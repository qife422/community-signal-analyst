import type { ParsedQuery, ScoredItem, SourceItem } from "../types/communitySignal.js";
import { expandKeyword } from "../query-parser/keywordConcepts.js";

const WEIGHTS: Record<ParsedQuery["analysisMode"], [number, number, number, number, number, number]> = {
  general: [0.35, 0.15, 0.15, 0.15, 0.15, 0.05],
  product_research: [0.30, 0.10, 0.10, 0.15, 0.30, 0.05],
  investment_research: [0.30, 0.10, 0.25, 0.20, 0.15, 0],
  ai_trend: [0.30, 0.15, 0.20, 0.15, 0.10, 0.10],
  content_ideas: [0.30, 0.25, 0.15, 0.10, 0.15, 0.05],
  dev_tool_research: [0.30, 0.15, 0.10, 0.15, 0.20, 0.10]
};

export function scoreItem(item: SourceItem, parsed: ParsedQuery): ScoredItem {
  const relevance = scoreRelevance(item, parsed);
  const engagement = scoreEngagement(item);
  const freshness = scoreFreshness(item);
  const sourceQuality = scoreSourceQuality(item);
  const discussionQuality = scoreDiscussionQuality(item);
  const novelty = scoreNovelty(item);
  const weights = WEIGHTS[parsed.analysisMode];
  const total = round(
    relevance * weights[0] +
      engagement * weights[1] +
      freshness * weights[2] +
      sourceQuality * weights[3] +
      discussionQuality * weights[4] +
      novelty * weights[5]
  );

  return {
    ...item,
    scores: { relevance, engagement, freshness, sourceQuality, discussionQuality, novelty, total },
    scoreRationale: buildRationale(item, relevance, engagement, discussionQuality, novelty, parsed.language)
  };
}

function scoreRelevance(item: SourceItem, parsed: ParsedQuery): number {
  const title = item.title.toLowerCase();
  const summary = `${item.summary} ${item.rawExcerpt ?? ""}`.toLowerCase();
  const tags = (item.tags ?? []).join(" ").toLowerCase();
  const comments = item.comments.map((comment) => comment.summary).join(" ").toLowerCase();
  let score = 10;

  for (const keyword of parsed.keywords) {
    const alternatives = expandKeyword(keyword).map((term) => term.toLowerCase()).filter(Boolean);
    if (alternatives.some((term) => title.includes(term))) score += 20;
    if (alternatives.some((term) => tags.includes(term))) score += 18;
    if (alternatives.some((term) => summary.includes(term))) score += 14;
    if (alternatives.some((term) => comments.includes(term))) score += 8;
  }

  if (summary.includes(parsed.topic.toLowerCase()) || title.includes(parsed.topic.toLowerCase())) {
    score += 12;
  }
  return clamp(score);
}

function scoreEngagement(item: SourceItem): number {
  const metrics = item.engagementMetrics;
  if (item.platform === "github") {
    return clamp(Math.log10((metrics.stars ?? 0) + 1) * 22 + Math.log10((metrics.forks ?? 0) + 1) * 10 + (metrics.commentsCount ?? 0));
  }
  if (item.platform === "hacker_news") {
    return clamp(Math.log10(Math.max(0, metrics.points ?? 0) + 1) * 28 + Math.log10(Math.max(0, metrics.commentsCount ?? 0) + 1) * 18);
  }
  if (item.platform === "reddit" || item.platform === "product_hunt") {
    return clamp(Math.log10(Math.max(0, metrics.points ?? 0) + 1) * 28 + Math.log10(Math.max(0, metrics.commentsCount ?? 0) + 1) * 18);
  }
  if (item.platform === "x") {
    return clamp(Math.log10(Math.max(0, metrics.points ?? 0) + 1) * 25 +
      Math.log10(Math.max(0, metrics.reactions ?? 0) + 1) * 18 +
      Math.log10(Math.max(0, metrics.commentsCount ?? 0) + 1) * 12);
  }
  return clamp(Math.log10((metrics.reactions ?? 0) + 1) * 30 + Math.log10((metrics.commentsCount ?? 0) + 1) * 18);
}

function scoreFreshness(item: SourceItem): number {
  if (!item.publishedAt) return 35;
  const ageMs = Date.now() - new Date(item.publishedAt).getTime();
  const ageDays = ageMs / 86_400_000;
  if (ageDays <= 1) return 95;
  if (ageDays <= 3) return 85;
  if (ageDays <= 7) return 75;
  if (ageDays <= 30) return 55;
  return 30;
}

function scoreSourceQuality(item: SourceItem): number {
  const completeness = [item.title, item.url, item.summary, item.rawExcerpt, item.publishedAt].filter(Boolean).length * 4;
  if (item.platform === "hacker_news") return clamp(58 + completeness + (item.comments.length ? 10 : 0));
  if (item.platform === "github") return clamp(58 + completeness + (item.engagementMetrics.stars ? 8 : 0));
  return clamp(55 + completeness + ((item.tags ?? []).length ? 8 : 0));
}

function scoreDiscussionQuality(item: SourceItem): number {
  if ((item.platform === "x" || item.platform === "discord" || item.platform === "whop") && !item.comments.length) return 0;
  const substantiveSignals = item.comments.filter((comment) =>
    ["pain_point", "technical", "opposing", "market"].includes(comment.signalType)
  ).length;
  return clamp(35 + item.comments.length * 12 + substantiveSignals * 10);
}

function scoreNovelty(item: SourceItem): number {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const noveltyHits = ["agent", "workflow", "local", "automation", "prototype", "earnings", "risk"].filter((term) =>
    text.includes(term)
  ).length;
  return clamp(50 + noveltyHits * 12);
}

function buildRationale(item: SourceItem, relevance: number, engagement: number, discussion: number, novelty: number, language: ParsedQuery["language"]): string[] {
  if (language === "en") {
    const match = relevance < 35 ? "low topic match" : relevance > 75 ? "strong title, tag, excerpt, or comment match" : "clear but limited topic match";
    return [
      `${item.platform} ${item.isMockData ? "example" : "item"} relevance ${relevance}/100: ${match}`,
      `Platform-specific engagement heuristic ${engagement}/100`,
      `Discussion density score ${discussion}/100`,
      `Novelty score ${novelty}/100`
    ];
  }
  const relevanceNote =
    relevance < 35
      ? "相关性偏低，即使互动较高也会被降权"
      : relevance > 75
        ? "关键词、摘要、标签或评论信号高度匹配"
        : "与查询存在明确但有限的匹配";
  return [
    `${item.platform} ${item.isMockData ? "示例内容" : "内容"}相关度 ${relevance}/100：${relevanceNote}`,
    `按平台类型换算的互动启发式得分 ${engagement}/100`,
    `评论/观点信息密度得分 ${discussion}/100`,
    `新颖性得分 ${novelty}/100`
  ];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, round(value)));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
