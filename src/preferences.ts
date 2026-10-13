import { createHash } from "node:crypto";
import type { CommunitySignalBrief, ParsedQuery, Platform, SourceItem, TimeRange } from "./types/communitySignal.js";
import type { Profile } from "./profile/schema.js";
import { parseQuery } from "./query-parser/parseQuery.js";

export interface AttentionInput { id: string; platform: Platform; author?: string; text: string; experienceId?: string; }
export interface AttentionResult {
  profileId: string; rulesFingerprint: string;
  counts: { examined: number; matched: number; excluded: number; unmatched: number; authorUnavailable: number; sourceNotAllowed: number; qualityRejected: number };
  matches: Array<{ id: string; platform: Platform; ruleIds: string[]; reasons: string[] }>;
  limitations: string[];
}
const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();
export function filterAttention<T extends AttentionInput>(items: T[], profile: Profile, boundIds?: string[]): { items: T[]; attention: AttentionResult } {
  const rules = profile.rules.filter(r => r.enabled), selected: T[] = [];
  const attention: AttentionResult = { profileId: profile.id, rulesFingerprint: createHash("sha256").update(JSON.stringify(profile)).digest("hex"),
    counts: { examined: items.length, matched: 0, excluded: 0, unmatched: 0, authorUnavailable: 0, sourceNotAllowed: 0, qualityRejected: 0 }, matches: [],
    limitations: [profile.defaults.language==="en"?"Literal matching on captured fields only; author names are matched exactly and identity is not independently verified.":"关键词为已取得字段的字面匹配，非全文或语义检索；作者按采集作者字段精确匹配，身份未独立验证。"] };
  for (const item of items) {
    if (!profile.defaults.platforms.includes(item.platform) || (item.platform === "whop" && boundIds && !boundIds.includes(item.experienceId ?? ""))) { attention.counts.sourceNotAllowed++; continue; }
    const content = norm(item.text);
    if (profile.excludeAny.some(s => content.includes(norm(s)))) { attention.counts.excluded++; continue; }
    const eligible = rules.filter(r => r.sources.includes(item.platform) && (!r.experienceId || r.experienceId === item.experienceId));
    if (!item.author?.trim() && eligible.some(r => r.authors.length)) attention.counts.authorUnavailable++;
    const matches = eligible.filter(r => (!r.authors.length || (item.author && r.authors.some(a => norm(a.value) === norm(item.author!)))) && (!r.includeAny.length || r.includeAny.some(w => content.includes(norm(w)))));
    if (rules.length && !matches.length) { attention.counts.unmatched++; continue; }
    selected.push(item); attention.counts.matched++;
    attention.matches.push({ id: item.id, platform: item.platform, ruleIds: matches.map(r => r.id).sort(), reasons: matches.length ? matches.map(r => profile.defaults.language==="en"?`Rule ${r.id}: source, captured author and literal keyword conditions satisfied`:`规则 ${r.id}：来源、作者与关键词条件满足`).sort() : [profile.defaults.language==="en"?"No enabled rule; source allowance and exclusions only":"没有启用关注规则；仅应用来源允许范围和排除词"] });
  }
  return { items: selected, attention };
}
export function sourceAttention<T extends SourceItem>(items: T[], profile: Profile) {
  const mapped = items.map(item => ({ ...item, text: [item.title, item.rawExcerpt ?? "", item.summary, ...(item.tags ?? [])].join("\n"), experienceId: item.whopContext?.experienceId }));
  const result = filterAttention(mapped, profile);
  const keys = new Set(result.items.map(i => `${i.platform}:${i.id}`));
  return { items: items.filter(i => keys.has(`${i.platform}:${i.id}`)), attention: result.attention };
}
export function applyProfileQuery(query: string | undefined, profile: Profile): ParsedQuery {
  const parsed = parseQuery(query?.trim() || profile.defaults.query);
  if (!query?.trim()) {
    parsed.platforms = [...profile.defaults.platforms].filter(p => p !== "whop");
    parsed.timeRange = profile.defaults.timeRange; parsed.language = profile.defaults.language; parsed.maxItems = profile.defaults.maxItems;
  } else {
    const periods: Array<[TimeRange, RegExp]> = [["recent_24h", /24\s*小时|\b24h\b|\b24 hours?\b|\b1 day\b|一天|today|今日/i], ["recent_3d", /3\s*天|\b3d\b|\b3 days?\b|三天/i], ["recent_14d", /14\s*天|\b14d\b|\b14 days?\b|两周|二周|2\s*周|\b2 weeks\b/i], ["recent_30d", /30\s*天|\b30d\b|\b30 days?\b|一个月|近月|past month|last month/i], ["recent_7d", /7\s*天|\b7d\b|\b7 days?\b|七天|一周|week/i]];
    parsed.timeRange = periods.find(([, pattern]) => pattern.test(query))?.[0] ?? profile.defaults.timeRange;
    if (!/\benglish\b|\bin english\b|英文|英语|中文|chinese|用汉语/i.test(query)) parsed.language = profile.defaults.language;
    const count = query.match(/(\d+|[一两三四五六七八九十])\s*(?:条|个|篇|items?|results?|posts?)/i) ?? query.match(/(?:top|前)\s*(\d+)/i);
    const numbers: Record<string, number> = {一:1,两:2,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
    parsed.maxItems = count ? Math.min(10, Math.max(1, numbers[count[1]] ?? Number(count[1]))) : profile.defaults.maxItems;
  }
  parsed.platforms = parsed.platforms.filter(p => p !== "whop" && profile.defaults.platforms.includes(p));
  return parsed;
}
export function attentionMarkdown(attention: AttentionResult, language: "zh" | "en") {
  const c = attention.counts, en = language === "en";
  const safe = (s: string) => s.replace(/[\\`*\[\]<>]/g, "").replace(/[\r\n]/g, " ");
  return [en ? "## Personal attention filters" : "## 个人关注筛选", "", `Profile: ${safe(attention.profileId)}; rules SHA-256: ${attention.rulesFingerprint}`,
    en ? `Examined ${c.examined}; matched ${c.matched}; excluded ${c.excluded}; unmatched ${c.unmatched}; author unavailable ${c.authorUnavailable}; source not allowed ${c.sourceNotAllowed}; original quality gate rejected ${c.qualityRejected}.` : `检查 ${c.examined} 条；匹配 ${c.matched}；排除 ${c.excluded}；未命中 ${c.unmatched}；缺作者 ${c.authorUnavailable}；来源不在允许范围 ${c.sourceNotAllowed}；原质量门槛未达 ${c.qualityRejected}。`,
    ...attention.matches.map(m => `- ${safe(m.platform)} / ${safe(m.id)}: ${m.ruleIds.map(safe).join(", ") || (en ? "no enabled rule" : "没有启用规则")}; ${en ? "source, author and literal keyword conditions satisfied" : m.reasons.map(safe).join("；")}`),
    en ? "Literal matching on captured fields only. Captured author names do not establish a verified unique identity. Zero matches is not proof that the source has no content." : "仅匹配已取得字段；采集作者名称不能证明唯一身份。零命中不代表来源没有内容。", ""].join("\n");
}
export function attachAttention(brief: CommunitySignalBrief, attention: AttentionResult): CommunitySignalBrief {
  const selectedKeys = new Set(brief.selectedItems.map(i => `${i.platform}:${i.id}`));
  const displayed = { ...attention, matches: attention.matches.filter(m => selectedKeys.has(`${m.platform}:${m.id}`)) };
  return { ...brief, attention: displayed, markdown: brief.markdown.trimEnd() + "\n\n" + attentionMarkdown(displayed, brief.parsedQuery.language),
    dataLimitations: [...brief.dataLimitations, brief.parsedQuery.language === "en" ? "Personal filters use captured fields; author identity is not independently verified." : attention.limitations[0]] };
}
