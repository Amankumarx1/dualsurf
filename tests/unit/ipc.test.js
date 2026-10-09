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
    goBack() { return true; },
    goForward() { return true; },
    reload() { return true; },
    stop() { return true; },
    getSettings() { return this.settings; },
    updateSettings(s) {
      this.settings = { ...this.settings, ...s };
      return this.settings;
    },
  };

  before(async () => {
    server = new IpcServer(mockController);
    await server.start();
    client = new IpcClient();
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
});
