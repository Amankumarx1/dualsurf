import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import { BrowserController, IpcServer } from '@dualsurf/controller';

// Set application name before any ready events to ensure dedicated %APPDATA%\DualSurf cache isolation
app.name = 'DualSurf';

// Performance & Memory Optimization:
// Cap V8 heap to prevent memory bloat and enforce background throttling
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch('disable-background-timer-throttling', 'false');
app.commandLine.appendSwitch('disable-renderer-backgrounding', 'false');

let ptyModule: any = null;
try {
  ptyModule = require('node-pty');
} catch (e: any) {
  console.warn('[Main] node-pty not available, will use process fallback:', e.message);
}

const activePtys = new Map<string, any>();
const activePtyMeta = new Map<string, { shellExe: string; cwd?: string }>();

import type {
  BrowserSettings,
  SystemInfo,
  TabId,
  ClearBrowsingDataOptions,
} from '@dualsurf/shared-types';

function findRepoRoot(startDir: string): string {
  let cur = startDir;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(cur, 'apps', 'cli', 'dist', 'index.js'))) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

function getCliToolsDir(): string {
  // 1. Packaged extraResources directory
  if (app.isPackaged) {
    const fromResources = path.join(process.resourcesPath, 'cli-tools');
    if (fs.existsSync(fromResources)) return fromResources;
    const fromAsar = path.join(__dirname, '..', 'cli-tools');
    if (fs.existsSync(fromAsar)) return fromAsar;
  }
  // 2. Relative to compiled main.js in dist/electron
  const fromDist = path.resolve(__dirname, '../../../cli/dist/tools');
  if (fs.existsSync(fromDist)) return fromDist;

  // 3. Search upward from appPath or cwd
  const repoRoot = findRepoRoot(app.getAppPath() || process.cwd());
  return path.join(repoRoot, 'apps', 'cli', 'dist', 'tools');
}

interface ResolvedShell {
  type: 'bash' | 'powershell' | 'cmd';
  name: string;
  path: string;
  getArgs: (cmd: string) => string[];
}

function resolveHostShell(preferred?: string): ResolvedShell {
  if (process.platform === 'win32') {
    const gitBashCandidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
      path.join(process.env.ProgramFiles || '', 'Git', 'bin', 'bash.exe'),
    ];
    const findGitBash = (): ResolvedShell | null => {
      for (const cand of gitBashCandidates) {
        if (fs.existsSync(cand)) {
          return {
            type: 'bash',
            name: 'GNU Bash (Git Bash)',
            path: cand,
            getArgs: (cmd) => ['-c', cmd],
          };
        }
      }
      return null;
    };

    const psCandidates = [
      path.join(process.env.ProgramFiles || '', 'PowerShell', '7', 'pwsh.exe'),
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ];
    const findPowerShell = (): ResolvedShell | null => {
      for (const psPath of psCandidates) {
        if (fs.existsSync(psPath)) {
          const isCore = psPath.toLowerCase().includes('pwsh');
          return {
            type: 'powershell',
            name: isCore ? 'PowerShell 7 (pwsh)' : 'Windows PowerShell 5.1',
            path: psPath,
            getArgs: (cmd) => ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
          };
        }
      }
      return null;
    };

    const getCmdPrompt = (): ResolvedShell => {
      const cmdPath = process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
      return {
        type: 'cmd',
        name: 'Windows Command Prompt (cmd.exe)',
        path: cmdPath,
        getArgs: (cmd) => ['/d', '/s', '/c', cmd],
      };
    };

    if (preferred === 'bash') {
      const gb = findGitBash();
      if (gb) return gb;
    } else if (preferred === 'cmd') {
      return getCmdPrompt();
    } else if (preferred === 'powershell') {
      const ps = findPowerShell();
      if (ps) return ps;
    }

    // Default on Windows: PowerShell first, then Git Bash, then Command Prompt
    const ps = findPowerShell();
    if (ps) return ps;
    const gb = findGitBash();
    if (gb) return gb;
    return getCmdPrompt();
  }

  // Linux or macOS
  const userShell = process.env.SHELL || '/bin/bash';
  const shellBase = path.basename(userShell);
  return {
    type: 'bash',
    name: shellBase || 'bash',
    path: userShell,
    getArgs: (cmd) => ['-c', cmd],
  };
}

