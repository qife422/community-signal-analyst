import { createHash } from "node:crypto";
import { object } from "./http.js";

export interface BrowserPost { id: string; author: string; publishedLabel: string; pinned: boolean; body: string; }
export interface BrowserSource { url: string; experienceId: string; communityName: string; channelName: string; posts: BrowserPost[];
  access?: {status:"ok"|"login_required"|"unavailable"; note?:string}; }
export interface BrowserSnapshot { schemaVersion: 1; retrievalMethod: "browser_visible"; fetchedAt: string; sources: BrowserSource[]; }
export interface BrowserScope {experienceId:string; communityName:string; channelUrl:string;}
export interface DigestState { schemaVersion: 1; entries: Array<{sourceUrl: string; id: string; bodyHash: string; contentHash?:string; fetchedAt: string}>;
  polls?:Array<{sourceUrl:string; fetchedAt:string}>; }
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const contentHash = (s: string) => hash(s.normalize("NFC").replace(/\r\n/g,"\n"));
const text = (v: unknown, max: number): v is string => typeof v === "string" && !!v.trim() && v.length <= max;
const id = (v: unknown, prefix: string): v is string => typeof v === "string" && new RegExp(`^${prefix}_[A-Za-z0-9]{1,100}$`).test(v);
function date(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return false;
  const d = new Date(v);return Number.isFinite(d.getTime()) && d.getTime() <= Date.now()+120_000
    && new Date(`${v.slice(0,10)}T00:00:00Z`).toISOString().slice(0,10) === v.slice(0,10);
}
function sourceUrl(value: unknown): value is string {
  if (!text(value,2048)) return false;
  try { const u = new URL(value);return u.href===value && u.protocol==="https:" && u.hostname==="whop.com"
    && !u.username && !u.password && !u.port && !u.search && !u.hash && /^\/.+\/exp_[A-Za-z0-9]{1,100}\/app\/$/.test(u.pathname); } catch {return false;}
}
/** Selected scope is configuration, not proof of browser/API authorization. */
export function parseBrowserScope(value:unknown):BrowserScope[] {
  if(!object(value) || value.schemaVersion!==1 || !Array.isArray(value.channels) || value.channels.length>3)throw new Error("Select up to 3 Whop sources");
  const seen=new Set<string>();
  return value.channels.map(s=>{
    if(!object(s) || !id(s.experienceId,"exp") || !text(s.communityName,100) || !sourceUrl(s.channelUrl)
      || !new URL(s.channelUrl).pathname.endsWith(`/${s.experienceId}/app/`) || seen.has(s.experienceId))throw new Error("Invalid or duplicate selected browser scope");
    seen.add(s.experienceId);return {experienceId:s.experienceId,communityName:s.communityName,channelUrl:s.channelUrl};
  });
}
/** Imports only a bounded, explicitly captured page snapshot; never controls a browser or calls an API. */
export function parseBrowserSnapshot(value: unknown): BrowserSnapshot {
  if (!object(value) || value.schemaVersion!==1 || value.retrievalMethod!=="browser_visible" || !date(value.fetchedAt)
    || !Array.isArray(value.sources) || !value.sources.length || value.sources.length>3) throw new Error("Invalid Whop browser snapshot");
  const seenSources=new Set<string>();
  for (const s of value.sources) {
    if (!object(s) || !sourceUrl(s.url) || !id(s.experienceId,"exp") || !new URL(s.url).pathname.endsWith(`/${s.experienceId}/app/`)
      || !text(s.communityName,100) || !text(s.channelName,100) || !Array.isArray(s.posts) || s.posts.length>50
      || seenSources.has(s.url)) throw new Error("Invalid selected Whop source");
    seenSources.add(s.url);const seenPosts=new Set<string>();
    if(s.access!==undefined && (!object(s.access) || !["ok","login_required","unavailable"].includes(s.access.status as string)
      || (s.access.note!==undefined && !text(s.access.note,300)) || (s.access.status!=="ok" && s.posts.length)))throw new Error("Failed sources cannot carry posts");
    for (const p of s.posts) {
      if (!object(p) || !id(p.id,"post") || seenPosts.has(p.id) || !text(p.author,100) || !text(p.publishedLabel,100)
        || typeof p.pinned!=="boolean" || !text(p.body,4000)) throw new Error("Invalid Whop browser post");
      seenPosts.add(p.id);
    }
  }
  return value as unknown as BrowserSnapshot;
}
export function parseDigestState(value: unknown): DigestState {
  if (!object(value) || value.schemaVersion!==1 || !Array.isArray(value.entries) || value.entries.length>1000) throw new Error("Invalid or full Whop digest state");
  const seen=new Set<string>();
  for (const e of value.entries) {
    if (!object(e) || !sourceUrl(e.sourceUrl) || !id(e.id,"post") || !text(e.bodyHash,64) || !/^[a-f0-9]{64}$/.test(e.bodyHash)
      || !date(e.fetchedAt) || seen.has(`${e.sourceUrl}#${e.id}`)) throw new Error("Invalid Whop digest state entry");
    seen.add(`${e.sourceUrl}#${e.id}`);
    if(e.contentHash!==undefined && (typeof e.contentHash!=="string" || !/^[a-f0-9]{64}$/.test(e.contentHash)))throw new Error("Invalid content hash");
  }
  if(value.polls!==undefined) {
    if(!Array.isArray(value.polls) || value.polls.length>1000)throw new Error("Invalid poll state");
    const urls=new Set<string>();
    for(const p of value.polls) {
      if(!object(p) || !sourceUrl(p.sourceUrl) || !date(p.fetchedAt) || urls.has(p.sourceUrl))throw new Error("Invalid poll watermark");
      urls.add(p.sourceUrl);
    }
  }
  return value as unknown as DigestState;
}
const safe = (s: string) => s.replace(/[\r\n<>\[\]`*#]/g," ");
function passages(body: string): string[] {
  // Candidate author statements, never generated conclusions or trading instructions.
  const financial=/股票|财报|BTC|估值|仓位|常规仓|止盈|止损|\b(?:stock|option|trading)\b/i.test(body);
  return body.split(/\n+/).map(s=>s.trim()).filter(s=>s.length>=10
    && !/买|卖|仓|止盈|止损|抄底|目标价|估值|套利|中线|再加|一半|分之|双倍|拿|\b(?:buy|sell|hold|long|short|entry|exit)\b/i.test(s)
    && !(financial && /\d|缺口|成本/.test(s))).slice(0,2).map(s=>s.slice(0,60));
}
/** First-observed records are not necessarily newly published. Body hashes ignore changing UI counts/time labels. */
export function digestBrowserSnapshot(snapshot: BrowserSnapshot, previous: DigestState={schemaVersion:1,entries:[]}, selected?:BrowserScope[]) {
  snapshot=parseBrowserSnapshot(snapshot);previous=parseDigestState(previous);
  if(snapshot.sources.length>1 && !selected)throw new Error("Multi-source processing requires an explicit selected scope");
  if(selected) {
    selected=parseBrowserScope({schemaVersion:1,channels:selected});
    for(const s of snapshot.sources)if(!selected.some(x=>x.channelUrl===s.url && x.experienceId===s.experienceId && x.communityName===s.communityName))throw new Error("Capture is outside selected sources");
  }
  const entries=new Map(previous.entries.map(e=>[`${e.sourceUrl}#${e.id}`,e]));
  const polls=new Map((previous.polls??[]).map(p=>[p.sourceUrl,p]));
  const knownContent=new Set(previous.entries.flatMap(e=>e.contentHash?[e.contentHash]:[]));
  // Legacy states: seed only captured bodies matching the saved author/body fingerprint.
  for(const s of snapshot.sources)for(const p of s.posts)if(entries.get(`${s.url}#${p.id}`)?.bodyHash===hash(`${p.author}\n${p.body}`))knownContent.add(contentHash(p.body));
  const records:Array<{source:BrowserSource;post:BrowserPost;change:"first_observed"|"body_changed";category:"pinned_context"|"contextual_post"|"short_update";passages:string[];contentHash:string;novelContent:boolean}>=[];
  const sourceResults:Array<{url:string;communityName:string;experienceId:string;status:"ok"|"login_required"|"unavailable"|"not_captured";captured:number;records:number;unchanged:number}>=[];
  let unchanged=0;
  for(const source of snapshot.sources) {
    const status=source.access?.status??"ok";
    const count={url:source.url,communityName:source.communityName,experienceId:source.experienceId,status,captured:source.posts.length,records:0,unchanged:0};sourceResults.push(count);
    if(status!=="ok")continue;
    if(polls.has(source.url) && Date.parse(polls.get(source.url)!.fetchedAt)>Date.parse(snapshot.fetchedAt))throw new Error("Snapshot is older than latest successful poll");
    polls.set(source.url,{sourceUrl:source.url,fetchedAt:snapshot.fetchedAt});
    for(const post of source.posts) {
      const key=`${source.url}#${post.id}`,old=entries.get(key),bodyHash=hash(`${post.author}\n${post.body}`);
      if(old && Date.parse(old.fetchedAt)>Date.parse(snapshot.fetchedAt))throw new Error("Snapshot is older than saved state; state was not replaced");
      const bodyContentHash=contentHash(post.body);
      if(old?.bodyHash===bodyHash) {unchanged++;count.unchanged++;entries.set(key,{...old,contentHash:bodyContentHash});continue;}
      records.push({source,post,change:old?"body_changed":"first_observed",category:post.pinned?"pinned_context":post.body.length>=100?"contextual_post":"short_update",passages:passages(post.body),contentHash:bodyContentHash,novelContent:!knownContent.has(bodyContentHash)});
      knownContent.add(bodyContentHash);count.records++;
      entries.set(key,{sourceUrl:source.url,id:post.id,bodyHash,contentHash:bodyContentHash,fetchedAt:snapshot.fetchedAt});
    }
  }
  for(const s of selected??[])if(!sourceResults.some(x=>x.url===s.channelUrl))sourceResults.push({url:s.channelUrl,communityName:s.communityName,experienceId:s.experienceId,status:"not_captured",captured:0,records:0,unchanged:0});
  if(entries.size>1000)throw new Error("Whop state reached 1000 entries; inspect before growing it; no automatic cleanup");
  const state:DigestState={schemaVersion:1,entries:[...entries.values()],polls:[...polls.values()]};
  if(polls.size>1000 || Buffer.byteLength(JSON.stringify(state))>1_000_000)throw new Error("Whop state exceeds capacity");
  const groups=[...new Set(records.map(r=>r.contentHash))].map(h=>({contentHash:h,novelContent:records.some(r=>r.contentHash===h && r.novelContent),
    references:[...entries.values()].filter(e=>e.contentHash===h).map(e=>({sourceUrl:e.sourceUrl,id:e.id}))}));
  const lines=["# Whop 内容摘要","",`采集时间：${snapshot.fetchedAt}。方式：成员浏览器页面只读采集。`,"",
    `本次首次观察/正文变化 ${records.length} 条；已见且正文相同 ${unchanged} 条。首次观察不等于刚发布。`,""];
  const labels={ok:"已读取",login_required:"需要登录",unavailable:"读取不可用",not_captured:"本次未捕获"};
  lines.push("## 来源覆盖","");
  for(const r of sourceResults)lines.push(`- ${safe(r.communityName)}：${labels[r.status]}；捕获 ${r.captured} 条，首次观察/变化 ${r.records} 条，相同 ${r.unchanged} 条。`);
  lines.push("","失败或未捕获不代表社区没有内容；来源名称和条数不等于独立观点数量。","");
  for(const source of snapshot.sources) {
    lines.push(`## ${safe(source.communityName)} · ${safe(source.channelName)}`,"",`[打开原频道](${source.url})`,"");
    if(source.access && source.access.status!=="ok") {lines.push(`本来源${labels[source.access.status]}，未处理正文；已有状态保留。`,"");continue;}
    const current=records.filter(r=>r.source.url===source.url),context=current.filter(r=>r.category!=="short_update"),short=current.filter(r=>r.category==="short_update");
    if(!current.length) {lines.push("本次没有未处理或正文变化的帖子。","");continue;}
    for(const r of context) {
      lines.push(`### ${r.category==="pinned_context"?"置顶背景":"较长内容"} · ${safe(r.post.publishedLabel)}`,"",
        `作者：${safe(r.post.author)}；原帖 ID：${r.post.id}；${r.change==="body_changed"?"正文变化":"首次观察"}；${r.novelContent?"首次记录该正文":"正文已在其他记录出现，不计新观点"}。`,"");
      lines.push(...(r.passages.length?r.passages.map(s=>`- 作者原文候选片段（未核实）：${safe(s)}`):["没有提取可用的非交易指令片段；正文保留在本地采集记录中。"]),"");
    }
    if(short.length) {
      lines.push(`### 短更新：${short.length} 条`,"","这些短帖单独保留为更新记录，信息量不足以据此推断新观点、共识或趋势。","");
      for(const r of short)lines.push(`- ${safe(r.post.author)} · ${safe(r.post.publishedLabel)} · ${r.post.id} · ${r.change==="body_changed"?"正文变化":"首次观察"} · ${r.novelContent?"首次记录正文":"正文已见"}`);
      lines.push("");
    }
  }
  const repeated=groups.filter(g=>g.references.length>1);
  if(repeated.length) {
    lines.push("## 相同正文的出处","","相同正文只占一个内容候选；重复出现不是独立核验，也不证明共识。只合并正文相同（统一 Unicode/换行）的记录，不自动合并同主题或相似观点。","");
    for(const g of repeated) {for(const r of g.references)lines.push(`- ${r.id} · [原频道](${r.sourceUrl})`);lines.push("");}
  }
  lines.push("## 数据限制","","仅处理已捕获的指定页面，未发现其他社区或补读历史。日期是页面显示标签，未补造年份或绝对发布时间。置顶背景不计作近期新观点。链接打开频道而非定位单帖；原帖 ID 用于核对。未覆盖不同作者的直接回复。作者片段不是事实核验或交易建议。正文完整性、社区共识和自动后台读取均未验证。旧状态缺少正文指纹时，仅对本次重新捕获的已见正文补齐跨来源指纹；未重新捕获的历史无法补造。"," ");
  return {schemaVersion:1 as const,retrievalMethod:"browser_visible" as const,fetchedAt:snapshot.fetchedAt,records,unchanged,sourceResults,groups,state,markdown:lines.join("\n")};
}
