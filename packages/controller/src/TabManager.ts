import { WebContentsView, BrowserWindow, app, Menu, MenuItem, clipboard } from 'electron';
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

export function isInternalNewTab(url: string | undefined | null): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed === '' ||
    trimmed === 'about:blank' ||
    trimmed === 'dualsurf:newtab' ||
    trimmed === 'dualsurf://newtab' ||
    trimmed.startsWith('dualsurf://newtab')
  );
}

export class TabManager extends EventEmitter {
  private tabs: Map<TabId, TabInstance> = new Map();
  private activeTabId: TabId | null = null;
  private splitTabId: TabId | null = null;
  private closedTabsHistory: TabState[] = [];
  private window: BrowserWindow | null = null;
  private contentBounds: Bounds = { x: 0, y: 78, width: 1200, height: 722 };
  private navigationService: NavigationService;
  private isViewsVisible: boolean = true;

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

  public setViewsVisible(visible: boolean): void {
    this.isViewsVisible = visible;
    if (!this.window || this.window.isDestroyed()) return;
    const active = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    const split = this.splitTabId ? this.tabs.get(this.splitTabId) : null;

    if (!visible) {
      if (active) {
        try { this.window.contentView.removeChildView(active.view); } catch {}
      }
      if (split && split.state.id !== this.activeTabId) {
        try { this.window.contentView.removeChildView(split.view); } catch {}
      }
    } else {
      if (active && !isInternalNewTab(active.state.url)) {
        try { this.window.contentView.addChildView(active.view); } catch {}
      }
      if (split && split.state.id !== this.activeTabId && !isInternalNewTab(split.state.url)) {
        try { this.window.contentView.addChildView(split.view); } catch {}
      }
      this.layoutActiveView();
    }
  }

  public async captureActivePage(): Promise<string | null> {
    const active = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    if (!active || !active.view || !active.view.webContents) return null;
    try {
      const nativeImage = await active.view.webContents.capturePage();
      return nativeImage.toDataURL();
    } catch {
      return null;
    }
  }

  public attachTabView(instance: TabInstance): void {
    if (!this.window || this.window.isDestroyed() || !this.isViewsVisible) return;
    if (isInternalNewTab(instance.state.url)) {
      this.detachTabView(instance);
      return;
    }
    if (instance.state.id === this.activeTabId || instance.state.id === this.splitTabId) {
      try {
        this.window.contentView.addChildView(instance.view);
      } catch {}
      this.layoutActiveView();
    }
  }

  public detachTabView(instance: TabInstance): void {
    if (!this.window || this.window.isDestroyed()) return;
    try {
      this.window.contentView.removeChildView(instance.view);
    } catch {}
  }

  private updateBoundsFromWindow(): void {
    if (!this.window || this.window.isDestroyed()) return;
    const [width, height] = this.window.getContentSize();
    this.contentBounds.width = Math.max(width, 100);
    this.contentBounds.height = Math.max(height - this.contentBounds.y, 100);
  }

  private layoutActiveView(): void {
    if (!this.window || this.window.isDestroyed() || !this.isViewsVisible) return;
    const active = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    const split = this.splitTabId ? this.tabs.get(this.splitTabId) : null;

    const showActive = active && !isInternalNewTab(active.state.url);
    const showSplit = split && split.state.id !== this.activeTabId && !isInternalNewTab(split.state.url);

    if (showActive && showSplit && split) {
      // Dual-View Side-by-Side Arrangement
      const halfWidth = Math.floor(this.contentBounds.width / 2);
      active.view.setBounds({
        x: this.contentBounds.x,
        y: this.contentBounds.y,
        width: halfWidth,
        height: this.contentBounds.height,
      });
      split.view.setBounds({
        x: this.contentBounds.x + halfWidth,
        y: this.contentBounds.y,
        width: this.contentBounds.width - halfWidth,
        height: this.contentBounds.height,
      });
    } else if (showActive && active) {
      active.view.setBounds({
        x: this.contentBounds.x,
        y: this.contentBounds.y,
        width: this.contentBounds.width,
        height: this.contentBounds.height,
      });
    } else if (showSplit && split) {
      split.view.setBounds({
        x: this.contentBounds.x,
        y: this.contentBounds.y,
        width: this.contentBounds.width,
        height: this.contentBounds.height,
      });
    }
  }

