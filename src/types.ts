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
