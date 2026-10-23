import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type {
  LogSourceInfo,
  SecurityEvidenceRecord,
  CaseTimelineEvent,
  BlueTeamCaseRecord,
  BlueTeamHuntRecord,
} from '@dualsurf/shared-types';
import { colors } from '../formatters.js';
import { executeShellCommand } from './shellExecutor.js';
import { evidenceStore } from './evidenceStore.js';
import { incidentStore, extractIocs, mapToMitreAttack } from './blueTeam.js';

// ============================================================================
// 1. TELEMETRY SOURCE DEFINITIONS & AUTO-DISCOVERY
// ============================================================================

export interface TelemetryEvent {
  timestamp: string;
  eventId?: number | string;
  provider: string;
  level: string;
  message: string;
  raw?: any;
  iocs?: any[];
  mitreTechniques?: any[];
}

export interface TelemetryQueryResult {
  source: LogSourceInfo;
  timeWindow: string;
  eventsCount: number;
  events: TelemetryEvent[];
  rawOutput: string;
  evidence: SecurityEvidenceRecord;
}

export function parsePowerShellJsonDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString();
  const match = /\/Date\((\d+)\)\//.exec(dateStr);
  if (match) return new Date(parseInt(match[1], 10)).toISOString();
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export async function runPowerShellScript(
  script: string,
  timeoutMs = 15000
): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }> {
  const isWindows = process.platform === 'win32';
  if (!isWindows) {
    return executeShellCommand(script, { timeoutMs });
  }
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return executeShellCommand(`powershell.exe -NoProfile -EncodedCommand ${encoded}`, { timeoutMs });
}

/**
 * Return inventory of host-supported telemetry sources and verify their live availability.
 */
export async function listTelemetrySources(): Promise<LogSourceInfo[]> {
  const isWindows = process.platform === 'win32';
  const sources: LogSourceInfo[] = [];

  if (isWindows) {
    // 1. Windows System Event Log
    sources.push({
      id: 'win-system',
      name: 'Windows System Event Log',
      type: 'windows_event',
      pathOrEndpoint: 'System',
      connected: true,
      status: 'ACTIVE',
    });

    // 2. Windows Application Event Log
    sources.push({
      id: 'win-application',
      name: 'Windows Application Event Log',
      type: 'windows_event',
      pathOrEndpoint: 'Application',
      connected: true,
      status: 'ACTIVE',
    });

    // 3. PowerShell Operational Log
    sources.push({
      id: 'win-powershell',
      name: 'Microsoft-Windows-PowerShell/Operational',
      type: 'windows_event',
      pathOrEndpoint: 'Microsoft-Windows-PowerShell/Operational',
      connected: true,
      status: 'ACTIVE',
    });

    // 4. Windows Security Audit Log (Test permission)
    try {
      const res = await executeShellCommand(
        'powershell.exe -NoProfile -Command "Get-WinEvent -LogName Security -MaxEvents 1 | Out-Null"',
        { timeoutMs: 3000 }
      );
      const isPermDenied = res.exitCode !== 0 || res.stderr.includes('UnauthorizedAccessException') || res.stderr.includes('unauthorized operation');
      sources.push({
        id: 'win-security',
        name: 'Windows Security Audit Log',
        type: 'windows_event',
        pathOrEndpoint: 'Security',
        connected: !isPermDenied,
        status: isPermDenied ? 'PERMISSION_DENIED' : 'ACTIVE',
      });
    } catch {
      sources.push({
        id: 'win-security',
        name: 'Windows Security Audit Log',
        type: 'windows_event',
        pathOrEndpoint: 'Security',
        connected: false,
        status: 'PERMISSION_DENIED',
      });
    }

    // 5. Sysmon Telemetry (Check if channel registered)
    try {
      const res = await executeShellCommand(
        'powershell.exe -NoProfile -Command "Get-WinEvent -ListLog Microsoft-Windows-Sysmon/Operational -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IsEnabled"',
        { timeoutMs: 3000 }
      );
      const isEnabled = res.stdout.trim().toLowerCase() === 'true';
      sources.push({
        id: 'win-sysmon',
        name: 'Microsoft Sysmon Telemetry',
        type: 'windows_event',
        pathOrEndpoint: 'Microsoft-Windows-Sysmon/Operational',
        connected: isEnabled,
        status: isEnabled ? 'ACTIVE' : 'UNCONFIGURED',
      });
    } catch {
      sources.push({
        id: 'win-sysmon',
        name: 'Microsoft Sysmon Telemetry',
        type: 'windows_event',
        pathOrEndpoint: 'Microsoft-Windows-Sysmon/Operational',
        connected: false,
        status: 'UNCONFIGURED',
      });
    }

    // 6. Live Process & Service Inventory
    sources.push({
      id: 'win-process',
      name: 'Live Process & Service Telemetry',
      type: 'windows_event',
      pathOrEndpoint: 'Get-Process / WMI',
      connected: true,
      status: 'ACTIVE',
    });
  } else {
    // Linux / Darwin / Kali
    const journalExists = fs.existsSync('/run/systemd/journal') || fs.existsSync('/var/log/journal');
    sources.push({
      id: 'linux-journal',
      name: 'systemd Journald Log',
      type: 'local_syslog',
      pathOrEndpoint: '/run/systemd/journal',
      connected: journalExists,
      status: journalExists ? 'ACTIVE' : 'DISCONNECTED',
    });

    const authLogExists = fs.existsSync('/var/log/auth.log') || fs.existsSync('/var/log/secure');
    sources.push({
      id: 'linux-auth',
      name: 'Linux Authentication Log',
      type: 'local_syslog',
      pathOrEndpoint: fs.existsSync('/var/log/auth.log') ? '/var/log/auth.log' : '/var/log/secure',
      connected: authLogExists,
      status: authLogExists ? 'ACTIVE' : 'UNCONFIGURED',
    });

    const syslogExists = fs.existsSync('/var/log/syslog') || fs.existsSync('/var/log/messages');
    sources.push({
      id: 'linux-syslog',
      name: 'System Syslog Stream',
      type: 'local_syslog',
      pathOrEndpoint: fs.existsSync('/var/log/syslog') ? '/var/log/syslog' : '/var/log/messages',
      connected: syslogExists,
      status: syslogExists ? 'ACTIVE' : 'UNCONFIGURED',
    });

    sources.push({
      id: 'linux-process',
      name: 'Linux /proc Process Table',
      type: 'local_syslog',
      pathOrEndpoint: '/proc',
      connected: fs.existsSync('/proc'),
      status: 'ACTIVE',
    });
  }

  return sources;
}

