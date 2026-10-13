export type Platform = "hacker_news" | "github" | "devto" | "reddit" | "product_hunt" | "x" | "discord" | "whop";

export type AnalysisMode =
  | "product_research"
  | "investment_research"
  | "ai_trend"
  | "content_ideas"
  | "dev_tool_research"
  | "general";

export type TimeRange = "recent_24h" | "recent_3d" | "recent_7d" | "recent_14d" | "recent_30d";

export interface UserQuery {
  query: string;
  language?: "zh" | "en";
  maxItems?: number;
  timeRange?: TimeRange;
}

export interface ParsedQuery {
  originalQuery: string;
  topic: string;
  keywords: string[];
  platforms: Platform[];
  timeRange: TimeRange;
  maxItems: number;
  analysisMode: AnalysisMode;
  strictMode: boolean;
  language: "zh" | "en";
  unavailablePlatforms?: string[];
}

export type SourceStatus = "verified_api" | "verified_url" | "search_result" | "mock_data" | "unverified";

export interface EngagementMetrics {
  points?: number;
  stars?: number;
  reactions?: number;
  commentsCount?: number;
  forks?: number;
  openIssues?: number;
}

export interface CommentSignal {
  sourceMessageId?: string;
  source: Platform;
  author?: string;
  url?: string;
  summary: string;
  signalType: "supporting" | "opposing" | "neutral" | "pain_point" | "technical" | "market";
  isDirectQuote: boolean;
  publishedAt?: string;
  fetchedAt?: string;
  parentItemId?: string;
  engagementMetrics?: EngagementMetrics;
  retrievalMethod?: "x_api" | "browser_visible" | "discord_bot_api" | "whop_user_oauth";
}

export interface CommentTheme {
  topic: "workflow" | "defects" | "cost" | "performance" | "security" | "methodology";
  commentUrls: string[];
  method: "keyword_grouping";
}

export interface SourceItem {
  id: string;
  platform: Platform;
  contentType: "article" | "post" | "repo" | "issue" | "discussion";
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  fetchedAt: string;
  rawExcerpt?: string;
  summary: string;
  tags?: string[];
  engagementMetrics: EngagementMetrics;
  comments: CommentSignal[];
  isMockData: boolean;
  dataLabel?: "示例数据";
  sourceStatus: SourceStatus;
  sourceQualityScore?: number;
  relevanceScore?: number;
  evidenceStrength?: number;
  citedUrls?: string[];
  claimVerification?: "author_claim_unverified" | "primary_source_verified";
  textSource?: "note_post" | "post_text";
  claimReviews?: ClaimReview[];
  commentThemes?: CommentTheme[];
  replyCollectionStatus?: "not_requested" | "no_visible_replies" | "sampled" | "no_qualifying_replies" | "unavailable";
  replySampleMethod?: "x_api" | "browser_visible";
  replySampledAt?: string;
  whopContext?: {
    channelId: string; experienceId: string; channelName?: string; communityName: string;
    sampledMessages: number; messageLimit: 50; sampledReplyCount: number;
    hasMoreMessages: boolean; parentMessageId?: string; contentTruncated: boolean;
    retrievalMethod: "whop_user_oauth"; access: "membership_required"; linkGranularity: "channel";
  };
  discordContext?: {
    guildId: string;
    channelId: string;
    channelName?: string;
    channelType: number;
    sampledMessages: number;
    messageLimit: 50;
    sampledReplyCount: number;
    parentMessageId?: string;
    contentTruncated: boolean;
    retrievalMethod: "discord_bot_api";
    access: "permission_required";
  };
}

/** A reviewer assessment of one claim, never an automatic truth verdict. */
export interface ClaimReview {
  platform: Platform;
  itemId: string;
  itemUrl: string;
  claimText: string;
  primarySourceUrl: string;
  primarySourceBasis: string;
  status: "supported" | "contradicted" | "inconclusive" | "unavailable";
  checkedAt: string;
  method: "retrieved_primary_source_review";
  rationale: string;
  evidenceExcerpt?: string;
  sourceFetchedAt?: string;
  sourceTextSha256?: string;
}

export interface ClaimReviewInput extends ClaimReview {
  /** Retrieved passage/context for excerpt integrity; omitted from reports. */
  sourceText?: string;
}

export interface ScoredItem extends SourceItem {
  scores: {
    relevance: number;
    engagement: number;
    freshness: number;
    sourceQuality: number;
    discussionQuality: number;
    novelty: number;
    total: number;
  };
  scoreRationale: string[];
}

export interface CommunitySignalBrief {
  attention?: import("../preferences.js").AttentionResult;
  parsedQuery: ParsedQuery;
  queriedPlatforms?: Platform[];
  selectedItems: ScoredItem[];
  quickTakeaways: string[];
  crossPlatformTrends: string[];
  nextSteps: string[];
  dataLimitations: string[];
  historyComparison?: HistoryComparison;
  markdown: string;
}

export interface RelatedSource {
  selectedItemId: string;
  platform: Platform;
  title: string;
  url: string;
  reason: "shared_reference" | "title_overlap";
  sharedReference?: string;
}

export interface HistoryComparison {
  previousCapturedAt?: string;
  status: "no_evidence" | "first_snapshot" | "compared" | "no_overlap";
  changes: Array<{ platform: Platform; id: string; title: string; url: string; metric: string; previous: number; current: number; delta: number }>;
}

export interface CollectionResult {
  items: SourceItem[];
  limitations: string[];
  queriedPlatforms?: Platform[];
}
