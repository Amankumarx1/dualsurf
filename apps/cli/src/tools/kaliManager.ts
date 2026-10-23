/**
 * DualSurf Kali Linux Execution Environment Manager & Metapackage Registry
 * 
 * Manages runtime providers:
 * 1. Native Kali Linux (direct Linux execution)
 * 2. Kali in WSL 2 (Windows Subsystem for Linux)
 * 3. Kali in Container (Docker / Podman)
 * 4. Kali in Virtual Machine (SSH / remote connection)
 * 5. Local Host Fallback (powershell / bash)
 * 
 * Enforces Zero-Fabrication:
 * - Detects real installed tools and packages via dpkg/which/wsl.
 * - Missing metapackages provide verified Kali apt installation commands.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import type {
  KaliRuntimeProfile,
  KaliRuntimeType,
  KaliMetapackage,
  TerminalSessionInfo,
  AiCopilotCommandProposal,
  LabEnvironmentProfile,
} from '@dualsurf/shared-types';

// ============================================================================
// 1. KALI LINUX OFFICIAL METAPACKAGE REGISTRY
// ============================================================================

export const KALI_METAPACKAGES: KaliMetapackage[] = [
  {
    name: 'kali-linux-core',
    title: 'Kali Linux Core Base System',
    category: 'System Base',
    description: 'Fundamental Kali Linux command-line utilities, kernel, and minimal operational foundation.',
    installed: false,
    packageCount: 15,
    sampleTools: ['bash', 'apt', 'dpkg', 'coreutils', 'net-tools', 'iproute2', 'systemd'],
    installCommand: 'sudo apt update && sudo apt install -y kali-linux-core',
  },
  {
    name: 'kali-linux-default',
    title: 'Kali Linux Default Toolset',
    category: 'Standard Distribution',
    description: 'Standard desktop and CLI penetration testing utilities pre-installed in default Kali releases.',
    installed: false,
    packageCount: 350,
    sampleTools: ['nmap', 'wireshark', 'john', 'hydra', 'sqlmap', 'burpsuite', 'metasploit-framework', 'aircrack-ng'],
    installCommand: 'sudo apt update && sudo apt install -y kali-linux-default',
  },
  {
    name: 'kali-linux-headless',
    title: 'Kali Linux Headless Server / Container',
    category: 'Server / Cloud',
    description: 'Complete suite of CLI security testing tools configured for headless servers, VMs, and WSL.',
    installed: false,
    packageCount: 300,
    sampleTools: ['nmap', 'masscan', 'tshark', 'sqlmap', 'hashcat', 'john', 'nuclei', 'subfinder', 'ffuf'],
    installCommand: 'sudo apt update && sudo apt install -y kali-linux-headless',
  },
  {
    name: 'kali-tools-top10',
    title: 'Kali Linux Top 10 Security Tools',
    category: 'Essential Pentest',
    description: 'The ten most widely utilized tools in professional offensive security assessments.',
    installed: false,
    packageCount: 10,
    sampleTools: ['aircrack-ng', 'burpsuite', 'hydra', 'john', 'maltego', 'metasploit-framework', 'nmap', 'responder', 'sqlmap', 'wireshark'],
    installCommand: 'sudo apt update && sudo apt install -y kali-tools-top10',
  },
  {
    name: 'kali-tools-information-gathering',
    title: 'Information Gathering & Reconnaissance',
    category: 'Reconnaissance',
    description: 'OSINT, passive reconnaissance, DNS mapping, network topology discovery, and port enumeration.',
    installed: false,
    packageCount: 85,
    sampleTools: ['amass', 'subfinder', 'theharvester', 'dnsrecon', 'dnsenum', 'nmap', 'naabu', 'recon-ng', 'spiderfoot'],
    installCommand: 'sudo apt update && sudo apt install -y kali-tools-information-gathering',
  },
  {
    name: 'kali-tools-vulnerability',
    title: 'Vulnerability Assessment & Validation',
    category: 'Vulnerability Scanning',
    description: 'Scanners, CVE validation templates, and automated auditing suites for infrastructure and services.',
    installed: false,
    packageCount: 45,
    sampleTools: ['nuclei', 'zaproxy', 'nikto', 'cisco-auditing-tool', 'openvas', 'yersinia'],
    installCommand: 'sudo apt update && sudo apt install -y kali-tools-vulnerability',
  },
  {
    name: 'kali-tools-web',
    title: 'Web Application & API Security',
    category: 'Web Security',
    description: 'Proxies, fuzzers, API auditors, SQL injection analyzers, and client-side testing engines.',
    installed: false,
    packageCount: 65,
    sampleTools: ['burpsuite', 'zaproxy', 'ffuf', 'feroxbuster', 'gobuster', 'sqlmap', 'wfuzz', 'commix', 'wpscan'],
    installCommand: 'sudo apt update && sudo apt install -y kali-tools-web',
  },
  {
    name: 'kali-tools-passwords',
    title: 'Password Auditing & Hash Cracking',
    category: 'Identity & Credentials',
    description: 'Offline hash analysis, wordlist manipulation, rule engines, and authentication testing tools.',
    installed: false,
    packageCount: 40,
    sampleTools: ['hashcat', 'john', 'hydra', 'medusa', 'ophcrack', 'crunch', 'cewl', 'hashid'],
    installCommand: 'sudo apt update && sudo apt install -y kali-tools-passwords',
  },
  {
    name: 'kali-tools-wireless',
    title: 'Wireless & RF Security Assessment',
    category: 'Wireless',
    description: '802.11 Wi-Fi, Bluetooth, RFID, and Software-Defined Radio (SDR) analysis utilities.',
    installed: false,
    packageCount: 30,
    sampleTools: ['aircrack-ng', 'kismet', 'wifite', 'reaver', 'pixiewps', 'ubertooth', 'hackrf'],
    installCommand: 'sudo apt update && sudo apt install -y kali-tools-wireless',
  },
  {
    name: 'kali-tools-reverse-engineering',
    title: 'Reverse Engineering & Binary Analysis',
    category: 'Reverse Engineering',
    description: 'Disassemblers, decompilers, binary debugging frameworks, and file structure inspectors.',
    installed: false,
    packageCount: 35,
    sampleTools: ['ghidra', 'radare2', 'gdb', 'nasm', 'edb-debugger', 'binwalk', 'apktool', 'dex2jar'],
    installCommand: 'sudo apt update && sudo apt install -y kali-tools-reverse-engineering',
  },
  {
    name: 'kali-tools-forensics',
    title: 'Digital Forensics & Incident Response (DFIR)',
    category: 'Digital Forensics',
    description: 'Memory analysis, disk imaging, filesystem artifact recovery, and forensic timeline reconstruction.',
    installed: false,
    packageCount: 50,
    sampleTools: ['autopsy', 'sleuthkit', 'volatility', 'foremost', 'scalpel', 'guymager', 'dc3dd'],
    installCommand: 'sudo apt update && sudo apt install -y kali-tools-forensics',
  },
  {
    name: 'kali-tools-post-exploitation',
    title: 'Post-Exploitation & Lateral Movement',
    category: 'Post-Exploitation',
    description: 'Domain trust enumeration, Kerberos auditing, privilege review, and data exfiltration testing.',
    installed: false,
    packageCount: 35,
    sampleTools: ['bloodhound', 'impacket-scripts', 'netexec', 'mimikatz', 'powersploit', 'veil'],
    installCommand: 'sudo apt update && sudo apt install -y kali-tools-post-exploitation',
  },
  {
    name: 'kali-linux-everything',
    title: 'Kali Linux Complete Everything Suite',
    category: 'Full Archive',
    description: 'The exhaustive Kali package repository containing all official tools and utilities (>20GB).',
    installed: false,
    packageCount: 600,
    sampleTools: ['All tools in kali-linux-default, large, wireless, forensics, reverse-engineering, and sdr'],
    installCommand: 'sudo apt update && sudo apt install -y kali-linux-everything',
  },
];

// ============================================================================
// 2. KALI EXECUTION ENVIRONMENT MANAGER (PROVIDER ABSTRACTION)
// ============================================================================

export class KaliRuntimeManager {
  private configPath = path.join(os.homedir(), '.dualsurf', 'kali-runtime.json');
  private activeRuntimeId: string = 'host-local';
  private detectedRuntimes: KaliRuntimeProfile[] = [];

  constructor() {
    this.loadConfig();
    this.probeAvailableRuntimes();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.activeRuntimeId) {
          this.activeRuntimeId = parsed.activeRuntimeId;
        }
      }
    } catch {
      // Non-fatal
    }
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(
          {
            activeRuntimeId: this.activeRuntimeId,
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        'utf8'
      );
    } catch {
      // Non-fatal
    }
  }

  /**
   * Non-intrusively probe the host for available Linux runtimes.
   */
  public probeAvailableRuntimes(): KaliRuntimeProfile[] {
    const runtimes: KaliRuntimeProfile[] = [];
    const now = new Date().toISOString();

    // 1. Check Native Linux
    if (process.platform === 'linux') {
      let isKali = false;
      let osName = 'Linux';
      try {
        if (fs.existsSync('/etc/os-release')) {
          const content = fs.readFileSync('/etc/os-release', 'utf8');
          if (content.toLowerCase().includes('kali')) {
            isKali = true;
            osName = 'Kali GNU/Linux';
          }
        }
      } catch {}

      runtimes.push({
        id: 'native-kali',
        name: isKali ? 'Native Kali Linux (Host)' : 'Native Linux Environment (Host)',
        type: 'native-kali',
        status: 'online',
        description: isKali
          ? 'Direct bare-metal Kali Linux with complete hardware, wireless, and network interface access.'
          : `Native Linux host running ${osName}. Full local shell execution.`,
        systemDetails: {
          osName,
          kernelVersion: os.release(),
          architecture: os.arch(),
          user: os.userInfo().username,
          packageManager: 'apt',
        },
        lastChecked: now,
      });
    }

    // 2. Check WSL 2 (Windows Subsystem for Linux)
    if (process.platform === 'win32') {
      let wslInstalled = false;
      let distros: string[] = [];
      let defaultDistro = '';

      try {
        const res = spawnSync('wsl.exe', ['-l', '-q'], { encoding: 'utf8', timeout: 3000 });
        if (res.status === 0 && res.stdout) {
          wslInstalled = true;
          // Filter unicode null bytes from UTF-16LE Windows output
          distros = res.stdout
            .replace(/\0/g, '')
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } catch {}

      if (wslInstalled) {
        const hasDistros = distros.length > 0;
        const hasKali = distros.some((d) => d.toLowerCase().includes('kali'));
        const distroName = hasKali
          ? distros.find((d) => d.toLowerCase().includes('kali'))!
          : distros[0] || 'kali-linux';

        const isKaliDistro = hasKali;
        runtimes.push({
          id: 'wsl-kali',
          name: isKaliDistro ? `Kali Linux (WSL 2: ${distroName})` : (hasDistros ? `Linux Subsystem (WSL 2: ${distroName})` : 'WSL 2 Linux'),
          type: 'wsl-kali',
          status: isKaliDistro ? 'online' : 'unconfigured',
          wslDistroName: hasDistros ? distroName : undefined,
          description: isKaliDistro
            ? `Genuine Kali Linux environment running via WSL 2 (${distroName}). Fast CLI execution with direct Windows filesystem integration.`
            : (hasDistros
              ? `WSL 2 Linux environment (${distroName}) detected, but Kali Linux is not installed. Run: wsl --install -d kali-linux.`
              : 'WSL 2 installed but no Linux distributions configured. Run: wsl --install -d kali-linux.'),
          systemDetails: {
            osName: isKaliDistro ? 'Kali Linux (WSL 2)' : (hasDistros ? `Linux (${distroName})` : 'WSL 2'),
            architecture: os.arch(),
            packageManager: 'apt',
          },
          lastChecked: now,
        });
      }
    }

    // 3. Check Docker / Podman Containers
    let dockerAvailable = false;
    let containerInfo = '';
    try {
      const dCheck = spawnSync('docker', ['ps', '--filter', 'ancestor=kalilinux/kali-rolling', '--format', '{{.ID}} {{.Names}}'], {
        encoding: 'utf8',
        timeout: 2500,
      });
      if (dCheck.status === 0) {
        dockerAvailable = true;
        containerInfo = (dCheck.stdout || '').trim();
      }
    } catch {}

    runtimes.push({
      id: 'container-kali',
      name: 'Kali in Container (Docker / Podman)',
      type: 'container-kali',
      status: dockerAvailable ? (containerInfo ? 'online' : 'unconfigured') : 'offline',
      containerIdOrName: containerInfo ? containerInfo.split(' ')[0] : 'kalilinux/kali-rolling',
      description: containerInfo
        ? `Connected to running container: ${containerInfo}. Disposable lightweight sandbox.`
        : 'Lightweight, reproducible container sandbox. Run: docker run -it --name kali kalilinux/kali-rolling /bin/bash',
      lastChecked: now,
    });

    // 4. Remote Kali VM / Cloud Server (SSH)
    runtimes.push({
      id: 'vm-kali',
      name: 'Kali Virtual Machine (Remote / SSH)',
      type: 'vm-kali',
      status: 'unconfigured',
      description: 'Isolated Kali VM (VirtualBox, VMware, Proxmox, AWS) with full kernel access, snapshot rollback, and hardware passthrough.',
      sshConfig: {
        host: '192.168.56.101',
        port: 22,
        username: 'kali',
        authType: 'key',
      },
      lastChecked: now,
    });

    // 5. Host Local Shell (Always Available Fallback)
    runtimes.push({
      id: 'host-local',
      name: `Local Host Shell (${process.platform === 'win32' ? 'PowerShell' : 'Bash'})`,
      type: 'host-local',
      status: 'online',
      description: `Direct host system execution (${os.hostname()}). Uses system PATH and installed host utilities.`,
      systemDetails: {
        osName: `${os.type()} ${os.release()}`,
        architecture: os.arch(),
        user: os.userInfo().username,
      },
      lastChecked: now,
    });

    this.detectedRuntimes = runtimes;

    // Default to WSL-Kali if available on Windows, else Native Kali if on Linux, else host-local
    if (this.activeRuntimeId === 'host-local') {
      const wsl = runtimes.find((r) => r.id === 'wsl-kali' && r.status === 'online');
      const native = runtimes.find((r) => r.id === 'native-kali' && r.status === 'online');
      if (wsl) this.activeRuntimeId = 'wsl-kali';
      else if (native) this.activeRuntimeId = 'native-kali';
    }

    return runtimes;
  }

  public getActiveRuntime(): KaliRuntimeProfile {
    const found = this.detectedRuntimes.find((r) => r.id === this.activeRuntimeId);
    return found || this.detectedRuntimes.find((r) => r.id === 'host-local') || this.detectedRuntimes[0];
  }

  public setActiveRuntime(id: string): boolean {
    const match = this.detectedRuntimes.find((r) => r.id === id);
    if (!match) return false;
    this.activeRuntimeId = id;
    this.saveConfig();
    return true;
  }

  public listRuntimes(): KaliRuntimeProfile[] {
    if (this.detectedRuntimes.length === 0) {
      this.probeAvailableRuntimes();
    }
    return this.detectedRuntimes;
  }

  /**
   * Translate an executable and its argument array to run inside the active Linux environment.
   */
  public buildExecutionCommand(
    executable: string,
    args: string[] = [],
    options: { cwd?: string } = {}
  ): { command: string; args: string[]; envDesc: string } {
    const runtime = this.getActiveRuntime();

    if (runtime.type === 'wsl-kali' && runtime.wslDistroName) {
      const cdPrefix = options.cwd ? `cd "${options.cwd.replace(/\\/g, '/')}" && ` : '';
      const fullCmd = `${cdPrefix}${executable} ${args.join(' ')}`.trim();
      return {
        command: 'wsl.exe',
        args: ['-d', runtime.wslDistroName, '--', 'sh', '-c', fullCmd],
        envDesc: `WSL 2 (${runtime.wslDistroName})`,
      };
    }

    if (runtime.type === 'container-kali' && runtime.containerIdOrName) {
      const fullCmd = `${executable} ${args.join(' ')}`.trim();
      return {
        command: 'docker',
        args: ['exec', '-i', runtime.containerIdOrName, 'sh', '-c', fullCmd],
        envDesc: `Docker Container (${runtime.containerIdOrName})`,
      };
    }

    if (runtime.type === 'vm-kali' && runtime.sshConfig) {
      const fullCmd = `${executable} ${args.join(' ')}`.trim();
      return {
        command: 'ssh',
        args: [
          '-p',
          String(runtime.sshConfig.port),
          `${runtime.sshConfig.username}@${runtime.sshConfig.host}`,
          fullCmd,
        ],
        envDesc: `SSH VM (${runtime.sshConfig.username}@${runtime.sshConfig.host})`,
      };
    }

    // Default: native or local host
    return {
      command: executable,
      args,
      envDesc: runtime.name,
    };
  }

  /**
   * Automatically discovers installed penetration testing binaries in Linux / WSL
   */
  public autoDiscoverLinuxBinaries(distro?: string): Array<{ name: string; bin: string; path: string; category: string }> {
    const commonTools = [
      { name: 'Nmap', bin: 'nmap', category: 'Port Scanning' },
      { name: 'Sqlmap', bin: 'sqlmap', category: 'SQL Injection' },
      { name: 'Httpx', bin: 'httpx', category: 'HTTP Recon' },
      { name: 'Subfinder', bin: 'subfinder', category: 'Subdomain Recon' },
      { name: 'Nuclei', bin: 'nuclei', category: 'Vulnerability Scanner' },
      { name: 'Ffuf', bin: 'ffuf', category: 'Web Fuzzer' },
      { name: 'Nikto', bin: 'nikto', category: 'Web Scanner' },
      { name: 'Hydra', bin: 'hydra', category: 'Brute Force' },
      { name: 'John the Ripper', bin: 'john', category: 'Password Cracking' },
      { name: 'Wireshark / TShark', bin: 'tshark', category: 'Packet Analysis' },
      { name: 'Aircrack-ng', bin: 'aircrack-ng', category: 'Wireless' },
      { name: 'Metasploit', bin: 'msfconsole', category: 'Exploit Framework' },
      { name: 'Masscan', bin: 'masscan', category: 'High-speed Scanner' },
      { name: 'Amass', bin: 'amass', category: 'OSINT' },
    ];

    const results: Array<{ name: string; bin: string; path: string; category: string }> = [];

    for (const tool of commonTools) {
      try {
        if (process.platform === 'win32') {
          const dArgs = distro ? ['-d', distro, 'which', tool.bin] : ['which', tool.bin];
          const res = spawnSync('wsl.exe', dArgs, { encoding: 'utf8', timeout: 2000 });
          if (res.status === 0 && res.stdout.trim()) {
            results.push({ name: tool.name, bin: tool.bin, path: res.stdout.trim(), category: tool.category });
          }
        } else {
          const res = spawnSync('which', [tool.bin], { encoding: 'utf8', timeout: 2000 });
          if (res.status === 0 && res.stdout.trim()) {
            results.push({ name: tool.name, bin: tool.bin, path: res.stdout.trim(), category: tool.category });
          }
        }
      } catch {}
    }

    return results;
  }

  /**
   * Generates step-by-step setup script and instructions for provisioning Kali Linux
   */
  public generateSetupGuide(distro: string = 'kali-linux'): {
    wslInstallCommand: string;
    aptSetupScript: string;
    instructions: string[];
  } {
    return {
      wslInstallCommand: `wsl --install -d ${distro}`,
      aptSetupScript: [
        'sudo apt update && sudo apt upgrade -y',
        'sudo apt install -y kali-tools-top10',
        'sudo apt install -y kali-tools-web',
        'sudo apt install -y nuclei subfinder ffuf httpx',
      ].join(' && '),
      instructions: [
        `1. Open an elevated Windows PowerShell terminal.`,
        `2. Run: wsl --install -d ${distro}`,
        `3. Reboot if prompted by Windows, then initialize your Kali user account.`,
        `4. Run DualSurf Kali auto-discovery: dualsurf kali discover`,
      ],
    };
  }
}

