import { loadMockDevToItems } from "./adapters/mockDevToAdapter.js";
import { loadMockGitHubItems } from "./adapters/mockGitHubAdapter.js";
import { loadMockHackerNewsItems } from "./adapters/mockHackerNewsAdapter.js";
import { collectLive, cutoffFor } from "./adapters/live.js";
import { collectXReplies } from "./adapters/xReplies.js";
import { matchSources } from "./corroboration/matchSources.js";
import { normalizeItems } from "./normalizer/normalizeItems.js";
import { expandKeyword } from "./query-parser/keywordConcepts.js";
import { parseQuery } from "./query-parser/parseQuery.js";
import { generateBrief } from "./report/generateBrief.js";
import { generateLiveBrief } from "./report/generateLiveBrief.js";
import { scoreItem } from "./scoring/scoreItem.js";
import { selectTopItems } from "./scoring/selectTopItems.js";
import type { CommunitySignalBrief, RelatedSource } from "./types/communitySignal.js";
import type { Profile } from "./profile/schema.js";
import { applyProfileQuery, attachAttention, sourceAttention } from "./preferences.js";

export function runCommunitySignalAnalysis(query: string, profile?: Profile): CommunitySignalBrief {
  const parsed = profile ? applyProfileQuery(query, profile) : parseQuery(query);
  const rawItems = [
    ...loadMockHackerNewsItems(),
    ...loadMockGitHubItems(),
    ...loadMockDevToItems()
  ].filter((item) => parsed.platforms.includes(item.platform));
  const normalized = normalizeItems(rawItems, parsed);
  const attention = profile ? sourceAttention(normalized, profile) : undefined;
  const scored = (attention?.items ?? normalized).map((item) => scoreItem(item, parsed));
  const selected = selectTopItems(scored, parsed.maxItems);
  const brief = generateBrief(parsed, selected);
  return attention ? attachAttention(brief, attention.attention) : brief;
}

export async function runLiveCommunitySignalAnalysis(query: string, profile?: Profile): Promise<CommunitySignalBrief> {
  const parsed = profile ? applyProfileQuery(query, profile) : parseQuery(query);
  if (profile && !parsed.platforms.length) {
    const brief = generateLiveBrief(parsed, [], ["请求与 profile 的已支持来源没有交集；Whop 使用独立浏览器摘要入口。本次零请求。"], 0, [], []);
    return attachAttention(brief, sourceAttention([], profile).attention);
  }
  const result = await collectLive(parsed);
  const cutoff = cutoffFor(parsed.timeRange).getTime();
  const eligible = result.items.filter((item) =>
    item.sourceStatus === "verified_api" &&
    /^https:\/\//.test(item.url) &&
    Boolean(item.publishedAt) &&
    new Date(item.publishedAt ?? 0).getTime() >= cutoff &&
    new Date(item.publishedAt ?? 0).getTime() <= Date.now() &&
    !/\[bot\]$/i.test(item.author ?? "") &&
    (item.contentType !== "repo" || (item.engagementMetrics.stars ?? 0) >= 15 || (item.engagementMetrics.forks ?? 0) >= 3) &&
    matchesTopic(item, parsed)
  );
  const uniqueEligible = [...new Map(eligible.map((item) => [`${item.platform}:${item.id}`, item])).values()];
  const scored = uniqueEligible.map((item) => {
    const scoredItem = scoreItem(item, parsed);
    if (item.platform === "x") {
      const bonus = Math.round((item.evidenceStrength ?? 0) * 0.15 * 10) / 10;
      scoredItem.scores.total = Math.min(100, Math.round((scoredItem.scores.total + bonus) * 10) / 10);
      scoredItem.scoreRationale.push(parsed.language === "en"
        ? `X evidence-density bonus +${bonus} points (max 15); comments were not fetched`
        : `X 证据密度加分 +${bonus} 分（上限 15）；本次未抓取评论`);
    }
    if (parsed.topic === "AI coding tools" && /coding|codebase|software|developer|programming/i.test(item.title)) {
      scoredItem.scores.total = Math.min(100, Math.round((scoredItem.scores.total + 10) * 10) / 10);
      scoredItem.scoreRationale.push("标题直接匹配开发工作流主题");
    }
    return scoredItem;
  }).filter((item) => item.scores.total >= 55 && (
    parsed.analysisMode !== "dev_tool_research" ||
    (item.platform === "x" ? item.scores.relevance >= 40 : item.scores.relevance >= 50 || item.comments.length > 0)
  ));
  const attention = profile ? sourceAttention(scored, profile) : undefined;
  if (attention) attention.attention.counts.qualityRejected = result.items.length - eligible.length + uniqueEligible.length - scored.length;
  const filteredScored = attention?.items ?? scored;
  const groups: typeof scored[] = [];
  for (const item of filteredScored) {
    const group = groups.find((members) => matchSources(members[0], item));
    if (group) group.push(item);
    else groups.push([item]);
  }
  const representatives = groups.map((members) => [...members].sort((a, b) =>
    (b.scores.total + (b.comments.length ? 6 : 0)) - (a.scores.total + (a.comments.length ? 6 : 0))
  )[0]);
  const bareRepos = representatives.filter((item) => item.platform === "github" && item.contentType === "repo" && !item.comments.length)
    .sort((a, b) => b.scores.total - a.scores.total);
  const ranked = selectTopItems(representatives.filter((item) => !bareRepos.includes(item) || item === bareRepos[0]), parsed.maxItems);
  const selected = ranked.sort((a, b) => b.scores.total - a.scores.total);
  const qualifiedKeys = new Set(filteredScored.map((item) => `${item.platform}:${item.id}`));
  const relatedSources: RelatedSource[] = selected.flatMap((item) => (profile ? sourceAttention(uniqueEligible, profile).items : uniqueEligible)
    .filter((candidate) => candidate.platform !== item.platform)
    .flatMap((candidate) => {
      const match = matchSources(item, candidate);
      return match && (match.reason === "shared_reference" || qualifiedKeys.has(`${candidate.platform}:${candidate.id}`))
        ? [{ selectedItemId: item.id, platform: candidate.platform, title: candidate.title, url: candidate.url, reason: match.reason, sharedReference: match.reference }]
        : [];
    }).slice(0, 2));
  const replyResult = await collectXReplies(parsed, selected, new Date(cutoff));
  const brief = generateLiveBrief(parsed, replyResult.items, [...result.limitations, ...replyResult.limitations], uniqueEligible.length, relatedSources, result.queriedPlatforms);
  return attention ? attachAttention(brief, attention.attention) : brief;
}

