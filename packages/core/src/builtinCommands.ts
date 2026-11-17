import { z } from 'zod';
import type { CommandDefinition } from './types.js';
import type { ScopeManager } from './scope.js';
import type { AuditSink } from './audit.js';
import type { PluginLoader } from './plugins.js';

/**
 * Shared boolean Zod schema helper that gracefully accepts boolean literals
 * or string representations ('true', 'false', '1', '0') from CLI inputs.
 */
export const booleanSchema = z.union([
  z.boolean(),
  z.enum(['true', 'false', '1', '0']).transform((val) => val === 'true' || val === '1'),
]);

export function registerBuiltinCommands(options: {
  register: (cmd: CommandDefinition) => void;
  scope: ScopeManager;
  audit: AuditSink;
  plugins: PluginLoader;
}): void {
  const { register, scope, audit, plugins } = options;

  // 1. scope.list
  register({
    id: 'scope.list',
    title: 'List Authorized Scope Rules',
    description: 'Returns the current allow and deny rules governing active network actions',
    category: 'system',
    owner: 'core',
    inputSchema: z.object({}),
    run: () => {
      return scope.list();
    },
  });

  // 2. scope.add
  register({
    id: 'scope.add',
    title: 'Add Rule to Scope',
    description: 'Adds an authorized host, wildcard, IP, or CIDR range to scope',
    category: 'system',
    owner: 'core',
    positional: ['pattern'],
    inputSchema: z.object({
      pattern: z
        .string()
        .min(1)
        .describe('Target domain, wildcard (*.domain), IP, or IPv4 CIDR (/8 to /32)'),
      deny: booleanSchema
        .optional()
        .default(false)
        .describe('If true, adds rule to the explicit deny list rather than allow list'),
    }),
    run: (input) => {
      return scope.add(input.pattern, input.deny);
    },
  });

  // 3. scope.remove
  register({
    id: 'scope.remove',
    title: 'Remove Rule from Scope',
    description: 'Removes an existing allow or deny rule from scope',
    category: 'system',
    owner: 'core',
    positional: ['pattern'],
    inputSchema: z.object({
      pattern: z.string().min(1).describe('Exact pattern string to remove from scope'),
    }),
    run: (input) => {
      const removed = scope.remove(input.pattern);
      return { removed, pattern: input.pattern };
    },
  });

  // 4. scope.check
  register({
    id: 'scope.check',
    title: 'Check Target Scope Status',
    description: 'Tests whether a specific URL or hostname is authorized under current scope rules',
    category: 'system',
    owner: 'core',
    positional: ['target'],
    inputSchema: z.object({
      target: z.string().min(1).describe('Target URL, host:port, or bare hostname to evaluate'),
    }),
    run: (input) => {
      return scope.check(input.target);
    },
  });

  // 5. audit.tail
  register({
    id: 'audit.tail',
    title: 'Tail Recent Audit Log',
    description: 'Returns the most recent cryptographic audit log entries',
    category: 'audit',
    owner: 'core',
    positional: ['count'],
    inputSchema: z.object({
      count: z.coerce
        .number()
        .int()
        .min(1)
        .max(500)
        .default(20)
        .describe('Number of recent entries to return (1 to 500, default 20)'),
    }),
    run: async (input) => {
      const rows = await audit.tail(input.count);
      // Return without raw cryptographic hashes for clean human presentation
      return rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        time: new Date(r.timestamp).toISOString(),
        caller: r.caller,
        command: r.command,
        outcome: r.outcome,
        input: JSON.parse(r.input),
        detail: r.detail || undefined,
      }));
    },
  });

  // 6. audit.verify
  register({
    id: 'audit.verify',
    title: 'Verify Audit Log Integrity',
    description: 'Recomputes the SHA-256 hash chain across all audit rows to detect tampering',
    category: 'audit',
    owner: 'core',
    inputSchema: z.object({}),
    run: async () => {
      return await audit.verify();
    },
  });

  // 7. plugins.list
  register({
    id: 'plugins.list',
    title: 'List Loaded Feature Plugins',
    description: 'Lists all currently active feature plugins, permissions, and command registrations',
    category: 'system',
    owner: 'core',
    inputSchema: z.object({}),
    run: () => {
      return plugins.listLoaded();
    },
  });
}

