# Report Template

Use this structure for the final answer unless the user requests another format.

```markdown
# Community Signal Brief

## 0. 用户指令

原始指令：{query}
解析主题：{topic}
时间范围：{time_range}
覆盖平台：{platforms}
最终筛选数量：{max_items}
抓取时间：{fetched_at}

## 1. 快速结论

- {最近最值得关注的内容}
- {信号最强的平台或社区}
- {主要情绪或观点分歧}
- {产品/投资/内容/AI 趋势启发}
- {关键不确定性}

## 2. 入选内容

### 内容 1：{title}

- 平台：{platform}
- 链接：{url}
- 作者/来源：{author}
- 发布时间：{published_at}
- 核心数据：{engagement_metrics}
- 一句话摘要：{one_sentence_summary}
- 详细摘要：{summary}
- 为什么值得关注：{why_it_matters}
- 代表性评论/观点：{comment_themes}
- AI 分析：{analysis}
- 对我的启发：{implications}
- 风险/不确定性：{risks}

### 内容 2：{title}

{same fields}

### 内容 3：{title}

{same fields}

## 3. 跨平台趋势总结

- 共同话题：{shared_themes}
- 观点分歧：{disagreements}
- 高频关键词：{keywords}
- 新出现的机会：{opportunities}
- 需要继续观察的信号：{watchlist}

## 4. 下一步建议

- {keywords_to_track}
- {platforms_to_add}
- {product_content_or_research_actions}
- {daily_or_weekly_followup_suggestion}

## 5. 数据限制说明

{api_limits}
{time_range_limits}
{keyword_limits}
{permission_limits}
{sample_bias}
```

Keep the brief concise. If fewer than 2 strong items exist, report fewer items and explain why.

When original-source reviews have been performed, include a claim-review section before data limitations: exact claim and post, primary source and its basis, supported/contradicted/inconclusive/unavailable assessment, short evidence, rationale, review/fetch times, method, and passage fingerprint. State that these are reviewer judgments applying only to listed claims. See `claim-verification.md` for the CLI input contract.
