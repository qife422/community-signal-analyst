## 当前收尾验收（1.14.1）

迁移后在当前项目根目录执行类型检查、构建和完整测试：24 文件 / 196 项通过，旧档案测试没有被收集。生产 src/tests/mock-data/agents 的 62 个文件与迁移前一致。两处旧入口已解析到当前根目录；旧版完整 1,115 项清单和原有 132 项证据/运行状态/自动化配置校验一致。

编译后的绑定 CLI 成功只读列出范围；在系统临时目录对此前 47 条成员样本处理两次，首次 47 条、重复 0 新 / 47 相同，fetch 被禁止。此为迁移和固定输入回归，不是新的实时读取或自动触发验收。

Skill frontmatter/name/description 和未完成占位符人工程序检查通过。官方 quick_validate.py 在系统和内置 Python 都因缺少 PyYAML 不能启动，未安装依赖；不能声称官方校验器通过。完整结果、命令、迁移与源指纹见 `artifacts/final/manifest.json`。

以下保留历史各阶段验收记录，当前交付边界见 `references/final-delivery.md`。

## 当前绑定管理验收（1.14.0）

新增使用者自行绑定的 add/list/remove 入口及 Skill 自然语言路由。24 文件/196 项固定响应与本地回归、类型检查、构建通过；新增15项覆盖 URL/凭据参数拒绝、重复和冲突绑定、3频道容量、解除最后一项、重新绑定保留历史去重、损坏/符号链接/现有锁保护，以及零网络的文件操作。所有摘要 CLI 单/多来源都必须提供当前绑定范围；空范围和解除来源均拒绝，不消费去重状态。

实际编译 CLI 完成12步添加/查看/解除与处理验收，复用已封存的47条真实浏览器样本，不是一次新抓取。临时配置与状态独立，现有 operational scope、47条状态与 PAUSED 自动化文件 SHA-256 不变。证据见 workspace `artifacts/whop-bind/manifest.json`；没有新社区加入或新的 API 授权，原有浏览器范围能力保留。用户已停止继续免费社区筛选，当前产品方案为各使用者自行选择频道。

## 历史两社区验收（1.13.0）

## 当前成员多来源验收（1.13.0）

当前范围 HN/GitHub/DEV/Product Hunt/X/Whop；Discord 与 Reddit 暂缓，自动化关闭。明确排除二者的真实模式入口使用合成凭据/开关回归，验证没有请求二者。Whop 多来源回归检查精确范围、相同 ID 的来源隔离、正文相同的归组与历史出处、不同观点不误合并、旧状态迁移、部分失败不推进水位、缺失来源标记、无 ID 交集的旧快照拒绝、成功空页面与失败区别。23 文件/181 项测试、类型检查、构建通过；实际 CLI 检查另见 artifacts/whop-multi/validation.json。

原选定社区的独立刷新与增量已验证；用户委托选择并确认免费加入后，现另有 AI for PROs 的真实聊天样本。两个社区合并处理 7+40 条，保存语义精华，实际编译 CLI 首次 40 新/7 相同、同样本本地重放 0 新/47 相同；后者不是独立浏览器轮询。50 聊天节点的 10 条排除原因有清单。源码/测试/配置 57 个 baseline 指纹不变，沿用 181 项既有回归，无需重复付费 X 或暂缓平台。实际命令、输入、结果与当前验收见 artifacts/whop-member；API、未来无人值守和全日覆盖未验证。

## 历史 Whop 日常模式增量验收（1.12.0）

独立刷新指定会员页面并保存真实采样，再对操作状态执行增量：重复正文 0 新/7 相同。`--delta` 在状态提交前保存原文；实际 CLI 验证首次本地处理、重复处理后旧 delta 仍可恢复、已有 delta 拒绝且状态不变、delta 写入失败且状态不消费。23 文件/166 项回归、类型检查与构建通过。真实新增帖子、下一次定时触发、第二社区、完整全日覆盖和 OAuth/API 未验证；不得用离线回放证明这些能力。

# Community Signal Analyst 验收计划

## 当前范围

真实模式使用公开 Hacker News、GitHub、DEV 接口；Reddit 仅在当前用途获准、提供 token 与 User-Agent 时使用只读接口，Product Hunt 需要有权使用的 token。X 需 Bearer Token 和显式付费读取开关；已完成一次质量门禁的真实端到端请求，并对后续报告措辞修正做离线回归。离线 mock 模式只用于回归测试。当前 skill 路径为 `~/.codex/skills/community-signal-analyst/`。

## 必须通过

