import type {
  DailyActivity,
  DateCoverage,
  RecapStats,
  RhythmCell,
  SearchRecord,
  InterestScore,
  WatchData,
  WatchRecord,
  WatchSession,
  BehaviorDimensionKey,
  BehaviorProfile,
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

function searchDiversity(searches: SearchRecord[]): number {
  const counts = countBy(searches, (search) => search.query.trim().toLocaleLowerCase());
  return diversity(counts);
}

const interestRules = [
  { category: '게임', icon: '🎮', keywords: ['게임', '좀보이드', '마인크래프트', 'minecraft', '롤', '리그 오브 레전드', '배틀그라운드', '스팀', 'game'] },
  { category: '음악', icon: '🎵', keywords: ['노래', 'cover', '가사', 'lyrics', 'k-pop', 'kpop', '아이돌', '뮤직', 'music', 'n mixx', 'nmixx'] },
  { category: '역사', icon: '📚', keywords: ['역사', '조선', '고려', '삼국지', '전쟁', 'war', 'history'] },
  { category: '영화·드라마', icon: '🎬', keywords: ['영화', '드라마', '예고편', 'marvel', '넷플릭스', 'netflix', 'trailer'] },
  { category: 'IT·AI', icon: '💻', keywords: ['it', 'ai', '인공지능', '코딩', '개발', '프로그래밍', '리뷰', '테크', 'tech'] },
  { category: '교육', icon: '🧠', keywords: ['공부', '강의', '강좌', '수학', '영어', '교육', 'tutorial', 'lecture'] },
  { category: '스포츠', icon: '⚽', keywords: ['축구', '야구', '농구', '스포츠', '골프', 'football', 'baseball'] },
] as const;

function classifyInterest(text: string): number {
  const normalized = text.toLocaleLowerCase();
  return interestRules.findIndex((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)));
}

function buildInterests(videos: WatchRecord[], searches: SearchRecord[]): InterestScore[] {
  const watchCounts = interestRules.map(() => 0);
  const searchCounts = interestRules.map(() => 0);
  const replayCounts = interestRules.map(() => 0);
  const videoIdCounts = countBy(videos, (video) => video.videoId ?? video.title);

  videos.forEach((video) => {
    const category = classifyInterest(video.title);
    if (category >= 0) {
      watchCounts[category] += 1;
      if ((videoIdCounts.get(video.videoId ?? video.title) ?? 0) > 1) replayCounts[category] += 1;
    }
  });
  searches.forEach((search) => {
    const category = classifyInterest(search.query);
    if (category >= 0) searchCounts[category] += 1;
  });

  const totalWatch = watchCounts.reduce((sum, count) => sum + count, 0);
  const totalSearch = searchCounts.reduce((sum, count) => sum + count, 0);
  const totalReplay = replayCounts.reduce((sum, count) => sum + count, 0);
  const scores: InterestScore[] = interestRules.map((rule, index) => ({
    category: rule.category,
    icon: rule.icon,
    score: 0.6 * (totalWatch ? watchCounts[index] / totalWatch : 0)
      + 0.25 * (totalSearch ? searchCounts[index] / totalSearch : 0)
      + 0.15 * (totalReplay ? replayCounts[index] / totalReplay : 0),
    count: watchCounts[index],
  }));
  const classifiedCount = scores.reduce((sum, item) => sum + item.count, 0);
  if (videos.length > classifiedCount) scores.push({ category: '기타', icon: '•', score: 0, count: videos.length - classifiedCount });
  return scores.sort((a, b) => b.score - a.score || b.count - a.count).slice(0, 5).map((item) => ({
    ...item,
    score: Math.round(item.score * 100),
  }));
}

