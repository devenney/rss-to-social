// Sets the sync floor in KV. Posts published before this date will never be
// syndicated, protecting against back-catalogue floods on fresh deployments.
//
// Usage:
//   npm run bootstrap                    # set sync floor to now
//   npm run bootstrap -- --from=2026-01-01   # set to a specific date (backfill from that point)

import { execSync } from 'node:child_process';

const BOOTSTRAPPED_KEY = '_bootstrapped';
const BINDING = 'SEEN_POSTS';

function main(): void {
  const fromArg = process.argv.find((a) => a.startsWith('--from='));
  const syncFrom = fromArg
    ? new Date(fromArg.slice('--from='.length)).toISOString()
    : new Date().toISOString();

  if (fromArg && isNaN(Date.parse(fromArg.slice('--from='.length)))) {
    console.error(`Invalid date: ${fromArg.slice('--from='.length)}`);
    process.exit(1);
  }

  console.log(`Setting sync floor to: ${syncFrom}`);
  execSync(
    `wrangler kv key put --binding=${BINDING} --config=wrangler.personal.toml "${BOOTSTRAPPED_KEY}" "${syncFrom}"`,
    { stdio: 'inherit' },
  );
  console.log(`\nDone. Posts published before ${syncFrom} will not be syndicated.`);
}

main();
