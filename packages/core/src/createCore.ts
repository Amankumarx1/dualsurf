import * as fs from 'fs';
import * as path from 'path';
import type { BrowserHost } from './host.js';
import { HeadlessBrowserHost } from './host.js';
import { EventBus } from './eventBus.js';
import { ScopeManager } from './scope.js';
import { SqliteAuditSink, type AuditSink } from './audit.js';
import { CommandRegistry } from './registry.js';
import { PluginLoader, type PluginManifest } from './plugins.js';
import { registerBuiltinCommands } from './builtinCommands.js';
import { CoreIpcServer } from './ipcServer.js';
import type { CommandCaller, Logger } from './types.js';

export interface CreateCoreOptions {
  host?: BrowserHost;
  dataDir: string;
  runtimeDir?: string;
  plugins?: PluginManifest[];
  auditSink?: AuditSink;
  logger?: Logger;
  startIpcServer?: boolean;
}

export interface DualSurfCore {
  host: BrowserHost;
  dataDir: string;
  runtimeDir?: string;
  events: EventBus;
  scope: ScopeManager;
  audit: AuditSink;
  registry: CommandRegistry;
  plugins: PluginLoader;
  ipcServer: CoreIpcServer | null;
  execute<T = unknown>(id: string, input?: unknown, caller?: CommandCaller): Promise<T>;
  dispose(): Promise<void>;
}

const defaultLogger: Logger = {
  info: (msg, ...args) => console.log(`[DualSurf:Core] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[DualSurf:Core] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[DualSurf:Core] ${msg}`, ...args),
  debug: () => {},
};

export async function createCore(options: CreateCoreOptions): Promise<DualSurfCore> {
  const logger = options.logger || defaultLogger;
  const host = options.host || new HeadlessBrowserHost();
  const dataDir = path.resolve(options.dataDir);

  // 1. Create data directory with owner-only permissions (0700)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  }

  // 2. Initialize Event Bus
  const events = new EventBus(logger);

  // 3. Initialize Scope Manager
  const scope = new ScopeManager(dataDir, events);

  // 4. Initialize Audit Sink
  const audit: AuditSink =
    options.auditSink || new SqliteAuditSink(path.join(dataDir, 'audit.db'));

  // 5. Initialize Registry and Plugin Loader
  let pluginLoaderRef: PluginLoader;

  const registry = new CommandRegistry({
    host,
    scope,
    audit,
    events,
    logger,
    getPluginApiForOwner: (owner) => pluginLoaderRef?.getPluginApi(owner) || null,
  });

  const plugins = new PluginLoader({
    host,
    events,
    registry,
    dataDir,
    logger,
  });
  pluginLoaderRef = plugins;

  // 6. Register Core Built-in Commands
  registerBuiltinCommands({
    register: (cmd) => registry.register(cmd),
    scope,
    audit,
    plugins,
  });

  // 7. Load initial plugins
  if (options.plugins) {
    for (const plugin of options.plugins) {
      try {
        await plugins.load(plugin);
      } catch (pluginErr) {
        // Plugin failure at startup must not stop the app or other plugins
        logger.error(`Plugin '${plugin.id}' failed to load at startup:`, pluginErr);
      }
    }
  }

  // 8. Optional IPC server
  let ipcServer: CoreIpcServer | null = null;
  if (options.startIpcServer && options.runtimeDir) {
    ipcServer = new CoreIpcServer({
      runtimeDir: options.runtimeDir,
      registry,
      logger,
    });
    await ipcServer.start();
  }

  return {
    host,
    dataDir,
    runtimeDir: options.runtimeDir,
    events,
    scope,
    audit,
    registry,
    plugins,
    ipcServer,
    execute: async <T>(id: string, input?: unknown, caller: CommandCaller = 'gui'): Promise<T> => {
      return (await registry.execute(id, input, caller)) as T;
    },
    dispose: async (): Promise<void> => {
      if (ipcServer) {
        await ipcServer.stop();
      }
      audit.close();
      events.removeAllListeners();
    },
  };
}

