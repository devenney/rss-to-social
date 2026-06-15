// Extends the generated Env interface (worker-configuration.d.ts) with bindings
// and secrets not declared in wrangler.toml:
//   - SEEN_POSTS: configured via Cloudflare dashboard (no namespace ID in template)
//   - Secrets: set via `wrangler secret put`, never in any config file
interface Env {
  SEEN_POSTS: KVNamespace;
  BLUESKY_APP_PASSWORD?: string;
  MASTODON_TOKEN?: string;
}
