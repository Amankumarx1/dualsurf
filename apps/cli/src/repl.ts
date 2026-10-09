import * as readline from 'readline';
import { IpcClient } from './IpcClient.js';
import {
  formatBanner,
  formatNumberedLinks,
  formatHeadings,
  formatPageHeader,
  formatPageText,
  formatTabsList,
  colors,
} from './formatters.js';
import { IPC_COMMANDS } from '@dualsurf/ipc-protocol';
import type { BrowserControllerState, PageMetadata } from '@dualsurf/shared-types';

export async function runInteractiveSession(client: IpcClient): Promise<void> {
  const isOnline = await client.isControllerAvailable();
  if (!isOnline) {
    console.error(
      `${colors.red}Error: DualSurf browser controller is not running.${colors.reset}\n` +
      `Please start DualSurf first (run "dualsurf" to launch GUI or controller).`
    );
    process.exit(1);
  }

  console.log(formatBanner());
  console.log(`${colors.green}Connected to live DualSurf browser session.${colors.reset}`);
  console.log(`${colors.dim}Type "help" for available commands, or "quit" to exit.${colors.reset}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.bold}${colors.cyan}dualsurf>${colors.reset} `,
    completer: (line: string) => {
      const completions = [
        'open',
        'text',
        'links',
        'click',
        'headings',
        'tabs',
        'tab',
        'back',
        'forward',
        'reload',
        'stop',
        'page',
        'search',
        'help',
        'quit',
        'exit',
      ];
      const hits = completions.filter((c) => c.startsWith(line.trim()));
      return [hits.length ? hits : completions, line];
    },
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const parts = input.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    try {
      switch (cmd) {
        case 'quit':
        case 'exit':
        case 'q': {
          console.log(`${colors.dim}Exiting interactive terminal mode.${colors.reset}`);
          rl.close();
          return;
        }

        case 'help':
        case 'h': {
          printReplHelp();
          break;
        }

        case 'tabs': {
          const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
          console.log(formatTabsList(state));
          break;
        }

        case 'tab': {
          if (!arg) {
            const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
            console.log(formatTabsList(state));
          } else if (arg.startsWith('new')) {
            const url = arg.substring(3).trim();
            const tab = await client.sendCommand(IPC_COMMANDS.TABS_CREATE, { url: url || undefined });
            console.log(`${colors.green}Opened new tab:${colors.reset} ${tab.id} (${tab.url})`);
          } else if (arg.startsWith('close')) {
            const indexStr = arg.substring(5).trim();
            const index = indexStr ? parseInt(indexStr, 10) : undefined;
            await client.sendCommand(IPC_COMMANDS.TABS_CLOSE, { index });
            console.log(`${colors.yellow}Closed tab.${colors.reset}`);
          } else {
            const index = parseInt(arg, 10);
            if (!isNaN(index)) {
              await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { index });
              console.log(`${colors.green}Switched to tab [${index}].${colors.reset}`);
            } else {
              await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: arg });
              console.log(`${colors.green}Switched to tab ${arg}.${colors.reset}`);
            }
          }
          break;
        }

        case 'open':
        case 'goto': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: open <URL or domain>${colors.reset}`);
          } else {
            console.log(`${colors.dim}Navigating to: ${arg}...${colors.reset}`);
            await client.sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: arg });
            console.log(`${colors.green}Navigation initiated.${colors.reset}`);
          }
          break;
        }

        case 'search': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: search <query>${colors.reset}`);
          } else {
            console.log(`${colors.dim}Searching for: "${arg}"...${colors.reset}`);
            await client.sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: arg });
            console.log(`${colors.green}Search dispatched.${colors.reset}`);
          }
          break;
        }

        case 'page': {
          const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatPageHeader(meta));
          break;
        }

        case 'text': {
          const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatPageText(meta));
          break;
        }

        case 'links': {
          const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatNumberedLinks(meta.links));
          break;
        }

        case 'click': {
          const num = parseInt(arg, 10);
          if (isNaN(num)) {
            console.log(`${colors.yellow}Usage: click <link number>${colors.reset}`);
          } else {
            console.log(`${colors.dim}Following link [${num}]...${colors.reset}`);
            await client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId: num });
            console.log(`${colors.green}Link [${num}] activated.${colors.reset}`);
          }
          break;
        }

        case 'headings': {
          const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatHeadings(meta.headings));
          break;
        }

        case 'back': {
          await client.sendCommand(IPC_COMMANDS.NAV_BACK);
          console.log(`${colors.dim}Navigated back.${colors.reset}`);
          break;
        }

        case 'forward': {
          await client.sendCommand(IPC_COMMANDS.NAV_FORWARD);
          console.log(`${colors.dim}Navigated forward.${colors.reset}`);
          break;
        }

        case 'reload':
        case 'r': {
          await client.sendCommand(IPC_COMMANDS.NAV_RELOAD);
          console.log(`${colors.dim}Reloading page.${colors.reset}`);
          break;
        }

        case 'stop': {
          await client.sendCommand(IPC_COMMANDS.NAV_STOP);
          console.log(`${colors.dim}Stopped navigation.${colors.reset}`);
          break;
        }

        default: {
          console.log(
            `${colors.red}Unknown command: "${cmd}".${colors.reset} Type "help" for a list of commands.`
          );
          break;
        }
      }
    } catch (err) {
      console.error(`${colors.red}Error: ${(err as Error).message}${colors.reset}`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

function printReplHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}DualSurf Interactive Terminal Commands:${colors.reset}
  ${colors.bold}open <url>${colors.reset}        Navigate to URL or domain in active tab
  ${colors.bold}search <query>${colors.reset}    Search with default search engine
  ${colors.bold}text${colors.reset}              Print structured readable page text & links
  ${colors.bold}links${colors.reset}             List numbered actionable links [1], [2]...
  ${colors.bold}click <n>${colors.reset}         Follow numbered link <n>
  ${colors.bold}headings${colors.reset}          List page headings in document order
  ${colors.bold}page${colors.reset}              Show active page metadata and status
  ${colors.bold}tabs${colors.reset}              List all open tabs
  ${colors.bold}tab <n>${colors.reset}           Switch to tab index <n>
  ${colors.bold}tab new [url]${colors.reset}    Create new tab
  ${colors.bold}tab close [n]${colors.reset}    Close tab
  ${colors.bold}back / forward${colors.reset}    History navigation
  ${colors.bold}reload / stop${colors.reset}     Reload or abort navigation
  ${colors.bold}quit / exit${colors.reset}       Exit interactive session
`);
}
