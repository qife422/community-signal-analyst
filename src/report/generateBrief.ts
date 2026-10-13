import type { CommunitySignalBrief, ParsedQuery, ScoredItem } from "../types/communitySignal.js";

export function generateBrief(parsedQuery: ParsedQuery, selectedItems: ScoredItem[]): CommunitySignalBrief {
  const quickTakeaways = buildQuickTakeaways(parsedQuery, selectedItems);
  const crossPlatformTrends = buildCrossPlatformTrends(selectedItems);
  const nextSteps = buildNextSteps(parsedQuery, selectedItems);
  const dataLimitations = buildDataLimitations(parsedQuery, selectedItems);
  const markdown = renderMarkdown(parsedQuery, selectedItems, quickTakeaways, crossPlatformTrends, nextSteps, dataLimitations);

  return {
    parsedQuery,
    selectedItems,
    quickTakeaways,
    crossPlatformTrends,
    nextSteps,
    dataLimitations,
    markdown
  };
}

function buildQuickTakeaways(parsed: ParsedQuery, items: ScoredItem[]): string[] {
  if (items.length === 0) {
    return [
      "没有足够高质量候选内容，当前结果不应被扩写成真实社区结论。",
      "数据不可用时优先调整关键词、时间范围或授权平台，而不是补写缺失数据。",
      "离线示例仅验证流程和报告格式。"
    ];
  }

  const strongest = items[0];
  const platforms = unique(items.map((item) => platformLabel(item.platform)));
  const signalTypes = unique(items.flatMap((item) => item.comments.map((comment) => signalLabel(comment.signalType))));
  const modeNote =
    parsed.analysisMode === "investment_research"
      ? "当前只适合做社区情绪、观点分歧和风险观察，不构成投资建议。"
      : parsed.analysisMode === "product_research"
        ? "当前更适合提炼用户痛点、功能需求、竞品替代和产品切入点。"
      : "当前适合提炼产品机会、开发者反馈和内容选题角度。";

  return [
    `最高分信号来自 ${platformLabel(strongest.platform)}：${cleanText(strongest.title)}，总分 ${strongest.scores.total}/100。`,
    `入选内容实际覆盖 ${platforms.join("、")}，主要评论信号包括 ${signalTypes.slice(0, 4).join("、") || "数据不可用"}。`,
    modeNote
  ];
}

function buildCrossPlatformTrends(items: ScoredItem[]): string[] {
  if (items.length === 0) {
    return ["没有足够高质量候选内容，无法形成可靠跨平台趋势。"];
  }
  const tags = topTerms(items.flatMap((item) => item.tags ?? []), 5);
  const platforms = unique(items.map((item) => platformLabel(item.platform)));
  const signals = unique(items.flatMap((item) => item.comments.map((comment) => signalLabel(comment.signalType))));
  const strongestTerms = tags.length ? tags.join("、") : "数据不可用";

  return [
    `共同话题：${strongestTerms} 在 ${platforms.join("、")} 的入选示例中重复出现。`,
    `观点分歧/评论信号：${signals.slice(0, 5).join("、") || "数据不可用"}。`,
    `需要继续观察的信号：${tags[0] ?? "核心关键词"} 是否继续在多个平台同步出现。`
  ];
}

function buildNextSteps(parsed: ParsedQuery, items: ScoredItem[]): string[] {
  if (items.length === 0) {
    return ["可以调整关键词、扩大时间范围，或在后续阶段加入真实 API adapter。"];
  }
  return [
    ...modeSpecificNextSteps(parsed),
    "需要实际社区信息时运行 live 模式，并复核原始来源。",
    "保留数据限制和来源复查字段，避免把示例信号误读为真实趋势。"
  ];
}

function modeSpecificNextSteps(parsed: ParsedQuery): string[] {
  if (parsed.analysisMode === "investment_research") {
    return [
      `继续追踪关键词：${parsed.keywords.slice(0, 5).join("、")}。`,
      "继续观察财报相关社区情绪、预期差、风险叙事和观点分歧，不输出交易动作。"
    ];
  }
  if (parsed.analysisMode === "product_research") {
    return [
      `继续追踪关键词：${parsed.keywords.slice(0, 5).join("、")}。`,
      "优先整理用户痛点、功能需求、竞品替代和价格/迁移阻力。"
    ];
  }
  return [
    `继续追踪关键词：${parsed.keywords.slice(0, 5).join("、")}。`,
    "继续比较竞品、GitHub 活跃度、开发者评论和采用阻力。"
  ];
}

