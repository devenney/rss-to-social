# rss-to-social — Design Spec

**Date:** 2026-06-14
**Status:** Approved

---

## Problem

Publishing a blog post is one action; getting it in front of people across multiple platforms is five more. This project automates syndication from any RSS feed to Bluesky, Mastodon, and Dev.to — running as a Cloudflare Worker cron job with zero ongoing maintenance.

It is open source and fully configurable: every URL, handle, and credential is an environment variable. No values are hardcoded.

---

## Architecture

A Cloudflare Worker fires on a configurable cron schedule. On each tick it:

1. Guards against uninitialised state (KV sentinel check)
2. Fetches the RSS feed
3. Diffs it against KV to find unseen posts
4. Syndicates each unseen post through all active adapters (independently — one adapter failing does not block others)
5. Records each syndicated GUID in KV

Three built-in adapters implement a common `SocialAdapter` interface. An adapter is skipped gracefully if its required secret is absent — no crash, no noise.

---

## File Layout

```
rss-to-social/
├── src/
│   ├── index.ts               # scheduled handler — orchestrates the run
│   ├── rss.ts                 # fetch + parse RSS into typed RssItem[]
│   ├── config.ts              # validate env, build adapter list
│   ├── ports/
│   │   └── social.ts          # SocialAdapter interface
│   └── adapters/
│       ├── bluesky.ts         # AT Protocol; embed card via OG tags
│       ├── mastodon.ts        # Mastodon REST API
│       └── devto.ts           # Dev.to API; full cross-post with canonical_url
├── scripts/
│   ├── bootstrap.ts           # seed all current feed GUIDs into KV (run once)
│   └── nudge.ts               # remove a GUID from KV to allow re-syndication
├── test/
│   ├── adapters/
│   │   ├── bluesky.spec.ts
│   │   ├── mastodon.spec.ts
│   │   └── devto.spec.ts
│   ├── rss.spec.ts
│   └── worker.spec.ts
├── .github/
│   └── workflows/
│       ├── ci.yml             # lint, type-check, test on PR
│       └── deploy.yml         # ci + wrangler deploy on push to main
├── .dev.vars.example          # committed; documents all required secrets
├── wrangler.toml
├── vitest.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Data Flow

```
cron tick
  → check KV["_bootstrapped"] — absent → log error, exit (no syndication)
  → fetch RSS_FEED_URL
  → parse items, sort oldest-first
  → for each item:
      → check KV["seen:{guid}"]
      → if not seen:
          → run each active adapter (failures isolated per adapter)
          → write KV["seen:{guid}"] = ISO timestamp
  → emit structured log summary
