import * as net from 'net';
import * as fs from 'fs';
import {
  getIpcSocketPath,
  IPCRequest,
  IPCResponse,
  IPC_COMMANDS,
  PROTOCOL_VERSION,
} from '@dualsurf/ipc-protocol';
import type { BrowserController } from './BrowserController.js';

export class IpcServer {
  private server: net.Server | null = null;
  private socketPath: string;
  private controller: BrowserController;

  constructor(controller: BrowserController) {
    this.controller = controller;
    this.socketPath = getIpcSocketPath();
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

      this.server.on('error', (err) => {
        console.error('[IpcServer] Server error:', err);
        reject(err);
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

        case IPC_COMMANDS.NAV_BACK: {
          const success = this.controller.goBack(params?.tabId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success,
            data: { action: 'goBack' },
          };
        }

        case IPC_COMMANDS.NAV_FORWARD: {
          const success = this.controller.goForward(params?.tabId);
          return {
            protocolVersion: PROTOCOL_VERSION,
            requestId,
            success,
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
