import { digestBrowserSnapshot, type BrowserScope } from "./browserDigest.js";
import type { Profile } from "../profile/schema.js";
import { filterAttention, attentionMarkdown } from "../preferences.js";
type Digest = ReturnType<typeof digestBrowserSnapshot>;
const safe = (s: string) => s.replace(/[\r\n<>\[\]`*#\\]/g, " ");
export function personalizeDigest(result: Digest, profile: Profile, scope: BrowserScope[], replay = false) {
  const filtered = filterAttention(result.records.map(r => ({...r,id:r.post.id,platform:"whop" as const,author:r.post.author,text:r.post.body,experienceId:r.source.experienceId})), profile, scope.map(s=>s.experienceId));
  const records = filtered.items.slice(0, profile.defaults.maxItems);
  const en = profile.defaults.language === "en";
  const channel=en?"Channel":"原频道";
  const lines = [en ? "# Whop personal digest" : "# Whop 个人关注摘要", "", replay ? (en?"Replay of saved samples — old records, not newly published or first observed.":"已有样本重筛 — 旧记录，不代表刚发布或首次观察。") : (en?`Captured ${result.fetchedAt}; full delta ${result.records.length}, unchanged ${result.unchanged}. First observed does not mean newly published.`:`采集时间 ${result.fetchedAt}；完整增量 ${result.records.length}，正文相同 ${result.unchanged}。首次观察不等于刚发布。`), "", en ? "## Source coverage" : "## 来源覆盖", ""];
  for(const s of result.sourceResults) lines.push(`- ${safe(s.communityName)} · ${s.status} · captured ${s.captured} · changed ${s.records} · unchanged ${s.unchanged} · [${channel}](${s.url})`);
  lines.push("", en?"Failures, uncaptured sources, zero matches and unchanged records are distinct; none proves the community has no content.":"失败/未捕获、零匹配、已处理分别统计；不能据此断言社区没有内容。", "");
  for (const short of [false,true]) {
    lines.push(short ? (en ? "## Matched short updates" : "## 关注作者短更新") : (en ? "## Matched context" : "## 匹配背景与较长内容"), "");
    for(const r of records.filter(r=>(r.category==="short_update")===short)) {
      lines.push(`- ${safe(r.post.author)} · ${safe(r.post.publishedLabel)} · ${r.post.id} · ${replay?(en?"saved sample":"已有样本"):r.change} · [${channel}](${r.source.url})`);
      if (!short) lines.push(...(r.passages.length?r.passages.map(p=>`  - ${en?"Candidate author excerpt (unverified)":"作者候选片段（未核实）"}: ${safe(p)}`):[en?"  - No non-trading excerpt extracted; original body remains in the private delta.":"  - 未提取非交易指令片段；正文保留在本地增量。"]));
    }
    lines.push("");
  }
  lines.push(en?`Matched ${filtered.items.length}; display limit ${profile.defaults.maxItems}. Short updates do not establish trends.`:`匹配 ${filtered.items.length} 条，展示上限 ${profile.defaults.maxItems}；短更新不用于推断趋势。`, "", en?"Visible date labels cannot establish absolute publication times; profile time filtering was not performed. Author identity unverified; replies not captured; no trading instructions.":"页面日期标签未统一为绝对时间，未按 profile 时间范围过滤。作者身份未独立验证；未读取回复，不生成交易指令。", "", attentionMarkdown(filtered.attention,profile.defaults.language));
  return {schemaVersion:1,retrievalMethod:result.retrievalMethod,fetchedAt:result.fetchedAt,replay,unchanged:result.unchanged,
    fullRecordCount:result.records.length,sourceResults:result.sourceResults,
    // Full original bodies belong to the private delta; the shareable report contains only candidate passages.
    selected:records.map(r=>({source:r.source.url,experienceId:r.source.experienceId,id:r.post.id,author:r.post.author,publishedLabel:r.post.publishedLabel,category:r.category,change:replay?"saved_sample":r.change,passages:r.category==="short_update"?[]:r.passages})),
    attention:filtered.attention,limitations:[...filtered.attention.limitations,en?"Absolute publication time filtering unavailable; full delta and deduplication are independent of display filters.":"未能执行绝对发布时间过滤；完整增量和去重不受展示筛选影响。"],markdown:lines.join("\n")};
}
