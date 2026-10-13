import type { RawMockItem } from "../adapters/types.js";
import type { ParsedQuery, SourceItem } from "../types/communitySignal.js";

export function normalizeItems(rawItems: RawMockItem[], _parsed: ParsedQuery): SourceItem[] {
  const fetchedAt = new Date().toISOString();

  return rawItems.map((raw) => ({
    id: raw.id,
    platform: raw.platform,
    contentType: raw.contentType,
    title: raw.title,
    url: raw.url,
    author: raw.author,
    publishedAt: raw.publishedAt,
    fetchedAt,
    rawExcerpt: raw.rawExcerpt,
    summary: raw.summary,
    tags: raw.tags ?? [],
    engagementMetrics: {
      points: raw.engagementMetrics.points,
      stars: raw.engagementMetrics.stars,
      reactions: raw.engagementMetrics.reactions,
      commentsCount: raw.engagementMetrics.commentsCount,
      forks: raw.engagementMetrics.forks,
      openIssues: raw.engagementMetrics.openIssues
    },
    comments: raw.comments.map((comment) => ({
      source: raw.platform,
      author: comment.author,
      summary: comment.summary,
      signalType: comment.signalType,
      isDirectQuote: false
    })),
    isMockData: raw.isMockData,
    dataLabel: raw.dataLabel,
    sourceStatus: "mock_data"
  }));
}
