import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';

export type AuditOutcome = 'started' | 'ok' | 'error' | 'denied' | 'invalid';

export interface AuditRow {
  id: number;
  timestamp: number;
  caller: string;
  command: string;
  outcome: AuditOutcome;
  input: string; // JSON serialized string
  detail: string;
  previous_hash: string;
  hash: string;
}

export interface AuditVerifyResult {
  ok: boolean;
  checked: number;
  brokenId?: number;
}

export const GENESIS_HASH = '0'.repeat(64);

export function computeRowHash(
  previousHash: string,
  timestamp: number,
  caller: string,
  command: string,
  outcome: string,
  input: string,
  detail: string
): string {
  const payload = [
    previousHash,
    String(timestamp),
    caller,
    command,
    outcome,
    input,
    detail,
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Sanitizes, redacts, and bounds input according to 01_PROJECT_CONTEXT.md rules.
 */
export function redactAndBoundInput(input: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[nested]';
  }

  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'function') {
    return null;
  }

  if (typeof input === 'bigint') {
    return input.toString();
  }

  if (typeof input === 'string') {
    if (input.length > 2000) {
      return input.slice(0, 2000) + '...[truncated]';
    }
    return input;
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    const capped = input.slice(0, 100);
    return capped.map((item) => redactAndBoundInput(item, depth + 1));
  }

  const SENSITIVE_REGEX = /^(pass(word)?|secret|token|api[_-]?key|authorization|cookie|credential)$/i;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_REGEX.test(key)) {
      result[key] = '[redacted]';
    } else {
      result[key] = redactAndBoundInput(value, depth + 1);
    }
  }

  return result;
}

export interface AuditSink {
  write(entry: {
    caller: string;
    command: string;
    outcome: AuditOutcome;
    input: unknown;
    detail?: string;
  }): Promise<AuditRow>;
  tail(count: number): Promise<AuditRow[]>;
  verify(): Promise<AuditVerifyResult>;
  close(): Promise<void> | void;
}

/**
 * SQLite Audit Sink with cryptographic hash chaining and immutability triggers.
 */
export class SqliteAuditSink implements AuditSink {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    try {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
    } catch {}

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        caller TEXT NOT NULL,
        command TEXT NOT NULL,
        outcome TEXT NOT NULL,
        input TEXT NOT NULL,
        detail TEXT NOT NULL,
        previous_hash TEXT NOT NULL,
        hash TEXT NOT NULL
      );

      CREATE TRIGGER IF NOT EXISTS audit_no_update
      BEFORE UPDATE ON audit
      BEGIN
        SELECT RAISE(ABORT, 'Audit log is append-only: UPDATE not permitted');
      END;

      CREATE TRIGGER IF NOT EXISTS audit_no_delete
      BEFORE DELETE ON audit
      BEGIN
        SELECT RAISE(ABORT, 'Audit log is append-only: DELETE not permitted');
      END;
    `);
  }

  public async write(entry: {
    caller: string;
    command: string;
    outcome: AuditOutcome;
    input: unknown;
    detail?: string;
  }): Promise<AuditRow> {
    const timestamp = Date.now();
    const redactedInput = redactAndBoundInput(entry.input);
    const inputJson = JSON.stringify(redactedInput ?? {});
    const detail = (entry.detail || '').slice(0, 1000);

    const lastRow = this.db
      .prepare('SELECT id, hash FROM audit ORDER BY id DESC LIMIT 1')
      .get() as { id: number; hash: string } | undefined;

    const previousHash = lastRow ? lastRow.hash : GENESIS_HASH;
    const hash = computeRowHash(
      previousHash,
      timestamp,
      entry.caller,
      entry.command,
      entry.outcome,
      inputJson,
      detail
    );

    const stmt = this.db.prepare(`
      INSERT INTO audit (timestamp, caller, command, outcome, input, detail, previous_hash, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      timestamp,
      entry.caller,
      entry.command,
      entry.outcome,
      inputJson,
      detail,
      previousHash,
      hash
    );

    return {
      id: Number(result.lastInsertRowid),
      timestamp,
      caller: entry.caller,
      command: entry.command,
      outcome: entry.outcome,
      input: inputJson,
      detail,
      previous_hash: previousHash,
      hash,
    };
  }

  public async tail(count: number): Promise<AuditRow[]> {
    const safeCount = Math.max(1, Math.min(500, count));
    const rows = this.db
      .prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?')
      .all(safeCount) as unknown as AuditRow[];

    return rows.reverse();
  }

  public async verify(): Promise<AuditVerifyResult> {
    const rows = this.db
      .prepare('SELECT * FROM audit ORDER BY id ASC')
      .all() as unknown as AuditRow[];
    let prevHash = GENESIS_HASH;
    let checked = 0;

    for (const row of rows) {
      if (row.previous_hash !== prevHash) {
        return { ok: false, checked, brokenId: row.id };
      }

      const expectedHash = computeRowHash(
        row.previous_hash,
        row.timestamp,
        row.caller,
        row.command,
        row.outcome,
        row.input,
        row.detail
      );

      if (row.hash !== expectedHash) {
        return { ok: false, checked, brokenId: row.id };
      }

      prevHash = row.hash;
      checked++;
    }

    return { ok: true, checked };
  }

  // Testing helper: Drops triggers and mutates a row to simulate tampering
  public tamperRowForTesting(id: number, newDetail: string): void {
    this.db.exec('DROP TRIGGER IF EXISTS audit_no_update;');
    this.db.prepare('UPDATE audit SET detail = ? WHERE id = ?').run(newDetail, id);
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // Ignore if already closed
    }
  }
}

