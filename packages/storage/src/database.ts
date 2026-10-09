import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { BookmarkEntry, HistoryEntry } from '@dualsurf/shared-types';

export interface StorageOptions {
  dbPath?: string;
  inMemory?: boolean;
}

interface StorageData {
  profiles: Array<{ id: string; name: string; created_at: number; is_private: number }>;
  history: Array<{ id: string; profile_id: string; url: string; title: string; visited_at: number; visit_count: number }>;
  bookmarks: Array<{ id: string; profile_id: string; url: string; title: string; folder_id: string | null; created_at: number }>;
  downloads: Array<{ id: string; profile_id: string; filename: string; path: string; status: string; total_bytes: number | null; received_bytes: number | null; created_at: number }>;
  settings: Record<string, { value: string; updated_at: number }>;
}

export class MetadataDatabase {
  private inMemory: boolean = false;
  private dbPath: string;
  private sqliteDb: any = null;
  private data: StorageData = {
    profiles: [],
    history: [],
    bookmarks: [],
    downloads: [],
    settings: {},
  };

  constructor(options: StorageOptions = {}) {
    this.inMemory = !!options.inMemory;

    if (this.inMemory) {
      this.dbPath = ':memory:';
    } else if (options.dbPath) {
      this.dbPath = options.dbPath;
      this.ensureDir(path.dirname(this.dbPath));
    } else {
      const home = os.homedir();
      const configDir =
        process.platform === 'win32'
          ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'dualsurf')
          : path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'dualsurf');

