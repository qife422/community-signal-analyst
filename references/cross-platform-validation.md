# Windows / Linux 安装验证

这是1.15.2的历史记录；当前1.15.3增量见 [Codex专项验证](codex-validation.md)。

日期：2026-10-28；功能版本：1.15.2。原生 GitHub Actions 运行器执行，未用 macOS 路径模拟代替系统验证。

[完整原生验收记录](https://github.com/qife422/community-signal-analyst/actions/runs/40778012503)；公开下载并验收的代码提交：`1e95012327aa03120b24a898db216043a64ec4a8`。后续收尾提交仅更新文档、交付状态与备份清单；应用代码、验证脚本和编译包以该提交为准。

| 环境 | Node | Python | 从公开 GitHub 克隆/下载后执行的16步骤 | 应用 / 脚本回归 | npm audit |
|---|---|---|---|---|---|
| Ubuntu 24.04 x64，ubuntu-latest | 22.17.1 | 3.12.15 | 全部通过 | 211 / 4通过 | 0 |
| Windows Server 2025 x64，windows-latest，PowerShell 7 | 22.17.1 | 3.12.10 | 全部通过 | 211 / 4通过 | 0 |
| 本机 macOS arm64（Darwin25.5.0） | 22.17.1 | 3.13.5 | 全部通过 | 211 / 4通过 | 0 |

## 实际执行范围

每个平台从公开 GitHub 解析并锁定上述提交，再克隆源码和下载编译 ZIP。独立临时 HOME/CODEX_HOME、空 npm/Git 配置、全新依赖和缓存，不继承 Token/付费开关、不链接本机 node_modules。执行 README 对应该系统的 Bash 或 PowerShell 代码块：编译包 init/doctor/show/demo/空绑定，以及源码安装、注册入口、初始化、类型检查、测试、重新打包和新包验证。

Windows 注册使用目录联接 junction，并以文件系统身份确认指向源码；不要求使用者为注册创建管理员符号链接。链接计量不会重复遍历依赖。GitHub 运行器本身具备测试文件符号链接所需权限，不能据此声称普通 Windows 账号拥有同等权限。

原生运行还对仓库实际分发 ZIP 执行离线验证：没有 node_modules、禁用 fetch、两个零绑定用户互不影响；明确标注的47条合成 Whop 记录全量/delta、重复输入0新+47未变、跨工作目录及snapshot/delta/已存brief重筛通过。它不证明会员访问或消息实时接收。

## 修复内容

- 报告和profile路径用系统 basename 解析，支持 Windows 反斜杠与正斜杠；Windows按大小写不敏感判断配置/状态/报告冲突，新增原生回归断言。
- 报告冲突检查使用解析后的父目录，修复 macOS 临时路径别名可能漏检状态目标的问题。
- 测试/验收使用系统临时目录；Node `--import`使用file URL，兼容空格、中文和Windows盘符。
- 验证器支持PowerShell、Windows Node/npm启动、进程超时处理、UTF-8文件和独立用户环境；源码Python工具自动选择python/python3/py -3。
- Windows junction不重复计量；原先最后一步字符串路径比较误报失败，改为samefile身份验证。早期失败保留于[首轮运行](https://github.com/qife422/community-signal-analyst/actions/runs/40777571033)和[第二轮运行](https://github.com/qife422/community-signal-analyst/actions/runs/40777736185)，未改写为当时通过。
- POSIX权限位只在Unix检查。Windows用户目录采用NTFS ACL；实验性Whop OAuth凭据文件助手在Windows明确拒绝，避免把0600误当ACL保护。按需浏览器整理不依赖它。
- README及包内onboarding补齐PowerShell步骤；新增固定官方Action提交的可重放Windows/Linux工作流，不启用产品定时。

## 分发与证据

已编译ZIP：102文件，593,314未压缩字节，236,859 ZIP字节，SHA-256：`9b0b96277d9816047ce4ef0c881851658e22ff6b577783ca2d27881034e29d6d`。源码打包在两种原生系统均通过；重新打包后的manifest和合成流程另行验证。分发包本地运行仍需Node22+；源码测试在22系列需22.12+，或Vitest支持的24/26系列；源码打包与完整验收需Python3。

本机正式证据入口：`artifacts/cross-platform/manifest.json`，记录验收标准、运行来源、命令、逐文件指纹和保全检查；私人artifacts不进入公开备份。CI小型JSON产物保留14天，公开本文与Git提交保留结果和来源；不声称临时CI附件永久可用。

未验证其他Linux发行版、Windows桌面各版本、各类Codex新账号模型执行或新的Whop会员浏览器权限。没有新增真实平台请求、频道写入或付费读取；Discord/Reddit暂缓、实时研究停止、现有Whop自动化保持PAUSED。
