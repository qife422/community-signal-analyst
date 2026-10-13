import { describe, expect, it } from "vitest";
import { loadMockDevToItems } from "../src/adapters/mockDevToAdapter.js";
import { loadMockGitHubItems } from "../src/adapters/mockGitHubAdapter.js";
import { loadMockHackerNewsItems } from "../src/adapters/mockHackerNewsAdapter.js";
import { normalizeItems } from "../src/normalizer/normalizeItems.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";
import { scoreItem } from "../src/scoring/scoreItem.js";
import { selectTopItems } from "../src/scoring/selectTopItems.js";

describe("scoring", () => {
  it("computes weighted scores with expected dimensions", () => {
    const parsed = parseQuery("帮我找最近 AI coding 工具比较火的内容");
    const [item] = normalizeItems(loadMockHackerNewsItems(), parsed);

    const scored = scoreItem(item, parsed);

    expect(scored.scores.total).toBeGreaterThan(0);
    expect(scored.scores.relevance).toBeGreaterThan(0);
    expect(scored.scores.engagement).toBeGreaterThan(0);
    expect(scored.scoreRationale.length).toBeGreaterThan(0);
  });

  it("selects at most top three items in descending score order", () => {
    const parsed = parseQuery("帮我找最近 AI coding 工具比较火的内容");
    const items = normalizeItems(
      [...loadMockHackerNewsItems(), ...loadMockGitHubItems(), ...loadMockDevToItems()],
      parsed
    ).map((item) => scoreItem(item, parsed));

    const selected = selectTopItems(items, 3);

    expect(selected).toHaveLength(3);
    expect(selected[0].scores.total).toBeGreaterThanOrEqual(selected[1].scores.total);
    expect(selected[1].scores.total).toBeGreaterThanOrEqual(selected[2].scores.total);
  });

  it("penalizes low relevance even when engagement is high", () => {
    const parsed = parseQuery("帮我找最近 AI coding 工具比较火的内容");
    const scored = normalizeItems(
      [...loadMockHackerNewsItems(), ...loadMockGitHubItems(), ...loadMockDevToItems()],
      parsed
    ).map((item) => scoreItem(item, parsed));

    const lowRelevant = scored.find((item) => item.id.includes("low-relevance"));
    const highRelevantLowEngagement = scored.find((item) => item.id.includes("high-relevance-low-engagement"));

    expect(lowRelevant?.scores.relevance).toBeLessThan(35);
    expect(highRelevantLowEngagement?.scores.total).toBeGreaterThan(lowRelevant?.scores.total ?? 0);
  });
});
