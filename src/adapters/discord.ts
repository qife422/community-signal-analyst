import { readFileSync, statSync } from "node:fs";
import type { CollectionResult, ParsedQuery, SourceItem } from "../types/communitySignal.js";
import { expandKeyword } from "../query-parser/keywordConcepts.js";
import { groupCommentThemes } from "../comments/groupThemes.js";

type Scope = { guildId: string; channelId: string };
type Message = { id: string; channel_id: string; content: string; timestamp: string; type: number;
  author: { id: string; username: string; bot?: boolean }; webhook_id?: string;
  message_reference?: { type?: number; message_id?: string; channel_id?: string; guild_id?: string };
  reactions?: Array<{ count?: number }>; message_snapshots?: unknown[] };
const id = (value: unknown): value is string => typeof value === "string" && /^\d{17,20}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const note = (parsed: ParsedQuery, zh: string, en: string) => parsed.language === "en" ? en : zh;

/** Validate every scope entry before any authenticated request. No guild discovery. */
export function loadDiscordScope(path: string): Scope[] {
  const info = statSync(path);
  if (!info.isFile() || info.size > 20_000) throw new Error("Discord scope must be a regular JSON file of at most 20 KB.");
  const text = readFileSync(path, "utf8");
  if (Buffer.byteLength(text) > 20_000) throw new Error("Discord scope exceeds 20 KB.");
  const value: unknown = JSON.parse(text);
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.channels) || value.channels.length < 1 || value.channels.length > 3) throw new Error("Discord scope requires schemaVersion 1 and 1–3 explicit guild/channel pairs.");
  const seen = new Set<string>();
  return value.channels.map((entry) => {
    if (!object(entry) || !id(entry.guildId) || !id(entry.channelId) || seen.has(entry.channelId)) throw new Error("Discord scope has an invalid or duplicate channel.");
    seen.add(entry.channelId);
    return { guildId: entry.guildId, channelId: entry.channelId };
  });
}