1. `npm run typecheck` 与 `npm test` 通过。
2. 真实模式的选中项只来自实际成功获取的公开 API 响应；包含可打开的 HTTPS 来源、时间戳和来源状态，不含 mock URL。
3. 指定的时间范围被硬性执行；旧内容不能靠高互动进入报告。
4. 用户明确指定平台时只查询指定平台；Reddit 未获当前用途批准或缺 token/User-Agent、Product Hunt 缺 token、X 缺付费读取开关或 token 时不发请求并报告权限限制，Discord 缺启用开关、Bot Token 或有效授权频道范围时不发请求；服务器或类型不符时不读消息。默认 3 条，明确数量最多 10 条；结果不足时少报。
5. 接口报错、无结果、无评论、缺失指标时准确说明，不填造内容或观点。
6. 研究结论能追溯到原帖与原评论；同一项目跨平台出现时只占一个名额，保留补充链接；样本不足时不宣称整体趋势。
7. 投资相关查询只描述社区情绪、分歧和风险，不给交易指令。
8. `--demo` 明确显示离线示例；默认真实模式不引用 mock 数据。`--json` 可导出结构化证据。明确要求英文时报告与限制说明使用英文。
9. `--history` 仅在显式指定文件且有入选来源时保存快照；只比较相同查询的同一来源同一指标。首份快照、无重叠来源均不声称增长，超过容量阈值时停止追加且不删除旧记录。

10. X 根帖只执行一次最多 10 条的相关性搜索；具体工具使用具体名称。回复、转发、空泛帖与推广不能入选；有方法与结果的研究或第一手经验可入选。点赞计入互动分，无评论时讨论质量为零；“热门”请求需要可见互动。
11. X 接口提供长文 `note_post`、作者和链接时，在同一请求中保存可得正文、作者与最多 5 个 HTTPS 帖内链接；报告明确这些链接未核验，不能把 API 已获取帖子等同于原始研究已核实。
12. 固定 X 质量评测集须报告误选、漏选、precision 和 recall，并对已标注案例零回归；固定样本内分数不得宣称为真实平台上的总体准确率。新发现的 Bad Case 应先归类，再加入改写后的测试样本。
13. 跨平台去重优先使用可规范化的共同项目或原始链接，保留次级来源；标题高度相似只能作为待人工复核的去重线索。多个平台转述同一链接不得写成对结论的独立核验，同仓库不同 issue 不得被合并。
14. 原始资料核验只作用于具体说法；四种判断状态必须区分。记录匹配入选来源的 platform/ID/URL，具体说法须在捕获正文中；除不可访问外，摘录须存在于原文片段且 SHA-256 匹配，时间须有效有序。错配、冲突和容量超限停止导入。CLI 不自动判断语义真伪，不能将整个帖子或未核验说法标为已核实。
15. `--verify-brief <live-json> --verification <reviews-json>` 可给已保存的真实报告补充核验，零采集请求，不接受 mock，不与新查询或历史快照同用；更新核验部分保留数据限制和历史部分。无显式 `--out` 不写结果。

16. X 回复仅在额外回复开关、付费读取开关与 token 均存在时请求；一次搜索最多 10 条、最多 3 个根帖、每帖最多 3 条，时间与父帖/会话一致。排除推荐、嵌套、转发、自回、重复和低质量回复。失败不重试，不补造评论；根帖排序分保留，关键词主题不推断情绪、共识或支持率。
17. `--reply-brief` 仅补读已有真实报告的回复，可同时导入核验记录；无额外授权零请求。浏览器可见回复须单独记录获取方式和时间，不能伪装成 API 结果。

## 验证方法

