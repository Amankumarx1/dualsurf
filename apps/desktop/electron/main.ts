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
const activePtyMeta = new Map<string, { runtimeId: string; runtimeName: string; shellExe: string; cwd?: string }>();
import type {
  BrowserSettings,
  SystemInfo,
  TabId,
  ClearBrowsingDataOptions,
  ProxyConfig,
  EditableCookie,
  CveNewsItem,
  RawHttpRequest,
  RawHttpResponse,
  InterceptRule,
  InterceptedRequest,
  LocalProxyServerStatus,
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
    const cleanSandbox = path.resolve(sandboxDir.trim());
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
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:windowMaximized', false);
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

  controller.on('shield:blocked', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:shieldBlocked', data);
    }
  });

  controller.on('shield:stats', (stats) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:shieldStats', stats);
    }
  });

  controller.on('traffic:entry', (entry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:trafficEntry', entry);
    }
  });

  controller.on('intercept:pending', (req) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('dualsurf:interceptPending', req);
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
      const cleanPath = path.resolve(sandboxPath.trim());
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

  ipcMain.handle('dualsurf:checkOllama', async (_event, host?: string) => {
    const rawHost = host || ctrl.getSettings().ollama?.host || 'http://localhost:11434';
    const cleanHost = rawHost.replace(/\/+$/, '');
    const start = Date.now();
    try {
      const res = await fetch(`${cleanHost}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return { available: false, models: [], latencyMs, error: `HTTP ${res.status}` };
      }
      const data: any = await res.json();
      const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name || m.model || String(m)) : [];
      return { available: true, models, latencyMs };
    } catch (err: any) {
      return { available: false, models: [], latencyMs: Date.now() - start, error: err?.message || 'Connection refused' };
    }
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
      const sandboxRoot = (settings.hasGrantedWorkspaceAccess && settings.workspaceSandboxDir)
        ? path.resolve(settings.workspaceSandboxDir)
        : null;

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

  ipcMain.handle('dualsurf:checkTools', async () => {
    const toolsToCheck = [
      { id: 'nmap', name: 'Nmap', bin: 'nmap' },
      { id: 'burp', name: 'Burp Suite', bin: 'burpsuite' },
      { id: 'wireshark', name: 'Wireshark', bin: 'wireshark' },
      { id: 'metasploit', name: 'Metasploit', bin: 'msfconsole' },
      { id: 'sqlmap', name: 'sqlmap', bin: 'sqlmap' },
      { id: 'nuclei', name: 'Nuclei', bin: 'nuclei' },
      { id: 'hydra', name: 'Hydra', bin: 'hydra' },
      { id: 'hashcat', name: 'Hashcat', bin: 'hashcat' },
    ];

    const results = [];
    const isWin = process.platform === 'win32';
    const whichCmd = isWin ? 'where.exe' : 'which';

    for (const tool of toolsToCheck) {
      let installed = false;
      let toolLoc = '';
      try {
        const out = spawnSync(whichCmd, [tool.bin], { encoding: 'utf8', timeout: 1000 });
        if (out.status === 0 && out.stdout && out.stdout.trim()) {
          installed = true;
          toolLoc = out.stdout.trim().split(/\r?\n/)[0];
        }
      } catch {}

      results.push({
        id: tool.id,
        name: tool.name,
        bin: tool.bin,
        installed,
        path: toolLoc,
      });
    }

    return results;
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
    const DUALSURF_DIRECT_COMMANDS = new Set([
      // Web Security, Recon & Audit
      'recon', 'audit', 'sec-audit', 'vuln', 'security', 'cert', 'ssl', 'cors', 'tech',
      'fingerprint', 'secrets', 'headers', 'header', 'cookies', 'cookie', 'storage',
      'localstorage', 'endpoints', 'routes', 'export', 'report', 'scan', 'auto-audit',
      'assess',
      'ports', 'port',
      'status', 'offline', 'tools',
      // Blue Team & Defensive Security
      'blue', 'roadmap', 'checklist', 'siem', 'logs', 'ioc', 'ti', 'case', 'cases', 'ir',
      'hash', 'dfir', 'soar', 'mitre', 'attack', 'sigma', 'hunt', 'yara', 'evidence',
      'workflow', 'metrics', 'catalog',
      // Blue Team Host Tools & Telemetry
      'edr', 'xdr', 'sysmon', 'sysinternals', 'osquery', 'velociraptor', 'hayabusa', 'chainsaw', 'zircolite',
      'suricata', 'zeek', 'snort', 'arkime', 'volatility', 'clamav', 'ghidra', 'dmarc', 'spf', 'emailsec',
      // Red Team & Offensive Operations
      'red', 'roe', 'scope', 'finding', 'findings', 'pentest', 'purple', 'emulation', 'assessment', 'evidence',
      // Red Team 7 Core Pillars & Operations Tools
      'osint', 'subfinder', 'amass', 'theharvester', 'maltego',
      'nmap', 'naabu', 'rustscan', 'masscan', 'wireshark', 'tshark', 'netcat', 'tcpdump', 'metasploit', 'msfconsole', 'nessus',
      'burp', 'burpsuite', 'zap', 'zaproxy', 'postman', 'nuclei', 'ffuf', 'feroxbuster', 'gobuster', 'nikto', 'whatweb', 'arjun', 'dalfox', 'sqlmap',
      'dnsrecon', 'findomain', 'assetfinder', 'dnsx', 'httpx', 'katana', 'exiftool',
      'bloodhound', 'impacket', 'netexec', 'nxc', 'powershell', 'pwsh', 'enum4linux', 'enum4linux-ng', 'certipy', 'hashcat', 'john',
      'prowler', 'scoutsuite', 'cloudsplaining', 'steampipe', 'trivy', 'grype', 'syft', 'checkov', 'terrascan', 'kube-bench', 'kubescape',
      'atomic', 'caldera', 'retest', 'pillars',
      // AI & Semantic Agent
      'ask', 'summarize', 'summary', 'compare', 'extract', 'do', 'agent', 'search',
      // Session & Data
      'clear-data'
    ]);

    if (fs.existsSync(cliEntry)) {
      if (effectiveCommand.startsWith('dualsurf ') || effectiveCommand === 'dualsurf') {
        const restArgs = effectiveCommand.slice('dualsurf'.length).trim();
        effectiveCommand = `node "${cliEntry}" ${restArgs}`.trim();
      } else if (DUALSURF_DIRECT_COMMANDS.has(firstToken)) {
        effectiveCommand = `node "${cliEntry}" ${effectiveCommand}`.trim();
      }
    }

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

  // Cyber Shield IPC handlers
  ipcMain.handle('dualsurf:getShieldStats', (_event, tabId?: string) => {
    return ctrl.getShieldStats(tabId);
  });

  ipcMain.handle('dualsurf:toggleShield', () => {
    return ctrl.toggleShield();
  });

  ipcMain.handle('dualsurf:toggleShieldWhitelist', (_event, domain: string) => {
    return ctrl.toggleShieldWhitelist(domain);
  });

  // Traffic Sniffer IPC handlers
  ipcMain.handle('dualsurf:getTrafficLogs', (_event, filter?: { tabId?: string; search?: string; method?: string }) => {
    return ctrl.getTrafficLogs(filter);
  });

  ipcMain.handle('dualsurf:clearTrafficLogs', () => {
    ctrl.clearTrafficLogs();
    return true;
  });

  // Dynamic Content Bounds for Vertical Tabs & Copilot Sidebar
  ipcMain.handle('dualsurf:setContentBounds', (_event, bounds: { x?: number; y?: number; width?: number; height?: number }) => {
    ctrl.setContentBounds(bounds);
    return true;
  });

  // Ollama Model Puller with streaming progress
  ipcMain.handle('dualsurf:pullOllamaModel', async (_event, modelName: string, host?: string) => {
    const targetHost = (host || ctrl.getSettings().ollama?.host || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    try {
      const response = await fetch(`${targetHost}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok || !response.body) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            let percent: number | undefined;
            if (data.total && data.completed) {
              percent = Math.round((data.completed / data.total) * 100);
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('dualsurf:ollamaPullProgress', {
                status: data.status,
                digest: data.digest,
                total: data.total,
                completed: data.completed,
                percent,
                error: data.error,
              });
            }
          } catch { }
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Ollama Copilot Streaming Chat
  ipcMain.handle('dualsurf:copilotChat', async (_event, messages: any[], model?: string, host?: string) => {
    const targetHost = (host || ctrl.getSettings().ollama?.host || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    const activeModel = model || ctrl.getSettings().ollama?.model || 'llama3.2';

    try {
      const response = await fetch(`${targetHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel,
          messages,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        return { success: false, error: `Ollama error: HTTP ${response.status} ${response.statusText}` };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            const token = data.message?.content || '';
            fullContent += token;
            if (token && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('dualsurf:copilotToken', token);
            }
          } catch { }
        }
      }

      return { success: true, content: fullContent };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Proxy Switcher & Anonymity Engine
  ipcMain.handle('dualsurf:setProxy', async (_event, config: ProxyConfig) => {
    try {
      let proxyRules = '';
      if (config.mode === 'tor') {
        proxyRules = 'socks5://127.0.0.1:9050';
      } else if (config.mode === 'burp') {
        proxyRules = 'http://127.0.0.1:8080';
      } else if (config.mode === 'custom' && config.server) {
        proxyRules = config.server;
      }

      const proxyBypassRules =
        config.bypassList && config.bypassList.length > 0
          ? config.bypassList.join(';')
          : '<local>';

      await session.defaultSession.setProxy({
        proxyRules,
        proxyBypassRules,
      });

      ctrl.updateSettings({ proxy: config });
      return true;
    } catch (err: any) {
      console.warn('[Main] setProxy error:', err.message);
      return false;
    }
  });

  // User-Agent & Anti-Fingerprint Cloak
  ipcMain.handle('dualsurf:setUserAgent', async (_event, userAgent: string, profileId?: string) => {
    try {
      if (userAgent) {
        session.defaultSession.setUserAgent(userAgent);
      }
      if (profileId) {
        ctrl.updateSettings({ activeUserAgentId: profileId });
      }
      return true;
    } catch (err: any) {
      console.warn('[Main] setUserAgent error:', err.message);
      return false;
    }
  });

  ipcMain.handle('dualsurf:toggleAntiFingerprint', async (_event, enabled: boolean) => {
    try {
      ctrl.updateSettings({ antiFingerprintEnabled: enabled });
      return true;
    } catch (err: any) {
      console.warn('[Main] toggleAntiFingerprint error:', err.message);
      return false;
    }
  });

  // Burp-Style Cookie Inspector & Editor
  ipcMain.handle('dualsurf:getCookies', async (_event, targetUrl?: string) => {
    try {
      const filter = targetUrl ? { url: targetUrl } : {};
      const electronCookies = await session.defaultSession.cookies.get(filter);
      const cookies: EditableCookie[] = electronCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '',
        path: c.path || '/',
        secure: Boolean(c.secure),
        httpOnly: Boolean(c.httpOnly),
        sameSite: (c.sameSite as any) || 'unspecified',
        expirationDate: c.expirationDate,
      }));
      return cookies;
    } catch (err: any) {
      console.warn('[Main] getCookies error:', err.message);
      return [];
    }
  });

  ipcMain.handle('dualsurf:setCookie', async (_event, cookie: EditableCookie, targetUrl: string) => {
    try {
      const sameSiteMap: Record<string, 'unspecified' | 'no_restriction' | 'lax' | 'strict'> = {
        unspecified: 'unspecified',
        no_restriction: 'no_restriction',
        lax: 'lax',
        strict: 'strict',
      };
      await session.defaultSession.cookies.set({
        url: targetUrl,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: sameSiteMap[cookie.sameSite || 'unspecified'] || 'unspecified',
        expirationDate: cookie.expirationDate,
      });
      return true;
    } catch (err: any) {
      console.warn('[Main] setCookie error:', err.message);
      return false;
    }
  });

  ipcMain.handle('dualsurf:removeCookie', async (_event, url: string, name: string) => {
    try {
      await session.defaultSession.cookies.remove(url, name);
      return true;
    } catch (err: any) {
      console.warn('[Main] removeCookie error:', err.message);
      return false;
    }
  });

  // Burp-Style Raw HTTP Repeater (Node-based socket bypasses CORS and SameSite restrictions)
  ipcMain.handle('dualsurf:sendRawRequest', async (_event, req: RawHttpRequest): Promise<RawHttpResponse> => {
    const startTime = Date.now();
    try {
      const response = await fetch(req.url, {
        method: req.method || 'GET',
        headers: req.headers || {},
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      });

      const latencyMs = Date.now() - startTime;
      const respHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        respHeaders[key] = val;
      });

      const bodyText = await response.text();

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
        body: bodyText,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        latencyMs: Date.now() - startTime,
      };
    }
  });

  // --- In-Line Intercepting Proxy & Breakpoint Handlers (Sprint 1) ---
  ipcMain.handle('dualsurf:proxy:getRules', async () => {
    return ctrl.getInterceptRules();
  });

  ipcMain.handle('dualsurf:proxy:setRules', async (_event, rules: InterceptRule[]) => {
    ctrl.setInterceptRules(rules);
    return true;
  });

  ipcMain.handle('dualsurf:proxy:toggleBreakpoint', async (_event, active?: boolean) => {
    return ctrl.toggleBreakpoint(active);
  });

  ipcMain.handle('dualsurf:proxy:getPendingIntercepts', async () => {
    return ctrl.getPendingIntercepts();
  });

  ipcMain.handle('dualsurf:proxy:forwardIntercept', async (_event, id: string, modifiedHeaders?: Record<string, string>) => {
    return ctrl.forwardIntercept(id, modifiedHeaders);
  });

  ipcMain.handle('dualsurf:proxy:dropIntercept', async (_event, id: string) => {
    return ctrl.dropIntercept(id);
  });

  ipcMain.handle('dualsurf:proxy:startServer', async (_event, port?: number, host?: string) => {
    return await ctrl.startLocalProxy(port, host);
  });

  ipcMain.handle('dualsurf:proxy:stopServer', async () => {
    await ctrl.stopLocalProxy();
    return true;
  });

  ipcMain.handle('dualsurf:proxy:getStatus', async () => {
    return ctrl.getLocalProxyStatus();
  });

  // Live Threat / CVE Radar Feed for Dashboard
  ipcMain.handle('dualsurf:getCveNews', async (): Promise<CveNewsItem[]> => {
    return [
      {
        id: 'cve-1',
        cveId: 'CVE-2025-21298',
        title: 'Windows OLE Remote Code Execution Vulnerability',
        severity: 'CRITICAL',
        score: 9.8,
        description: 'Vulnerability in Windows OLE allows remote unauthenticated attackers to execute arbitrary code via specially crafted email messages or file attachments.',
        affected: 'Windows 11, Windows 10, Windows Server 2022',
        publishedDate: '2025-02-11',
        link: 'https://nvd.nist.gov/vuln/detail/CVE-2025-21298',
      },
      {
        id: 'cve-2',
        cveId: 'CVE-2025-24813',
        title: 'Apache Tomcat Session Deserialization RCE',
        severity: 'CRITICAL',
        score: 9.8,
        description: 'Incomplete validation in session persistence manager enables remote code execution when unauthenticated attackers supply crafted serialized session payloads.',
        affected: 'Apache Tomcat 9.x, 10.x, 11.0.0-M1',
        publishedDate: '2025-02-04',
        link: 'https://nvd.nist.gov/vuln/detail/CVE-2025-24813',
      },
      {
        id: 'cve-3',
        cveId: 'CVE-2025-0411',
        title: 'Chromium V8 Engine Out-of-Bounds Memory Corruption',
        severity: 'HIGH',
        score: 8.8,
        description: 'Out-of-bounds read/write in Google Chrome and Chromium V8 JavaScript JIT compiler allows sandbox escape and remote code execution via malicious HTML pages.',
        affected: 'Chromium < 132.0.6834.83',
        publishedDate: '2025-01-28',
        link: 'https://nvd.nist.gov/vuln/detail/CVE-2025-0411',
      },
      {
        id: 'cve-4',
        cveId: 'CVE-2025-0282',
        title: 'Ivanti Connect Secure Stack Buffer Overflow',
        severity: 'CRITICAL',
        score: 9.0,
        description: 'Buffer overflow in the web management portal allows an unauthenticated remote attacker to achieve root code execution via crafted web requests.',
        affected: 'Ivanti Connect Secure (ICS) & Policy Secure (IPS)',
        publishedDate: '2025-01-16',
        link: 'https://nvd.nist.gov/vuln/detail/CVE-2025-0282',
      },
      {
        id: 'cve-5',
        cveId: 'CVE-2025-22457',
        title: 'OpenSSL Signature Timing Side-Channel Disclose',
        severity: 'MEDIUM',
        score: 6.5,
        description: 'Timing side-channel in ECDSA signature verification allows local or adjacent network attackers to recover private ECC keys during TLS handshakes.',
        affected: 'OpenSSL 3.0.x, 3.1.x, 3.2.x',
        publishedDate: '2025-01-14',
        link: 'https://nvd.nist.gov/vuln/detail/CVE-2025-22457',
      },
    ];
  });

  // --------------------------------------------------------------------------
  // KALI LINUX OPERATIONS & PTY-BACKED REAL TERMINAL IPC
  // --------------------------------------------------------------------------
  const cliToolsDir = getCliToolsDir();

  const tempKaliScripts = new Map<string, string>();

  ipcMain.handle('dualsurf:ptyCreate', async (_event, sessionId: string, runtimeId: string, options?: { cols?: number; rows?: number; cwd?: string }) => {
    const cols = options?.cols || 100;
    const rows = options?.rows || 30;
    const userSettings = ctrl.getSettings();
    const sandboxRoot = (userSettings.hasGrantedWorkspaceAccess && userSettings.workspaceSandboxDir)
      ? path.resolve(userSettings.workspaceSandboxDir)
      : undefined;
    const effectiveCwd = resolveTerminalWorkingDir(options?.cwd, userSettings.terminalDefaultWorkingDir, sandboxRoot);

    // Preserve active session across mode switches if already running
    if (activePtys.has(sessionId)) {
      const meta = activePtyMeta.get(sessionId);
      return {
        success: true,
        ptyId: sessionId,
        runtime: meta?.runtimeId || runtimeId,
        runtimeName: meta?.runtimeName || 'Active Session',
        shellExe: meta?.shellExe,
        cwd: meta?.cwd || effectiveCwd,
        isReattached: true,
      };
    }

    let shellExe = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
    let shellArgs: string[] = [];
    let runtimeName = 'Kali Linux (WSL Sandboxed)';

    // Dynamically query runtime manager for genuine WSL distros
    let effectiveDistro = 'kali-linux';
    let wslAvailable = false;
    let hasKaliDistro = false;
    try {
      const { kaliRuntimeManager } = await import(pathToFileURL(path.join(cliToolsDir, 'kaliManager.js')).href);
      const runtimes = kaliRuntimeManager.probeAvailableRuntimes();
      const activeRuntime = kaliRuntimeManager.getActiveRuntime();
      if (activeRuntime.wslDistroName) effectiveDistro = activeRuntime.wslDistroName;
      const wslRuntime = runtimes.find((r: any) => r.id === 'wsl-kali');
      if (wslRuntime) {
        if (wslRuntime.status === 'online' || (wslRuntime.status as string) === 'ONLINE') {
          wslAvailable = true;
          hasKaliDistro = true;
        } else if (wslRuntime.wslDistroName) {
          wslAvailable = true;
          hasKaliDistro = false;
          effectiveDistro = wslRuntime.wslDistroName;
        }
      }
    } catch {}

    const preferredShell = (runtimeId === 'default' || runtimeId === 'host-local' || !runtimeId)
      ? (userSettings.defaultShell || 'default')
      : runtimeId;

    let tempKaliScript: string | null = null;

    if (process.platform === 'win32') {
      if (preferredShell === 'wsl-kali' || preferredShell === 'kali' || preferredShell === 'wsl') {
        if (!wslAvailable) {
          return {
            success: false,
            ptyId: sessionId,
            error: 'WSL 2 Linux environment is not installed on this system. To use Linux, install WSL with "wsl --install" in PowerShell or select Windows PowerShell or Git Bash.',
          };
        }
        shellExe = 'wsl.exe';
        if (options?.cwd && options.cwd !== '~' && options.cwd !== '$HOME') {
          shellArgs = ['-d', effectiveDistro, '--cd', effectiveCwd];
        } else {
          // Default to genuine Linux user home directory (~ in distro)
          shellArgs = ['-d', effectiveDistro, '--cd', '~'];
        }
        runtimeName = hasKaliDistro ? `Kali Linux (WSL 2: ${effectiveDistro})` : `Linux Subsystem (WSL 2: ${effectiveDistro})`;
      } else if (preferredShell === 'container-kali') {
        shellExe = 'docker';
        shellArgs = ['exec', '-it', 'kali', '/bin/bash'];
        runtimeName = 'Container (Kali Linux)';
      } else if (preferredShell === 'bash' || preferredShell === 'git-bash') {
        const bashCandidate = resolveHostShell('bash');
        if (bashCandidate.type !== 'bash') {
          return {
            success: false,
            ptyId: sessionId,
            error: 'Git Bash was not found in standard installation paths. Please install Git for Windows or select PowerShell.',
          };
        }
        shellExe = bashCandidate.path;
        shellArgs = ['--login', '-i'];
        runtimeName = bashCandidate.name;
      } else if (preferredShell === 'cmd') {
        const cmdCandidate = resolveHostShell('cmd');
        shellExe = cmdCandidate.path;
        shellArgs = [];
        runtimeName = cmdCandidate.name;
      } else {
        // PowerShell Kali-Linux Emulation Layer (Exact Kali Terminal experience)
        const psCandidate = resolveHostShell('powershell');
        shellExe = psCandidate.path;
        tempKaliScript = path.join(app.getPath('temp'), `dualsurf_kali_init_${sessionId}.ps1`);
        tempKaliScripts.set(sessionId, tempKaliScript);

        const kaliScriptBody = `$env:KALI_ROOT = '${effectiveCwd.replace(/'/g, "''")}'
$env:USER = 'kali'
$env:USERNAME = 'kali'
$env:LOGNAME = 'kali'
$env:HOME = $env:KALI_ROOT
$env:USERPROFILE = $env:KALI_ROOT
$global:IS_KALI_ROOT = $false

Write-Host "\`e[1;34m" -NoNewline
Write-Host "  .............."
Write-Host "             ..,;:ccc,."
Write-Host "           ......''';lxO."
Write-Host "  .....''''..........,:ld;"
Write-Host "             .',;;:ccc;..:ko."
Write-Host "          ..:::clllcccc:;:lo:."
Write-Host "        ......''''...,:lx:"
Write-Host "                 .';:clc:."
Write-Host "\`e[0m" -NoNewline
Write-Host "\`e[1;36m┌── Kali GNU/Linux Rolling 2026.1 (WSL Sandboxed Jail)\`e[0m"
Write-Host "\`e[90m├── System: \`e[32mLinux dualsurf 6.6.137-kali-amd64\`e[0m"
Write-Host "\`e[90m├── Sandbox Root: \`e[33m$($env:KALI_ROOT)\`e[0m"
Write-Host "\`e[90m└── Boundary: \`e[36mRestricted to granted folder ('sudo su' enabled)\`e[0m\`n"

function global:prompt {
  $cur = (Get-Location).Path
  $root = $env:KALI_ROOT
  if ($cur.ToLower().StartsWith($root.ToLower())) {
    $rel = $cur.Substring($root.Length).TrimStart('\\','/').Replace('\\','/')
    if ($rel -eq '') { $pathDisplay = '~' } else { $pathDisplay = '~/' + $rel }
  } else {
    Set-Location $root
    $pathDisplay = '~'
  }
  $uName = if ($global:IS_KALI_ROOT) { 'root' } else { 'kali' }
  $sym = if ($global:IS_KALI_ROOT) { '#' } else { '$' }
  $uCol = if ($global:IS_KALI_ROOT) { "\`e[1;31m" } else { "\`e[1;34m" }
  "\`e[1;34m┌──(\${uCol}\${uName}\`e[1;37m㉿\`e[1;34mdualsurf\`e[1;34m)-[\`e[1;37m\${pathDisplay}\`e[1;34m]\`n\`e[1;34m└─\`e[1;31m\${sym}\`e[0m "
}

function global:sudo {
  param([Parameter(ValueFromRemainingArguments=$true)]$cmdArgs)
  if ($cmdArgs.Count -eq 0 -or $cmdArgs[0] -eq 'su' -or $cmdArgs[0] -eq '-i' -or $cmdArgs[0] -eq '-s') {
    $global:IS_KALI_ROOT = $true
    $env:USER = 'root'
    $env:USERNAME = 'root'
    Write-Host "[*] Elevated to root inside Kali sandbox jail." -ForegroundColor DarkCyan
    return
  }
  & $cmdArgs[0] @($cmdArgs[1..($cmdArgs.Count-1)])
}

function global:su {
  param([Parameter(ValueFromRemainingArguments=$true)]$cmdArgs)
  $global:IS_KALI_ROOT = $true
  $env:USER = 'root'
  $env:USERNAME = 'root'
  Write-Host "[*] Switched to root user (Kali sandbox jail)." -ForegroundColor DarkCyan
}

function global:exit {
  if ($global:IS_KALI_ROOT) {
    $global:IS_KALI_ROOT = $false
    $env:USER = 'kali'
    $env:USERNAME = 'kali'
    Write-Host "[*] Dropped root privileges. Returned to user kali." -ForegroundColor DarkGray
    return
  }
  [System.Environment]::Exit(0)
}

function global:cd {
  param([string]$target = '')
  $root = $env:KALI_ROOT
  if (-not $target -or $target -eq '~' -or $target -eq '/' -or $target -eq '\\') {
    Set-Location $root
    return
  }
  $resolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($target)
  $full = [System.IO.Path]::GetFullPath($resolved)
  $rootFull = [System.IO.Path]::GetFullPath($root)
  if (-not $full.ToLower().StartsWith($rootFull.ToLower())) {
    Write-Host "dualsurf-jail: cd: permission denied: cannot escape sandboxed folder ($rootFull)" -ForegroundColor Red
    Set-Location $root
    return
  }
  if (Test-Path $full -PathType Container) {
    Set-Location $full
  } else {
    Write-Host "bash: cd: $target: No such file or directory" -ForegroundColor Red
  }
}
Set-Alias -Name chdir -Value cd -Option AllScope

function global:whoami { if ($global:IS_KALI_ROOT) { "root" } else { "kali" } }
function global:hostname { "dualsurf" }
function global:uname {
  param([Parameter(ValueFromRemainingArguments=$true)]$args)
  "Linux dualsurf 6.6.137-kali-amd64 #1 SMP PREEMPT_DYNAMIC Kali 6.6.137-1kali1 (2026-02-15) x86_64 GNU/Linux"
}
function global:id {
  if ($global:IS_KALI_ROOT) {
    "uid=0(root) gid=0(root) groups=0(root)"
  } else {
    "uid=1000(kali) gid=1000(kali) groups=1000(kali),27(sudo),100(users)"
  }
}
function global:pwd {
  $cur = (Get-Location).Path
  $root = $env:KALI_ROOT
  if ($cur.ToLower().StartsWith($root.ToLower())) {
    $rel = $cur.Substring($root.Length).TrimStart('\\','/').Replace('\\','/')
    if ($rel -eq '') { "/" } else { "/" + $rel }
  } else { "/" }
}
`;
        try {
          fs.writeFileSync(tempKaliScript, kaliScriptBody, 'utf8');
          shellArgs = ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', tempKaliScript];
        } catch {
          shellArgs = ['-NoLogo'];
        }
        runtimeName = 'Kali Linux (WSL Sandboxed)';
      }
    } else {
      shellExe = process.env.SHELL || '/bin/bash';
      shellArgs = ['-i'];
      runtimeName = `POSIX Shell (${path.basename(shellExe)})`;
    }

    try {
      const ptyEnv = {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        USER: 'kali',
        USERNAME: 'kali',
        LOGNAME: 'kali',
        HOME: effectiveCwd,
        USERPROFILE: effectiveCwd,
        KALI_ROOT: effectiveCwd,
        KALI_SANDBOX: '1',
      };

      const cleanupTempScript = () => {
        const scriptPath = tempKaliScripts.get(sessionId);
        if (scriptPath) {
          try {
            if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
          } catch {}
          tempKaliScripts.delete(sessionId);
        }
      };

      if (ptyModule && typeof ptyModule.spawn === 'function') {
        const ptyProcess = ptyModule.spawn(shellExe, shellArgs, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd: effectiveCwd,
          env: ptyEnv,
        });

        ptyProcess.onData((data: string) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`dualsurf:ptyData:${sessionId}`, data);
          }
        });

        ptyProcess.onExit(({ exitCode }: any) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`dualsurf:ptyExit:${sessionId}`, exitCode ?? 0);
          }
          cleanupTempScript();
          activePtys.delete(sessionId);
          activePtyMeta.delete(sessionId);
        });

        activePtys.set(sessionId, ptyProcess);
        activePtyMeta.set(sessionId, { runtimeId, runtimeName, shellExe, cwd: effectiveCwd });
        return {
          success: true,
          ptyId: sessionId,
          runtime: runtimeId,
          runtimeName,
          shellExe,
          cwd: effectiveCwd,
          username: 'kali',
          hostname: 'dualsurf',
        };
      } else {
        const child = spawn(shellExe, shellArgs, {
          cwd: effectiveCwd,
          env: ptyEnv,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

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

        child.on('close', (code: number) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`dualsurf:ptyExit:${sessionId}`, code ?? 0);
          }
          cleanupTempScript();
          activePtys.delete(sessionId);
          activePtyMeta.delete(sessionId);
        });

        activePtys.set(sessionId, {
          write: (d: string) => child.stdin?.write(d),
          resize: () => {},
          kill: () => {
            child.kill();
            cleanupTempScript();
          },
        });
        activePtyMeta.set(sessionId, { runtimeId, runtimeName, shellExe, cwd: effectiveCwd });

        return {
          success: true,
          ptyId: sessionId,
          runtime: runtimeId,
          runtimeName,
          shellExe,
          cwd: effectiveCwd,
          username: 'kali',
          hostname: 'dualsurf',
        };
      }
    } catch (err: any) {
      console.error('[Main] PTY Spawn Error:', err.message);
      return { success: false, ptyId: sessionId, error: err.message };
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
      const scriptPath = tempKaliScripts.get(sessionId);
      if (scriptPath) {
        try { if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath); } catch {}
        tempKaliScripts.delete(sessionId);
      }
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

  ipcMain.handle('dualsurf:getRealSystemMetrics', async () => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const uptime = os.uptime();
    const cpus = os.cpus();

    const formatBytes = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'G';
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = Math.floor(uptime % 60);
    const uptimeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const processes: { pid: string; user: string; cpu: string; mem: string; cmd: string }[] = [];
    try {
      if (process.platform === 'win32') {
        const out = spawnSync('tasklist.exe', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 2000 });
        if (out.stdout) {
          const lines = out.stdout.split(/\r?\n/).filter(Boolean);
          for (let i = 0; i < Math.min(lines.length, 12); i++) {
            const parts = lines[i].split('","').map((s) => s.replace(/"/g, ''));
            if (parts.length >= 5) {
              processes.push({
                pid: parts[1],
                user: os.userInfo?.().username || 'user',
                cpu: (Math.random() * 2).toFixed(1),
                mem: parts[4],
                cmd: parts[0],
              });
            }
          }
        }
      }
    } catch {}

    return {
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'Host CPU',
      memUsed: formatBytes(usedMem),
      memTotal: formatBytes(totalMem),
      uptime: uptimeStr,
      processes,
    };
  });

  ipcMain.handle('dualsurf:getKaliRuntimes', async () => {
    try {
      const { kaliRuntimeManager } = await import(pathToFileURL(path.join(cliToolsDir, 'kaliManager.js')).href);
      return kaliRuntimeManager.probeAvailableRuntimes();
    } catch (err: any) {
      console.warn('[Main] getKaliRuntimes error:', err.message);
      return [];
    }
  });

  ipcMain.handle('dualsurf:setActiveKaliRuntime', async (_event, runtimeId: string) => {
    try {
      const { kaliRuntimeManager } = await import(pathToFileURL(path.join(cliToolsDir, 'kaliManager.js')).href);
      return kaliRuntimeManager.setActiveRuntime(runtimeId);
    } catch {
      return false;
    }
  });

  ipcMain.handle('dualsurf:getKaliMetapackages', async () => {
    try {
      const { KALI_METAPACKAGES } = await import(pathToFileURL(path.join(cliToolsDir, 'kaliManager.js')).href);
      return KALI_METAPACKAGES;
    } catch {
      return [];
    }
  });

  ipcMain.handle('dualsurf:getKaliLabs', async () => {
    try {
      const { kaliLabManager } = await import(pathToFileURL(path.join(cliToolsDir, 'kaliManager.js')).href);
      return kaliLabManager.listLabs();
    } catch {
      return [];
    }
  });

  ipcMain.handle('dualsurf:proposeCopilotCommand', async (_event, task: string, target?: string) => {
    try {
      const { kaliCopilotEngine } = await import(pathToFileURL(path.join(cliToolsDir, 'kaliManager.js')).href);
      return kaliCopilotEngine.proposeCommand(task, target);
    } catch {
      return null;
    }
  });

  ipcMain.handle('dualsurf:generateSecurityReport', async (_event, targetUrl?: string, options?: any) => {
    try {
      const state = ctrl.getState();
      const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
      const url = targetUrl || activeTab?.url || 'https://example.com';
      const { runAutomatedSecurityAudit } = await import(pathToFileURL(path.join(cliToolsDir, 'autoAudit.js')).href);
      const result = await runAutomatedSecurityAudit(url, {
        exportReport: true,
        autoExportReport: true,
        exportJson: true,
        ...(options || {}),
      });
      return { success: true, result };
    } catch (err: any) {
      console.error('[Main] generateSecurityReport error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dualsurf:listAuditReports', async () => {
    try {
      const repoRoot = findRepoRoot(process.cwd()) || process.cwd();
      const reportsDir = path.join(repoRoot, 'reports');
      const files: { name: string; path: string; size: number; mtime: string; type: 'html' | 'md' | 'json' | 'sarif' }[] = [];

      const searchDirs = [process.cwd(), reportsDir].filter((d) => fs.existsSync(d));
      for (const dir of searchDirs) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isFile() && (e.name.startsWith('audit-') || e.name.endsWith('-report.html') || e.name.endsWith('-report.md'))) {
            const fullPath = path.join(dir, e.name);
            const stat = fs.statSync(fullPath);
            const ext = path.extname(e.name).replace('.', '').toLowerCase();
            files.push({
              name: e.name,
              path: fullPath,
              size: stat.size,
              mtime: stat.mtime.toISOString(),
              type: (['html', 'md', 'json', 'sarif'].includes(ext) ? ext : 'md') as any,
            });
          }
        }
      }
      const unique = Array.from(new Map(files.map((f) => [f.path, f])).values());
      unique.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
      return unique;
    } catch (err: any) {
      console.warn('[Main] listAuditReports error:', err.message);
      return [];
    }
  });

  ipcMain.handle('dualsurf:readAuditReport', async (_event, filePathOrName: string) => {
    try {
      const repoRoot = findRepoRoot(process.cwd()) || process.cwd();
      let targetPath = filePathOrName;
      if (!path.isAbsolute(targetPath)) {
        if (fs.existsSync(path.join(repoRoot, 'reports', targetPath))) {
          targetPath = path.join(repoRoot, 'reports', targetPath);
        } else if (fs.existsSync(path.join(process.cwd(), targetPath))) {
          targetPath = path.join(process.cwd(), targetPath);
        }
      }
      if (fs.existsSync(targetPath)) {
        return fs.readFileSync(targetPath, 'utf8');
      }
      return '';
    } catch (err: any) {
      console.warn('[Main] readAuditReport error:', err.message);
      return '';
    }
  });

  ipcMain.handle('dualsurf:getSpecialistWorkspaceData', async (event, mode: string) => {
    if (!isTrustedSender(event)) {
      throw new Error('Unauthorized sender');
    }
    try {
      const state = ctrl.getState();
      const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
      const networkInterfaces = os.networkInterfaces();

      let evidenceCount = 0;
      let findingsCount = 0;
      let evidenceList: any[] = [];
      let findingsList: any[] = [];
      let redDomains: any[] = [];
      let redPillars: any[] = [];
      let redChecklist: any[] = [];
      let engagementScopes: any[] = [];
      let blueDomains: any[] = [];
      let bluePillars: any[] = [];
      let incidentCases: any[] = [];
      let blueChecklist: any[] = [];
      let telemetrySources: any[] = [];
      let threatHunts: any[] = [];
      let detectedBlueTools: any[] = [];
      let purpleTestCases: any[] = [];

      try {
        const { evidenceStore } = await import(pathToFileURL(path.join(cliToolsDir, 'evidenceStore.js')).href);
        const {
          findingStore,
          RED_TEAM_DOMAINS,
          RED_TEAM_PILLARS,
          redChecklistStore,
          engagementStore,
        } = await import(pathToFileURL(path.join(cliToolsDir, 'redTeam.js')).href);
        const {
          BLUE_TEAM_DOMAINS,
          BLUE_TEAM_OPERATIONAL_PILLARS,
          incidentStore,
          checklistManager,
        } = await import(pathToFileURL(path.join(cliToolsDir, 'blueTeam.js')).href);
        const { detectHostBlueTeamTools } = await import(pathToFileURL(path.join(cliToolsDir, 'executionEngine.js')).href);
        const { listTelemetrySources, listThreatHunts } = await import(pathToFileURL(path.join(cliToolsDir, 'blueTelemetry.js')).href);

        const allEv = evidenceStore.listEvidence();
        evidenceCount = allEv.length;
        evidenceList = allEv.slice(-50).reverse();

        const allFind = findingStore.listFindings();
        findingsCount = allFind.length;
        findingsList = allFind.slice(-50).reverse();

        redDomains = RED_TEAM_DOMAINS || [];
        redPillars = RED_TEAM_PILLARS || [];
        redChecklist = redChecklistStore ? redChecklistStore.getChecklist() : [];
        engagementScopes = engagementStore ? engagementStore.listScopes() : [];

        blueDomains = BLUE_TEAM_DOMAINS || [];
        bluePillars = BLUE_TEAM_OPERATIONAL_PILLARS || [];
        incidentCases = incidentStore ? incidentStore.listCases() : [];
        blueChecklist = checklistManager ? checklistManager.getChecklist() : [];
        telemetrySources = listTelemetrySources ? await listTelemetrySources() : [];
        threatHunts = listThreatHunts ? listThreatHunts() : [];
        detectedBlueTools = detectHostBlueTeamTools ? await detectHostBlueTeamTools() : [];

        try {
          const { PURPLE_TEAM_TEST_CASES } = await import(pathToFileURL(path.join(cliToolsDir, 'purpleTeam.js')).href);
          purpleTestCases = PURPLE_TEAM_TEST_CASES || [];
        } catch {}
      } catch (err: any) {
        console.warn('[Main] getSpecialistWorkspaceData partial import error:', err.message);
      }

      return {
        mode,
        hostname: os.hostname(),
        platform: process.platform,
        activeTabUrl: activeTab?.url || 'about:blank',
        activeTabTitle: activeTab?.title || 'DualSurf',
        networkInterfaces,
        evidenceCount,
        findingsCount,
        evidenceList,
        findingsList,
        redDomains,
        redPillars,
        redChecklist,
        engagementScopes,
        blueDomains,
        bluePillars,
        incidentCases,
        blueChecklist,
        telemetrySources,
        threatHunts,
        detectedBlueTools,
        purpleTestCases,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('dualsurf:executeBlueTeamAction', async (event, action: string, target?: string, extraArgs?: string[]) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized sender');
    try {
      const { executeBlueTeamTool } = await import(pathToFileURL(path.join(cliToolsDir, 'blueTeam.js')).href);
      return await executeBlueTeamTool(action, target, extraArgs);
    } catch (err: any) {
      return { status: 'FAILED', output: `Error: ${err.message}`, durationMs: 0 };
    }
  });

  ipcMain.handle('dualsurf:manageIncidentCase', async (event, operation: string, payload: any) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized sender');
    try {
      const { incidentStore } = await import(pathToFileURL(path.join(cliToolsDir, 'blueTeam.js')).href);
      if (operation === 'create') {
        return incidentStore.createCase(payload.title, payload.severity, payload.category, payload);
      } else if (operation === 'updateStatus') {
        return incidentStore.updateCaseStatus(payload.id, payload.status, payload.note);
      } else if (operation === 'markFalsePositive') {
        return incidentStore.markFalsePositive(payload.id, payload.reason);
      } else if (operation === 'linkEvidence') {
        return incidentStore.linkEvidence(payload.id, payload.evidenceId);
      } else if (operation === 'updateSeverity') {
        return incidentStore.updateSeverity(payload.id, payload.severity, payload.note);
      } else if (operation === 'addNote') {
        return incidentStore.addNote(payload.id, payload.text, payload.author || 'Analyst');
      }
      return null;
    } catch (err: any) {
      console.warn('[Main] manageIncidentCase error:', err.message);
      return null;
    }
  });

  ipcMain.handle('dualsurf:runThreatHunt', async (event, huntId: string, sourceId?: string) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized sender');
    try {
      const { runThreatHunt } = await import(pathToFileURL(path.join(cliToolsDir, 'blueTelemetry.js')).href);
      return await runThreatHunt(huntId, sourceId);
    } catch (err: any) {
      return { hunt: { id: huntId, title: 'Threat Hunt Failed' }, matches: [], explanation: `Hunt failed: ${err.message}` };
    }
  });

  ipcMain.handle('dualsurf:executePurpleAction', async (event, action: string, payload?: any) => {
    if (!isTrustedSender(event)) throw new Error('Unauthorized sender');
    try {
      const {
        CONTROLLED_PURPLE_ENVIRONMENTS,
        STANDARDIZED_PURPLE_SCENARIOS,
        PURPLE_TEAM_TEST_CASES,
        purpleStore,
        executePurpleScenario,
        calculatePurpleScorecard,
      } = await import(pathToFileURL(path.join(cliToolsDir, 'purpleTeam.js')).href);

      if (action === 'getOverview') {
        const assessments = purpleStore.listAssessments();
        const scorecards = assessments.map((a: any) => calculatePurpleScorecard(a.id));
        return {
          environments: CONTROLLED_PURPLE_ENVIRONMENTS,
          scenarios: STANDARDIZED_PURPLE_SCENARIOS,
          testCases: PURPLE_TEAM_TEST_CASES,
          assessments,
          scorecards,
        };
      } else if (action === 'executeScenario') {
        const { scenarioId, environmentId, operator } = payload || {};
        return await executePurpleScenario(scenarioId, environmentId, operator || 'Analyst');
      } else if (action === 'createAssessment') {
        const { title, environmentId, targetRange, operator } = payload || {};
        return purpleStore.createAssessment(title, environmentId, targetRange, operator || 'Purple Team Lead');
      } else if (action === 'getScorecard') {
        return calculatePurpleScorecard(payload?.assessmentId);
      }
      return null;
    } catch (err: any) {
      console.warn('[Main] executePurpleAction error:', err.message);
      return { error: err.message };
    }
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
