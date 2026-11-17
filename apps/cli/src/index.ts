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
  formatBookmarks,
  formatHistory,
  formatDownloads,
  formatFindResults,
  formatEndpoints,
  colors,
} from './formatters.js';
import { IPC_COMMANDS } from '@dualsurf/ipc-protocol';
import type { BrowserControllerState, PageMetadata } from '@dualsurf/shared-types';
import { autoStartControllerIfOffline } from './launcher.js';
import { OllamaClient } from './ollama/index.js';
import { AgentRunner } from './agent/index.js';
import { findBestMatchingLink, findBestMatchingTab, findTopMatchingLinks } from './semantic/index.js';

async function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const filteredArgs = args.filter((a) => a !== '--json');

  const client = new IpcClient();
  const ollama = new OllamaClient();

  if (filteredArgs.length === 0 || filteredArgs.includes('--terminal') || filteredArgs[0] === 'attach') {
    if (filteredArgs.includes('--terminal') || filteredArgs[0] === 'attach') {
      const isReady = await autoStartControllerIfOffline(client);
      if (isReady) {
        await runInteractiveSession(client);
        return;
      }

      console.error(
        `${colors.red}Error: DualSurf browser controller could not be started.${colors.reset}\n` +
        `Please start DualSurf manually via "npm run dev:desktop".`
      );
      process.exit(1);
    }

    if (filteredArgs.length === 0) {
      if (await client.isControllerAvailable()) {
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

  if (command === 'help' || command === '--help' || command === '-h') {
    printCliHelp();
    return;
  }

  const CONTROLLER_REQUIRED_COMMANDS = new Set([
    'tabs', 'tab', 'open', 'search', 'page', 'text', 'links', 'endpoints', 'routes',
    'click', 'headings', 'find', 'back', 'forward', 'reload', 'stop', 'settings',
    'bookmarks', 'bookmark', 'history', 'downloads', 'download', 'clear-data',
    'gui', 'shutdown', 'kill', 'ask', 'summarize', 'summary', 'compare', 'extract',
    'do', 'agent', 'status',
  ]);

  // Ensure browser controller is online only when required by the command
  if (CONTROLLER_REQUIRED_COMMANDS.has(command)) {
    await autoStartControllerIfOffline(client);
  }

  try {
    switch (command) {
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
          } else if (sub) {
            // Semantic tab matching by keyword
            const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
            const match = findBestMatchingTab(rest.join(' ') || sub, state.tabs);
            if (match) {
              await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: match.tab.id });
              if (isJson) {
                console.log(JSON.stringify({ switchedTo: match.tab }));
              } else {
                console.log(
                  `${colors.green}Switched to tab [${match.index}]:${colors.reset} "${match.tab.title}"`
                );
              }
            } else {
              console.log(`${colors.yellow}No tab matching "${sub}" found.${colors.reset}`);
            }
          } else {
            console.log(`${colors.yellow}Usage: dualsurf tab <number | name> | dualsurf tab new [url] | dualsurf tab close [number]${colors.reset}`);
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

      case 'endpoints':
      case 'routes': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const filter = rest[0];
        if (isJson) {
          let list = meta.endpoints || [];
          if (filter) {
            const f = filter.toLowerCase().replace(/^-+/, '');
            list = list.filter((e) => e.category.toLowerCase().includes(f) || e.path.toLowerCase().includes(f));
          }
          console.log(JSON.stringify(list, null, 2));
        } else {
          console.log(formatEndpoints(meta.endpoints, filter));
        }
        break;
      }

      case 'click': {
        const target = rest.join(' ');
        if (!target) {
          console.error(`${colors.red}Error: Link identifier required.${colors.reset} Usage: dualsurf click <number | text>`);
          process.exit(1);
        }

        const linkId = parseInt(target, 10);
        if (!isNaN(linkId)) {
          const res = await client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId });
          if (isJson) {
            console.log(JSON.stringify(res, null, 2));
          } else {
            console.log(`${colors.green}Followed link [${linkId}].${colors.reset}`);
          }
        } else {
          // Semantic link resolution
          const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const match = findBestMatchingLink(target, meta.links || []);
          if (match) {
            const res = await client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId: match.item.id });
            if (isJson) {
              console.log(JSON.stringify({ match: match.item, result: res }, null, 2));
            } else {
              console.log(
                `${colors.green}Matched link [${match.item.id}]:${colors.reset} "${colors.bold}${match.item.label}${colors.reset}" -> ${match.item.href}`
              );
            }
          } else {
            const suggestions = findTopMatchingLinks(target, meta.links || [], 3);
            if (suggestions.length > 0) {
              console.log(`${colors.yellow}No exact match. Did you mean:${colors.reset}`);
              suggestions.forEach((s) => {
                console.log(`  ${colors.cyan}[${s.item.id}]${colors.reset} ${s.item.label}`);
              });
            } else {
              console.error(`${colors.red}Error: No link matching "${target}" found.${colors.reset}`);
            }
            process.exit(1);
          }
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

      case 'find': {
        const query = rest.join(' ');
        if (!query) {
          console.error(`${colors.red}Error: Search keyword required.${colors.reset} Usage: dualsurf find <keyword>`);
          process.exit(1);
        }
        const result = await client.sendCommand(IPC_COMMANDS.PAGE_FIND, { query });
        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatFindResults(result));
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

      case 'bookmarks': {
        const bookmarks = await client.sendCommand(IPC_COMMANDS.BOOKMARKS_LIST);
        if (isJson) {
          console.log(JSON.stringify(bookmarks, null, 2));
        } else {
          console.log(formatBookmarks(bookmarks));
        }
        break;
      }

      case 'bookmark': {
        const sub = rest[0]?.toLowerCase();
        if (sub === 'add') {
          let url = rest[1];
          let title = rest.slice(2).join(' ');

          if (!url) {
            const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            url = meta.url;
            title = meta.title;
          }

          const bm = await client.sendCommand(IPC_COMMANDS.BOOKMARKS_ADD, { url, title });
          if (isJson) {
            console.log(JSON.stringify(bm, null, 2));
          } else {
            console.log(`${colors.green}Saved bookmark:${colors.reset} ${bm.title} (${bm.url})`);
          }
        } else if (sub === 'remove' || sub === 'rm') {
          const id = rest[1];
          if (!id) {
            console.error(`${colors.red}Error: Bookmark ID required.${colors.reset} Usage: dualsurf bookmark remove <id>`);
            process.exit(1);
          }
          await client.sendCommand(IPC_COMMANDS.BOOKMARKS_REMOVE, { id });
          if (isJson) console.log(JSON.stringify({ removed: id }));
          else console.log(`${colors.yellow}Removed bookmark: ${id}${colors.reset}`);
        } else {
          const bookmarks = await client.sendCommand(IPC_COMMANDS.BOOKMARKS_LIST);
          if (isJson) console.log(JSON.stringify(bookmarks, null, 2));
          else console.log(formatBookmarks(bookmarks));
        }
        break;
      }

      case 'history': {
        const queryIndex = rest.indexOf('--search');
        if (queryIndex !== -1 && rest[queryIndex + 1]) {
          const query = rest[queryIndex + 1];
          const history = await client.sendCommand(IPC_COMMANDS.HISTORY_SEARCH, { query });
          if (isJson) console.log(JSON.stringify(history, null, 2));
          else console.log(formatHistory(history));
        } else {
          const limit = rest[0] ? parseInt(rest[0], 10) : 30;
          const history = await client.sendCommand(IPC_COMMANDS.HISTORY_LIST, { limit });
          if (isJson) console.log(JSON.stringify(history, null, 2));
          else console.log(formatHistory(history));
        }
        break;
      }

      case 'downloads':
      case 'download': {
        const downloads = await client.sendCommand(IPC_COMMANDS.DOWNLOADS_LIST);
        if (isJson) {
          console.log(JSON.stringify(downloads, null, 2));
        } else {
          console.log(formatDownloads(downloads));
        }
        break;
      }

      case 'clear-data': {
        await client.sendCommand(IPC_COMMANDS.HISTORY_CLEAR);
        if (isJson) console.log(JSON.stringify({ cleared: true }));
        else console.log(`${colors.yellow}Cleared all browsing history and session data.${colors.reset}`);
        break;
      }

      case 'gui': {
        await client.sendCommand(IPC_COMMANDS.SYSTEM_SHOW_GUI);
        if (isJson) console.log(JSON.stringify({ gui: true }));
        else console.log(`${colors.green}DualSurf graphical browser window launched.${colors.reset}`);
        break;
      }

      case 'shutdown':
      case 'kill': {
        await client.sendCommand(IPC_COMMANDS.SYSTEM_QUIT);
        if (isJson) console.log(JSON.stringify({ stopped: true }));
        else console.log(`${colors.yellow}DualSurf browser controller stopped.${colors.reset}`);
        break;
      }

      case 'ask': {
        const question = rest.join(' ');
        if (!question) {
          console.error(`${colors.red}Error: Question required.${colors.reset} Usage: dualsurf ask <question>`);
          process.exit(1);
        }

        if (!(await ollama.isAvailable())) {
          console.error(
            `${colors.red}Error: Local Ollama daemon is offline.${colors.reset}\n` +
            `Please run "ollama run llama3.2:1b" in a terminal.`
          );
          process.exit(1);
        }

        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        console.log(`${colors.cyan}🤖 [DualSurf Q&A] Reading "${meta.title}"...${colors.reset}\n`);
        await ollama.askAboutPage(meta, question, (token) => {
          process.stdout.write(token);
        });
        console.log('\n');
        break;
      }

      case 'summarize':
      case 'summary': {
        if (!(await ollama.isAvailable())) {
          console.error(
            `${colors.red}Error: Local Ollama daemon is offline.${colors.reset}\n` +
            `Please run "ollama run llama3.2:1b" in a terminal.`
          );
          process.exit(1);
        }

        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        console.log(`${colors.cyan}🤖 [DualSurf Summary] ${colors.bold}${meta.title || meta.url}${colors.reset}\n`);
        await ollama.summarizePage(meta, {
          onToken: (token) => {
            process.stdout.write(token);
          },
        });
        console.log('\n');
        break;
      }

      case 'compare': {
        const target = rest.join(' ');
        if (!target) {
          console.error(`${colors.red}Error: Target tab required.${colors.reset} Usage: dualsurf compare <tab index or keyword>`);
          process.exit(1);
        }

        const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        const match = findBestMatchingTab(target, state.tabs);
        if (!match) {
          console.error(`${colors.red}Error: No tab matching "${target}" found to compare.${colors.reset}`);
          process.exit(1);
        }

        const currentMeta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: match.tab.id });
        const targetMeta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        if (state.activeTabId) {
          await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: state.activeTabId });
        }

        console.log(`${colors.cyan}🤖 [DualSurf Comparison] "${currentMeta.title}" vs "${targetMeta.title}"${colors.reset}\n`);
        await ollama.comparePages(currentMeta, targetMeta, undefined, (token) => {
          process.stdout.write(token);
        });
        console.log('\n');
        break;
      }

      case 'extract': {
        const target = rest.join(' ');
        if (!target) {
          console.error(`${colors.red}Error: Target extraction description required.${colors.reset} Usage: dualsurf extract <data description>`);
          process.exit(1);
        }

        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const data = await ollama.extractStructuredData(meta, target);
        console.log(JSON.stringify(data, null, 2));
        break;
      }

      case 'do':
      case 'agent': {
        const goal = rest.join(' ');
        if (!goal) {
          console.error(`${colors.red}Error: Goal required.${colors.reset} Usage: dualsurf do <browsing goal>`);
          process.exit(1);
        }

        const agent = new AgentRunner(client, ollama);
        await agent.runGoal(goal);
        break;
      }

      case 'status': {
        const state = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const ollamaOk = await ollama.isAvailable();
        if (isJson) {
          console.log(JSON.stringify({ state, meta, ollama: { available: ollamaOk } }, null, 2));
        } else {
          console.log(`\n${colors.bold}${colors.cyan}DUALSURF SESSION STATUS & CONTEXT:${colors.reset}`);
          console.log(`  ${colors.bold}Active Tab:${colors.reset}   [${state.activeTabId || '1'}] "${meta.title || '(No title)'}" (${colors.cyan}${meta.url || 'about:blank'}${colors.reset})`);
          console.log(`  ${colors.bold}Open Tabs:${colors.reset}    ${state.tabs.length} tabs open`);
          console.log(`  ${colors.bold}Endpoints:${colors.reset}    ${meta.endpoints?.length || 0} detected`);
          console.log(`  ${colors.bold}Directory:${colors.reset}    ${process.cwd()}`);
          console.log(`  ${colors.bold}Local AI:${colors.reset}     ${ollamaOk ? colors.green + '✓ Connected (127.0.0.1:11434)' : colors.yellow + '○ Offline (Start Ollama for AI)'}${colors.reset}\n`);
        }
        break;
      }

      default: {
        // Natural language fallback: if input has multiple words or phrasing, treat as Agent goal
        const fullPrompt = filteredArgs.join(' ');
        if (filteredArgs.length >= 2 && (await ollama.isAvailable())) {
          console.log(`${colors.dim}Executing natural language browsing request with DualSurf Agent...${colors.reset}`);
          const agent = new AgentRunner(client, ollama);
          await agent.runGoal(fullPrompt);
          break;
        }

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
  dualsurf [command | "natural language goal"] [options]

${colors.bold}${colors.magenta}AI AGENT & NATURAL LANGUAGE:${colors.reset}
  ${colors.bold}dualsurf "<goal>"${colors.reset}             Autonomous browsing (e.g. dualsurf "open github and find trending")
  ${colors.bold}dualsurf do <goal>${colors.reset}             Run multi-step autonomous browsing agent
  ${colors.bold}dualsurf ask <question>${colors.reset}        Ask AI questions about current webpage content
  ${colors.bold}dualsurf summarize${colors.reset}             Generate concise AI summary of the active webpage
  ${colors.bold}dualsurf compare <tab>${colors.reset}         Side-by-side AI comparison with another open tab
  ${colors.bold}dualsurf extract <desc>${colors.reset}        Extract structured data from page into JSON

${colors.bold}${colors.cyan}NAVIGATION COMMANDS:${colors.reset}
  ${colors.bold}--terminal, attach${colors.reset}             Launch interactive terminal session
  ${colors.bold}open <url>${colors.reset}                     Open URL in active tab
  ${colors.bold}search <query>${colors.reset}                 Search using configured search engine
  ${colors.bold}click <number | "text">${colors.reset}        Follow link by ID OR semantic text (e.g. click "Pricing")
  ${colors.bold}page${colors.reset}                           Display metadata for current page
  ${colors.bold}text${colors.reset}                           Print structured readable content from page
  ${colors.bold}links${colors.reset}                          Print numbered actionable links with endpoint badges
  ${colors.bold}endpoints [filter]${colors.reset}             List detected endpoints (API, Auth, Download, Form)
  ${colors.bold}headings${colors.reset}                       List page headings in document order
  ${colors.bold}find <keyword>${colors.reset}                  Search text on current page
  ${colors.bold}back / forward${colors.reset}                 History navigation
  ${colors.bold}reload / stop${colors.reset}                  Reload or stop current page

${colors.bold}${colors.cyan}TAB MANAGEMENT:${colors.reset}
  ${colors.bold}tabs${colors.reset}                           List all open tabs
  ${colors.bold}tab <number | "name">${colors.reset}         Switch to tab by index OR tab name keyword
  ${colors.bold}tab new [url]${colors.reset}                  Create a new tab
  ${colors.bold}tab close [number]${colors.reset}             Close a tab

${colors.bold}${colors.cyan}BOOKMARKS, HISTORY & DATA:${colors.reset}
  ${colors.bold}bookmarks${colors.reset}                      List saved bookmarks
  ${colors.bold}bookmark add [url]${colors.reset}             Save a bookmark
  ${colors.bold}bookmark rm <id>${colors.reset}               Remove a bookmark
  ${colors.bold}history [--search Q]${colors.reset}           Display or search browsing history
  ${colors.bold}downloads${colors.reset}                      List recent download activity
  ${colors.bold}clear-data${colors.reset}                     Clear history and cached data

${colors.bold}${colors.cyan}BROWSER CONTROL:${colors.reset}
  ${colors.bold}gui${colors.reset}                            Launch / show graphical browser window
  ${colors.bold}settings${colors.reset}                       View browser preferences
  ${colors.bold}status${colors.reset}                         Display session status and local AI state
  ${colors.bold}shutdown / kill${colors.reset}                Stop background browser engine
  ${colors.bold}help${colors.reset}                           Show this help message

${colors.bold}OPTIONS:${colors.reset}
  ${colors.bold}--json${colors.reset}                         Output results in structured JSON format
`);
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
