// Extends the generated Env interface (worker-configuration.d.ts) with all
// runtime configuration. Nothing here is declared in wrangler.toml because
// all values are configured via the Cloudflare dashboard or Workers Builds
// environment variables — keep_vars = true preserves them across deployments.
interface Env {
  SEEN_POSTS: KVNamespace;
  RSS_FEED_URL: string;
  BLUESKY_HANDLE?: string;
  MASTODON_INSTANCE?: string;
  BLUESKY_APP_PASSWORD?: string;
  MASTODON_TOKEN?: string;
}
