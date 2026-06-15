import { describe, it, expect } from 'vitest';
import { parseFeed } from '../src/rss.js';

const SINGLE_ITEM_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Test Blog</title>
    <item>
      <guid>https://example.com/post-1</guid>
      <title>Hello World</title>
      <link>https://example.com/post-1</link>
      <pubDate>Mon, 14 Jun 2026 10:00:00 GMT</pubDate>
      <description>&lt;p&gt;A &lt;strong&gt;short&lt;/strong&gt; description.&lt;/p&gt;</description>
      <content:encoded><![CDATA[<p>Full content here.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;

const MULTI_ITEM_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <guid>post-a</guid>
      <title>Post A</title>
      <link>https://example.com/a</link>
      <pubDate>Sat, 13 Jun 2026 10:00:00 GMT</pubDate>
      <description>Older post</description>
    </item>
    <item>
      <guid>post-b</guid>
      <title>Post B</title>
      <link>https://example.com/b</link>
      <pubDate>Sun, 14 Jun 2026 10:00:00 GMT</pubDate>
      <description>Newer post</description>
    </item>
  </channel>
</rss>`;

const NO_GUID_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>No GUID Post</title>
      <link>https://example.com/no-guid</link>
      <pubDate>Mon, 14 Jun 2026 10:00:00 GMT</pubDate>
      <description>Uses link as GUID</description>
    </item>
  </channel>
</rss>`;

describe('parseFeed', () => {
  it('parses a single item into an RssItem', () => {
    const items = parseFeed(SINGLE_ITEM_RSS);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item!.guid).toBe('https://example.com/post-1');
    expect(item!.title).toBe('Hello World');
    expect(item!.link).toBe('https://example.com/post-1');
    expect(item!.pubDate).toBeInstanceOf(Date);
    expect(item!.description).toBe('A short description.');
    expect(item!.content).toBe('<p>Full content here.</p>');
  });

  it('strips HTML tags and decodes entities from description', () => {
    const [item] = parseFeed(SINGLE_ITEM_RSS);
    expect(item!.description).not.toContain('<');
    expect(item!.description).toBe('A short description.');
  });

  it('returns items sorted oldest-first', () => {
    const items = parseFeed(MULTI_ITEM_RSS);
    expect(items).toHaveLength(2);
    expect(items[0]!.guid).toBe('post-a');
    expect(items[1]!.guid).toBe('post-b');
  });

  it('falls back to link when guid is absent', () => {
    const [item] = parseFeed(NO_GUID_RSS);
    expect(item!.guid).toBe('https://example.com/no-guid');
  });

  it('returns empty array for empty channel', () => {
    const xml = `<?xml version="1.0"?><rss><channel></channel></rss>`;
    expect(parseFeed(xml)).toEqual([]);
  });
});
