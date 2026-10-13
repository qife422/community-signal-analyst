import type { Platform } from "../types/communitySignal.js";

export interface RawMockItem {
  id: string;
  platform: Platform;
  contentType: "article" | "post" | "repo" | "discussion";
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  rawExcerpt?: string;
  summary: string;
  engagementMetrics: Record<string, number | undefined>;
  comments: Array<{
    author?: string;
    summary: string;
    signalType: "supporting" | "opposing" | "neutral" | "pain_point" | "technical" | "market";
  }>;
  tags?: string[];
  isMockData: true;
  dataLabel: "示例数据";
}
