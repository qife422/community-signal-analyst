# Whop member chat access

## 当前交付入口

收尾版 1.14.1 的范围见 [最终交付说明](final-delivery.md)。Whop 默认使用已绑定页面的按需浏览器模式。实时接收研究已停止；App webhook 需要创建者安装/批准，不能当作普通成员跨社区订阅；未完成业务注册、App/OAuth 授权或 webhook 注册。以下保留浏览器模式和独立 API 实验的具体说明。

## 多来源浏览器模式（1.13.0）

当前交付暂缓 Discord 和 Reddit，自动化保持 PAUSED。Whop 只读浏览器模式支持最多 3 个用户明确选定页面，多个页面必须向 digest CLI 提供 --scope。sourceResults 保留成功/失败/未捕获状态，groups 合并完全相同正文且保留出处，polls 防止旧快照回退。旧操作状态可从已匹配的当前捕获补齐内容指纹，不需要覆盖旧正式证据。

类型检查、构建、181 项测试通过，生产代码指纹未变。用户委托选择并确认免费加入 AI for PROs / AI SaaS Building Chat 后，两个实际会员社区已完成只读采样、合并精华和同样本去重（0 新/47 相同）。本次原论坛 7 条、新聊天 40 条文本；聊天 50 节点中 10 条因元数据缺失、附件/表情、旧 UUID 或会议访问秘密未导入。当前验收见 delivery-status.json 和 workspace artifacts/whop-member/readiness.md。AI for PROs 内容偏历史且有迁移公告，不认定为活跃每日来源。OAuth/API 仍未验证，不要求为已可用的浏览器模式重复授权。


## 当前选定页面的日常模式（1.12.0）

通过现有会员浏览器登录已验证独立刷新读取和持久增量检查。日常模式使用 Codex 定时唤醒、cua_repl 只读页面和 agent 语义整理；`--delta` 保存可恢复的增量原文。详见 `whop-daily.md` 和 `delivery-status.json`。无需拥有社区；当前操作范围为 state/whop-scope.json 中的两个社区页面。自动化 PAUSED；API/OAuth、未来无人值守与全日覆盖未验证。只读其他频道须有新授权；免费产品不解锁全部应用。

下面保留此前 API 候选和 1.11.0 浏览器快照阶段记录；其中“未创建定时”等描述属于当时阶段，以当前状态文件为准。


## Historical status (1.11.0)

Version 1.11.0 retains the preliminary read-only OAuth flow and bounded member-chat collector and adds local browser-snapshot digest processing. Offline response tests pass. No Whop OAuth app ID or token was configured in the existing local keys; no actual Whop API message read has occurred. A Whop browser session is logged in, but that is not an OAuth grant to this integration. The documented developer dashboard link again redirected this account to Townhall; personal settings did not expose an OAuth app. We have not created a business, app, membership or permission grant.

Current focus is Whop; preserve the existing Discord adapter and historical successful fixture reads. Reddit remains deferred.

The user subsequently selected `https://whop.com/stock-and-option/exp_JG1I58S5zTHbxs/app/`. A read-only browser check using their existing login succeeded: the page title is `历史股票期权记录区 | stock and option | Whop`, with two pinned longer posts and five recent updates visible. No text was entered, controls clicked, messages/replies sent, reactions added or OAuth permissions granted. See workspace `artifacts/whop-source/manifest.json`. This establishes only selected-page browser visibility. The post-card presentation does not establish the backend resource type; `exp_JG1I58S5zTHbxs` is known but a matching API channel/resource ID is not yet verified. Do not invent a chat_feed ID or treat this browser check as API, different-author discussion, cross-community or incremental-collection acceptance.

## 当前默认入口：自行绑定（1.14.0）

使用者按 [绑定说明](whop-binding.md) 管理自己选定的 Whop 原生频道。当前交付停止继续寻找/加入免费社区，保留已验证的两个来源，并支持调用者独立 scope。绑定、会员浏览器权限、API OAuth 授权是三个不同状态。下面 OAuth 说明保留为试验性路径，不是浏览器绑定的前置条件。

## Official access model

Whop documents user OAuth with PKCE and chat:read, and membership-gated channels. This offers a member-oriented candidate distinct from a creator App API key. It still must be tested in a real third-party community. Do not substitute an API key scoped to an owned account for the user's requested ordinary-member access.

