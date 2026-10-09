import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { BookmarkEntry, HistoryEntry } from '@dualsurf/shared-types';

export interface StorageOptions {
  dbPath?: string;
  inMemory?: boolean;
}

export class MetadataDatabase {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(options: StorageOptions = {}) {
    if (options.inMemory) {
      this.dbPath = ':memory:';
      this.db = new DatabaseSync(':memory:');
    } else if (options.dbPath) {
      this.dbPath = options.dbPath;
      this.ensureDir(path.dirname(this.dbPath));
      this.db = new DatabaseSync(this.dbPath);
    } else {
      const home = os.homedir();
      const configDir =
        process.platform === 'win32'
          ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'dualsurf')
          : path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'dualsurf');

      this.ensureDir(configDir);
      this.dbPath = path.join(configDir, 'dualsurf.db');
      this.db = new DatabaseSync(this.dbPath);
    }

    this.initializeSchema();
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error('[MetadataDatabase] Failed to create directory:', err);
      }
    }
  }

  private initializeSchema(): void {
    // Enable WAL mode for high performance concurrent reads and atomic writes
    try {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');
    } catch {
      // WAL may not be supported on in-memory DBs
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        is_private INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL DEFAULT 'default',
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        visited_at INTEGER NOT NULL,
        visit_count INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
      CREATE INDEX IF NOT EXISTS idx_history_visited_at ON history(visited_at DESC);

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL DEFAULT 'default',
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        folder_id TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);

      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL DEFAULT 'default',
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        status TEXT NOT NULL,
        total_bytes INTEGER,
        received_bytes INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  // --- History ---

  public addHistory(url: string, title: string, profileId = 'default'): HistoryEntry {
    const existing = this.db
      .prepare('SELECT id, visit_count FROM history WHERE url = ? AND profile_id = ?')
      .get(url, profileId) as { id: string; visit_count: number } | undefined;

    const now = Date.now();

    if (existing) {
      const newCount = existing.visit_count + 1;
      this.db
        .prepare('UPDATE history SET title = ?, visited_at = ?, visit_count = ? WHERE id = ?')
        .run(title, now, newCount, existing.id);

      return {
        id: existing.id,
        url,
        title,
        visitedAt: now,
        visitCount: newCount,
      };
    } else {
      const id = `hist-${now}-${Math.random().toString(36).substring(2, 6)}`;
      this.db
        .prepare(
          'INSERT INTO history (id, profile_id, url, title, visited_at, visit_count) VALUES (?, ?, ?, ?, ?, 1)'
        )
        .run(id, profileId, url, title, now);

      return {
        id,
        url,
        title,
        visitedAt: now,
        visitCount: 1,
      };
    }
  }

  public getHistory(limit = 50, profileId = 'default'): HistoryEntry[] {
    const rows = this.db
      .prepare(
        'SELECT id, url, title, visited_at as visitedAt, visit_count as visitCount FROM history WHERE profile_id = ? ORDER BY visited_at DESC LIMIT ?'
      )
      .all(profileId, limit) as unknown as HistoryEntry[];

    return rows;
  }

  public searchHistory(query: string, limit = 20, profileId = 'default'): HistoryEntry[] {
    const searchPattern = `%${query}%`;
    const rows = this.db
      .prepare(
        'SELECT id, url, title, visited_at as visitedAt, visit_count as visitCount FROM history WHERE profile_id = ? AND (url LIKE ? OR title LIKE ?) ORDER BY visited_at DESC LIMIT ?'
      )
      .all(profileId, searchPattern, searchPattern, limit) as unknown as HistoryEntry[];

    return rows;
  }

  public clearHistory(profileId?: string): void {
    if (profileId) {
      this.db.prepare('DELETE FROM history WHERE profile_id = ?').run(profileId);
    } else {
      this.db.exec('DELETE FROM history;');
    }
  }

  // --- Bookmarks ---

  public addBookmark(url: string, title: string, folderId?: string, profileId = 'default'): BookmarkEntry {
    const id = `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    this.db
      .prepare(
        'INSERT INTO bookmarks (id, profile_id, url, title, folder_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, profileId, url, title, folderId || null, now);

    return {
      id,
      url,
      title,
      folderId,
      createdAt: now,
    };
  }

  public getBookmarks(profileId = 'default'): BookmarkEntry[] {
    const rows = this.db
      .prepare(
        'SELECT id, url, title, folder_id as folderId, created_at as createdAt FROM bookmarks WHERE profile_id = ? ORDER BY created_at DESC'
      )
      .all(profileId) as unknown as BookmarkEntry[];

    return rows;
  }

  public removeBookmark(id: string): boolean {
    const result = this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }

  // --- Downloads ---

  public addDownload(
    filename: string,
    targetPath: string,
    status = 'completed',
    totalBytes?: number,
    profileId = 'default'
  ) {
    const id = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    this.db
      .prepare(
        'INSERT INTO downloads (id, profile_id, filename, path, status, total_bytes, received_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(id, profileId, filename, targetPath, status, totalBytes || null, totalBytes || null, now);

    return { id, filename, path: targetPath, status, totalBytes, createdAt: now };
  }

  public getDownloads(limit = 30, profileId = 'default') {
    return this.db
      .prepare(
        'SELECT id, filename, path, status, total_bytes as totalBytes, created_at as createdAt FROM downloads WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(profileId, limit);
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // Ignored
    }
  }
}
