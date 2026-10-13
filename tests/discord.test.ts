import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectDiscord, loadDiscordScope } from "../src/adapters/discord.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";
import { runLiveCommunitySignalAnalysis } from "../src/index.js";
const guild = "111111111111111111", channel = "222222222222222222", rootId = "333333333333333333", replyId = "444444444444444444";
let dir: string, scope: string;
const parsed = () => parseQuery("Find recent Discord AI coding discussions in English");
const cutoff = () => new Date("2026-09-21T12:00:00Z");
const message = (overrides: Record<string, unknown> = {}) => ({ id: rootId, channel_id: channel, type: 0, content: "AI coding with Codex needs a review workflow. We tested our software repository and found fewer regression bugs after adding tests.", author: { id: "555555555555555555", username: "author" }, timestamp: "2026-09-28T09:00:00Z", reactions: [{ count: 8 }, { count: 3 }], ...overrides });
const reply = (overrides: Record<string, unknown> = {}) => message({ id: replyId, type: 19, author: { id: "666666666666666666", username: "reader" }, timestamp: "2026-09-28T10:00:00Z", content: "I tried Codex for AI coding in this workflow. Review and tests matter because our repository still had regression bugs after generation.", message_reference: { type: 0, message_id: rootId, channel_id: channel, guild_id: guild }, ...overrides });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const setup = (messages: unknown[], metadata: unknown = { id: channel, guild_id: guild, type: 0, name: "coding" }) => {
  const fetchMock = vi.fn(async (input: string | URL) => String(input).includes("/messages?") ? json(messages) : json(metadata));
  vi.stubGlobal("fetch", fetchMock); return fetchMock;
};
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "community-signal-discord-test-")); scope = join(dir, "scope.json");
  writeFileSync(scope, JSON.stringify({ schemaVersion: 1, channels: [{ guildId: guild, channelId: channel }] }));
  vi.stubEnv("DISCORD_API_ENABLED", "true"); vi.stubEnv("DISCORD_BOT_TOKEN", "synthetic-test-token"); vi.stubEnv("DISCORD_SCOPE_FILE", scope);
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); rmSync(dir, { recursive: true }); });

