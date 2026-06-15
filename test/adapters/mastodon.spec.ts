import { describe, it, expect, vi } from 'vitest';
import { MastodonAdapter } from '../../src/adapters/mastodon.js';
import type { RssItem } from '../../src/types.js';

const ITEM: RssItem = {
  guid: 'https://example.com/post-1',
  title: 'Hello World',
  link: 'https://example.com/post-1',
  pubDate: new Date('2026-06-14T10:00:00Z'),
  description: 'A short description of the post.',
  content: '<p>Full content here.</p>',
};

const STATUS_RESPONSE = { id: '123456789', url: 'https://mastodon.social/@user/123456789' };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('MastodonAdapter', () => {
  it('posts a status and returns the URL', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(json(STATUS_RESPONSE));
    const adapter = new MastodonAdapter('mastodon.social', 'test-token', mockFetch);

    const url = await adapter.post(ITEM);

    expect(url).toBe('https://mastodon.social/@user/123456789');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('status body contains title, description, and link', async () => {
    let capturedBody = '';
    const mockFetch = vi.fn<typeof fetch>().mockImplementationOnce((_url, init) => {
      capturedBody = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body ?? '') ?? '';
      return Promise.resolve(json(STATUS_RESPONSE));
    });

    const adapter = new MastodonAdapter('mastodon.social', 'test-token', mockFetch);
    await adapter.post(ITEM);

    const parsed = JSON.parse(capturedBody) as { status: string };
    expect(parsed.status).toContain('Hello World');
    expect(parsed.status).toContain('A short description of the post.');
    expect(parsed.status).toContain('https://example.com/post-1');
  });

  it('truncates description so Mastodon-counted length is within 500 chars', async () => {
    const longItem: RssItem = { ...ITEM, description: 'x'.repeat(600) };
    let capturedBody = '';
    const mockFetch = vi.fn<typeof fetch>().mockImplementationOnce((_url, init) => {
      capturedBody = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body ?? '') ?? '';
      return Promise.resolve(json(STATUS_RESPONSE));
    });

    const adapter = new MastodonAdapter('mastodon.social', 'test-token', mockFetch);
    await adapter.post(longItem);

    const { status } = JSON.parse(capturedBody) as { status: string };
    // Mastodon counts every URL as exactly 23 chars regardless of actual length.
    const mastodonLength = status.replace(/https?:\/\/\S+/g, (url) =>
      'x'.repeat(Math.min(url.length, 23)),
    ).length;
    expect(mastodonLength).toBeLessThanOrEqual(500);
  });

  it('throws when the API returns an error', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );
    const adapter = new MastodonAdapter('mastodon.social', 'test-token', mockFetch);
    await expect(adapter.post(ITEM)).rejects.toThrow('Mastodon post failed: 401');
  });
});
