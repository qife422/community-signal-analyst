import { describe, expect, it } from "vitest";
import { generateBrief } from "../src/report/generateBrief.js";
import { parseQuery } from "../src/query-parser/parseQuery.js";

describe("no-data behavior", () => {
  it("explains limitations and next steps when no candidates are selected", () => {
    const parsed = parseQuery("一个 mock 数据里不存在的冷门主题");
    const brief = generateBrief(parsed, []);

    expect(brief.markdown).toContain("没有足够高质量候选内容");
    expect(brief.markdown).toContain("可以调整关键词");
    expect(brief.markdown).not.toContain("https://news.ycombinator.com/item?id=");
  });
});
