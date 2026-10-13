import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import type { ClaimReview, ClaimReviewInput, CommunitySignalBrief } from "./types/communitySignal.js";

const platforms = ["hacker_news", "github", "devto", "reddit", "product_hunt", "x", "discord", "whop"];
const statuses = ["supported", "contradicted", "inconclusive", "unavailable"];
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown, limit: number): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= limit;
}
function https(value: unknown): value is string {
  if (!text(value, 2048) || /[\s<>]/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value.slice(0, 10)
    && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now();
}
function normalize(value: string): string { return value.replace(/\s+/g, " ").trim(); }
function readBoundedJson(path: string): unknown {
  const info = statSync(path);
  if (!info.isFile() || info.size > 1_000_000) throw new Error("Input must be a regular JSON file of at most 1 MB; inspect it before proceeding.");
  const contents = readFileSync(path, "utf8");
  if (Buffer.byteLength(contents) > 1_000_000) throw new Error("Input exceeds 1 MB.");
  return JSON.parse(contents);
}

/** Checks attribution and passage integrity, not the semantic truth of the review. */
export function validateClaimReviews(value: unknown): ClaimReview[] {
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.reviews) || value.reviews.length > 30) throw new Error("Verification schema requires schemaVersion: 1 and at most 30 reviews.");
  const seen = new Set<string>();
  return value.reviews.map((entry: unknown, index: number) => {
    const fail = (reason: string): never => { throw new Error(`Review ${index + 1}: ${reason}`); };
    if (!object(entry)) return fail("invalid record");
    if (typeof entry.platform !== "string" || !platforms.includes(entry.platform) || !text(entry.itemId, 200) || !https(entry.itemUrl)
      || !text(entry.claimText, 1000) || !https(entry.primarySourceUrl) || !text(entry.primarySourceBasis, 1000)
      || typeof entry.status !== "string" || !statuses.includes(entry.status) || !timestamp(entry.checkedAt)
      || entry.method !== "retrieved_primary_source_review" || !text(entry.rationale, 1000)) return fail("missing or invalid attribution, status, date, method, or rationale");
    const key = JSON.stringify([entry.platform, entry.itemId, normalize(entry.claimText)]);
    if (seen.has(key)) return fail("duplicate or conflicting review for one claim");
    seen.add(key);
    const record: ClaimReview = {
      platform: entry.platform as ClaimReview["platform"], itemId: entry.itemId, itemUrl: entry.itemUrl,
      claimText: entry.claimText, primarySourceUrl: entry.primarySourceUrl, primarySourceBasis: entry.primarySourceBasis,
      status: entry.status as ClaimReview["status"], checkedAt: entry.checkedAt,
      method: "retrieved_primary_source_review", rationale: entry.rationale
    };
    if (record.status === "unavailable") {
      if (["evidenceExcerpt", "sourceText", "sourceTextSha256", "sourceFetchedAt"].some((field) => entry[field] !== undefined)) return fail("unavailable sources cannot carry retrieved evidence");
    } else {
      if (!text(entry.sourceText, 12_000) || !text(entry.evidenceExcerpt, 1000) || !timestamp(entry.sourceFetchedAt)
        || Date.parse(entry.sourceFetchedAt) > Date.parse(record.checkedAt)
        || !normalize(entry.sourceText).includes(normalize(entry.evidenceExcerpt))) return fail("retrieved context, exact excerpt, and ordered fetch/review dates are required");
      const hash = createHash("sha256").update(entry.sourceText, "utf8").digest("hex");
      if (entry.sourceTextSha256 !== hash) return fail("source text SHA-256 does not match");
      record.evidenceExcerpt = entry.evidenceExcerpt;
      record.sourceFetchedAt = entry.sourceFetchedAt;
      record.sourceTextSha256 = hash;
    }
    return record;
  });
}

export function loadClaimReviews(path: string): ClaimReview[] { return validateClaimReviews(readBoundedJson(path)); }

export function loadSavedBrief(path: string): CommunitySignalBrief {
  const value = readBoundedJson(path);
  if (!object(value) || !object(value.parsedQuery) || typeof value.parsedQuery.language !== "string" || !["zh", "en"].includes(value.parsedQuery.language)
    || !text(value.markdown, 1_000_000) || !Array.isArray(value.selectedItems) || value.selectedItems.length > 10
    || !["quickTakeaways", "crossPlatformTrends", "nextSteps", "dataLimitations"].every((field) => Array.isArray(value[field]) && (value[field] as unknown[]).every((line) => typeof line === "string"))) throw new Error("Expected a saved live --json brief, not a Markdown report.");
  for (const item of value.selectedItems) {
    if (!object(item) || typeof item.platform !== "string" || !platforms.includes(item.platform) || !text(item.id, 200) || !https(item.url)
      || item.isMockData !== false || item.sourceStatus !== "verified_api"
      || !object(item.engagementMetrics) || !Array.isArray(item.comments) || !object(item.scores) || !Array.isArray(item.scoreRationale)
      || typeof item.title !== "string" || typeof item.summary !== "string"
      || (item.rawExcerpt !== undefined && typeof item.rawExcerpt !== "string")) throw new Error("Saved brief contains an invalid or non-live source.");
    if (Object.values(item.engagementMetrics).some((metric) => metric !== undefined && (typeof metric !== "number" || !Number.isFinite(metric) || metric < 0))
      || !item.scoreRationale.every((line) => typeof line === "string")
      || !item.comments.every((comment) => object(comment) && typeof comment.summary === "string" && (comment.url === undefined || https(comment.url)))) throw new Error("Saved brief contains malformed metrics, rationale, or comments.");
  }
  // This is caller-supplied local data, not an authenticated platform response.
  return value as unknown as CommunitySignalBrief;
}

