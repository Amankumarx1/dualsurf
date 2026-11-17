import { contextBridge, ipcRenderer } from 'electron';
import type {
  BookmarkEntry,
  BrowserControllerState,
  BrowserSettings,
  ClearBrowsingDataOptions,
  FindResult,
  HistoryEntry,
  PageMetadata,
  PageSecurityInfo,
  ReaderArticle,
  SystemInfo,
  TabId,
  TabState,
  PlatformDiagnostics,
} from '@dualsurf/shared-types';

export interface DualSurfAPI {
  // Core Tab & Navigation
  getState: () => Promise<BrowserControllerState>;
  createTab: (url?: string, activate?: boolean) => Promise<TabState>;
  closeTab: (tabId: TabId) => Promise<boolean>;
  activateTab: (tabId: TabId) => Promise<boolean>;
  navigate: (tabId: TabId | undefined, urlOrQuery: string) => Promise<boolean>;
  navigateTab: (tabId: TabId | undefined, urlOrQuery: string) => Promise<boolean>;
  goBack: (tabId?: TabId) => Promise<boolean>;
  goForward: (tabId?: TabId) => Promise<boolean>;
  reload: (tabId?: TabId) => Promise<boolean>;
  stop: (tabId?: TabId) => Promise<boolean>;
  reopenClosedTab: () => Promise<TabState | null>;
  duplicateTab: (tabId?: TabId) => Promise<TabState | null>;
  togglePinTab: (tabId?: TabId) => Promise<boolean>;
  toggleMuteTab: (tabId?: TabId) => Promise<boolean>;
  setSplitTab: (tabId: TabId | null) => Promise<boolean>;
  closeOtherTabs: (tabId?: TabId) => Promise<boolean>;
  closeTabsToTheRight: (tabId?: TabId) => Promise<boolean>;

  // Viewport, Zoom & Window
  setZoom: (tabId: TabId | undefined, factor: number) => Promise<number>;
  getZoom: (tabId?: TabId) => Promise<number>;
  toggleDevTools: (tabId?: TabId) => Promise<boolean>;
  toggleFullScreen: () => Promise<boolean>;
  setTerminalMode: (isTerminal: boolean) => Promise<boolean>;
  setViewsVisible: (visible: boolean) => Promise<boolean>;
  captureActivePage: () => Promise<string | null>;
  setContentBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) => Promise<boolean>;
  setTopBarHeight: (height: number) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  // Content Inspection & Reading
  getPageMetadata: (tabId?: TabId) => Promise<PageMetadata | null>;
  getReaderArticle: (tabId?: TabId) => Promise<ReaderArticle | null>;
  getPageSecurityInfo: (tabId?: TabId) => Promise<PageSecurityInfo | null>;
  clickNumberedLink: (tabId: TabId | undefined, linkId: number) => Promise<boolean>;
  findInPage: (tabId: TabId | undefined, query: string) => Promise<FindResult>;

  // Settings & System
  getSettings: () => Promise<BrowserSettings>;
  updateSettings: (partial: Partial<BrowserSettings>) => Promise<BrowserSettings>;
  resetSettings: () => Promise<BrowserSettings>;
  selectDownloadFolder: () => Promise<{ success: boolean; path: string }>;
  selectFolder: (title?: string) => Promise<{ success: boolean; path?: string }>;
  getPlatformDiagnostics: () => Promise<PlatformDiagnostics>;
  getSystemInfo: () => Promise<SystemInfo>;
  executeCommand: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

  // Bookmarks, History & Data
  getBookmarks: () => Promise<BookmarkEntry[]>;
  addBookmark: (url: string, title?: string) => Promise<BookmarkEntry>;
  removeBookmark: (id: string) => Promise<boolean>;
  getHistory: (limit?: number) => Promise<HistoryEntry[]>;
  clearHistory: (sinceTimestamp?: number) => Promise<void>;
  clearBrowsingData: (options?: ClearBrowsingDataOptions) => Promise<boolean>;
  getDownloads: () => Promise<any[]>;
  openDownloadsFolder: () => Promise<boolean>;

  // PTY Terminal Emulation
  ptyCreate: (sessionId: string, runtimeId?: string, options?: { cols?: number; rows?: number; cwd?: string }) => Promise<{ success: boolean; ptyId: string; runtime?: string; runtimeName?: string; shellExe?: string; cwd?: string; username?: string; hostname?: string; error?: string; isReattached?: boolean }>;
  ptyWrite: (sessionId: string, data: string) => Promise<boolean>;
  ptyResize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
  ptyKill: (sessionId: string) => Promise<boolean>;
  ptyInterrupt: (sessionId: string) => Promise<boolean>;
  onPtyData: (sessionId: string, callback: (data: string) => void) => () => void;
  onPtyExit: (sessionId: string, callback: (exitCode: number) => void) => () => void;

  // Real-time Event Subscriptions
  onStateChanged: (callback: (state: BrowserControllerState) => void) => () => void;
  onTabUpdated: (callback: (tab: TabState) => void) => () => void;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
  onWindowResized: (callback: () => void) => () => void;
}

