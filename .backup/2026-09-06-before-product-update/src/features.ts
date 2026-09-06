import type {
  DailyActivity,
  DateCoverage,
  RecapStats,
  RhythmCell,
  SearchRecord,
  WatchData,
  WatchRecord,
  WatchSession,
} from './types';

const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

function highest(counts: Map<string, number>): { name: string; count: number } | null {
  const item = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return item ? { name: item[0], count: item[1] } : null;
}

function ranked(counts: Map<string, number>, limit: number): { name: string; count: number }[] {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function diversity(channelCounts: Map<string, number>): number {
  const values = [...channelCounts.values()];
  if (values.length <= 1) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  const entropy = values.reduce((sum, value) => {
    const probability = value / total;
    return sum - probability * Math.log2(probability);
  }, 0);
  return entropy / Math.log2(values.length);
}

function dateRange(records: { time: Date }[]): { start: Date | null; end: Date | null } {
  if (!records.length) return { start: null, end: null };
  const sorted = [...records].sort((a, b) => a.time.getTime() - b.time.getTime());
  return { start: sorted[0].time, end: sorted.at(-1)?.time ?? sorted[0].time };
}

function inclusiveDays(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function buildRhythm(videos: WatchRecord[]): RhythmCell[] {
  const counts = new Map<string, number>();
  for (const video of videos) {
    const key = `${video.time.getDay()}:${video.time.getHours()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, hour) => ({
    day,
    hour,
    count: counts.get(`${day}:${hour}`) ?? 0,
  }))).flat();
}

function buildDailyActivity(videos: WatchRecord[]): DailyActivity[] {
  return [...countBy(videos, (video) => video.time.toISOString().slice(0, 10)).entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildSessions(videos: WatchRecord[]): WatchSession[] {
  const sorted = [...videos].sort((a, b) => a.time.getTime() - b.time.getTime());
  const sessions: WatchSession[] = [];
  const sessionGap = 15 * 60 * 1000;

  for (const video of sorted) {
    const current = sessions.at(-1);
    if (!current || video.time.getTime() - current.end.getTime() > sessionGap) {
      sessions.push({ start: video.time, end: video.time, videoCount: 1, durationMinutes: 0 });
      continue;
    }
    current.end = video.time;
    current.videoCount += 1;
    current.durationMinutes = (current.end.getTime() - current.start.getTime()) / 60000;
  }

  return sessions;
}

export function calculateStats(data: WatchData, searches: SearchRecord[] = []): RecapStats {
  const videos = data.videos.filter((video) => video.service === 'YouTube');
  const musicVideos = data.videos.filter((video) => video.service === 'YouTube Music');
  const channelRecords = videos.filter((video) => video.channelId || video.channelName);
  const channelCounts = countBy(channelRecords, (video) => video.channelId ?? video.channelName ?? '알 수 없는 채널');
  const titleCounts = countBy(videos, (video) => video.videoId ?? video.title);
  const repeatedViews = [...titleCounts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  const total = videos.length;
  const dates = videos.map((video) => video.time).sort((a, b) => a.getTime() - b.getTime());
  const dayCounts = countBy(videos, (video) => dayNames[video.time.getDay()]);
  const hourCounts = countBy(videos, (video) => String(video.time.getHours()));
  const activeDateKeys = new Set(videos.map((video) => video.time.toISOString().slice(0, 10)));
  const weekendCount = videos.filter((video) => [0, 6].includes(video.time.getDay())).length;
  const serviceCounts = ranked(countBy(data.videos, (video) => video.service), 3);
  const topHour = highest(hourCounts);
  const channelValues = [...channelCounts.values()];
  const shareTotal = channelValues.reduce((sum, value) => sum + value, 0);
  const hhi = shareTotal ? channelValues.reduce((sum, value) => sum + (value / shareTotal) ** 2, 0) : 0;
  const firstSeen = new Set<string>();
  let newChannels = 0;
  for (const video of [...videos].sort((a, b) => a.time.getTime() - b.time.getTime())) {
    const channel = video.channelId ?? video.channelName;
    if (channel && !firstSeen.has(channel)) {
      firstSeen.add(channel);
      newChannels += 1;
    }
  }

  const topChannel = highest(channelCounts);
  if (topChannel) {
    topChannel.name = data.channelNames.get(topChannel.name)
      ?? videos.find((video) => (video.channelId ?? video.channelName) === topChannel.name)?.channelName
      ?? '채널명 확인 불가';
  }

  const topVideos = ranked(titleCounts, 5).map((item) => {
    const video = videos.find((candidate) => (candidate.videoId ?? candidate.title) === item.name);
    return {
      title: video?.title ?? item.name,
      channelName: video?.channelName ?? null,
      count: item.count,
      url: video?.titleUrl ?? null,
    };
  });
  const searchCounts = countBy(searches, (search) => search.query);
  const musicCounts = countBy(musicVideos, (video) => video.videoId ?? video.title);
  const topMusicItem = highest(musicCounts);
  const topMusicVideo = topMusicItem
    ? musicVideos.find((video) => (video.videoId ?? video.title) === topMusicItem.name)
    : null;
  const watchRange = dateRange(videos);
  const searchRange = dateRange(searches);
  const dailyActivity = buildDailyActivity(videos);
  const sessions = buildSessions(videos);
  const coverage: DateCoverage = {
    searchStart: searchRange.start,
    searchEnd: searchRange.end,
    watchStart: watchRange.start,
    watchEnd: watchRange.end,
    searchDays: inclusiveDays(searchRange.start, searchRange.end),
    watchDays: inclusiveDays(watchRange.start, watchRange.end),
    watchChannelCoverage: total ? videos.filter((video) => video.channelId).length / total : 0,
    hasSearchData: searches.length > 0,
    hasSubscriptionData: data.subscriptionCount > 0,
  };

  return {
    totalRecords: videos.length + musicVideos.length + data.communityPosts.length,
    videoCount: videos.length,
    communityPostCount: data.communityPosts.length,
    shortCount: videos.filter((video) => video.isShort).length,
    uniqueChannels: channelCounts.size,
    topChannel,
    topDay: highest(dayCounts),
    topHour: topHour ? { hour: Number(topHour.name), count: topHour.count } : null,
    newChannelRate: total ? newChannels / total : 0,
    repeatedVideoRate: total ? repeatedViews / total : 0,
    channelDiversity: diversity(channelCounts),
    hhi,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    youtubeMusicCount: musicVideos.length,
    topMusic: topMusicItem ? {
      title: topMusicVideo?.title ?? topMusicItem.name,
      channelName: topMusicVideo?.channelName ?? null,
      count: topMusicItem.count,
    } : null,
    searchCount: searches.length,
    activeDays: activeDateKeys.size,
    averagePerActiveDay: activeDateKeys.size ? total / activeDateKeys.size : 0,
    weekendRate: total ? weekendCount / total : 0,
    topVideos,
    recentVideos: [...videos].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5),
    serviceCounts,
    topSearches: ranked(searchCounts, 5).map((item) => ({ query: item.name, count: item.count })),
    coverage,
    rhythm: buildRhythm(videos),
    dailyActivity,
    maxDailyCount: dailyActivity.reduce((max, item) => Math.max(max, item.count), 0),
    sessions,
    bingeSessionCount: sessions.filter((session) => session.videoCount >= 2).length,
    longestSession: sessions.reduce<WatchSession | null>((longest, session) => (
      !longest || session.videoCount > longest.videoCount
        || (session.videoCount === longest.videoCount && session.durationMinutes > longest.durationMinutes)
        ? session
        : longest
    ), null),
  };
}
