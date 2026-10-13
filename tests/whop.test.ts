import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {collectWhop,loadWhopScope} from "../src/adapters/whop.js";
import {parseQuery} from "../src/query-parser/parseQuery.js";
import {runLiveCommunitySignalAnalysis} from "../src/index.js";
import {matchSources} from "../src/corroboration/matchSources.js";
const channel="chat_feed_alpha", experience="exp_alpha";
let dir:string,scope:string;
const msg=(overrides:Record<string,unknown>={})=>({id:"post_root",content:"AI coding with Codex needs a careful review workflow. We tested software repository changes and found regression bugs after generation, so we added isolated tests.",created_at:"2026-09-30T08:00:00Z",message_type:"regular",user:{id:"user_alice",username:"alice"},replying_to_message_id:null,reaction_counts:[{count:4},{count:3}],...overrides});
const reply=(overrides:Record<string,unknown>={})=>msg({id:"post_reply",user:{id:"user_bob",username:"bob"},created_at:"2026-09-30T09:00:00Z",replying_to_message_id:"post_root",content:"We tried the same approach in our team. Isolating tests helped because the change broke cache invalidation and the review did not catch it immediately.",...overrides});
const entry=(suffix="alpha")=>({channelId:`chat_feed_${suffix}`,experienceId:`exp_${suffix}`,communityName:`Community ${suffix}`,channelUrl:`https://whop.com/joined/${suffix}/chat/app/`});
function setup(messages:unknown[],metadata:unknown={id:channel,experience:{id:experience,name:"Coding chat"}},status=200) {
 const mock=vi.fn(async(input:string|URL,options?:RequestInit)=>{
  const url=new URL(String(input));expect(url.origin).toBe("https://api.whop.com");expect(options?.redirect).toBe("error");expect(options?.method ?? "GET").toBe("GET");
  expect((options?.headers as Record<string,string>).Authorization).toBe("Bearer synthetic-member-token");
  if(url.pathname==="/api/v1/messages") {expect(url.searchParams.get("first")).toBe("50");expect(url.searchParams.get("direction")).toBe("desc");expect(url.searchParams.has("after")).toBe(false);return new Response(JSON.stringify({data:messages,page_info:{has_next_page:true}}));}
  return new Response(JSON.stringify(metadata),{status});
 });vi.stubGlobal("fetch",mock);return mock;
}
beforeEach(()=>{
 dir=mkdtempSync(join(tmpdir(),"community-whop-test-"));scope=join(dir,"scope.json");writeFileSync(scope,JSON.stringify({schemaVersion:1,channels:[entry()]}));
 vi.stubEnv("WHOP_API_ENABLED","true");vi.stubEnv("WHOP_SCOPE_FILE",scope);vi.stubEnv("WHOP_USER_ACCESS_TOKEN","synthetic-member-token");
 vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.useRealTimers();rmSync(dir,{recursive:true});});
