import { lstatSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve, join } from "node:path";
/** Bounded new private reports. Never replace an existing file, including a dangling symlink. */
export function checkReport(path: string, content?: string, reservedBytes = 0, reservedEntries = 0): string {
  const out = join(realpathSync(dirname(resolve(path))), basename(resolve(path)));
  try { lstatSync(out); throw new Error("报告目标已存在"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  const entries = readdirSync(dirname(out));
  let bytes = 0;
  for (const name of entries) { const st = lstatSync(join(dirname(out), name)); if (st.isFile()) bytes += st.size; }
  const size = content === undefined ? 0 : Buffer.byteLength(content);
  if (size > 1_000_000 || entries.length + reservedEntries >= 100 || bytes + size + reservedBytes > 4_088_420) throw new Error("报告目录达到容量阈值；请先盘点");
  return out;
}
export function writeReport(path: string, content: string) { writeFileSync(checkReport(path, content), content, {flag:"wx",mode:0o600}); }
