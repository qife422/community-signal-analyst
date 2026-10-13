import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {createHash} from "node:crypto";
import {mkdtempSync,rmSync,statSync,chmodSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {beginWhopOAuth,finishWhopOAuth,refreshWhopTokens,writeWhopTokens,readWhopTokens} from "../src/whop/oauth.js";
let dir:string;
const tokens=()=>({access_token:"synthetic-access",refresh_token:"synthetic-refresh",token_type:"Bearer",expires_in:3600,scope:"chat:read"});
const setup=()=>{const f=vi.fn(async(_input:string|URL,_options?:RequestInit)=>new Response(JSON.stringify(tokens())));vi.stubGlobal("fetch",f);return f;};
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),"community-whop-auth-test-"));vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();rmSync(dir,{recursive:true});});
it("creates PKCE authorization with only read scope and a random state",()=>{
 const a=beginWhopOAuth("app_test"),b=beginWhopOAuth("app_test"),url=new URL(a.authorizationUrl);expect(url.origin).toBe("https://api.whop.com");expect(url.searchParams.get("scope")).toBe("chat:read");expect(url.searchParams.get("code_challenge_method")).toBe("S256");expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(a.verifier).digest("base64url"));expect(a.state).not.toBe(b.state);expect(a.authorizationUrl).not.toContain(a.verifier);
});
it.each(["https://attacker.example/whop/callback","http://0.0.0.0:4387/whop/callback"])("refuses non-loopback redirect %s",url=>expect(()=>beginWhopOAuth("app_test",url)).toThrow());
it.each(["state","origin","age","denied"])("rejects %s callback before exchanging credentials",async(reason)=>{
 const s=beginWhopOAuth("app_test"),u=new URL(s.redirectUri);u.searchParams.set("state",s.state);u.searchParams.set("code","synthetic-code");
 if(reason==="state")u.searchParams.set("state","wrong");if(reason==="origin")u.hostname="attacker.example";if(reason==="age")vi.advanceTimersByTime(600_001);if(reason==="denied")u.searchParams.set("error","access_denied");
 const f=setup();await expect(finishWhopOAuth(s,u.href)).rejects.toThrow();expect(f).not.toHaveBeenCalled();
});
it("exchanges a valid callback using PKCE without logging or returning the authorization code",async()=>{
 const s=beginWhopOAuth("app_test"),f=setup(),result=await finishWhopOAuth(s,`${s.redirectUri}?code=synthetic-code&state=${s.state}`);
 expect(f).toHaveBeenCalledTimes(1);expect(f.mock.calls[0][0]).toBe("https://api.whop.com/oauth/token");expect(JSON.parse((f.mock.calls[0] as unknown as [string,RequestInit])[1].body as string)).toMatchObject({grant_type:"authorization_code",code_verifier:s.verifier,client_id:"app_test"});expect(result).toMatchObject({requestedScope:"chat:read",returnedScope:"chat:read",expiresAt:"2026-09-30T13:00:00.000Z"});expect(JSON.stringify(result)).not.toContain("synthetic-code");
});
it("saves private credentials once and refuses insecure or expired files",async()=>{
 const s=beginWhopOAuth("app_test");setup();const result=await finishWhopOAuth(s,`${s.redirectUri}?code=synthetic-code&state=${s.state}`),path=join(dir,"oauth.json");
 writeWhopTokens(path,result);expect(statSync(path).mode & 0o777).toBe(0o600);expect(readWhopTokens(path)).toEqual(result);expect(()=>writeWhopTokens(path,result)).toThrow();expect(readFileSync(path,"utf8")).toContain("synthetic-access");
 chmodSync(path,0o644);expect(()=>readWhopTokens(path)).toThrow();chmodSync(path,0o600);vi.advanceTimersByTime(3_600_001);expect(()=>readWhopTokens(path)).toThrow();
});
it("requires read permission when the response reports scopes",async()=>{
 const s=beginWhopOAuth("app_test");vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({...tokens(),scope:"profile"}))));await expect(finishWhopOAuth(s,`${s.redirectUri}?code=test&state=${s.state}`)).rejects.toThrow();
});
it("uses the rotated refresh token and does not silently retain an obsolete one",async()=>{
 const s=beginWhopOAuth("app_test");setup();const previous=await finishWhopOAuth(s,`${s.redirectUri}?code=test&state=${s.state}`);
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({...tokens(),access_token:"new-access",refresh_token:"rotated-refresh"}))));expect((await refreshWhopTokens(previous)).refreshToken).toBe("rotated-refresh");
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({...tokens(),refresh_token:undefined}))));await expect(refreshWhopTokens(previous)).rejects.toThrow();
});
