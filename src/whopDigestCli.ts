import { existsSync, lstatSync, openSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { parseBrowserSnapshot, parseBrowserScope, parseDigestState, digestBrowserSnapshot } from "./whop/browserDigest.js";
import { loadProfile } from "./profile/store.js";
import { checkReport, writeReport } from "./profile/output.js";
import { personalizeDigest } from "./whop/preferences.js";

function bounded(path: string, limit=1_000_000): unknown {
  const info=lstatSync(path);if(!info.isFile() || info.size>limit)throw new Error("Invalid or oversized input");
  return JSON.parse(readFileSync(path,"utf8"));
}
const args=process.argv.slice(2), flags=new Map<string,string>(); let json=false;
try {
  for(let i=0;i<args.length;i+=2) {
    if(args[i]==="--json" && !json) {json=true;i--;continue;}
    if(!["--snapshot","--state","--out","--delta","--scope","--profile"].includes(args[i]) || !args[i+1] || flags.has(args[i]))throw new Error("Invalid flags");
    flags.set(args[i],args[i]==="--profile"?args[i+1]:resolve(args[i+1]));
  }
  const configured=flags.has("--profile")?loadProfile(flags.get("--profile")!):undefined;
  if(configured) {
    for(const [flag,path] of [["--state",configured.paths.state],["--scope",configured.paths.scope]]) {
      if(flags.has(flag) && flags.get(flag)!==path)throw new Error("Profile path conflicts with explicit scope/state"); flags.set(flag,path);
    }
    if(!flags.has("--delta") && flags.has("--out"))flags.set("--delta",flags.get("--out")!+".delta.json");
  }
  if(!["--snapshot","--state","--out","--scope"].every(k=>flags.has(k)) || new Set(flags.values()).size!==flags.size)throw new Error("Distinct input/state/report/delta/scope paths are required");
  const input=flags.get("--snapshot")!,statePath=flags.get("--state")!,out=flags.get("--out")!;
  const deltaPath=flags.get("--delta");
  const scope=parseBrowserScope(bounded(flags.get("--scope")!,20_000));
  if(!scope.length)throw new Error("No bound Whop sources; add a binding first");
  const snapshot=parseBrowserSnapshot(bounded(input));
  if(configured) {checkReport(out);if(deltaPath)checkReport(deltaPath);}
  // Lock only this caller-selected state; never remove someone else's existing lock.
  const lock=`${statePath}.lock`,fd=openSync(lock,"wx",0o600);let temporary:string|undefined;
  try {
    const previous=existsSync(statePath)?parseDigestState(bounded(statePath)):undefined;
    const result=digestBrowserSnapshot(snapshot,previous,scope);
    const report=configured?personalizeDigest(result,configured.profile,scope):undefined;
    const content=report?(json?JSON.stringify(report,null,2):report.markdown):result.markdown;
    if(existsSync(out))throw new Error("Report already exists; choose a new output path");
    if(deltaPath && existsSync(deltaPath))throw new Error("Delta already exists; inspect pending work before retrying");
    // Persist only changed records with source metadata, not repeated full source snapshots.
    // The agent can finish a pending semantic brief even after deduplication state was committed.
    const delta=JSON.stringify({schemaVersion:1,retrievalMethod:result.retrievalMethod,fetchedAt:result.fetchedAt,
      unchanged:result.unchanged,sourceResults:result.sourceResults,groups:result.groups,records:result.records.map(({source,post,change,category,contentHash,novelContent})=>({
        source:{url:source.url,experienceId:source.experienceId,communityName:source.communityName,channelName:source.channelName},
        post,change,category,contentHash,novelContent
      }))},null,2)+"\n";
    if(Buffer.byteLength(delta)>1_000_000)throw new Error("Delta exceeds 1 MB; no state committed");
    if(configured) {checkReport(out,content,0,deltaPath && dirname(deltaPath)===dirname(out)?1:0);if(deltaPath)checkReport(deltaPath,delta,dirname(deltaPath)===dirname(out)?Buffer.byteLength(content)+2:0);}
    temporary=join(dirname(statePath),`.whop-${randomUUID()}.tmp`);
    writeFileSync(temporary,JSON.stringify(result.state,null,2)+"\n",{flag:"wx",mode:0o600});
    // Save inspectable report before committing deduplication state; failed report writes do not consume records.
    if(configured)writeReport(out,content+"\n");else writeFileSync(out,content+"\n",{flag:"wx",mode:0o600});
    if(deltaPath)writeFileSync(deltaPath,delta,{flag:"wx",mode:0o600});
    renameSync(temporary,statePath);temporary=undefined;
    console.log(JSON.stringify({records:result.records.length,unchanged:result.unchanged,
      sourceResults:result.sourceResults,newContentGroups:result.groups.filter(g=>g.novelContent).length,
      report:out,state:statePath,delta:deltaPath,networkRequests:0}));
  } finally {
    closeSync(fd);if(temporary && existsSync(temporary))unlinkSync(temporary);unlinkSync(lock);
  }
} catch { console.error("Whop 摘要处理失败：检查范围、文件格式/容量、状态锁或输出路径；不发送频道内容。已有状态与报告请保留核对。");process.exitCode=1; }
