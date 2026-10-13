import type { Platform, TimeRange } from "../types/communitySignal.js";

export const profilePlatforms = ["hacker_news", "github", "devto", "product_hunt", "x", "whop"] as const;
export interface AttentionRule {
  id: string; enabled: boolean; sources: Platform[]; experienceId?: string;
  authors: Array<{ kind: "captured_author"; value: string }>; includeAny: string[];
}
export interface Profile {
  schemaVersion: 1; id: string;
  defaults: { query: string; platforms: Platform[]; timeRange: TimeRange; language: "zh" | "en"; maxItems: number };
  whop: { scopeFile: string; stateFile: string }; reportDirectory: string;
  rules: AttentionRule[]; excludeAny: string[];
}
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === "object" && !Array.isArray(v); }
function keys(v: unknown, required: string[], optional: string[] = []): asserts v is Record<string, unknown> {
  if (!object(v) || required.some(k => !Object.hasOwn(v, k)) || Object.keys(v).some(k => ![...required, ...optional].includes(k))) throw new Error("配置字段缺失或包含未知字段");
}
function text(v: unknown, max: number): v is string { return typeof v === "string" && !!v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v); }
function identifier(v: unknown): v is string { return typeof v === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 40; }
function words(v: unknown, max: number): v is string[] { return Array.isArray(v) && v.length <= max && v.every(s => text(s, 100)); }
function relative(v: unknown): v is string { return text(v, 200) && !/^(?:\/|[a-z]:)/i.test(v) && !v.includes("\\") && v.split("/").every(s => s && s !== "." && s !== ".."); }
export function parseProfile(value: unknown): Profile {
  if (Buffer.byteLength(JSON.stringify(value) ?? "") > 65_536) throw new Error("配置超过64KiB");
  keys(value, ["schemaVersion", "id", "defaults", "whop", "reportDirectory", "rules", "excludeAny"]);
  keys(value.defaults, ["query", "platforms", "timeRange", "language", "maxItems"]);
  keys(value.whop, ["scopeFile", "stateFile"]);
  const d = value.defaults, w = value.whop;
  if (value.schemaVersion !== 1 || !identifier(value.id) || !text(d.query, 500)
    || !Array.isArray(d.platforms) || !d.platforms.length || d.platforms.some(p => !profilePlatforms.includes(p as typeof profilePlatforms[number])) || new Set(d.platforms).size !== d.platforms.length
    || !["recent_24h", "recent_3d", "recent_7d", "recent_14d", "recent_30d"].includes(d.timeRange as string)
    || !["zh", "en"].includes(d.language as string) || !Number.isInteger(d.maxItems) || (d.maxItems as number) < 1 || (d.maxItems as number) > 10
    || !relative(w.scopeFile) || !relative(w.stateFile) || !relative(value.reportDirectory)
    || new Set([w.scopeFile, w.stateFile, value.reportDirectory]).size !== 3
    || !Array.isArray(value.rules) || value.rules.length > 20 || !words(value.excludeAny, 20)) throw new Error("配置格式或容量无效");
  const seen = new Set<string>();
  for (const rule of value.rules) {
    keys(rule, ["id", "enabled", "sources", "authors", "includeAny"], ["experienceId"]);
    if (!identifier(rule.id) || seen.has(rule.id) || typeof rule.enabled !== "boolean" || !Array.isArray(rule.sources) || !rule.sources.length
      || rule.sources.some(p => !profilePlatforms.includes(p as typeof profilePlatforms[number])) || new Set(rule.sources).size !== rule.sources.length
      || !Array.isArray(rule.authors) || rule.authors.length > 10 || !words(rule.includeAny, 20)
      || (rule.experienceId !== undefined && (typeof rule.experienceId !== "string" || !/^exp_[A-Za-z0-9]{1,100}$/.test(rule.experienceId) || rule.sources.some(p => p !== "whop")))) throw new Error("关注规则格式或容量无效");
    seen.add(rule.id);
    for (const author of rule.authors) {
      keys(author, ["kind", "value"]);
      if (author.kind !== "captured_author" || !text(author.value, 100)) throw new Error("作者规则仅支持精确的采集作者字段");
    }
  }
  return JSON.parse(JSON.stringify(value)) as Profile;
}
export function defaultProfile(): Profile {
  return { schemaVersion: 1, id: "my-research", defaults: { query: "找最近 AI coding 的高质量讨论", platforms: ["hacker_news", "github", "devto"], timeRange: "recent_7d", language: "zh", maxItems: 3 },
    whop: { scopeFile: "scope.json", stateFile: "whop-state.json" }, reportDirectory: "reports", rules: [], excludeAny: [] };
}
