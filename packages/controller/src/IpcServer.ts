import * as net from 'net';
import * as fs from 'fs';
import { spawn } from 'child_process';
import {
  getIpcSocketPath,
  IPCRequest,
  IPCResponse,
  IPC_COMMANDS,
  PROTOCOL_VERSION,
} from '@dualsurf/ipc-protocol';
import { EventEmitter } from 'events';
import type { BrowserController } from './BrowserController.js';

export class IpcServer extends EventEmitter {
  private server: net.Server | null = null;
  private socketPath: string;
  private controller: BrowserController;

  constructor(controller: BrowserController, socketPath?: string) {
    super();
    this.controller = controller;
    this.socketPath = socketPath || getIpcSocketPath();
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // On Unix, clean up stale socket file if it exists
      if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
        try {
          fs.unlinkSync(this.socketPath);
        } catch (err) {
          console.warn('[IpcServer] Could not unlink stale socket:', err);
        }
      }

      this.server = net.createServer((socket) => {
        let buffer = '';

        socket.on('data', async (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const request: IPCRequest = JSON.parse(trimmed);
              const response = await this.handleRequest(request);
              socket.write(JSON.stringify(response) + '\n');
            } catch (err) {
              const errorResponse: IPCResponse = {
                protocolVersion: PROTOCOL_VERSION,
                requestId: 'unknown',
                success: false,
                error: {
                  code: 'MALFORMED_REQUEST',
                  message: (err as Error).message,
                },
              };
              socket.write(JSON.stringify(errorResponse) + '\n');
            }
          }
        });

