import type { CollectionResult, ParsedQuery, SourceItem } from "../types/communitySignal.js";

const note = (parsed: ParsedQuery, zh: string, en: string) => parsed.language === "en" ? en : zh;
const clean = (value: unknown, max = 360) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, max);
const validUrl = (url: unknown, host: string) => {
  try { const parsed = new URL(String(url)); return parsed.protocol === "https:" && (parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)); }
  catch { return false; }
};

type RedditPost = { id: string; title: string; selftext?: string; author?: string; subreddit?: string; permalink?: string; created_utc?: number; score?: number; num_comments?: number; over_18?: boolean; stickied?: boolean };
type RedditComment = { body?: string; author?: string; permalink?: string; score?: number };
type RedditListing<T> = { data?: { children?: Array<{ kind: string; data: T }> } };

export async function collectReddit(parsed: ParsedQuery, cutoff: Date): Promise<CollectionResult> {
  const token = process.env.REDDIT_ACCESS_TOKEN;
  if (!token) return { items: [], limitations: [note(parsed, "权限限制：未提供 REDDIT_ACCESS_TOKEN；Reddit 未查询。", "Access limitation: REDDIT_ACCESS_TOKEN is missing; Reddit was not queried.")], queriedPlatforms: [] };
  const userAgent = process.env.REDDIT_USER_AGENT;
  if (!userAgent || !/^[^:]+:[^:]+:[^ ]+ \(by \/u\/[A-Za-z0-9_-]+\)$/.test(userAgent)) {
    return { items: [], limitations: [note(parsed, "权限限制：未提供符合 Reddit 格式的 REDDIT_USER_AGENT；Reddit 未查询。", "Access limitation: REDDIT_USER_AGENT is missing or invalid; Reddit was not queried.")], queriedPlatforms: [] };
  }
  if (process.env.REDDIT_API_APPROVED !== "true") {
    return { items: [], limitations: [note(parsed, "权限限制：未确认 Reddit 对当前用途的 API 访问批准（REDDIT_API_APPROVED=true）；Reddit 未查询。", "Access limitation: Reddit API approval for this use has not been confirmed (REDDIT_API_APPROVED=true); Reddit was not queried.")], queriedPlatforms: [] };
  }
  const limitations: string[] = [];
  const items: SourceItem[] = [];
  const terms = parsed.keywords.filter((term) => /^[\w\s.-]+$/.test(term)).slice(0, 2);
  if (!terms.length) return { items, limitations: [note(parsed, "Reddit：没有适用的英文搜索词，本次未查询。", "Reddit: no usable search term; no query was run.")], queriedPlatforms: [] };
  const headers = { Authorization: `Bearer ${token}`, "User-Agent": userAgent, Accept: "application/json" };
  for (const term of terms) {
    try {
      const url = new URL("https://oauth.reddit.com/search.json");
      url.searchParams.set("q", term);
      url.searchParams.set("sort", "new");
      url.searchParams.set("limit", "30");
      url.searchParams.set("raw_json", "1");
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const listing = await response.json() as RedditListing<RedditPost>;
      for (const child of listing.data?.children ?? []) {
        const post = child.data;
        if (child.kind !== "t3" || !post?.id || !post.title || !post.created_utc || post.over_18 || post.stickied || !post.permalink || new Date(post.created_utc * 1000) < cutoff) continue;
        const permalink = `https://www.reddit.com${post.permalink}`;
        if (!validUrl(permalink, "reddit.com")) continue;
        items.push({ id: post.id, platform: "reddit", contentType: "post", title: clean(post.title, 180), url: permalink,
          author: post.author, publishedAt: new Date(post.created_utc * 1000).toISOString(), fetchedAt: new Date().toISOString(),
          rawExcerpt: clean(post.selftext), summary: clean(post.selftext) || clean(post.title, 180), tags: post.subreddit ? [post.subreddit] : [],
          engagementMetrics: { points: post.score, commentsCount: post.num_comments }, comments: [], isMockData: false, sourceStatus: "verified_api" });
      }
    } catch (error) { limitations.push(note(parsed, `Reddit 搜索“${term}”失败：${String(error)}。`, `Reddit search failed for “${term}”: ${String(error)}.`)); }
  }
  const unique = [...new Map(items.map((item) => [item.id, item])).values()];
  const relevant = unique.filter((item) => parsed.keywords.some((term) => `${item.title} ${item.summary}`.toLowerCase().includes(term.toLowerCase())))
    .sort((a, b) => (b.engagementMetrics.commentsCount ?? 0) - (a.engagementMetrics.commentsCount ?? 0)).slice(0, 5);
  await Promise.all(relevant.map(async (item) => {
    try {
      const response = await fetch(`https://oauth.reddit.com/comments/${item.id}.json?limit=20&sort=top&raw_json=1`, { headers, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const listings = await response.json() as Array<RedditListing<RedditComment>>;
      item.comments = (listings[1]?.data?.children ?? []).filter((child) => child.kind === "t1" && clean(child.data.body).length >= 60 && child.data.author !== item.author)
        .sort((a, b) => (b.data.score ?? 0) - (a.data.score ?? 0)).slice(0, 3).map((child) => ({
          source: "reddit" as const, author: child.data.author, url: child.data.permalink ? `https://www.reddit.com${child.data.permalink}` : item.url,
          summary: clean(child.data.body, 200), signalType: "neutral" as const, isDirectQuote: false
        })).filter((comment) => validUrl(comment.url, "reddit.com"));
    } catch { limitations.push(note(parsed, `Reddit 帖子 ${item.id} 的评论不可用。`, `Reddit comments for post ${item.id} were unavailable.`)); }
  }));
  return { items: unique, limitations, queriedPlatforms: ["reddit"] };
}

type PhComment = { body: string; url: string; user?: { username?: string }; votesCount?: number };
type PhPost = { id: string; name: string; tagline?: string; description?: string; url: string; createdAt: string; featuredAt?: string | null; votesCount?: number; commentsCount?: number; user?: { username?: string }; comments?: { edges?: Array<{ node: PhComment }> } };
type PhResponse = { data?: { posts?: { edges?: Array<{ node: PhPost }> }; post?: PhPost }; errors?: Array<{ message?: string }> };

export async function collectProductHunt(parsed: ParsedQuery, cutoff: Date): Promise<CollectionResult> {
  const token = process.env.PRODUCT_HUNT_TOKEN;
  if (!token) return { items: [], limitations: [note(parsed, "权限限制：未提供 PRODUCT_HUNT_TOKEN；Product Hunt 未查询。", "Access limitation: PRODUCT_HUNT_TOKEN is missing; Product Hunt was not queried.")], queriedPlatforms: [] };
  const query = `query RecentPosts($after: DateTime!) { posts(first: 50, order: NEWEST, postedAfter: $after) { edges { node { id name tagline description url createdAt featuredAt votesCount commentsCount user { username } } } } }`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
  const fetchGraphql = async (query: string, variables: Record<string, string>): Promise<PhResponse> => {
    const response = await fetch("https://api.producthunt.com/v2/api/graphql", { method: "POST", headers, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as PhResponse;
    if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message ?? "GraphQL error").join("; ").slice(0, 200));
    return payload;
  };
  try {
    const payload = await fetchGraphql(query, { after: cutoff.toISOString() });
    const items = (payload.data?.posts?.edges ?? []).flatMap(({ node: post }): SourceItem[] => {
      const launchAt = post?.featuredAt ?? post?.createdAt;
      if (!post?.id || !post.name || !launchAt || !validUrl(post.url, "producthunt.com") || new Date(launchAt) < cutoff) return [];
      return [{ id: String(post.id), platform: "product_hunt", contentType: "post", title: clean(post.name, 180), url: post.url,
        author: post.user?.username, publishedAt: launchAt, fetchedAt: new Date().toISOString(), rawExcerpt: clean(`${post.tagline ?? ""} ${post.description ?? ""}`),
        summary: clean(post.tagline || post.description || post.name), engagementMetrics: { points: post.votesCount, commentsCount: post.commentsCount },
        comments: [],
        isMockData: false, sourceStatus: "verified_api" }];
    });
    const limitations = [note(parsed, "Product Hunt 仅采样近期最多 50 个发布；API 使用须符合其访问条款。", "Product Hunt sampled up to 50 recent launches; API use remains subject to its access terms.")];
    const relevant = items.filter((item) => parsed.keywords.some((term) => `${item.title} ${item.rawExcerpt}`.toLowerCase().includes(term.toLowerCase())))
      .sort((a, b) => (b.engagementMetrics.commentsCount ?? 0) - (a.engagementMetrics.commentsCount ?? 0)).slice(0, 5);
    const commentsQuery = `query PostComments($id: ID!) { post(id: $id) { comments(first: 8, order: VOTES_COUNT) { edges { node { body url votesCount user { username } } } } } }`;
    await Promise.all(relevant.filter((item) => (item.engagementMetrics.commentsCount ?? 0) > 0).map(async (item) => {
      try {
        const commentsPayload = await fetchGraphql(commentsQuery, { id: item.id });
        item.comments = (commentsPayload.data?.post?.comments?.edges ?? []).map(({ node: comment }) => ({ source: "product_hunt" as const, author: comment.user?.username, url: comment.url, summary: clean(comment.body, 200), signalType: "neutral" as const, isDirectQuote: false }))
          .filter((comment) => comment.summary.length >= 60 && validUrl(comment.url, "producthunt.com") && comment.author !== item.author).slice(0, 3);
      } catch (error) { limitations.push(note(parsed, `Product Hunt 发布 ${item.id} 的评论不可用：${String(error)}。`, `Product Hunt comments for post ${item.id} were unavailable: ${String(error)}.`)); }
    }));
    return { items, limitations, queriedPlatforms: ["product_hunt"] };
  } catch (error) { return { items: [], limitations: [note(parsed, `Product Hunt 获取失败：${String(error)}。`, `Product Hunt collection failed: ${String(error)}.`)], queriedPlatforms: ["product_hunt"] }; }
}
