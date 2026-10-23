import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as net from 'net';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { IpcServer } from '../../packages/controller/dist/IpcServer.js';
import { NavigationService } from '../../packages/controller/dist/NavigationService.js';
import { SessionStore } from '../../packages/controller/dist/SessionStore.js';
import { IpcClient } from '../../apps/cli/dist/IpcClient.js';
import { getIpcSocketPath, IPC_COMMANDS } from '../../packages/ipc-protocol/dist/index.js';

describe('DualSurf IPC Protocol & Server Integration', () => {
  let server;
  let client;

  // Mock controller matching BrowserController interface for headless testing
  const mockController = {
    state: {
      tabs: [
        { id: 'tab-001', url: 'https://duckduckgo.com', title: 'DuckDuckGo', isLoading: false },
        { id: 'tab-002', url: 'https://github.com', title: 'GitHub', isLoading: false },
      ],
      activeTabId: 'tab-001',
      profileId: 'default',
    },
    settings: {
      searchEngine: 'duckduckgo',
      homeUrl: 'https://duckduckgo.com',
      restoreSessionOnStartup: true,
      terminalTheme: 'dracula',
    },
    getState() {
      return this.state;
    },
    createTab(url) {
      const tab = {
        id: `tab-${Date.now()}`,
        url: url || 'https://duckduckgo.com',
        title: 'New Tab',
        isLoading: false,
      };
      this.state.tabs.push(tab);
      this.state.activeTabId = tab.id;
      return tab;
    },
    activateTab(id) {
      this.state.activeTabId = id;
      return true;
    },
    closeTab(id) {
      this.state.tabs = this.state.tabs.filter((t) => t.id !== id);
      if (this.state.activeTabId === id) {
        this.state.activeTabId = this.state.tabs[0]?.id || null;
      }
      return true;
    },
    reopenClosedTab() {
      return this.createTab('https://reopened.local');
    },
    navigate(tabId, url) {
      const target = this.state.tabs.find((t) => t.id === (tabId || this.state.activeTabId));
      if (target) {
        target.url = url;
        return true;
      }
      return false;
    },
    async getPageMetadata() {
      return {
        title: 'Mock Page',
        url: 'https://mock.example.com',
        isLoading: false,
        headings: [{ level: 1, text: 'Hello DualSurf' }],
        links: [
          { id: 1, label: 'Documentation', href: 'https://docs.dualsurf.local' },
          { id: 2, label: 'GitHub', href: 'https://github.com/dualsurf' },
        ],
        textSnippet: 'DualSurf unified browser content.',
      };
    },
    async clickNumberedLink(tabId, linkId) {
      return linkId === 1;
    },
    async findInPage(tabId, query) {
      return {
        query,
        count: 1,
        matches: [{ index: 1, snippet: `Found ${query} in mock content.` }],
      };
    },
    goBack() { return true; },
    goForward() { return true; },
    reload() { return true; },
    stop() { return true; },
    getSettings() { return this.settings; },
    updateSettings(s) {
      this.settings = { ...this.settings, ...s };
      return this.settings;
    },
    bookmarks: [],
    getBookmarks() { return this.bookmarks; },
    addBookmark(url, title) {
      const bm = { id: 'bm-test', url, title: title || url, createdAt: Date.now() };
      this.bookmarks.push(bm);
      return bm;
    },
    removeBookmark(id) {
      this.bookmarks = this.bookmarks.filter(b => b.id !== id);
      return true;
    },
    history: [{ id: 'hist-1', url: 'https://test.local', title: 'Test', visitedAt: Date.now(), visitCount: 1 }],
    getHistory() { return this.history; },
    searchHistory(q) { return this.history.filter(h => h.url.includes(q) || h.title.includes(q)); },
    clearHistory() { this.history = []; },
    getDownloads() { return [{ id: 'dl-1', filename: 'file.tar.gz', path: '/tmp/file.tar.gz', status: 'completed' }]; },
  };

  const testSocketPath = process.platform === 'win32'
    ? `\\\\.\\pipe\\dualsurf-test-${Date.now()}`
    : path.join(os.tmpdir(), `dualsurf-test-${Date.now()}.sock`);

  before(async () => {
    server = new IpcServer(mockController, testSocketPath);
    await server.start();
    client = new IpcClient(testSocketPath);
  });

  after(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('responds to system.ping', async () => {
    const res = await client.sendCommand(IPC_COMMANDS.PING);
    assert.equal(res.pong, true);
    assert.ok(typeof res.timestamp === 'number');
  });

  it('lists active tabs with tabs.list', async () => {
    const state = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
    assert.equal(state.tabs.length, 2);
    assert.equal(state.activeTabId, 'tab-001');
  });

  it('switches active tab with tabs.switch by index', async () => {
    const res = await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { index: 2 });
    assert.equal(res.activatedTabId, 'tab-002');
    assert.equal(mockController.state.activeTabId, 'tab-002');
  });

  it('creates new tabs with tabs.create', async () => {
    const tab = await client.sendCommand(IPC_COMMANDS.TABS_CREATE, { url: 'https://archlinux.org' });
    assert.ok(tab.id.startsWith('tab-'));
    assert.equal(tab.url, 'https://archlinux.org');
    assert.equal(mockController.state.activeTabId, tab.id);
  });

  it('retrieves page metadata, headings, and numbered links', async () => {
    const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
    assert.equal(meta.title, 'Mock Page');
    assert.equal(meta.headings.length, 1);
    assert.equal(meta.headings[0].text, 'Hello DualSurf');
    assert.equal(meta.links.length, 2);
    assert.equal(meta.links[0].id, 1);
    assert.equal(meta.links[0].label, 'Documentation');
  });

  it('follows numbered link via page.clickLink', async () => {
    const res = await client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId: 1 });
    assert.equal(res.followedLinkId, 1);
  });

  it('queries and updates browser settings', async () => {
    const settings = await client.sendCommand(IPC_COMMANDS.SETTINGS_GET);
    assert.equal(settings.searchEngine, 'duckduckgo');

    const updated = await client.sendCommand(IPC_COMMANDS.SETTINGS_UPDATE, { searchEngine: 'brave' });
    assert.equal(updated.searchEngine, 'brave');
  });

  it('manages bookmarks over IPC', async () => {
    const added = await client.sendCommand(IPC_COMMANDS.BOOKMARKS_ADD, {
      url: 'https://kernel.org',
      title: 'Linux Kernel',
    });
    assert.equal(added.id, 'bm-test');
    assert.equal(added.title, 'Linux Kernel');

    const list = await client.sendCommand(IPC_COMMANDS.BOOKMARKS_LIST);
    assert.equal(list.length, 1);
    assert.equal(list[0].url, 'https://kernel.org');

    const removeRes = await client.sendCommand(IPC_COMMANDS.BOOKMARKS_REMOVE, { id: 'bm-test' });
    assert.equal(removeRes.removedId, 'bm-test');
  });

  it('retrieves browsing history over IPC', async () => {
    const history = await client.sendCommand(IPC_COMMANDS.HISTORY_LIST);
    assert.equal(history.length, 1);
    assert.equal(history[0].url, 'https://test.local');
  });

  it('retrieves downloads activity over IPC', async () => {
    const downloads = await client.sendCommand(IPC_COMMANDS.DOWNLOADS_LIST);
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].filename, 'file.tar.gz');
  });

  it('searches in-page text occurrences with page.find', async () => {
    const res = await client.sendCommand(IPC_COMMANDS.PAGE_FIND, { query: 'DualSurf' });
    assert.equal(res.query, 'DualSurf');
    assert.equal(res.count, 1);
    assert.equal(res.matches.length, 1);
    assert.ok(res.matches[0].snippet.includes('DualSurf'));
  });

  it('handles multiple consecutive rapid IPC requests smoothly', async () => {
    const promises = [
      client.sendCommand(IPC_COMMANDS.TABS_LIST),
      client.sendCommand(IPC_COMMANDS.SETTINGS_GET),
      client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA),
      client.sendCommand(IPC_COMMANDS.PING),
    ];
    const results = await Promise.all(promises);
    assert.equal(results.length, 4);
    assert.equal(results[0].tabs.length, 3);
    assert.equal(results[1].searchEngine, 'brave');
    assert.equal(results[2].title, 'Mock Page');
    assert.equal(results[3].pong, true);
  });

  it('rejects unknown commands with proper protocol error', async () => {
    await assert.rejects(
      async () => {
        await client.sendCommand('nonexistent.command');
      },
      /Command "nonexistent.command" is not recognized/
    );
  });

  it('validates required parameters and reports errors', async () => {
    await assert.rejects(
      async () => {
        await client.sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, {});
      },
      /URL parameter is required/
    );
  });

  it('executes host command via system.exec over IPC', async () => {
    const isWindows = process.platform === 'win32';
    const testCmd = isWindows ? 'echo IPCExecSuccess' : 'echo "IPCExecSuccess"';

    const res = await client.sendCommand(IPC_COMMANDS.SYSTEM_EXEC, { command: testCmd });
    assert.equal(res.exitCode, 0);
    assert.ok(res.stdout.includes('IPCExecSuccess'));
  });
});
