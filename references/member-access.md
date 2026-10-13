# Member community access

## User outcome clarified on 2026-09-30

The user wants to connect selected Discord/Whop communities they join as an ordinary member and automatically extract high-value information across chats. The current Bot-only Discord adapter does not fulfill this requirement. Reddit remains deferred. Do not ask the user to create a server, fabricate discussion, or invite a second test identity as a substitute for this outcome.

## Verified documentation and remaining unknowns

- Discord ordinary OAuth `guilds` lists basic server information; it does not grant message history access. The documented `messages.read` scope belongs to local RPC, not a general REST history permission. RPC access has app/tester restrictions; this project's app has no verified RPC authorization. A user-installed command is not proof of background message access. [OAuth scopes](https://docs.discord.com/developers/topics/oauth2#oauth2-scopes), [RPC restrictions and authorization](https://docs.discord.com/developers/topics/rpc).
- Discord prohibits automating normal user accounts outside its OAuth2/Bot API. Do not request or extract a user-account token or describe self-bot/browser polling as a verified supported alternative. [Discord account automation policy](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots).
- Whop documents `GET /api/v1/messages`, a required channel/experience ID, paginated messages, author/time/content/reply fields, and `chat:read` (or the applicable DM/support permission). Authorization documentation explicitly lists a user OAuth token. This is a candidate for member access, not proof that an ordinary member can authorize arbitrary purchased communities. Official OAuth and Chat OAuth guides explicitly document user-authorized chat:read and PKCE. A preliminary implementation is now available; app setup, actual scope grant, resource access and live member reads remain unverified. [Whop OAuth](https://docs.whop.com/developer/guides/oauth), [Chat OAuth](https://docs.whop.com/developer/guides/chat/oauth). [Whop List messages](https://docs.whop.com/api-reference/messages/list-messages).
- A Whop membership may lead to an external Discord server; in that case Whop chat API support does not establish access to the Discord messages. [Whop membership Discord access](https://docs.whop.com/memberships-and-access/access-discord-server/access-a-discord-server).

## Historical next executable step (before browser acceptance)

Obtain one user-selected community/channel URL and whether it is a Whop-native chat or Discord. Verify a supported member authorization path and a bounded real read before building that collector. Membership alone must not be treated as access already granted to an integration. Keep access scoped to selected sources; do not enumerate unrelated private communities or change memberships/permissions.

If member authorization succeeds, implement a small multi-community slice: explicit source list, bounded incremental reads, deduplication, context-preserving high-value selection and an inspectable digest with links. Decide run cadence after collection works; no recurring automation has been created by this clarification.

Existing Bot code, gates and historical evidence remain available as a separate supported mode. Preserve prior manifests as historical snapshots. This note records documentation research and product requirements, not a formal live acceptance package.

## Current priority

The user now accepts retaining Whop at its current capability and asks that users bind their own desired communities. Version 1.14.0 adds local add/list/remove scope management and natural-language Skill routing; empty scope stops reads and every digest CLI invocation requires the bound scope. Membership/browser permission must be verified independently. No more delegated free-community scouting or joining is pending. See [Whop binding](whop-binding.md).

Both Discord and Reddit are now deferred. Two named Whop communities have passed bounded ordinary-member browser capture and combined highlights; see workspace artifacts/whop-member. AI for PROs was selected under the human's explicit free-community delegation and terms confirmation. On-demand scope is complete with recorded content/access limits; automation remains PAUSED and OAuth/API remains unverified. This does not authorize joining other communities or opening the external Skool destination. The historical next-step section above is no longer a pending input.

The user requested retaining Discord successes and prioritizing Whop. See [Whop setup](whop-access.md) for the implemented bounded slice and [delivery status](delivery-status.json) for current gates. Existing Bot fixture evidence remains a successful historical read, not member-workflow acceptance.

## Final scope after user stopped real-time research

On-demand bound member-browser reading is retained. Real-time receipt and author-triggered actions are not implemented. Whop App webhook permissions require creator installation/approval; creating our own business does not grant access to other creators' communities. The business name form was prepared but not submitted; there is no App grant or webhook subscription. The user has stopped this investigation. Preserve `artifacts/whop-push/` as failed feasibility evidence, not live delivery acceptance. Resume only on a new user request.

Whop's current terms restrict automated monitoring/scraping; do not infer permission for an always-on browser listener or private connection reuse from membership or past bounded browser tests. Any future implementation must verify the platform-permitted access method for that use. [Whop terms §5](https://whop.com/tos/).
