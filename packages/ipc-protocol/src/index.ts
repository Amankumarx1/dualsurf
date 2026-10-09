import * as os from 'os';
import * as path from 'path';

export const PROTOCOL_VERSION = 1;

export interface IPCRequest<T = any> {
  protocolVersion: number;
  requestId: string;
  command: string;
  params?: T;
}

export interface IPCResponse<T = any> {
  protocolVersion: number;
  requestId: string;
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Returns the platform-appropriate local IPC communication endpoint:
 * - Linux: $XDG_RUNTIME_DIR/dualsurf.sock or /tmp/dualsurf-<uid>.sock
 * - macOS: /tmp/dualsurf-<uid>.sock
 * - Windows: \\.\pipe\dualsurf-<username>
 */
export function getIpcSocketPath(): string {
  if (process.platform === 'win32') {
    const user = process.env.USERNAME || 'default';
    return `\\\\.\\pipe\\dualsurf-${user}`;
  }

  if (process.env.XDG_RUNTIME_DIR) {
    return path.join(process.env.XDG_RUNTIME_DIR, 'dualsurf.sock');
  }

  const uid = typeof process.getuid === 'function' ? process.getuid() : 'default';
  return path.join(os.tmpdir(), `dualsurf-${uid}.sock`);
}

/**
 * Standard IPC command constants
 */
export const IPC_COMMANDS = {
  TABS_LIST: 'tabs.list',
  TABS_CREATE: 'tabs.create',
  TABS_CLOSE: 'tabs.close',
  TABS_SWITCH: 'tabs.switch',
  TABS_REOPEN: 'tabs.reopen',
  PAGE_NAVIGATE: 'page.navigate',
  PAGE_GET_METADATA: 'page.getMetadata',
  PAGE_CLICK_LINK: 'page.clickLink',
  NAV_BACK: 'nav.back',
  NAV_FORWARD: 'nav.forward',
  NAV_RELOAD: 'nav.reload',
  NAV_STOP: 'nav.stop',
  SETTINGS_GET: 'settings.get',
  SETTINGS_UPDATE: 'settings.update',
  BOOKMARKS_LIST: 'bookmarks.list',
  BOOKMARKS_ADD: 'bookmarks.add',
  BOOKMARKS_REMOVE: 'bookmarks.remove',
  HISTORY_LIST: 'history.list',
  HISTORY_SEARCH: 'history.search',
  HISTORY_CLEAR: 'history.clear',
  DOWNLOADS_LIST: 'downloads.list',
  PING: 'system.ping',
} as const;

export type IpcCommandType = (typeof IPC_COMMANDS)[keyof typeof IPC_COMMANDS];
