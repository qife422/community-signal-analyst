import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLiveCommunitySignalAnalysis } from "../src/index.js";
const platforms = ["hacker_news", "github", "devto", "reddit", "product_hunt", "x", "discord"];
let temp: string | undefined;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); if (temp) rmSync(temp, { recursive: true }); temp = undefined; });

it("combines all seven adapters in one deterministic run without real network or paid calls", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  temp = mkdtempSync(join(tmpdir(), "community-signal-seven-test-")); const scope = join(temp, "scope.json");
  const guild = "111111111111111111", channel = "222222222222222222";
  writeFileSync(scope, JSON.stringify({ schemaVersion: 1, channels: [{ guildId: guild, channelId: channel }] }));
  for (const [key, value] of Object.entries({ REDDIT_ACCESS_TOKEN: "fixture", REDDIT_USER_AGENT: "script:fixture:1.9 (by /u/fixture)", REDDIT_API_APPROVED: "true", PRODUCT_HUNT_TOKEN: "fixture", X_API_ENABLED: "true", X_BEARER_TOKEN: "fixture", X_REPLIES_ENABLED: "false", DISCORD_API_ENABLED: "true", DISCORD_BOT_TOKEN: "fixture", DISCORD_SCOPE_FILE: scope })) vi.stubEnv(key, value);
  const text = "AI coding with Codex and Cursor: I tested software changes in production and found three regression bugs. Code review and tests caught errors before release.";
  const comment = { body: text, author: "reader", permalink: "/r/fixture/comments/r1/reply/", score: 3 };
  const fetchedHosts = new Set<string>();
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, options?: RequestInit) => {
    const url = new URL(String(input)); fetchedHosts.add(url.hostname); let body: unknown;
    if (url.hostname === "hn.algolia.com") body = { hits: [] };
    else if (url.hostname === "hacker-news.firebaseio.com") body = url.pathname.includes("/item/1.") ? { id: 1, type: "story", title: "AI coding Codex review for orchard storage", text, time: Date.parse("2026-09-28T09:00:00Z") / 1000, score: 80, descendants: 1, kids: [2], by: "author" } : url.pathname.includes("/item/2.") ? { id: 2, text, by: "reader" } : url.pathname.includes("topstories") ? [1] : [];
    else if (url.hostname === "api.github.com") body = url.pathname.includes("search/repositories") ? { items: [{ id: 3, full_name: "maker/AI-coding-Codex-mosaic", description: text, html_url: "https://github.com/maker/mosaic", created_at: "2026-09-28T09:00:00Z", stargazers_count: 100, forks_count: 10, owner: { login: "maker" }, topics: ["Codex", "Cursor"] }] } : { items: [] };
    else if (url.hostname === "dev.to") body = url.pathname.includes("comments") ? [{ id_code: "reply", body_html: text, user: { username: "reader" } }] : [{ id: 4, title: "AI coding Codex observability lessons", description: text, url: "https://dev.to/maker/observability", published_at: "2026-09-28T09:00:00Z", positive_reactions_count: 80, comments_count: 1, user: { username: "maker" } }];
    else if (url.hostname === "oauth.reddit.com") body = url.pathname.includes("/comments/") ? [{}, { data: { children: [{ kind: "t1", data: comment }] } }] : { data: { children: [{ kind: "t3", data: { id: "r1", title: "AI coding Codex sandbox isolation results", selftext: text, author: "maker", permalink: "/r/fixture/comments/r1/", created_utc: Date.parse("2026-09-28T09:00:00Z") / 1000, score: 80, num_comments: 1 } }] } };
    else if (url.hostname === "api.producthunt.com") body = String(options?.body).includes("PostComments") ? { data: { post: { comments: { edges: [{ node: { body: text, url: "https://www.producthunt.com/posts/fixture#reply", user: { username: "reader" } } }] } } } } : { data: { posts: { edges: [{ node: { id: "p1", name: "AI coding Codex compass assistant", description: text, tagline: text, url: "https://www.producthunt.com/posts/fixture", createdAt: "2026-09-28T09:00:00Z", votesCount: 80, commentsCount: 1, user: { username: "maker" } } }] } } };
    else if (url.hostname === "api.x.com") body = { data: [{ id: "2100000000000000000", text: `AI coding migration experiment. ${text}`, author_id: "xauthor", created_at: "2026-09-28T09:00:00Z", public_metrics: { like_count: 80, reply_count: 1, repost_count: 3 } }], includes: { users: [{ id: "xauthor", username: "maker" }] } };
    else if (url.hostname === "discord.com") body = url.pathname.includes("/messages") ? [{ id: "333333333333333333", channel_id: channel, type: 0, content: `AI coding Codex cache invalidation experiment. ${text}`, author: { id: "555555555555555555", username: "maker" }, timestamp: "2026-09-28T09:00:00Z", reactions: [{ count: 80 }] }] : { id: channel, guild_id: guild, type: 0, name: "fixture" };
    else throw new Error(`Unexpected fixture host: ${url.hostname}`);
    return new Response(JSON.stringify(body));
  }));
  const brief = await runLiveCommunitySignalAnalysis("Find 10 posts about AI coding on all platforms in English");
  expect(brief.queriedPlatforms).toEqual(platforms);
  expect(new Set(brief.selectedItems.map((item) => item.platform))).toEqual(new Set(platforms));
  expect(fetchedHosts).toEqual(new Set(["hn.algolia.com", "hacker-news.firebaseio.com", "api.github.com", "dev.to", "oauth.reddit.com", "api.producthunt.com", "api.x.com", "discord.com"]));
  expect(brief.selectedItems.every((item) => item.sourceStatus === "verified_api" && !item.isMockData)).toBe(true);
  expect(brief.markdown).toContain("Requested platforms: Hacker News, GitHub, DEV, Reddit, Product Hunt, X, Discord");
  expect(brief.markdown).toContain("Authorized scope:"); expect(brief.markdown).not.toContain("undefined");
});

