import { ErrorCodes, type SerializedError, type FieldValidationIssue } from '@dualsurf/ipc-protocol';

export class CoreError extends Error {
  public readonly code: number;
  public readonly data?: Record<string, unknown>;

  constructor(code: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundCommandError extends CoreError {
  constructor(commandId: string) {
    super(ErrorCodes.METHOD_NOT_FOUND, `Unknown command or method: ${commandId}`, { commandId });
    this.name = 'NotFoundCommandError';
  }
}

export class ValidationCommandError extends CoreError {
  public readonly issues: FieldValidationIssue[];

  constructor(issues: FieldValidationIssue[], message = 'Invalid command input') {
    super(ErrorCodes.INVALID_PARAMS, message, { issues });
    this.name = 'ValidationCommandError';
    this.issues = issues;
  }
}

export class ScopeViolationError extends CoreError {
  public readonly target: string;
  public readonly reason: string;

  constructor(target: string, reason: string) {
    super(
      ErrorCodes.SCOPE_VIOLATION,
      `Target '${target}' is not in authorized scope: ${reason}`,
      { target, reason }
    );
    this.name = 'ScopeViolationError';
    this.target = target;
    this.reason = reason;
  }
}

export class UnauthorizedError extends CoreError {
  constructor(message = 'Unauthorized: invalid or missing IPC authentication token') {
    super(ErrorCodes.UNAUTHORIZED, message);
    this.name = 'UnauthorizedError';
  }
}

export class PermissionDeniedError extends CoreError {
  public readonly pluginId: string;
  public readonly permission: string;

  constructor(pluginId: string, permission: string) {
    super(
      ErrorCodes.PERMISSION_DENIED,
      `Permission denied: plugin '${pluginId}' lacks '${permission}' permission`,
      { pluginId, permission }
    );
    this.name = 'PermissionDeniedError';
    this.pluginId = pluginId;
    this.permission = permission;
  }
}

export class ExecutionFailedError extends CoreError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(ErrorCodes.COMMAND_FAILED, message, data);
    this.name = 'ExecutionFailedError';
  }
}

export class InternalCommandError extends CoreError {
  constructor(message = 'Internal error') {
    super(ErrorCodes.INTERNAL_ERROR, message);
    this.name = 'InternalCommandError';
  }
}

/**
 * Turns any thrown value into a safe, serializable error object.
 * Stack traces are deliberately NOT included to avoid leaking across process boundaries.
 */
export function serializeError(err: unknown): SerializedError {
  if (err instanceof CoreError) {
    return {
      code: err.code,
      message: err.message,
      ...(err.data ? { data: err.data } : {}),
    };
  }

  if (err instanceof Error) {
    return {
      code: ErrorCodes.COMMAND_FAILED,
      message: err.message || 'Command failed with an unexpected error',
    };
  }

  return {
    code: ErrorCodes.INTERNAL_ERROR,
    message: typeof err === 'string' ? err : 'Internal error',
  };
}

