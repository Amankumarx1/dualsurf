import * as fs from 'fs';
import * as path from 'path';
import type { BrowserHost } from './host.js';
import type { EventBus, DualSurfEvents, EventHandler, UnsubscribeFn } from './eventBus.js';
import type { CommandDefinition, PluginCommandDefinition, Logger } from './types.js';
import type { CommandRegistry } from './registry.js';
import { PermissionDeniedError } from './errors.js';

export type PluginPermission =
  | 'network:read'
  | 'network:intercept'
  | 'storage'
  | 'filesystem';

const KNOWN_PERMISSIONS = new Set<PluginPermission>([
  'network:read',
  'network:intercept',
  'storage',
  'filesystem',
]);

const PLUGIN_ID_REGEX = /^[a-z0-9][a-z0-9-]*$/;

export interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

export interface PluginFileSystem {
  readFile(subPath: string, encoding?: BufferEncoding): Promise<string | Buffer>;
  writeFile(subPath: string, data: string | Buffer): Promise<void>;
  listFiles(subPath?: string): Promise<string[]>;
  exists(subPath: string): Promise<boolean>;
  deleteFile(subPath: string): Promise<boolean>;
}

export interface PluginNetwork {
  fetch(url: string, init?: RequestInit, tabId?: string): Promise<Response>;
}

export interface PluginEvents {
  on<K extends keyof DualSurfEvents>(
    event: K,
    handler: EventHandler<DualSurfEvents[K]>
  ): UnsubscribeFn;
  emit<K extends keyof DualSurfEvents>(event: K, data: DualSurfEvents[K]): void;
}

export interface PluginApi {
  readonly pluginId: string;
  readonly permissions: ReadonlySet<PluginPermission>;
  readonly network: PluginNetwork;
  readonly storage: PluginStorage;
  readonly files: PluginFileSystem;
  readonly events: PluginEvents;
  intercept(): never; // throws "not available yet"
}

export interface PluginActivationContext {
  api: PluginApi;
  registerCommand(cmd: PluginCommandDefinition): void;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  permissions: PluginPermission[];
  activate(ctx: PluginActivationContext): Promise<void> | void;
  deactivate?(): Promise<void> | void;
}

export interface LoadedPluginSummary {
  id: string;
  name: string;
  version: string;
  permissions: PluginPermission[];
  commands: string[];
}

export class PluginLoader {
  private plugins = new Map<string, PluginManifest>();
  private loadedCommands = new Map<string, Set<string>>(); // pluginId -> commandIds
  private loadedDisposers = new Map<string, Set<UnsubscribeFn>>();
  private pluginApis = new Map<string, PluginApi>();

  private host: BrowserHost;
  private events: EventBus;
  private registry: CommandRegistry;
  private dataDir?: string;
  private logger: Logger;

  constructor(options: {
    host: BrowserHost;
    events: EventBus;
    registry: CommandRegistry;
    dataDir?: string;
    logger: Logger;
  }) {
    this.host = options.host;
    this.events = options.events;
    this.registry = options.registry;
    this.dataDir = options.dataDir;
    this.logger = options.logger;
  }

  public getPluginApi(pluginId: string): PluginApi | null {
    return this.pluginApis.get(pluginId) || null;
  }

  public listLoaded(): LoadedPluginSummary[] {
    const list: LoadedPluginSummary[] = [];
    for (const [id, manifest] of this.plugins.entries()) {
      const cmds = Array.from(this.loadedCommands.get(id) || []);
      list.push({
        id,
        name: manifest.name,
        version: manifest.version,
        permissions: [...manifest.permissions],
        commands: cmds.sort(),
      });
    }
    return list.sort((a, b) => a.id.localeCompare(b.id));
  }

