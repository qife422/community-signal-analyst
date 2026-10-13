import type { AnalysisMode, ParsedQuery, TimeRange } from "../types/communitySignal.js";
import { selectPlatforms } from "./platformSelector.js";

const AI_CODING_KEYWORDS = ["AI coding", "agentic coding", "Codex", "Cursor", "Claude Code", "Copilot"];
const INVESTMENT_KEYWORDS = ["股票", "美股", "市场情绪", "stocks", "stock market", "investing", "market sentiment"];
const NVIDIA_KEYWORDS = ["Nvidia", "NVDA", "earnings", "英伟达", "财报", "市场情绪"];
const PRODUCT_RESEARCH_KEYWORDS = ["用户痛点", "竞品", "替代方案", "新工具", "产品反馈", "功能需求"];

export function parseQuery(query: string): ParsedQuery {
  const normalized = query.trim();
  const lower = normalized.toLowerCase();
  const analysisMode = inferAnalysisMode(lower);
  const topic = inferTopic(normalized, lower, analysisMode);
  const keywords = inferKeywords(normalized, analysisMode, topic);
  const timeRange = inferTimeRange(lower);
  const parsedWithoutPlatforms = {
    originalQuery: normalized,
    topic,
    keywords,
    platforms: [],
    timeRange,
    maxItems: inferMaxItems(lower),
    analysisMode,
    strictMode: true,
    language: /\b(?:in english|english report|respond in english|write in english)\b|用英文|英文输出|英语报告/i.test(normalized) ? "en" as const : "zh" as const
  };

  return {
    ...parsedWithoutPlatforms,
    platforms: selectPlatforms(parsedWithoutPlatforms),
    unavailablePlatforms: []
  };
}

function inferAnalysisMode(lower: string): AnalysisMode {
  if (/(英伟达|nvidia|nvda|财报|股票|美股|市场情绪|stock|earnings|stock market)/i.test(lower)) {
    return "investment_research";
  }
  if (/(ai coding|coding 工具|codex|cursor|claude code|copilot|agentic coding|coding agent)/i.test(lower)) {
    return "dev_tool_research";
  }
  if (/(ai agent|llm|大模型|人工智能)/i.test(lower)) return "ai_trend";
  if (/(产品|用户痛点|痛点|竞品|替代方案|新工具|功能需求|用户反馈)/i.test(lower)) {
    return "product_research";
  }
  if (/(选题|内容|视频|文章)/i.test(lower)) {
    return "content_ideas";
  }
  return "general";
}

function inferTopic(original: string, lower: string, mode: AnalysisMode): string {
  if (/(英伟达|nvidia|nvda)/i.test(lower)) return /(财报|earnings|季度业绩|quarterly results)/i.test(lower) ? "Nvidia earnings" : "Nvidia discussion";
  if (mode === "investment_research") return "stock market discussion";
  if (mode === "dev_tool_research") return "AI coding tools";
  if (mode === "product_research") return "product research signals";
  return inferGeneralKeywords(original).join(" ") || original || "community signals";
}

function inferKeywords(original: string, mode: AnalysisMode, topic: string): string[] {
  if (topic === "Nvidia earnings") return NVIDIA_KEYWORDS;
  if (topic === "Nvidia discussion") return ["Nvidia", "NVDA", "英伟达"];
  if (mode === "investment_research") return INVESTMENT_KEYWORDS;
  if (mode === "dev_tool_research") {
    const namedTools = ["Claude Code", "GitHub Copilot", "Cursor", "Codex", "Copilot", "Windsurf", "Cline"]
      .filter((name) => new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i").test(original));
    return [...new Set([...namedTools, ...AI_CODING_KEYWORDS])];
  }
  if (mode === "product_research") return PRODUCT_RESEARCH_KEYWORDS;
  return inferGeneralKeywords(original);
}

function inferGeneralKeywords(query: string): string[] {
  const englishStopwords = new Set(["find", "recent", "latest", "about", "posts", "post", "items", "item", "articles", "article", "community", "discussion", "discussions", "on", "the", "a", "of", "for", "from", "past", "last", "days", "day", "hours", "hour", "top", "hot", "hacker", "news", "github", "dev", "to", "reddit", "product", "products", "hunt", "launch", "launches", "twitter", "x", "x.com", "discord", "whop", "all", "seven", "six", "platforms", "except", "excluding", "exclude", "excluded", "without", "skip", "and", "including", "english", "report", "respond", "write", "in"]);
  const chineseStopwords = new Set(["最近", "最新", "近", "天", "关于", "社区", "讨论", "帖子", "内容", "比较", "热门", "热度", "大家", "看看", "怎么", "什么", "一些", "几个", "帮我", "给我", "找", "条", "篇", "个", "的", "和", "在", "上", "里", "吗", "呢", "一周", "两周", "一个月", "小时", "用", "英文", "输出", "英语", "报告", "全平台", "所有", "全部", "平台", "不含", "不包含", "排除", "跳过", "暂缓", "暂停", "除了", "除外", "之外", "以外"]);
  const english = (query.match(/[A-Za-z][A-Za-z0-9.+#/-]*/g) ?? []).filter((word) => !englishStopwords.has(word.toLowerCase()));
  const chinese = [...new Intl.Segmenter("zh", { granularity: "word" }).segment(query)]
    .filter((part) => part.isWordLike && /[\u3400-\u9fff]/.test(part.segment))
    .map((part) => part.segment)
    .filter((word) => word.length >= 2 && !chineseStopwords.has(word));
  return [...new Set([...english, ...chinese])].slice(0, 6);
}

function inferTimeRange(lower: string): TimeRange {
  if (/(24 小时|\b24h\b|\b24 hours?\b|\b1 day\b|一天|today|今日)/i.test(lower)) return "recent_24h";
  if (/(3 天|\b3d\b|\b3 days?\b|三天)/i.test(lower)) return "recent_3d";
  if (/(14 天|\b14d\b|\b14 days?\b|两周|二周|2 周|\b2 weeks\b)/i.test(lower)) return "recent_14d";
  if (/(30 天|\b30d\b|\b30 days?\b|一个月|近月|past month|last month)/i.test(lower)) return "recent_30d";
  return "recent_7d";
}

function inferMaxItems(lower: string): number {
  const explicit = lower.match(/(\d+)\s*[-–~到至]\s*(\d+)/);
  if (explicit) return Math.max(1, Math.min(Number(explicit[2]), 10));
  const single = lower.match(/(\d+)\s*(篇|个|条|posts?|items?|discussions?|articles?)/);
  if (single) return Math.max(1, Math.min(Number(single[1]), 10));
  return 3;
}
