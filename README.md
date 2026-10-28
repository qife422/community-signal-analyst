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

## 安装前准备

- **Node.js 22或更新版本（含npm）**：终端运行 `node --version`、`npm --version` 确认。使用已编译包也需要Node。
- **Codex**：自然语言调用前，先启动Codex并完成自己的登录/模型访问配置；执行命令和访问所选来源时，还需给予相应本地/网络权限。只运行本项目CLI不需要Codex账号。
- **浏览器能力（仅Whop采集）**：需要Codex环境中可用且获准的浏览器工具，以及使用者自己能访问频道的Whop账号。Skill不附带浏览器连接器或会员权限。

下面命令使用macOS/Linux的shell语法。已有运行验收在macOS完成；Windows及其他系统尚未完成全流程验收。

## 第一步：选择一种安装方式

### A. 普通使用者：下载已编译包（推荐）

1. [直接下载 community-signal-analyst.zip](https://raw.githubusercontent.com/qife422/community-signal-analyst/main/distribution/community-signal-analyst.zip)。这是仓库 `distribution/` 中的编译包；GitHub的 **Code → Download ZIP** 下载的是整个源码仓库，采用下方方式B。
2. 解压后得到 `community-signal-analyst` 文件夹。**保留整个文件夹，不要只复制SKILL.md**。
3. 创建用户Skill目录：

   ```bash
   mkdir -p "$HOME/.agents/skills"
   ```

4. 用文件管理器把解压后的文件夹放入该目录。最终结构应为：

   ```text
   ~/.agents/skills/community-signal-analyst/
   ├── SKILL.md
   ├── package.json
   ├── dist/
   ├── references/
   └── agents/
   ```

   确认 `SKILL.md` 直接位于上述目录中，没有多嵌套一层。已有同名目录时先核对，勿覆盖自己的版本或配置。
5. 进入安装目录：

   ```bash
   cd "$HOME/.agents/skills/community-signal-analyst"
   ```

**此方式无需 `npm ci` 或 `npm run build`**，包内运行命令直接使用已编译文件。源码、参考资料和编译文件须保持相对布局。

编译包版本1.15.0，SHA-256：`3ad141a7adc095fb48dcc1c090d29ad5f8cda7ec6def2a6afe4ed513d8e1627a`。macOS可用 `shasum -a 256 /实际下载路径/community-signal-analyst.zip` 核对下载内容。

### B. 开发者：克隆源码并构建

在自己选择的项目目录执行；同名目标已存在时先核对，不覆盖：

```bash
git clone https://github.com/qife422/community-signal-analyst.git
cd community-signal-analyst
npm ci
npm run build
```

**源码安装实测提示（2026-10-28）：** 当前锁文件的 `npm ci` 可以完成，但npm报告8项开发/测试依赖告警（含2项critical）。完整修复建议涉及Vitest跨大版本升级，尚未实施；不要把安装成功等同于依赖告警已解决，也不要直接执行 `npm audit fix --force`。推荐的编译包不安装这套开发依赖。详情及验收范围见 [新用户安装实测](references/install-validation.md)。

为让Codex在其他项目中也发现它，在**源码根目录**执行下面的软链接注册；链接指向唯一源码，不维护第二份：

```bash
mkdir -p "$HOME/.agents/skills"
if [ -e "$HOME/.agents/skills/community-signal-analyst" ] || [ -L "$HOME/.agents/skills/community-signal-analyst" ]; then
  printf '%s\n' '安装入口已存在，请先核对；未修改。'
else
  ln -s "$PWD" "$HOME/.agents/skills/community-signal-analyst"
fi
```

上述检查遇到同名目录/链接时保留原入口；不要加覆盖参数。注册后仍在源码根目录运行后续命令。若通过GitHub **Code → Download ZIP** 下载源码，先解压、进入含package.json的根目录，再执行 `npm ci`、`npm run build` 和同样的注册步骤。

Codex用户级发现目录为 `~/.agents/skills`，支持符号链接；未出现时重启Codex。安装位置与发现行为见 [OpenAI官方说明](https://learn.chatgpt.com/docs/build-skills#where-to-save-skills)。

## 第二步：初始化自己的配置

在上面选定的Skill目录执行。配置保存在安装目录之外，不会跟着分享包分发：

```bash
mkdir -p -m 700 "$HOME/.community-signal-analyst"

npm run profile -- init \
  --file "$HOME/.community-signal-analyst/profile.json"

npm run doctor -- \
  --profile "$HOME/.community-signal-analyst/profile.json"
```

这是**首次初始化**步骤。已有profile时不要重复init，先用show或doctor查看；初始化不会覆盖旧文件。

生成内容：

```text
~/.community-signal-analyst/
├── profile.json       # 自己的默认查询与关注规则
├── scope.json         # 初始零Whop绑定
└── reports/           # 私有报告目录
```

Whop去重state在第一次实际digest时才创建。默认来源 **HN/GitHub/DEV**，中文、近7天、最多3条、AI coding主题、零关注规则和零Whop绑定。

查看当前配置：

```bash
npm run profile -- show \
  --file "$HOME/.community-signal-analyst/profile.json"
```

### 如何理解doctor

| 状态 | 含义与下一步 |
|---|---|
| `ready` | 本地配置有效，可尝试所选来源；没有做在线权限验证 |
| `needs_configuration` | 所选来源缺凭据/开关或Whop尚未绑定，按来源提示补充 |
| `unverified_access` | 已有本地配置/绑定，但平台访问尚未验证 |
| `invalid_config` | 先修正Node版本、schema、路径或文件状态；不自动重置原配置 |

有效本地配置退出码0，无效配置退出码2。doctor零网络、零配置修改，不读取浏览器登录信息，不打印凭据值。

## 第三步：完成第一次使用

### 先做离线演示（不访问真实平台）

```bash
npm run demo
```

演示内容是固定模拟数据，只证明基本运行入口，不是当前真实社区结果。

### 读取公开社区并保存报告

```bash
npm run live -- \
  --profile "$HOME/.community-signal-analyst/profile.json" \
  "找近7天 Hacker News 的 AI coding 高质量讨论" \
  --json \
  --out "$HOME/.community-signal-analyst/reports/first-research.json"
```

此命令会请求真实公开来源。输出保留实际取得的链接、作者、时间和限制；结果不足时不会补造。目标报告已存在时选择新文件名，不覆盖。去掉 `--json` 可保存Markdown报告。

### 在Codex中设置关注规则并使用

确保Codex能发现本Skill，然后说：

> 使用 community-signal-analyst，采用我家目录下 .community-signal-analyst/profile.json 的配置，重点关注Codex和Cursor，排除招聘，并保存规则。

再说：

> 使用同一profile，找近7天 Hacker News 和 GitHub 关于AI coding的高质量讨论，保存报告并说明筛选依据。

CLI/IDE可用 `$community-signal-analyst` 显式提及；没有出现在列表时先检查目录层级、SKILL.md和软链接目标，再重启Codex。完整对象schema、作者规则、关键词包含/排除、set和离线重筛见 [首次配置与规则](references/onboarding.md)。

## 第四步：按需启用其他来源

| 来源 | 使用者需要提供 |
|---|---|
| HN、GitHub、DEV | 默认可先尝试；受网络及API额度限制，GitHub Token可选 |
| Whop | 自己的成员访问、精确原生频道URL、Codex可用的授权浏览器工具，并在profile允许来源中启用whop |
| Product Hunt | 自己的 `PRODUCT_HUNT_TOKEN`，在profile允许来源中加入product_hunt |
| X | 自己的 `X_BEARER_TOKEN`，明确授权付费读取后设置 `X_API_ENABLED=true`，并在profile允许来源中加入x |

平台凭据通过使用者自己的环境/安全存储提供，不能写入profile、报告或Git。仅设置环境变量不会自动扩展profile允许来源。X的可选回复还有单独的付费读取门禁，见SKILL说明。

### Whop首次绑定与整理

1. 在Codex获准操作的浏览器中登录自己的Whop，确认能打开目标频道。
2. 提供形如 `https://whop.com/<社区>/exp_<ID>/app/` 的**完整原生频道URL**，不要只给社区首页。
3. 对Codex说：“采用我的profile，把Whop加入允许来源，绑定这个我有权访问的频道：完整链接。” 不要只添加过滤规则而忘记启用来源。
4. 让Codex按需只读捕获已绑定页面，生成本地snapshot，再交给digest整理。浏览器工具不可用或需要登录时先处理该具体缺项，不能仅凭绑定成功声称已经读取。

查看自己的绑定：

```bash
npm run whop:bind -- list   --scope "$HOME/.community-signal-analyst/scope.json"
```

需要自己操作CLI绑定时，先将profile的允许来源增加whop，再将下面URL与名称占位值替换为自己的真实来源：

```bash
npm run whop:bind -- add   --scope "$HOME/.community-signal-analyst/scope.json" \
  --url "https://whop.com/REPLACE/exp_REPLACE/app/" \
  --name "替换为自己的社区名"
```

最多3个明确频道。绑定只保存本地范围，不加入/购买社区、不授予权限。`whop:digest` 只处理本地snapshot，**不会自动启动浏览器或持续接收消息**；具体capture/digest/preview步骤见 [onboarding](references/onboarding.md)。Skill不操作频道输入框或发送内容；Discord/Reddit、实时与交易功能保持上文边界。

## 常见问题

| 情况 | 处理 |
|---|---|
| `node` / `npm` 找不到 | 安装Node.js22+并重新打开终端 |
| 找不到package.json | 先cd到含SKILL.md与package.json的Skill根目录 |
| 找不到dist文件，或源码命令找不到tsc | 确认下载方式：源码需先npm ci、npm run build；编译包重新完整解压，勿只复制SKILL.md |
| Codex不识别Skill | 检查 `~/.agents/skills/community-signal-analyst/SKILL.md` 或软链接目标，避免双层目录，必要时重启 |
| init提示目标已存在 | 不删除原文件；用show/doctor核对已有配置，或显式选择另一个独立目录 |
| 报告目标已存在 | 换新输出文件名，不重复初始化profile或清空去重state |
| doctor ready但平台读取失败 | ready只说明本地有效，按实际网络/凭据/会员/浏览器提示处理 |
| Whop绑定后仍未读取 | 确认profile允许whop、浏览器可用、自己有成员访问；CLI digest还需要真实捕获的snapshot |
| 筛选后零条 | 核对来源交集、作者精确字段、关键词和排除词；零命中不代表社区没有内容 |

开发者需要运行回归时，在源码目录执行 `npm run typecheck`、`npm run build`、`npm test`。编译包不包含开发测试套件；当前只在macOS做过干净解压验收，不把它扩展为所有系统或其他人的账号均已验证。

更多恢复、重新绑定和后续推送步骤见 [RESTORE.md](RESTORE.md)。

## 验证与证据

2026-10-28已从公开GitHub重新下载，使用全新HOME和npm缓存实测：编译包初始化/doctor/demo成功，一次真实HN查询返回3条结果；源码干净npm ci/build及211测试通过。空CODEX_HOME下，本机Codex通过本地skills/list识别到已安装的Skill。自然语言模型执行、新Whop会员登录和浏览器采集未在该空账号中验证；源码依赖告警仍未解决。逐项结果见 [新用户安装实测](references/install-validation.md)。

本轮备份前验证结果记录在 [backup-manifest.json](backup-manifest.json)。源码包含211项回归测试；恢复验收会核对实际 GitHub 提交与文件内容。集成回归使用明确标注的 [合成夹具](tests/fixtures/README.md)，没有真实频道正文或授权数据；测试不是线上全覆盖证明。

本机此前的真实平台验收保留在本机历史证据中，未随仓库上传。旧 Spec/交付说明中引用的 artifacts、state 和绝对路径在恢复后的仓库中应视为 historical/unavailable，不能声称云端已保全这些材料，也不能当作新机器 live 权限已经验证。

## 仓库包含与排除

包含 Skill 入口、agents、src、tests/合成夹具、references、Spec、构建配置、锁文件、打包/验证脚本、恢复说明和编译 ZIP。

不跟踪密钥、环境文件、个人 profile、scope/state、频道采集正文、个人报告、runs、历史 artifacts、旧 .history、node_modules 与 dist 构建目录。丢失电脑后可以恢复工具代码和可运行分发包；个人绑定、去重历史、报告和凭据须从自己另行保存的资料恢复，或重新配置。

本项目不自动安装全局 Skill、不恢复定时或申请权限。代码许可尚未指定。

## 后续更新

每次交付在 [CHANGELOG.md](CHANGELOG.md) 记录版本/日期、新增或修复内容、实际验证及已知限制，随对应 Git 提交一起推送。功能变化时同步 package.json 与锁文件版本；仅文档或仓库设置变化保留功能版本。公开仓库展示当前已实现能力，未实现功能不会写成已完成。
