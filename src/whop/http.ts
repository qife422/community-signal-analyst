/** Whop-only transport: fixed origin, no redirects, bounded responses, no error-body logging. */
export class WhopHttpError extends Error {
  constructor(readonly status: number) { super(`Whop HTTP ${status}`); }
}
export async function whopJson(path: string, options: RequestInit): Promise<unknown> {
  if (!/^\/(?:api\/v1\/|oauth\/)/.test(path) || path.includes("..")) throw new Error("Invalid Whop API path");
  const response = await fetch(`https://api.whop.com${path}`, {
    ...options, redirect: "error", signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) { await response.body?.cancel(); throw new WhopHttpError(response.status); }
  if (Number(response.headers.get("content-length")) > 1_000_000) { await response.body?.cancel(); throw new Error("Whop response exceeds 1 MB"); }
  if (!response.body) throw new Error("Empty Whop response");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1_000_000) { await reader.cancel(); throw new Error("Whop response exceeds 1 MB"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
