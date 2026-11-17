import * as readline from 'readline';
import type { CommandSummary } from '@dualsurf/ipc-protocol';
import type { CliTransport } from './transport.js';
import { tokenizeCommandLine, parseTokensToInput } from './tokenizer.js';
import { formatResult, formatError, colors } from './formatter.js';

export class DualSurfRepl {
  private transport: CliTransport;
  private commandsCache: CommandSummary[] = [];

  constructor(transport: CliTransport) {
    this.transport = transport;
  }

  public async start(): Promise<void> {
    try {
      this.commandsCache = await this.transport.listCommands();
    } catch {
      // If listing fails initially, cache remains empty
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.bold}${colors.cyan}dualsurf>${colors.reset} `,
      completer: (line: string) => this.completer(line),
    });

    console.log(
      `${colors.bold}DualSurf CLI${colors.reset} (mode: ${this.transport.mode})\n` +
      `Type '${colors.cyan}help${colors.reset}' for commands or '${colors.cyan}exit${colors.reset}' to quit.\n`
    );

    rl.prompt();

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      let tokens: string[];
      try {
        tokens = tokenizeCommandLine(trimmed);
      } catch (err: any) {
        console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
        rl.prompt();
        return;
      }

      const firstToken = tokens[0].toLowerCase();

      // Handle Shell Built-ins
      if (firstToken === 'exit' || firstToken === 'quit') {
        rl.close();
        return;
      }

      if (firstToken === 'clear') {
        console.clear();
        rl.prompt();
        return;
      }

      if (firstToken === 'list') {
        await this.handleList();
        rl.prompt();
        return;
      }

      if (firstToken === 'help') {
        if (tokens.length > 1) {
          await this.handleCommandHelp(tokens[1]);
        } else {
          await this.handleGeneralHelp();
        }
        rl.prompt();
        return;
      }

      // Execute command
      await this.executeCommand(tokens[0], tokens.slice(1));
      rl.prompt();
    });

    rl.on('close', async () => {
      console.log('\nGoodbye.');
      await this.transport.close();
      process.exit(0);
    });
  }

  private completer(line: string): [string[], string] {
    const completions = this.commandsCache.map((c) => c.id).concat(['help', 'list', 'clear', 'exit', 'quit']);
    const hits = completions.filter((c) => c.startsWith(line.trim()));
    return [hits.length ? hits : completions, line];
  }

  private async refreshCommands(): Promise<CommandSummary[]> {
    try {
      this.commandsCache = await this.transport.listCommands();
    } catch {}
    return this.commandsCache;
  }

  private async handleList(): Promise<void> {
    const cmds = await this.refreshCommands();
    const rows = cmds.map((c) => ({
      id: c.id,
      category: c.category,
      title: c.title,
      scope: c.scopeRequired ? 'required' : 'none',
    }));
    console.log(formatResult(rows, false));
  }

  private async handleGeneralHelp(): Promise<void> {
    const cmds = await this.refreshCommands();
    const categories = new Map<string, CommandSummary[]>();

    for (const cmd of cmds) {
      const cat = String(cmd.category || 'general');
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      categories.get(cat)!.push(cmd);
    }

    console.log(`\n${colors.bold}Available Commands:${colors.reset}`);
    for (const [cat, items] of Array.from(categories.entries()).sort()) {
      console.log(`\n${colors.bold}${colors.cyan}[${cat.toUpperCase()}]${colors.reset}`);
      for (const item of items) {
        console.log(`  ${colors.bold}${item.id.padEnd(24)}${colors.reset} ${item.description}`);
      }
    }

    console.log(`\nType '${colors.cyan}help <command>${colors.reset}' for detailed parameter syntax.`);
  }

  private async handleCommandHelp(cmdId: string): Promise<void> {
    const cmds = await this.refreshCommands();
    const cmd = cmds.find((c) => c.id === cmdId.toLowerCase());

    if (!cmd) {
      console.log(`${colors.red}Unknown command:${colors.reset} '${cmdId}'`);
      this.suggestSimilar(cmdId, cmds);
      return;
    }

    console.log(`\n${colors.bold}${cmd.id}${colors.reset} — ${cmd.title}`);
    console.log(`${colors.dim}${cmd.description}${colors.reset}\n`);

    console.log(`  ${colors.cyan}Category:${colors.reset}       ${cmd.category}`);
    console.log(`  ${colors.cyan}Owner:${colors.reset}          ${cmd.owner}`);
    console.log(
      `  ${colors.cyan}Scope Required:${colors.reset} ${cmd.scopeRequired ? colors.yellow + 'Yes' : 'No'}${colors.reset}`
    );

    if (cmd.positional && cmd.positional.length > 0) {
      console.log(`  ${colors.cyan}Positional:${colors.reset}     ${cmd.positional.join(', ')}`);
    }

    if (cmd.fields && cmd.fields.length > 0) {
      console.log(`\n${colors.bold}Parameters:${colors.reset}`);
      for (const f of cmd.fields) {
        const optBadge = f.optional ? `${colors.dim}(optional)${colors.reset}` : `${colors.yellow}(required)${colors.reset}`;
        console.log(`  --${f.name.padEnd(14)} [${f.type}] ${optBadge} ${f.description || ''}`);
      }
    } else {
      console.log(`\n${colors.dim}This command accepts no parameters.${colors.reset}`);
    }
  }

  private suggestSimilar(cmdId: string, cmds: CommandSummary[]): void {
    const group = cmdId.split('.')[0];
    const similar = cmds.filter((c) => c.id.startsWith(group + '.'));
    if (similar.length > 0) {
      console.log(
        `${colors.dim}Did you mean one of these in group '${group}'?${colors.reset}\n` +
        similar.map((s) => `  - ${colors.cyan}${s.id}${colors.reset}`).join('\n')
      );
    }
  }

  private async executeCommand(id: string, argTokens: string[]): Promise<void> {
    const cmds = await this.refreshCommands();
    const cmdSummary = cmds.find((c) => c.id === id);

    if (!cmdSummary) {
      console.error(`${colors.red}error [-32601]:${colors.reset} Unknown command or method: ${id}`);
      this.suggestSimilar(id, cmds);
      return;
    }

    let input: Record<string, unknown>;
    try {
      input = parseTokensToInput(argTokens, cmdSummary.positional);
    } catch (err: any) {
      console.error(`${colors.red}Argument error:${colors.reset} ${err.message}`);
      return;
    }

    try {
      const result = await this.transport.execute(id, input);
      console.log(formatResult(result, false));
    } catch (err: any) {
      console.error(formatError(err));
    }
  }
}
