import type { CommentSignal, CommentTheme } from "../types/communitySignal.js";

const topics: Array<[CommentTheme["topic"], RegExp]> = [
  ["workflow", /\breview\b|\btests?\b|\bworkflow\b|\bdeploy|\bownership\b|\bagent prs?\b|\brework\b|\bmaintenance\b|pull request|代码审查|工作流|测试|部署|返工|维护/i],
  ["defects", /\bbugs?\b|\bregressions?\b|\bfail(?:ed|ure|ing)?\b|\bdefects?\b|\bbroken\b|follow-up fix|缺陷|回归|出错|故障|失败/i],
  ["cost", /\bcost\b|\bpric(?:e|es|ing)\b|\bbill(?:ing)?\b|\bbudget\b|\bexpensive\b|成本|价格|定价|费用|预算/i],
  ["performance", /\bperformance\b|\blatency\b|\bfaster\b|\bslower\b|\befficien|token usage|性能|延迟|速度|效率|耗时/i],
  ["security", /\bsecurity\b|\bpermission\b|\bprivacy\b|\bleak|\bupload|安全|权限|隐私|泄漏|上传/i],
  ["methodology", /\bbenchmark\b|\bbaseline\b|\bsample\b|\bmethodology\b|\bcontrol(?:led)?\b|\bodds\b|\bcompar(?:e|ison)\b|\brepo(?:sitory)? maturity\b|基准|样本|方法|对照|优势比|比较/i]
];

/** Topic indexing only: never infers sentiment, consensus, or population frequency. */
export function groupCommentThemes(comments: CommentSignal[]): CommentTheme[] {
  return topics.flatMap(([topic, pattern]) => {
    const commentUrls = [...new Set(comments.filter((comment) => pattern.test(comment.summary) && /^https:\/\//.test(comment.url ?? "")).map((comment) => comment.url!))];
    return commentUrls.length ? [{ topic, commentUrls, method: "keyword_grouping" as const }] : [];
  });
}
