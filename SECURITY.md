# Security

To report a vulnerability, please use [GitHub Security Advisories](https://github.com/devenney/rss-to-social/security/advisories/new) rather than opening a public issue.

## Credential handling

Secrets (Bluesky app password, Mastodon access token) are stored as Cloudflare Worker secrets via `wrangler secret put` and never appear in any file in this repository. `wrangler.personal.toml` is gitignored.

## Dependencies

`npm audit` reports zero vulnerabilities. To verify: `npm audit`.
