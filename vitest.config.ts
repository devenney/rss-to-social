import { cloudflarePool, cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// SEEN_POSTS is not in wrangler.toml (configured via Cloudflare dashboard at runtime).
// Miniflare creates it in-memory for tests.
const workerOptions = {
  wrangler: { configPath: './wrangler.toml' },
  miniflare: { kvNamespaces: ['SEEN_POSTS'] },
};

export default defineConfig({
  plugins: [cloudflareTest(workerOptions)],
  test: {
    pool: cloudflarePool(workerOptions),
  },
});
