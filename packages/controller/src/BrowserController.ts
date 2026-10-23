import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import {
  BookmarkEntry,
  BrowserControllerState,
  BrowserSettings,
  FindResult,
  HistoryEntry,
  LinkItem,
  PageMetadata,
  PageSecurityInfo,
  ReaderArticle,
  TabId,
  TabState,
  CyberShieldStats,
  TrafficLogEntry,
} from '@dualsurf/shared-types';
import { MetadataDatabase } from '@dualsurf/storage';
import { NavigationService } from './NavigationService.js';
import { TabManager, isInternalNewTab } from './TabManager.js';
import { PageInspector } from './PageInspector.js';
import { SessionStore, DEFAULT_SETTINGS } from './SessionStore.js';
import { CyberShield } from './CyberShield.js';
import { TrafficSniffer } from './TrafficSniffer.js';
import { InterceptProxyEngine } from './InterceptProxyEngine.js';
import type {
  InterceptRule,
  InterceptedRequest,
  LocalProxyServerStatus,
  RawHttpRequest,
  RawHttpResponse,
} from '@dualsurf/shared-types';

export class BrowserController extends EventEmitter {
  private navigationService: NavigationService;
  private tabManager: TabManager;
  private pageInspector: PageInspector;
  private sessionStore: SessionStore;
  private database: MetadataDatabase;
  private cyberShield: CyberShield;
  private trafficSniffer: TrafficSniffer;
  private interceptEngine: InterceptProxyEngine;
  private settings: BrowserSettings;
  private isInitialized: boolean = false;
  private tabLinkSnapshots: Map<TabId, { url: string; links: LinkItem[]; timestamp: number }> = new Map();

  constructor(dbOptions?: { inMemory?: boolean; dbPath?: string }) {
    super();
    this.sessionStore = new SessionStore();
    this.database = new MetadataDatabase(dbOptions);
    const persisted = this.sessionStore.loadSession();
    this.settings = persisted.settings;

    this.navigationService = new NavigationService(this.settings.searchEngine);
    this.tabManager = new TabManager(this.navigationService);
    this.pageInspector = new PageInspector();
    this.cyberShield = new CyberShield(this.settings.cyberShieldEnabled !== false);
    this.trafficSniffer = new TrafficSniffer(500);
    this.interceptEngine = new InterceptProxyEngine();

    this.interceptEngine.on('proxy:traffic', (entry) => {
      this.trafficSniffer.addEntry(entry);
      this.emit('traffic:entry', entry);
    });

    this.interceptEngine.on('intercept:pending', (req) => {
      this.emit('intercept:pending', req);
    });

    this.cyberShield.on('shield:blocked', (data) => {
      this.trafficSniffer.recordBlocked(data);
      this.emit('shield:blocked', data);
    });

    this.cyberShield.on('stats:updated', (stats) => {
      this.emit('shield:stats', stats);
    });

    this.trafficSniffer.on('traffic:entry', (entry) => {
      this.emit('traffic:entry', entry);
    });

    this.forwardTabManagerEvents();
  }

