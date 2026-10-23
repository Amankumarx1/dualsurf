import * as net from 'net';
import {
  getIpcSocketPath,
  IPCRequest,
  IPCResponse,
  PROTOCOL_VERSION,
} from '@dualsurf/ipc-protocol';

export class IpcClient {
  private socketPath: string;

  constructor(socketPath?: string) {
    this.socketPath = socketPath || getIpcSocketPath();
  }

  public async sendCommand<T = any>(command: string, params?: any, timeoutMs = 15000): Promise<T> {
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const socket = net.createConnection(this.socketPath);
      let buffer = '';

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          socket.destroy();
          reject(new Error(`IPC request for command "${command}" timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const cleanupAndReject = (err: Error) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          socket.destroy();
          reject(err);
        }
      };

      const cleanupAndResolve = (data: T) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          socket.end();
          resolve(data);
        }
      };

      const requestId = `cli-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const request: IPCRequest = {
        protocolVersion: PROTOCOL_VERSION,
        requestId,
        command,
        params,
      };

      socket.on('connect', () => {
        socket.write(JSON.stringify(request) + '\n');
      });

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        if (buffer.includes('\n')) {
          const line = buffer.split('\n')[0].trim();
          try {
            const response: IPCResponse<T> = JSON.parse(line);
            if (!response.success) {
              const err = new Error(
                response.error?.message || `Command failed with error code: ${response.error?.code}`
              );
              (err as any).code = response.error?.code;
              return cleanupAndReject(err);
            }

            cleanupAndResolve(response.data as T);
          } catch (err) {
            cleanupAndReject(new Error(`Failed to parse response: ${(err as Error).message}`));
          }
        }
      });

      socket.on('error', (err: any) => {
        if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
          cleanupAndReject(
            new Error(
              'Browser controller unavailable. Please start DualSurf first (run "dualsurf" to launch GUI or controller).'
            )
          );
        } else {
          cleanupAndReject(new Error(`IPC Error: ${err.message}`));
        }
      });

      socket.on('close', () => {
        if (!isSettled) {
          cleanupAndReject(new Error('IPC socket closed before a complete response was received'));
        }
      });
    });
  }

  public async isControllerAvailable(): Promise<boolean> {
    try {
      await this.sendCommand('system.ping');
      return true;
    } catch {
      return false;
    }
  }
}