Sources read on 2026-09-30: [OAuth](https://docs.whop.com/developer/guides/oauth), [Chat OAuth](https://docs.whop.com/developer/guides/chat/oauth), [Credential types](https://docs.whop.com/developer/guides/auth-scoping), [Membership channels](https://docs.whop.com/developer/guides/chat/channels), [List messages](https://docs.whop.com/api-reference/messages/list-messages), [Retrieve channel](https://docs.whop.com/api-reference/chat-channels/retrieve-chat-channel). Some Markdown guides were unavailable through the web reader, so their official Markdown contents were read directly by HTTPS with bounded Python urllib requests. No community message or secret was used for those documentation reads.

## OAuth setup

Create/select a developer OAuth app and register exactly:

`http://127.0.0.1:4387/whop/callback`

Enable the available user OAuth `chat:read` scope. This collector does not request message creation, moderation, DMs, support chats, email, payments or account access. App permissions/creator install and user OAuth scopes are distinct configurations; verify the member OAuth flow itself. Creating an app or granting new access must use the actual user-approved setup, not an inferred browser login grant.

After a real app ID is available, from the installed source:

```bash
npm run whop:auth -- --app-id app_REPLACE --out /absolute/private/whop.json
```

The app ID above is a placeholder. The helper prints a consent link, listens only on 127.0.0.1 for up to 10 minutes, validates state/origin/age and exchanges the code with S256 PKCE. Token contents are not logged. The output must be a new absolute path in an existing private directory; existing files are not overwritten. New token files use mode 0600. Denied consent, wrong state, expired session or network errors produce no credential file. If a token response omits scope, requestedScope is recorded, not presented as a confirmed grant; actual API reads must establish permission.

Whop access tokens expire. The library has a tested refresh exchange that requires the returned rotated refresh token, but the collector does not silently refresh or rewrite stored credentials. An expired credential file skips collection and asks for reauthorization. Automatic refresh persistence and incremental collection belong to the next slice after real access is established.

## Exact source scope

Supply a regular JSON file at most 20 KB, with 1–3 distinct member chat feeds:

```json
{
  "schemaVersion": 1,
  "channels": [{
    "experienceId": "exp_REPLACE",
    "communityName": "Selected community",
    "channelUrl": "https://whop.com/selected/exp_REPLACE/app/"
  }]
}
```

These are placeholders, not valid live sources. The official retrieve-channel and list-messages endpoints accept an experience ID as well as a channel ID. `channelId` is optional: when omitted, use the exact selected `exp_` ID for the metadata GET, require a returned `chat_feed_` ID and matching experience, then read that resolved channel. A non-chat/incorrect response blocks message reads. The experience must also match the clean selected URL's final `/<exp_id>/app/` segment. Existing scopes with an explicit channelId remain supported and require metadata to match both IDs. Do not extract a browser session token or enumerate unrelated memberships. This documented lookup path does not prove that the selected page is backed by that chat API until an authorized real metadata read succeeds. Never manufacture a per-message URL.

The supplied source is prepared in workspace `state/whop-scope.json`, containing the two selected experiences and original URLs for browser mode. It is configuration for a future authorized lookup, not live API evidence.

## Browser snapshot mode

The user-selected page can already be read through the authorized existing browser session. In 1.11.0, `whop:digest` processes its bounded capture without network access. This is a useful on-demand mode while API setup is pending; it is not unattended browser polling or an API grant.

1. Use cua_repl to open only explicitly selected member source URLs. Verify the page title and membership access. Read DOM-rendered post cards; do not type into composers, post, reply, react, read cookies/session tokens, fetch hidden state, or follow unrelated memberships. Current observed selector is `[id^="post_"][id$="_content"]`, with body paragraphs `p`. If the layout changes, inspect the actual DOM again rather than guessing selectors. Maximum 3 selected pages and 50 captured roots per page; stop rather than silently broadening scope.
2. Save a fresh regular JSON file at most 1 MB: `schemaVersion: 1`, `retrievalMethod: browser_visible`, actual `fetchedAt`, and `sources` with exact `url`, `experienceId`, community/channel names and `posts`. Each post has ID, author, displayed `publishedLabel`, pinned flag, and captured body at most 4,000 characters. No absolute timestamp/year is inferred from labels. Record capture method and unknown completeness separately. Empty/unreadable pages must be reported as access/coverage limits rather than inactivity.
3. Process the new capture, with caller-selected operational state and a new report path:

```bash
npm run whop:digest -- --snapshot /absolute/capture.json --state /absolute/operational/whop.json --out /absolute/new-report.md --scope /absolute/private/whop-scope.json
```

4. State keys are selected source URL plus post ID; hashes cover author/body, not changing view counts or relative time labels. Repeated identical roots produce no new records; changed bodies are separately identified. First-observed does not mean newly published. Pinned background and short updates stay separate; raw transaction text is preserved locally while the report avoids trading instructions/prices. Candidate author excerpts are not independently checked facts or a complete semantic highlight analysis.
5. State uses a lock, private atomic writes, at most 1,000 entries/1 MB, and stops on invalid/stale state or capacity. Existing reports are never overwritten by the CLI; failed report writes do not consume records. Only this invocation's temporary/lock files are removed. Formal snapshot/evidence state must not be reused as mutable operational state. Current workspace operational state is `state/whop.json`; the snapshot in `artifacts/whop-digest/state.json` is fixed evidence.

The real seven-post capture produced seven first-observed records; the same capture's second pass produced zero new records/seven unchanged, with fetch prohibited. The candidate snippet policy was repaired after it retained disguised execution fragments; initial candidate and repair provenance are retained in the evidence package. See workspace `artifacts/whop-digest/manifest.json`. This proves local capture-to-digest processing and same-snapshot deduplication, not a second live poll, different-author replies, a second community, API permission, automatic token refresh, or a scheduled collector. No schedule was created.

Once authorization and scope are ready:

```bash
WHOP_API_ENABLED=true WHOP_TOKEN_FILE=/absolute/private/whop.json WHOP_SCOPE_FILE=/absolute/private/whop-scope.json node dist/src/cli.js "找最近 Whop AI coding 讨论"
```

Alternatively a user OAuth token can be supplied privately as WHOP_USER_ACCESS_TOKEN. Never paste tokens into chat or report files. The CLI does not automatically load the existing credential env. Bare all-platform and six/seven-platform queries retain their earlier semantics; explicitly name Whop during the trial. Named Whop queries do not collect HN, X, Discord or Reddit.

## Experimental OAuth/API bounded slice and limits

- Two GETs per chat: metadata then the newest 50 messages via first=50 and direction=desc. At most six requests/150 messages. No pagination, discovery, DMs, attachment reads, retries or message creation.
- Fixed official API origin, 10-second requests, failed redirects and 1 MB streamed-response limit. Invalid scopes are rejected before credentials leave the process. HTTP 401/429 stops further chats; 403 permits another independently selected chat to proceed.
- Keep only regular messages with valid user/message IDs, dates in the requested window and no future dates. Deduplicate IDs per chat; exclude thin promotional content. Preserve body up to 4,000 characters, original author/time and up to three substantive direct replies from a different author in the same fetched page. Preserve reply message IDs and parent attribution. No total reply count is inferred.
- Reporting retains the selected community name, API channel name and exact IDs. URLs open the channel, not the individual message. The report states this explicitly. Sharing a channel URL must not merge separate discussions. Reaction counts sum emoji counts, not unique people. Factual statements remain author claims.
- This is one-shot topic selection, not a completed always-on multi-community digest. Durable cursors, across-run deduplication, automatic refresh storage, broad highlight extraction and a user-selected run cadence remain pending. No API scheduled collector has been created; the separate browser heartbeat is PAUSED.

## Live acceptance gates

1. Verify a real user OAuth consent for read access, an existing third-party community membership, and an accurate selected channel URL/ID mapping.
2. Read actual substantive discussion and a different author's direct reply; preserve provenance, body and context.
3. Repeat with a second selected community before asserting cross-community access.
4. Then implement and validate incremental read/refresh persistence and repeat-run deduplication, and deliver useful topic highlights with original-source access limits.
5. Record actual calls, source scope, code fingerprints and limits in a new live evidence package. Offline fixtures never count as real community discussion.
