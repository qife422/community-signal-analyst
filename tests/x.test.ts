import { afterEach, describe, expect, it, vi } from "vitest";
import { buildXSearch, collectX, rejectXPost } from "../src/adapters/x.js";
import { runLiveCommunitySignalAnalysis } from "../src/index.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";
import { scoreItem } from "../src/scoring/scoreItem.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.X_API_ENABLED;
  delete process.env.X_BEARER_TOKEN;
});

describe("X paid read gate", () => {
  it("makes no request without explicit paid-read opt-in", async () => {
    process.env.X_BEARER_TOKEN = "test-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await collectX(parseQuery("Find recent X AI coding posts"), new Date("2026-09-27"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.queriedPlatforms).toEqual([]);
    expect(result.limitations[0]).toContain("X_API_ENABLED=true");
  });

  it("makes no request when opted in but the token is missing", async () => {
    process.env.X_API_ENABLED = "true";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await collectX(parseQuery("Find recent X AI coding posts"), new Date("2026-09-27"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.limitations[0]).toContain("X_BEARER_TOKEN");
  });

  it("runs one bounded recent search and normalizes original post URLs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
    process.env.X_API_ENABLED = "true";
    process.env.X_BEARER_TOKEN = "test-token";
    const fetchMock = vi.fn(async (_input: string | URL, _options?: RequestInit) => ({ ok: true, json: async () => ({ data: [
      { id: "123", text: "I tested an AI coding workflow in production because the generated patch missed three failing tests. Adding a review gate caught the regression before release.", created_at: "2026-09-28T10:00:00Z", public_metrics: { like_count: 7, reply_count: 3, repost_count: 2 } },
      { id: "old", text: "AI coding old post", created_at: "2026-09-20T10:00:00Z" }
    ] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await collectX(parseQuery("Find X AI coding posts from the past 14 days"), new Date("2026-09-21T12:00:00Z"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, options] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe("https://api.x.com/2/tweets/search/recent");
    expect(url.searchParams.get("max_results")).toBe("10");
    expect(url.searchParams.get("query")).toContain("AI coding");
    expect(url.searchParams.get("query")).toContain("-is:reply");
    expect(url.searchParams.get("query")).toContain("(tested OR benchmark OR production OR bug OR review OR cost)");
    expect(url.searchParams.get("sort_order")).toBe("relevancy");
    expect(url.searchParams.get("post.fields")).toContain("referenced_posts");
    expect(url.searchParams.get("start_time")).toMatch(/^2026-09-21T12:10:/);
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(result.queriedPlatforms).toEqual(["x"]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].url).toBe("https://x.com/i/web/status/123");
    expect(result.items[0].engagementMetrics.commentsCount).toBe(3);
    expect(result.items[0].comments).toEqual([]);
    expect(result.limitations.some((line) => line.includes("七天"))).toBe(true);
  });

  it("reports API failures without inventing data or retrying", async () => {
    process.env.X_API_ENABLED = "true";
    process.env.X_BEARER_TOKEN = "test-token";
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await collectX(parseQuery("X AI coding"), new Date(Date.now() - 86_400_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([]);
    expect(result.limitations.some((line) => line.includes("429"))).toBe(true);
  });

  it("rejects invalid, future and out-of-window timestamps and processes at most 10 returned roots", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T04:00:00Z"));
    process.env.X_API_ENABLED = "true";
    process.env.X_BEARER_TOKEN = "test-token";
    const text = "I tested an AI coding workflow in production and found three failing tests. A review gate caught the regression before release.";
    const data = [
      { id: "invalid", text, created_at: "invalid" },
      { id: "future", text, created_at: "2026-09-30T04:00:00Z" },
      { id: "old", text, created_at: "2026-09-22T04:05:00Z" },
      ...Array.from({ length: 10 }, (_, index) => ({ id: `valid-${index}`, text, created_at: "2026-09-28T04:00:00Z" }))
    ];
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data }) }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await collectX(parseQuery("Find X AI coding posts from the past 14 days"), new Date("2026-09-15T04:00:00Z"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.items.map((item) => item.id)).toEqual(Array.from({ length: 7 }, (_, index) => `valid-${index}`));
  });

  it("searches a named tool instead of generic AI coding terms", () => {
    const parsed = parseQuery("Find recent X Cursor reviews in English");
    expect(parsed.keywords[0]).toBe("Cursor");
    expect(buildXSearch(parsed)?.query).toBe('"Cursor" (tested OR benchmark OR production OR bug OR review OR cost) -is:retweet -is:reply');
  });

  it("rejects a replay of the low-value live replies and shallow hype", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T04:00:00Z"));
    process.env.X_API_ENABLED = "true";
    process.env.X_BEARER_TOKEN = "test-token";
    const weak = [
      { id: "1", text: "@cavsdan A wealth manager learned how to build software, imagine if Buffett learned how to use AI coding tools. I have a portfolio of companies and am not slowing down.", created_at: "2026-09-29T03:28:42Z", public_metrics: { like_count: 0, reply_count: 1, repost_count: 0 }, referenced_posts: [{ type: "replied_to" }] },
      { id: "2", text: "AI coding tools are amazing and the future of everything. Everyone should be using them now because this is a revolution and I am so excited to see what comes next.", created_at: "2026-09-29T03:27:55Z", public_metrics: { like_count: 0, reply_count: 1, repost_count: 0 } }
    ];
    expect(rejectXPost(weak[0], ["AI coding"])).toBe("reply");
    expect(rejectXPost(weak[1], ["AI coding"])).toBe("shallow");
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: weak }) }));
    vi.stubGlobal("fetch", fetchMock);
    const brief = await runLiveCommunitySignalAnalysis("Find 3 recent X AI coding posts in English");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(brief.selectedItems).toEqual([]);
    expect(brief.dataLimitations.some((line) => line.includes("quality gate rejected 2"))).toBe(true);
  });

  it("keeps evidence-rich research leads from a real-shaped response without inventing comment quality", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T04:00:00Z"));
    process.env.X_API_ENABLED = "true";
    process.env.X_BEARER_TOKEN = "test-token";
    const data = [
      { id: "study", text: "AI coding study of 6,700 merged pull requests found follow-up fixes at 1.6 times the rate of comparable human pull requests. The result raises a review workflow question.", created_at: "2026-09-28T10:00:00Z", public_metrics: { like_count: 1, reply_count: 3, repost_count: 0 } },
      { id: "refactor", text: "One AI coding agent refactored a million-line codebase in 19 hours. The result cut non-test code by 34%, but the run cost about $25,000 and introduced regressions needing review.", created_at: "2026-09-28T11:00:00Z", public_metrics: { like_count: 7, reply_count: 0, repost_count: 4 } },
      { id: "benchmark", text: "AI coding agents may be getting more efficient. Researchers benchmarked a coding agent on 51 tasks and report 44.7% lower token use and about 33% lower API cost.", created_at: "2026-09-28T11:30:00Z", public_metrics: { like_count: 0, reply_count: 1, repost_count: 0 } },
      { id: "workflow", text: "My AI coding workflow: - Strong model creates a PRD - An agent writes tickets - I review the changes - Repeat. The process matters as much as the model.", created_at: "2026-09-28T11:45:00Z", public_metrics: { like_count: 3, reply_count: 1, repost_count: 0 } },
      { id: "ad", text: "I installed @vendorOne and tested an AI coding workflow in production. This review shows it blocking a bug, so check out @vendorTwo for the full demo at https://t.co/example", created_at: "2026-09-28T12:00:00Z", public_metrics: { like_count: 5, reply_count: 0, repost_count: 2 } }
    ];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data }) })));
    const brief = await runLiveCommunitySignalAnalysis("Find 3 recent X AI coding posts in English");
    expect(brief.selectedItems.map((item) => item.id)).toEqual(["refactor", "study", "benchmark"]);
    expect(brief.selectedItems.every((item) => item.scores.discussionQuality === 0)).toBe(true);
    expect(brief.dataLimitations.some((line) => line.includes("promotion 1"))).toBe(true);
    expect(brief.dataLimitations).toContain("X reply counts are visible, but reply content was not fetched; community opinions and trends are not inferred.");
    expect(brief.markdown).toContain("7 likes; 4 reposts; 0 replies");
  });

  it("keeps the available long-form text, author, and unchecked source links in one request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T04:00:00Z"));
    process.env.X_API_ENABLED = "true";
    process.env.X_BEARER_TOKEN = "test-token";
    const fullText = "I tested an AI coding review workflow on 120 pull requests and found it caught 18 regressions before merge. The original post text was truncated, but this note includes the method, sample, and observed result.";
    const fetchMock = vi.fn(async (_input: string | URL) => ({ ok: true, json: async () => ({
      data: [{
        id: "long", text: "AI coding study truncated…", note_post: {
          text: fullText,
          entities: { urls: [{ expanded_url: "https://example.org/study" }, { expanded_url: "http://unsafe.example/study" }] }
        },
        author_id: "author-1", created_at: "2026-09-28T10:00:00Z",
        public_metrics: { like_count: 12, reply_count: 2, repost_count: 1 }
      }], includes: { users: [{ id: "author-1", username: "researcher" }] }
    }) }));
    vi.stubGlobal("fetch", fetchMock);
    const brief = await runLiveCommunitySignalAnalysis("Find recent X AI coding posts in English");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("post.fields")).toContain("note_post");
    expect(url.searchParams.get("expansions")).toBe("author_id");
    expect(brief.selectedItems).toHaveLength(1);
    expect(brief.selectedItems[0]).toMatchObject({
      author: "@researcher", rawExcerpt: fullText, textSource: "note_post",
      citedUrls: ["https://example.org/study"], claimVerification: "author_claim_unverified"
    });
    expect(brief.markdown).toContain("research figures and conclusions are author claims, not independently verified");
    expect(brief.markdown).toContain("https://example.org/study");
  });

  it("requires visible engagement when the user asks for popular posts", () => {
    const post = { text: "AI coding study of 6,700 merged pull requests found follow-up fixes at 1.6 times the rate of comparable human pull requests. The result raises a review workflow question.", public_metrics: { like_count: 1, reply_count: 3, repost_count: 0 } };
    expect(rejectXPost(post, ["AI coding"])).toBeUndefined();
    expect(rejectXPost(post, ["AI coding"], true)).toBe("low_engagement");
  });

  it("searches Nvidia aliases and accepts concrete earnings analysis", () => {
    const parsed = parseQuery("Find recent X Nvidia discussion");
    expect(buildXSearch(parsed)?.query).toBe("(Nvidia OR NVDA) -is:retweet -is:reply");
    const post = { text: "NVDA earnings revenue grew 25% this quarter, but gross margin declined 3 points and management cut its guidance. The result changes the valuation risk for next year." };
    expect(rejectXPost(post, ["Nvidia", "NVDA"])).toBeUndefined();
  });

  it("counts X likes in engagement without inventing comments", () => {
    const parsed = parseQuery("Find recent X AI coding posts");
    const item = {
      id: "liked", platform: "x" as const, contentType: "post" as const,
      title: "AI coding study", url: "https://x.com/i/web/status/liked",
      publishedAt: new Date().toISOString(), fetchedAt: new Date().toISOString(),
      summary: "AI coding study", engagementMetrics: { points: 100, reactions: 0, commentsCount: 0 },
      comments: [], isMockData: false, sourceStatus: "verified_api" as const
    };
    const scored = scoreItem(item, parsed);
    expect(scored.scores.engagement).toBeGreaterThan(40);
    expect(scored.scores.discussionQuality).toBe(0);
  });
});
