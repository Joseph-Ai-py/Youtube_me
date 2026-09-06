import type { CommunityPostRecord, SearchRecord, WatchData, WatchRecord } from './types';
import JSZip from 'jszip';

interface RawEntry {
  header?: unknown;
  title?: unknown;
  titleUrl?: unknown;
  subtitles?: unknown;
  time?: unknown;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function cleanWatchTitle(title: string): string {
  return title
    .replace(/^(?:Watched\s+|시청함\s*[:：]?\s*|시청한 동영상\s*[:：]?\s*)/iu, '')
    .replace(/\s+(?:을\(를\)\s*시청했습니다|watched)\.?\s*$/iu, '')
    .trim();
}

function parseTime(value: unknown): Date | null {
  const date = new Date(asText(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function channelInfo(subtitles: unknown): { channelId: string | null; channelName: string | null } {
  if (!Array.isArray(subtitles) || !subtitles[0] || typeof subtitles[0] !== 'object') {
    return { channelId: null, channelName: null };
  }

  const item = subtitles[0] as { name?: unknown; url?: unknown };
  const url = asText(item.url);
  const match = url.match(/\/channel\/([^/?]+)/);
  return { channelId: match?.[1] ?? null, channelName: asText(item.name) || null };
}

function entriesFromJson(raw: string): RawEntry[] {
  const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, ''));
  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : null;

  if (!entries) throw new Error('JSON 최상위 값은 시청 기록 배열이어야 합니다.');
  return entries.filter((entry): entry is RawEntry => Boolean(entry && typeof entry === 'object'));
}

export function parseWatchHistory(raw: string): WatchData {
  const videos: WatchRecord[] = [];
  const communityPosts: CommunityPostRecord[] = [];
  let unclassifiedCount = 0;
  let missingUrlCount = 0;

  for (const entry of entriesFromJson(raw)) {
    const time = parseTime(entry.time);
    if (!time) continue;

    const titleUrl = asText(entry.titleUrl) || null;
    const title = cleanWatchTitle(asText(entry.title));
    const service = asText(entry.header) || 'YouTube';
    const channel = channelInfo(entry.subtitles);

    if (!titleUrl) {
      missingUrlCount += 1;
      unclassifiedCount += 1;
      continue;
    }

    if (titleUrl.includes('/post/')) {
      communityPosts.push({ postUrl: titleUrl, ...channel, time, service });
      continue;
    }

    const videoMatch = titleUrl.match(/[?&]v=([^&]+)/) ?? titleUrl.match(/\/shorts\/([^/?]+)/);
    if (!videoMatch) {
      unclassifiedCount += 1;
      continue;
    }

    videos.push({
      title,
      videoId: videoMatch[1],
      titleUrl,
      ...channel,
      time,
      service,
      isShort: title.toLowerCase().includes('#shorts'),
    });
  }

  return { videos, communityPosts, unclassifiedCount, missingUrlCount, channelNames: new Map(), subscriptionCount: 0 };
}

export function parseSearchHistory(raw: string): SearchRecord[] {
  const results: SearchRecord[] = [];
  for (const entry of entriesFromJson(raw)) {
    const time = parseTime(entry.time);
    const title = asText(entry.title);
    if (!time || !title) continue;
    const stripped = title.replace(/\s*(?:을\(를\)\s*검색했습니다|searched for)\.?$/iu, '').trim();
    let query = stripped !== title.trim() ? stripped : '';
    if (!query && entry.titleUrl) {
      try {
        query = new URL(asText(entry.titleUrl)).searchParams.get('search_query') ?? '';
      } catch {
        query = '';
      }
    }
    if (query) results.push({ query, time, service: asText(entry.header) || 'YouTube' });
  }
  return results;
}

export async function parseTakeoutZip(file: Blob | Uint8Array): Promise<{ watch: WatchData; searches: SearchRecord[] }> {
  const zip = await JSZip.loadAsync(file);
  const watchFile = Object.keys(zip.files).find((path) => /(?:^|\/)(?:watch[-_ ]?history|시청[-_ ]?기록)\.json$/iu.test(path));
  const searchFile = Object.keys(zip.files).find((path) => /(?:^|\/)(?:search[-_ ]?history|검색[-_ ]?기록)\.json$/iu.test(path));
  if (!watchFile) throw new Error('ZIP 안에서 시청 기록 JSON 파일을 찾지 못했습니다.');

  const watchRaw = await zip.files[watchFile].async('string');
  const searchRaw = searchFile ? await zip.files[searchFile].async('string') : null;
  const subscriptionFile = Object.keys(zip.files).find((path) => /(?:^|\/)(?:subscriptions?|구독[-_ ]?정보)\.csv$/iu.test(path));
  const channelNames = new Map<string, string>();
  let subscriptionCount = 0;
  if (subscriptionFile) {
    const csv = await zip.files[subscriptionFile].async('string');
    for (const line of csv.replace(/^\uFEFF/, '').split(/\r?\n/).slice(1)) {
      const columns = line.match(/(?:^|,)\s*(?:"([^"]*)"|([^,]*))/g)?.map((column) => column.replace(/^,\s*|^\s*"|"\s*$/g, '')) ?? [];
      const channelId = columns[0]?.trim();
      const channelTitle = columns[2]?.trim();
      if (channelId) subscriptionCount += 1;
      if (channelId && channelTitle) channelNames.set(channelId, channelTitle);
    }
  }
  const watch = parseWatchHistory(watchRaw);
  watch.channelNames = channelNames;
  watch.subscriptionCount = subscriptionCount;
  return {
    watch,
    searches: searchRaw ? parseSearchHistory(searchRaw) : [],
  };
}
