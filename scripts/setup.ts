// Creates KV namespaces and generates wrangler.personal.toml.
// Run once before first deploy: npm run setup

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function createNamespace(args: string): string {
  const output = execSync(`wrangler kv namespace create SEEN_POSTS ${args}`, {
    encoding: 'utf-8',
  });
  const match = output.match(/id\s*=\s*"([a-f0-9]+)"/);
  if (!match?.[1]) {
    console.error('Could not parse namespace ID from output:\n' + output);
    process.exit(1);
  }
  return match[1];
}

function main(): void {
  if (existsSync('wrangler.personal.toml')) {
    console.log('wrangler.personal.toml already exists — delete it to re-run setup.');
    process.exit(0);
  }

  console.log('Creating production KV namespace...');
  const id = createNamespace('');

  console.log('Creating preview KV namespace...');
  const previewId = createNamespace('--preview');

  const config = readFileSync('wrangler.personal.toml.example', 'utf-8')
    .replace('YOUR_PRODUCTION_KV_NAMESPACE_ID', id)
    .replace('YOUR_PREVIEW_KV_NAMESPACE_ID', previewId);

  writeFileSync('wrangler.personal.toml', config);

  console.log('\n✓ wrangler.personal.toml created\n');
  console.log('Next steps:');
  console.log('  1. Edit wrangler.personal.toml — fill in RSS_FEED_URL, BLUESKY_HANDLE, MASTODON_INSTANCE');
  console.log('  2. npm run secrets   — set BLUESKY_APP_PASSWORD and MASTODON_TOKEN');
  console.log('  3. npm run deploy');
}

main();
