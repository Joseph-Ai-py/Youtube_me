import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStats } from '../src/features';
import type { WatchData, WatchRecord } from '../src/types';

function video(title: string, videoId: string, channelId: string, time: string): WatchRecord {
  return {
    title,
    videoId,
    titleUrl: `https://www.youtube.com/watch?v=${videoId}`,
    channelId,
    channelName: channelId,
    time: new Date(time),
    service: 'YouTube',
    isShort: false,
  };
}

function watchData(videos: WatchRecord[]): WatchData {
  return {
    videos,
    communityPosts: [],
    unclassifiedCount: 0,
    missingUrlCount: 0,
    channelNames: new Map(),
    subscriptionCount: 0,
  };
}

test('calculates repeat, channel, and session metrics consistently', () => {
  const stats = calculateStats(watchData([
    video('First', 'one', 'channel-a', '2026-09-01T10:00:00Z'),
    video('First', 'one', 'channel-a', '2026-09-01T10:05:00Z'),
    video('Second', 'two', 'channel-b', '2026-09-01T10:10:00Z'),
  ]));

  assert.equal(stats.videoCount, 3);
  assert.equal(stats.repeatedVideoRate, 2 / 3);
  assert.equal(stats.newChannelRate, 2 / 3);
  assert.equal(stats.sessions.length, 1);
  assert.equal(stats.longestSession?.videoCount, 3);
  assert.equal(stats.topVideos[0]?.count, 2);
});