- 使用 `tests/live.test.ts`、`tests/authorized.test.ts`、`tests/x.test.ts` 的固定 API 响应验证时间过滤、GitHub issue、Reddit 与 Product Hunt 授权分支、X 零请求门禁、单次 10 条上限与质量门禁、原评论链接、跨平台去重和失败状态。
- 使用 `tests/history.test.ts` 验证同源指标变化和损坏文件保护。
- 使用 `tests/x-quality-eval.test.ts` 评测 `tests/fixtures/xQualityCases.ts` 中的改写与合成案例，覆盖开发工具、产品反馈、财报、中文经验帖、推广、口号与热度门槛。固定输入不保存真实 X 帖子全文；测试运行只打印结果，不产生大型数据目录。
- 使用 `tests/corroboration.test.ts` 与 `tests/live.test.ts` 的固定响应验证共同链接、HN 外链、同项目多平台去重、泛主题标题不误合并、同仓库不同 issue 独立保留及报告措辞。测试不访问付费接口。
- 使用 `tests/verification.test.ts` 验证逐条记录、四种状态、来源/摘录/指纹/时间拒绝分支、集合替换、数据限制与历史保留、容量边界及零网络导入；样本均为合成，不宣称已核验真实研究。编译后运行离线 CLI，禁止 fetch，验证 JSON 与 Markdown 输出入口。
- 使用 `tests/x-replies.test.ts` 验证零请求门禁、父帖/会话、时间、去重、推广和空泛过滤、请求与存储上限、429 零重试、保留初筛分、主题原链接及离线报告补充。
- 固定输入记录：`tests/fixtures/xQualityCases.ts` 共 24 例（11 条应保留、13 条应剔除），来源是既有真实测试中观察到的错误类型与专门构造的边界案例，文字均经改写或合成。SHA-256：`bc38cf6fdda71c1f008d8574d97acd2e0e8c8146cc16b0eb1a21e1df19837f0b`。执行 `npx vitest run tests/x-quality-eval.test.ts`，验收该固定集无误选和漏选；每次修改固定输入应同步更新此指纹。它是回归输入，不是平台总体准确率的正式证据。
- 使用现有离线回归测试验证评分、格式与禁止编造等约束。时间敏感测试固定时钟。
- 用一条真实查询人工检查入选链接、实际相关性、评论质量和限制说明。真实平台内容会变化，不把具体标题或互动数写成稳定断言。

## X 验收结果与边界

1.8.0 完成根帖搜索、信息量门禁、作者与长文证据、原文核验记录、可选直接回复、主题索引、中英文报告和已保存报告补充。原文阅读与语义判断由 Codex 在具体研究任务中完成；CLI 校验归属、时间、摘录和指纹。用户无需手写 JSON 或逐阶段确认继续。

真实工作流验收复用既有 X API 取得的 3 条帖子，实际阅读两篇作者论文和 Hermes 第一手复盘，核对 8 条具体说法（7 支持、1 反驳），并在获准 Chrome 中读取 1 条有内容的直接回复。发现的具体错误是把统计优势比 1.62 写成发生率倍数；论文支持修复更频繁的方向，但指标须纠正。推荐帖、引用帖和垃圾回复不进入样本。

正式证据位于 `/Users/ffq/Documents/aicoding项目/Community Signal Analyst/artifacts/x/`：`manifest.json` 记录来源、方法、验收标准、文件清单、SHA-256、版本与容量；`brief.md`/`brief.json` 保留浏览器阶段报告；`api-brief.md`/`api-brief.json` 是付费补测后的最新报告；`api-response.json` 保存解析后的真实响应，`api-test.json` 保存请求次数、HTTP 状态与检查结果。原始采集快照不覆盖，回复获取时间不替换根帖互动快照时间。保存的原文片段是核验指纹输入，不代表独立复现研究。证据仅证明这一有界样本工作流可运行，不代表全站准确率。

根帖质量门禁与长文/作者字段已在此前真实付费请求中验收；1.5.0 后的门禁调整和 1.8.0 API 回复适配器通过固定响应回归及下述真实付费补测。补测已在用户明确付费授权后完成一次真实 X 回复请求：HTTP 200，返回 3 条，修正返工讨论漏筛后最终保留 2 条直接回复、排除 1 条垃圾回复。修正通过同一已保存真实响应离线重放，不再付费；93 项回归测试通过。原 API 获取时间在重放中固定保留，初次保留 1 条的处理结果也记录在 `api-test.json`。一次最多 10 条回复可能不足，完整语义主题聚类与任意来源的自动事实判定不属于当前能力。

## 其他平台边界

Discord 已接入 Bot REST API v10 与统一入口；已在单一明确授权的自建测试频道补测，两次 GET 均 HTTP 200，普通非提及消息正文可读。该消息明确标为验收样例，不是社区意见。统一入口将其排除在研究入选项之外；同一保存响应的零网络适配器回放验证归一化。初始要求测试样例入选的失败预期保留，不修改生产门槛。Bot 仅有查看/历史权限，默认身份组无继承写入权限。真实直接回复没有覆盖，固定响应继续覆盖范围校验、消息采样、直接回复、权限/容量故障及中英文报告。Product Hunt 已用有权使用的 token 完成真实发布与评论端到端验收。Reddit 的个人非商业研究不符合现有研究者计划资格，不能用普通 OAuth 应用代替研究授权；该适配器仅保留给将来获得明确适用许可的非研究用途。

### 付费补测复现边界

`paid-test.mjs` 限制一次最多 10 条的真实请求，已有付费证据时拒绝重复请求；`replay-api.mjs` 只读取保存的响应，零外发请求，时间固定为原接口获取时间。验收方法、来源与指纹已纳入同一 manifest。API 调用次数不能直接换算账单金额；实际费用以 X 账单为准。


