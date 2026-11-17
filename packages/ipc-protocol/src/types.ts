import type { SerializedError } from './errors.js';

export type CommandCategory =
  | 'network'
  | 'audit'
  | 'recon'
  | 'inspection'
  | 'malware'
  | 'intel'
  | 'system';

export interface CommandFieldSummary {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

export interface CommandSummary {
  id: string;
  title: string;
  description: string;
  category: CommandCategory | string;
  owner: string; // 'core' or plugin id
  scopeRequired: boolean;
  positional?: string[];
  fields: CommandFieldSummary[];
}

export type ResultEnvelope<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: SerializedError };

export interface DualSurfBridge {
  execute<T = unknown>(id: string, input?: unknown): Promise<ResultEnvelope<T>>;
  list(): Promise<CommandSummary[]>;
}

// JSON-RPC 2.0 Types
export type JsonRpcId = string | number | null;

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: T;
}

export interface JsonRpcNotification<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
}

export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: T;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  error: SerializedError;
}

export type JsonRpcResponse<T = unknown> =
  | JsonRpcSuccessResponse<T>
  | JsonRpcErrorResponse;

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse;