function buildBehaviorProfile(
  channelDiscoveryRate: number,
  channelDiversity: number,
  channelConcentration: number,
  repeatViewRate: number,
  searchVariety: number,
  sessions: WatchSession[],
  activeDayRate: number,
): BehaviorProfile {
  const bingeRatio = sessions.length ? sessions.filter((session) => session.videoCount >= 2).length / sessions.length : 0;
  const averageSessionLength = sessions.length
    ? Math.min(sessions.reduce((sum, session) => sum + session.videoCount, 0) / sessions.length / 10, 1)
    : 0;
  const maxSessionLength = sessions.length ? Math.min(Math.max(...sessions.map((session) => session.videoCount)) / 100, 1) : 0;
  const scoreValues: Record<BehaviorDimensionKey, number> = {
    exploration: 0.45 * channelDiscoveryRate + 0.35 * channelDiversity + 0.2 * searchVariety,
    focus: 0.7 * channelConcentration + 0.3 * (1 - channelDiversity),
    repetition: repeatViewRate,
    immersion: 0.45 * bingeRatio + 0.3 * averageSessionLength + 0.25 * maxSessionLength,
    regularity: activeDayRate,
  };
  const descriptions: Record<BehaviorDimensionKey, { label: string; description: string }> = {
    exploration: { label: '탐색성', description: '새 채널과 검색 주제를 넓게 발견하는 정도입니다.' },
    focus: { label: '집중성', description: '소수의 채널과 익숙한 주제에 시청이 모이는 정도입니다.' },
    repetition: { label: '반복성', description: '같은 영상을 다시 시청하는 정도입니다.' },
    immersion: { label: '몰입성', description: '한 세션에서 여러 영상을 이어 보는 정도입니다.' },
    regularity: { label: '규칙성', description: '전체 기간 중 활동일이 꾸준히 이어지는 정도입니다.' },
  };
  const evidence: Record<BehaviorDimensionKey, { label: string; value: string }[]> = {
    exploration: [
      { label: '채널 발견률', value: `${Math.round(channelDiscoveryRate * 100)}%` },
      { label: '검색 다양도', value: `${Math.round(searchVariety * 100)}점` },
    ],
    focus: [
      { label: '채널 집중도', value: `${Math.round(channelConcentration * 100)}%` },
      { label: '채널 다양성', value: `${Math.round(channelDiversity * 100)}점` },
    ],
    repetition: [
      { label: '반복 시청 기록', value: `${Math.round(repeatViewRate * 100)}%` },
    ],
    immersion: [
      { label: '몰아보기 세션', value: `${Math.round(bingeRatio * 100)}%` },
      { label: '평균 세션 길이', value: `${(sessions.length ? sessions.reduce((sum, session) => sum + session.videoCount, 0) / sessions.length : 0).toFixed(1)}개` },
    ],
    regularity: [
      { label: '관찰 기간 활동률', value: `${Math.round(activeDayRate * 100)}%` },
    ],
  };
  const scores = (Object.keys(scoreValues) as BehaviorDimensionKey[]).map((key) => ({
    key,
    label: descriptions[key].label,
    score: Math.round(Math.max(0, Math.min(scoreValues[key], 1)) * 100),
    description: descriptions[key].description,
    evidence: evidence[key],
  }));
  return { scores };
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
  const channelConcentration = shareTotal ? channelValues.reduce((sum, value) => sum + (value / shareTotal) ** 2, 0) : 0;
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
  const searchVariety = searchDiversity(searches);
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

  const channelDiscoveryRate = total ? newChannels / total : 0;
  const repeatViewRate = total ? repeatedViews / total : 0;
  const watchDays = inclusiveDays(watchRange.start, watchRange.end);
  const activeDayRate = watchDays > 1 ? activeDateKeys.size / watchDays : 0;
  const behaviorProfile = buildBehaviorProfile(channelDiscoveryRate, diversity(channelCounts), channelConcentration, repeatViewRate, searchVariety, sessions, activeDayRate);

  return {
    totalRecords: videos.length + musicVideos.length + data.communityPosts.length,
    videoCount: videos.length,
    communityPostCount: data.communityPosts.length,
    shortCount: videos.filter((video) => video.isShort).length,
    uniqueChannels: channelCounts.size,
    topChannel,
    topDay: highest(dayCounts),
    topHour: topHour ? { hour: Number(topHour.name), count: topHour.count } : null,
    channelDiscoveryRate,
    repeatViewRate,
    channelDiversity: diversity(channelCounts),
    channelConcentration,
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
    behaviorProfile,
    interests: buildInterests(videos, searches),
  };
}
