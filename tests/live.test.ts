import { afterEach, describe, expect, it, vi } from "vitest";
import { runLiveCommunitySignalAnalysis } from "../src/index.js";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.unstubAllEnvs(); delete process.env.X_API_ENABLED; delete process.env.X_BEARER_TOKEN; });

describe("live collection", () => {
  it("uses verified HN data and excludes content outside the requested time range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00.000Z"));
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      let body: unknown = [];
      if (url.includes("hn.algolia.com")) body = { hits: [] };
      if (url.includes("topstories.json")) body = [1, 2];
      if (url.includes("item/1.json")) body = { id: 1, type: "story", title: "AI coding workflow review", time: Date.parse("2026-09-28T10:00:00Z") / 1000, score: 45, descendants: 1, kids: [3], by: "author" };
      if (url.includes("item/2.json")) body = { id: 2, type: "story", title: "AI coding old post", time: Date.parse("2026-09-20T10:00:00Z") / 1000, score: 999 };
      if (url.includes("item/3.json")) body = { id: 3, type: "comment", text: "I used this workflow for a month and found review time matters more than generation speed.", by: "reader" };
      return { ok: true, json: async () => body };
    }));
    const brief = await runLiveCommunitySignalAnalysis("找最近 24h Hacker News 的 AI coding 讨论");
    expect(brief.selectedItems.map((item) => item.id)).toEqual(["1"]);
    expect(brief.selectedItems[0].sourceStatus).toBe("verified_api");
    expect(brief.selectedItems[0].comments[0].url).toBe("https://news.ycombinator.com/item?id=3");
    expect(brief.markdown).toContain("真实官方 API（需权限的平台仅在授权时查询）；无 mock 数据");
    expect(brief.markdown).not.toContain("AI coding old post");
    const english = await runLiveCommunitySignalAnalysis("Find recent Hacker News AI coding discussions in English");
    expect(english.parsedQuery.language).toBe("en");
    expect(english.markdown).toContain("## Selected items");
    expect(english.markdown).toContain("Source excerpt:");
    expect(english.markdown).not.toContain("数据不可用");
  });

  it("reports inaccessible sources without inventing results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 })));
    const brief = await runLiveCommunitySignalAnalysis("找最近 Hacker News 的 AI coding 讨论");
    expect(brief.selectedItems).toHaveLength(0);
    expect(brief.queriedPlatforms).toEqual(["hacker_news"]);
    expect(brief.markdown).toContain("没有符合条件的内容");
    expect(brief.dataLimitations.some((line) => line.includes("获取失败"))).toBe(true);
  });

  it("does not query substitute platforms when Reddit credentials are absent", async () => {
    delete process.env.REDDIT_ACCESS_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const brief = await runLiveCommunitySignalAnalysis("找最近 Reddit 的 AI coding 讨论");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(brief.selectedItems).toHaveLength(0);
    expect(brief.queriedPlatforms).toEqual([]);
    expect(brief.dataLimitations).toContain("权限限制：未提供 REDDIT_ACCESS_TOKEN；Reddit 未查询。");
    expect(brief.markdown).toContain("实际查询平台：无");
    expect(brief.markdown).not.toContain("候选范围有限：Reddit");
  });

  it("selects a relevant public issue with a traceable comment and rejects bot noise", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00.000Z"));
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      const issue = { id: 7, title: "PostgreSQL query latency regression", html_url: "https://github.com/example/db/issues/7", body: "PostgreSQL 17 query performance regressed after the upgrade. Benchmark results show doubled latency.", created_at: "2026-09-27T10:00:00Z", comments: 3, comments_url: "https://api.github.com/repos/example/db/issues/7/comments", user: { login: "maintainer" }, labels: [{ name: "performance" }] };
      const bot = { ...issue, id: 8, title: "PostgreSQL migration tracking", html_url: "https://github.com/example/db/issues/8", user: { login: "planner[bot]" } };
      const body = url.includes("search/issues") ? { items: [bot, issue] }
        : url.includes("search/repositories") ? { items: [] }
        : url.includes("issues/7/comments") ? [{ body: "I reproduced the latency regression with the same query plan and have a benchmark showing it doubles after upgrade.", html_url: "https://github.com/example/db/issues/7#issuecomment-1", user: { login: "user" } }]
        : [];
      return { ok: true, json: async () => body };
    }));
    const brief = await runLiveCommunitySignalAnalysis("找 5 条近 14 天 GitHub 关于 PostgreSQL 性能的讨论");
    expect(brief.parsedQuery.maxItems).toBe(5);
    expect(brief.selectedItems.map((item) => item.id)).toEqual(["issue-7"]);
    expect(brief.selectedItems[0].comments[0].url).toBe("https://github.com/example/db/issues/7#issuecomment-1");
  });

  it("counts one project once when it appears on HN and GitHub", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00.000Z"));
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      let body: unknown = [];
      if (url.includes("hn.algolia.com")) body = { hits: [] };
      else if (url.includes("topstories.json")) body = [21, 23];
      else if (url.includes("item/21.json")) body = { id: 21, type: "story", title: "Vibe Coding Production Kit – workflow for AI coding agents", url: "https://github.com/maker/Vibe-Coding-Production-Kit", time: Date.parse("2026-09-28T10:00:00Z") / 1000, score: 50, descendants: 1, kids: [22], by: "maker" };
      else if (url.includes("item/22.json")) body = { id: 22, text: "I tested this coding workflow and found the review gates useful for production projects.", by: "reader" };
      else if (url.includes("item/23.json")) body = { id: 23, type: "story", title: "AI coding workflow failures in production", time: Date.parse("2026-09-28T09:00:00Z") / 1000, score: 35, descendants: 1, kids: [24], by: "practitioner" };
      else if (url.includes("item/24.json")) body = { id: 24, text: "We used this coding agent workflow and repeatedly found review failures after deployment, so we added human validation.", by: "reviewer" };
      else if (url.includes("search/repositories")) body = { items: [{ id: 31, full_name: "maker/Vibe-Coding-Production-Kit", html_url: "https://github.com/maker/Vibe-Coding-Production-Kit", description: "Production workflow for AI coding agents and Codex", created_at: "2026-09-27T10:00:00Z", updated_at: "2026-09-28T10:00:00Z", stargazers_count: 55, forks_count: 5, open_issues_count: 2, owner: { login: "maker" }, topics: ["AI coding", "Codex"] }] };
      else if (url.includes("search/issues")) body = { items: [] };
      return { ok: true, json: async () => body };
    }));
    const brief = await runLiveCommunitySignalAnalysis("找最近 Hacker News GitHub 的 AI coding 讨论");
    expect(brief.selectedItems).toHaveLength(2);
    expect(brief.selectedItems.map((item) => item.id)).toEqual(expect.arrayContaining(["21", "23"]));
    expect(brief.selectedItems.find((item) => item.id === "21")?.citedUrls).toEqual(["https://github.com/maker/Vibe-Coding-Production-Kit"]);
    expect(brief.crossPlatformTrends.join("\n")).toContain("同一链接");
    expect(brief.crossPlatformTrends.join("\n")).toContain("不能视为对其结论的独立核验");
  });

  it("groups an X post and GitHub repo sharing a project link without claiming independent proof", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00.000Z"));
    process.env.X_API_ENABLED = "true";
    process.env.X_BEARER_TOKEN = "test-token";
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      const repo = { id: 77, full_name: "acme/AI-Coding-Review-Kit", html_url: "https://github.com/acme/AI-Coding-Review-Kit", description: "Production review workflow for AI coding agents", created_at: "2026-09-27T10:00:00Z", updated_at: "2026-09-28T10:00:00Z", stargazers_count: 80, forks_count: 8, open_issues_count: 2, owner: { login: "acme" }, topics: ["AI coding"] };
      const body = url.includes("api.x.com") ? { data: [{
        id: "x77", text: "I tested an AI coding review workflow on a production service. It caught 3 regressions before release, and the GitHub repo documents the failing tests and repair method.",
        created_at: "2026-09-28T09:00:00Z", public_metrics: { like_count: 12, reply_count: 1, repost_count: 3 },
        entities: { urls: [{ expanded_url: "https://github.com/acme/AI-Coding-Review-Kit?utm_source=x" }] }
      }] } : url.includes("search/repositories") ? { items: [repo] } : { items: [] };
      return { ok: true, json: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);
    const brief = await runLiveCommunitySignalAnalysis("Find 3 recent X GitHub AI coding posts in English");
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("api.x.com"))).toHaveLength(1);
    expect(brief.queriedPlatforms).toEqual(["github", "x"]);
    expect(brief.selectedItems).toHaveLength(1);
    expect(brief.crossPlatformTrends.join("\n")).toContain("same reference");
    expect(brief.crossPlatformTrends.join("\n")).toContain("not independent verification");
    expect(brief.markdown).not.toContain("This corroborates one project");
  });
});

