import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findBestMatchingLink,
  findTopMatchingLinks,
  findBestMatchingTab,
  normalizeQuery,
} from '../../apps/cli/dist/semantic/fuzzyMatcher.js';

describe('DualSurf Semantic Link & Tab Resolver', () => {
  const sampleLinks = [
    { id: 1, label: 'DualSurf Home', href: 'https://dualsurf.local' },
    { id: 2, label: 'Official Documentation', href: 'https://dualsurf.local/docs' },
    { id: 3, label: 'Pricing & Plans', href: 'https://dualsurf.local/pricing' },
    { id: 4, label: 'Sign In to Your Account', href: 'https://dualsurf.local/login' },
    { id: 5, label: 'GitHub Repository', href: 'https://github.com/dualsurf/browser' },
    { id: 6, label: 'Contact Support Team', href: 'https://dualsurf.local/support' },
  ];

  const sampleTabs = [
    {
      id: 'tab-1',
      title: 'DualSurf Documentation - Getting Started',
      url: 'https://dualsurf.local/docs',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      pinned: false,
      muted: false,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    },
    {
      id: 'tab-2',
      title: 'GitHub - Trending TypeScript Repositories',
      url: 'https://github.com/trending/typescript',
      isLoading: false,
      canGoBack: true,
      canGoForward: false,
      pinned: false,
      muted: false,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    },
    {
      id: 'tab-3',
      title: 'Hacker News',
      url: 'https://news.ycombinator.com',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      pinned: false,
      muted: false,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    },
  ];

  it('normalizes natural language query intent', () => {
    assert.equal(normalizeQuery('click the "Pricing" button'), 'pricing');
    assert.equal(normalizeQuery('go to Official Documentation link'), 'official documentation');
    assert.equal(normalizeQuery('open GitHub Repository'), 'github repository');
    assert.equal(normalizeQuery('switch to Hacker News tab'), 'hacker news');
  });

  it('matches link by exact or partial label', () => {
    const match1 = findBestMatchingLink('pricing', sampleLinks);
    assert.ok(match1);
    assert.equal(match1.item.id, 3);
    assert.equal(match1.item.label, 'Pricing & Plans');

    const match2 = findBestMatchingLink('docs', sampleLinks);
    assert.ok(match2);
    assert.equal(match2.item.id, 2);

    const match3 = findBestMatchingLink('click sign in button', sampleLinks);
    assert.ok(match3);
    assert.equal(match3.item.id, 4);
  });

  it('returns top ranked matching suggestions when multiple candidates exist', () => {
    const top = findTopMatchingLinks('dualsurf', sampleLinks, 3);
    assert.ok(top.length > 0);
    assert.ok(top.some((m) => m.item.label.includes('DualSurf')));
  });

  it('matches tabs by title keyword or domain', () => {
    const tabMatch1 = findBestMatchingTab('github', sampleTabs);
    assert.ok(tabMatch1);
    assert.equal(tabMatch1.tab.id, 'tab-2');
    assert.equal(tabMatch1.index, 2);

    const tabMatch2 = findBestMatchingTab('hacker news', sampleTabs);
    assert.ok(tabMatch2);
    assert.equal(tabMatch2.tab.id, 'tab-3');
    assert.equal(tabMatch2.index, 3);

    const tabMatch3 = findBestMatchingTab('documentation', sampleTabs);
    assert.ok(tabMatch3);
    assert.equal(tabMatch3.tab.id, 'tab-1');
  });

  it('safely handles empty queries and non-matches', () => {
    assert.equal(findBestMatchingLink('', sampleLinks), null);
    assert.equal(findBestMatchingLink('nonexistentxyz', sampleLinks), null);
    assert.equal(findBestMatchingTab('', sampleTabs), null);
  });
});
