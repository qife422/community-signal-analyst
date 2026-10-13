import { describe, expect, it } from "vitest";
import { runCommunitySignalAnalysis } from "../src/index.js";

describe("investment compliance", () => {
  it("does not emit direct trading advice for investment research queries", () => {
    const brief = runCommunitySignalAnalysis("看看最近大家对英伟达财报怎么看");

    expect(brief.parsedQuery.analysisMode).toBe("investment_research");
    expect(brief.markdown).not.toMatch(/买入|卖出|持有|目标价|仓位建议|价格目标/);
    expect(brief.markdown).toContain("不构成投资建议");
    expect(brief.markdown).toContain("社区讨论存在样本偏差");
  });

  it("returns mock community signals for broad stock market queries without advice", () => {
    const brief = runCommunitySignalAnalysis("给我一些最近关于股票比较火的帖子");

    expect(brief.parsedQuery.analysisMode).toBe("investment_research");
    expect(brief.selectedItems.length).toBeGreaterThan(0);
    expect(brief.markdown).toContain("不构成投资建议");
    expect(brief.markdown).not.toMatch(/买入|卖出|持有|目标价|仓位建议|价格目标/);
  });
});
