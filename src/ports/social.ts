import type { RssItem } from '../types.js';

export interface SocialAdapter {
  readonly name: string;
  post(item: RssItem): Promise<string>;
}
