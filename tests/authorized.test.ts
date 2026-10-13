import { afterEach, describe, expect, it, vi } from "vitest";
import { collectProductHunt, collectReddit } from "../src/adapters/authorized.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";

afterEach(() => { vi.unstubAllGlobals(); delete process.env.REDDIT_ACCESS_TOKEN; delete process.env.REDDIT_USER_AGENT; delete process.env.REDDIT_API_APPROVED; delete process.env.PRODUCT_HUNT_TOKEN; });

describe("credential-gated adapters", () => {
  it("does not call Product Hunt without a token", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const result = await collectProductHunt(parseQuery("Product Hunt AI coding"), new Date("2026-09-20"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.limitations[0]).toContain("PRODUCT_HUNT_TOKEN");
  });

  it("does not call Reddit with a token but no identifying User-Agent", async () => {
    process.env.REDDIT_ACCESS_TOKEN = "test-token";
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const result = await collectReddit(parseQuery("Reddit AI coding"), new Date("2026-09-20"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.queriedPlatforms).toEqual([]);
    expect(result.limitations[0]).toContain("REDDIT_USER_AGENT");
  });

  it("normalizes authenticated Reddit posts and original comments", async () => {
    process.env.REDDIT_ACCESS_TOKEN = "test-token";
    process.env.REDDIT_USER_AGENT = "script:community-signal-analyst:1.1 (by /u/tester)";
    process.env.REDDIT_API_APPROVED = "true";
    const fetchMock = vi.fn(async (input: string | URL, _options?: RequestInit) => {
      const url = String(input);
      const body = url.includes("comments/")
        ? [{ data: { children: [] } }, { data: { children: [{ kind: "t1", data: { body: "I used this coding tool in production and found the review workflow catches several bugs before shipping.", author: "reader", score: 15, permalink: "/r/coding/comments/abc/post/def/" } }] } }]
        : { data: { children: [{ kind: "t3", data: { id: "abc", title: "AI coding workflow review", selftext: "Tested in production", author: "maker", subreddit: "coding", permalink: "/r/coding/comments/abc/post/", created_utc: Date.parse("2026-09-27") / 1000, score: 42, num_comments: 10 } }] } };
      return { ok: true, json: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await collectReddit(parseQuery("Reddit AI coding"), new Date("2026-09-20"));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].comments[0].url).toContain("reddit.com/r/coding/comments/");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)["User-Agent"]).toContain("/u/tester");
  });

  it("does not query Reddit when approval for the use case is unconfirmed", async () => {
    process.env.REDDIT_ACCESS_TOKEN = "test-token";
    process.env.REDDIT_USER_AGENT = "script:community-signal-analyst:1.1 (by /u/tester)";
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const result = await collectReddit(parseQuery("Reddit AI coding"), new Date("2026-09-20"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.queriedPlatforms).toEqual([]);
    expect(result.limitations[0]).toContain("REDDIT_API_APPROVED=true");
  });

  it("normalizes Product Hunt launches and detects GraphQL errors", async () => {
    process.env.PRODUCT_HUNT_TOKEN = "test-token";
    const post = {
      id: "101", name: "AI Coding Review", tagline: "Review agents for coding",
      url: "https://www.producthunt.com/posts/ai-coding-review", createdAt: "2026-09-10T12:00:00Z", featuredAt: "2026-09-27T12:00:00Z",
      votesCount: 130, commentsCount: 8, user: { username: "maker" },
      comments: { edges: [{ node: {
        body: "We tested this for a week and found the review workflow much safer than direct generation in our team.",
        url: "https://www.producthunt.com/posts/ai-coding-review#comment-1", user: { username: "reader" }
      } }] }
    };
    const fetchMock = vi.fn(async (_input: string | URL, options?: RequestInit) => {
      const { query } = JSON.parse(options?.body as string);
      return { ok: true, json: async () => query.includes("PostComments")
        ? { data: { post: { comments: post.comments } } }
        : { data: { posts: { edges: [{ node: post }] } } } };
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await collectProductHunt(parseQuery("Product Hunt AI coding"), new Date("2026-09-20"));
    expect(result.items[0].engagementMetrics.points).toBe(130);
    expect(result.items[0].publishedAt).toBe("2026-09-27T12:00:00Z");
    expect(result.items[0].comments[0].url).toContain("#comment-1");
    const request = fetchMock.mock.calls[0][1];
    expect(request?.method).toBe("POST");
    expect(JSON.parse(request?.body as string).variables.after).toBe("2026-09-20T00:00:00.000Z");
    expect(JSON.parse(request?.body as string).query).not.toContain("comments(first:");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ errors: [{ message: "unauthorized" }] }) })));
    const failed = await collectProductHunt(parseQuery("Product Hunt AI coding"), new Date("2026-09-20"));
    expect(failed.items).toEqual([]);
    expect(failed.limitations[0]).toContain("unauthorized");
  });
});
