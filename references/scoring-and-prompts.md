# Scoring, Comment Selection, And Prompts

## Candidate Scoring

The CLI computes a 0–100 heuristic score with these weights, in order: relevance, engagement, freshness, source quality, discussion quality, novelty.

| Mode | Weights |
|---|---|
| General | 0.35, 0.15, 0.15, 0.15, 0.15, 0.05 |
| Product research | 0.30, 0.10, 0.10, 0.15, 0.30, 0.05 |
| Investment research | 0.30, 0.10, 0.25, 0.20, 0.15, 0 |
| AI trend | 0.30, 0.15, 0.20, 0.15, 0.10, 0.10 |
| Content ideas | 0.30, 0.25, 0.15, 0.10, 0.15, 0.05 |
| Developer tools | 0.30, 0.15, 0.10, 0.15, 0.20, 0.10 |

Scores are candidate-ranking aids, not measurements of community sentiment or growth.

For live cross-platform results, the CLI first removes duplicate IDs within a platform, then groups items sharing a canonical project or source URL. Strong title overlap can group a likely duplicate but must be labeled for human review. Preserve the secondary source link. Two platforms linking to the same article or repository show distribution of one source, not independent confirmation of its claims. Separate GitHub issues remain separate discussions even in one repository.

X candidates first pass a substance gate: relevance, language-aware minimum text length, no reply/repost or direct promotion, and a specific method plus outcome. Quantitative studies and substantive third-party reports can qualify; qualitative first-hand reports also need concrete context. A workflow list without an observed outcome and high engagement without evidence are insufficient. Requests for popular posts add a visible-engagement floor. Likes, reposts, and reply counts contribute to engagement, but missing comments give discussion quality zero. A bounded evidence-density bonus affects X ranking; quoted research figures remain author claims until the original source is checked.

Optional modifier:

- Add a small `cross_platform_signal` boost when similar topics recur across multiple independent platforms.
- Reduce score for marketing-heavy sources, bot-like activity, shallow hype, missing links, or unverifiable metrics.

For the final narrative, account for mode-specific evidence: product research needs direct pain-point evidence, investment research needs freshness and viewpoint diversity, developer tools need adoption feedback, and content ideas need a clear discussion angle. These judgments should not be inferred from the numeric score alone.

Use relative 0-100 scores if exact normalization is unavailable. Explain major ranking assumptions when data is incomplete.

## Comment Selection

Prefer comments that contain:

- High engagement plus substance.
- First-hand product or usage experience.
- Clear causal reasoning.
- Professional or developer context.
- Representative disagreement.
- Pain points, bugs, pricing, alternatives, market expectations, or adoption blockers.
- Controversy with informational value.

Avoid:

- Abuse or slurs.
- Pure jokes or memes.
- Very short low-information reactions.
- Obvious ads or self-promotion.
- Contextless excerpts that would mislead.

## Reusable Prompts

### Candidate Filtering

Given the user query, parsed topic, platform candidates, source links, timestamps, and available metrics, rank candidates for community signal value. Prefer 2-3 items that are recent, relevant, verifiable, discussion-rich, and useful for the requested analysis mode. Penalize low-quality marketing, missing sources, shallow engagement, or unverifiable claims. Return scores, reasons, and rejected-near-miss notes.

### Comment Extraction

From the available comment thread, select a small set of representative high-information comments. Balance high-engagement comments with substantive dissent, first-hand experience, technical details, pain points, pricing, alternatives, and market judgment. Do not quote long passages. If comments are unavailable, say so plainly.

### Single Item Analysis

Analyze this item as community signal, not generic news. Explain what it is, why it is getting attention, what the community seems to agree/disagree on, what the engagement data does and does not prove, what a product/investment/content/AI-tool researcher can learn, and what uncertainties remain.

### Cross-Platform Trend Analysis

Compare the selected items across platforms. Identify shared themes, divergent community attitudes, repeated keywords, emerging opportunities, weak signals worth monitoring, and likely platform bias. Do not overstate patterns from only 2-3 items.

### Final Brief Generation

Write a concise Community Signal Brief in the requested language. Preserve every source link, publication time, fetched time, and metric caveat. Include a fast conclusion, selected items, cross-platform synthesis, next steps, and data limitations.