## 1.9.0 七平台联合验收

当前 1.9.1 交付范围按用户要求排除 Reddit，见 `references/delivery-status.json`。下列 1.9.0 记录保留为历史快照。1.9.1 新增六平台/Reddit 排除的解析与零外发门禁回归；完整 20 个文件、124 项测试以及类型检查、构建通过。验收方法与当前进度记录于工作区 `artifacts/delivery/`。Discord 的最终真实讨论和不同作者直接回复验收需要有权访问的真实来源；已有测试样例不能补足该条件，完成状态保持待验证。

全部适配器接线后统一执行类型检查、构建和完整回归：20 个测试文件、115 项测试通过，Skill 格式校验通过。`tests/platforms.test.ts` 在同一次运行中覆盖七个平台的官方 API 响应形状、统一筛选、去重和报告；另检查未授权平台不发请求、不被记作已查询。响应为固定合成数据，所有 fetch 都被替换，未使用真实凭据或发起付费请求。

Discord 新增验收：1–3 个频道范围先整体校验；元数据服务器和类型不符时不读历史；最多 50 条消息、3 条直接回复；排除跨频道/服务器引用、转发、机器人、推广、旧/未来/无效日期；未知父消息不额外读取；正文及回复缺失不推断无讨论；401/429 停止余下频道，403 保留健康频道；1 MB 流式响应限制、禁止重定向；报告标记权限和表情计数口径。

五平台真实联合验收保留在 `artifacts/online/`，Discord 的两次真实读取及离线响应回放补测保留在 `artifacts/discord/`。综合记录覆盖六个平台的不同时点访问，不能宣称六平台同轮或七平台在线联测。Reddit 当前研究用途未获准，保留跳过门禁。本次 Discord 补测没有追加 X 请求，生产源码与此前 115 项回归的基线一致；文档更新单独记录。完整回归结果与方法仍见 `artifacts/platforms/manifest.json`，它是较早代码验收快照；`artifacts/x/manifest.json` 保留 1.8.0 快照，`artifacts/online/manifest.json` 保留当时缺 Discord 配置的五平台快照，均不改写历史状态。最新综合状态与本次标准、清单、来源指纹见 `artifacts/discord/manifest.json`。


## 1.10.0 Whop 试验性成员接入

重点改为 Whop，保留 Discord 既有成功；Reddit 暂缓。新增 18 项 Whop 采集测试和 11 项 OAuth 测试；22 文件、153 项完整固定响应回归通过。覆盖 S256 PKCE、最小 chat:read、回调 state/origin/时效、拒绝授权、0600 凭据、过期跳过与刷新轮换，及选定范围、元数据匹配、有界消息、直接回复归属、日期/推广/重复排除、容量与 HTTP 故障、同频道讨论去重和中英文报告。所有 fetch 为固定合成响应，真实 Whop 成员授权/跨社区访问未验收。未创建定时采集；原始 Discord 18 项回归继续通过。正式代码回归快照见工作区 artifacts/whop/manifest.json，不能替代真实成员读取证据。
# Whop selected-source snapshot processing (1.11.0)

23 test files / 166 fixed-response tests pass, with typecheck and build. The new Whop experience lookup is covered for success, wrong resource/experience and incorrect selected URL rejection before credentials are sent. Nine browser digest cases cover selected URL/experience scope, exact IDs/body bounds, displayed-date honesty, pinned/short classification, author/body deduplication independent of relative date changes, body edits, source isolation, stale/corrupt/full state, and keeping financial execution fragments only in raw evidence.

The user's exact seven-post member-page capture is processed through the compiled CLI with fetch prohibited: first pass 7 records; same capture repeat 0 records / 7 unchanged. This is real source capture plus local processing, not mocked community text, but does not prove live polling, OAuth/API access, a second community or unattended ingestion. See workspace artifacts/whop-digest/manifest.json. Earlier artifacts/whop and artifacts/whop-source snapshots remain preserved. Operational state is separate from formal evidence.

## Spec 0.1.0 新增验收

运行 typecheck、build、全部 Vitest；profile/preferences/profile-whop 测试对应 AC-03/04/06–11。用 `python3 scripts/verify_distribution.py --zip <绝对ZIP路径>` 在含空格临时目录禁止 fetch、无 node_modules，核对清单/hash并运行已编译 init/show/set/doctor/digest/preview，对应 AC-01/02/05/10。自然语言五类路由作人工文档复核，非外部用户 Codex 实装验收。保护清单及容量由本轮 manifest 固定，旧线上证据不改写为新请求。
