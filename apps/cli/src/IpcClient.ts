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

  public async sendCommand<T = any>(command: string, params?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      let buffer = '';

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
            socket.end();

            if (!response.success) {
              const err = new Error(
                response.error?.message || `Command failed with error code: ${response.error?.code}`
              );
              (err as any).code = response.error?.code;
              return reject(err);
            }

            resolve(response.data as T);
          } catch (err) {
            socket.end();
            reject(new Error(`Failed to parse response: ${(err as Error).message}`));
          }
        }
      });

      socket.on('error', (err: any) => {
        if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
          reject(
            new Error(
              'Browser controller unavailable. Please start DualSurf first (run "dualsurf" to launch GUI or controller).'
            )
          );
        } else {
          reject(new Error(`IPC Error: ${err.message}`));
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
