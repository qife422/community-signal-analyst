# 从 GitHub 恢复 Community Signal Analyst

账号 `qife422`，私有仓库 `community-signal-analyst`，源码主分支 `main`。这是工具源码和编译分发包的备份；个人配置、历史报告、平台凭据和频道正文不在仓库中。

## 1. 重新取得仓库

在新机器登录自己的 GitHub 账号；可用 GitHub 网页下载仓库ZIP，或使用 Git/GitHub CLI：

```bash
gh auth login
gh repo clone qife422/community-signal-analyst
cd community-signal-analyst
```

下载项目是恢复快照；本机的旧目录和兼容链接仅是历史布局说明。新机器实际解压/克隆的位置是该机器的源码位置，不为恢复路径表象复制旧缓存或创建多份活动源码。让 Codex 从实际路径加载 SKILL.md；如需要安装到自己的 Skill 发现目录，由自己把入口指向此唯一源码，旧机器的链接不会自动恢复。

## 2. 直接运行，或恢复开发环境

直接运行：解压 `distribution/community-signal-analyst.zip`，进入里面的目录，使用 Node.js22+ 执行 README/onboarding 的 profile、doctor、digest、preview 命令。编译包内运行脚本直接执行 node dist，无需安装开发依赖。

继续开发：在仓库源码根目录运行：

```bash
npm ci
npm run build
npm run typecheck
npm test
python3 scripts/verify_distribution.py --zip "$PWD/distribution/community-signal-analyst.zip"
```

Python验证脚本需要Python3；用合成样本验证已编译本地命令，不读取真实频道。Node开发依赖在node_modules，构建输出在dist，均不进入Git。没有先build时，部分集成测试因找不到编译CLI而失败，应先build而非降低测试要求。

## 3. 恢复自己的配置

在包外选择一个已存在的私有目录，初始化新 profile。示例中的路径需要自行替换：

```bash
npm run profile -- init --file /absolute/private/profile.json
npm run doctor -- --profile /absolute/private/profile.json
```

没有另外保存旧配置时，从零绑定开始；不会补造丢失的去重历史或已读报告。按 [onboarding](references/onboarding.md) 设置关注规则并重新绑定自己有权限的精确Whop频道。平台凭据使用自己的安全存储重新提供，不能写入Git；绑定有效不证明成员访问，doctor不会主动验证网络权限。

本机此前暂停的自动化不会从仓库恢复或开启。Discord/Reddit、实时/自动交易和实验API的边界保持README所述。

## 4. 核对备份身份

`backup-manifest.json` 记录本次快照的文件清单/字节数/SHA-256，不包含manifest自身或Git元数据。`git log -1` 可查看提交身份；网页与本机应对应同一提交。分发包内另有负载manifest，整体ZIP指纹见README。

旧references/Spec中提到的 `artifacts/`、`state/`、`.history/` 和原机器路径未上传；在恢复机器上是历史引用且 unavailable，不能作为当前活动证据。本机这些内容仍保留，不被此备份任务删除、迁移或重新封存。

## 5. 后续更新

修改完成并验证后，仅提交工具代码与文档。先看 `git status` 和暂存差异，确认不含个人配置/凭据/正文，再提交、推送：

```bash
git status --short
git add <明确选择的源码或文档路径>
git diff --cached --stat
git commit -m "Describe the actual change"
git push origin main
```

这次上传是一次快照；不是自动同步或定时备份。后续修改要再次推送，GitHub上的版本才会更新。更新ZIP用新的目标路径打包并校验，不覆盖尚需核对的候选；只有明确决定更新仓库中的交付资产后才提交替换。
