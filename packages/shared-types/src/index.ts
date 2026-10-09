/**
 * DualSurf: Shared Domain Types
 * Shared across GUI, Shared Controller, CLI, and IPC layer.
 */

export type TabId = string;
export type ProfileId = string;

export interface TabState {
  id: TabId;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  pinned: boolean;
  muted: boolean;
  error?: {
    code: number | string;
    description: string;
    failingUrl?: string;
  } | null;
  createdAt: number;
  lastAccessedAt: number;
}

export interface BrowserControllerState {
  tabs: TabState[];
  activeTabId: TabId | null;
  profileId: ProfileId;
  windowBounds?: {
    width: number;
    height: number;
  };
}

export interface NavigationOptions {
  tabId?: TabId;
  newTab?: boolean;
  activate?: boolean;
}

export type SearchEngine = 'duckduckgo' | 'google' | 'brave' | 'bing';

export interface BrowserSettings {
  searchEngine: SearchEngine;
  homeUrl: string;
  restoreSessionOnStartup: boolean;
  terminalTheme: 'dracula' | 'gruvbox' | 'nord' | 'matrix';
  defaultDownloadDir: string;
}

export interface LinkItem {
  id: number;
  label: string;
  href: string;
}

export interface HeadingItem {
  level: number;
  text: string;
}

export interface PageMetadata {
  title: string;
  url: string;
  isLoading: boolean;
  headings: HeadingItem[];
  links: LinkItem[];
  textSnippet?: string;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
  visitCount: number;
}

export interface BookmarkEntry {
  id: string;
  title: string;
  url: string;
  folderId?: string;
  createdAt: number;
}

/**
 * Controller-to-Interface Event Payloads
 */
export type ControllerEventType =
  | 'state:updated'
  | 'tab:created'
  | 'tab:closed'
  | 'tab:activated'
  | 'tab:updated'
  | 'navigation:failed';

export interface ControllerEvent<T = unknown> {
  type: ControllerEventType;
  payload: T;
  timestamp: number;
}
