import { describe, expect, it } from "vitest";
import { matchSources } from "../src/corroboration/matchSources.js";
import type { SourceItem } from "../src/types/communitySignal.js";

function item(platform: SourceItem["platform"], id: string, title: string, url: string, citedUrls: string[] = []): SourceItem {
  return {
    platform, id, title, url, citedUrls, contentType: "post", summary: title,
    fetchedAt: "2026-09-28T12:00:00Z", engagementMetrics: {}, comments: [],
    isMockData: false, sourceStatus: "verified_api"
  };
}

describe("conservative cross-platform source matching", () => {
  it("matches a cited repository to its GitHub repo despite tracking parameters", () => {
    const x = item("x", "x1", "I tested a review gate", "https://x.com/i/web/status/x1", ["https://www.github.com/acme/review-kit/?utm_source=x"]);
    const github = item("github", "g1", "acme/review-kit", "https://github.com/acme/review-kit");
    expect(matchSources(x, github)).toEqual({ reason: "shared_reference", reference: "https://github.com/acme/review-kit" });
  });

  it("matches an external article cited by both HN and X without calling it independent proof", () => {
    const hn = item("hacker_news", "h1", "Technical discussion", "https://news.ycombinator.com/item?id=1", ["https://example.org/study/agent-bugs?utm_campaign=launch"]);
    const x = item("x", "x1", "AI coding agent review", "https://x.com/i/web/status/x1", ["https://example.org/study/agent-bugs"]);
    expect(matchSources(hn, x)).toEqual({ reason: "shared_reference", reference: "https://example.org/study/agent-bugs" });
  });

  it("does not merge unrelated items with only generic topic words", () => {
    const a = item("x", "x1", "AI coding agent review and workflow", "https://x.com/i/web/status/x1");
    const b = item("hacker_news", "h1", "AI coding agent review and workflow", "https://news.ycombinator.com/item?id=1");
    expect(matchSources(a, b)).toBeUndefined();
  });

  it("marks distinctive title overlap as a heuristic only", () => {
    const hn = item("hacker_news", "h1", "Vibe Coding Production Kit for agents", "https://news.ycombinator.com/item?id=1");
    const github = item("github", "g1", "maker/Vibe-Coding-Production-Kit", "https://github.com/maker/Vibe-Coding-Production-Kit");
    expect(matchSources(hn, github)).toEqual({ reason: "title_overlap" });
  });

  it("does not treat the same ID as a second source", () => {
    const x = item("x", "x1", "A study", "https://x.com/i/web/status/x1");
    expect(matchSources(x, x)).toBeUndefined();
  });

  it("keeps distinct issues in one repository as separate discussions", () => {
    const first = item("github", "issue-1", "Permission bug in login", "https://github.com/acme/app/issues/1");
    const second = item("github", "issue-2", "Import timeout after upgrade", "https://github.com/acme/app/issues/2");
    expect(matchSources(first, second)).toBeUndefined();
  });
});
