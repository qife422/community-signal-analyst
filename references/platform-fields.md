# Platform Fields And Access Notes

## Common Fields

Capture these fields whenever available:

- `platform`
- `title`
- `url`
- `author`
- `published_at`
- `fetched_at`
- `content_type`: article, post, project, launch, repo, issue, discussion, comment thread
- `summary`
- `raw_excerpt`
- `engagement_metrics`
- `comments`
- `source_quality_score`
- `relevance_score`

Mark unavailable fields as `数据不可用`; do not infer exact metrics.

## Current Live Platforms

The code reads bounded samples from official HN, GitHub, and DEV APIs. Reddit, Product Hunt, and X adapters activate only with authorized credentials and the applicable X paid-read flag. These notes describe potential fields, not a claim that every field is collected today.

### Hacker News

Use for technical, startup, developer, AI tooling, and founder discussions.

Try to capture:

- `points`
- `comment_count`
- `story_type`: story, Ask HN, Show HN, job, poll
- `top_comments`
- `hn_rank` when from front page or ranked list

High-signal sources: front page stories, Ask HN with many substantive replies, Show HN launches with product feedback, threads with informed technical debate.

When an HN story includes an HTTPS outbound URL, the CLI retains it in `citedUrls` for source matching. A shared outbound URL across platforms identifies repeated coverage of one page; it does not verify claims on that page.

### GitHub

Use for open-source trend, developer pain, project quality, and technical adoption signals.

Try to capture:

- `repo_name`
- `owner`
- `stars`
- `forks`
- `open_issues`
- `recent_commits`
- `release_info`
- `readme_summary`
- representative issues, discussions, or user feedback

Watch GitHub Search API rate limits and query constraints. Star count alone is not enough; look for recency, issue quality, release activity, and discussion substance.

### dev.to

Use for developer articles, tutorials, experience reports, tool introductions, and discussion posts.

Try to capture:

- `title`
- `author`
- `tags`
- `reactions_count`
- `comments_count`
- `reading_time`
- `article_excerpt`

Treat DEV/Forem articles as mixed content: blog posts, tutorials, announcements, and community discussion.

## Credential-Gated Platforms

### Reddit

Use for subreddit discussions, user pain, consumer/product feedback, investment communities, AI communities, and controversial opinions.

Try to capture:

- `subreddit`
- `upvotes`
- `upvote_ratio`
- `comment_count`
- `post_flair`
- `top_comments`
- `controversial_comments`

The CLI requires approval for the specific use, `REDDIT_API_APPROVED=true`, an approved `REDDIT_ACCESS_TOKEN`, and a truthful `REDDIT_USER_AGENT` before calling OAuth search and comments endpoints. Login and app creation alone do not provide approval. Reddit research belongs to its sponsored academic RFR program, which uses BigQuery rather than this adapter; do not run this OAuth adapter for personal research. Search is a bounded sample; beware brigading, memes, bots, low-effort posts, and subreddit-specific bias.

### Product Hunt

Use for launches, new products, maker positioning, early user comments, and product category momentum.

Try to capture:

- `product_name`
- `tagline`
- `description`
- `upvotes`
- `comments_count`
- `maker`
- `launch_date`
- `topics`

The CLI uses `PRODUCT_HUNT_TOKEN` with API v2 GraphQL, samples up to 50 recent launches, and reads a small number of comments. The API requires auth and has use restrictions, including on commercial use. If unavailable, report missing access without substituting scraped data.

### X / Twitter

Use for real-time opinion, KOL comments, market sentiment, and spread velocity only when access is available.

Try to capture:

- `author_handle`
- `followers_count` if available
- `likes`
- `reposts`
- `replies`
- `views` if available
- `quoted_posts` if available

The current adapter makes one relevance-sorted recent-search request for up to 10 posts and requests `created_at`, `public_metrics`, `referenced_posts`, `note_post`, `entities`, and `author_id`, with author username expansion. It retains the available long-form text in JSON `rawExcerpt`, up to 5 HTTPS links in `citedUrls`, and marks claims `author_claim_unverified`. It does not fetch followers, views, quoted posts, comments, or linked pages. It filters thin and promotional posts and requires concrete evidence or experience; a popularity request also requires visible engagement. Research numbers in posts are author claims until the primary source is independently checked. Do not assume unlimited recent search or full firehose access. Mention API plan, auth, query, and recency limitations.

### X optional direct-reply sample

`X_REPLIES_ENABLED=true` explicitly opts into one additional potentially billable recent-search request alongside `X_API_ENABLED=true` and the bearer token. The query combines up to 3 selected root conversation IDs, asks for at most 10 replies, and retains up to 3 substantive direct replies per root. Responses are checked for the exact conversation and replied-to IDs, valid recent timestamps, duplicates, self-replies, reposts, short text, and promotions. No automatic pagination or retry. Missing or zero-quality replies stay missing.

`--reply-brief <saved-live-json>` avoids repeating root search. Per-comment provenance includes URL, author, parent item, timestamps, API-visible metrics, and retrieval method. `commentThemes` only index captured comments by workflow, defects, cost, performance, security, or methodology keywords; all stance labels remain neutral until an analyst reads the original comments. Selection scores retain their pre-reply values. A browser fallback must record `browser_visible` and must exclude X's recommended posts, quoted posts, and spam.

### Discord access

Implemented via the official Bot REST API v10 with `DISCORD_API_ENABLED`, `DISCORD_BOT_TOKEN`, and `DISCORD_SCOPE_FILE`. See [Discord access](discord-access.md). Up to 3 explicit guild/channel pairs, 50 latest messages per channel, and 3 substantive same-page direct replies per root. Preserve API text, IDs, dates and permission-required URLs; `discordContext` carries scope, clipping and sample size. Reactions sum emoji counts, not unique users; retained reply count is not the total. Missing text or history can reflect permissions. Do not import attachments or embedded parent bodies.

Do not design or attempt public all-Discord search. Treat Discord data as private/community-internal unless the user explicitly provides authorization and scope.

### Whop member chat trial

Preliminary official user OAuth and read-only collector, selected only by explicitly naming Whop. See [Whop access](whop-access.md). Up to 3 selected membership chat feeds, each verified against its selected experience then sampled for 50 latest messages; retain author, time, message/reply IDs, body and user-supplied channel URL. No exact message URL, total comments, unique reactors or member coverage is inferred. Offline API acceptance is complete; real member OAuth/API access remains unverified. Separately, the bound browser workflow has verified two selected member communities; it is on-demand and does not prove API or push access.

## Future Expansion Candidates

Medium, Substack, Indie Hackers, Lobsters, and Stack Overflow Blog can be added later for deeper content discovery. Mark them as future expansion unless explicitly requested and accessible.
