import { closeSync, existsSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parseBrowserScope, type BrowserScope } from "./browserDigest.js";

export const bindingHelp = `Whop 社区绑定（仅保存本地读取范围，不加入社区、不获取授权、不发消息）
npm run whop:bind -- list --scope <绝对路径>
npm run whop:bind -- add --scope <绝对路径> --url <Whop频道完整链接> --name <社区名>
npm run whop:bind -- remove --scope <绝对路径> --id <exp_频道ID>
每个配置最多3个频道。链接应为 https://whop.com/<社区>/exp_<ID>/app/，不含查询参数。
社区首页链接需先在浏览器中选择要读取的频道；绑定后仍须验证会员访问权限。`;

export function addBinding(channels: BrowserScope[], url: string, name: string): {channels: BrowserScope[]; changed: boolean} {
  channels = parseBrowserScope({schemaVersion:1, channels});
  let experienceId: string;
  try { experienceId = new URL(url).pathname.match(/\/(exp_[A-Za-z0-9]{1,100})\/app\/$/)?.[1] ?? ""; }
  catch { throw new Error("请提供完整的 Whop 频道链接"); }
  let entry: BrowserScope;
  try { entry = parseBrowserScope({schemaVersion:1,channels:[{experienceId,communityName:name,channelUrl:url}]})[0]; }
  catch { throw new Error("链接或社区名无效；请使用不含参数的 Whop 频道完整链接"); }
  const existing = channels.find(x => x.experienceId === experienceId);
  if (existing) {
    if (existing.channelUrl === entry.channelUrl && existing.communityName === entry.communityName) return {channels,changed:false};
    throw new Error("该频道已绑定到不同名称或链接；请先明确解除原绑定");
  }
  if (channels.length >= 3) throw new Error("最多绑定3个频道；请先解除一个绑定或选择另一独立配置");
  return {channels:[...channels,entry],changed:true};
}

export function removeBinding(channels: BrowserScope[], experienceId: string): {channels: BrowserScope[]; changed: boolean} {
  channels = parseBrowserScope({schemaVersion:1,channels});
  if (!/^exp_[A-Za-z0-9]{1,100}$/.test(experienceId)) throw new Error("解除绑定需要精确的 exp_频道ID");
  return {channels:channels.filter(x=>x.experienceId!==experienceId),changed:channels.some(x=>x.experienceId===experienceId)};
}

function readBindings(path: string): BrowserScope[] {
  if (!existsSync(path)) {
    // existsSync also returns false for a dangling symlink; never replace one.
    try { lstatSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    throw new Error("绑定配置必须是普通文件");
  }
  const info = lstatSync(path);
  if (!info.isFile() || info.size > 20_000) throw new Error("绑定配置必须是20KB以内的普通文件");
  try { return parseBrowserScope(JSON.parse(readFileSync(path,"utf8"))); }
  catch { throw new Error("绑定配置格式无效；保留原文件，请检查 channels 范围"); }
}

/** Only local selected-scope configuration is changed. No browser, credential, digest-state or network access. */
export function runBindingCommand(argv: string[]): {message:string; channels:BrowserScope[]; changed:boolean; networkRequests:0} {
  const [command,...args] = argv;
  if (!["list","add","remove"].includes(command)) throw new Error(bindingHelp);
  const flags = new Map<string,string>();
  const allowed = command==="add" ? ["--scope","--url","--name"] : command==="remove" ? ["--scope","--id"] : ["--scope"];
  for (let i=0;i<args.length;i+=2) {
    if (!allowed.includes(args[i]) || !args[i+1] || args[i+1].startsWith("--") || flags.has(args[i])) throw new Error(bindingHelp);
    flags.set(args[i],args[i+1]);
  }
  if (allowed.some(x=>!flags.has(x)) || !isAbsolute(flags.get("--scope")!)) throw new Error(bindingHelp);
  // Reject invalid requests before opening a lock or touching caller-selected files.
  if (command==="add") addBinding([],flags.get("--url")!,flags.get("--name")!);
  if (command==="remove") removeBinding([],flags.get("--id")!);
  const path = resolve(flags.get("--scope")!);
  if (command === "list") {
    const channels = readBindings(path);
    return {message:channels.length ? "已绑定的本地读取范围；会员访问仍需浏览器验证" : "尚未绑定频道；请先添加绑定",channels,changed:false,networkRequests:0};
  }
  const lock = `${path}.lock`, fd = openSync(lock,"wx",0o600);
  let temporary: string | undefined;
  try {
    const channels = readBindings(path);
    const result = command==="add" ? addBinding(channels,flags.get("--url")!,flags.get("--name")!) : removeBinding(channels,flags.get("--id")!);
    if (result.changed) {
      temporary = join(dirname(path),`.whop-bind-${randomUUID()}.tmp`);
      writeFileSync(temporary,JSON.stringify({schemaVersion:1,channels:result.channels},null,2)+"\n",{flag:"wx",mode:0o600});
      renameSync(temporary,path); temporary=undefined;
    }
    return {message:result.changed ? (command==="add" ? "已保存本地绑定；尚未验证会员访问" : "已解除绑定；历史去重记录和报告保留") : (command==="add" ? "该频道已绑定，无需重复添加" : "该频道未绑定，无需修改"),...result,networkRequests:0};
  } finally {
    closeSync(fd);
    if (temporary && existsSync(temporary)) unlinkSync(temporary);
    unlinkSync(lock);
  }
}
