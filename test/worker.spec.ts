import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  env,
  createScheduledController,
  createExecutionContext,
  waitOnExecutionContext,
} from 'cloudflare:test';
import worker from '../src/index.js';

vi.mock('../src/rss.js', () => ({ fetchFeed: vi.fn() }));
vi.mock('../src/config.js', () => ({ buildAdapters: vi.fn() }));

import { fetchFeed } from '../src/rss.js';
import { buildAdapters } from '../src/config.js';

// A post published well before any test run — used to verify date-floor filtering
const OLD_ITEM = {
  guid: 'https://example.com/old-post',
  title: 'Old Post',
  link: 'https://example.com/old-post',
  pubDate: new Date('2020-01-01T00:00:00Z'),
  description: 'An old post.',
  content: '<p>Old.</p>',
};

// A post published in the future — always newer than the sync floor
const NEW_ITEM = {
  guid: 'https://example.com/new-post',
  title: 'New Post',
  link: 'https://example.com/new-post',
  pubDate: new Date('2099-01-01T00:00:00Z'),
  description: 'A new post.',
  content: '<p>New.</p>',
};

const mockAdapter = { name: 'mock', post: vi.fn().mockResolvedValue('https://example.com/syndicated') };

async function runWorker(env: Env): Promise<void> {
  const ctx = createExecutionContext();
  worker.scheduled(
    createScheduledController({ scheduledTime: Date.now(), cron: '0 * * * *' }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
}

const testEnv = env as unknown as Env;

describe('worker.scheduled', () => {
  beforeEach(async () => {
    vi.mocked(fetchFeed).mockClear().mockResolvedValue([NEW_ITEM]);
    vi.mocked(buildAdapters).mockClear().mockReturnValue([mockAdapter]);
    vi.mocked(mockAdapter.post).mockClear();
    const { keys } = await testEnv.SEEN_POSTS.list();
    await Promise.all(keys.map((k) => testEnv.SEEN_POSTS.delete(k.name)));
  });

  it('auto-bootstraps on first run: sets sync floor without syndicating', async () => {
    await runWorker({ ...testEnv, RSS_FEED_URL: 'https://example.com/rss.xml' });

    const syncFrom = await testEnv.SEEN_POSTS.get('_bootstrapped');
    expect(syncFrom).not.toBeNull();
    expect(mockAdapter.post).not.toHaveBeenCalled();
  });

  it('skips posts published before the sync floor (date-floor protection)', async () => {
    // Set sync floor to now — OLD_ITEM (2020) is before it
    await testEnv.SEEN_POSTS.put('_bootstrapped', new Date().toISOString());
    vi.mocked(fetchFeed).mockResolvedValue([OLD_ITEM]);

    await runWorker({ ...testEnv, RSS_FEED_URL: 'https://example.com/rss.xml' });

    expect(mockAdapter.post).not.toHaveBeenCalled();
    const seen = await testEnv.SEEN_POSTS.get('seen:https://example.com/old-post');
    expect(seen).toBeNull();
  });

  it('syndicates posts published after the sync floor', async () => {
    await testEnv.SEEN_POSTS.put('_bootstrapped', new Date().toISOString());
    // NEW_ITEM (2099) is always after the sync floor

    await runWorker({ ...testEnv, RSS_FEED_URL: 'https://example.com/rss.xml' });

    expect(mockAdapter.post).toHaveBeenCalledOnce();
    const seen = await testEnv.SEEN_POSTS.get('seen:https://example.com/new-post');
    expect(seen).not.toBeNull();
  });

  it('exits before fetching when buildAdapters returns empty', async () => {
    await testEnv.SEEN_POSTS.put('_bootstrapped', new Date().toISOString());
    vi.mocked(buildAdapters).mockReturnValueOnce([]);

    await runWorker({ ...testEnv, RSS_FEED_URL: 'https://example.com/rss.xml' });

    expect(fetchFeed).not.toHaveBeenCalled();
  });

  it('does NOT mark an item as seen when an adapter fails', async () => {
    await testEnv.SEEN_POSTS.put('_bootstrapped', new Date().toISOString());
    vi.mocked(mockAdapter.post).mockRejectedValueOnce(new Error('adapter down'));

    await runWorker({ ...testEnv, RSS_FEED_URL: 'https://example.com/rss.xml' });

    const seen = await testEnv.SEEN_POSTS.get('seen:https://example.com/new-post');
    expect(seen).toBeNull();
  });

  it('skips items already in KV without calling post', async () => {
    await testEnv.SEEN_POSTS.put('_bootstrapped', new Date().toISOString());
    await testEnv.SEEN_POSTS.put('seen:https://example.com/new-post', new Date().toISOString());

    await runWorker({ ...testEnv, RSS_FEED_URL: 'https://example.com/rss.xml' });

    expect(mockAdapter.post).not.toHaveBeenCalled();
  });
});
