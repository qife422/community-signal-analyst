# Codex Skill发现与执行验证

日期：2026-10-28（America/Los_Angeles）。交付版本1.15.3，原生Codex CLI/App Server 0.165.0。[原生CI](https://github.com/qife422/community-signal-analyst/actions/runs/40819707660)；受测提交 `8f499cb3fd9ed47e07b4c61e61658459b62948b6`。模型凭据由用户明确选择暂不提供。

| 实际验收 | Ubuntu24.04 x64 | Windows Server2025 x64 |
|---|---|---|
| 编译包放入用户Skill入口后发现 | 通过 | 通过 |
| 源码symlink/junction注册后发现 | 通过 | 通过 |
| 无关工作目录中的skills/list | 两种安装均为user、enabled=true、同名唯一 | 两种安装均为user、enabled=true、同名唯一 |
| 显式Skill输入与完整正文加载 | 两种安装均逐字匹配正文（归一化换行） | 两种安装均逐字匹配正文（归一化换行） |
| Codex工具实际执行init/doctor | 每种安装2次命令，均退出0 | 每种安装2次命令，均退出0 |
| 独立profile、零绑定、doctor ready | 通过，未生成Whop state | 通过，未生成Whop state |
| 真实模型推理/自主选择Skill | 未验证，按用户选择不提供凭据 | 未验证，按用户选择不提供凭据 |

## 怎么验证，以及不能据此推断什么

调用真实Codex二进制，通过标准本地App Server JSON-RPC完成initialize、account/read、skills/list、thread/start和turn/start。首次account/read均为未登录；不借用本机ChatGPT/API登录，不复制auth.json，不注入额外Skill扫描根路径。

执行阶段使用仅监听127.0.0.1的**脚本化Responses协议夹具**，返回预先写好的两次工具调用；Codex执行真实Node CLI，检查实际文件、退出码与doctor输出。每种安装3次本地协议请求，对应init、doctor、结束。它不做模型推理，不验证自然语言理解、自动选择或研究质量，不能写成“真实模型调用已通过”。未来真实模型验收需要使用者自己的登录与可用额度。

发现检查的cwd与Skill无关；执行命令的workdir为解析链接后的真实安装/源码目录，与README和新版Skill指引一致。profile放在安装目录外。调用者项目里的package.json不会被误用。

测试为临时账户显式配置workspace权限profile与零命令网络访问。Linux采用bubblewrap及Ubuntu的bwrap AppArmor配置；Windows运行器不支持MXC，使用官方管理员预配的elevated沙箱，子命令在受限用户中运行。没有用full access或unelevated代替失败验证。普通用户仍需配置自己环境的Codex沙箱；本轮没有自动操作桌面/IDE的Skill选择器，也没有验证所有Windows桌面/Linux发行版。

## 发现与修正

- Windows系统用户目录不能通过HOME/USERPROFILE伪装成另一个账号。测试改用一次性运行器账号的真实用户目录，隔离CODEX_HOME，并保留真实USERPROFILE；已有同名入口会停止，不覆盖。
- Linux需要bubblewrap，Ubuntu24.04可能还需要官方AppArmor配置。Windows发现成功后，未完成原生沙箱设置仍可能禁止执行；README补齐对应前提与排查链接。
- 全局发现不代表任意cwd都能运行本Skill的npm脚本。1.15.3入口、包内onboarding及README明确要求解析symlink/junction并使用真实Skill目录作为命令工作目录，Windows使用npm.cmd。
- 验证器使用分别可观察的init和doctor工具调用，检查完整Skill正文、两次成功退出、真实生成文件、零绑定与state未创建；修复了最初夹具解析/协议枚举不匹配的问题。
- Codex后台插件目录下载曾使新用户测试目录达到32,481,233字节，超出20MB阈值；盘点确认其中25,495,172字节为插件Git pack。该轮按失败保留记录。本地Skill专项不需要远端插件，本轮禁用apps/plugins/remote_plugin，保留原500文件/20MB阈值。最终Linux盘点244文件/6,837,768字节，Windows80文件/11,682,594字节。
- Windows同一一次性账号顺序验证两种安装，复用其隔离CODEX_HOME；profile与scope各自新建。Windows沙箱服务持有临时目录句柄，最后记录EBUSY而保留该上下文目录，交由运行器生命周期回收；未把清理状态伪称成功。

## 版本与完整回归

两种原生系统均再次完成公开GitHub源码/编译包的16步骤安装验收，干净npm ci/audit为0告警，27文件/211应用测试与4项Python回归、源码重新打包及合成Whop47条/去重/重筛验证通过。macOS本机Codex0.165.0-alpha.1.2也通过两种安装的无凭据发现/执行链复验；不把该alpha结果代替原生稳定版结果。

1.15.3 ZIP：102条目，594,236未压缩字节、237,345 ZIP字节，SHA-256：`9acb0e7d4e21783b4fd6a7f63cf607925b1ed26bdf7482b2f6754be0f9bab9f6`。应用TypeScript逻辑与依赖版本不变；补丁更新Skill命令定位、包内说明、验证工具和安装文档。原有Whop自动化保持PAUSED，Discord/Reddit与实时研究仍暂缓。

## 重放与证据

源码已有npm ci/build后，开发者可在隔离环境中运行：

```text
node scripts/check_codex.mjs --codex /absolute/path/to/native/codex --out /existing/parent/new-report.json
```

--codex必须是原生可执行文件，Windows为codex.exe，不是npm的codex.cmd包装器。此脚本会临时安装并移除自己创建的测试入口；Windows仅允许一次性GitHub运行器账号，不能拿它改动日常账号的现有注册。普通用户按README使用/skills与自己的登录做首次调用即可。

`scripts/install_codex.py`只为原生x64 CI准备固定0.165.0外部运行时，逐个校验官方GitHub release长度与SHA-256，放在CI临时目录，不全局安装或加入项目node_modules。独立上限600MB/100文件/源码字节的2500倍；本次有效598,330,000字节。应用原依赖/dist/证据上限不变，正式证据仅选小型JSON，不打包运行时或缓存。

本机正式证据：`artifacts/codex-validation/manifest.json`。公开CI的小型JSON附件保留14天；此说明、源码与提交记录保留方法和结果，不把临时附件承诺为永久备份。旧失败运行保持原结论，未覆盖历史证据。

参考：[官方Skill目录与调用](https://learn.chatgpt.com/docs/build-skills)、[App Server协议](https://learn.chatgpt.com/docs/app-server)、[认证](https://learn.chatgpt.com/docs/auth)、[Linux沙箱前提](https://learn.chatgpt.com/docs/sandboxing#prerequisites)、[Windows沙箱](https://learn.chatgpt.com/docs/windows/windows-sandbox)。
