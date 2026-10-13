import { describe, expect, it } from "vitest";
import { runCommunitySignalAnalysis } from "../src/index.js";

const bannedTradingAdvice = /买入|卖出|持有|目标价|仓位建议|价格目标/;
const devTestTone = /用于验证如何|适合继续验证|评分权重|报告结构|测试说明/;
const investmentTemplateTerms = /充分定价|增长叙事|财报叙事|估值消化|预期差/;

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe("report quality", () => {
  it("prints an actual selected count that matches rendered item sections", () => {
    const brief = runCommunitySignalAnalysis("看看最近大家对英伟达财报怎么看");
    const renderedCount = [...brief.markdown.matchAll(/^### 内容 \d+：/gm)].length;

    expect(brief.selectedItems.length).toBeGreaterThan(0);
    expect(brief.selectedItems.length).toBeLessThanOrEqual(3);
    expect(renderedCount).toBe(brief.selectedItems.length);
    expect(brief.markdown).toContain(`最终筛选数量：${brief.selectedItems.length}`);
  });

  it("does not repeat mock disclosure throughout item body copy", () => {
    const brief = runCommunitySignalAnalysis("看看最近大家对英伟达财报怎么看");

    expect(brief.markdown).toContain("本报告基于离线 mock 示例数据生成，仅用于验证流程，不代表真实平台热度。");
    expect(countOccurrences(brief.markdown, "示例数据")).toBeLessThanOrEqual(4);
  });

  it("uses reader-facing analysis instead of development test language", () => {
    const brief = runCommunitySignalAnalysis("看看最近大家对英伟达财报怎么看");

    expect(brief.markdown).not.toMatch(devTestTone);
    expect(brief.markdown).toContain("核心争议");
    expect(brief.markdown).toContain("社区情绪");
    expect(brief.markdown).toContain("为什么值得继续观察");
  });

  it("keeps investment reports free of direct trading advice", () => {
    const brief = runCommunitySignalAnalysis("看看最近大家对英伟达财报怎么看");

    expect(brief.markdown).not.toMatch(bannedTradingAdvice);
    expect(brief.markdown).toContain("不构成投资建议");
  });

  it("explains why covered platforms are not selected", () => {
    const brief = runCommunitySignalAnalysis("看看最近大家对英伟达财报怎么看");
    const selectedPlatforms = new Set(brief.selectedItems.map((item) => item.platform));

    if (!selectedPlatforms.has("devto")) {
      expect(brief.markdown).toContain("dev.to 未入选");
    }
  });

  it("does not use investment analysis phrasing for AI coding reports", () => {
    const brief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");

    expect(brief.parsedQuery.analysisMode).toBe("dev_tool_research");
    expect(brief.markdown).not.toMatch(investmentTemplateTerms);
    expect(brief.markdown).toContain("稳定开发流程");
    expect(brief.markdown).toContain("review、测试和上下文管理成本");
    expect(brief.markdown).toContain("hidden bugs");
  });

  it("allows investment analysis phrasing for earnings reports without trading advice", () => {
    const brief = runCommunitySignalAnalysis("看看最近大家对英伟达财报怎么看");

    expect(brief.parsedQuery.analysisMode).toBe("investment_research");
    expect(brief.markdown).toContain("预期差");
    expect(brief.markdown).toContain("市场情绪");
    expect(brief.markdown).toContain("财报叙事");
    expect(brief.markdown).not.toMatch(bannedTradingAdvice);
  });

  it("keeps product research reports focused on user pain and competitors", () => {
    const brief = runCommunitySignalAnalysis("帮我看看新工具的用户痛点、竞品和替代方案");

    expect(brief.parsedQuery.analysisMode).toBe("product_research");
    expect(brief.markdown).toContain("用户痛点");
    expect(brief.markdown).toContain("功能需求");
    expect(brief.markdown).toContain("竞品反馈");
    expect(brief.markdown).not.toMatch(investmentTemplateTerms);
  });

  it("renders source status and reviewable link fields for every selected item", () => {
    const brief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");
    const sections = brief.markdown.split(/^### 内容 \d+：/m).slice(1);

    expect(sections).toHaveLength(brief.selectedItems.length);
    for (const section of sections) {
      expect(section).toContain("- 平台：");
      expect(section).toContain("- 来源链接：");
      expect(section).toContain("- 来源状态：");
      expect(section).toContain("- 发布时间：");
      expect(section).toContain("- 核心数据：");
      expect(section).toContain("- 一句话摘要：");
      expect(section).toContain("- 为什么火：");
      expect(section).toContain("- 代表性观点：");
      expect(section).toContain("- AI 分析：");
      expect(section).toContain("- 对我的启发：");
      expect(section).toContain("- 风险/不确定性：");
      expect(section).toMatch(/- 来源链接：(?:mock:\/\/|https?:\/\/|需人工补充来源链接)/);
    }
  });

  it("adds a data source status block at the start of the report", () => {
    const brief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");

    expect(brief.markdown).toContain("## 0. 数据来源状态");
    expect(brief.markdown).toContain("本次是否使用真实 API：否");
    expect(brief.markdown).toContain("是否使用 mock 数据：是");
    expect(brief.markdown).toContain("是否所有链接可复查：是");
    expect(brief.markdown).toContain("可能不完整的平台数据：Hacker News、GitHub、dev.to");
  });

  it("does not print precise engagement metrics for mock or unverified selected items", () => {
    const brief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");
    const sections = brief.markdown.split(/^### 内容 \d+：/m).slice(1);

    for (const section of sections) {
      if (section.includes("- 来源状态：mock_data") || section.includes("- 来源状态：unverified")) {
        const metricLine = section.split("\n").find((line) => line.startsWith("- 核心数据："));
        expect(metricLine).toBeDefined();
        expect(metricLine).not.toMatch(/\b\d+\s*(stars|forks|points|comments|reactions|open issues)\b/i);
        expect(metricLine).toContain("未验证");
      }
    }
  });

});