function buildDataLimitations(parsed: ParsedQuery, items: ScoredItem[]): string[] {
  const limitations = [
    "mock 数据来源：本报告使用本地 JSON mock 候选，原始数据均带 isMockData=true 与 dataLabel 字段。",
    "未接入真实 API，未请求 API key，未执行浏览器抓取。",
    `本次离线示例仅覆盖 ${parsed.platforms.map(platformLabel).join("、")} 的本地样本；Reddit、Product Hunt、X、Discord 的真实接口需要相应授权；Discord 仅限明确授权频道。`,
    "互动数据、发布时间和评论观点均来自离线 mock 文件，不代表真实平台数据。"
  ];

  if (items.length === 0) {
    limitations.push("数据不可用：没有候选内容进入报告。");
  }
  if (items.length > 0 && items.length < Math.min(parsed.maxItems, 10)) {
    limitations.push(`筛选说明：目标最多 ${Math.min(parsed.maxItems, 10)} 条，实际入选 ${items.length} 条；其余候选未达到相关性或质量门槛。`);
  }
  const missingPlatforms = parsed.platforms.filter(
    (platform) => !items.some((item) => item.platform === platform)
  );
  for (const platform of missingPlatforms) {
    limitations.push(`${platformLabel(platform)} 未入选：候选内容相关性、讨论质量或时效性未进入本次 Top ${items.length || Math.min(parsed.maxItems, 10)}。`);
  }
  if (parsed.analysisMode === "investment_research") {
    limitations.push("社区讨论存在样本偏差、平台偏差、营销内容和过度解读风险；不构成投资建议。");
  }
  return limitations;
}

function renderMarkdown(
  parsed: ParsedQuery,
  items: ScoredItem[],
  quickTakeaways: string[],
  crossPlatformTrends: string[],
  nextSteps: string[],
  dataLimitations: string[]
): string {
  const itemSections =
    items.length > 0
      ? items.map((item, index) => renderItem(item, index + 1, parsed)).join("\n\n")
      : "没有足够高质量候选内容。\n\n- 数据不可用：当前没有候选内容可供筛选。\n- 可以调整关键词、扩大时间范围，或在后续阶段接入授权数据源。";
  const fetchedAt = new Date().toISOString();

  return `# Community Signal Brief

## 0. 数据来源状态

本次是否使用真实 API：${usesRealApi(items) ? "是" : "否"}
是否使用 mock 数据：${items.some((item) => item.sourceStatus === "mock_data") ? "是" : "否"}
是否所有链接可复查：${allItemsHaveReviewableLinks(items) ? "是" : "否"}
可能不完整的平台数据：${parsed.platforms.map(platformLabel).join("、")}

说明：source_status 取值为 verified_api、verified_url、search_result、mock_data、unverified。mock:// 链接仅指向本地示例记录，不是真实平台链接。

## 0. 用户指令

原始指令：${parsed.originalQuery}
解析主题：${parsed.topic}
时间范围：${parsed.timeRange}
覆盖平台：${parsed.platforms.map(platformLabel).join("、")}
最终筛选数量：${items.length}
目标筛选数量：${Math.min(parsed.maxItems, 10)}
抓取时间：${fetchedAt}

说明：本报告基于离线 mock 示例数据生成，仅用于验证流程，不代表真实平台热度。

## 1. 快速结论

${quickTakeaways.map((item) => `- ${item}`).join("\n")}

## 2. 入选内容

${itemSections}

## 3. 跨平台趋势总结

${crossPlatformTrends.map((item) => `- ${item}`).join("\n")}

## 4. 下一步建议

${nextSteps.map((item) => `- ${item}`).join("\n")}

## 5. 数据限制说明

${dataLimitations.map((item) => `- ${item}`).join("\n")}
`;
}

