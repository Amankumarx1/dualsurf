import { spawn, spawnSync } from 'child_process';
import { colors } from '../formatters.js';

export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut?: boolean;
}

/**
 * Execute a local shell tool/command directly from DualSurf CLI/REPL.
 * Enables executing any installed system utility (Kali tools, Unix utilities, scripts).
 */
export async function executeShellCommand(
  command: string,
  options: {
    cwd?: string;
    timeoutMs?: number;
    streamToTerminal?: boolean;
  } = {}
): Promise<CommandResult> {
  const start = Date.now();
  const isWindows = process.platform === 'win32';
  let shell = isWindows ? (process.env.COMSPEC || 'cmd.exe') : (process.env.SHELL || '/bin/sh');
  let shellArgs = isWindows ? ['/d', '/s', '/c', command] : ['-c', command];

  // If on Windows and command starts with a binary available only in WSL, route through WSL
  if (isWindows && isWslAvailable()) {
    const firstWord = command.trim().split(/\s+/)[0];
    const check = checkToolAvailable(firstWord);
    if (check.available && check.runtime === 'wsl') {
      shell = 'wsl.exe';
      shellArgs = ['-e', 'sh', '-c', command];
    }
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(shell, shellArgs, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, PAGER: 'cat' },
      stdio: options.streamToTerminal ? ['inherit', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });

    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, options.timeoutMs)
      : null;

    child.stdout?.on('data', (data) => {
      let chunk = data.toString();
      if (shell === 'wsl.exe') {
        chunk = chunk.replace(/^wsl: Failed to translate[^\r\n]*\r?\n?/gm, '');
      }
      stdout += chunk;
      if (options.streamToTerminal) {
        process.stdout.write(chunk);
      }
    });

    child.stderr?.on('data', (data) => {
      let chunk = data.toString();
      if (shell === 'wsl.exe') {
        chunk = chunk.replace(/^wsl: Failed to translate[^\r\n]*\r?\n?/gm, '');
      }
      stderr += chunk;
      if (options.streamToTerminal) {
        process.stderr.write(chunk);
      }
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - start;
      const cleanStdout = stdout.replace(/^wsl: Failed to translate[^\r\n]*\r?\n?/gm, '').trimStart();
      const cleanStderr = (timedOut && !stderr ? 'Command timed out' : stderr).replace(/^wsl: Failed to translate[^\r\n]*\r?\n?/gm, '').trimStart();
      resolve({
        command,
        exitCode: code ?? (timedOut ? 1 : 0),
        stdout: cleanStdout,
        stderr: cleanStderr,
        durationMs,
        timedOut,
      });
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - start;
      resolve({
        command,
        exitCode: 1,
        stdout: '',
        stderr: err.message,
        durationMs,
        timedOut,
      });
    });
  });
}

/**
 * Execute an interactive shell command with full stdio inheritance (TTY).
 * Essential for sudo, sudo su, su, password prompts, interactive shells (bash, zsh, cmd),
 * and terminal editors/tools (nano, vim, htop).
 */
export async function executeInteractiveShellCommand(
  command: string,
  options: {
    cwd?: string;
  } = {}
): Promise<number> {
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? (process.env.COMSPEC || 'cmd.exe') : (process.env.SHELL || '/bin/bash');
  const shellArgs = isWindows ? ['/d', '/s', '/c', command] : ['-c', command];

  return new Promise((resolve) => {
    // If process.stdin is in raw mode (e.g. from a keypress listener), suspend it during child execution
    const isStdinRaw = process.stdin.isTTY && (process.stdin as any).isRaw;
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      try {
        process.stdin.setRawMode(false);
      } catch {
        // ignore
      }
    }

    const child = spawn(shell, shellArgs, {
      cwd: options.cwd || process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function' && isStdinRaw) {
        try {
          process.stdin.setRawMode(true);
        } catch {
          // ignore
        }
      }
      resolve(code ?? 0);
    });

    child.on('error', (err) => {
      console.error(`${colors.red}Failed to execute command: ${err.message}${colors.reset}`);
      resolve(1);
    });
  });
}

/**
 * Audit common local inspection / penetration testing / network tools available on host.
 */
