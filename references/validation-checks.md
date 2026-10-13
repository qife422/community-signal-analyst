# Validation Checks

Before claiming the skill or an implementation is ready, verify:

- Query parsing extracts topic, keywords, platforms, time range, output count, and analysis mode. The current public-platform delivery excludes Discord and Reddit using explicit exclusions; Whop member-browser digests use their own bound capture workflow. Legacy `全平台（不含 Reddit）` / `all platforms except Reddit` / six-platform wording remains compatibility behavior. Verify zero Reddit requests even if synthetic Reddit credentials and approval flags are present; platform exclusions must not become topic keywords. Retain explicit seven-platform compatibility.
- Public HN, GitHub, and DEV samples work without additional credentials. Reddit queries only when the token, identifying User-Agent, and explicit use-case approval flag are all set; Product Hunt requires its authorized token. X requires its Bearer Token and explicit paid-read flag; it makes one bounded search and filters replies, promotions, shallow content, and low-engagement posts when popularity was requested. Missing access produces a limitation and no substitute data. Discord requires an enabled authorized bot and a validated file containing 1–3 explicit guild/channel pairs. Missing scope or credentials means zero requests; mismatched metadata blocks message access. Scope, direct replies, timestamps, content limits and permission-required report labels are covered by offline tests. Ordinary message content was read in the authorized marked-fixture test; final real-discussion/different-author-reply acceptance remains pending in delivery-status.json.
- Saved history requires `--history`; comparison is limited to the same query, source, and metric, with no platform-wide growth claim.
- A one-sentence user request can produce up to 2-3 source-backed high-value items by default; explicit larger counts up to 10 are honored only when evidence qualifies.
- Articles, posts, projects, comments, and engagement metrics are distinguished.
- Platform API/auth/rate-limit limits are visible in the output.
- Scoring uses relevance, engagement, freshness, source quality, discussion quality, and novelty with mode-specific weights; cross-platform duplicate projects are linked rather than counted twice.
- Comment extraction favors information density over raw upvotes alone.
- The final report follows the Community Signal Brief structure.
- No real posts, comments, metrics, or claims are fabricated. Final Discord research acceptance requires a genuine substantive human discussion and a substantive direct reply from a different human with the exact same-channel parent. A marked fixture proves API access only; preserve the distinction and keep final status pending until real evidence exists.
- Any illustrative content is labeled `示例数据`.
- Investment research avoids direct buy/sell advice and emphasizes sentiment, disagreement, risk, and uncertainty.
- Low-quality marketing, spam, bot-like activity, and shallow hype are filtered or caveated.
- Source links and fetched timestamps are preserved for human review.
- English requests produce English reports; JSON output preserves structured evidence and limitations.
- X long-form text, author, and cited HTTPS links are retained when the API provides them; linked pages are not silently treated as verified research. Tests cover the one-request bound and the unverified-claim label.
- Shared canonical links across X, HN, and GitHub group a repeated project once and keep secondary links. Similar titles are marked as an unverified heuristic; distinct issues within one repository stay separate. The report must not label shared-source repetition as independent claim verification.
- Run the labeled X quality corpus in `tests/x-quality-eval.test.ts`. It uses paraphrased and synthetic cases across several topics to catch known false positives and false negatives. Passing this fixed corpus is a regression check, not an estimate of real-world precision or recall.
- Claim imports preserve post attribution, primary URL, assessment, limits, timestamps, and passage fingerprint. Wrong identity/claim/excerpt/hash, conflicting records, oversized inputs, and invented evidence for inaccessible sources are rejected. Offline `--verify-brief` makes no collection requests. Only listed claims are reviewed; the importer checks integrity, not semantic truth.
- Optional X replies require the separate reply-read flag, paid-read flag and token; one request, at most 10 replies across 3 roots and 3 retained direct replies per root. Exact parent/conversation and time checks exclude nested or recommended posts. Preserve comment links, retrieval method, timestamps and original ranking; topic keywords do not imply stance or consensus. A browser-visible sample is identified separately from an API sample.

## Artifact Capacity And Evidence

- A saved brief or claim-review input is limited to 1 MB; reviews are limited to 30, with at most 12,000 characters of source context each. History is limited to 100 snapshots or 1 MB. These limits stop processing or growth, never authorize cleanup.
- For one formal evidence package, stop at 1 MB, 30 files, or 10 times the measured `src/` byte size, whichever is reached first. Save only the selected baseline, bounded source passages, browser observations, review records, report, validation log and manifest. Record provenance, extraction/commands, applicable acceptance criteria, inventory and SHA-256. Full HTML, build trees and dependencies are not evidence by default.
- TypeScript `dist/` is regenerable output: stop growth at 10 MB, 200 files or 10 times `src/` bytes. `node_modules/` is the existing dependency runtime: stop installing at 200 MB, 2,000 files or 1,000 times `src/` bytes. Dependencies have a separate threshold because package size is independent of application source size. Record both absolute and relative sizes; do not hide them in a source-only total.
- Temporary fixtures and fetch guards belong in the system temporary directory; use a caller-selected location for durable evidence. Never move, compress, replace or remove old directories based on a passing stage or capacity warning. On any threshold, stop growing that class of artifact, inventory exact paths read-only and report the impact. No automatic cleanup.

Forward-test with prompts such as:

- `Use $community-signal-analyst to find recent high-signal discussions about AI coding tools.`
- `Use $community-signal-analyst to summarize how communities are reacting to NVDA earnings.`
- `Use $community-signal-analyst to find Product Hunt, Hacker News, or GitHub signals about agentic coding tools.`