```

Oldest-first ordering ensures a partial run on failure resumes correctly on the next tick.

---

## KV Schema

| Key | Value | Purpose |
|---|---|---|
| `_bootstrapped` | ISO timestamp | Sentinel. Absent → worker exits without publishing. |
| `seen:{guid}` | ISO timestamp | Dedup record. Timestamp = when syndicated. |

The `_bootstrapped` key protects against a KV namespace wipe causing silent re-syndication of the entire feed. Without it, a wipe is undetectable and catastrophic. With it, the worker fails safely and visibly.

---

## Configuration

### `wrangler.toml` vars (non-secret)

```toml
[vars]
RSS_FEED_URL       = "https://example.com/rss.xml"
BLUESKY_HANDLE     = "you.bsky.social"
MASTODON_INSTANCE  = "mastodon.social"
```

### Secrets (via `wrangler secret put`)

| Secret | Required for |
|---|---|
| `BLUESKY_APP_PASSWORD` | Bluesky adapter |
| `MASTODON_TOKEN` | Mastodon adapter |
| `DEVTO_API_KEY` | Dev.to adapter |

All three are optional. An adapter whose secret is absent is silently skipped on every run. This means you can deploy with only a subset of adapters active.

### Cron schedule

Configured in `wrangler.toml`:

```toml
[triggers]
crons = ["0 * * * *"]   # every hour; adjust to taste
```

### Local dev

Secrets go in a gitignored `.dev.vars` file (see `.dev.vars.example` for the template). The preview KV namespace is used automatically by `wrangler dev`.

---

## Adapter Specifications

### Bluesky

- Protocol: AT Protocol (`com.atproto.repo.createRecord`, `app.bsky.feed.post`)
- Character limit: 300 graphemes
- Post body: 1–2 sentence excerpt, ≤200 chars (leaves room for any future additions)
- Embed: `app.bsky.embed.external` card, populated from OG tags fetched from the post URL (title, description, thumbnail blob uploaded via `com.atproto.repo.uploadBlob`)
- URL lives in the embed card only — not duplicated in body text
- Auth: app password via `BLUESKY_APP_PASSWORD`

### Mastodon

- Protocol: Mastodon REST API (`POST /api/v1/statuses`)
- Character limit: 500 (default; instance-configurable — we target the 500 char baseline)
- Post body: title + 1–2 sentence excerpt + canonical URL
- URL in body text is sufficient — Mastodon clients generate link previews automatically
- Instance: configurable via `MASTODON_INSTANCE`
- Auth: OAuth access token via `MASTODON_TOKEN`

### Dev.to

- Protocol: Dev.to API (`POST /api/articles`)
- Content: full post body (Markdown), sourced from RSS `<content:encoded>` or `<description>`
- `canonical_url`: set to the original post URL on the source site — preserves SEO, prevents duplicate content penalty
- `canonical_url`: set to the RSS item's `<link>` value directly — this is the full URL of the original post and requires no additional configuration
- `published`: `true` — posts immediately on syndication
- Auth: API key via `DEVTO_API_KEY`

---

## Bootstrap and Nudge

These scripts run locally via `tsx` (TypeScript execution, no compile step). They use `wrangler kv:bulk` and `wrangler kv:key` under the hood — no extra credentials beyond normal wrangler auth.

### `npm run bootstrap`

Run once before first deploy. Safe to re-run at any time (idempotent).

1. Fetches `RSS_FEED_URL` (from `.dev.vars` or env)
2. Parses all items
3. Writes `seen:{guid}` for every item to the **production** KV namespace
4. Writes `_bootstrapped` = ISO timestamp

Re-running after a KV wipe restores the correct seen-set for all posts currently in the feed. Posts that have aged out of the feed cannot be re-syndicated regardless (the worker cannot see them).

### `npm run nudge -- --url <post-url>`

Marks a specific post as unseen, allowing the next cron tick to re-syndicate it via all active adapters.

1. Derives the GUID from the provided URL (matches against current RSS feed)
2. Deletes `seen:{guid}` from KV
3. Preserves `_bootstrapped`

Used when a post was missed due to adapter downtime or a transient error.

---

## Error Handling

| Failure | Behaviour |
|---|---|
| `_bootstrapped` missing | Exit immediately, log warning, no syndication |
| RSS fetch fails | Exit, log error, retry on next tick |
| One adapter fails | Log error, continue with remaining adapters |
| All adapters fail | GUID still marked as seen (partial success) — use nudge to retry |
| OG fetch fails (Bluesky) | Post without embed card rather than failing the adapter |

All log output is structured JSON for easy filtering in Cloudflare's dashboard.

---

## Testing

- **Runtime**: `@cloudflare/vitest-pool-workers` — tests run in real `workerd`, not Node shims
- **KV**: real in-memory namespace via Miniflare, seeded per test in `beforeEach`
- **HTTP**: `fetchMock` from `cloudflare:test` — zero outbound calls in unit tests
- **Integration tests**: marked `test.skipIf(process.env.CI)` — skipped in CI, runnable locally on demand against real APIs
- **Scripts**: tested as plain Node/tsx scripts, separately from the Worker test suite

---

## CI/CD

### Workflows

**`ci.yml`** — triggers on pull request:
- `eslint` (lint)
- `tsc --noEmit` (type-check)
- `vitest run` (unit tests)

**`deploy.yml`** — triggers on push to `main`:
- Runs full CI suite first
- `wrangler deploy` on success

### Release management

`release-please` manages semantic versioning and changelog generation. On merge to `main` it opens a release PR; merging that PR tags the release and generates `CHANGELOG.md` entries from conventional commit messages.

Conventional commits are enforced locally via `commitlint` + `husky`.

### Secrets (GitHub Actions)

| Secret | Used by |
|---|---|
| `CLOUDFLARE_API_TOKEN` | `wrangler deploy` |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler deploy` |

---

## Open Source Considerations

- All example values in `wrangler.toml`, `.dev.vars.example`, and `README.md` use generic placeholders (`https://example.com/rss.xml`, `you.bsky.social`, etc.)
- No hardcoded URLs, handles, or instance names anywhere in source
- `README.md` includes a full setup guide: fork → configure → bootstrap → deploy
- `LICENSE`: MIT
