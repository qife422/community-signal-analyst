import type { CollectionResult, ParsedQuery, Platform, SourceItem } from "../types/communitySignal.js";
import { collectProductHunt, collectReddit } from "./authorized.js";
import { collectX } from "./x.js";
import { collectDiscord } from "./discord.js";
import { collectWhop } from "./whop.js";

const USER_AGENT = "community-signal-analyst/1.1 (public community research)";
const note = (parsed: ParsedQuery, zh: string, en: string): string => parsed.language === "en" ? en : zh;

export function cutoffFor(range: ParsedQuery["timeRange"], now = new Date()): Date {
  const days = { recent_24h: 1, recent_3d: 3, recent_7d: 7, recent_14d: 14, recent_30d: 30 }[range];
  return new Date(now.getTime() - days * 86_400_000);
}

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    const remaining = response.headers?.get("x-ratelimit-remaining");
    const reset = response.headers?.get("x-ratelimit-reset");
    const resetAt = reset && Number.isFinite(Number(reset)) ? new Date(Number(reset) * 1000).toISOString() : undefined;
    throw new Error(`HTTP ${response.status}${remaining === "0" ? `; rate limit reset ${resetAt ?? "time unavailable"}` : ""}`);
  }
  return await response.json() as T;
}

function plain(value: unknown, limit = 360): string {
  const cleaned = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/&(?:amp|#38);/g, "&")
    .replace(/&(?:lt|#60);/g, "<")
    .replace(/&(?:gt|#62);/g, ">")
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => String.fromCodePoint(code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : parseInt(code, 10)))
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= limit) return cleaned;
  const clipped = cleaned.slice(0, limit);
  return `${clipped.slice(0, Math.max(clipped.lastIndexOf(" "), limit - 25)).trimEnd()}…`;
}

function commentQuality(text: string, parsed: ParsedQuery): number {
  const lower = text.toLowerCase();
  const keywordHits = parsed.keywords.filter((keyword) => lower.includes(keyword.toLowerCase())).length;
  const reasoning = /because|however|but|although|i used|i tried|benchmark|cost|latency|bug|issue|trade.?off|原因|但是|测试|实际|问题|成本|性能/i.test(text) ? 2 : 0;
  return keywordHits * 3 + reasoning + Math.min(text.length, 240) / 120;
}

function base(platform: Platform, id: string, title: string, url: string, publishedAt: string, fetchedAt: string): SourceItem {
  return {
    id, platform, contentType: platform === "github" ? "repo" : platform === "devto" ? "article" : "post",
    title, url, publishedAt, fetchedAt, summary: title, engagementMetrics: {}, comments: [],
    isMockData: false, sourceStatus: "verified_api"
  };
}

type HnItem = { id: number; type?: string; deleted?: boolean; dead?: boolean; title?: string; text?: string; url?: string; by?: string; time?: number; score?: number; descendants?: number; kids?: number[] };

async function collectHackerNews(parsed: ParsedQuery, cutoff: Date): Promise<CollectionResult> {
  const root = "https://hacker-news.firebaseio.com/v0";
  const feeds = ["topstories", "newstories", "askstories", "showstories"];
  const feedResults = await Promise.allSettled(feeds.map((feed) => getJson<number[]>(`${root}/${feed}.json`)));
  const limitations = feedResults.flatMap((result, index) => result.status === "rejected" ? [note(parsed, `Hacker News ${feeds[index]} 获取失败：${String(result.reason)}`, `Hacker News ${feeds[index]} failed: ${String(result.reason)}`)] : []);
  const searchTerms = parsed.keywords.filter((term) => /^[\w\s.-]+$/.test(term)).slice(0, 3);
  const searches = await Promise.allSettled(searchTerms.map((term) => {
    const url = new URL("https://hn.algolia.com/api/v1/search");
    url.searchParams.set("query", term);
    url.searchParams.set("tags", "story");
    url.searchParams.set("numericFilters", `created_at_i>${Math.floor(cutoff.getTime() / 1000)}`);
    url.searchParams.set("hitsPerPage", "30");
    return getJson<{ hits: Array<{ objectID: string }> }>(url.toString());
  }));
  for (let index = 0; index < searches.length; index++) {
    if (searches[index].status === "rejected") limitations.push(note(parsed, `HN Search 搜索“${searchTerms[index]}”失败；本次只使用可取得的候选。`, `HN Search failed for “${searchTerms[index]}”; only available candidates were used.`));
  }
  const searchIds = searches.flatMap((result) => result.status === "fulfilled" ? (result.value.hits ?? []).map((hit) => Number(hit.objectID)).filter(Number.isFinite) : []);
  const ids = [...new Set([...searchIds, ...feedResults.flatMap((result) => result.status === "fulfilled" ? result.value.slice(0, 25) : [])])].slice(0, 150);
  const fetchedAt = new Date().toISOString();
  const items: SourceItem[] = [];
  for (let offset = 0; offset < ids.length; offset += 12) {
    const batch = await Promise.allSettled(ids.slice(offset, offset + 12).map((id) => getJson<HnItem>(`${root}/item/${id}.json`)));
    for (const result of batch) {
      if (result.status !== "fulfilled") continue;
      const item = result.value;
      if (!item?.title || !item.time || item.dead || item.deleted || new Date(item.time * 1000) < cutoff) continue;
      const entry = base("hacker_news", String(item.id), plain(item.title), `https://news.ycombinator.com/item?id=${item.id}`, new Date(item.time * 1000).toISOString(), fetchedAt);
      entry.author = item.by;
      if (item.url?.startsWith("https://")) entry.citedUrls = [item.url];
      entry.rawExcerpt = plain(item.text);
      entry.summary = entry.rawExcerpt || entry.title;
      entry.engagementMetrics = { points: item.score, commentsCount: item.descendants };
      entry.tags = item.type ? [item.type] : [];
      items.push(entry);
    }
  }
  const terms = parsed.keywords.map((keyword) => keyword.toLowerCase());
  const relevant = items.filter((item) => terms.some((term) => `${item.title} ${item.rawExcerpt}`.toLowerCase().includes(term)))
    .sort((a, b) => {
      const matchScore = (entry: SourceItem) => terms.filter((term) => entry.title.toLowerCase().includes(term)).length * 10 + Math.log1p(entry.engagementMetrics.commentsCount ?? 0);
      return matchScore(b) - matchScore(a);
    }).slice(0, 14);
  await Promise.all(relevant.map(async (item) => {
    try {
      const story = await getJson<HnItem>(`${root}/item/${item.id}.json`);
      const comments = await Promise.allSettled((story.kids ?? []).slice(0, 8).map((id) => getJson<HnItem>(`${root}/item/${id}.json`)));
      item.comments = comments.flatMap((result) => {
        if (result.status !== "fulfilled" || !result.value.text || result.value.deleted || result.value.dead || result.value.by === item.author) return [];
        const summary = plain(result.value.text, 200);
        if (summary.length < 60 || !relevantComment(summary, parsed)) return [];
        return [{ source: "hacker_news" as const, author: result.value.by, url: `https://news.ycombinator.com/item?id=${result.value.id}`, summary, signalType: "neutral" as const, isDirectQuote: false }];
      }).sort((a, b) => commentQuality(b.summary, parsed) - commentQuality(a.summary, parsed)).slice(0, 3);
    } catch { /* A missing comment does not invalidate a verified story. */ }
  }));
  if (!ids.length) limitations.push(note(parsed, "Hacker News 没有可读取的列表数据。", "Hacker News returned no readable listing data."));
  return { items, limitations };
}

type GhRepo = { id: number; full_name: string; html_url: string; description: string | null; created_at: string; updated_at: string; stargazers_count: number; forks_count: number; open_issues_count: number; owner?: { login?: string }; topics?: string[] };
type GhIssue = { id: number; title: string; html_url: string; body?: string | null; created_at: string; comments: number; comments_url: string; user?: { login?: string }; labels?: Array<{ name?: string }> };
type GhComment = { body?: string; html_url?: string; user?: { login?: string } };

function githubHeaders(): Record<string, string> {
  return { "X-GitHub-Api-Version": "2022-11-28", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
}

async function collectGitHub(parsed: ParsedQuery, cutoff: Date): Promise<CollectionResult> {
  const fetchedAt = new Date().toISOString();
  const limitations: string[] = [];
  const items: SourceItem[] = [];
  const issueCommentUrls = new Map<string, string>();
  const terms = parsed.keywords.filter((term) => /^[\w\s.-]+$/.test(term)).slice(0, 2);
  for (const term of terms) {
    const query = `${term} in:name,description created:>=${cutoff.toISOString().slice(0, 10)}`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=20`;
    try {
      const result = await getJson<{ items: GhRepo[]; incomplete_results?: boolean }>(url, githubHeaders());
      if (result.incomplete_results) limitations.push(note(parsed, "GitHub Search 返回 incomplete_results，候选可能不完整。", "GitHub Search reported incomplete_results; candidates may be missing."));
      for (const repo of result.items ?? []) {
        const entry = base("github", String(repo.id), repo.full_name, repo.html_url, repo.created_at, fetchedAt);
        entry.author = repo.owner?.login;
        entry.rawExcerpt = plain(repo.description);
        entry.summary = entry.rawExcerpt || repo.full_name;
        entry.tags = repo.topics ?? [];
        entry.engagementMetrics = { stars: repo.stargazers_count, forks: repo.forks_count, openIssues: repo.open_issues_count };
        items.push(entry);
      }
    } catch (error) {
      limitations.push(note(parsed, `GitHub 搜索“${term}”失败：${String(error)}。可能受 API 限额或网络状态影响。`, `GitHub repository search failed for “${term}”: ${String(error)}. API limits or network conditions may be involved.`));
    }
  }
  if (parsed.analysisMode !== "investment_research") {
    for (const term of terms) {
      const query = `${term} in:title,body type:issue created:>=${cutoff.toISOString().slice(0, 10)}`;
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=comments&order=desc&per_page=20`;
      try {
        const result = await getJson<{ items: GhIssue[]; incomplete_results?: boolean }>(url, githubHeaders());
        if (result.incomplete_results) limitations.push(note(parsed, "GitHub Issue Search 返回 incomplete_results，讨论候选可能不完整。", "GitHub Issue Search reported incomplete_results; discussion candidates may be missing."));
        for (const issue of result.items ?? []) {
          if (!issue.title || !issue.html_url || !issue.created_at) continue;
          const entry = base("github", `issue-${issue.id}`, issue.title, issue.html_url, issue.created_at, fetchedAt);
          entry.contentType = "issue";
          entry.author = issue.user?.login;
          entry.rawExcerpt = plain(issue.body);
          entry.summary = entry.rawExcerpt || issue.title;
          entry.tags = (issue.labels ?? []).map((label) => label.name ?? "").filter(Boolean);
          entry.engagementMetrics = { commentsCount: issue.comments };
          if (issue.comments_url?.startsWith("https://api.github.com/repos/")) issueCommentUrls.set(entry.id, issue.comments_url);
          items.push(entry);
        }
      } catch (error) {
        limitations.push(note(parsed, `GitHub issue 搜索“${term}”失败：${String(error)}。`, `GitHub issue search failed for “${term}”: ${String(error)}.`));
      }
    }
    const issueCandidates = items.filter((item) => item.contentType === "issue" && item.engagementMetrics.commentsCount && issueCommentUrls.has(item.id))
      .sort((a, b) => (b.engagementMetrics.commentsCount ?? 0) - (a.engagementMetrics.commentsCount ?? 0)).slice(0, 8);
    await Promise.all(issueCandidates.map(async (item) => {
      try {
        const comments = await getJson<GhComment[]>(`${issueCommentUrls.get(item.id)}?per_page=20`, githubHeaders());
        item.comments = comments.filter((comment) => comment.user?.login !== item.author && plain(comment.body).length >= 60 && relevantComment(plain(comment.body), parsed))
          .sort((a, b) => commentQuality(plain(b.body), parsed) - commentQuality(plain(a.body), parsed)).slice(0, 3).map((comment) => ({
          source: "github" as const, author: comment.user?.login, url: comment.html_url ?? item.url,
          summary: plain(comment.body, 200), signalType: "neutral" as const, isDirectQuote: false
        }));
      } catch { /* Partial comment access is reported at item level. */ }
    }));
  }
  if (!terms.length) limitations.push(note(parsed, "GitHub：当前关键词不适合仓库搜索，本次未查询。", "GitHub was not queried because no usable repository search terms were found."));
  return { items: [...new Map(items.map((item) => [item.id, item])).values()], limitations };
}

type DevArticle = { id: number; title: string; url: string; user?: { username?: string }; published_at?: string; description?: string; tag_list?: string[]; positive_reactions_count?: number; comments_count?: number };
type DevComment = { id_code?: string; body_html?: string; user?: { username?: string } };

async function collectDevTo(parsed: ParsedQuery, cutoff: Date): Promise<CollectionResult> {
  const fetchedAt = new Date().toISOString();
  const limitations: string[] = [];
  const items: SourceItem[] = [];
  const endpoints = ["https://dev.to/api/articles/latest?per_page=100", "https://dev.to/api/articles?per_page=100&top=7"];
  const results = await Promise.allSettled(endpoints.map((url) => getJson<DevArticle[]>(url)));
  for (const result of results) {
    if (result.status === "rejected") { limitations.push(note(parsed, `DEV 列表获取失败：${String(result.reason)}`, `DEV article listing failed: ${String(result.reason)}`)); continue; }
    for (const article of result.value) {
      if (!article.published_at || new Date(article.published_at) < cutoff) continue;
      const entry = base("devto", String(article.id), article.title, article.url, article.published_at, fetchedAt);
      entry.author = article.user?.username;
      entry.rawExcerpt = plain(article.description);
      entry.summary = entry.rawExcerpt || article.title;
      entry.tags = article.tag_list ?? [];
      entry.engagementMetrics = { reactions: article.positive_reactions_count, commentsCount: article.comments_count };
      items.push(entry);
    }
  }
  const unique = [...new Map(items.map((item) => [item.id, item])).values()];
  const terms = parsed.keywords.map((keyword) => keyword.toLowerCase());
  const relevant = unique.filter((item) => terms.some((term) => `${item.title} ${item.summary} ${(item.tags ?? []).join(" ")}`.toLowerCase().includes(term))).slice(0, 5);
  await Promise.all(relevant.map(async (item) => {
    try {
      const comments = await getJson<DevComment[]>(`https://dev.to/api/comments?a_id=${item.id}`);
      item.comments = comments.slice(0, 12).filter((comment) => comment.user?.username !== item.author && plain(comment.body_html).length >= 60 && relevantComment(plain(comment.body_html), parsed))
        .sort((a, b) => commentQuality(plain(b.body_html), parsed) - commentQuality(plain(a.body_html), parsed)).slice(0, 3).map((comment) => ({
        source: "devto" as const, author: comment.user?.username, url: comment.id_code ? `${item.url}#comment-${comment.id_code}` : item.url,
        summary: plain(comment.body_html, 200), signalType: "neutral" as const, isDirectQuote: false
      }));
    } catch { /* The article remains valid when comments are unavailable. */ }
  }));
  return { items: unique, limitations };
}

function relevantComment(text: string, parsed: ParsedQuery): boolean {
  if (parsed.analysisMode === "dev_tool_research" && parsed.topic === "AI coding tools") {
    return /cod(?:e|ing)|software|developer|programming|agent|\bllm\b|\bide\b|review|test|repo|workflow|代码|编程/i.test(text);
  }
  return true;
}

export async function collectLive(parsed: ParsedQuery): Promise<CollectionResult> {
  const cutoff = cutoffFor(parsed.timeRange);
  const collectors: Record<Platform, () => Promise<CollectionResult>> = {
    hacker_news: () => collectHackerNews(parsed, cutoff),
    github: () => collectGitHub(parsed, cutoff),
    devto: () => collectDevTo(parsed, cutoff),
    reddit: () => collectReddit(parsed, cutoff),
    product_hunt: () => collectProductHunt(parsed, cutoff),
    x: () => collectX(parsed, cutoff),
    discord: () => collectDiscord(parsed, cutoff),
    whop: () => collectWhop(parsed, cutoff)
  };
  const results = await Promise.allSettled(parsed.platforms.map((platform) => collectors[platform]()));
  const items: SourceItem[] = [];
  const limitations: string[] = [];
  const queriedPlatforms: Platform[] = [];
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (result.status === "fulfilled") { items.push(...result.value.items); limitations.push(...result.value.limitations); queriedPlatforms.push(...(result.value.queriedPlatforms ?? [parsed.platforms[index]])); }
    else limitations.push(note(parsed, `${parsed.platforms[index]} 获取失败：${String(result.reason)}`, `${parsed.platforms[index]} collection failed: ${String(result.reason)}`));
  }
  for (const platform of parsed.unavailablePlatforms ?? []) limitations.push(note(parsed, `权限限制：${platform} 尚未接入，本次未查询该平台。`, `Access limitation: ${platform} is not integrated and was not queried.`));
  return { items, limitations, queriedPlatforms };
}