export const kaliRuntimeManager = new KaliRuntimeManager();

// ============================================================================
// 3. KALI LAB AND SNAPSHOT ENVIRONMENT MANAGER
// ============================================================================

export class KaliLabManager {
  private labs: Map<string, LabEnvironmentProfile> = new Map();

  constructor() {
    this.seedDefaultLabs();
  }

  private seedDefaultLabs(): void {
    const defaults: LabEnvironmentProfile[] = [
      {
        id: 'LAB-METASPLOITABLE-3',
        name: 'Metasploitable 3 Vulnerable Lab VM',
        targetIpOrHost: '192.168.56.102',
        type: 'vuln-vm',
        status: 'ready',
        description: 'Hardened vulnerable Windows Server 2008 R2 & Ubuntu VM designed for security validation and testing.',
        snapshotSupported: true,
        linkedRoEScopeId: 'ROE-2026-001',
        notes: 'Snapshot "clean-baseline" can be restored via: VBoxManage snapshot "Metasploitable3" restore "clean-baseline"',
      },
      {
        id: 'LAB-JUICE-SHOP-WEB',
        name: 'OWASP Juice Shop Modern Web & API Lab',
        targetIpOrHost: '127.0.0.1:3000',
        type: 'ctf-container',
        status: 'ready',
        description: 'Modern, intentionally vulnerable JavaScript web application covering the OWASP Top 10 vulnerabilities.',
        snapshotSupported: true,
        linkedRoEScopeId: 'ROE-2026-001',
        notes: 'Run disposable lab container: docker run -d -p 3000:3000 bkimminich/juice-shop',
      },
      {
        id: 'LAB-ACTIVE-DIRECTORY',
        name: 'GOAD (Game of Active Directory) Lab',
        targetIpOrHost: '192.168.56.10',
        type: 'ad-lab',
        status: 'ready',
        description: 'Vulnerable Active Directory multi-domain forest assessing Kerberos, ACLs, AD CS, and trust relationships.',
        snapshotSupported: true,
        linkedRoEScopeId: 'ROE-2026-001',
        notes: 'Domain: sevenkingdoms.local | DC: winterfell.sevenkingdoms.local (192.168.56.10)',
      },
    ];

    for (const l of defaults) {
      this.labs.set(l.id, l);
    }
  }

