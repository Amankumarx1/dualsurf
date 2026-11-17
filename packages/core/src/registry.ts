import { z } from 'zod';
import type { CommandSummary, CommandFieldSummary } from '@dualsurf/ipc-protocol';
import type {
  CommandDefinition,
  CommandCaller,
  CommandContext,
  Logger,
} from './types.js';
import type { ScopeManager } from './scope.js';
import type { AuditSink } from './audit.js';
import type { BrowserHost } from './host.js';
import type { EventBus } from './eventBus.js';
import type { PluginApi } from './plugins.js';
import {
  NotFoundCommandError,
  ValidationCommandError,
  ExecutionFailedError,
} from './errors.js';

const ID_REGEX = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;
const RESERVED_NAMESPACES = ['system.', 'scope.', 'audit.', 'plugins.'];

export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private host: BrowserHost;
  private scope: ScopeManager;
  private audit: AuditSink;
  private events: EventBus;
  private logger: Logger;
  private getPluginApiForOwner?: (owner: string) => PluginApi | null;

  constructor(options: {
    host: BrowserHost;
    scope: ScopeManager;
    audit: AuditSink;
    events: EventBus;
    logger: Logger;
    getPluginApiForOwner?: (owner: string) => PluginApi | null;
  }) {
    this.host = options.host;
    this.scope = options.scope;
    this.audit = options.audit;
    this.events = options.events;
    this.logger = options.logger;
    this.getPluginApiForOwner = options.getPluginApiForOwner;
  }

  public register(cmd: CommandDefinition): void {
    const owner = cmd.owner || 'core';

    // 1. Validate ID format
    if (!ID_REGEX.test(cmd.id)) {
      throw new Error(
        `Invalid command id '${cmd.id}': must be lowercase 'group.action' (e.g. 'headers.analyze')`
      );
    }

    // 2. Check reserved namespaces
    for (const ns of RESERVED_NAMESPACES) {
      if (cmd.id.startsWith(ns) && owner !== 'core') {
        throw new Error(
          `Namespace '${ns}' is reserved for core commands; plugin '${owner}' cannot register '${cmd.id}'`
        );
      }
    }

    // 3. No duplicate ids
    if (this.commands.has(cmd.id)) {
      throw new Error(`Command with id '${cmd.id}' is already registered`);
    }

    // 4. Scope-required commands must provide extractTargets
    if (cmd.scopeRequired && typeof cmd.extractTargets !== 'function') {
      throw new Error(
        `Command '${cmd.id}' requires scope but does not provide an extractTargets function`
      );
    }

    this.commands.set(cmd.id, {
      ...cmd,
      owner,
    });
  }

  public unregisterOwner(owner: string): string[] {
    const removed: string[] = [];
    for (const [id, cmd] of this.commands.entries()) {
      if (cmd.owner === owner) {
        this.commands.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  public get(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  public listSummaries(): CommandSummary[] {
    const list: CommandSummary[] = [];

    for (const cmd of this.commands.values()) {
      list.push({
        id: cmd.id,
        title: cmd.title,
        description: cmd.description,
        category: cmd.category,
        owner: cmd.owner || 'core',
        scopeRequired: Boolean(cmd.scopeRequired),
        positional: cmd.positional,
        fields: this.deriveFields(cmd.inputSchema),
      });
    }

    return list.sort((a, b) => a.id.localeCompare(b.id));
  }

  public async execute(id: string, rawInput: unknown, caller: CommandCaller): Promise<unknown> {
    const startTime = Date.now();

    // 1. Find command
    const cmd = this.commands.get(id);
    if (!cmd) {
      throw new NotFoundCommandError(id);
    }

    // 2. Validate input with zod schema
    const inputToValidate = rawInput === undefined ? {} : rawInput;
    const parsed = cmd.inputSchema.safeParse(inputToValidate);

    if (!parsed.success) {
      const issues = parsed.error.issues.map((iss) => ({
        field: iss.path.join('.') || 'input',
        message: iss.message,
      }));

      // Write 'invalid' audit row
      try {
        await this.audit.write({
          caller,
          command: id,
          outcome: 'invalid',
          input: inputToValidate,
          detail: issues.map((i) => `${i.field}: ${i.message}`).join('; '),
        });
      } catch (auditErr) {
        this.logger.error('Failed to write invalid audit row:', auditErr);
      }

      throw new ValidationCommandError(issues);
    }

    const validatedInput = parsed.data;

    // 3. Scope verification (if required)
    if (cmd.scopeRequired && cmd.extractTargets) {
      try {
        const extracted = cmd.extractTargets(validatedInput);
        this.scope.assertAllowed(extracted);
      } catch (scopeErr: any) {
        try {
          await this.audit.write({
            caller,
            command: id,
            outcome: 'denied',
            input: validatedInput,
            detail: scopeErr.message || 'Target out of scope',
          });
        } catch (auditErr) {
          this.logger.error('Failed to write denied audit row:', auditErr);
        }
        throw scopeErr;
      }
    }

    // 4. Write 'started' audit row. If this write fails, DO NOT run the command!
    await this.audit.write({
      caller,
      command: id,
      outcome: 'started',
      input: validatedInput,
    });

    // Emit command started event
    this.events.emit('command:started', {
      id,
      caller,
      timestamp: startTime,
    });

    // 5. Execute command
    const ctx: CommandContext = {
      caller,
      host: this.host,
      events: this.events,
      logger: this.logger,
      assertInScope: (targets) => this.scope.assertAllowed(targets),
      pluginApi: this.getPluginApiForOwner ? this.getPluginApiForOwner(cmd.owner || 'core') : null,
    };

    let result: unknown;
    try {
      result = await cmd.run(validatedInput, ctx);

      // Write 'ok' audit row
      try {
        await this.audit.write({
          caller,
          command: id,
          outcome: 'ok',
          input: validatedInput,
        });
      } catch (auditErr) {
        this.logger.warn('Failed to write ok audit row:', auditErr);
      }

      this.events.emit('command:finished', {
        id,
        caller,
        ok: true,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (err: any) {
      const errorMessage = err?.message || 'Command execution failed';

      // Write 'error' audit row
      try {
        await this.audit.write({
          caller,
          command: id,
          outcome: 'error',
          input: validatedInput,
          detail: errorMessage,
        });
      } catch (auditErr) {
        this.logger.warn('Failed to write error audit row:', auditErr);
      }

      this.events.emit('command:finished', {
        id,
        caller,
        ok: false,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      });

      // Pass typed CoreError through, or wrap unknown errors
      if (err.name === 'CoreError' || err.code !== undefined) {
        throw err;
      }

      throw new ExecutionFailedError(errorMessage);
    }
  }

  private deriveFields(schema: z.ZodTypeAny): CommandFieldSummary[] {
    const fields: CommandFieldSummary[] = [];

    let current = schema;
    // Unwrap effects/pipelines
    while (current instanceof z.ZodEffects) {
      current = current.innerType();
    }

    if (current instanceof z.ZodObject) {
      const shape = current.shape;
      for (const [key, value] of Object.entries(shape)) {
        fields.push(this.inspectZodField(key, value as z.ZodTypeAny));
      }
    }

    return fields;
  }

  private inspectZodField(name: string, fieldSchema: z.ZodTypeAny): CommandFieldSummary {
    let current = fieldSchema;
    let optional = false;
    let description = current.description;

    while (true) {
      if (!description && current.description) {
        description = current.description;
      }

      if (current instanceof z.ZodOptional) {
        optional = true;
        current = current.unwrap();
      } else if (current instanceof z.ZodNullable) {
        optional = true;
        current = current.unwrap();
      } else if (current instanceof z.ZodDefault) {
        optional = true;
        current = current.removeDefault();
      } else if (current instanceof z.ZodEffects) {
        current = current.innerType();
      } else {
        break;
      }
    }

    let typeName = 'any';
    if (current instanceof z.ZodString) typeName = 'string';
    else if (current instanceof z.ZodNumber) typeName = 'number';
    else if (current instanceof z.ZodBoolean) typeName = 'boolean';
    else if (current instanceof z.ZodArray) typeName = 'array';
    else if (current instanceof z.ZodObject) typeName = 'object';
    else if (current instanceof z.ZodEnum) typeName = 'enum';

    return {
      name,
      type: typeName,
      optional,
      description,
    };
  }
}

