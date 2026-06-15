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