      this.ensureDir(configDir);
      this.dbPath = path.join(configDir, 'dualsurf-metadata.json');
    }

    this.initDatabase();
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

  private initDatabase(): void {
    // Try native node:sqlite if available in the host runtime
    try {
      // Dynamic require so module loader does not fail at bundle time in Electron
      const sqliteModule = (module as any).require ? (module as any).require('node:sqlite') : null;
      if (sqliteModule && sqliteModule.DatabaseSync) {
        this.sqliteDb = new sqliteModule.DatabaseSync(
          this.inMemory ? ':memory:' : this.dbPath.endsWith('.json') ? this.dbPath.replace('.json', '.db') : this.dbPath
        );
        this.initSqliteSchema();
        return;
      }
    } catch {
      // node:sqlite not supported in current environment (e.g. Electron runtime)
      this.sqliteDb = null;
    }

    // Fallback: persistent JSON storage
    if (!this.inMemory && fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(raw);
      } catch {
        // Fallback default empty state
      }
    }
  }

  private initSqliteSchema(): void {
    if (!this.sqliteDb) return;
    try {
      this.sqliteDb.exec('PRAGMA journal_mode = WAL;');
      this.sqliteDb.exec('PRAGMA foreign_keys = ON;');
    } catch {
      // Ignored
    }

    this.sqliteDb.exec(`
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
    `);
  }

  private persistJson(): void {
    if (this.inMemory) return;
    try {
      const tmp = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.dbPath);
    } catch (err) {
      console.error('[MetadataDatabase] Failed to persist JSON metadata:', err);
    }
  }

  // --- History ---

  public addHistory(url: string, title: string, profileId = 'default'): HistoryEntry {
    if (this.sqliteDb) {
      const existing = this.sqliteDb
        .prepare('SELECT id, visit_count FROM history WHERE url = ? AND profile_id = ?')
        .get(url, profileId) as { id: string; visit_count: number } | undefined;

      const now = Date.now();
      if (existing) {
        const newCount = existing.visit_count + 1;
        this.sqliteDb
          .prepare('UPDATE history SET title = ?, visited_at = ?, visit_count = ? WHERE id = ?')
          .run(title, now, newCount, existing.id);

        return { id: existing.id, url, title, visitedAt: now, visitCount: newCount };
      } else {
        const id = `hist-${now}-${Math.random().toString(36).substring(2, 6)}`;
        this.sqliteDb
          .prepare('INSERT INTO history (id, profile_id, url, title, visited_at, visit_count) VALUES (?, ?, ?, ?, ?, 1)')
          .run(id, profileId, url, title, now);

        return { id, url, title, visitedAt: now, visitCount: 1 };
      }
    }

    // JSON driver
    const now = Date.now();
    const existing = this.data.history.find((h) => h.url === url && h.profile_id === profileId);

    if (existing) {
      existing.title = title;
      existing.visited_at = now;
      existing.visit_count += 1;
      this.persistJson();
      return { id: existing.id, url, title, visitedAt: now, visitCount: existing.visit_count };
    } else {
      const id = `hist-${now}-${Math.random().toString(36).substring(2, 6)}`;
      const entry = { id, profile_id: profileId, url, title, visited_at: now, visit_count: 1 };
      this.data.history.unshift(entry);
      this.persistJson();
      return { id, url, title, visitedAt: now, visitCount: 1 };
    }
  }

  public getHistory(limit = 50, profileId = 'default'): HistoryEntry[] {
    if (this.sqliteDb) {
      return this.sqliteDb
        .prepare(
          'SELECT id, url, title, visited_at as visitedAt, visit_count as visitCount FROM history WHERE profile_id = ? ORDER BY visited_at DESC LIMIT ?'
        )
        .all(profileId, limit) as unknown as HistoryEntry[];
    }

    return this.data.history
      .filter((h) => h.profile_id === profileId)
      .slice(0, limit)
      .map((h) => ({
        id: h.id,
        url: h.url,
        title: h.title,
        visitedAt: h.visited_at,
        visitCount: h.visit_count,
      }));
  }

  public searchHistory(query: string, limit = 20, profileId = 'default'): HistoryEntry[] {
    const q = query.toLowerCase();

    if (this.sqliteDb) {
      const searchPattern = `%${query}%`;
      return this.sqliteDb
        .prepare(
          'SELECT id, url, title, visited_at as visitedAt, visit_count as visitCount FROM history WHERE profile_id = ? AND (url LIKE ? OR title LIKE ?) ORDER BY visited_at DESC LIMIT ?'
        )
        .all(profileId, searchPattern, searchPattern, limit) as unknown as HistoryEntry[];
    }

    return this.data.history
      .filter((h) => h.profile_id === profileId && (h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q)))
      .slice(0, limit)
      .map((h) => ({
        id: h.id,
        url: h.url,
        title: h.title,
        visitedAt: h.visited_at,
        visitCount: h.visit_count,
      }));
  }

  public clearHistory(profileId?: string): void {
    if (this.sqliteDb) {
      if (profileId) {
        this.sqliteDb.prepare('DELETE FROM history WHERE profile_id = ?').run(profileId);
      } else {
        this.sqliteDb.exec('DELETE FROM history;');
      }
      return;
    }

    if (profileId) {
      this.data.history = this.data.history.filter((h) => h.profile_id !== profileId);
    } else {
      this.data.history = [];
    }
    this.persistJson();
  }

  // --- Bookmarks ---

  public addBookmark(url: string, title: string, folderId?: string, profileId = 'default'): BookmarkEntry {
    const id = `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    if (this.sqliteDb) {
      this.sqliteDb
        .prepare('INSERT INTO bookmarks (id, profile_id, url, title, folder_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, profileId, url, title, folderId || null, now);

      return { id, url, title, folderId, createdAt: now };
    }

    const bm = { id, profile_id: profileId, url, title, folder_id: folderId || null, created_at: now };
    this.data.bookmarks.unshift(bm);
    this.persistJson();
    return { id, url, title, folderId, createdAt: now };
  }

  public getBookmarks(profileId = 'default'): BookmarkEntry[] {
    if (this.sqliteDb) {
      return this.sqliteDb
        .prepare(
          'SELECT id, url, title, folder_id as folderId, created_at as createdAt FROM bookmarks WHERE profile_id = ? ORDER BY created_at DESC'
        )
        .all(profileId) as unknown as BookmarkEntry[];
    }

    return this.data.bookmarks
      .filter((b) => b.profile_id === profileId)
      .map((b) => ({
        id: b.id,
        url: b.url,
        title: b.title,
        folderId: b.folder_id || undefined,
        createdAt: b.created_at,
      }));
  }

  public removeBookmark(id: string): boolean {
    if (this.sqliteDb) {
      const result = this.sqliteDb.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
      return Number(result.changes) > 0;
    }

    const prevLen = this.data.bookmarks.length;
    this.data.bookmarks = this.data.bookmarks.filter((b) => b.id !== id);
    const removed = this.data.bookmarks.length < prevLen;
    if (removed) this.persistJson();
    return removed;
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

    if (this.sqliteDb) {
      this.sqliteDb
        .prepare(
          'INSERT INTO downloads (id, profile_id, filename, path, status, total_bytes, received_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(id, profileId, filename, targetPath, status, totalBytes || null, totalBytes || null, now);

      return { id, filename, path: targetPath, status, totalBytes, createdAt: now };
    }

    const dl = {
      id,
      profile_id: profileId,
      filename,
      path: targetPath,
      status,
      total_bytes: totalBytes || null,
      received_bytes: totalBytes || null,
      created_at: now,
    };
    this.data.downloads.unshift(dl);
    this.persistJson();
    return { id, filename, path: targetPath, status, totalBytes, createdAt: now };
  }

  public getDownloads(limit = 30, profileId = 'default') {
    if (this.sqliteDb) {
      return this.sqliteDb
        .prepare(
          'SELECT id, filename, path, status, total_bytes as totalBytes, created_at as createdAt FROM downloads WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?'
        )
        .all(profileId, limit);
    }

    return this.data.downloads
      .filter((d) => d.profile_id === profileId)
      .slice(0, limit)
      .map((d) => ({
        id: d.id,
        filename: d.filename,
        path: d.path,
        status: d.status,
        totalBytes: d.total_bytes,
        createdAt: d.created_at,
      }));
  }

  public close(): void {
    if (this.sqliteDb) {
      try {
        this.sqliteDb.close();
      } catch {
        // Ignored
      }
    }
  }
}
