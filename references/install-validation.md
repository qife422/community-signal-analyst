# 新用户安装实测

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