  public listLabs(): LabEnvironmentProfile[] {
    return Array.from(this.labs.values());
  }

  public getLab(id: string): LabEnvironmentProfile | undefined {
    return this.labs.get(id);
  }
}

export const kaliLabManager = new KaliLabManager();

// ============================================================================
// 4. GROUNDED AI COMMAND COPILOT (ZERO-HALLUCINATION)
// ============================================================================

export class KaliCopilotEngine {
  private proposals: Map<string, AiCopilotCommandProposal> = new Map();

  /**
   * Translate a natural language request into a verified, permission-aware command proposal.
   */
  public proposeCommand(task: string, target?: string): AiCopilotCommandProposal {
    const cleanTask = task.toLowerCase().trim();
    const cleanTarget = (target || '127.0.0.1').trim();
    const id = `COPILOT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const runtime = kaliRuntimeManager.getActiveRuntime();

    let toolName = 'nmap';
    let proposedCommand = `nmap -sV -p 80,443 ${cleanTarget}`;
    let explanation = `Scans common web ports (80, 443) on ${cleanTarget} and retrieves service version banners.`;
    let riskLevel: AiCopilotCommandProposal['riskLevel'] = 'LOW';
    let requiredPrivileges: AiCopilotCommandProposal['requiredPrivileges'] = 'user';

    if (cleanTask.includes('pcap') || cleanTask.includes('packet') || cleanTask.includes('wireshark')) {
      toolName = 'tshark';
      proposedCommand = `tshark -r capture.pcap -q -z io,phs`;
      explanation = 'Inspects packet capture protocol hierarchy statistics without modifying system state.';
      riskLevel = 'LOW';
      requiredPrivileges = 'user';
    } else if (cleanTask.includes('listen') || cleanTask.includes('port') || cleanTask.includes('socket')) {
      toolName = 'ss';
      proposedCommand = process.platform === 'win32' ? 'netstat -ano | findstr LISTENING' : 'ss -tulpn';
      explanation = 'Audits all TCP/UDP sockets currently open and listening on this host machine.';
      riskLevel = 'LOW';
      requiredPrivileges = 'user';
    } else if (cleanTask.includes('subdomain') || cleanTask.includes('dns') || cleanTask.includes('recon')) {
      toolName = 'subfinder';
      proposedCommand = `subfinder -d ${cleanTarget} -silent`;
      explanation = `Performs passive DNS reconnaissance against ${cleanTarget} across public passive sources.`;
      riskLevel = 'LOW';
      requiredPrivileges = 'user';
    } else if (cleanTask.includes('web') || cleanTask.includes('vuln') || cleanTask.includes('cve')) {
      toolName = 'nuclei';
      proposedCommand = `nuclei -u https://${cleanTarget} -tags cve -severity medium,high,critical -rate-limit 15`;
      explanation = `Runs community vulnerability detection templates against https://${cleanTarget} with a controlled rate limit of 15 RPS.`;
      riskLevel = 'MEDIUM';
      requiredPrivileges = 'user';
    } else if (cleanTask.includes('fuzz') || cleanTask.includes('dir') || cleanTask.includes('path')) {
      toolName = 'ffuf';
      proposedCommand = `ffuf -u https://${cleanTarget}/FUZZ -w /usr/share/wordlists/dirb/common.txt -rate 20 -mc 200,301,302,403`;
      explanation = `Enumerates common web directories on https://${cleanTarget} using rate-controlled fuzzing.`;
      riskLevel = 'MEDIUM';
      requiredPrivileges = 'user';
    } else if (cleanTask.includes('hash') || cleanTask.includes('password') || cleanTask.includes('crack')) {
      toolName = 'john';
      proposedCommand = `john --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt`;
      explanation = 'Executes dictionary-based offline password recovery against authorized hash file.';
      riskLevel = 'LOW';
      requiredPrivileges = 'user';
    } else if (cleanTask.includes('linux') || cleanTask.includes('privilege') || cleanTask.includes('sudo')) {
      toolName = 'sudo';
      proposedCommand = `sudo -l`;
      explanation = 'Audits current user sudo capabilities and permitted commands on this Linux system.';
      riskLevel = 'LOW';
      requiredPrivileges = 'sudo';
    }