function plain(value: string): string { return normalize(value).replace(/[\\`*_[\]<>#|]/g, "\\$&"); }
function link(label: string, url: string): string { return `[${label}](<${url}>)`; }

export function applyClaimReviews(brief: CommunitySignalBrief, reviews: ClaimReview[]): CommunitySignalBrief {
  const en = brief.parsedQuery.language === "en";
  const selectedItems = brief.selectedItems.map((item) => ({ ...item, claimReviews: [] as ClaimReview[] }));
  for (const review of reviews) {
    const item = selectedItems.find((candidate) => candidate.platform === review.platform && candidate.id === review.itemId && candidate.url === review.itemUrl);
    if (!item || item.isMockData || item.sourceStatus !== "verified_api") throw new Error(`Review does not match a selected live source: ${review.platform}:${review.itemId}`);
    const originalText = item.rawExcerpt || item.summary;
    if (!normalize(originalText).includes(normalize(review.claimText))) throw new Error(`Claim is absent from captured source text: ${review.platform}:${review.itemId}`);
    item.claimReviews.push({ ...review });
  }
  // A quote budget is shared by all reviewed claims citing the same page.
  const quoteBudgets = new Map<string, { words: number; chars: number }>();
  const sections = reviews.map((review, index) => {
    const label = en ? ({ supported: "Supported", contradicted: "Contradicted", inconclusive: "Inconclusive", unavailable: "Source unavailable" })[review.status]
      : ({ supported: "原文支持", contradicted: "原文反驳", inconclusive: "无法确定", unavailable: "原文不可访问" })[review.status];
    const canonical = new URL(review.primarySourceUrl); canonical.hash = "";
    const key = canonical.href;
    const budget = quoteBudgets.get(key) ?? { words: 25, chars: 140 };
    const words = (review.evidenceExcerpt ?? "").trim().split(/\s+/).filter(Boolean);
    const excerpt = words.slice(0, budget.words).join(" ").slice(0, budget.chars);
    budget.words = Math.max(0, budget.words - excerpt.split(/\s+/).filter(Boolean).length);
    budget.chars = Math.max(0, budget.chars - excerpt.length);
    quoteBudgets.set(key, budget);
    return en ? `### ${index + 1}. ${label}\n\n- Claim: ${plain(review.claimText)} (${link("post", review.itemUrl)})\n- Primary source: ${link("reviewed source", review.primarySourceUrl)}; why primary: ${plain(review.primarySourceBasis)}\n- Assessment: ${plain(review.rationale)}\n- Evidence excerpt: ${excerpt ? plain(excerpt) : review.status === "unavailable" ? "unavailable" : "omitted to keep quotations short; see JSON"}\n- Checked: ${review.checkedAt}; method: ${review.method}${review.sourceFetchedAt ? `; source fetched: ${review.sourceFetchedAt}; passage SHA-256: ${review.sourceTextSha256}` : ""}`
      : `### ${index + 1}. ${label}\n\n- 具体说法：${plain(review.claimText)}（${link("原帖", review.itemUrl)}）\n- 原始来源：${link("核验原文", review.primarySourceUrl)}；原始性依据：${plain(review.primarySourceBasis)}\n- 核验判断：${plain(review.rationale)}\n- 证据摘录：${excerpt ? plain(excerpt) : review.status === "unavailable" ? "数据不可用" : "为控制引用长度省略；见 JSON"}\n- 核验时间：${review.checkedAt}；方法：${review.method}${review.sourceFetchedAt ? `；原文获取时间：${review.sourceFetchedAt}；片段 SHA-256：${review.sourceTextSha256}` : ""}`;
  });
  const notice = en ? "Statuses are reviewer assessments imported from retrieved sources. The CLI checks record attribution and excerpt/hash integrity, not semantic truth. Only listed claims are reviewed; other claims remain unverified. A supported claim does not mean independent replication."
    : "状态来自核验者对已读取原始资料的判断；CLI 仅检查归属、摘录和指纹一致性，不自动判定事实真伪。仅列出的具体说法经过核验，其余说法仍未核验；原文支持不等于独立复现实验。";
  const heading = en ? "Primary-source claim review" : "原始资料核验";
  const section = `## ${heading}\n\n${notice}\n\n${sections.join("\n\n") || (en ? "No claim reviews supplied." : "未提供具体说法核验记录。")}\n\n`;
  const withoutPrevious = brief.markdown.replace(/^## (?:Primary-source claim review|原始资料核验)\n[\s\S]*?(?=^## |$(?![\s\S]))/gm, "")
    .replaceAll("- Claim status: the post", "- Claim status at collection: the post")
    .replaceAll("- 结论状态：帖子由", "- 结论状态（采集时）：帖子由");
  const marker = en ? "## Data limitations" : "## 数据限制";
  const markdown = withoutPrevious.includes(marker) ? withoutPrevious.replace(marker, section + marker) : `${withoutPrevious.trimEnd()}\n\n${section}`;
  return { ...brief, selectedItems, markdown };
}

export type { ClaimReviewInput };