  public async load(manifest: PluginManifest): Promise<void> {
    // 1. Validate manifest
    if (!PLUGIN_ID_REGEX.test(manifest.id)) {
      throw new Error(
        `Invalid plugin id '${manifest.id}': must consist of lowercase letters, digits, and hyphens`
      );
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      throw new Error(`Plugin '${manifest.id}' has invalid version string`);
    }

    for (const perm of manifest.permissions) {
      if (!KNOWN_PERMISSIONS.has(perm)) {
        throw new Error(`Plugin '${manifest.id}' declared unknown permission '${perm}'`);
      }
    }

    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin with id '${manifest.id}' is already loaded`);
    }

    const pluginId = manifest.id;
    const permissions = new Set<PluginPermission>(manifest.permissions);
    const disposers = new Set<UnsubscribeFn>();
    const registeredCommandIds = new Set<string>();

    const api = this.createPluginApi(pluginId, permissions, disposers);
    this.pluginApis.set(pluginId, api);

    const activationCtx: PluginActivationContext = {
      api,
      registerCommand: (cmdDef: PluginCommandDefinition) => {
        const fullCmd: CommandDefinition = {
          ...cmdDef,
          owner: pluginId,
          run: (input, ctx) => cmdDef.run(input, { ...ctx, pluginApi: api }),
        };

        this.registry.register(fullCmd);
        registeredCommandIds.add(cmdDef.id);
      },
    };

    // 2. Activate with rollback protection
    try {
      await manifest.activate(activationCtx);

      this.plugins.set(pluginId, manifest);
      this.loadedCommands.set(pluginId, registeredCommandIds);
      this.loadedDisposers.set(pluginId, disposers);

      this.events.emit('plugin:loaded', {
        pluginId,
        version: manifest.version,
        permissions: manifest.permissions,
      });

      this.logger.info(`Loaded plugin '${pluginId}' v${manifest.version}`);
    } catch (err) {
      // Rollback registered commands and event subscriptions
      for (const cmdId of registeredCommandIds) {
        this.registry.unregisterOwner(pluginId);
      }
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {}
      }
      this.pluginApis.delete(pluginId);

      this.logger.error(`Failed to activate plugin '${pluginId}':`, err);
      throw err;
    }
  }

  public async unload(pluginId: string): Promise<boolean> {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) return false;

    // Call deactivate if defined
    if (typeof manifest.deactivate === 'function') {
      try {
        await manifest.deactivate();
      } catch (deactErr) {
        this.logger.warn(`Error during deactivate of plugin '${pluginId}':`, deactErr);
      }
    }

    // Unregister commands
    this.registry.unregisterOwner(pluginId);
    this.loadedCommands.delete(pluginId);

    // Dispose subscriptions
    const disposers = this.loadedDisposers.get(pluginId);
    if (disposers) {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {}
      }
      this.loadedDisposers.delete(pluginId);
    }

    this.plugins.delete(pluginId);
    this.pluginApis.delete(pluginId);

    this.events.emit('plugin:unloaded', { pluginId });
    this.logger.info(`Unloaded plugin '${pluginId}'`);

    return true;
  }

  private createPluginApi(
    pluginId: string,
    permissions: ReadonlySet<PluginPermission>,
    disposers: Set<UnsubscribeFn>
  ): PluginApi {
    const assertPerm = (perm: PluginPermission) => {
      if (!permissions.has(perm)) {
        throw new PermissionDeniedError(pluginId, perm);
      }
    };

    const pluginDir = this.dataDir ? path.join(this.dataDir, 'plugins', pluginId) : undefined;

    // Storage capability
    const storage: PluginStorage = {
      get: async <T>(key: string): Promise<T | null> => {
        assertPerm('storage');
        if (!pluginDir) return null;
        const filePath = path.join(pluginDir, 'storage.json');
        if (!fs.existsSync(filePath)) return null;
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(raw);
          return (data[key] as T) ?? null;
        } catch {
          return null;
        }
      },
      set: async <T>(key: string, value: T): Promise<void> => {
        assertPerm('storage');
        if (!pluginDir) return;
        if (!fs.existsSync(pluginDir)) {
          fs.mkdirSync(pluginDir, { recursive: true, mode: 0o700 });
        }
        const filePath = path.join(pluginDir, 'storage.json');
        const tempPath = path.join(pluginDir, `storage.json.tmp.${Date.now()}`);
        let current: Record<string, unknown> = {};
        if (fs.existsSync(filePath)) {
          try {
            current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          } catch {}
        }
        current[key] = value;
        fs.writeFileSync(tempPath, JSON.stringify(current, null, 2), { mode: 0o600 });
        fs.renameSync(tempPath, filePath);
      },
      delete: async (key: string): Promise<boolean> => {
        assertPerm('storage');
        if (!pluginDir) return false;
        const filePath = path.join(pluginDir, 'storage.json');
        if (!fs.existsSync(filePath)) return false;
        try {
          const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (key in current) {
            delete current[key];
            fs.writeFileSync(filePath, JSON.stringify(current, null, 2), { mode: 0o600 });
            return true;
          }
        } catch {}
        return false;
      },
      clear: async (): Promise<void> => {
        assertPerm('storage');
        if (!pluginDir) return;
        const filePath = path.join(pluginDir, 'storage.json');
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      },
    };

    // Filesystem capability
    const filesDir = pluginDir ? path.join(pluginDir, 'files') : undefined;

    const resolveSafePath = (subPath: string): string => {
      assertPerm('filesystem');
      if (!filesDir) {
        throw new Error('Plugin filesystem is not configured (missing dataDir)');
      }
      if (!fs.existsSync(filesDir)) {
        fs.mkdirSync(filesDir, { recursive: true, mode: 0o700 });
      }

      const normalized = path.normalize(subPath);
      const target = path.resolve(filesDir, normalized);

      // Defend against path traversal
      if (!target.startsWith(filesDir + path.sep) && target !== filesDir) {
        throw new Error(`Security violation: path traversal outside plugin folder: ${subPath}`);
      }

      // Check for symlinks escaping the folder
      if (fs.existsSync(target)) {
        const real = fs.realpathSync(target);
        if (!real.startsWith(filesDir + path.sep) && real !== filesDir) {
          throw new Error(`Security violation: symlink escapes plugin folder: ${subPath}`);
        }
      }

      return target;
    };

    const files: PluginFileSystem = {
      readFile: async (subPath: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
        const target = resolveSafePath(subPath);
        return fs.readFileSync(target, encoding);
      },
      writeFile: async (subPath: string, data: string | Buffer): Promise<void> => {
        const target = resolveSafePath(subPath);
        const parent = path.dirname(target);
        if (!fs.existsSync(parent)) {
          fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
        }
        fs.writeFileSync(target, data, { mode: 0o600 });
      },
      listFiles: async (subPath = ''): Promise<string[]> => {
        const target = resolveSafePath(subPath);
        if (!fs.existsSync(target)) return [];
        return fs.readdirSync(target);
      },
      exists: async (subPath: string): Promise<boolean> => {
        try {
          const target = resolveSafePath(subPath);
          return fs.existsSync(target);
        } catch {
          return false;
        }
      },
      deleteFile: async (subPath: string): Promise<boolean> => {
        try {
          const target = resolveSafePath(subPath);
          if (fs.existsSync(target)) {
            fs.unlinkSync(target);
            return true;
          }
        } catch {}
        return false;
      },
    };

    // Network capability
    const network: PluginNetwork = {
      fetch: async (url: string, init?: RequestInit, tabId?: string): Promise<Response> => {
        assertPerm('network:read');
        return this.host.fetch(url, init, tabId);
      },
    };

    // Events capability
    const events: PluginEvents = {
      on: <K extends keyof DualSurfEvents>(
        event: K,
        handler: EventHandler<DualSurfEvents[K]>
      ): UnsubscribeFn => {
        if (String(event).startsWith('traffic:')) {
          assertPerm('network:read');
        }

        const unsub = this.events.on(event, handler);
        disposers.add(unsub);

        return () => {
          disposers.delete(unsub);
          unsub();
        };
      },
      emit: <K extends keyof DualSurfEvents>(event: K, data: DualSurfEvents[K]): void => {
        this.events.emit(event, data);
      },
    };

    return {
      pluginId,
      permissions,
      network,
      storage,
      files,
      events,
      intercept: () => {
        assertPerm('network:intercept');
        throw new Error('Traffic interception capability is not available yet (scheduled for Step 2)');
      },
    };
  }
}

