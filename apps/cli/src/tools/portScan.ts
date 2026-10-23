import * as net from 'net';
import * as dns from 'dns/promises';
import type {
  OpenPortInfo,
  PortScanReport,
  PortServiceType,
} from '@dualsurf/shared-types';
import { engagementStore } from './redTeam.js';
import { colors } from '../formatters.js';

// ============================================================================
// 1. PORT PROFILES & SERVICE KNOWLEDGE BASE
// ============================================================================

export const PORT_PROFILES: Record<string, number[]> = {
  web: [80, 443, 8000, 8008, 8080, 8443, 8888, 3000, 5000, 5173, 9000, 9443],
  common: [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 465, 587, 993, 995, 1433, 3306, 3389, 5432, 6379, 8080],
  top20: [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 465, 587, 993, 995, 1433, 3306, 3389, 5432, 6379, 8080],
  db: [1433, 1521, 3306, 5432, 6379, 9200, 27017, 28017],
  all: [
    21, 22, 23, 25, 53, 80, 110, 143, 389, 443, 445, 465, 587, 636, 993, 995,
    1433, 1521, 2049, 2375, 3000, 3306, 3389, 5000, 5173, 5432, 5900, 6379,
    8000, 8008, 8080, 8081, 8443, 8888, 9000, 9200, 9443, 10000, 27017, 28017,
  ],
};

interface PortMetadata {
  service: PortServiceType;
  description: string;
  defaultRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  riskReason: string;
  mitreTechnique: string;
  hardeningAdvice: string;
  probeType: 'http' | 'greeting' | 'passive';
}