const dualsurfApi: DualSurfAPI = {
  // Tabs & Navigation
  getState: () => ipcRenderer.invoke('dualsurf:getState'),
  createTab: (url, activate) => ipcRenderer.invoke('dualsurf:createTab', url, activate),
  closeTab: (tabId) => ipcRenderer.invoke('dualsurf:closeTab', tabId),
  activateTab: (tabId) => ipcRenderer.invoke('dualsurf:activateTab', tabId),
  navigate: (tabId, urlOrQuery) => ipcRenderer.invoke('dualsurf:navigate', tabId, urlOrQuery),
  navigateTab: (tabId, urlOrQuery) => ipcRenderer.invoke('dualsurf:navigate', tabId, urlOrQuery),
  goBack: (tabId) => ipcRenderer.invoke('dualsurf:goBack', tabId),
  goForward: (tabId) => ipcRenderer.invoke('dualsurf:goForward', tabId),
  reload: (tabId) => ipcRenderer.invoke('dualsurf:reload', tabId),
  stop: (tabId) => ipcRenderer.invoke('dualsurf:stop', tabId),
  reopenClosedTab: () => ipcRenderer.invoke('dualsurf:reopenClosedTab'),
  duplicateTab: (tabId) => ipcRenderer.invoke('dualsurf:duplicateTab', tabId),
  togglePinTab: (tabId) => ipcRenderer.invoke('dualsurf:togglePinTab', tabId),
  toggleMuteTab: (tabId) => ipcRenderer.invoke('dualsurf:toggleMuteTab', tabId),
  setSplitTab: (tabId) => ipcRenderer.invoke('dualsurf:setSplitTab', tabId),
  closeOtherTabs: (tabId) => ipcRenderer.invoke('dualsurf:closeOtherTabs', tabId),
  closeTabsToTheRight: (tabId) => ipcRenderer.invoke('dualsurf:closeTabsToTheRight', tabId),

  // Viewport, Zoom & Window
  setZoom: (tabId, factor) => ipcRenderer.invoke('dualsurf:setZoom', tabId, factor),
  getZoom: (tabId) => ipcRenderer.invoke('dualsurf:getZoom', tabId),
  toggleDevTools: (tabId) => ipcRenderer.invoke('dualsurf:toggleDevTools', tabId),
  toggleFullScreen: () => ipcRenderer.invoke('dualsurf:toggleFullScreen'),
  setTerminalMode: (isTerminal) => ipcRenderer.invoke('dualsurf:setTerminalMode', isTerminal),
  setViewsVisible: (visible) => ipcRenderer.invoke('dualsurf:setViewsVisible', visible),
  captureActivePage: () => ipcRenderer.invoke('dualsurf:captureActivePage'),
  setContentBounds: (bounds) => ipcRenderer.invoke('dualsurf:setContentBounds', bounds),
  setTopBarHeight: (height) => ipcRenderer.invoke('dualsurf:setTopBarHeight', height),
  minimizeWindow: () => ipcRenderer.invoke('dualsurf:minimizeWindow'),
  maximizeWindow: () => ipcRenderer.invoke('dualsurf:maximizeWindow'),
  closeWindow: () => ipcRenderer.invoke('dualsurf:closeWindow'),
  isMaximized: () => ipcRenderer.invoke('dualsurf:isMaximized'),

  // Content Inspection & Reading
  getPageMetadata: (tabId) => ipcRenderer.invoke('dualsurf:getPageMetadata', tabId),
  getReaderArticle: (tabId) => ipcRenderer.invoke('dualsurf:getReaderArticle', tabId),
  getPageSecurityInfo: (tabId) => ipcRenderer.invoke('dualsurf:getPageSecurityInfo', tabId),
  clickNumberedLink: (tabId, linkId) => ipcRenderer.invoke('dualsurf:clickNumberedLink', tabId, linkId),
  findInPage: (tabId, query) => ipcRenderer.invoke('dualsurf:findInPage', tabId, query),

  // Settings & System
  getSettings: () => ipcRenderer.invoke('dualsurf:getSettings'),
  updateSettings: (partial) => ipcRenderer.invoke('dualsurf:updateSettings', partial),
  resetSettings: () => ipcRenderer.invoke('dualsurf:resetSettings'),
  selectDownloadFolder: () => ipcRenderer.invoke('dualsurf:selectDownloadFolder'),
  selectFolder: (title?: string) => ipcRenderer.invoke('dualsurf:selectFolder', title),
  getPlatformDiagnostics: () => ipcRenderer.invoke('dualsurf:getPlatformDiagnostics'),
  getSystemInfo: () => ipcRenderer.invoke('dualsurf:getSystemInfo'),
  executeCommand: (command) => ipcRenderer.invoke('dualsurf:executeCommand', command),

  // Bookmarks, History & Data
  getBookmarks: () => ipcRenderer.invoke('dualsurf:getBookmarks'),
  addBookmark: (url, title) => ipcRenderer.invoke('dualsurf:addBookmark', url, title),
  removeBookmark: (id) => ipcRenderer.invoke('dualsurf:removeBookmark', id),
  getHistory: (limit) => ipcRenderer.invoke('dualsurf:getHistory', limit),
  clearHistory: (sinceTimestamp) => ipcRenderer.invoke('dualsurf:clearHistory', sinceTimestamp),
  clearBrowsingData: (options) => ipcRenderer.invoke('dualsurf:clearBrowsingData', options),
  getDownloads: () => ipcRenderer.invoke('dualsurf:getDownloads'),
  openDownloadsFolder: () => ipcRenderer.invoke('dualsurf:openDownloadsFolder'),

  // PTY Terminal
  ptyCreate: (sessionId, runtimeId, options) => ipcRenderer.invoke('dualsurf:ptyCreate', sessionId, runtimeId, options),
  ptyWrite: (sessionId, data) => ipcRenderer.invoke('dualsurf:ptyWrite', sessionId, data),
  ptyResize: (sessionId, cols, rows) => ipcRenderer.invoke('dualsurf:ptyResize', sessionId, cols, rows),
  ptyKill: (sessionId) => ipcRenderer.invoke('dualsurf:ptyKill', sessionId),
  ptyInterrupt: (sessionId) => ipcRenderer.invoke('dualsurf:ptyInterrupt', sessionId),
  onPtyData: (sessionId, callback) => {
    const sub = (_e: any, data: string) => callback(data);
    ipcRenderer.on(`dualsurf:ptyData:${sessionId}`, sub);
    return () => ipcRenderer.removeListener(`dualsurf:ptyData:${sessionId}`, sub);
  },
  onPtyExit: (sessionId, callback) => {
    const sub = (_e: any, code: number) => callback(code);
    ipcRenderer.on(`dualsurf:ptyExit:${sessionId}`, sub);
    return () => ipcRenderer.removeListener(`dualsurf:ptyExit:${sessionId}`, sub);
  },

  // Event Subscriptions
  onStateChanged: (callback) => {
    const subscription = (_event: any, state: BrowserControllerState) => callback(state);
    ipcRenderer.on('dualsurf:stateChanged', subscription);
    return () => ipcRenderer.removeListener('dualsurf:stateChanged', subscription);
  },
  onTabUpdated: (callback) => {
    const subscription = (_event: any, tab: TabState) => callback(tab);
    ipcRenderer.on('dualsurf:tabUpdated', subscription);
    return () => ipcRenderer.removeListener('dualsurf:tabUpdated', subscription);
  },
  onMaximizedChange: (callback) => {
    const subscription = (_event: any, isMax: boolean) => callback(isMax);
    ipcRenderer.on('dualsurf:windowMaximized', subscription);
    return () => ipcRenderer.removeListener('dualsurf:windowMaximized', subscription);
  },
  onWindowResized: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('dualsurf:windowResized', subscription);
    return () => ipcRenderer.removeListener('dualsurf:windowResized', subscription);
  },
};

contextBridge.exposeInMainWorld('dualsurf', dualsurfApi);
