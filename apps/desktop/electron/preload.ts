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
  CyberShieldStats,
  TrafficLogEntry,
  OllamaPullProgress,
  ProxyConfig,
  EditableCookie,
  CveNewsItem,
  RawHttpRequest,
  RawHttpResponse,
  InterceptRule,
  InterceptedRequest,
  LocalProxyServerStatus,
  PlatformDiagnostics,
} from '@dualsurf/shared-types';

export interface DualSurfAPI {
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
  setZoom: (tabId: TabId | undefined, factor: number) => Promise<number>;
  getZoom: (tabId?: TabId) => Promise<number>;
  toggleDevTools: (tabId?: TabId) => Promise<boolean>;
  toggleFullScreen: () => Promise<boolean>;
  openDownloadsFolder: () => Promise<boolean>;
  getPageMetadata: (tabId?: TabId) => Promise<PageMetadata | null>;
  getReaderArticle: (tabId?: TabId) => Promise<ReaderArticle | null>;
  getPageSecurityInfo: (tabId?: TabId) => Promise<PageSecurityInfo | null>;
  clickNumberedLink: (tabId: TabId | undefined, linkId: number) => Promise<boolean>;
  findInPage: (tabId: TabId | undefined, query: string) => Promise<FindResult>;
  setTerminalMode: (isTerminal: boolean) => Promise<boolean>;
  setViewsVisible: (visible: boolean) => Promise<boolean>;
  captureActivePage: () => Promise<string | null>;
  getSettings: () => Promise<BrowserSettings>;
  updateSettings: (partial: Partial<BrowserSettings>) => Promise<BrowserSettings>;
  resetSettings: () => Promise<BrowserSettings>;
  selectDownloadFolder: () => Promise<{ success: boolean; path: string }>;
  selectFolder: (title?: string) => Promise<{ success: boolean; path?: string }>;
  getPlatformDiagnostics: () => Promise<PlatformDiagnostics>;
  executePurpleAction: (action: string, payload?: any) => Promise<any>;
  checkOllama: (host?: string) => Promise<{ available: boolean; models: string[]; latencyMs: number; error?: string }>;
  getBookmarks: () => Promise<BookmarkEntry[]>;
  addBookmark: (url: string, title?: string) => Promise<BookmarkEntry>;
  removeBookmark: (id: string) => Promise<boolean>;
  getHistory: (limit?: number) => Promise<HistoryEntry[]>;
  clearHistory: (sinceTimestamp?: number) => Promise<void>;
  clearBrowsingData: (options?: ClearBrowsingDataOptions) => Promise<boolean>;
  getDownloads: () => Promise<any[]>;
  setTopBarHeight: (height: number) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  getSystemInfo: () => Promise<SystemInfo>;
  executeCommand: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  getShieldStats: (tabId?: string) => Promise<CyberShieldStats>;
  toggleShield: () => Promise<boolean>;
  toggleShieldWhitelist: (domain: string) => Promise<boolean>;
  getTrafficLogs: (filter?: { tabId?: string; search?: string; method?: string }) => Promise<TrafficLogEntry[]>;
  clearTrafficLogs: () => Promise<boolean>;
  pullOllamaModel: (modelName: string, host?: string) => Promise<{ success: boolean; error?: string }>;
  copilotChat: (messages: any[], model?: string, host?: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  setContentBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) => Promise<boolean>;
  setProxy: (config: ProxyConfig) => Promise<boolean>;
  setUserAgent: (userAgent: string, profileId?: string) => Promise<boolean>;
  toggleAntiFingerprint: (enabled: boolean) => Promise<boolean>;
  getCookies: (targetUrl?: string) => Promise<EditableCookie[]>;
  setCookie: (cookie: EditableCookie, targetUrl: string) => Promise<boolean>;
  removeCookie: (url: string, name: string) => Promise<boolean>;
  getCveNews: () => Promise<CveNewsItem[]>;
  sendRawRequest: (req: RawHttpRequest) => Promise<RawHttpResponse>;
  onStateChanged: (callback: (state: BrowserControllerState) => void) => () => void;
  onTabUpdated: (callback: (tab: TabState) => void) => () => void;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
  onShieldBlocked: (callback: (data: any) => void) => () => void;
  onShieldStats: (callback: (stats: CyberShieldStats) => void) => () => void;
  onTrafficEntry: (callback: (entry: TrafficLogEntry) => void) => () => void;
  onOllamaPullProgress: (callback: (progress: OllamaPullProgress) => void) => () => void;
  onCopilotToken: (callback: (token: string) => void) => () => void;
  // Kali Linux PTY & Execution Workstation APIs
  ptyCreate: (sessionId: string, runtimeId: string, options?: { cols?: number; rows?: number; cwd?: string }) => Promise<{ success: boolean; ptyId: string; runtime?: string; runtimeName?: string; shellExe?: string; cwd?: string; username?: string; hostname?: string; error?: string; isReattached?: boolean }>;
  ptyWrite: (sessionId: string, data: string) => Promise<boolean>;
  ptyResize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
  ptyKill: (sessionId: string) => Promise<boolean>;
  ptyInterrupt: (sessionId: string) => Promise<boolean>;
  onPtyData: (sessionId: string, callback: (data: string) => void) => () => void;
  onPtyExit: (sessionId: string, callback: (exitCode: number) => void) => () => void;
  getKaliRuntimes: () => Promise<any[]>;
  setActiveKaliRuntime: (runtimeId: string) => Promise<boolean>;
  getKaliMetapackages: () => Promise<any[]>;
  getKaliLabs: () => Promise<any[]>;
  proposeCopilotCommand: (task: string, target?: string) => Promise<any>;
  getSpecialistWorkspaceData: (mode: string) => Promise<any>;
  executeBlueTeamAction: (action: string, target?: string, extraArgs?: string[]) => Promise<any>;
  manageIncidentCase: (operation: string, payload: any) => Promise<any>;
  runThreatHunt: (huntId: string, sourceId?: string) => Promise<any>;
  generateSecurityReport: (targetUrl: string, options?: any) => Promise<any>;
  listAuditReports: () => Promise<any[]>;
  readAuditReport: (filename: string) => Promise<string>;
  listFiles: (targetDir?: string) => Promise<{ success: boolean; currentPath: string; rawPath?: string; parentPath?: string | null; files: { name: string; isDir: boolean; modified: string; size?: number }[]; error?: string }>;
  setWorkspaceSandboxDir: (path: string) => Promise<{ success: boolean; path: string }>;
  getWorkspaceSandboxDir: () => Promise<{ path: string; hasGranted: boolean }>;
  getStorageInfo: () => Promise<{ success: boolean; freeBytes: number; totalBytes: number; freeFormatted: string }>;
  checkTools: () => Promise<{ id: string; name: string; bin: string; installed: boolean; path?: string }[]>;
  getRealSystemMetrics: () => Promise<{ cpuCount: number; cpuModel: string; memUsed: string; memTotal: string; uptime: string; processes: { pid: string; user: string; cpu: string; mem: string; cmd: string }[] }>;
  // In-Line Intercepting Proxy APIs
  proxyGetRules: () => Promise<InterceptRule[]>;
  proxySetRules: (rules: InterceptRule[]) => Promise<boolean>;
  proxyToggleBreakpoint: (active?: boolean) => Promise<boolean>;
  proxyGetPendingIntercepts: () => Promise<InterceptedRequest[]>;
  proxyForwardIntercept: (id: string, modifiedHeaders?: Record<string, string>) => Promise<boolean>;
  proxyDropIntercept: (id: string) => Promise<boolean>;
  proxyStartServer: (port?: number, host?: string) => Promise<{ success: boolean; error?: string }>;
  proxyStopServer: () => Promise<boolean>;
  proxyGetStatus: () => Promise<LocalProxyServerStatus>;
  onInterceptPending: (callback: (req: InterceptedRequest) => void) => () => void;
}