        socket.on('error', (err) => {
          console.warn('[IpcServer] Socket client error:', err.message);
        });
      });

      this.server.on('error', (err: any) => {
        if (err && err.code === 'EADDRINUSE') {
          console.warn('[IpcServer] IPC pipe or socket already active, continuing without duplicate listener:', this.socketPath);
          resolve();
        } else {
          console.error('[IpcServer] Server error:', err);
          reject(err);
        }
      });

      this.server.listen(this.socketPath, () => {
        // Enforce user-only permissions (0600) on Unix sockets for local security
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(this.socketPath, 0o600);
          } catch (err) {
            console.warn('[IpcServer] Could not set 0600 permissions on socket:', err);
          }
        }
        console.log(`[IpcServer] DualSurf IPC listening on: ${this.socketPath}`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
            try {
              fs.unlinkSync(this.socketPath);
            } catch {
              // Ignored
            }
          }
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(request: IPCRequest): Promise<IPCResponse> {
    const { requestId, command, params } = request;

    if (request.protocolVersion !== PROTOCOL_VERSION) {
      return {
        protocolVersion: PROTOCOL_VERSION,
        requestId,
        success: false,
        error: {
          code: 'PROTOCOL_VERSION_MISMATCH',
          message: `Expected protocol version ${PROTOCOL_VERSION}, got ${request.protocolVersion}`,
        },
      };
    }

    try {
      switch (command) {
        case IPC_COMMANDS.PING: {
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { pong: true, timestamp: Date.now() },
          };
        }

        case IPC_COMMANDS.TABS_LIST: {
          const state = this.controller.getState();
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: state,
          };
        }

        case IPC_COMMANDS.TABS_CREATE: {
          const tab = this.controller.createTab(params?.url, params?.activate ?? true);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: tab,
          };
        }

        case IPC_COMMANDS.TABS_SWITCH: {
          const state = this.controller.getState();
          let targetId = params?.tabId;

          // Support 1-based numerical index if provided
          if (typeof params?.index === 'number') {
            const idx = params.index - 1;
            if (idx >= 0 && idx < state.tabs.length) {
              targetId = state.tabs[idx].id;
            } else {
              return {
                protocolVersion: PROTOCOL_VERSION,
                requestId,
                success: false,
                error: { code: 'INDEX_OUT_OF_RANGE', message: `Tab index ${params.index} is out of range` },
              };
            }
          }

          if (!targetId) {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: { code: 'MISSING_PARAM', message: 'tabId or index is required' },
            };
          }

          const success = this.controller.activateTab(targetId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success,
            data: { activatedTabId: targetId },
          };
        }

        case IPC_COMMANDS.TABS_CLOSE: {
          const state = this.controller.getState();
          let targetId = params?.tabId;

          if (typeof params?.index === 'number') {
            const idx = params.index - 1;
            if (idx >= 0 && idx < state.tabs.length) {
              targetId = state.tabs[idx].id;
            } else {
              return {
                protocolVersion: PROTOCOL_VERSION,
                requestId,
                success: false,
                error: { code: 'INDEX_OUT_OF_RANGE', message: `Tab index ${params.index} is out of range` },
              };
            }
          }

          if (!targetId) {
            targetId = state.activeTabId || undefined;
          }

          if (!targetId) {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: { code: 'NO_ACTIVE_TAB', message: 'No tab available to close' },
            };
          }

          const success = this.controller.closeTab(targetId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success,
            data: { closedTabId: targetId },
          };
        }

        case IPC_COMMANDS.TABS_REOPEN: {
          const tab = this.controller.reopenClosedTab();
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: !!tab,
            data: tab,
          };
        }

        case IPC_COMMANDS.TABS_MUTE: {
          const isMuted = this.controller.toggleMuteTab(params?.tabId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { muted: isMuted },
          };
        }

        case IPC_COMMANDS.TABS_SPLIT: {
          const success = this.controller.setSplitTab(params?.tabId || null);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success,
            data: { splitTabId: this.controller.getSplitTabId() },
          };
        }

        case IPC_COMMANDS.PAGE_GET_READER: {
          const article = await this.controller.getReaderArticle(params?.tabId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: !!article,
            data: article,
          };
        }

        case IPC_COMMANDS.PAGE_GET_SECURITY_INFO: {
          const sec = await this.controller.getPageSecurityInfo(params?.tabId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: !!sec,
            data: sec,
          };
        }

        case IPC_COMMANDS.PAGE_NAVIGATE: {
          const { url, tabId } = params || {};
          if (!url) {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: { code: 'MISSING_PARAM', message: 'URL parameter is required' },
            };
          }

          const success = this.controller.navigate(tabId, url);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success,
            data: { navigatedUrl: url },
          };
        }

        case IPC_COMMANDS.PAGE_GET_METADATA: {
          const metadata = await this.controller.getPageMetadata(params?.tabId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: !!metadata,
            data: metadata,
          };
        }

        case IPC_COMMANDS.PAGE_CLICK_LINK: {
          const { linkId, tabId } = params || {};
          if (typeof linkId !== 'number') {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: { code: 'MISSING_PARAM', message: 'linkId number is required' },
            };
          }

          const success = await this.controller.clickNumberedLink(tabId, linkId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success,
            data: { followedLinkId: linkId },
          };
        }

        case IPC_COMMANDS.PAGE_FIND: {
          const { query, tabId } = params || {};
          if (!query || typeof query !== 'string') {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: { code: 'MISSING_PARAM', message: 'Query string is required for page.find' },
            };
          }

          const result = await this.controller.findInPage(tabId, query);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: result,
          };
        }

        case IPC_COMMANDS.NAV_BACK: {
          const success = this.controller.goBack(params?.tabId);
          if (!success) {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: {
                code: 'CANNOT_GO_BACK',
                message: 'Cannot navigate back: no previous history in active tab',
              },
            };
          }
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { action: 'goBack' },
          };
        }

        case IPC_COMMANDS.NAV_FORWARD: {
          const success = this.controller.goForward(params?.tabId);
          if (!success) {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: {
                code: 'CANNOT_GO_FORWARD',
                message: 'Cannot navigate forward: no forward history in active tab',
              },
            };
          }
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { action: 'goForward' },
          };
        }

        case IPC_COMMANDS.NAV_RELOAD: {
          const success = this.controller.reload(params?.tabId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success,
            data: { action: 'reload' },
          };
        }

        case IPC_COMMANDS.NAV_STOP: {
          const success = this.controller.stop(params?.tabId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success,
            data: { action: 'stop' },
          };
        }

        case IPC_COMMANDS.SETTINGS_GET: {
          const settings = this.controller.getSettings();
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: settings,
          };
        }

        case IPC_COMMANDS.SETTINGS_UPDATE: {
          const updated = this.controller.updateSettings(params || {});
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: updated,
          };
        }

        case IPC_COMMANDS.BOOKMARKS_LIST: {
          const bookmarks = this.controller.getBookmarks();
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: bookmarks,
          };
        }

        case IPC_COMMANDS.BOOKMARKS_ADD: {
          const { url, title } = params || {};
          if (!url) {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: { code: 'MISSING_PARAM', message: 'URL is required for bookmark' },
            };
          }
          const bookmark = this.controller.addBookmark(url, title);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: bookmark,
          };
        }

        case IPC_COMMANDS.BOOKMARKS_REMOVE: {
          const { id } = params || {};
          if (!id) {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: { code: 'MISSING_PARAM', message: 'Bookmark ID is required' },
            };
          }
          const removed = this.controller.removeBookmark(id);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: removed,
            data: { removedId: id },
          };
        }

        case IPC_COMMANDS.HISTORY_LIST: {
          const limit = params?.limit ? parseInt(params.limit, 10) : 50;
          const history = this.controller.getHistory(limit);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: history,
          };
        }

        case IPC_COMMANDS.HISTORY_SEARCH: {
          const query = params?.query || '';
          const history = this.controller.searchHistory(query);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: history,
          };
        }

        case IPC_COMMANDS.HISTORY_CLEAR: {
          this.controller.clearHistory();
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { cleared: true },
          };
        }

        case IPC_COMMANDS.DOWNLOADS_LIST: {
          const limit = params?.limit ? parseInt(params.limit, 10) : 20;
          const downloads = this.controller.getDownloads(limit);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: downloads,
          };
        }

        case IPC_COMMANDS.SYSTEM_SHOW_GUI: {
          this.emit('system:show-gui');
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { message: 'Graphical window requested' },
          };
        }

        case IPC_COMMANDS.SYSTEM_QUIT: {
          this.emit('system:quit');
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { message: 'DualSurf shutdown initiated' },
          };
        }

        case IPC_COMMANDS.SYSTEM_EXEC: {
          const cmd = params?.command;
          if (!cmd) {
            return {
              protocolVersion: PROTOCOL_VERSION,
              requestId,
              success: false,
              error: {
                code: 'INVALID_PARAMS',
                message: 'Missing "command" parameter',
              },
            };
          }
          const isWindows = process.platform === 'win32';
          const shell = isWindows ? (process.env.COMSPEC || 'cmd.exe') : (process.env.SHELL || '/bin/sh');
          const shellArgs = isWindows ? ['/d', '/s', '/c', cmd] : ['-c', cmd];
          const timeoutMs = params?.timeoutMs ? parseInt(params.timeoutMs, 10) : 15000;

          const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
            let stdout = '';
            let stderr = '';
            const child = spawn(shell, shellArgs, {
              cwd: params?.cwd || process.cwd(),
              env: { ...process.env, PAGER: 'cat' },
              stdio: ['ignore', 'pipe', 'pipe'],
            });

            const timer = setTimeout(() => {
              child.kill('SIGTERM');
            }, timeoutMs);

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

          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: result.exitCode === 0,
            data: result,
          };
        }

        case IPC_COMMANDS.PROXY_GET_STATUS: {
          const status = this.controller.getLocalProxyStatus();
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: status,
          };
        }

        case IPC_COMMANDS.PROXY_GET_RULES: {
          const rules = this.controller.getInterceptRules();
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: rules,
          };
        }

        case IPC_COMMANDS.PROXY_SET_RULES: {
          this.controller.setInterceptRules(params?.rules || []);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { updated: true },
          };
        }

        case IPC_COMMANDS.PROXY_TOGGLE_BREAKPOINT: {
          const active = this.controller.toggleBreakpoint(params?.active);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { isBreakpointActive: active },
          };
        }

        case IPC_COMMANDS.PROXY_GET_PENDING: {
          const pending = this.controller.getPendingIntercepts();
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: pending,
          };
        }

        case IPC_COMMANDS.PROXY_FORWARD: {
          const ok = this.controller.forwardIntercept(params?.id, params?.modifiedHeaders);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: ok,
            data: { forwarded: ok },
          };
        }

        case IPC_COMMANDS.PROXY_DROP: {
          const ok = this.controller.dropIntercept(params?.id);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: ok,
            data: { dropped: ok },
          };
        }

        case IPC_COMMANDS.PROXY_START: {
          const res = await this.controller.startLocalProxy(params?.port, params?.host);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: res.success,
            data: res,
          };
        }

        case IPC_COMMANDS.PROXY_STOP: {
          await this.controller.stopLocalProxy();
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: true,
            data: { stopped: true },
          };
        }

        case IPC_COMMANDS.REPEATER_SEND: {
          const res = await this.controller.sendRawRequest(params || { url: '', method: 'GET', headers: {} });
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: res.success,
            data: res,
          };
        }

        default: {
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success: false,
            error: {
              code: 'UNKNOWN_COMMAND',
              message: `Command "${command}" is not recognized by the DualSurf controller`,
            },
          };
        }
      }
    } catch (err) {
      return {
        protocolVersion: PROTOCOL_VERSION,
        requestId,
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: (err as Error).message,
        },
      };
    }
  }
}