function renderItem(item: ScoredItem, index: number, parsed?: ParsedQuery): string {
  const titlePrefix = item.sourceStatus === "mock_data" ? "[Mock] " : "";

  return `### 内容 ${index}：${titlePrefix}${cleanText(item.title)}

- 标题：${cleanText(item.title)}
- 平台：${platformLabel(item.platform)}
- 来源链接：${sourceLink(item)}
- 来源状态：${item.sourceStatus}（抓取时间：${item.fetchedAt}）
- 发布时间：${item.publishedAt ?? "数据不可用"}
- 核心数据：${formatMetrics(item)}
- 一句话摘要：${cleanText(item.summary)}
- 为什么火：${whyItMatters(item)}
- 代表性观点：${formatComments(item)}
- AI 分析：${itemAnalysis(item, parsed)}
- 对我的启发：${itemImplication(item, parsed)}
- 风险/不确定性：${riskNote(item)}`;
}

function whyItMatters(item: ScoredItem): string {
  const commentSignals = unique(item.comments.map((comment) => signalLabel(comment.signalType))).join("、") || "数据不可用";
  return `总分 ${item.scores.total}/100；${item.scoreRationale.join("；")}；代表性评论信号：${commentSignals}。`;
}

function itemAnalysis(item: ScoredItem, parsed?: ParsedQuery): string {
  const tags = (item.tags ?? []).slice(0, 4).join("、") || "数据不可用";
  const signals = unique(item.comments.map((comment) => signalLabel(comment.signalType)));

  if (parsed?.analysisMode === "investment_research") {
    const coreDebate = signals.includes("反方/风险观点")
      ? "核心争议集中在财报叙事能否延续、预期差是否扩大，以及风险因素是否已被市场情绪消化。"
      : "核心争议集中在财报后的市场情绪是否过热，以及社区讨论是否过度外推单一信号。";
    const watchReason =
      tags === "数据不可用"
        ? "继续观察财报后叙事变化、风险点和观点分歧。"
        : `继续观察 ${tags} 这些主题是否伴随财报叙事、预期差和市场情绪变化反复出现。`;
    return `核心争议：${coreDebate} 社区情绪：社区更关注预期差、市场情绪和风险叙事。 支持/谨慎观点：${formatComments(item)} 为什么值得继续观察：${watchReason}`;
  }

  if (parsed?.analysisMode === "product_research") {
    const coreDebate = signals.includes("用户痛点")
      ? "核心争议集中在用户痛点是否足够强、现有替代方案是否已经满足需求，以及新工具能否形成清晰差异化。"
      : "核心争议集中在功能需求是否真实存在，以及用户是否愿意为迁移和学习成本付费。";
    const watchReason =
      tags === "数据不可用"
        ? "继续观察用户痛点、功能需求和竞品反馈是否重复出现。"
        : `继续观察 ${tags} 这些主题背后的用户痛点、功能需求、竞品反馈和替代方案。`;
    return `核心争议：${coreDebate} 社区情绪：社区更关注上手成本、价格阻力、迁移成本和替代工具。 支持/谨慎观点：${formatComments(item)} 为什么值得继续观察：${watchReason}`;
  }

  if (parsed?.analysisMode === "dev_tool_research" || parsed?.analysisMode === "ai_trend") {
    const coreDebate = signals.includes("反方/风险观点")
      ? "核心争议集中在 AI coding agent 是否真的能进入稳定开发流程，而不是只提升原型速度。"
      : signals.includes("用户痛点")
        ? "核心争议集中在效率提升是否足以覆盖工具迁移、review、测试和上下文管理成本。"
        : "核心争议集中在工具是否能从 demo 体验走向稳定的团队开发工作流。";
    const mood = signals.includes("技术细节")
      ? "社区情绪偏务实，重点关注 review burden、test gates、hidden bugs、context drift 和代码可审查性。"
      : "社区情绪仍在效率期待和维护风险之间摇摆。";
    const watchReason =
      tags === "数据不可用"
        ? "继续观察 review、测试、上下文漂移、替代工具和真实使用反馈是否反复出现。"
        : `继续观察 ${tags} 是否与 review、测试、context drift、local context、GitHub 活跃度和开发者采用阻力一起反复出现。`;
    return `核心争议：${coreDebate} 社区情绪：${mood} 支持/谨慎观点：${formatComments(item)} 为什么值得继续观察：${watchReason}`;
  }

  const coreDebate = signals.includes("用户痛点")
    ? "核心争议集中在需求是否真实、痛点是否高频，以及现有替代方案是否足够。"
    : "核心争议集中在热度背后的真实需求是否足够持续。";
  const mood = signals.includes("技术细节")
    ? "社区情绪更偏务实，关注可靠性、审查和落地成本。"
    : "社区情绪仍需要更多评论样本确认。";
  const watchReason = tags === "数据不可用" ? "后续应补充更完整标签和评论样本。" : `值得继续观察 ${tags} 这些主题是否反复出现。`;
  return `核心争议：${coreDebate} 社区情绪：${mood} 支持/谨慎观点：${formatComments(item)} 为什么值得继续观察：${watchReason}`;
}

