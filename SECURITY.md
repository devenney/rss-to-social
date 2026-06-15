# Security

## Reporting vulnerabilities

Please report security issues by emailing **brendan.devenney@approov.io** rather than opening a public GitHub issue. I aim to respond within 72 hours.

## Credential handling

This project handles three types of live credentials:

| Credential | Storage |
|---|---|
| Bluesky app password | Cloudflare Worker secret (`wrangler secret put`) |
| Mastodon access token | Cloudflare Worker secret (`wrangler secret put`) |
| Dev.to API key | Cloudflare Worker secret (`wrangler secret put`) |
| Cloudflare API token | GitHub Actions secret |

Secrets are never written to any file in this repository. The `wrangler.personal.toml` file (which contains KV namespace IDs — non-sensitive identifiers, not credentials) is gitignored.

## npm audit

This project maintains zero `npm audit` vulnerabilities. Runtime dependencies bundled into the deployed worker are audited strictly. Dev tooling vulnerabilities in `esbuild` (locked by `wrangler`) are patched via `package.json` overrides where possible.

To verify: `npm audit`
