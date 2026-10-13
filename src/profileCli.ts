import { initProfile, loadProfile, readJson, setProfile } from "./profile/store.js";
const [command, ...args] = process.argv.slice(2);
try {
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (!["--file", "--input"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--") || flags.has(args[i])) throw new Error("参数无效");
    flags.set(args[i], args[i + 1]);
  }
  if (!["init", "show", "set"].includes(command) || !flags.has("--file") || (command === "set") !== flags.has("--input")) throw new Error("Use init/show/set --file <absolute profile.json>; set also requires --input <JSON>");
  const file = flags.get("--file")!;
  const profile = command === "init" ? initProfile(file) : command === "set" ? setProfile(file, readJson(flags.get("--input")!)) : loadProfile(file).profile;
  console.log(JSON.stringify({ message: "本地配置处理完成；不授予平台权限", profile, paths:loadProfile(file).paths, networkRequests: 0 }, null, 2));
} catch (error) { console.error(error instanceof Error && !("code" in error) ? error.message : "本地配置处理失败；检查目标、权限与锁，已有配置保留"); process.exitCode = 2; }
