#!/usr/bin/env node
import { AttachedTransport, HeadlessTransport, CliConnectionError } from './transport.js';
import { DualSurfRepl } from './repl.js';
import { tokenizeCommandLine, parseTokensToInput } from './tokenizer.js';
import { formatResult, formatError } from './formatter.js';

async function main() {
  const args = process.argv.slice(2);

  let asJson = false;
  let useHeadless = false;
  let showHelp = false;
  const remainingArgs: string[] = [];

  // Parse global flags before command
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      asJson = true;
    } else if (arg === '--headless') {
      useHeadless = true;
    } else if (arg === '-h' || arg === '--help') {
      showHelp = true;
    } else {
      remainingArgs.push(arg);
    }
  }

  if (showHelp && remainingArgs.length === 0) {
    printGlobalHelp();
    process.exit(0);
  }

  const transport = useHeadless
    ? new HeadlessTransport()
    : new AttachedTransport();

  // If no command provided, enter interactive shell
  if (remainingArgs.length === 0) {
    const repl = new DualSurfRepl(transport);
    await repl.start();
    return;
  }

  // Single-shot command execution
  const commandId = remainingArgs[0].toLowerCase();
  const commandArgTokens = remainingArgs.slice(1);

  try {
    const commands = await transport.listCommands();
    const cmd = commands.find((c) => c.id === commandId);

    if (!cmd) {
      if (asJson) {
        console.error(
          JSON.stringify({
            code: -32601,
            message: `Unknown command: ${commandId}`,
          })
        );
      } else {
        console.error(`error [-32601]: Unknown command or method: ${commandId}`);
      }
      await transport.close();
      process.exit(1);
    }

    let input: Record<string, unknown>;
    try {
      input = parseTokensToInput(commandArgTokens, cmd.positional);
    } catch (parseErr: any) {
      if (asJson) {
        console.error(
          JSON.stringify({
            code: -32602,
            message: parseErr.message,
          })
        );
      } else {
        console.error(`error [-32602]: ${parseErr.message}`);
      }
      await transport.close();
      process.exit(1);
    }

    const result = await transport.execute(commandId, input);
    console.log(formatResult(result, asJson));

    await transport.close();
    process.exit(0);
  } catch (err: any) {
    if (asJson) {
      console.error(
        JSON.stringify({
          code: err.code || -32000,
          message: err.message || 'Command failed',
          data: err.data,
        })
      );
    } else {
      console.error(formatError(err));
    }

    await transport.close();

    if (err instanceof CliConnectionError || err.code === 2) {
      process.exit(2);
    }
    process.exit(1);
  }
}

function printGlobalHelp() {
  console.log(`
DualSurf CLI — Universal Dual-Mode Cybersecurity Interface

Usage:
  dualsurf [options] [command] [args...]
  dualsurf                    Start interactive terminal shell

Global Options:
  --json                      Emit structured, machine-readable JSON output
  --headless                  Run headless core in-process (no Electron required)
  -h, --help                  Show CLI help and usage instructions

Examples:
  dualsurf scope.list
  dualsurf scope.add example.com
  dualsurf headers.analyze https://example.com
  dualsurf audit.tail 10
  dualsurf audit.verify
`);
}

main().catch((fatal) => {
  console.error(`Fatal CLI error:`, fatal);
  process.exit(2);
});
