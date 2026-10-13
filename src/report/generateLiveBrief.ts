import type { CommunitySignalBrief, ParsedQuery, Platform, RelatedSource, ScoredItem } from "../types/communitySignal.js";

const platformName = { hacker_news: "Hacker News", github: "GitHub", devto: "DEV", reddit: "Reddit", product_hunt: "Product Hunt", x: "X", discord: "Discord", whop: "Whop" };
const timeName = { recent_24h: "近 24 小时", recent_3d: "近 3 天", recent_7d: "近 7 天", recent_14d: "近 14 天", recent_30d: "近 30 天" };
const timeNameEn = { recent_24h: "past 24 hours", recent_3d: "past 3 days", recent_7d: "past 7 days", recent_14d: "past 14 days", recent_30d: "past 30 days" };
const contentName = { article: "文章", post: "帖子", repo: "仓库", issue: "Issue", discussion: "讨论" };

function safeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/[`*]/g, "\\$&").replace(/^>/, "\\>");
}

function sourceSnippet(value: string, maxWords: number, maxChars: number): string {
  const words = value.trim().split(/\s+/);
  const byWords = words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : value;
  return safeText(byWords.length > maxChars ? `${byWords.slice(0, maxChars).trimEnd()}…` : byWords);
}

function sourceLink(label: string, url: string): string {
  if (!/^https:\/\//i.test(url)) return safeText(label);
  return `[${safeText(label)}](<${url.replace(/>/g, "%3E")}>)`;
}

function metrics(item: ScoredItem, language: ParsedQuery["language"]): string {
  const m = item.engagementMetrics;
  const values = [
    m.points === undefined ? "" : `${m.points} ${item.platform === "product_hunt" ? "votes" : item.platform === "reddit" ? "score" : item.platform === "x" ? "likes" : "points"}`,
    m.stars === undefined ? "" : `${m.stars} stars`,
    m.reactions === undefined ? "" : `${m.reactions} ${item.platform === "x" ? "reposts" : (item.platform === "discord" || item.platform === "whop") ? "emoji reactions (not unique users)" : "reactions"}`,
    m.commentsCount === undefined ? "" : `${m.commentsCount} ${item.platform === "x" ? "replies" : "comments"}`,
    m.forks === undefined ? "" : `${m.forks} forks`
  ].filter(Boolean);
  return values.join(language === "en" ? "; " : "；") || (language === "en" ? "unavailable" : "数据不可用");
}

function xEvidence(item: ScoredItem, language: ParsedQuery["language"]): string {
  if (item.platform !== "x") return "";
  const en = language === "en";
  const links = item.citedUrls?.length
    ? item.citedUrls.map((url, index) => sourceLink(en ? `link ${index + 1}` : `链接 ${index + 1}`, url)).join(en ? ", " : "、")
    : en ? "none returned" : "接口未返回";
  return en
    ? `\n- Claim status at collection: the post was returned by the X API; its research figures and conclusions are author claims, not independently verified. Later claim reviews, if supplied, apply only to the listed claims.\n- Text field: ${item.textSource === "note_post" ? "long-form note_post" : "post text; may be truncated"}. Full available text is retained in JSON rawExcerpt.\n- Links supplied in the post (not checked during collection): ${links}`
    : `\n- 结论状态（采集时）：帖子由 X API 返回；其中的研究数字与结论仅为发帖者陈述，尚未独立核验。后续如有核验记录，仅适用于列出的具体说法。\n- 正文字段：${item.textSource === "note_post" ? "长文 note_post" : "普通帖子正文，可能截断"}；接口返回的可得正文保留在 JSON rawExcerpt。\n- 帖内链接（采集时未核验）：${links}`;
}

function discordEvidence(item: ScoredItem, language: ParsedQuery["language"]): string {
  if (item.platform !== "discord" || !item.discordContext) return "";
  const c = item.discordContext;
  const scope = `${c.guildId}/${c.channelId}${c.channelName ? ` (${safeText(c.channelName)})` : ""}`;
  return language === "en"
    ? `\n- Authorized scope: ${scope}; method: ${c.retrievalMethod}; message links require server permissions.\n- Sample: ${c.sampledMessages}/${c.messageLimit} latest channel messages; ${c.sampledReplyCount} retained direct replies, not the total reply count. No pagination or embedded parent-message import.${c.parentMessageId ? ` Parent ${c.parentMessageId} was not retained as a selected root; parent context is unavailable.` : ""}\n- Content: ${c.contentTruncated ? "clipped to 4,000 characters" : "API-returned text"}; API provenance does not verify authors' factual claims.`
    : `\n- 授权范围：${scope}；方法：${c.retrievalMethod}；消息链接需要服务器权限。\n- 采样：频道最新消息 ${c.sampledMessages}/${c.messageLimit} 条；保留 ${c.sampledReplyCount} 条直接回复，并非回复总数。未翻页、未导入嵌入的父消息正文。${c.parentMessageId ? ` 父消息 ${c.parentMessageId} 未保留为入选根消息，父上下文不可用。` : ""}\n- 正文：${c.contentTruncated ? "截取至 4,000 字符" : "API 返回文字"}；API 来源状态不代表作者说法经过事实核验。`;
}

