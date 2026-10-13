import { describe, expect, it } from "vitest";
import { rejectXPost } from "../src/adapters/x.js";
import { xQualityCases } from "./fixtures/xQualityCases.js";

describe("X quality gate evaluation corpus", () => {
  it("meets the labeled precision and recall floors across research modes and noisy posts", () => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    const misses: string[] = [];
    for (const testCase of xQualityCases) {
      const accepted = !rejectXPost({
        text: testCase.text,
        referenced_posts: testCase.referencedPosts,
        public_metrics: testCase.metrics
      }, testCase.topicTerms, testCase.popularRequest);
      if (accepted && testCase.valuable) truePositive++;
      if (accepted && !testCase.valuable) { falsePositive++; misses.push(`false positive: ${testCase.id}`); }
      if (!accepted && testCase.valuable) { falseNegative++; misses.push(`false negative: ${testCase.id}`); }
    }
    const precision = truePositive / (truePositive + falsePositive);
    const recall = truePositive / (truePositive + falseNegative);
    expect({ precision, recall, misses }).toMatchObject({ precision: 1, recall: 1, misses: [] });
  });
});
