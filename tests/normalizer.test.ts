import { describe, expect, it } from "vitest";
import { loadMockDevToItems } from "../src/adapters/mockDevToAdapter.js";
import { loadMockGitHubItems } from "../src/adapters/mockGitHubAdapter.js";
import { loadMockHackerNewsItems } from "../src/adapters/mockHackerNewsAdapter.js";
import { normalizeItems } from "../src/normalizer/normalizeItems.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";

describe("mock data normalization", () => {
  it("normalizes HN, GitHub, and dev.to mock items into SourceItem records", () => {
    const parsed = parseQuery("帮我找最近 AI coding 工具比较火的内容");
    const rawItems = [
      ...loadMockHackerNewsItems(),
      ...loadMockGitHubItems(),
      ...loadMockDevToItems()
    ];

    const normalized = normalizeItems(rawItems, parsed);

    expect(normalized).toHaveLength(13);
    expect(new Set(normalized.map((item) => item.platform))).toEqual(new Set(["devto", "github", "hacker_news"]));
    expect(normalized.every((item) => item.isMockData)).toBe(true);
    expect(normalized.every((item) => item.dataLabel === "示例数据")).toBe(true);
    expect(normalized.every((item) => item.fetchedAt)).toBe(true);
    expect(normalized.every((item) => item.sourceStatus === "mock_data")).toBe(true);
  });
});