/**
 * Perform a deep preflight check on a single telemetry source.
 */
export async function checkTelemetrySource(sourceId: string): Promise<LogSourceInfo> {
  const sources = await listTelemetrySources();
  const source = sources.find((s) => s.id.toLowerCase() === sourceId.toLowerCase());
  if (!source) {
    throw new Error(`Telemetry source "${sourceId}" is not a recognized DualSurf telemetry provider.`);
  }

  if (source.status === 'PERMISSION_DENIED') {
    return source;
  }

  // Attempt reading 1 event to get live event timestamp & total counts
  if (process.platform === 'win32') {
    if (source.id === 'win-process') {
      const res = await runPowerShellScript('(Get-Process).Count', 4000);
      source.eventsCount = parseInt(res.stdout.trim(), 10) || 0;
      source.lastEventTime = new Date().toISOString();
    } else {
      const psCmd = `Get-WinEvent -LogName '${source.pathOrEndpoint}' -MaxEvents 1 | Select-Object -ExpandProperty TimeCreated | ConvertTo-Json -Compress`;
      const res = await runPowerShellScript(psCmd, 5000);
      if (res.exitCode === 0 && res.stdout.trim()) {
        source.lastEventTime = parsePowerShellJsonDate(res.stdout.trim().replace(/^"|"$/g, ''));
        // Get approximate total count
        const countRes = await runPowerShellScript(
          `(Get-WinEvent -ListLog '${source.pathOrEndpoint}').RecordCount`,
          3000
        );
        source.eventsCount = parseInt(countRes.stdout.trim(), 10) || undefined;
      }
    }
  }

  return source;
}

// ============================================================================
// 2. REAL TELEMETRY INGESTION & PARSING
// ============================================================================

