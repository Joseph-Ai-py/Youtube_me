export type Service = 'YouTube' | 'YouTube Music' | string;

export interface WatchRecord {
  title: string;
  videoId: string | null;
  titleUrl: string | null;
  channelId: string | null;
  channelName: string | null;
  time: Date;
  service: Service;
  isShort: boolean;
}

export interface CommunityPostRecord {
  postUrl: string | null;
  channelId: string | null;
  channelName: string | null;
  time: Date;
  service: Service;
}

export interface WatchData {
  videos: WatchRecord[];
  communityPosts: CommunityPostRecord[];
  unclassifiedCount: number;
  missingUrlCount: number;
  channelNames: Map<string, string>;
}

export interface SearchRecord {
  query: string;
  time: Date;
  service: Service;
}

export interface RecapStats {
  totalRecords: number;
  videoCount: number;
  communityPostCount: number;
  shortCount: number;
  uniqueChannels: number;
  topChannel: { name: string; count: number } | null;
  topDay: { name: string; count: number } | null;
  topHour: { hour: number; count: number } | null;
  newChannelRate: number;
  repeatedVideoRate: number;
  channelDiversity: number;
  hhi: number;
  firstDate: Date | null;
  lastDate: Date | null;
  youtubeMusicCount: number;
  topMusic: { title: string; channelName: string | null; count: number } | null;
  searchCount: number;
  activeDays: number;
  averagePerActiveDay: number;
  weekendRate: number;
  topVideos: { title: string; channelName: string | null; count: number; url: string | null }[];
  recentVideos: WatchRecord[];
  serviceCounts: { name: string; count: number }[];
  topSearches: { query: string; count: number }[];
}
