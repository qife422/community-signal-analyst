import { existsSync, lstatSync } from "node:fs";
import { loadProfile, loadProfileScope, readJson } from "./store.js";
import { parseDigestState } from "../whop/browserDigest.js";

export function doctor(file: string, environment: NodeJS.ProcessEnv = process.env, nodeVersion = process.versions.node) {
  try {
    if (Number(nodeVersion.split(".")[0]) < 22) throw new Error("运行需要 Node.js 22 或更新版本");
    const { profile, paths } = loadProfile(file), scope = loadProfileScope(file, profile);
    if (existsSync(paths.state)) parseDigestState(readJson(paths.state, 1_000_000));
    if (!lstatSync(paths.reports).isDirectory()) throw new Error("报告目录无效");
    const unboundRules = profile.rules.filter(r => r.experienceId && !scope.some(s => s.experienceId === r.experienceId)).map(r => r.id);
    const sources = profile.defaults.platforms.map(platform => {
      if (platform === "whop") return { platform, status: scope.length ? "unverified_access" : "needs_configuration", suggestion: scope.length ? "绑定格式有效，浏览器连接和会员权限尚未验证" : "先绑定自己有权访问的完整频道链接" };
      if (platform === "x" || platform === "product_hunt") {
        const present = Boolean(environment[platform === "x" ? "X_BEARER_TOKEN" : "PRODUCT_HUNT_TOKEN"]);
        const enabled = platform !== "x" || environment.X_API_ENABLED === "true";
        return { platform, status: present && enabled ? "unverified_access" : "needs_configuration", suggestion: present && enabled ? "已提供运行配置，实际接口权限尚未验证" : "自行提供对应环境变量；X 还需明确付费读取开关" };
      }
      return { platform, status: "ready", suggestion: "本地配置可用；本次没有验证在线访问" };
    });
    return { status: sources.some(s => s.status === "needs_configuration") ? "needs_configuration" : sources.some(s => s.status === "unverified_access") ? "unverified_access" : "ready", profileId: profile.id, sources, unboundRules: unboundRules.map(id => ({ id, status: "scope_unbound" })), liveAccessVerified: false, networkRequests: 0, filesModified: 0, exitCode: 0 };
  } catch { return { status: "invalid_config", suggestion: "检查 Node.js 22、配置 schema/容量、独立普通文件路径、scope 和 reports；原配置未修改", liveAccessVerified: false, networkRequests: 0, filesModified: 0, exitCode: 2 }; }
}
