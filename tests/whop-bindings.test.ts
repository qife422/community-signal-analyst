import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, statSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addBinding, removeBinding, runBindingCommand } from "../src/whop/bindings.js";
import { digestBrowserSnapshot, parseBrowserScope, type BrowserSnapshot } from "../src/whop/browserDigest.js";
const url = (id="alpha")=>`https://whop.com/example/exp_${id}/app/`;
const initial = ()=>addBinding([],url(),"Example").channels;
const scopePath = ()=>join(mkdtempSync(join(tmpdir(),"whop-bind-test-")),"scope.json");
afterEach(()=>vi.unstubAllGlobals());
describe("user-selected Whop bindings",()=>{
 it("adds one exact channel and treats repeated identical binding as a no-op",()=>{
  const channels=initial();expect(channels[0].experienceId).toBe("exp_alpha");
  expect(addBinding(channels,url(),"Example")).toEqual({channels,changed:false});
 });
 it.each(["https://attacker.example/example/exp_alpha/app/","http://whop.com/example/exp_alpha/app/","https://whop.com/example/","https://whop.com/example/exp_alpha/app/?token=private","https://whop.com/example/exp_alpha/app/#message","https://user:pass@whop.com/example/exp_alpha/app/"])("rejects non-scoped or sensitive URL %s",bad=>{
  expect(()=>addBinding(initial(),bad,"Example")).toThrow();
 });
 it("never silently reassigns an existing experience or removes bindings at capacity",()=>{
  const channels=[...initial(),...addBinding([],url("beta"),"Other").channels,...addBinding([],url("gamma"),"Third").channels];
  expect(()=>addBinding(channels,url("delta"),"Fourth")).toThrow(/3/);
  expect(()=>addBinding(channels,url(),"Renamed")).toThrow(/解除/);
  expect(channels).toHaveLength(3);
 });
 it("removes exactly the selected channel and accepts zero remaining bindings",()=>{
  const channels=[...initial(),...addBinding([],url("beta"),"Other").channels];
  const removed=removeBinding(channels,"exp_alpha");expect(removed.channels[0].experienceId).toBe("exp_beta");
  expect(removeBinding(removed.channels,"exp_beta").channels).toEqual([]);
  expect(parseBrowserScope({schemaVersion:1,channels:[]})).toEqual([]);
  expect(removeBinding(channels,"exp_missing").changed).toBe(false);
 });
 it("removed channels are rejected by the digest while their historical state survives",()=>{
  const snapshot:BrowserSnapshot={schemaVersion:1,retrievalMethod:"browser_visible",fetchedAt:new Date().toISOString(),sources:[{
    url:url(),experienceId:"exp_alpha",communityName:"Example",channelName:"Chat",posts:[{id:"post_one",author:"Member",publishedLabel:"1h",pinned:false,body:"A substantive real-world workflow is described here as a synthetic test fixture."}]
  }]};
  const prior=digestBrowserSnapshot(snapshot,undefined,initial()).state;
  expect(()=>digestBrowserSnapshot(snapshot,prior,removeBinding(initial(),"exp_alpha").channels)).toThrow(/outside/);
  expect(prior.entries).toHaveLength(1);
  expect(digestBrowserSnapshot(snapshot,prior,initial()).unchanged).toBe(1);
 });
 it("persists an add/list/remove lifecycle privately without fetching or editing other files",()=>{
  vi.stubGlobal("fetch",()=>{throw new Error("network prohibited");});
  const path=scopePath(),history=join(path,"..","whop.json");writeFileSync(history,'{"preserved":true}\n');
  expect(runBindingCommand(["list","--scope",path]).channels).toEqual([]);
  const add=runBindingCommand(["add","--scope",path,"--url",url(),"--name","Example"]);
  expect(add.changed).toBe(true);expect(add.networkRequests).toBe(0);if(process.platform!=="win32")expect(statSync(path).mode&0o777).toBe(0o600);
  expect(runBindingCommand(["list","--scope",path]).channels).toEqual(initial());
  expect(runBindingCommand(["remove","--scope",path,"--id","exp_alpha"]).channels).toEqual([]);
  expect(JSON.parse(readFileSync(path,"utf8")).channels).toEqual([]);
  expect(readFileSync(history,"utf8")).toBe('{"preserved":true}\n');
 });
 it("does not overwrite malformed or symlinked scope or remove someone else's lock",()=>{
  const path=scopePath();writeFileSync(path,'private-invalid-config');
  const args=["add","--scope",path,"--url",url(),"--name","Example"];
  expect(()=>runBindingCommand(args)).toThrow(/格式/);expect(readFileSync(path,"utf8")).toBe('private-invalid-config');
  const alias=join(path,"..","alias.json");symlinkSync(path,alias);
  expect(()=>runBindingCommand(["list","--scope",alias])).toThrow(/普通文件/);
  const dangling=join(path,"..","dangling.json");symlinkSync(join(path,"..","missing.json"),dangling);
  expect(()=>runBindingCommand(["add","--scope",dangling,"--url",url(),"--name","Example"])).toThrow(/普通文件/);
  writeFileSync(`${path}.lock`,"another caller");expect(()=>runBindingCommand(args)).toThrow();
  expect(readFileSync(`${path}.lock`,"utf8")).toBe("another caller");
 });
 it.each([["add","--scope","relative.json","--url",url(),"--name","Example"],["remove","--scope","/unused","--id","*"],["list","--scope","/unused","--scope","/duplicate"]])("rejects ambiguous input %j",(...args)=>{
  expect(()=>runBindingCommand(args)).toThrow();
 });
});
