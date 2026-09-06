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
  subscriptionCount: number;
}

export interface SearchRecord {
  query: string;
  time: Date;
  service: Service;
}

export interface DateCoverage {
  searchStart: Date | null;
  searchEnd: Date | null;
  watchStart: Date | null;
  watchEnd: Date | null;
  searchDays: number;
  watchDays: number;
  watchChannelCoverage: number;
  hasSearchData: boolean;
  hasSubscriptionData: boolean;
}

export interface RhythmCell {
  day: number;
  hour: number;
  count: number;
}

export interface DailyActivity {
  date: string;
  count: number;
}

export interface WatchSession {
  start: Date;
  end: Date;
  videoCount: number;
  durationMinutes: number;
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
  coverage: DateCoverage;
  rhythm: RhythmCell[];
  dailyActivity: DailyActivity[];
  maxDailyCount: number;
  sessions: WatchSession[];
  bingeSessionCount: number;
  longestSession: WatchSession | null;
}
