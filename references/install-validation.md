# 新用户安装实测

## 当前结果：1.15.1依赖与脚本修复（2026-10-28）

- Vitest升级至5.0.5，固定Vite6维护线（6.4.5），重新解析并锁定已修复的传递依赖；不采用force或legacy-peer-deps。
- 实际npm ci、npm audit、typecheck、build成功，27文件/211应用测试和4项Python脚本回归通过；审计各级告警均为0。
- 本轮源码开发工具链在Node22系列要求22.12+；已编译本地命令的Node22+要求不变。
- 新脚本 `scripts/check_installation.py` 支持公开GitHub快照或本地白名单候选，干净HOME/CODEX_HOME/空npm配置/全新缓存，不链接原node_modules。
- 完整本地候选验收12步骤全部通过，源码干净安装后再次审计0告警、测试通过，编译包无node_modules时init/doctor/show/demo/list成功。
- 计数根因是npm在TMPDIR生成的Node编译缓存混入工作树。现用os.walk且不遍历注册软链接，将工作树、依赖、npm缓存、Node编译缓存和Git元数据分别按容量计量。工作树仍在500文件停止，没有放宽或关闭原门槛。
- 该次完整脚本统计：工作树298文件/2,641,748字节；Node编译缓存1,067文件/3,986,268字节；依赖874文件/60,155,546字节；npm缓存87文件/12,505,410字节。全部在各自阈值内，总脚本status=passed。
- 回归用501个Node缓存文件证明不会误触工作树门槛，用500个真实工作文件证明仍会拒绝且保留文件，另覆盖软链接不重复计量和无凭据环境。
- 新编译包：102条目，未压缩590,828字节、ZIP235,803字节；SHA-256 `473fcd8f3da21d21ce728bf43e3d27d03e023361cdb31a5401066f58f59b3cbf`。清单/个人数据排除与编译Whop/preview验收通过。
- 原1.15.0 ZIP保留在Git历史和本机既有输出中；本轮明确更新仓库的交付资产。旧失败与告警证据不覆盖，不伪称当时通过。

修复初期Vitest4的可选peer链在npm10.9.2触发解析器edgesOut异常，改用同一已修复5系列后锁文件解析和干净安装通过。没有以绕过peer校验解决。

本轮没有重新访问付费来源或Whop会员页面，也没有验证新Codex账号的模型执行；这些边界不因依赖修复而改变。公开源码快照以Git提交为准，本机正式证据见 `artifacts/dependency-fix/manifest.json`。

## 历史：1.15.0初次实测（保留当时事实）

以下“未解决”“整体脚本失败”描述均指1.15.0当时结果；相关依赖和计数问题已由上面的1.15.1实际验证关闭。

日期：2026-10-28。功能版本：1.15.0。测试下载的公开提交：`7b852c4017a3213ca5d0bc402f4ba82763f96f77`。

## 方法

直接从GitHub下载编译ZIP，同时使用公开git clone取得源码，按该提交README执行。两条路径使用独立的临时HOME、CODEX_HOME和npm缓存，不链接本机node_modules，不继承Token/付费开关；Git全局和系统配置关闭。本机没有 `/usr/local/etc/npmrc`。仅复用作为安装前提的主机Node.js22.17.1、npm10.9.2、git与macOS，不是重新安装操作系统。

编译包SHA-256：`3ad141a7adc095fb48dcc1c090d29ad5f8cda7ec6def2a6afe4ed513d8e1627a`，与README相同。

## 实际结果

| 步骤 | 结果 |
|---|---|
| 公开ZIP下载、解压、用户Skill目录安装 | 成功；没有node_modules |
| Node/npm版本检查 | 成功 |
| README的profile init、doctor、show | 均退出0；独立配置、零Whop绑定 |
| npm run demo | 成功；固定模拟内容 |
| README的首次真实公开研究命令 | 退出0，保存JSON，3条入选，实际来源hacker_news，sourceStatus均为verified_api |
| Whop空绑定list | 成功；不读取任何频道 |
| 公开git clone、全新npm ci | 均退出0；未借用现有依赖或npm缓存 |
| 源码build、软链接注册、独立init/doctor/demo | 均退出0 |
| 源码typecheck、npm test | 成功；27文件/211测试通过 |
| Codex本地Skill发现 | 单独空HOME/CODEX_HOME中成功，详情见下文 |

真实HN结果的抓取时间为 `2026-10-28T21:27:45.547Z`，只证明该次有界请求成功，不承诺今后的网络、额度、内容或访问持续可用。没有X/Product Hunt付费读取，没有复用Whop登录。

## Codex发现与账号边界

使用本机打包的Codex `0.165.0-alpha.1.2`，创建存在的空CODEX_HOME，凭据存储明确设为该目录的file模式，login status返回Not logged in。仅通过本地App Server的initialize和skills/list请求检查，返回community-signal-analyst，scope=user、enabled=true，路径指向新用户的 `.agents/skills/community-signal-analyst/SKILL.md`。没有启动模型turn或使用现有账号。

初次测试脚本把CODEX_HOME指向了尚不存在的目录，CLI因此在加载配置时退出；创建目录后发现检查通过。这是验证脚本准备问题，不是Skill发现失败。实际自然语言生成、登录授权、会员频道捕获与特定浏览器连接器仍需使用者自己的环境，不标记为已验证。官方本地协议参考：[Codex App Server](https://learn.chatgpt.com/docs/app-server)。

## 未解决：开发依赖安全告警

干净npm ci成功，但npm audit报告8项：1 low、1 moderate、4 high、2 critical。告警来自Vitest及其传递开发/测试依赖链；当前package没有第三方生产依赖，编译分发包也不携带node_modules。此说明不等于对所有使用方式作安全保证。

主要涉及vitest/@vitest/mocker、tinypool、vite、esbuild、postcss、nanoid、source-map-js。npm对部分告警给出的完整修复是升级到Vitest5，属于跨大版本，尚未在本轮实施或验收。参考npm返回的官方GitHub advisory：[Vitest](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)、[Tinypool](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)。后续需要单独完成依赖升级、锁文件更新和回归，不能仅运行force修复便宣布安全。

## 验证脚本容量检查

安装与测试15个命令步骤全部成功。末尾临时目录计数得到1,386文件/7,474,400字节，超过预设工作树500文件门槛，脚本因此以失败结束；**整体脚本不标记全通过**，命令成功与该容量结果分别记录。依赖单独盘点为1,035文件/69,502,916字节，npm缓存185文件/18,289,531字节，均低于各自声明阈值。

达到计数阈值后未继续生成该源码测试树；仅保留结果摘要，没有为目录计数重新执行平台查询或完整安装。上下文结束按事前定义清理本轮临时树，不涉及本机旧源码、个人state、旧证据或档案。当前没有进一步的完整工作树明细，不能把该临时树当正式证据包。

本机有界证据位于 `artifacts/readme-install/`，不随Git分发；本报告为可公开的摘要。运行代码、锁文件和分发ZIP未修改。
