// Runs only public package installs and offline fixtures. No member/auth requests.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, platform, release, arch } from "node:os";
import { spawnSync } from "node:child_process";
const output = join(process.env.RUNNER_TEMP || tmpdir(), "community-validation");
mkdirSync(output, { recursive: true });
const report = { platform: platform(), release: release(), arch: arch(), node: process.version, commit: process.env.GITHUB_SHA, steps: [] };
function run(name, args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" }, timeout: 540_000, maxBuffer: 2_000_000 });
  report.steps.push({ name, exitCode: result.status, stdout: result.stdout?.slice(-8000), stderr: result.stderr?.slice(-4000), error: result.error?.message });
  writeFileSync(join(output, "native.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(name, result.stdout || "", result.stderr || "");
  if (result.status !== 0) process.exit(result.status || 1);
}
run("clean_readme_installation", ["scripts/run-python.mjs", "scripts/check_installation.py", "--ref", process.env.GITHUB_SHA || "main", "--out", join(output, "installation.json")]);
run("compiled_offline_whop", ["scripts/run-python.mjs", "scripts/verify_distribution.py", "--zip", "distribution/community-signal-analyst.zip"]);
report.status = "passed";
writeFileSync(join(output, "native.json"), JSON.stringify(report, null, 2) + "\n");
