import { contextBridge, ipcRenderer } from 'electron';
import type {
  BookmarkEntry,
  BrowserControllerState,
  BrowserSettings,
  HistoryEntry,
  PageMetadata,
  TabId,
  TabState,
} from '@dualsurf/shared-types';

export interface DualSurfAPI {
  getState: () => Promise<BrowserControllerState>;
  createTab: (url?: string, activate?: boolean) => Promise<TabState>;
  closeTab: (tabId: TabId) => Promise<boolean>;
  activateTab: (tabId: TabId) => Promise<boolean>;
  navigate: (tabId: TabId | undefined, urlOrQuery: string) => Promise<boolean>;
  goBack: (tabId?: TabId) => Promise<boolean>;
  goForward: (tabId?: TabId) => Promise<boolean>;
  reload: (tabId?: TabId) => Promise<boolean>;
  stop: (tabId?: TabId) => Promise<boolean>;
  reopenClosedTab: () => Promise<TabState | null>;
  getPageMetadata: (tabId?: TabId) => Promise<PageMetadata | null>;
  clickNumberedLink: (tabId: TabId | undefined, linkId: number) => Promise<boolean>;
  getSettings: () => Promise<BrowserSettings>;
  updateSettings: (partial: Partial<BrowserSettings>) => Promise<BrowserSettings>;
  getBookmarks: () => Promise<BookmarkEntry[]>;
  addBookmark: (url: string, title?: string) => Promise<BookmarkEntry>;
  removeBookmark: (id: string) => Promise<boolean>;
  getHistory: (limit?: number) => Promise<HistoryEntry[]>;
  clearHistory: () => Promise<void>;
  getDownloads: () => Promise<any[]>;
  setTopBarHeight: (height: number) => Promise<void>;
  onStateChanged: (callback: (state: BrowserControllerState) => void) => () => void;
  onTabUpdated: (callback: (tab: TabState) => void) => () => void;
}

const dualsurfApi: DualSurfAPI = {
  getState: () => ipcRenderer.invoke('dualsurf:getState'),
  createTab: (url, activate) => ipcRenderer.invoke('dualsurf:createTab', url, activate),
  closeTab: (tabId) => ipcRenderer.invoke('dualsurf:closeTab', tabId),
  activateTab: (tabId) => ipcRenderer.invoke('dualsurf:activateTab', tabId),
  navigate: (tabId, urlOrQuery) => ipcRenderer.invoke('dualsurf:navigate', tabId, urlOrQuery),
  goBack: (tabId) => ipcRenderer.invoke('dualsurf:goBack', tabId),
  goForward: (tabId) => ipcRenderer.invoke('dualsurf:goForward', tabId),
  reload: (tabId) => ipcRenderer.invoke('dualsurf:reload', tabId),
  stop: (tabId) => ipcRenderer.invoke('dualsurf:stop', tabId),
  reopenClosedTab: () => ipcRenderer.invoke('dualsurf:reopenClosedTab'),
  getPageMetadata: (tabId) => ipcRenderer.invoke('dualsurf:getPageMetadata', tabId),
  clickNumberedLink: (tabId, linkId) => ipcRenderer.invoke('dualsurf:clickNumberedLink', tabId, linkId),
  getSettings: () => ipcRenderer.invoke('dualsurf:getSettings'),
  updateSettings: (partial) => ipcRenderer.invoke('dualsurf:updateSettings', partial),
  getBookmarks: () => ipcRenderer.invoke('dualsurf:getBookmarks'),
  addBookmark: (url, title) => ipcRenderer.invoke('dualsurf:addBookmark', url, title),
  removeBookmark: (id) => ipcRenderer.invoke('dualsurf:removeBookmark', id),
  getHistory: (limit) => ipcRenderer.invoke('dualsurf:getHistory', limit),
  clearHistory: () => ipcRenderer.invoke('dualsurf:clearHistory'),
  getDownloads: () => ipcRenderer.invoke('dualsurf:getDownloads'),
  setTopBarHeight: (height) => ipcRenderer.invoke('dualsurf:setTopBarHeight', height),

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
};

contextBridge.exposeInMainWorld('dualsurf', dualsurfApi);
