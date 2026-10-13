# Community Signal Analyst

社区信号分析器：把公开社区讨论、项目和评论，以及自己有权访问的 Whop 频道，整理成带出处、筛选依据和限制说明的研究报告。

**版本：1.15.0 · Node.js 22+ · 公开展示与源码备份**

当前版本可用于社区研究、个人关注规则与 Whop 按需整理。后续功能继续迭代，实际改动与验证结果见 [更新记录](CHANGELOG.md)。

## 这个 Skill 能做什么

| 功能 | 实际行为 |
|---|---|
| 社区研究 | 按主题、时间、平台和数量筛选 HN、GitHub、DEV 的讨论/项目，保留原链接、作者、时间和互动指标 |
| 授权来源 | Product Hunt/X 使用各使用者自己的授权；X 保留明确的付费读取门禁 |
| Whop 按需整理 | 自己绑定最多3个有成员访问权限的原生频道，在授权浏览器只读捕获后提取精华；不发送频道消息 |
| 独立用户配置 | 初始化自己的 profile、空 scope 与私有 reports，默认中文、近7天、3条、HN/GitHub/DEV |
| 个人关注规则 | 精确匹配采集到的作者字段，按关键词包含/排除，保存默认主题、语言、时间范围和数量 |
| 可解释筛选 | 同规则条件 AND、规则间 OR、排除词优先；公开来源先通过原质量门槛，筛选再发生在 Top N 前 |
| Whop 增量与去重 | 完整增量/state 和展示筛选分开；区分首次观察、正文变化、已处理、来源失败；短更新单列 |
| 离线重筛 | 对已有 snapshot/delta/真实研究 JSON 用新规则再筛选；不请求网络、不修改去重状态 |
| 原始说法核验 | 导入实际阅读原资料后的逐条核验，区分支持/反驳/无法确定/不可访问；社区观点不自动变成事实 |
| 配置检查 | doctor 零网络、零配置修改，区分本地有效、缺配置、访问未验证和无效配置 |
| 本地分发 | 干净 ZIP 内含已编译入口，可以直接运行本地配置、doctor、摘要和重筛，无需安装开发依赖 |

### 使用场景

- 产品团队：看社区里某产品的痛点、替代方案和有内容的反馈。
- 开发者：追踪 Codex/Cursor 等工具的实际使用经验与高质量讨论。
- 内容创作者：按自己的主题和关键词保留可核对的选题线索。
- Whop 成员：按需整理自己绑定频道中某个作者的发言，避免重复整理同一正文。

### 可以对 Codex 这样说

- “用 community-signal-analyst 初始化我的配置。”
- “重点关注 AI coding，保留 Codex 和 Cursor，排除招聘。”
- “找近7天 Hacker News 和 GitHub 关于代码评审的高质量讨论。”
- “绑定这个我有权限的 Whop 频道：完整频道链接。”
- “整理我绑定频道中 Alice 的发言，并注明身份和样本限制。”
- “用我的新关注规则，重筛这份已经保存的报告。”

## 当前边界

Whop 是**使用者自己绑定页面 + 按需授权浏览器读取**，需要自己的会员访问；配置绑定不能取得权限。显示名不证明唯一身份，关键词只匹配已采集字段。页面日期只有相对标签时不推断绝对时间。已有 JSON brief 只能重筛当时保存的入选项。

Discord/Reddit 暂缓；Whop OAuth/API 保留实验代码，成员 API 读取未验证。实时接收、作者发言触发外部操作、自动交易未实现。现有自动化仍暂停，克隆仓库不会启用定时。报告是研究线索，不是交易指令。

## 快速开始：源码方式

```bash
git clone https://github.com/qife422/community-signal-analyst.git
cd community-signal-analyst
npm ci
npm run build
npm run typecheck
npm test
```

仓库公开，可直接浏览、下载或克隆。自然语言使用另需 Codex 加载本目录的 [SKILL.md](SKILL.md)；Whop 页面读取另需获准浏览器和自己的成员访问。

选择包外一个已存在的私有目录，将下面的 `/absolute/private` 换成自己的真实绝对路径：

```bash
npm run profile -- init --file /absolute/private/profile.json
npm run doctor -- --profile /absolute/private/profile.json
npm run profile -- show --file /absolute/private/profile.json
npm run live -- --profile /absolute/private/profile.json "找近7天 Hacker News AI coding讨论" --json --out /absolute/private/reports/research.json
```

profile 默认零绑定，不复制本机现用状态。配置字段、规则示例、Whop binding/digest/preview 命令见 [首次配置与规则](references/onboarding.md)。`npm run demo` 只使用固定模拟材料，不能当作真实社区结果。

## 快速恢复：直接使用编译包

[distribution/community-signal-analyst.zip](distribution/community-signal-analyst.zip) 是已验证的1.15.0编译分发包。下载并解压，在其目录运行 profile/doctor/digest/preview；需要 Node.js22+，这些本地命令无需 npm ci。它不会自动连接 Whop 或获得平台授权。

包 SHA-256：`3ad141a7adc095fb48dcc1c090d29ad5f8cda7ec6def2a6afe4ed513d8e1627a`。

完整恢复、认证、重新绑定和后续推送步骤见 [RESTORE.md](RESTORE.md)。

## 验证与证据

本轮备份前验证结果记录在 [backup-manifest.json](backup-manifest.json)。源码包含211项回归测试；恢复验收会核对实际 GitHub 提交与文件内容。集成回归使用明确标注的 [合成夹具](tests/fixtures/README.md)，没有真实频道正文或授权数据；测试不是线上全覆盖证明。

本机此前的真实平台验收保留在本机历史证据中，未随仓库上传。旧 Spec/交付说明中引用的 artifacts、state 和绝对路径在恢复后的仓库中应视为 historical/unavailable，不能声称云端已保全这些材料，也不能当作新机器 live 权限已经验证。

## 仓库包含与排除

包含 Skill 入口、agents、src、tests/合成夹具、references、Spec、构建配置、锁文件、打包/验证脚本、恢复说明和编译 ZIP。

不跟踪密钥、环境文件、个人 profile、scope/state、频道采集正文、个人报告、runs、历史 artifacts、旧 .history、node_modules 与 dist 构建目录。丢失电脑后可以恢复工具代码和可运行分发包；个人绑定、去重历史、报告和凭据须从自己另行保存的资料恢复，或重新配置。

本项目不自动安装全局 Skill、不恢复定时或申请权限。代码许可尚未指定。

## 后续更新

每次交付在 [CHANGELOG.md](CHANGELOG.md) 记录版本/日期、新增或修复内容、实际验证及已知限制，随对应 Git 提交一起推送。功能变化时同步 package.json 与锁文件版本；仅文档或仓库设置变化保留功能版本。公开仓库展示当前已实现能力，未实现功能不会写成已完成。
