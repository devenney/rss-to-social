# rss-to-social

Automatically syndicate your RSS feed to **Bluesky**, **Mastodon**, and **Dev.to**. Runs on Cloudflare Workers as a scheduled cron job. Open source — bring your own feed and credentials.

## Features

- Polls any RSS 2.0 feed on a configurable cron schedule
- Posts to **Bluesky** with a rich link card (OG title, description, thumbnail via AT Protocol embed)
- Posts to **Mastodon** with title, excerpt, and link (client-side preview generated automatically)
- Cross-posts to **Dev.to** with full content and `canonical_url` pointing to your original post — SEO preserved
- Deduplicates via Cloudflare KV — each post syndicates exactly once
- Auto-bootstraps on first run: safe against back-catalogue flooding, no setup scripts required
- Adapters are optional — configure only the platforms you want; others are silently skipped
- Structured JSON logs for easy filtering in the Cloudflare dashboard

## Prerequisites

- [Cloudflare account](https://cloudflare.com) (free tier sufficient)
- Node.js 22+ (only needed if deploying manually via CLI)

---

## Deploying via Cloudflare dashboard (recommended)

No local setup required. Everything is configured in the Cloudflare dashboard.

### 1. Fork this repository

Fork on GitHub so you own a copy.

### 2. Connect to Workers Builds

In the [Cloudflare dashboard](https://dash.cloudflare.com):

1. Go to **Workers & Pages → Create**
2. Choose **Connect to Git**, select your fork
3. Leave all build settings as defaults — no build command needed
4. Click **Save and Deploy**

Cloudflare runs `npm ci` then `npx wrangler deploy` automatically. The worker deploys on every push to your default branch.

### 3. Create a KV namespace

1. Go to **Workers & Pages → KV → Create namespace**
2. Name it `rss-to-social-kv` (or any name you like)
3. Go to your Worker → **Settings → Bindings → Add binding**
4. Choose **KV Namespace**, set variable name to `SEEN_POSTS`, select the namespace you just created

### 4. Set environment variables

In your Worker → **Settings → Variables and Secrets**:

| Variable | Value |
|---|---|
| `RSS_FEED_URL` | `https://your-site.com/rss.xml` |
| `BLUESKY_HANDLE` | `you.bsky.social` |
| `MASTODON_INSTANCE` | `mastodon.social` |

### 5. Set secrets (encrypted)

In the same Variables and Secrets section, add as **Secret** (encrypted):

| Secret | How to get it |
|---|---|
| `BLUESKY_APP_PASSWORD` | Settings → Privacy and Security → App Passwords ([bsky.app](https://bsky.app/settings/app-passwords)) |
| `MASTODON_TOKEN` | Settings → Development → Your Applications → write:statuses scope |
| `DEVTO_API_KEY` | Settings → Extensions → DEV Community API Keys ([dev.to](https://dev.to/settings/extensions)) |

### 6. Trigger a deploy

Push any commit to your fork (or use the **Trigger deploy** button in the dashboard). The worker deploys automatically.

### 7. Wait for the first cron tick

The worker runs on the schedule in `wrangler.toml` (default: hourly). On its **first run** it auto-bootstraps: marks all posts currently in your feed as already-seen without publishing them. On the **second run** onwards, only new posts are syndicated.

You can trigger a manual run at any time: **Workers → your worker → Triggers → Send Cron Event**.

---

## Deploying via CLI (alternative)

Use this if you want to run tests locally before deploying, or need full control over the build pipeline.

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/rss-to-social.git
cd rss-to-social
npm install
```

### 2. Create KV namespaces

```bash
wrangler kv namespace create SEEN_POSTS
wrangler kv namespace create SEEN_POSTS --preview
```

### 3. Create `wrangler.personal.toml`

```bash
cp wrangler.personal.toml.example wrangler.personal.toml
```

Fill in the KV namespace IDs from step 2, your RSS URL, social handles.

### 4. Obtain credentials

See the platform-specific instructions:

- **Bluesky:** [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords) → Add App Password
- **Mastodon:** `https://[instance]/settings/applications` → New Application, tick `write:statuses`
- **Dev.to:** [dev.to/settings/extensions](https://dev.to/settings/extensions) → Generate API Key

### 5. Set secrets

```bash
wrangler secret put BLUESKY_APP_PASSWORD --config wrangler.personal.toml
wrangler secret put MASTODON_TOKEN       --config wrangler.personal.toml
wrangler secret put DEVTO_API_KEY        --config wrangler.personal.toml
```

### 6. Set up local `.dev.vars`

```bash
cp .dev.vars.example .dev.vars
```

Edit with your values (used by `npm run dev` and local testing).

### 7. Deploy

```bash
npm run deploy
```

The worker auto-bootstraps on its first cron tick — no separate bootstrap step needed.

---

## How auto-bootstrap works

On its first run the worker records the current timestamp as a **sync floor**. Any post with a publication date before that timestamp is permanently skipped — protecting against back-catalogue flooding if the worker is deployed to a feed with existing posts.

After that, only posts published after the sync floor are syndicated. Seen GUIDs are tracked in KV to prevent duplicates within that window.

If the KV namespace is ever wiped: the sync floor is re-set to now on the next run. Posts published between the original floor and the re-bootstrap will not be re-syndicated. To intentionally backfill a specific date range, use the bootstrap script:

```bash
npm run bootstrap -- --from=2026-01-01
```

---

## Re-syndicating a missed post

If a post was skipped due to adapter downtime or a transient error:

```bash
npm run nudge -- --url=https://your-site.com/blog/the-missed-post
```

This removes the post's GUID from KV. The next cron tick re-syndicates it through all active adapters.

---

## GitHub Actions CI/CD (optional)

If you want lint → typecheck → test to run before every deploy, use GitHub Actions instead of (or in addition to) Workers Builds.

Add these secrets to your GitHub repository (**Settings → Secrets and variables → Actions**):

| Secret | Notes |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → any Workers page → right sidebar |
| `KV_NAMESPACE_ID` | The production namespace ID from `wrangler kv namespace create` |
| `RSS_FEED_URL` | Your feed URL |
| `BLUESKY_HANDLE` | Your Bluesky handle |
| `MASTODON_INSTANCE` | Your Mastodon instance hostname |

Push to `main` to trigger CI and deploy. Releases are managed by [release-please](https://github.com/googleapis/release-please) from [conventional commits](https://www.conventionalcommits.org/).

---

## Configuration reference

### Cron schedule

Edit `wrangler.toml` (or your fork):

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