function itemImplication(item: ScoredItem, parsed?: ParsedQuery): string {
  if (parsed?.analysisMode === "investment_research") {
    return "关注预期差、市场情绪是否过热、财报后叙事变化和风险点；只作为信息研究，不提供交易动作。";
  }
  if (parsed?.analysisMode === "product_research") {
    return "优先提炼用户痛点、功能需求、竞品反馈和替代方案，判断是否存在可落地的产品机会。";
  }
  return "关注开发者抱怨、替代品、功能需求和 GitHub 活跃度，用来判断 AI 工具趋势与竞品机会。";
}

function formatMetrics(item: ScoredItem): string {
  if (!canShowPreciseMetrics(item)) {
    return `${item.sourceStatus}：未验证互动数据，精确 points/stars/forks/comments 不输出。`;
  }

  const metrics = item.engagementMetrics;
  const parts = [
    metrics.points === undefined ? undefined : `points ${metrics.points}`,
    metrics.stars === undefined ? undefined : `stars ${metrics.stars}`,
    metrics.reactions === undefined ? undefined : `reactions ${metrics.reactions}`,
    metrics.commentsCount === undefined ? undefined : `comments ${metrics.commentsCount}`,
    metrics.forks === undefined ? undefined : `forks ${metrics.forks}`,
    metrics.openIssues === undefined ? undefined : `open issues ${metrics.openIssues}`
  ].filter(Boolean);
  return parts.length ? parts.join("，") : "数据不可用";
}

function canShowPreciseMetrics(item: ScoredItem): boolean {
  return item.sourceStatus === "verified_api" || item.sourceStatus === "verified_url";
}

function sourceLink(item: ScoredItem): string {
  return item.url.trim().length > 0 ? item.url : "需人工补充来源链接";
}

function riskNote(item: ScoredItem): string {
  if (item.sourceStatus === "mock_data") {
    return "mock_data 示例数据；未接入真实 API；互动数据不可用于真实判断。";
  }
  if (item.sourceStatus === "search_result" || item.sourceStatus === "unverified") {
    return `${item.sourceStatus}；只可作为线索，未验证前不输出精确互动数据。`;
  }
  return "来源已验证，但仍需注意平台样本偏差、评论偏差和抓取时间后的变化。";
}

function usesRealApi(items: ScoredItem[]): boolean {
  return items.some((item) => item.sourceStatus === "verified_api");
}

function allItemsHaveReviewableLinks(items: ScoredItem[]): boolean {
  return items.every((item) => item.url.trim().length > 0 || sourceLink(item) === "需人工补充来源链接");
}

function formatComments(item: ScoredItem): string {
  if (item.comments.length === 0) return "数据不可用";
  return item.comments
    .slice(0, 2)
    .map((comment) => `${signalLabel(comment.signalType)}: ${cleanText(comment.summary)}`)
    .join("；");
}

function platformLabel(platform: string): string {
  if (platform === "hacker_news") return "Hacker News";
  if (platform === "github") return "GitHub";
  if (platform === "devto") return "dev.to";
  return platform;
}

function signalLabel(signal: string): string {
  const labels: Record<string, string> = {
    supporting: "支持观点",
    opposing: "反方/风险观点",
    neutral: "中立观察",
    pain_point: "用户痛点",
    technical: "技术细节",
    market: "市场情绪"
  };
  return labels[signal] ?? signal;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function topTerms(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function cleanText(text: string): string {
  return text
    .replace(/^示例数据：/, "")
    .replace(/示例数据\s*/g, "")
    .trim();
}
