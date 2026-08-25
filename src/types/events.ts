export interface SearchEvent {
  type: "search";
  query: string;
  timestamp: string;
  platform: "youtube" | "youtube_music" | "unknown";
}

export interface WatchEvent {
  type: "watch";
  videoId?: string;
  title: string;
  channelName?: string;
  channelId?: string;
  timestamp: string;
  platform: "youtube" | "youtube_music" | "unknown";
  isAd: boolean;
}

export interface Subscription {
  type: "subscription";
  channelId?: string;
  channelName: string;
  channelUrl?: string;
}

export interface YouTubeData {
  search: SearchEvent[];
  watch: WatchEvent[];
  subscriptions: Subscription[];
}