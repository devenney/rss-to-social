import { describe, it, expect, vi } from 'vitest';
import { DevtoAdapter } from '../../src/adapters/devto.js';
import type { RssItem } from '../../src/types.js';

const ITEM: RssItem = {
  guid: 'https://example.com/post-1',
  title: 'Hello World',
  link: 'https://example.com/post-1',
  pubDate: new Date('2026-06-14T10:00:00Z'),
  description: 'A short description.',
  content: '<p>Full content here.</p>',
};

const ARTICLE_RESPONSE = { id: 12345, url: 'https://dev.to/user/hello-world-abc1' };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('DevtoAdapter', () => {
  it('creates an article and returns the URL', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(json(ARTICLE_RESPONSE, 201));
    const adapter = new DevtoAdapter('test-api-key', mockFetch);

    const url = await adapter.post(ITEM);

    expect(url).toBe('https://dev.to/user/hello-world-abc1');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('sends canonical_url set to the RSS item link', async () => {
    let capturedBody = '';
    const mockFetch = vi.fn<typeof fetch>().mockImplementationOnce((_url, init) => {
      capturedBody = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body ?? '') ?? '';
      return Promise.resolve(json(ARTICLE_RESPONSE, 201));
    });

    const adapter = new DevtoAdapter('test-api-key', mockFetch);
    await adapter.post(ITEM);

    const parsed = JSON.parse(capturedBody) as {
      article: { canonical_url: string; title: string; published: boolean };
    };
    expect(parsed.article.canonical_url).toBe('https://example.com/post-1');
    expect(parsed.article.title).toBe('Hello World');
    expect(parsed.article.published).toBe(true);
  });

  it('sends full HTML content as body_markdown', async () => {
    let capturedBody = '';
    const mockFetch = vi.fn<typeof fetch>().mockImplementationOnce((_url, init) => {
      capturedBody = typeof init?.body === 'string' ? init.body : JSON.stringify(init?.body ?? '') ?? '';
      return Promise.resolve(json(ARTICLE_RESPONSE, 201));
    });

    const adapter = new DevtoAdapter('test-api-key', mockFetch);
    await adapter.post(ITEM);

    const parsed = JSON.parse(capturedBody) as { article: { body_markdown: string } };
    expect(parsed.article.body_markdown).toBe('<p>Full content here.</p>');
  });

  it('throws when the API returns an error', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      json({ error: 'Unprocessable', status: 422 }, 422),
    );
    const adapter = new DevtoAdapter('test-api-key', mockFetch);
    await expect(adapter.post(ITEM)).rejects.toThrow('Dev.to post failed: 422');
  });
});
