import type { SocialAdapter } from '../ports/social.js';
import type { RssItem } from '../types.js';

export class MastodonAdapter implements SocialAdapter {
  readonly name = 'mastodon';

  constructor(
    private readonly instance: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async post(item: RssItem): Promise<string> {
    const status = this.buildStatus(item);

    const res = await this.fetcher(`https://${this.instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, visibility: 'public' }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Mastodon post failed: ${res.status} ${body}`);
    }

    const data: { url: string } = await res.json();
    return data.url;
  }

  private buildStatus(item: RssItem): string {
    // Mastodon counts all URLs as exactly 23 characters regardless of actual length.
    const MASTODON_URL_LENGTH = 23;
    const url = `\n\n${item.link}`;
    const header = `${item.title}\n\n`;
    const budget = 500 - header.length - 2 - MASTODON_URL_LENGTH; // 2 for "\n\n"

    const excerpt =
      item.description.length > budget
        ? `${item.description.slice(0, budget - 1)}…`
        : item.description;

    return `${header}${excerpt}${url}`;
  }
}
