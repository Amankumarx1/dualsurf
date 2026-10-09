import { WebContentsView, BrowserWindow, app } from 'electron';
import { TabId, TabState } from '@dualsurf/shared-types';
import { EventEmitter } from 'events';
import { NavigationService } from './NavigationService.js';

export interface TabInstance {
  state: TabState;
  view: WebContentsView;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TabManager extends EventEmitter {
  private tabs: Map<TabId, TabInstance> = new Map();
  private activeTabId: TabId | null = null;
  private closedTabsHistory: TabState[] = [];
  private window: BrowserWindow | null = null;
  private contentBounds: Bounds = { x: 0, y: 78, width: 1200, height: 722 };
  private navigationService: NavigationService;

  constructor(navigationService: NavigationService) {
    super();
    this.navigationService = navigationService;
  }

  public attachWindow(window: BrowserWindow): void {
    this.window = window;
    this.updateBoundsFromWindow();

    window.on('resize', () => {
      this.updateBoundsFromWindow();
      this.layoutActiveView();
    });
  }

  public setContentBounds(bounds: Partial<Bounds>): void {
    this.contentBounds = { ...this.contentBounds, ...bounds };
    this.layoutActiveView();
  }

  private updateBoundsFromWindow(): void {
    if (!this.window || this.window.isDestroyed()) return;
    const [width, height] = this.window.getContentSize();
    this.contentBounds.width = Math.max(width, 100);
    this.contentBounds.height = Math.max(height - this.contentBounds.y, 100);
  }

  private layoutActiveView(): void {
    if (!this.window || this.window.isDestroyed() || !this.activeTabId) return;
    const active = this.tabs.get(this.activeTabId);
    if (active) {
      active.view.setBounds({
        x: this.contentBounds.x,
        y: this.contentBounds.y,
        width: this.contentBounds.width,
        height: this.contentBounds.height,
      });
    }
  }

  public createTab(initialUrl?: string, activate: boolean = true): TabState {
    const id = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const url = initialUrl
      ? this.navigationService.normalizeUrl(initialUrl)
      : 'https://duckduckgo.com';

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });

    const state: TabState = {
      id,
      url,
      title: 'New Tab',
      isLoading: true,
      canGoBack: false,
      canGoForward: false,
      pinned: false,
      muted: false,
      error: null,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    const instance: TabInstance = { state, view };
    this.tabs.set(id, instance);
    this.setupViewListeners(instance);

    view.webContents.loadURL(url).catch(err => {
      state.isLoading = false;
      state.error = {
        code: -1,
        description: err.message,
        failingUrl: url,
      };
      this.emit('tab:updated', state);
    });

    this.emit('tab:created', state);

    if (activate || !this.activeTabId) {
      this.activateTab(id);
    } else {
      this.emit('state:changed', this.getState());
    }

    return state;
  }

  private setupViewListeners(instance: TabInstance): void {
    const { state, view } = instance;
    const wc = view.webContents;

    wc.on('did-start-loading', () => {
      state.isLoading = true;
      state.error = null;
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('did-stop-loading', () => {
      state.isLoading = false;
      state.canGoBack = wc.canGoBack();
      state.canGoForward = wc.canGoForward();
      state.url = wc.getURL();
      state.title = wc.getTitle() || state.title;
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('page-title-updated', (_event, title) => {
      state.title = title;
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('page-favicon-updated', (_event, favicons) => {
      if (favicons.length > 0) {
        state.favicon = favicons[0];
        this.emit('tab:updated', state);
        this.emit('state:changed', this.getState());
      }
    });

    wc.on('did-navigate', (_event, url) => {
      state.url = url;
      state.canGoBack = wc.canGoBack();
      state.canGoForward = wc.canGoForward();
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('did-navigate-in-page', (_event, url) => {
      state.url = url;
      state.canGoBack = wc.canGoBack();
      state.canGoForward = wc.canGoForward();
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      state.isLoading = false;
      state.error = {
        code: errorCode,
        description: errorDescription,
        failingUrl: validatedURL,
      };
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    // Handle new-window requests securely by creating a new tab instead of a popup
    wc.setWindowOpenHandler(details => {
      this.createTab(details.url, true);
      return { action: 'deny' };
    });
  }

  public activateTab(tabId: TabId): boolean {
    const target = this.tabs.get(tabId);
    if (!target) return false;

    if (this.window && !this.window.isDestroyed()) {
      // Remove current active view from contentView
      if (this.activeTabId && this.activeTabId !== tabId) {
        const current = this.tabs.get(this.activeTabId);
        if (current) {
          try {
            this.window.contentView.removeChildView(current.view);
          } catch {
            // View may not have been attached
          }
        }
      }

      // Add new active view
      try {
        this.window.contentView.addChildView(target.view);
      } catch {
        // Child view might already be present
      }
      this.layoutActiveView();
    }

    this.activeTabId = tabId;
    target.state.lastAccessedAt = Date.now();

    this.emit('tab:activated', target.state);
    this.emit('state:changed', this.getState());
    return true;
  }

  public closeTab(tabId: TabId): boolean {
    const target = this.tabs.get(tabId);
    if (!target) return false;

    this.closedTabsHistory.push({ ...target.state });
    if (this.closedTabsHistory.length > 20) {
      this.closedTabsHistory.shift();
    }

    if (this.window && !this.window.isDestroyed()) {
      try {
        this.window.contentView.removeChildView(target.view);
      } catch {
        // Ignored
      }
    }

    // Clean up webContents
    try {
      (target.view.webContents as any).destroy?.();
    } catch {
      // Ignored
    }

    this.tabs.delete(tabId);
    this.emit('tab:closed', tabId);

    // If active tab was closed, switch to another tab or create a fresh one
    if (this.activeTabId === tabId) {
      const remainingIds = Array.from(this.tabs.keys());
      if (remainingIds.length > 0) {
        this.activateTab(remainingIds[remainingIds.length - 1]);
      } else {
        this.activeTabId = null;
        this.createTab('https://duckduckgo.com', true);
      }
    } else {
      this.emit('state:changed', this.getState());
    }

    return true;
  }

  public reopenClosedTab(): TabState | null {
    const lastClosed = this.closedTabsHistory.pop();
    if (!lastClosed) return null;
    return this.createTab(lastClosed.url, true);
  }

  public getActiveTab(): TabInstance | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  public getTab(tabId: TabId): TabInstance | null {
    return this.tabs.get(tabId) || null;
  }

  public getAllTabs(): TabState[] {
    return Array.from(this.tabs.values()).map(t => ({ ...t.state }));
  }

  public getActiveTabId(): TabId | null {
    return this.activeTabId;
  }

  public getState() {
    return {
      tabs: this.getAllTabs(),
      activeTabId: this.activeTabId,
      profileId: 'default',
    };
  }
}
