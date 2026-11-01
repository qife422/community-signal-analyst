import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const moduleUrl = pathToFileURL(resolve("scripts/whop-browser-reader.mjs")).href;
const { captureWhopPage } = await import(moduleUrl);
const scope = { channelUrl: "https://whop.com/example/exp_Example/app/", experienceId: "exp_Example", communityName: "Example" };
const card = { id: "post_Example", author: "Alice", publishedLabel: "1d", pinned: false, body: "A substantive community observation", collapsed: false };
const options = { channelName: "Visible channel" };

function tabFor(read: () => unknown, url = scope.channelUrl) {
  return { url: async () => url, playwright: { locator: () => ({ evaluateAll: async () => read() }) } };
}

describe("bounded Whop browser transport", () => {
  it("never reads a redirected or unrelated page", async () => {
    let reads = 0;
    const result = await captureWhopPage(tabFor(() => { reads++; }, "https://whop.com/home/"), scope, options);
    expect(result.reason).toBe("source_mismatch"); expect(reads).toBe(0);
  });
  it("keeps loading separate from an empty successful channel", async () => {
    const result = await captureWhopPage(tabFor(() => ({ rootCount: 0, cards: [] })), scope, options);
    expect(result.status).toBe("not_ready"); expect(result.snapshot).toBeUndefined();
  });
  it("retries a transport failure once without navigation or overlapping reads", async () => {
    let reads = 0;
    const result = await captureWhopPage(tabFor(() => {
      reads++; if (reads === 1) throw new Error("CDP operation exceeded its deadline before command dispatch");
      return { rootCount: 1, cards: [card] };
    }), scope, options);
    expect(reads).toBe(2); expect(result.status).toBe("ok");
    expect(result.snapshot.sources[0].posts).toEqual([{ id: card.id, author: card.author, publishedLabel: card.publishedLabel, pinned: false, body: card.body }]);
  });
  it("stops after two transport failures and does not retry an unrelated read error", async () => {
    let reads = 0;
    const failed = await captureWhopPage(tabFor(() => { reads++; throw new Error("Timed out after3000ms waiting for CDP command Runtime.evaluate"); }), scope, options);
    expect(reads).toBe(2); expect(failed.reason).toBe("browser_transport"); expect(failed.snapshot).toBeUndefined();
    reads = 0;
    const invalid = await captureWhopPage(tabFor(() => { reads++; throw new Error("Permission denied"); }), scope, options);
    expect(reads).toBe(1); expect(invalid.reason).toBe("read_error");
  });
  it("excludes incomplete text and metadata instead of promoting them to captured posts", async () => {
    const result = await captureWhopPage(tabFor(() => ({ rootCount: 5, cards: [
      card, { ...card, id: "post_Collapsed", collapsed: true }, { ...card, id: "post_Attachment", body: "" },
      { ...card, id: "post_Metadata", publishedLabel: "" }, { ...card, id: "post_Large", body: "x".repeat(4001) }
    ] })), scope, options);
    expect(result.snapshot.sources[0].posts).toHaveLength(1);
    expect(result.snapshot.captureNotes.excluded.map((x: {reason:string}) => x.reason)).toEqual(["collapsed_body", "no_text_body", "missing_or_invalid_metadata", "body_over_limit"]);
  });
});
