# Community Signal Analyst

## 唯一入口

- 用户已明确授权把两处 Skill 合并到本项目文件夹；本项目根目录是唯一活动源码。该具名授权优先于上层默认 `skills/{name}` 路径规则。
- `~/.codex/skills/community-signal-analyst` 和 `/Users/ffq/Documents/aicoding项目/skills/community-signal-analyst` 仅为兼容链接，必须解析到本项目，不创建第二份源码。
- 当前能力与交付状态见 `SKILL.md`、`references/final-delivery.md`、`references/delivery-status.json`。旧版 `.history/community-signal-analyst/` 只作历史恢复，不能用于活动构建、测试或覆盖当前源码。

## 活动边界

- Whop 保留使用者自行绑定页面的按需只读整理。Discord、Reddit 暂缓，实时接收研究停止。Whop 自动化 PAUSED。不得把收尾授权解释为恢复定时、申请新权限或发布服务。
- `state/` 是当前使用者的运行状态；新增使用者从零绑定开始。`artifacts/` 是各阶段固定证据，历史版本与旧来源路径保留当时事实；正式收尾记录见 `artifacts/final/manifest.json`。
- 代码/配置整理走可逆的小改动，不改写密钥、已有报告、来源范围、去重记录或自动化配置。真实平台请求与付费读取另按既有授权执行。

## 目录与容量

- `src/`、`tests/`、`references/` 是活动输入；`dist/`、`node_modules/`、`output/` 是已有构建/runtime/候选产物，已指定忽略目录。新临时验证放系统临时目录。
- 活动 dist：10 MB / 200 文件 / src 字节数的 10 倍；活动依赖：200 MB / 2,000 文件 / src 的 1,000 倍；单个正式证据包：1 MB / 30 文件 / src 的 10 倍。
- `.history/` 是旧迁移目录，迁移时约 49 MB / 1,115 个文件，不是正式证据。历史源码、锁文件、测试和独有资料保留，不在其中构建、安装或扩展；依赖缓存的处置按下方2026-10-31新增授权执行，不把迁移本身当作删除授权。
- 命中阈值停止同类产物增长，盘点并报告，不自动删除/压缩。构建只编译 src/tests；测试只收集 tests/**/*.test.ts，排除历史档案。

## 开发完成后的空间管理

- 用户2026-10-31明确授权：某部分开发验证完成、对应源码与必要分发内容上传GitHub且回读可恢复后，清理本项目不影响运行或后续开发的可再生产物。该授权不扩展到其他项目、系统缓存或浏览器标签页；删除文件释放磁盘空间，不保证减少运行内存。
- 每次先盘点精确绝对路径、文件数、字节数、分类与恢复方法；核对Git工作树、远端提交/文件指纹、正在使用的路径和证据manifest。只对已盘点的具体目标执行，禁止宽泛glob、未解析变量或整个仓库递归清理；删除前再次核对路径身份与指纹，有差异即停止。
- 可选目标：已被当前分发包或Git历史替代的重复构建包、未被正式证据引用的可再生缓存，以及已确认退出活动路径的历史依赖目录。本轮白名单为`.history/community-signal-analyst/node_modules`与和正式分发ZIP指纹相同的`output/codex-validation/community-signal-analyst.zip`；历史依赖的恢复依据是原目录保留的package.json/package-lock.json，若需重建另在隔离恢复工作区进行。
- 当前`node_modules/`与`dist/`仍供源码npm命令运行/开发，默认保留；源码、锁文件、测试、脚本、正式分发包、Git元数据、历史独有源码、密钥/登录、profile/scope/state、报告、待处理delta和正式证据均不在自动清理范围。忽略目录不等于可删除目录，失败记录也不默认是缓存。
- 清理清单与结果存本地独立manifest；只将无私有内容的规则/结论同步GitHub。结束后核对释放的文件字节、保留项指纹、Skill链接及本地命令可运行。未上传、不可恢复、被引用、仍在使用或分类不明的文件先保留并说明。
