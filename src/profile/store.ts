import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, relative, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { parseBrowserScope } from "../whop/browserDigest.js";
import { defaultProfile, parseProfile, type Profile } from "./schema.js";

export function pathKey(path: string): string { return process.platform === "win32" ? path.toLowerCase() : path; }

export function assertRegular(path: string, max = 65_536): void {
  const st = lstatSync(path);
  if (!st.isFile() || st.isSymbolicLink() || st.size > max) throw new Error("输入必须是容量以内的普通文件");
}
export function readJson(path: string, max = 65_536): unknown { assertRegular(path, max); return JSON.parse(readFileSync(path, "utf8")); }
export function profileLocation(file: string): string {
  if (!isAbsolute(file)) throw new Error("请提供 profile 的绝对路径");
  const location = join(realpathSync(dirname(file)), basename(file));
  if (existsSync(location) || (() => { try { lstatSync(location); return true; } catch { return false; } })()) assertRegular(location);
  return location;
}
export function childPath(file: string, child: string): string {
  const base = dirname(profileLocation(file)), target = resolve(base, child), rel = relative(base, target);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new Error("配置路径越界");
  let cursor = base;
  for (const part of rel.split(sep)) {
    cursor = join(cursor, part);
    try { if (lstatSync(cursor).isSymbolicLink()) throw new Error("配置路径不能经过符号链接"); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  }
  return target;
}
export function pathsFor(file: string, profile: Profile) {
  const filePath = profileLocation(file);
  const paths = { file: filePath, scope: childPath(filePath, profile.whop.scopeFile), state: childPath(filePath, profile.whop.stateFile), reports: childPath(filePath, profile.reportDirectory) };
  if (new Set(Object.values(paths).map(pathKey)).size !== 4) throw new Error("配置文件目标冲突");
  if ([paths.scope, paths.state].some(p => pathKey(paths.reports) === pathKey(p) || pathKey(p).startsWith(pathKey(paths.reports) + sep)) || pathKey(filePath).startsWith(pathKey(paths.reports) + sep)) throw new Error("报告目录不能混放配置/状态");
  return paths;
}
export function loadProfile(file: string): { profile: Profile; paths: ReturnType<typeof pathsFor> } {
  const location = profileLocation(file), profile = parseProfile(readJson(location));
  return { profile, paths: pathsFor(location, profile) };
}
export function loadProfileScope(file: string, profile: Profile) { return parseBrowserScope(readJson(pathsFor(file, profile).scope, 20_000)); }
export function initProfile(file: string): Profile {
  const profile = defaultProfile(), paths = pathsFor(file, profile), targets = [paths.file, paths.scope, paths.state, paths.reports];
  for (const target of targets) { try { lstatSync(target); throw new Error("初始化目标已存在；已有配置不变"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; } }
  const created: string[] = [];
  try {
    mkdirSync(paths.reports, { mode: 0o700 }); created.push(paths.reports);
    for (const [path, value] of [[paths.scope, { schemaVersion: 1, channels: [] }], [paths.file, profile]] as const) {
      const fd = openSync(path, "wx", 0o600); created.push(path);
      try { writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); } finally { closeSync(fd); }
    }
    return profile;
  } catch (e) {
    for (const path of created.reverse()) { if (path === paths.reports) rmdirSync(path); else unlinkSync(path); }
    throw e;
  }
}
export function setProfile(file: string, value: unknown): Profile {
  const current = loadProfile(file), profile = parseProfile(value); pathsFor(file, profile);
  const fd = openSync(`${current.paths.file}.lock`, "wx", 0o600), temp = join(dirname(current.paths.file), `.profile-${randomUUID()}.tmp`);
  try {
    loadProfile(file);
    writeFileSync(temp, JSON.stringify(profile, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    renameSync(temp, current.paths.file); return profile;
  } finally { closeSync(fd); if (existsSync(temp)) unlinkSync(temp); unlinkSync(`${current.paths.file}.lock`); }
}
