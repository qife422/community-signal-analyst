import { describe, expect, it } from "vitest";
import { digestBrowserSnapshot, parseBrowserSnapshot, parseBrowserScope, parseDigestState, type BrowserSnapshot } from "../src/whop/browserDigest.js";
const make = (): BrowserSnapshot => ({schemaVersion:1,retrievalMethod:"browser_visible",fetchedAt:"2026-09-30T12:00:00Z",sources:[{
 url:"https://whop.com/example/exp_alpha/app/",experienceId:"exp_alpha",communityName:"Example",channelName:"Records",posts:[
  {id:"post_context",author:"author",publishedLabel:"6月28日",pinned:true,body:"作者认为资金流动会影响市场短期波动，因此需要关注实际资金变化。\n买入点位是作者的个人交易指令，不能作为摘要的交易建议。"},
  {id:"post_short",author:"author",publishedLabel:"3h",pinned:false,body:"15.85加了六分之一常规仓cifr"}
 ]}]});
describe("Whop read-only browser snapshot processing",()=>{
 it("retains short updates without presenting old pinned posts as newly published",()=>{
  const result=digestBrowserSnapshot(make());expect(result.records.map(r=>r.category)).toEqual(["pinned_context","short_update"]);
  expect(result.markdown).toContain("首次观察不等于刚发布");expect(result.markdown).toContain("6月28日");
  expect(result.markdown).not.toContain("15.85");expect(result.markdown).not.toContain("买入点位");
  expect(result.records[1].post.body).toContain("15.85");
 });
 it("deduplicates a repeat even when relative time labels change",()=>{
  const first=digestBrowserSnapshot(make());const again=make();again.fetchedAt="2026-09-30T13:00:00Z";again.sources[0].posts[1].publishedLabel="4h";
  const result=digestBrowserSnapshot(again,first.state);expect(result.records).toEqual([]);expect(result.unchanged).toBe(2);
 });
 it("keeps financial execution fragments in raw evidence without surfacing prices or disguised position instructions",()=>{
  const snapshot=make();snapshot.sources[0].posts[0].body="财报后中线操作记录\niren 44.8有个常规一半 可以42附近再加一半\n微软 财报跌398-400缺口附近 17.3双倍附近";
  const result=digestBrowserSnapshot(snapshot);
  expect(result.records[0].passages).toEqual([]);expect(result.markdown).not.toContain("44.8");expect(result.markdown).not.toContain("398-400");
  expect(result.records[0].post.body).toContain("44.8");
 });
 it("reports edited body and keeps unrelated selected sources distinct",()=>{
  const first=digestBrowserSnapshot(make()),edited=make();edited.sources[0].posts[0].body+="新增背景信息";
  expect(digestBrowserSnapshot(edited,first.state).records[0].change).toBe("body_changed");
  const other=make();other.sources[0].url="https://whop.com/other/exp_other/app/";other.sources[0].experienceId="exp_other";
  expect(digestBrowserSnapshot(other,first.state).records).toHaveLength(2);
 });
 it.each(["https://attacker.example/example/exp_alpha/app/","https://whop.com/example/exp_other/app/","https://whop.com/example/exp_alpha/app/?token=secret"])("rejects wrong source mapping %s",url=>{
  const snapshot=make();snapshot.sources[0].url=url;expect(()=>parseBrowserSnapshot(snapshot)).toThrow();
 });
 it("rejects duplicate IDs and oversized sources before processing",()=>{
  const duplicate=make();duplicate.sources[0].posts.push(duplicate.sources[0].posts[0]);expect(()=>parseBrowserSnapshot(duplicate)).toThrow();
  const oversized=make();oversized.sources[0].posts[0].body="x".repeat(4001);expect(()=>parseBrowserSnapshot(oversized)).toThrow();
 });
 it("rejects stale snapshot rollback and corrupted or full state",()=>{
  const first=digestBrowserSnapshot(make()),older=make();older.fetchedAt="2026-09-30T11:00:00Z";
  expect(()=>digestBrowserSnapshot(older,first.state)).toThrow(/older/);
  expect(()=>parseDigestState({...first.state,entries:[{...first.state.entries[0],bodyHash:"bad"}]})).toThrow();
  expect(()=>parseDigestState({schemaVersion:1,entries:Array(1001).fill(first.state.entries[0])})).toThrow();
 });
});