const parsed=()=>parseQuery("Find recent Whop AI coding discussions in English");
const cutoff=()=>new Date("2026-09-23T12:00:00Z");
describe("Whop preliminary member chat collector",()=>{
 it("recognizes explicit Whop while preserving six/all-seven defaults",()=>{
  expect(parsed().platforms).toEqual(["whop"]);expect(parseQuery("Find recent Whop cache invalidation").keywords).not.toContain("Whop");
  expect(parseQuery("全平台不含 Reddit AI coding").platforms).not.toContain("whop");
  expect(parseQuery("全平台（不含 Reddit），另外查询 Whop AI coding").platforms).toContain("whop");
 });
 it.each(["disabled","missing_token"])("makes no request with %s access",async(reason)=>{
  if(reason==="disabled")vi.stubEnv("WHOP_API_ENABLED","false");else{vi.stubEnv("WHOP_USER_ACCESS_TOKEN","");vi.stubEnv("WHOP_TOKEN_FILE","");}
  const mock=setup([]);expect((await collectWhop(parsed(),cutoff())).queriedPlatforms).toEqual([]);expect(mock).not.toHaveBeenCalled();
 });
 it.each([
  {schemaVersion:1,channels:[]}, {schemaVersion:1,channels:[entry(),entry()]},
  {schemaVersion:1,channels:[entry(),entry("b"),entry("c"),entry("d")]},
  {schemaVersion:1,channels:[{...entry(),channelId:"feed_privateDm"}]},
  {schemaVersion:1,channels:[{...entry(),channelUrl:"https://attacker.example/chat"}]},
  {schemaVersion:1,channels:[{...entry(),channelUrl:"https://whop.com/chat?access_token=secret"}]}
 ])("rejects bad scope before sending credentials",async(value)=>{
  writeFileSync(scope,JSON.stringify(value));const mock=setup([]);expect(()=>loadWhopScope(scope)).toThrow();expect((await collectWhop(parsed(),cutoff())).queriedPlatforms).toEqual([]);expect(mock).not.toHaveBeenCalled();
 });
 it("verifies channel experience before fetching any messages",async()=>{
  const mock=setup([msg()],{id:channel,experience:{id:"exp_wrong"}});expect((await collectWhop(parsed(),cutoff())).items).toEqual([]);expect(mock).toHaveBeenCalledTimes(1);
 });
 it("resolves the explicitly selected experience without requiring a channel ID",async()=>{
  const {channelId:unused,...selected}=entry();
  selected.channelUrl=`https://whop.com/joined/${experience}/app/`;
  writeFileSync(scope,JSON.stringify({schemaVersion:1,channels:[selected]}));
  const mock=setup([msg()]);const result=await collectWhop(parsed(),cutoff());
  expect(String(mock.mock.calls[0][0])).toBe(`https://api.whop.com/api/v1/chat_channels/${experience}`);
  expect(new URL(String(mock.mock.calls[1][0])).searchParams.get("channel_id")).toBe(channel);
  expect(result.items[0].whopContext?.channelId).toBe(channel);
 });
 it.each([{id:"feed_dm",experience:{id:experience}},{id:channel,experience:{id:"exp_other"}}])("does not read messages when experience lookup fails scope validation",async(metadata)=>{
  const {channelId:unused,...selected}=entry();selected.channelUrl=`https://whop.com/joined/${experience}/app/`;writeFileSync(scope,JSON.stringify({schemaVersion:1,channels:[selected]}));
  const mock=setup([msg()],metadata);expect((await collectWhop(parsed(),cutoff())).items).toEqual([]);expect(mock).toHaveBeenCalledTimes(1);
 });
 it("rejects a different experience URL before sending OAuth credentials",async()=>{
  const {channelId:unused,...selected}=entry();selected.channelUrl="https://whop.com/joined/exp_other/app/";
  writeFileSync(scope,JSON.stringify({schemaVersion:1,channels:[selected]}));const mock=setup([]);
  expect((await collectWhop(parsed(),cutoff())).queriedPlatforms).toEqual([]);expect(mock).not.toHaveBeenCalled();
 });
 it("preserves message and reply attribution without inventing message links or totals",async()=>{
  const mock=setup([msg(),reply(),reply({id:"post_self",user:{id:"user_alice",username:"alice"}}),reply({id:"post_badParent",replying_to_message_id:"post_other"}),reply({id:"post_nested",replying_to_message_id:"post_reply"}),reply({id:"post_before",created_at:"2026-09-30T07:00:00Z"})]);
  const result=await collectWhop(parsed(),cutoff());const root=result.items.find(i=>i.id==="post_root")!;expect(mock).toHaveBeenCalledTimes(2);
  expect(root.comments).toHaveLength(1);expect(root.comments[0]).toMatchObject({sourceMessageId:"post_reply",author:"bob",parentItemId:"post_root",retrievalMethod:"whop_user_oauth"});
  expect(root.url).toBe(entry().channelUrl);expect(root.whopContext).toMatchObject({channelId:channel,experienceId:experience,hasMoreMessages:true,linkGranularity:"channel"});
  expect(root.engagementMetrics).toEqual({reactions:7});expect(root.claimVerification).toBe("author_claim_unverified");
 });
 it("filters invalid time, mismatched channel, promotion, system content and duplicate IDs",async()=>{
  setup([msg(),msg(),msg({id:"post_old",created_at:"2026-08-01T12:00:00Z"}),msg({id:"post_future",created_at:"2026-10-01T12:00:00Z"}),msg({id:"post_invalid",created_at:"2026-09-31T12:00:00Z"}),msg({id:"post_other",channel_id:"chat_feed_other"}),msg({id:"post_spam",content:msg().content+" use my affiliate link"}),msg({id:"post_system",message_type:"system"})]);
  expect((await collectWhop(parsed(),cutoff())).items.map(i=>i.id)).toEqual(["post_root"]);
 });
 it.each([401,429])("stops further channels after HTTP %s and does not leak error bodies",async(status)=>{
  writeFileSync(scope,JSON.stringify({schemaVersion:1,channels:[entry(),entry("b")]}));const mock=vi.fn(async()=>new Response("SECRET server error body",{status}));vi.stubGlobal("fetch",mock);
  const result=await collectWhop(parsed(),cutoff());expect(mock).toHaveBeenCalledTimes(1);expect(result.limitations.join()).toContain(`HTTP ${status}`);expect(JSON.stringify(result)).not.toContain("SECRET");
 });
 it("can continue a separately selected channel after permission failure",async()=>{
  writeFileSync(scope,JSON.stringify({schemaVersion:1,channels:[entry(),entry("b")]}));const mock=vi.fn(async(input:string|URL)=>{
   const u=new URL(String(input));if(u.pathname.endsWith(channel))return new Response("denied",{status:403});
   return new Response(JSON.stringify(u.pathname==="/api/v1/messages"?{data:[msg()],page_info:{has_next_page:false}}:{id:"chat_feed_b",experience:{id:"exp_b",name:"Second"}}));
  });vi.stubGlobal("fetch",mock);const result=await collectWhop(parsed(),cutoff());expect(mock).toHaveBeenCalledTimes(3);expect(result.items[0].whopContext?.channelId).toBe("chat_feed_b");
 });
 it("bounds streamed responses",async()=>{
  const mock=vi.fn(async()=>new Response("x".repeat(1_000_001)));vi.stubGlobal("fetch",mock);expect((await collectWhop(parsed(),cutoff())).items).toEqual([]);expect(mock).toHaveBeenCalledTimes(1);
 });
 it("does not conflate distinct discussions just because they share a channel link",async()=>{
  setup([msg(),msg({id:"post_second",content:"Cursor has a pricing problem in our local automation prototype. We measured spending and compared the output before deciding which developer tasks to automate."})]);
  const result=await collectWhop(parsed(),cutoff());expect(result.items).toHaveLength(2);expect(matchSources(result.items[0],result.items[1])).toBeUndefined();
 });
 it("integrates actual collector output into Chinese and English briefs with clear access limits",async()=>{
  setup([msg(),reply()]);const en=await runLiveCommunitySignalAnalysis("Find recent Whop AI coding discussions in English");expect(en.queriedPlatforms).toEqual(["whop"]);expect(en.selectedItems).toHaveLength(1);expect(en.markdown).toContain("Whop member scope:");expect(en.markdown).toContain("not the exact message");expect(en.markdown).toContain("channel; message post_reply");
  const zh=await runLiveCommunitySignalAnalysis("找最近 Whop AI coding 讨论");expect(zh.markdown).toContain("Whop 成员范围：");expect(zh.markdown).toContain("非精确消息定位");
 });
});
