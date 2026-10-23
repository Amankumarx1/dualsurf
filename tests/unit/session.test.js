import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionStore } from '../../packages/controller/dist/SessionStore.js';

describe('SessionStore Persistence', () => {
  const testDir = path.join(os.tmpdir(), `dualsurf-test-session-${Date.now()}`);
  const store = new SessionStore(testDir);

  after(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

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

  it('persists and restores all extended 13-category settings fields', () => {
    const extendedSettings = {
      searchEngine: 'brave',
      homeUrl: 'https://brave.com',
      restoreSessionOnStartup: true,
      terminalTheme: 'nord',
      defaultDownloadDir: 'D:\\Evidence',
      themeMode: 'light',
      uiDensity: 'compact',
      defaultShell: 'powershell',
      terminalFontSize: 16,
      terminalFontFamily: 'Fira Code',
      terminalScrollback: 10000,
      scopeEnforcementStrict: true,
      autoClearDataOnExit: true,
      blockThirdPartyCookies: true,
      doNotTrack: true,
      evidenceAutoHash: true,
      defaultZoom: 110,
    };

    store.saveSession([], null, extendedSettings);
    const reloaded = store.loadSession();

    assert.equal(reloaded.settings.searchEngine, 'brave');
    assert.equal(reloaded.settings.themeMode, 'light');
    assert.equal(reloaded.settings.uiDensity, 'compact');
    assert.equal(reloaded.settings.defaultShell, 'powershell');
    assert.equal(reloaded.settings.terminalFontSize, 16);
    assert.equal(reloaded.settings.terminalScrollback, 10000);
    assert.equal(reloaded.settings.scopeEnforcementStrict, true);
    assert.equal(reloaded.settings.evidenceAutoHash, true);
    assert.equal(reloaded.settings.defaultZoom, 110);
  });

  it('resets settings to DEFAULT_SETTINGS correctly in BrowserController', async () => {
    const { BrowserController } = await import('../../packages/controller/dist/BrowserController.js');
    const ctrl = new BrowserController({ inMemory: true });

    ctrl.updateSettings({
      searchEngine: 'ecosia',
      themeMode: 'light',
      terminalTheme: 'matrix',
    });
    assert.equal(ctrl.getSettings().searchEngine, 'ecosia');
    assert.equal(ctrl.getSettings().themeMode, 'light');

    const resetResult = ctrl.resetSettings();
    assert.equal(resetResult.searchEngine, 'google');
    assert.equal(resetResult.themeMode, 'dark');
    assert.equal(resetResult.terminalTheme, 'dracula');
    assert.equal(ctrl.getSettings().searchEngine, 'google');
  });
});
