import type { CollectionResult, ParsedQuery, SourceItem } from "../types/communitySignal.js";

type XPost = {
  id?: string;
  text?: string;
  note_post?: { text?: string; entities?: { urls?: Array<{ expanded_url?: string; unwound_url?: string }> } };
  entities?: { urls?: Array<{ expanded_url?: string; unwound_url?: string }> };
  author_id?: string;
  created_at?: string;
  referenced_posts?: Array<{ type?: string }>;
  public_metrics?: { like_count?: number; reply_count?: number; repost_count?: number; quote_count?: number };
};
type XResponse = { data?: XPost[]; includes?: { users?: Array<{ id?: string; username?: string }> }; errors?: Array<{ detail?: string; title?: string }> };

const note = (parsed: ParsedQuery, zh: string, en: string) => parsed.language === "en" ? en : zh;

type XSearch = { query: string; topicTerms: string[] };
const TOOL_NAME = /^(?:Claude Code|GitHub Copilot|Cursor|Codex|Copilot|Windsurf|Cline)$/i;

function postText(post: XPost): string {
  return (post.note_post?.text?.trim() || post.text || "").replace(/\s+/g, " ").trim();
}

function citedUrls(post: XPost): string[] {
  const links = [...(post.note_post?.entities?.urls ?? []), ...(post.entities?.urls ?? [])];
  return [...new Set(links.map((link) => link.unwound_url || link.expanded_url).filter((value): value is string => {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && url.toString().length <= 500;
    } catch { return false; }
  }))].slice(0, 5);
}