describe("Discord authorized channel adapter", () => {
  it("makes zero requests without explicit access", async () => {
    vi.stubEnv("DISCORD_API_ENABLED", "false"); const mock = setup([]);
    const result = await collectDiscord(parsed(), cutoff()); expect(result.queriedPlatforms).toEqual([]); expect(mock).not.toHaveBeenCalled();
  });
  it.each([
    { schemaVersion: 1, channels: [] },
    { schemaVersion: 1, channels: [{ guildId: guild, channelId: "bad" }] },
    { schemaVersion: 1, channels: Array.from({ length: 4 }, (_, i) => ({ guildId: guild, channelId: String(BigInt(channel) + BigInt(i)) })) },
    { schemaVersion: 1, channels: [{ guildId: guild, channelId: channel }, { guildId: guild, channelId: channel }] }
  ])("rejects invalid scope before sending credentials", async (value) => {
    writeFileSync(scope, JSON.stringify(value)); const mock = setup([]);
    expect(() => loadDiscordScope(scope)).toThrow(); expect((await collectDiscord(parsed(), cutoff())).queriedPlatforms).toEqual([]); expect(mock).not.toHaveBeenCalled();
  });
  it.each([{ id: channel, guild_id: "777777777777777777", type: 0 }, { id: channel, guild_id: guild, type: 1 }, { id: channel, guild_id: guild, type: 15 }])("does not read messages for a mismatched guild or unsupported channel", async (metadata) => {
    const mock = setup([message()], metadata); const result = await collectDiscord(parsed(), cutoff());
    expect(mock).toHaveBeenCalledTimes(1); expect(result.items).toEqual([]);
  });
  it("retains real IDs, dates, API text, direct replies and reaction counts without inventing totals", async () => {
    const mock = setup([reply(), message()]); const result = await collectDiscord(parsed(), cutoff());
    expect(mock).toHaveBeenCalledTimes(2); expect(String(mock.mock.calls[1][0])).toContain("limit=50");
    const item = result.items[0]; expect(result.items).toHaveLength(1); expect(item.id).toBe(rootId);
    expect(item.engagementMetrics).toEqual({ reactions: 11 }); expect(item.comments).toHaveLength(1);
    expect(item.comments[0]).toMatchObject({ parentItemId: rootId, retrievalMethod: "discord_bot_api", isDirectQuote: true });
    expect(item.discordContext).toMatchObject({ sampledMessages: 2, sampledReplyCount: 1, access: "permission_required" });
    expect(item.url).toBe(`https://discord.com/channels/${guild}/${channel}/${rootId}`);
  });
  it("excludes bots, promotions, forwarded bodies, invalid dates and out-of-scope references", async () => {
    setup([message(), message({ id: replyId, timestamp: "2026-02-30T10:00:00Z" }), message({ id: replyId, timestamp: "2026-09-29T10:00:00Z" }),
      message({ id: replyId, timestamp: "2026-09-01T10:00:00Z" }), message({ id: replyId, author: { id: guild, username: "bot", bot: true } }),
      message({ id: replyId, webhook_id: guild }), message({ id: replyId, message_snapshots: [{}] }),
      message({ id: replyId, content: "Join my giveaway for AI coding rewards. " + "Advertised promotion. ".repeat(8) }),
      reply({ message_reference: { message_id: rootId, channel_id: "888888888888888888", guild_id: guild } }),
      reply({ message_reference: { message_id: rootId, channel_id: channel, guild_id: "999999999999999999" } })]);
    const result = await collectDiscord(parsed(), cutoff()); expect(result.items.map((item) => item.id)).toEqual([rootId]); expect(result.items[0].comments).toEqual([]);
  });
  it("does not fetch an absent parent or import embedded parent bodies", async () => {
    const mock = setup([reply({ referenced_message: message(), message_reference: { message_id: "777777777777777777", channel_id: channel } })]);
    const result = await collectDiscord(parsed(), cutoff()); expect(mock).toHaveBeenCalledTimes(2);
    expect(result.items[0].discordContext?.parentMessageId).toBe("777777777777777777"); expect(result.items[0].comments).toEqual([]);
  });
  it("limits each page to 50 messages and each root to 3 distinct direct replies", async () => {
    const replies = Array.from({ length: 59 }, (_, i) => reply({ id: String(BigInt(replyId) + BigInt(i)) })); setup([message(), ...replies]);
    const result = await collectDiscord(parsed(), cutoff()); expect(result.items).toHaveLength(1); expect(result.items[0].comments).toHaveLength(3); expect(result.items[0].discordContext?.sampledMessages).toBe(50);
  });
  it("does not treat missing text or missing history as no discussion", async () => {
    setup([message({ content: "" })]); expect((await collectDiscord(parsed(), cutoff())).limitations.join(" ")).toContain("does not imply no discussion");
    setup([]); expect((await collectDiscord(parsed(), cutoff())).limitations.join(" ")).toContain("history permissions");
  });
  it.each([401, 429])("stops remaining channels on HTTP %s without logging server bodies or credentials", async (status) => {
    writeFileSync(scope, JSON.stringify({ schemaVersion: 1, channels: [{ guildId: guild, channelId: channel }, { guildId: guild, channelId: replyId }] }));
    const mock = vi.fn(async () => json({ message: "sensitive server body" }, status)); vi.stubGlobal("fetch", mock);
    const result = await collectDiscord(parsed(), cutoff()); expect(mock).toHaveBeenCalledTimes(1);
    expect(result.limitations.join(" ")).not.toMatch(/sensitive|synthetic-test-token/);
  });
  it("continues healthy channels after a forbidden one", async () => {
    writeFileSync(scope, JSON.stringify({ schemaVersion: 1, channels: [{ guildId: guild, channelId: replyId }, { guildId: guild, channelId: channel }] }));
    const mock = vi.fn(async (input: string | URL) => String(input).includes(`/channels/${replyId}`) ? json({}, 403) : String(input).includes("/messages?") ? json([message()]) : json({ id: channel, guild_id: guild, type: 11 })); vi.stubGlobal("fetch", mock);
    const result = await collectDiscord(parsed(), cutoff()); expect(mock).toHaveBeenCalledTimes(3); expect(result.items).toHaveLength(1);
  });
  it("bounds streamed responses and requires redirects to fail", async () => {
    const mock = vi.fn(async (_input: string | URL, options?: RequestInit) => { expect(options?.redirect).toBe("error"); return new Response("x".repeat(1_000_001)); }); vi.stubGlobal("fetch", mock);
    expect((await collectDiscord(parsed(), cutoff())).items).toEqual([]); expect(mock).toHaveBeenCalledTimes(1);
  });
  it("integrates Chinese and English reports with scope and inaccessible parent context", async () => {
    setup([reply({ message_reference: { message_id: "777777777777777777", channel_id: channel } }), message()]);
    const en = await runLiveCommunitySignalAnalysis("Find 5 recent Discord AI coding discussions in English");
    expect(en.selectedItems.length).toBeGreaterThan(0); expect(en.markdown).toContain("Authorized scope:"); expect(en.markdown).toContain("not unique users"); expect(en.markdown).toContain("parent context is unavailable");
    const zh = await runLiveCommunitySignalAnalysis("找 5 条最近 Discord AI coding 讨论"); expect(zh.markdown).toContain("授权范围："); expect(zh.markdown).toContain("并非回复总数");
  });
});
