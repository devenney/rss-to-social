import { fetchFeed } from './rss.js';
import { buildAdapters } from './config.js';

const BOOTSTRAPPED_KEY = '_bootstrapped';
const SEEN_PREFIX = 'seen:';

function log(event: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...data, ts: new Date().toISOString() }));
}

// On first run, record now as the sync floor. Any post published before this
// timestamp will never be syndicated, protecting against back-catalogue floods
// even if seen:{guid} keys are later wiped from KV.
async function bootstrap(env: Env): Promise<void> {
  const syncFrom = new Date().toISOString();
  await env.SEEN_POSTS.put(BOOTSTRAPPED_KEY, syncFrom);
  log('bootstrapped', { syncFrom });
}

async function run(env: Env): Promise<void> {
  const syncFrom = await env.SEEN_POSTS.get(BOOTSTRAPPED_KEY);
  if (!syncFrom) {
    await bootstrap(env);
    return;
  }

  const syncFloor = new Date(syncFrom).getTime();

  const adapters = buildAdapters(env);
  if (adapters.length === 0) {
    log('no_adapters', { message: 'No adapter secrets configured — nothing to do.' });
    return;
  }

  let items;
  try {
    items = await fetchFeed(env.RSS_FEED_URL);
  } catch (err) {
    log('feed_error', { error: String(err) });
    return;
  }

  log('feed_fetched', { count: items.length });

  for (const item of items) {
    // Skip posts published before the sync floor (back-catalogue protection).
    if (item.pubDate.getTime() < syncFloor) continue;

    const seenKey = `${SEEN_PREFIX}${item.guid}`;
    const alreadySeen = await env.SEEN_POSTS.get(seenKey);
    if (alreadySeen) continue;

    const results: Record<string, string> = {};
    let anyFailed = false;

    for (const adapter of adapters) {
      try {
        results[adapter.name] = await adapter.post(item);
      } catch (err) {
        log('adapter_error', { adapter: adapter.name, guid: item.guid, error: String(err) });
        results[adapter.name] = `error: ${String(err)}`;
        anyFailed = true;
      }
    }

    if (anyFailed) {
      // Leave item unseen so the next run retries. Accept the risk of duplicates
      // on already-successful adapters — silent omission is worse for a content tool.
      log('partial_failure', { guid: item.guid, title: item.title, results });
      continue;
    }

    await env.SEEN_POSTS.put(seenKey, new Date().toISOString());
    log('syndicated', { guid: item.guid, title: item.title, results });
  }
}

export default {
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(run(env));
  },
} satisfies ExportedHandler<Env>;
