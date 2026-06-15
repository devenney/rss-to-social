import type { SocialAdapter } from '../ports/social.js';
import type { RssItem, OgTags } from '../types.js';

interface AtpSession {
  accessJwt: string;
  did: string;
}

interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

export class BlueskyAdapter implements SocialAdapter {
  readonly name = 'bluesky';
  private readonly service = 'https://bsky.social';
  private session: AtpSession | null = null;

  constructor(
    private readonly handle: string,
    private readonly appPassword: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async post(item: RssItem): Promise<string> {
    const session = await this.getSession();
    const ogTags = await this.fetchOgTags(item.link);
    const thumb = ogTags.imageUrl
      ? await this.uploadThumb(session, ogTags.imageUrl)
      : undefined;
    return this.createPost(session, item, ogTags, thumb);
  }

  private async getSession(): Promise<AtpSession> {
    if (!this.session) {
      this.session = await this.login();
    }
    return this.session;
  }

  private async login(): Promise<AtpSession> {
    const res = await this.fetcher(`${this.service}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: this.handle, password: this.appPassword }),
    });
    if (!res.ok) throw new Error(`Bluesky login failed: ${res.status}`);
    return res.json();
  }

  private async fetchOgTags(url: string): Promise<OgTags> {
    const tags: Record<string, string> = {};
    try {
      const res = await this.fetcher(url);
      const transformed = new HTMLRewriter()
        .on('meta', {
          element(el) {
            const prop = el.getAttribute('property');
            const content = el.getAttribute('content');
            if (prop?.startsWith('og:') && content) tags[prop] = content;
          },
        })
        .transform(res);
      await transformed.text();
    } catch {
      // Non-fatal: post without embed card metadata
    }
    const imageUrl = tags['og:image'];
    return {
      title: tags['og:title'] ?? '',
      description: tags['og:description'] ?? '',
      ...(imageUrl ? { imageUrl } : {}),
    };
  }

  private async uploadThumb(
    session: AtpSession,
    imageUrl: string,
  ): Promise<BlobRef | undefined> {
    try {
      const imgRes = await this.fetcher(imageUrl);
      if (!imgRes.ok) return undefined;
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const buffer = await imgRes.arrayBuffer();

      const res = await this.fetcher(`${this.service}/xrpc/com.atproto.repo.uploadBlob`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          'Content-Type': contentType,
        },
        body: buffer,
      });
      if (!res.ok) return undefined;
      const data: { blob: BlobRef } = await res.json();
      return data.blob;
    } catch {
      return undefined;
    }
  }

  private async createPost(
    session: AtpSession,
    item: RssItem,
    ogTags: OgTags,
    thumb: BlobRef | undefined,
  ): Promise<string> {
    const text = this.buildText(item);

    const external: Record<string, unknown> = {
      uri: item.link,
      title: ogTags.title || item.title,
      description: ogTags.description || item.description,
    };
    if (thumb) external['thumb'] = thumb;

    const record = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      embed: { $type: 'app.bsky.embed.external', external },
    };

    const res = await this.fetcher(`${this.service}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Bluesky createRecord failed: ${res.status} ${body}`);
    }

    const data: { uri: string } = await res.json();
    return data.uri;
  }

  private buildText(item: RssItem): string {
    const max = 200;
    return item.description.length > max
      ? `${item.description.slice(0, max - 1)}…`
      : item.description;
  }
}
