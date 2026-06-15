import type { SocialAdapter } from '../ports/social.js';
import type { RssItem } from '../types.js';

export class DevtoAdapter implements SocialAdapter {
  readonly name = 'devto';
  private readonly baseUrl = 'https://dev.to/api';

  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async post(item: RssItem): Promise<string> {
    const res = await this.fetcher(`${this.baseUrl}/articles`, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        article: {
          title: item.title,
          body_markdown: item.content,
          published: true,
          canonical_url: item.link,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Dev.to post failed: ${res.status} ${body}`);
    }

    const data: { url: string } = await res.json();
    return data.url;
  }
}
