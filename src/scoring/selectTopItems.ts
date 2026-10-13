import type { ScoredItem } from "../types/communitySignal.js";

export function selectTopItems(items: ScoredItem[], maxItems = 3): ScoredItem[] {
  const limit = Math.max(1, Math.min(maxItems, 10));
  const eligible = items
    .filter((item) => item.scores.relevance >= 35)
    .sort((a, b) => b.scores.total - a.scores.total);
  const selected: ScoredItem[] = [];

  if (eligible[0]) selected.push(eligible[0]);

  for (const item of eligible) {
    if (selected.length >= Math.min(2, limit)) break;
    if (!selected.includes(item) && !selected.some((selectedItem) => selectedItem.platform === item.platform)) {
      selected.push(item);
    }
  }

  const relevanceFirst = [...eligible].sort(
    (a, b) => b.scores.relevance - a.scores.relevance || b.scores.total - a.scores.total
  );
  for (const item of relevanceFirst) {
    if (selected.length >= limit) break;
    if (!selected.includes(item) && item.scores.relevance >= 85) {
      selected.push(item);
    }
  }

  for (const item of eligible) {
    if (selected.length >= limit) break;
    if (!selected.includes(item)) selected.push(item);
  }

  return selected;
}
