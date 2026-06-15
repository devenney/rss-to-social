import { execSync } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';

const SEEN_PREFIX = 'seen:';
const BINDING = 'SEEN_POSTS';

interface RawItem {
  guid?: string | { '#text': string };
  link?: string;
  title?: string;
}

async function main(): Promise<void> {
  const urlArg = process.argv.find((a) => a.startsWith('--url='));
  const targetUrl = urlArg?.slice('--url='.length);

  if (!targetUrl) {
    console.error('Usage: npm run nudge -- --url=<post-url>');
    console.error('Example: npm run nudge -- --url=https://example.com/blog/my-post');
    process.exit(1);
  }

  const feedUrl = process.env['RSS_FEED_URL'];
  if (!feedUrl) {
    console.error(
      'Error: RSS_FEED_URL is not set.\n' +
        'Copy .dev.vars.example → .dev.vars and fill in your values.',
    );
    process.exit(1);
  }

  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`Failed to fetch feed: ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RawItem | RawItem[] } } };
  const raw = doc?.rss?.channel?.item;
  const items: RawItem[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

  const item = items.find((i) => i.link === targetUrl);
  if (!item) {
    console.error(`No feed item found with link: ${targetUrl}`);
    console.error('Note: the post must currently be present in the RSS feed.');
    process.exit(1);
  }

  const guid =
    typeof item.guid === 'object' && item.guid !== null
      ? item.guid['#text']
      : (item.guid ?? item.link ?? '');

  const key = `${SEEN_PREFIX}${guid}`;
  console.log(`Removing KV key: ${key}`);
  execSync(
    `wrangler kv key delete --binding=${BINDING} --config=wrangler.personal.toml "${key}" --force`,
    { stdio: 'inherit' },
  );
  console.log(`\nDone. "${item.title}" will be re-syndicated on the next cron tick.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