export function auditInstalledTools(toolList?: string[]): Array<{ name: string; available: boolean; path?: string }> {
  const tools = toolList || [
    'curl',
    'ping',
    'dig',
    'whois',
    'nmap',
    'openssl',
    'traceroute',
    'tcpdump',
    'git',
    'python3',
  ];

  const isWindows = process.platform === 'win32';
  const whichCmd = isWindows ? 'where' : 'which';

  return tools.map((tool) => {
    try {
      const res = spawnSync(whichCmd, [tool], { encoding: 'utf-8', stdio: 'pipe' });
      const available = res.status === 0;
      const foundPath = available ? (res.stdout.split('\n')[0] || '').trim() : undefined;
      return { name: tool, available, path: foundPath };
    } catch {
      return { name: tool, available: false };
    }
  });
}

/**
 * Format audit table of installed tools for terminal output.
 */
export function formatToolsAudit(tools: Array<{ name: string; available: boolean; path?: string }>): string {
  const header = [
    `${colors.bold}${colors.cyan}AVAILABLE SYSTEM TOOLS & UTILITIES:${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────${colors.reset}`,
  ];

  const rows = tools.map((t) => {
    const status = t.available
      ? `${colors.green}✓ Available${colors.reset} ${colors.dim}(${t.path})${colors.reset}`
      : `${colors.gray}✗ Not found${colors.reset}`;
    return `  ${colors.bold}${t.name.padEnd(14, ' ')}${colors.reset} : ${status}`;
  });

  const footer = `\n${colors.dim}Run any tool directly inside DualSurf REPL using "! <command>" or "sh <command>".${colors.reset}`;

  return [...header, ...rows, footer].join('\n');
}

/**
 * 7 Core Red Team Operational Pillars and their associated tools.
 */