function confineToSandbox(targetPath: string | undefined, sandboxDir: string | undefined): string {
  if (!sandboxDir || typeof sandboxDir !== 'string' || !sandboxDir.trim()) {
    return targetPath || os.homedir();
  }
  const cleanSandbox = path.resolve(sandboxDir.trim());
  if (!targetPath || typeof targetPath !== 'string' || !targetPath.trim() || targetPath === '~' || targetPath === '$HOME' || targetPath === '/') {
    return cleanSandbox;
  }
  let resolvedTarget = targetPath.trim();
  if (resolvedTarget.startsWith('~/') || resolvedTarget.startsWith('~\\')) {
    resolvedTarget = path.join(cleanSandbox, resolvedTarget.slice(2));
  } else if (!path.isAbsolute(resolvedTarget)) {
    resolvedTarget = path.resolve(cleanSandbox, resolvedTarget);
  } else {
    resolvedTarget = path.resolve(resolvedTarget);
  }

  const rel = path.relative(cleanSandbox, resolvedTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return cleanSandbox;
  }
  return resolvedTarget;
}

function resolveTerminalWorkingDir(requestedCwd?: string, userDefaultDir?: string, sandboxDir?: string): string {
  // If sandboxDir is provided and active, all paths are rooted and confined to sandboxDir
  if (sandboxDir && typeof sandboxDir === 'string' && sandboxDir.trim()) {
    let cleanSandbox = sandboxDir.trim();
    if (cleanSandbox === '~' || cleanSandbox === '$HOME') {
      cleanSandbox = os.homedir();
    } else if (cleanSandbox.startsWith('~/') || cleanSandbox.startsWith('~\\')) {
      cleanSandbox = path.join(os.homedir(), cleanSandbox.slice(2));
    } else {
      cleanSandbox = path.resolve(cleanSandbox);
    }
    if (fs.existsSync(cleanSandbox)) {
      if (!requestedCwd || requestedCwd === '~' || requestedCwd === '$HOME' || requestedCwd === '/') {
        return cleanSandbox;
      }
      return confineToSandbox(requestedCwd, cleanSandbox);
    }
  }

  // 1. Explicit requested cwd
  if (requestedCwd && typeof requestedCwd === 'string') {
    let clean = requestedCwd.trim();
    if (clean === '~' || clean === '$HOME' || clean === '%USERPROFILE%') {
      return os.homedir();
    }
    if (clean.startsWith('~/') || clean.startsWith('~\\')) {
      clean = path.join(os.homedir(), clean.slice(2));
    }
    if (path.isAbsolute(clean) && fs.existsSync(clean)) {
      try {
        const stat = fs.statSync(clean);
        if (stat.isDirectory()) return clean;
      } catch {}
    }
  }

  // 2. Configured user default working directory
  if (userDefaultDir && typeof userDefaultDir === 'string') {
    let clean = userDefaultDir.trim();
    if (clean.startsWith('~/') || clean.startsWith('~\\')) {
      clean = path.join(os.homedir(), clean.slice(2));
    }
    if (path.isAbsolute(clean) && fs.existsSync(clean)) {
      try {
        const stat = fs.statSync(clean);
        if (stat.isDirectory()) return clean;
      } catch {}
    }
  }

  // 3. Fallback to user's home directory (NEVER repository root or development path!)
  return os.homedir();
}

let mainWindow: BrowserWindow | null = null;
let controller: BrowserController | null = null;
let ipcServer: IpcServer | null = null;
let topBarHeight = 84;

const isHeadless = process.argv.includes('--headless');

process.on('uncaughtException', (err) => {
  console.warn('[Main] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Main] Unhandled Rejection:', reason);
});

