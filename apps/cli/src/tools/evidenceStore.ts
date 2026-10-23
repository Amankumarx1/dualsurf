import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type {
  SecurityEvidenceRecord,
  EvidenceState,
} from '@dualsurf/shared-types';
import { colors } from '../formatters.js';

/**
 * DualSurf Immutable Security Evidence Store
 *
 * Implements strict provenance tracking:
 * - Captures exact stdout, stderr, execution metadata, and exit codes.
 * - Computes cryptographic SHA-256 integrity hash of raw execution output.
 * - Enforces explicit evidence states (VERIFIED, OBSERVED, CORRELATED, etc.).
 * - Persists to disk so evidence remains traceable across application restarts.
 */
export class SecurityEvidenceStore {
  private baseDir: string;
  private manifestPath: string;
  private memoryCache: Map<string, SecurityEvidenceRecord> = new Map();

  constructor(customDir?: string) {
    if (customDir) {
      this.baseDir = customDir;
    } else {
      const home = os.homedir();
      const configDir =
        process.platform === 'win32'
          ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'dualsurf', 'evidence')
          : path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'dualsurf', 'evidence');
      this.baseDir = configDir;
    }

    this.manifestPath = path.join(this.baseDir, 'evidence-index.json');
    this.ensureDirectory();
    this.loadManifest();
  }

  private ensureDirectory(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch {
      // Fallback to local project directory if APPDATA is inaccessible
      this.baseDir = path.join(process.cwd(), '.dualsurf', 'evidence');
      this.manifestPath = path.join(this.baseDir, 'evidence-index.json');
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    }
  }

  private loadManifest(): void {
    if (fs.existsSync(this.manifestPath)) {
      try {
        const raw = fs.readFileSync(this.manifestPath, 'utf8');
        const items: SecurityEvidenceRecord[] = JSON.parse(raw);
        for (const item of items) {
          this.memoryCache.set(item.id, item);
        }
      } catch {
        // Corrupt or empty manifest, start fresh
      }
    }
  }

  private persistManifest(): void {
    try {
      const all = Array.from(this.memoryCache.values());
      fs.writeFileSync(this.manifestPath, JSON.stringify(all, null, 2), 'utf8');
    } catch (err) {
      // Failed to write index
    }
  }

  /**
   * Calculate SHA-256 integrity hash of raw execution outputs.
   */
  public computeIntegrityHash(stdout: string, stderr: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(stdout || '');
    hash.update('\n---STDERR---\n');
    hash.update(stderr || '');
    return hash.digest('hex');
  }

  /**
   * Save a newly collected security evidence record to durable disk storage.
   */
  public recordEvidence(
    data: Omit<SecurityEvidenceRecord, 'id' | 'integrityHash'>
  ): SecurityEvidenceRecord {
    this.ensureDirectory();

    const integrityHash = this.computeIntegrityHash(data.stdout, data.stderr);
    const shortHash = integrityHash.slice(0, 8);
    const id = `EVD-${Date.now()}-${shortHash}`;

    const record: SecurityEvidenceRecord = {
      ...data,
      id,
      integrityHash,
    };

    // 1. Write individual record file
    try {
      const recordFile = path.join(this.baseDir, `${id}.json`);
      fs.writeFileSync(recordFile, JSON.stringify(record, null, 2), 'utf8');
    } catch {
      // Disk write error
    }

    // 2. Add to cache & update manifest
    this.memoryCache.set(id, record);
    this.persistManifest();

    return record;
  }

  /**
   * Retrieve an evidence record by unique ID.
   */
  public getEvidence(id: string): SecurityEvidenceRecord | undefined {
    // Check memory cache
    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id);
    }

    // Check disk file directly
    const recordFile = path.join(this.baseDir, `${id}.json`);
    if (fs.existsSync(recordFile)) {
      try {
        const raw = fs.readFileSync(recordFile, 'utf8');
        const rec = JSON.parse(raw);
        this.memoryCache.set(id, rec);
        return rec;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * List all stored evidence records with optional filtering.
   */
  public listEvidence(filter?: {
    toolId?: string;
    state?: EvidenceState;
    target?: string;
    limit?: number;
  }): SecurityEvidenceRecord[] {
    let results = Array.from(this.memoryCache.values());

    if (filter?.toolId) {
      const tid = filter.toolId.toLowerCase();
      results = results.filter((r) => r.toolId.toLowerCase() === tid || r.toolName.toLowerCase() === tid);
    }

    if (filter?.state) {
      results = results.filter((r) => r.state === filter.state);
    }

    if (filter?.target) {
      const targetQuery = filter.target.toLowerCase();
      results = results.filter((r) => (r.target || '').toLowerCase().includes(targetQuery));
    }

    // Sort descending by execution time (most recent first)
    results.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

    if (filter?.limit && filter.limit > 0) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Verify cryptographic integrity of an evidence record against its saved hash.
   */
  public verifyIntegrity(id: string): {
    valid: boolean;
    storedHash: string;
    calculatedHash: string;
    record?: SecurityEvidenceRecord;
  } {
    const record = this.getEvidence(id);
    if (!record) {
      return { valid: false, storedHash: '', calculatedHash: '' };
    }

    const calculatedHash = this.computeIntegrityHash(record.stdout, record.stderr);
    const valid = calculatedHash === record.integrityHash;

    return {
      valid,
      storedHash: record.integrityHash,
      calculatedHash,
      record,
    };
  }

  /**
   * Export evidence record in JSON or raw output format.
   */
  public exportEvidence(id: string, format: 'json' | 'raw' = 'json'): string {
    const record = this.getEvidence(id);
    if (!record) {
      throw new Error(`Evidence record "${id}" not found.`);
    }

    if (format === 'raw') {
      return [
        `=== DUALSURF EVIDENCE ARCHIVE: ${record.id} ===`,
        `Tool: ${record.toolName} (ID: ${record.toolId})`,
        `Command Executed: ${record.commandExecuted}`,
        `Target: ${record.target || 'localhost'}`,
        `Executed At: ${record.executedAt} | Completed At: ${record.completedAt}`,
        `Exit Code: ${record.exitCode} | Duration: ${record.durationMs}ms`,
        `Evidence State: ${record.state}`,
        `SHA-256 Integrity: ${record.integrityHash}`,
        `\n--- STDOUT ---\n${record.stdout || '(no stdout)'}`,
        `\n--- STDERR ---\n${record.stderr || '(no stderr)'}`,
      ].join('\n');
    }

    return JSON.stringify(record, null, 2);
  }

  /**
   * Clear all records (testing/demo environments only).
   */
  public clearAll(): void {
    this.memoryCache.clear();
    try {
      if (fs.existsSync(this.manifestPath)) {
        fs.unlinkSync(this.manifestPath);
      }
      const files = fs.readdirSync(this.baseDir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          fs.unlinkSync(path.join(this.baseDir, f));
        }
      }
    } catch {}
  }
}

export const evidenceStore = new SecurityEvidenceStore();

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatEvidenceList(records: SecurityEvidenceRecord[]): string {
  if (records.length === 0) {
    return [
      `\n${colors.bold}${colors.cyan}DUALSURF EVIDENCE STORE${colors.reset}`,
      `${colors.gray}──────────────────────────────────────────────────────────────────────────────${colors.reset}`,
      `  ${colors.dim}No evidence records collected yet.${colors.reset}`,
      `  ${colors.dim}Run an authorized defensive operation (e.g. dualsurf siem / dualsurf edr / dualsurf hunt)${colors.reset}`,
      `  ${colors.dim}to collect cryptographic evidence grounded in real execution.${colors.reset}\n`,
    ].join('\n');
  }

  const lines = [
    `\n${colors.bold}${colors.cyan}DUALSURF EVIDENCE STORE (${records.length} RECORDS)${colors.reset}`,
    `${colors.gray}──────────────────────────────────────────────────────────────────────────────${colors.reset}`,
    `  ${colors.bold}ID${colors.reset.padEnd(26)} ${colors.bold}Tool${colors.reset.padEnd(16)} ${colors.bold}State${colors.reset.padEnd(18)} ${colors.bold}Target / Source${colors.reset.padEnd(20)} ${colors.bold}Timestamp${colors.reset}`,
    `  ${colors.gray}──────────────────────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  for (const r of records) {
    let stateCol: string = r.state;
    if (r.state === 'VERIFIED') stateCol = `${colors.green}VERIFIED${colors.reset}`;
    else if (r.state === 'OBSERVED') stateCol = `${colors.cyan}OBSERVED${colors.reset}`;
    else if (r.state === 'CORRELATED') stateCol = `${colors.yellow}CORRELATED${colors.reset}`;
    else if (r.state === 'ANALYST_REVIEW') stateCol = `${colors.yellow}ANALYST_REV${colors.reset}`;
    else if (r.state === 'FAILED' || r.state === 'PERMISSION_DENIED') stateCol = `${colors.red}${r.state}${colors.reset}`;
    else stateCol = `${colors.dim}${r.state}${colors.reset}`;

    const idPad = r.id.padEnd(24);
    const toolPad = r.toolName.padEnd(14);
    const targetPad = ((r.target || 'localhost').length > 18 ? (r.target || 'localhost').slice(0, 15) + '...' : (r.target || 'localhost')).padEnd(18);
    const timeSnippet = new Date(r.executedAt).toLocaleTimeString();

    lines.push(`  ${colors.bold}${idPad}${colors.reset} ${toolPad} ${stateCol.padEnd(26)} ${targetPad} ${timeSnippet}`);
  }

  lines.push(`\n${colors.dim}Run "dualsurf blue evidence show <ID>" to inspect full provenance and raw output.${colors.reset}\n`);
  return lines.join('\n');
}

export function formatEvidenceDetail(record: SecurityEvidenceRecord): string {
  const isVerified = record.state === 'VERIFIED';
  const stateColor = isVerified ? colors.green : record.state === 'OBSERVED' ? colors.cyan : colors.yellow;

  const stdoutPreview = record.stdout
    ? record.stdout.slice(0, 1500) + (record.stdout.length > 1500 ? `\n... [truncated ${record.stdout.length - 1500} bytes - export for full view]` : '')
    : '(no stdout)';

  const stderrPreview = record.stderr
    ? record.stderr.slice(0, 500) + (record.stderr.length > 500 ? `\n... [truncated ${record.stderr.length - 500} bytes]` : '')
    : '(clean - no errors)';

  return [
    `\n${colors.bold}${colors.cyan}DUALSURF EVIDENCE RECORD: ${record.id}${colors.reset}`,
    `${colors.gray}══════════════════════════════════════════════════════════════════════════════${colors.reset}`,
    `  ${colors.bold}Source Tool:${colors.reset}       ${record.toolName} (ID: ${record.toolId})`,
    `  ${colors.bold}Tool Version:${colors.reset}      ${record.toolVersion || 'System default / built-in'}`,
    `  ${colors.bold}Executable Path:${colors.reset}   ${record.executablePath || 'Built-in Engine'}`,
    `  ${colors.bold}Command Executed:${colors.reset}  ${colors.green}${record.commandExecuted}${colors.reset}`,
    `  ${colors.bold}Target / Asset:${colors.reset}    ${record.target || 'localhost'}`,
    `  ${colors.bold}Execution State:${colors.reset}   ${stateColor}${colors.bold}${record.state}${colors.reset}`,
    `  ${colors.bold}Timestamps:${colors.reset}        Executed: ${record.executedAt} | Completed: ${record.completedAt} (${record.durationMs}ms)`,
    `  ${colors.bold}Process Exit Code:${colors.reset} ${record.exitCode === 0 ? `${colors.green}0 (SUCCESS)${colors.reset}` : `${colors.red}${record.exitCode} (NON-ZERO)${colors.reset}`}`,
    `  ${colors.bold}SHA-256 Hash:${colors.reset}      ${colors.yellow}${record.integrityHash}${colors.reset}`,
    `\n  ${colors.bold}Parsed Findings (${record.parsedFindings.length}):${colors.reset}`,
    ...(record.parsedFindings.length > 0
      ? record.parsedFindings.slice(0, 10).map((f) => `    • ${typeof f === 'string' ? f : JSON.stringify(f)}`)
      : ['    (no structured findings reported)']),
    `\n  ${colors.bold}Source Telemetry Coverage:${colors.reset}`,
    record.sourceCoverage
      ? [
          `    • Endpoint: ${record.sourceCoverage.endpointLogs ? '✓' : '✖'} | Network: ${record.sourceCoverage.networkLogs ? '✓' : '✖'} | DNS: ${record.sourceCoverage.dnsLogs ? '✓' : '✖'} | Cloud: ${record.sourceCoverage.cloudAudit ? '✓' : '✖'} | Identity: ${record.sourceCoverage.identityLogs ? '✓' : '✖'}`,
          record.sourceCoverage.missingSources.length > 0 ? `    • Gaps: Missing ${record.sourceCoverage.missingSources.join(', ')}` : '',
        ].filter(Boolean).join('\n')
      : '    (single-source observation)',
    `\n  ${colors.bold}Raw Standard Output:${colors.reset}`,
    `${colors.gray}──────────────────────────────────────────────────────────────────────────────${colors.reset}`,
    stdoutPreview,
    `${colors.gray}──────────────────────────────────────────────────────────────────────────────${colors.reset}`,
    `  ${colors.bold}Raw Standard Error:${colors.reset}`,
    stderrPreview,
    `\n${colors.dim}Use "dualsurf blue evidence export ${record.id}" to dump full untruncated evidence archive.${colors.reset}\n`,
  ].join('\n');
}