export async function queryTelemetry(
  sourceId: string,
  options: { since?: string; limit?: number } = {}
): Promise<TelemetryQueryResult> {
  const limit = Math.min(Math.max(options.limit || 25, 1), 200);
  const since = options.since || '24h';
  const startMs = Date.now();

  const source = await checkTelemetrySource(sourceId);
  if (source.status === 'PERMISSION_DENIED') {
    throw new Error(
      `Permission Denied: Access to ${source.name} requires administrative privileges or Event Log Readers group membership.`
    );
  }
  if (source.status === 'UNCONFIGURED' || !source.connected) {
    throw new Error(
      `Source Unavailable: ${source.name} is not installed, configured, or enabled on this system.`
    );
  }

  const events: TelemetryEvent[] = [];
  let rawStdout = '';
  let commandExecuted = '';

  if (process.platform === 'win32') {
    if (source.id === 'win-process') {
      const psScript = `Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First ${limit} Id, ProcessName, WorkingSet64, CPU, Path | ConvertTo-Json -Compress`;
      commandExecuted = `powershell.exe Get-Process -First ${limit}`;
      const res = await runPowerShellScript(psScript, 15000);
      rawStdout = res.stdout;

      try {
        const parsed = JSON.parse(res.stdout || '[]');
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const p of items) {
          if (!p || !p.ProcessName) continue;
          const memMb = p.WorkingSet64 ? Math.round(p.WorkingSet64 / (1024 * 1024)) : 0;
          events.push({
            timestamp: new Date().toISOString(),
            eventId: p.Id,
            provider: p.ProcessName,
            level: memMb > 1000 ? 'Warning' : 'Information',
            message: `Process: ${p.ProcessName} (PID ${p.Id}) | WorkingSet: ${memMb} MB | Path: ${p.Path || 'N/A'}`,
            raw: p,
          });
        }
      } catch (err: any) {
        throw new Error(`Failed to parse process telemetry JSON: ${err.message}`);
      }
    } else {
      // Time window parsing
      let timeFilter = '(Get-Date).AddHours(-24)';
      if (since.endsWith('m')) {
        const mins = parseInt(since, 10) || 60;
        timeFilter = `(Get-Date).AddMinutes(-${mins})`;
      } else if (since.endsWith('h')) {
        const hours = parseInt(since, 10) || 24;
        timeFilter = `(Get-Date).AddHours(-${hours})`;
      } else if (since.endsWith('d')) {
        const days = parseInt(since, 10) || 1;
        timeFilter = `(Get-Date).AddDays(-${days})`;
      }

      const psScript = `Get-WinEvent -FilterHashtable @{LogName='${source.pathOrEndpoint}'; StartTime=${timeFilter}} -MaxEvents ${limit} -ErrorAction SilentlyContinue | Select-Object TimeCreated, Id, ProviderName, LevelDisplayName, Message | ConvertTo-Json -Compress`;
      commandExecuted = `powershell.exe Get-WinEvent -LogName ${source.pathOrEndpoint} -MaxEvents ${limit} -Since ${since}`;
      const res = await runPowerShellScript(psScript, 20000);
      rawStdout = res.stdout;

      if (res.stdout.trim()) {
        try {
          const parsed = JSON.parse(res.stdout);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const ev of items) {
            if (!ev) continue;
            const msg = ev.Message ? String(ev.Message).replace(/\r\n/g, ' ').substring(0, 500) : 'No message content';
            const iocs = extractIocs(msg);
            const mitre = mapToMitreAttack(msg);
            events.push({
              timestamp: parsePowerShellJsonDate(ev.TimeCreated),
              eventId: ev.Id,
              provider: ev.ProviderName || source.pathOrEndpoint,
              level: ev.LevelDisplayName || 'Information',
              message: msg,
              raw: ev,
              iocs,
              mitreTechniques: mitre,
            });
          }
        } catch (err: any) {
          throw new Error(`Failed to parse event log output: ${err.message}`);
        }
      }
    }
  } else {
    // Linux journal / syslog collection
    if (source.id === 'linux-process') {
      commandExecuted = `ps aux --sort=-%mem | head -n ${limit + 1}`;
      const res = await executeShellCommand(commandExecuted);
      rawStdout = res.stdout;
      const lines = res.stdout.split('\n').slice(1);
      for (const line of lines) {
        if (!line.trim()) continue;
        events.push({
          timestamp: new Date().toISOString(),
          provider: 'ps-aux',
          level: 'Information',
          message: line.trim(),
        });
      }
    } else {
      commandExecuted = `journalctl -n ${limit} --output=short-iso --no-pager`;
      const res = await executeShellCommand(commandExecuted);
      rawStdout = res.stdout;
      const lines = res.stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        events.push({
          timestamp: line.substring(0, 25).trim() || new Date().toISOString(),
          provider: source.name,
          level: line.includes('error') ? 'Error' : line.includes('warn') ? 'Warning' : 'Information',
          message: line.substring(26).trim(),
        });
      }
    }
  }

  // Record into Immutable Evidence Store
  const durationMs = Date.now() - startMs;
  const evidenceRecord = evidenceStore.recordEvidence({
    executionId: `EXEC-LOG-${source.id}-${Date.now()}`,
    toolId: `collector-${source.id}`,
    toolName: `DualSurf Telemetry Collector (${source.name})`,
    target: source.pathOrEndpoint,
    commandExecuted,
    executedAt: new Date(startMs).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs,
    exitCode: 0,
    stdout: rawStdout,
    stderr: '',
    state: events.length > 0 ? 'VERIFIED' : 'OBSERVED',
    parsedFindings: events,
    sourceCoverage: {
      endpointLogs: true,
      networkLogs: false,
      dnsLogs: false,
      cloudAudit: false,
      identityLogs: source.id === 'win-security' || source.id === 'linux-auth',
      missingSources: [],
    },
    limitations:
      events.length === 0
        ? `No events observed in the specified time window (${since}). This does not indicate the absence of activity outside the window.`
        : undefined,
  });

  return {
    source,
    timeWindow: since,
    eventsCount: events.length,
    events,
    rawOutput: rawStdout,
    evidence: evidenceRecord,
  };
}

