import { afterEach, describe, expect, it, vi } from "vitest";
import { collectXReplies } from "../src/adapters/xReplies.js";
import { groupCommentThemes } from "../src/comments/groupThemes.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";
import { scoreItem } from "../src/scoring/scoreItem.js";
import { appendXReplySample, generateLiveBrief } from "../src/report/generateLiveBrief.js";
import { runLiveCommunitySignalAnalysis } from "../src/index.js";

const cutoff = new Date("2026-09-26T00:00:00Z");
const parsed = parseQuery("Find X AI coding discussions in English");
function item(id = "123", commentsCount = 5) {
  return scoreItem({ id, platform: "x", contentType: "post", title: "AI coding production benchmark", url: `https://x.com/i/web/status/${id}`, author: "@original", publishedAt: "2026-09-27T00:00:00Z", fetchedAt: "2026-09-28T00:00:00Z", summary: "We tested AI coding in production: 20% faster on 10 tasks but review still caught regressions.", engagementMetrics: { commentsCount, points: 20 }, comments: [], sourceStatus: "verified_api", isMockData: false }, parsed);
}
function reply(id: string, parent = "123", text = "I tested the workflow in production, but the review gate caught a regression in our payment tests.") {
  return { id, author_id: "reader", created_at: "2026-09-28T01:00:00Z", conversation_id: parent, referenced_posts: [{ type: "replied_to", id: parent }], text, public_metrics: { like_count: 2 } };
}
function enable() {
  process.env.X_API_ENABLED = "true";
  process.env.X_REPLIES_ENABLED = "true";
  process.env.X_BEARER_TOKEN = "test-token";
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-29T00:00:00Z"));
}
function response(data: unknown[]) { return { ok: true, json: async () => ({ data, includes: { users: [{ id: "reader", username: "reader" }, { id: "original", username: "original" }] } }) }; }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); delete process.env.X_REPLIES_ENABLED; delete process.env.X_API_ENABLED; delete process.env.X_BEARER_TOKEN; });

