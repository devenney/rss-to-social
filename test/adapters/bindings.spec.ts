/**
 * Binding smoke tests — exercise the DEFAULT fetch path (no injected mock).
 *
 * vi.fn() tests cannot catch "Illegal invocation" because they bypass the
 * Workers runtime fetch entirely. These tests use vi.spyOn(globalThis, 'fetch')
 * so the adapter's default (...args) => fetch(...args) wrapper is actually
 * called, and any binding error in that path will surface here.
 *
 * A passing test means: fetch was called (binding is correct). The adapters
 * are expected to fail at the HTTP level (401/etc.) — that is intentional and
 * proves the binding works.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { BlueskyAdapter } from '../../src/adapters/bluesky.js';
import { MastodonAdapter } from '../../src/adapters/mastodon.js';
import type { RssItem } from '../../src/types.js';

const ITEM: RssItem = {
  guid: 'https://example.com/post-1',
  title: 'Hello World',
  link: 'https://example.com/post-1',
  pubDate: new Date('2026-06-14T10:00:00Z'),
  description: 'A short description.',
  content: '<p>Full content.</p>',
};

afterEach(() => vi.restoreAllMocks());

describe('default fetch binding (no injected fetcher)', () => {
  it('BlueskyAdapter: globalThis.fetch is called — no Illegal invocation', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    const adapter = new BlueskyAdapter('user.bsky.social', 'test-pass');
    // Expected: HTTP-level error, NOT "Illegal invocation"
    await expect(adapter.post(ITEM)).rejects.toThrow('Bluesky login failed: 401');
    expect(spy).toHaveBeenCalled();
  });

  it('MastodonAdapter: globalThis.fetch is called — no Illegal invocation', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    const adapter = new MastodonAdapter('mastodon.social', 'invalid-token');
    // Expected: HTTP-level error, NOT "Illegal invocation"
    await expect(adapter.post(ITEM)).rejects.toThrow('Mastodon post failed: 401');
    expect(spy).toHaveBeenCalled();
  });
});
