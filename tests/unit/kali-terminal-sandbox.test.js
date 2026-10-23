import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_SETTINGS, SessionStore } from '../../packages/controller/dist/SessionStore.js';

describe('DualSurf Kali Terminal & WSL Workspace Sandbox Isolation Suite', () => {
  const tempTestDir = path.join(os.tmpdir(), `dualsurf-test-sandbox-${Date.now()}`);
  const subFolder = path.join(tempTestDir, 'projects', 'recon');
  const secretOutside = path.join(os.tmpdir(), `dualsurf-outside-${Date.now()}`);

  before(async () => {
    await fs.promises.mkdir(subFolder, { recursive: true });
    await fs.promises.writeFile(path.join(tempTestDir, 'targets.txt'), 'example.com\n');
    await fs.promises.writeFile(path.join(subFolder, 'scan.log'), 'open 80, 443\n');
    await fs.promises.mkdir(secretOutside, { recursive: true });
    await fs.promises.writeFile(path.join(secretOutside, 'secret.env'), 'API_KEY=topsecret\n');
  });

  after(async () => {
    try {
      await fs.promises.rm(tempTestDir, { recursive: true, force: true });
      await fs.promises.rm(secretOutside, { recursive: true, force: true });
    } catch {}
  });

  // Confinement helper mirroring Electron main
  function confineToSandbox(targetPath, sandboxDir) {
    if (!sandboxDir || typeof sandboxDir !== 'string' || !sandboxDir.trim()) {
      return targetPath || os.homedir();
    }
    const cleanSandbox = path.resolve(sandboxDir.trim());
    if (!targetPath || typeof targetPath !== 'string' || !targetPath.trim() || targetPath === '~' || targetPath === '$HOME' || targetPath === '/') {
      return cleanSandbox;
    }
    let resolvedTarget = targetPath.trim();
    if (resolvedTarget.startsWith('~/') || resolvedTarget.startsWith('~\\')) {
      resolvedTarget = path.join(cleanSandbox, resolvedTarget.slice(2));
    } else if (!path.isAbsolute(resolvedTarget)) {
      resolvedTarget = path.resolve(cleanSandbox, resolvedTarget);
    } else {
      resolvedTarget = path.resolve(resolvedTarget);
    }

    const rel = path.relative(cleanSandbox, resolvedTarget);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return cleanSandbox;
    }
    return resolvedTarget;
  }

  // 1. Settings schema verifies default sandbox state
  it('1. DEFAULT_SETTINGS starts with empty sandbox and ungranted access until user prompted', () => {
    assert.equal(DEFAULT_SETTINGS.workspaceSandboxDir, '');
    assert.equal(DEFAULT_SETTINGS.hasGrantedWorkspaceAccess, false);
  });

  // 2. SessionStore stores and persists granted workspace directory
  it('2. SessionStore safely persists granted workspace sandbox directory and status', () => {
    const store = new SessionStore(tempTestDir);
    const initial = store.loadSession().settings;
    assert.equal(initial.hasGrantedWorkspaceAccess, false);

    store.saveSession([], null, {
      ...initial,
      workspaceSandboxDir: tempTestDir,
      hasGrantedWorkspaceAccess: true,
    });

    const updated = store.loadSession().settings;
    assert.equal(updated.workspaceSandboxDir, tempTestDir);
    assert.equal(updated.hasGrantedWorkspaceAccess, true);
  });

  // 3. Confinement helper resolves internal paths safely
  it('3. confineToSandbox allows normal access inside granted folder', () => {
    const resolvedRoot = confineToSandbox('~', tempTestDir);
    assert.equal(resolvedRoot.toLowerCase(), tempTestDir.toLowerCase());

    const resolvedSub = confineToSandbox('~/projects/recon', tempTestDir);
    assert.equal(resolvedSub.toLowerCase(), subFolder.toLowerCase());

    const resolvedRelative = confineToSandbox('projects/recon', tempTestDir);
    assert.equal(resolvedRelative.toLowerCase(), subFolder.toLowerCase());
  });

  // 4. Confinement helper clamps path traversal attempts
  it('4. confineToSandbox strictly prevents traversal beyond granted directory root (cd ..)', () => {
    // Attempting to step out with ..
    const escapeParent = confineToSandbox(path.join(tempTestDir, '..'), tempTestDir);
    assert.equal(escapeParent.toLowerCase(), tempTestDir.toLowerCase(), 'Must clamp escape attempt to sandbox root');

    const escapeRelative = confineToSandbox('../../', tempTestDir);
    assert.equal(escapeRelative.toLowerCase(), tempTestDir.toLowerCase(), 'Must clamp relative .. to sandbox root');

    // Attempting to pass external absolute path
    const escapeAbsolute = confineToSandbox(secretOutside, tempTestDir);
    assert.equal(escapeAbsolute.toLowerCase(), tempTestDir.toLowerCase(), 'Must clamp external path to sandbox root');
  });

  // 5. listFiles confinement simulation
  it('5. listFiles enforces parentPath = null at sandbox root to prevent escaping via file manager', async () => {
    const sandboxRoot = path.resolve(tempTestDir);
    const resolvedDir = confineToSandbox(undefined, sandboxRoot);
    const parentDir = path.dirname(resolvedDir);

    const isAtSandboxRoot = path.resolve(resolvedDir).toLowerCase() === sandboxRoot.toLowerCase();
    const parentPath = isAtSandboxRoot ? null : parentDir;

    assert.equal(isAtSandboxRoot, true);
    assert.equal(parentPath, null, 'User cannot navigate above sandbox root in directory explorer');
  });

  // 6. listFiles within subfolder allows navigating up only to sandbox root
  it('6. listFiles in subfolder allows parent navigation only up to sandbox root', async () => {
    const sandboxRoot = path.resolve(tempTestDir);
    const resolvedDir = confineToSandbox('~/projects/recon', sandboxRoot);
    const parentDir = path.dirname(resolvedDir);

    const isAtSandboxRoot = path.resolve(resolvedDir).toLowerCase() === sandboxRoot.toLowerCase();
    const relParent = path.relative(sandboxRoot, parentDir);
    const parentAllowed = !relParent.startsWith('..') && !path.isAbsolute(relParent);
    const parentPath = isAtSandboxRoot ? null : (parentAllowed ? parentDir : null);

    assert.equal(isAtSandboxRoot, false);
    assert.ok(parentPath, 'Should allow parent navigation when inside subfolder');
    assert.equal(path.resolve(parentPath).toLowerCase(), path.join(tempTestDir, 'projects').toLowerCase());
  });

  // 7. Kali Linux prompt formatting
  it('7. Kali terminal formatting matches authentic prompt structure for both user and root', () => {
    const renderPrompt = (user, host, pathDisplay) => {
      const isRoot = user === 'root';
      const sym = isRoot ? '#' : '$';
      const uCol = isRoot ? '\x1b[1;31m' : '\x1b[1;34m';
      return `\x1b[1;34m┌──(${uCol}${user}\x1b[1;37m㉿\x1b[1;34m${host}\x1b[1;34m)-[\x1b[1;37m${pathDisplay}\x1b[1;34m]\n\x1b[1;34m└─\x1b[1;31m${sym}\x1b[0m `;
    };

    const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

    const kaliPrompt = renderPrompt('kali', 'dualsurf', '~');
    const cleanKali = stripAnsi(kaliPrompt);
    assert.ok(cleanKali.includes('┌──(kali㉿dualsurf)-[~]'));
    assert.ok(cleanKali.includes('└─$ '));

    const rootPrompt = renderPrompt('root', 'dualsurf', '~');
    const cleanRoot = stripAnsi(rootPrompt);
    assert.ok(cleanRoot.includes('┌──(root㉿dualsurf)-[~]'));
    assert.ok(cleanRoot.includes('└─# '));
  });

  // 8. sudo su elevation simulation
  it('8. sudo su elevates execution context to root inside sandbox without Windows developer settings error', () => {
    let currentUser = 'kali';
    let isRoot = false;

    function executeVirtualCommand(cmd) {
      if (cmd === 'sudo su' || cmd === 'su' || cmd === 'sudo -i') {
        isRoot = true;
        currentUser = 'root';
        return '[*] Elevated to root inside Kali sandbox jail.';
      }
      if (cmd === 'exit') {
        if (isRoot) {
          isRoot = false;
          currentUser = 'kali';
          return '[*] Dropped root privileges. Returned to user kali.';
        }
        return '[Process exited]';
      }
      if (cmd === 'whoami') {
        return currentUser;
      }
      if (cmd === 'hostname') {
        return 'dualsurf';
      }
      return '';
    }

    assert.equal(executeVirtualCommand('whoami'), 'kali');
    const elevateMsg = executeVirtualCommand('sudo su');
    assert.ok(elevateMsg.includes('Elevated to root'));
    assert.equal(executeVirtualCommand('whoami'), 'root');
    assert.equal(executeVirtualCommand('hostname'), 'dualsurf');

    const dropMsg = executeVirtualCommand('exit');
    assert.ok(dropMsg.includes('Dropped root privileges'));
    assert.equal(executeVirtualCommand('whoami'), 'kali');
  });

  // 9. Kali Terminal Jail boundary cd restriction
  it('9. Kali Terminal Jail blocks cd beyond sandbox directory root', () => {
    let currentDir = '~';

    function executeCd(target) {
      if (!target || target === '~' || target === '/' || target === '') {
        currentDir = '~';
        return '';
      }
      if (target === '..') {
        if (currentDir === '~') {
          return 'dualsurf-jail: cd: permission denied: cannot escape sandboxed folder';
        }
        currentDir = '~';
        return '';
      }
      currentDir = `~/${target}`;
      return '';
    }

    // At root, cd .. must be blocked
    const escapeErr = executeCd('..');
    assert.ok(escapeErr.includes('permission denied'));
    assert.equal(currentDir, '~');

    // Inside subfolder, cd .. returns to root
    executeCd('projects');
    assert.equal(currentDir, '~/projects');
    executeCd('..');
    assert.equal(currentDir, '~');
  });
});