const multi = (): BrowserSnapshot => {
  const a=make();a.sources[0].posts=[{...a.sources[0].posts[0],pinned:false}];
  const b=structuredClone(a.sources[0]);b.url="https://whop.com/second/exp_beta/app/";b.experienceId="exp_beta";b.communityName="Second";b.posts[0].author="another-author";
  a.sources.push(b);return a;
};
const scopeOf = (s:BrowserSnapshot) => parseBrowserScope({schemaVersion:1,channels:s.sources.map(x=>({experienceId:x.experienceId,communityName:x.communityName,channelUrl:x.url}))});
describe("Whop explicitly selected multi-source digest",()=>{
  it("requires a scope and rejects a capture outside exact selected URLs before processing",()=>{
    const snapshot=multi();expect(()=>digestBrowserSnapshot(snapshot)).toThrow(/scope/);
    const scope=scopeOf(snapshot);scope[1].channelUrl="https://whop.com/wrong/exp_beta/app/";
    expect(()=>digestBrowserSnapshot(snapshot,undefined,scope)).toThrow(/outside/);
    expect(()=>parseBrowserScope({schemaVersion:1,channels:Array(4).fill(scope[0])})).toThrow();
  });
  it("preserves identical IDs in distinct sources while grouping copied bodies once",()=>{
    const s=multi(),r=digestBrowserSnapshot(s,undefined,scopeOf(s));
    expect(r.records).toHaveLength(2);expect(r.state.entries).toHaveLength(2);expect(r.groups).toHaveLength(1);
    expect(r.groups[0].references.map(x=>x.sourceUrl)).toEqual(s.sources.map(x=>x.url));
    expect(r.records.map(x=>x.novelContent)).toEqual([true,false]);expect(r.markdown).toContain("重复出现不是独立核验");
    expect(digestBrowserSnapshot(s,r.state,scopeOf(s)).unchanged).toBe(2);
  });
  it("keeps similar but different opinions separate",()=>{
    const s=multi();s.sources[1].posts[0].body+="另一作者明确提出不同条件。";
    const r=digestBrowserSnapshot(s,undefined,scopeOf(s));expect(r.groups).toHaveLength(2);expect(r.records.every(x=>x.novelContent)).toBe(true);
  });
  it("recognizes a later cross-source repost by another author and retains historical attribution",()=>{
    const first=make();first.sources[0].posts=[first.sources[0].posts[0]];const prior=digestBrowserSnapshot(first);
    const next=multi();next.sources=next.sources.slice(1);next.fetchedAt="2026-09-30T14:00:00Z";
    const r=digestBrowserSnapshot(next,prior.state,scopeOf(next));expect(r.records).toHaveLength(1);expect(r.records[0].novelContent).toBe(false);
    expect(r.groups[0].references).toHaveLength(2);expect(r.groups[0].novelContent).toBe(false);
  });
  it("migrates legacy fingerprints only from matching recaptured bodies, independent of source order",()=>{
    const s=multi();const initial=make();initial.sources[0].posts=[initial.sources[0].posts[0]];
    const state=digestBrowserSnapshot(initial).state;delete state.polls;for(const e of state.entries)delete e.contentHash;
    s.sources.reverse();const r=digestBrowserSnapshot(s,state,scopeOf(s));expect(r.records).toHaveLength(1);expect(r.records[0].novelContent).toBe(false);
    expect(r.state.entries.every(e=>e.contentHash?.length===64)).toBe(true);
  });
  it("reports unavailable sources independently without consuming their records or poll timestamp",()=>{
    const s=multi(),scope=scopeOf(s),prior=digestBrowserSnapshot(s,undefined,scope).state;
    s.fetchedAt="2026-09-30T14:00:00Z";s.sources[0].posts[0].body+="新的内容修订";
    s.sources[1].posts=[];s.sources[1].access={status:"login_required"};
    const r=digestBrowserSnapshot(s,prior,scope);expect(r.records).toHaveLength(1);expect(r.sourceResults[1].status).toBe("login_required");
    expect(r.state.entries.find(e=>e.sourceUrl===s.sources[1].url)).toEqual(prior.entries.find(e=>e.sourceUrl===s.sources[1].url));
    expect(r.state.polls?.find(e=>e.sourceUrl===s.sources[1].url)).toEqual(prior.polls?.find(e=>e.sourceUrl===s.sources[1].url));
    expect(r.markdown).toContain("需要登录");expect(r.markdown).toContain("失败或未捕获不代表社区没有内容");
  });
  it("labels a selected but omitted source as not captured and rejects failed sources containing posts",()=>{
    const s=multi(),scope=scopeOf(s);s.sources=s.sources.slice(0,1);
    const r=digestBrowserSnapshot(s,undefined,scope);expect(r.sourceResults[1].status).toBe("not_captured");
    s.sources[0].access={status:"unavailable"};expect(()=>parseBrowserSnapshot(s)).toThrow(/Failed/);
  });
  it("rejects stale first-seen posts even if no saved post ID overlaps",()=>{
    const s=make(),prior=digestBrowserSnapshot(s).state;
    s.fetchedAt="2026-09-30T11:00:00Z";s.sources[0].posts=[{...s.sources[0].posts[0],id:"post_unseen"}];
    expect(()=>digestBrowserSnapshot(s,prior)).toThrow(/poll/);
  });
  it("distinguishes successful empty reads from failures and preserves all-failed observation state",()=>{
    const s=make(),prior=digestBrowserSnapshot(s).state;s.fetchedAt="2026-09-30T14:00:00Z";s.sources[0].posts=[];
    s.sources[0].access={status:"unavailable"};const failed=digestBrowserSnapshot(s,prior);expect(failed.state).toEqual(prior);
    s.sources[0].access={status:"ok"};const empty=digestBrowserSnapshot(s,prior);expect(empty.sourceResults[0].status).toBe("ok");
    expect(empty.state.polls?.[0].fetchedAt).toBe(s.fetchedAt);
  });
});