// ============================================================================
// 3. THREAT HUNTING ENGINE
// ============================================================================

export const REGISTERED_THREAT_HUNTS: BlueTeamHuntRecord[] = [
  {
    id: 'HUNT-001',
    title: 'Suspicious PowerShell Execution & Obfuscation',
    hypothesis:
      'Adversaries utilize PowerShell with encoded commands, execution policy bypasses, or in-memory download cradles to execute unapproved scripts.',
    dataSources: ['win-powershell', 'linux-journal', 'linux-syslog'],
    query: '-enc|frombase64|downloadstring|bypass|-w\\s+hidden|iex\\(',
    timeWindow: '24h',
    findings: [],
    limitations: 'Limited to hosts with PowerShell operational logging enabled.',
    analystConclusion: 'Pending Hunt Run',
    mitreTechniques: ['T1059.001 - PowerShell', 'T1027 - Obfuscated Files or Information'],
    linkedEvidenceIds: [],
    status: 'Draft',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'HUNT-002',
    title: 'DistributedCOM Permission Anomalies',
    hypothesis:
      'Frequent Event ID 10016 warnings may indicate lateral movement reconnaissance or unauthorized RPC application activation attempts.',
    dataSources: ['win-system', 'linux-journal', 'linux-syslog'],
    query: '10016|DistributedCOM',
    timeWindow: '24h',
    findings: [],
    limitations: 'DCOM warnings can be common on default Windows desktop configurations.',
    analystConclusion: 'Pending Hunt Run',
    mitreTechniques: ['T1021.003 - Distributed Component Object Model'],
    linkedEvidenceIds: [],
    status: 'Draft',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'HUNT-003',
    title: 'Unexpected Windows Service Installations',
    hypothesis:
      'Malicious persistence is established by installing rogue system services (Event ID 7045 / Service Control Manager).',
    dataSources: ['win-system', 'linux-journal', 'linux-syslog'],
    query: '7045|Service Control Manager',
    timeWindow: '7d',
    findings: [],
    limitations: 'Legitimate software installers also generate Event 7045.',
    analystConclusion: 'Pending Hunt Run',
    mitreTechniques: ['T1543.003 - Windows Service'],
    linkedEvidenceIds: [],
    status: 'Draft',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'HUNT-004',
    title: 'Failed Logon Spikes & Credential Guessing',
    hypothesis:
      'Adversaries attempting brute force or password spraying produce concentrated Event ID 4625 clusters in Security logs.',
    dataSources: ['win-security', 'linux-auth', 'linux-syslog'],
    query: '4625|Audit Failure',
    timeWindow: '24h',
    findings: [],
    limitations: 'Requires elevated privileges to read Windows Security event stream.',
    analystConclusion: 'Pending Hunt Run',
    mitreTechniques: ['T1110 - Brute Force', 'T1110.003 - Password Spraying'],
    linkedEvidenceIds: [],
    status: 'Draft',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'HUNT-005',
    title: 'High-Memory / Unusual Working Set Processes',
    hypothesis:
      'In-memory implants, cryptominers, or large staging binaries exhibit unusually high working set memory footprint (> 1GB).',
    dataSources: ['win-process', 'linux-process'],
    query: 'WorkingSet > 1000MB',
    timeWindow: 'live',
    findings: [],
    limitations: 'Legitimate development IDEs and web browsers commonly consume > 1GB RAM.',
    analystConclusion: 'Pending Hunt Run',
    mitreTechniques: ['T1055 - Process Injection', 'T1496 - Resource Hijacking'],
    linkedEvidenceIds: [],
    status: 'Draft',
    createdAt: new Date().toISOString(),
  },
];

