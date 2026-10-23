import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MetadataDatabase } from '../../packages/storage/dist/database.js';

describe('DualSurf SQLite MetadataDatabase', () => {
  const db = new MetadataDatabase({ inMemory: true });

  it('records new history entries and increments visit counts', () => {
    const entry1 = db.addHistory('https://news.ycombinator.com', 'Hacker News');
    assert.equal(entry1.url, 'https://news.ycombinator.com');
    assert.equal(entry1.visitCount, 1);

    // Visiting the same URL increments visit count
    const entry2 = db.addHistory('https://news.ycombinator.com', 'Hacker News (Updated)');
    assert.equal(entry2.id, entry1.id);
    assert.equal(entry2.visitCount, 2);

    const history = db.getHistory(10);
    assert.equal(history.length, 1);
    assert.equal(history[0].visitCount, 2);
  });

  it('searches browsing history by title and URL', () => {
    db.addHistory('https://archlinux.org/packages', 'Arch Packages');
    db.addHistory('https://docs.kernel.org', 'Linux Kernel Documentation');

    const search1 = db.searchHistory('kernel');
    assert.equal(search1.length, 1);
    assert.equal(search1[0].title, 'Linux Kernel Documentation');

    const search2 = db.searchHistory('archlinux');
    assert.equal(search2.length, 1);
    assert.equal(search2[0].url, 'https://archlinux.org/packages');
  });

  it('manages bookmarks (add, list, remove)', () => {
    const bm1 = db.addBookmark('https://github.com/torvalds/linux', 'Linux Source Code');
    assert.ok(bm1.id.startsWith('bm-'));
    assert.equal(bm1.title, 'Linux Source Code');

    const list = db.getBookmarks();
    assert.equal(list.length, 1);
    assert.equal(list[0].url, 'https://github.com/torvalds/linux');

    const removed = db.removeBookmark(bm1.id);
    assert.equal(removed, true);

    const emptyList = db.getBookmarks();
    assert.equal(emptyList.length, 0);
  });

  it('logs downloads activity', () => {
    const dl = db.addDownload('dualsurf-0.1.0.AppImage', '/home/user/Downloads/dualsurf.AppImage', 'completed', 85000000);
    assert.ok(dl.id.startsWith('dl-'));
    assert.equal(dl.filename, 'dualsurf-0.1.0.AppImage');

    const downloads = db.getDownloads(5);
    assert.equal(downloads.length, 1);
  });

  it('clears browsing history', () => {
    db.clearHistory();
    const history = db.getHistory();
    assert.equal(history.length, 0);
  });

  it('supports clearing browsing history with time range filter', () => {
    db.addHistory('https://recent-visit.com', 'Recent Visit');
    const historyBefore = db.getHistory();
    assert.ok(historyBefore.length >= 1);

    // Clearing with a timestamp in the future does not purge past visits
    db.clearHistory(undefined, Date.now() + 100000);
    assert.ok(db.getHistory().length >= 1);

    // Clearing with a timestamp from 1 hour ago purges recent visits
    db.clearHistory(undefined, Date.now() - 3600000);
    assert.equal(db.getHistory().length, 0);
  });
});
