import { pathKey, loadProfile, loadProfileScope, readJson } from "./profile/store.js";
import { writeReport, checkReport } from "./profile/output.js";
import { parseBrowserSnapshot, digestBrowserSnapshot, type BrowserSource } from "./whop/browserDigest.js";
import { personalizeDigest } from "./whop/preferences.js";
import { sourceAttention, attachAttention } from "./preferences.js";
import { loadSavedBrief } from "./verification.js";
import { generateLiveBrief } from "./report/generateLiveBrief.js";
import { resolve } from "node:path";

try {
  const flags=new Map<string,string>();let json=false;
  const args=process.argv.slice(2);
  for(let i=0;i<args.length;i++) {
    if(args[i]==="--json" && !json){json=true;continue;}
    if(!["--profile","--input","--out"].includes(args[i]) || !args[i+1] || flags.has(args[i]))throw new Error("Invalid flags");
    flags.set(args[i],args[++i]);
  }
  if(!["--profile","--input","--out"].every(k=>flags.has(k)))throw new Error("Expected profile/input/new out");
  const configured=loadProfile(flags.get("--profile")!);
  const input=resolve(flags.get("--input")!),out=checkReport(flags.get("--out")!);
  if([input,...Object.values(configured.paths)].map(pathKey).includes(pathKey(out)))throw new Error("Conflicting output");
  const value=readJson(input,1_000_000) as Record<string,unknown>;
  let report: {markdown:string};
  if(value?.retrievalMethod==="browser_visible") {
    const scope=loadProfileScope(flags.get("--profile")!,configured.profile);
    if(!scope.length)throw new Error("No bindings");
    let snapshot;
    if(Array.isArray(value.sources))snapshot=parseBrowserSnapshot(value);
    else {
      if(value.schemaVersion!==1 || !Array.isArray(value.records) || value.records.length>150 || !Array.isArray(value.sourceResults))throw new Error("Invalid delta");
      const sources:BrowserSource[]=scope.map(s=>({url:s.channelUrl,experienceId:s.experienceId,communityName:s.communityName,channelName:"已有样本",posts:[]}));
      for(const entry of value.records) {
        if(!entry || typeof entry!=="object" || !entry.source || !entry.post)throw new Error("Invalid delta record");
        const s=sources.find(s=>s.url===entry.source.url && s.experienceId===entry.source.experienceId && s.communityName===entry.source.communityName);
        if(!s)throw new Error("Unbound delta source");s.posts.push(entry.post);
      }
      for(const entry of value.sourceResults as Array<Record<string,unknown>>) {
        const s=sources.find(s=>s.url===entry?.url && s.experienceId===entry.experienceId && s.communityName===entry.communityName);
        if(!s || !["ok","login_required","unavailable","not_captured"].includes(String(entry.status)))throw new Error("Invalid delta coverage");
        if(entry.status==="login_required" || entry.status==="unavailable")s.access={status:entry.status};
      }
      snapshot=parseBrowserSnapshot({schemaVersion:1,retrievalMethod:"browser_visible",fetchedAt:value.fetchedAt,sources});
    }
    const digest=digestBrowserSnapshot(snapshot,undefined,scope);
    if(Array.isArray(value.records)) {
      // Preserve validated original coverage, rather than treating the delta's subset as a full capture.
      for(const coverage of digest.sourceResults) {
        const original=(value.sourceResults as Array<Record<string,unknown>>).find(s=>s.url===coverage.url);
        if(!original || !["captured","records","unchanged"].every(k=>Number.isInteger(original[k]) && Number(original[k])>=0 && Number(original[k])<=1000))throw new Error("Invalid delta counts");
        Object.assign(coverage,{status:original.status,captured:original.captured,records:original.records,unchanged:original.unchanged});
      }
      if(!Number.isInteger(value.unchanged) || Number(value.unchanged)<0 || Number(value.unchanged)>1000)throw new Error("Invalid unchanged count");
      digest.unchanged=Number(value.unchanged);
    }
    report=personalizeDigest(digest,configured.profile,scope,true);
  } else {
    const original=loadSavedBrief(input);
    if(original.selectedItems.some(i=>i.author!==undefined && typeof i.author!=="string"))throw new Error("Invalid author");
    const filtered=sourceAttention(original.selectedItems,configured.profile);
    const selected=filtered.items.slice(0,configured.profile.defaults.maxItems);
    const parsed={...original.parsedQuery,language:configured.profile.defaults.language,maxItems:configured.profile.defaults.maxItems};
    const brief=generateLiveBrief(parsed,selected,[...original.dataLimitations,parsed.language==="en"?"Replay of saved samples: only previously selected items are available; unsaved candidates cannot be recovered. No live verification was performed.":"已有样本重筛：仅有已保存的入选项，不能找回未保存候选；不是本次实时验证。"],original.selectedItems.length,[],original.queriedPlatforms);
    report=attachAttention(brief,filtered.attention);
  }
  writeReport(out,(json?JSON.stringify(report,null,2):report.markdown)+"\n");
  console.log(JSON.stringify({replay:true,networkRequests:0,stateModified:false}));
} catch {console.error("离线重筛失败：检查 profile、绑定范围、样本格式/容量和新输出路径；输入与去重状态未修改。");process.exitCode=2;}
