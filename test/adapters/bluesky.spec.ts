import { describe, it, expect, vi } from 'vitest';
import { BlueskyAdapter } from '../../src/adapters/bluesky.js';
import type { RssItem } from '../../src/types.js';

const ITEM: RssItem = {
  guid: 'https://example.com/post-1',
  title: 'Hello World',
  link: 'https://example.com/post-1',
  pubDate: new Date('2026-06-14T10:00:00Z'),
  description: 'A short description of the post.',
  content: '<p>Full content here.</p>',
};

const SESSION = { accessJwt: 'test-jwt', did: 'did:plc:testuser' };
const BLOB = { $type: 'blob', ref: { $link: 'bafytest123' }, mimeType: 'image/jpeg', size: 3 };
const AT_URI = 'at://did:plc:testuser/app.bsky.feed.post/abc123';

const EXAMPLE_HTML = `<html><head>
  <meta property="og:title" content="Hello World" />
  <meta property="og:description" content="OG description." />
  <meta property="og:image" content="https://example.com/image.jpg" />
</head><body></body></html>`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function html(content: string): Response {
  return new Response(content, { headers: { 'content-type': 'text/html' } });
}

describe('BlueskyAdapter', () => {
  it('posts with embed card and returns AT URI', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(SESSION))                          // login (once per adapter instance)
      .mockResolvedValueOnce(html(EXAMPLE_HTML))                     // og tags
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })) // image
      .mockResolvedValueOnce(json({ blob: BLOB }))                   // upload blob
      .mockResolvedValueOnce(json({ uri: AT_URI, cid: 'cid123' })); // create record

    const adapter = new BlueskyAdapter('user.bsky.social', 'test-password', mockFetch);
    const uri = await adapter.post(ITEM);

    expect(uri).toBe(AT_URI);
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it('reuses session across multiple posts without re-authenticating', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(SESSION))                          // login once
      .mockResolvedValueOnce(html('<html><head></head></html>'))      // og tags post 1
      .mockResolvedValueOnce(json({ uri: AT_URI, cid: 'cid1' }))    // create record post 1
      .mockResolvedValueOnce(html('<html><head></head></html>'))      // og tags post 2
      .mockResolvedValueOnce(json({ uri: AT_URI, cid: 'cid2' }));   // create record post 2

    const adapter = new BlueskyAdapter('user.bsky.social', 'test-password', mockFetch);
    await adapter.post(ITEM);
    await adapter.post({ ...ITEM, guid: 'post-2', title: 'Post 2' });

    // Login called exactly once despite two posts
    const loginCalls = mockFetch.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('createSession'),
    );
    expect(loginCalls).toHaveLength(1);
  });

  it('posts without thumb when image fetch fails', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(SESSION))
      .mockResolvedValueOnce(html(EXAMPLE_HTML))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))   // image fails
      .mockResolvedValueOnce(json({ uri: AT_URI, cid: 'cid123' })); // create record (no upload)

    const adapter = new BlueskyAdapter('user.bsky.social', 'test-password', mockFetch);
    const uri = await adapter.post(ITEM);

    expect(uri).toBe(AT_URI);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('posts without embed card when OG fetch fails', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(SESSION))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))   // og fails
      .mockResolvedValueOnce(json({ uri: AT_URI, cid: 'cid123' })); // create record

    const adapter = new BlueskyAdapter('user.bsky.social', 'test-password', mockFetch);
    const uri = await adapter.post(ITEM);

    expect(uri).toBe(AT_URI);
  });

  it('throws when login fails', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const adapter = new BlueskyAdapter('user.bsky.social', 'test-password', mockFetch);
    await expect(adapter.post(ITEM)).rejects.toThrow('Bluesky login failed: 401');
  });

  it('throws when createRecord fails', async () => {
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(SESSION))
      .mockResolvedValueOnce(html('<html><head></head></html>'))
      .mockResolvedValueOnce(json({ error: 'InvalidRequest' }, 400));

    const adapter = new BlueskyAdapter('user.bsky.social', 'test-password', mockFetch);
    await expect(adapter.post(ITEM)).rejects.toThrow('Bluesky createRecord failed: 400');
  });

  it('truncates description to 200 chars in post body', async () => {
    const longItem: RssItem = { ...ITEM, description: 'x'.repeat(250) };

    let capturedBody = '';
    const mockFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(SESSION))
      .mockResolvedValueOnce(html('<html><head></head></html>'))
      .mockImplementationOnce((_url, init) => {
        capturedBody = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body ?? '') ?? '';
        return Promise.resolve(json({ uri: AT_URI, cid: 'cid123' }));
      });

    const adapter = new BlueskyAdapter('user.bsky.social', 'test-password', mockFetch);
    await adapter.post(longItem);

    const parsed = JSON.parse(capturedBody) as { record: { text: string } };
    expect(parsed.record.text.length).toBeLessThanOrEqual(200);
    expect(parsed.record.text.endsWith('…')).toBe(true);
  });
});
