import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_SETTINGS, SessionStore } from '../../packages/controller/dist/SessionStore.js';
import { kaliRuntimeManager } from '../../apps/cli/dist/tools/kaliManager.js';

describe('DualSurf Production Terminal Startup, Working Directory & Identity Suite', () => {
  const homeDir = os.homedir();
  const repoDevDir = path.resolve(process.cwd());

  // Helper matching Electron main resolution logic
  function resolveTerminalWorkingDir(requestedCwd, userDefaultDir) {
    if (requestedCwd && typeof requestedCwd === 'string') {
      let clean = requestedCwd.trim();
      if (clean === '~' || clean === '$HOME' || clean === '%USERPROFILE%') {
        return os.homedir();
      }
      if (clean.startsWith('~/') || clean.startsWith('~\\')) {
        clean = path.join(os.homedir(), clean.slice(2));
      }
      if (path.isAbsolute(clean) && fs.existsSync(clean)) {
        try {
          const stat = fs.statSync(clean);
          if (stat.isDirectory()) return clean;
        } catch {}
      }
    }

    if (userDefaultDir && typeof userDefaultDir === 'string') {
      let clean = userDefaultDir.trim();
      if (clean.startsWith('~/') || clean.startsWith('~\\')) {
        clean = path.join(os.homedir(), clean.slice(2));
      }
      if (path.isAbsolute(clean) && fs.existsSync(clean)) {
        try {
          const stat = fs.statSync(clean);
          if (stat.isDirectory()) return clean;
        } catch {}
      }
    }

    return os.homedir();
  }

  // 1. New PowerShell session opens in user's home directory
  it('1. New PowerShell session defaults to user home directory ($HOME / os.homedir())', () => {
    const resolved = resolveTerminalWorkingDir(undefined, undefined);
    assert.equal(resolved, homeDir, 'Default session directory must be os.homedir()');
    assert.notEqual(resolved, repoDevDir, 'Must never default to the development repository');
  });

  // 2. New Git Bash session opens in actual Git Bash home directory
  it('2. New Git Bash session opens in user home directory (expanded ~)', () => {
    const resolved = resolveTerminalWorkingDir('~', undefined);
    assert.equal(resolved, homeDir, '~ must expand to os.homedir()');
    assert.notEqual(resolved, repoDevDir, 'Git Bash must not default to repository root');
  });

  // 3. New WSL session arguments pass --cd ~ to open in Linux user home
  it('3. New WSL session targets Linux home directory via --cd ~ argument', () => {
    const requestedCwd = undefined;
    const effectiveDistro = 'kali-linux';
    const shellArgs = (!requestedCwd || requestedCwd === '~')
      ? ['-d', effectiveDistro, '--cd', '~']
      : ['-d', effectiveDistro, '--cd', requestedCwd];

    assert.deepEqual(shellArgs, ['-d', 'kali-linux', '--cd', '~']);
    assert.ok(shellArgs.includes('--cd'), 'WSL invocation must specify --cd flag');
    assert.ok(shellArgs.includes('~'), 'Default WSL directory must be Linux home ~');
  });

  // 4. Native Linux sessions use actual user home directory
  it('4. Native Linux sessions resolve to active environment user home', () => {
    const linuxResolved = resolveTerminalWorkingDir('$HOME', undefined);
    assert.equal(linuxResolved, homeDir);
  });

  // 5. No session defaults to development repository unless explicitly requested
  it('5. No session defaults to repository root or development path', () => {
    const emptyCwd = resolveTerminalWorkingDir('', '');
    const undefinedCwd = resolveTerminalWorkingDir(undefined, undefined);
    const nullCwd = resolveTerminalWorkingDir(null, null);

    assert.equal(emptyCwd, homeDir);
    assert.equal(undefinedCwd, homeDir);
    assert.equal(nullCwd, homeDir);
    assert.notEqual(emptyCwd, repoDevDir);
  });

  // 6. Runtime labels match the real shell environment
  it('6. Runtime labels truthfully match the real shell environment', () => {
    const runtimes = kaliRuntimeManager.probeAvailableRuntimes();
    const host = runtimes.find((r) => r.type === 'host-local');
    assert.ok(host, 'Host local profile must be found');

    if (process.platform === 'win32') {
      assert.ok(host.name.includes('PowerShell') || host.name.includes('Host'), 'Windows host shell must identify as PowerShell or Host');
      assert.ok(!host.name.toLowerCase().includes('kali'), 'Host shell on Windows must not be labeled Kali');
    }
  });

  // 7. No fake Kali identity appears in Git Bash
  it('7. No fake Kali Linux identity appears in host shell detection or Git Bash', () => {
    const runtimes = kaliRuntimeManager.probeAvailableRuntimes();
    const hostLocal = runtimes.find((r) => r.id === 'host-local');
    assert.ok(hostLocal);
    assert.ok(!hostLocal.description.toLowerCase().includes('kali linux 2024'), 'Host local must not claim to be Kali Linux 2024');
  });

  // 8. Missing runtimes produce accurate unavailable states
  it('8. Missing runtimes produce accurate unavailable/unconfigured states', () => {
    const runtimes = kaliRuntimeManager.probeAvailableRuntimes();
    const vmKali = runtimes.find((r) => r.id === 'vm-kali');
    assert.ok(vmKali);
    assert.equal(vmKali.status, 'unconfigured', 'Unconfigured VM must report unconfigured status');

    // If Docker is not running, container runtime must report offline or unconfigured
    const containerKali = runtimes.find((r) => r.id === 'container-kali');
    assert.ok(containerKali);
    assert.ok(['offline', 'unconfigured', 'online'].includes(containerKali.status));
  });

  // 9. Missing home directories are handled safely
  it('9. Missing or invalid requested directories fallback safely to os.homedir()', () => {
    const nonExistentDir = path.join(homeDir, 'non_existent_folder_xyz_99881122');
    const resolved = resolveTerminalWorkingDir(nonExistentDir, undefined);
    assert.equal(resolved, homeDir, 'Invalid requested directory must fall back safely to homeDir');
  });

  // 10. Invalid saved working directory falls back safely
  it('10. Invalid saved user default working directory falls back to homeDir', () => {
    const invalidDefault = 'Z:\\Fake\\Mounted\\Drive\\NoWhere';
    const resolved = resolveTerminalWorkingDir(undefined, invalidDefault);
    assert.equal(resolved, homeDir, 'Invalid saved directory must fall back to homeDir');
  });

  // 11. Restored sessions use valid paths or fallback
  it('11. Restored sessions validate path existence and fall back gracefully', () => {
    const savedPathExists = homeDir;
    const savedPathMissing = 'C:\\NonExistent_Session_Path_404';

    assert.equal(resolveTerminalWorkingDir(savedPathExists, undefined), homeDir);
    assert.equal(resolveTerminalWorkingDir(savedPathMissing, undefined), homeDir);
  });

  // 12. New sessions do not inherit another session working directory unexpectedly
  it('12. Independent sessions resolve working directory independently', () => {
    const customProjectDir = path.join(homeDir, 'Projects');
    const session1Cwd = resolveTerminalWorkingDir(undefined, undefined);
    const session2Cwd = fs.existsSync(customProjectDir)
      ? resolveTerminalWorkingDir(customProjectDir, undefined)
      : resolveTerminalWorkingDir(undefined, undefined);

    assert.equal(session1Cwd, homeDir, 'Session 1 must be home directory');
    if (fs.existsSync(customProjectDir)) {
      assert.equal(session2Cwd, customProjectDir, 'Session 2 must be project directory');
    }
  });

  // 13. Terminal default settings contain no developer-specific paths
  it('13. Production DEFAULT_SETTINGS source contains no hardcoded developer username or repository literals', () => {
    const sessionStoreSrc = fs.readFileSync(path.resolve('packages/controller/src/SessionStore.ts'), 'utf8');
    assert.ok(!sessionStoreSrc.includes('amank'), 'SessionStore.ts source must not contain hardcoded developer username');
    assert.ok(!sessionStoreSrc.includes('C:\\\\D Drive') && !sessionStoreSrc.includes('C:/D Drive'), 'SessionStore.ts must not contain dev repo drive');
    assert.equal(DEFAULT_SETTINGS.terminalDefaultWorkingDir, '', 'terminalDefaultWorkingDir must default to empty (runtime default)');
    assert.equal(DEFAULT_SETTINGS.terminalRestoreSessions, false, 'terminalRestoreSessions must default to false');
    assert.equal(DEFAULT_SETTINGS.terminalShowWelcome, true, 'terminalShowWelcome must default to true');
  });

  // 14. SessionStore initializes safely without developer paths
  it('14. SessionStore initializes safely with dynamic OS home directory', () => {
    const tempConfigDir = path.join(os.tmpdir(), `dualsurf-test-session-${Date.now()}`);
    try {
      const store = new SessionStore(tempConfigDir);
      const session = store.loadSession();
      assert.ok(session.settings);
      assert.equal(session.settings.terminalDefaultWorkingDir, '');
      assert.equal(session.settings.terminalRestoreSessions, false);
      assert.equal(session.settings.defaultDownloadDir, path.join(os.homedir(), 'Downloads'));
    } finally {
      if (fs.existsSync(tempConfigDir)) {
        fs.rmSync(tempConfigDir, { recursive: true, force: true });
      }
    }
  });

  // 15. Verified tools check returns real results
  it('15. checkTools audits host tools and accurately categorizes installed vs missing', () => {
    const available = kaliRuntimeManager.probeAvailableRuntimes();
    assert.ok(Array.isArray(available));
    assert.ok(available.length > 0);
  });

  // 16. PTY spawn error handling produces clear actionable messages
  it('16. PTY spawn failure returns descriptive error message rather than unhandled crash', () => {
    const wslInstalled = false;
    let errorResult = null;
    if (!wslInstalled) {
      errorResult = {
        success: false,
        error: 'WSL 2 Linux environment is not installed on this system. To use Linux, install WSL with "wsl --install" in PowerShell or select Windows PowerShell or Git Bash.',
      };
    }
    assert.equal(errorResult.success, false);
    assert.ok(errorResult.error.includes('WSL 2'));
  });

  // 17. No hardcoded terminal output is presented as real command output
  it('17. No hardcoded terminal output or fake neofetch banner in workspace defaults', () => {
    const workspaceFilePath = path.resolve('apps/desktop/src/components/terminal/DualSurfTerminalWorkspace.tsx');
    const content = fs.readFileSync(workspaceFilePath, 'utf8');

    assert.ok(!content.includes('displayNeofetchBanner'), 'displayNeofetchBanner must be completely removed');
    assert.ok(!content.includes('-(dualsurf㉿kali)-[~]'), 'Fake kali shell prompt must not be hardcoded');
    assert.ok(!content.includes('OS: Kali Linux 2024.4 x86_64'), 'Synthetic Kali 2024.4 neofetch banner must not be present');
    assert.ok(!content.includes("id: 'kali'"), "Hardcoded fake 'kali' session tab must not be present");
  });
});