export const RED_TEAM_PILLAR_TOOLS: Record<number, {
  pillar: string;
  category: string;
  tools: Array<{ name: string; aliases: string[]; description: string }>;
}> = {
  1: {
    pillar: '1. Reconnaissance and OSINT',
    category: 'Reconnaissance & OSINT',
    tools: [
      { name: 'nmap', aliases: ['nmap'], description: 'Host discovery and network perimeter sweeping' },
      { name: 'amass', aliases: ['amass'], description: 'In-depth attack surface mapping and asset discovery' },
      { name: 'subfinder', aliases: ['subfinder'], description: 'Passive subdomain enumeration via CT logs and DNS' },
      { name: 'theharvester', aliases: ['theharvester', 'theHarvester'], description: 'OSINT gathering for emails, subdomains, and hosts' },
      { name: 'maltego', aliases: ['maltego'], description: 'Interactive transform graph of target infrastructure' },
    ],
  },
  2: {
    pillar: '2. Network and infrastructure penetration testing',
    category: 'Network & Infrastructure',
    tools: [
      { name: 'nmap', aliases: ['nmap'], description: 'Port scanning, service version detection, and script auditing' },
      { name: 'wireshark', aliases: ['wireshark', 'tshark'], description: 'Network packet analysis and protocol inspection' },
      { name: 'metasploit', aliases: ['msfconsole', 'msf'], description: 'Vulnerability validation and penetration testing framework' },
      { name: 'nessus', aliases: ['nessus', 'nessuscli'], description: 'Infrastructure vulnerability scanning and configuration audit' },
    ],
  },
  3: {
    pillar: '3. Web application and API attacks',
    category: 'Web App & API',
    tools: [
      { name: 'burpsuite', aliases: ['burp', 'burpsuite'], description: 'Web application security testing, proxy, and HTTP repeater' },
      { name: 'zaproxy', aliases: ['zap', 'zaproxy'], description: 'OWASP automated and manual web vulnerability scanner' },
      { name: 'postman', aliases: ['postman'], description: 'API endpoint inspection, schema testing, and authorization audit' },
      { name: 'devtools', aliases: ['devtools'], description: 'Browser developer tools, DOM inspector, and storage auditor' },
    ],
  },
  4: {
    pillar: '4. Identity and privilege escalation testing',
    category: 'Identity & PrivEsc',
    tools: [
      { name: 'bloodhound', aliases: ['bloodhound'], description: 'Active Directory attack path mapping and privilege relationship analysis' },
      { name: 'impacket', aliases: ['impacket-secretsdump', 'secretsdump.py', 'impacket'], description: 'Network protocol manipulation and credential assessment' },
      { name: 'netexec', aliases: ['nxc', 'netexec', 'crackmapexec'], description: 'Network service protocol assessment across SMB, WinRM, LDAP, SSH' },
      { name: 'powershell', aliases: ['powershell', 'pwsh'], description: 'Windows command-line shell and administration automation' },
    ],
  },
  5: {
    pillar: '5. Cloud and container security testing',
    category: 'Cloud & Container',
    tools: [
      { name: 'prowler', aliases: ['prowler'], description: 'AWS, Azure, and GCP security assessment and CIS compliance auditing' },
      { name: 'scoutsuite', aliases: ['scoutsuite', 'scout'], description: 'Multi-cloud security auditing tool for posture review' },
      { name: 'trivy', aliases: ['trivy'], description: 'Container image, filesystem, and dependency CVE scanner' },
      { name: 'cloud-tools', aliases: ['aws', 'az', 'gcloud'], description: 'Cloud provider management CLIs' },
    ],
  },
  6: {
    pillar: '6. Adversary simulation and security-control testing',
    category: 'Adversary Simulation',
    tools: [
      { name: 'mitre-attack', aliases: ['mitre'], description: 'MITRE ATT&CK adversary technique matrix and mapping' },
      { name: 'atomic-red-team', aliases: ['atomic', 'Invoke-AtomicTest'], description: 'Actionable, scripted tests mapped to MITRE ATT&CK techniques' },
      { name: 'caldera', aliases: ['caldera'], description: 'Automated adversary emulation and detection response platform' },
      { name: 'custom-scripts', aliases: ['script', 'sh'], description: 'Controlled custom assessment scripts' },
    ],
  },
  7: {
    pillar: '7. Evidence, reporting and retesting',
    category: 'Reporting & Retesting',
    tools: [
      { name: 'finding-store', aliases: ['finding'], description: 'Verified vulnerability findings with CVSS v3.1 scoring' },
      { name: 'poc-verifier', aliases: ['poc'], description: 'Reproducible non-destructive proof-of-concept generator' },
      { name: 'retest-engine', aliases: ['retest'], description: 'Post-remediation verification and vulnerability retesting' },
      { name: 'sarif-exporter', aliases: ['sarif', 'report'], description: 'Standardized SARIF and HTML audit report generator' },
    ],
  },
};

let _wslAvailableCache: boolean | null = null;

/**
 * Check if Windows Subsystem for Linux (WSL) is installed and operational.
 */
export function isWslAvailable(): boolean {
  if (_wslAvailableCache !== null) return _wslAvailableCache;
  if (process.platform !== 'win32') {
    _wslAvailableCache = false;
    return false;
  }
  try {
    const res = spawnSync('where', ['wsl.exe'], { encoding: 'utf-8', stdio: 'pipe' });
    _wslAvailableCache = res.status === 0;
  } catch {
    _wslAvailableCache = false;
  }
  return _wslAvailableCache;
}

/**
 * Check if a specific tool binary is available on the host system or inside WSL.
 */
export function checkToolAvailable(toolName: string): { available: boolean; path?: string; runtime?: 'host' | 'wsl' } {
  const isWindows = process.platform === 'win32';
  const whichCmd = isWindows ? 'where' : 'which';

  try {
    const res = spawnSync(whichCmd, [toolName], { encoding: 'utf-8', stdio: 'pipe' });
    if (res.status === 0) {
      const foundPath = (res.stdout.split('\n')[0] || '').trim();
      return { available: true, path: foundPath, runtime: 'host' };
    }
  } catch {
    // fallback
  }

  // On Windows, also test with .exe if not already appended
  if (isWindows && !toolName.endsWith('.exe')) {
    try {
      const res = spawnSync(whichCmd, [`${toolName}.exe`], { encoding: 'utf-8', stdio: 'pipe' });
      if (res.status === 0) {
        const foundPath = (res.stdout.split('\n')[0] || '').trim();
        return { available: true, path: foundPath, runtime: 'host' };
      }
    } catch {
      // fallback
    }
  }

  // On Windows, if tool is not in Windows PATH, probe WSL if WSL is installed
  if (isWindows && isWslAvailable()) {
    try {
      const cleanTool = toolName.replace(/\.exe$/i, '');
      const res = spawnSync('wsl.exe', ['-e', 'which', cleanTool], { encoding: 'utf-8', stdio: 'pipe' });
      if (res.status === 0) {
        const lines = (res.stdout || '')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('/'));
        if (lines.length > 0) {
          return { available: true, path: lines[0], runtime: 'wsl' };
        }
      }
    } catch {
      // fallback
    }
  }

  return { available: false };
}