export function listThreatHunts(): BlueTeamHuntRecord[] {
  return REGISTERED_THREAT_HUNTS;
}

/**
 * Execute a threat hunt hypothesis against real host telemetry.
 */
export async function runThreatHunt(
  huntId: string,
  preferredSource?: string
): Promise<{
  hunt: BlueTeamHuntRecord;
  matches: TelemetryEvent[];
  evidence: SecurityEvidenceRecord;
  explanation: string;
}> {
  const hunt = REGISTERED_THREAT_HUNTS.find((h) => h.id.toLowerCase() === huntId.toLowerCase());
  if (!hunt) {
    throw new Error(`Threat hunt hypothesis "${huntId}" was not found in the registry.`);
  }

  const availableSources = await listTelemetrySources();
  const availableIds = new Set(availableSources.map((s) => s.id.toLowerCase()));

  let sourceId = preferredSource;
  if (!sourceId || !availableIds.has(sourceId.toLowerCase())) {
    sourceId = hunt.dataSources.find((ds) => availableIds.has(ds.toLowerCase())) || hunt.dataSources[0];
  }

  const queryResult = await queryTelemetry(sourceId, { since: hunt.timeWindow, limit: 100 });

  const queryRegex = new RegExp(hunt.query, 'i');
  const matchingEvents: TelemetryEvent[] = [];

  for (const ev of queryResult.events) {
    if (huntId === 'HUNT-005') {
      let memMb = ev.raw?.WorkingSet64 ? Math.round(ev.raw.WorkingSet64 / (1024 * 1024)) : 0;
      if (!memMb && ev.message) {
        // Parse Linux ps aux line: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
        const parts = ev.message.trim().split(/\s+/);
        const rssKb = parseInt(parts[5], 10);
        if (!isNaN(rssKb)) memMb = Math.round(rssKb / 1024);
      }
      if (memMb > 1000) {
        matchingEvents.push(ev);
      }
    } else {
      if (queryRegex.test(ev.message) || queryRegex.test(String(ev.eventId || ''))) {
        matchingEvents.push(ev);
      }
    }
  }

  hunt.status = 'Completed';
  hunt.findings = matchingEvents.map((m) => `[${m.timestamp}] ${m.provider}: ${m.message.substring(0, 100)}`);
  hunt.linkedEvidenceIds = [queryResult.evidence.id];

  let explanation = '';
  if (matchingEvents.length > 0) {
    explanation = `${matchingEvents.length} events matched the hunt hypothesis pattern "${hunt.query}". Corroborate with additional context before declaring an incident.`;
    hunt.analystConclusion = explanation;
  } else {
    explanation = `0 events matched the hypothesis pattern in the queried ${hunt.timeWindow} window. Note: Zero matches in this bounded window does not conclude that the host is completely threat-free.`;
    hunt.analystConclusion = explanation;
  }

  return {
    hunt,
    matches: matchingEvents,
    evidence: queryResult.evidence,
    explanation,
  };
}

// ============================================================================
// 4. INCIDENT TIMELINE & REPORT GENERATOR
// ============================================================================

