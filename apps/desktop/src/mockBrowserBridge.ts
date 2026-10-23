/**
 * DualSurf: Standalone Browser Bridge
 * Provides full stateful mock capabilities when DualSurf is executed directly in
 * web browsers (such as Microsoft Edge or Chrome) outside of the native Electron environment.
 */

import type {
  BrowserControllerState,
  BrowserSettings,
  TabState,
  TabId,
  BookmarkEntry,
  HistoryEntry,
  CyberShieldStats,
  TrafficLogEntry,
  EditableCookie,
  CveNewsItem,
  RawHttpRequest,
  RawHttpResponse,
  PageMetadata,
  PageSecurityInfo,
  ReaderArticle,
  FindResult,
  PlatformDiagnostics,
  SystemInfo,
  InterceptRule,
  InterceptedRequest,
  LocalProxyServerStatus,
} from '@dualsurf/shared-types';
import type { DualSurfAPI } from '../electron/preload';

export function setupBrowserBridge(): void {
  if (typeof window === 'undefined' || (window as any).dualsurf) {
    return;
  }

  console.info('%c[DualSurf Browser Bridge] Initializing standalone web browser runtime for Edge/Chrome', 'color: #00ff88; font-weight: bold;');

  // State store
  const stateSubscribers = new Set<(state: BrowserControllerState) => void>();
  const tabSubscribers = new Set<(tab: TabState) => void>();
  const shieldSubscribers = new Set<(stats: CyberShieldStats) => void>();
  const trafficSubscribers = new Set<(entry: TrafficLogEntry) => void>();
  const ptySubscribers = new Map<string, Set<(data: string) => void>>();
  const sessionLineBuffers = new Map<string, string>();
  const sessionRootState = new Map<string, boolean>();
  const sessionCwdState = new Map<string, string>();

  let nextTabNum = 2;
  const initialTab: TabState = {
    id: 'tab-1',
    url: 'dualsurf://newtab',
    title: 'New Tab',
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    pinned: false,
    muted: false,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  };

  const tabs: TabState[] = [initialTab];
  let activeTabId: TabId | null = 'tab-1';
  let splitTabId: TabId | null = null;
  const closedTabs: TabState[] = [];

  let settings: BrowserSettings = {
    searchEngine: 'google',
    homeUrl: 'dualsurf://newtab',
    restoreSessionOnStartup: true,
    terminalTheme: 'dracula',
    defaultDownloadDir: 'C:\\Users\\User\\Downloads',
    defaultShell: 'powershell',
    cyberShieldEnabled: true,
    tabLayout: 'horizontal',
    autoHibernateTabs: false,
    activeWorkspaceId: 'default',
    workspaces: [
      { id: 'default', name: 'General', color: '#ffffff', tabIds: ['tab-1'] },
      { id: 'recon', name: 'Recon & Security', color: '#ff0055', tabIds: [] },
      { id: 'dev', name: 'Development', color: '#00ff88', tabIds: [] },
    ],
    proxy: { mode: 'direct' },
    activeUserAgentId: 'default',
    antiFingerprintEnabled: true,
    themeMode: 'dark',
    uiDensity: 'comfortable',
    terminalDefaultWorkingDir: '',
    terminalRestoreSessions: false,
    terminalShowWelcome: true,
    terminalFontSize: 14,
    defaultZoom: 1,
    ollama: {
      enabled: true,
      host: 'http://127.0.0.1:11434',
      model: 'llama3:8b',
      onboardingCompleted: true,
    },
  };

  const bookmarks: BookmarkEntry[] = [
    { id: 'bm-1', url: 'https://codexsec.com', title: 'CodexSec Cyber Research', createdAt: Date.now() - 3600000 },
    { id: 'bm-2', url: 'https://nmap.org', title: 'Nmap Network Scanner', createdAt: Date.now() - 7200000 },
    { id: 'bm-3', url: 'https://owasp.org', title: 'OWASP Security Foundation', createdAt: Date.now() - 10800000 },
    { id: 'bm-4', url: 'https://www.exploit-db.com', title: 'Exploit Database', createdAt: Date.now() - 14400000 },
  ];

  const history: HistoryEntry[] = [
    { id: 'h-1', url: 'https://codexsec.com', title: 'CodexSec - Cyber Operations', visitedAt: Date.now() - 600000, visitCount: 5 },
    { id: 'h-2', url: 'https://github.com', title: 'GitHub: Where the world builds software', visitedAt: Date.now() - 1800000, visitCount: 12 },
    { id: 'h-3', url: 'https://news.ycombinator.com', title: 'Hacker News', visitedAt: Date.now() - 3600000, visitCount: 8 },
  ];

  let shieldStats: CyberShieldStats = {
    enabled: true,
    totalBlocked: 32,
    trackersBlocked: 18,
    adsBlocked: 7,
    malwareBlocked: 3,
    tabBlockedCount: 4,
    whitelistedDomains: [],
    recentBlocked: [
      {
        url: 'https://telemetry.bad-tracker.net/collect',
        domain: 'telemetry.bad-tracker.net',
        category: 'tracker',
        timestamp: Date.now() - 30000,
      },
    ],
  };

  const trafficLogs: TrafficLogEntry[] = [
    {
      id: 'req-1',
      tabId: 'tab-1',
      url: 'https://codexsec.com/api/v1/telemetry',
      method: 'POST',
      statusCode: 200,
      resourceType: 'fetch',
      timestamp: Date.now() - 12000,
      durationMs: 42,
      requestHeaders: { 'Content-Type': 'application/json', 'User-Agent': 'DualSurf/1.0 (SecBrowser; x64)' },
      responseHeaders: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
      contentLength: 512,
    },
    {
      id: 'req-2',
      tabId: 'tab-1',
      url: 'https://codexsec.com/assets/matrix-bg.webp',
      method: 'GET',
      statusCode: 200,
      resourceType: 'image',
      timestamp: Date.now() - 8000,
      durationMs: 18,
      requestHeaders: { 'Accept': 'image/webp,*/*' },
      responseHeaders: { 'Cache-Control': 'max-age=31536000', 'Content-Type': 'image/webp' },
      contentLength: 104820,
    },
    {
      id: 'req-3',
      tabId: 'tab-1',
      url: 'https://analytics.trackers.example/ping',
      method: 'GET',
      statusCode: 0,
      resourceType: 'script',
      timestamp: Date.now() - 5000,
      durationMs: 1,
      requestHeaders: { 'Host': 'analytics.trackers.example' },
      responseHeaders: {},
      contentLength: 0,
      blocked: true,
      blockedReason: 'CyberShield Filter (Telemetry Tracker Blocked)',
    },
  ];

  const cookies: EditableCookie[] = [
    {
      name: 'dualsurf_session',
      value: 'sec_auth_token_9918237192',
      domain: 'codexsec.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      expirationDate: Math.floor(Date.now() / 1000) + 86400,
    },
    {
      name: 'csrftoken',
      value: 'xX8219adfa09121ba89',
      domain: 'codexsec.com',
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'strict',
    },
  ];

  function notifyState(): void {
    const currentState: BrowserControllerState = {
      tabs: [...tabs],
      activeTabId,
      splitTabId,
      profileId: 'default',
    };
    stateSubscribers.forEach((cb) => cb(currentState));
  }

  function notifyTab(tab: TabState): void {
    tabSubscribers.forEach((cb) => cb(tab));
  }

  const browserApi: DualSurfAPI = {
    getState: async () => ({
      tabs: [...tabs],
      activeTabId,
      splitTabId,
      profileId: 'default',
    }),

    createTab: async (url = 'dualsurf://newtab', activate = true) => {
      const id = `tab-${nextTabNum++}`;
      let title = 'New Tab';
      if (url.startsWith('http')) {
        try {
          const parsed = new URL(url);
          title = parsed.hostname;
        } catch {
          title = url;
        }
      }
      const newTab: TabState = {
        id,
        url,
        title,
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        pinned: false,
        muted: false,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      tabs.push(newTab);
      if (activate) {
        activeTabId = id;
      }
      notifyState();
      return newTab;
    },

    closeTab: async (tabId: TabId) => {
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx !== -1) {
        const [removed] = tabs.splice(idx, 1);
        closedTabs.push(removed);
        if (activeTabId === tabId) {
          activeTabId = tabs.length > 0 ? tabs[Math.max(0, idx - 1)].id : null;
        }
        if (splitTabId === tabId) {
          splitTabId = null;
        }
        notifyState();
      }
      return true;
    },

    activateTab: async (tabId: TabId) => {
      const found = tabs.find((t) => t.id === tabId);
      if (found) {
        activeTabId = tabId;
        found.lastAccessedAt = Date.now();
        notifyState();
        return true;
      }
      return false;
    },

    navigate: async (tabId: TabId | undefined, urlOrQuery: string) => {
      const targetId = tabId || activeTabId;
      const tab = tabs.find((t) => t.id === targetId);
      if (!tab) return false;

      let finalUrl = urlOrQuery.trim();
      let finalTitle = finalUrl;

      if (!finalUrl.includes('://') && !finalUrl.startsWith('dualsurf://') && !finalUrl.startsWith('about:')) {
        if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/.test(finalUrl)) {
          finalUrl = `https://${finalUrl}`;
          finalTitle = finalUrl;
        } else {
          finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
          finalTitle = `${urlOrQuery} - Google Search`;
        }
      } else {
        try {
          const parsed = new URL(finalUrl);
          finalTitle = parsed.hostname;
        } catch {
          finalTitle = finalUrl;
        }
      }

      tab.url = finalUrl;
      tab.title = finalTitle;
      tab.canGoBack = true;
      tab.isLoading = false;

      // Add to history
      history.unshift({
        id: `h-${Date.now()}`,
        url: finalUrl,
        title: finalTitle,
        visitedAt: Date.now(),
        visitCount: 1,
      });

      notifyTab(tab);
      notifyState();
      return true;
    },

    navigateTab: async (tabId, urlOrQuery) => {
      return browserApi.navigate(tabId, urlOrQuery);
    },

    goBack: async (tabId) => {
      const tab = tabs.find((t) => t.id === (tabId || activeTabId));
      if (tab) {
        tab.canGoForward = true;
        notifyTab(tab);
        notifyState();
      }
      return true;
    },

    goForward: async (tabId) => {
      const tab = tabs.find((t) => t.id === (tabId || activeTabId));
      if (tab) {
        notifyTab(tab);
        notifyState();
      }
      return true;
    },

    reload: async (tabId) => {
      const tab = tabs.find((t) => t.id === (tabId || activeTabId));
      if (tab) {
        tab.isLoading = true;
        notifyTab(tab);
        setTimeout(() => {
          tab.isLoading = false;
          notifyTab(tab);
          notifyState();
        }, 300);
      }
      return true;
    },

    stop: async (tabId) => {
      const tab = tabs.find((t) => t.id === (tabId || activeTabId));
      if (tab) {
        tab.isLoading = false;
        notifyTab(tab);
      }
      return true;
    },

    reopenClosedTab: async () => {
      const popped = closedTabs.pop();
      if (popped) {
        tabs.push(popped);
        activeTabId = popped.id;
        notifyState();
        return popped;
      }
      return null;
    },

    duplicateTab: async (tabId) => {
      const tab = tabs.find((t) => t.id === (tabId || activeTabId));
      if (tab) {
        return browserApi.createTab(tab.url, true);
      }
      return null;
    },

    togglePinTab: async (tabId) => {
      const tab = tabs.find((t) => t.id === (tabId || activeTabId));
      if (tab) {
        tab.pinned = !tab.pinned;
        notifyTab(tab);
        notifyState();
      }
      return true;
    },

    toggleMuteTab: async (tabId) => {
      const tab = tabs.find((t) => t.id === (tabId || activeTabId));
      if (tab) {
        tab.muted = !tab.muted;
        notifyTab(tab);
        notifyState();
      }
      return true;
    },

    setSplitTab: async (tabId) => {
      splitTabId = tabId;
      notifyState();
      return true;
    },

    closeOtherTabs: async (tabId) => {
      const keepId = tabId || activeTabId;
      const filtered = tabs.filter((t) => t.id === keepId);
      tabs.length = 0;
      tabs.push(...filtered);
      activeTabId = keepId;
      notifyState();
      return true;
    },

    closeTabsToTheRight: async (tabId) => {
      const keepId = tabId || activeTabId;
      const idx = tabs.findIndex((t) => t.id === keepId);
      if (idx !== -1) {
        tabs.splice(idx + 1);
        notifyState();
      }
      return true;
    },

    setZoom: async (_tabId, factor) => factor,
    getZoom: async () => 1,
    toggleDevTools: async () => true,
    toggleFullScreen: async () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
      return true;
    },

    openDownloadsFolder: async () => true,

    getPageMetadata: async (tabId) => {
      const tab = tabs.find((t) => t.id === (tabId || activeTabId));
      return {
        title: tab?.title || 'DualSurf Security Node',
        description: 'Hardened dual-mode reconnaissance browser and tactical cybersecurity console.',
        url: tab?.url || 'dualsurf://newtab',
        icon: '🔒',
        keywords: ['cybersecurity', 'reconnaissance', 'packet-sniffer', 'http-repeater', 'dualsurf'],
        security: {
          isSecure: true,
          protocol: 'TLSv1.3',
          cipher: 'TLS_AES_256_GCM_SHA384',
          certificateIssuer: 'DigiCert Global Root G2',
          validFrom: '2025-01-01',
          validTo: '2027-01-01',
        },
        headers: {
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
          'Content-Security-Policy': "default-src 'self'",
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
        },
      } as unknown as PageMetadata;
    },

    getReaderArticle: async (tabId) => {
      const tab = tabs.find((t) => t.id === (tabId || activeTabId));
      return {
        title: tab?.title || 'Distraction Free Mode',
        content: '<p>This is a distraction-free, privacy-hardened reader mode view generated by DualSurf.</p>',
        byline: 'DualSurf Privacy Engine',
        textContent: 'Distraction-free privacy view.',
        length: 120,
        siteName: tab?.title || 'DualSurf',
      } as ReaderArticle;
    },

    getPageSecurityInfo: async () => {
      const active = tabs.find((t) => t.id === activeTabId) || tabs[0];
      const url = active?.url || 'https://vantage.csw.lenovo.com/v1/web/containerwidget/default/';
      let hostname = 'vantage.csw.lenovo.com';
      try {
        hostname = new URL(url).hostname;
      } catch {}
      const isHttps = url.startsWith('https://');

      return {
        url,
        hostname,
        isHttps,
        securityScore: isHttps ? 94 : 38,
        grade: isHttps ? 'A' : 'D',
        protocol: 'TLSv1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384',
        certificate: {
          issuer: 'DigiCert Global Root G2',
          validFrom: new Date(Date.now() - 30 * 86400000).toISOString(),
          validTo: new Date(Date.now() + 335 * 86400000).toISOString(),
          daysRemaining: 335,
          subjectAltNames: [hostname, `*.${hostname}`],
          isExpired: false,
        },
        headers: [
          { name: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload', status: 'pass' },
          { name: 'Content-Security-Policy', value: "default-src 'self' https:; frame-ancestors 'self'", status: 'pass' },
          { name: 'X-Content-Type-Options', value: 'nosniff', status: 'pass' },
          { name: 'X-Frame-Options', value: 'SAMEORIGIN', status: 'pass' },
        ],
        cookiesCount: 4,
        hasInsecureContent: false,
      } as unknown as PageSecurityInfo;
    },

    clickNumberedLink: async () => true,
    findInPage: async (_tabId, query) => ({
      activeMatchOrdinal: query ? 1 : 0,
      numberOfMatches: query ? 3 : 0,
    } as unknown as FindResult),

    setTerminalMode: async () => true,
    setViewsVisible: async () => true,
    captureActivePage: async () => null,

    getSettings: async () => ({ ...settings }),
    updateSettings: async (partial) => {
      settings = { ...settings, ...partial };
      return { ...settings };
    },
    resetSettings: async () => {
      return { ...settings };
    },
    selectDownloadFolder: async () => ({ success: true, path: 'C:\\Users\\User\\Downloads' }),
    selectFolder: async (_title?: string) => ({ success: true, path: 'C:\\Users\\User\\DualSurf-Kali-Workspace' }),
    getWorkspaceSandboxDir: async () => ({
      path: settings.workspaceSandboxDir || 'C:\\Users\\User\\DualSurf-Kali-Workspace',
      hasGranted: Boolean(settings.hasGrantedWorkspaceAccess),
    }),
    setWorkspaceSandboxDir: async (sandboxPath: string) => {
      settings = {
        ...settings,
        workspaceSandboxDir: sandboxPath,
        hasGrantedWorkspaceAccess: true,
        terminalDefaultWorkingDir: sandboxPath,
      };
      return { success: true, path: sandboxPath };
    },

    getPlatformDiagnostics: async () => ({
      electronVersion: '34.5.8 (Edge/Web Emulation)',
      chromeVersion: '133.0.0.0',
      nodeVersion: '22.13.10',
      v8Version: '12.8',
      platform: 'win32',
      arch: 'x64',
      osRelease: 'Windows 11 Pro 64-bit',
      hostname: 'DUALSURF-WORKSTATION',
      uptimeSeconds: 7420,
      memoryRssMb: 142,
      memoryHeapUsedMb: 68,
      memoryHeapTotalMb: 112,
      userDataPath: 'C:\\Users\\User\\AppData\\Roaming\\DualSurf',
      downloadsPath: 'C:\\Users\\User\\Downloads',
    } as PlatformDiagnostics),

    checkOllama: async () => ({
      available: true,
      models: ['llama3:8b', 'mistral:7b', 'deepseek-r1:8b'],
      latencyMs: 14,
    }),

    getBookmarks: async () => [...bookmarks],
    addBookmark: async (url, title) => {
      const bm: BookmarkEntry = {
        id: `bm-${Date.now()}`,
        url,
        title: title || url,
        createdAt: Date.now(),
      };
      bookmarks.push(bm);
      return bm;
    },
    removeBookmark: async (id) => {
      const idx = bookmarks.findIndex((b) => b.id === id);
      if (idx !== -1) bookmarks.splice(idx, 1);
      return true;
    },

    getHistory: async () => [...history],
    clearHistory: async () => {
      history.length = 0;
    },
    clearBrowsingData: async () => {
      history.length = 0;
      return true;
    },

    getDownloads: async () => [
      { id: 'dl-1', filename: 'nmap-7.95-setup.exe', progress: 100, state: 'completed', totalBytes: 28419200 },
      { id: 'dl-2', filename: 'wireshark-win64-4.2.5.exe', progress: 100, state: 'completed', totalBytes: 78912400 },
    ],

    setTopBarHeight: async () => {},
    minimizeWindow: async () => {},
    maximizeWindow: async () => {},
    closeWindow: async () => {},
    isMaximized: async () => false,

    getSystemInfo: async () => ({
      platform: 'win32',
      arch: 'x64',
      cpus: 16,
      totalMemory: 34359738368,
      freeMemory: 18253611008,
      uptime: 89400,
    } as unknown as SystemInfo),

    executeCommand: async (cmd) => ({
      stdout: `[dualsurf@kali ~]$ ${cmd}\nCommand executed successfully on simulated security runtime.`,
      stderr: '',
      exitCode: 0,
    }),

    getShieldStats: async () => ({ ...shieldStats }),
    toggleShield: async () => {
      shieldStats = {
        ...shieldStats,
        enabled: !shieldStats.enabled,
        totalBlocked: shieldStats.totalBlocked + 1,
      };
      shieldSubscribers.forEach((cb) => cb({ ...shieldStats }));
      return shieldStats.enabled;
    },
    toggleShieldWhitelist: async (domain?: string) => {
      if (!domain) return true;
      const lower = domain.toLowerCase();
      const idx = shieldStats.whitelistedDomains.indexOf(lower);
      if (idx >= 0) {
        shieldStats.whitelistedDomains.splice(idx, 1);
      } else {
        shieldStats.whitelistedDomains.push(lower);
      }
      shieldSubscribers.forEach((cb) => cb({ ...shieldStats }));
      return idx < 0;
    },

    getTrafficLogs: async (filter) => {
      let filtered = [...trafficLogs];
      if (filter?.method && filter.method !== 'ALL') {
        filtered = filtered.filter((r) => r.method === filter.method);
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        filtered = filtered.filter((r) => r.url.toLowerCase().includes(q));
      }
      return filtered;
    },

    clearTrafficLogs: async () => {
      trafficLogs.length = 0;
      return true;
    },

    pullOllamaModel: async (_model) => ({ success: true }),
    copilotChat: async (messages) => {
      const lastMsg = messages[messages.length - 1]?.content || 'Hello';
      return {
        success: true,
        content: `**DualSurf Cyber AI Assistant:**\n\nI have analyzed your request regarding "${lastMsg}". In this secure workspace, you can perform DNS recon, inspect raw HTTP traffic via the built-in HTTP Repeater, or execute scoped network audits.`,
      };
    },

    setContentBounds: async () => true,
    setProxy: async (cfg) => {
      settings.proxy = cfg;
      return true;
    },
    setUserAgent: async (_ua, profileId) => {
      settings.activeUserAgentId = profileId;
      return true;
    },
    toggleAntiFingerprint: async (enabled) => {
      settings.antiFingerprintEnabled = enabled;
      return true;
    },

    getCookies: async () => [...cookies],
    setCookie: async (cookie) => {
      const idx = cookies.findIndex((c) => c.name === cookie.name && c.domain === cookie.domain);
      if (idx !== -1) {
        cookies[idx] = cookie;
      } else {
        cookies.push(cookie);
      }
      return true;
    },
    removeCookie: async (_url, name) => {
      const idx = cookies.findIndex((c) => c.name === name);
      if (idx !== -1) cookies.splice(idx, 1);
      return true;
    },

    getCveNews: async () => [
      {
        id: 'CVE-2024-38077',
        cveId: 'CVE-2024-38077',
        title: 'Windows Remote Desktop Licensing Service Remote Code Execution Vulnerability',
        severity: 'CRITICAL',
        cvssScore: 9.8,
        description: 'An unauthenticated attacker could send specially crafted packets to compromise the RDL service.',
        publishedDate: '2024-07-09',
        source: 'NVD / Microsoft MSRC',
        references: ['https://msrc.microsoft.com/update-guide/vulnerability/CVE-2024-38077'],
      },
      {
        id: 'CVE-2024-6387',
        cveId: 'CVE-2024-6387',
        title: 'regreSSHion: Remote Code Execution in OpenSSH\'s server (sshd)',
        severity: 'HIGH',
        cvssScore: 8.1,
        description: 'Signal handler race condition vulnerability in OpenSSH sshd process allowing unauthenticated root RCE on glibc systems.',
        publishedDate: '2024-07-01',
        source: 'Qualys Threat Research',
        references: ['https://www.qualys.com/2024/07/01/cve-2024-6387/regresshion.txt'],
      },
      {
        id: 'CVE-2024-21413',
        cveId: 'CVE-2024-21413',
        title: 'Microsoft Outlook Remote Code Execution Vulnerability (MonikerLink)',
        severity: 'CRITICAL',
        cvssScore: 9.8,
        description: 'Flaw in Office Moniker handling bypasses Protected View and leaks NTLM credentials.',
        publishedDate: '2024-02-13',
        source: 'Check Point Research',
        references: ['https://msrc.microsoft.com/update-guide/vulnerability/CVE-2024-21413'],
      },
    ] as unknown as CveNewsItem[],

    sendRawRequest: async (req: RawHttpRequest): Promise<RawHttpResponse> => {
      const startTime = Date.now();
      const mockBody = JSON.stringify({
        status: 'success',
        echo: {
          method: req.method,
          url: req.url,
          headers: req.headers,
        },
        securityTelemetry: {
          wafStatus: 'bypassed_simulated',
          sslCipher: 'TLS_AES_256_GCM_SHA384',
          nodeLatencyMs: 19,
        },
      }, null, 2);

      return {
        success: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'server': 'DualSurf-Security-Edge/2.0',
          'x-powered-by': 'DualSurf Embedded Interceptor',
          'x-content-type-options': 'nosniff',
          'connection': 'close',
        },
        body: mockBody,
        rawHeaders: 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nServer: DualSurf-Security-Edge\r\n',
        roundTripTimeMs: Date.now() - startTime + 24,
        sizeBytes: mockBody.length,
      };
    },

    onStateChanged: (callback) => {
      stateSubscribers.add(callback);
      return () => {
        stateSubscribers.delete(callback);
      };
    },

    onTabUpdated: (callback) => {
      tabSubscribers.add(callback);
      return () => {
        tabSubscribers.delete(callback);
      };
    },

    onMaximizedChange: () => () => {},
    onShieldBlocked: () => () => {},
    onShieldStats: (callback) => {
      shieldSubscribers.add(callback);
      return () => {
        shieldSubscribers.delete(callback);
      };
    },
    onTrafficEntry: (callback) => {
      trafficSubscribers.add(callback);
      return () => {
        trafficSubscribers.delete(callback);
      };
    },
    onOllamaPullProgress: () => () => {},
    onCopilotToken: () => () => {},

    ptyCreate: async (sessionId, runtimeId, options) => {
      const sandbox = settings.workspaceSandboxDir || 'C:\\Users\\User\\DualSurf-Kali-Workspace';
      const effectiveCwd = options?.cwd || sandbox;
      sessionCwdState.set(sessionId, '~');
      sessionRootState.set(sessionId, false);

      setTimeout(() => {
        const sid = sessionId || 'default';
        const subs = ptySubscribers.get(sid) || ptySubscribers.get('default');
        const dragonBanner = [
          '\x1b[1;34m  ..............\x1b[0m',
          '\x1b[1;34m             ..,;:ccc,.\x1b[0m',
          '\x1b[1;34m           ......\'\'\';lxO.\x1b[0m',
          '\x1b[1;34m  .....\'\'\'\'..........,:ld;\x1b[0m',
          '\x1b[1;34m             .\',;;:ccc;..:ko.\x1b[0m',
          '\x1b[1;34m          ..:::clllcccc:;:lo:.\x1b[0m',
          '\x1b[1;34m        ......\'\'\'\'...,:lx:\x1b[0m',
          '\x1b[1;34m                 .\';:clc:.\x1b[0m',
          '\x1b[1;36m┌── Kali GNU/Linux Rolling 2026.1 (WSL Sandboxed Jail)\x1b[0m',
          '\x1b[90m├── System: \x1b[32mLinux dualsurf 6.6.137-kali-amd64\x1b[0m',
          `\x1b[90m├── Sandbox Root: \x1b[33m${effectiveCwd}\x1b[0m`,
          '\x1b[90m└── Boundary: \x1b[36mRestricted to granted folder (\'sudo su\' supported)\x1b[0m\r\n',
          '\x1b[1;34m┌──(\x1b[1;34mkali\x1b[1;37m㉿\x1b[1;34mdualsurf\x1b[1;34m)-[\x1b[1;37m~\x1b[1;34m]\x1b[0m\r\n\x1b[1;34m└─\x1b[1;31m$\x1b[0m ',
        ].join('\r\n');
        subs?.forEach((cb) => cb(dragonBanner));
      }, 50);

      return {
        success: true,
        ptyId: sessionId,
        runtime: runtimeId || 'kali-linux',
        runtimeName: 'Kali Linux (WSL Sandboxed)',
        cwd: effectiveCwd,
        username: 'kali',
        hostname: 'dualsurf',
      };
    },
    ptyWrite: async (sessionId, data) => {
      const sid = sessionId || 'default';
      const subs = ptySubscribers.get(sid) || ptySubscribers.get('default');
      let buf = sessionLineBuffers.get(sid) || '';

      const executeVirtualCommand = (rawLine: string): string => {
        const parts = rawLine.trim().split(/\s+/);
        const cmd = parts[0]?.toLowerCase() || '';
        const arg1 = parts[1] || '';

        switch (cmd) {
          case 'help':
          case '?':
            return [
              '\x1b[1;36m=== DualSurf Cyber Workstation Commands ===\x1b[0m',
              '  \x1b[32mopen <url>\x1b[0m        Navigate active tab to target web address',
              '  \x1b[32mnav <url>\x1b[0m         Alias for open',
              '  \x1b[32mpage\x1b[0m              Display active page title, security state & metadata',
              '  \x1b[32mtabs\x1b[0m              List all currently open browser tabs',
              '  \x1b[32mtab <num>\x1b[0m         Switch to tab by 1-based index',
              '  \x1b[32mnew [url]\x1b[0m         Open a new browser tab',
              '  \x1b[32mclose [num]\x1b[0m       Close specified tab or active tab',
              '  \x1b[32mback / forward\x1b[0m   Navigate history backwards/forwards',
              '  \x1b[32mreload\x1b[0m            Refresh active tab content',
              '  \x1b[32mheadings\x1b[0m          Extract headings (h1-h6) from current DOM',
              '  \x1b[32mlinks\x1b[0m             Enumerate all clickable hyperlinks on page',
              '  \x1b[32mcookies\x1b[0m           Audit session cookies and security attributes',
              '  \x1b[32mheaders\x1b[0m           Audit HTTP response headers & security policies',
              '  \x1b[32mscan <url>\x1b[0m        Execute automated vulnerability audit pipeline',
              '  \x1b[32mports <host>\x1b[0m      Run perimeter TCP/UDP port sweep',
              '  \x1b[32mrecon <domain>\x1b[0m    Perform OSINT asset discovery & DNS mapping',
              '  \x1b[32mhistory\x1b[0m           Display recently visited pages',
              '  \x1b[32mbookmarks\x1b[0m         List saved browser bookmarks',
              '  \x1b[32mstatus\x1b[0m            Show host diagnostics and AI assistant state',
              '  \x1b[32mtools\x1b[0m             Audit detected local cybersecurity binaries',
              '  \x1b[32mwhoami / pwd\x1b[0m      Display current user & directory context',
              '  \x1b[32mclear\x1b[0m             Clear terminal display',
              '  \x1b[32mgui / exit\x1b[0m        Return to graphical browser viewport',
            ].join('\r\n');

          case 'status': {
            const curTab = tabs.find((t) => t.id === activeTabId);
            return [
              '\x1b[1;36m[DualSurf Workstation Status]\x1b[0m',
              `  \x1b[1mActive Tab:\x1b[0m     ${curTab?.title || 'None'} (${curTab?.url || 'about:blank'})`,
              `  \x1b[1mOpen Tabs:\x1b[0m      ${tabs.length} tabs active`,
              `  \x1b[1mCyberShield:\x1b[0m    \x1b[32mACTIVE\x1b[0m (${shieldStats.totalBlocked} threats blocked)`,
              `  \x1b[1mProxy Routing:\x1b[0m  Direct Connection (Local Bypass)`,
              `  \x1b[1mOllama Engine:\x1b[0m  \x1b[32mONLINE\x1b[0m (model: llama3:8b, latency: 14ms)`,
              `  \x1b[1mRuntime:\x1b[0m        DualSurf Host Terminal`,
              `  \x1b[1mIsolation:\x1b[0m      WebContents Sandboxed`,
            ].join('\r\n');
          }

          case 'tabs':
            return [
              '\x1b[1mIDX  TAB ID   TITLE                            URL\x1b[0m',
              '----------------------------------------------------------------------',
              ...tabs.map((t, idx) => {
                const isAct = t.id === activeTabId ? '\x1b[32m* ' : '  ';
                const title = (t.title || 'New Tab').padEnd(30).slice(0, 30);
                return `${isAct}${idx + 1}   ${t.id.padEnd(8)} ${title} ${t.url}\x1b[0m`;
              }),
            ].join('\r\n');

          case 'tab': {
            const idx = parseInt(arg1, 10) - 1;
            if (!isNaN(idx) && tabs[idx]) {
              browserApi.activateTab(tabs[idx].id);
              return `\x1b[32mSwitched to tab #${arg1}: ${tabs[idx].title} (${tabs[idx].url})\x1b[0m`;
            }
            return '\x1b[31mError: Invalid tab index. Usage: tab <number>\x1b[0m';
          }

          case 'open':
          case 'nav':
          case 'goto': {
            if (!arg1) return '\x1b[31mUsage: open <url | query>\x1b[0m';
            browserApi.navigate(activeTabId || undefined, arg1);
            return `\x1b[32m[Navigation] Loading: ${arg1} ...\x1b[0m\r\n\x1b[90mHTTP 200 OK | Content-Type: text/html | TLS 1.3 AES-256-GCM\x1b[0m`;
          }

          case 'new':
          case 'newtab': {
            const targetUrl = arg1 || 'dualsurf://newtab';
            browserApi.createTab(targetUrl);
            return `\x1b[32mOpened new tab with URL: ${targetUrl}\x1b[0m`;
          }

          case 'close':
          case 'closetab': {
            if (arg1) {
              const idx = parseInt(arg1, 10) - 1;
              if (!isNaN(idx) && tabs[idx]) {
                const closedId = tabs[idx].id;
                browserApi.closeTab(closedId);
                return `\x1b[33mClosed tab #${arg1} (${closedId})\x1b[0m`;
              }
            } else if (activeTabId) {
              browserApi.closeTab(activeTabId);
              return `\x1b[33mClosed active tab (${activeTabId})\x1b[0m`;
            }
            return '\x1b[31mError: Could not close tab\x1b[0m';
          }

          case 'page': {
            const cur = tabs.find((t) => t.id === activeTabId);
            return [
              '\x1b[1;36m=== Active Page Metadata ===\x1b[0m',
              `  \x1b[1mTitle:\x1b[0m       ${cur?.title || 'None'}`,
              `  \x1b[1mURL:\x1b[0m         ${cur?.url || 'about:blank'}`,
              `  \x1b[1mProtocol:\x1b[0m    TLS 1.3 / HTTPS`,
              `  \x1b[1mCipher:\x1b[0m      TLS_AES_256_GCM_SHA384`,
              `  \x1b[1mSecurity:\x1b[0m    \x1b[32mSecure\x1b[0m (HSTS Active, CSP Enforced, Sandboxed)`,
            ].join('\r\n');
          }

          case 'headings':
            return [
              '\x1b[1m[Page Headings]\x1b[0m',
              '  \x1b[36mH1:\x1b[0m DualSurf Hardened Cyber Security Workstation',
              '  \x1b[36mH2:\x1b[0m Tactical Threat Ingestion & Adversary Emulation',
              '  \x1b[36mH3:\x1b[0m Live Packet Repeater & Telemetry Monitors',
            ].join('\r\n');

          case 'links':
            return [
              '\x1b[1m[Clickable Links on Page]\x1b[0m',
              '  \x1b[33m[1]\x1b[0m Documentation       (https://dualsurf.internal/docs)',
              '  \x1b[33m[2]\x1b[0m MITRE ATT&CK Matrix (https://attack.mitre.org)',
              '  \x1b[33m[3]\x1b[0m CVE Security Guide  (https://cve.mitre.org)',
              '  \x1b[33m[4]\x1b[0m CodexSec Lab Blog   (https://codexsec.com)',
            ].join('\r\n');

          case 'history':
            return [
              '\x1b[1m=== Browsing History (Last 10 Visits) ===\x1b[0m',
              ...history.slice(0, 10).map((h, i) => `  ${i + 1}. \x1b[36m${h.title}\x1b[0m - ${h.url} (${new Date(h.visitedAt).toLocaleTimeString()})`),
            ].join('\r\n');

          case 'bookmarks':
            return [
              '\x1b[1m=== Saved Bookmarks ===\x1b[0m',
              ...bookmarks.map((b, i) => `  ${i + 1}. \x1b[33m★\x1b[0m \x1b[1m${b.title}\x1b[0m -> ${b.url}`),
            ].join('\r\n');

          case 'cookies':
            return [
              '\x1b[1m=== Active Cookies ===\x1b[0m',
              '  NAME               DOMAIN          SECURE  HTTPONLY  VALUE',
              '  -----------------------------------------------------------------',
              '  dualsurf_session   codexsec.com    TRUE    TRUE      sec_auth_token_991823...',
              '  csrftoken          codexsec.com    TRUE    FALSE     xX8219adfa09121ba89...',
            ].join('\r\n');

          case 'headers':
            return [
              '\x1b[1m=== HTTP Security Headers Audit ===\x1b[0m',
              '  \x1b[32mStrict-Transport-Security:\x1b[0m max-age=31536000; includeSubDomains; preload (\x1b[32mPASS\x1b[0m)',
              "  \x1b[32mContent-Security-Policy:\x1b[0m default-src 'self'; script-src 'self' (\x1b[32mPASS\x1b[0m)",
              '  \x1b[32mX-Frame-Options:\x1b[0m DENY (\x1b[32mPASS\x1b[0m)',
              '  \x1b[32mX-Content-Type-Options:\x1b[0m nosniff (\x1b[32mPASS\x1b[0m)',
              '  \x1b[32mReferrer-Policy:\x1b[0m strict-origin-when-cross-origin (\x1b[32mPASS\x1b[0m)',
            ].join('\r\n');

          case 'ports':
          case 'nmap': {
            const target = arg1 || '127.0.0.1';
            return [
              `\x1b[36mStarting Nmap 7.95 ( https://nmap.org ) against ${target} ...\x1b[0m`,
              `Host is up (0.00021s latency).`,
              `\x1b[1mPORT     STATE SERVICE     VERSION\x1b[0m`,
              `22/tcp   open  ssh         OpenSSH 9.2p1 Debian 2 (protocol 2.0)`,
              `80/tcp   open  http        nginx 1.24.0`,
              `443/tcp  open  ssl/https   nginx 1.24.0 (TLS 1.3 / HTTP/2)`,
              `8080/tcp open  http-proxy  DualSurf In-Line Interceptor 2.0`,
              `\x1b[32mNmap done: 1 IP address (1 host up) scanned in 0.42 seconds\x1b[0m`,
            ].join('\r\n');
          }

          case 'scan':
          case 'sec-audit': {
            const target = arg1 || tabs.find((t) => t.id === activeTabId)?.url || 'http://localhost:5173';
            return [
              `\x1b[1;36m[DualSurf Automated Security Assessment]\x1b[0m Target: ${target}`,
              `  [*] Evaluating OWASP Top 10 web boundaries...`,
              `  [*] Checking SSL/TLS cipher suites & certificate validity...`,
              `  [*] Auditing response headers & Content-Security-Policy...`,
              `\x1b[1;32m[+] Audit Completed: Overall Security Score 88/100 (Grade: A)\x1b[0m`,
              `  - [MED] CSP lacks nonce strict-dynamic`,
              `  - [LOW] Permissions-Policy header missing`,
              `  - [INFO] TLS 1.3 modern cipher suite active`,
            ].join('\r\n');
          }

          case 'recon': {
            const domain = arg1 || 'codexsec.com';
            return [
              `\x1b[1;36m[Target Reconnaissance & OSINT]\x1b[0m Domain: ${domain}`,
              `  [*] Resolving DNS A/AAAA records: 198.51.100.42`,
              `  [*] Discovering subdomains: api.${domain}, portal.${domain}, dev.${domain}`,
              `  [*] ASN Identification: AS13335 (Cloudflare, Inc.)`,
              `  [*] Web Server: nginx / Cloudflare Edge`,
              `  \x1b[32m[✓] Reconnaissance complete. 3 assets added to Attack Surface graph.\x1b[0m`,
            ].join('\r\n');
          }

          case 'tools':
            return [
              '\x1b[1m[Verified Local Cybersecurity Binaries]\x1b[0m',
              '  \x1b[32m[✓] nmap\x1b[0m         Network port discovery & service version scanner',
              '  \x1b[32m[✓] curl\x1b[0m         Command line tool and library for transferring data',
              '  \x1b[32m[✓] openssl\x1b[0m      TLS/SSL cryptography toolkit',
              '  \x1b[32m[✓] wireshark\x1b[0m    Network packet analyzer (tshark CLI ready)',
              '  \x1b[32m[✓] nuclei\x1b[0m       Fast vulnerability scanner based on simple YAML DSL',
              '  \x1b[32m[✓] sqlmap\x1b[0m       Automatic SQL injection tool',
            ].join('\r\n');

          case 'sudo':
          case 'su':
            if (rawLine.trim() === 'sudo su' || rawLine.trim() === 'su' || rawLine.trim() === 'sudo -i' || rawLine.trim() === 'sudo -s') {
              sessionRootState.set(sid, true);
              return '\x1b[36m[*] Elevated to root inside Kali sandbox jail.\x1b[0m';
            }
            return '\x1b[90m[sudo] Executing in Kali sandbox jail...\x1b[0m';

          case 'whoami':
            return sessionRootState.get(sid) ? 'root' : 'kali';

          case 'hostname':
            return 'dualsurf';

          case 'uname':
            return 'Linux dualsurf 6.6.137-kali-amd64 #1 SMP PREEMPT_DYNAMIC Kali 6.6.137-1kali1 (2026-02-15) x86_64 GNU/Linux';

          case 'id':
            return sessionRootState.get(sid)
              ? 'uid=0(root) gid=0(root) groups=0(root)'
              : 'uid=1000(kali) gid=1000(kali) groups=1000(kali),27(sudo),100(users)';

          case 'pwd': {
            const cwd = sessionCwdState.get(sid) || '~';
            return cwd === '~' ? '/' : cwd;
          }

          case 'cd': {
            const target = arg1.trim();
            const cur = sessionCwdState.get(sid) || '~';
            if (!target || target === '~' || target === '/' || target === '') {
              sessionCwdState.set(sid, '~');
              return '';
            }
            if (target === '..') {
              if (cur === '~') {
                return '\x1b[31mdualsurf-jail: cd: permission denied: cannot escape sandboxed folder\x1b[0m';
              }
              sessionCwdState.set(sid, '~');
              return '';
            }
            sessionCwdState.set(sid, '~/' + target.replace(/^[\/\\]/, ''));
            return '';
          }

          case 'ls':
            return '\x1b[1;34mDesktop  Downloads  Projects  Tools  Reports\x1b[0m  recon_targets.txt';

          case 'neofetch':
            return [
              '\x1b[1;36m DualSurf Kali Terminal (WSL Sandboxed Jail)\x1b[0m',
              '  \x1b[1mOS:\x1b[0m Kali GNU/Linux Rolling 2026.1 (x86_64)',
              '  \x1b[1mHost:\x1b[0m dualsurf (Linux 6.6.137-kali-amd64)',
              '  \x1b[1mKernel:\x1b[0m 6.6.137-kali-amd64',
              '  \x1b[1mShell:\x1b[0m zsh 5.9 / Kali Prompt',
              '  \x1b[1mTerminal:\x1b[0m dualsurf-pty (xterm.js)',
            ].join('\r\n');

          case 'gui':
            browserApi.setTerminalMode(false);
            return '\x1b[32m[Switching to GUI Browser Mode...]\x1b[0m';

          case 'exit':
            if (sessionRootState.get(sid)) {
              sessionRootState.set(sid, false);
              return '\x1b[90m[*] Dropped root privileges. Returned to user kali.\x1b[0m';
            }
            browserApi.setTerminalMode(false);
            return '\x1b[32m[Switching to GUI Browser Mode...]\x1b[0m';

          case 'clear':
            return '\x1b[2J\x1b[H';

          default:
            return `\x1b[90m[kali-sandbox: executed "${rawLine}"]\x1b[0m\r\n\x1b[32mStatus: Completed with exit code 0\x1b[0m`;
        }
      };

      const renderKaliPrompt = (sessionKey: string) => {
        const isRoot = Boolean(sessionRootState.get(sessionKey));
        const cwd = sessionCwdState.get(sessionKey) || '~';
        const user = isRoot ? 'root' : 'kali';
        const userColor = isRoot ? '\x1b[1;31m' : '\x1b[1;34m';
        const promptSymbol = isRoot ? '#' : '$';
        return `\x1b[1;34m┌──(${userColor}${user}\x1b[1;37m㉿\x1b[1;34mdualsurf\x1b[1;34m)-[\x1b[1;37m${cwd}\x1b[1;34m]\x1b[0m\r\n\x1b[1;34m└─\x1b[1;31m${promptSymbol}\x1b[0m `;
      };

      for (let i = 0; i < data.length; i++) {
        const ch = data[i];
        if (ch === '\r' || ch === '\n') {
          subs?.forEach((cb) => cb('\r\n'));
          const cmdLine = buf.trim();
          buf = '';
          sessionLineBuffers.set(sid, '');
          if (cmdLine) {
            const output = executeVirtualCommand(cmdLine);
            if (output === '\x1b[2J\x1b[H') {
              subs?.forEach((cb) => cb('\x1b[2J\x1b[H'));
            } else if (output) {
              subs?.forEach((cb) => cb(output + '\r\n'));
            }
          }
          subs?.forEach((cb) => cb(renderKaliPrompt(sid)));
        } else if (ch === '\x7f' || ch === '\b') {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            sessionLineBuffers.set(sid, buf);
            subs?.forEach((cb) => cb('\b \b'));
          }
        } else if (ch === '\x03') {
          buf = '';
          sessionLineBuffers.set(sid, '');
          subs?.forEach((cb) => cb('^C\r\n' + renderKaliPrompt(sid)));
        } else {
          buf += ch;
          sessionLineBuffers.set(sid, buf);
          subs?.forEach((cb) => cb(ch));
        }
      }
      return true;
    },
    ptyResize: async () => true,
    ptyKill: async (sessionId) => {
      ptySubscribers.delete(sessionId);
      sessionLineBuffers.delete(sessionId);
      sessionRootState.delete(sessionId);
      sessionCwdState.delete(sessionId);
      return true;
    },
    ptyInterrupt: async (sessionId) => {
      const sid = sessionId || 'default';
      const subs = ptySubscribers.get(sid) || ptySubscribers.get('default');
      const isRoot = Boolean(sessionRootState.get(sid));
      const cwd = sessionCwdState.get(sid) || '~';
      const user = isRoot ? 'root' : 'kali';
      const userColor = isRoot ? '\x1b[1;31m' : '\x1b[1;34m';
      const promptSymbol = isRoot ? '#' : '$';
      const prompt = `\x1b[1;34m┌──(${userColor}${user}\x1b[1;37m㉿\x1b[1;34mdualsurf\x1b[1;34m)-[\x1b[1;37m${cwd}\x1b[1;34m]\x1b[0m\r\n\x1b[1;34m└─\x1b[1;31m${promptSymbol}\x1b[0m `;
      subs?.forEach((cb) => cb('^C\r\n' + prompt));
      return true;
    },
    onPtyData: (sessionId, callback) => {
      const sid = sessionId || 'default';
      if (!ptySubscribers.has(sid)) {
        ptySubscribers.set(sid, new Set());
      }
      ptySubscribers.get(sid)!.add(callback);
      if (!ptySubscribers.has('default')) {
        ptySubscribers.set('default', new Set());
      }
      ptySubscribers.get('default')!.add(callback);

      return () => {
        ptySubscribers.get(sid)?.delete(callback);
        ptySubscribers.get('default')?.delete(callback);
      };
    },
    onPtyExit: () => () => {},
    getKaliRuntimes: async () => [
      { id: 'kali-wsl', name: 'Kali Linux (WSL2)', status: 'ready', default: true },
      { id: 'kali-docker', name: 'Kali Rolling (Container)', status: 'available' },
      { id: 'host-powershell', name: 'Host Windows PowerShell', status: 'ready' },
    ],
    setActiveKaliRuntime: async () => true,
    getKaliMetapackages: async () => [
      { id: 'kali-tools-top10', name: 'Top 10 Security Tools', installed: true, count: 10 },
      { id: 'kali-tools-web', name: 'Web Application Analysis', installed: true, count: 48 },
      { id: 'kali-tools-information-gathering', name: 'OSINT & Information Gathering', installed: true, count: 64 },
    ],
    getKaliLabs: async () => [],
    proposeCopilotCommand: async (task) => ({ command: `nmap -sV -sC -Pn ${task || 'codexsec.com'}` }),
    getSpecialistWorkspaceData: async (mode) => {
      if (mode === 'blue') {
        return {
          status: 'online',
          mode: 'blue',
          blueDomains: [
            { id: 'telemetry', name: 'Live Host Telemetry', count: 3 },
            { id: 'cases', name: 'Incident Cases', count: 2 },
          ],
          bluePillars: [
            {
              id: 1,
              name: 'Endpoint Detection & Response (EDR)',
              description: 'Kernel-level process, network, and file integrity monitoring.',
              tools: ['Wazuh', 'Sysmon', 'Osquery'],
              sampleRule: 'title: Suspicious Process Spawning from Web Server\nstatus: production\nlogsource:\n  category: process_creation\n  product: windows\ndetection:\n  selection:\n    ParentImage|endswith: ["w3wp.exe", "nginx.exe", "httpd.exe"]\n    Image|endswith: ["cmd.exe", "powershell.exe", "whoami.exe"]\n  condition: selection',
            },
            {
              id: 2,
              name: 'Network Threat Detection (NIDS/NTA)',
              description: 'Deep packet inspection, protocol analysis, and JA3/JA4 TLS fingerprinting.',
              tools: ['Suricata', 'Zeek', 'Snort3'],
              sampleRule: 'alert tcp $EXTERNAL_NET any -> $HOME_NET $HTTP_PORTS (msg:"DUALSURF - Inbound Log4j RCE Attempt"; flow:established,to_server; content:"${jndi:"; nocase; classtype:attempted-admin; sid:1000001; rev:1;)',
            },
            {
              id: 3,
              name: 'Security Information & Event Management (SIEM)',
              description: 'Centralized log aggregation, correlation rules, and event enrichment.',
              tools: ['Elasticsearch', 'Splunk', 'Grafana Loki'],
              sampleRule: 'index=dualsurf_telemetry sourcetype="wineventlog:security" EventCode=4625 | stats count by TargetUserName, Source_Network_Address | where count > 5',
            },
          ],
          incidentCases: [
            {
              id: 'CASE-2026-001',
              title: 'Suspicious TLS 1.0 Downgrade & Heartbleed Probe',
              severity: 'P1-CRITICAL',
              status: 'Investigating',
              category: 'Web Application Attack',
              affectedHosts: ['192.168.1.100', 'api.internal'],
              iocs: ['198.51.100.42'],
              createdAt: Date.now() - 3600000,
              evidenceIds: ['EV-01', 'EV-03'],
            },
            {
              id: 'CASE-2026-002',
              title: 'Port Scan Sweep from External ASN',
              severity: 'P3-MEDIUM',
              status: 'Open',
              category: 'Network Reconnaissance',
              affectedHosts: ['192.168.1.1'],
              iocs: ['203.0.113.19'],
              createdAt: Date.now() - 7200000,
              evidenceIds: [],
            },
          ],
          blueChecklist: [
            { id: 'chk-1', text: 'Validate TLS certificate expiration & cipher suite', completed: true },
            { id: 'chk-2', text: 'Confirm WAF rate limiting on authentication endpoints', completed: true },
            { id: 'chk-3', text: 'Verify egress firewall filtering on unallocated ports', completed: false },
          ],
          telemetrySources: [
            { id: 'suricata', name: 'Suricata NIDS', status: 'Online', eventsPerSec: 1420, protocol: 'EVE JSON' },
            { id: 'zeek', name: 'Zeek Network Security Monitor', status: 'Online', eventsPerSec: 2850, protocol: 'TSV/JSON' },
            { id: 'wazuh', name: 'Wazuh Host EDR', status: 'Online', eventsPerSec: 410, protocol: 'Syslog / API' },
          ],
          threatHunts: [
            {
              id: 'hunt-webshell',
              name: 'Web Shell Detection & PHP Obfuscation',
              title: 'Web Shell Detection & PHP Obfuscation',
              hypothesis: 'Adversaries establishing persistence via obfuscated eval/assert calls in upload dirs.',
              mitreTactic: 'Persistence (TA0003)',
              techniqueId: 'T1505.003',
              dataSources: ['Web Server Logs', 'Process Creation', 'File Integrity'],
              mitreTechniques: ['T1505.003 - Server Software Component: Web Shell', 'T1059.004 - Unix Shell'],
              recommendedQueries: ['suricata.signature_id:2010935', 'process.name:(php OR nginx) AND child.name:sh'],
              status: 'Ready',
            },
            {
              id: 'hunt-c2-beaconing',
              name: 'Periodic C2 DNS Tunneling & Beaconing',
              title: 'Periodic C2 DNS Tunneling & Beaconing',
              hypothesis: 'Malware using DNS TXT record tunneling for outbound exfiltration and beaconing.',
              mitreTactic: 'Command and Control (TA0011)',
              techniqueId: 'T1071.004',
              dataSources: ['Zeek DNS Logs', 'Network Flow', 'Suricata EVE'],
              mitreTechniques: ['T1071.004 - Application Layer Protocol: DNS', 'T1048 - Exfiltration Over Alternative Protocol'],
              recommendedQueries: ['dns.query_length:>50', 'zeek.dns.qtype_name:"TXT"'],
              status: 'Ready',
            },
          ],
          detectedBlueTools: [
            { id: 'wazuh', name: 'Wazuh Agent', installed: true, version: '4.8.0' },
            { id: 'sysmon', name: 'Sysmon', installed: true, version: '15.1' },
          ],
        };
      }

      if (mode === 'red') {
        return {
          status: 'online',
          mode: 'red',
          redDomains: [{ id: 'recon', name: 'Reconnaissance' }, { id: 'exploitation', name: 'Exploitation' }],
          engagementScopes: [
            { id: 'scope-1', name: 'Authorized DualSurf Local & Web Labs', targets: ['localhost', '127.0.0.1', 'github.com', 'codexsec.com', 'nmap.org', '*'] }
          ],
          findingsList: [
            { id: 'FND-001', title: 'Content Security Policy (CSP) Lacks Nonce Strictness', severity: 'Medium', pillar: 'Web Application & API Pentesting', target: 'http://localhost:5173' },
            { id: 'FND-002', title: 'Permissive CORS Header Access-Control-Allow-Origin: *', severity: 'Low', pillar: 'Web Application & API Pentesting', target: 'http://localhost:5173' },
          ],
          redChecklist: [
            { id: 'rchk-1', text: 'Verify scope boundary against RoE agreement', completed: true },
            { id: 'rchk-2', text: 'Execute non-intrusive port and banner discovery', completed: true },
            { id: 'rchk-3', text: 'Audit TLS configuration and security headers', completed: true },
          ],
        };
      }

      return { status: 'online', mode };
    },
    executePurpleAction: async (action, payload) => {
      if (action === 'getOverview') {
        return {
          scenarios: [
            {
              id: 'SCN-001',
              title: 'T1059.001 - PowerShell Obfuscated Download Cradle',
              techniqueId: 'T1059.001',
              tactic: 'Execution',
              description: 'Executes an encoded PowerShell cradle designed to test AMSI telemetry and Sysmon Event ID 1 detection.',
              command: 'powershell -NoP -NonI -W Hidden -Enc SUVY...',
              mitreUrl: 'https://attack.mitre.org/techniques/T1059/001/',
            },
            {
              id: 'SCN-002',
              title: 'T1003.001 - LSASS Memory Credential Access Emulation',
              techniqueId: 'T1003.001',
              tactic: 'Credential Access',
              description: 'Simulates MiniDumpWriteDump against an isolated mock process to trigger Sysmon Event ID 10 alerts.',
              command: 'rundll32.exe comsvcs.dll, MiniDump...',
              mitreUrl: 'https://attack.mitre.org/techniques/T1003/001/',
            },
          ],
          environments: [
            { id: 'env-local-win', name: 'DualSurf Windows Range (Local)', isAvailable: true, os: 'Windows 11 Enterprise', ip: '127.0.0.1' },
            { id: 'env-kali-wsl', name: 'Kali Linux Adversary Container', isAvailable: true, os: 'Kali Rolling 2026', ip: '172.28.0.2' },
          ],
          testCases: [
            { id: 'TC-01', name: 'T1059.001 - Command & Scripting Interpreter' },
            { id: 'TC-02', name: 'T1003.001 - OS Credential Dumping' },
          ],
          assessments: [
            {
              id: 'ASM-2026-01',
              title: 'Q1 Web Perimeter Emulation & Telemetry Verification',
              operator: 'Purple Team Lead',
              targetRange: '127.0.0.1',
              status: 'Completed',
              createdAt: Date.now() - 86400000,
              score: '91%',
            },
          ],
        };
      }
      if (action === 'executeScenario') {
        return {
          status: 'COMPLETED',
          executionTimeMs: 1420,
          detections: 2,
          log: `Executed scenario ${payload?.scenarioId || 'unknown'} against range ${payload?.environmentId || 'local'}. Sysmon Event 1 generated. Wazuh alert triggered.`,
        };
      }
      if (action === 'createAssessment') {
        return { success: true };
      }
      return { success: true };
    },
    executeBlueTeamAction: async () => ({ success: true, timestamp: Date.now() }),
    manageIncidentCase: async () => ({ success: true }),
    runThreatHunt: async (huntId) => ({
      huntId,
      completedAt: Date.now(),
      matchesFound: 2,
      findings: [
        { timestamp: new Date().toISOString(), host: '192.168.1.100', match: 'Suspicious beacon sequence (interval=60s jitter=5%)' },
        { timestamp: new Date().toISOString(), host: 'api.internal', match: 'High entropy DNS query payload detected' },
      ],
    }),
    generateSecurityReport: async (targetUrl) => ({
      success: true,
      result: {
        targetUrl,
        securityScore: 88,
        findings: [
          { id: 'F-01', title: 'Content Security Policy (CSP) Lacks Strict-Dynamic', severity: 'Medium', pillar: 'Web Application & API Pentesting' },
          { id: 'F-02', title: 'Missing Permissions-Policy Header', severity: 'Low', pillar: 'Web Application & API Pentesting' },
          { id: 'F-03', title: 'Strict-Transport-Security Max-Age < 1 Year', severity: 'Low', pillar: 'Perimeter & Port Scanning' },
        ],
      },
    }),
    listAuditReports: async () => [],
    readAuditReport: async () => '',
    listFiles: async () => ({
      success: true,
      currentPath: 'C:\\Users\\User\\Projects',
      files: [
        { name: 'recon_targets.txt', isDir: false, modified: '2026-10-19', size: 1024 },
        { name: 'evidence_pcaps', isDir: true, modified: '2026-10-19' },
      ],
    }),
    getStorageInfo: async () => ({ success: true, freeBytes: 150000000000, totalBytes: 512000000000, freeFormatted: '150 GB' }),
    checkTools: async () => [
      { id: 'nmap', name: 'Nmap', bin: 'nmap', installed: true },
      { id: 'curl', name: 'cURL', bin: 'curl', installed: true },
      { id: 'openssl', name: 'OpenSSL', bin: 'openssl', installed: true },
    ],
    getRealSystemMetrics: async () => ({
      cpuCount: 16,
      cpuModel: 'AMD Ryzen / Intel Core i7',
      memUsed: '14.2 GB',
      memTotal: '32.0 GB',
      uptime: '18h 42m',
      processes: [
        { pid: '1044', user: 'dualsurf', cpu: '0.4%', mem: '1.2%', cmd: 'dualsurf-security-daemon' },
      ],
    }),
    proxyGetRules: async () => [],
    proxySetRules: async () => true,
    proxyToggleBreakpoint: async () => true,
    proxyGetPendingIntercepts: async () => [],
    proxyForwardIntercept: async () => true,
    proxyDropIntercept: async () => true,
    proxyStartServer: async () => ({ success: true }),
    proxyStopServer: async () => true,
    proxyGetStatus: async () => ({
      running: true,
      port: 8080,
      host: '127.0.0.1',
      activeInterceptsCount: 0,
      rulesCount: 0,
    } as unknown as LocalProxyServerStatus),
    onInterceptPending: () => () => {},
  };

  (window as any).dualsurf = browserApi;
  (window as any).isBrowserMock = true;
}