function matchesTopic(item: import("./types/communitySignal.js").SourceItem, parsed: import("./types/communitySignal.js").ParsedQuery): boolean {
  if (parsed.topic === "Nvidia earnings") {
    const text = `${item.title} ${item.summary} ${(item.tags ?? []).join(" ")}`;
    return /\bnvidia\b|\bnvda\b|英伟达/i.test(text) && /earnings|quarterly|financial results|revenue|guidance|财报|业绩|营收/i.test(text);
  }
  if (parsed.analysisMode === "general" || parsed.analysisMode === "content_ideas" || parsed.analysisMode === "ai_trend") {
    const text = `${item.title} ${item.summary.slice(0, 240)} ${(item.tags ?? []).join(" ")}`.toLowerCase();
    const concepts = parsed.keywords.map(expandKeyword);
    if (concepts.length === 0) return false;
    const matches = concepts.map((alternatives) => alternatives.some((term) => text.includes(term.toLowerCase())));
    return matches[0] && (matches.length === 1 || matches.slice(1).some(Boolean));
  }
  if (parsed.analysisMode !== "dev_tool_research" || parsed.topic !== "AI coding tools") return true;
  const text = `${item.title} ${item.summary} ${(item.tags ?? []).join(" ")}`.toLowerCase();
  return /\bcoding\b|\bdeveloper\b|\bprogramming\b|\bcodebase\b|\brepository\b|\brepo\b|pull request|code review|code generation|software development|\bide\b|\bcursor\b|\bcodex\b|claude code|\bcopilot\b|\bwindsurf\b|\bcline\b|编程|代码/.test(text);
}

export * from "./types/communitySignal.js";
export { applyClaimReviews, loadClaimReviews, loadSavedBrief, validateClaimReviews } from "./verification.js";
export { collectXReplies } from "./adapters/xReplies.js";
export { appendXReplySample } from "./report/generateLiveBrief.js";
export { groupCommentThemes } from "./comments/groupThemes.js";

export { collectDiscord, loadDiscordScope } from "./adapters/discord.js";

export { collectWhop, loadWhopScope } from "./adapters/whop.js";
