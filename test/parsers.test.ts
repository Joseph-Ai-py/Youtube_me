import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { cleanWatchTitle, parseSearchHistory, parseTakeoutZip, parseWatchHistory } from '../src/parsers';

const watchedEntry = {
  header: 'YouTube',
  title: 'Watched A video title 을(를) 시청했습니다.',
  titleUrl: 'https://www.youtube.com/watch?v=abc123',
  time: '2026-09-01T10:00:00Z',
};

test('cleans localized watch title prefixes and suffixes', () => {
  assert.equal(cleanWatchTitle(watchedEntry.title), 'A video title');
  assert.equal(cleanWatchTitle('Watched Another title'), 'Another title');
});

test('parses watch and search records from English Takeout JSON', () => {
  const watch = parseWatchHistory(JSON.stringify([watchedEntry]));
  const searches = parseSearchHistory(JSON.stringify([{
    header: 'YouTube',
    title: 'cats searched for',
    time: '2026-09-01T11:00:00Z',
  }]));

  assert.equal(watch.videos[0]?.title, 'A video title');
  assert.equal(watch.videos[0]?.videoId, 'abc123');
  assert.equal(searches[0]?.query, 'cats');
});

test('finds English Takeout filenames with regex patterns', async () => {
  const zip = new JSZip();
  zip.file('Takeout/YouTube/watch-history.json', JSON.stringify([watchedEntry]));
  zip.file('Takeout/YouTube/search-history.json', JSON.stringify([{
    header: 'YouTube',
    title: 'cats searched for',
    time: '2026-09-01T11:00:00Z',
  }]));

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const parsed = await parseTakeoutZip(bytes);

  assert.equal(parsed.watch.videos.length, 1);
  assert.equal(parsed.searches[0]?.query, 'cats');
});
