# Whop 社区绑定

## 使用者怎么用

在 Codex 中启用 Community Signal Analyst 后，可以直接说：

- “绑定这个 Whop 频道：〈频道链接〉，社区名是〈名称〉。”
- “查看我已绑定的 Whop 社区。”
- “解除〈频道名称或 exp_ ID〉的 Whop 绑定。”
- “整理我已绑定的 Whop 社区精华。”

首次使用时，先在自己的 Whop 浏览器账号加入需要的社区并取得频道访问权限，再提供链接。无需创建自己的服务器。Whop 中对应的是社区和原生频道；如果链接只是 Discord 的入口，本功能不能读取其 Discord 聊天。

完整频道链接形如 `https://whop.com/<社区>/exp_<ID>/app/`。社区首页也可交给 Codex：在已授权浏览器里打开首页，根据实际侧栏定位所需频道；有多个候选时让使用者选定。不要把主页当成整社区授权，不枚举成员全部频道。命令行直接添加需要完整频道链接，不含查询参数或锚点。

## 绑定和访问分别验证

绑定只保存本地读取范围。它不会加入社区、付款、接受条款、发消息、回复、反应、授权 OAuth 或启用自动化。新增绑定不继承其他人的登录/会员权限。浏览器标题、URL、社区/频道名和实际可读状态需要通过当前使用者会话核对；保存成功但无法读取时，报告“已绑定，访问待验证/需要登录/权限不足”。会员权限撤销后仍明确显示失败，不报无新内容。

添加后不自动整理全部历史；使用者要求整理时，读取当前绑定范围，每次最多3个频道、每频道50条。保留原作者、显示日期、真实消息ID和频道链接，去重后提取少量有实质内容的精华。没有有价值的信息时少报或不报。

## 命令行入口

在安装源码目录执行，`--scope` 必须是使用者指定的绝对路径，父目录需已存在。每个使用者/工作区使用独立范围和去重状态，不把现有两个示例绑定默认复制给新使用者。

```bash
npm run whop:bind -- --help
npm run whop:bind -- list --scope /absolute/private/whop-scope.json
npm run whop:bind -- add --scope /absolute/private/whop-scope.json --url https://whop.com/community/exp_REPLACE/app/ --name '社区名称'
npm run whop:bind -- remove --scope /absolute/private/whop-scope.json --id exp_REPLACE
```

上述 URL/ID 为格式示例，不是真实来源。绑定文件最多20KB、0–3个频道。新配置在首次添加时创建，mode 0600；重复添加相同频道不重复写入，冲突名称/链接需先明确解除。达到3个时停止新增，不擅自替换。多份范围配置可分别按需运行；每轮仍限3个。

解除只改选定的 scope 文件，不退群、不删除旧摘要/原始采集/去重状态。重新绑定后沿用原状态，避免把旧消息重新当作新内容。最后一个绑定解除后，`channels: []` 是合法配置，摘要 CLI 停止处理，提示先绑定。已有配置损坏、超限、符号链接或正在被另一调用锁定时，不覆盖原配置。

## 与精华处理连接

浏览器采集由 Codex 经 cua_repl 执行，读取当前绑定；本地处理 CLI 零网络，**单/多来源都必须提供 scope**：

```bash
npm run whop:digest -- --snapshot /absolute/new-capture.json --state /absolute/private/whop.json --out /absolute/new-index.md --delta /absolute/new-delta.json --scope /absolute/private/whop-scope.json
```

URL、experienceId 和社区名与绑定严格匹配；未绑定或已解除的页面拒绝处理。中断恢复也先核对当前绑定，不继续总结已解除来源的旧 delta；保留历史文件供核对。语义精华与运行恢复步骤见 [读取规程](whop-daily.md)。

## 当前交付边界

已验证两个指定社区的普通会员浏览器读取及持久去重；此版本验证绑定管理和范围约束，不声称任意社区都已通过实测。需要使用者自身会员访问，内容质量取决于所选社区。OAuth/API 和无人值守运行仍未实测；自动化 PAUSED，Discord 和 Reddit 暂缓。停止继续寻找/加入新免费社区。
