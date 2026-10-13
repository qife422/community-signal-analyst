# Abstract API Contract

This reference describes a possible expanded HTTP connector API. The current implementation is the local TypeScript CLI with `src/adapters/live.ts`,  `src/adapters/authorized.ts`, `src/adapters/x.ts` and `src/adapters/discord.ts`, not these HTTP endpoints. Reddit and Product Hunt require explicit credentials; X and Discord access is not implied.

```yaml
openapi: 3.1.0
info:
  title: Community Signal Analyst Connector API
  version: 0.1.0
  description: Abstract search and normalization API for community signal collection.
paths:
  /parseQuery:
    post:
      summary: Parse a natural-language research request.
      requestBody:
        required: true
      responses:
        "200":
          description: Parsed topic, keywords, platforms, time range, and analysis mode.
  /searchHackerNews:
    post:
      summary: Search Hacker News stories and comments.
      responses:
        "200":
          description: Normalized HN candidates.
  /searchGitHub:
    post:
      summary: Search GitHub repositories, issues, discussions, and releases.
      responses:
        "200":
          description: Normalized GitHub candidates.
  /searchDevTo:
    post:
      summary: Search dev.to/Forem articles and metadata.
      responses:
        "200":
          description: Normalized dev.to candidates.
  /searchReddit:
    post:
      summary: Search Reddit posts and comments where API/auth access permits.
      responses:
        "200":
          description: Normalized Reddit candidates.
  /searchProductHunt:
    post:
      summary: Search Product Hunt launches and comments where GraphQL auth permits.
      responses:
        "200":
          description: Normalized Product Hunt candidates.
  /searchX:
    post:
      summary: Search X/Twitter recent posts where API access permits.
      responses:
        "200":
          description: Normalized X candidates.
  /searchDiscord:
    post:
      summary: Search authorized Discord servers or channels only.
      responses:
        "200":
          description: Normalized Discord candidates.
  /rankCandidates:
    post:
      summary: Score and select high-signal candidates.
      responses:
        "200":
          description: Ranked candidates with score explanations.
```

Implementation requirements:

- Require auth metadata per platform; never hardcode keys.
- Return `fetched_at` for every candidate.
- Include raw source URLs and platform IDs for audit.
- Distinguish missing fields from zero values.
- Propagate rate-limit and permission errors into the final data limitations section.