export interface RedTeamPillarAudit {
  pillarId: number;
  title: string;
  category: string;
  tools: Array<{
    name: string;
    description: string;
    availableOnHost: boolean;
    hostPath?: string;
    hasDualSurfEngine: boolean;
  }>;
}

/**
 * Audit all tools across all 7 Red Team operational pillars.
 */
export function auditRedTeamTools(): RedTeamPillarAudit[] {
  const audits: RedTeamPillarAudit[] = [];

  for (const [idStr, info] of Object.entries(RED_TEAM_PILLAR_TOOLS)) {
    const pillarId = parseInt(idStr, 10);
    const auditedTools = info.tools.map((t) => {
      let hostCheck = checkToolAvailable(t.name);
      if (!hostCheck.available) {
        for (const alias of t.aliases) {
          hostCheck = checkToolAvailable(alias);
          if (hostCheck.available) break;
        }
      }

      // DualSurf built-in engine is always available as fallback for real scanning
      const hasDualSurfEngine = true;

      return {
        name: t.name,
        description: t.description,
        availableOnHost: hostCheck.available,
        hostPath: hostCheck.path,
        hasDualSurfEngine,
      };
    });

    audits.push({
      pillarId,
      title: info.pillar,
      category: info.category,
      tools: auditedTools,
    });
  }

  return audits;
}

/**
 * Format the 7 Red Team pillars and tool audit table for terminal output.
 */
