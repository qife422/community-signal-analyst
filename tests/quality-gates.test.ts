import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMockDevToItems } from "../src/adapters/mockDevToAdapter.js";
import { loadMockGitHubItems } from "../src/adapters/mockGitHubAdapter.js";
import { loadMockHackerNewsItems } from "../src/adapters/mockHackerNewsAdapter.js";
import { runCommunitySignalAnalysis } from "../src/index.js";
import { normalizeItems } from "../src/normalizer/normalizeItems.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";
import { scoreItem } from "../src/scoring/scoreItem.js";
import { selectTopItems } from "../src/scoring/selectTopItems.js";

const allRawItems = () => [...loadMockHackerNewsItems(), ...loadMockGitHubItems(), ...loadMockDevToItems()];

describe("offline demo quality gates", () => {
  afterEach(() => vi.useRealTimers());
  it("keeps low-relevance high-engagement items away from the top result", () => {
    const parsed = parseQuery("帮我找最近 AI coding 工具比较火的内容");
    const scored = normalizeItems(allRawItems(), parsed).map((item) => scoreItem(item, parsed));
    const selected = selectTopItems(scored, 3);

    expect(selected[0].id).not.toContain("low-relevance");
    expect(selected.every((item) => item.id.includes("low-relevance"))).toBe(false);
  });

  it("allows high-relevance lower-engagement items to enter the final selection", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T00:00:00.000Z"));
    const brief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");

    expect(brief.selectedItems.some((item) => item.id.includes("high-relevance-low-engagement"))).toBe(true);
  });

  it("builds trend summaries from selected item signals instead of static filler", () => {
    const aiBrief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");
    const investmentBrief = runCommunitySignalAnalysis("看看最近大家对英伟达财报怎么看");

    expect(aiBrief.crossPlatformTrends.join("\n")).toContain("agentic coding");
    expect(investmentBrief.crossPlatformTrends.join("\n")).toContain("earnings");
    expect(aiBrief.crossPlatformTrends).not.toEqual(investmentBrief.crossPlatformTrends);
  });

  it("selects items from at least two platforms when enough candidates exist", () => {
    const brief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");
    const platforms = new Set(brief.selectedItems.map((item) => item.platform));

    expect(platforms.size).toBeGreaterThanOrEqual(2);
  });

  it("keeps every mock item explicitly labeled as example data", () => {
    const raw = allRawItems();

    expect(raw.length).toBeGreaterThanOrEqual(9);
    expect(raw.every((item) => item.isMockData === true)).toBe(true);
    expect(raw.every((item) => item.dataLabel === "示例数据")).toBe(true);
    expect(raw.every((item) => item.url.startsWith("mock://"))).toBe(true);
  });
});
