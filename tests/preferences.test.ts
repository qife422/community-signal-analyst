import { describe, expect, it, vi, afterEach } from "vitest";
import { defaultProfile, type AttentionRule } from "../src/profile/schema.js";
import { applyProfileQuery, filterAttention, sourceAttention } from "../src/preferences.js";
import { runLiveCommunitySignalAnalysis } from "../src/index.js";
import type { SourceItem } from "../src/types/communitySignal.js";
const rule = (overrides: Partial<AttentionRule> = {}): AttentionRule => ({ id: "coding", enabled: true, sources: ["hacker_news"], authors: [], includeAny: [], ...overrides });
const item = (id: string, author?: string, text = "Codex") => ({ id, platform: "hacker_news" as const, author, text });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("explainable personal filtering", () => {
  it("uses AND within a rule, OR across rules, and excludes first", () => {
    const p = defaultProfile(); p.rules = [rule({ authors: [{ kind: "captured_author", value: "Alice" }], includeAny: ["Codex"] }), rule({ id: "other", includeAny: ["Cursor"] })]; p.excludeAny = ["招聘"];
    const input = [item("yes", "ALICE", "Ｃｏｄｅｘ"), item("author-no", "Bob"), item("other", "Bob", "Cursor"), item("blocked", "Alice", "Codex 招聘"), item("missing")];
    const result = filterAttention(input, p);
    expect(result.items.map(i => i.id)).toEqual(["yes", "other"]);
    expect(result.attention.counts).toMatchObject({ excluded: 1, unmatched: 2, authorUnavailable: 1 });
    expect(filterAttention(input, { ...p, rules: [...p.rules].reverse() }).items).toEqual(result.items);
    expect(input[0].text).toBe("Ｃｏｄｅｘ");
  });
  it("does not conflate sources, names, @ handles, or reply authors", () => {
    const p = defaultProfile(); p.rules = [rule({ authors: [{ kind: "captured_author", value: "Alice" }] })];
    expect(filterAttention([{ ...item("other-source", "Alice"), platform: "github" }, item("at", "@Alice"), item("exact", " Alice ")], p).items.map(i => i.id)).toEqual(["exact"]);
    const root = { ...item("root", "Bob"), title: "Codex", summary: "sample", url: "https://example.com", contentType: "discussion", fetchedAt: "2026-10-08T00:00:00Z", comments: [{ source: "hacker_news", author: "Alice", summary: "Codex", signalType: "technical", isDirectQuote: false }], engagementMetrics: {}, isMockData: false, sourceStatus: "verified_api" } as SourceItem;
    expect(sourceAttention([root], p).items).toEqual([]);
  });
  it("treats empty or disabled rules as unlimited and keeps Whop scopes separate", () => {
    const p = defaultProfile(); p.rules = [rule({ enabled: false, includeAny: ["Never"] })];
    expect(filterAttention([item("yes")], p).items).toHaveLength(1);
    p.defaults.platforms = ["whop"]; p.rules = [rule({ sources: ["whop"], experienceId: "exp_One" })];
    const one = { ...item("one"), platform: "whop" as const, experienceId: "exp_One" };
    expect(filterAttention([one, { ...one, id: "two", experienceId: "exp_Two" }], p, ["exp_One"]).items).toEqual([one]);
    expect(filterAttention([one], p, []).items).toEqual([]);
  });
  it("uses defaults only when not explicitly requested and never expands sources", () => {
    const p = defaultProfile(); p.defaults = { ...p.defaults, language: "en", maxItems: 5, timeRange: "recent_30d", platforms: ["github"] };
    expect(applyProfileQuery(undefined, p)).toMatchObject({ language: "en", maxItems: 5, timeRange: "recent_30d", platforms: ["github"] });
    expect(applyProfileQuery("用中文找近3天 GitHub 的 AI coding 讨论，2条", p)).toMatchObject({ language: "zh", maxItems: 2, timeRange: "recent_3d", platforms: ["github"] });
    expect(applyProfileQuery("找近7天 X 帖子", p).platforms).toEqual([]);
    expect(applyProfileQuery("GitHub AI coding top 2", p).maxItems).toBe(2);
    expect(applyProfileQuery("GitHub AI coding 两条", p).maxItems).toBe(2);
  });
  it("makes zero network calls when requested platforms do not intersect", async () => {
    const p = defaultProfile(); p.defaults.platforms = ["whop"];
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("not allowed"));
    const result = await runLiveCommunitySignalAnalysis("找近7天 Hacker News AI coding 讨论", p);
    expect(result.selectedItems).toEqual([]); expect(fetch).not.toHaveBeenCalled(); expect(result.attention?.profileId).toBe("my-research");
  });
  it("finds a qualifying author outside the old Top N without rescuing bot noise", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    const fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      const body = url.includes("algolia") ? { hits: [] } : /(?:top|new|ask|show)stories/.test(url) ? [1, 2, 3]
        : { id: Number(url.match(/item\/(\d+)/)?.[1]), type: "story", title: "Codex AI coding workflow review", by: url.includes("/1.") ? "Popular" : url.includes("/2.") ? "Followed" : "Followed[bot]", score: url.includes("/1.") ? 999 : 80, descendants: 3, time: Date.parse("2026-10-08T10:00:00Z") / 1000 };
      return { ok: true, json: async () => body };
    });
    vi.stubGlobal("fetch", fetch);
    const p = defaultProfile(); p.defaults.platforms = ["hacker_news"]; p.defaults.maxItems = 1;
    p.rules = [rule({ authors: [{ kind: "captured_author", value: "Followed" }, { kind: "captured_author", value: "Followed[bot]" }] })];
    const result = await runLiveCommunitySignalAnalysis("找近7天 Hacker News 的 AI coding workflow", p);
    expect(result.selectedItems.map(i => i.id)).toEqual(["2"]);
    expect(result.attention?.counts.qualityRejected).toBe(1); expect(result.attention?.matches[0].ruleIds).toEqual(["coding"]);
  });
});
