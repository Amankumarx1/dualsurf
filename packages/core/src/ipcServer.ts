import * as net from 'net';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  ErrorCodes,
  LineDecoder,
  encodeMessage,
  ensureSafeRuntimeDir,
  getIpcEndpoint,
  getTokenFilePath,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from '@dualsurf/ipc-protocol';
import type { CommandRegistry } from './registry.js';
import type { Logger } from './types.js';
import { serializeError } from './errors.js';

export class CoreIpcServer {
  private server: net.Server | null = null;
  private runtimeDir: string;
  private registry: CommandRegistry;
  private logger: Logger;
  private authToken = '';
  private activeSockets = new Set<net.Socket>();

  constructor(options: {
    runtimeDir: string;
    registry: CommandRegistry;
    logger: Logger;
  }) {
    this.runtimeDir = options.runtimeDir;
    this.registry = options.registry;
    this.logger = options.logger;
  }

  public getAuthToken(): string {
    return this.authToken;
  }

  public async start(): Promise<void> {
    // 1. Verify runtime directory safety
    ensureSafeRuntimeDir(this.runtimeDir, true);

    // 2. Generate and write fresh 32-byte hex token (owner-only)
    this.authToken = crypto.randomBytes(32).toString('hex');
    const tokenPath = getTokenFilePath(this.runtimeDir);
    fs.writeFileSync(tokenPath, this.authToken, { mode: 0o600 });

    const socketEndpoint = getIpcEndpoint(this.runtimeDir);

    // 3. Check for stale socket on Unix
    if (process.platform !== 'win32' && fs.existsSync(socketEndpoint)) {
      const isAlive = await this.probeSocket(socketEndpoint);
      if (isAlive) {
        throw new Error(`Another instance is already running at ${socketEndpoint}`);
      }
      try {
        fs.unlinkSync(socketEndpoint);
      } catch (err) {
        this.logger.warn(`Could not remove stale socket at ${socketEndpoint}:`, err);
      }
    }

    // 4. Create and start server
    this.server = net.createServer((socket) => this.handleConnection(socket));

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(socketEndpoint, () => {
        this.server!.removeListener('error', reject);
        // Restrict socket file permissions on Unix
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(socketEndpoint, 0o600);
          } catch {}
        }
        resolve();
      });
    });

    this.logger.info(`DualSurf Core IPC server listening at: ${socketEndpoint}`);
  }

  public async stop(): Promise<void> {
    // Close and destroy all active client connections
    for (const socket of Array.from(this.activeSockets)) {
      try {
        socket.destroy();
      } catch {}
    }
    this.activeSockets.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    // Clean up socket file on Unix
    const socketEndpoint = getIpcEndpoint(this.runtimeDir);
    if (process.platform !== 'win32' && fs.existsSync(socketEndpoint)) {
      try {
        fs.unlinkSync(socketEndpoint);
      } catch {}
    }

    // Clean up token file
    const tokenPath = getTokenFilePath(this.runtimeDir);
    if (fs.existsSync(tokenPath)) {
      try {
        fs.unlinkSync(tokenPath);
      } catch {}
    }
  }

  private handleConnection(socket: net.Socket): void {
    this.activeSockets.add(socket);

    let isAuthenticated = false;
    const decoder = new LineDecoder();

    // Enforce 5-second auth timeout
    const authTimer = setTimeout(() => {
      if (!isAuthenticated) {
        this.logger.warn('IPC connection closed: failed to authenticate within 5 seconds');
        socket.destroy();
      }
    }, 5000);

    // Queue for processing requests sequentially per connection
    let queuePromise = Promise.resolve();

    const enqueue = (fn: () => Promise<void>) => {
      queuePromise = queuePromise.then(fn).catch((err) => {
        this.logger.error('Error handling IPC request:', err);
      });
    };

    socket.on('data', (chunk) => {
      let messages;
      try {
        messages = decoder.push(chunk);
      } catch (err: any) {
        const errorResp: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: err.code || ErrorCodes.PARSE_ERROR,
            message: err.message || 'Parse error',
          },
        };
        socket.write(encodeMessage(errorResp));
        return;
      }

      for (const msg of messages) {
        enqueue(async () => {
          await this.processMessage(socket, msg as JsonRpcRequest, () => {
            isAuthenticated = true;
            clearTimeout(authTimer);
          }, isAuthenticated);
        });
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimer);
      this.activeSockets.delete(socket);
    });

    socket.on('error', (err) => {
      this.logger.debug?.('IPC socket error:', err);
      socket.destroy();
    });
  }

  private async processMessage(
    socket: net.Socket,
    msg: JsonRpcRequest,
    onAuthSuccess: () => void,
    isAuthenticated: boolean
  ): Promise<void> {
    const id = msg && msg.id !== undefined ? msg.id : null;

    // Validate JSON-RPC 2.0 structure
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      const errorResp: JsonRpcResponse = {
        jsonrpc: '2.0',
        id,
        error: {
          code: ErrorCodes.INVALID_REQUEST,
          message: 'Invalid request: must be a valid JSON-RPC 2.0 request object',
        },
      };
      socket.write(encodeMessage(errorResp));
      return;
    }

    // 1. Handle 'auth' method
    if (msg.method === 'auth') {
      const token = (msg.params as any)?.token;
      const incomingBuf = Buffer.from(typeof token === 'string' ? token : '', 'utf8');
      const expectedBuf = Buffer.from(this.authToken, 'utf8');

      if (
        incomingBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(incomingBuf, expectedBuf)
      ) {
        onAuthSuccess();
        const successResp: JsonRpcResponse = {
          jsonrpc: '2.0',
          id,
          result: { authenticated: true },
        };
        socket.write(encodeMessage(successResp));
        return;
      }

      // Authentication failure
      const errorResp: JsonRpcResponse = {
        jsonrpc: '2.0',
        id,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Unauthorized: invalid authentication token',
        },
      };
      socket.write(encodeMessage(errorResp));
      socket.destroy();
      return;
    }

    // 2. Reject unauthenticated requests
    if (!isAuthenticated) {
      const errorResp: JsonRpcResponse = {
        jsonrpc: '2.0',
        id,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Unauthorized: connection must be authenticated before sending requests',
        },
      };
      socket.write(encodeMessage(errorResp));
      socket.destroy();
      return;
    }

    // 3. Process authenticated methods
    try {
      if (msg.method === 'commands.list') {
        const summaries = this.registry.listSummaries();
        const successResp: JsonRpcResponse = {
          jsonrpc: '2.0',
          id,
          result: summaries,
        };
        socket.write(encodeMessage(successResp));
        return;
      }

      if (msg.method === 'commands.execute') {
        const params = (msg.params as any) || {};
        const cmdId = params.id;
        const input = params.input;

        if (!cmdId || typeof cmdId !== 'string') {
          const errorResp: JsonRpcResponse = {
            jsonrpc: '2.0',
            id,
            error: {
              code: ErrorCodes.INVALID_PARAMS,
              message: "Missing or invalid 'id' parameter in commands.execute",
            },
          };
          socket.write(encodeMessage(errorResp));
          return;
        }

        const data = await this.registry.execute(cmdId, input, 'cli');
        const serializedResult = data === undefined ? null : data;

        const successResp: JsonRpcResponse = {
          jsonrpc: '2.0',
          id,
          result: serializedResult,
        };
        socket.write(encodeMessage(successResp));
        return;
      }

      // Unknown method
      const errorResp: JsonRpcResponse = {
        jsonrpc: '2.0',
        id,
        error: {
          code: ErrorCodes.METHOD_NOT_FOUND,
          message: `Unknown method '${msg.method}'`,
        },
      };
      socket.write(encodeMessage(errorResp));
    } catch (err: unknown) {
      const serialized = serializeError(err);
      const errorResp: JsonRpcResponse = {
        jsonrpc: '2.0',
        id,
        error: serialized,
      };
      socket.write(encodeMessage(errorResp));
    }
  }

  private probeSocket(endpoint: string): Promise<boolean> {
    return new Promise((resolve) => {
      const probe = net.connect(endpoint);
      probe.once('connect', () => {
        probe.destroy();
        resolve(true);
      });
      probe.once('error', () => {
        probe.destroy();
        resolve(false);
      });
    });
  }
}

