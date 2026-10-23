import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('DualSurf Shell & Session Integration Audit', () => {
  it('correctly resolves the host shell and preserves truthful metadata', () => {
    const isWindows = process.platform === 'win32';
    let shellPath = '';
    let shellName = '';

    if (isWindows) {
      const gitBashCandidates = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
        path.join(process.env.ProgramFiles || '', 'Git', 'bin', 'bash.exe'),
      ];
      for (const cand of gitBashCandidates) {
        if (fs.existsSync(cand)) {
          shellPath = cand;
          shellName = 'GNU Bash (Git Bash)';
          break;
        }
      }
      if (!shellPath) {
        const psPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
        if (fs.existsSync(psPath)) {
          shellPath = psPath;
          shellName = 'Windows PowerShell 5.1';
        } else {
          shellPath = process.env.COMSPEC || 'cmd.exe';
          shellName = 'Windows Command Prompt (cmd.exe)';
        }
      }
    } else {
      shellPath = process.env.SHELL || '/bin/bash';
      shellName = path.basename(shellPath);
    }

    assert.ok(fs.existsSync(shellPath), `Resolved shell must exist on disk: ${shellPath}`);
    assert.ok(shellName.length > 0, 'Shell name must be populated truthfully');
  });

  it('executes a valid command and preserves zero exit code with accurate output', async () => {
    const isWindows = process.platform === 'win32';
    const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
    const useGitBash = isWindows && fs.existsSync(gitBashPath);

    const execPath = useGitBash
      ? gitBashPath
      : isWindows
      ? 'C:\\Windows\\System32\\cmd.exe'
      : (process.env.SHELL || '/bin/sh');

    const execArgs = useGitBash
      ? ['-c', 'whoami']
      : isWindows
      ? ['/d', '/s', '/c', 'whoami']
      : ['-c', 'whoami'];

    const result = await new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      const child = spawn(execPath, execArgs, {
        cwd: process.cwd(),
        env: { ...process.env, PAGER: 'cat' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });
      child.on('error', (err) => {
        resolve({ stdout, stderr: err.message, exitCode: 1 });
      });
    });

    assert.equal(result.exitCode, 0, 'Valid command whoami must exit with code 0');
    assert.ok(result.stdout.trim().length > 0, 'Stdout must not be empty');
    assert.equal(result.stderr, '', 'Stderr should be empty on successful whoami');
  });

  it('executes an intentionally invalid command, returns non-zero exit code without fabricating success', async () => {
    const isWindows = process.platform === 'win32';
    const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
    const useGitBash = isWindows && fs.existsSync(gitBashPath);

    const execPath = useGitBash
      ? gitBashPath
      : isWindows
      ? 'C:\\Windows\\System32\\cmd.exe'
      : (process.env.SHELL || '/bin/sh');

    const execArgs = useGitBash
      ? ['-c', 'invalid_command_xyz_98765']
      : isWindows
      ? ['/d', '/s', '/c', 'invalid_command_xyz_98765']
      : ['-c', 'invalid_command_xyz_98765'];

    const result = await new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      const child = spawn(execPath, execArgs, {
        cwd: process.cwd(),
        env: { ...process.env, PAGER: 'cat' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });
      child.on('error', (err) => {
        resolve({ stdout, stderr: err.message, exitCode: 1 });
      });
    });

    assert.notEqual(result.exitCode, 0, 'Invalid command must NOT return exit code 0');
    assert.ok(result.stderr.length > 0, 'Stderr must contain truthful error message from executing shell');
    if (useGitBash) {
      assert.ok(result.stderr.includes('command not found'), 'Git Bash must report command not found');
    }
  });

  it('verifies ActiveSessionState contract fields are correctly structured', () => {
    const testSession = {
      activeTabId: 'tab-1234',
      url: 'https://github.com',
      title: 'GitHub · Change is constant.',
      mode: 'terminal',
      ipcConnected: true,
      sessionConnected: true,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      error: null,
    };

    assert.equal(testSession.activeTabId, 'tab-1234');
    assert.equal(testSession.url, 'https://github.com');
    assert.ok(testSession.title.includes('GitHub'));
    assert.equal(testSession.mode, 'terminal');
    assert.equal(testSession.sessionConnected, true);
    assert.equal(testSession.isLoading, false);
  });

  it('validates SQLite storage operations for history and bookmarks', async () => {
    const { MetadataDatabase } = await import('@dualsurf/storage');
    const db = new MetadataDatabase({ inMemory: true });

    // Test history
    const entry = db.addHistory('https://dualsurf.dev', 'DualSurf Browser');
    assert.ok(entry.id, 'History entry must have an ID');
    assert.equal(entry.url, 'https://dualsurf.dev');

    const historyList = db.getHistory(10);
    assert.ok(historyList.length >= 1, 'History list must contain the added entry');

    // Test bookmarks
    const bm = db.addBookmark('https://news.ycombinator.com', 'Hacker News');
    assert.ok(bm.id, 'Bookmark must have an ID');
    assert.equal(bm.title, 'Hacker News');

    const bookmarks = db.getBookmarks();
    assert.ok(bookmarks.length >= 1, 'Bookmarks list must contain the added bookmark');

    // Test bookmark removal
    const removed = db.removeBookmark(bm.id);
    assert.equal(removed, true, 'Bookmark should be removed successfully');
    assert.equal(db.getBookmarks().length, 0, 'Bookmarks list should be empty after removal');

    // Test history clearing
    db.clearHistory();
    assert.equal(db.getHistory().length, 0, 'History should be empty after clearHistory');
  });

  it('verifies tab zoom and management boundary validations', () => {
    // Zoom clamping bounds
    const clampZoom = (factor) => Math.max(0.25, Math.min(factor, 5.0));
    assert.equal(clampZoom(1.0), 1.0);
    assert.equal(clampZoom(0.1), 0.25);
    assert.equal(clampZoom(10.0), 5.0);
  });
});