  private forwardTabManagerEvents(): void {
    this.tabManager.on('tab:created', (tab: TabState) => {
      this.emit('tab:created', tab);
      this.persistSessionDebounced();
    });

    this.tabManager.on('tab:closed', (tabId: TabId) => {
      this.tabLinkSnapshots.delete(tabId);
      this.emit('tab:closed', tabId);
      this.persistSessionDebounced();
    });

    this.tabManager.on('tab:activated', (tab: TabState) => {
      this.emit('tab:activated', tab);
      this.persistSessionDebounced();
    });

    this.tabManager.on('tab:updated', (tab: TabState) => {
      const cached = this.tabLinkSnapshots.get(tab.id);
      if (cached && cached.url !== tab.url) {
        this.tabLinkSnapshots.delete(tab.id);
      }
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
      // Create initial home tab - ALWAYS DualSurf start page, never external websites
      this.tabManager.createTab('dualsurf://newtab', true);
    }
  }

  public attachWindow(window: BrowserWindow): void {
    this.tabManager.attachWindow(window);
  }

  public setContentBounds(bounds: Partial<{ x: number; y: number; width: number; height: number }>): void {
    this.tabManager.setContentBounds(bounds);
  }

  public setViewsVisible(visible: boolean): void {
    this.tabManager.setViewsVisible(visible);
  }

  public async captureActivePage(): Promise<string | null> {
    return this.tabManager.captureActivePage();
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

  public togglePinTab(tabId: TabId): boolean {
    return this.tabManager.togglePinTab(tabId);
  }

  public toggleMuteTab(tabId?: TabId): boolean {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return false;
    return this.tabManager.toggleMuteTab(targetId);
  }

  public setSplitTab(tabId: TabId | null): boolean {
    return this.tabManager.setSplitTab(tabId);
  }

  public getSplitTabId(): TabId | null {
    return this.tabManager.getSplitTabId();
  }

  public duplicateTab(tabId: TabId): TabState | null {
    return this.tabManager.duplicateTab(tabId);
  }

  public closeOtherTabs(tabId: TabId): boolean {
    return this.tabManager.closeOtherTabs(tabId);
  }

  public closeTabsToTheRight(tabId: TabId): boolean {
    return this.tabManager.closeTabsToTheRight(tabId);
  }

  public async getReaderArticle(tabId?: TabId): Promise<ReaderArticle | null> {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return null;
    const instance = this.tabManager.getTab(targetId);
    if (!instance) return null;
    return this.pageInspector.extractReaderArticle(instance.view.webContents);
  }

  public async getPageSecurityInfo(tabId?: TabId): Promise<PageSecurityInfo | null> {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return null;
    const instance = this.tabManager.getTab(targetId);
    if (!instance) return null;
    return this.pageInspector.getPageSecurityInfo(instance.view.webContents);
  }

  public setZoom(tabId: TabId | undefined, zoomFactor: number): number {
    return this.tabManager.setZoom(tabId, zoomFactor);
  }

  public getZoom(tabId?: TabId): number {
    return this.tabManager.getZoom(tabId);
  }

  public toggleDevTools(tabId?: TabId): boolean {
    return this.tabManager.toggleDevTools(tabId);
  }

  public navigate(tabId: TabId | undefined, urlOrQuery: string): boolean {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) {
      this.createTab(urlOrQuery, true);
      return true;
    }

    const instance = this.tabManager.getTab(targetId);
    if (!instance) return false;

    // Check if navigating to internal start page
    if (isInternalNewTab(urlOrQuery)) {
      instance.state.url = 'dualsurf://newtab';
      instance.state.title = 'New Tab';
      instance.state.isLoading = false;
      instance.state.error = null;
      instance.state.canGoBack = false;
      instance.state.canGoForward = false;
      this.tabManager.detachTabView(instance);
      instance.view.webContents.loadURL('about:blank').catch(() => {});
      this.emit('tab:updated', instance.state);
      this.emit('state:changed', this.getState());
      return true;
    }

    const resolvedUrl = this.navigationService.normalizeUrl(urlOrQuery, this.settings.searchEngine);
    instance.state.isLoading = true;
    instance.state.error = null;
    instance.state.url = resolvedUrl;
    this.tabManager.attachTabView(instance);
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
    if (!instance) return false;
    const wc = instance.view.webContents;
    const nav = (wc as any).navigationHistory;
    const canBack = nav ? nav.canGoBack() : wc.canGoBack();
    if (!canBack) return false;
    if (nav?.goBack) nav.goBack();
    else wc.goBack();
    return true;
  }

  public goForward(tabId?: TabId): boolean {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return false;
    const instance = this.tabManager.getTab(targetId);
    if (!instance) return false;
    const wc = instance.view.webContents;
    const nav = (wc as any).navigationHistory;
    const canFwd = nav ? nav.canGoForward() : wc.canGoForward();
    if (!canFwd) return false;
    if (nav?.goForward) nav.goForward();
    else wc.goForward();
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

    const meta = await this.pageInspector.inspectPage(instance.view.webContents);
    if (meta && meta.links) {
      this.tabLinkSnapshots.set(targetId, {
        url: meta.url,
        links: meta.links,
        timestamp: Date.now(),
      });
    }
    return meta;
  }

  public async clickNumberedLink(tabId: TabId | undefined, linkId: number): Promise<boolean> {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) {
      throw new Error('No active tab available to follow link');
    }
    const instance = this.tabManager.getTab(targetId);
    if (!instance) {
      throw new Error(`Tab ${targetId} not found`);
    }

    const currentUrl = instance.view.webContents.getURL();
    const snapshot = this.tabLinkSnapshots.get(targetId);

    // 1. Try cached link snapshot if fresh
    if (snapshot && snapshot.url === currentUrl) {
      const link = snapshot.links.find((l) => l.id === linkId);
      if (link) {
        return this.navigate(targetId, link.href);
      }
    }

    // 2. Resilient live DOM inspection fallback
    const liveHref = await this.pageInspector.clickNumberedLink(instance.view.webContents, linkId);
    if (liveHref) {
      return this.navigate(targetId, liveHref);
    }

    if (snapshot && snapshot.url === currentUrl) {
      throw new Error(
        `Link [${linkId}] is out of range. Page snapshot has ${snapshot.links.length} links.`
      );
    }

    throw new Error(
      `Link [${linkId}] could not be found on page. Run "dualsurf links" to update.`
    );
  }

