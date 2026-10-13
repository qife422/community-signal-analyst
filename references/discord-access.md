# Discord authorized channel access

The CLI reads Discord's official Bot REST API v10. It requires all three inputs: `DISCORD_API_ENABLED=true`, `DISCORD_BOT_TOKEN`, and `DISCORD_SCOPE_FILE`. A user account token or self-bot is not supported. Use a bot already authorized in the supplied server; do not discover servers, join them, invite a bot, or expand channel permissions without authorization.

## Scope file

Supply a regular UTF-8 JSON file of at most 20 KB, with 1–3 distinct channel IDs:

```json
{
  "schemaVersion": 1,
  "channels": [
    { "guildId": "123456789012345678", "channelId": "234567890123456789" }
  ]
}
```

The IDs above are examples, not usable credentials or a configured server. In a supplied `https://discord.com/channels/<guild>/<channel>` link, use those two IDs. Forum containers are unsupported; an explicit forum post's thread ID may be supplied instead. Validate every scope entry before making any request. Metadata must match the specified guild and channel; only guild text (0), announcement (5), announcement thread (10), public thread (11), and private thread (12) types are supported. DM, voice, group DM, forum container and category history is not read. Thread access still depends on the bot's permissions and membership.

## Credentials and permissions

Keep the bot token in the existing local credential file or process environment; never put it in chat, the scope file, reports, fixtures or manifests. The CLI does not automatically load credential files. Configure the bot with access to the selected channel and `VIEW_CHANNEL` / `READ_MESSAGE_HISTORY`; ordinary message content may also require the enabled and, where applicable, approved `MESSAGE_CONTENT` intent. Missing content can also mean a non-text message, so do not diagnose intent failure solely from empty content.

Example after the token has been loaded privately into the environment:

```bash
DISCORD_API_ENABLED=true DISCORD_SCOPE_FILE=/absolute/path/discord-scope.json node dist/src/cli.js "找最近 Discord AI coding 讨论"
node dist/src/cli.js "找最近全平台 AI coding 讨论"
```

The second command queries gated platforms only if their respective environment inputs and authorization are already present. It does not enable paid X reads or Reddit approval.

## Bounded collection contract

- At most 2 GETs per channel: verify metadata, then read the newest 50 messages. At most 6 requests and 150 inspected messages per run. No pagination, discovery, thread enumeration, parent fetch or failure retries.
- Each request times out after 10 seconds; redirects fail. Responses are streamed with a 1 MB limit. Invalid or oversized responses produce a limitation without echoing their bodies. HTTP 401 or 429 stops remaining channels; 403 permits independently authorized channels to continue.
- Enforce original message timestamps within the requested period and no later than fetch time. Discard bot/webhook/system messages, forwarded snapshots, promotions, missing text, invalid timestamps and mismatched channel references.
- Preserve returned IDs, author, URL, dates and up to 4,000 characters of message text. Attachments, embedded parent bodies and linked content are not imported. Cited HTTPS links remain unchecked leads.
- Keep up to 3 substantive replies with an exact same-channel parent reference, different author and valid chronological order, all from the same fetched page. Unknown parents are marked as unavailable context; do not invent their bodies. Nested replies are not treated as direct replies to the root.
- `discordContext` records scope, sample size, message bound, retained reply count, text clipping, access requirement and `discord_bot_api` method. No total comment count is invented. Emoji reaction counts are summed and are not unique users or a community popularity measure. No captured comments means no discussion quality score.
- All author claims remain unverified until specific primary-source reviews are supplied. Private message links can be verified only by readers with the appropriate server access. A missing-content or empty-history result is not proof of no discussion.

## Verification status

The adapter, gates, response limits, metadata checks, scoped replies, Chinese/English report and all-seven integration are covered by deterministic offline API-response tests. Authorized live acceptance now covers one user-owned isolated test server/channel: two official REST GETs returned HTTP 200 and read an ordinary, non-mention human message with the enabled MESSAGE_CONTENT intent. Public Bot is disabled; the Bot role enables only view/history permissions, and the test server's @everyone permissions are cleared to avoid inherited write access. Channel metadata contains no permission overrides. The configured scope contains exactly this one channel.

The message explicitly identifies itself as a synthetic acceptance fixture, not a community opinion. Its body, author, dates and link were normalized by replaying the saved parsed API responses with network fallback blocked. The original pipeline correctly selected no research items: the fixture has no real experience, engagement or replies and fails the research gate. The initial acceptance expectation that it should be selected is preserved as failed in `test.json`; corrected channel-read/normalization checks are in `acceptance.json`. No production gate was relaxed. Live direct-reply coverage remains untested in this single-human server; existing offline cases cover it. There were no additional X requests. The latest consolidated status and formal evidence are in the workspace's `artifacts/discord/readiness.md` and `manifest.json`; earlier five-platform evidence remains a separate snapshot.

Official references: [Message resource](https://docs.discord.com/developers/resources/message), [Channel resource](https://docs.discord.com/developers/resources/channel), [Gateway intents](https://docs.discord.com/developers/events/gateway#privileged-intents).
