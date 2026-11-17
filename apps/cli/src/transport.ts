import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  LineDecoder,
  encodeMessage,
  ensureSafeRuntimeDir,
  getIpcEndpoint,
  getRuntimeDir,
  getTokenFilePath,
  ErrorCodes,
  type CommandSummary,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from '@dualsurf/ipc-protocol';

export interface CliTransport {
  readonly mode: 'attached' | 'headless';
  listCommands(): Promise<CommandSummary[]>;
  execute(id: string, input?: unknown): Promise<unknown>;
  close(): Promise<void>;
}

export class CliConnectionError extends Error {
  public readonly code = 2;
  constructor(message: string) {
    super(message);
    this.name = 'CliConnectionError';
  }
}

/**
 * Connects to a running DualSurf desktop/core instance over local IPC.
 */
export class AttachedTransport implements CliTransport {
  public readonly mode = 'attached' as const;

  private socket: net.Socket | null = null;
  private pendingRequests = new Map<
    string | number,
    { resolve: (val: unknown) => void; reject: (err: Error) => void }
  >();
  private nextRequestId = 1;
  private isConnected = false;
  private runtimeDir: string;

  constructor(runtimeDir: string = getRuntimeDir()) {
    this.runtimeDir = runtimeDir;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;

    // 1. Verify runtime directory safety
    try {
      ensureSafeRuntimeDir(this.runtimeDir, false);
    } catch (err: any) {
      throw new CliConnectionError(
        `DualSurf is not currently running: ${err.message}\n` +
        `Start the DualSurf desktop app, or run in-process using --headless.`
      );
    }

    // 2. Read token file
    const tokenPath = getTokenFilePath(this.runtimeDir);
    if (!fs.existsSync(tokenPath)) {
      throw new CliConnectionError(
        `DualSurf is not currently running (no authentication token found at ${tokenPath}).\n` +
        `Start the DualSurf desktop app, or run in-process using --headless.`
      );
    }

    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    const endpoint = getIpcEndpoint(this.runtimeDir);

    // 3. Connect with 3-second timeout
    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const sock = net.connect(endpoint);

      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          sock.destroy();
          reject(
            new CliConnectionError(
              `Connection to DualSurf timed out after 3 seconds (${endpoint}).\n` +
              `Make sure DualSurf is active and responsive, or use --headless.`
            )
          );
        }
      }, 3000);

      sock.once('connect', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          this.socket = sock;
          this.initSocket(sock);
          resolve();
        }
      });

      sock.once('error', (err: any) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          sock.destroy();
          reject(
            new CliConnectionError(
              `DualSurf is not currently running (${err.message}).\n` +
              `Start the DualSurf desktop app, or use --headless to run in-process.`
            )
          );
        }
      });
    });

    // 4. Authenticate as the very first message
    await this.sendRequest('auth', { token });
    this.isConnected = true;
  }

  public async listCommands(): Promise<CommandSummary[]> {
    await this.connect();
    return (await this.sendRequest('commands.list')) as CommandSummary[];
  }

  public async execute(id: string, input?: unknown): Promise<unknown> {
    await this.connect();
    return await this.sendRequest('commands.execute', { id, input });
  }

  public async close(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
    this.rejectAllPending(new Error('Connection closed'));
  }

  private initSocket(socket: net.Socket): void {
    const decoder = new LineDecoder();

    socket.on('data', (chunk) => {
      let messages: JsonRpcResponse[];
      try {
        messages = decoder.push(chunk) as JsonRpcResponse[];
      } catch (err: any) {
        this.rejectAllPending(err);
        return;
      }

      for (const msg of messages) {
        if (msg.id !== null && msg.id !== undefined) {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            this.pendingRequests.delete(msg.id);
            if ('error' in msg && msg.error) {
              const err = new Error(msg.error.message || 'Command error');
              (err as any).code = msg.error.code;
              (err as any).data = msg.error.data;
              pending.reject(err);
            } else {
              pending.resolve((msg as any).result);
            }
          }
        }
      }
    });

    socket.on('close', () => {
      this.isConnected = false;
      this.rejectAllPending(new CliConnectionError('Connection to DualSurf closed'));
    });

    socket.on('error', (err) => {
      this.rejectAllPending(err);
    });
  }

  private sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject(new CliConnectionError('Socket is not connected'));
    }

    const id = this.nextRequestId++;
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.socket!.write(encodeMessage(req));
    });
  }

  private rejectAllPending(err: Error): void {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }
}

/**
 * Headless transport running the core directly in-process without an Electron GUI.
 * Lazily loads @dualsurf/core and feature plugins.
 */
export class HeadlessTransport implements CliTransport {
  public readonly mode = 'headless' as const;
  private coreInstance: any = null;

  public async getCore(): Promise<any> {
    if (!this.coreInstance) {
      const { createCore } = await import('@dualsurf/core');
      const { blueSocPlugins } = await import('@dualsurf/plugin-blue-soc');

      const dataDir =
        process.env.DUALSURF_DATA_DIR ||
        path.join(os.homedir(), '.dualsurf');

      this.coreInstance = await createCore({
        dataDir,
        plugins: blueSocPlugins,
        logger: {
          info: () => {},
          warn: (msg, ...args) => console.error(`[DualSurf:Core] ${msg}`, ...args),
          error: (msg, ...args) => console.error(`[DualSurf:Core] ${msg}`, ...args),
        },
      });
    }
    return this.coreInstance;
  }

  public async listCommands(): Promise<CommandSummary[]> {
    const core = await this.getCore();
    return core.registry.listSummaries();
  }

  public async execute(id: string, input?: unknown): Promise<unknown> {
    const core = await this.getCore();
    return await core.execute(id, input, 'cli');
  }

  public async close(): Promise<void> {
    if (this.coreInstance) {
      await this.coreInstance.dispose();
      this.coreInstance = null;
    }
  }
}