  public async findInPage(tabId: TabId | undefined, query: string): Promise<FindResult> {
    const targetId = tabId || this.tabManager.getActiveTabId();
    if (!targetId) return { query, count: 0, matches: [] };
    const instance = this.tabManager.getTab(targetId);
    if (!instance) return { query, count: 0, matches: [] };

    return this.pageInspector.findInPage(instance.view.webContents, query);
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

  public resetSettings(): BrowserSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.navigationService.setSearchEngine(this.settings.searchEngine);
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

  public clearHistory(sinceTimestamp?: number): void {
    this.database.clearHistory(undefined, sinceTimestamp);
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

  // --- Cyber Shield & Traffic Sniffer Methods ---

  public attachSession(ses: any): void {
    if (!ses) return;
    this.cyberShield.attachToSession(ses);
    this.trafficSniffer.attachToSession(ses);
    this.interceptEngine.attachToSession(ses);
  }

  public getCyberShield(): CyberShield {
    return this.cyberShield;
  }

  public getTrafficSniffer(): TrafficSniffer {
    return this.trafficSniffer;
  }

  public getShieldStats(webContentsId?: string | number): CyberShieldStats {
    return this.cyberShield.getStats(webContentsId);
  }

  public toggleShield(): boolean {
    const enabled = this.cyberShield.toggle();
    this.updateSettings({ cyberShieldEnabled: enabled });
    return enabled;
  }

  public toggleShieldWhitelist(domain: string): boolean {
    return this.cyberShield.toggleWhitelist(domain);
  }

  public getTrafficLogs(filter?: { tabId?: string; search?: string; method?: string }): TrafficLogEntry[] {
    return this.trafficSniffer.getEntries(filter);
  }

  public clearTrafficLogs(): void {
    this.trafficSniffer.clear();
  }

  public getInterceptEngine(): InterceptProxyEngine {
    return this.interceptEngine;
  }

  public getInterceptRules(): InterceptRule[] {
    return this.interceptEngine.getRules();
  }

  public setInterceptRules(rules: InterceptRule[]): void {
    this.interceptEngine.setRules(rules);
  }

  public toggleBreakpoint(active?: boolean): boolean {
    const val = active !== undefined ? active : !this.interceptEngine.getBreakpointActive();
    this.interceptEngine.setBreakpointActive(val);
    return val;
  }

  public getPendingIntercepts(): InterceptedRequest[] {
    return this.interceptEngine.getPendingRequests();
  }

  public forwardIntercept(id: string, modifiedHeaders?: Record<string, string>): boolean {
    return this.interceptEngine.forwardRequest(id, modifiedHeaders);
  }

  public dropIntercept(id: string): boolean {
    return this.interceptEngine.dropRequest(id);
  }

  public async startLocalProxy(port?: number, host?: string): Promise<{ success: boolean; error?: string }> {
    return this.interceptEngine.startProxyServer(port, host);
  }

  public async stopLocalProxy(): Promise<void> {
    return this.interceptEngine.stopProxyServer();
  }

  public getLocalProxyStatus(): LocalProxyServerStatus {
    return this.interceptEngine.getStatus();
  }

  public async sendRawRequest(req: RawHttpRequest): Promise<RawHttpResponse> {
    const startTime = Date.now();
    try {
      const response = await fetch(req.url, {
        method: req.method || 'GET',
        headers: req.headers || {},
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      });

      const latencyMs = Date.now() - startTime;
      const respHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        respHeaders[key] = val;
      });

      const bodyText = await response.text();

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
        body: bodyText,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
