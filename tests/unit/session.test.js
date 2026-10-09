import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionStore } from '../../packages/controller/dist/SessionStore.js';

describe('SessionStore Persistence', () => {
  const store = new SessionStore();

  it('loads default fallback session if no session file exists', () => {
    const session = store.loadSession();
    assert.ok(session.settings);
    assert.equal(typeof session.settings.searchEngine, 'string');
    assert.equal(typeof session.settings.restoreSessionOnStartup, 'boolean');
    assert.ok(Array.isArray(session.tabs));
  });

  it('persists and retrieves tab session correctly', () => {
    const mockTabs = [
      {
        id: 'tab-1',
        url: 'https://duckduckgo.com',
        title: 'DuckDuckGo',
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
        url: 'https://github.com',
        title: 'GitHub',
        isLoading: false,
        canGoBack: true,
        canGoForward: false,
        pinned: true,
        muted: false,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      },
    ];

    const mockSettings = {
      searchEngine: 'duckduckgo',
      homeUrl: 'https://duckduckgo.com',
      restoreSessionOnStartup: true,
      terminalTheme: 'dracula',
      defaultDownloadDir: '/downloads',
    };

    store.saveSession(mockTabs, 'tab-2', mockSettings);

    const reloaded = store.loadSession();
    assert.equal(reloaded.lastActiveTabId, 'tab-2');
    assert.equal(reloaded.tabs.length, 2);
    assert.equal(reloaded.tabs[0].url, 'https://duckduckgo.com');
    assert.equal(reloaded.tabs[1].url, 'https://github.com');
    assert.equal(reloaded.tabs[1].pinned, true);
    assert.equal(reloaded.settings.terminalTheme, 'dracula');
  });
});
