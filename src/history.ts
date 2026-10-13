import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import type { CommunitySignalBrief, EngagementMetrics, HistoryComparison, Platform } from "./types/communitySignal.js";

type SnapshotItem = { platform: Platform; id: string; title: string; url: string; metrics: EngagementMetrics };
type Snapshot = { capturedAt: string; queryKey: string; items: SnapshotItem[] };
type HistoryFile = { schemaVersion: 1; snapshots: Snapshot[] };
const metrics: Array<keyof EngagementMetrics> = ["points", "stars", "reactions", "commentsCount", "forks"];

function queryKey(brief: CommunitySignalBrief): string {
  const q = brief.parsedQuery;
  return JSON.stringify({ topic: q.topic.toLowerCase(), keywords: q.keywords.map((word) => word.toLowerCase()).sort(), platforms: [...q.platforms].sort(), timeRange: q.timeRange });
}

function compare(previous: Snapshot | undefined, current: Snapshot): HistoryComparison {
  if (!previous) return { status: "first_snapshot", changes: [] };
  const old = new Map(previous.items.map((item) => [`${item.platform}:${item.id}`, item]));
  const changes = current.items.flatMap((item) => {
    const before = old.get(`${item.platform}:${item.id}`);
    if (!before) return [];
    return metrics.flatMap((metric) => {
      const previousValue = before.metrics[metric];
      const currentValue = item.metrics[metric];
      if (typeof previousValue !== "number" || typeof currentValue !== "number") return [];
      return [{ platform: item.platform, id: item.id, title: item.title, url: item.url, metric, previous: previousValue, current: currentValue, delta: currentValue - previousValue }];
    });
  });
  return { previousCapturedAt: previous.capturedAt, status: changes.length ? "compared" : "no_overlap", changes };
}

export function recordHistory(brief: CommunitySignalBrief, path: string): CommunitySignalBrief {
  if (!brief.selectedItems.length) {
    const en = brief.parsedQuery.language === "en";
    brief.historyComparison = { status: "no_evidence", changes: [] };
    brief.markdown += `\n## ${en ? "Saved snapshot comparison" : "历史快照比较"}\n\n- ${en ? "No verified selected source; no snapshot was saved." : "没有入选的可核查来源，本次未保存快照。"}\n`;
    return brief;
  }
  const resolved = resolve(path);
  let history: HistoryFile = { schemaVersion: 1, snapshots: [] };
  if (existsSync(resolved)) {
    if (statSync(resolved).size > 1_000_000) throw new Error("History file exceeds 1 MB; inspect it before adding more snapshots.");
    const parsed: unknown = JSON.parse(readFileSync(resolved, "utf8"));
    if (!parsed || typeof parsed !== "object" || (parsed as HistoryFile).schemaVersion !== 1 || !Array.isArray((parsed as HistoryFile).snapshots)) throw new Error("History file schema is invalid; it was not overwritten.");
    history = parsed as HistoryFile;
  }
  if (history.snapshots.length >= 100) throw new Error("History has reached 100 snapshots; inspect it before adding more.");
  const current: Snapshot = { capturedAt: new Date().toISOString(), queryKey: queryKey(brief), items: brief.selectedItems.map((item) => ({ platform: item.platform, id: item.id, title: item.title, url: item.url, metrics: item.engagementMetrics })) };
  const previous = [...history.snapshots].reverse().find((snapshot) => snapshot.queryKey === current.queryKey);
  const comparison = compare(previous, current);
  const next = JSON.stringify({ schemaVersion: 1, snapshots: [...history.snapshots, current] }, null, 2);
  if (Buffer.byteLength(next) > 1_000_000) throw new Error("History would exceed 1 MB; inspect it before adding more snapshots.");
  mkdirSync(dirname(resolved), { recursive: true });
  const temporary = `${resolved}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, next, { encoding: "utf8", flag: "wx" }); renameSync(temporary, resolved); }
  catch (error) { if (existsSync(temporary)) unlinkSync(temporary); throw error; }
  const en = brief.parsedQuery.language === "en";
  const lines = comparison.status === "first_snapshot"
    ? [en ? "First saved snapshot for this query; no historical change is available yet." : "这是该查询的首份快照，暂时无法计算历史变化。"]
    : comparison.status === "no_overlap"
      ? [en ? "No identical selected source appears in both snapshots; no engagement growth can be computed." : "两次快照没有相同的入选来源，无法计算互动增长。"]
      : comparison.changes.map((change) => `${change.platform} ${change.title}: ${change.metric} ${change.previous} → ${change.current} (${change.delta >= 0 ? "+" : ""}${change.delta})`);
  brief.historyComparison = comparison;
  brief.markdown += `\n## ${en ? "Saved snapshot comparison" : "历史快照比较"}\n\n${lines.map((line) => `- ${line}`).join("\n")}\n\n${en ? "Only the same source and metric are compared; selection changes and cumulative counts are not platform-wide trends." : "仅比较同一来源的同一指标；入选变化和累计值不能代表平台整体趋势。"}\n`;
  return brief;
}