async function createWindow() {
  const iconCandidates = [
    path.join(__dirname, '../../build/icon.png'),
    path.join(__dirname, '../public/icon.png'),
    path.join(process.resourcesPath || '', 'icon.png'),
  ];
  let resolvedIcon: string | undefined;
  for (const c of iconCandidates) {
    if (fs.existsSync(c)) {
      resolvedIcon = c;
      break;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 500,
    show: !isHeadless,
    title: 'DualSurf',
    icon: resolvedIcon,
    backgroundColor: '#000000',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });

  // Track window maximize / restore state
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:windowMaximized', true);
      mainWindow.webContents.send('dualsurf:windowResized');
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:windowMaximized', false);
      mainWindow.webContents.send('dualsurf:windowResized');
    }
  });

  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:windowResized');
    }
  });

  // Security: Restrict popup creation and external navigation in trusted GUI window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (controller && url && url !== 'about:blank') {
      controller.createTab(url, true);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const isDevServer = Boolean(process.env.VITE_DEV_SERVER_URL && navigationUrl.startsWith(process.env.VITE_DEV_SERVER_URL));
    const isLocalFile = navigationUrl.startsWith('file://');
    if (!isDevServer && !isLocalFile) {
      event.preventDefault();
      if (controller) {
        controller.createTab(navigationUrl, true);
      }
    }
  });

  // Initialize shared controller if not already created
  if (!controller) {
    controller = new BrowserController();
  }
  controller.attachWindow(mainWindow);
  controller.attachSession(session.defaultSession);
  controller.setContentBounds({ y: topBarHeight });

  // Security Hardening: Strict Permission Handlers for all WebContents & Tab Views
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const url = details.requestingUrl || (webContents && !webContents.isDestroyed() ? webContents.getURL() : '');
    const isLocalApp =
      url.startsWith('file://') ||
      Boolean(process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)) ||
      url.startsWith('http://localhost:');

    // Trusted local GUI window permissions
    if (isLocalApp) {
      const trustedAllowed = new Set([
        'fullscreen',
        'clipboard-read',
        'clipboard-sanitized-write',
        'notifications',
      ]);
      return callback(trustedAllowed.has(permission));
    }

    // Untrusted external web content permissions:
    // Only allow benign UI features (fullscreen for videos, pointerLock for canvas/games, sanitized clipboard write)
    const untrustedAllowed = new Set([
      'fullscreen',
      'pointerLock',
      'clipboard-sanitized-write',
    ]);

    // Explicitly deny dangerous capabilities: camera, microphone, geolocation, notifications, openExternal, midi, sensors
    return callback(untrustedAllowed.has(permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const isLocalApp =
      requestingOrigin.startsWith('file://') ||
      requestingOrigin.includes('localhost:') ||
      requestingOrigin.includes('127.0.0.1:');

    if (isLocalApp) {
      const trustedAllowed = new Set([
        'fullscreen',
        'clipboard-read',
        'clipboard-sanitized-write',
        'notifications',
      ]);
      return trustedAllowed.has(permission);
    }

    const untrustedAllowed = new Set([
      'fullscreen',
      'pointerLock',
      'clipboard-sanitized-write',
    ]);
    return untrustedAllowed.has(permission);
  });

  // Start local socket IPC Server for CLI & TUI communication
  if (!ipcServer) {
    ipcServer = new IpcServer(controller);
    ipcServer.on('system:show-gui', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
    ipcServer.on('system:quit', () => {
      if (ipcServer) {
        ipcServer.stop().finally(() => app.quit());
      } else {
        app.quit();
      }
    });
    ipcServer.start().catch((err) => {
      console.warn('[Main] IPC Server failed to start:', err.message);
    });
  }

  // Forward controller events to GUI renderer
  controller.on('state:changed', (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:stateChanged', state);
    }
  });

  controller.on('tab:updated', (tab) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:tabUpdated', tab);
    }
  });

  // Setup IPC Handlers
  setupIpcHandlers(controller);

  // Initialize controller tabs
  controller.initialize(mainWindow);

  // Load GUI renderer with resilient dev server connection
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : undefined);
  if (devServerUrl) {
    let connected = false;
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        await mainWindow.loadURL(devServerUrl);
        connected = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    if (!connected) {
      const indexPath = path.join(__dirname, '../renderer/index.html');
      if (fs.existsSync(indexPath)) {
        await mainWindow.loadFile(indexPath);
      }
    }
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    console.log('[Main] Graphical window closed.');
    if (process.env.NODE_ENV === 'development' || process.platform === 'win32') {
      if (ipcServer) {
        ipcServer.stop().finally(() => app.quit());
      } else {
        app.quit();
      }
    }
  });
}

function isTrustedSender(event: Electron.IpcMainInvokeEvent): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return true;
  return event.sender.id === mainWindow.webContents.id;
}

