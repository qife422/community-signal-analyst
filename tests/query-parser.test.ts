import { describe, expect, it } from "vitest";
import { parseQuery } from "../src/query-parser/parseQuery.js";
import { selectPlatforms } from "../src/query-parser/platformSelector.js";

describe("query parsing", () => {
  it("extracts an arbitrary topic and honors an explicit larger result count", () => {
    const parsed = parseQuery("找 5 条近 14 天关于 PostgreSQL 性能的社区讨论");
    expect(parsed.keywords).toContain("PostgreSQL");
    expect(parsed.keywords).toContain("性能");
    expect(parsed.keywords).not.toContain("最近");
    expect(parsed.maxItems).toBe(5);
    expect(parsed.timeRange).toBe("recent_14d");
  });

  it("honors an explicit English output request without treating it as a topic", () => {
    const parsed = parseQuery("Find recent PostgreSQL performance discussions in English");
    expect(parsed.language).toBe("en");
    expect(parsed.keywords).toEqual(["PostgreSQL", "performance"]);
  });

  it("keeps the named product as the topic in a Product Hunt launch request", () => {
    const parsed = parseQuery("Find recent Product Hunt Lattice launches in English");
    expect(parsed.platforms).toEqual(["product_hunt"]);
    expect(parsed.keywords).toEqual(["Lattice"]);
  });

  it("parses English time windows and result counts", () => {
    const parsed = parseQuery("Find 5 PostgreSQL performance posts from the past 14 days in English");
    expect(parsed.timeRange).toBe("recent_14d");
    expect(parsed.maxItems).toBe(5);
    expect(parsed.keywords).toEqual(["PostgreSQL", "performance"]);
  });

  it("does not turn an unrelated agent query into AI coding research", () => {
    const parsed = parseQuery("Find recent Kubernetes agent performance discussions");
    expect(parsed.analysisMode).toBe("general");
    expect(parsed.keywords).toContain("Kubernetes");
  });
  it("parses AI coding requests into dev tool research defaults", () => {
    const parsed = parseQuery("帮我找最近 AI coding 工具比较火的内容");

    expect(parsed.topic).toBe("AI coding tools");
    expect(parsed.keywords).toContain("AI coding");
    expect(parsed.keywords).toContain("agentic coding");
    expect(parsed.analysisMode).toBe("dev_tool_research");
    expect(parsed.timeRange).toBe("recent_7d");
    expect(parsed.maxItems).toBe(3);
    expect(parsed.strictMode).toBe(true);
    expect(parsed.language).toBe("zh");
  });

  it("parses investment queries without trading advice intent", () => {
    const parsed = parseQuery("看看最近大家对英伟达财报怎么看");

    expect(parsed.topic).toBe("Nvidia earnings");
    expect(parsed.keywords).toEqual(expect.arrayContaining(["Nvidia", "NVDA", "earnings"]));
    expect(parsed.analysisMode).toBe("investment_research");
  });

  it("recognizes product research and user pain queries", () => {
    const parsed = parseQuery("帮我看看新工具的用户痛点、竞品和替代方案");

    expect(parsed.analysisMode).toBe("product_research");
    expect(parsed.keywords).toEqual(expect.arrayContaining(["用户痛点", "竞品", "替代方案", "新工具"]));
  });

  it("recognizes US stock and market sentiment wording", () => {
    const parsed = parseQuery("给我一些最近关于美股市场情绪比较火的帖子");

    expect(parsed.analysisMode).toBe("investment_research");
    expect(parsed.keywords).toEqual(expect.arrayContaining(["美股", "市场情绪"]));
  });
});

describe("platform selection", () => {
  it.each(["找最近全平台（不含 Reddit）AI coding 讨论", "找最近除 Reddit 外的全部平台 AI coding 讨论", "Find all platforms except Reddit AI coding discussions", "Find all platforms excluding Reddit AI coding discussions", "找最近六平台 AI coding 讨论", "Find all six platforms AI coding discussions"])("honors the six-platform delivery scope: %s", (query) => {
    expect(parseQuery(query).platforms).toEqual(["hacker_news", "github", "devto", "product_hunt", "x", "discord"]);
  });
  it("keeps platform exclusions out of general topic keywords", () => {
    const parsed = parseQuery("Find all platforms except Reddit PostgreSQL performance discussions in English");
    expect(parsed.keywords).toEqual(["PostgreSQL", "performance"]);
    expect(parseQuery("Find all six platforms PostgreSQL performance discussions in English").keywords).toEqual(parsed.keywords);
  });
  it("does not select an excluded Reddit mention as a requested source", () => {
    expect(parseQuery("Find Hacker News PostgreSQL discussions, skip Reddit").platforms).toEqual(["hacker_news"]);
    expect(parseQuery("Find Reddit PostgreSQL discussions, exclude Reddit").platforms).toEqual([]);
  });
  it("routes Discord to the authorized adapter and excludes platform words from topic terms", () => {
    const parsed = parseQuery("Find recent Discord PostgreSQL performance discussions in English");
    expect(parsed.platforms).toEqual(["discord"]);
    expect(parsed.keywords).toEqual(["PostgreSQL", "performance"]);
    expect(parsed.unavailablePlatforms).toEqual([]);
  });
  it("selects all seven only when all-platform coverage was requested", () => {
    const platforms = ["hacker_news", "github", "devto", "reddit", "product_hunt", "x", "discord"];
    expect(parseQuery("找最近全平台 AI coding 讨论").platforms).toEqual(platforms);
    expect(parseQuery("Find all platforms PostgreSQL performance discussions in English").platforms).toEqual(platforms);
    expect(parseQuery("Find all platforms PostgreSQL performance discussions in English").keywords).toEqual(["PostgreSQL", "performance"]);
  });
  it("selects suitable default platforms", () => {
    const parsed = parseQuery("给我一些最近关于股票比较火的帖子");

    expect(selectPlatforms(parsed)).toEqual(["hacker_news", "devto"]);
  });

  it("selects a credential-gated requested platform without substituting another", () => {
    const parsed = parseQuery("找最近 Reddit 关于 AI coding 的讨论");
    expect(parsed.platforms).toEqual(["reddit"]);
    expect(parsed.unavailablePlatforms).toEqual([]);
  });

  it("routes a standalone X request to the gated X adapter", () => {
    const parsed = parseQuery("找最近 X 上的 AI coding 讨论");
    expect(parsed.platforms).toEqual(["x"]);
    expect(parsed.unavailablePlatforms).toEqual([]);
  });
});

describe("current delivery excludes Discord and Reddit while naming Whop",()=>{
  it.each(["找全平台（不含 Discord 和 Reddit）以及 Whop 的 PostgreSQL 性能讨论", "Find all platforms except Discord and Reddit, including Whop, PostgreSQL performance discussions", "找除 Reddit、Discord 外的全部平台 Whop PostgreSQL 讨论"])("honors both deferred platforms: %s",query=>{
    expect(parseQuery(query).platforms).toEqual(["hacker_news","github","devto","product_hunt","x","whop"]);
  });
  it("does not treat exclusion conjunctions as the research topic",()=>{
    expect(parseQuery("Find all platforms except Discord and Reddit, including Whop, PostgreSQL performance discussions").keywords).toEqual(["PostgreSQL","performance"]);
  });
  it("can explicitly defer a named source without substituting another",()=>{
    expect(parseQuery("Whop PostgreSQL 讨论，暂缓 Discord 和 Reddit").platforms).toEqual(["whop"]);
    expect(parseQuery("Find Discord PostgreSQL discussions, skip Discord").platforms).toEqual([]);
  });
});