it("never queries either deferred platform even when synthetic credentials and permissions are enabled",async()=>{
  for(const [k,v] of Object.entries({REDDIT_ACCESS_TOKEN:"synthetic-token",REDDIT_USER_AGENT:"script:test:1.0 (by /u/test)",REDDIT_API_APPROVED:"true",DISCORD_API_ENABLED:"true",DISCORD_BOT_TOKEN:"synthetic-token",DISCORD_SCOPE_FILE:"/synthetic/nonexistent/scope.json"}))vi.stubEnv(k,v);
  const fetchMock=vi.fn(async(input:string|URL)=>{
    const url=String(input);if(/reddit|discord/i.test(url))throw new Error("Deferred platform queried");
    const body=url.includes("hn.algolia.com")?{hits:[]}:url.includes("api.github.com")?{items:[]}:[];
    return {ok:true,json:async()=>body};
  });vi.stubGlobal("fetch",fetchMock);
  const brief=await runLiveCommunitySignalAnalysis("找全平台（不含 Discord 和 Reddit）Whop 的 PostgreSQL 性能讨论");
  expect(brief.parsedQuery.platforms).toEqual(["hacker_news","github","devto","product_hunt","x","whop"]);
  expect(fetchMock.mock.calls.every(([url])=>!/reddit|discord/i.test(String(url)))).toBe(true);
  expect(brief.queriedPlatforms).not.toContain("discord");expect(brief.queriedPlatforms).not.toContain("reddit");
  expect(brief.dataLimitations.join(" ")).not.toMatch(/Discord 未查询|Reddit 未查询/);
});
