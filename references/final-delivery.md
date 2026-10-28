# 最终交付说明

版本：1.15.1。当前项目根目录是唯一源码；两个旧 Skill 路径仅作发现/兼容链接。已停止实时接收研究，收尾范围如下。

## 1.15.1维护修复

开发依赖审计0告警、211项应用测试和4项安装脚本回归通过；缓存分类计数修复及完整空用户安装验收通过。源码开发需要Node22.12+（22系列），编译入口仍为Node22+。证据见 `artifacts/dependency-fix/manifest.json`，公开摘要见 [安装实测](install-validation.md)。旧Spec 0.1.0验证只证明原功能合同，不替代本次维护证据。

## 原1.15.0新增

- 独立零绑定 profile；查看/设置规则与零网络 doctor。
- 作者、关键词、排除词、默认主题/语言/数量/时间；公开来源原质量门槛后、Top N 前筛选。
- Whop 只筛选展示，完整增量/去重保留；离线重筛 snapshot/delta/真实研究 JSON，不改 state。
- 白名单编译分发包，Node.js22+ 可直接运行本地命令；自然语言与 Whop 捕获分别需要 Codex、获准浏览器/成员访问。

使用见 [首次配置与规则](onboarding.md)。本轮技术验收绑定 Spec 0.1.0 与 `artifacts/onboarding-preferences/manifest.json`；final acceptance 仍待用户决定。

## 可以做什么

- 从 HN、GitHub、DEV、Product Hunt、X 的已获准来源筛选帖子、项目和有内容的评论，保留作者、链接、时间、互动和限制。默认中文、通常 2–3 条。Product Hunt/X 仍需要各使用者的授权，X 有付费门禁。
- 整理产品研究、开发工具、内容选题和投资相关的社区观点；逐条核验重要说法。社区观点不等于事实，也不转成下单指令。
- Whop 使用者绑定自己有权访问的原生频道，添加/查看/解除；最多 3 个页面。按需在授权浏览器读取，整理精华，保留来源并对重复/修改正文、来源失败和待处理增量作区分。
- 现有两个成员来源已通过有界采样与精华验证，共 47 条记录；同输入重复处理 0 新、47 相同。这些是此前固定样本，不代表当前实时内容或全天覆盖。AI for PROs 是历史讨论样本。

## 使用入口

向 Codex 提出：

- “用 community-signal-analyst 找近 7 天 Hacker News 和 GitHub 关于 AI coding 的高质量讨论。”
- “绑定这个 Whop 频道：<你有权限的完整频道 URL>。”
- “查看我的 Whop 绑定。” / “解除 <exp_频道ID> 的绑定。”
- “整理我绑定的 Whop 频道精华。”

命令在本项目根目录运行：

```bash
npm run live -- "找最近全平台（不含 Discord 和 Reddit）AI coding 讨论"
npm run whop:bind -- list --scope "/Users/ffq/Documents/aicoding项目/Community Signal Analyst/state/whop-scope.json"
```

Whop live API 适配器尚未验证，Whop 按需读取由 Skill 授权浏览器捕获后交给 `whop:digest` 处理；仅运行 `live` 不会自动完成浏览器采集。无 profile 的 digest 要求 `--scope`；带 profile 时采用其独立 scope/state，具体见 [绑定说明](whop-binding.md) 和 [按需整理流程](whop-daily.md)。新使用者选择独立 state/scope 路径，默认零绑定，不复制这里已有使用者的状态或密钥。

## 明确的交付边界

- Discord、Reddit：保留代码和历史证据，暂缓。
- Whop OAuth/API：保留离线测试过的实验，实际成员权限和消息读取未验证，不作为使用前提。
- 定时：现有 Whop 自动化 PAUSED；每日或每六小时运行需另行启用，并实际验证未来触发。本次不启用。
- 实时接收、指定作者发言触发、自动交易：未实现；用户已停止继续研究。没有完成业务注册、App 授权或 webhook 订阅。
- 浏览器读取有页面、登录、采样和平台许可边界；不得把当前按需验证扩展为已获准持续监控。

## 历史合并与恢复

活动版本沿用 1.14.0 的已有能力，以 1.14.1 收尾。旧 0.1.0 全目录保存在 `.history/community-signal-analyst/`，包括它独有的 mock 适配器、旧评分模块及测试，不参与当前运行。旧平台枚举/固定评分公式与当前已验证行为不兼容，未直接混入活动代码。所有文件迁移前后核对 SHA-256，没有删除旧内容。

`artifacts/final/migration.json` 记录原位置、精确清单、保护范围与恢复步骤；`artifacts/final/manifest.json` 关联验收标准、实际验证和收尾后的源码指纹。历史证据不改写成此次运行结果。技术收尾完成不代表用户最终接受已记录。
