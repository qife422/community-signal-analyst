// Real Codex discovery and tool execution against an explicit local protocol fixture.
// No inference credentials, real model, community reads, or existing user config.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, lstatSync, statSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir, homedir, platform, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const options = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  if (!["--codex", "--out", "--source", "--bundle"].includes(process.argv[i]) || !process.argv[i + 1] || options.has(process.argv[i])) throw new Error("Expected codex/out and optional source/bundle flags");
  options.set(process.argv[i], process.argv[i + 1]);
}
const source = resolve(options.get("--source") || "."), codex = resolve(options.get("--codex") || ""), output = resolve(options.get("--out") || "");
if (!options.has("--codex") || !options.has("--out") || existsSync(output) || !existsSync(dirname(output))) throw new Error("Choose an existing Codex executable and a new report path");
const nativeHome = homedir(), ownedNativeEntries = new Set();
if (process.platform === "win32" && process.env.GITHUB_ACTIONS !== "true") throw new Error("Windows isolation uses a disposable GitHub runner account; this script will not modify a real user Skill registry");
function removeOwnedEntry(entry) {
  if (!ownedNativeEntries.has(entry)) throw new Error("Not a context-owned CI entry");
  rmSync(entry, { recursive: !lstatSync(entry).isSymbolicLink(), force: true, maxRetries: 5, retryDelay: 200 });
  ownedNativeEntries.delete(entry);
}
const base = realpathSync(mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "community codex ")));
const report = { schemaVersion: 1, platform: platform(), release: release(), node: process.version, status: "running", cases: [], realModelVerified: false, credentialsUsed: false, fixture: "scripted local Responses protocol; not LLM inference", communityRequests: 0 };
const hash = data => createHash("sha256").update(data).digest("hex");
function save() { const data = JSON.stringify(report, null, 2).replaceAll(base.replaceAll("\\", "\\\\"), "<isolated-root>").replaceAll(base, "<isolated-root>"); if (Buffer.byteLength(data) > 500_000) throw new Error("Report capacity reached"); writeFileSync(output, data + "\n"); }
function inventory() {
  let files = 0, bytes = 0, externalRuntimeHardLinks = 0, aliasedLogicalBytes = 0;
  const runtime = statSync(codex), largest = [];
  const visit = dir => { for (const item of readdirSync(dir)) {
    const p = join(dir, item), st = lstatSync(p);
    if (st.isSymbolicLink()) { files++; bytes += st.size; }
    else if (st.isDirectory()) visit(p);
    else {
      files++;
      if (st.nlink > 1 && st.dev === runtime.dev && st.ino === runtime.ino) { externalRuntimeHardLinks++; aliasedLogicalBytes += st.size; }
      else { bytes += st.size; largest.push({path:p.replace(base,"<isolated-root>"),bytes:st.size}); }
    }
  } };
  visit(base);
  for (const entry of ownedNativeEntries) { const st = lstatSync(entry); if (st.isSymbolicLink()) { files++; bytes += st.size; } else visit(entry); }
  largest.sort((a,b)=>b.bytes-a.bytes);
  const measured = {files,bytes,externalRuntimeHardLinks,aliasedLogicalBytes,largest:largest.slice(0,8),limits:{files:500,bytes:20_000_000,sourceAmplification:100}};
  report.inventory = measured;
  if (files >= 500 || bytes >= 20_000_000) { report.capacityReached = true; save(); throw new Error("New-user test capacity reached: " + JSON.stringify(measured)); }
  return measured;
}