function whopEvidence(item: ScoredItem, language: ParsedQuery["language"]): string {
  if (!item.whopContext) return "";
  const c = item.whopContext;
  return language === "en"
    ? `\n- Whop member scope: ${safeText(c.communityName)} / ${safeText(c.channelName ?? c.channelId)}; ${c.experienceId}; method: ${c.retrievalMethod}.\n- Sample: ${c.sampledMessages}/${c.messageLimit} latest messages; ${c.sampledReplyCount} direct replies, not the total. Older history ${c.hasMoreMessages ? "exists but was not fetched" : "was not indicated by this page"}.\n- Link opens the authorized channel, not the exact message; locate message ID ${item.id}. Membership is required. ${c.parentMessageId ? `Parent ${c.parentMessageId} context was not retained. ` : ""}API provenance does not verify author claims.`
    : `\n- Whop 成员范围：${safeText(c.communityName)} / ${safeText(c.channelName ?? c.channelId)}；${c.experienceId}；方法：${c.retrievalMethod}。\n- 采样：最新消息 ${c.sampledMessages}/${c.messageLimit} 条；${c.sampledReplyCount} 条直接回复，并非回复总数；${c.hasMoreMessages ? "还有更早历史，本轮未读取" : "该页未标记更多历史"}。\n- 链接为已授权频道入口，非精确消息定位；消息 ID：${item.id}。需要会员访问权。${c.parentMessageId ? `父消息 ${c.parentMessageId} 上下文未保留。` : ""}API 来源不代表作者说法已核实。`;
}

export function xReplyEvidence(item: ScoredItem, language: ParsedQuery["language"]): string {
  if (item.platform !== "x" || !item.replyCollectionStatus || item.replyCollectionStatus === "not_requested") return "";
  const en = language === "en";
  const browser = item.replySampleMethod === "browser_visible";
  const status = ({ no_visible_replies: browser ? en ? "page checked; no visible replies" : "已检查页面，未显示回复" : en ? "no visible replies; not queried" : "无可见回复，未查询", sampled: en ? "bounded direct-reply sample" : "取得有限直接回复样本", no_qualifying_replies: browser ? en ? "page checked; no qualifying direct reply visible" : "已检查页面，未显示符合门槛的直接回复" : en ? "searched; no qualifying direct reply returned" : "已查询，未取得符合门槛的直接回复", unavailable: en ? "reply evidence unavailable" : "回复证据不可用" })[item.replyCollectionStatus];
  const names = { workflow: en ? "workflow/review" : "工作流与审查", defects: en ? "defects/regressions" : "缺陷与回归", cost: en ? "cost/pricing" : "成本与价格", performance: en ? "performance/efficiency" : "性能与效率", security: en ? "security/privacy" : "安全与隐私", methodology: en ? "methodology/baseline" : "方法与比较基准" };
  const themes = (item.commentThemes ?? []).map((theme) => `${names[theme.topic]} (${theme.commentUrls.map((url, index) => sourceLink(en ? `comment ${index + 1}` : `原评论 ${index + 1}`, url)).join(en ? ", " : "、")})`).join(en ? "; " : "；");
  return en ? `\n- Reply coverage: ${status}${item.replySampleMethod ? `; method: ${item.replySampleMethod}` : ""}${item.replySampledAt ? `; checked: ${item.replySampledAt}` : ""}. Selection scores were computed before reply sampling.\n- Comment topics: ${themes || "no topic evidence"}. Keyword grouping only; read the linked comments to judge stance. No consensus or sentiment percentage is inferred.`
    : `\n- 回复覆盖：${status}${item.replySampleMethod ? `；方法：${item.replySampleMethod}` : ""}${item.replySampledAt ? `；核查时间：${item.replySampledAt}` : ""}；排序分在回复采样之前计算。\n- 评论主题：${themes || "没有可分组的主题证据"}。仅按关键词分组，观点立场须读取原评论判断；不推断共识或情绪比例。`;
}