export const PORT_DATABASE: Record<number, PortMetadata> = {
  21: {
    service: 'FTP',
    description: 'File Transfer Protocol (Cleartext)',
    defaultRisk: 'HIGH',
    riskReason: 'Transmits credentials and file payloads unencrypted over the wire.',
    mitreTechnique: 'T1071.002 - File Transfer Protocols',
    hardeningAdvice: 'Migrate to SFTP (SSH File Transfer) or FTPS with strict TLS enforcement.',
    probeType: 'greeting',
  },
  22: {
    service: 'SSH',
    description: 'Secure Shell Remote Administration',
    defaultRisk: 'MEDIUM',
    riskReason: 'Exposed remote administrative shell subject to credential brute force.',
    mitreTechnique: 'T1021.004 - SSH',
    hardeningAdvice: 'Disable password authentication, enforce Ed25519 keys, and implement Fail2ban or bastion gateway.',
    probeType: 'greeting',
  },
  23: {
    service: 'Telnet',
    description: 'Legacy Telnet Remote Terminal',
    defaultRisk: 'CRITICAL',
    riskReason: 'Completely unencrypted administrative protocol; passwords sent in plaintext.',
    mitreTechnique: 'T1021 - Remote Services',
    hardeningAdvice: 'Disable Telnet daemon immediately and replace with SSH.',
    probeType: 'greeting',
  },
  25: {
    service: 'SMTP',
    description: 'Simple Mail Transfer Protocol',
    defaultRisk: 'LOW',
    riskReason: 'Mail transfer gateway; potential open relay or user enumeration.',
    mitreTechnique: 'T1071.003 - Mail Protocols',
    hardeningAdvice: 'Ensure open relaying is disabled, require STARTTLS, and implement SPF/DKIM/DMARC.',
    probeType: 'greeting',
  },
  53: {
    service: 'DNS',
    description: 'Domain Name System',
    defaultRisk: 'INFO',
    riskReason: 'Standard name resolution service; ensure recursion is restricted on WAN.',
    mitreTechnique: 'T1071.004 - DNS',
    hardeningAdvice: 'Disable public recursive lookups to prevent DNS amplification DDoS attacks.',
    probeType: 'passive',
  },
  80: {
    service: 'HTTP',
    description: 'Hypertext Transfer Protocol (Cleartext Web)',
    defaultRisk: 'MEDIUM',
    riskReason: 'Unencrypted web traffic susceptible to passive interception and session hijacking.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Enforce automatic 301 redirect to HTTPS and enable HSTS with long max-age.',
    probeType: 'http',
  },
  110: {
    service: 'Unknown',
    description: 'Post Office Protocol (POP3 Cleartext)',
    defaultRisk: 'HIGH',
    riskReason: 'Downloads emails and transmits credentials unencrypted.',
    mitreTechnique: 'T1114 - Email Collection',
    hardeningAdvice: 'Migrate to POP3S (Port 995 with TLS) or modern OAuth2 IMAP.',
    probeType: 'greeting',
  },
  143: {
    service: 'Unknown',
    description: 'Internet Message Access Protocol (IMAP Cleartext)',
    defaultRisk: 'HIGH',
    riskReason: 'Cleartext mailbox access allowing eavesdropping of user emails.',
    mitreTechnique: 'T1114 - Email Collection',
    hardeningAdvice: 'Enforce IMAPS (Port 993) with TLS encryption.',
    probeType: 'greeting',
  },
  389: {
    service: 'Unknown',
    description: 'Lightweight Directory Access Protocol (LDAP)',
    defaultRisk: 'HIGH',
    riskReason: 'Exposes directory hierarchy and potentially allows unencrypted bind authentication.',
    mitreTechnique: 'T1087.002 - Domain Account Discovery',
    hardeningAdvice: 'Require LDAPS (Port 636) or StartTLS, and do not expose directly to public WAN.',
    probeType: 'passive',
  },
  443: {
    service: 'HTTPS',
    description: 'HTTP over TLS/SSL (Encrypted Web)',
    defaultRisk: 'INFO',
    riskReason: 'Standard encrypted web interface.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Ensure TLS 1.3/1.2 only, disable weak ciphers, and configure security headers (CSP, HSTS).',
    probeType: 'http',
  },
  445: {
    service: 'SMB',
    description: 'Server Message Block (Windows File Sharing)',
    defaultRisk: 'CRITICAL',
    riskReason: 'Highly dangerous exposure on public WAN; primary vector for ransomware, EternalBlue, and NTLM relaying.',
    mitreTechnique: 'T1021.002 - SMB/Windows Admin Shares',
    hardeningAdvice: 'Block TCP port 445 at perimeter edge firewall immediately. Never expose SMB to WAN.',
    probeType: 'passive',
  },
  465: {
    service: 'SMTP',
    description: 'SMTPS (SMTP over TLS)',
    defaultRisk: 'INFO',
    riskReason: 'Encrypted mail submission endpoint.',
    mitreTechnique: 'T1071.003 - Mail Protocols',
    hardeningAdvice: 'Enforce modern TLS versions and strong authentication.',
    probeType: 'greeting',
  },
  587: {
    service: 'SMTP',
    description: 'SMTP Mail Submission (STARTTLS)',
    defaultRisk: 'INFO',
    riskReason: 'Standard authenticated mail submission.',
    mitreTechnique: 'T1071.003 - Mail Protocols',
    hardeningAdvice: 'Require SASL authentication and mandatory STARTTLS.',
    probeType: 'greeting',
  },
  993: {
    service: 'Unknown',
    description: 'IMAPS (IMAP over TLS)',
    defaultRisk: 'INFO',
    riskReason: 'Encrypted mail retrieval.',
    mitreTechnique: 'T1114 - Email Collection',
    hardeningAdvice: 'Enforce strong cipher suites and valid TLS certificates.',
    probeType: 'passive',
  },
  995: {
    service: 'Unknown',
    description: 'POP3S (POP3 over TLS)',
    defaultRisk: 'INFO',
    riskReason: 'Encrypted mail retrieval.',
    mitreTechnique: 'T1114 - Email Collection',
    hardeningAdvice: 'Enforce modern TLS standards.',
    probeType: 'passive',
  },
  1433: {
    service: 'MSSQL',
    description: 'Microsoft SQL Server Database',
    defaultRisk: 'CRITICAL',
    riskReason: 'Database listener exposed to WAN. Vulnerable to brute force, SA account takeover, and xp_cmdshell execution.',
    mitreTechnique: 'T1190 - Exploit Public-Facing Application',
    hardeningAdvice: 'Bind database strictly to 127.0.0.1 or internal private subnet; never expose SQL port to the internet.',
    probeType: 'passive',
  },
  1521: {
    service: 'Unknown',
    description: 'Oracle Database Listener',
    defaultRisk: 'CRITICAL',
    riskReason: 'Exposed Oracle TNS listener subject to SID brute force and remote exploitation.',
    mitreTechnique: 'T1190 - Exploit Public-Facing Application',
    hardeningAdvice: 'Place Oracle listener in isolated DB subnet behind VPN.',
    probeType: 'passive',
  },
  2049: {
    service: 'Unknown',
    description: 'Network File System (NFS)',
    defaultRisk: 'HIGH',
    riskReason: 'NFS shares often lack strong authentication, permitting arbitrary root file reads/writes.',
    mitreTechnique: 'T1021.002 - SMB/Windows Admin Shares',
    hardeningAdvice: 'Restrict NFS exports strictly to trusted client IPs and enforce Kerberos security.',
    probeType: 'passive',
  },
  2375: {
    service: 'Development',
    description: 'Unencrypted Docker Engine REST API',
    defaultRisk: 'CRITICAL',
    riskReason: 'Allows unauthenticated remote root container creation and full host compromise.',
    mitreTechnique: 'T1610 - Deploy Container',
    hardeningAdvice: 'Disable unencrypted Docker daemon port 2375. Use TLS mutual authentication (Port 2376) or SSH socket tunneling.',
    probeType: 'http',
  },
  3000: {
    service: 'Development',
    description: 'Node.js / React / Grafana Dev Server',
    defaultRisk: 'LOW',
    riskReason: 'Exposed development service or administrative monitoring dashboard.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Ensure debug modes and source maps are disabled in production; place dashboards behind reverse proxy.',
    probeType: 'http',
  },
  3306: {
    service: 'MySQL',
    description: 'MySQL / MariaDB Database Server',
    defaultRisk: 'CRITICAL',
    riskReason: 'Database port exposed directly to WAN. Vulnerable to credential stuffing and auth bypasses.',
    mitreTechnique: 'T1190 - Exploit Public-Facing Application',
    hardeningAdvice: 'Configure bind-address = 127.0.0.1 in my.cnf and connect only via SSH tunnel or private VPC.',
    probeType: 'greeting',
  },
  3389: {
    service: 'RDP',
    description: 'Microsoft Remote Desktop Protocol (RDP)',
    defaultRisk: 'HIGH',
    riskReason: 'Direct remote desktop access on WAN. Primary target for credential stuffing, BlueKeep, and ransomware operators.',
    mitreTechnique: 'T1021.001 - Remote Desktop Protocol',
    hardeningAdvice: 'Place RDP behind Remote Desktop Gateway, VPN, or zero-trust identity proxy. Enforce Network Level Authentication (NLA) and MFA.',
    probeType: 'passive',
  },
  5000: {
    service: 'Development',
    description: 'Python Flask / Docker Registry / Dev Service',
    defaultRisk: 'LOW',
    riskReason: 'Application development server or internal microservice.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Avoid running development WSGI servers in production; deploy behind Nginx or Gunicorn.',
    probeType: 'http',
  },
  5173: {
    service: 'Development',
    description: 'Vite Frontend Development Server',
    defaultRisk: 'LOW',
    riskReason: 'Live frontend dev server with Hot Module Reloading.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Do not expose Vite dev server to public networks; deploy built static assets.',
    probeType: 'http',
  },
  5432: {
    service: 'PostgreSQL',
    description: 'PostgreSQL Database Server',
    defaultRisk: 'CRITICAL',
    riskReason: 'Relational database exposed to WAN. Allows remote connection attempts and potential data exfiltration.',
    mitreTechnique: 'T1190 - Exploit Public-Facing Application',
    hardeningAdvice: 'Set listen_addresses = \'localhost\' in postgresql.conf and enforce strict pg_hba.conf IP restrictions.',
    probeType: 'passive',
  },
  5900: {
    service: 'VNC',
    description: 'Virtual Network Computing (VNC Remote Desktop)',
    defaultRisk: 'HIGH',
    riskReason: 'VNC passwords are limited to 8 characters and often unencrypted.',
    mitreTechnique: 'T1021.005 - VNC',
    hardeningAdvice: 'Tunnel VNC exclusively through SSH or an encrypted VPN tunnel.',
    probeType: 'greeting',
  },
  6379: {
    service: 'Redis',
    description: 'Redis In-Memory Key-Value Datastore',
    defaultRisk: 'CRITICAL',
    riskReason: 'Often deployed without password authentication; attackers can write SSH authorized_keys or cron jobs to achieve RCE.',
    mitreTechnique: 'T1190 - Exploit Public-Facing Application',
    hardeningAdvice: 'Set bind 127.0.0.1 in redis.conf, enable protected-mode yes, and configure strong requirepass.',
    probeType: 'passive',
  },
  8000: {
    service: 'Development',
    description: 'Alternative Web / Python SimpleHTTPServer',
    defaultRisk: 'LOW',
    riskReason: 'Often used for testing, staging APIs, or ad-hoc file sharing.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Ensure directory listing is disabled and access is authenticated.',
    probeType: 'http',
  },
  8080: {
    service: 'Proxy',
    description: 'HTTP Alternative / Proxy / Tomcat / Spring Boot',
    defaultRisk: 'MEDIUM',
    riskReason: 'Common port for administrative panels, Jenkins, Tomcat manager, or Spring Boot actuator endpoints.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Audit exposed administrative endpoints (e.g. /actuator, /manager) and enforce TLS + authentication.',
    probeType: 'http',
  },
  8443: {
    service: 'HTTPS',
    description: 'HTTPS Alternative / SSL Admin Console',
    defaultRisk: 'INFO',
    riskReason: 'Encrypted alternative web or management interface.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Enforce strong credentials and multi-factor authentication for management consoles.',
    probeType: 'http',
  },
  8888: {
    service: 'Development',
    description: 'Jupyter Notebook / Web Application Proxy',
    defaultRisk: 'MEDIUM',
    riskReason: 'Often hosts interactive Jupyter notebooks allowing arbitrary code execution if token is weak.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Enforce strong token authentication and place behind corporate SSO.',
    probeType: 'http',
  },
  9000: {
    service: 'Development',
    description: 'PHP-FPM / SonarQube / MinIO Admin',
    defaultRisk: 'MEDIUM',
    riskReason: 'Exposed PHP FastCGI or object storage management API.',
    mitreTechnique: 'T1071.001 - Web Protocols',
    hardeningAdvice: 'Ensure PHP-FPM only listens on Unix socket or 127.0.0.1.',
    probeType: 'http',
  },
  9200: {
    service: 'Unknown',
    description: 'Elasticsearch REST Cluster API',
    defaultRisk: 'HIGH',
    riskReason: 'Unauthenticated Elasticsearch APIs allow querying and deletion of all indexed security logs or sensitive records.',
    mitreTechnique: 'T1190 - Exploit Public-Facing Application',
    hardeningAdvice: 'Enable X-Pack security (HTTPS + authentication) and restrict access to authorized SIEM collectors.',
    probeType: 'http',
  },
  10000: {
    service: 'Unknown',
    description: 'Webmin Server Management Console',
    defaultRisk: 'HIGH',
    riskReason: 'Web-based Linux system administration interface with root-level privileges.',
    mitreTechnique: 'T1021 - Remote Services',
    hardeningAdvice: 'Do not expose Webmin directly to WAN; restrict to internal VPN network.',
    probeType: 'http',
  },
  27017: {
    service: 'MongoDB',
    description: 'MongoDB NoSQL Database',
    defaultRisk: 'CRITICAL',
    riskReason: 'Exposed MongoDB databases are frequently ransomed or dumped when deployed without authentication.',
    mitreTechnique: 'T1190 - Exploit Public-Facing Application',
    hardeningAdvice: 'Enable authorization: enabled in mongod.conf and bind strictly to 127.0.0.1.',
    probeType: 'passive',
  },
};

