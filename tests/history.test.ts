import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recordHistory } from "../src/history.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";
import type { CommunitySignalBrief, ScoredItem } from "../src/types/communitySignal.js";

function brief(points: number): CommunitySignalBrief {
  const item = { id: "42", platform: "hacker_news", title: "AI coding review", url: "https://news.ycombinator.com/item?id=42", engagementMetrics: { points, commentsCount: 10 } } as ScoredItem;
  return { parsedQuery: parseQuery("Hacker News AI coding"), selectedItems: [item], quickTakeaways: [], crossPlatformTrends: [], nextSteps: [], dataLimitations: [], markdown: "# Brief\n" };
}

describe("history snapshots", () => {
  it("compares the same source and metric across opt-in snapshots", () => {
    const dir = mkdtempSync(join(tmpdir(), "community-history-")); const path = join(dir, "history.json");
    try {
      expect(recordHistory(brief(20), path).historyComparison?.status).toBe("first_snapshot");
      const second = recordHistory(brief(35), path);
      expect(second.historyComparison?.status).toBe("compared");
      expect(second.historyComparison?.changes.find((change) => change.metric === "points")?.delta).toBe(15);
      expect(JSON.parse(readFileSync(path, "utf8")).snapshots).toHaveLength(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("keeps an invalid history file untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "community-history-")); const path = join(dir, "history.json");
    try { writeFileSync(path, "not json"); expect(() => recordHistory(brief(10), path)).toThrow(); expect(readFileSync(path, "utf8")).toBe("not json"); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("does not save a snapshot without a verified selected source", () => {
    const dir = mkdtempSync(join(tmpdir(), "community-history-")); const path = join(dir, "history.json");
    try {
      const empty = brief(10); empty.selectedItems = [];
      expect(recordHistory(empty, path).historyComparison?.status).toBe("no_evidence");
      expect(existsSync(path)).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
