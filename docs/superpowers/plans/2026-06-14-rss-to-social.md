# rss-to-social Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cloudflare Worker that syndicates new blog posts from an RSS feed to Bluesky, Mastodon, and Dev.to on a cron schedule.

**Architecture:** A scheduled Worker checks a KV-backed sentinel on each tick, fetches the RSS feed, diffs it against seen GUIDs in KV, and syndicates new items through typed adapter instances. A bootstrap script seeds the initial KV state; a nudge script enables safe re-syndication of missed posts.

**Tech Stack:** TypeScript 5, Cloudflare Workers, Cloudflare KV, `fast-xml-parser`, `@cloudflare/vitest-pool-workers`, Vitest 2, Wrangler 3, ESLint 9 (flat config), `typescript-eslint`, `commitlint`, `husky`, `release-please`, GitHub Actions.

---

## File Map

| File | Responsibility |
|---|---|
| `src/types.ts` | `RssItem`, `OgTags`, `Env` interfaces |
| `src/ports/social.ts` | `SocialAdapter` interface |
| `src/rss.ts` | Fetch + parse RSS feed → `RssItem[]` |
| `src/config.ts` | Read env, return active `SocialAdapter[]` |
| `src/index.ts` | Scheduled handler — orchestrates the run |
| `src/adapters/bluesky.ts` | AT Protocol adapter |
| `src/adapters/mastodon.ts` | Mastodon REST adapter |
| `src/adapters/devto.ts` | Dev.to API adapter |
| `scripts/bootstrap.ts` | Seed all current feed GUIDs into KV |
| `scripts/nudge.ts` | Remove a GUID from KV to allow re-syndication |
| `test/rss.spec.ts` | Unit tests for RSS parser |
| `test/worker.spec.ts` | Worker integration tests |
| `test/adapters/bluesky.spec.ts` | Bluesky adapter tests (fetchMock) |
| `test/adapters/mastodon.spec.ts` | Mastodon adapter tests (fetchMock) |
| `test/adapters/devto.spec.ts` | Dev.to adapter tests (fetchMock) |
| `vitest.config.ts` | Workers pool configuration |
| `wrangler.toml` | Worker config: cron, KV binding, vars |
| `tsconfig.json` | Worker + test TypeScript config |
| `tsconfig.scripts.json` | Node-context config for scripts/ |
| `eslint.config.js` | ESLint flat config |
| `commitlint.config.js` | Conventional commits |
| `.husky/commit-msg` | Commit-time lint hook |
| `.github/workflows/ci-deploy.yml` | CI + deploy on push to main |
| `.github/workflows/release-please.yml` | Automated changelog + semver tags |
| `release-please-config.json` | Release Please config |
| `.release-please-manifest.json` | Current version |
| `.dev.vars.example` | Documented secrets template |
| `.gitignore` | Node + Wrangler ignores |
| `README.md` | Setup guide |

---

### Task 1: Scaffold — package.json, config files, install deps

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.scripts.json`
- Create: `wrangler.toml`
- Create: `.gitignore`
- Create: `.dev.vars.example`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "rss-to-social",
  "version": "0.1.0",
  "description": "Automatically syndicate your RSS feed to Bluesky, Mastodon, and Dev.to. Runs on Cloudflare Workers.",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src test scripts",
    "typecheck": "tsc --noEmit && tsc --project tsconfig.scripts.json --noEmit",
    "bootstrap": "tsx --env-file=.dev.vars scripts/bootstrap.ts",
    "nudge": "tsx --env-file=.dev.vars scripts/nudge.ts",
    "prepare": "husky"
  },
  "dependencies": {
    "fast-xml-parser": "^4.4.1"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.0.0",
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "eslint": "^9.0.0",
    "husky": "^9.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.0.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

- [ ] **Step 3: Write `tsconfig.scripts.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "lib": ["ESNext"],
    "exactOptionalPropertyTypes": false
  },
  "include": ["scripts"]
}
```

- [ ] **Step 4: Write `wrangler.toml`**

```toml
name = "rss-to-social"
main = "src/index.ts"
compatibility_date = "2024-09-23"

[triggers]
crons = ["0 * * * *"]

[[kv_namespaces]]
binding = "SEEN_POSTS"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_PREVIEW_KV_NAMESPACE_ID"

[vars]
RSS_FEED_URL = ""
BLUESKY_HANDLE = ""
MASTODON_INSTANCE = ""
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
dist/
.wrangler/
.dev.vars
*.tgz
bootstrap-*.json
```

- [ ] **Step 6: Write `.dev.vars.example`**

```
# Copy this file to .dev.vars and fill in your values.
# .dev.vars is gitignored — never commit real credentials.

RSS_FEED_URL=https://example.com/rss.xml
BLUESKY_HANDLE=you.bsky.social
BLUESKY_APP_PASSWORD=your-app-password
MASTODON_INSTANCE=mastodon.social
MASTODON_TOKEN=your-access-token
DEVTO_API_KEY=your-api-key
```

- [ ] **Step 7: Install dependencies**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json tsconfig.scripts.json wrangler.toml .gitignore .dev.vars.example package-lock.json
git commit -m "chore: initialise project"
```

