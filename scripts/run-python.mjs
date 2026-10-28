// Prefer an installed Python 3 without relying on python3 being a Windows alias.
import { spawnSync } from "node:child_process";
const choices = process.platform === "win32" ? [["python", []], ["py", ["-3"]], ["python3", []]] : [["python3", []], ["python", []]];
for (const [command, prefix] of choices) {
  const probe = spawnSync(command, [...prefix, "--version"], { encoding: "utf8" });
  if (probe.status !== 0 || !/^Python 3\./.test(probe.stdout || probe.stderr || "")) continue;
  const result = spawnSync(command, [...prefix, ...process.argv.slice(2)], {
    stdio: "inherit", env: { ...process.env, PYTHONUTF8: "1" }
  });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
console.error("Python 3 is required for source packaging/installation checks. Install Python 3 and reopen the terminal.");
process.exit(1);
