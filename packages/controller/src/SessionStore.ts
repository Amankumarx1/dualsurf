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

const DEFAULT_SETTINGS: BrowserSettings = {
  searchEngine: 'duckduckgo',
  homeUrl: 'https://duckduckgo.com',
  restoreSessionOnStartup: true,
  terminalTheme: 'dracula',
  defaultDownloadDir: path.join(os.homedir(), 'Downloads'),
};

export class SessionStore {
  private configDir: string;
  private sessionFilePath: string;

  constructor() {
    const home = os.homedir();
    this.configDir =
      process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'dualsurf')
        : path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'dualsurf');

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
        return {
          lastActiveTabId: data.lastActiveTabId || null,
          tabs: Array.isArray(data.tabs) ? data.tabs : [],
          settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
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