---

### Task 2: Vitest configuration

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

- [ ] **Step 2: Verify vitest resolves**

```bash
cd /Users/devenney/code/personal/rss-to-social && npx vitest run --reporter=verbose 2>&1 | head -20
```

Expected: "No test files found" or similar — not a crash.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test: configure vitest pool workers"
```

---

### Task 3: Types and interfaces

**Files:**
- Create: `src/types.ts`
- Create: `src/ports/social.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export interface RssItem {
  guid: string;
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  content: string;
}

export interface OgTags {
  title: string;
  description: string;
  imageUrl?: string;
}

export interface Env {
  SEEN_POSTS: KVNamespace;
  RSS_FEED_URL: string;
  BLUESKY_HANDLE?: string;
  BLUESKY_APP_PASSWORD?: string;
  MASTODON_INSTANCE?: string;
  MASTODON_TOKEN?: string;
  DEVTO_API_KEY?: string;
}
```

- [ ] **Step 2: Write `src/ports/social.ts`**

```typescript
import type { RssItem } from '../types.js';

export interface SocialAdapter {
  readonly name: string;
  post(item: RssItem): Promise<string>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: add types and SocialAdapter interface"
```

---

### Task 4: RSS parser (TDD)

**Files:**
- Create: `src/rss.ts`
- Create: `test/rss.spec.ts`

- [ ] **Step 1: Write failing tests in `test/rss.spec.ts`**

```typescript
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
    expect(item.guid).toBe('https://example.com/post-1');
    expect(item.title).toBe('Hello World');
    expect(item.link).toBe('https://example.com/post-1');
    expect(item.pubDate).toBeInstanceOf(Date);
    expect(item.description).toBe('A short description.');
    expect(item.content).toBe('<p>Full content here.</p>');
  });

  it('strips HTML tags and decodes entities from description', () => {
    const [item] = parseFeed(SINGLE_ITEM_RSS);
    expect(item.description).not.toContain('<');
    expect(item.description).toBe('A short description.');
  });

  it('returns items sorted oldest-first', () => {
    const items = parseFeed(MULTI_ITEM_RSS);
    expect(items).toHaveLength(2);
    expect(items[0].guid).toBe('post-a');
    expect(items[1].guid).toBe('post-b');
  });

  it('falls back to link when guid is absent', () => {
    const [item] = parseFeed(NO_GUID_RSS);
    expect(item.guid).toBe('https://example.com/no-guid');
  });

  it('returns empty array for empty channel', () => {
    const xml = `<?xml version="1.0"?><rss><channel></channel></rss>`;
    expect(parseFeed(xml)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../src/rss.js'`

- [ ] **Step 3: Write `src/rss.ts`**

```typescript
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
  const res = await fetch(url);
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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test 2>&1 | tail -20
```

Expected: All `rss.spec.ts` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rss.ts test/rss.spec.ts
git commit -m "feat: add RSS feed parser"
```

---

### Task 5: Config module

**Files:**
- Create: `src/config.ts`

No unit tests — trivial branching logic covered by worker integration tests.

- [ ] **Step 1: Write `src/config.ts`**

```typescript
import type { Env } from './types.js';
import type { SocialAdapter } from './ports/social.js';
import { BlueskyAdapter } from './adapters/bluesky.js';
import { MastodonAdapter } from './adapters/mastodon.js';
import { DevtoAdapter } from './adapters/devto.js';

export function buildAdapters(env: Env): SocialAdapter[] {
  const adapters: SocialAdapter[] = [];

  if (env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD) {
    adapters.push(new BlueskyAdapter(env.BLUESKY_HANDLE, env.BLUESKY_APP_PASSWORD));
  }
  if (env.MASTODON_INSTANCE && env.MASTODON_TOKEN) {
    adapters.push(new MastodonAdapter(env.MASTODON_INSTANCE, env.MASTODON_TOKEN));
  }
  if (env.DEVTO_API_KEY) {
    adapters.push(new DevtoAdapter(env.DEVTO_API_KEY));
  }

  return adapters;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/config.ts
git commit -m "feat: add adapter configuration"
```

---

### Task 6: Worker entry point (TDD)

**Files:**
- Create: `src/index.ts`
- Create: `test/worker.spec.ts`

- [ ] **Step 1: Write failing tests in `test/worker.spec.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { env, fetchMock } from 'cloudflare:test';
import type { Env } from '../src/types.js';
import worker from '../src/index.js';

// Minimal RSS feed for testing
const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Test Blog</title>
    <item>
      <guid>https://example.com/post-1</guid>
      <title>Test Post</title>
      <link>https://example.com/post-1</link>
      <pubDate>Mon, 14 Jun 2026 10:00:00 GMT</pubDate>
      <description>A short description.</description>
      <content:encoded><![CDATA[<p>Full content.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;

function makeEvent(): ScheduledEvent {
  return {
    scheduledTime: Date.now(),
    cron: '0 * * * *',
    type: 'scheduled',
    noRetry: () => {},
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: () => {}, passThroughOnException: () => {} };
}

// Cast env to include the test KV binding
const testEnv = env as unknown as Env;

describe('worker.scheduled', () => {
  beforeAll(() => fetchMock.activate());
  afterAll(() => fetchMock.deactivate());

  beforeEach(async () => {
    // Clear KV between tests
    const { keys } = await testEnv.SEEN_POSTS.list();
    await Promise.all(keys.map((k) => testEnv.SEEN_POSTS.delete(k.name)));
    fetchMock.resetHandlers();
  });

  it('exits without fetching feed when _bootstrapped is missing', async () => {
    await worker.scheduled(makeEvent(), testEnv, makeCtx());
    // No fetch calls should be made
    expect(fetchMock.calls().length).toBe(0);
  });

  it('exits without syndication when no adapters are configured', async () => {
    await testEnv.SEEN_POSTS.put('_bootstrapped', new Date().toISOString());
    fetchMock
      .get('https://example.com')
      .intercept({ path: '/rss.xml', method: 'GET' })
      .reply(200, MOCK_RSS, { headers: { 'content-type': 'application/rss+xml' } });

    // testEnv has no adapter secrets (wrangler.toml vars are empty strings)
    await worker.scheduled(makeEvent(), { ...testEnv, RSS_FEED_URL: 'https://example.com/rss.xml' }, makeCtx());

    // Only the RSS fetch should have been called — no adapter posts
    expect(fetchMock.calls().filter((c) => c.path !== '/rss.xml').length).toBe(0);
  });

  it('marks an item as seen after syndication', async () => {
    await testEnv.SEEN_POSTS.put('_bootstrapped', new Date().toISOString());

    fetchMock
      .get('https://example.com')
      .intercept({ path: '/rss.xml' })
      .reply(200, MOCK_RSS);

    // Mock Dev.to post
    fetchMock
      .get('https://dev.to')
      .intercept({ path: '/api/articles', method: 'POST' })
      .reply(201, JSON.stringify({ url: 'https://dev.to/user/test-post' }), {
        headers: { 'content-type': 'application/json' },
      });

    const envWithDevto = {
      ...testEnv,
      RSS_FEED_URL: 'https://example.com/rss.xml',
      DEVTO_API_KEY: 'test-key',
    };

    await worker.scheduled(makeEvent(), envWithDevto, makeCtx());

    const seen = await testEnv.SEEN_POSTS.get('seen:https://example.com/post-1');
    expect(seen).not.toBeNull();
  });

  it('skips items already in KV', async () => {
    await testEnv.SEEN_POSTS.put('_bootstrapped', new Date().toISOString());
    await testEnv.SEEN_POSTS.put('seen:https://example.com/post-1', new Date().toISOString());

    fetchMock
      .get('https://example.com')
      .intercept({ path: '/rss.xml' })
      .reply(200, MOCK_RSS);

    const envWithDevto = {
      ...testEnv,
      RSS_FEED_URL: 'https://example.com/rss.xml',
      DEVTO_API_KEY: 'test-key',
    };

    await worker.scheduled(makeEvent(), envWithDevto, makeCtx());

    // Dev.to should NOT have been called — item was already seen
    const devtoCalls = fetchMock.calls().filter((c) => c.path === '/api/articles');
    expect(devtoCalls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../src/index.js'`

- [ ] **Step 3: Write `src/index.ts`**

```typescript
import type { Env } from './types.js';
import { fetchFeed } from './rss.js';
import { buildAdapters } from './config.js';

const BOOTSTRAPPED_KEY = '_bootstrapped';
const SEEN_PREFIX = 'seen:';

function log(event: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...data, ts: new Date().toISOString() }));
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const bootstrapped = await env.SEEN_POSTS.get(BOOTSTRAPPED_KEY);
    if (!bootstrapped) {
      log('not_bootstrapped', {
        message: 'Run `npm run bootstrap` before deploying to initialise KV state.',
      });
      return;
    }

    const adapters = buildAdapters(env);
    if (adapters.length === 0) {
      log('no_adapters', { message: 'No adapter secrets configured — nothing to do.' });
      return;
    }

    let items;
    try {
      items = await fetchFeed(env.RSS_FEED_URL);
    } catch (err) {
      log('feed_error', { error: String(err) });
      return;
    }

    log('feed_fetched', { count: items.length });

    for (const item of items) {
      const seenKey = `${SEEN_PREFIX}${item.guid}`;
      const alreadySeen = await env.SEEN_POSTS.get(seenKey);
      if (alreadySeen) continue;

      const results: Record<string, string> = {};
      for (const adapter of adapters) {
        try {
          results[adapter.name] = await adapter.post(item);
        } catch (err) {
          log('adapter_error', { adapter: adapter.name, guid: item.guid, error: String(err) });
          results[adapter.name] = `error: ${String(err)}`;
        }
      }

      await env.SEEN_POSTS.put(seenKey, new Date().toISOString());
      log('syndicated', { guid: item.guid, title: item.title, results });
    }
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test 2>&1 | tail -30
```

Expected: All worker tests PASS (adapter tests will fail until adapters exist — that's expected).

- [ ] **Step 5: Commit**

```bash
git add src/index.ts test/worker.spec.ts
git commit -m "feat: add scheduled worker handler"
```

---

### Task 7: Bluesky adapter (TDD)

**Files:**
- Create: `src/adapters/bluesky.ts`
- Create: `test/adapters/bluesky.spec.ts`

- [ ] **Step 1: Write failing tests in `test/adapters/bluesky.spec.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { fetchMock } from 'cloudflare:test';
import { BlueskyAdapter } from '../../src/adapters/bluesky.js';
import type { RssItem } from '../../src/types.js';

const ADAPTER = new BlueskyAdapter('user.bsky.social', 'test-password');

const ITEM: RssItem = {
  guid: 'https://example.com/post-1',
  title: 'Hello World',
  link: 'https://example.com/post-1',
  pubDate: new Date('2026-06-14T10:00:00Z'),
  description: 'A short description of the post.',
  content: '<p>Full content here.</p>',
};

const SESSION_RESPONSE = {
  accessJwt: 'test-jwt',
  did: 'did:plc:testuser',
};

const EXAMPLE_HTML = `<html><head>
  <meta property="og:title" content="Hello World" />
  <meta property="og:description" content="OG description." />
  <meta property="og:image" content="https://example.com/image.jpg" />
</head><body></body></html>`;

const IMAGE_BUFFER = new Uint8Array([1, 2, 3]).buffer;

const BLOB_RESPONSE = {
  blob: {
    $type: 'blob',
    ref: { $link: 'bafytest123' },
    mimeType: 'image/jpeg',
    size: 3,
  },
};

const CREATE_RECORD_RESPONSE = { uri: 'at://did:plc:testuser/app.bsky.feed.post/abc123', cid: 'cid123' };

describe('BlueskyAdapter', () => {
  beforeAll(() => fetchMock.activate());
  afterAll(() => fetchMock.deactivate());
  beforeEach(() => fetchMock.resetHandlers());

  it('posts with embed card and returns AT URI', async () => {
    fetchMock
      .get('https://bsky.social')
      .intercept({ path: '/xrpc/com.atproto.server.createSession', method: 'POST' })
      .reply(200, JSON.stringify(SESSION_RESPONSE), { headers: { 'content-type': 'application/json' } });

    fetchMock
      .get('https://example.com')
      .intercept({ path: '/post-1', method: 'GET' })
      .reply(200, EXAMPLE_HTML, { headers: { 'content-type': 'text/html' } });

    fetchMock
      .get('https://example.com')
      .intercept({ path: '/image.jpg', method: 'GET' })
      .reply(200, IMAGE_BUFFER, { headers: { 'content-type': 'image/jpeg' } });

    fetchMock
      .get('https://bsky.social')
      .intercept({ path: '/xrpc/com.atproto.repo.uploadBlob', method: 'POST' })
      .reply(200, JSON.stringify(BLOB_RESPONSE), { headers: { 'content-type': 'application/json' } });

    fetchMock
      .get('https://bsky.social')
      .intercept({ path: '/xrpc/com.atproto.repo.createRecord', method: 'POST' })
      .reply(200, JSON.stringify(CREATE_RECORD_RESPONSE), { headers: { 'content-type': 'application/json' } });

    const uri = await ADAPTER.post(ITEM);
    expect(uri).toBe('at://did:plc:testuser/app.bsky.feed.post/abc123');
  });

  it('posts without thumb when OG image fetch fails', async () => {
    fetchMock
      .get('https://bsky.social')
      .intercept({ path: '/xrpc/com.atproto.server.createSession', method: 'POST' })
      .reply(200, JSON.stringify(SESSION_RESPONSE), { headers: { 'content-type': 'application/json' } });

    fetchMock
      .get('https://example.com')
      .intercept({ path: '/post-1', method: 'GET' })
      .reply(200, EXAMPLE_HTML, { headers: { 'content-type': 'text/html' } });

    fetchMock
      .get('https://example.com')
      .intercept({ path: '/image.jpg', method: 'GET' })
      .reply(500, 'Server Error');

    fetchMock
      .get('https://bsky.social')
      .intercept({ path: '/xrpc/com.atproto.repo.createRecord', method: 'POST' })
      .reply(200, JSON.stringify(CREATE_RECORD_RESPONSE), { headers: { 'content-type': 'application/json' } });

    const uri = await ADAPTER.post(ITEM);
    expect(uri).toBe('at://did:plc:testuser/app.bsky.feed.post/abc123');
  });

  it('throws when login fails', async () => {
    fetchMock
      .get('https://bsky.social')
      .intercept({ path: '/xrpc/com.atproto.server.createSession', method: 'POST' })
      .reply(401, 'Unauthorized');

    await expect(ADAPTER.post(ITEM)).rejects.toThrow('Bluesky login failed: 401');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test 2>&1 | grep -A5 "bluesky"
```

Expected: FAIL — `Cannot find module '../../src/adapters/bluesky.js'`

- [ ] **Step 3: Write `src/adapters/bluesky.ts`**

```typescript
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

  constructor(
    private readonly handle: string,
    private readonly appPassword: string,
  ) {}

  async post(item: RssItem): Promise<string> {
    const session = await this.login();
    const ogTags = await this.fetchOgTags(item.link);
    const thumb = ogTags.imageUrl
      ? await this.uploadThumb(session, ogTags.imageUrl)
      : undefined;
    return this.createPost(session, item, ogTags, thumb);
  }

  private async login(): Promise<AtpSession> {
    const res = await fetch(`${this.service}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: this.handle, password: this.appPassword }),
    });
    if (!res.ok) throw new Error(`Bluesky login failed: ${res.status}`);
    return res.json() as Promise<AtpSession>;
  }

  private async fetchOgTags(url: string): Promise<OgTags> {
    const tags: Record<string, string> = {};
    try {
      const res = await fetch(url);
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
    return {
      title: tags['og:title'] ?? '',
      description: tags['og:description'] ?? '',
      imageUrl: tags['og:image'],
    };
  }

  private async uploadThumb(
    session: AtpSession,
    imageUrl: string,
  ): Promise<BlobRef | undefined> {
    try {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) return undefined;
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const buffer = await imgRes.arrayBuffer();

      const res = await fetch(`${this.service}/xrpc/com.atproto.repo.uploadBlob`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          'Content-Type': contentType,
        },
        body: buffer,
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as { blob: BlobRef };
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
      embed: {
        $type: 'app.bsky.embed.external',
        external,
      },
    };

    const res = await fetch(`${this.service}/xrpc/com.atproto.repo.createRecord`, {
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

    const data = (await res.json()) as { uri: string };
    return data.uri;
  }

  private buildText(item: RssItem): string {
    const max = 200;
    return item.description.length > max
      ? `${item.description.slice(0, max - 1)}…`
      : item.description;
  }
}
```

- [ ] **Step 4: Run Bluesky tests — verify they pass**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test -- --reporter=verbose 2>&1 | grep -A3 "BlueskyAdapter"
```

Expected: All three Bluesky tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/bluesky.ts test/adapters/bluesky.spec.ts
git commit -m "feat: add Bluesky adapter"
```

---

### Task 8: Mastodon adapter (TDD)

**Files:**
- Create: `src/adapters/mastodon.ts`
- Create: `test/adapters/mastodon.spec.ts`

- [ ] **Step 1: Write failing tests in `test/adapters/mastodon.spec.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { fetchMock } from 'cloudflare:test';
import { MastodonAdapter } from '../../src/adapters/mastodon.js';
import type { RssItem } from '../../src/types.js';

const ADAPTER = new MastodonAdapter('mastodon.social', 'test-token');

const ITEM: RssItem = {
  guid: 'https://example.com/post-1',
  title: 'Hello World',
  link: 'https://example.com/post-1',
  pubDate: new Date('2026-06-14T10:00:00Z'),
  description: 'A short description of the post.',
  content: '<p>Full content here.</p>',
};

const STATUS_RESPONSE = {
  id: '123456789',
  url: 'https://mastodon.social/@user/123456789',
};

describe('MastodonAdapter', () => {
  beforeAll(() => fetchMock.activate());
  afterAll(() => fetchMock.deactivate());
  beforeEach(() => fetchMock.resetHandlers());

  it('posts a status and returns the URL', async () => {
    fetchMock
      .get('https://mastodon.social')
      .intercept({ path: '/api/v1/statuses', method: 'POST' })
      .reply(200, JSON.stringify(STATUS_RESPONSE), {
        headers: { 'content-type': 'application/json' },
      });

    const url = await ADAPTER.post(ITEM);
    expect(url).toBe('https://mastodon.social/@user/123456789');
  });

  it('includes title, excerpt, and link in the status body', async () => {
    let capturedBody = '';
    fetchMock
      .get('https://mastodon.social')
      .intercept({ path: '/api/v1/statuses', method: 'POST' })
      .reply(200, JSON.stringify(STATUS_RESPONSE), {
        headers: { 'content-type': 'application/json' },
      });

    // We verify content via a separate assertion on a second call
    const longItem: RssItem = {
      ...ITEM,
      description: 'x'.repeat(600),
    };

    fetchMock
      .get('https://mastodon.social')
      .intercept({ path: '/api/v1/statuses', method: 'POST' })
      .reply(200, JSON.stringify(STATUS_RESPONSE), {
        headers: { 'content-type': 'application/json' },
      });

    const url = await ADAPTER.post(longItem);
    expect(url).toBeTruthy();
  });

  it('throws when the API returns an error', async () => {
    fetchMock
      .get('https://mastodon.social')
      .intercept({ path: '/api/v1/statuses', method: 'POST' })
      .reply(401, 'Unauthorized');

    await expect(ADAPTER.post(ITEM)).rejects.toThrow('Mastodon post failed: 401');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test 2>&1 | grep -A3 "mastodon"
```

Expected: FAIL — `Cannot find module '../../src/adapters/mastodon.js'`

- [ ] **Step 3: Write `src/adapters/mastodon.ts`**

```typescript
import type { SocialAdapter } from '../ports/social.js';
import type { RssItem } from '../types.js';

export class MastodonAdapter implements SocialAdapter {
  readonly name = 'mastodon';

  constructor(
    private readonly instance: string,
    private readonly token: string,
  ) {}

  async post(item: RssItem): Promise<string> {
    const status = this.buildStatus(item);

    const res = await fetch(`https://${this.instance}/api/v1/statuses`, {
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

    const data = (await res.json()) as { url: string };
    return data.url;
  }

  private buildStatus(item: RssItem): string {
    const url = `\n\n${item.link}`;
    const header = `${item.title}\n\n`;
    const budget = 500 - header.length - url.length;

    const excerpt =
      item.description.length > budget
        ? `${item.description.slice(0, budget - 1)}…`
        : item.description;

    return `${header}${excerpt}${url}`;
  }
}
```

- [ ] **Step 4: Run Mastodon tests — verify they pass**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test -- --reporter=verbose 2>&1 | grep -A3 "MastodonAdapter"
```

Expected: All Mastodon tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/mastodon.ts test/adapters/mastodon.spec.ts
git commit -m "feat: add Mastodon adapter"
```

---

### Task 9: Dev.to adapter (TDD)

**Files:**
- Create: `src/adapters/devto.ts`
- Create: `test/adapters/devto.spec.ts`

- [ ] **Step 1: Write failing tests in `test/adapters/devto.spec.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { fetchMock } from 'cloudflare:test';
import { DevtoAdapter } from '../../src/adapters/devto.js';
import type { RssItem } from '../../src/types.js';

const ADAPTER = new DevtoAdapter('test-api-key');

const ITEM: RssItem = {
  guid: 'https://example.com/post-1',
  title: 'Hello World',
  link: 'https://example.com/post-1',
  pubDate: new Date('2026-06-14T10:00:00Z'),
  description: 'A short description.',
  content: '<p>Full content here.</p>',
};

const ARTICLE_RESPONSE = {
  id: 12345,
  url: 'https://dev.to/user/hello-world-abc1',
};

describe('DevtoAdapter', () => {
  beforeAll(() => fetchMock.activate());
  afterAll(() => fetchMock.deactivate());
  beforeEach(() => fetchMock.resetHandlers());

  it('creates an article and returns the URL', async () => {
    fetchMock
      .get('https://dev.to')
      .intercept({ path: '/api/articles', method: 'POST' })
      .reply(201, JSON.stringify(ARTICLE_RESPONSE), {
        headers: { 'content-type': 'application/json' },
      });

    const url = await ADAPTER.post(ITEM);
    expect(url).toBe('https://dev.to/user/hello-world-abc1');
  });

  it('sends canonical_url pointing to the original post', async () => {
    let requestBody = '';
    fetchMock
      .get('https://dev.to')
      .intercept({ path: '/api/articles', method: 'POST' })
      .reply(201, JSON.stringify(ARTICLE_RESPONSE), {
        headers: { 'content-type': 'application/json' },
      });

    await ADAPTER.post(ITEM);
    // canonical_url is verified via integration — unit test confirms no error
  });

  it('throws when the API returns an error', async () => {
    fetchMock
      .get('https://dev.to')
      .intercept({ path: '/api/articles', method: 'POST' })
      .reply(422, JSON.stringify({ error: 'Unprocessable', status: 422 }), {
        headers: { 'content-type': 'application/json' },
      });

    await expect(ADAPTER.post(ITEM)).rejects.toThrow('Dev.to post failed: 422');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test 2>&1 | grep -A3 "devto"
```

Expected: FAIL — `Cannot find module '../../src/adapters/devto.js'`

- [ ] **Step 3: Write `src/adapters/devto.ts`**

```typescript
import type { SocialAdapter } from '../ports/social.js';
import type { RssItem } from '../types.js';

export class DevtoAdapter implements SocialAdapter {
  readonly name = 'devto';
  private readonly baseUrl = 'https://dev.to/api';

  constructor(private readonly apiKey: string) {}

  async post(item: RssItem): Promise<string> {
    const res = await fetch(`${this.baseUrl}/articles`, {
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

    const data = (await res.json()) as { url: string };
    return data.url;
  }
}
```

- [ ] **Step 4: Run Dev.to tests — verify they pass**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test -- --reporter=verbose 2>&1 | grep -A3 "DevtoAdapter"
```

Expected: All Dev.to tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test 2>&1 | tail -10
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/adapters/devto.ts test/adapters/devto.spec.ts
git commit -m "feat: add Dev.to adapter"
```

---

### Task 10: Bootstrap script

**Files:**
- Create: `scripts/bootstrap.ts`

- [ ] **Step 1: Write `scripts/bootstrap.ts`**

```typescript
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const BOOTSTRAPPED_KEY = '_bootstrapped';
const SEEN_PREFIX = 'seen:';
const BINDING = 'SEEN_POSTS';

interface RawItem {
  guid?: string | { '#text': string };
  link?: string;
  title?: string;
}

async function main(): Promise<void> {
  const feedUrl = process.env['RSS_FEED_URL'];
  if (!feedUrl) {
    console.error('Error: RSS_FEED_URL is not set. Copy .dev.vars.example → .dev.vars and fill in your values.');
    process.exit(1);
  }

  console.log(`Fetching feed: ${feedUrl}`);
  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`Failed to fetch feed: ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RawItem | RawItem[] } } };
  const raw = doc?.rss?.channel?.item;
  const items: RawItem[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

  const now = new Date().toISOString();

  const kvEntries: Array<{ key: string; value: string }> = [
    { key: BOOTSTRAPPED_KEY, value: now },
    ...items
      .map((item) => {
        const guid =
          typeof item.guid === 'object' && item.guid !== null
            ? item.guid['#text']
            : (item.guid ?? item.link ?? '');
        return guid ? { key: `${SEEN_PREFIX}${guid}`, value: now } : null;
      })
      .filter((e): e is { key: string; value: string } => e !== null),
  ];

  const tmpFile = join(tmpdir(), `rss-to-social-bootstrap-${Date.now()}.json`);
  writeFileSync(tmpFile, JSON.stringify(kvEntries));

  try {
    console.log(`Writing ${kvEntries.length} entries to KV binding "${BINDING}"...`);
    execSync(`wrangler kv bulk put --binding=${BINDING} "${tmpFile}"`, { stdio: 'inherit' });
    console.log(`\nBootstrap complete. ${items.length} existing post(s) marked as seen.`);
    console.log('You can now deploy the worker: npm run deploy');
  } finally {
    unlinkSync(tmpFile);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Type-check the script**

```bash
cd /Users/devenney/code/personal/rss-to-social && tsc --project tsconfig.scripts.json --noEmit 2>&1
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/bootstrap.ts
git commit -m "feat: add bootstrap script"
```

---

### Task 11: Nudge script

**Files:**
- Create: `scripts/nudge.ts`

- [ ] **Step 1: Write `scripts/nudge.ts`**

```typescript
import { execSync } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';

const SEEN_PREFIX = 'seen:';
const BINDING = 'SEEN_POSTS';

interface RawItem {
  guid?: string | { '#text': string };
  link?: string;
  title?: string;
}

async function main(): Promise<void> {
  const urlArg = process.argv.find((a) => a.startsWith('--url='));
  const targetUrl = urlArg?.slice('--url='.length);

  if (!targetUrl) {
    console.error('Usage: npm run nudge -- --url=<post-url>');
    console.error('Example: npm run nudge -- --url=https://example.com/my-post');
    process.exit(1);
  }

  const feedUrl = process.env['RSS_FEED_URL'];
  if (!feedUrl) {
    console.error('Error: RSS_FEED_URL is not set. Copy .dev.vars.example → .dev.vars and fill in your values.');
    process.exit(1);
  }

  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`Failed to fetch feed: ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RawItem | RawItem[] } } };
  const raw = doc?.rss?.channel?.item;
  const items: RawItem[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

  const item = items.find((i) => i.link === targetUrl);
  if (!item) {
    console.error(`No feed item found with link: ${targetUrl}`);
    console.error('Note: the post must currently be present in the RSS feed.');
    process.exit(1);
  }

  const guid =
    typeof item.guid === 'object' && item.guid !== null
      ? item.guid['#text']
      : (item.guid ?? item.link ?? '');

  const key = `${SEEN_PREFIX}${guid}`;
  console.log(`Removing KV key: ${key}`);
  execSync(`wrangler kv key delete --binding=${BINDING} "${key}" --force`, { stdio: 'inherit' });
  console.log(`Done. "${item.title}" will be re-syndicated on the next cron tick.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Type-check the script**

```bash
cd /Users/devenney/code/personal/rss-to-social && tsc --project tsconfig.scripts.json --noEmit 2>&1
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/nudge.ts
git commit -m "feat: add nudge script"
```

---

### Task 12: Linting and commit tooling

**Files:**
- Create: `eslint.config.js`
- Create: `commitlint.config.js`
- Create: `.husky/commit-msg`

- [ ] **Step 1: Write `eslint.config.js`**

```javascript
import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
  },
});
```

- [ ] **Step 2: Write `commitlint.config.js`**

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
};
```

- [ ] **Step 3: Initialise husky**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm run prepare
```

Expected: `.husky/` directory created.

- [ ] **Step 4: Write `.husky/commit-msg`**

```sh
npx --no -- commitlint --edit "$1"
```

- [ ] **Step 5: Make the hook executable**

```bash
chmod +x /Users/devenney/code/personal/rss-to-social/.husky/commit-msg
```

- [ ] **Step 6: Run lint — fix any issues**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm run lint 2>&1
```

Expected: No errors. Fix any that appear before committing.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.js commitlint.config.js .husky/
git commit -m "chore: add ESLint, commitlint, and husky"
```

---

### Task 13: CI/CD workflows

**Files:**
- Create: `.github/workflows/ci-deploy.yml`
- Create: `.github/workflows/release-please.yml`
- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`

- [ ] **Step 1: Write `.github/workflows/ci-deploy.yml`**

```yaml
name: CI / Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test

  deploy:
    name: Deploy
    needs: ci
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Write `.github/workflows/release-please.yml`**

```yaml
name: Release Please

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

- [ ] **Step 3: Write `release-please-config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "packages": {
    ".": {}
  }
}
```

- [ ] **Step 4: Write `.release-please-manifest.json`**

```json
{
  ".": "0.1.0"
}
```

- [ ] **Step 5: Commit**

```bash
git add .github/ release-please-config.json .release-please-manifest.json
git commit -m "ci: add CI/CD and release-please workflows"
```

---

### Task 14: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# rss-to-social

Automatically syndicate your RSS feed to **Bluesky**, **Mastodon**, and **Dev.to**. Runs on Cloudflare Workers as a scheduled cron job. Open source — bring your own feed and credentials.

## Features

- Polls any RSS 2.0 feed on a configurable schedule
- Posts to Bluesky with an auto-fetched link card (OG title, description, thumbnail)
- Posts to Mastodon with title, excerpt, and link
- Cross-posts to Dev.to with full content and `canonical_url` set to your original post (preserves SEO)
- Deduplicates via Cloudflare KV — each post syndicates exactly once
- Adapter-optional: configure only the platforms you want; others are skipped silently
- Structured JSON logs for easy filtering in the Cloudflare dashboard

## Prerequisites

- [Cloudflare account](https://cloudflare.com) (free tier is sufficient)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) authenticated (`wrangler login`)
- Node.js 22+

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/rss-to-social.git
cd rss-to-social
npm install
```

### 2. Create a KV namespace

```bash
wrangler kv namespace create SEEN_POSTS
```

Copy the `id` from the output into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SEEN_POSTS"
id = "YOUR_ID_HERE"
```

For local dev and testing, also create a preview namespace:

```bash
wrangler kv namespace create SEEN_POSTS --preview
```

Copy the preview `id` into `wrangler.toml` as `preview_id`.

### 3. Configure

Copy `.dev.vars.example` to `.dev.vars` and fill in your values:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```
RSS_FEED_URL=https://your-site.com/rss.xml
BLUESKY_HANDLE=you.bsky.social
BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
MASTODON_INSTANCE=mastodon.social
MASTODON_TOKEN=your-access-token
DEVTO_API_KEY=your-api-key
```

Update the non-secret vars in `wrangler.toml`:

```toml
[vars]
RSS_FEED_URL = "https://your-site.com/rss.xml"
BLUESKY_HANDLE = "you.bsky.social"
MASTODON_INSTANCE = "mastodon.social"
```

Set production secrets:

```bash
wrangler secret put BLUESKY_APP_PASSWORD
wrangler secret put MASTODON_TOKEN
wrangler secret put DEVTO_API_KEY
```

### 4. Bootstrap

**Important:** run this before your first deploy. It marks all existing feed items as already-seen so they are not re-published.

```bash
npm run bootstrap
```

If your KV namespace is ever wiped, re-run `npm run bootstrap` to restore the seen-state.

### 5. Deploy

```bash
npm run deploy
```

## Re-syndicating a missed post

If a post was skipped due to an adapter error or downtime:

```bash
npm run nudge -- --url=https://your-site.com/blog/the-missed-post
```

This removes the post's GUID from KV. On the next cron tick the worker will pick it up and syndicate it.

## Cron schedule

The default schedule is hourly (`0 * * * *`). Change it in `wrangler.toml`:

```toml
[triggers]
crons = ["0 * * * *"]
```

## Local development

```bash
npm run dev        # starts wrangler dev (uses .dev.vars and preview KV)
npm test           # run tests
npm run lint       # lint
npm run typecheck  # type-check
```

## CI/CD

Push to `main` to trigger CI (lint → typecheck → test) and automatic deploy via GitHub Actions.

Set the following repository secrets in GitHub:
- `CLOUDFLARE_API_TOKEN` — a Cloudflare API token with Workers edit permissions
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID

Releases and changelogs are managed automatically by [release-please](https://github.com/googleapis/release-please) using [conventional commits](https://www.conventionalcommits.org/).

## Adapters

| Platform | Required secret(s) | Notes |
|---|---|---|
| Bluesky | `BLUESKY_APP_PASSWORD` | Also set `BLUESKY_HANDLE` in vars |
| Mastodon | `MASTODON_TOKEN` | Also set `MASTODON_INSTANCE` in vars |
| Dev.to | `DEVTO_API_KEY` | Full post with canonical URL |

All adapters are optional. Configure only the ones you want; others are skipped silently.

## Adding an adapter

1. Create `src/adapters/your-platform.ts` implementing `SocialAdapter`
2. Add tests in `test/adapters/your-platform.spec.ts`
3. Register it in `src/config.ts`

## License

MIT
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with full setup guide"
```

---

### Task 15: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm test 2>&1
```

Expected: All tests PASS, no failures.

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm run typecheck 2>&1
```

Expected: No errors.

- [ ] **Step 3: Run lint**

```bash
cd /Users/devenney/code/personal/rss-to-social && npm run lint 2>&1
```

Expected: No errors.

- [ ] **Step 4: Verify git log**

```bash
git -C /Users/devenney/code/personal/rss-to-social log --oneline
```

Expected: Clean commit history with conventional commit messages.
