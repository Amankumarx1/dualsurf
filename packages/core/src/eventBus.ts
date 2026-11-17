import type { CommandCaller, Logger } from './types.js';

export interface CommandStartedEvent {
  id: string;
  caller: CommandCaller;
  timestamp: number;
}

export interface CommandFinishedEvent {
  id: string;
  caller: CommandCaller;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface ScopeChangedEvent {
  allow: string[];
  deny: string[];
}

export interface PluginLoadedEvent {
  pluginId: string;
  version: string;
  permissions: string[];
}

export interface PluginUnloadedEvent {
  pluginId: string;
}

export interface TrafficRequestEvent {
  id: string;
  tabId?: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyLength?: number;
  timestamp: number;
}

export interface TrafficResponseEvent {
  id: string;
  tabId?: string;
  url: string;
  status: number;
  statusText?: string;
  headers: Record<string, string>;
  bodyLength?: number;
  durationMs: number;
  timestamp: number;
}

export interface DualSurfEvents {
  'command:started': CommandStartedEvent;
  'command:finished': CommandFinishedEvent;
  'scope:changed': ScopeChangedEvent;
  'plugin:loaded': PluginLoadedEvent;
  'plugin:unloaded': PluginUnloadedEvent;
  'traffic:request': TrafficRequestEvent;
  'traffic:response': TrafficResponseEvent;
}

export type EventHandler<T> = (data: T) => void | Promise<void>;
export type UnsubscribeFn = () => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  public on<K extends keyof DualSurfEvents>(
    event: K,
    handler: EventHandler<DualSurfEvents[K]>
  ): UnsubscribeFn {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const set = this.handlers.get(event)!;
    set.add(handler);

    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  public emit<K extends keyof DualSurfEvents>(event: K, data: DualSurfEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;

    for (const handler of Array.from(set)) {
      try {
        const result = handler(data);
        if (result && typeof (result as any).catch === 'function') {
          (result as Promise<void>).catch((err) => {
            this.logger?.warn(`Event handler error in '${String(event)}':`, err);
          });
        }
      } catch (err) {
        this.logger?.warn(`Event handler error in '${String(event)}':`, err);
      }
    }
  }

  public removeAllListeners(): void {
    this.handlers.clear();
  }
}