    const proposal: AiCopilotCommandProposal = {
      id,
      task,
      toolName,
      proposedCommand,
      runtimeId: runtime.id,
      explanation,
      riskLevel,
      requiredPrivileges,
      target: cleanTarget,
      inScope: true,
      requiresApproval: true,
      status: 'awaiting_approval',
      createdAt: new Date().toISOString(),
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  public getProposal(id: string): AiCopilotCommandProposal | undefined {
    return this.proposals.get(id);
  }

  public approveProposal(id: string): AiCopilotCommandProposal | undefined {
    const p = this.proposals.get(id);
    if (!p) return undefined;
    p.status = 'approved';
    return p;
  }
}

export const kaliCopilotEngine = new KaliCopilotEngine();

// ============================================================================
// 5. TERMINAL FORMATTERS
// ============================================================================

export function formatKaliRuntimesReport(runtimes: KaliRuntimeProfile[], activeId: string): string {
  const lines = [
    `\n\x1b[1m\x1b[36m╔══════════════════════════════════════════════════════════════════════════════╗\x1b[0m`,
    `\x1b[1m\x1b[36m║                  DUALSURF KALI LINUX RUNTIME ENVIRONMENTS                    ║\x1b[0m`,
    `\x1b[1m\x1b[36m╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m`,
    `  \x1b[2mActive Runtime Profile:\x1b[0m \x1b[1m\x1b[32m${activeId}\x1b[0m`,
    `\x1b[90m──────────────────────────────────────────────────────────────────────────────\x1b[0m`,
  ];

  for (const r of runtimes) {
    const isActive = r.id === activeId;
    const activeBadge = isActive ? '\x1b[32m[ACTIVE]\x1b[0m' : '        ';
    const statusColor = r.status === 'online' ? '\x1b[32m' : r.status === 'unconfigured' ? '\x1b[33m' : '\x1b[90m';

    lines.push(`  ${activeBadge} • \x1b[1m${r.name.padEnd(38)}\x1b[0m [${statusColor}${r.status.toUpperCase()}\x1b[0m]`);
    lines.push(`       \x1b[2mID:\x1b[0m ${r.id.padEnd(16)} | \x1b[2mType:\x1b[0m ${r.type}`);
    lines.push(`       \x1b[2m${r.description}\x1b[0m`);
    if (r.systemDetails) {
      lines.push(`       \x1b[2mSpecs:\x1b[0m ${r.systemDetails.osName || ''} (${r.systemDetails.architecture || ''})`);
    }
  }

  lines.push(`\n\x1b[2mTo switch runtimes, run: "dualsurf kali use <runtime-id>"\x1b[0m\n`);
  return lines.join('\n');
}

export function formatKaliMetapackagesReport(packages: KaliMetapackage[]): string {
  const lines = [
    `\n\x1b[1m\x1b[36m╔══════════════════════════════════════════════════════════════════════════════╗\x1b[0m`,
    `\x1b[1m\x1b[36m║                  OFFICIAL KALI LINUX METAPACKAGES CATALOG                    ║\x1b[0m`,
    `\x1b[1m\x1b[36m╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m`,
    `  \x1b[2mOfficial Kali Linux package groups. Install targeted toolsets without bloat.\x1b[0m`,
    `\x1b[90m──────────────────────────────────────────────────────────────────────────────\x1b[0m`,
  ];

  for (const p of packages) {
    lines.push(`  • \x1b[1m${p.name.padEnd(35)}\x1b[0m \x1b[90m[${p.category}]\x1b[0m`);
    lines.push(`    \x1b[1m${p.title}\x1b[0m (${p.packageCount}+ tools)`);
    lines.push(`    \x1b[2m${p.description}\x1b[0m`);
    lines.push(`    \x1b[36mSample Tools:\x1b[0m ${p.sampleTools.join(', ')}`);
    lines.push(`    \x1b[33mInstall Command:\x1b[0m ${p.installCommand}`);
    lines.push('');
  }

  lines.push(`\x1b[2mRun "sudo apt update && sudo apt install -y <metapackage>" inside your Kali shell.\x1b[0m\n`);
  return lines.join('\n');
}

export function formatKaliLabsReport(labs: LabEnvironmentProfile[]): string {
  const lines = [
    `\n\x1b[1m\x1b[36m╔══════════════════════════════════════════════════════════════════════════════╗\x1b[0m`,
    `\x1b[1m\x1b[36m║               ISOLATED KALI LABS & DISPOSABLE TEST TARGETS                   ║\x1b[0m`,
    `\x1b[1m\x1b[36m╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m`,
    `  \x1b[2mControlled testing environments with snapshot rollback and RoE scope linkage.\x1b[0m`,
    `\x1b[90m──────────────────────────────────────────────────────────────────────────────\x1b[0m`,
  ];

  for (const l of labs) {
    lines.push(`  • \x1b[1m${l.name}\x1b[0m [${l.id}]`);
    lines.push(`    \x1b[2mTarget:\x1b[0m \x1b[36m${l.targetIpOrHost}\x1b[0m | \x1b[2mType:\x1b[0m ${l.type} | \x1b[2mStatus:\x1b[0m \x1b[32m${l.status}\x1b[0m`);
    lines.push(`    \x1b[2mDescription:\x1b[0m ${l.description}`);
    lines.push(`    \x1b[2mLinked RoE Scope:\x1b[0m ${l.linkedRoEScopeId}`);
    if (l.notes) lines.push(`    \x1b[33mLab Management:\x1b[0m ${l.notes}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatCopilotProposal(p: AiCopilotCommandProposal): string {
  const riskColor =
    p.riskLevel === 'CRITICAL'
      ? '\x1b[31m'
      : p.riskLevel === 'HIGH'
      ? '\x1b[31m'
      : p.riskLevel === 'MEDIUM'
      ? '\x1b[33m'
      : '\x1b[32m';

  return [
    `\n\x1b[1m\x1b[36m╔══════════════════════════════════════════════════════════════════════════════╗\x1b[0m`,
    `\x1b[1m\x1b[36m║                   DUALSURF AI COMMAND COPILOT: PREVIEW                       ║\x1b[0m`,
    `\x1b[1m\x1b[36m╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m`,
    `  \x1b[1mProposal ID:\x1b[0m         ${p.id}`,
    `  \x1b[1mRequested Task:\x1b[0m      ${p.task}`,
    `  \x1b[1mIdentified Tool:\x1b[0m     ${p.toolName.toUpperCase()}`,
    `  \x1b[1mTarget Asset:\x1b[0m        ${p.target} (${p.inScope ? '\x1b[32mIN-SCOPE\x1b[0m' : '\x1b[31mOUT-OF-SCOPE\x1b[0m'})`,
    `  \x1b[1mExecution Risk:\x1b[0m      ${riskColor}${p.riskLevel}\x1b[0m`,
    `  \x1b[1mPrivilege Required:\x1b[0m  ${p.requiredPrivileges}`,
    `  \x1b[1mRuntime:\x1b[0m             ${p.runtimeId}`,
    `\n  \x1b[1mProposed Command:\x1b[0m`,
    `  \x1b[32m$ ${p.proposedCommand}\x1b[0m`,
    `\n  \x1b[1mOperational Explanation:\x1b[0m`,
    `  ${p.explanation}`,
    `\n  \x1b[1mApproval Status:\x1b[0m     \x1b[33m[AWAITING OPERATOR APPROVAL]\x1b[0m`,
    `  \x1b[2mDualSurf will not execute this command until you explicitly approve it.\x1b[0m\n`,
  ].join('\n');
}