export function buildXSearch(parsed: ParsedQuery): XSearch | undefined {
  const safe = parsed.keywords.filter((word) => word.length <= 80 && /^[\p{L}\p{N} .+#-]+$/u.test(word));
  if (!safe.length) return undefined;
  let terms: string[];
  let expression: string;
  if (parsed.analysisMode === "dev_tool_research") {
    const named = safe.find((word) => TOOL_NAME.test(word) && new RegExp(`\\b${word.replace(/ /g, "\\s+")}\\b`, "i").test(parsed.originalQuery));
    terms = named ? [named] : ["AI coding", "coding agent"];
    const subject = terms.length === 1 ? `"${terms[0]}"` : `("${terms[0]}" OR "${terms[1]}")`;
    expression = `${subject} (tested OR benchmark OR production OR bug OR review OR cost)`;
  } else if (parsed.topic === "Nvidia earnings" || parsed.topic === "Nvidia discussion") {
    terms = ["Nvidia", "NVDA"];
    expression = parsed.topic === "Nvidia earnings" ? '(Nvidia OR NVDA) earnings' : '(Nvidia OR NVDA)';
  } else {
    terms = safe.slice(0, 2);
    expression = terms.map((term) => `"${term}"`).join(" ");
  }
  return { query: `${expression} -is:retweet -is:reply`, topicTerms: terms };
}

type Rejection = "reply" | "thin" | "off_topic" | "promo" | "shallow" | "low_engagement";
type Assessment = { rejection?: Rejection; evidenceStrength: number };

export function rejectXPost(post: XPost, topicTerms: string[], requireEngagement = false): Rejection | undefined {
  return assessXPost(post, topicTerms, requireEngagement).rejection;
}

function assessXPost(post: XPost, topicTerms: string[], requireEngagement = false): Assessment {
  const text = postText(post);
  if (post.referenced_posts?.some((reference) => reference.type === "replied_to" || reference.type === "retweeted") || /^@\w{1,15}\b|^RT\s+@/i.test(text)) return { rejection: "reply", evidenceStrength: 0 };
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  if (text.length < (cjkCount >= 20 ? 60 : 100)) return { rejection: "thin", evidenceStrength: 0 };
  if (!topicTerms.some((term) => text.toLowerCase().includes(term.toLowerCase()))) return { rejection: "off_topic", evidenceStrength: 0 };
  if (/\b(?:sign up|try my|check out|follow me|dm me|limited offer|launching today|enroll now|join the waitlist|unlock your|book a demo|tag a friend|repost this|follow for the full|full reveal)\b|注册体验|点击购买|限时优惠|转发关注|关注领取/i.test(text)
    || ((text.match(/@\w+/g) ?? []).length >= 2 && /https:\/\/t\.co\//.test(text) && /review|demo|showcase/i.test(text))) return { rejection: "promo", evidenceStrength: 0 };
  const numeric = /\b\d[\d,.]*%|\b\d[\d,.]*\s+(?:times|hours?|minutes?|tasks?|users?|issues?|requests?|prs?|pull requests?|bugs?|regressions?|points?|quarters?|weeks?|days?)\b|\$\d[\d,.]*|\d+％|\d+倍/i.test(text);
  const method = /\b(?:study|benchmarks?|benchmarked|tested|measured|experiment|results?|workflow|regressions?|bugs?|review|pull requests?|codebase|trial|comparison|earnings|revenue|guidance|margin|forecast|valuation|product feedback|onboarding|retention|pricing)\b|研究|基准|测试|实测|工作流|回归|错误|代码库|对比|财报|营收|指引|利润率|估值|留存|定价/i.test(text);
  const outcome = /\b(?:found|caught|fixed|failed|failure|lower|less|faster|slower|rate|reduced|improved|increased|saved|cost|risk|regressions?|bugs?|blocking|deleting|uploaded|leaked|works?|minutes?|hours?|beat|missed|raised|cut|growth|decline|churn|retention)\b|发现|修复|失败|降低|提升|成本|风险|回归|错误|泄漏|上传|分钟|小时|超预期|不及预期|增长|下降|流失/i.test(text);
  const firstHand = /\b(?:i|we)\s+(?:used|tried|tested|built|switched|compared|shipped|ran|found|measured|installed|gave|interviewed)\b|\bmy\s+(?:workflow|test|experience)\b|我(?:用|试|测|实测|做|发现)|我们(?:用|试|测|实测|发现|访谈)/i.test(text);
  const concreteContext = /\b(?:production|payment|permission|migration|customer|import|support|repository|codebase|deploy|release|failing tests|onboarding)\b|边界条件|仓库|代码审查|真实缺陷|生产环境|用户访谈/i.test(text);
  const metrics = post.public_metrics;
  const engaged = (metrics?.like_count ?? 0) >= 10 || (metrics?.repost_count ?? 0) >= 3 || (metrics?.reply_count ?? 0) >= 5;
  if (requireEngagement && !engaged) return { rejection: "low_engagement", evidenceStrength: 0 };
  const evidenceStrength = numeric && method && outcome ? 90 : firstHand && method && outcome && concreteContext ? 80 : 0;
  if (!evidenceStrength) return { rejection: "shallow", evidenceStrength: 0 };
  return { evidenceStrength: Math.min(100, evidenceStrength + (engaged ? 5 : 0) + (/https:\/\/t\.co\//.test(text) ? 5 : 0)) };
}

/** One bounded request only. X_API_ENABLED is an explicit opt-in for a potentially billable read. */
export async function collectX(parsed: ParsedQuery, cutoff: Date): Promise<CollectionResult> {
  if (process.env.X_API_ENABLED !== "true") return {
    items: [], queriedPlatforms: [], limitations: [note(parsed,
      "权限限制：X 读取可能收费；未设置 X_API_ENABLED=true，本次未请求 X。",
      "Access limitation: X reads may incur charges; X_API_ENABLED=true is not set, so X was not queried.")]
  };
  const token = process.env.X_BEARER_TOKEN?.trim();
  if (!token) return {
    items: [], queriedPlatforms: [], limitations: [note(parsed,
      "权限限制：未提供 X_BEARER_TOKEN；X 未查询。",
      "Access limitation: X_BEARER_TOKEN is missing; X was not queried.")]
  };
  const search = buildXSearch(parsed);
  if (!search) return {
    items: [], queriedPlatforms: [], limitations: [note(parsed, "X：没有可用搜索词，本次未查询。", "X: no usable search term; no query was run.")]
  };
  const now = Date.now();
  const earliest = new Date(now - (7 * 24 * 60 - 10) * 60_000);
  const start = new Date(Math.max(cutoff.getTime(), earliest.getTime()));
  const limitations = [note(parsed,
    "X 仅执行一次相关性排序的近期搜索，最多读取 10 条非回复帖子；内容还须通过信息量门槛。本次帖子搜索不读取回复，可另行显式开启有界回复读取；不代表全站舆情。较长帖子可能被 API 截断，请打开原链接复核。",
    "X runs one relevance-sorted recent search for at most 10 non-reply posts; candidates must also pass a substance gate. The post search does not fetch replies; bounded reply reading requires a separate opt-in. This is not a platform-wide sentiment sample. Longer posts may be truncated by the API; review their original links.")];
  limitations.push(note(parsed,
    "X 帖子中的研究数字与结论仅代表发帖者说法；本适配器不独立核验其原始研究。",
    "Research figures and conclusions in X posts are the authors' claims; this adapter does not independently verify the underlying research."));
  if (cutoff < earliest) limitations.push(note(parsed,
    "X 近期搜索仅覆盖约七天；已将请求时间范围收窄。",
    "X recent search covers about seven days; the requested time range was narrowed."));
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", search.query);
  url.searchParams.set("max_results", "10");
  url.searchParams.set("start_time", start.toISOString());
  url.searchParams.set("sort_order", "relevancy");
  url.searchParams.set("post.fields", "created_at,public_metrics,referenced_posts,note_post,entities,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username");
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as XResponse;
    if (body.errors?.length) throw new Error(body.errors.map((error) => error.detail ?? error.title ?? "API error").join("; ").slice(0, 180));
    const fetchedAt = new Date().toISOString();
    const authors = new Map((body.includes?.users ?? []).filter((user) => user.id && user.username).map((user) => [user.id!, user.username!]));
    const rejected: Record<Rejection, number> = { reply: 0, thin: 0, off_topic: 0, promo: 0, shallow: 0, low_engagement: 0 };
    const requireEngagement = /热门|热度|比较火|火的|trending|popular|\bhot\b/i.test(parsed.originalQuery);
    const items: SourceItem[] = (body.data ?? []).slice(0, 10).flatMap((post) => {
      const publishedTime = Date.parse(post.created_at ?? "");
      if (!post.id || !postText(post) || !Number.isFinite(publishedTime) || publishedTime < start.getTime() || publishedTime > now) return [];
      const cleaned = postText(post);
      const assessment = assessXPost(post, search.topicTerms, requireEngagement);
      if (assessment.rejection) { rejected[assessment.rejection]++; return []; }
      const username = post.author_id ? authors.get(post.author_id) : undefined;
      return [{
        id: post.id, platform: "x" as const, contentType: "post" as const,
        title: cleaned.length > 140 ? `${cleaned.slice(0, 137)}…` : cleaned,
        url: `https://x.com/i/web/status/${encodeURIComponent(post.id)}`,
        author: username && /^\w{1,15}$/.test(username) ? `@${username}` : undefined,
        publishedAt: post.created_at, fetchedAt,
        rawExcerpt: cleaned.slice(0, 5000), summary: cleaned.slice(0, 360),
        engagementMetrics: {
          points: post.public_metrics?.like_count,
          commentsCount: post.public_metrics?.reply_count,
          reactions: post.public_metrics?.repost_count
        },
        comments: [], isMockData: false, sourceStatus: "verified_api" as const,
        evidenceStrength: assessment.evidenceStrength,
        citedUrls: citedUrls(post), claimVerification: "author_claim_unverified" as const,
        textSource: post.note_post?.text?.trim() ? "note_post" as const : "post_text" as const
      }];
    });
    const rejectedCount = Object.values(rejected).reduce((sum, count) => sum + count, 0);
    if (rejectedCount) limitations.push(note(parsed,
      `X 质量门禁剔除 ${rejectedCount} 条：回复/转发 ${rejected.reply}、过短 ${rejected.thin}、偏题 ${rejected.off_topic}、推广 ${rejected.promo}、缺少具体经验或证据 ${rejected.shallow}、热度不足 ${rejected.low_engagement}。`,
      `X quality gate rejected ${rejectedCount} posts: replies/reposts ${rejected.reply}, too short ${rejected.thin}, off-topic ${rejected.off_topic}, promotion ${rejected.promo}, lacking concrete experience or evidence ${rejected.shallow}, low engagement for a popularity request ${rejected.low_engagement}.`));
    return { items, limitations, queriedPlatforms: ["x"] };
  } catch (error) {
    return { items: [], limitations: [...limitations, note(parsed,
      `X 获取失败：${String(error)}。`, `X collection failed: ${String(error)}.`)], queriedPlatforms: ["x"] };
  }
}
