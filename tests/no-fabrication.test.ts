import { describe, expect, it } from "vitest";
import { runCommunitySignalAnalysis } from "../src/index.js";

describe("no-fabrication rules", () => {
  it("marks every selected item as mock example data", () => {
    const brief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");

    expect(brief.selectedItems.every((item) => item.isMockData)).toBe(true);
    expect(brief.selectedItems.every((item) => item.dataLabel === "示例数据")).toBe(true);
    expect(brief.markdown).toContain("本报告基于离线 mock 示例数据生成，仅用于验证流程，不代表真实平台热度。");
    expect(brief.markdown).toContain("未接入真实 API");
  });

  it("does not use real platform URLs in mock data", () => {
    const brief = runCommunitySignalAnalysis("帮我找最近 AI coding 工具比较火的内容");

    expect(brief.selectedItems.every((item) => item.url.startsWith("mock://"))).toBe(true);
  });
});