describe("bounded X direct reply sampling", () => {
  it("never requests replies without the separate paid-read flag, API flag, and token", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await collectXReplies(parsed, [item()], cutoff);
    process.env.X_REPLIES_ENABLED = "true";
    const result = await collectXReplies(parsed, [item()], cutoff);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.limitations.join(" ")).toContain("both paid-read flags");
  });

  it("makes no extra request for roots with zero visible replies", async () => {
    enable(); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const result = await collectXReplies(parsed, [item("123", 0)], cutoff);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.items[0].replyCollectionStatus).toBe("no_visible_replies");
  });

  it("uses one 10-reply request for at most three roots and retains attributed direct comments", async () => {
    enable(); const fetchMock = vi.fn(async () => response([reply("1001"), reply("1002", "456"), reply("1003", "789"), reply("1004", "999")])); vi.stubGlobal("fetch", fetchMock);
    const roots = [item("123"), item("456"), item("789"), item("999")];
    const result = await collectXReplies(parsed, roots, cutoff);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(input.searchParams.get("max_results")).toBe("10");
    expect(input.searchParams.get("query")).toBe("(conversation_id:123 OR conversation_id:456 OR conversation_id:789) is:reply -is:retweet");
    expect(input.searchParams.get("next_token")).toBeNull();
    expect(result.items[0].comments[0]).toMatchObject({ author: "@reader", parentItemId: "123", retrievalMethod: "x_api", url: "https://x.com/i/web/status/1001", signalType: "neutral", isDirectQuote: true });
    expect(result.items[0].commentThemes?.map((theme) => theme.topic)).toEqual(["workflow", "defects"]);
    expect(result.items[3].comments).toEqual([]);
    expect(roots[0].comments).toEqual([]);
  });

  it("rejects nested/unrelated/reposted/self/short/promotional/old/future/invalid replies and duplicate IDs", async () => {
    enable();
    const data = [
      { ...reply("1001"), referenced_posts: [{ type: "replied_to", id: "nested" }] },
      { ...reply("1002"), conversation_id: "other" },
      { ...reply("1003"), referenced_posts: [{ type: "replied_to", id: "123" }, { type: "retweeted", id: "other" }] },
      { ...reply("1004"), author_id: "original" },
      reply("1005", "123", "great work"),
      reply("1006", "123", "Sign up for my AI workflow course because it will fix your production bugs and halve your cost."),
      { ...reply("1007"), created_at: "2026-09-20T00:00:00Z" },
      { ...reply("1008"), created_at: "2026-10-01T00:00:00Z" },
      { ...reply("1009"), created_at: "invalid" }, reply("1010")
    ];
    vi.stubGlobal("fetch", vi.fn(async () => response(data)));
    const result = await collectXReplies(parsed, [item()], cutoff);
    expect(result.items[0].comments.map((comment) => comment.url)).toEqual(["https://x.com/i/web/status/1010"]);
    vi.stubGlobal("fetch", vi.fn(async () => response([reply("1010"), reply("1010")])));
    expect((await collectXReplies(parsed, [item()], cutoff)).items[0].comments).toHaveLength(1);
  });

  it("caps response processing at 10 and per-root storage at 3, with no fallback requests", async () => {
    enable(); vi.stubGlobal("fetch", vi.fn(async () => response(Array.from({ length: 15 }, (_, i) => reply(String(2000 + i))))));
    expect((await collectXReplies(parsed, [item()], cutoff)).items[0].comments).toHaveLength(3);
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429 })); vi.stubGlobal("fetch", fetchMock);
    const failed = await collectXReplies(parsed, [item()], cutoff);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(failed.items[0].replyCollectionStatus).toBe("unavailable");
    expect(failed.items[0].comments).toEqual([]);
    expect(failed.limitations.join(" ")).toContain("HTTP 429");
  });

  it("retains maintenance-method discussion without personal-experience keywords", async () => {
    enable();
    // Paraphrased boundary found in a real paid response; no copied post text.
    const text = "Compare rework after one week and one month across repository maturity groups. A green merge pipeline alone misses later maintenance work.";
    const fetchMock = vi.fn(async () => response([reply("2011", "123", text), reply("2012", "123", "ready for some fun")]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await collectXReplies(parsed, [item()], cutoff);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.items[0].comments.map((comment) => comment.url)).toEqual(["https://x.com/i/web/status/2011"]);
    expect(result.items[0].commentThemes?.map((theme) => theme.topic)).toEqual(["workflow", "methodology"]);
    expect(result.items[0].comments[0].signalType).toBe("neutral");
  });

  it("renders evidence links and themes without claiming a sentiment share or retaining a false no-fetch label", async () => {
    enable(); vi.stubGlobal("fetch", vi.fn(async () => response([reply("1001")])));
    const result = await collectXReplies(parsed, [item()], cutoff);
    const brief = generateLiveBrief(parsed, result.items, result.limitations, 1, [], ["x"]);
    expect(brief.markdown).toContain("workflow/review");
    expect(brief.markdown).toContain("https://x.com/i/web/status/1001");
    expect(brief.dataLimitations.join(" ")).not.toContain("reply content was not fetched");
    expect(brief.markdown).toContain("No consensus or sentiment percentage is inferred");
    const original = generateLiveBrief(parsed, [item()], [], 1, [], ["x"]);
    original.markdown += "\n## Saved snapshot comparison\n\nFirst snapshot.\n";
    const appended = appendXReplySample(original, result.items, result.limitations);
    const twice = appendXReplySample(appended, result.items, result.limitations);
    expect(twice.markdown.match(/^## Additional X reply sample$/gm)).toHaveLength(1);
    expect(twice.markdown).toContain("First snapshot.");
    expect(twice.markdown).toContain("At initial collection");
  });

  it("only groups real captured comment URLs and never infers opposing/supporting labels", () => {
    const comments = [{ source: "x" as const, url: "https://x.com/i/web/status/42", summary: "I do not think cost improved; the benchmark baseline is unclear.", signalType: "neutral" as const, isDirectQuote: true }];
    expect(groupCommentThemes(comments).map((theme) => theme.topic)).toEqual(["cost", "methodology"]);
    expect(comments[0].signalType).toBe("neutral");
    expect(groupCommentThemes([{ ...comments[0], url: undefined }])).toEqual([]);
  });

  it("integrates a single optional reply request after root selection", async () => {
    enable(); const fetchMock = vi.fn(async () => response([reply("1001")]));
    fetchMock.mockResolvedValueOnce(response([{ id: "123", text: `${item().summary} We measured the review costs over a full release cycle.`, author_id: "original", created_at: item().publishedAt, public_metrics: { like_count: 20, reply_count: 3 } }]));
    vi.stubGlobal("fetch", fetchMock);
    const brief = await runLiveCommunitySignalAnalysis("Find X AI coding discussions in English");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(brief.selectedItems[0].comments).toHaveLength(1);
    expect(brief.selectedItems[0].scores.discussionQuality).toBe(0);
    expect(brief.selectedItems[0].scoreRationale.join(" ")).toContain("original ranking scores are retained");
  });
});
