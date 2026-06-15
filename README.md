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

---

## Deployment options

| Method | Requires | Best for |
|---|---|---|
| [Workers Builds](#deploying-via-workers-builds) | GitHub account, Cloudflare account | Dashboard-first, no local tooling |
| [Wrangler CLI](#deploying-via-wrangler-cli) | Node.js 22+, Wrangler CLI | Local control, CI/CD pipelines |

---

## Deploying via Workers Builds

Cloudflare automatically deploys on every push to your default branch. All configuration lives in the Cloudflare dashboard.

### Important: how configuration works

`wrangler deploy` treats `wrangler.toml` as authoritative for the bindings it declares. This project uses `keep_vars = true` so that environment variables and secrets you set in the dashboard are preserved across deployments. **The KV namespace binding must be injected at build time** (see step 3) because dashboard-only bindings are cleared by each `wrangler deploy`.

### 1. Fork and connect

1. Fork this repository on GitHub
2. In the [Cloudflare dashboard](https://dash.cloudflare.com) go to **Workers & Pages → Create**
3. Choose **Connect to Git** and select your fork
4. Leave all build settings as defaults for now — you'll add a build command in step 3
5. Click **Save and Deploy**

### 2. Create a KV namespace

1. Go to **Storage & Databases → Workers KV → Create instance**
2. Name it `rss-to-social-kv` (any name is fine)
3. Copy the namespace ID — you'll need it in the next step

### 3. Configure the build command

The KV namespace binding must be injected at build time so it survives every deployment.

In Workers Builds → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `KV_NAMESPACE_ID` | The namespace ID from step 2 |

Then in Workers Builds → **Settings → Build configuration**, set the **Build command** to:

```bash
printf '\n[[kv_namespaces]]\nbinding = "SEEN_POSTS"\nid = "%s"\n' "$KV_NAMESPACE_ID" >> wrangler.toml
```

This appends the KV binding to `wrangler.toml` before each deployment so the binding is never lost.

Trigger a new deployment after saving — either push a commit or click **Trigger deploy**.

### 4. Set environment variables

In your Worker → **Settings → Variables and Secrets**:

| Variable | Value |
|---|---|
| `RSS_FEED_URL` | `https://your-site.com/rss.xml` |
| `BLUESKY_HANDLE` | `you.bsky.social` |
| `MASTODON_INSTANCE` | `mastodon.social` |

These are preserved across deployments by `keep_vars = true` in `wrangler.toml`.

### 5. Set secrets

In the same section, add as **Secret** (encrypted):

| Secret | How to get it |
|---|---|
| `BLUESKY_APP_PASSWORD` | Settings → Privacy and Security → App Passwords ([bsky.app](https://bsky.app/settings/app-passwords)) |
| `MASTODON_TOKEN` | Settings → Development → Your Applications → `write:statuses` scope ([mastodon.social](https://mastodon.social/settings/applications)) |

### 6. Wait for the first cron tick

The worker runs hourly by default. On its **first run** it auto-bootstraps: it records the current time as a sync floor and exits without publishing anything. On the **next run**, only posts published after that time are syndicated.

Trigger a manual run any time via the **Triggers** tab on your Worker.

---

## Deploying via Wrangler CLI

Full local control. Configuration lives in a gitignored `wrangler.personal.toml` so it never touches the repository.

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

Copy both IDs — you'll need them in the next step.

### 3. Create `wrangler.personal.toml`

```bash
cp wrangler.personal.toml.example wrangler.personal.toml
```

Edit `wrangler.personal.toml` with your KV namespace IDs, RSS URL, and social handles. This file is gitignored and never committed.

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

Fill in your values. This file is gitignored and is used by `npm run dev` and `npm run bootstrap`.

### 7. Deploy

```bash
npm run deploy
```

The worker auto-bootstraps on its first cron tick.

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

## Configuration reference

### Cron schedule

Edit `wrangler.toml` (or your `wrangler.personal.toml`):

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
