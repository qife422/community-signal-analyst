/** Paraphrased patterns and adversarial synthetic cases. No copied X post text. */
export type XQualityCase = {
  id: string;
  topicTerms: string[];
  text: string;
  valuable: boolean;
  popularRequest?: boolean;
  referencedPosts?: Array<{ type: string }>;
  metrics?: { like_count: number; reply_count: number; repost_count: number };
};

export const xQualityCases: XQualityCase[] = [
  { id: "agent-study", topicTerms: ["AI coding"], valuable: true,
    text: "A study of 6,500 merged AI coding pull requests found follow-up fixes at 1.5 times the human baseline. The comparison used matched repositories and raises a concrete code-review question." },
  { id: "production-regression", topicTerms: ["AI coding"], valuable: true,
    text: "I tested an AI coding agent on our production service. It changed the payment retry path, but a review gate caught two regressions before release; the failed cases are documented in the issue." },
  { id: "named-tool-cost", topicTerms: ["Cursor"], valuable: true,
    text: "I used Cursor for a month on a TypeScript codebase. The review workflow saved about 6 hours a week, but debugging generated migrations cost more time than expected." },
  { id: "benchmark", topicTerms: ["AI coding"], valuable: true,
    text: "Researchers benchmarked an AI coding agent on 51 tasks and measured 34% lower token use and 22% lower API cost. The result held on the listed repair tasks, though other tasks were not tested." },
  { id: "earnings-analysis", topicTerms: ["Nvidia", "NVDA"], valuable: true,
    text: "NVDA earnings showed revenue growth of 25%, while gross margin declined three points and management lowered next-quarter guidance. The valuation risk depends on whether that margin recovers." },
  { id: "product-feedback", topicTerms: ["onboarding"], valuable: true,
    text: "We tested a shorter onboarding flow with 40 new users. Completion improved from 48% to 65%, while support requests fell; the biggest remaining complaint was the import step." },
  { id: "chinese-experience", topicTerms: ["AI coding"], valuable: true,
    text: "我们实测 AI coding 工作流处理 30 个真实缺陷，发现自动补丁在边界条件下失败 4 次。增加人工代码审查后修复了这些回归问题，测试记录留在仓库。" },
  { id: "qualitative-firsthand", topicTerms: ["AI coding"], valuable: true,
    text: "I used AI coding in a legacy service migration. The agent produced a working first pass, but we found a permission bug during review and fixed it before deploying to customers." },
  { id: "qualitative-product-feedback", topicTerms: ["onboarding"], valuable: true,
    text: "We interviewed new users about onboarding. They completed signup but struggled to import data, so we moved the import prompt later and reduced support requests from first-time customers." },
  { id: "substantive-low-engagement", topicTerms: ["AI coding"], valuable: true,
    text: "A benchmark of AI coding agents across 42 tasks found a lower failure rate when tests were supplied up front. The comparison separated new features from bug-fix tasks and reported both outcomes.",
    metrics: { like_count: 1, reply_count: 0, repost_count: 0 } },
  { id: "popular-with-evidence", topicTerms: ["AI coding"], valuable: true, popularRequest: true,
    text: "We tested an AI coding review gate on 90 pull requests and found it caught 11 regressions before merge. The team kept the gate because the extra review time was lower than the repair cost.",
    metrics: { like_count: 15, reply_count: 6, repost_count: 4 } },
  { id: "reply", topicTerms: ["AI coding"], valuable: false,
    text: "@someone I tested AI coding on a real codebase and found two bugs during review, but your benchmark misses the migration cases entirely. The outcome depends on the test set.",
    referencedPosts: [{ type: "replied_to" }] },
  { id: "repost", topicTerms: ["AI coding"], valuable: false,
    text: "RT @someone AI coding benchmark tested 60 tasks and found lower cost after review. The study compares different repositories and measured the repair rate.",
    referencedPosts: [{ type: "retweeted" }] },
  { id: "short", topicTerms: ["AI coding"], valuable: false,
    text: "AI coding agents are amazing. Try one today." },
  { id: "off-topic", topicTerms: ["AI coding"], valuable: false,
    text: "We tested a new garden irrigation controller on 24 plots and found lower water cost after changing the valve workflow. The field results are available for review." },
  { id: "direct-promo", topicTerms: ["AI coding"], valuable: false,
    text: "I tested my AI coding service on 40 tasks and found lower repair cost. Sign up for the beta now to get a discount and join our launch event this week." },
  { id: "subtle-promo", topicTerms: ["AI coding"], valuable: false,
    text: "Our AI coding platform was tested on 100 tasks and cut review cost by 50%. Enroll now for early access and unlock your team's productivity with our exclusive launch package." },
  { id: "demo-promo", topicTerms: ["AI coding"], valuable: false,
    text: "Our AI coding benchmark on 80 tasks found 30% lower review cost. Book a demo with our team to see the workflow and learn why the platform is the best choice for your company." },
  { id: "workflow-list", topicTerms: ["AI coding"], valuable: false,
    text: "My AI coding workflow: first I ask for a plan, then I generate tickets, then an agent writes code, then I review it. The process matters more than the model." },
  { id: "engagement-hype", topicTerms: ["AI coding"], valuable: false,
    text: "AI coding workflow is the future and every team should embrace it. The cost and risk are worth it because innovation always wins. This changes everything for developers.",
    metrics: { like_count: 90, reply_count: 20, repost_count: 12 } },
  { id: "vague-firsthand", topicTerms: ["AI coding"], valuable: false,
    text: "I used AI coding in my workflow and found lower cost, better results, and fewer bugs. It was a great experience that everyone should try because the future is here." },
  { id: "engagement-bait", topicTerms: ["AI coding"], valuable: false,
    text: "AI coding benchmark results are finally here: 25% lower cost and faster reviews. Tag a friend, repost this thread, and follow for the full reveal tomorrow." },
  { id: "not-popular", topicTerms: ["AI coding"], valuable: false, popularRequest: true,
    text: "I tested an AI coding agent on 50 issues and found lower review cost after we added a failing-test gate. The workflow still needs a human sign-off for production changes.",
    metrics: { like_count: 1, reply_count: 0, repost_count: 0 } },
  { id: "mention-promo", topicTerms: ["AI coding"], valuable: false,
    text: "I tested an AI coding workflow and found lower bug risk during review. This demo with @vendorOne and @vendorTwo has the full showcase at https://t.co/example, so check it out." }
];
