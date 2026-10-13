import { readFileSync, statSync } from "node:fs";
import type { CollectionResult, ParsedQuery, SourceItem } from "../types/communitySignal.js";
import { expandKeyword } from "../query-parser/keywordConcepts.js";
import { groupCommentThemes } from "../comments/groupThemes.js";
import { object, WhopHttpError, whopJson } from "../whop/http.js";
import { readWhopTokens } from "../whop/oauth.js";

type Scope = { channelId?: string; experienceId: string; communityName: string; channelUrl: string };
type ResolvedScope = Scope & { channelId: string };
type Message = { id: string; content: string; created_at: string; message_type: "regular";
  user: { id: string; username: string; name?: string }; replying_to_message_id?: string | null;
  reaction_counts?: Array<{ count?: number }> };
const identifier = (v: unknown, prefix: string): v is string => typeof v === "string" && new RegExp(`^${prefix}_[A-Za-z0-9]{1,100}$`).test(v);
const note = (p: ParsedQuery, zh: string, en: string) => p.language === "en" ? en : zh;
function boundedFile(path: string, limit: number): unknown {
  const info = statSync(path);
  if (!info.isFile() || info.size > limit) throw new Error("Invalid or oversized input");
  const text = readFileSync(path, "utf8");
  if (Buffer.byteLength(text) > limit) throw new Error("Oversized input");
  return JSON.parse(text);
}
/** User-selected membership chats only. No DMs, account discovery or channel enumeration. */
export function loadWhopScope(path: string): Scope[] {
  const value = boundedFile(path, 20_000), seen = new Set<string>();
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.channels) || value.channels.length < 1 || value.channels.length > 3) throw new Error("Whop requires 1–3 explicit member chat scopes");
  return value.channels.map((entry) => {
    if (!object(entry) || (entry.channelId !== undefined && !identifier(entry.channelId, "chat_feed")) || !identifier(entry.experienceId, "exp")
      || typeof entry.communityName !== "string" || !entry.communityName.trim() || entry.communityName.length > 100
      || typeof entry.channelUrl !== "string" || entry.channelUrl.length > 2048 || /[\s<>]/.test(entry.channelUrl)
      || seen.has(entry.experienceId) || (typeof entry.channelId === "string" && seen.has(entry.channelId))) throw new Error("Invalid or duplicate Whop scope");
    const url = new URL(entry.channelUrl);
    if (url.protocol !== "https:" || url.hostname !== "whop.com" || url.port || url.username || url.password
      || url.search || url.hash || url.pathname === "/") throw new Error("Supply the clean original Whop channel URL");
    if (entry.channelId === undefined && !url.pathname.endsWith(`/${entry.experienceId}/app/`)) throw new Error("The selected URL must contain the exact experience ID");
    seen.add(entry.experienceId);
    if (typeof entry.channelId === "string") seen.add(entry.channelId);
    return { channelId: entry.channelId as string | undefined, experienceId: entry.experienceId, communityName: entry.communityName.trim(), channelUrl: url.href };
  });
}
function validTime(v: unknown): number {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return NaN;
  const day = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === v.slice(0, 10) ? Date.parse(v) : NaN;
}
function validMessage(v: unknown, scope: ResolvedScope, cutoff: number, now: number): v is Message {
  if (!object(v) || !identifier(v.id, "post") || typeof v.content !== "string" || v.message_type !== "regular"
    || !object(v.user) || !identifier(v.user.id, "user") || typeof v.user.username !== "string" || !v.user.username.trim()
    || (v.channel_id !== undefined && v.channel_id !== scope.channelId)
    || (v.replying_to_message_id != null && !identifier(v.replying_to_message_id, "post"))) return false;
  const time = validTime(v.created_at);
  return Number.isFinite(time) && time >= cutoff && time <= now;
}
function substantial(text: string, reply = false): boolean {
  const minimum = /[\u3400-\u9fff]/.test(text) ? reply ? 30 : 40 : reply ? 60 : 80;
  return text.trim().length >= minimum && !/\b(?:airdrop|giveaway|join my|dm me|promo code|discount code|affiliate link|guaranteed profit)\b|加群|私信领取|保证收益/i.test(text);
}
function matches(text: string, p: ParsedQuery): boolean {
  return p.keywords.some(k => expandKeyword(k).some(t => text.toLowerCase().includes(t.toLowerCase())));
}
function links(text: string): string[] {
  return [...new Set((text.match(/https:\/\/[^\s<>]+/g) ?? []).flatMap(raw => {
    try { const url = new URL(raw.replace(/[).,;!?]+$/, "")); return url.username || url.password ? [] : [url.href]; } catch { return []; }
  }))].slice(0, 5);
}
/** Preliminary collector: at most six GETs; actual ordinary-member access still needs live acceptance. */
export async function collectWhop(parsed: ParsedQuery, cutoff: Date): Promise<CollectionResult> {
  const items: SourceItem[] = [], limitations: string[] = [], queriedPlatforms: "whop"[] = [];
  const disabled = (zh: string, en: string): CollectionResult => ({ items, limitations: [note(parsed, zh, en)], queriedPlatforms });
  if (process.env.WHOP_API_ENABLED !== "true" || !process.env.WHOP_SCOPE_FILE) return disabled(
    "Whop 未查询：需要启用 WHOP_API_ENABLED、用户 OAuth 凭据和明确选择的会员聊天室范围。",
    "Whop was not queried: enable WHOP_API_ENABLED and supply user OAuth credentials and selected member chat scopes.");
  let scopes: Scope[], token: string;
  try {
    scopes = loadWhopScope(process.env.WHOP_SCOPE_FILE);
    token = process.env.WHOP_USER_ACCESS_TOKEN?.trim() || readWhopTokens(process.env.WHOP_TOKEN_FILE ?? "").accessToken;
    if (!token || token.length > 20_000 || /\s/.test(token)) throw new Error("Invalid token");
  } catch { return disabled("Whop 未查询：范围或 OAuth 凭据缺失、过期或无效；未发送凭据。", "Whop was not queried: scope or OAuth credentials are missing, expired or invalid; no credentials were sent."); }
  for (const selected of scopes) {
    try {
      if (!queriedPlatforms.length) queriedPlatforms.push("whop");
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const channel = await whopJson(`/api/v1/chat_channels/${selected.channelId ?? selected.experienceId}`, { headers });
      if (!object(channel) || !identifier(channel.id, "chat_feed") || (selected.channelId !== undefined && channel.id !== selected.channelId) || !object(channel.experience) || channel.experience.id !== selected.experienceId) {
        limitations.push(note(parsed, `Whop 频道 ${selected.experienceId} 与指定体验不符，未读取消息。`, `Whop channel ${selected.experienceId} does not match its selected experience; messages were not read.`)); continue;
      }
      const scope: ResolvedScope = {...selected, channelId: channel.id};
      const data = await whopJson(`/api/v1/messages?${new URLSearchParams({ channel_id: scope.channelId, first: "50", direction: "desc" })}`, { headers });
      if (!object(data) || !Array.isArray(data.data) || !object(data.page_info) || typeof data.page_info.has_next_page !== "boolean") throw new Error("Invalid messages response");
      const fetchedAt = new Date().toISOString(), now = Date.parse(fetchedAt), window = data.data.slice(0, 50);
      const messages = [...new Map(window.filter(m => validMessage(m, scope, cutoff.getTime(), now)).map(m => [m.id, m])).values()];
      const roots = messages.filter(m => substantial(m.content) && matches(m.content, parsed)), rootIds = new Set(roots.map(m => m.id));
      for (const root of roots) {
        if (root.replying_to_message_id && rootIds.has(root.replying_to_message_id)) continue;
        const comments = messages.filter(m => m.replying_to_message_id === root.id && m.user.id !== root.user.id
          && validTime(m.created_at) >= validTime(root.created_at) && substantial(m.content, true))
          .sort((a,b) => validTime(b.created_at) - validTime(a.created_at)).slice(0,3).map(m => ({
            source: "whop" as const, sourceMessageId: m.id, author: m.user.username, url: scope.channelUrl, summary: m.content.slice(0,1000),
            signalType: "neutral" as const, isDirectQuote: true, publishedAt: m.created_at, fetchedAt,
            parentItemId: root.id, retrievalMethod: "whop_user_oauth" as const
          }));
        const raw = root.content.slice(0,4000);
        const counts = Array.isArray(root.reaction_counts) ? root.reaction_counts.flatMap(r => object(r) && Number.isSafeInteger(r.count) && (r.count as number) >= 0 ? [r.count as number] : []) : [];
        const count = counts.reduce((sum,n) => sum+n,0);
        items.push({ id: root.id, platform: "whop", contentType: "discussion", title: raw.replace(/\s+/g," ").trim().slice(0,140),
          url: scope.channelUrl, author: root.user.username, publishedAt: root.created_at, fetchedAt,
          rawExcerpt: raw, summary: raw.slice(0,360), engagementMetrics: counts.length && Number.isSafeInteger(count) ? {reactions:count} : {},
          comments, commentThemes: groupCommentThemes(comments), citedUrls: links(raw), isMockData: false, sourceStatus: "verified_api", claimVerification: "author_claim_unverified",
          whopContext: { channelId: scope.channelId, experienceId: scope.experienceId, communityName: scope.communityName,
            channelName: typeof channel.experience.name === "string" ? channel.experience.name.slice(0,100) : undefined,
            sampledMessages: window.length, messageLimit: 50, sampledReplyCount: comments.length, hasMoreMessages: data.page_info.has_next_page,
            parentMessageId: root.replying_to_message_id ?? undefined, contentTruncated: root.content.length > 4000,
            retrievalMethod: "whop_user_oauth", access: "membership_required", linkGranularity: "channel" }
        });
      }
      if (!window.length) limitations.push(note(parsed, `Whop 频道 ${scope.channelId} 本次返回空页，不能代表整个社区没有讨论。`, `Whop channel ${scope.channelId} returned an empty page; this does not describe all community activity.`));
    } catch (error) {
      const status = error instanceof WhopHttpError ? error.status : undefined;
      limitations.push(note(parsed, `Whop 频道 ${selected.experienceId} 读取失败${status ? `（HTTP ${status}）` : "（网络、响应或容量限制）"}；成员/OAuth 访问尚需核实，不能推断没有讨论。`, `Whop channel ${selected.experienceId} could not be read${status ? ` (HTTP ${status})` : " (network, response or size limit)"}; member/OAuth access must be checked, not inferred as inactivity.`));
      if (status === 401 || status === 429) break;
    }
  }
  limitations.push(note(parsed, "Whop 当前仅试验性读取最多 3 个明确选择的会员聊天室各最新 50 条消息及同批直接回复；无频道发现、翻页、附件读取或自动定时采集。链接为频道入口，reaction 为表情计数而非独立用户；真实成员跨社区访问尚未验收。", "Whop currently has a preliminary bounded read of up to 3 selected member chats, 50 latest messages each and same-page direct replies. No channel discovery, pagination, attachment reads or scheduled collection. Links open channels; reactions are emoji counts, not unique users. Live member access across communities is not yet accepted."));
  return {items,limitations,queriedPlatforms};
}