  public createTab(initialUrl?: string, activate: boolean = true): TabState {
    const id = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const isNew = !initialUrl || isInternalNewTab(initialUrl);
    const url = isNew
      ? 'dualsurf://newtab'
      : this.navigationService.normalizeUrl(initialUrl);

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        backgroundThrottling: true,
      },
    });

    const state: TabState = {
      id,
      url,
      title: isNew ? 'New Tab' : 'Loading...',
      isLoading: !isNew,
      canGoBack: false,
      canGoForward: false,
      pinned: false,
      muted: false,
      isAudioPlaying: false,
      error: null,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    const instance: TabInstance = { state, view };
    this.tabs.set(id, instance);
    this.setupViewListeners(instance);

    if (isNew) {
      view.webContents.loadURL('about:blank').catch(() => {});
    } else {
      view.webContents.loadURL(url).catch(err => {
        state.isLoading = false;
        state.error = {
          code: -1,
          description: err.message,
          failingUrl: url,
        };
        this.emit('tab:updated', state);
      });
    }

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

    const canGoBack = () => {
      const nav = (wc as any).navigationHistory;
      return nav ? nav.canGoBack() : wc.canGoBack();
    };
    const canGoForward = () => {
      const nav = (wc as any).navigationHistory;
      return nav ? nav.canGoForward() : wc.canGoForward();
    };
    const goBack = () => {
      const nav = (wc as any).navigationHistory;
      if (nav?.goBack) nav.goBack();
      else wc.goBack();
    };
    const goForward = () => {
      const nav = (wc as any).navigationHistory;
      if (nav?.goForward) nav.goForward();
      else wc.goForward();
    };

    wc.on('did-start-loading', () => {
      state.isLoading = true;
      state.error = null;
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('did-stop-loading', () => {
      state.isLoading = false;
      state.canGoBack = canGoBack();
      state.canGoForward = canGoForward();
      state.url = wc.getURL();
      state.title = wc.getTitle() || state.title;
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('media-started-playing', () => {
      state.isAudioPlaying = true;
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('media-paused', () => {
      state.isAudioPlaying = false;
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('render-process-gone', (_event, details) => {
      state.isLoading = false;
      state.isAudioPlaying = false;
      state.error = {
        code: -999,
        description: `Renderer process terminated (${details.reason || 'crashed'})`,
        failingUrl: state.url,
      };
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('unresponsive', () => {
      state.error = {
        code: -998,
        description: 'Page has become unresponsive',
        failingUrl: state.url,
      };
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('responsive', () => {
      if (state.error?.code === -998) {
        state.error = null;
        this.emit('tab:updated', state);
        this.emit('state:changed', this.getState());
      }
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
      state.canGoBack = canGoBack();
      state.canGoForward = canGoForward();
      if (isInternalNewTab(url)) {
        this.detachTabView(instance);
      } else if (this.isViewsVisible && (instance.state.id === this.activeTabId || instance.state.id === this.splitTabId)) {
        this.attachTabView(instance);
      }
      this.emit('tab:updated', state);
      this.emit('state:changed', this.getState());
    });

    wc.on('did-navigate-in-page', (_event, url) => {
      state.url = url;
      state.canGoBack = canGoBack();
      state.canGoForward = canGoForward();
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

    // Restrict untrusted remote web pages from pivoting to sensitive local file:// or dangerous protocol schemes
    wc.on('will-navigate', (event, navigationUrl) => {
      const currentUrl = wc.getURL();
      const lowerNav = navigationUrl.toLowerCase();
      if (currentUrl && (currentUrl.startsWith('http://') || currentUrl.startsWith('https://'))) {
        if (lowerNav.startsWith('file:') || lowerNav.startsWith('javascript:') || lowerNav.startsWith('data:') || lowerNav.startsWith('vbscript:')) {
          event.preventDefault();
          console.warn(`[TabManager] Blocked remote attempt to navigate to dangerous scheme: ${navigationUrl}`);
        }
      }
    });

    // Native in-page right click context menu
    wc.on('context-menu', (_event, params) => {
      try {
        const menu = new Menu();

        // 1. Navigation Actions
        menu.append(new MenuItem({
          label: 'Back',
          enabled: canGoBack(),
          click: () => goBack(),
        }));
        menu.append(new MenuItem({
          label: 'Forward',
          enabled: canGoForward(),
          click: () => goForward(),
        }));
        menu.append(new MenuItem({
          label: 'Reload',
          click: () => wc.reload(),
        }));
        menu.append(new MenuItem({ type: 'separator' }));

        // 2. Link Actions
        if (params.linkURL) {
          menu.append(new MenuItem({
            label: 'Open Link in New Tab',
            click: () => this.createTab(params.linkURL, true),
          }));
          menu.append(new MenuItem({
            label: 'Copy Link Address',
            click: () => clipboard.writeText(params.linkURL),
          }));
          menu.append(new MenuItem({ type: 'separator' }));
        }

        // 3. Selection Actions
        if (params.selectionText && params.selectionText.trim()) {
          const text = params.selectionText.trim();
          menu.append(new MenuItem({
            label: 'Copy',
            role: 'copy',
          }));
          menu.append(new MenuItem({
            label: `Search for "${text.length > 25 ? text.slice(0, 25) + '...' : text}"`,
            click: () => {
              const searchUrl = this.navigationService.buildSearchUrl(text);
              this.createTab(searchUrl, true);
            },
          }));
          menu.append(new MenuItem({ type: 'separator' }));
        }

        // 4. Inspection & DevTools
        menu.append(new MenuItem({
          label: 'Inspect Element',
          click: () => {
            wc.inspectElement(params.x, params.y);
            if (!wc.isDevToolsOpened()) {
              wc.openDevTools({ mode: 'detach' });
            }
          },
        }));

        menu.popup();
      } catch (menuErr) {
        console.warn('[TabManager] Context menu error:', menuErr);
      }
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

      // Add new active view if views are currently visible and not an internal start page
      if (this.isViewsVisible && !isInternalNewTab(target.state.url)) {
        try {
          this.window.contentView.addChildView(target.view);
        } catch {
          // Child view might already be present
        }
        this.layoutActiveView();
      } else {
        try {
          this.window.contentView.removeChildView(target.view);
        } catch {}
      }
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

    // Determine adjacent active tab using visual order before deletion
    let nextTabIdToActivate: TabId | null = null;
    if (this.activeTabId === tabId) {
      const visualTabs = this.getAllTabs();
      const closedIndex = visualTabs.findIndex((t) => t.id === tabId);
      if (closedIndex > -1) {
        if (closedIndex + 1 < visualTabs.length) {
          nextTabIdToActivate = visualTabs[closedIndex + 1].id;
        } else if (closedIndex > 0) {
          nextTabIdToActivate = visualTabs[closedIndex - 1].id;
        }
      }
    }

    if (this.splitTabId === tabId) {
      this.splitTabId = null;
    }

    this.tabs.delete(tabId);
    this.emit('tab:closed', tabId);

    // If active tab was closed, switch to adjacent tab or create a fresh one
    if (this.activeTabId === tabId) {
      if (nextTabIdToActivate && this.tabs.has(nextTabIdToActivate)) {
        this.activateTab(nextTabIdToActivate);
      } else if (this.tabs.size > 0) {
        const remaining = this.getAllTabs();
        this.activateTab(remaining[0].id);
      } else {
        this.activeTabId = null;
        this.createTab('dualsurf://newtab', true);
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

  public duplicateTab(tabId: TabId): TabState | null {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;
    let url = tab.state.url;
    try {
      url = tab.view.webContents.getURL() || url;
    } catch {
      // Ignored
    }
    return this.createTab(url, true);
  }

  public closeOtherTabs(tabId: TabId): boolean {
    const visualTabs = this.getAllTabs();
    for (const t of visualTabs) {
      // Standard browser behavior: protect pinned tabs and the target tab
      if (t.id !== tabId && !t.pinned) {
        this.closeTab(t.id);
      }
    }
    this.activateTab(tabId);
    return true;
  }

  public closeTabsToTheRight(tabId: TabId): boolean {
    const visualTabs = this.getAllTabs();
    const idx = visualTabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return false;
    for (let i = idx + 1; i < visualTabs.length; i++) {
      const t = visualTabs[i];
      // Standard browser behavior: protect pinned tabs
      if (!t.pinned) {
        this.closeTab(t.id);
      }
    }
    return true;
  }

  public setZoom(tabId: TabId | undefined, zoomFactor: number): number {
    const target = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    if (!target) return 1.0;
    try {
      target.view.webContents.setZoomFactor(Math.max(0.25, Math.min(zoomFactor, 5.0)));
      return target.view.webContents.getZoomFactor();
    } catch {
      return 1.0;
    }
  }

  public getZoom(tabId?: TabId): number {
    const target = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    if (!target) return 1.0;
    try {
      return target.view.webContents.getZoomFactor();
    } catch {
      return 1.0;
    }
  }

  public toggleDevTools(tabId?: TabId): boolean {
    const target = tabId ? this.tabs.get(tabId) : this.getActiveTab();
    if (!target) return false;
    try {
      if (target.view.webContents.isDevToolsOpened()) {
        target.view.webContents.closeDevTools();
        return false;
      } else {
        target.view.webContents.openDevTools({ mode: 'detach' });
        return true;
      }
    } catch {
      return false;
    }
  }

  public getActiveTab(): TabInstance | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  public getTab(tabId: TabId): TabInstance | null {
    return this.tabs.get(tabId) || null;
  }

  public togglePinTab(tabId: TabId): boolean {
    const target = this.tabs.get(tabId);
    if (!target) return false;
    target.state.pinned = !target.state.pinned;
    this.emit('tab:updated', target.state);
    this.emit('state:changed', this.getState());
    return target.state.pinned;
  }

  public toggleMuteTab(tabId: TabId): boolean {
    const target = this.tabs.get(tabId);
    if (!target) return false;
    target.state.muted = !target.state.muted;
    try {
      target.view.webContents.setAudioMuted(target.state.muted);
    } catch {}
    this.emit('tab:updated', target.state);
    this.emit('state:changed', this.getState());
    return target.state.muted;
  }

  public setSplitTab(tabId: TabId | null): boolean {
    if (this.splitTabId === tabId) return true;

    // Remove prior split view from window if it was attached
    if (this.splitTabId && this.window && !this.window.isDestroyed()) {
      const oldSplit = this.tabs.get(this.splitTabId);
      if (oldSplit && oldSplit.state.id !== this.activeTabId) {
        try {
          this.window.contentView.removeChildView(oldSplit.view);
        } catch {}
      }
    }

    if (!tabId || !this.tabs.has(tabId) || tabId === this.activeTabId) {
      this.splitTabId = null;
      this.layoutActiveView();
      this.emit('state:changed', this.getState());
      return false;
    }

    this.splitTabId = tabId;
    const newSplit = this.tabs.get(tabId);
    if (newSplit && this.window && !this.window.isDestroyed() && this.isViewsVisible) {
      try {
        this.window.contentView.addChildView(newSplit.view);
      } catch {}
      this.layoutActiveView();
    }

    this.emit('state:changed', this.getState());
    return true;
  }

  public getSplitTabId(): TabId | null {
    return this.splitTabId;
  }

  public getAllTabs(): TabState[] {
    const list = Array.from(this.tabs.values()).map(t => ({ ...t.state }));
    // Pinned tabs always stay grouped at the front of the tab bar
    return list.sort((a, b) => {
      if (a.pinned === b.pinned) return 0;
      return a.pinned ? -1 : 1;
    });
  }

  public getActiveTabId(): TabId | null {
    return this.activeTabId;
  }

  public getState() {
    return {
      tabs: this.getAllTabs(),
      activeTabId: this.activeTabId,
      splitTabId: this.splitTabId,
      profileId: 'default',
    };
  }
}
