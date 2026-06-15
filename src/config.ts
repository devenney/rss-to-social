import type { SocialAdapter } from './ports/social.js';
import { BlueskyAdapter } from './adapters/bluesky.js';
import { MastodonAdapter } from './adapters/mastodon.js';

export function buildAdapters(env: Env): SocialAdapter[] {
  const adapters: SocialAdapter[] = [];

  if (env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD) {
    adapters.push(new BlueskyAdapter(env.BLUESKY_HANDLE, env.BLUESKY_APP_PASSWORD));
  }
  if (env.MASTODON_INSTANCE && env.MASTODON_TOKEN) {
    adapters.push(new MastodonAdapter(env.MASTODON_INSTANCE, env.MASTODON_TOKEN));
  }

  return adapters;
}
