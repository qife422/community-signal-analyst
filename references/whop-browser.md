# Whop 浏览器读取与超时处理

当前辅助模块适用于已绑定、已获成员访问的原生帖子页。聊天页继续按既有聊天DOM采集规程处理，不能把本模块的0个帖子写成0条聊天消息。只在cua_repl使用当前浏览器文档支持的Tab；不用终端浏览器、私有接口、cookie/token或新的连接器代替授权页面。

1. 从当前用户scope选精确URL；复用已有浏览器，任务开始列出当前用户标签页并claim已经释放的对应用户页；同一turn内保持句柄，不在每次读取前重复get/claim或切换焦点。原句柄失效才重新取得，不因单次错误更换浏览器。
2. 接管、刷新、观察渲染、展开正文和采集分为独立调用。刷新后先看页面状态；只出现框架或0个根帖时表示仍加载/布局变化，不能当作无内容。不要把导航后的下一条指令立即当成已加载成功。
3. 已确认当前帖子DOM结构后，使用scripts/whop-browser-reader.mjs中的captureWhopPage。默认12个根帖，上限50；每条文字≤4000字符。helper只读精确来源URL与DOM，不导航、不点击、不发送、不写文件。传入从页面核实的channelName及当前scope的一条绑定。

在已初始化的cua_repl主机侧加载本Skill实际安装目录中的模块（这是本地模块读取，不是页面JS或浏览器文件访问）：

```javascript
var whopReader = await import('file:///实际安装目录/scripts/whop-browser-reader.mjs');
var captured = await whopReader.captureWhopPage(tab, selectedScopeEntry, {
  channelName: '从当前页面核实的频道名', maxRoots: 12
});
nodeRepl.write({status: captured.status, attempts: captured.attempts});
```

路径含空格/非ASCII字符时用Node的pathToFileURL产生模块URL。上例是cua_repl代码，不是在shell执行；不能在页面evaluate里import本机文件。完整结构化snapshot留在主机变量，status=ok后用本地主机文件工具独占新建到私有运行目录；不经聊天手工重写帖ID、日期或正文。没有本地主机文件能力时说明具体限制，不把手工转录写成自动导出。

本地运行目录已经以0700创建、snapshotPath为其中尚不存在的新文件时，可以在cua_repl主机侧保存（不在页面evaluate中执行）：

```javascript
if (captured.status === 'ok') {
  var localFiles = await import('node:fs/promises');
  await localFiles.writeFile(snapshotPath, JSON.stringify(captured.snapshot, null, 2) + '\n',
    {flag: 'wx', mode: 0o600});
}
```

4. 缺作者/日期、附件无文字、折叠正文、超长文字分别排除并保存原因；不猜身份或绝对日期。对helper标出的collapsed_body，可按当前DOM定位该帖的“查看更多”，只展开已有正文后在独立调用重新采集；不点回复/分享/反应，不枚举其他频道，不打开附件。没有可用文字时报告no_usable_text，不生成空的成功报告。
5. helper对已识别的控制层超时最多顺序重试一次，每次核对同一精确URL；不重发消息类操作、不并发请求、不切换来源、不循环刷新。not_ready、source_mismatch、read_error等不自动重试。15秒evaluate参数不保证能改变底层CDP命令约3秒的截止时间；延长外层tool超时也不能被宣称是修复了连接。
6. 两次仍失败时停止本轮在线读取，保留已有候选与未完成delta，说明browser_transport/需要登录/布局变化，按实际情况请求用户恢复浏览器。不要把旧快照冒充本次采集。先前已成功导出的独立快照可以完成其本地处理，但要说明采集时间。
7. 再验应做至少两次独立刷新后的直接采集，分别保存snapshot，按真实增量结果比较；不同采集范围或可见正文变动要单列，不能机械要求0新增。浏览器原生错误来自连接层，不在本仓库内；流程缓解和短期验收通过不等于底层连接永不超时。

8GB机器上避免整页outerHTML、重复全页快照和额外标签页；本地文件清理不等于释放运行内存。不要替用户关闭其他任务页面、重启Chrome、清理浏览器缓存或改扩展权限；确有需要时说明影响再由用户决定。自动化仍暂停。
