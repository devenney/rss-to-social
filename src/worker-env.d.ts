// Extends the generated Env interface with runtime configuration.
// These bindings and secrets are not in wrangler.toml — they are set
// in wrangler.personal.toml (local) or via GitHub Actions secrets (CI).
interface Env {
  SEEN_POSTS: KVNamespace;
  RSS_FEED_URL: string;
  BLUESKY_HANDLE?: string;
  MASTODON_INSTANCE?: string;
  BLUESKY_APP_PASSWORD?: string;
  MASTODON_TOKEN?: string;
}