const dualsurfApi: DualSurfAPI = {
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
  setZoom: (tabId, factor) => ipcRenderer.invoke('dualsurf:setZoom', tabId, factor),
  getZoom: (tabId) => ipcRenderer.invoke('dualsurf:getZoom', tabId),
  toggleDevTools: (tabId) => ipcRenderer.invoke('dualsurf:toggleDevTools', tabId),
  toggleFullScreen: () => ipcRenderer.invoke('dualsurf:toggleFullScreen'),
  openDownloadsFolder: () => ipcRenderer.invoke('dualsurf:openDownloadsFolder'),
  getPageMetadata: (tabId) => ipcRenderer.invoke('dualsurf:getPageMetadata', tabId),
  getReaderArticle: (tabId) => ipcRenderer.invoke('dualsurf:getReaderArticle', tabId),
  getPageSecurityInfo: (tabId) => ipcRenderer.invoke('dualsurf:getPageSecurityInfo', tabId),
  clickNumberedLink: (tabId, linkId) => ipcRenderer.invoke('dualsurf:clickNumberedLink', tabId, linkId),
  findInPage: (tabId, query) => ipcRenderer.invoke('dualsurf:findInPage', tabId, query),
  setTerminalMode: (isTerminal) => ipcRenderer.invoke('dualsurf:setTerminalMode', isTerminal),
  setViewsVisible: (visible) => ipcRenderer.invoke('dualsurf:setViewsVisible', visible),
  captureActivePage: () => ipcRenderer.invoke('dualsurf:captureActivePage'),
  getSettings: () => ipcRenderer.invoke('dualsurf:getSettings'),
  updateSettings: (partial) => ipcRenderer.invoke('dualsurf:updateSettings', partial),
  resetSettings: () => ipcRenderer.invoke('dualsurf:resetSettings'),
  selectDownloadFolder: () => ipcRenderer.invoke('dualsurf:selectDownloadFolder'),
  selectFolder: (title?: string) => ipcRenderer.invoke('dualsurf:selectFolder', title),
  getPlatformDiagnostics: () => ipcRenderer.invoke('dualsurf:getPlatformDiagnostics'),
  executePurpleAction: (action, payload) => ipcRenderer.invoke('dualsurf:executePurpleAction', action, payload),
  checkOllama: (host) => ipcRenderer.invoke('dualsurf:checkOllama', host),
  getBookmarks: () => ipcRenderer.invoke('dualsurf:getBookmarks'),
  addBookmark: (url, title) => ipcRenderer.invoke('dualsurf:addBookmark', url, title),
  removeBookmark: (id) => ipcRenderer.invoke('dualsurf:removeBookmark', id),
  getHistory: (limit) => ipcRenderer.invoke('dualsurf:getHistory', limit),
  clearHistory: (sinceTimestamp) => ipcRenderer.invoke('dualsurf:clearHistory', sinceTimestamp),
  clearBrowsingData: (options) => ipcRenderer.invoke('dualsurf:clearBrowsingData', options),
  getDownloads: () => ipcRenderer.invoke('dualsurf:getDownloads'),
  setTopBarHeight: (height) => ipcRenderer.invoke('dualsurf:setTopBarHeight', height),
  minimizeWindow: () => ipcRenderer.invoke('dualsurf:minimizeWindow'),
  maximizeWindow: () => ipcRenderer.invoke('dualsurf:maximizeWindow'),
  closeWindow: () => ipcRenderer.invoke('dualsurf:closeWindow'),
  isMaximized: () => ipcRenderer.invoke('dualsurf:isMaximized'),
  getSystemInfo: () => ipcRenderer.invoke('dualsurf:getSystemInfo'),
  executeCommand: (command) => ipcRenderer.invoke('dualsurf:executeCommand', command),
  getShieldStats: (tabId) => ipcRenderer.invoke('dualsurf:getShieldStats', tabId),
  toggleShield: () => ipcRenderer.invoke('dualsurf:toggleShield'),
  toggleShieldWhitelist: (domain) => ipcRenderer.invoke('dualsurf:toggleShieldWhitelist', domain),
  getTrafficLogs: (filter) => ipcRenderer.invoke('dualsurf:getTrafficLogs', filter),
  clearTrafficLogs: () => ipcRenderer.invoke('dualsurf:clearTrafficLogs'),
  pullOllamaModel: (modelName, host) => ipcRenderer.invoke('dualsurf:pullOllamaModel', modelName, host),
  copilotChat: (messages, model, host) => ipcRenderer.invoke('dualsurf:copilotChat', messages, model, host),
  setContentBounds: (bounds) => ipcRenderer.invoke('dualsurf:setContentBounds', bounds),
  setProxy: (config) => ipcRenderer.invoke('dualsurf:setProxy', config),
  setUserAgent: (userAgent, profileId) => ipcRenderer.invoke('dualsurf:setUserAgent', userAgent, profileId),
  toggleAntiFingerprint: (enabled) => ipcRenderer.invoke('dualsurf:toggleAntiFingerprint', enabled),
  getCookies: (targetUrl) => ipcRenderer.invoke('dualsurf:getCookies', targetUrl),
  setCookie: (cookie, targetUrl) => ipcRenderer.invoke('dualsurf:setCookie', cookie, targetUrl),
  removeCookie: (url, name) => ipcRenderer.invoke('dualsurf:removeCookie', url, name),
  getCveNews: () => ipcRenderer.invoke('dualsurf:getCveNews'),
  sendRawRequest: (req) => ipcRenderer.invoke('dualsurf:sendRawRequest', req),

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

  onShieldBlocked: (callback) => {
    const sub = (_e: any, data: any) => callback(data);
    ipcRenderer.on('dualsurf:shieldBlocked', sub);
    return () => ipcRenderer.removeListener('dualsurf:shieldBlocked', sub);
  },

  onShieldStats: (callback) => {
    const sub = (_e: any, stats: CyberShieldStats) => callback(stats);
    ipcRenderer.on('dualsurf:shieldStats', sub);
    return () => ipcRenderer.removeListener('dualsurf:shieldStats', sub);
  },

  onTrafficEntry: (callback) => {
    const sub = (_e: any, entry: TrafficLogEntry) => callback(entry);
    ipcRenderer.on('dualsurf:trafficEntry', sub);
    return () => ipcRenderer.removeListener('dualsurf:trafficEntry', sub);
  },

  onOllamaPullProgress: (callback) => {
    const sub = (_e: any, progress: OllamaPullProgress) => callback(progress);
    ipcRenderer.on('dualsurf:ollamaPullProgress', sub);
    return () => ipcRenderer.removeListener('dualsurf:ollamaPullProgress', sub);
  },

  onCopilotToken: (callback) => {
    const sub = (_e: any, token: string) => callback(token);
    ipcRenderer.on('dualsurf:copilotToken', sub);
    return () => ipcRenderer.removeListener('dualsurf:copilotToken', sub);
  },

  // Kali Linux PTY & Execution Workstation APIs
  ptyCreate: (sessionId, runtimeId, options) => ipcRenderer.invoke('dualsurf:ptyCreate', sessionId, runtimeId, options),
  ptyWrite: (sessionId, data) => ipcRenderer.invoke('dualsurf:ptyWrite', sessionId, data),
  ptyResize: (sessionId, cols, rows) => ipcRenderer.invoke('dualsurf:ptyResize', sessionId, cols, rows),
  ptyKill: (sessionId) => ipcRenderer.invoke('dualsurf:ptyKill', sessionId),
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
  getKaliRuntimes: () => ipcRenderer.invoke('dualsurf:getKaliRuntimes'),
  setActiveKaliRuntime: (runtimeId) => ipcRenderer.invoke('dualsurf:setActiveKaliRuntime', runtimeId),
  getKaliMetapackages: () => ipcRenderer.invoke('dualsurf:getKaliMetapackages'),
  getKaliLabs: () => ipcRenderer.invoke('dualsurf:getKaliLabs'),
  proposeCopilotCommand: (task, target) => ipcRenderer.invoke('dualsurf:proposeCopilotCommand', task, target),
  getSpecialistWorkspaceData: (mode) => ipcRenderer.invoke('dualsurf:getSpecialistWorkspaceData', mode),
  executeBlueTeamAction: (action, target, extraArgs) => ipcRenderer.invoke('dualsurf:executeBlueTeamAction', action, target, extraArgs),
  manageIncidentCase: (operation, payload) => ipcRenderer.invoke('dualsurf:manageIncidentCase', operation, payload),
  runThreatHunt: (huntId, sourceId) => ipcRenderer.invoke('dualsurf:runThreatHunt', huntId, sourceId),
  ptyInterrupt: (sessionId) => ipcRenderer.invoke('dualsurf:ptyInterrupt', sessionId),
  generateSecurityReport: (targetUrl, options) => ipcRenderer.invoke('dualsurf:generateSecurityReport', targetUrl, options),
  listAuditReports: () => ipcRenderer.invoke('dualsurf:listAuditReports'),
  readAuditReport: (filename) => ipcRenderer.invoke('dualsurf:readAuditReport', filename),
  listFiles: (targetDir) => ipcRenderer.invoke('dualsurf:listFiles', targetDir),
  setWorkspaceSandboxDir: (targetPath) => ipcRenderer.invoke('dualsurf:setWorkspaceSandboxDir', targetPath),
  getWorkspaceSandboxDir: () => ipcRenderer.invoke('dualsurf:getWorkspaceSandboxDir'),
  getStorageInfo: () => ipcRenderer.invoke('dualsurf:getStorageInfo'),
  checkTools: () => ipcRenderer.invoke('dualsurf:checkTools'),
  getRealSystemMetrics: () => ipcRenderer.invoke('dualsurf:getRealSystemMetrics'),
  proxyGetRules: () => ipcRenderer.invoke('dualsurf:proxy:getRules'),
  proxySetRules: (rules: InterceptRule[]) => ipcRenderer.invoke('dualsurf:proxy:setRules', rules),
  proxyToggleBreakpoint: (active?: boolean) => ipcRenderer.invoke('dualsurf:proxy:toggleBreakpoint', active),
  proxyGetPendingIntercepts: () => ipcRenderer.invoke('dualsurf:proxy:getPendingIntercepts'),
  proxyForwardIntercept: (id: string, modifiedHeaders?: Record<string, string>) => ipcRenderer.invoke('dualsurf:proxy:forwardIntercept', id, modifiedHeaders),
  proxyDropIntercept: (id: string) => ipcRenderer.invoke('dualsurf:proxy:dropIntercept', id),
  proxyStartServer: (port?: number, host?: string) => ipcRenderer.invoke('dualsurf:proxy:startServer', port, host),
  proxyStopServer: () => ipcRenderer.invoke('dualsurf:proxy:stopServer'),
  proxyGetStatus: () => ipcRenderer.invoke('dualsurf:proxy:getStatus'),
  onInterceptPending: (callback: (req: InterceptedRequest) => void) => {
    const handler = (_event: any, req: InterceptedRequest) => callback(req);
    ipcRenderer.on('dualsurf:interceptPending', handler);
    return () => ipcRenderer.removeListener('dualsurf:interceptPending', handler);
  },
};

contextBridge.exposeInMainWorld('dualsurf', dualsurfApi);

