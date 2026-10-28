import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { object, whopJson } from "./http.js";

export interface WhopOAuthSession {
  clientId: string; redirectUri: string; state: string; verifier: string; createdAt: number; authorizationUrl: string;
}
export interface WhopTokens {
  schemaVersion: 1; clientId: string; accessToken: string; refreshToken?: string;
  tokenType: "Bearer"; expiresAt: string; requestedScope: "chat:read"; returnedScope?: string;
}
function token(v: unknown): v is string { return typeof v === "string" && v.length > 0 && v.length <= 20_000 && !/\s/.test(v); }
function client(v: string): boolean { return /^app_[A-Za-z0-9]{1,100}$/.test(v); }
function redirect(v: string): void {
  const url = new URL(v);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/whop/callback") throw new Error("Use a registered loopback callback: http://127.0.0.1:<port>/whop/callback");
}
/** Creates only the public authorization link, never a credential or a consent grant. */
export function beginWhopOAuth(clientId: string, redirectUri = "http://127.0.0.1:4387/whop/callback"): WhopOAuthSession {
  if (!client(clientId)) throw new Error("A configured Whop OAuth app ID is required");
  redirect(redirectUri);
  const verifier = randomBytes(32).toString("base64url"), state = randomBytes(24).toString("base64url");
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri,
    scope: "chat:read", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
  return { clientId, redirectUri, state, verifier, createdAt: Date.now(), authorizationUrl: `https://api.whop.com/oauth/authorize?${params}` };
}
function parseTokens(value: unknown, clientId: string): WhopTokens {
  if (!object(value) || !token(value.access_token) || typeof value.token_type !== "string" || value.token_type.toLowerCase() !== "bearer"
    || !Number.isSafeInteger(value.expires_in) || (value.expires_in as number) <= 0 || (value.expires_in as number) > 86_400
    || (value.refresh_token !== undefined && !token(value.refresh_token))
    || (value.scope !== undefined && (typeof value.scope !== "string" || !value.scope.split(/\s+/).includes("chat:read")))) throw new Error("Whop token response is invalid or lacks returned chat:read scope");
  return { schemaVersion: 1, clientId, accessToken: value.access_token, refreshToken: value.refresh_token as string | undefined,
    tokenType: "Bearer", expiresAt: new Date(Date.now() + (value.expires_in as number)*1000).toISOString(),
    requestedScope: "chat:read", returnedScope: value.scope as string | undefined };
}
export async function finishWhopOAuth(session: WhopOAuthSession, callbackUrl: string): Promise<WhopTokens> {
  const callback = new URL(callbackUrl), expected = new URL(session.redirectUri), state = callback.searchParams.get("state") ?? "";
  if (!client(session.clientId) || Date.now() < session.createdAt || Date.now()-session.createdAt > 600_000
    || callback.origin !== expected.origin || callback.pathname !== expected.pathname
    || state.length !== session.state.length || !timingSafeEqual(Buffer.from(state),Buffer.from(session.state))) throw new Error("Whop callback state, origin or session age is invalid");
  if (callback.searchParams.has("error")) throw new Error("Whop authorization was declined or unavailable");
  const code = callback.searchParams.get("code");
  if (!token(code)) throw new Error("Whop callback is missing a valid authorization code");
  const value = await whopJson("/oauth/token", { method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({grant_type:"authorization_code",code,redirect_uri:session.redirectUri,client_id:session.clientId,code_verifier:session.verifier}) });
  return parseTokens(value,session.clientId);
}
export async function refreshWhopTokens(previous: WhopTokens): Promise<WhopTokens> {
  if (!client(previous.clientId) || !token(previous.refreshToken)) throw new Error("Whop refresh credentials are unavailable");
  const value = await whopJson("/oauth/token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({grant_type:"refresh_token",refresh_token:previous.refreshToken,client_id:previous.clientId})});
  const next = parseTokens(value,previous.clientId);
  // Whop rotates refresh tokens; never silently retain an obsolete one.
  if (!next.refreshToken) throw new Error("Whop refresh did not return a rotated refresh token");
  return next;
}
export function writeWhopTokens(path: string, value: WhopTokens): void {
  assertCredentialFilePlatform();
  writeFileSync(path,JSON.stringify(value,null,2)+"\n",{mode:0o600,flag:"wx"});
}
export function readWhopTokens(path: string): WhopTokens {
  assertCredentialFilePlatform();
  const info = statSync(path);
  if (!info.isFile() || info.size > 50_000 || (info.mode & 0o077)) throw new Error("Whop credential file must be private (0600) and at most 50 KB");
  const value: unknown = JSON.parse(readFileSync(path,"utf8"));
  if (!object(value) || value.schemaVersion !== 1 || typeof value.clientId !== "string" || !client(value.clientId)
    || !token(value.accessToken) || value.tokenType !== "Bearer" || value.requestedScope !== "chat:read"
    || typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()
    || (value.refreshToken !== undefined && !token(value.refreshToken))
    || (value.returnedScope !== undefined && (typeof value.returnedScope !== "string" || !value.returnedScope.split(/\s+/).includes("chat:read")))) throw new Error("Whop credentials are invalid or expired; reauthorize before collection");
  return value as unknown as WhopTokens;
}

// The experimental token-file route has no Windows ACL verification yet.
function assertCredentialFilePlatform(): void {
  if (process.platform === "win32") throw new Error("Experimental Whop OAuth credential files are unsupported on Windows; use the authorized browser workflow");
}
