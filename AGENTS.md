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
- `.history/` 是本次授权迁移的旧目录，约 49 MB / 1,115 个文件，包含原有缓存与生成物，不是正式证据。仅为保全，不继续构建、安装或扩展；不得从本次迁移推断删除授权。
- 命中阈值停止同类产物增长，盘点并报告，不自动删除/压缩。构建只编译 src/tests；测试只收集 tests/**/*.test.ts，排除历史档案。
