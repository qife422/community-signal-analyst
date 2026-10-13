import { groupCommentThemes } from "../comments/groupThemes.js";
import type { CommentSignal, ParsedQuery, ScoredItem } from "../types/communitySignal.js";

type Reply = {
  id?: string; text?: string; author_id?: string; created_at?: string; conversation_id?: string;
  note_post?: { text?: string };
  referenced_posts?: Array<{ id?: string; type?: string }>;
  public_metrics?: { like_count?: number; reply_count?: number; repost_count?: number };
};
type ReplyResponse = { data?: Reply[]; includes?: { users?: Array<{ id?: string; username?: string }> }; errors?: unknown[] };
const numericId = (value: unknown): value is string => typeof value === "string" && /^\d{1,19}$/.test(value);

/** One optional paid search, at most 10 replies across at most 3 selected root posts. */
export async function collectXReplies(parsed: ParsedQuery, selected: ScoredItem[], cutoff: Date): Promise<{ items: ScoredItem[]; limitations: string[] }> {
  const items = selected.map((item) => item.platform === "x" ? { ...item, replyCollectionStatus: "not_requested" as const } : item);
  const en = parsed.language === "en";
  const note = (zh: string, english: string) => en ? english : zh;
  if (process.env.X_REPLIES_ENABLED !== "true") return { items: selected, limitations: [] };
  const token = process.env.X_BEARER_TOKEN?.trim();
  if (process.env.X_API_ENABLED !== "true" || !token) return { items, limitations: [note("权限限制：X 回复读取需 X_API_ENABLED=true、X_REPLIES_ENABLED=true 和令牌；本次未请求回复。", "Access limitation: X replies require both paid-read flags and a token; no reply request was made.")] };
  const targets = items.filter((item) => item.platform === "x" && numericId(item.id) && item.sourceStatus === "verified_api" && !item.isMockData).slice(0, 3);
  for (const item of targets) if (item.engagementMetrics.commentsCount === 0) item.replyCollectionStatus = "no_visible_replies";
  const queryTargets = targets.filter((item) => item.engagementMetrics.commentsCount !== 0);
  if (!queryTargets.length) return { items, limitations: [note("X：入选样本没有可见回复，未额外请求回复。", "X: selected roots have no visible replies; no extra reply request was made.")] };
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", `(${queryTargets.map((item) => `conversation_id:${item.id}`).join(" OR ")}) is:reply -is:retweet`);
  url.searchParams.set("max_results", "10");
  url.searchParams.set("sort_order", "relevancy");
  const startTime = Math.max(cutoff.getTime(), Date.now() - (7 * 24 * 60 - 10) * 60_000);
  url.searchParams.set("start_time", new Date(startTime).toISOString());
  url.searchParams.set("post.fields", "created_at,public_metrics,conversation_id,referenced_posts,note_post,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username");
  const limitations = [note("X 回复只作一次最多 10 条的额外付费搜索，覆盖最多 3 个入选帖；只保留有内容的直接回复，每帖最多 3 条。不翻页，可能漏掉其他回复；主题是关键词分组，不代表支持率或社区共识。", "X replies use one extra paid search for at most 10 replies across up to 3 selected roots, retaining up to 3 substantive direct replies per root. No pagination; other replies may be missed. Themes are keyword groupings, not sentiment shares or community consensus.")];
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as ReplyResponse;
    if (body.errors?.length) throw new Error("API returned incomplete reply data");
    const fetchedAt = new Date().toISOString();
    const authors = new Map((body.includes?.users ?? []).map((author) => [author.id, author.username]));
    const seen = new Set<string>();
    for (const item of queryTargets) {
      const comments: CommentSignal[] = [];
      for (const reply of (body.data ?? []).slice(0, 10)) {
        const text = (reply.note_post?.text || reply.text || "").replace(/\s+/g, " ").trim();
        const time = Date.parse(reply.created_at ?? "");
        const parent = reply.referenced_posts?.find((reference) => reference.type === "replied_to")?.id;
        const username = authors.get(reply.author_id);
        if (!numericId(reply.id) || seen.has(reply.id) || parent !== item.id || reply.conversation_id !== item.id
          || !Number.isFinite(time) || time < startTime || time > Date.now() || (item.publishedAt && time < Date.parse(item.publishedAt))
          || reply.referenced_posts?.some((reference) => reference.type === "retweeted")
          || (username && `@${username}` === item.author)
          || text.length < (/[\u3400-\u9fff]/.test(text) ? 30 : 60)
          || /\b(?:sign up|follow me|dm me|buy now|check out my|join the waitlist|limited offer)\b|注册领取|点击购买|限时优惠/i.test(text)
          || !/\bbecause\b|\bhowever\b|\bbut\b|\bi (?:used|tested|tried|found|measured)\b|\bwe (?:used|tested|found)\b|\bbenchmark\b|\bsample\b|\bmethodology\b|\bregression|\bbug\b|\bcost\b|\bodds\b|\bproduction\b|follow-up fix|\bownership\b|\breview\b|\brework\b|\bmaintenance\b|因为|但是|实测|样本|成本|缺陷|回归|方法|对照|生产环境|返工|维护/i.test(text)) continue;
        seen.add(reply.id);
        comments.push({ source: "x", author: username && /^\w{1,15}$/.test(username) ? `@${username}` : undefined,
          url: `https://x.com/i/web/status/${reply.id}`, summary: text.slice(0, 1000), signalType: "neutral", isDirectQuote: true,
          parentItemId: item.id, publishedAt: reply.created_at, fetchedAt, retrievalMethod: "x_api",
          engagementMetrics: { points: reply.public_metrics?.like_count, commentsCount: reply.public_metrics?.reply_count, reactions: reply.public_metrics?.repost_count } });
        if (comments.length >= 3) break;
      }
      item.comments = comments;
      item.commentThemes = groupCommentThemes(comments);
      item.replyCollectionStatus = comments.length ? "sampled" : "no_qualifying_replies";
      item.replySampleMethod = "x_api";
      item.replySampledAt = fetchedAt;
      item.scoreRationale = item.scoreRationale.filter((line) => !/comments were not fetched|本次未抓取评论/.test(line));
      item.scoreRationale.push(note("回复在初筛之后读取；原排序分保留，主题不自动推断情绪。", "Replies were fetched after selection; original ranking scores are retained and themes do not infer sentiment."));
    }
    return { items, limitations };
  } catch (error) {
    for (const item of queryTargets) item.replyCollectionStatus = "unavailable";
    return { items, limitations: [...limitations, note(`X 回复获取失败：${error instanceof Error ? error.message : "unknown error"}；不重试，不补造评论。`, `X reply collection failed: ${error instanceof Error ? error.message : "unknown error"}; no retry or invented comments.`)] };
  }
}