function envFor(home) {
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, CODEX_HOME: join(home, ".codex"), APPDATA: join(home, "AppData/Roaming"), LOCALAPPDATA: join(home, "AppData/Local"), TEMP: join(home, "tmp"), TMP: join(home, "tmp"), TMPDIR: join(home, "tmp"), LANG: "en_US.UTF-8", PYTHONUTF8: "1" };
  for (const k of ["SystemRoot", "WINDIR", "COMSPEC", "PATHEXT"]) if (process.env[k]) env[k] = process.env[k];
  for (const p of [env.CODEX_HOME, env.APPDATA, env.LOCALAPPDATA, env.TEMP]) mkdirSync(p, { recursive: true });
  writeFileSync(join(env.CODEX_HOME, "config.toml"), 'cli_auth_credentials_store = "ephemeral"\n');
  return env;
}
function startServer(cwd, env) {
  const child = spawn(codex, ["app-server", "--listen", "stdio://"], { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  let next = 0, stderr = "", closed = false;
  const requests = new Map(), events = [];
  child.stderr.setEncoding("utf8"); child.stderr.on("data", s => { stderr = (stderr + s).slice(-3000); });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", line => {
    if (line.length > 2_000_000) { child.kill(); return; }
    let msg; try { msg = JSON.parse(line); } catch { return; }
    if (msg.id !== undefined && requests.has(msg.id)) { const p = requests.get(msg.id); requests.delete(msg.id); clearTimeout(p.timer); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
    else if (msg.method) {
      events.push(msg); if (events.length > 1000) child.kill();
      // This test never approves arbitrary prompts or unexpected server requests.
      if (msg.id !== undefined) child.stdin.write(JSON.stringify({ id: msg.id, error: { code: -32601, message: "No interactive approvals in fixture test" } }) + "\n");
    }
  });
  child.on("exit", () => { closed = true; for (const p of requests.values()) { clearTimeout(p.timer); p.reject(new Error("Codex exited: " + stderr)); } requests.clear(); });
  child.on("error", error => { for (const p of requests.values()) p.reject(error); });
  return {
    events,
    request(method, params) { return new Promise((resolvePromise, reject) => { const id = ++next; const timer = setTimeout(() => { requests.delete(id); reject(new Error("RPC timeout: " + method + " " + stderr)); }, 30_000); requests.set(id, { resolve: resolvePromise, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + "\n"); }); },
    notify(method, params = {}) { child.stdin.write(JSON.stringify({ method, params }) + "\n"); },
    async close() { if (closed) return; child.stdin.end(); await Promise.race([new Promise(r => child.once("exit", r)), new Promise(r => setTimeout(() => { child.kill(); r(); }, 3000))]); },
    stderr: () => stderr
  };
}
async function initialize(rpc) { await rpc.request("initialize", { clientInfo: { name: "community_skill_installation_check", version: "1.0.0" }, capabilities: { experimentalApi: true } }); rpc.notify("initialized"); }
async function waitTurn(rpc) {
  const start = Date.now();
  while (Date.now() - start < 90_000) { const done = rpc.events.find(e => e.method === "turn/completed"); if (done) { if (done.params.turn.status !== "completed") throw new Error("Turn failed: " + JSON.stringify(done.params.turn.error) + " " + rpc.stderr()); return done; } await new Promise(r => setTimeout(r, 100)); }
  throw new Error("Codex fixture turn timed out: " + rpc.stderr());
}
function sse(response, items, number) {
  response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const event = (type, extra) => response.write("event: " + type + "\ndata: " + JSON.stringify({ type, ...extra }) + "\n\n");
  event("response.created", { response: { id: "fixture_" + number, status: "in_progress", output: [] } });
  items.forEach((item, output_index) => event("response.output_item.done", { output_index, item }));
  event("response.completed", { response: { id: "fixture_" + number, status: "completed", output: items, usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } } });
  response.end();
}
async function fixture(commands, cwd, skillText) {
  const state = { requests: 0, instructionInjected: false, toolName: null, functionOutputObserved: false };
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", chunk => { body += chunk; if (body.length > 1_000_000) request.destroy(); });
    request.on("end", () => {
      try {
        const data = JSON.parse(body); state.requests++;
        const serialized = JSON.stringify(data.input);
        state.toolOutputs = (data.input || []).filter(item => item.type === "function_call_output").map(item => typeof item.output === "string" ? item.output.slice(-2000) : JSON.stringify(item.output).slice(-2000));
        const texts = value => typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(texts) : [];
        const instructionBody = skillText.replace(/^---[\s\S]*?---\s*/, "").replaceAll("\r\n", "\n").trim();
        state.instructionInjected ||= texts(data.input).some(text => text.replaceAll("\r\n", "\n").includes(instructionBody));
        state.expectedInstructionBodySha256 = hash(instructionBody);
        if (state.requests <= commands.length) {
          const command = commands[state.requests - 1];
          const tool = data.tools.find(t => ["exec_command", "shell_command", "shell"].includes(t.name));
          if (!tool || !state.instructionInjected) throw new Error("Expected a real injected skill and Codex shell tool");
          state.toolName = tool.name;
          const args = tool.name === "exec_command" ? { cmd: command, workdir: cwd, login: false, yield_time_ms: 10000, max_output_tokens: 2500 } : tool.name === "shell_command" ? { command, workdir: cwd, timeout_ms: 20_000 } : { command: process.platform === "win32" ? ["powershell", "-NoProfile", "-Command", command] : ["/bin/bash", "-c", command], workdir: cwd, timeout_ms: 20_000 };
          sse(response, [{ type: "function_call", id: "fixture_function_" + state.requests, call_id: "fixture_call_" + state.requests, name: tool.name, arguments: JSON.stringify(args) }], state.requests);
        } else {
          state.functionOutputObserved ||= serialized.includes("ready") && serialized.includes("networkRequests");
          sse(response, [{ type: "message", role: "assistant", id: "fixture_message", content: [{ type: "output_text", text: "Local scripted protocol fixture completed. No real model inference." }] }], state.requests);
        }
      } catch (error) { state.error = error.message; sse(response, [{type:"message",role:"assistant",id:"fixture_error",content:[{type:"output_text",text:"Scripted fixture error: "+error.message}]}], state.requests); }
    });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  return { state, url: "http://127.0.0.1:" + server.address().port + "/v1", close: () => new Promise(r => server.close(r)) };
}
async function checkCase(kind) {
  const home = join(base, kind); mkdirSync(home); const env = envFor(home), cwd = join(home, "unrelated project"), skills = join(process.platform === "win32" ? nativeHome : home, ".agents/skills"); mkdirSync(cwd); mkdirSync(skills, { recursive: true });
  const installed = join(skills, "community-signal-analyst");
  try { lstatSync(installed); throw new Error("Existing user Skill entry preserved; use a fresh CI account"); } catch(error) { if (error.code !== "ENOENT") throw error; }
  if (process.platform === "win32") ownedNativeEntries.add(installed);
  if (kind === "compiled") {
    const extraction = 'import sys,zipfile,pathlib\nz=zipfile.ZipFile(sys.argv[1]); entries=z.infolist(); assert len(entries)<200 and sum(x.file_size for x in entries)<2044210; assert all(not pathlib.Path(x.filename).is_absolute() and ".." not in pathlib.Path(x.filename).parts for x in entries); z.extractall(sys.argv[2])';
    const child = spawnSync(process.execPath, [join(source, "scripts/run-python.mjs"), "-c", extraction, resolve(options.get("--bundle") || join(source, "distribution/community-signal-analyst.zip")), skills], { encoding: "utf8", timeout: 20_000 }); if (child.status !== 0) throw new Error(child.stderr);
  } else symlinkSync(source, installed, process.platform === "win32" ? "junction" : "dir");
  const entry = join(installed, "SKILL.md"), skillText = readFileSync(entry, "utf8");
  const result = { kind, sourceRegistration: kind === "source" ? (process.platform === "win32" ? "junction" : "symlink") : "complete compiled folder", cwdUnrelatedToSkill: true, discoveryHome: process.platform === "win32" ? "disposable native Windows CI account" : "isolated HOME", skillSha256: hash(skillText) }; report.cases.push(result); save();
  let rpc = startServer(cwd, env);
  try {
    await initialize(rpc);
    const account = await rpc.request("account/read", { refreshToken: false }); if (account.account !== null) throw new Error("Expected signed-out new user"); result.account = "signed_out";
    const catalog = await rpc.request("skills/list", { cwds: [cwd], forceReload: true });
    const matches = catalog.data.flatMap(x => x.skills).filter(x => x.name === "community-signal-analyst");
    if (matches.length !== 1 || matches[0].enabled !== true || matches[0].scope !== "user" || (statSync(matches[0].path).ino !== statSync(entry).ino || statSync(matches[0].path).dev !== statSync(entry).dev)) throw new Error("Normal user Skill discovery failed: " + JSON.stringify(catalog));
    result.discovery = { status: "passed", name: matches[0].name, enabled: matches[0].enabled, scope: matches[0].scope, errors: catalog.data.flatMap(x => x.errors || []) };
  } finally { await rpc.close(); }
  const privateDir = join(home, ".community-signal-analyst"); mkdirSync(privateDir, { mode: 0o700 }); const profile = join(privateDir, "profile.json"), guard = join(cwd, "network-guard.mjs");
  writeFileSync(guard, 'globalThis.fetch=()=>{throw new Error("community network forbidden")};');
  const quote = value => "'" + value.replaceAll("'", process.platform === "win32" ? "''" : "'\\''") + "'";
  const commands = [[join(installed, "dist/src/profileCli.js"), "init", "--file", profile], [join(installed, "dist/src/doctorCli.js"), "--profile", profile]].map(args => (process.platform === "win32" ? "& " : "") + [process.execPath, "--import", pathToFileURL(guard).href, ...args].map(quote).join(" "));
  if (process.platform === "win32") {
    const identity = process.env.USERDOMAIN + "\\" + process.env.USERNAME;
    const setup = spawnSync(codex, ["sandbox", "setup", "--elevated", "--user", identity, "--codex-home", env.CODEX_HOME], {cwd, env, encoding:"utf8", timeout:60_000});
    result.windowsSandbox = {mode:"elevated",setupExitCode:setup.status};
    if(setup.status !== 0) throw new Error("Native Windows sandbox setup failed: " + (setup.stderr || setup.stdout).slice(-2500));
  }
  const backend = await fixture(commands, cwd, skillText);
  writeFileSync(join(env.CODEX_HOME, "config.toml"), `cli_auth_credentials_store = "ephemeral"\nmodel_provider = "fixture"\nmodel = "fixture-codex-skill"\n[model_providers.fixture]\nname = "Local scripted protocol fixture (not inference)"\nbase_url = ${JSON.stringify(backend.url)}\nwire_api = "responses"\nrequires_openai_auth = false\n${process.platform === "win32" ? '[windows]\nsandbox = "elevated"\n' : ""}`);
  rpc = startServer(cwd, env);
  try {
    await initialize(rpc);
    const thread = await rpc.request("thread/start", { cwd, ephemeral: true, approvalPolicy: "never", sandbox: "workspace-write" });
    await rpc.request("turn/start", { threadId: thread.thread.id, input: [{ type: "text", text: "$community-signal-analyst 初始化并检查我指定的临时profile；这是离线安装测试，不访问社区、不启用自动化。" }, { type: "skill", name: "community-signal-analyst", path: entry }], sandboxPolicy: { type: "workspaceWrite", writableRoots: [cwd, privateDir], networkAccess: false } });
    await waitTurn(rpc);
    const commands = rpc.events.filter(e => e.method === "item/completed" && e.params.item.type === "commandExecution").map(e => ({ status: e.params.item.status, exitCode: e.params.item.exitCode, command: e.params.item.command, cwd: e.params.item.cwd, output: e.params.item.aggregatedOutput }));
    if (backend.state.error || !backend.state.instructionInjected || !backend.state.functionOutputObserved || commands.length !== 2 || !commands.every(x => x.exitCode === 0)) throw new Error("Incomplete fixture execution: " + JSON.stringify({ state: backend.state, commands, profileExists: existsSync(profile), stderr: rpc.stderr() }));
    const scope = JSON.parse(readFileSync(join(privateDir, "scope.json"), "utf8")); if (scope.channels.length !== 0 || existsSync(join(privateDir, "whop-state.json"))) throw new Error("Expected a new zero-bound user without state");
    result.protocolFixture = { status: "passed", ...backend.state, commands, zeroBindings: true, realModel: false };
    if (existsSync(join(env.CODEX_HOME, "auth.json"))) throw new Error("Credential file unexpectedly created");
    result.credentialsWritten = false;
  } finally { await rpc.close(); await backend.close(); }
  report.inventory = inventory(); save();
  if (process.platform === "win32") removeOwnedEntry(installed);
}
try {
  const version = spawnSync(codex, ["--version"], { encoding: "utf8", timeout: 10_000 }); if (version.status !== 0) throw new Error(version.stderr); report.codexVersion = version.stdout.trim();
  await checkCase("compiled"); await checkCase("source");
  report.status = "discovery_and_scripted_protocol_passed"; report.realModelStatus = "not_verified_user_selected_no_credentials";
  save(); console.log(JSON.stringify({ status: report.status, codex: report.codexVersion, cases: report.cases.map(x => ({ kind: x.kind, discovery: x.discovery.status, fixture: x.protocolFixture.status })), realModelVerified: false }));
} catch (error) { report.status = "failed"; report.error = error.message.replaceAll(base, "<isolated-root>"); save(); console.error(report.error); process.exitCode = 1; }
finally {
  for (const entry of [...ownedNativeEntries]) { try { removeOwnedEntry(entry); } catch(error) { report.entryCleanup = error.code; } }
  try { if(report.capacityReached) report.temporaryDisposition = "capacity stop; context-owned tree retained for inventory"; else { rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); report.temporaryDisposition = "context-owned tree removed"; } }
  catch(error) { report.temporaryDisposition = "context-owned CI tree retained because locked: " + error.code; }
  save();
}