export function formatRedTeamToolsAudit(audits?: RedTeamPillarAudit[]): string {
  const data = audits || auditRedTeamTools();

  const lines = [
    `\n${colors.bold}${colors.red}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.red}║             RED TEAM OPERATIONS: 7 CORE PILLARS & TOOL INTEGRATION           ║${colors.reset}`,
    `${colors.bold}${colors.red}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
    `  ${colors.dim}When you run any tool command, DualSurf executes the real system tool if installed,${colors.reset}`,
    `  ${colors.dim}or dispatches to DualSurf's high-speed real network/audit engines for live data.${colors.reset}`,
    `${colors.gray}──────────────────────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  for (const pillar of data) {
    lines.push(`\n  ${colors.bold}${colors.yellow}${pillar.title}${colors.reset}`);
    lines.push(`  ${colors.gray}┌──────────────┬──────────────────────────────┬──────────────────────────────┐${colors.reset}`);
    lines.push(`  ${colors.gray}│${colors.reset} ${colors.bold}Tool${colors.reset.padEnd(14)} ${colors.gray}│${colors.reset} ${colors.bold}Execution Engine${colors.reset.padEnd(30)} ${colors.gray}│${colors.reset} ${colors.bold}Operational Capability${colors.reset.padEnd(28)} ${colors.gray}│${colors.reset}`);
    lines.push(`  ${colors.gray}├──────────────┼──────────────────────────────┼──────────────────────────────┤${colors.reset}`);

    for (const t of pillar.tools) {
      const toolCol = colors.bold + t.name.padEnd(12, ' ') + colors.reset;
      let engineCol: string;
      if (t.availableOnHost) {
        engineCol = `${colors.green}✓ Host Native${colors.reset} ${colors.dim}(system binary)${colors.reset}`.padEnd(37, ' ');
      } else {
        engineCol = `${colors.cyan}⚡ DualSurf Engine${colors.reset} ${colors.dim}(built-in)${colors.reset}`.padEnd(37, ' ');
      }
      const descSnippet = t.description.length > 28 ? t.description.slice(0, 25) + '...' : t.description;
      const descCol = descSnippet.padEnd(28, ' ');

      lines.push(`  ${colors.gray}│${colors.reset} ${toolCol} ${colors.gray}│${colors.reset} ${engineCol} ${colors.gray}│${colors.reset} ${descCol} ${colors.gray}│${colors.reset}`);
    }

    lines.push(`  ${colors.gray}└──────────────┴──────────────────────────────┴──────────────────────────────┘${colors.reset}`);
  }

  lines.push(`\n${colors.bold}Quick Commands:${colors.reset}`);
  lines.push(`  • ${colors.cyan}osint <domain>${colors.reset}        : Real OSINT (DNS, CT subdomains, TLS, email posture, tech)`);
  lines.push(`  • ${colors.cyan}nmap <target>${colors.reset}         : Real network port audit & banner grab (host binary or socket probe)`);
  lines.push(`  • ${colors.cyan}subfinder <domain>${colors.reset}    : Real Certificate Transparency & DNS subdomain discovery`);
  lines.push(`  • ${colors.cyan}theharvester <dom>${colors.reset}    : Real domain intelligence, mail servers, and asset inventory`);
  lines.push(`  • ${colors.cyan}trivy [path]${colors.reset}          : Real dependency & manifest CVE vulnerability scan`);
  lines.push(`  • ${colors.cyan}retest <finding-id>${colors.reset}   : Real-time retesting of pentest finding to verify remediation\n`);

  return lines.join('\n');
}

// ============================================================================
// BLUE TEAM: 13 CORE OPERATIONAL PILLARS & TOOL INTEGRATIONS
// ============================================================================

export const BLUE_TEAM_PILLAR_TOOLS: Record<
  number,
  {
    pillar: string;
    category: string;
    tools: Array<{ name: string; aliases: string[]; description: string }>;
  }
> = {
  1: {
    pillar: '1. Security monitoring and SOC operations',
    category: 'SIEM & Log Management',
    tools: [
      { name: 'sentinel', aliases: ['az', 'microsoft-sentinel'], description: 'Microsoft Sentinel cloud SIEM & analytics' },
      { name: 'splunk', aliases: ['splunkd'], description: 'Splunk Enterprise Security log correlation' },
      { name: 'elastic', aliases: ['elasticsearch', 'kibana'], description: 'Elastic Security SIEM & ES|QL analytics' },
      { name: 'wazuh', aliases: ['wazuh-agent', 'wazuh-manager'], description: 'Wazuh open-source security monitoring' },
      { name: 'graylog', aliases: ['graylog-server'], description: 'Graylog centralized log management' },
      { name: 'fluent-bit', aliases: ['fluentbit', 'fluentd'], description: 'Lightweight log collection & forwarding' },
      { name: 'vector', aliases: ['vector'], description: 'High-performance log and telemetry processing' },
      { name: 'filebeat', aliases: ['winlogbeat'], description: 'Elastic Beats log shipper' },
    ],
  },
  2: {
    pillar: '2. Endpoint Detection and Response (EDR/XDR)',
    category: 'Endpoint Security & Telemetry',
    tools: [
      { name: 'sysmon', aliases: ['sysmon64'], description: 'Microsoft Sysmon process & network telemetry' },
      { name: 'procexp', aliases: ['procexp64', 'ProcessExplorer'], description: 'Sysinternals Process Explorer' },
      { name: 'procmon', aliases: ['procmon64', 'ProcessMonitor'], description: 'Sysinternals Process Monitor' },
      { name: 'autoruns', aliases: ['autorunsc', 'autorunsc64'], description: 'Sysinternals Autoruns persistence auditing' },
      { name: 'osqueryi', aliases: ['osquery', 'osqueryd'], description: 'SQL-powered endpoint observability' },
      { name: 'velociraptor', aliases: ['velociraptor.exe'], description: 'Endpoint hunting & digital forensics' },
      { name: 'hayabusa', aliases: ['hayabusa.exe'], description: 'Fast Windows event log threat hunter' },
      { name: 'chainsaw', aliases: ['chainsaw.exe'], description: 'Rapid Windows event log IOC searcher' },
      { name: 'zircolite', aliases: ['zircolite.py'], description: 'Sigma rule engine for event logs' },
    ],
  },
  3: {
    pillar: '3. Threat hunting & Detection Engineering',
    category: 'Hypothesis-Driven Hunting',
    tools: [
      { name: 'sigma', aliases: ['sigmac', 'pySigma'], description: 'Generic detection rule format & transpiler' },
      { name: 'yara', aliases: ['yara64'], description: 'Pattern matching swiss army knife for files/memory' },
      { name: 'timesketch', aliases: ['timesketch'], description: 'Collaborative forensic timeline analysis' },
      { name: 'zeek', aliases: ['bro'], description: 'Structured network protocol telemetry generator' },
      { name: 'wireshark', aliases: ['tshark'], description: 'Packet-level network protocol analysis' },
      { name: 'python3', aliases: ['python'], description: 'Data correlation, pandas analytics & automation' },
    ],
  },
  4: {
    pillar: '4. Incident response and containment',
    category: 'Case Management & Playbooks',
    tools: [
      { name: 'thehive', aliases: ['thehive'], description: 'Security incident response & case management' },
      { name: 'iris', aliases: ['dfir-iris'], description: 'DFIR-IRIS collaborative incident response' },
      { name: 'shuffle', aliases: ['shuffle'], description: 'Open-source SOAR & workflow automation' },
      { name: 'tines', aliases: ['tines'], description: 'No-code security workflow automation' },
    ],
  },
  5: {
    pillar: '5. Digital forensics and malware analysis',
    category: 'Forensics & Reverse Engineering',
    tools: [
      { name: 'autopsy', aliases: ['autopsy64'], description: 'Digital forensics disk image investigator' },
      { name: 'volatility3', aliases: ['vol', 'volatility'], description: 'Advanced memory forensics framework' },
      { name: 'ghidra', aliases: ['ghidraRun'], description: 'NSA software reverse engineering suite' },
      { name: 'capa', aliases: ['capa.exe'], description: 'Identify executable capabilities & techniques' },
      { name: 'floss', aliases: ['floss.exe'], description: 'Deobfuscate strings in malware binaries' },
      { name: 'cyberchef', aliases: ['cyberchef'], description: 'Cyber Swiss Army Knife for data decoding' },
      { name: 'clamav', aliases: ['clamscan'], description: 'Open-source antivirus signature engine' },
    ],
  },
  6: {
    pillar: '6. Network Detection and Response (NDR)',
    category: 'Network Inspection & IDS',
    tools: [
      { name: 'suricata', aliases: ['suricata.exe'], description: 'High-performance Network IDS/IPS engine' },
      { name: 'snort', aliases: ['snort.exe', 'snort3'], description: 'Rule-based network intrusion detection' },
      { name: 'tcpdump', aliases: ['windump'], description: 'Command-line packet capture & filtering' },
      { name: 'arkime', aliases: ['moloch'], description: 'Large-scale packet search and indexing' },
      { name: 'ntopng', aliases: ['ntopng.exe'], description: 'High-speed web-based traffic flow monitor' },
    ],
  },
  7: {
    pillar: '7. Vulnerability management and hardening',
    category: 'Exposure & Vulnerability Scanning',
    tools: [
      { name: 'nessus', aliases: ['nessuscli'], description: 'Enterprise vulnerability scanner' },
      { name: 'nuclei', aliases: ['nuclei.exe'], description: 'Fast template-based vulnerability scanner' },
      { name: 'openvas', aliases: ['gvm-cli'], description: 'Open-source vulnerability management' },
      { name: 'trivy', aliases: ['trivy.exe'], description: 'Container, dependency, and IaC scanner' },
      { name: 'semgrep', aliases: ['semgrep.exe'], description: 'Static application security testing (SAST)' },
      { name: 'lynis', aliases: ['lynis'], description: 'Linux system security & compliance auditor' },
    ],
  },
  8: {
    pillar: '8. Identity and access security',
    category: 'IAM & Directory Hardening',
    tools: [
      { name: 'bloodhound', aliases: ['bloodhound-python', 'sharpHound'], description: 'Active Directory attack path auditor' },
      { name: 'pingcastle', aliases: ['pingcastle.exe'], description: 'Active Directory security posture assessor' },
      { name: 'purpleknight', aliases: ['purpleknight.exe'], description: 'AD & Entra ID posture analyzer' },
      { name: 'openldap', aliases: ['ldapsearch'], description: 'Directory services query and auditing' },
    ],
  },
  9: {
    pillar: '9. Cloud security monitoring and defense',
    category: 'Cloud Posture & Workload Protection',
    tools: [
      { name: 'prowler', aliases: ['prowler'], description: 'AWS, Azure & GCP security posture auditor' },
      { name: 'scoutsuite', aliases: ['scout'], description: 'Multi-cloud security auditing tool' },
      { name: 'steampipe', aliases: ['steampipe'], description: 'SQL-based cloud asset and config queries' },
      { name: 'falco', aliases: ['falco'], description: 'Cloud-native runtime threat detection' },
      { name: 'checkov', aliases: ['checkov'], description: 'Infrastructure-as-code security scanner' },
    ],
  },
  10: {
    pillar: '10. Email security and phishing defense',
    category: 'Email Security & Header Analysis',
    tools: [
      { name: 'mxtoolbox', aliases: ['mxtoolbox'], description: 'DNS, MX, SPF, DKIM, and DMARC diagnostics' },
      { name: 'thunderbird', aliases: ['thunderbird'], description: 'Controlled email header and artifact inspector' },
      { name: 'rspamd', aliases: ['rspamc'], description: 'Fast email filtering & spam detection' },
      { name: 'spamassassin', aliases: ['spamassassin'], description: 'Email spam & rule filtering platform' },
    ],
  },
  11: {
    pillar: '11. Security automation and SOAR',
    category: 'Orchestration & Workflow Automation',
    tools: [
      { name: 'powershell', aliases: ['pwsh'], description: 'PowerShell enterprise automation engine' },
      { name: 'ansible', aliases: ['ansible-playbook'], description: 'Configuration management & automation' },
      { name: 'n8n', aliases: ['n8n'], description: 'Workflow automation for security orchestrations' },
    ],
  },
  12: {
    pillar: '12. Threat intelligence and indicator analysis',
    category: 'Threat Feeds & Indicator Analysis',
    tools: [
      { name: 'misp', aliases: ['misp-cli'], description: 'Malware Information Sharing Platform' },
      { name: 'opencti', aliases: ['opencti'], description: 'Open Cyber Threat Intelligence platform' },
      { name: 'yeti', aliases: ['yeti'], description: 'Threat intelligence repository & correlator' },
    ],
  },
  13: {
    pillar: '13. Security architecture, deception, and resilience',
    category: 'Architecture, Deception & Resilience',
    tools: [
      { name: 'cowrie', aliases: ['cowrie'], description: 'Medium/high interaction SSH/Telnet honeypot' },
      { name: 'opencanary', aliases: ['opencanaryd'], description: 'Modular lightweight decoy honeypot' },
      { name: 'restic', aliases: ['restic.exe'], description: 'Secure, encrypted, deduplicated backups' },
      { name: 'borg', aliases: ['borgbackup'], description: 'Deduplicating backup software' },
    ],
  },
};

export interface BlueTeamPillarAudit {
  pillarId: number;
  title: string;
  category: string;
  tools: Array<{
    name: string;
    description: string;
    availableOnHost: boolean;
    hostPath?: string;
    hasDualSurfEngine: boolean;
  }>;
}

/**
 * Audit all tools across all 13 Blue Team operational pillars.
 */
export function auditBlueTeamTools(): BlueTeamPillarAudit[] {
  const audits: BlueTeamPillarAudit[] = [];

  for (const [idStr, info] of Object.entries(BLUE_TEAM_PILLAR_TOOLS)) {
    const pillarId = parseInt(idStr, 10);
    const auditedTools = info.tools.map((t) => {
      let hostCheck = checkToolAvailable(t.name);
      if (!hostCheck.available) {
        for (const alias of t.aliases) {
          hostCheck = checkToolAvailable(alias);
          if (hostCheck.available) break;
        }
      }

      // DualSurf built-in engine provides authentic local defensive telemetry
      const hasDualSurfEngine = true;

      return {
        name: t.name,
        description: t.description,
        availableOnHost: hostCheck.available,
        hostPath: hostCheck.path,
        hasDualSurfEngine,
      };
    });

    audits.push({
      pillarId,
      title: info.pillar,
      category: info.category,
      tools: auditedTools,
    });
  }

  return audits;
}

/**
 * Format the 13 Blue Team pillars and tool audit table for terminal output.
 */
export function formatBlueTeamToolsAudit(audits?: BlueTeamPillarAudit[]): string {
  const data = audits || auditBlueTeamTools();

  const lines = [
    `\n${colors.bold}${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.cyan}║            BLUE TEAM OPERATIONS: 13 CORE PILLARS & TOOL INTEGRATION          ║${colors.reset}`,
    `${colors.bold}${colors.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
    `  ${colors.dim}When you run any defensive command, DualSurf executes the real system tool if installed,${colors.reset}`,
    `  ${colors.dim}or dispatches to DualSurf's high-speed real telemetry/analysis engines for authentic data.${colors.reset}`,
    `${colors.gray}──────────────────────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  for (const pillar of data) {
    lines.push(`\n  ${colors.bold}${colors.yellow}${pillar.title}${colors.reset}`);
    lines.push(`  ${colors.gray}┌──────────────┬──────────────────────────────┬──────────────────────────────┐${colors.reset}`);
    lines.push(`  ${colors.gray}│${colors.reset} ${colors.bold}Tool${colors.reset.padEnd(14)} ${colors.gray}│${colors.reset} ${colors.bold}Execution Engine${colors.reset.padEnd(30)} ${colors.gray}│${colors.reset} ${colors.bold}Operational Capability${colors.reset.padEnd(28)} ${colors.gray}│${colors.reset}`);
    lines.push(`  ${colors.gray}├──────────────┼──────────────────────────────┼──────────────────────────────┤${colors.reset}`);

    for (const t of pillar.tools) {
      const toolCol = colors.bold + t.name.padEnd(12, ' ') + colors.reset;
      let engineCol: string;
      if (t.availableOnHost) {
        engineCol = `${colors.green}✓ Host Native${colors.reset} ${colors.dim}(system binary)${colors.reset}`.padEnd(37, ' ');
      } else {
        engineCol = `${colors.cyan}⚡ DualSurf Engine${colors.reset} ${colors.dim}(built-in)${colors.reset}`.padEnd(37, ' ');
      }
      const descSnippet = t.description.length > 28 ? t.description.slice(0, 25) + '...' : t.description;
      const descCol = descSnippet.padEnd(28, ' ');

      lines.push(`  ${colors.gray}│${colors.reset} ${toolCol} ${colors.gray}│${colors.reset} ${engineCol} ${colors.gray}│${colors.reset} ${descCol} ${colors.gray}│${colors.reset}`);
    }

    lines.push(`  ${colors.gray}└──────────────┴──────────────────────────────┴──────────────────────────────┘${colors.reset}`);
  }

  lines.push(`\n${colors.bold}Quick Commands:${colors.reset}`);
  lines.push(`  • ${colors.cyan}siem [file]${colors.reset}           : Ingest & analyze security event logs for active attack patterns`);
  lines.push(`  • ${colors.cyan}edr / sysmon${colors.reset}          : Inspect host processes, listening sockets, and registry autoruns`);
  lines.push(`  • ${colors.cyan}hunt [telemetry]${colors.reset}      : Run hypothesis-driven threat hunter across process & network events`);
  lines.push(`  • ${colors.cyan}sigma [rule]${colors.reset}          : Generate and transpile Sigma rules to SPL, KQL, and Sentinel`);
  lines.push(`  • ${colors.cyan}soar [action] [target]${colors.reset}: Generate firewall containment & DNS sinkhole isolation playbooks`);
  lines.push(`  • ${colors.cyan}dmarc <domain>${colors.reset}        : Live DNS inspection of SPF, DKIM, and DMARC mail protection\n`);

  return lines.join('\n');
}