function setupIpcHandlers(ctrl: BrowserController) {
  ipcMain.handle('dualsurf:getState', () => {
    return ctrl.getState();
  });

  ipcMain.handle('dualsurf:createTab', (_event, url?: string, activate: boolean = true) => {
    const safeUrl = typeof url === 'string' ? url : undefined;
    return ctrl.createTab(safeUrl, Boolean(activate));
  });

  ipcMain.handle('dualsurf:closeTab', (_event, tabId: TabId) => {
    if (!tabId || typeof tabId !== 'string') return false;
    return ctrl.closeTab(tabId);
  });

  ipcMain.handle('dualsurf:activateTab', (_event, tabId: TabId) => {
    if (!tabId || typeof tabId !== 'string') return false;
    return ctrl.activateTab(tabId);
  });

  ipcMain.handle('dualsurf:navigate', (_event, tabId: TabId | undefined, urlOrQuery: string) => {
    if (typeof urlOrQuery !== 'string') return false;
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.navigate(safeTabId, urlOrQuery);
  });

  ipcMain.handle('dualsurf:goBack', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.goBack(safeTabId);
  });

  ipcMain.handle('dualsurf:goForward', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.goForward(safeTabId);
  });

  ipcMain.handle('dualsurf:reload', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.reload(safeTabId);
  });

  ipcMain.handle('dualsurf:stop', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.stop(safeTabId);
  });

  ipcMain.handle('dualsurf:reopenClosedTab', () => {
    return ctrl.reopenClosedTab();
  });

  ipcMain.handle('dualsurf:duplicateTab', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : (ctrl.getState().activeTabId || '');
    return safeTabId ? ctrl.duplicateTab(safeTabId) : null;
  });

  ipcMain.handle('dualsurf:togglePinTab', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : (ctrl.getState().activeTabId || '');
    return safeTabId ? ctrl.togglePinTab(safeTabId) : false;
  });

  ipcMain.handle('dualsurf:toggleMuteTab', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : (ctrl.getState().activeTabId || '');
    return safeTabId ? ctrl.toggleMuteTab(safeTabId) : false;
  });

  ipcMain.handle('dualsurf:setSplitTab', (_event, tabId: TabId | null) => {
    return ctrl.setSplitTab(tabId);
  });

  ipcMain.handle('dualsurf:getReaderArticle', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.getReaderArticle(safeTabId);
  });

  ipcMain.handle('dualsurf:getPageSecurityInfo', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.getPageSecurityInfo(safeTabId);
  });

  ipcMain.handle('dualsurf:closeOtherTabs', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : (ctrl.getState().activeTabId || '');
    return safeTabId ? ctrl.closeOtherTabs(safeTabId) : false;
  });

  ipcMain.handle('dualsurf:closeTabsToTheRight', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : (ctrl.getState().activeTabId || '');
    return safeTabId ? ctrl.closeTabsToTheRight(safeTabId) : false;
  });

  ipcMain.handle('dualsurf:setZoom', (_event, tabId: TabId | undefined, factor: number) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    const safeFactor = typeof factor === 'number' && Number.isFinite(factor) ? factor : 1.0;
    return ctrl.setZoom(safeTabId, safeFactor);
  });

  ipcMain.handle('dualsurf:getZoom', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.getZoom(safeTabId);
  });

  ipcMain.handle('dualsurf:toggleDevTools', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.toggleDevTools(safeTabId);
  });

  ipcMain.handle('dualsurf:toggleFullScreen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const isFull = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!isFull);
      return !isFull;
    }
    return false;
  });

  ipcMain.handle('dualsurf:openDownloadsFolder', async () => {
    const settings = ctrl.getSettings();
    const downloadDir = settings.defaultDownloadDir || path.join(os.homedir(), 'Downloads');
    if (!fs.existsSync(downloadDir)) {
      try {
        fs.mkdirSync(downloadDir, { recursive: true });
      } catch {
        // Ignored
      }
    }
    await shell.openPath(downloadDir);
    return true;
  });

  ipcMain.handle('dualsurf:getPageMetadata', (_event, tabId?: TabId) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    return ctrl.getPageMetadata(safeTabId);
  });

  ipcMain.handle('dualsurf:clickNumberedLink', (_event, tabId: TabId | undefined, linkId: number) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    const num = parseInt(String(linkId), 10);
    if (!Number.isFinite(num) || num < 1) return false;
    return ctrl.clickNumberedLink(safeTabId, num);
  });

  ipcMain.handle('dualsurf:getSettings', () => {
    return ctrl.getSettings();
  });

  ipcMain.handle('dualsurf:updateSettings', (_event, partial: Partial<BrowserSettings>) => {
    if (!partial || typeof partial !== 'object') return ctrl.getSettings();
    return ctrl.updateSettings(partial);
  });

  ipcMain.handle('dualsurf:resetSettings', (event) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized sender');
    return ctrl.resetSettings();
  });

  ipcMain.handle('dualsurf:selectDownloadFolder', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized sender');
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win || mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Default Downloads Location',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selected = result.filePaths[0];
      ctrl.updateSettings({ defaultDownloadDir: selected });
      return { success: true, path: selected };
    }
    return { success: false, path: ctrl.getSettings().defaultDownloadDir };
  });

  ipcMain.handle('dualsurf:selectFolder', async (event, title?: string) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized sender');
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win || mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: title || 'Select Terminal Directory',
      defaultPath: os.homedir(),
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false };
  });

  ipcMain.handle('dualsurf:getWorkspaceSandboxDir', async () => {
    const settings = ctrl.getSettings();
    return {
      path: settings.workspaceSandboxDir || '',
      hasGranted: !!settings.hasGrantedWorkspaceAccess,
    };
  });

  ipcMain.handle('dualsurf:setWorkspaceSandboxDir', async (_event, sandboxPath: string) => {
    try {
      let trimmed = sandboxPath.trim();
      let cleanPath: string;
      if (trimmed === '~' || trimmed === '$HOME') {
        cleanPath = os.homedir();
      } else if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
        cleanPath = path.join(os.homedir(), trimmed.slice(2));
      } else {
        cleanPath = path.resolve(trimmed);
      }
      if (!fs.existsSync(cleanPath)) {
        await fs.promises.mkdir(cleanPath, { recursive: true });
      }
      ctrl.updateSettings({
        workspaceSandboxDir: cleanPath,
        hasGrantedWorkspaceAccess: true,
        terminalDefaultWorkingDir: cleanPath,
      });
      return { success: true, path: cleanPath };
    } catch (err: any) {
      return { success: false, path: sandboxPath, error: err.message };
    }
  });

  ipcMain.handle('dualsurf:getPlatformDiagnostics', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized sender');
    const mem = process.memoryUsage();
    return {
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      v8Version: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      hostname: os.hostname(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round(mem.rss / (1024 * 1024)),
      memoryHeapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      memoryHeapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
      userDataPath: app.getPath('userData'),
      downloadsPath: ctrl.getSettings().defaultDownloadDir,
    };
  });

  ipcMain.handle('dualsurf:getBookmarks', () => {
    return ctrl.getBookmarks();
  });

  ipcMain.handle('dualsurf:addBookmark', (_event, url: string, title?: string) => {
    if (!url || typeof url !== 'string') return null;
    return ctrl.addBookmark(url, typeof title === 'string' ? title : undefined);
  });

  ipcMain.handle('dualsurf:removeBookmark', (_event, id: string) => {
    if (!id || typeof id !== 'string') return false;
    return ctrl.removeBookmark(id);
  });

  ipcMain.handle('dualsurf:getHistory', (_event, limit?: number) => {
    const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, limit) : 50;
    return ctrl.getHistory(safeLimit);
  });

  ipcMain.handle('dualsurf:clearHistory', (_event, sinceTimestamp?: number) => {
    return ctrl.clearHistory(typeof sinceTimestamp === 'number' ? sinceTimestamp : undefined);
  });

  ipcMain.handle('dualsurf:clearBrowsingData', async (_event, options?: ClearBrowsingDataOptions) => {
    const opts = options || {};
    const timeRangeMs = typeof opts.timeRangeMs === 'number' ? opts.timeRangeMs : 0;
    const sinceTimestamp = timeRangeMs > 0 ? Date.now() - timeRangeMs : 0;

    if (opts.history !== false) {
      ctrl.clearHistory(sinceTimestamp);
    }

    try {
      const sess = session.defaultSession;
      if (sess) {
        const storages: string[] = [];
        if (opts.cookies !== false) storages.push('cookies');
        if (opts.storage !== false) storages.push('localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage');

        if (storages.length > 0) {
          await sess.clearStorageData({
            storages: storages as any,
          });
        }
        if (opts.cache !== false) {
          await sess.clearCache();
        }
      }
    } catch (err) {
      console.warn('[Main] clearBrowsingData storage warning:', err);
    }
    return true;
  });

  ipcMain.handle('dualsurf:getDownloads', (_event, limit?: number) => {
    const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, limit) : 50;
    return ctrl.getDownloads(safeLimit);
  });

  ipcMain.handle('dualsurf:setTopBarHeight', (_event, height: number) => {
    const safeHeight = typeof height === 'number' && Number.isFinite(height) ? Math.max(0, Math.min(height, 500)) : 84;
    topBarHeight = safeHeight;
    ctrl.setContentBounds({ y: safeHeight });
  });

  ipcMain.handle('dualsurf:setTerminalMode', (_event, isTerminal: boolean) => {
    ctrl.setViewsVisible(!Boolean(isTerminal));
    return true;
  });

  ipcMain.handle('dualsurf:setViewsVisible', (_event, visible: boolean) => {
    ctrl.setViewsVisible(Boolean(visible));
    return true;
  });

  ipcMain.handle('dualsurf:captureActivePage', async () => {
    return ctrl.captureActivePage();
  });

  ipcMain.handle('dualsurf:findInPage', (_event, tabId: TabId | undefined, query: string) => {
    const safeTabId = typeof tabId === 'string' ? tabId : undefined;
    const safeQuery = typeof query === 'string' ? query : '';
    return ctrl.findInPage(safeTabId, safeQuery);
  });

  ipcMain.handle('dualsurf:minimizeWindow', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('dualsurf:maximizeWindow', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('dualsurf:closeWindow', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  ipcMain.handle('dualsurf:isMaximized', () => {
    return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
  });

  ipcMain.handle('dualsurf:getSystemInfo', (): SystemInfo => {
    const hostShell = resolveHostShell(ctrl?.getSettings?.()?.defaultShell);
    const isWindows = process.platform === 'win32';
    const osName = isWindows
      ? `Windows 11 (${os.release()})`
      : (process.platform === 'darwin' ? `macOS ${os.release()}` : `Linux ${os.release()}`);
    return {
      platform: process.platform as 'win32' | 'linux' | 'darwin',
      osName,
      osRelease: os.release(),
      shellType: hostShell.type,
      shellName: hostShell.name,
      shellPath: hostShell.path,
      username: os.userInfo?.().username || process.env.USERNAME || process.env.USER || 'user',
      hostname: os.hostname(),
      cwd: os.homedir(),
    };
  });

  ipcMain.handle('dualsurf:listFiles', async (_event, targetDir?: string) => {
    try {
      const settings = ctrl.getSettings();
      let sandboxRoot: string | null = null;
      if (settings.hasGrantedWorkspaceAccess && settings.workspaceSandboxDir) {
        const raw = settings.workspaceSandboxDir.trim();
        if (raw === '~' || raw === '$HOME') {
          sandboxRoot = os.homedir();
        } else if (raw.startsWith('~/') || raw.startsWith('~\\')) {
          sandboxRoot = path.join(os.homedir(), raw.slice(2));
        } else {
          sandboxRoot = path.resolve(raw);
        }
      }

      let baseRoot = sandboxRoot || os.homedir();
      let resolvedDir = targetDir ? targetDir.trim() : baseRoot;

      if (sandboxRoot) {
        resolvedDir = confineToSandbox(resolvedDir, sandboxRoot);
      } else {
        if (resolvedDir.startsWith('~/') || resolvedDir === '~') {
          resolvedDir = path.join(os.homedir(), resolvedDir.slice(1));
        }
        if (!path.isAbsolute(resolvedDir)) {
          resolvedDir = path.resolve(os.homedir(), resolvedDir);
        }
      }

      if (!fs.existsSync(resolvedDir)) {
        resolvedDir = baseRoot;
      }

      const entries = await fs.promises.readdir(resolvedDir, { withFileTypes: true });
      const parentDir = path.dirname(resolvedDir);

      const items: { name: string; isDir: boolean; modified: string; size?: number }[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '..') continue;
        try {
          const fullPath = path.join(resolvedDir, entry.name);
          const stat = await fs.promises.stat(fullPath);
          const d = new Date(stat.mtime);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = months[d.getMonth()];
          const day = d.getDate();
          const hours = String(d.getHours()).padStart(2, '0');
          const mins = String(d.getMinutes()).padStart(2, '0');
          const modified = `${month} ${day} ${hours}:${mins}`;

          items.push({
            name: entry.name,
            isDir: entry.isDirectory(),
            modified,
            size: stat.size,
          });
        } catch {
          items.push({
            name: entry.name,
            isDir: entry.isDirectory(),
            modified: '—',
          });
        }
      }

      items.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });

      let displayPath = '';
      let parentPath: string | null = null;
      if (sandboxRoot) {
        const isAtSandboxRoot = path.resolve(resolvedDir).toLowerCase() === sandboxRoot.toLowerCase();
        if (isAtSandboxRoot) {
          displayPath = '~/';
          parentPath = null; // Strictly cannot navigate beyond sandbox root!
        } else {
          const rel = path.relative(sandboxRoot, resolvedDir).replace(/\\/g, '/');
          displayPath = '~/' + rel;
          const relParent = path.relative(sandboxRoot, parentDir);
          if (!relParent.startsWith('..') && !path.isAbsolute(relParent)) {
            parentPath = parentDir;
          } else {
            parentPath = null;
          }
        }
      } else {
        displayPath = resolvedDir === os.homedir()
          ? '~/'
          : (resolvedDir.startsWith(os.homedir())
            ? '~/' + path.relative(os.homedir(), resolvedDir).replace(/\\/g, '/')
            : resolvedDir.replace(/\\/g, '/'));
        parentPath = parentDir !== resolvedDir ? parentDir : null;
      }

      return {
        success: true,
        currentPath: displayPath,
        rawPath: resolvedDir,
        parentPath,
        files: items.slice(0, 50),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        currentPath: '~/',
        files: [],
      };
    }
  });

  ipcMain.handle('dualsurf:getStorageInfo', async () => {
    try {
      const checkPath = process.cwd();
      const stats = await fs.promises.statfs(checkPath);
      const freeBytes = stats.bavail * stats.bsize;
      const totalBytes = stats.blocks * stats.bsize;
      const freeGb = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
      return {
        success: true,
        freeBytes,
        totalBytes,
        freeFormatted: `${freeGb} GB Free`,
      };
    } catch {
      return {
        success: true,
        freeBytes: 0,
        totalBytes: 0,
        freeFormatted: 'Measured',
      };
    }
  });

  ipcMain.handle('dualsurf:openDevTools', async (_event, tabId?: string) => {
    try {
      return ctrl.toggleDevTools(tabId);
    } catch {
      return false;
    }
  });

  ipcMain.handle('dualsurf:executeCommand', async (event, command: string) => {
    if (!isTrustedSender(event)) {
      return { stdout: '', stderr: 'Unauthorized IPC invocation: executeCommand is restricted to trusted DualSurf UI.', exitCode: 1 };
    }
    if (!command || typeof command !== 'string') {
      return { stdout: '', stderr: 'Invalid command input', exitCode: 1 };
    }

    const hostShell = resolveHostShell();
    const repoRoot = findRepoRoot(process.cwd());
    const cliEntry = path.join(repoRoot, 'apps', 'cli', 'dist', 'index.js');

    let effectiveCommand = command.trim();
    const firstToken = effectiveCommand.split(/\s+/)[0].toLowerCase();
    if (fs.existsSync(cliEntry)) {
      if (effectiveCommand.startsWith('dualsurf ') || effectiveCommand === 'dualsurf') {
        const restArgs = effectiveCommand.slice('dualsurf'.length).trim();
        effectiveCommand = `node "${cliEntry}" ${restArgs}`.trim();
      } else if (effectiveCommand.startsWith('ds ') || effectiveCommand === 'ds') {
        const restArgs = effectiveCommand.slice(2).trim();
        effectiveCommand = `node "${cliEntry}" ds ${restArgs}`.trim();
      }
    }

    const standardDirs = process.platform === 'win32' ? [
      'C:\\Program Files\\Wireshark',
      'C:\\Program Files (x86)\\Wireshark',
      'C:\\Program Files (x86)\\Nmap',
      'C:\\Program Files\\Nmap',
      'C:\\Program Files\\Masscan',
      'C:\\masscan',
      'C:\\tools\\nc',
      'C:\\tools\\ncat',
      'C:\\tools\\nmap',
      'C:\\tools\\wireshark',
    ].filter((p) => fs.existsSync(p)) : ['/usr/local/bin', '/opt/homebrew/bin'];

    const augmentedPath = process.platform === 'win32'
      ? [...standardDirs, process.env.PATH || ''].filter(Boolean).join(';')
      : [process.env.PATH || '', ...standardDirs].filter(Boolean).join(':');

    const shellArgs = hostShell.getArgs(effectiveCommand);

    return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      let stdout = '';
      let stderr = '';
      const child = spawn(hostShell.path, shellArgs, {
        cwd: repoRoot,
        env: { ...process.env, PAGER: 'cat', TERM: 'xterm-256color' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
      }, 30000);

      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ stdout, stderr: err.message, exitCode: 1 });
      });
    });
  });

  // Dynamic Content Bounds for Vertical Tabs
  ipcMain.handle('dualsurf:setContentBounds', (_event, bounds: { x?: number; y?: number; width?: number; height?: number }) => {
    ctrl.setContentBounds(bounds);
    return true;
  });

  // Simple Native PTY Terminal Handlers
  ipcMain.handle('dualsurf:ptyCreate', async (event, sessionId: string, _runtimeId?: string, options?: { cols?: number; rows?: number; cwd?: string }) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized sender');
    const cols = options?.cols || 80;
    const rows = options?.rows || 24;
    const cwd = options?.cwd && fs.existsSync(options.cwd) ? options.cwd : os.homedir();

    if (activePtys.has(sessionId)) {
      const meta = activePtyMeta.get(sessionId);
      return {
        success: true,
        sessionId,
        shell: meta?.shellExe,
        cwd: meta?.cwd || cwd,
        isReattached: true,
      };
    }

    const hostShell = resolveHostShell();
    const shellExe = hostShell.path;
    const shellArgs: string[] = [];

    if (hostShell.type === 'powershell') {
      shellArgs.push('-NoLogo');
    }

    const env: any = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    };

    try {
      if (ptyModule) {
        const ptyProcess = ptyModule.spawn(shellExe, shellArgs, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env,
        });

        activePtys.set(sessionId, ptyProcess);
        activePtyMeta.set(sessionId, { shellExe, cwd });

        ptyProcess.onData((data: string) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`dualsurf:ptyData:${sessionId}`, data);
          }
        });

        ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
          activePtys.delete(sessionId);
          activePtyMeta.delete(sessionId);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`dualsurf:ptyExit:${sessionId}`, exitCode);
          }
        });

        return {
          success: true,
          sessionId,
          shell: hostShell.name,
          cwd,
        };
      } else {
        const child = spawn(shellExe, shellArgs, {
          cwd,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
        });

        const fallbackPty = {
          write: (data: string) => {
            child.stdin?.write(data);
          },
          resize: () => {},
          kill: () => {
            child.kill();
          },
        };

        activePtys.set(sessionId, fallbackPty);
        activePtyMeta.set(sessionId, { shellExe, cwd });

        child.stdout?.on('data', (d: Buffer) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`dualsurf:ptyData:${sessionId}`, d.toString('utf8'));
          }
        });

        child.stderr?.on('data', (d: Buffer) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`dualsurf:ptyData:${sessionId}`, d.toString('utf8'));
          }
        });

        child.on('exit', (code: number) => {
          activePtys.delete(sessionId);
          activePtyMeta.delete(sessionId);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`dualsurf:ptyExit:${sessionId}`, code ?? 0);
          }
        });

        return {
          success: true,
          sessionId,
          shell: hostShell.name,
          cwd,
        };
      }
    } catch (err: any) {
      console.error('[Main] ptyCreate error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dualsurf:ptyWrite', (_event, sessionId: string, data: string) => {
    const p = activePtys.get(sessionId);
    if (p && typeof p.write === 'function') {
      p.write(data);
      return true;
    }
    return false;
  });

  ipcMain.handle('dualsurf:ptyResize', (_event, sessionId: string, cols: number, rows: number) => {
    const p = activePtys.get(sessionId);
    if (p && typeof p.resize === 'function') {
      try {
        p.resize(cols, rows);
        return true;
      } catch {}
    }
    return false;
  });

  ipcMain.handle('dualsurf:ptyKill', (_event, sessionId: string) => {
    const p = activePtys.get(sessionId);
    if (p && typeof p.kill === 'function') {
      try {
        p.kill();
      } catch {}
      activePtys.delete(sessionId);
      activePtyMeta.delete(sessionId);
      return true;
    }
    return false;
  });

  ipcMain.handle('dualsurf:ptyInterrupt', (_event, sessionId: string) => {
    const p = activePtys.get(sessionId);
    if (p && typeof p.write === 'function') {
      p.write('\x03');
      return true;
    }
    return false;
  });
}

// App lifecycle & Single-Instance Lock protection
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Main] Another DualSurf instance is already running. Focusing existing window and exiting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  for (const [sessionId, pty] of activePtys.entries()) {
    try {
      if (typeof pty.kill === 'function') pty.kill();
    } catch {}
  }
  activePtys.clear();
  activePtyMeta.clear();

  if (ipcServer) {
    ipcServer.stop().finally(() => app.quit());
  } else {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
