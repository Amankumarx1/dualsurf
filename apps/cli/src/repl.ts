import * as readline from 'readline';
import { IpcClient } from './IpcClient.js';
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
import { OllamaClient } from './ollama/index.js';
import { AgentRunner } from './agent/index.js';
import { findBestMatchingLink, findBestMatchingTab, findTopMatchingLinks } from './semantic/index.js';

export async function runInteractiveSession(client: IpcClient): Promise<void> {
  const isOnline = await client.isControllerAvailable();
  if (!isOnline) {
    console.error(
      `${colors.red}Error: DualSurf browser controller is not running.${colors.reset}\n` +
      `Please start DualSurf first (run "dualsurf" to launch GUI or controller).`
    );
    process.exit(1);
  }

  const ollama = new OllamaClient();
  const agent = new AgentRunner(client, ollama);

  console.log(formatBanner());
  console.log(`${colors.green}Connected to live DualSurf browser session.${colors.reset}`);

  const isOllamaOnline = await ollama.isAvailable();
  if (isOllamaOnline) {
    const currentModel = await ollama.getOrSelectModel();
    console.log(
      `${colors.cyan}🤖 Ollama AI Assistant:${colors.reset} ${colors.green}Active${colors.reset} (Model: ${colors.bold}${currentModel}${colors.reset})`
    );
  } else {
    console.log(
      `${colors.dim}🤖 Ollama AI Assistant: Offline (Run "ollama run llama3.2:1b" to enable AI browsing)${colors.reset}`
    );
  }

  console.log(`${colors.dim}Type "help" for commands, or type any natural language goal to browse.${colors.reset}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.bold}${colors.cyan}dualsurf>${colors.reset} `,
    completer: (line: string) => {
      const completions = [
        'open',
        'goto',
        'search',
        'page',
        'text',
        'links',
        'endpoints',
        'click',
        'headings',
        'find',
        'tabs',
        'tab',
        'back',
        'forward',
        'reload',
        'stop',
        'ask',
        'summarize',
        'summary',
        'compare',
        'extract',
        'do',
        'agent',
        'bookmarks',
        'bookmark',
        'history',
        'downloads',
        'download',
        'gui',
        'settings',
        'clear-data',
        'help',
        'quit',
        'exit',
      ];
      const hits = completions.filter((c) => c.startsWith(line.trim()));
      return [hits.length ? hits : completions, line];
    },
  });

  const updatePrompt = (urlOrTitle?: string) => {
    let contextStr = '';
    if (urlOrTitle && urlOrTitle !== 'about:blank') {
      try {
        const u = new URL(urlOrTitle);
        contextStr = ` ${colors.dim}[${u.hostname}]${colors.reset}`;
      } catch {
        const clean = urlOrTitle.substring(0, 22).replace(/\s+/g, ' ');
        contextStr = ` ${colors.dim}[${clean}]${colors.reset}`;
      }
    }
    rl.setPrompt(`${colors.bold}${colors.cyan}dualsurf${colors.reset}${contextStr}> `);
  };

  const sendCommand = async (command: string, params?: any): Promise<any> => {
    try {
      return await client.sendCommand(command, params);
    } catch (err: any) {
      if (err.message && err.message.includes('Browser controller unavailable')) {
        console.log(`${colors.cyan}[DualSurf]${colors.reset} Controller connection lost. Reconnecting...`);
        const { autoStartControllerIfOffline } = await import('./launcher.js');
        const reconnected = await autoStartControllerIfOffline(client);
        if (reconnected) {
          return await client.sendCommand(command, params);
        }
      }
      throw err;
    }
  };

  // Initial prompt setup
  sendCommand(IPC_COMMANDS.PAGE_GET_METADATA)
    .then((m) => {
      if (m && m.url) updatePrompt(m.url);
    })
    .catch(() => {});

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
          const state: BrowserControllerState = await sendCommand(IPC_COMMANDS.TABS_LIST);
          console.log(formatTabsList(state));
          break;
        }

        case 'tab': {
          if (!arg) {
            const state: BrowserControllerState = await sendCommand(IPC_COMMANDS.TABS_LIST);
            console.log(formatTabsList(state));
          } else if (arg.startsWith('new')) {
            const url = arg.substring(3).trim();
            const tab = await sendCommand(IPC_COMMANDS.TABS_CREATE, { url: url || undefined });
            console.log(`${colors.green}Opened new tab:${colors.reset} ${tab.id} (${tab.url})`);
          } else if (arg.startsWith('close')) {
            const indexStr = arg.substring(5).trim();
            const index = indexStr ? parseInt(indexStr, 10) : undefined;
            await sendCommand(IPC_COMMANDS.TABS_CLOSE, { index });
            console.log(`${colors.yellow}Closed tab.${colors.reset}`);
          } else {
            const index = parseInt(arg, 10);
            if (!isNaN(index)) {
              await sendCommand(IPC_COMMANDS.TABS_SWITCH, { index });
              console.log(`${colors.green}Switched to tab [${index}].${colors.reset}`);
            } else {
              const state: BrowserControllerState = await sendCommand(IPC_COMMANDS.TABS_LIST);
              const match = findBestMatchingTab(arg, state.tabs);
              if (match) {
                await sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: match.tab.id });
                console.log(
                  `${colors.green}Switched to tab [${match.index}]:${colors.reset} "${match.tab.title}"`
                );
              } else {
                console.log(`${colors.yellow}No tab matching "${arg}" found.${colors.reset}`);
              }
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
            await sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: arg });
            console.log(`${colors.green}Navigation initiated.${colors.reset}`);
            updatePrompt(arg);
          }
          break;
        }

        case 'search': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: search <query>${colors.reset}`);
          } else {
            console.log(`${colors.dim}Searching for: "${arg}"...${colors.reset}`);
            await sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: arg });
            console.log(`${colors.green}Search dispatched.${colors.reset}`);
          }
          break;
        }

        case 'page': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatPageHeader(meta));
          break;
        }

        case 'text': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatPageText(meta));
          break;
        }

        case 'links': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatNumberedLinks(meta.links));
          break;
        }

        case 'endpoints':
        case 'routes': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatEndpoints(meta.endpoints, arg));
          break;
        }

        case 'click': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: click <number | text>${colors.reset}`);
            break;
          }
          const linkId = parseInt(arg, 10);
          if (!isNaN(linkId)) {
            await sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId });
            console.log(`${colors.green}Clicked link [${linkId}].${colors.reset}`);
          } else {
            const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            const match = findBestMatchingLink(arg, meta.links || []);
            if (match) {
              await sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId: match.item.id });
              console.log(
                `${colors.green}Clicked link [${match.item.id}]:${colors.reset} "${match.item.label}" -> ${match.item.href}`
              );
            } else {
              const suggestions = findTopMatchingLinks(arg, meta.links || [], 3);
              if (suggestions.length > 0) {
                console.log(`${colors.yellow}No exact match. Did you mean:${colors.reset}`);
                suggestions.forEach((s) => {
                  console.log(`  [${s.item.id}] ${s.item.label}`);
                });
              } else {
                console.log(`${colors.red}No link matching "${arg}" found.${colors.reset}`);
              }
            }
          }
          break;
        }

        case 'headings': {
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(formatHeadings(meta.headings));
          break;
        }

        case 'find': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: find <keyword>${colors.reset}`);
          } else {
            const result = await sendCommand(IPC_COMMANDS.PAGE_FIND, { query: arg });
            console.log(formatFindResults(result));
          }
          break;
        }

        case 'back': {
          await sendCommand(IPC_COMMANDS.NAV_BACK);
          console.log(`${colors.green}Navigated back.${colors.reset}`);
          break;
        }

        case 'forward': {
          await sendCommand(IPC_COMMANDS.NAV_FORWARD);
          console.log(`${colors.green}Navigated forward.${colors.reset}`);
          break;
        }

        case 'reload': {
          await sendCommand(IPC_COMMANDS.NAV_RELOAD);
          console.log(`${colors.green}Reloading active tab.${colors.reset}`);
          break;
        }

        case 'stop': {
          await sendCommand(IPC_COMMANDS.NAV_STOP);
          console.log(`${colors.yellow}Stopped navigation.${colors.reset}`);
          break;
        }

        case 'bookmarks': {
          const bookmarks = await sendCommand(IPC_COMMANDS.BOOKMARKS_LIST);
          console.log(formatBookmarks(bookmarks));
          break;
        }

        case 'bookmark': {
          const sub = parts[1]?.toLowerCase();
          if (sub === 'add') {
            const url = parts[2];
            const title = parts.slice(3).join(' ');
            let targetUrl = url;
            let targetTitle = title;
            if (!targetUrl) {
              const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              targetUrl = meta.url;
              targetTitle = meta.title;
            }
            const bm = await sendCommand(IPC_COMMANDS.BOOKMARKS_ADD, { url: targetUrl, title: targetTitle });
            console.log(`${colors.green}Saved bookmark:${colors.reset} ${bm.title} (${bm.url})`);
          } else if (sub === 'remove' || sub === 'rm') {
            const id = parts[2];
            if (!id) {
              console.log(`${colors.yellow}Usage: bookmark remove <id>${colors.reset}`);
            } else {
              await sendCommand(IPC_COMMANDS.BOOKMARKS_REMOVE, { id });
              console.log(`${colors.yellow}Removed bookmark: ${id}${colors.reset}`);
            }
          } else {
            const bookmarks = await sendCommand(IPC_COMMANDS.BOOKMARKS_LIST);
            console.log(formatBookmarks(bookmarks));
          }
          break;
        }

        case 'history': {
          const limit = arg ? parseInt(arg, 10) : 25;
          const history = await sendCommand(IPC_COMMANDS.HISTORY_LIST, { limit });
          console.log(formatHistory(history));
          break;
        }

        case 'downloads':
        case 'download': {
          const downloads = await sendCommand(IPC_COMMANDS.DOWNLOADS_LIST);
          console.log(formatDownloads(downloads));
          break;
        }

        case 'gui': {
          await sendCommand(IPC_COMMANDS.SYSTEM_SHOW_GUI);
          console.log(`${colors.green}DualSurf graphical browser window opened.${colors.reset}`);
          break;
        }

        case 'settings': {
          const settings = await sendCommand(IPC_COMMANDS.SETTINGS_GET);
          console.log(formatBanner());
          console.log(`${colors.bold}DualSurf Settings:${colors.reset}`);
          console.log(`  Search Engine: ${settings.searchEngine}`);
          console.log(`  Home URL:      ${settings.homeUrl}`);
          console.log(`  Downloads:     ${settings.defaultDownloadDir || 'Default (~/Downloads)'}`);
          break;
        }

        case 'clear-data': {
          await sendCommand(IPC_COMMANDS.HISTORY_CLEAR);
          console.log(`${colors.yellow}Cleared browsing data.${colors.reset}`);
          break;
        }

        case 'ask': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: ask <question about active page>${colors.reset}`);
            break;
          }
          if (!(await ollama.isAvailable())) {
            console.log(`${colors.yellow}Ollama is not running. Start with "ollama run llama3.2:1b".${colors.reset}`);
            break;
          }
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(`${colors.cyan}🤖 Asking about "${meta.title}"...${colors.reset}\n`);
          await ollama.askAboutPage(meta, arg, (token) => {
            process.stdout.write(token);
          });
          console.log('\n');
          break;
        }

        case 'summarize':
        case 'summary': {
          if (!(await ollama.isAvailable())) {
            console.log(`${colors.yellow}Ollama is not running. Start with "ollama run llama3.2:1b".${colors.reset}`);
            break;
          }
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          console.log(`${colors.cyan}🤖 Summarizing "${meta.title}"...${colors.reset}\n`);
          await ollama.summarizePage(meta, {
            onToken: (token) => process.stdout.write(token),
          });
          console.log('\n');
          break;
        }

        case 'compare': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: compare <tab index or title keyword>${colors.reset}`);
            break;
          }
          const state: BrowserControllerState = await sendCommand(IPC_COMMANDS.TABS_LIST);
          const match = findBestMatchingTab(arg, state.tabs);
          if (!match) {
            console.log(`${colors.red}Target tab "${arg}" not found.${colors.reset}`);
            break;
          }
          const currentMeta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          await sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: match.tab.id });
          const targetMeta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          if (state.activeTabId) {
            await sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: state.activeTabId });
          }
          console.log(`${colors.cyan}🤖 Comparing "${currentMeta.title}" vs "${targetMeta.title}"...${colors.reset}\n`);
          await ollama.comparePages(currentMeta, targetMeta, undefined, (token) => {
            process.stdout.write(token);
          });
          console.log('\n');
          break;
        }

        case 'extract': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: extract <data description>${colors.reset}`);
            break;
          }
          const meta: PageMetadata = await sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          const data = await ollama.extractStructuredData(meta, arg);
          console.log(JSON.stringify(data, null, 2));
          break;
        }

        case 'do':
        case 'agent': {
          if (!arg) {
            console.log(`${colors.yellow}Usage: do <natural language browsing goal>${colors.reset}`);
            break;
          }
          await agent.runGoal(arg);
          break;
        }

        default: {
          // If input looks like a URL, navigate directly
          if (input.includes('.') && !input.includes(' ')) {
            console.log(`${colors.dim}Navigating to: ${input}...${colors.reset}`);
            await sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: input });
            console.log(`${colors.green}Navigation initiated.${colors.reset}`);
            updatePrompt(input);
          } else {
            console.log(
              `${colors.dim}Command not recognized. Type "help" for available commands, or try "open ${input}".${colors.reset}`
            );
          }
          break;
        }
      }
    } catch (err: any) {
      console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
    }

    rl.prompt();
  });
}

function printReplHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}DualSurf Interactive Browser Terminal Commands:${colors.reset}

  ${colors.bold}Navigation:${colors.reset}
    open <url>                 Navigate active tab to a URL or domain
    search <query>             Search the web using default search engine
    back                       Go back in browser history
    forward                    Go forward in browser history
    reload                     Reload current tab
    stop                       Stop loading active tab

  ${colors.bold}Tab Management:${colors.reset}
    tabs                       List all open browser tabs
    tab <number | name>        Switch to a tab by index or matching title
    tab new [url]              Open a new tab
    tab close [number]         Close a tab by index

  ${colors.bold}Page Content & Links:${colors.reset}
    page                       Display page header and overview
    text                       Display extracted readable text from active page
    links                      Show numbered clickable links on the page
    click <number | label>     Click a link by its number (#) or text
    headings                   Show H1-H6 headings tree on the page
    endpoints                  Show detected API/web routes on the page
    find <keyword>             Find keyword occurrences in active page

  ${colors.bold}Browser Tools:${colors.reset}
    bookmarks                  List saved bookmarks
    bookmark add [url] [title] Bookmark active page or specific URL
    bookmark remove <id>       Remove a bookmark
    history [limit]            Show recent browsing history
    downloads                  Show recent downloads
    clear-data                 Clear browsing history and storage
    gui                        Bring graphical browser window to front
    settings                   View browser configuration

  ${colors.bold}AI Assistant (Ollama):${colors.reset}
    ask <question>             Ask a question about the current page
    summarize                  Generate a clean AI summary of active page
    compare <tab>              Compare active page with another open tab
    extract <description>      Extract structured data from active page
    do <browsing goal>         Autonomous AI browser agent goal

  ${colors.bold}General:${colors.reset}
    help                       Show this help text
    exit / quit                Exit interactive terminal
`);
}
