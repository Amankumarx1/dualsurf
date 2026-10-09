import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { BrowserController, IpcServer } from '@dualsurf/controller';
import type { BrowserSettings, TabId } from '@dualsurf/shared-types';

let mainWindow: BrowserWindow | null = null;
let controller: BrowserController | null = null;
let ipcServer: IpcServer | null = null;
let topBarHeight = 84;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 500,
    title: 'DualSurf',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // Initialize shared controller
  controller = new BrowserController();
  controller.attachWindow(mainWindow);
  controller.setContentBounds({ y: topBarHeight });

  // Start local socket IPC Server for CLI & TUI communication
  ipcServer = new IpcServer(controller);
  ipcServer.start().catch((err) => {
    console.warn('[Main] IPC Server failed to start:', err.message);
  });

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

  // Load GUI renderer
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    try {
      await mainWindow.loadURL('http://localhost:5173');
    } catch {
      const indexPath = path.join(__dirname, '../renderer/index.html');
      await mainWindow.loadFile(indexPath);
    }
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    await mainWindow.loadFile(indexPath);
  }

  // Initialize controller tabs after window is ready
  controller.initialize(mainWindow);

  mainWindow.on('closed', () => {
    if (ipcServer) {
      ipcServer.stop();
      ipcServer = null;
    }
    mainWindow = null;
    controller = null;
  });
}

function setupIpcHandlers(ctrl: BrowserController) {
  ipcMain.handle('dualsurf:getState', () => {
    return ctrl.getState();
  });

  ipcMain.handle('dualsurf:createTab', (_event, url?: string, activate: boolean = true) => {
    return ctrl.createTab(url, activate);
  });

  ipcMain.handle('dualsurf:closeTab', (_event, tabId: TabId) => {
    return ctrl.closeTab(tabId);
  });

  ipcMain.handle('dualsurf:activateTab', (_event, tabId: TabId) => {
    return ctrl.activateTab(tabId);
  });

  ipcMain.handle('dualsurf:navigate', (_event, tabId: TabId | undefined, urlOrQuery: string) => {
    return ctrl.navigate(tabId, urlOrQuery);
  });

  ipcMain.handle('dualsurf:goBack', (_event, tabId?: TabId) => {
    return ctrl.goBack(tabId);
  });

  ipcMain.handle('dualsurf:goForward', (_event, tabId?: TabId) => {
    return ctrl.goForward(tabId);
  });

  ipcMain.handle('dualsurf:reload', (_event, tabId?: TabId) => {
    return ctrl.reload(tabId);
  });

  ipcMain.handle('dualsurf:stop', (_event, tabId?: TabId) => {
    return ctrl.stop(tabId);
  });

  ipcMain.handle('dualsurf:reopenClosedTab', () => {
    return ctrl.reopenClosedTab();
  });

  ipcMain.handle('dualsurf:getPageMetadata', (_event, tabId?: TabId) => {
    return ctrl.getPageMetadata(tabId);
  });

  ipcMain.handle('dualsurf:clickNumberedLink', (_event, tabId: TabId | undefined, linkId: number) => {
    return ctrl.clickNumberedLink(tabId, linkId);
  });

  ipcMain.handle('dualsurf:getSettings', () => {
    return ctrl.getSettings();
  });

  ipcMain.handle('dualsurf:updateSettings', (_event, partial: Partial<BrowserSettings>) => {
    return ctrl.updateSettings(partial);
  });

  ipcMain.handle('dualsurf:setTopBarHeight', (_event, height: number) => {
    topBarHeight = height;
    ctrl.setContentBounds({ y: height });
  });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
