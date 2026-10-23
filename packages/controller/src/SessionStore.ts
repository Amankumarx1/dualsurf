import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BrowserSettings, TabState } from '@dualsurf/shared-types';

export interface PersistedSession {
  lastActiveTabId: string | null;
  tabs: Array<{
    id: string;
    url: string;
    title: string;
    pinned?: boolean;
  }>;
  settings: BrowserSettings;
}

export const DEFAULT_SETTINGS: BrowserSettings = {
  searchEngine: 'google',
  homeUrl: 'dualsurf://newtab',
  restoreSessionOnStartup: false,
  terminalTheme: 'dracula',
  defaultDownloadDir: path.join(os.homedir(), 'Downloads'),
  ollama: {
    enabled: false,
    host: 'http://localhost:11434',
    model: 'llama3.2',
    onboardingCompleted: false,
    autoSummarize: false,
  },
  cyberShieldEnabled: true,
  tabLayout: 'horizontal',
  autoHibernateTabs: false,
  activeWorkspaceId: 'default',
  workspaces: [
    { id: 'default', name: 'General', color: '#ffffff', tabIds: [] },
    { id: 'recon', name: 'Recon & Security', color: '#ff0055', tabIds: [] },
    { id: 'dev', name: 'Development', color: '#00ff88', tabIds: [] },
  ],
  proxy: {
    mode: 'direct',
  },
  activeUserAgentId: 'default',
  antiFingerprintEnabled: false,
  themeMode: 'dark',
  uiDensity: 'comfortable',
  defaultShell: 'default',
  terminalDefaultWorkingDir: '',
  terminalRestoreSessions: false,
  terminalShowWelcome: true,
  terminalFontSize: 14,
  terminalFontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  terminalScrollback: 5000,
  scopeEnforcementStrict: true,
  autoClearDataOnExit: false,
  blockThirdPartyCookies: true,
  doNotTrack: true,
  evidenceAutoHash: true,
  defaultZoom: 100,
  workspaceSandboxDir: '',
  hasGrantedWorkspaceAccess: false,
};

export class SessionStore {
  private configDir: string;
  private sessionFilePath: string;

  constructor(customConfigDir?: string) {
    if (customConfigDir) {
      this.configDir = customConfigDir;
    } else {
      const home = os.homedir();
      this.configDir =
        process.platform === 'win32'
          ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'dualsurf')
          : path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'dualsurf');
    }

    this.sessionFilePath = path.join(this.configDir, 'session.json');
    this.ensureDirExists();
  }

  private ensureDirExists(): void {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
    } catch (err) {
      console.error('[SessionStore] Failed to create config dir:', err);
    }
  }

  public loadSession(): PersistedSession {
    try {
      if (fs.existsSync(this.sessionFilePath)) {
        const raw = fs.readFileSync(this.sessionFilePath, 'utf8');
        const data = JSON.parse(raw);
        const loadedSettings: BrowserSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
        if (!loadedSettings.homeUrl || loadedSettings.homeUrl.startsWith('http://') || loadedSettings.homeUrl.startsWith('https://') || loadedSettings.homeUrl === 'dualsurf:newtab') {
          loadedSettings.homeUrl = 'dualsurf://newtab';
        }

        // When restoreSessionOnStartup is false, always return clean dualsurf://newtab
        if (!loadedSettings.restoreSessionOnStartup) {
          return {
            lastActiveTabId: 'tab-default',
            tabs: [{
              id: 'tab-default',
              url: 'dualsurf://newtab',
              title: 'New Tab',
              pinned: false,
            }],
            settings: loadedSettings,
          };
        }

        let tabs = Array.isArray(data.tabs) ? data.tabs : [];
        if (tabs.length === 0 || (tabs.length === 1 && (tabs[0].url === 'https://duckduckgo.com' || tabs[0].url === 'dualsurf:newtab'))) {
          tabs = [{
            id: tabs[0]?.id || 'tab-default',
            url: 'dualsurf://newtab',
            title: 'New Tab',
            pinned: false,
          }];
        }

        return {
          lastActiveTabId: data.lastActiveTabId || null,
          tabs,
          settings: loadedSettings,
        };
      }
    } catch (err) {
      console.warn('[SessionStore] Could not read existing session file:', err);
    }

    return {
      lastActiveTabId: null,
      tabs: [],
      settings: DEFAULT_SETTINGS,
    };
  }

  public saveSession(tabs: TabState[], activeTabId: string | null, settings: BrowserSettings): void {
    try {
      this.ensureDirExists();
      const payload: PersistedSession = {
        lastActiveTabId: activeTabId,
        tabs: tabs.map(t => ({
          id: t.id,
          url: t.url,
          title: t.title,
          pinned: t.pinned,
        })),
        settings,
      };

      const tmpPath = `${this.sessionFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.sessionFilePath);
    } catch (err) {
      console.error('[SessionStore] Failed to save session:', err);
    }
  }
}
