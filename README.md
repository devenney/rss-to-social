# rss-to-social

Automatically syndicate your RSS feed to **Bluesky** and **Mastodon**. Runs on Cloudflare Workers as a scheduled cron job. Open source — bring your own feed and credentials.

> **Dev.to:** has native RSS import built in — no adapter needed. See [dev.to/settings/extensions](https://dev.to/settings/extensions) to connect your feed directly. Posts land as drafts for you to review before publishing.

## Features

- Polls any RSS 2.0 feed on a configurable cron schedule
- Posts to **Bluesky** with a rich link card (OG title, description, thumbnail via AT Protocol embed)
- Posts to **Mastodon** with title, excerpt, and link (client-side preview generated automatically)
- Deduplicates via Cloudflare KV — each post syndicates exactly once
- Auto-bootstraps on first run: safe against back-catalogue flooding, no setup scripts required
- Adapters are optional — configure only the platforms you want; others are silently skipped
- Structured JSON logs for easy filtering in the Cloudflare dashboard

## Prerequisites

- [Cloudflare account](https://cloudflare.com) (free tier sufficient)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated (`wrangler login`)
- Node.js 22+

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/devenney/rss-to-social.git
cd rss-to-social
npm install
```

### 2. Create a KV namespace

```bash
wrangler kv namespace create SEEN_POSTS
wrangler kv namespace create SEEN_POSTS --preview
```

Copy both IDs from the output.

### 3. Create `wrangler.personal.toml`

```bash
cp wrangler.personal.toml.example wrangler.personal.toml
```

Edit `wrangler.personal.toml` with your values:

```toml
[[kv_namespaces]]
binding = "SEEN_POSTS"
id = "your-production-id"
preview_id = "your-preview-id"

[vars]
RSS_FEED_URL = "https://your-site.com/rss.xml"
BLUESKY_HANDLE = "you.bsky.social"
MASTODON_INSTANCE = "mastodon.social"
```

This file is gitignored and never committed.

### 4. Obtain credentials

- **Bluesky:** [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords) → Add App Password
- **Mastodon:** `https://[instance]/settings/applications` → New Application, tick `write:statuses`

### 5. Set secrets

```bash
wrangler secret put BLUESKY_APP_PASSWORD --config wrangler.personal.toml
wrangler secret put MASTODON_TOKEN       --config wrangler.personal.toml
```

### 6. Create `.dev.vars`

```bash
cp .dev.vars.example .dev.vars
```

Fill in all values from steps 3–5.

### 7. Deploy

```bash
npm run deploy
```

The worker auto-bootstraps on its first cron tick — no manual setup needed.

---

## How auto-bootstrap works

On its first run the worker records the current timestamp as a **sync floor**. Any post published before that time is permanently skipped — protecting against back-catalogue flooding on first deploy.

After that, only posts published after the sync floor are syndicated. Seen GUIDs are tracked in KV to prevent duplicates.

If the KV namespace is ever wiped, the sync floor resets to now on the next run. To intentionally backfill from a specific date:

```bash
npm run bootstrap -- --from=2026-01-01
```

---

## Re-syndicating a missed post

If a post was skipped due to adapter downtime or a transient error:

```bash
npm run nudge -- --url=https://your-site.com/blog/the-missed-post
```

This removes the post's GUID from KV. The next cron tick re-syndicates it.

---

## Automatic deploys (optional)

To deploy automatically on every push to `main`, add these secrets to your GitHub repository (**Settings → Secrets and variables → Actions**) and re-add the deploy job to `.github/workflows/ci-deploy.yml`:

| Secret | Notes |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → any Workers page → right sidebar |
| `KV_NAMESPACE_ID` | Your production KV namespace ID |
| `RSS_FEED_URL` | Your feed URL |
| `BLUESKY_HANDLE` | Your Bluesky handle |
| `MASTODON_INSTANCE` | Your Mastodon instance |

Releases and changelogs are managed automatically by [release-please](https://github.com/googleapis/release-please) from [conventional commits](https://www.conventionalcommits.org/).

---

## Configuration reference

### Cron schedule

Edit `wrangler.personal.toml`:

```toml
[triggers]
crons = ["0 * * * *"]   # hourly; adjust to taste
```

### Adding an adapter

1. Create `src/adapters/your-platform.ts` implementing `SocialAdapter` (see `src/ports/social.ts`)
2. Add tests in `test/adapters/your-platform.spec.ts`
3. Register it in `src/config.ts`

---

## Local development

```bash
npm run dev        # wrangler dev with wrangler.personal.toml
npm test           # run tests (in-memory KV, no network calls)
npm run lint       # lint
npm run typecheck  # type-check worker and scripts
```

---

## License

MIT