/** Preserve a saved report while adding a later reply snapshot, without recollecting roots. */
export function appendXReplySample(brief: CommunitySignalBrief, selectedItems: ScoredItem[], limitations: string[]): CommunitySignalBrief {
  const en = brief.parsedQuery.language === "en";
  const withoutPrevious = brief.markdown.replace(/^## (?:Additional X reply sample|补充 X 回复样本)\n[\s\S]*?(?=^## |$(?![\s\S]))/gm, "");
  const seenUrls = new Set<string>();
  const sections = selectedItems.filter((item) => item.platform === "x").map((item, index) => {
    const comments = item.comments.map((comment) => {
      const url = comment.url ?? item.url;
      const alreadyQuoted = seenUrls.has(url) || withoutPrevious.includes(url);
      seenUrls.add(url);
      return `- ${sourceLink(en ? "original reply" : "原回复", url)}${alreadyQuoted ? "" : `: ${sourceSnippet(comment.summary, 20, 140)}`}${comment.fetchedAt ? ` (${comment.fetchedAt}; ${comment.retrievalMethod ?? "unavailable"})` : ""}`;
    }).join("\n");
    return `### ${index + 1}. ${sourceLink(item.title, item.url)}\n${xReplyEvidence(item, brief.parsedQuery.language)}\n\n${comments || (en ? "No qualifying reply evidence." : "没有符合门槛的回复证据。")}`;
  });
  const section = `\n## ${en ? "Additional X reply sample" : "补充 X 回复样本"}\n\n${en ? "This is a later bounded reply snapshot. Original post metrics and ranking are retained. Recommendations shown by X are not replies; quoted replies express their authors' views, not verified research findings." : "这是初次采集后的有限回复快照，保留原帖指标和排序。X 推荐内容不计入回复；引用评论表达评论者观点，不是经过核实的研究结论。"}\n\n${sections.join("\n\n")}\n\n${limitations.map((line) => `- ${line}`).join("\n")}\n`;
  const markdown = withoutPrevious
    .replaceAll("- Discussion evidence:", "- Discussion evidence at initial collection:")
    .replaceAll("- 讨论观点：", "- 初次采集的讨论观点：")
    .replaceAll("X reply counts are visible, but reply content was not fetched", "At initial collection, X reply counts were visible but reply content was not fetched")
    .replaceAll("X 仅取得回复数量，未抓取回复内容", "初次采集时 X 仅取得回复数量，未抓取回复内容");
  return { ...brief, selectedItems, dataLimitations: [...new Set([...brief.dataLimitations, ...limitations])], markdown: markdown.trimEnd() + "\n" + section };
}

function itemSection(item: ScoredItem, index: number, language: ParsedQuery["language"]): string {
  if (language === "en") {
    const comments = item.comments.slice(0, 2).map((comment) => `  - Excerpt: ${sourceSnippet(comment.summary, 20, 140)} (${sourceLink(comment.source === "whop" ? `channel; message ${comment.sourceMessageId ?? "unavailable"}` : "original comment", comment.url ?? item.url)})`).join("\n");
    return `### ${index + 1}. ${sourceLink(item.title, item.url)}

- Platform: ${platformName[item.platform]}; type: ${item.contentType}; ${item.contentType === "repo" ? "repository created" : "published"}: ${item.publishedAt ?? "unavailable"}; fetched: ${item.fetchedAt}
- Source status: ${item.sourceStatus}; source ID: ${safeText(item.id)}
- Author: ${safeText(item.author ?? "unavailable")}; engagement: ${metrics(item, language)}
- Source excerpt: ${sourceSnippet(item.summary, 25, 180)}${xEvidence(item, language)}${xReplyEvidence(item, language)}${discordEvidence(item, language)}${whopEvidence(item, language)}
- Selection: relevance ${item.scores.relevance}/100, heuristic overall score ${item.scores.total}/100; platform engagement scales differ.
- Discussion evidence: ${comments ? `\n${comments}` : "No quotable comments were retrieved."}
- Interpretation limit: ${item.comments.length ? "Check the original thread for context; one discussion does not represent the whole community." : "The item and visible engagement are verified, but community sentiment cannot be inferred."}`;
  }
  const comments = item.comments.slice(0, 2).map((comment) => `  - 摘录：${sourceSnippet(comment.summary, 20, 140)}（${sourceLink(comment.source === "whop" ? `频道；消息 ${comment.sourceMessageId ?? "数据不可用"}` : "原评论", comment.url ?? item.url)}）`).join("\n");
  return `### ${index + 1}. ${sourceLink(item.title, item.url)}

- 平台：${platformName[item.platform]}；类型：${contentName[item.contentType]}；${item.contentType === "repo" ? "仓库创建时间" : "发布时间"}：${item.publishedAt ?? "数据不可用"}；抓取时间：${item.fetchedAt}
- 来源状态：${item.sourceStatus}；来源 ID：${safeText(item.id)}
- 作者：${safeText(item.author ?? "数据不可用")}；互动数据：${metrics(item, language)}
- 来源摘录：${sourceSnippet(item.summary, 25, 180)}${xEvidence(item, language)}${xReplyEvidence(item, language)}${discordEvidence(item, language)}${whopEvidence(item, language)}
- 入选依据：相关度 ${item.scores.relevance}/100，启发式综合分 ${item.scores.total}/100；各平台互动口径不同。
- 讨论观点：${comments ? `\n${comments}` : "数据不可用；本次未取得可引用评论。"}
- 研究提示：${item.comments.length ? "可从原帖及评论核对具体观点；单条讨论不足以代表社区整体。" : "目前只能确认该内容及可见互动，不能推断社区态度。"}`;
}

export function generateLiveBrief(parsed: ParsedQuery, selected: ScoredItem[], limitations: string[], candidateCount: number, relatedSources: RelatedSource[] = [], queriedPlatforms: Platform[] = parsed.platforms): CommunitySignalBrief {
  const en = parsed.language === "en";
  const platforms = [...new Set(selected.map((item) => platformName[item.platform]))];
  const quickTakeaways = en
    ? selected.length
      ? [`From ${candidateCount} recent candidates, ${selected.length} met the evidence threshold (requested maximum: ${parsed.maxItems}).`, `Selected sources: ${platforms.join(", ")}. ${platforms.length > 1 ? "Engagement counts are not directly comparable across platforms." : "Engagement counts reflect only the fetched snapshot."}`, ...(selected.length < parsed.maxItems ? [candidateCount > selected.length ? "Other candidates did not meet the quality threshold or duplicated a selected project." : "The bounded sample contained no additional qualifying items."] : [])]
      : [queriedPlatforms.length ? "No verifiable item met the relevance threshold within the requested period and accessible sources." : "No requested platform could be queried; see access limitations below."]
    : selected.length
      ? [`在 ${candidateCount} 条近期候选中，目标最多 ${parsed.maxItems} 条，实际筛出 ${selected.length} 条。`, `入选来源：${platforms.join("、")}。${platforms.length > 1 ? "不同平台的互动数不能直接比较。" : "互动数仅反映抓取时的可见状态。"}`, ...(selected.length < parsed.maxItems ? [candidateCount > selected.length ? "其余候选未达质量门槛，或与已入选项目重复。" : "当前有界样本中没有更多符合条件的内容。"] : [])]
      : [queriedPlatforms.length ? "在可访问来源和指定时间内，没有找到达到相关性门槛的可核查内容。" : "本次未能查询指定平台；请看下方权限或接入限制。"];
  const crossPlatformTrends = [
    ...relatedSources.map((source) => {
      const selectedItem = selected.find((item) => item.id === source.selectedItemId);
      const first = selectedItem ? sourceLink(en ? "selected item" : "入选项", selectedItem.url) : en ? "selected item" : "入选项";
      const second = sourceLink(platformName[source.platform], source.url);
      if (source.reason === "shared_reference" && source.sharedReference) {
        const shared = sourceLink(en ? "same reference" : "同一链接", source.sharedReference);
        return en
          ? `${first} and ${second} point to the ${shared}. This is repeated coverage of one source, not independent verification of its claims.`
          : `${first} 与 ${second} 指向${shared}；这是同一来源的多平台传播，不能视为对其结论的独立核验。`;
      }
      return en
        ? `${first} and ${second} have strongly overlapping titles and were grouped as one lead. The project relationship needs human review; this is not independent verification.`
        : `${first} 与 ${second} 的标题高度相似，暂按一条线索去重；项目关系仍需人工复核，不构成独立核验。`;
    }),
    platforms.length >= 2
      ? en ? "Selected items span multiple platforms, but the sample only supports research leads, not a platform-wide trend claim." : "入选内容来自多个平台；样本量仅适合提出待核查线索，不能据此断言整体趋势。"
      : en ? "There is insufficient cross-platform evidence to assess a broader trend." : "本次没有足够的跨平台入选样本，无法判断跨平台趋势。"
  ];
  const nextSteps = selected.length
    ? [selected.every((item) => item.platform === "x")
      ? en ? `Review the original posts and any cited studies; track: ${parsed.keywords.slice(0, 5).join(", ")}.` : `继续核对原帖及其引用的研究，并追踪关键词：${parsed.keywords.slice(0, 5).join("、")}。`
      : en ? `Review the original items and comments; track: ${parsed.keywords.slice(0, 5).join(", ")}.` : `继续核对原帖与评论，并追踪关键词：${parsed.keywords.slice(0, 5).join("、")}。`]
    : [!queriedPlatforms.length
      ? en ? "Provide authorized access for the requested platform or choose an accessible source." : "可提供指定平台的合法访问凭据，或选择可访问的来源。"
      : en ? "Try a wider date range, different keywords, or specific community links." : "可以扩大时间范围、调整关键词，或提供具体社区链接。"];
  const sampleDescriptions = queriedPlatforms.map((platform) => ({
    hacker_news: en ? "HN Search and recent lists provide a bounded candidate sample; selected stories are checked against the official HN API" : "HN Search 与近期榜单只提供部分候选，入选帖经 HN 官方 API 回查",
    github: en ? "GitHub searches recently created repositories and issues" : "GitHub 取新建仓库与 issue 搜索结果",
    devto: en ? "DEV samples latest and recently popular articles" : "DEV 取最新与近期热门文章",
    reddit: en ? "Reddit OAuth searches a bounded recent post sample" : "Reddit OAuth 搜索有限的近期帖子样本",
    product_hunt: en ? "Product Hunt samples up to 50 recent launches" : "Product Hunt 采样最多 50 个近期发布",
    x: en ? "X recent search samples up to 10 posts from the past seven days" : "X 近期搜索最多采样过去七天的 10 条帖子",
    whop: en ? "Whop samples 50 latest messages per selected member chat (up to 3); member access remains subject to live authorization" : "Whop 最多读取 3 个选定会员聊天室各最新 50 条消息；实际访问取决于成员授权",
    discord: en ? "Discord samples 50 latest messages per explicitly authorized channel (up to 3), with direct replies from that page" : "Discord 最多取 3 个明确授权频道各最新 50 条消息及同批直接回复"
  })[platform]);
  const dataLimitations = [
    ...limitations,
    ...(queriedPlatforms.length ? [en ? `Coverage is bounded: ${sampleDescriptions.join("; ")}; this is not a full-platform search.` : `候选范围有限：${sampleDescriptions.join("；")}；不代表平台全量内容。`,
      queriedPlatforms.every((platform) => platform === "x")
        ? selected.some((item) => item.replyCollectionStatus && item.replyCollectionStatus !== "not_requested" && item.replyCollectionStatus !== "no_visible_replies")
          ? selected.some((item) => item.replySampleMethod === "browser_visible")
            ? en ? "X replies include a bounded browser-visible sample, not the entire thread. Recommendations, missing replies, nested conversations, and community sentiment shares are not inferred." : "X 回复包含浏览器可见的有限样本，不代表完整评论区；推荐帖不计入回复，未取得的回复、嵌套讨论和社区情绪比例均不推断。"
            : en ? "X direct replies are a bounded relevance-sorted sample, not the entire thread. Missing replies, nested conversations, and community sentiment shares are not inferred." : "X 直接回复仅为相关性排序的有限样本，不代表完整评论区；未取得的回复、嵌套讨论和社区情绪比例均不推断。"
          : en ? "X reply counts are visible, but reply content was not fetched; community opinions and trends are not inferred." : "X 仅取得回复数量，未抓取回复内容；不推断社区观点与趋势。"
        : en ? "Only a small number of accessible original comments are sampled where supported; missing opinions and trends are not inferred." : "支持评论读取的平台仅抽取少量可访问的原评论；未取得的观点与精确趋势均不推断。"] : []),
    ...(queriedPlatforms.includes("github") ? [en ? "GitHub stars and forks are cumulative at fetch time, not growth during the requested period." : "GitHub stars、forks 是抓取时的累计值，不代表指定时间内的增长。"] : []),
    ...(parsed.analysisMode === "investment_research" ? [en ? "Community discussions are biased samples. This report organizes information and is not investment advice." : "社区讨论有样本偏差；本报告仅整理信息，不构成投资建议。"] : [])
  ];
  const markdown = en ? `# Community Signal Brief

## Query

- Original request: ${safeText(parsed.originalQuery)}
- Topic: ${safeText(parsed.topic)}; period: ${timeNameEn[parsed.timeRange]}
- Requested platforms: ${parsed.platforms.length ? parsed.platforms.map((platform) => platformName[platform]).join(", ") : "none integrated"}
- Queried platforms: ${queriedPlatforms.length ? queriedPlatforms.map((platform) => platformName[platform]).join(", ") : "none"}
- Generated: ${new Date().toISOString()}
- Data status: ${queriedPlatforms.length ? "live official APIs; no mock data" : "not queried; no mock data"}

## Key findings

${quickTakeaways.map((line) => `- ${line}`).join("\n")}

## Selected items

${selected.length ? selected.map((item, index) => itemSection(item, index, parsed.language)).join("\n\n") : "No qualifying items."}

## Cross-platform assessment

${crossPlatformTrends.map((line) => `- ${line}`).join("\n")}

## Next step

${nextSteps.map((line) => `- ${line}`).join("\n")}

## Data limitations

${dataLimitations.map((line) => `- ${line}`).join("\n")}
` : `# Community Signal Brief

## 查询

- 原始指令：${safeText(parsed.originalQuery)}
- 主题：${safeText(parsed.topic)}；时间：${timeName[parsed.timeRange]}
- 请求平台：${parsed.platforms.length ? parsed.platforms.map((platform) => platformName[platform]).join("、") : "无已接入平台"}
- 实际查询平台：${queriedPlatforms.length ? queriedPlatforms.map((platform) => platformName[platform]).join("、") : "无"}
- 生成时间：${new Date().toISOString()}
- 数据状态：${queriedPlatforms.length ? "真实官方 API（需权限的平台仅在授权时查询）；无 mock 数据" : "未查询；无 mock 数据"}

## 快速结论

${quickTakeaways.map((line) => `- ${line}`).join("\n")}

## 入选内容

${selected.length ? selected.map((item, index) => itemSection(item, index, parsed.language)).join("\n\n") : "没有符合条件的内容。"}

## 跨平台判断

${crossPlatformTrends.map((line) => `- ${line}`).join("\n")}

## 下一步

${nextSteps.map((line) => `- ${line}`).join("\n")}

## 数据限制

${dataLimitations.map((line) => `- ${line}`).join("\n")}
`;
  return { parsedQuery: parsed, queriedPlatforms, selectedItems: selected, quickTakeaways, crossPlatformTrends, nextSteps, dataLimitations, markdown };
}
