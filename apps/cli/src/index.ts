#!/usr/bin/env node
import { IpcClient } from './IpcClient.js';
import { runInteractiveSession } from './repl.js';
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

async function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const filteredArgs = args.filter((a) => a !== '--json');

  const client = new IpcClient();

  if (filteredArgs.length === 0 || filteredArgs.includes('--terminal') || filteredArgs[0] === 'attach') {
    // If running with --terminal or attach, or no args when controller is online
    const isOnline = await client.isControllerAvailable();
    if (isOnline && (filteredArgs.includes('--terminal') || filteredArgs[0] === 'attach')) {
      await runInteractiveSession(client);
      return;
    }

    if (!isOnline && (filteredArgs.includes('--terminal') || filteredArgs[0] === 'attach')) {
      console.error(
        `${colors.red}Error: DualSurf browser controller is not running.${colors.reset}\n` +
        `Please start DualSurf first (e.g. npm run dev:desktop).`
      );
      process.exit(1);
    }

    if (filteredArgs.length === 0) {
      if (isOnline) {
        const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        if (isJson) {
          console.log(JSON.stringify(state, null, 2));
        } else {
          console.log(formatTabsList(state));
          console.log(`\n${colors.dim}Run "dualsurf --terminal" to start interactive mode.${colors.reset}`);
        }
        return;
      } else {
        printCliHelp();
        return;
      }
    }
  }

  const command = filteredArgs[0].toLowerCase();
  const rest = filteredArgs.slice(1);

  try {
    switch (command) {
      case 'help':
      case '--help':
      case '-h': {
        printCliHelp();
        break;
      }

      case 'tabs': {
        const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        if (isJson) {
          console.log(JSON.stringify(state, null, 2));
        } else {
          console.log(formatTabsList(state));
        }
        break;
      }

      case 'tab': {
        const sub = rest[0]?.toLowerCase();
        if (sub === 'new') {
          const url = rest[1];
          const tab = await client.sendCommand(IPC_COMMANDS.TABS_CREATE, { url });
          if (isJson) {
            console.log(JSON.stringify(tab, null, 2));
          } else {
            console.log(`${colors.green}Created new tab:${colors.reset} ${tab.id} (${tab.url})`);
          }
        } else if (sub === 'close') {
          const index = rest[1] ? parseInt(rest[1], 10) : undefined;
          const res = await client.sendCommand(IPC_COMMANDS.TABS_CLOSE, { index });
          if (isJson) {
            console.log(JSON.stringify(res, null, 2));
          } else {
            console.log(`${colors.yellow}Closed tab.${colors.reset}`);
          }
        } else {
          const index = parseInt(sub, 10);
          if (!isNaN(index)) {
            const res = await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { index });
            if (isJson) {
              console.log(JSON.stringify(res, null, 2));
            } else {
              console.log(`${colors.green}Switched to tab [${index}].${colors.reset}`);
            }
          } else {
            console.log(`${colors.yellow}Usage: dualsurf tab <number> | dualsurf tab new [url] | dualsurf tab close [number]${colors.reset}`);
          }
        }
        break;
      }

      case 'open': {
        const url = rest.join(' ');
        if (!url) {
          console.error(`${colors.red}Error: URL argument required.${colors.reset} Usage: dualsurf open <url>`);
          process.exit(1);
        }
        const res = await client.sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url });
        if (isJson) {
          console.log(JSON.stringify(res, null, 2));
        } else {
          console.log(`${colors.green}Navigating active tab to:${colors.reset} ${url}`);
        }
        break;
      }

      case 'search': {
        const query = rest.join(' ');
        if (!query) {
          console.error(`${colors.red}Error: Search query required.${colors.reset} Usage: dualsurf search <query>`);
          process.exit(1);
        }
        const res = await client.sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: query });
        if (isJson) {
          console.log(JSON.stringify(res, null, 2));
        } else {
          console.log(`${colors.green}Searching for:${colors.reset} "${query}"`);
        }
        break;
      }

      case 'page': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        if (isJson) {
          console.log(JSON.stringify(meta, null, 2));
        } else {
          console.log(formatPageHeader(meta));
        }
        break;
      }

      case 'text': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        if (isJson) {
          console.log(JSON.stringify(meta, null, 2));
        } else {
          console.log(formatPageText(meta));
        }
        break;
      }

      case 'links': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        if (isJson) {
          console.log(JSON.stringify(meta.links, null, 2));
        } else {
          console.log(formatBanner());
          console.log(formatNumberedLinks(meta.links));
        }
        break;
      }

      case 'click': {
        const linkId = parseInt(rest[0], 10);
        if (isNaN(linkId)) {
          console.error(`${colors.red}Error: Link number required.${colors.reset} Usage: dualsurf click <number>`);
          process.exit(1);
        }
        const res = await client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId });
        if (isJson) {
          console.log(JSON.stringify(res, null, 2));
        } else {
          console.log(`${colors.green}Followed link [${linkId}].${colors.reset}`);
        }
        break;
      }

      case 'headings': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        if (isJson) {
          console.log(JSON.stringify(meta.headings, null, 2));
        } else {
          console.log(formatBanner());
          console.log(formatHeadings(meta.headings));
        }
        break;
      }

      case 'back': {
        const res = await client.sendCommand(IPC_COMMANDS.NAV_BACK);
        if (isJson) console.log(JSON.stringify(res));
        else console.log(`${colors.green}Navigated back in active tab.${colors.reset}`);
        break;
      }

      case 'forward': {
        const res = await client.sendCommand(IPC_COMMANDS.NAV_FORWARD);
        if (isJson) console.log(JSON.stringify(res));
        else console.log(`${colors.green}Navigated forward in active tab.${colors.reset}`);
        break;
      }

      case 'reload': {
        const res = await client.sendCommand(IPC_COMMANDS.NAV_RELOAD);
        if (isJson) console.log(JSON.stringify(res));
        else console.log(`${colors.green}Reloading active tab.${colors.reset}`);
        break;
      }

      case 'stop': {
        const res = await client.sendCommand(IPC_COMMANDS.NAV_STOP);
        if (isJson) console.log(JSON.stringify(res));
        else console.log(`${colors.yellow}Stopped navigation in active tab.${colors.reset}`);
        break;
      }

      case 'settings': {
        const settings = await client.sendCommand(IPC_COMMANDS.SETTINGS_GET);
        if (isJson) {
          console.log(JSON.stringify(settings, null, 2));
        } else {
          console.log(formatBanner());
          console.log(`${colors.bold}DualSurf Settings:${colors.reset}`);
          console.log(`  Search Engine: ${settings.searchEngine}`);
          console.log(`  Home URL:      ${settings.homeUrl}`);
          console.log(`  Restore Tabs:  ${settings.restoreSessionOnStartup}`);
          console.log(`  Terminal Theme:${settings.terminalTheme}`);
        }
        break;
      }

      default: {
        console.error(`${colors.red}Unknown command: "${command}".${colors.reset}`);
        printCliHelp();
        process.exit(1);
      }
    }
  } catch (err) {
    if (isJson) {
      console.error(JSON.stringify({ error: (err as Error).message }));
    } else {
      console.error(`${colors.red}Error: ${(err as Error).message}${colors.reset}`);
    }
    process.exit(1);
  }
}

function printCliHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}DualSurf CLI${colors.reset} - Dual-Mode Browser Control Interface

${colors.bold}USAGE:${colors.reset}
  dualsurf [command] [options]

${colors.bold}COMMANDS:${colors.reset}
  ${colors.bold}--terminal, attach${colors.reset}     Launch interactive terminal session
  ${colors.bold}open <url>${colors.reset}             Open URL in active tab
  ${colors.bold}search <query>${colors.reset}         Search using configured search engine
  ${colors.bold}tabs${colors.reset}                   List all open tabs
  ${colors.bold}tab <number>${colors.reset}           Switch to tab index
  ${colors.bold}tab new [url]${colors.reset}          Create a new tab
  ${colors.bold}tab close [number]${colors.reset}     Close a tab
  ${colors.bold}page${colors.reset}                   Display metadata for current page
  ${colors.bold}text${colors.reset}                   Print structured readable content from page
  ${colors.bold}links${colors.reset}                  Print numbered actionable links
  ${colors.bold}click <number>${colors.reset}        Follow numbered link
  ${colors.bold}headings${colors.reset}               List page headings in document order
  ${colors.bold}back / forward${colors.reset}         History navigation
  ${colors.bold}reload / stop${colors.reset}          Reload or stop current page
  ${colors.bold}settings${colors.reset}               View browser preferences
  ${colors.bold}help${colors.reset}                   Show this help message

${colors.bold}OPTIONS:${colors.reset}
  ${colors.bold}--json${colors.reset}                 Output results in structured JSON format
`);
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