class ApiError extends Error { constructor(readonly status: number) { super(`HTTP ${status}`); } }
async function getJson(path: string, token: string): Promise<unknown> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bot ${token}`, Accept: "application/json", "User-Agent": "community-signal-analyst/1.9" },
    redirect: "error", signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) { await response.body?.cancel(); throw new ApiError(response.status); }
  if (Number(response.headers.get("content-length")) > 1_000_000) { await response.body?.cancel(); throw new Error("response size limit"); }
  if (!response.body) throw new Error("empty response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1_000_000) { await reader.cancel(); throw new Error("response size limit"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function topic(text: string, parsed: ParsedQuery): boolean {
  const lower = text.toLowerCase();
  return parsed.keywords.some((keyword) => expandKeyword(keyword).some((term) => lower.includes(term.toLowerCase())));
}
function substantial(text: string, reply = false): boolean {
  const min = /[\u3400-\u9fff]/.test(text) ? reply ? 30 : 40 : reply ? 60 : 80;
  return text.trim().length >= min && !/\b(?:airdrop|giveaway|join my|dm me|promo code|discount code)\b|加群|私信领取/i.test(text);
}
function timestamp(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value.slice(0, 10) ? parsed : NaN;
}
function validMessage(value: unknown, scope: Scope, cutoff: number, now: number): value is Message {
  if (!object(value) || !id(value.id) || value.channel_id !== scope.channelId || typeof value.content !== "string"
    || !object(value.author) || !id(value.author.id) || typeof value.author.username !== "string" || !value.author.username
    || value.author.bot === true || value.webhook_id !== undefined || ![0, 19].includes(value.type as number)
    || (Array.isArray(value.message_snapshots) && value.message_snapshots.length > 0)) return false;
  const time = timestamp(value.timestamp);
  if ((value.type === 19 || value.message_reference !== undefined) && !parent(value as unknown as Message, scope)) return false;
  return Number.isFinite(time) && time >= cutoff && time <= now;
}
function parent(message: Message, scope: Scope): string | undefined {
  const ref = message.message_reference;
  return object(ref) && (ref.type === undefined || ref.type === 0) && ref.channel_id === scope.channelId
    && (ref.guild_id === undefined || ref.guild_id === scope.guildId) && id(ref.message_id) ? ref.message_id : undefined;
}
function links(text: string): string[] {
  return [...new Set((text.match(/https:\/\/[^\s<>]+/g) ?? []).flatMap((raw) => {
    try { const url = new URL(raw.replace(/[).,;!?]+$/, "")); return url.username || url.password ? [] : [url.href]; } catch { return []; }
  }))].slice(0, 5);
}

/** Read only explicitly authorized guild text channels or threads; at most 6 GETs. */
export async function collectDiscord(parsed: ParsedQuery, cutoff: Date): Promise<CollectionResult> {
  const items: SourceItem[] = [], limitations: string[] = [];
  const disabled = (zh: string, en: string): CollectionResult => ({ items, limitations: [note(parsed, zh, en)], queriedPlatforms: [] });
  const token = process.env.DISCORD_BOT_TOKEN;
  if (process.env.DISCORD_API_ENABLED !== "true" || !token || !process.env.DISCORD_SCOPE_FILE) return disabled(
    "Discord 未查询：需要启用 DISCORD_API_ENABLED、合法 Bot Token 和明确授权的频道范围文件。",
    "Discord was not queried: enable DISCORD_API_ENABLED and supply an authorized bot token and explicit channel scope file.");
  let scopes: Scope[];
  try { scopes = loadDiscordScope(process.env.DISCORD_SCOPE_FILE); }
  catch { return disabled("Discord 未查询：频道范围文件无效；请按访问说明配置，未发送凭据。", "Discord was not queried: the scope file is invalid; no credentials were sent."); }
  for (const scope of scopes) {
    try {
      const channel = await getJson(`/channels/${scope.channelId}`, token);
      if (!object(channel) || channel.id !== scope.channelId || channel.guild_id !== scope.guildId || ![0, 5, 10, 11, 12].includes(channel.type as number)) {
        limitations.push(note(parsed, `Discord 频道 ${scope.channelId} 的服务器或类型不符，未读取消息。`, `Discord channel ${scope.channelId} has an unexpected guild or type; messages were not read.`)); continue;
      }
      const data = await getJson(`/channels/${scope.channelId}/messages?limit=50`, token);
      if (!Array.isArray(data)) throw new Error("invalid message response");
      const fetchedAt = new Date().toISOString(), now = Date.parse(fetchedAt);
      const window = data.slice(0, 50);
      const messages = [...new Map(window.filter((message) => validMessage(message, scope, cutoff.getTime(), now)).map((message) => [message.id, message])).values()];
      const roots = messages.filter((message) => substantial(message.content) && topic(message.content, parsed));
      const rootIds = new Set(roots.map((message) => message.id));
      for (const root of roots) {
        const parentId = parent(root, scope);
        if (parentId && rootIds.has(parentId)) continue;
        const raw = root.content.slice(0, 4000), title = raw.replace(/\s+/g, " ").trim().slice(0, 140);
        const url = (messageId: string) => `https://discord.com/channels/${scope.guildId}/${scope.channelId}/${messageId}`;
        const comments = messages.filter((message) => parent(message, scope) === root.id && message.author.id !== root.author.id
          && timestamp(message.timestamp) >= timestamp(root.timestamp) && substantial(message.content, true) && topic(message.content, parsed))
          .sort((a, b) => timestamp(b.timestamp) - timestamp(a.timestamp)).slice(0, 3).map((message) => ({
            source: "discord" as const, author: message.author.username, url: url(message.id), summary: message.content.slice(0, 1000),
            signalType: "neutral" as const, isDirectQuote: true, publishedAt: message.timestamp, fetchedAt, parentItemId: root.id,
            retrievalMethod: "discord_bot_api" as const
          }));
        const counts = Array.isArray(root.reactions) ? root.reactions.flatMap((reaction) => object(reaction) && Number.isSafeInteger(reaction.count) && (reaction.count as number) >= 0 ? [reaction.count as number] : []) : [];
        const reactionSum = counts.reduce((sum, count) => sum + count, 0);
        items.push({ id: root.id, platform: "discord", contentType: "discussion", title, url: url(root.id), author: root.author.username,
          publishedAt: root.timestamp, fetchedAt, rawExcerpt: raw, summary: raw.slice(0, 360), engagementMetrics: counts.length && Number.isSafeInteger(reactionSum) ? { reactions: reactionSum } : {},
          comments, commentThemes: groupCommentThemes(comments), citedUrls: links(raw), isMockData: false, sourceStatus: "verified_api",
          discordContext: { guildId: scope.guildId, channelId: scope.channelId, channelName: typeof channel.name === "string" ? channel.name.slice(0, 100) : undefined,
            channelType: channel.type as number, sampledMessages: window.length, messageLimit: 50, sampledReplyCount: comments.length,
            parentMessageId: parentId, contentTruncated: root.content.length > 4000, retrievalMethod: "discord_bot_api", access: "permission_required" }
        });
      }
      if (window.length && !window.some((message) => object(message) && typeof message.content === "string" && message.content.trim())) limitations.push(note(parsed,
        `Discord 频道 ${scope.channelId} 返回消息但正文不可用；可能涉及 MESSAGE_CONTENT 权限或非文字消息，不能推断没有讨论。`,
        `Discord channel ${scope.channelId} returned messages without usable content; MESSAGE_CONTENT access or non-text messages may be involved. This does not imply no discussion.`));
      if (!window.length) limitations.push(note(parsed, `Discord 频道 ${scope.channelId} 未返回历史消息；空结果也可能由历史读取权限不足造成。`, `Discord channel ${scope.channelId} returned no history; missing history permissions can also cause an empty result.`));
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      limitations.push(note(parsed, `Discord 频道 ${scope.channelId} 读取失败${status ? `（HTTP ${status}）` : "（网络、响应或容量限制）"}；未取得的内容不推断。`,
        `Discord channel ${scope.channelId} could not be read${status ? ` (HTTP ${status})` : " (network, response, or size limit)"}; unavailable content is not inferred.`));
      if (status === 401 || status === 429) break;
    }
  }
  limitations.push(note(parsed, "Discord 只读取最多 3 个授权频道各最新 50 条消息，无翻页或频道发现；仅采样同批消息中的直接回复。reaction 为各表情计数之和，不是独立用户数；消息链接需要相应服务器权限。", "Discord reads only the newest 50 messages in each of up to 3 authorized channels, without pagination or channel discovery. Replies come only from that same page. Reactions sum emoji counts, not unique users; message links require server access."));
  return { items, limitations, queriedPlatforms: ["discord"] };
}
