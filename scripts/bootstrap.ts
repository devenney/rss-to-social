// Sets the sync floor in KV. Posts published before this date will never be
// syndicated, protecting against back-catalogue floods on fresh deployments.
//
// Usage:
//   npm run bootstrap                       # set sync floor to now
//   npm run bootstrap -- --from=2026-01-01  # backfill from a specific date

import { execSync } from 'node:child_process';

const BOOTSTRAPPED_KEY = '_bootstrapped';
const BINDING = 'SEEN_POSTS';

function main(): void {
  const fromArg = process.argv.find((a) => a.startsWith('--from='));

  if (fromArg) {
    const raw = fromArg.slice('--from='.length);
    if (isNaN(Date.parse(raw))) {
      console.error(`Invalid date: ${raw}`);
      process.exit(1);
    }
  }

  const syncFrom = fromArg
    ? new Date(fromArg.slice('--from='.length)).toISOString()
    : new Date().toISOString();

  console.log(`Setting sync floor to: ${syncFrom}`);
  execSync(
    `wrangler kv key put --binding=${BINDING} --config=wrangler.personal.toml "${BOOTSTRAPPED_KEY}" "${syncFrom}"`,
    { stdio: 'inherit' },
  );
  console.log(`\nDone. Posts published before ${syncFrom} will not be syndicated.`);
}

main();
