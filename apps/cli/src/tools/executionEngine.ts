import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import type {
  SecurityEvidenceRecord,
  EvidenceState,
  ToolDetectionResult,
  ToolDetectionStatus,
} from '@dualsurf/shared-types';
import { evidenceStore } from './evidenceStore.js';
import { checkToolAvailable, isWslAvailable } from './shellExecutor.js';

export interface ToolExecutionRequest {
  toolId: string;
  commandArgs?: string[];
  target?: string;
  timeoutMs?: number;
  approved?: boolean;
  dryRun?: boolean;
  context?: Record<string, any>;
}

export interface ControlledProcessOptions {
  executable: string;
  args: string[];
  toolId: string;
  toolName: string;
  toolVersion?: string;
  target?: string;
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  sourceCoverage?: {
    endpointLogs: boolean;
    networkLogs: boolean;
    dnsLogs: boolean;
    cloudAudit: boolean;
    identityLogs: boolean;
    missingSources: string[];
  };
}

/**
 * Sanitize arguments and check against command-injection metacharacters.
 */
export function validateArgumentsSafety(args: string[]): { safe: boolean; reason?: string } {
  // Disallow shell operators and chaining in individual argument tokens
  const injectionPattern = /[;&|`$<>\r\n]/;
  for (const arg of args) {
    if (injectionPattern.test(arg)) {
      return {
        safe: false,
        reason: `Potential command-injection character detected in argument: "${arg}"`,
      };
    }
  }
  return { safe: true };
}

/**
 * Redact sensitive secrets, passwords, and tokens before logging or rendering.
 */
export function redactSensitiveData(text: string): string {
  if (!text) return '';
  return text
    .replace(/(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*([^\s,;&]+)/gi, '$1=***REDACTED***')
    .replace(/(--password|-p|--token|--key)\s+([^\s]+)/gi, '$1 ***REDACTED***')
    .replace(/Bearer\s+([a-zA-Z0-9_\-\.]+)/gi, 'Bearer ***REDACTED***')
    .replace(/(AKIA[0-9A-Z]{16})/g, 'AKIA***REDACTED***')
    .replace(/ghp_[0-9a-zA-Z]{36}/g, 'ghp_***REDACTED***');
}

/**
 * Run a child process through a strictly controlled process API using
 * executable paths + structured argument arrays (no shell concatenation).
 */
export async function runControlledProcess(
  options: ControlledProcessOptions
): Promise<SecurityEvidenceRecord> {
  const start = Date.now();
  const executedAt = new Date().toISOString();
  const timeoutMs = options.timeoutMs || 25000;

  // Validate argument safety
  const safetyCheck = validateArgumentsSafety(options.args);
  if (!safetyCheck.safe) {
    const errorMsg = `Command rejected by DualSurf Execution Engine: ${safetyCheck.reason}`;
    return evidenceStore.recordEvidence({
      executionId: `EXEC-REJECTED-${Date.now()}`,
      toolId: options.toolId,
      toolName: options.toolName,
      toolVersion: options.toolVersion,
      executablePath: options.executable,
      target: options.target,
      commandExecuted: `${options.executable} ${options.args.join(' ')}`,
      executedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
      exitCode: 1,
      stdout: '',
      stderr: errorMsg,
      state: 'FAILED',
      parsedFindings: [],
      limitations: 'Execution blocked due to unsafe characters in argument list.',
      sourceCoverage: options.sourceCoverage,
    });
  }

  const sanitizedCommandString = redactSensitiveData(`${options.executable} ${options.args.join(' ')}`);

  return new Promise<SecurityEvidenceRecord>((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;
    let finished = false;

    let child: any;
    const isWindows = process.platform === 'win32';
    const isWsl = isWindows && isWslAvailable() && (options.executable.startsWith('/') || checkToolAvailable(options.executable).runtime === 'wsl');

    try {
      if (isWsl) {
        child = spawn('wsl.exe', ['-e', options.executable, ...options.args], {
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...(options.env || {}), PAGER: 'cat', TERM: 'xterm-256color' },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } else {
        child = spawn(options.executable, options.args, {
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...(options.env || {}), PAGER: 'cat', TERM: 'xterm-256color' },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      }
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const rec = evidenceStore.recordEvidence({
        executionId: `EXEC-ERR-${Date.now()}`,
        toolId: options.toolId,
        toolName: options.toolName,
        toolVersion: options.toolVersion,
        executablePath: options.executable,
        target: options.target,
        commandExecuted: sanitizedCommandString,
        executedAt,
        completedAt: new Date().toISOString(),
        durationMs,
        exitCode: 127,
        stdout: '',
        stderr: `Failed to spawn process (${options.executable}): ${err.message}`,
        state: 'FAILED',
        parsedFindings: [],
        limitations: 'Failed to launch tool binary.',
        sourceCoverage: options.sourceCoverage,
      });
      return resolve(rec);
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
        } else {
          child.kill('SIGKILL');
        }
      } catch {}
    }, timeoutMs);

    child.stdout?.on('data', (d: Buffer) => {
      // Bound output capture to 2MB in memory to prevent memory exhaustion
      if (stdoutData.length < 2 * 1024 * 1024) {
        let chunk = d.toString('utf8');
        if (isWsl) chunk = chunk.replace(/^wsl: Failed to translate[^\r\n]*\r?\n?/gm, '');
        stdoutData += chunk;
      }
    });

    child.stderr?.on('data', (d: Buffer) => {
      if (stderrData.length < 512 * 1024) {
        let chunk = d.toString('utf8');
        if (isWsl) chunk = chunk.replace(/^wsl: Failed to translate[^\r\n]*\r?\n?/gm, '');
        stderrData += chunk;
      }
    });

    child.on('error', (err: any) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      const rec = evidenceStore.recordEvidence({
        executionId: `EXEC-ERR-${Date.now()}`,
        toolId: options.toolId,
        toolName: options.toolName,
        toolVersion: options.toolVersion,
        executablePath: options.executable,
        target: options.target,
        commandExecuted: sanitizedCommandString,
        executedAt,
        completedAt: new Date().toISOString(),
        durationMs,
        exitCode: 1,
        stdout: redactSensitiveData(stdoutData),
        stderr: redactSensitiveData(`${stderrData}\nProcess error: ${err.message}`),
        state: 'FAILED',
        parsedFindings: [],
        sourceCoverage: options.sourceCoverage,
      });
      resolve(rec);
    });

    child.on('close', (exitCode: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      const completedAt = new Date().toISOString();
      const code = exitCode ?? (timedOut ? 124 : 0);

      let state: EvidenceState;
      if (timedOut) {
        state = 'TIMED_OUT';
      } else if (code === 0) {
        state = 'VERIFIED';
      } else {
        state = 'PARTIAL';
      }

      const rec = evidenceStore.recordEvidence({
        executionId: `EXEC-${Date.now()}`,
        toolId: options.toolId,
        toolName: options.toolName,
        toolVersion: options.toolVersion,
        executablePath: options.executable,
        target: options.target,
        commandExecuted: sanitizedCommandString,
        executedAt,
        completedAt,
        durationMs,
        exitCode: code,
        stdout: redactSensitiveData(stdoutData),
        stderr: redactSensitiveData(stderrData),
        state,
        parsedFindings: [],
        sourceCoverage: options.sourceCoverage,
      });

      resolve(rec);
    });
  });
}

// ============================================================================
// TOOL REGISTRY AND ADAPTER DISCOVERY
// ============================================================================

export interface ToolIntegrationMetadata {
  id: string;
  name: string;
  category: string;
  binaryName: string;
  aliases: string[];
  versionFlag: string;
  supportedOs: ('win32' | 'linux' | 'darwin')[];
  requiredPrivilege: 'user' | 'admin' | 'root';
  documentationUrl: string;
  adapterImplemented: boolean;
}

export const REGISTERED_BLUE_TEAM_TOOLS: ToolIntegrationMetadata[] = [
  // 1. SIEM & Log Collection
  {
    id: 'wazuh',
    name: 'Wazuh',
    category: 'SIEM & Endpoint Security',
    binaryName: 'wazuh-agent',
    aliases: ['wazuh-control', 'wazuh-manager'],
    versionFlag: '-v',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'admin',
    documentationUrl: 'https://documentation.wazuh.com',
    adapterImplemented: true,
  },
  {
    id: 'fluent-bit',
    name: 'Fluent Bit',
    category: 'Log Collection',
    binaryName: 'fluent-bit',
    aliases: ['fluentbit'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://docs.fluentbit.io',
    adapterImplemented: true,
  },
  {
    id: 'vector',
    name: 'Vector',
    category: 'Log Collection & Routing',
    binaryName: 'vector',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://vector.dev',
    adapterImplemented: true,
  },

  // 2. Endpoint & Telemetry
  {
    id: 'osquery',
    name: 'osquery',
    category: 'Endpoint Observability',
    binaryName: 'osqueryi',
    aliases: ['osquery', 'osqueryd'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://osquery.io',
    adapterImplemented: true,
  },
  {
    id: 'sysmon',
    name: 'Microsoft Sysmon',
    category: 'Endpoint Telemetry',
    binaryName: 'sysmon64',
    aliases: ['sysmon', 'sysmon.exe'],
    versionFlag: '-?',
    supportedOs: ['win32', 'linux'],
    requiredPrivilege: 'admin',
    documentationUrl: 'https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon',
    adapterImplemented: true,
  },
  {
    id: 'procexp',
    name: 'Process Explorer',
    category: 'Endpoint Telemetry',
    binaryName: 'procexp64',
    aliases: ['procexp', 'ProcessExplorer.exe'],
    versionFlag: '',
    supportedOs: ['win32'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://learn.microsoft.com/en-us/sysinternals/downloads/process-explorer',
    adapterImplemented: true,
  },
  {
    id: 'autoruns',
    name: 'Sysinternals Autoruns',
    category: 'Endpoint Telemetry',
    binaryName: 'autorunsc64',
    aliases: ['autorunsc', 'autoruns.exe'],
    versionFlag: '-a',
    supportedOs: ['win32'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://learn.microsoft.com/en-us/sysinternals/downloads/autoruns',
    adapterImplemented: true,
  },
  {
    id: 'velociraptor',
    name: 'Velociraptor',
    category: 'Endpoint Hunting & Forensics',
    binaryName: 'velociraptor',
    aliases: ['velociraptor.exe'],
    versionFlag: 'version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'admin',
    documentationUrl: 'https://docs.velociraptor.app',
    adapterImplemented: true,
  },
  {
    id: 'hayabusa',
    name: 'Hayabusa',
    category: 'Windows Event Log Hunting',
    binaryName: 'hayabusa',
    aliases: ['hayabusa.exe'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/Yamato-Security/hayabusa',
    adapterImplemented: true,
  },
  {
    id: 'chainsaw',
    name: 'Chainsaw',
    category: 'Windows Event Log Hunting',
    binaryName: 'chainsaw',
    aliases: ['chainsaw.exe'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/WithSecureLabs/chainsaw',
    adapterImplemented: true,
  },

  // 3. Threat Hunting & Detection Engineering
  {
    id: 'yara',
    name: 'YARA',
    category: 'Pattern Matching & Triage',
    binaryName: 'yara',
    aliases: ['yara64', 'yara.exe'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://virustotal.github.io/yara/',
    adapterImplemented: true,
  },
  {
    id: 'zeek',
    name: 'Zeek Network Security Monitor',
    category: 'Network Protocol Telemetry',
    binaryName: 'zeek',
    aliases: ['bro'],
    versionFlag: '--version',
    supportedOs: ['linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://zeek.org',
    adapterImplemented: true,
  },
  {
    id: 'suricata',
    name: 'Suricata IDS/IPS',
    category: 'Network Threat Detection',
    binaryName: 'suricata',
    aliases: ['suricata.exe'],
    versionFlag: '-V',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'root',
    documentationUrl: 'https://suricata.io',
    adapterImplemented: true,
  },
  {
    id: 'wireshark',
    name: 'Wireshark / TShark',
    category: 'Packet Capture & Inspection',
    binaryName: 'tshark',
    aliases: ['wireshark'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://www.wireshark.org',
    adapterImplemented: true,
  },
  {
    id: 'tcpdump',
    name: 'tcpdump',
    category: 'Network Packet Sniffer',
    binaryName: 'tcpdump',
    aliases: ['windump'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'root',
    documentationUrl: 'https://www.tcpdump.org',
    adapterImplemented: true,
  },

  // 4. Digital Forensics & Malware Analysis
  {
    id: 'volatility',
    name: 'Volatility 3',
    category: 'Memory Forensics',
    binaryName: 'vol',
    aliases: ['volatility', 'volatility3', 'vol.py'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/volatilityfoundation/volatility3',
    adapterImplemented: true,
  },
  {
    id: 'clamav',
    name: 'ClamAV',
    category: 'Antivirus File Scanner',
    binaryName: 'clamscan',
    aliases: ['clamav'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://www.clamav.net',
    adapterImplemented: true,
  },
  {
    id: 'ghidra',
    name: 'Ghidra',
    category: 'Reverse Engineering',
    binaryName: 'ghidraRun',
    aliases: ['ghidraRun.bat', 'ghidra'],
    versionFlag: '',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://ghidra-sre.org',
    adapterImplemented: true,
  },

  // 5. Vulnerability Management & Hardening
  {
    id: 'trivy',
    name: 'Trivy',
    category: 'Container & Dependency Scanner',
    binaryName: 'trivy',
    aliases: ['trivy.exe'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://trivy.dev',
    adapterImplemented: true,
  },
  {
    id: 'lynis',
    name: 'Lynis',
    category: 'System Security Auditing',
    binaryName: 'lynis',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['linux', 'darwin'],
    requiredPrivilege: 'root',
    documentationUrl: 'https://cisofy.com/lynis/',
    adapterImplemented: true,
  },
  {
    id: 'semgrep',
    name: 'Semgrep',
    category: 'Static Analysis & AppSec',
    binaryName: 'semgrep',
    aliases: ['semgrep.exe'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://semgrep.dev',
    adapterImplemented: true,
  },
  {
    id: 'checkov',
    name: 'Checkov',
    category: 'Infrastructure as Code Security',
    binaryName: 'checkov',
    aliases: ['checkov.cmd'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://www.checkov.io',
    adapterImplemented: true,
  },
];

/**
 * Audit host system and return actual detection results for all registered integrations.
 * Grounded strictly in reality (searches PATH using non-disruptive checks).
 */
export async function detectHostBlueTeamTools(): Promise<ToolDetectionResult[]> {
  const currentOs = process.platform as 'win32' | 'linux' | 'darwin';
  const results: ToolDetectionResult[] = [];

  for (const meta of REGISTERED_BLUE_TEAM_TOOLS) {
    const isSupportedOs =
      meta.supportedOs.includes(currentOs) ||
      (currentOs === 'win32' && isWslAvailable() && meta.supportedOs.includes('linux'));
    const now = new Date().toISOString();

    if (!isSupportedOs) {
      results.push({
        toolId: meta.id,
        name: meta.name,
        category: meta.category,
        installed: false,
        status: 'UNSUPPORTED_OS',
        supportedOs: meta.supportedOs,
        requiredPrivilege: meta.requiredPrivilege,
        isConfigured: false,
        adapterImplemented: meta.adapterImplemented,
        documentationUrl: meta.documentationUrl,
        lastChecked: now,
      });
      continue;
    }

    // Check executable presence
    let check = checkToolAvailable(meta.binaryName);
    if (!check.available) {
      for (const alias of meta.aliases) {
        check = checkToolAvailable(alias);
        if (check.available) break;
      }
    }

    if (!check.available) {
      results.push({
        toolId: meta.id,
        name: meta.name,
        category: meta.category,
        installed: false,
        status: 'NOT_INSTALLED',
        supportedOs: meta.supportedOs,
        requiredPrivilege: meta.requiredPrivilege,
        isConfigured: false,
        adapterImplemented: meta.adapterImplemented,
        documentationUrl: meta.documentationUrl,
        lastChecked: now,
      });
      continue;
    }

    // Tool is installed on host! Attempt non-disruptive version query if supported
    let versionStr: string | undefined = undefined;
    if (meta.versionFlag && check.path) {
      try {
        const verExec = await runControlledProcess({
          executable: check.path,
          args: [meta.versionFlag],
          toolId: meta.id,
          toolName: meta.name,
          timeoutMs: 3000,
        });
        const firstLine = (verExec.stdout || verExec.stderr).split('\n')[0]?.trim();
        if (firstLine && firstLine.length < 80) {
          versionStr = firstLine;
        }
      } catch {
        // Version flag failed, still report installed
      }
    }

    results.push({
      toolId: meta.id,
      name: meta.name,
      category: meta.category,
      installed: true,
      version: versionStr,
      executablePath: check.path,
      status: 'INSTALLED_ACTIVE',
      supportedOs: meta.supportedOs,
      requiredPrivilege: meta.requiredPrivilege,
      isConfigured: true,
      adapterImplemented: meta.adapterImplemented,
      documentationUrl: meta.documentationUrl,
      lastChecked: now,
    });
  }

  return results;
}

/**
 * Format the tool center detection results into a clean, truthful terminal report.
 */
export function formatToolDetectionReport(tools: ToolDetectionResult[]): string {
  const installed = tools.filter((t) => t.installed);
  const missing = tools.filter((t) => !t.installed && t.status === 'NOT_INSTALLED');
  const unsupported = tools.filter((t) => t.status === 'UNSUPPORTED_OS');

  const lines = [
    `\n\x1b[1m\x1b[36m╔══════════════════════════════════════════════════════════════════════════════╗\x1b[0m`,
    `\x1b[1m\x1b[36m║               DUALSURF BLUE TEAM TOOL CENTER & HOST DISCOVERY                ║\x1b[0m`,
    `\x1b[1m\x1b[36m╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m`,
    `  \x1b[2mPlatform: ${process.platform} (${os.release()}) | Host: ${os.hostname()} | Checked: ${new Date().toLocaleTimeString()}\x1b[0m`,
    `  \x1b[2mSummary: \x1b[32m${installed.length} Installed\x1b[0m \x1b[2m· \x1b[33m${missing.length} Missing\x1b[0m \x1b[2m· \x1b[90m${unsupported.length} Unsupported OS\x1b[0m`,
    `\x1b[90m──────────────────────────────────────────────────────────────────────────────\x1b[0m`,
  ];

  if (installed.length > 0) {
    lines.push(`\n  \x1b[1m\x1b[32mINSTALLED & READY DEFENSIVE TOOLS (${installed.length}):\x1b[0m`);
    for (const t of installed) {
      const verSnippet = t.version ? ` (${t.version})` : '';
      lines.push(`  \x1b[32m✓\x1b[0m \x1b[1m${t.name.padEnd(20)}\x1b[0m \x1b[90m${t.category.padEnd(26)}\x1b[0m \x1b[2m${t.executablePath || ''}${verSnippet}\x1b[0m`);
    }
  }

  if (missing.length > 0) {
    lines.push(`\n  \x1b[1m\x1b[33mMISSING FROM HOST PATH (${missing.length}):\x1b[0m`);
    for (const t of missing) {
      lines.push(`  \x1b[31m✖\x1b[0m \x1b[1m${t.name.padEnd(20)}\x1b[0m \x1b[90m${t.category.padEnd(26)}\x1b[0m \x1b[2mRun "dualsurf blue tools info ${t.toolId}" for install guidance\x1b[0m`);
    }
  }

  if (unsupported.length > 0) {
    lines.push(`\n  \x1b[1m\x1b[90mUNSUPPORTED ON CURRENT OS (${unsupported.length}):\x1b[0m`);
    for (const t of unsupported) {
      lines.push(`  \x1b[90m- ${t.name.padEnd(20)} ${t.category.padEnd(26)} (requires ${t.supportedOs.join('/')})\x1b[0m`);
    }
  }

  lines.push(`\n\x1b[2mDualSurf will never pretend a missing tool ran. Missing tools will guide you to installation.\x1b[0m\n`);
  return lines.join('\n');
}

/**
 * Return actionable installation and setup guidance for a specific tool.
 */
export function getToolInfoGuidance(toolId: string, detection?: ToolDetectionResult): string {
  const meta = REGISTERED_BLUE_TEAM_TOOLS.find((t) => t.id.toLowerCase() === toolId.toLowerCase());
  if (!meta) {
    return `\x1b[33mTool "${toolId}" is not in the registered integration catalog.\x1b[0m\n`;
  }

  const isInstalled = detection?.installed ?? false;
  const statusColor = isInstalled ? '\x1b[32m' : '\x1b[33m';

  return [
    `\n\x1b[1m\x1b[36mDUALSURF TOOL INTEGRATION: ${meta.name.toUpperCase()}\x1b[0m`,
    `\x1b[90m──────────────────────────────────────────────────────────────────────────────\x1b[0m`,
    `  \x1b[1mCategory:\x1b[0m            ${meta.category}`,
    `  \x1b[1mCurrent Status:\x1b[0m      ${statusColor}${isInstalled ? 'INSTALLED & ACTIVE' : 'NOT INSTALLED'}\x1b[0m`,
    `  \x1b[1mBinary Name:\x1b[0m         ${meta.binaryName}`,
    `  \x1b[1mRequired Privilege:\x1b[0m  ${meta.requiredPrivilege}`,
    `  \x1b[1mSupported OS:\x1b[0m        ${meta.supportedOs.join(', ')}`,
    `  \x1b[1mOfficial Docs:\x1b[0m       ${meta.documentationUrl}`,
    `\n  \x1b[1mInstallation Next Steps:\x1b[0m`,
    isInstalled
      ? `    Tool is installed at ${detection?.executablePath || 'host PATH'}. Ready for live investigations.`
      : [
          `    1. Install ${meta.name} on this host using official packages or package manager.`,
          process.platform === 'win32'
            ? `       • Windows: winget install ${meta.name} (or download installer)`
            : `       • Linux: sudo apt install ${meta.binaryName} (or curl/repo install)`,
          `    2. Ensure the binary is in your system PATH.`,
          `    3. Run "dualsurf blue tools check" to verify discovery.`,
        ].join('\n'),
    `\n  \x1b[1mDualSurf Truthfulness Guarantee:\x1b[0m`,
    `    No synthetic or fabricated results will be shown. All findings require verified local evidence.\n`,
  ].join('\n');
}

// ============================================================================
// RED TEAM TOOL REGISTRY AND ADAPTER DISCOVERY
// ============================================================================

export const REGISTERED_RED_TEAM_TOOLS: ToolIntegrationMetadata[] = [
  // A. Reconnaissance and attack-surface discovery
  {
    id: 'subfinder',
    name: 'Subfinder',
    category: 'Reconnaissance & OSINT',
    binaryName: 'subfinder',
    aliases: [],
    versionFlag: '-version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/projectdiscovery/subfinder',
    adapterImplemented: true,
  },
  {
    id: 'amass',
    name: 'OWASP Amass',
    category: 'Reconnaissance & OSINT',
    binaryName: 'amass',
    aliases: [],
    versionFlag: '-version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/owasp-amass/amass',
    adapterImplemented: true,
  },
  {
    id: 'theharvester',
    name: 'theHarvester',
    category: 'Reconnaissance & OSINT',
    binaryName: 'theHarvester',
    aliases: ['theharvester'],
    versionFlag: '-h',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/laramies/theHarvester',
    adapterImplemented: true,
  },
  {
    id: 'recon-ng',
    name: 'Recon-ng',
    category: 'Reconnaissance & OSINT',
    binaryName: 'recon-ng',
    aliases: [],
    versionFlag: '-v',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/lanmaster53/recon-ng',
    adapterImplemented: true,
  },
  {
    id: 'spiderfoot',
    name: 'SpiderFoot',
    category: 'Reconnaissance & OSINT',
    binaryName: 'spiderfoot',
    aliases: ['sf.py', 'sf'],
    versionFlag: '-v',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/smicallef/spiderfoot',
    adapterImplemented: true,
  },
  {
    id: 'dnsrecon',
    name: 'DNSRecon',
    category: 'Reconnaissance & OSINT',
    binaryName: 'dnsrecon',
    aliases: [],
    versionFlag: '-v',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/darkoperator/dnsrecon',
    adapterImplemented: true,
  },
  {
    id: 'findomain',
    name: 'Findomain',
    category: 'Reconnaissance & OSINT',
    binaryName: 'findomain',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/Findomain/Findomain',
    adapterImplemented: true,
  },
  {
    id: 'assetfinder',
    name: 'assetfinder',
    category: 'Reconnaissance & OSINT',
    binaryName: 'assetfinder',
    aliases: [],
    versionFlag: '-h',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/tomnomnom/assetfinder',
    adapterImplemented: true,
  },
  {
    id: 'dnsx',
    name: 'dnsx',
    category: 'Reconnaissance & OSINT',
    binaryName: 'dnsx',
    aliases: [],
    versionFlag: '-version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/projectdiscovery/dnsx',
    adapterImplemented: true,
  },
  {
    id: 'httpx',
    name: 'httpx',
    category: 'Reconnaissance & OSINT',
    binaryName: 'httpx',
    aliases: [],
    versionFlag: '-version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/projectdiscovery/httpx',
    adapterImplemented: true,
  },
  {
    id: 'katana',
    name: 'Katana Crawler',
    category: 'Reconnaissance & OSINT',
    binaryName: 'katana',
    aliases: [],
    versionFlag: '-version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/projectdiscovery/katana',
    adapterImplemented: true,
  },
  {
    id: 'exiftool',
    name: 'ExifTool',
    category: 'Metadata Analysis',
    binaryName: 'exiftool',
    aliases: [],
    versionFlag: '-ver',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://exiftool.org',
    adapterImplemented: true,
  },

  // B. Network and service visibility
  {
    id: 'nmap',
    name: 'Nmap',
    category: 'Network & Port Scanning',
    binaryName: 'nmap',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://nmap.org',
    adapterImplemented: true,
  },
  {
    id: 'naabu',
    name: 'Naabu Port Scanner',
    category: 'Network & Port Scanning',
    binaryName: 'naabu',
    aliases: [],
    versionFlag: '-version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/projectdiscovery/naabu',
    adapterImplemented: true,
  },
  {
    id: 'rustscan',
    name: 'RustScan',
    category: 'Network & Port Scanning',
    binaryName: 'rustscan',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/RustScan/RustScan',
    adapterImplemented: true,
  },
  {
    id: 'masscan',
    name: 'Masscan',
    category: 'Network & Port Scanning',
    binaryName: 'masscan',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'admin',
    documentationUrl: 'https://github.com/robertdavidgraham/masscan',
    adapterImplemented: true,
  },
  {
    id: 'netcat',
    name: 'Netcat',
    category: 'Network Utilities',
    binaryName: 'nc',
    aliases: ['netcat', 'ncat'],
    versionFlag: '-h',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://nmap.org/ncat',
    adapterImplemented: true,
  },
  {
    id: 'wireshark',
    name: 'Wireshark',
    category: 'Packet Capture & Analysis',
    binaryName: 'wireshark',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'admin',
    documentationUrl: 'https://www.wireshark.org',
    adapterImplemented: true,
  },
  {
    id: 'tshark',
    name: 'TShark',
    category: 'Packet Capture & Analysis',
    binaryName: 'tshark',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'admin',
    documentationUrl: 'https://tshark.dev',
    adapterImplemented: true,
  },
  {
    id: 'tcpdump',
    name: 'tcpdump',
    category: 'Packet Capture & Analysis',
    binaryName: 'tcpdump',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['linux', 'darwin'],
    requiredPrivilege: 'admin',
    documentationUrl: 'https://www.tcpdump.org',
    adapterImplemented: true,
  },

  // C. Web application and API assessment
  {
    id: 'zap',
    name: 'OWASP ZAP',
    category: 'Web & API Assessment',
    binaryName: 'zap',
    aliases: ['zaproxy', 'owasp-zap'],
    versionFlag: '-version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://www.zaproxy.org',
    adapterImplemented: true,
  },
  {
    id: 'mitmproxy',
    name: 'mitmproxy',
    category: 'Web & API Assessment',
    binaryName: 'mitmproxy',
    aliases: ['mitmdump'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://mitmproxy.org',
    adapterImplemented: true,
  },
  {
    id: 'nuclei',
    name: 'Nuclei Vulnerability Scanner',
    category: 'Web & Vulnerability Validation',
    binaryName: 'nuclei',
    aliases: [],
    versionFlag: '-version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/projectdiscovery/nuclei',
    adapterImplemented: true,
  },
  {
    id: 'ffuf',
    name: 'ffuf Web Fuzzer',
    category: 'Web & Content Discovery',
    binaryName: 'ffuf',
    aliases: [],
    versionFlag: '-V',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/ffuf/ffuf',
    adapterImplemented: true,
  },
  {
    id: 'feroxbuster',
    name: 'feroxbuster',
    category: 'Web & Content Discovery',
    binaryName: 'feroxbuster',
    aliases: [],
    versionFlag: '-V',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/epi052/feroxbuster',
    adapterImplemented: true,
  },
  {
    id: 'gobuster',
    name: 'Gobuster',
    category: 'Web & Content Discovery',
    binaryName: 'gobuster',
    aliases: [],
    versionFlag: 'version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/OJ/gobuster',
    adapterImplemented: true,
  },
  {
    id: 'nikto',
    name: 'Nikto Web Scanner',
    category: 'Web & API Assessment',
    binaryName: 'nikto',
    aliases: ['nikto.pl'],
    versionFlag: '-Version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://cirt.net/Nikto2',
    adapterImplemented: true,
  },
  {
    id: 'whatweb',
    name: 'WhatWeb',
    category: 'Technology Fingerprinting',
    binaryName: 'whatweb',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/urbanadventurer/WhatWeb',
    adapterImplemented: true,
  },
  {
    id: 'arjun',
    name: 'Arjun Parameter Discovery',
    category: 'Web & API Assessment',
    binaryName: 'arjun',
    aliases: [],
    versionFlag: '--help',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/s0md3v/Arjun',
    adapterImplemented: true,
  },
  {
    id: 'dalfox',
    name: 'Dalfox XSS Scanner',
    category: 'Web & API Assessment',
    binaryName: 'dalfox',
    aliases: [],
    versionFlag: 'version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/hahwul/dalfox',
    adapterImplemented: true,
  },
  {
    id: 'sqlmap',
    name: 'sqlmap',
    category: 'Database & SQL Injection Assessment',
    binaryName: 'sqlmap',
    aliases: ['sqlmap.py'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://sqlmap.org',
    adapterImplemented: true,
  },

  // D. Identity and directory security assessment
  {
    id: 'bloodhound',
    name: 'BloodHound Community Edition',
    category: 'Active Directory & Identity',
    binaryName: 'bloodhound',
    aliases: ['bloodhound-python'],
    versionFlag: '--help',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/BloodHoundAD/BloodHound',
    adapterImplemented: true,
  },
  {
    id: 'netexec',
    name: 'NetExec (nxc)',
    category: 'Active Directory & Network Protocols',
    binaryName: 'nxc',
    aliases: ['netexec'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/Pennyw0rth/NetExec',
    adapterImplemented: true,
  },
  {
    id: 'impacket',
    name: 'Impacket Suite',
    category: 'Active Directory & Network Protocols',
    binaryName: 'secretsdump.py',
    aliases: ['impacket-secretsdump', 'GetNPUsers.py'],
    versionFlag: '-h',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/fortra/impacket',
    adapterImplemented: true,
  },
  {
    id: 'enum4linux-ng',
    name: 'enum4linux-ng',
    category: 'Active Directory & SMB Enumeration',
    binaryName: 'enum4linux-ng',
    aliases: ['enum4linux'],
    versionFlag: '-h',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/cddmp/enum4linux-ng',
    adapterImplemented: true,
  },
  {
    id: 'certipy',
    name: 'Certipy AD CS Assessment',
    category: 'Active Directory & PKI',
    binaryName: 'certipy',
    aliases: [],
    versionFlag: '-h',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/ly4k/Certipy',
    adapterImplemented: true,
  },
  {
    id: 'hashcat',
    name: 'Hashcat',
    category: 'Password Audit & Cryptography',
    binaryName: 'hashcat',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://hashcat.net/hashcat/',
    adapterImplemented: true,
  },
  {
    id: 'john',
    name: 'John the Ripper',
    category: 'Password Audit & Cryptography',
    binaryName: 'john',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://www.openwall.com/john/',
    adapterImplemented: true,
  },

  // E. Cloud and infrastructure assessment
  {
    id: 'prowler',
    name: 'Prowler Cloud Security',
    category: 'Cloud Security Assessment',
    binaryName: 'prowler',
    aliases: [],
    versionFlag: '-v',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/prowler-cloud/prowler',
    adapterImplemented: true,
  },
  {
    id: 'scoutsuite',
    name: 'ScoutSuite',
    category: 'Cloud Security Assessment',
    binaryName: 'scout',
    aliases: ['scoutsuite'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/nccgroup/ScoutSuite',
    adapterImplemented: true,
  },
  {
    id: 'cloudsplaining',
    name: 'Cloudsplaining',
    category: 'Cloud IAM Assessment',
    binaryName: 'cloudsplaining',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/salesforce/cloudsplaining',
    adapterImplemented: true,
  },
  {
    id: 'steampipe',
    name: 'Steampipe',
    category: 'Cloud & Infrastructure Auditing',
    binaryName: 'steampipe',
    aliases: [],
    versionFlag: '-v',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://steampipe.io',
    adapterImplemented: true,
  },
  {
    id: 'trivy',
    name: 'Trivy',
    category: 'Container & Dependency Scanner',
    binaryName: 'trivy',
    aliases: [],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://trivy.dev',
    adapterImplemented: true,
  },
  {
    id: 'grype',
    name: 'Grype Vulnerability Scanner',
    category: 'Container & Dependency Scanner',
    binaryName: 'grype',
    aliases: [],
    versionFlag: 'version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/anchore/grype',
    adapterImplemented: true,
  },
  {
    id: 'syft',
    name: 'Syft SBOM Generator',
    category: 'Software Composition Analysis',
    binaryName: 'syft',
    aliases: [],
    versionFlag: 'version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/anchore/syft',
    adapterImplemented: true,
  },
  {
    id: 'checkov',
    name: 'Checkov',
    category: 'Infrastructure as Code Security',
    binaryName: 'checkov',
    aliases: [],
    versionFlag: '-v',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://www.checkov.io',
    adapterImplemented: true,
  },
  {
    id: 'terrascan',
    name: 'Terrascan',
    category: 'Infrastructure as Code Security',
    binaryName: 'terrascan',
    aliases: [],
    versionFlag: 'version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://runterrascan.io',
    adapterImplemented: true,
  },
  {
    id: 'kube-bench',
    name: 'kube-bench',
    category: 'Kubernetes CIS Benchmark',
    binaryName: 'kube-bench',
    aliases: [],
    versionFlag: 'version',
    supportedOs: ['linux'],
    requiredPrivilege: 'admin',
    documentationUrl: 'https://github.com/aquasecurity/kube-bench',
    adapterImplemented: true,
  },
  {
    id: 'kubescape',
    name: 'Kubescape',
    category: 'Kubernetes Security & Hardening',
    binaryName: 'kubescape',
    aliases: [],
    versionFlag: 'version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'user',
    documentationUrl: 'https://github.com/kubescape/kubescape',
    adapterImplemented: true,
  },

  // F. Controlled Lab Validation
  {
    id: 'metasploit',
    name: 'Metasploit Framework',
    category: 'Controlled Lab Validation (Approval Required)',
    binaryName: 'msfconsole',
    aliases: ['msfvenom'],
    versionFlag: '--version',
    supportedOs: ['win32', 'linux', 'darwin'],
    requiredPrivilege: 'admin',
    documentationUrl: 'https://www.metasploit.com',
    adapterImplemented: true,
  },
];

/**
 * Non-intrusively inspect the host for all registered Red Team tools.
 */
export async function detectHostRedTeamTools(): Promise<ToolDetectionResult[]> {
  const currentOs = process.platform as 'win32' | 'linux' | 'darwin';
  const now = new Date().toISOString();
  const results: ToolDetectionResult[] = [];

  for (const meta of REGISTERED_RED_TEAM_TOOLS) {
    const isSupported = meta.supportedOs.includes(currentOs) || (currentOs === 'win32' && isWslAvailable() && meta.supportedOs.includes('linux'));
    if (!isSupported) {
      results.push({
        toolId: meta.id,
        name: meta.name,
        category: meta.category,
        installed: false,
        status: 'UNSUPPORTED_OS',
        supportedOs: meta.supportedOs,
        requiredPrivilege: meta.requiredPrivilege,
        isConfigured: false,
        adapterImplemented: meta.adapterImplemented,
        documentationUrl: meta.documentationUrl,
        lastChecked: now,
      });
      continue;
    }

    let check = checkToolAvailable(meta.binaryName);
    if (!check.available && meta.aliases.length > 0) {
      for (const alias of meta.aliases) {
        check = checkToolAvailable(alias);
        if (check.available) break;
      }
    }

    if (!check.available) {
      results.push({
        toolId: meta.id,
        name: meta.name,
        category: meta.category,
        installed: false,
        status: 'NOT_INSTALLED',
        supportedOs: meta.supportedOs,
        requiredPrivilege: meta.requiredPrivilege,
        isConfigured: false,
        adapterImplemented: meta.adapterImplemented,
        documentationUrl: meta.documentationUrl,
        lastChecked: now,
      });
      continue;
    }

    let versionStr: string | undefined = undefined;
    if (meta.versionFlag && check.path) {
      try {
        const { execSync } = await import('child_process');
        const cmd = check.runtime === 'wsl'
          ? `wsl.exe -e ${check.path} ${meta.versionFlag}`
          : `"${check.path}" ${meta.versionFlag}`;
        const verOutput = execSync(cmd, {
          timeout: 3000,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        const clean = verOutput.replace(/^wsl: Failed to translate[^\r\n]*\r?\n?/gm, '').trim();
        const firstLine = clean.split('\n')[0]?.trim();
        if (firstLine && firstLine.length < 80) {
          versionStr = firstLine;
        }
      } catch {
        // Version flag error, still report installed
      }
    }

    results.push({
      toolId: meta.id,
      name: meta.name,
      category: meta.category,
      installed: true,
      version: versionStr,
      executablePath: check.path,
      status: 'INSTALLED_ACTIVE',
      supportedOs: meta.supportedOs,
      requiredPrivilege: meta.requiredPrivilege,
      isConfigured: true,
      adapterImplemented: meta.adapterImplemented,
      documentationUrl: meta.documentationUrl,
      lastChecked: now,
    });
  }

  return results;
}

/**
 * Format the red team tool center detection results into a clean, truthful terminal report.
 */
export function formatRedToolDetectionReport(tools: ToolDetectionResult[]): string {
  const installed = tools.filter((t) => t.installed);
  const missing = tools.filter((t) => !t.installed && t.status === 'NOT_INSTALLED');
  const unsupported = tools.filter((t) => t.status === 'UNSUPPORTED_OS');

  const lines = [
    `\n\x1b[1m\x1b[31m╔══════════════════════════════════════════════════════════════════════════════╗\x1b[0m`,
    `\x1b[1m\x1b[31m║                DUALSURF RED TEAM TOOL CENTER & HOST DISCOVERY                ║\x1b[0m`,
    `\x1b[1m\x1b[31m╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m`,
    `  \x1b[2mPlatform: ${process.platform} (${os.release()}) | Host: ${os.hostname()} | Checked: ${new Date().toLocaleTimeString()}\x1b[0m`,
    `  \x1b[2mSummary: \x1b[32m${installed.length} Installed\x1b[0m \x1b[2m· \x1b[33m${missing.length} Missing\x1b[0m \x1b[2m· \x1b[90m${unsupported.length} Unsupported OS\x1b[0m`,
    `\x1b[90m──────────────────────────────────────────────────────────────────────────────\x1b[0m`,
  ];

  if (installed.length > 0) {
    lines.push(`\n  \x1b[1m\x1b[32mINSTALLED & READY OFFENSIVE/ASSESSMENT TOOLS (${installed.length}):\x1b[0m`);
    for (const t of installed) {
      const verSnippet = t.version ? ` (${t.version})` : '';
      lines.push(`  \x1b[32m✓\x1b[0m \x1b[1m${t.name.padEnd(24)}\x1b[0m \x1b[90m${t.category.padEnd(28)}\x1b[0m \x1b[2m${t.executablePath || ''}${verSnippet}\x1b[0m`);
    }
  }

  if (missing.length > 0) {
    lines.push(`\n  \x1b[1m\x1b[33mMISSING FROM HOST PATH (${missing.length}):\x1b[0m`);
    for (const t of missing) {
      lines.push(`  \x1b[31m✖\x1b[0m \x1b[1m${t.name.padEnd(24)}\x1b[0m \x1b[90m${t.category.padEnd(28)}\x1b[0m \x1b[2mRun "dualsurf red tools info ${t.toolId}" for install guidance\x1b[0m`);
    }
  }

  if (unsupported.length > 0) {
    lines.push(`\n  \x1b[1m\x1b[90mUNSUPPORTED ON CURRENT OS (${unsupported.length}):\x1b[0m`);
    for (const t of unsupported) {
      lines.push(`  \x1b[90m- ${t.name.padEnd(24)} ${t.category.padEnd(28)} (requires ${t.supportedOs.join('/')})\x1b[0m`);
    }
  }

  lines.push(`\n\x1b[2mDualSurf will never pretend a missing tool ran. Missing tools will guide you to installation.\x1b[0m\n`);
  return lines.join('\n');
}

/**
 * Return actionable installation and setup guidance for a specific red team tool.
 */
export function getRedToolInfoGuidance(toolId: string, detection?: ToolDetectionResult): string {
  const meta = REGISTERED_RED_TEAM_TOOLS.find((t) => t.id.toLowerCase() === toolId.toLowerCase());
  if (!meta) {
    return `\x1b[33mTool "${toolId}" is not in the registered Red Team integration catalog.\x1b[0m\n`;
  }

  const isInstalled = detection?.installed ?? false;
  const statusColor = isInstalled ? '\x1b[32m' : '\x1b[33m';

  return [
    `\n\x1b[1m\x1b[31mDUALSURF RED TEAM TOOL INTEGRATION: ${meta.name.toUpperCase()}\x1b[0m`,
    `\x1b[90m──────────────────────────────────────────────────────────────────────────────\x1b[0m`,
    `  \x1b[1mCategory:\x1b[0m            ${meta.category}`,
    `  \x1b[1mCurrent Status:\x1b[0m      ${statusColor}${isInstalled ? 'INSTALLED & ACTIVE' : 'NOT INSTALLED'}\x1b[0m`,
    `  \x1b[1mBinary Name:\x1b[0m         ${meta.binaryName}`,
    `  \x1b[1mRequired Privilege:\x1b[0m  ${meta.requiredPrivilege}`,
    `  \x1b[1mSupported OS:\x1b[0m        ${meta.supportedOs.join(', ')}`,
    `  \x1b[1mOfficial Docs:\x1b[0m       ${meta.documentationUrl}`,
    `\n  \x1b[1mInstallation Next Steps:\x1b[0m`,
    isInstalled
      ? `    Tool is installed at ${detection?.executablePath || 'host PATH'}. Ready for authorized testing.`
      : [
          `    1. Install ${meta.name} on this host using official packages or package manager.`,
          process.platform === 'win32'
            ? `       • Windows: winget install ${meta.name} (or download official release from ${meta.documentationUrl})`
            : `       • Linux: sudo apt install ${meta.binaryName} (or go install / pip / release)`,
          `    2. Ensure the binary is in your system PATH.`,
          `    3. Run "dualsurf red tools check" to verify discovery.`,
        ].join('\n'),
    `\n  \x1b[1mAuthorization Requirement:\x1b[0m`,
    `    Active testing is permitted only against targets explicitly authorized in an approved scope profile.`,
    `    DualSurf will reject execution against any out-of-scope or unauthorized destination.\n`,
  ].join('\n');
}

/**
 * Validate that an argument does not contain dangerous shell command injection metacharacters.
 */
export function isArgumentSafe(arg: string): boolean {
  if (typeof arg !== 'string') return false;
  // Disallow shell operators and command chaining delimiters
  const dangerousPatterns = /[;&|`$<>\r\n]/;
  return !dangerousPatterns.test(arg);
}

