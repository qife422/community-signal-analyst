import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { applyClaimReviews, loadClaimReviews, loadSavedBrief, validateClaimReviews } from "../src/verification.js";
import { generateLiveBrief } from "../src/report/generateLiveBrief.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";
import { scoreItem } from "../src/scoring/scoreItem.js";
import type { ClaimReviewInput } from "../src/types/communitySignal.js";

const passage = "In a controlled benchmark, task completion was 20% faster. The sample had 10 tasks; it does not cover production use.";
function review(overrides: Partial<ClaimReviewInput> = {}): ClaimReviewInput {
  return {
    platform: "x", itemId: "123", itemUrl: "https://x.com/i/web/status/123", claimText: "task completion was 20% faster",
    primarySourceUrl: "https://example.org/benchmark", primarySourceBasis: "The team published its own benchmark methodology and results.",
    status: "supported", checkedAt: "2026-09-01T12:01:00Z", method: "retrieved_primary_source_review",
    rationale: "Supports the figure for the benchmark's 10 tasks, not a general production productivity claim.",
    evidenceExcerpt: "task completion was 20% faster", sourceText: passage,
    sourceFetchedAt: "2026-09-01T12:00:00Z", sourceTextSha256: createHash("sha256").update(passage).digest("hex"), ...overrides
  };
}
function validated(...records: ClaimReviewInput[]) { return validateClaimReviews({ schemaVersion: 1, reviews: records }); }
function brief(language: "zh" | "en" = "en") {
  const parsed = { ...parseQuery("Find X AI coding discussions"), language };
  const item = scoreItem({
    id: "123", platform: "x", contentType: "post", title: "Benchmark lead", url: "https://x.com/i/web/status/123",
    fetchedAt: "2026-09-01T10:00:00Z", summary: "We tested AI coding: task completion was 20% faster. All coding work is now 50% faster.",
    rawExcerpt: "We tested AI coding: task completion was 20% faster. All coding work is now 50% faster.",
    engagementMetrics: { points: 12 }, comments: [], sourceStatus: "verified_api", isMockData: false,
    claimVerification: "author_claim_unverified", citedUrls: ["https://example.org/benchmark"]
  }, parsed);
  return generateLiveBrief(parsed, [item], [], 1, [], ["x"]);
}

describe("primary-source claim reviews", () => {
  it("retains claim-level assessments without verifying the entire post or exposing source context", () => {
    const result = applyClaimReviews(brief(), validated(review()));
    expect(result.selectedItems[0].claimReviews?.[0].status).toBe("supported");
    expect(result.selectedItems[0].sourceStatus).toBe("verified_api");
    expect(result.selectedItems[0].claimVerification).toBe("author_claim_unverified");
    expect(result.selectedItems[0].claimReviews?.[0]).not.toHaveProperty("sourceText");
    expect(result.markdown).toContain("other claims remain unverified");
    expect(result.markdown).toContain("not semantic truth");
    expect(result.markdown).toContain("10 tasks");
    expect(result.markdown).toContain("passage SHA-256");
  });

  it("supports contradiction, uncertainty, and unavailable source without inventing excerpts", () => {
    for (const status of ["contradicted", "inconclusive"] as const) expect(validated(review({ status }))[0].status).toBe(status);
    const unavailable = review({ status: "unavailable", sourceText: undefined, sourceTextSha256: undefined, sourceFetchedAt: undefined, evidenceExcerpt: undefined, rationale: "The source required login and could not be read." });
    const result = applyClaimReviews(brief("zh"), validated(unavailable));
    expect(result.markdown).toContain("原文不可访问");
    expect(result.markdown).toContain("证据摘录：数据不可用");
    expect(() => validated(review({ status: "unavailable" }))).toThrow("cannot carry retrieved evidence");
  });

  it("rejects a wrong fingerprint, invented excerpt, bad dates, invalid URLs, and conflicting assessments", () => {
    expect(() => validated(review({ sourceTextSha256: "0".repeat(64) }))).toThrow("SHA-256");
    expect(() => validated(review({ evidenceExcerpt: "50% faster" }))).toThrow("exact excerpt");
    expect(() => validated(review({ sourceFetchedAt: "2026-09-01T12:02:00Z" }))).toThrow();
    expect(() => validated(review({ checkedAt: "not a date" }))).toThrow();
    expect(() => validated(review({ checkedAt: "2026-02-30T00:00:00Z" }))).toThrow();
    expect(() => validated(review({ checkedAt: "2099-01-01T00:00:00Z" }))).toThrow();
    expect(() => validated(review({ primarySourceUrl: "https://user:secret@example.org/paper" }))).toThrow();
    expect(() => validated(review(), review({ status: "contradicted" }))).toThrow("conflicting");
    expect(() => validateClaimReviews({ schemaVersion: 1, reviews: [{ ...review(), status: ["supported"] }] })).toThrow();
  });

  it("rejects wrong source identity, URL, and absent claim, without partially changing the brief", () => {
    const original = brief();
    const snapshot = JSON.stringify(original);
    for (const changes of [{ platform: "github" as const }, { itemId: "other" }, { itemUrl: "https://x.com/i/web/status/other" }, { claimText: "productivity doubled" }]) {
      expect(() => applyClaimReviews(original, validated(review(changes)))).toThrow();
      expect(JSON.stringify(original)).toBe(snapshot);
    }
  });

  it("replaces a prior review section while preserving limitations and history", () => {
    const original = brief();
    original.markdown += "\n## Saved snapshot comparison\n\nFirst snapshot.\n";
    const first = applyClaimReviews(original, validated(review()));
    const second = applyClaimReviews(first, validated(review({ status: "inconclusive" })));
    expect(second.markdown.match(/^## Primary-source claim review$/gm)).toHaveLength(1);
    expect(second.markdown).not.toContain("### 1. Supported");
    expect(second.markdown).toContain("### 1. Inconclusive");
    expect(second.markdown).toContain("## Data limitations");
    expect(second.markdown).toContain("First snapshot.");
  });

  it("applies reviews to a saved live brief with zero network calls", () => {
    const directory = mkdtempSync(join(tmpdir(), "signal-verification-"));
    const briefPath = join(directory, "brief.json");
    const reviewPath = join(directory, "review.json");
    writeFileSync(briefPath, JSON.stringify(brief()));
    writeFileSync(reviewPath, JSON.stringify({ schemaVersion: 1, reviews: [review()] }));
    const fetchMock = vi.fn(() => { throw new Error("Network forbidden in offline review"); });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = applyClaimReviews(loadSavedBrief(briefPath), loadClaimReviews(reviewPath));
      expect(result.selectedItems[0].claimReviews).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
    writeFileSync(briefPath, JSON.stringify({ ...brief(), selectedItems: [{ ...brief().selectedItems[0], isMockData: true }] }));
    expect(() => loadSavedBrief(briefPath)).toThrow("non-live");
  });

  it("bounds input size, count, and retrieved context before any output", () => {
    const directory = mkdtempSync(join(tmpdir(), "signal-verification-bounds-"));
    const path = join(directory, "oversize.json");
    writeFileSync(path, " ".repeat(1_000_001));
    expect(() => loadClaimReviews(path)).toThrow("1 MB");
    expect(() => validateClaimReviews({ schemaVersion: 1, reviews: Array(31).fill(review()) })).toThrow("30 reviews");
    expect(() => validated(review({ sourceText: "x".repeat(12_001) }))).toThrow();
  });
});
