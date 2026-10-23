import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  executeShellCommand,
  executeInteractiveShellCommand,
  auditInstalledTools,
  formatToolsAudit,
} from '../../apps/cli/dist/tools/shellExecutor.js';
import {
  BROWSER_TOOL_DEFINITIONS,
  executeBrowserTool,
} from '../../apps/cli/dist/agent/browserTools.js';

describe('System Shell Executor & Tool Integration', () => {
  it('defines run_terminal_command in BROWSER_TOOL_DEFINITIONS', () => {
    const tool = BROWSER_TOOL_DEFINITIONS.find(
      (t) => t.function.name === 'run_terminal_command'
    );
    assert.ok(tool, 'run_terminal_command must be present in BROWSER_TOOL_DEFINITIONS');
    assert.ok(tool.function.parameters.properties.command);
  });

  it('audits installed tools and returns structured status', () => {
    const results = auditInstalledTools(['node', 'git', 'nonexistent_test_tool_xyz_123']);
    assert.equal(results.length, 3);

    const nodeTool = results.find((t) => t.name === 'node');
    assert.ok(nodeTool);
    assert.equal(nodeTool.available, true);
    assert.ok(nodeTool.path && nodeTool.path.length > 0);

    const fakeTool = results.find((t) => t.name === 'nonexistent_test_tool_xyz_123');
    assert.ok(fakeTool);
    assert.equal(fakeTool.available, false);
  });

  it('formats tool audit summary with table indicators', () => {
    const formatted = formatToolsAudit([
      { name: 'nmap', available: true, path: '/usr/bin/nmap' },
      { name: 'tcpdump', available: false },
    ]);
    assert.ok(formatted.includes('AVAILABLE SYSTEM TOOLS'));
    assert.ok(formatted.includes('nmap'));
    assert.ok(formatted.includes('Available'));
    assert.ok(formatted.includes('tcpdump'));
    assert.ok(formatted.includes('Not found'));
  });

  it('executes a basic shell command synchronously', async () => {
    const isWindows = process.platform === 'win32';
    const testCmd = isWindows ? 'echo DualSurfOfflineMode' : 'echo "DualSurfOfflineMode"';

    const res = await executeShellCommand(testCmd);
    assert.equal(res.exitCode, 0);
    assert.ok(res.stdout.includes('DualSurfOfflineMode'));
    assert.ok(res.durationMs >= 0);
  });

  it('handles non-zero exit codes gracefully', async () => {
    const isWindows = process.platform === 'win32';
    const failCmd = isWindows ? 'exit 7' : 'exit 7';

    const res = await executeShellCommand(failCmd);
    assert.equal(res.exitCode, 7);
  });

  it('executes run_terminal_command via executeBrowserTool', async () => {
    const mockClient = {
      sendCommand: async () => ({}),
    };

    const isWindows = process.platform === 'win32';
    const testCmd = isWindows ? 'echo HelloFromAgent' : 'echo "HelloFromAgent"';

    const toolRes = await executeBrowserTool(mockClient, 'run_terminal_command', {
      command: testCmd,
    });

    assert.equal(toolRes.tool, 'run_terminal_command');
    assert.equal(toolRes.success, true);
    assert.ok(toolRes.data.output.includes('HelloFromAgent'));
  });

  it('executes interactive shell command and returns exit code', async () => {
    const isWindows = process.platform === 'win32';
    const testCmd = isWindows ? 'echo InteractiveTest' : 'echo "InteractiveTest"';

    const exitCode = await executeInteractiveShellCommand(testCmd);
    assert.equal(exitCode, 0);
  });

  it('handles non-zero exit code in interactive shell command', async () => {
    const failCmd = 'exit 42';
    const exitCode = await executeInteractiveShellCommand(failCmd);
    assert.equal(exitCode, 42);
  });
});