/**
 * In-memory Audit Sink for fast testing.
 */
export class MemoryAuditSink implements AuditSink {
  private rows: AuditRow[] = [];
  private nextId = 1;
  public throwOnWrite = false;

  public async write(entry: {
    caller: string;
    command: string;
    outcome: AuditOutcome;
    input: unknown;
    detail?: string;
  }): Promise<AuditRow> {
    if (this.throwOnWrite) {
      throw new Error('Simulated audit sink failure');
    }

    const timestamp = Date.now();
    const redactedInput = redactAndBoundInput(entry.input);
    const inputJson = JSON.stringify(redactedInput ?? {});
    const detail = (entry.detail || '').slice(0, 1000);

    const prevRow = this.rows[this.rows.length - 1];
    const previousHash = prevRow ? prevRow.hash : GENESIS_HASH;
    const hash = computeRowHash(
      previousHash,
      timestamp,
      entry.caller,
      entry.command,
      entry.outcome,
      inputJson,
      detail
    );

    const row: AuditRow = {
      id: this.nextId++,
      timestamp,
      caller: entry.caller,
      command: entry.command,
      outcome: entry.outcome,
      input: inputJson,
      detail,
      previous_hash: previousHash,
      hash,
    };

    this.rows.push(row);
    return row;
  }

  public async tail(count: number): Promise<AuditRow[]> {
    const safeCount = Math.max(1, Math.min(500, count));
    return this.rows.slice(-safeCount);
  }

  public async verify(): Promise<AuditVerifyResult> {
    let prevHash = GENESIS_HASH;
    let checked = 0;

    for (const row of this.rows) {
      if (row.previous_hash !== prevHash) {
        return { ok: false, checked, brokenId: row.id };
      }

      const expectedHash = computeRowHash(
        row.previous_hash,
        row.timestamp,
        row.caller,
        row.command,
        row.outcome,
        row.input,
        row.detail
      );

      if (row.hash !== expectedHash) {
        return { ok: false, checked, brokenId: row.id };
      }

      prevHash = row.hash;
      checked++;
    }

    return { ok: true, checked };
  }

  public tamperRow(id: number, newDetail: string): void {
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.detail = newDetail;
    }
  }

  public close(): void {
    this.rows = [];
  }
}
