import { describe, expect, it } from "vitest";
import { runCommunitySignalAnalysis } from "../src/index.js";
import { generateBrief } from "../src/report/generateBrief.js";

describe("report generation", () => {
  it("generates a Community Signal Brief with required sections and mock disclosure", () => {
    const brief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");

    expect(brief.markdown).toContain("# Community Signal Brief");
    expect(brief.markdown).toContain("## 0. 用户指令");
    expect(brief.markdown).toContain("## 1. 快速结论");
    expect(brief.markdown).toContain("## 2. 入选内容");
    expect(brief.markdown).toContain("## 3. 跨平台趋势总结");
    expect(brief.markdown).toContain("## 4. 下一步建议");
    expect(brief.markdown).toContain("## 5. 数据限制说明");
    expect(brief.markdown).toContain("mock 数据来源");
    expect(brief.selectedItems.length).toBeGreaterThan(0);
    expect(brief.selectedItems.length).toBeLessThanOrEqual(3);
  });

  it("handles no-data scenarios without fabricating items", () => {
    const parsed = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容").parsedQuery;
    const brief = generateBrief(parsed, []);

    expect(brief.selectedItems).toHaveLength(0);
    expect(brief.markdown).toContain("没有足够高质量候选内容");
    expect(brief.markdown).toContain("数据不可用");
  });
});
