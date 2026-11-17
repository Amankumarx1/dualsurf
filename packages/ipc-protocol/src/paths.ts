import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * Resolves the platform-specific DualSurf runtime directory.
 * Can be overridden by the DUALSURF_RUNTIME_DIR environment variable (used by tests).
 */
export function getRuntimeDir(): string {
  if (process.env.DUALSURF_RUNTIME_DIR) {
    return path.resolve(process.env.DUALSURF_RUNTIME_DIR);
  }

  if (process.platform === 'win32') {
    const localAppData =
      process.env.LOCALAPPDATA ||
      path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'dualsurf', 'run');
  }

  if (process.env.XDG_RUNTIME_DIR) {
    return path.join(process.env.XDG_RUNTIME_DIR, 'dualsurf');
  }

  const uid = typeof process.getuid === 'function' ? process.getuid() : 'default';
  return path.join(os.tmpdir(), `dualsurf-${uid}`);
}

/**
 * Returns the IPC endpoint address:
 * - Unix: socket file path inside runtimeDir (`dualsurf.sock`)
 * - Windows: named pipe `\\.\pipe\dualsurf-<username>-<hash>`
 */
export function getIpcEndpoint(runtimeDir: string = getRuntimeDir()): string {
  if (process.platform === 'win32') {
    const user = (process.env.USERNAME || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const dirHash = crypto
      .createHash('sha256')
      .update(path.resolve(runtimeDir).toLowerCase())
      .digest('hex')
      .substring(0, 8);
    return `\\\\.\\pipe\\dualsurf-${user}-${dirHash}`;
  }

  return path.join(runtimeDir, 'dualsurf.sock');
}

/**
 * Returns the path to the authentication token file inside runtimeDir.
 */
export function getTokenFilePath(runtimeDir: string = getRuntimeDir()): string {
  return path.join(runtimeDir, 'dualsurf.token');
}

/**
 * Verifies that the runtime directory is a real directory owned by the current user
 * with restrictive permissions (no group or other access on Unix, not a symlink).
 *
 * Both the IPC server and client MUST invoke this check before opening or connecting.
 */
export function ensureSafeRuntimeDir(dir: string, createIfMissing = true): void {
  const resolved = path.resolve(dir);

  if (!fs.existsSync(resolved)) {
    if (!createIfMissing) {
      throw new Error(`Runtime directory does not exist: ${resolved}`);
    }
    // Create with restrictive 0700 permissions
    fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  }

  const stat = fs.lstatSync(resolved);

  if (stat.isSymbolicLink()) {
    throw new Error(`Security violation: runtime directory cannot be a symbolic link (${resolved})`);
  }

  if (!stat.isDirectory()) {
    throw new Error(`Runtime path is not a directory: ${resolved}`);
  }

  // POSIX ownership and permissions verification
  if (process.platform !== 'win32' && typeof process.getuid === 'function') {
    const currentUid = process.getuid();
    if (stat.uid !== currentUid) {
      throw new Error(
        `Security violation: runtime directory is owned by UID ${stat.uid}, expected ${currentUid}`
      );
    }

    const mode = stat.mode & 0o777;
    // Disallow group and others permissions (must be 0700)
    if ((mode & 0o077) !== 0) {
      // Try to fix permissions if we own the directory
      try {
        fs.chmodSync(resolved, 0o700);
      } catch {
        throw new Error(
          `Security violation: runtime directory permissions too open (${mode.toString(8)}), expected 0700`
        );
      }
    }
  }
}

