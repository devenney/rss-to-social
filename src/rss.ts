import { XMLParser } from 'fast-xml-parser';
import type { RssItem } from './types.js';

interface RawItem {
  guid?: string | { '#text': string; '@_isPermaLink'?: string };
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  'content:encoded'?: string;
}

export async function fetchFeed(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'rss-to-social/1.0 (+https://github.com/devenney/rss-to-social)' },
  });
  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
  }
  return parseFeed(await res.text());
}

export function parseFeed(xml: string): RssItem[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RawItem | RawItem[] } } };

  const raw = doc?.rss?.channel?.item;
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];

  return items
    .map((item): RssItem | null => {
      const guid =
        typeof item.guid === 'object' ? item.guid['#text'] : item.guid;
      const link = item.link;
      const resolvedGuid = guid ?? link;
      if (!resolvedGuid || !link || !item.title) return null;
      return {
        guid: resolvedGuid,
        title: item.title,
        link,
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(0),
        description: stripHtml(item.description ?? ''),
        content: item['content:encoded'] ?? item.description ?? '',
      };
    })
    .filter((item): item is RssItem => item !== null)
    .sort((a, b) => a.pubDate.getTime() - b.pubDate.getTime());
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&apos;/g, "'")
    .trim();
}
