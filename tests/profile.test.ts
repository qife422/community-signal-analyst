import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultProfile, parseProfile } from "../src/profile/schema.js";
import { childPath, initProfile, loadProfile, setProfile } from "../src/profile/store.js";
import { doctor } from "../src/profile/doctor.js";
import { runBindingCommand } from "../src/whop/bindings.js";
const dirs: string[] = [];
function home() { const d = mkdtempSync(join(tmpdir(), "community-profile-")); dirs.push(d); return realpathSync(d); }
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true }); vi.restoreAllMocks(); });

describe("independent profiles and local doctor", () => {
  it("starts two users empty and changes only the selected scope", () => {
    const a = home(), b = home(), af = join(a, "profile.json"), bf = join(b, "profile.json");
    initProfile(af); initProfile(bf);
    if (process.platform !== "win32") { expect(statSync(af).mode & 0o777).toBe(0o600); expect(statSync(join(a, "reports")).mode & 0o777).toBe(0o700); }
    runBindingCommand(["add", "--scope", join(a, "scope.json"), "--url", "https://whop.com/example/exp_One/app/", "--name", "My own source"]);
    expect(JSON.parse(readFileSync(join(b, "scope.json"), "utf8")).channels).toEqual([]);
    expect(doctor(bf, {}, "22.0.0")).toMatchObject({ status: "ready", networkRequests: 0, filesModified: 0, liveAccessVerified: false });
  });
  it("preserves existing configuration, locks and malformed originals", () => {
    const occupied=home();writeFileSync(join(occupied,"whop-state.json"),"existing user state");
    expect(()=>initProfile(join(occupied,"profile.json"))).toThrow();
    expect(readFileSync(join(occupied,"whop-state.json"),"utf8")).toBe("existing user state");
    const f = join(home(), "profile.json"); initProfile(f); const before = readFileSync(f, "utf8");
    expect(() => initProfile(f)).toThrow(); expect(readFileSync(f, "utf8")).toBe(before);
    expect(() => setProfile(f, { ...defaultProfile(), token: "never log this" })).toThrow(); expect(readFileSync(f, "utf8")).toBe(before);
    writeFileSync(f + ".lock", "someone else's lock"); expect(() => setProfile(f, defaultProfile())).toThrow();
    expect(readFileSync(f + ".lock", "utf8")).toBe("someone else's lock");
    writeFileSync(f, "invalid"); expect(() => setProfile(f, defaultProfile())).toThrow(); expect(readFileSync(f, "utf8")).toBe("invalid");
  });
  it("never fetches or exposes credential values and distinguishes access from local readiness", () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network"));
    const f = join(home(), "profile.json"); initProfile(f); const p = defaultProfile(); p.defaults.platforms = ["x", "product_hunt", "whop"];
    setProfile(f, p);
    expect(doctor(f, {}, "22.0.0").status).toBe("needs_configuration");
    runBindingCommand(["add", "--scope", join(f, "../scope.json"), "--url", "https://whop.com/example/exp_One/app/", "--name", "Owned"]);
    const before=[f,join(f,"../scope.json")].map(path=>readFileSync(path,"utf8"));
    const result = doctor(f, { X_BEARER_TOKEN: "private-value", PRODUCT_HUNT_TOKEN: "private-value", X_API_ENABLED: "true" }, "22.0.0");
    expect([f,join(f,"../scope.json")].map(path=>readFileSync(path,"utf8"))).toEqual(before);
    expect(result.status).toBe("unverified_access"); expect(JSON.stringify(result)).not.toContain("private-value"); expect(fetch).not.toHaveBeenCalled();
    expect(doctor(f, {}, "20.1.0")).toMatchObject({ status: "invalid_config", exitCode: 2 });
  });
  it("resolves within profile rather than cwd and rejects symlinks and duplicate targets", () => {
    const base = home(), f = join(base, "profile.json"); initProfile(f);
    expect(loadProfile(f.split("\\").join("/")).paths.scope).toBe(join(base, "scope.json"));
    expect(() => childPath(f, "../outside")).toThrow();
    if(process.platform === "win32") expect(() => setProfile(f, {...defaultProfile(),whop:{scopeFile:"PROFILE.JSON",stateFile:"state.json"}})).toThrow();
    const link = join(base, "linked.json"); symlinkSync(f, link); expect(() => loadProfile(link)).toThrow();
    mkdirSync(join(base, "elsewhere")); symlinkSync(join(base, "elsewhere"), join(base, "linkdir"), process.platform === "win32" ? "junction" : "dir");
    expect(() => childPath(f, "linkdir/state.json")).toThrow();
    expect(() => setProfile(f, { ...defaultProfile(), whop: { scopeFile: "profile.json", stateFile: "state.json" } })).toThrow();
  });
  it("validates disabled and unknown rules, limits, and refuses source expansion", () => {
    for (const p of [{ ...defaultProfile(), schemaVersion: 2 }, { ...defaultProfile(), defaults: { ...defaultProfile().defaults, platforms: ["discord"] } }, { ...defaultProfile(), excludeAny: Array(21).fill("noise") }]) expect(() => parseProfile(p)).toThrow();
    const p = defaultProfile(); p.rules = [{ id: "same", enabled: false, sources: ["whop"], authors: [{ kind: "captured_author", value: "Someone" }], includeAny: [] }];
    expect(parseProfile(p).rules).toHaveLength(1); p.rules.push(p.rules[0]); expect(() => parseProfile(p)).toThrow();
  });
});