// ============================================================================
// 2. SAFE ASYNCHRONOUS TCP SOCKET PROBE
// ============================================================================

/**
 * Perform a safe, bounded TCP connection probe on a single target host and port.
 */
export async function probeTcpPort(
  host: string,
  port: number,
  timeoutMs = 1500
): Promise<OpenPortInfo | null> {
  return new Promise<OpenPortInfo | null>((resolve) => {
    const t0 = Date.now();
    const meta = PORT_DATABASE[port];
    const service: PortServiceType = meta ? meta.service : 'Unknown';
    const risk = meta ? meta.defaultRisk : 'LOW';
    const riskReason = meta ? meta.riskReason : 'Non-standard port exposed on target host.';
    const mitreTechnique = meta ? meta.mitreTechnique : 'T1046 - Network Service Discovery';
    const hardeningAdvice = meta ? meta.hardeningAdvice : 'Review necessity of this exposed service and enforce firewall ingress rules.';

    let socket: net.Socket | null = null;
    let resolved = false;

    const cleanup = () => {
      if (socket) {
        try {
          socket.removeAllListeners();
          socket.destroy();
        } catch {}
        socket = null;
      }
    };

    const done = (result: OpenPortInfo | null) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    try {
      socket = net.createConnection({ host, port, timeout: timeoutMs }, () => {
        const latencyMs = Date.now() - t0;
        let banner = '';

        if (!socket) {
          done({
            port,
            protocol: 'tcp',
            state: 'open',
            service,
            latencyMs,
            risk,
            riskReason,
            mitreTechnique,
            hardeningAdvice,
          });
          return;
        }

        // Quick banner grab with safety timer
        const bannerTimer = setTimeout(() => {
          done({
            port,
            protocol: 'tcp',
            state: 'open',
            service,
            banner: banner || undefined,
            latencyMs,
            risk,
            riskReason,
            mitreTechnique,
            hardeningAdvice,
          });
        }, 350);

        socket.on('data', (chunk) => {
          clearTimeout(bannerTimer);
          const raw = chunk.toString('utf8');
          // Look for HTTP server header or greeting
          const serverMatch = raw.match(/server:\s*([^\r\n]+)/i);
          if (serverMatch) {
            banner = `Server: ${serverMatch[1].trim()}`;
          } else {
            const firstLine = raw.split(/[\r\n]+/)[0].trim();
            banner = firstLine.replace(/[\x00-\x1F\x7F-\x9F]/g, '').slice(0, 60);
          }
          done({
            port,
            protocol: 'tcp',
            state: 'open',
            service,
            banner: banner || undefined,
            latencyMs,
            risk,
            riskReason,
            mitreTechnique,
            hardeningAdvice,
          });
        });

        // For HTTP and non-greeting ports, send lightweight probe to elicit banner response
        if (meta?.probeType === 'http' || PORT_PROFILES.web.includes(port) || !meta) {
          try {
            socket.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\nUser-Agent: DualSurf-Audit/1.0\r\n\r\n`);
          } catch {}
        }
      });

      socket.on('timeout', () => done(null));
      socket.on('error', () => done(null));
    } catch {
      done(null);
    }
  });
}

// ============================================================================
// 3. AUTOMATED PORT SCANNING ENGINE
// ============================================================================

export interface PortScanOptions {
  profile?: 'web' | 'common' | 'db' | 'top20' | 'all';
  ports?: number[];
  timeoutMs?: number;
  concurrency?: number;
  scopeCheck?: boolean;
}

/**
 * Automatically inspects exposed network ports for a given website URL or hostname.
 */
export async function scanPorts(
  targetOrUrl: string,
  options: PortScanOptions = {}
): Promise<PortScanReport> {
  const startTime = Date.now();
  let host = targetOrUrl.trim();

  // Extract hostname if URL passed
  try {
    if (host.includes('://')) {
      const u = new URL(host);
      host = u.hostname;
    } else {
      const u = new URL(`https://${host}`);
      host = u.hostname;
    }
  } catch {
    // Keep host as-is
  }

  // 1. Resolve IP address
  let ip: string | undefined = undefined;
  try {
    const lookup = await dns.lookup(host);
    ip = lookup.address;
  } catch {
    // DNS resolution failed or host is local IP
    ip = host;
  }

  // 2. Rules of Engagement scope check
  let inScope: boolean | undefined = undefined;
  if (options.scopeCheck !== false) {
    const scopes = engagementStore.listScopes();
    if (scopes.length > 0) {
      const scopeCheck = engagementStore.isTargetInScope(scopes[0].id, host);
      inScope = scopeCheck.inScope;
    }
  }

  // 3. Determine port list to scan
  let portList: number[] = [];
  if (options.ports && options.ports.length > 0) {
    portList = Array.from(new Set(options.ports)).sort((a, b) => a - b);
  } else {
    const profile = options.profile || 'web';
    portList = PORT_PROFILES[profile] || PORT_PROFILES.web;
  }

  const timeoutMs = options.timeoutMs || 1500;
  const concurrency = Math.min(25, Math.max(1, options.concurrency || 10));
  const openPorts: OpenPortInfo[] = [];

  // 4. Batched parallel execution
  for (let i = 0; i < portList.length; i += concurrency) {
    const chunk = portList.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map((port) => probeTcpPort(host, port, timeoutMs))
    );
    for (const res of results) {
      if (res) openPorts.push(res);
    }
  }

  openPorts.sort((a, b) => a.port - b.port);
  const highRiskCount = openPorts.filter(
    (p) => p.risk === 'CRITICAL' || p.risk === 'HIGH'
  ).length;

  return {
    host,
    ip,
    scannedPortsCount: portList.length,
    openPortsCount: openPorts.length,
    durationMs: Date.now() - startTime,
    openPorts,
    highRiskCount,
    timestamp: new Date().toISOString(),
    inScope,
  };
}

// ============================================================================
// 4. TERMINAL REPORT FORMATTER
// ============================================================================

/**
 * Format the port scan report into a clear, high-contrast terminal representation.
 */
export function formatPortScanReport(report: PortScanReport): string {
  const riskColor =
    report.highRiskCount > 0
      ? colors.red
      : report.openPortsCount > 0
      ? colors.yellow
      : colors.green;

  const lines = [
    `\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.cyan}║         AUTOMATED PORT AUDIT & SERVICE PERIMETER SCANNER           ║${colors.reset}`,
    `${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`,
    `  ${colors.bold}Target Host:${colors.reset}    ${colors.cyan}${report.host}${colors.reset} ${report.ip ? `(${colors.dim}${report.ip}${colors.reset})` : ''}`,
    `  ${colors.bold}Exposure Risk:${colors.reset}  ${riskColor}${report.highRiskCount > 0 ? `${report.highRiskCount} HIGH/CRITICAL PORTS EXPOSED` : 'LOW RISK PERIMETER'}${colors.reset}`,
    `  ${colors.bold}Scan Coverage:${colors.reset}  ${report.openPortsCount} open ports discovered out of ${report.scannedPortsCount} probed in ${report.durationMs}ms`,
    `${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (report.inScope !== undefined) {
    lines.push(
      `  ${colors.bold}RoE Scope:${colors.reset}      ${report.inScope ? `${colors.green}✔ Authorized In-Scope Target${colors.reset}` : `${colors.yellow}⚠ Target not found in authorized RoE scope${colors.reset}`}\n`
    );
  }

  if (report.openPorts.length === 0) {
    lines.push(
      `  ${colors.green}✔ All scanned ports are closed or filtered. No exposed service listeners detected.${colors.reset}\n`
    );
  } else {
    lines.push(
      `  ${colors.bold}${'PORT'.padEnd(10)} ${'SERVICE'.padEnd(14)} ${'LATENCY'.padEnd(10)} ${'RISK'.padEnd(12)} ${'BANNER / VERSION'}${colors.reset}`,
      `  ${colors.gray}${'─'.repeat(8)}   ${'─'.repeat(12)}   ${'─'.repeat(8)}   ${'─'.repeat(10)}   ${'─'.repeat(24)}${colors.reset}`
    );

    report.openPorts.forEach((p) => {
      const portStr = `${p.port}/${p.protocol}`.padEnd(10);
      const servStr = p.service.padEnd(14);
      const latStr = `${p.latencyMs || 0}ms`.padEnd(10);
      const pRiskColor =
        p.risk === 'CRITICAL'
          ? colors.red
          : p.risk === 'HIGH'
          ? colors.red
          : p.risk === 'MEDIUM'
          ? colors.yellow
          : p.risk === 'LOW'
          ? colors.cyan
          : colors.dim;
      const riskStr = `${pRiskColor}${p.risk.padEnd(12)}${colors.reset}`;
      const bannerStr = p.banner ? `${colors.dim}${p.banner}${colors.reset}` : `${colors.dim}(No banner emitted)${colors.reset}`;

      lines.push(`  ${colors.bold}${portStr}${colors.reset} ${servStr} ${latStr} ${riskStr} ${bannerStr}`);
    });

    const highRisks = report.openPorts.filter((p) => p.risk === 'CRITICAL' || p.risk === 'HIGH');
    if (highRisks.length > 0) {
      lines.push(
        `\n  ${colors.bold}${colors.red}CRITICAL PERIMETER HARDENING ADVISORIES:${colors.reset}`
      );
      highRisks.forEach((hr) => {
        lines.push(
          `  • ${colors.bold}${colors.yellow}Port ${hr.port} (${hr.service}):${colors.reset} ${hr.riskReason}`
        );
        lines.push(`    ${colors.green}Hardening Action:${colors.reset} ${hr.hardeningAdvice}`);
        if (hr.mitreTechnique) {
          lines.push(`    ${colors.dim}MITRE ATT&CK: ${hr.mitreTechnique}${colors.reset}`);
        }
      });
    }
  }

  lines.push(
    `\n${colors.dim}Commands: "ports scan <target> --profile common", "soar block <ip>", "sec-audit <target>"${colors.reset}\n`
  );
  return lines.join('\n');
}
