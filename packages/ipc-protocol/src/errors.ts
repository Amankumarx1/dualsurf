/**
 * DualSurf JSON-RPC 2.0 and Core Error Codes
 * Defined by 01_PROJECT_CONTEXT.md
 */
export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  COMMAND_FAILED: -32000,
  SCOPE_VIOLATION: -32001,
  UNAUTHORIZED: -32002,
  PERMISSION_DENIED: -32003,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface FieldValidationIssue {
  field: string;
  message: string;
}

export interface SerializedError {
  code: number;
  message: string;
  data?: {
    issues?: FieldValidationIssue[];
    target?: string;
    pluginId?: string;
    permission?: string;
    [key: string]: unknown;
  };
}

