import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import {
  BookmarkEntry,
  BrowserControllerState,
  BrowserSettings,
  HistoryEntry,
  PageMetadata,
  TabId,
  TabState,
} from '@dualsurf/shared-types';
import { MetadataDatabase } from '@dualsurf/storage';
import { NavigationService } from './NavigationService.js';
import { TabManager } from './TabManager.js';
import { PageInspector } from './PageInspector.js';
import { SessionStore } from './SessionStore.js';

export class BrowserController extends EventEmitter {
  private navigationService: NavigationService;
  private tabManager: TabManager;
  private pageInspector: PageInspector;
  private sessionStore: SessionStore;
  private database: MetadataDatabase;
  private settings: BrowserSettings;
  private isInitialized: boolean = false;

  constructor(dbOptions?: { inMemory?: boolean; dbPath?: string }) {
    super();
    this.sessionStore = new SessionStore();
    this.database = new MetadataDatabase(dbOptions);
    const persisted = this.sessionStore.loadSession();
    this.settings = persisted.settings;

    this.navigationService = new NavigationService(this.settings.searchEngine);
    this.tabManager = new TabManager(this.navigationService);
    this.pageInspector = new PageInspector();

    this.forwardTabManagerEvents();
  }

  private forwardTabManagerEvents(): void {
    this.tabManager.on('tab:created', (tab: TabState) => {
      this.emit('tab:created', tab);
      this.persistSessionDebounced();
    });

    this.tabManager.on('tab:closed', (tabId: TabId) => {
      this.emit('tab:closed', tabId);
      this.persistSessionDebounced();
    });

    this.tabManager.on('tab:activated', (tab: TabState) => {
      this.emit('tab:activated', tab);
      this.persistSessionDebounced();
    });

    this.tabManager.on('tab:updated', (tab: TabState) => {
      this.emit('tab:updated', tab);
      this.persistSessionDebounced();

      // Automatically record successful visits in SQLite history
      if (!tab.isLoading && tab.url && !tab.url.startsWith('about:') && !tab.url.startsWith('dualsurf:')) {
        this.database.addHistory(tab.url, tab.title || tab.url);
      }
    });

    this.tabManager.on('state:changed', (state: BrowserControllerState) => {
      this.emit('state:changed', state);
    });
  }

  private persistTimeout: NodeJS.Timeout | null = null;
  private persistSessionDebounced(): void {
    if (!this.settings.restoreSessionOnStartup) return;
    if (this.persistTimeout) clearTimeout(this.persistTimeout);

    this.persistTimeout = setTimeout(() => {
      const state = this.getState();
      this.sessionStore.saveSession(state.tabs, state.activeTabId, this.settings);
    }, 1000);
  }

  public initialize(window?: BrowserWindow): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (window) {
      this.tabManager.attachWindow(window);
    }

    // Restore prior session if configured
    const session = this.sessionStore.loadSession();
    if (this.settings.restoreSessionOnStartup && session.tabs.length > 0) {
      for (const t of session.tabs) {
        this.tabManager.createTab(t.url, t.id === session.lastActiveTabId);
      }
    } else {
      // Create initial home tab
      this.tabManager.createTab(this.settings.homeUrl || 'https://duckduckgo.com', true);
    }
  }

  public attachWindow(window: BrowserWindow): void {
    this.tabManager.attachWindow(window);
  }

  public setContentBounds(bounds: Partial<{ x: number; y: number; width: number; height: number }>): void {
    this.tabManager.setContentBounds(bounds);
  }

  public getState(): BrowserControllerState {
    return this.tabManager.getState();
  }

  public createTab(url?: string, activate: boolean = true): TabState {
    return this.tabManager.createTab(url, activate);
  }

  public closeTab(tabId: TabId): boolean {
    return this.tabManager.closeTab(tabId);
  }

  public activateTab(tabId: TabId): boolean {
    return this.tabManager.activateTab(tabId);
  }

  public reopenClosedTab(): TabState | null {
    return this.tabManager.reopenClosedTab();
  }

  public navigate(tabId: TabId | undefined, urlOrQuery: string): boolean {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return false;

    const instance = this.tabManager.getTab(targetId);
    if (!instance) return false;

    const resolvedUrl = this.navigationService.normalizeUrl(urlOrQuery, this.settings.searchEngine);
    instance.state.isLoading = true;
    instance.state.error = null;
    this.emit('tab:updated', instance.state);

    instance.view.webContents.loadURL(resolvedUrl).catch(err => {
      instance.state.isLoading = false;
      instance.state.error = {
        code: -1,
        description: err.message,
        failingUrl: resolvedUrl,
      };
      this.emit('tab:updated', instance.state);
    });

    return true;
  }

  public goBack(tabId?: TabId): boolean {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return false;
    const instance = this.tabManager.getTab(targetId);
    if (!instance || !instance.view.webContents.canGoBack()) return false;
    instance.view.webContents.goBack();
    return true;
  }

  public goForward(tabId?: TabId): boolean {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return false;
    const instance = this.tabManager.getTab(targetId);
    if (!instance || !instance.view.webContents.canGoForward()) return false;
    instance.view.webContents.goForward();
    return true;
  }

  public reload(tabId?: TabId): boolean {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return false;
    const instance = this.tabManager.getTab(targetId);
    if (!instance) return false;
    instance.view.webContents.reload();
    return true;
  }

  public stop(tabId?: TabId): boolean {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return false;
    const instance = this.tabManager.getTab(targetId);
    if (!instance) return false;
    instance.view.webContents.stop();
    return true;
  }

  public async getPageMetadata(tabId?: TabId): Promise<PageMetadata | null> {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return null;
    const instance = this.tabManager.getTab(targetId);
    if (!instance) return null;

    return this.pageInspector.inspectPage(instance.view.webContents);
  }

  public async clickNumberedLink(tabId: TabId | undefined, linkId: number): Promise<boolean> {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return false;
    const instance = this.tabManager.getTab(targetId);
    if (!instance) return false;

    const targetHref = await this.pageInspector.clickNumberedLink(instance.view.webContents, linkId);
    if (targetHref) {
      return this.navigate(targetId, targetHref);
    }
    return false;
  }

  public getSettings(): BrowserSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<BrowserSettings>): BrowserSettings {
    this.settings = { ...this.settings, ...partial };
    if (partial.searchEngine) {
      this.navigationService.setSearchEngine(partial.searchEngine);
    }
    const state = this.getState();
    this.sessionStore.saveSession(state.tabs, state.activeTabId, this.settings);
    this.emit('settings:updated', this.settings);
    return this.settings;
  }

  // --- SQLite Metadata Methods ---

  public getHistory(limit?: number): HistoryEntry[] {
    return this.database.getHistory(limit);
  }

  public searchHistory(query: string, limit?: number): HistoryEntry[] {
    return this.database.searchHistory(query, limit);
  }

  public clearHistory(): void {
    this.database.clearHistory();
    this.emit('history:cleared');
  }

  public addBookmark(url: string, title?: string): BookmarkEntry {
    const bookmark = this.database.addBookmark(url, title || url);
    this.emit('bookmark:added', bookmark);
    return bookmark;
  }

  public getBookmarks(): BookmarkEntry[] {
    return this.database.getBookmarks();
  }

  public removeBookmark(id: string): boolean {
    const removed = this.database.removeBookmark(id);
    if (removed) {
      this.emit('bookmark:removed', id);
    }
    return removed;
  }

  public getDownloads(limit?: number) {
    return this.database.getDownloads(limit);
  }
}