export function buildCaseTimeline(caseId: string): CaseTimelineEvent[] {
  const c = incidentStore.getCase(caseId);
  if (!c) {
    throw new Error(`Incident case "${caseId}" not found in case store.`);
  }

  const timeline: CaseTimelineEvent[] = [];

  // Add notes as events
  if (c.notes) {
    c.notes.forEach((n, idx) => {
      timeline.push({
        id: `TLE-NOTE-${idx + 1}`,
        timestamp: n.timestamp,
        title: `Analyst Note [${n.author}]`,
        description: n.text,
        analyst: n.author,
      });
    });
  }

  // Link any evidence records referencing this case or explicitly linked via c.evidenceIds
  const evidenceRecords = evidenceStore.listEvidence();
  const linkedEvidenceSet = new Set(c.evidenceIds || []);
  for (const ev of evidenceRecords) {
    if (linkedEvidenceSet.has(ev.id) || ev.target?.includes(c.id) || ev.commandExecuted?.includes(c.id)) {
      timeline.push({
        id: `TLE-EVD-${ev.id}`,
        timestamp: ev.executedAt,
        title: `Evidence Collected (${ev.toolName})`,
        description: `Target: ${ev.target || 'host'} | Exit: ${ev.exitCode} | SHA-256: ${ev.integrityHash.slice(0, 12)}...`,
        evidenceId: ev.id,
        sourceTool: ev.toolName,
      });
    }
  }

  return timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function generateBlueTeamReport(
  caseId: string,
  format: 'markdown' | 'json' = 'markdown'
): { reportContent: string; filePath: string } {
  const c = incidentStore.getCase(caseId);
  if (!c) {
    throw new Error(`Incident case "${caseId}" not found for report generation.`);
  }

  const timeline = buildCaseTimeline(caseId);
  const evidenceList = evidenceStore.listEvidence();

  const reportDir = path.join(process.cwd(), '.dualsurf', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const fileName = `incident-report-${caseId.toLowerCase()}.${format === 'json' ? 'json' : 'md'}`;
  const filePath = path.join(reportDir, fileName);

  if (format === 'json') {
    const reportData = {
      case: c,
      timeline,
      hostMetadata: {
        hostname: os.hostname(),
        platform: process.platform,
        arch: os.arch(),
        release: os.release(),
      },
      generatedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(reportData, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
    return { reportContent: content, filePath };
  }

  // Markdown Report
  const mdLines = [
    `# DUALSURF BLUE TEAM INCIDENT INVESTIGATION REPORT`,
    ``,
    `**Case ID:** \`${c.id}\`  `,
    `**Title:** ${c.title}  `,
    `**Severity:** **${c.severity}** | **Status:** ${c.status}  `,
    ...(c.isFalsePositive
      ? [`**Disposition:** **FALSE POSITIVE** (${c.falsePositiveReason || 'Benign'})  `]
      : []),
    `**Assigned To:** ${c.assignedTo || 'SOC Analyst Tier 1'}  `,
    `**Report Generated:** ${new Date().toUTCString()}  `,
    `**Investigation Host:** \`${os.hostname()}\` (${process.platform} ${os.release()})  `,
    ``,
    `---`,
    ``,
    `## 1. Executive Summary`,
    `${c.notes?.[0]?.text || 'Formal investigation opened under DualSurf SOC triage workflow.'}`,
    ``,
    `## 2. Affected Assets & Accounts`,
    `- **Hosts:** ${c.affectedHosts?.length ? c.affectedHosts.join(', ') : 'None documented'}`,
    `- **Accounts:** ${c.affectedUsers?.length ? c.affectedUsers.join(', ') : 'None documented'}`,
    `- **Category:** ${c.category}`,
    ``,
    `## 3. Indicators of Compromise (IOCs) & MITRE ATT&CK`,
    `### Extracted IOCs`,
    c.iocs?.length ? c.iocs.map((i) => `- \`${i}\``).join('\n') : `_No external indicators identified._`,
    ``,
    `### MITRE ATT&CK Mappings`,
    c.mitreTechniques?.length ? c.mitreTechniques.map((m) => `- **${m}**`).join('\n') : `_Pending adversary technique correlation._`,
    ``,
    `## 4. Chronological Incident Timeline`,
    `| Timestamp (UTC) | Phase / Event | Description | Evidence ID |`,
    `| :--- | :--- | :--- | :--- |`,
    timeline.length
      ? timeline.map((t) => `| ${t.timestamp} | ${t.title} | ${t.description} | ${t.evidenceId || 'N/A'} |`).join('\n')
      : `| ${c.createdAt} | Case Initialization | Initial triage case record created | N/A |`,
    ``,
    `## 5. Correlated Security Evidence`,
    `| Evidence ID | Tool / Provider | SHA-256 Output Hash | State | Duration |`,
    `| :--- | :--- | :--- | :--- | :--- |`,
    evidenceList.length
      ? evidenceList
          .filter((e) => (c.evidenceIds || []).includes(e.id) || e.target?.includes(c.id))
          .concat(evidenceList.filter((e) => !(c.evidenceIds || []).includes(e.id) && !e.target?.includes(c.id)))
          .slice(0, 10)
          .map((e) => `| \`${e.id}\` | ${e.toolName} | \`${e.integrityHash.slice(0, 16)}...\` | ${e.state} | ${e.durationMs}ms |`)
          .join('\n')
      : `| _None_ | _No associated evidence recorded_ | - | - | - |`,
    ``,
    `## 6. Containment & Remediation Actions`,
    c.containmentSteps?.length ? c.containmentSteps.map((s, idx) => `${idx + 1}. ${s}`).join('\n') : `_No immediate containment steps prescribed._`,
    ``,
    `---`,
    `*Report generated authentically by DualSurf Blue Team DFIR Subsystem.*`,
  ];

  const reportContent = mdLines.join('\n');
  fs.writeFileSync(filePath, reportContent, 'utf8');
  return { reportContent, filePath };
}

// ============================================================================
// 5. HUMAN-APPROVED RESPONSE ACTIONS (DRY-RUN & PREVIEW)
// ============================================================================

export function previewResponseAction(
  action: string,
  target: string
): {
  action: string;
  target: string;
  proposedCommand: string;
  expectedImpact: string;
  requiresApproval: boolean;
  status: 'PREVIEW_ONLY';
} {
  const isWindows = process.platform === 'win32';
  let proposedCommand = '';
  let expectedImpact = '';

  switch (action.toLowerCase()) {
    case 'isolate-host':
      proposedCommand = isWindows
        ? `netsh advfirewall firewall add rule name="DualSurf-Containment" dir=in action=block`
        : `iptables -A INPUT -j DROP && iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT`;
      expectedImpact = `Sever all inbound and outbound network connectivity for ${target}, preserving only forensic console management.`;
      break;

    case 'terminate-process':
      proposedCommand = isWindows
        ? `Stop-Process -Id ${target} -Force`
        : `kill -9 ${target}`;
      expectedImpact = `Immediately kill running process ${target}. In-flight memory and uncommitted state will be terminated.`;
      break;

    case 'block-ip':
      proposedCommand = isWindows
        ? `netsh advfirewall firewall add rule name="Block-IOC-${target}" dir=in action=block remoteip=${target}`
        : `iptables -I INPUT -s ${target} -j DROP`;
      expectedImpact = `Block network ingress and egress packets matching external IP ${target}.`;
      break;

    default:
      proposedCommand = `echo "Response action '${action}' on target '${target}'"`;
      expectedImpact = `Dry run execution of custom response action.`;
      break;
  }

  return {
    action,
    target,
    proposedCommand,
    expectedImpact,
    requiresApproval: true,
    status: 'PREVIEW_ONLY',
  };
}

// ============================================================================
// 6. TERMINAL FORMATTERS
// ============================================================================

export function formatTelemetrySources(sources: LogSourceInfo[]): string {
  const lines = [
    `\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.cyan}║                    DUALSURF HOST TELEMETRY SOURCES INVENTORY                  ║${colors.reset}`,
    `${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
    `  Host: ${os.hostname()} (${process.platform} ${os.release()}) | Total Sources: ${sources.length}`,
    `${colors.gray}────────────────────────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  for (const s of sources) {
    const statusBadge =
      s.status === 'ACTIVE'
        ? `${colors.green}[ACTIVE]${colors.reset}`
        : s.status === 'PERMISSION_DENIED'
        ? `${colors.red}[PERMISSION DENIED]${colors.reset}`
        : s.status === 'DISCONNECTED'
        ? `${colors.yellow}[DISCONNECTED]${colors.reset}`
        : `${colors.dim}[NOT CONFIGURED]${colors.reset}`;

    lines.push(`  ${colors.bold}${s.id.padEnd(16)}${colors.reset} ${statusBadge} ${s.name}`);
    lines.push(`    ${colors.dim}Target/Channel:${colors.reset} ${s.pathOrEndpoint}`);
    if (s.eventsCount !== undefined) {
      lines.push(`    ${colors.dim}Total Records:${colors.reset}  ${s.eventsCount.toLocaleString()} events`);
    }
    if (s.lastEventTime) {
      lines.push(`    ${colors.dim}Latest Record:${colors.reset}  ${s.lastEventTime}`);
    }
    lines.push('');
  }

  lines.push(`  ${colors.dim}Run "dualsurf blue logs query <source-id> --since 1h" to ingest real events.${colors.reset}\n`);
  return lines.join('\n');
}

export function formatTelemetryEvents(events: TelemetryEvent[], source: LogSourceInfo, evidenceId: string): string {
  const lines = [
    `\n${colors.bold}${colors.cyan}REAL TELEMETRY INGESTION: ${source.name}${colors.reset}`,
    `  Source ID: ${source.id} | Events Captured: ${events.length} | Evidence ID: ${colors.green}${evidenceId}${colors.reset}`,
    `${colors.gray}────────────────────────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (events.length === 0) {
    lines.push(`  ${colors.yellow}No events found matching the specified time window.${colors.reset}\n`);
    return lines.join('\n');
  }

  for (let i = 0; i < Math.min(events.length, 15); i++) {
    const ev = events[i];
    const lvlColor =
      ev.level.toLowerCase().includes('err') || ev.level.toLowerCase().includes('crit')
        ? colors.red
        : ev.level.toLowerCase().includes('warn')
        ? colors.yellow
        : colors.cyan;

    lines.push(`  ${colors.dim}[${ev.timestamp}]${colors.reset} ${lvlColor}${ev.level.padEnd(11)}${colors.reset} ${colors.bold}${ev.provider}${colors.reset} (EventID: ${ev.eventId || 'N/A'})`);
    lines.push(`    ${ev.message.substring(0, 160)}${ev.message.length > 160 ? '...' : ''}`);
    if (ev.mitreTechniques && ev.mitreTechniques.length > 0) {
      lines.push(`    ${colors.yellow}MITRE ATT&CK:${colors.reset} ${ev.mitreTechniques.map((m: any) => m.id || m).join(', ')}`);
    }
    lines.push('');
  }

  if (events.length > 15) {
    lines.push(`  ${colors.dim}... and ${events.length - 15} more events. Run with "--json" for full raw dataset.${colors.reset}\n`);
  }

  return lines.join('\n');
}

export function formatThreatHuntsList(hunts: BlueTeamHuntRecord[]): string {
  const lines = [
    `\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.cyan}║                   DUALSURF BLUE TEAM THREAT HUNTING HYPOTHESES                 ║${colors.reset}`,
    `${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
  ];

  for (const h of hunts) {
    lines.push(`  ${colors.bold}${h.id}${colors.reset}: ${colors.cyan}${h.title}${colors.reset}`);
    lines.push(`    ${colors.dim}Hypothesis:${colors.reset}   ${h.hypothesis}`);
    lines.push(`    ${colors.dim}Data Sources:${colors.reset} ${h.dataSources.join(', ')} | Query: \`${h.query}\``);
    lines.push(`    ${colors.dim}MITRE ATT&CK:${colors.reset} ${h.mitreTechniques.join(', ')}`);
    lines.push('');
  }

  lines.push(`  ${colors.dim}Run "dualsurf blue hunt run <hunt-id>" to execute a hunt against host telemetry.${colors.reset}\n`);
  return lines.join('\n');
}

export function formatThreatHuntResult(result: {
  hunt: BlueTeamHuntRecord;
  matches: TelemetryEvent[];
  evidence: SecurityEvidenceRecord;
  explanation: string;
}): string {
  const lines = [
    `\n${colors.bold}${colors.cyan}THREAT HUNT EXECUTION: ${result.hunt.id} - ${result.hunt.title}${colors.reset}`,
    `  Evidence Record: ${colors.green}${result.evidence.id}${colors.reset} | Matches: ${result.matches.length}`,
    `${colors.gray}────────────────────────────────────────────────────────────────────────────────${colors.reset}`,
    `  ${colors.bold}Hypothesis:${colors.reset} ${result.hunt.hypothesis}`,
    `  ${colors.bold}Analyst Explanation:${colors.reset} ${result.explanation}`,
    '',
  ];

  if (result.matches.length > 0) {
    lines.push(`  ${colors.bold}${colors.yellow}MATCHED TELEMETRY EVENTS (${result.matches.length}):${colors.reset}`);
    result.matches.slice(0, 5).forEach((m, idx) => {
      lines.push(`    ${idx + 1}. [${m.timestamp}] ${m.provider}: ${m.message.substring(0, 140)}`);
    });
  } else {
    lines.push(`  ${colors.green}✔ No matching telemetry events detected in the queried window.${colors.reset}`);
  }

  lines.push(`\n  ${colors.dim}SHA-256 Evidence Hash: ${result.evidence.integrityHash}${colors.reset}\n`);
  return lines.join('\n');
}
