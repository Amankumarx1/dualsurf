import type { z } from 'zod';
import type { CommandCategory } from '@dualsurf/ipc-protocol';
import type { BrowserHost } from './host.js';
import type { EventBus } from './eventBus.js';
import type { PluginApi } from './plugins.js';

export type CommandCaller = 'gui' | 'cli' | 'plugin';

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug?(message: string, ...args: unknown[]): void;
}

export interface CommandContext {
  caller: CommandCaller;
  host: BrowserHost;
  events: EventBus;
  logger: Logger;
  assertInScope(target: string | string[]): void;
  pluginApi: PluginApi | null;
}

export interface PluginCommandContext extends CommandContext {
  pluginApi: PluginApi;
}

export type TargetExtractor<T = unknown> = (input: T) => string | string[];

export interface CommandDefinition<TInput = any, TOutput = any> {
  id: string; // group.action (lowercase)
  title: string;
  description: string;
  category: CommandCategory;
  owner?: string; // default: 'core'
  inputSchema: z.ZodType<TInput>;
  positional?: string[];
  scopeRequired?: boolean;
  extractTargets?: TargetExtractor<TInput>;
  run(input: TInput, ctx: CommandContext): Promise<TOutput> | TOutput;
}

export interface PluginCommandDefinition<TInput = any, TOutput = any>
  extends Omit<CommandDefinition<TInput, TOutput>, 'owner' | 'run'> {
  run(input: TInput, ctx: PluginCommandContext): Promise<TOutput> | TOutput;
}

