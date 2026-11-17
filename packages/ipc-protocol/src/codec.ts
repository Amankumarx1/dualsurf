import { ErrorCodes } from './errors.js';
import type { JsonRpcMessage } from './types.js';

export const MAX_MESSAGE_BYTES = 4 * 1024 * 1024; // 4 MB

export class ProtocolError extends Error {
  public code: number;
  public data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
    this.data = data;
  }
}

/**
 * Encodes a JSON-RPC 2.0 message as a UTF-8 newline-terminated string.
 */
export function encodeMessage(msg: unknown): string {
  const json = JSON.stringify(msg);
  return json + '\n';
}

/**
 * Line-delimited stream decoder for JSON-RPC messages.
 * Handles split chunks, multi-byte UTF-8 boundaries, and enforces the 4 MB limit.
 */
export class LineDecoder {
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * Appends incoming data chunk and returns any fully received JSON-RPC messages.
   */
  public push(chunk: Buffer | Uint8Array | string): JsonRpcMessage[] {
    const chunkBuf = typeof chunk === 'string'
      ? Buffer.from(chunk, 'utf8')
      : Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);

    if (this.buffer.length + chunkBuf.length > MAX_MESSAGE_BYTES * 2) {
      // Emergency overflow guard
      this.buffer = Buffer.alloc(0);
      throw new ProtocolError(
        ErrorCodes.INVALID_REQUEST,
        `Message buffer exceeded maximum size of ${MAX_MESSAGE_BYTES} bytes`
      );
    }

    this.buffer = Buffer.concat([this.buffer, chunkBuf]);
    const messages: JsonRpcMessage[] = [];

    while (true) {
      const newlineIndex = this.buffer.indexOf(0x0a); // '\n'
      if (newlineIndex === -1) {
        if (this.buffer.length > MAX_MESSAGE_BYTES) {
          this.buffer = Buffer.alloc(0);
          throw new ProtocolError(
            ErrorCodes.INVALID_REQUEST,
            `Message length exceeded maximum size of ${MAX_MESSAGE_BYTES} bytes`
          );
        }
        break;
      }

      if (newlineIndex > MAX_MESSAGE_BYTES) {
        this.buffer = this.buffer.subarray(newlineIndex + 1);
        throw new ProtocolError(
          ErrorCodes.INVALID_REQUEST,
          `Message length exceeded maximum size of ${MAX_MESSAGE_BYTES} bytes`
        );
      }

      // Slice out the line (handling optional preceding '\r')
      let lineBuf = this.buffer.subarray(0, newlineIndex);
      this.buffer = this.buffer.subarray(newlineIndex + 1);

      if (lineBuf.length > 0 && lineBuf[lineBuf.length - 1] === 0x0d) {
        lineBuf = lineBuf.subarray(0, lineBuf.length - 1);
      }

      // Empty lines between messages are ignored
      if (lineBuf.length === 0) {
        continue;
      }

      const text = lineBuf.toString('utf8');
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new ProtocolError(
            ErrorCodes.INVALID_REQUEST,
            'JSON-RPC message must be a JSON object'
          );
        }
        messages.push(parsed as JsonRpcMessage);
      } catch (err: unknown) {
        if (err instanceof ProtocolError) {
          throw err;
        }
        throw new ProtocolError(
          ErrorCodes.PARSE_ERROR,
          `Malformed JSON on the wire: ${(err as Error).message}`
        );
      }
    }

    return messages;
  }

  /**
   * Resets the buffer state.
   */
  public reset(): void {
    this.buffer = Buffer.alloc(0);
  }
}

