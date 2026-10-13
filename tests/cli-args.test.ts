import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cliArgs.js";

describe("CLI arguments", () => {
  it("preserves the first explicit query argument", () => {
    expect(parseCliArgs(["看看最近大家对英伟达财报怎么看"]).query).toBe("看看最近大家对英伟达财报怎么看");
  });

  it("separates demo and output options from the query", () => {
    expect(parseCliArgs(["--demo", "--json", "AI coding", "--out", "/tmp/brief.json"])).toEqual({
      query: "AI coding", demo: true, json: true, outputPath: "/tmp/brief.json"
    });
  });

  it("requires an explicit history path and keeps it out of the query", () => {
    expect(parseCliArgs(["AI coding", "--history", "/tmp/history.json"]).query).toBe("AI coding");
    expect(parseCliArgs(["AI coding", "--history", "/tmp/history.json"]).historyPath).toBe("/tmp/history.json");
    expect(() => parseCliArgs(["--history"])).toThrow();
    expect(() => parseCliArgs(["--demo", "--history", "/tmp/history.json"])).toThrow();
  });

  it("allows offline verification without a new query", () => {
    const args = parseCliArgs(["--verify-brief", "/tmp/brief.json", "--verification", "/tmp/reviews.json", "--json"]);
    expect(args.savedBriefPath).toBe("/tmp/brief.json");
    expect(args.verificationPath).toBe("/tmp/reviews.json");
    expect(args.json).toBe(true);
    for (const invalid of [["--verification"], ["--verification", "--out", "/tmp/out"], ["--verify-brief", "/tmp/brief.json"], ["--demo", "--verification", "/tmp/reviews.json"], ["--verify-brief", "/tmp/brief.json", "--verification", "/tmp/reviews.json", "new query"], ["--unknown"]]) expect(() => parseCliArgs(invalid)).toThrow();
  });

  it("allows replies for a saved brief without recollecting roots, optionally with claim reviews", () => {
    const args = parseCliArgs(["--reply-brief", "/tmp/brief.json", "--verification", "/tmp/reviews.json"]);
    expect(args.replyBriefPath).toBe("/tmp/brief.json");
    expect(args.verificationPath).toBe("/tmp/reviews.json");
    for (const invalid of [["--reply-brief"], ["--demo", "--reply-brief", "/tmp/brief.json"], ["--reply-brief", "/tmp/brief.json", "new query"], ["--reply-brief", "/tmp/brief.json", "--history", "/tmp/history.json"]]) expect(() => parseCliArgs(invalid)).toThrow();
  });
});