it("keeps inaccessible gated platforms out of queried coverage in a joint run", async () => {
  for (const key of ["REDDIT_ACCESS_TOKEN", "PRODUCT_HUNT_TOKEN", "X_BEARER_TOKEN", "DISCORD_BOT_TOKEN"]) vi.stubEnv(key, "");
  const hosts = new Set<string>(); vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => { const url = new URL(String(input)); hosts.add(url.hostname); return new Response(JSON.stringify(url.hostname === "api.github.com" ? { items: [] } : url.hostname === "hn.algolia.com" ? { hits: [] } : [])); }));
  const brief = await runLiveCommunitySignalAnalysis("Find recent all platforms AI coding discussions in English");
  expect(brief.queriedPlatforms).toEqual(["hacker_news", "github", "devto"]);
  expect(hosts).toEqual(new Set(["hn.algolia.com", "hacker-news.firebaseio.com", "api.github.com", "dev.to"]));
  expect(brief.selectedItems).toEqual([]);
  for (const platform of ["Reddit", "Product Hunt", "X", "Discord"]) expect(brief.dataLimitations.join(" ")).toContain(platform);
});

it("runs the six-platform scope without Reddit calls even when Reddit inputs are present", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  temp = mkdtempSync(join(tmpdir(), "community-signal-six-test-")); const scope = join(temp, "scope.json");
  const guild = "111111111111111111", channel = "222222222222222222";
  writeFileSync(scope, JSON.stringify({ schemaVersion: 1, channels: [{ guildId: guild, channelId: channel }] }));
  for (const [key, value] of Object.entries({ REDDIT_ACCESS_TOKEN: "fixture", REDDIT_USER_AGENT: "script:fixture:1.9 (by /u/fixture)", REDDIT_API_APPROVED: "true", PRODUCT_HUNT_TOKEN: "fixture", X_API_ENABLED: "true", X_BEARER_TOKEN: "fixture", X_REPLIES_ENABLED: "false", DISCORD_API_ENABLED: "true", DISCORD_BOT_TOKEN: "fixture", DISCORD_SCOPE_FILE: scope })) vi.stubEnv(key, value);
  const hosts = new Set<string>();
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input)); hosts.add(url.hostname);
    if (url.hostname.includes("reddit")) throw new Error("Excluded platform was contacted");
    const body = url.hostname === "api.github.com" ? { items: [] }
      : url.hostname === "hn.algolia.com" ? { hits: [] }
      : url.hostname === "api.producthunt.com" ? { data: { posts: { edges: [] } } }
      : url.hostname === "api.x.com" ? { data: [] }
      : url.hostname === "discord.com" && !url.pathname.includes("/messages") ? { id: channel, guild_id: guild, type: 0, name: "fixture" }
      : [];
    return new Response(JSON.stringify(body));
  }));
  const brief = await runLiveCommunitySignalAnalysis("Find all platforms except Reddit AI coding discussions in English");
  expect(brief.parsedQuery.platforms).toEqual(platforms.filter(platform => platform !== "reddit"));
  expect(brief.queriedPlatforms).toEqual(brief.parsedQuery.platforms);
  expect(hosts).toEqual(new Set(["hn.algolia.com", "hacker-news.firebaseio.com", "api.github.com", "dev.to", "api.producthunt.com", "api.x.com", "discord.com"]));
  expect(brief.markdown).toContain("Requested platforms: Hacker News, GitHub, DEV, Product Hunt, X, Discord");
});
