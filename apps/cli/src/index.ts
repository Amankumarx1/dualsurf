#!/usr/bin/env node
import * as os from 'os';
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
    'do', 'agent', 'status'
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
        if (isJson) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(JSON.stringify(data, null, 2));
        }
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

      case 'sudo': {
        const cmd = ['sudo', ...rest].join(' ');
        const { executeInteractiveShellCommand } = await import('./tools/index.js');
        const code = await executeInteractiveShellCommand(cmd);
        process.exit(code);
        break;
      }

      case 'sh':
      case 'exec': {
        const cmd = rest.join(' ');
        if (!cmd) {
          console.error(`${colors.red}Error: Command required.${colors.reset} Usage: dualsurf sh <command>`);
          process.exit(1);
        }
        const { executeInteractiveShellCommand } = await import('./tools/index.js');
        const code = await executeInteractiveShellCommand(cmd);
        process.exit(code);
        break;
      }

      case 'tools': {
        const { auditInstalledTools, formatToolsAudit, auditRedTeamTools, formatRedTeamToolsAudit } = await import('./tools/shellExecutor.js');
        const sub = rest[0]?.toLowerCase();
        if (sub === 'red' || sub === 'pillars' || sub === '7') {
          if (isJson) {
            console.log(JSON.stringify(auditRedTeamTools(), null, 2));
          } else {
            console.log(formatRedTeamToolsAudit());
          }
        } else {
          if (isJson) {
            console.log(JSON.stringify(auditInstalledTools(), null, 2));
          } else {
            console.log(formatToolsAudit(auditInstalledTools()));
            console.log(`\n${colors.dim}Run "dualsurf tools red" to audit all 7 Red Team operational pillars and tools.${colors.reset}\n`);
          }
        }
        break;
      }

      case 'assess':
      case 'scan':
      case 'auto-audit': {
        if (rest[0] === 'diff') {
          const prevFile = rest[1];
          const currFile = rest[2];
          if (!prevFile || !currFile) {
            console.error(`${colors.red}Error: Two JSON audit result files required for diff comparison.${colors.reset}\nUsage: dualsurf scan diff <prev.json> <curr.json>`);
            process.exit(1);
          }
          const fs = await import('fs');
          const path = await import('path');
          const pPath = path.isAbsolute(prevFile) ? prevFile : path.resolve(process.cwd(), prevFile);
          const cPath = path.isAbsolute(currFile) ? currFile : path.resolve(process.cwd(), currFile);
          if (!fs.existsSync(pPath)) {
            console.error(`${colors.red}Error: File not found: ${pPath}${colors.reset}`);
            process.exit(1);
          }
          if (!fs.existsSync(cPath)) {
            console.error(`${colors.red}Error: File not found: ${cPath}${colors.reset}`);
            process.exit(1);
          }
          const prevJson = JSON.parse(fs.readFileSync(pPath, 'utf8'));
          const currJson = JSON.parse(fs.readFileSync(cPath, 'utf8'));
          const { compareAuditResults, formatAuditComparisonTerminal } = await import('./tools/autoAudit.js');
          const diff = compareAuditResults(prevJson, currJson);
          if (isJson) {
            console.log(JSON.stringify(diff, null, 2));
          } else {
            console.log(formatAuditComparisonTerminal(diff));
          }
          break;
        }

        const exportHtml = rest.includes('--html') || rest.includes('--all');
        const exportJson = isJson || rest.includes('--json') || rest.includes('--all');
        const exportSarif = rest.includes('--sarif') || rest.includes('--all');
        const generateCiWorkflow = rest.includes('--ci-workflow') || rest.includes('--ci');
        const useAi = !rest.includes('--no-ai');

        const profileIdx = rest.indexOf('--profile');
        const portProfile = profileIdx !== -1 && rest[profileIdx + 1] ? (rest[profileIdx + 1].toLowerCase() as any) : 'web';
        const scanPortsFlag = !rest.includes('--no-ports');

        const cookieIdx = rest.indexOf('--cookie');
        const authCookie = cookieIdx !== -1 && rest[cookieIdx + 1] ? rest[cookieIdx + 1] : undefined;

        const tokenIdx = rest.indexOf('--token') !== -1 ? rest.indexOf('--token') : rest.indexOf('--auth');
        const bearerToken = tokenIdx !== -1 && rest[tokenIdx + 1] ? rest[tokenIdx + 1] : undefined;

        const webhookIdx = rest.indexOf('--webhook');
        const webhookUrl = webhookIdx !== -1 && rest[webhookIdx + 1] ? rest[webhookIdx + 1] : undefined;

        const cleanedRest = rest.filter((r, i) =>
          r !== '--html' && r !== '--json' && r !== '--all' && r !== '--no-ports' &&
          r !== '--sarif' && r !== '--ai' && r !== '--no-ai' &&
          r !== '--ci-workflow' && r !== '--ci' &&
          r !== '--profile' && rest[i - 1] !== '--profile' &&
          r !== '--cookie' && rest[i - 1] !== '--cookie' &&
          r !== '--token' && rest[i - 1] !== '--token' &&
          r !== '--auth' && rest[i - 1] !== '--auth' &&
          r !== '--webhook' && rest[i - 1] !== '--webhook'
        );

        let explicitTarget = (cleanedRest[0] && !cleanedRest[0].endsWith('.md') && !cleanedRest[0].endsWith('.html') && !cleanedRest[0].endsWith('.json') && !cleanedRest[0].endsWith('.sarif'))
          ? cleanedRest[0]
          : undefined;

        if (!explicitTarget) {
          try {
            if (await client.isControllerAvailable()) {
              const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              if (meta?.url && meta.url !== 'about:blank' && !meta.url.startsWith('dualsurf://')) {
                explicitTarget = meta.url;
              }
            }
          } catch {}
        }

        const target = explicitTarget;
        const outputFile = (cleanedRest[0]?.endsWith('.md') || cleanedRest[0]?.endsWith('.html') || cleanedRest[0]?.endsWith('.json') || cleanedRest[0]?.endsWith('.sarif'))
          ? cleanedRest[0]
          : cleanedRest[1];

        if (!target || target === 'about:blank') {
          console.error(`${colors.red}Error: Website URL required.${colors.reset}\nUsage: dualsurf assess <url> [output.md] [--html] [--json] [--sarif] [--ci-workflow] [--profile <web|common|db|all>] [--cookie <session>] [--token <jwt>] [--webhook <url>]`);
          process.exit(1);
        }
        const { runAutomatedSecurityAudit, formatAutoAuditTerminal } = await import('./tools/autoAudit.js');
        if (!isJson) {
          console.log(`\n${colors.cyan}Initiating complete end-to-end security assessment for:${colors.reset} ${colors.bold}${target}${colors.reset}...`);
          if (authCookie || bearerToken) {
            console.log(`  ${colors.magenta}🔒 Authenticated Audit Mode Active (Session headers injected)${colors.reset}`);
          }
        }
        const auditResult = await runAutomatedSecurityAudit(target, {
          outputPath: outputFile,
          autoExportReport: true,
          deepInspect: true,
          exportHtml: exportHtml || true,
          exportJson: exportJson,
          exportSarif: exportSarif,
          format: exportJson ? 'all' : 'html',
          scanPorts: scanPortsFlag,
          portProfile: portProfile,
          checkDns: true,
          checkEmailSecurity: true,
          checkAdminRoutes: true,
          deepAttackSurface: true,
          checkCloudBuckets: true,
          checkSubdomainTakeover: true,
          discoverApis: true,
          authCookie,
          bearerToken,
          webhookUrl,
          useAiRemediation: useAi,
          generateCiWorkflow,
        });
        if (isJson) {
          console.log(JSON.stringify(auditResult, null, 2));
        } else {
          console.log(formatAutoAuditTerminal(auditResult));
        }
        break;
      }

      case 'init-ci': {
        const { writeGitHubActionWorkflow } = await import('./tools/cicdWorkflow.js');
        const targetUrl = rest[0] || 'https://example.com';
        const createdPath = writeGitHubActionWorkflow(undefined, { targetUrl });
        console.log(`${colors.green}✔ Created GitHub Actions CI/CD security gate:${colors.reset} ${createdPath}`);
        break;
      }

      case 'ports':
      case 'port':
      case 'port-scan':
      case 'portscan': {
        let targetArg: string | undefined = undefined;
        let profileArg: 'web' | 'common' | 'db' | 'top20' | 'all' = 'web';
        let customPortsArg: number[] | undefined = undefined;

        const profileIdx = rest.indexOf('--profile');
        if (profileIdx !== -1 && rest[profileIdx + 1]) {
          profileArg = rest[profileIdx + 1].toLowerCase() as any;
        }

        const portsIdx = rest.indexOf('--ports');
        if (portsIdx !== -1 && rest[portsIdx + 1]) {
          customPortsArg = rest[portsIdx + 1]
            .split(',')
            .map((p) => parseInt(p.trim(), 10))
            .filter((p) => !isNaN(p) && p > 0 && p <= 65535);
        }

        const candidateArgs = rest.filter(
          (arg, i) =>
            arg !== 'scan' &&
            arg !== '--profile' &&
            rest[i - 1] !== '--profile' &&
            arg !== '--ports' &&
            rest[i - 1] !== '--ports'
        );

        if (candidateArgs.length > 0) {
          targetArg = candidateArgs[0];
        } else {
          try {
            const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            targetArg = meta?.url;
          } catch {}
        }

        if (!targetArg || targetArg === 'about:blank') {
          console.error(
            `${colors.red}Error: Target host or website URL required.${colors.reset}\n` +
            `Usage: dualsurf ports [scan] <target> [--profile <web|common|db|top20|all>] [--ports 80,443,8080]`
          );
          process.exit(1);
        }

        const { scanPorts, formatPortScanReport } = await import('./tools/portScan.js');
        if (!isJson) {
          console.log(`\n${colors.cyan}Initiating network port audit for:${colors.reset} ${colors.bold}${targetArg}${colors.reset} (Profile: ${profileArg})...`);
        }
        const portReport = await scanPorts(targetArg, {
          profile: profileArg,
          ports: customPortsArg,
        });

        if (isJson) {
          console.log(JSON.stringify(portReport, null, 2));
        } else {
          console.log(formatPortScanReport(portReport));
        }
        break;
      }

      case 'dns': {
        let target = rest[0];
        if (!target) {
          try {
            if (await client.isControllerAvailable()) {
              const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta?.url;
            }
          } catch {}
        }
        if (!target) {
          console.error(`${colors.yellow}Usage: dualsurf dns <host/domain>${colors.reset}`);
          process.exit(1);
        }
        const cleanHost = target
          .replace(/^https?:\/\//i, '')
          .split('/')[0]
          .split(':')[0]
          .trim()
          .toLowerCase();

        const { auditDnsAndEmail } = await import('./tools/attackSurface.js');
        const dnsInfo = await auditDnsAndEmail(cleanHost);

        if (isJson) {
          console.log(JSON.stringify({ host: cleanHost, ...dnsInfo }, null, 2));
        } else {
          console.log(`\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
          console.log(`${colors.bold}${colors.cyan}║       DUALSURF DNS & EMAIL AUTHENTICATION SECURITY AUDIT           ║${colors.reset}`);
          console.log(`${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
          console.log(`  Target Host:    ${colors.bold}${cleanHost}${colors.reset}`);
          console.log(`  IP Addresses:   ${dnsInfo.ipList.join(', ') || 'None resolved'}`);

          console.log(`\n  ${colors.bold}DNS Records Discovered (${dnsInfo.dnsRecords.length}):${colors.reset}`);
          dnsInfo.dnsRecords.forEach((r) => {
            console.log(`    • [${colors.yellow}${r.type.padEnd(5)}${colors.reset}] ${r.value}`);
          });

          const email = dnsInfo.emailSecurity;
          const policyStr = email.dmarcPolicy || 'missing';
          const dmarcColor = policyStr === 'reject' || policyStr === 'quarantine' ? colors.green : colors.red;
          console.log(`\n  ${colors.bold}Email & Domain Security Posture:${colors.reset}`);
          console.log(`    • SPF Record:   ${email.hasSpf ? colors.green + '✔ CONFIGURED' : colors.red + '✖ MISSING'}${colors.reset} ${email.spfRecord ? `(${email.spfRecord})` : ''}`);
          console.log(`    • DMARC Policy: ${dmarcColor}${policyStr.toUpperCase()}${colors.reset} ${email.dmarcRecord ? `(${email.dmarcRecord})` : colors.red + '(RFC 7489 Policy Missing)' + colors.reset}`);
          if (email.issues.length > 0) {
            console.log(`\n  ${colors.bold}${colors.red}Security Risks & Deficiencies:${colors.reset}`);
            email.issues.forEach((iss) => {
              console.log(`    ${colors.red}✖${colors.reset} ${iss}`);
            });
          } else {
            console.log(`\n  ${colors.green}✔ Domain authentication posture complies with email spoofing defenses.${colors.reset}`);
          }
          console.log('');
        }
        break;
      }

      case 'attack-surface':
      case 'asm': {
        let target = rest[0];
        if (!target) {
          try {
            if (await client.isControllerAvailable()) {
              const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta?.url;
            }
          } catch {}
        }
        if (!target) {
          console.error(`${colors.yellow}Usage: dualsurf attack-surface <domain/url> [--json]${colors.reset}`);
          process.exit(1);
        }
        const cleanHost = target
          .replace(/^https?:\/\//i, '')
          .split('/')[0]
          .split(':')[0]
          .trim()
          .toLowerCase();
        const baseUrl = /^https?:\/\//i.test(target.trim()) ? target.trim() : `https://${cleanHost}`;

        if (!isJson) {
          console.log(`${colors.dim}Initiating passive external attack surface discovery for: ${cleanHost}...${colors.reset}`);
        }
        const {
          auditDnsAndEmail,
          harvestCertificateTransparencySubdomains,
          probeAdminInterfaces,
          auditCloudStorageBuckets,
          auditSubdomainTakeovers,
          auditApiAndGraphQl,
          buildAttackSurfaceRegister,
          formatAttackSurfaceTerminal,
        } = await import('./tools/attackSurface.js');
        const { inspectTlsCertificate } = await import('./tools/securityAudit.js');

        const [dnsInfo, cert, ctSubs] = await Promise.all([
          auditDnsAndEmail(cleanHost),
          inspectTlsCertificate(cleanHost).catch(() => null),
          harvestCertificateTransparencySubdomains(cleanHost).catch(() => []),
        ]);

        const sanList = cert?.subjectAltNames || [];
        const allDiscoveredSubs = Array.from(new Set([cleanHost, ...sanList, ...ctSubs]));

        const [adminChecks, cloudBuckets, takeovers, apiDiscovery] = await Promise.all([
          probeAdminInterfaces(baseUrl).catch(() => []),
          auditCloudStorageBuckets(cleanHost).catch(() => []),
          auditSubdomainTakeovers(allDiscoveredSubs).catch(() => []),
          auditApiAndGraphQl(baseUrl).catch(() => undefined),
        ]);

        const assets = buildAttackSurfaceRegister(cleanHost, dnsInfo.ipList, sanList, [], ctSubs);

        if (isJson) {
          console.log(
            JSON.stringify(
              {
                host: cleanHost,
                assets,
                emailSecurity: dnsInfo.emailSecurity,
                dnsRecords: dnsInfo.dnsRecords,
                adminChecks,
                cloudBuckets,
                takeovers,
                apiDiscovery,
              },
              null,
              2
            )
          );
        } else {
          console.log(
            formatAttackSurfaceTerminal(
              assets,
              dnsInfo.emailSecurity,
              adminChecks,
              cloudBuckets,
              takeovers,
              apiDiscovery
            )
          );
        }
        break;
      }

      case 'report': {
        const filePath = rest[0];
        if (!filePath) {
          console.error(`${colors.red}Error: Report file path required.${colors.reset} Usage: dualsurf report <path/to/report.html|.md|.json>`);
          process.exit(1);
        }
        const fs = await import('fs');
        const path = await import('path');
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        if (!fs.existsSync(resolvedPath)) {
          console.error(`${colors.red}Error: File not found: ${resolvedPath}${colors.reset}`);
          process.exit(1);
        }

        if (resolvedPath.endsWith('.html')) {
          console.log(`${colors.green}Opening interactive HTML penetration report in DualSurf browser:${colors.reset} ${colors.cyan}${resolvedPath}${colors.reset}`);
          const fileUrl = `file:///${resolvedPath.replace(/\\/g, '/')}`;
          try {
            if (await client.isControllerAvailable()) {
              await client.sendCommand(IPC_COMMANDS.TABS_CREATE, { url: fileUrl });
            } else {
              console.log(`${colors.yellow}[Notice] Report is saved at: ${resolvedPath}. To view interactively, launch DualSurf desktop.${colors.reset}`);
            }
          } catch {
            console.log(`${colors.yellow}[Notice] Report is saved at: ${resolvedPath}${colors.reset}`);
          }
        } else {
          const content = fs.readFileSync(resolvedPath, 'utf8');
          console.log(content);
        }
        break;
      }

      case 'recon':
      case 'audit': {
        let meta: PageMetadata = {
          url: rest[0] ? (/^https?:\/\//i.test(rest[0].trim()) ? rest[0].trim() : `https://${rest[0].trim()}`) : '',
          title: rest[0] || 'Target Reconnaissance',
          isLoading: false,
          headings: [],
          forms: [],
          links: [],
          scripts: [],
          textSnippet: '',
        };
        if (!rest[0]) {
          try {
            if (await client.isControllerAvailable()) {
              meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            }
          } catch {}
        }
        if (!meta.url || meta.url === 'about:blank') {
          console.error(`${colors.yellow}Usage: dualsurf recon <url>${colors.reset}`);
          process.exit(1);
        }

        // Headless enrichment if executing without active browser WebContents
        if (rest[0] && meta.url) {
          try {
            const resp = await fetch(meta.url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DualSurf/1.0' },
              signal: AbortSignal.timeout(5000),
            });
            const html = await resp.text();
            meta.textSnippet = html.slice(0, 10000);
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) meta.title = titleMatch[1].trim();

            const scriptMatches = html.match(/<script\b[^>]*\bsrc=(["'])(.*?)\1/gi) || [];
            meta.scripts = scriptMatches.map((s) => {
              const m = s.match(/src=(["'])(.*?)\1/i);
              return m ? m[2] : s;
            });

            const linkMatches = html.match(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>/gi) || [];
            meta.links = linkMatches.slice(0, 30).map((l, idx) => {
              const hrefM = l.match(/href=(["'])(.*?)\1/i);
              const labelM = l.match(/>([^<]+)</);
              return {
                id: idx + 1,
                href: hrefM ? hrefM[2] : '',
                label: labelM ? labelM[1].trim() : 'Link',
              };
            });
          } catch {}
        }

        const { analyzeSecurityHeaders, formatReconSummary } = await import('./tools/recon.js');
        let headers;
        try {
          headers = await analyzeSecurityHeaders(meta.url);
        } catch {
          // offline
        }
        if (isJson) {
          console.log(JSON.stringify({ meta, headers }, null, 2));
        } else {
          console.log(formatReconSummary(meta, headers));
        }
        break;
      }

      case 'sec-audit':
      case 'vuln':
      case 'security': {
        let meta: PageMetadata = {
          url: rest[0] ? (/^https?:\/\//i.test(rest[0].trim()) ? rest[0].trim() : `https://${rest[0].trim()}`) : '',
          title: rest[0] || 'Passive Security Audit',
          isLoading: false,
          headings: [],
          forms: [],
          links: [],
          scripts: [],
          textSnippet: '',
        };
        if (!rest[0]) {
          try {
            if (await client.isControllerAvailable()) {
              meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            }
          } catch {}
        }
        if (!meta.url || meta.url === 'about:blank') {
          console.error(`${colors.yellow}Usage: dualsurf sec-audit <url>${colors.reset}`);
          process.exit(1);
        }

        // Headless enrichment for accurate passive security signals
        if (rest[0] && meta.url) {
          try {
            const resp = await fetch(meta.url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DualSurf/1.0' },
              signal: AbortSignal.timeout(5000),
            });
            const html = await resp.text();
            meta.textSnippet = html.slice(0, 20000);

            // Extract forms and security attributes
            const formMatches = html.match(/<form\b[^>]*>([\s\S]*?)<\/form>/gi) || [];
            meta.forms = formMatches.map((fStr, idx) => {
              const actionMatch = fStr.match(/action=(["'])(.*?)\1/i);
              const action = actionMatch ? actionMatch[2] : '';
              const methodMatch = fStr.match(/method=(["'])(.*?)\1/i);
              const method = (methodMatch ? methodMatch[2] : 'GET').toUpperCase();
              const hasPassword = /type=(["'])password\1/i.test(fStr);
              const hasCsrfToken = /csrf|_token|authenticity_token/i.test(fStr);
              const isCleartext = action.startsWith('http://');
              return {
                id: `form-${idx + 1}`,
                name: `Form ${idx + 1}`,
                action,
                method: method as any,
                hasPassword,
                hasCsrfToken,
                isCleartext,
              };
            });

            // Extract scripts
            const scriptMatches = html.match(/<script\b[^>]*\bsrc=(["'])(.*?)\1/gi) || [];
            meta.scripts = scriptMatches.map((s) => {
              const m = s.match(/src=(["'])(.*?)\1/i);
              return m ? m[2] : s;
            });

            // Tabnabbing and mixed content detection
            const linkMatches = html.match(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>/gi) || [];
            let tabnabbingCount = 0;
            let insecureLinksCount = 0;
            linkMatches.forEach((l) => {
              if (/_blank/i.test(l) && !/noopener/i.test(l)) tabnabbingCount++;
              if (/href=(["'])http:\/\//i.test(l)) insecureLinksCount++;
            });

            meta.securitySignals = {
              tabnabbingCount,
              insecureLinksCount,
              scriptsCount: meta.scripts.length,
              externalScriptsCount: meta.scripts.filter((s) => /^https?:\/\//i.test(s)).length,
              hasPasswordField: meta.forms.some((f) => f.hasPassword),
              metaGenerator: (html.match(/<meta\b[^>]*name=(["'])generator\1[^>]*content=(["'])(.*?)\2/i) || [])[3] || '',
            };
          } catch {}
        }

        const { analyzeSecurityHeaders } = await import('./tools/recon.js');
        const { auditPassiveSecurity, formatSecurityAudit } = await import('./tools/securityAudit.js');
        let headers;
        try {
          headers = await analyzeSecurityHeaders(meta.url);
        } catch {
          // offline
        }
        const report = auditPassiveSecurity(meta, headers);
        if (isJson) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatSecurityAudit(report));
        }
        break;
      }

      case 'cert':
      case 'ssl': {
        let target = rest[0];
        if (!target) {
          try {
            if (await client.isControllerAvailable()) {
              const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta?.url;
            }
          } catch {}
        }
        if (!target) {
          console.error(`${colors.yellow}Usage: dualsurf cert <host/url>${colors.reset}`);
          process.exit(1);
        }
        const { inspectTlsCertificate, formatTlsCertificate } = await import('./tools/securityAudit.js');
        const cert = await inspectTlsCertificate(target);
        if (isJson) {
          console.log(JSON.stringify(cert, null, 2));
        } else {
          console.log(formatTlsCertificate(cert));
        }
        break;
      }

      case 'cors': {
        let target = rest[0];
        if (!target) {
          try {
            if (await client.isControllerAvailable()) {
              const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta?.url;
            }
          } catch {}
        }
        if (!target) {
          console.error(`${colors.yellow}Usage: dualsurf cors <url>${colors.reset}`);
          process.exit(1);
        }
        const normalizedTarget = /^https?:\/\//i.test(target.trim()) ? target.trim() : `https://${target.trim()}`;
        const { analyzeCorsPolicy, formatCorsAnalysis } = await import('./tools/securityAudit.js');
        const cors = await analyzeCorsPolicy(normalizedTarget);
        if (isJson) {
          console.log(JSON.stringify(cors, null, 2));
        } else {
          console.log(formatCorsAnalysis(cors));
        }
        break;
      }

      case 'tech':
      case 'fingerprint': {
        let target = rest[0];
        let scripts: string[] | undefined;
        if (!target) {
          try {
            if (await client.isControllerAvailable()) {
              const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta?.url;
              scripts = meta?.scripts;
            }
          } catch {}
        }
        if (!target) {
          console.error(`${colors.yellow}Usage: dualsurf tech <url>${colors.reset}`);
          process.exit(1);
        }
        const normalizedTarget = /^https?:\/\//i.test(target.trim()) ? target.trim() : `https://${target.trim()}`;
        const { analyzeSecurityHeaders } = await import('./tools/recon.js');
        const { detectTechnologies, formatTechProfile } = await import('./tools/securityAudit.js');
        let headers: any;
        try {
          headers = await analyzeSecurityHeaders(normalizedTarget);
        } catch {
          // offline
        }

        let bodySnippet = '';
        if (!scripts || scripts.length === 0) {
          try {
            const resp = await fetch(normalizedTarget, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DualSurf/1.0' },
              signal: AbortSignal.timeout(5000),
            });
            bodySnippet = await resp.text();
            const scriptMatches = bodySnippet.match(/<script\b[^>]*\bsrc=(["'])(.*?)\1/gi) || [];
            scripts = scriptMatches.map((s) => {
              const m = s.match(/src=(["'])(.*?)\1/i);
              return m ? m[2] : s;
            });
          } catch {}
        }

        const techMeta = bodySnippet
          ? ({ url: normalizedTarget, scripts: scripts || [], textSnippet: bodySnippet.slice(0, 15000) } as any)
          : normalizedTarget;
        const tech = detectTechnologies(techMeta, scripts, headers?.headers || headers);
        if (isJson) {
          console.log(JSON.stringify(tech, null, 2));
        } else {
          console.log(formatTechProfile(tech));
        }
        break;
      }

      case 'secrets': {
        const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const { scanForSecrets } = await import('./tools/securityAudit.js');
        const combined = [
          meta.textSnippet || '',
          JSON.stringify(meta.storage || []),
          JSON.stringify(meta.cookies || []),
        ].join('\n');
        const findings = scanForSecrets(combined);
        if (isJson) {
          console.log(JSON.stringify({ url: meta.url, count: findings.length, findings }, null, 2));
        } else {
          if (findings.length > 0) {
            console.log(`\n${colors.bold}${colors.red}POTENTIALLY LEAKED SECRETS / CREDENTIALS (${findings.length} findings):${colors.reset}`);
            findings.forEach((f, idx) => {
              console.log(`  ${colors.red}[${idx + 1}] ${f.type}:${colors.reset} ${f.snippet}`);
            });
            console.log('');
          } else {
            console.log(`${colors.green}✔ No API keys, JWT tokens, AWS credentials, or private keys found in active DOM or storage.${colors.reset}`);
          }
        }
        break;
      }

      case 'siem':
      case 'logs': {
        const { analyzeSecurityLogs, formatSiemReport } = await import('./tools/blueTeam.js');
        let content = '';
        if (rest[0]) {
          const fs = await import('fs');
          if (fs.existsSync(rest[0])) {
            content = fs.readFileSync(rest[0], 'utf8');
          } else {
            content = rest.join(' ');
          }
        } else {
          try {
            if (await client.isControllerAvailable()) {
              const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              content = [meta.title, meta.url, meta.textSnippet || ''].join('\n');
            }
          } catch {}
          if (!content) {
            console.error(`${colors.yellow}Usage: dualsurf siem <logfile | "log text">${colors.reset}`);
            process.exit(1);
          }
        }
        const report = analyzeSecurityLogs(content);
        if (isJson) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatSiemReport(report));
        }
        break;
      }

      case 'ioc':
      case 'ti': {
        const { extractIocs, formatIocFindings } = await import('./tools/blueTeam.js');
        let text = rest.join(' ');
        if (!text) {
          const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          text = [meta.title, meta.url, meta.textSnippet || ''].join('\n');
        }
        const findings = extractIocs(text);
        if (isJson) {
          console.log(JSON.stringify({ count: findings.length, findings }, null, 2));
        } else {
          console.log(formatIocFindings(findings));
        }
        break;
      }

      case 'case':
      case 'ir': {
        const { incidentStore, formatIncidentCase } = await import('./tools/blueTeam.js');
        const subCmd = rest[0]?.toLowerCase() || 'list';

        if (subCmd === 'new' || subCmd === 'create') {
          const title = rest.slice(1).join(' ') || 'Investigated Security Anomaly';
          let affectedHosts = ['host-workstation'];
          let iocs: string[] = [];
          try {
            if (await client.isControllerAvailable()) {
              const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              if (meta?.url) {
                affectedHosts = [meta.url];
                iocs = [meta.url];
              }
            }
          } catch {
            // Standalone CLI mode
          }
          const newCase = incidentStore.createCase(title, 'P2-HIGH', 'Web / Endpoint Incident', {
            affectedHosts,
            iocs,
          });
          if (isJson) console.log(JSON.stringify(newCase, null, 2));
          else console.log(formatIncidentCase(newCase));
        } else if (subCmd === 'view' || subCmd === 'get') {
          const targetId = rest[1];
          const c = incidentStore.getCase(targetId);
          if (isJson) console.log(JSON.stringify(c || null, null, 2));
          else if (c) console.log(formatIncidentCase(c));
          else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
        } else if (subCmd === 'close') {
          const targetId = rest[1];
          const c = incidentStore.updateCaseStatus(targetId, 'Closed', 'Investigation completed');
          if (isJson) console.log(JSON.stringify(c || null, null, 2));
          else if (c) console.log(`${colors.green}✔ Case ${targetId} marked as Closed.${colors.reset}`);
          else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
        } else if (subCmd === 'link') {
          const targetId = rest[1];
          const evidenceId = rest[2];
          if (!targetId || !evidenceId) {
            console.error(`${colors.yellow}Usage: dualsurf case link <case-id> <evidence-id>${colors.reset}`);
            process.exit(1);
          }
          const c = incidentStore.linkEvidence(targetId, evidenceId);
          if (isJson) console.log(JSON.stringify(c || null, null, 2));
          else if (c) console.log(`${colors.green}✔ Linked evidence ${evidenceId} to incident case ${targetId}.${colors.reset}`);
          else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
        } else if (subCmd === 'severity' || subCmd === 'sev') {
          const targetId = rest[1];
          const sev = (rest[2] || 'P2-HIGH').toUpperCase() as any;
          const note = rest.slice(3).join(' ');
          if (!targetId) {
            console.error(`${colors.yellow}Usage: dualsurf case severity <case-id> <P1-CRITICAL|P2-HIGH|P3-MEDIUM|P4-LOW>${colors.reset}`);
            process.exit(1);
          }
          const c = incidentStore.updateSeverity(targetId, sev, note);
          if (isJson) console.log(JSON.stringify(c || null, null, 2));
          else if (c) console.log(`${colors.green}✔ Updated case ${targetId} severity to ${sev}.${colors.reset}`);
          else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
        } else if (subCmd === 'assign') {
          const targetId = rest[1];
          const analyst = rest.slice(2).join(' ') || 'SOC Analyst Tier 1';
          if (!targetId) {
            console.error(`${colors.yellow}Usage: dualsurf case assign <case-id> <analyst-name>${colors.reset}`);
            process.exit(1);
          }
          const c = incidentStore.assignAnalyst(targetId, analyst);
          if (isJson) console.log(JSON.stringify(c || null, null, 2));
          else if (c) console.log(`${colors.green}✔ Reassigned case ${targetId} to "${analyst}".${colors.reset}`);
          else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
        } else if (subCmd === 'fp' || subCmd === 'false-positive') {
          const targetId = rest[1];
          const reason = rest.slice(2).join(' ') || 'Confirmed benign business traffic / authorized administrative action';
          if (!targetId) {
            console.error(`${colors.yellow}Usage: dualsurf case fp <case-id> <reason>${colors.reset}`);
            process.exit(1);
          }
          const c = incidentStore.markFalsePositive(targetId, reason);
          if (isJson) console.log(JSON.stringify(c || null, null, 2));
          else if (c) console.log(`${colors.green}✔ Case ${targetId} marked as FALSE POSITIVE: ${reason}${colors.reset}`);
          else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
        } else if (subCmd === 'note' || subCmd === 'add-note') {
          const targetId = rest[1];
          const noteText = rest.slice(2).join(' ');
          if (!targetId || !noteText) {
            console.error(`${colors.yellow}Usage: dualsurf case note <case-id> <note-text>${colors.reset}`);
            process.exit(1);
          }
          const c = incidentStore.addNote(targetId, noteText, 'SOC Analyst');
          if (isJson) console.log(JSON.stringify(c || null, null, 2));
          else if (c) console.log(`${colors.green}✔ Added analyst note to case ${targetId}.${colors.reset}`);
          else console.log(`${colors.red}Case not found: ${targetId}${colors.reset}`);
        } else if (subCmd === 'timeline') {
          const targetId = rest[1];
          if (!targetId) {
            console.error(`${colors.yellow}Usage: dualsurf case timeline <case-id>${colors.reset}`);
            process.exit(1);
          }
          const { buildCaseTimeline } = await import('./tools/blueTelemetry.js');
          try {
            const tl = buildCaseTimeline(targetId);
            if (isJson) {
              console.log(JSON.stringify(tl, null, 2));
            } else {
              console.log(`\n${colors.bold}${colors.cyan}INCIDENT TIMELINE FOR CASE ${targetId} (${tl.length} events):${colors.reset}`);
              tl.forEach((e) => {
                console.log(`  • [${colors.dim}${e.timestamp}${colors.reset}] ${colors.bold}${e.title}${colors.reset}`);
                console.log(`    ${e.description} ${e.evidenceId ? `(${colors.cyan}${e.evidenceId}${colors.reset})` : ''}`);
              });
              console.log('');
            }
          } catch (err: any) {
            console.error(`${colors.red}${err.message}${colors.reset}`);
            process.exit(1);
          }
        } else if (subCmd === 'report') {
          const targetId = rest[1];
          if (!targetId) {
            console.error(`${colors.yellow}Usage: dualsurf case report <case-id> [--json]${colors.reset}`);
            process.exit(1);
          }
          const { generateBlueTeamReport } = await import('./tools/blueTelemetry.js');
          const format = isJson || rest.includes('--json') ? 'json' : 'markdown';
          try {
            const res = generateBlueTeamReport(targetId, format);
            if (format === 'json') console.log(res.reportContent);
            else {
              console.log(`${colors.green}✔ Generated DFIR Report: ${res.filePath}${colors.reset}\n`);
              console.log(res.reportContent);
            }
          } catch (err: any) {
            console.error(`${colors.red}${err.message}${colors.reset}`);
            process.exit(1);
          }
        } else {
          const list = incidentStore.listCases();
          if (isJson) {
            console.log(JSON.stringify(list, null, 2));
          } else {
            console.log(`\n${colors.bold}${colors.magenta}ACTIVE INCIDENT RESPONSE CASES (${list.length}):${colors.reset}`);
            list.forEach((c) => {
              const sev = c.severity === 'P1-CRITICAL' ? colors.red : c.severity === 'P2-HIGH' ? colors.yellow : colors.cyan;
              const fpNotice = c.isFalsePositive ? ` ${colors.yellow}[FP]${colors.reset}` : '';
              console.log(`  • ${colors.bold}${c.id}${colors.reset} [${sev}${c.severity}${colors.reset}] (${c.status})${fpNotice} - ${c.title}`);
            });
            console.log('');
          }
        }
        break;
      }

      case 'edr': {
        const { executeBlueTeamTool } = await import('./tools/blueTeam.js');
        const sub = rest[0] || 'all';
        const res = await executeBlueTeamTool('edr', sub, rest.slice(1));
        if (isJson) console.log(JSON.stringify(res, null, 2));
        else console.log(res.output);
        break;
      }

      case 'hunt': {
        const { listThreatHunts, runThreatHunt, formatThreatHuntsList, formatThreatHuntResult } = await import('./tools/blueTelemetry.js');
        const subCmd = rest[0]?.toLowerCase();
        if (!subCmd || subCmd === 'list') {
          const hunts = listThreatHunts();
          if (isJson) console.log(JSON.stringify(hunts, null, 2));
          else console.log(formatThreatHuntsList(hunts));
        } else if (subCmd === 'run') {
          const huntId = rest[1] || 'HUNT-001';
          const srcId = rest[2];
          try {
            const huntRes = await runThreatHunt(huntId, srcId);
            if (isJson) console.log(JSON.stringify(huntRes, null, 2));
            else console.log(formatThreatHuntResult(huntRes));
          } catch (err: any) {
            console.error(`${colors.red}Threat hunt failed: ${err.message}${colors.reset}`);
            process.exit(1);
          }
        } else {
          const { huntThreats, formatThreatHuntReport } = await import('./tools/blueTeam.js');
          const query = rest.join(' ');
          const findings = huntThreats(query || 'telemetry-stream');
          if (isJson) console.log(JSON.stringify(findings, null, 2));
          else console.log(formatThreatHuntReport(findings));
        }
        break;
      }

      case 'hash':
      case 'dfir': {
        const targetPath = rest[0];
        if (!targetPath) {
          console.error(`${colors.red}Error: Target file required.${colors.reset} Usage: dualsurf hash <file_path>`);
          process.exit(1);
        }
        const { computeForensicHash, formatForensicEvidence } = await import('./tools/blueTeam.js');
        const evidence = computeForensicHash(targetPath);
        if (isJson) {
          console.log(JSON.stringify(evidence, null, 2));
        } else {
          console.log(formatForensicEvidence(evidence));
        }
        break;
      }

      case 'soar': {
        const { runSoarTriagePlaybook, formatSoarTriage, generateSoarPlaybook, formatSoarPlaybook } = await import('./tools/blueTeam.js');
        const sub = rest[0]?.toLowerCase();
        if (sub === 'block' || sub === 'isolate' || sub === 'sinkhole') {
          let target = rest.slice(1).join(' ');
          if (!target) {
            const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            target = meta.url;
          }
          const playbook = generateSoarPlaybook(sub, target);
          if (isJson) {
            console.log(JSON.stringify(playbook, null, 2));
          } else {
            console.log(formatSoarPlaybook(playbook));
          }
          break;
        }

        let target = rest.join(' ');
        if (!target) {
          const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          target = meta.url;
        }
        const result = await runSoarTriagePlaybook(target);
        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatSoarTriage(result));
        }
        break;
      }

      case 'mitre':
      case 'attack': {
        const { mapToMitreAttack } = await import('./tools/blueTeam.js');
        let text = rest.join(' ');
        if (!text) {
          const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          text = [meta.title, meta.url, meta.textSnippet || ''].join('\n');
        }
        const mappings = mapToMitreAttack(text);
        if (isJson) {
          console.log(JSON.stringify(mappings, null, 2));
        } else {
          if (mappings.length > 0) {
            console.log(`\n${colors.bold}${colors.cyan}CORRELATED MITRE ATT&CK TECHNIQUES (${mappings.length}):${colors.reset}`);
            mappings.forEach((m) => {
              console.log(`  • ${colors.bold}${colors.yellow}${m.id}${colors.reset}: ${colors.bold}${m.technique}${colors.reset} (${m.tactic})`);
              console.log(`    ${colors.dim}${m.description}${colors.reset}`);
            });
            console.log('');
          } else {
            console.log(`${colors.green}✔ No suspicious activity matching MITRE ATT&CK patterns detected.${colors.reset}`);
          }
        }
        break;
      }

      case 'blue':
      case 'blue-team':
      case 'roadmap': {
        const {
          formatBlueTeamDomainList,
          formatBlueTeamDomainDetail,
          getSpecializationGuide,
          BLUE_TEAM_DOMAINS,
          BLUE_TEAM_OPERATIONAL_PILLARS,
          formatBlueTeamPillarsList,
          formatBlueTeamPillarDetail,
          formatBlueTeamWorkflow,
          formatBlueTeamDailyOperations,
          formatBlueTeamMetrics,
          formatBlueTeamCatalog,
          formatBlueTeamRoadmap,
          executeBlueTeamTool,
        } = await import('./tools/blueTeam.js');

        const { evidenceStore, formatEvidenceList, formatEvidenceDetail } = await import('./tools/evidenceStore.js');
        const { detectHostBlueTeamTools, formatToolDetectionReport, getToolInfoGuidance } = await import('./tools/executionEngine.js');
        const { auditBlueTeamTools, formatBlueTeamToolsAudit } = await import('./tools/shellExecutor.js');
        const {
          listTelemetrySources,
          checkTelemetrySource,
          queryTelemetry,
          listThreatHunts,
          runThreatHunt,
          generateBlueTeamReport,
          previewResponseAction,
          formatTelemetrySources,
          formatTelemetryEvents,
          formatThreatHuntsList,
          formatThreatHuntResult,
        } = await import('./tools/blueTelemetry.js');

        const sub = rest[0]?.toLowerCase();

        if (!sub || sub === 'pillars' || sub === '13') {
          if (isJson) console.log(JSON.stringify(BLUE_TEAM_OPERATIONAL_PILLARS, null, 2));
          else console.log(formatBlueTeamPillarsList());
        } else if (sub === 'pillar' || sub === 'p') {
          const pillarId = parseInt(rest[1], 10) || 1;
          const pillar = BLUE_TEAM_OPERATIONAL_PILLARS.find((p) => p.id === pillarId) || BLUE_TEAM_OPERATIONAL_PILLARS[0];
          if (isJson) console.log(JSON.stringify(pillar, null, 2));
          else console.log(formatBlueTeamPillarDetail(pillarId));
        } else if (sub === 'status') {
          const detected = await detectHostBlueTeamTools();
          const evidenceCount = evidenceStore.listEvidence().length;
          const { incidentStore } = await import('./tools/blueTeam.js');
          const caseCount = incidentStore.listCases().length;
          const statusObj = {
            installedTools: detected.filter((t) => t.installed).length,
            missingTools: detected.filter((t) => !t.installed && t.status === 'NOT_INSTALLED').length,
            unsupportedTools: detected.filter((t) => t.status === 'UNSUPPORTED_OS').length,
            evidenceRecords: evidenceCount,
            activeCases: caseCount,
            host: os.hostname(),
            platform: process.platform,
          };
          if (isJson) {
            console.log(JSON.stringify(statusObj, null, 2));
          } else {
            console.log(`\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
            console.log(`${colors.bold}${colors.cyan}║             DUALSURF BLUE TEAM OPERATIONS STATUS                   ║${colors.reset}`);
            console.log(`${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
            console.log(`  ${colors.bold}Host System:${colors.reset}       ${statusObj.host} (${statusObj.platform})`);
            console.log(`  ${colors.bold}Installed Tools:${colors.reset}   ${colors.green}${statusObj.installedTools} Active${colors.reset}`);
            console.log(`  ${colors.bold}Missing Tools:${colors.reset}     ${colors.yellow}${statusObj.missingTools} Not in PATH${colors.reset}`);
            console.log(`  ${colors.bold}Evidence Records:${colors.reset}  ${colors.cyan}${statusObj.evidenceRecords} Stored on disk${colors.reset}`);
            console.log(`  ${colors.bold}Incident Cases:${colors.reset}    ${colors.yellow}${statusObj.activeCases} Open / Active${colors.reset}`);
            console.log(`\n  ${colors.dim}Run "dualsurf blue tools check" or "dualsurf blue evidence list" for details.${colors.reset}\n`);
          }
        } else if (sub === 'tools') {
          const action = rest[1]?.toLowerCase();
          if (action === 'check') {
            const detected = await detectHostBlueTeamTools();
            if (isJson) console.log(JSON.stringify(detected, null, 2));
            else console.log(formatToolDetectionReport(detected));
          } else if (action === 'info') {
            const toolId = rest[2] || 'osquery';
            const detected = await detectHostBlueTeamTools();
            const det = detected.find((t) => t.toolId.toLowerCase() === toolId.toLowerCase());
            console.log(getToolInfoGuidance(toolId, det));
          } else {
            if (isJson) console.log(JSON.stringify(auditBlueTeamTools(), null, 2));
            else console.log(formatBlueTeamToolsAudit());
          }
        } else if (sub === 'catalog') {
          const query = rest.slice(1).join(' ');
          if (isJson) {
            const { searchBlueTeamCatalog } = await import('./tools/blueTeam.js');
            console.log(JSON.stringify(searchBlueTeamCatalog(query), null, 2));
          } else {
            console.log(formatBlueTeamCatalog(query));
          }
        } else if (sub === 'workflow' || sub === 'cycle') {
          if (isJson) {
            const { BLUE_TEAM_WORKFLOW } = await import('./tools/blueTeam.js');
            console.log(JSON.stringify(BLUE_TEAM_WORKFLOW, null, 2));
          } else {
            console.log(formatBlueTeamWorkflow());
          }
        } else if (sub === 'day' || sub === 'operations') {
          if (isJson) {
            const { BLUE_TEAM_ROLE_PERSONAS } = await import('./tools/blueTeam.js');
            console.log(JSON.stringify(BLUE_TEAM_ROLE_PERSONAS, null, 2));
          } else {
            console.log(formatBlueTeamDailyOperations());
          }
        } else if (sub === 'metrics') {
          if (isJson) {
            const { BLUE_TEAM_METRICS } = await import('./tools/blueTeam.js');
            console.log(JSON.stringify(BLUE_TEAM_METRICS, null, 2));
          } else {
            console.log(formatBlueTeamMetrics());
          }
        } else if (sub === 'evidence') {
          const action = rest[1]?.toLowerCase();
          if (!action || action === 'list') {
            const records = evidenceStore.listEvidence();
            if (isJson) console.log(JSON.stringify(records, null, 2));
            else console.log(formatEvidenceList(records));
          } else if (action === 'show' || action === 'view') {
            const id = rest[2];
            if (!id) {
              console.error(`${colors.yellow}Usage: dualsurf blue evidence show <EVD-ID>${colors.reset}`);
              process.exit(1);
            }
            const rec = evidenceStore.getEvidence(id);
            if (!rec) {
              console.error(`${colors.red}Evidence record "${id}" not found.${colors.reset}`);
              process.exit(1);
            }
            if (isJson) console.log(JSON.stringify(rec, null, 2));
            else console.log(formatEvidenceDetail(rec));
          } else if (action === 'export') {
            const id = rest[2];
            const format = (rest[3]?.toLowerCase() === 'raw' ? 'raw' : 'json') as 'json' | 'raw';
            if (!id) {
              console.error(`${colors.yellow}Usage: dualsurf blue evidence export <EVD-ID> [raw|json]${colors.reset}`);
              process.exit(1);
            }
            try {
              console.log(evidenceStore.exportEvidence(id, format));
            } catch (err: any) {
              console.error(`${colors.red}${err.message}${colors.reset}`);
              process.exit(1);
            }
          }
        } else if (sub === 'cases') {
          const { incidentStore, formatIncidentCase } = await import('./tools/blueTeam.js');
          const action = rest[1]?.toLowerCase();
          if (!action || action === 'list') {
            const cases = incidentStore.listCases();
            if (isJson) console.log(JSON.stringify(cases, null, 2));
            else {
              console.log(`\n${colors.bold}${colors.cyan}ACTIVE INCIDENT RESPONSE CASES (${cases.length}):${colors.reset}`);
              cases.forEach((c) => console.log(formatIncidentCase(c) + '\n'));
            }
          } else if (action === 'show' || action === 'view') {
            const id = rest[2] || 'INC-2026-001';
            const c = incidentStore.getCase(id);
            if (!c) {
              console.error(`${colors.yellow}Incident case "${id}" not found.${colors.reset}`);
              process.exit(1);
            }
            if (isJson) console.log(JSON.stringify(c, null, 2));
            else console.log(formatIncidentCase(c));
          } else if (action === 'create') {
            const title = rest.slice(2).join(' ') || 'Incident Triage Investigation';
            const newCase = incidentStore.createCase(title, 'P3-MEDIUM', 'Investigative Review', {});
            if (isJson) console.log(JSON.stringify(newCase, null, 2));
            else {
              console.log(`${colors.green}✔ Created new incident case ${newCase.id}:${colors.reset} ${newCase.title}`);
              console.log(formatIncidentCase(newCase));
            }
          }
        } else if (sub === 'sources') {
          const action = rest[1]?.toLowerCase();
          if (!action || action === 'list') {
            const sources = await listTelemetrySources();
            if (isJson) console.log(JSON.stringify(sources, null, 2));
            else console.log(formatTelemetrySources(sources));
          } else if (action === 'check') {
            const srcId = rest[2];
            if (!srcId) {
              console.error(`${colors.yellow}Usage: dualsurf blue sources check <source-id>${colors.reset}`);
              process.exit(1);
            }
            try {
              const src = await checkTelemetrySource(srcId);
              if (isJson) console.log(JSON.stringify(src, null, 2));
              else {
                console.log(`\n${colors.bold}${colors.cyan}TELEMETRY SOURCE PREFLIGHT CHECK:${colors.reset} ${src.name}`);
                console.log(`  Source ID:    ${src.id}`);
                console.log(`  Endpoint:     ${src.pathOrEndpoint}`);
                console.log(`  Connected:    ${src.connected ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
                console.log(`  Status:       ${src.status === 'ACTIVE' ? colors.green + src.status : colors.yellow + src.status}${colors.reset}`);
                if (src.eventsCount !== undefined) console.log(`  Total Events: ${src.eventsCount.toLocaleString()}`);
                if (src.lastEventTime) console.log(`  Latest Event: ${src.lastEventTime}`);
                console.log('');
              }
            } catch (err: any) {
              console.error(`${colors.red}Check failed: ${err.message}${colors.reset}`);
              process.exit(1);
            }
          }
        } else if (sub === 'logs') {
          const action = rest[1]?.toLowerCase();
          if (action === 'sources' || !action) {
            const sources = await listTelemetrySources();
            if (isJson) console.log(JSON.stringify(sources, null, 2));
            else console.log(formatTelemetrySources(sources));
          } else if (action === 'query') {
            const srcId = rest[2];
            if (!srcId) {
              console.error(`${colors.yellow}Usage: dualsurf blue logs query <source-id> [--since <duration>] [--limit <n>]${colors.reset}`);
              process.exit(1);
            }
            const sinceIdx = rest.indexOf('--since');
            const since = sinceIdx !== -1 ? rest[sinceIdx + 1] : '24h';
            const limitIdx = rest.indexOf('--limit');
            const limit = limitIdx !== -1 ? parseInt(rest[limitIdx + 1], 10) : 25;
            try {
              const result = await queryTelemetry(srcId, { since, limit });
              if (isJson) console.log(JSON.stringify(result, null, 2));
              else console.log(formatTelemetryEvents(result.events, result.source, result.evidence.id));
            } catch (err: any) {
              console.error(`${colors.red}Log query error: ${err.message}${colors.reset}`);
              process.exit(1);
            }
          }
        } else if (sub === 'hunt') {
          const action = rest[1]?.toLowerCase();
          if (!action || action === 'list') {
            const hunts = listThreatHunts();
            if (isJson) console.log(JSON.stringify(hunts, null, 2));
            else console.log(formatThreatHuntsList(hunts));
          } else if (action === 'run') {
            const huntId = rest[2] || 'HUNT-001';
            const srcId = rest[3];
            try {
              const res = await runThreatHunt(huntId, srcId);
              if (isJson) console.log(JSON.stringify(res, null, 2));
              else console.log(formatThreatHuntResult(res));
            } catch (err: any) {
              console.error(`${colors.red}Threat hunt failed: ${err.message}${colors.reset}`);
              process.exit(1);
            }
          } else {
            const query = rest.slice(1).join(' ');
            const { huntThreats, formatThreatHuntReport } = await import('./tools/blueTeam.js');
            const findings = huntThreats(query || 'telemetry-stream');
            if (isJson) console.log(JSON.stringify(findings, null, 2));
            else console.log(formatThreatHuntReport(findings));
          }
        } else if (sub === 'report') {
          const caseId = rest[1] || 'INC-2026-0001';
          const format = rest.includes('--json') || isJson ? 'json' : 'markdown';
          try {
            const res = generateBlueTeamReport(caseId, format);
            if (format === 'json') {
              console.log(res.reportContent);
            } else {
              console.log(`${colors.green}✔ Generated Blue Team Investigation Report:${colors.reset} ${res.filePath}\n`);
              console.log(res.reportContent);
            }
          } catch (err: any) {
            console.error(`${colors.red}Report generation error: ${err.message}${colors.reset}`);
            process.exit(1);
          }
        } else if (sub === 'response') {
          const act = rest[1]?.toLowerCase() === 'preview' ? (rest[2] || 'isolate-host') : (rest[1] || 'isolate-host');
          const target = (rest[1]?.toLowerCase() === 'preview' ? rest[3] : rest[2]) || '192.168.1.50';
          const prev = previewResponseAction(act, target);
          if (isJson) console.log(JSON.stringify(prev, null, 2));
          else {
            console.log(`\n${colors.bold}${colors.cyan}BLUE TEAM RESPONSE ACTION WORKFLOW (DRY-RUN / PREVIEW):${colors.reset}`);
            console.log(`  ${colors.bold}Action:${colors.reset}          ${prev.action}`);
            console.log(`  ${colors.bold}Target:${colors.reset}          ${prev.target}`);
            console.log(`  ${colors.bold}Proposed Cmd:${colors.reset}    ${prev.proposedCommand}`);
            console.log(`  ${colors.bold}Expected Impact:${colors.reset} ${colors.yellow}${prev.expectedImpact}${colors.reset}`);
            console.log(`  ${colors.bold}Status:${colors.reset}          ${colors.cyan}${prev.status}${colors.reset}`);
            console.log(`  ${colors.bold}Approval Gate:${colors.reset}   ${colors.red}REQUIRES EXPLICIT SOC LEAD APPROVAL BEFORE EXECUTION${colors.reset}\n`);
          }
        } else if (sub === 'exec' || sub === 'run') {
          const tool = rest[1] || 'siem';
          const target = rest[2] || '';
          const toolResult = await executeBlueTeamTool(tool, target, rest.slice(2));
          if (isJson) console.log(JSON.stringify(toolResult, null, 2));
          else console.log(toolResult.output);
        } else if (sub === 'roadmap' || sub === 'plan') {
          if (isJson) {
            const { BLUE_TEAM_LEARNING_ROADMAP } = await import('./tools/blueTeam.js');
            console.log(JSON.stringify(BLUE_TEAM_LEARNING_ROADMAP, null, 2));
          } else {
            console.log(formatBlueTeamRoadmap());
          }
        } else if (sub === 'domain' || !isNaN(parseInt(sub, 10))) {
          const domainId = sub === 'domain' ? parseInt(rest[1], 10) : parseInt(sub, 10);
          if (domainId >= 1 && domainId <= 13 && !rest[1]) {
            if (isJson) console.log(JSON.stringify(BLUE_TEAM_OPERATIONAL_PILLARS[domainId - 1], null, 2));
            else console.log(formatBlueTeamPillarDetail(domainId));
          } else {
            const domain = BLUE_TEAM_DOMAINS.find((d) => d.id === (domainId || 1));
            if (isJson) console.log(JSON.stringify(domain, null, 2));
            else console.log(formatBlueTeamDomainDetail(domainId || 1));
          }
        } else if (sub === 'spec' || sub === 'career') {
          const role = rest.slice(1).join(' ') || 'soc';
          console.log(getSpecializationGuide(role));
        } else {
          console.log(formatBlueTeamPillarsList());
        }
        break;
      }

      case 'checklist': {
        const { checklistManager } = await import('./tools/blueTeam.js');
        const sub = rest[0]?.toLowerCase();

        if (sub === 'check') {
          const id = parseInt(rest[1], 10);
          if (isNaN(id) || id < 1 || id > 30) {
            console.error(`${colors.yellow}Usage: dualsurf checklist check <1-30> [optional note]${colors.reset}`);
            process.exit(1);
          }
          const note = rest.slice(2).join(' ') || undefined;
          const updated = checklistManager.checkItem(id, note);
          if (isJson) console.log(JSON.stringify(updated, null, 2));
          else {
            console.log(`${colors.green}✔ Marked skill #${id} complete:${colors.reset} ${updated?.task}`);
            console.log(checklistManager.formatReport());
          }
        } else if (sub === 'uncheck') {
          const id = parseInt(rest[1], 10);
          if (isNaN(id) || id < 1 || id > 30) {
            console.error(`${colors.yellow}Usage: dualsurf checklist uncheck <1-30>${colors.reset}`);
            process.exit(1);
          }
          const updated = checklistManager.uncheckItem(id);
          if (isJson) console.log(JSON.stringify(updated, null, 2));
          else {
            console.log(`${colors.yellow}Skill #${id} marked incomplete:${colors.reset} ${updated?.task}`);
            console.log(checklistManager.formatReport());
          }
        } else if (sub === 'reset') {
          checklistManager.resetChecklist();
          if (isJson) console.log(JSON.stringify({ reset: true }));
          else {
            console.log(`${colors.yellow}Blue team master checklist reset to 0/30.${colors.reset}`);
            console.log(checklistManager.formatReport());
          }
        } else {
          if (isJson) console.log(JSON.stringify(checklistManager.getChecklist(), null, 2));
          else console.log(checklistManager.formatReport());
        }
        break;
      }

      case 'sigma': {
        const { generateSigmaRule, formatSigmaYaml, formatSigmaTranspileReport, transpileSigma } = await import('./tools/blueTeam.js');
        const sub = rest[0]?.toLowerCase();
        if (sub === 'transpile') {
          const target = rest.slice(1).join(' ') || 'sqli';
          const rule = generateSigmaRule(target);
          if (isJson) {
            console.log(JSON.stringify(transpileSigma(rule), null, 2));
          } else {
            console.log(formatSigmaTranspileReport(rule));
          }
          break;
        }

        const target = rest.join(' ') || 'sqli';
        const rule = generateSigmaRule(target);
        if (isJson) {
          console.log(JSON.stringify(rule, null, 2));
        } else {
          console.log(`\n${colors.bold}${colors.cyan}GENERATED PRODUCTION SIGMA DETECTION RULE:${colors.reset}`);
          console.log(`${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`);
          console.log(colors.green + formatSigmaYaml(rule) + colors.reset + '\n');
          console.log(`${colors.dim}Run "dualsurf sigma transpile ${target}" to convert into Splunk SPL, Elastic KQL, and Sentinel KQL.${colors.reset}\n`);
        }
        break;
      }

      case 'hunt': {
        const { huntThreats, formatThreatHuntReport } = await import('./tools/blueTeam.js');
        let telemetry = rest.join(' ');
        if (telemetry) {
          const fs = await import('fs');
          if (fs.existsSync(telemetry)) {
            telemetry = fs.readFileSync(telemetry, 'utf8');
          }
        } else {
          const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          telemetry = [meta.title, meta.url, meta.textSnippet || ''].join('\n');
        }
        const findings = huntThreats(telemetry);
        if (isJson) {
          console.log(JSON.stringify(findings, null, 2));
        } else {
          console.log(formatThreatHuntReport(findings));
        }
        break;
      }

      case 'yara': {
        const { generateYaraRule } = await import('./tools/blueTeam.js');
        const name = rest[0] || 'webshell';
        const patterns = rest.slice(1).length > 0 ? rest.slice(1) : ['c99.php', 'r57.php', 'eval(base64_decode'];
        const rule = generateYaraRule(name, patterns);
        if (isJson) {
          console.log(JSON.stringify({ ruleName: name, rule }));
        } else {
          console.log(`\n${colors.bold}${colors.cyan}GENERATED DEFENSIVE YARA RULE:${colors.reset}`);
          console.log(`${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`);
          console.log(colors.yellow + rule + colors.reset + '\n');
        }
        break;
      }

      case 'red':
      case 'red-team': {
        const {
          formatRedTeamDomainList,
          formatRedTeamDomainDetail,
          getRedSpecializationGuide,
          getRedTeamStudyPlan,
          redChecklistManager,
          RED_TEAM_DOMAINS,
          RED_TEAM_7_PILLARS,
          formatRedTeamPillarsList,
          formatRedTeamPillarDetail,
          executeRedTeamTool,
          engagementStore,
          assessmentStore,
          findingStore,
          formatEngagementScope,
          formatPentestFinding,
          formatPentestReport,
          formatFindingPoc,
          retestFinding,
          generateRedTeamReport,
          formatAssessmentList,
          formatAssessmentDetail,
          formatScopeValidation,
        } = await import('./tools/redTeam.js');

        const { detectHostRedTeamTools, formatRedToolDetectionReport, getRedToolInfoGuidance } = await import('./tools/executionEngine.js');
        const { auditRedTeamTools, formatRedTeamToolsAudit } = await import('./tools/shellExecutor.js');
        const { evidenceStore, formatEvidenceList, formatEvidenceDetail } = await import('./tools/evidenceStore.js');

        const sub = rest[0]?.toLowerCase();

        if (sub === 'status') {
          const detected = await detectHostRedTeamTools();
          const scopes = engagementStore.listScopes();
          const assessments = assessmentStore.listAssessments();
          const findings = findingStore.listFindings();
          const evidences = evidenceStore.listEvidence();

          const statusObj = {
            installedTools: detected.filter((t) => t.installed).length,
            missingTools: detected.filter((t) => !t.installed && t.status === 'NOT_INSTALLED').length,
            unsupportedTools: detected.filter((t) => t.status === 'UNSUPPORTED_OS').length,
            activeScopes: scopes.length,
            activeAssessments: assessments.length,
            recordedFindings: findings.length,
            evidenceRecords: evidences.length,
            host: os.hostname(),
            platform: process.platform,
          };

          if (isJson) {
            console.log(JSON.stringify(statusObj, null, 2));
          } else {
            console.log(`\n${colors.bold}${colors.red}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
            console.log(`${colors.bold}${colors.red}║              DUALSURF RED TEAM OPERATIONS STATUS                   ║${colors.reset}`);
            console.log(`${colors.bold}${colors.red}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
            console.log(`  ${colors.bold}Host System:${colors.reset}          ${statusObj.host} (${statusObj.platform})`);
            console.log(`  ${colors.bold}Installed Tools:${colors.reset}      ${colors.green}${statusObj.installedTools} Active in PATH${colors.reset}`);
            console.log(`  ${colors.bold}Missing Tools:${colors.reset}        ${colors.yellow}${statusObj.missingTools} Not in PATH${colors.reset}`);
            console.log(`  ${colors.bold}Active Scopes (RoE):${colors.reset}  ${colors.cyan}${statusObj.activeScopes} Configured${colors.reset}`);
            console.log(`  ${colors.bold}Assessments:${colors.reset}          ${colors.cyan}${statusObj.activeAssessments} Active${colors.reset}`);
            console.log(`  ${colors.bold}Pentest Findings:${colors.reset}     ${colors.yellow}${statusObj.recordedFindings} Documented${colors.reset}`);
            console.log(`  ${colors.bold}Evidence Records:${colors.reset}     ${colors.green}${statusObj.evidenceRecords} Stored with SHA-256 integrity${colors.reset}`);
            console.log(`\n  ${colors.dim}Run "dualsurf red tools check" or "dualsurf red scope list" for details.${colors.reset}\n`);
          }
        } else if (sub === 'scope' || sub === 'roe') {
          const action = rest[1]?.toLowerCase();
          if (!action || action === 'list') {
            const scopes = engagementStore.listScopes();
            if (isJson) console.log(JSON.stringify(scopes, null, 2));
            else {
              console.log(`\n${colors.bold}${colors.red}RULES OF ENGAGEMENT (ROE) SCOPES (${scopes.length}):${colors.reset}`);
              scopes.forEach((s) => console.log(formatEngagementScope(s) + '\n'));
            }
          } else if (action === 'show' || action === 'view') {
            const id = rest[2] || engagementStore.listScopes()[0]?.id || 'ROE-2026-001';
            const s = engagementStore.getScope(id);
            if (isJson) console.log(JSON.stringify(s || null, null, 2));
            else if (!s) console.log(`${colors.yellow}Scope "${id}" not found.${colors.reset}`);
            else console.log(formatEngagementScope(s));
          } else if (action === 'validate' || action === 'check') {
            const scopeId = rest[2] || engagementStore.listScopes()[0]?.id || 'ROE-2026-001';
            let targetIdx = rest.indexOf('--target');
            let target = targetIdx !== -1 && rest[targetIdx + 1] ? rest[targetIdx + 1] : (rest[2]?.startsWith('ROE-') ? rest[3] : rest[2]);
            if (!target) target = '127.0.0.1';

            const validation = engagementStore.validateTargetScope(scopeId, target);
            if (isJson) console.log(JSON.stringify(validation, null, 2));
            else console.log(formatScopeValidation(validation));
          } else if (action === 'create' || action === 'new') {
            const name = rest[2] || 'Client Assessment Scope';
            const newScope = engagementStore.createScope({
              name,
              clientName: name,
              targetDomains: ['localhost', '127.0.0.1', 'target.internal'],
              targetIpRanges: ['10.0.0.0/24', '192.168.1.0/24', '127.0.0.1'],
              exclusions: ['payment.target.internal', '192.168.1.1'],
            });
            if (isJson) console.log(JSON.stringify(newScope, null, 2));
            else {
              console.log(`${colors.green}✔ Created new engagement scope [${newScope.id}]:${colors.reset}`);
              console.log(formatEngagementScope(newScope));
            }
          } else {
            console.log(`${colors.yellow}Usage: dualsurf red scope [list | show <id> | validate <id> --target <target> | create <name>]${colors.reset}`);
          }
        } else if (sub === 'tools') {
          const action = rest[1]?.toLowerCase();
          if (action === 'check') {
            const detected = await detectHostRedTeamTools();
            if (isJson) console.log(JSON.stringify(detected, null, 2));
            else console.log(formatRedToolDetectionReport(detected));
          } else if (action === 'info') {
            const toolId = rest[2] || 'nmap';
            const detected = await detectHostRedTeamTools();
            const det = detected.find((t) => t.toolId.toLowerCase() === toolId.toLowerCase());
            console.log(getRedToolInfoGuidance(toolId, det));
          } else {
            if (isJson) console.log(JSON.stringify(auditRedTeamTools(), null, 2));
            else console.log(formatRedTeamToolsAudit());
          }
        } else if (sub === 'assessment' || sub === 'assess') {
          const action = rest[1]?.toLowerCase();
          if (!action || action === 'list') {
            const assessments = assessmentStore.listAssessments();
            if (isJson) console.log(JSON.stringify(assessments, null, 2));
            else console.log(formatAssessmentList(assessments));
          } else if (action === 'show' || action === 'view') {
            const id = rest[2] || assessmentStore.listAssessments()[0]?.id || 'ASSESS-2026-001';
            const a = assessmentStore.getAssessment(id);
            if (!a) {
              console.log(`${colors.yellow}Assessment "${id}" not found.${colors.reset}`);
            } else if (isJson) {
              console.log(JSON.stringify(a, null, 2));
            } else {
              console.log(formatAssessmentDetail(a));
            }
          } else if (action === 'create') {
            const name = rest.slice(2).join(' ') || 'Production Web & Network Assessment';
            const scopeId = engagementStore.listScopes()[0]?.id || 'ROE-2026-001';
            const newAssess = assessmentStore.createAssessment({
              name,
              clientOrLab: 'Authorized Lab Assessment',
              scopeId,
              environment: 'lab',
            });
            if (isJson) console.log(JSON.stringify(newAssess, null, 2));
            else {
              console.log(`${colors.green}✔ Created new assessment [${newAssess.id}]:${colors.reset}`);
              console.log(formatAssessmentDetail(newAssess));
            }
          } else {
            console.log(`${colors.yellow}Usage: dualsurf red assessment [list | show <id> | create <name>]${colors.reset}`);
          }
        } else if (sub === 'recon' || sub === 'network' || sub === 'web') {
          const action = rest[1]?.toLowerCase();
          let targetIdx = rest.indexOf('--target');
          let target = targetIdx !== -1 && rest[targetIdx + 1] ? rest[targetIdx + 1] : rest[2];
          if (!target) target = '127.0.0.1';

          const toolToRun = sub === 'recon' ? 'osint' : sub === 'network' ? 'nmap' : 'zap';
          const toolResult = await executeRedTeamTool(toolToRun, target, rest.slice(2));
          if (isJson) console.log(JSON.stringify(toolResult, null, 2));
          else console.log(toolResult.output);
        } else if (sub === 'findings') {
          const action = rest[1]?.toLowerCase();
          if (!action || action === 'list') {
            const findings = findingStore.listFindings();
            if (isJson) console.log(JSON.stringify(findings, null, 2));
            else console.log(formatPentestReport(findings));
          } else if (action === 'show' || action === 'view') {
            const id = rest[2] || findingStore.listFindings()[0]?.id || 'FIND-2026-001';
            const f = findingStore.getFinding(id);
            if (!f) console.log(`${colors.yellow}Finding "${id}" not found.${colors.reset}`);
            else if (isJson) console.log(JSON.stringify(f, null, 2));
            else console.log(formatPentestFinding(f));
          } else if (action === 'poc') {
            const id = rest[2] || findingStore.listFindings()[0]?.id || 'FIND-2026-001';
            const f = findingStore.getFinding(id);
            if (!f) console.log(`${colors.yellow}Finding "${id}" not found.${colors.reset}`);
            else if (isJson) console.log(JSON.stringify({ id: f.id, curlPoc: f.curlPoc }, null, 2));
            else console.log(formatFindingPoc(f));
          } else if (action === 'verify' || action === 'retest') {
            const id = rest[2] || findingStore.listFindings()[0]?.id || 'FIND-2026-001';
            const result = await retestFinding(id);
            if (isJson) console.log(JSON.stringify(result, null, 2));
            else {
              console.log(`${colors.green}✔ Retested finding ${id}:${colors.reset} Status: ${result.newStatus}`);
              console.log(`  Evidence: ${result.verificationEvidence}`);
            }
          } else {
            console.log(`${colors.yellow}Usage: dualsurf red findings [list | show <id> | poc <id> | verify <id>]${colors.reset}`);
          }
        } else if (sub === 'evidence') {
          const action = rest[1]?.toLowerCase();
          if (!action || action === 'list') {
            const records = evidenceStore.listEvidence();
            if (isJson) console.log(JSON.stringify(records, null, 2));
            else console.log(formatEvidenceList(records));
          } else if (action === 'show' || action === 'view') {
            const id = rest[2];
            if (!id) {
              console.error(`${colors.yellow}Usage: dualsurf red evidence show <EVD-ID>${colors.reset}`);
              process.exit(1);
            }
            const rec = evidenceStore.getEvidence(id);
            if (!rec) {
              console.error(`${colors.red}Evidence record "${id}" not found.${colors.reset}`);
              process.exit(1);
            }
            if (isJson) console.log(JSON.stringify(rec, null, 2));
            else console.log(formatEvidenceDetail(rec));
          } else if (action === 'export') {
            const id = rest[2];
            const format = (rest[3]?.toLowerCase() === 'raw' ? 'raw' : 'json') as 'json' | 'raw';
            if (!id) {
              console.error(`${colors.yellow}Usage: dualsurf red evidence export <EVD-ID> [raw|json]${colors.reset}`);
              process.exit(1);
            }
            try {
              console.log(evidenceStore.exportEvidence(id, format));
            } catch (err: any) {
              console.error(`${colors.red}${err.message}${colors.reset}`);
              process.exit(1);
            }
          }
        } else if (sub === 'report') {
          let assessId: string | undefined = rest[1];
          let formatStr = 'markdown';
          let outFile: string | undefined = undefined;

          for (let i = 1; i < rest.length; i++) {
            if (rest[i] === '--format' && rest[i + 1]) {
              formatStr = rest[i + 1].toLowerCase();
              i++;
            } else if ((rest[i] === '--out' || rest[i] === '-o') && rest[i + 1]) {
              outFile = rest[i + 1];
              i++;
            } else if (!rest[i].startsWith('-')) {
              if (['markdown', 'md', 'html', 'json', 'burp', 'zap'].includes(rest[i].toLowerCase())) {
                formatStr = rest[i].toLowerCase();
              } else if (!assessId) {
                assessId = rest[i];
              }
            }
          }

          if (assessId && (assessId.startsWith('--') || ['markdown', 'html', 'json', 'burp', 'zap'].includes(assessId.toLowerCase()))) {
            assessId = undefined;
          }

          let finalFormat: 'markdown' | 'json' | 'html' | 'burp' | 'zap' = 'markdown';
          if (formatStr === 'html') finalFormat = 'html';
          else if (formatStr === 'json') finalFormat = 'json';
          else if (formatStr === 'burp' || formatStr === 'burpsuite') finalFormat = 'burp';
          else if (formatStr === 'zap' || formatStr === 'zaproxy') finalFormat = 'zap';

          const reportContent = generateRedTeamReport(assessId, finalFormat);

          if (outFile) {
            const fs = await import('fs');
            const path = await import('path');
            const targetPath = path.resolve(process.cwd(), outFile);
            fs.writeFileSync(targetPath, reportContent, 'utf8');
            console.log(`${colors.green}✔ Exported ${finalFormat.toUpperCase()} report (${Buffer.byteLength(reportContent)} bytes) to:${colors.reset} ${targetPath}`);
          } else {
            console.log(reportContent);
          }
        } else if (sub === 'help') {
          console.log(`\n${colors.bold}${colors.red}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
          console.log(`${colors.bold}${colors.red}║              DUALSURF RED TEAM OPERATIONS CLI REFERENCE                      ║${colors.reset}`);
          console.log(`${colors.bold}${colors.red}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}`);
          console.log(`  dualsurf red status                          View host tool counts, scopes, and findings`);
          console.log(`  dualsurf red scope list                      List authorized Rules of Engagement scopes`);
          console.log(`  dualsurf red scope show <scope-id>           Inspect scope boundaries and exclusions`);
          console.log(`  dualsurf red scope validate <id> --target <t> Validate target against scope backend`);
          console.log(`  dualsurf red tools check                     Discover installed offensive tools in PATH`);
          console.log(`  dualsurf red tools info <tool-id>            Installation guidance and documentation URL`);
          console.log(`  dualsurf red assessment list                 View active penetration testing assessments`);
          console.log(`  dualsurf red assessment show <id>            Inspect assessment scope and execution log`);
          console.log(`  dualsurf red execute <tool> [target]         Execute security tool within verified scope`);
          console.log(`  dualsurf red recon run <id> --target <t>     Execute reconnaissance within scope`);
          console.log(`  dualsurf red network run <id> --target <t>   Execute network service inventory`);
          console.log(`  dualsurf red web run <id> --target <url>     Execute web application assessment`);
          console.log(`  dualsurf red findings list                   List normalized pentest findings`);
          console.log(`  dualsurf red findings show <id>              View technical finding card and remediation`);
          console.log(`  dualsurf red findings poc <id>               Output copy-paste cURL reproduction PoC`);
          console.log(`  dualsurf red findings verify <id>            Retest and verify finding remediation`);
          console.log(`  dualsurf red evidence list                   List evidence records with SHA-256 hashes`);
          console.log(`  dualsurf red evidence show <id>              Inspect evidence provenance and raw output`);
          console.log(`  dualsurf red report <id> [--format burp|zap|html|json|md] [--out <file>] Compile report`);
          console.log(`  dualsurf red pillars                         View 7 Core Red Team Operational Pillars\n`);
        } else if (!sub || sub === 'pillars' || sub === '7') {
          if (isJson) console.log(JSON.stringify(RED_TEAM_7_PILLARS, null, 2));
          else console.log(formatRedTeamPillarsList());
        } else if (sub === 'pillar' || sub === 'p') {
          const pillarId = parseInt(rest[1], 10) || 1;
          const pillar = RED_TEAM_7_PILLARS.find((p) => p.id === pillarId) || RED_TEAM_7_PILLARS[0];
          if (isJson) console.log(JSON.stringify(pillar, null, 2));
          else console.log(formatRedTeamPillarDetail(pillarId));
        } else if (sub === 'roadmap' || sub === 'domains' || sub === 'list') {
          if (isJson) console.log(JSON.stringify(RED_TEAM_DOMAINS, null, 2));
          else console.log(formatRedTeamDomainList());
        } else if (sub === 'exec' || sub === 'run' || sub === 'execute') {
          const tool = rest[1] || 'osint';
          let target = '127.0.0.1';
          const targetIdx = rest.indexOf('--target');
          if (targetIdx !== -1 && rest[targetIdx + 1]) {
            target = rest[targetIdx + 1];
          } else if (rest[2] && !rest[2].startsWith('-')) {
            target = rest[2];
          }

          const toolArgs = rest.slice(2).filter((arg, idx) => {
            if (arg === '--target' || (idx > 0 && rest.slice(2)[idx - 1] === '--target')) return false;
            return true;
          });

          const toolResult = await executeRedTeamTool(tool, target, toolArgs);
          if (isJson) {
            console.log(JSON.stringify(toolResult, null, 2));
          } else {
            console.log(toolResult.output);
          }

          if (toolResult.status === 'ERROR') {
            process.exitCode = 1;
          }
        } else if (sub === 'domain' || !isNaN(parseInt(sub, 10))) {
          const domainId = sub === 'domain' ? parseInt(rest[1], 10) : parseInt(sub, 10);
          if (domainId >= 1 && domainId <= 7 && !rest[1]) {
            if (isJson) console.log(JSON.stringify(RED_TEAM_7_PILLARS[domainId - 1], null, 2));
            else console.log(formatRedTeamPillarDetail(domainId));
          } else {
            const domain = RED_TEAM_DOMAINS.find((d) => d.id === (domainId || 1));
            if (isJson) console.log(JSON.stringify(domain, null, 2));
            else console.log(formatRedTeamDomainDetail(domainId || 1));
          }
        } else if (sub === 'spec' || sub === 'career') {
          const role = rest.slice(1).join(' ') || 'web';
          console.log(getRedSpecializationGuide(role));
        } else if (sub === 'study' || sub === 'plan') {
          console.log(getRedTeamStudyPlan());
        } else if (sub === 'checklist') {
          if (isJson) console.log(JSON.stringify(redChecklistManager.getChecklist(), null, 2));
          else console.log(redChecklistManager.formatReport());
        } else if (sub === 'check') {
          const id = parseInt(rest[1], 10);
          if (isNaN(id) || id < 1 || id > 25) {
            console.error(`${colors.yellow}Usage: dualsurf red check <1-25> [optional notes]${colors.reset}`);
            process.exit(1);
          }
          const note = rest.slice(2).join(' ') || undefined;
          const updated = redChecklistManager.checkItem(id, note);
          if (isJson) console.log(JSON.stringify(updated, null, 2));
          else {
            console.log(`${colors.green}✔ Marked skill #${id} complete:${colors.reset} ${updated?.task}`);
            console.log(redChecklistManager.formatReport());
          }
        } else if (sub === 'uncheck') {
          const id = parseInt(rest[1], 10);
          if (isNaN(id) || id < 1 || id > 25) {
            console.error(`${colors.yellow}Usage: dualsurf red uncheck <1-25>${colors.reset}`);
            process.exit(1);
          }
          const updated = redChecklistManager.uncheckItem(id);
          if (isJson) console.log(JSON.stringify(updated, null, 2));
          else {
            console.log(`${colors.yellow}Skill #${id} marked incomplete:${colors.reset} ${updated?.task}`);
            console.log(redChecklistManager.formatReport());
          }
        } else if (sub === 'reset') {
          redChecklistManager.resetChecklist();
          if (isJson) console.log(JSON.stringify({ reset: true }));
          else {
            console.log(`${colors.yellow}Red team master checklist reset to 0/25.${colors.reset}`);
            console.log(redChecklistManager.formatReport());
          }
        } else if (!sub) {
          console.log(formatRedTeamPillarsList());
        } else {
          console.error(`\n${colors.red}✖ Error: Unknown Red Team command "${sub}".${colors.reset}\nRun "dualsurf red help" for available operational commands.\n`);
          process.exitCode = 1;
        }
        break;
      }

      case 'kali': {
        const {
          kaliRuntimeManager,
          KALI_METAPACKAGES,
          kaliLabManager,
          kaliCopilotEngine,
          formatKaliRuntimesReport,
          formatKaliMetapackagesReport,
          formatKaliLabsReport,
          formatCopilotProposal,
        } = await import('./tools/kaliManager.js');

        const sub = rest[0]?.toLowerCase();

        if (sub === 'runtimes' || sub === 'env' || sub === 'environments') {
          const runtimes = kaliRuntimeManager.probeAvailableRuntimes();
          const active = kaliRuntimeManager.getActiveRuntime();
          if (isJson) console.log(JSON.stringify({ active: active.id, runtimes }, null, 2));
          else console.log(formatKaliRuntimesReport(runtimes, active.id));
        } else if (sub === 'use' || sub === 'set') {
          const targetId = rest[1];
          if (!targetId) {
            console.error(`${colors.yellow}Usage: dualsurf kali use <runtime-id>${colors.reset}`);
            process.exit(1);
          }
          const success = kaliRuntimeManager.setActiveRuntime(targetId);
          if (success) {
            const active = kaliRuntimeManager.getActiveRuntime();
            console.log(`\n${colors.green}✔ Active Linux runtime switched to:${colors.reset} ${active.name} (${active.id})`);
          } else {
            console.error(`\n${colors.red}✖ Unknown runtime profile:${colors.reset} "${targetId}". Run "dualsurf kali runtimes" to list options.`);
            process.exit(1);
          }
        } else if (sub === 'metapackages' || sub === 'packages' || sub === 'tools') {
          if (isJson) console.log(JSON.stringify(KALI_METAPACKAGES, null, 2));
          else console.log(formatKaliMetapackagesReport(KALI_METAPACKAGES));
        } else if (sub === 'install') {
          const pkgName = rest[1];
          const found = KALI_METAPACKAGES.find((p) => p.name.toLowerCase() === pkgName?.toLowerCase());
          if (!found) {
            console.error(`${colors.yellow}Package "${pkgName}" not found. Run "dualsurf kali metapackages" to view registered packages.${colors.reset}`);
            process.exit(1);
          }
          console.log(`\n${colors.bold}${colors.cyan}KALI LINUX PACKAGE INSTALLATION GUIDANCE:${colors.reset}`);
          console.log(`  Package: ${found.name} (${found.title})`);
          console.log(`  Run in Kali shell:\n  ${colors.green}${found.installCommand}${colors.reset}\n`);
        } else if (sub === 'labs') {
          const labs = kaliLabManager.listLabs();
          if (isJson) console.log(JSON.stringify(labs, null, 2));
          else console.log(formatKaliLabsReport(labs));
        } else if (sub === 'copilot' || sub === 'ask') {
          const task = rest.slice(1).join(' ');
          if (!task) {
            console.error(`${colors.yellow}Usage: dualsurf kali copilot "<task description>" [--target <target>]${colors.reset}`);
            process.exit(1);
          }
          let target = '127.0.0.1';
          const tIdx = rest.indexOf('--target');
          if (tIdx !== -1 && rest[tIdx + 1]) target = rest[tIdx + 1];

          const proposal = kaliCopilotEngine.proposeCommand(task, target);
          if (isJson) console.log(JSON.stringify(proposal, null, 2));
          else console.log(formatCopilotProposal(proposal));
        } else {
          console.log(`\n${colors.bold}${colors.cyan}DUALSURF KALI LINUX OPERATIONS WORKSTATION${colors.reset}`);
          console.log(`${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`);
          console.log(`  dualsurf kali runtimes               Audit and list available Linux execution environments`);
          console.log(`  dualsurf kali use <runtime-id>       Switch active runtime (native-kali, wsl-kali, container-kali, host-local)`);
          console.log(`  dualsurf kali metapackages           Inspect official Kali Linux metapackage catalog`);
          console.log(`  dualsurf kali install <metapackage>  View verified installation instructions for Kali packages`);
          console.log(`  dualsurf kali labs                   List isolated test targets, lab profiles, and snapshots`);
          console.log(`  dualsurf kali copilot "<task>"       Generate an AI-assisted verified command preview and approval\n`);
        }
        break;
      }

      case 'osint':
      case 'nmap':
      case 'subfinder':
      case 'amass':
      case 'theharvester':
      case 'maltego':
      case 'dnsrecon':
      case 'findomain':
      case 'assetfinder':
      case 'dnsx':
      case 'httpx':
      case 'katana':
      case 'exiftool':
      case 'wireshark':
      case 'tshark':
      case 'tcpdump':
      case 'metasploit':
      case 'msfconsole':
      case 'nessus':
      case 'burp':
      case 'burpsuite':
      case 'zap':
      case 'zaproxy':
      case 'postman':
      case 'nuclei':
      case 'ffuf':
      case 'feroxbuster':
      case 'gobuster':
      case 'nikto':
      case 'whatweb':
      case 'arjun':
      case 'dalfox':
      case 'sqlmap':
      case 'bloodhound':
      case 'impacket':
      case 'netexec':
      case 'nxc':
      case 'enum4linux':
      case 'enum4linux-ng':
      case 'certipy':
      case 'hashcat':
      case 'john':
      case 'powershell':
      case 'pwsh':
      case 'prowler':
      case 'scoutsuite':
      case 'cloudsplaining':
      case 'steampipe':
      case 'trivy':
      case 'grype':
      case 'syft':
      case 'checkov':
      case 'terrascan':
      case 'kube-bench':
      case 'kubescape':
      case 'naabu':
      case 'rustscan':
      case 'masscan':
      case 'netcat':
      case 'retest': {
        const { executeRedTeamTool } = await import('./tools/redTeam.js');
        let target = rest[0];
        if (!target) {
          try {
            const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            if (meta?.url && meta.url !== 'about:blank' && !meta.url.startsWith('dualsurf://')) {
              target = meta.url;
            }
          } catch {}
        }
        const toolResult = await executeRedTeamTool(command, target, rest);
        if (isJson) {
          console.log(JSON.stringify(toolResult, null, 2));
        } else {
          console.log(toolResult.output);
        }
        break;
      }

      case 'edr':
      case 'sysmon':
      case 'sysinternals':
      case 'osquery':
      case 'velociraptor':
      case 'hayabusa':
      case 'chainsaw':
      case 'suricata':
      case 'zeek':
      case 'snort':
      case 'arkime':
      case 'volatility':
      case 'clamav':
      case 'ghidra':
      case 'dmarc':
      case 'spf':
      case 'emailsec': {
        const { executeBlueTeamTool } = await import('./tools/blueTeam.js');
        let target = rest[0];
        if (!target) {
          try {
            const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
            if (meta?.url && meta.url !== 'about:blank' && !meta.url.startsWith('dualsurf://')) {
              target = meta.url;
            }
          } catch {}
        }
        const toolResult = await executeBlueTeamTool(command, target, rest);
        if (isJson) {
          console.log(JSON.stringify(toolResult, null, 2));
        } else {
          console.log(toolResult.output);
        }
        break;
      }

      case 'roe':
      case 'scope': {
        const { engagementStore, formatEngagementScope } = await import('./tools/redTeam.js');
        const sub = rest[0]?.toLowerCase();

        if (!sub || sub === 'list') {
          const scopes = engagementStore.listScopes();
          if (isJson) console.log(JSON.stringify(scopes, null, 2));
          else {
            console.log(`\n${colors.bold}${colors.red}RULES OF ENGAGEMENT (ROE) SCOPES (${scopes.length}):${colors.reset}`);
            scopes.forEach((s) => console.log(formatEngagementScope(s) + '\n'));
          }
        } else if (sub === 'view') {
          const id = rest[1] || 'ROE-2026-001';
          const s = engagementStore.getScope(id);
          if (isJson) console.log(JSON.stringify(s || null, null, 2));
          else if (!s) console.log(`${colors.yellow}Engagement scope "${id}" not found.${colors.reset}`);
          else console.log(formatEngagementScope(s));
        } else if (sub === 'check') {
          const target = rest[1] || '';
          const scopeId = rest[2] || engagementStore.listScopes()[0]?.id || 'ROE-2026-001';
          if (!target) {
            console.error(`${colors.yellow}Usage: dualsurf roe check <domain|ip> [scopeId]${colors.reset}`);
            process.exit(1);
          }
          const res = engagementStore.isTargetInScope(scopeId, target);
          if (isJson) console.log(JSON.stringify(res, null, 2));
          else if (res.inScope) {
            console.log(`${colors.bold}${colors.green}✔ AUTHORIZED IN-SCOPE:${colors.reset} ${res.reason}`);
          } else {
            console.log(`${colors.bold}${colors.red}✖ UNAUTHORIZED / OUT OF SCOPE:${colors.reset} ${res.reason}`);
          }
        } else if (sub === 'new') {
          const clientName = rest.slice(1).join(' ') || 'New Engagement';
          const newScope = engagementStore.createScope({ clientName });
          if (isJson) console.log(JSON.stringify(newScope, null, 2));
          else {
            console.log(`${colors.green}✔ Created new scope [${newScope.id}]:${colors.reset}`);
            console.log(formatEngagementScope(newScope));
          }
        } else {
          console.log(`${colors.yellow}Usage: dualsurf roe [list | view <id> | check <target> [scopeId] | new <client>]${colors.reset}`);
        }
        break;
      }

      case 'finding':
      case 'findings':
      case 'pentest': {
        const { findingStore, formatPentestFinding, formatPentestReport } = await import('./tools/redTeam.js');
        const sub = rest[0]?.toLowerCase();

        if (!sub || sub === 'list') {
          const findings = findingStore.listFindings();
          if (isJson) console.log(JSON.stringify(findings, null, 2));
          else console.log(formatPentestReport(findings));
        } else if (sub === 'view') {
          const id = rest[1] || '';
          const f = findingStore.getFinding(id);
          if (isJson) console.log(JSON.stringify(f || null, null, 2));
          else if (!f) console.log(`${colors.yellow}Finding "${id}" not found.${colors.reset}`);
          else console.log(formatPentestFinding(f));
        } else if (sub === 'poc') {
          const id = rest[1] || '';
          const f = findingStore.getFinding(id);
          if (!f) {
            console.log(`${colors.yellow}Finding "${id}" not found. Run "dualsurf finding list" to see active IDs.${colors.reset}`);
          } else {
            const { formatFindingPoc } = await import('./tools/redTeam.js');
            if (isJson) {
              console.log(JSON.stringify({ id: f.id, curlPoc: f.curlPoc, cweId: f.cweId, reproductionSteps: f.reproductionSteps }, null, 2));
            } else {
              console.log(formatFindingPoc(f));
            }
          }
        } else if (sub === 'new') {
          const title = rest.slice(1).join(' ') || 'SQL Injection in Authenticated API';
          const newF = findingStore.createFinding({
            title,
            affectedAsset: 'https://app.target.internal/api/v1/user',
            severity: 'HIGH',
          });
          if (isJson) console.log(JSON.stringify(newF, null, 2));
          else {
            console.log(`${colors.green}✔ Logged pentest finding [${newF.id}] (CVSS ${newF.cvssScore}):${colors.reset}`);
            console.log(formatPentestFinding(newF));
          }
        } else if (sub === 'status') {
          const id = rest[1] || '';
          const status = (rest[2] || 'Remediated') as any;
          const updated = findingStore.updateStatus(id, status);
          if (isJson) console.log(JSON.stringify(updated || null, null, 2));
          else if (!updated) console.log(`${colors.yellow}Finding "${id}" not found.${colors.reset}`);
          else console.log(`${colors.green}✔ Finding [${updated.id}] status updated to: ${updated.status}${colors.reset}`);
        } else if (sub === 'export') {
          const { generateRedTeamReport, exportBurpSuiteXml, exportOwaspZapJson } = await import('./tools/redTeam.js');
          const formatArg = (rest.find((r) => ['burp', 'zap', 'json', 'md', 'html', 'markdown'].includes(r.toLowerCase())) || 'json').toLowerCase();
          const outIdx = rest.indexOf('--out');
          const outFile = outIdx !== -1 && rest[outIdx + 1] ? rest[outIdx + 1] : undefined;
          const findings = findingStore.listFindings();
          let output = '';
          if (formatArg === 'burp' || formatArg === 'xml') {
            output = exportBurpSuiteXml(findings);
          } else if (formatArg === 'zap') {
            output = exportOwaspZapJson(findings);
          } else {
            output = generateRedTeamReport(undefined, (formatArg === 'md' ? 'markdown' : formatArg) as any);
          }
          if (outFile) {
            const fs = await import('fs');
            const path = await import('path');
            const dest = path.isAbsolute(outFile) ? outFile : path.resolve(process.cwd(), outFile);
            fs.writeFileSync(dest, output, 'utf8');
            console.log(`${colors.green}✔ Exported ${findings.length} findings to (${formatArg.toUpperCase()}):${colors.reset} ${dest}`);
          } else {
            console.log(output);
          }
        } else {
          console.log(`${colors.yellow}Usage: dualsurf finding [list | view <id> | poc <id> | new <title> | status <id> <status> | export [burp|zap|json|md] [--out file]]${colors.reset}`);
        }
        break;
      }

      case 'purple':
      case 'purple-team':
      case 'emulation': {
        const {
          purpleTeamEngine,
          listPurpleEnvironments,
          checkPurpleEnvironment,
          listPurpleScenarios,
          getPurpleScenario,
          listDetectionRules,
          generatePurpleTeamReport,
          formatPurpleStatus,
          formatPurpleEnvironments,
          formatPurpleScenarios,
          formatPurpleScenarioDetail,
          formatPurpleAssessments,
          formatPurpleAssessmentDetail,
          formatPurpleExecutions,
          formatPurpleExecutionResult,
          formatPurpleDetections,
          formatPurpleHelp,
        } = await import('./tools/purpleTeam.js');

        const { evidenceStore, formatEvidenceDetail, formatEvidenceList } = await import('./tools/evidenceStore.js');

        const sub = rest[0]?.toLowerCase();
        const action = rest[1]?.toLowerCase();

        if (!sub || sub === 'status') {
          if (rest[1] && ['DETECTED', 'BLIND_SPOT', 'PARTIAL'].includes(rest[2]?.toUpperCase())) {
            const { purpleTeamStore } = await import('./tools/redTeam.js');
            const id = rest[1];
            const st = rest[2].toUpperCase() as any;
            const notes = rest.slice(3).join(' ') || undefined;
            const updated = purpleTeamStore.updateDetectionStatus(id, st, notes);
            if (isJson) console.log(JSON.stringify(updated || null, null, 2));
            else if (!updated) console.log(`${colors.yellow}Test case "${id}" not found.${colors.reset}`);
            else console.log(`${colors.green}✔ Purple team test [${updated.id}] detection status updated to: ${updated.detectionStatus}${colors.reset}`);
          } else {
            const statusReport = {
              status: 'Active',
              host: { platform: process.platform, release: os.release(), hostname: os.hostname() },
              environments: listPurpleEnvironments(),
              activeAssessment: purpleTeamEngine.listAssessments()[0] || null,
              catalogCount: listPurpleScenarios().length,
            };
            if (isJson) console.log(JSON.stringify(statusReport, null, 2));
            else console.log(formatPurpleStatus(purpleTeamEngine));
          }
        } else if (sub === 'environments' || sub === 'envs' || sub === 'env') {
          if (action === 'check') {
            const envId = rest[2] || 'env-local-win';
            try {
              const checked = checkPurpleEnvironment(envId);
              if (isJson) console.log(JSON.stringify(checked, null, 2));
              else {
                console.log(`\n${colors.bold}${colors.magenta}PURPLE TEAM ENVIRONMENT CHECK [${checked.id}]:${colors.reset}`);
                console.log(`  Name:        ${checked.name}`);
                console.log(`  Platform:    ${checked.platform}`);
                console.log(`  Available:   ${checked.isAvailable ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
                console.log(`  Assets:      ${checked.authorizedAssets.join(', ')}`);
                console.log(`  Sources:     ${checked.availableSources.join(', ')}`);
                console.log(`  Privilege:   ${checked.requiredPrivilege}`);
                console.log(`  Notes:       ${checked.notes}\n`);
              }
            } catch (err: any) {
              if (isJson) console.log(JSON.stringify({ error: err.message }, null, 2));
              else console.log(`${colors.red}Error: ${err.message}${colors.reset}`);
            }
          } else {
            const envs = listPurpleEnvironments();
            if (isJson) console.log(JSON.stringify(envs, null, 2));
            else console.log(formatPurpleEnvironments(envs));
          }
        } else if (sub === 'tests' || sub === 'catalog') {
          if (action === 'show' || action === 'view') {
            const testId = rest[2] || 'PT-WIN-01';
            const scenario = getPurpleScenario(testId);
            if (isJson) console.log(JSON.stringify(scenario || null, null, 2));
            else if (!scenario) console.log(`${colors.yellow}Test scenario "${testId}" not found in catalog.${colors.reset}`);
            else console.log(formatPurpleScenarioDetail(scenario));
          } else {
            const scenarios = listPurpleScenarios();
            if (isJson) console.log(JSON.stringify(scenarios, null, 2));
            else console.log(formatPurpleScenarios(scenarios));
          }
        } else if (sub === 'test') {
          if (action === 'validate') {
            const testId = rest[2] || 'PT-WIN-01';
            const sc = getPurpleScenario(testId);
            if (!sc) {
              if (isJson) console.log(JSON.stringify({ error: `Scenario "${testId}" not found.` }, null, 2));
              else console.log(`${colors.yellow}Scenario "${testId}" not found.${colors.reset}`);
            } else {
              const env = checkPurpleEnvironment(sc.environmentId);
              const valid = env.isAvailable;
              const result = {
                scenarioId: sc.id,
                name: sc.name,
                environment: env.id,
                platformMatch: env.platform === 'all' || env.platform === process.platform,
                requiredPrivilege: sc.requiredPermissions,
                prerequisitesSatisfied: valid,
                riskLevel: sc.riskLevel,
                telemetrySourcesAvailable: sc.expectedTelemetrySources,
              };
              if (isJson) console.log(JSON.stringify(result, null, 2));
              else {
                console.log(`\n${colors.bold}${colors.magenta}TEST SCENARIO PREREQUISITE VALIDATION: [${sc.id}]${colors.reset}`);
                console.log(`  Scenario:      ${sc.name}`);
                console.log(`  Environment:   ${env.name} (${env.id})`);
                console.log(`  Platform OK:   ${result.platformMatch ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
                console.log(`  Prerequisites: ${valid ? colors.green + 'SATISFIED' : colors.red + 'FAILED'}${colors.reset}`);
                console.log(`  Telemetry:     ${sc.expectedTelemetrySources.join(', ')}`);
                console.log(`  Risk Level:    ${sc.riskLevel}\n`);
              }
            }
          } else if (action === 'run') {
            const testId = rest[2] || 'PT-WIN-01';
            const envIndex = rest.indexOf('--environment');
            const customEnv = envIndex !== -1 ? rest[envIndex + 1] : undefined;
            try {
              if (!isJson) {
                console.log(`${colors.dim}Executing controlled validation scenario "${testId}"...${colors.reset}`);
              }
              const res = await purpleTeamEngine.runValidationTest(testId, {
                environmentId: customEnv,
                approvedBy: 'SOC Operator (CLI Authorized)',
              });
              if (isJson) console.log(JSON.stringify(res, null, 2));
              else console.log(formatPurpleExecutionResult(res));
            } catch (err: any) {
              if (isJson) console.log(JSON.stringify({ error: err.message }, null, 2));
              else console.log(`${colors.red}Execution Error: ${err.message}${colors.reset}`);
            }
          } else {
            console.log(`${colors.yellow}Usage: dualsurf purple test [validate <test-id> | run <test-id> [--environment <id>]]${colors.reset}`);
          }
        } else if (sub === 'assessment' || sub === 'campaign') {
          if (action === 'create' || action === 'new') {
            const title = rest.slice(2).join(' ') || 'Controlled Purple Team Validation Campaign';
            const created = purpleTeamEngine.createAssessment(title);
            if (isJson) console.log(JSON.stringify(created, null, 2));
            else {
              console.log(`${colors.green}✔ Created Purple Team Assessment:${colors.reset} ${colors.bold}${created.id}${colors.reset}`);
              console.log(formatPurpleAssessmentDetail(created));
            }
          } else if (action === 'show' || action === 'view') {
            const id = rest[2] || 'PTA-2026-0001';
            const a = purpleTeamEngine.getAssessment(id);
            if (isJson) console.log(JSON.stringify(a || null, null, 2));
            else if (!a) console.log(`${colors.yellow}Assessment "${id}" not found.${colors.reset}`);
            else console.log(formatPurpleAssessmentDetail(a));
          } else {
            const list = purpleTeamEngine.listAssessments();
            if (isJson) console.log(JSON.stringify(list, null, 2));
            else console.log(formatPurpleAssessments(list));
          }
        } else if (sub === 'executions' || sub === 'runs') {
          if (action === 'show' || action === 'view') {
            const execId = rest[2];
            if (!execId) {
              console.log(`${colors.yellow}Usage: dualsurf purple executions show <execution-id>${colors.reset}`);
            } else {
              const exec = purpleTeamEngine.getExecution(execId);
              if (isJson) console.log(JSON.stringify(exec || null, null, 2));
              else if (!exec) console.log(`${colors.yellow}Execution "${execId}" not found.${colors.reset}`);
              else console.log(formatPurpleExecutionResult(exec));
            }
          } else {
            const assessmentId = rest[1] && !rest[1].startsWith('--') && rest[1] !== 'list' ? rest[1] : undefined;
            const list = purpleTeamEngine.listExecutions(assessmentId);
            if (isJson) console.log(JSON.stringify(list, null, 2));
            else console.log(formatPurpleExecutions(list));
          }
        } else if (sub === 'detections' || sub === 'rules') {
          if (action === 'evaluate' || action === 'check') {
            const execId = rest[2];
            if (!execId) {
              console.log(`${colors.yellow}Usage: dualsurf purple detections evaluate <execution-id>${colors.reset}`);
            } else {
              try {
                const updated = purpleTeamEngine.evaluateExecutionDetection(execId);
                if (isJson) console.log(JSON.stringify(updated, null, 2));
                else {
                  console.log(`${colors.green}✔ Evaluated detection for execution ${execId}:${colors.reset}`);
                  console.log(formatPurpleExecutionResult(updated));
                }
              } catch (err: any) {
                if (isJson) console.log(JSON.stringify({ error: err.message }, null, 2));
                else console.log(`${colors.red}Evaluation Error: ${err.message}${colors.reset}`);
              }
            }
          } else {
            const rules = listDetectionRules();
            if (isJson) console.log(JSON.stringify(rules, null, 2));
            else console.log(formatPurpleDetections(rules));
          }
        } else if (sub === 'evidence') {
          if (action === 'show' || action === 'view') {
            const evId = rest[2];
            const ev = evId ? evidenceStore.getEvidence(evId) : undefined;
            if (isJson) console.log(JSON.stringify(ev || null, null, 2));
            else if (!ev) console.log(`${colors.yellow}Evidence record "${evId}" not found.${colors.reset}`);
            else console.log(formatEvidenceDetail(ev));
          } else {
            const allEv = evidenceStore.listEvidence();
            if (isJson) console.log(JSON.stringify(allEv, null, 2));
            else {
              console.log(`\n${colors.bold}${colors.magenta}IMMUTABLE EVIDENCE RECORDS (${allEv.length}):${colors.reset}`);
              allEv.forEach((e: any) => {
                console.log(`  • ${colors.bold}${e.id}${colors.reset} [${e.state}] Tool: ${e.toolName} | Hash: ${e.rawOutputSha256?.slice(0, 16) || 'N/A'}...`);
              });
              console.log(`\n${colors.dim}Run "dualsurf purple evidence show <id>" to view full record.${colors.reset}\n`);
            }
          }
        } else if (sub === 'report') {
          const assessmentId = rest[1] || 'PTA-2026-0001';
          const format = isJson ? 'json' : 'markdown';
          try {
            const res = generatePurpleTeamReport(assessmentId, format);
            if (isJson) {
              console.log(res.reportContent);
            } else {
              console.log(`${colors.green}✔ Purple Team Assessment Report generated successfully!${colors.reset}`);
              console.log(`  File: ${colors.bold}${res.filePath}${colors.reset}\n`);
              console.log(res.reportContent);
            }
          } catch (err: any) {
            if (isJson) console.log(JSON.stringify({ error: err.message }, null, 2));
            else console.log(`${colors.red}Report Error: ${err.message}${colors.reset}`);
          }
        } else if (sub === 'matrix' || sub === 'score' || sub === 'scorecard') {
          const { purpleTeamStore, formatPurpleTeamMatrix, calculatePurpleTeamScorecard, formatPurpleScorecard } = await import('./tools/redTeam.js');
          if (sub === 'matrix') {
            const tests = purpleTeamStore.listTestCases();
            if (isJson) console.log(JSON.stringify(tests, null, 2));
            else console.log(formatPurpleTeamMatrix(tests));
          } else {
            const scorecard = calculatePurpleTeamScorecard();
            if (isJson) console.log(JSON.stringify(scorecard, null, 2));
            else console.log(formatPurpleScorecard(scorecard));
          }
        } else if (sub === 'help' || sub === '--help' || sub === '-h') {
          console.log(formatPurpleHelp());
        } else {
          console.log(`${colors.yellow}Unknown purple command: "${sub}".${colors.reset}`);
          console.log(formatPurpleHelp());
        }
        break;
      }

      case 'headers': {
        let target = rest[0];
        if (!target) {
          try {
            if (await client.isControllerAvailable()) {
              const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              target = meta?.url;
            }
          } catch {}
        }
        if (!target) {
          console.error(`${colors.yellow}Usage: dualsurf headers <url>${colors.reset}`);
          process.exit(1);
        }
        const normalizedTarget = /^https?:\/\//i.test(target.trim()) ? target.trim() : `https://${target.trim()}`;
        const { analyzeSecurityHeaders, formatSecurityHeaders } = await import('./tools/recon.js');
        const res = await analyzeSecurityHeaders(normalizedTarget);
        if (isJson) {
          console.log(JSON.stringify(res, null, 2));
        } else {
          console.log(formatSecurityHeaders(res));
        }
        break;
      }

      case 'cookies': {
        const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const { formatCookies } = await import('./tools/recon.js');
        if (isJson) {
          console.log(JSON.stringify(meta.cookies || [], null, 2));
        } else {
          console.log(formatCookies(meta));
        }
        break;
      }

      case 'storage': {
        const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const { formatStorage } = await import('./tools/recon.js');
        if (isJson) {
          console.log(JSON.stringify(meta.storage || [], null, 2));
        } else {
          console.log(formatStorage(meta));
        }
        break;
      }

      case 'export': {
        const filename = rest[0] || 'audit-report.md';
        const meta = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const { analyzeSecurityHeaders, generateMarkdownReport, exportReportToFile } = await import('./tools/recon.js');
        let headers;
        try {
          headers = await analyzeSecurityHeaders(meta.url);
        } catch {
          // offline
        }
        const report = generateMarkdownReport(meta, headers);
        const fullPath = exportReportToFile(filename, report);
        if (isJson) {
          console.log(JSON.stringify({ exported: true, path: fullPath, sizeBytes: report.length }));
        } else {
          console.log(`${colors.green}✔ Target security audit report exported to:${colors.reset} ${colors.bold}${fullPath}${colors.reset}`);
        }
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
          console.log(`  ${colors.bold}Local AI:${colors.reset}     ${ollamaOk ? colors.green + '✓ Connected (127.0.0.1:11434)' : colors.yellow + '○ Offline'}${colors.reset}`);
          console.log(`  ${colors.bold}Privileges:${colors.reset}   Host execution enabled (sudo, Kali tools, interactive TTY)\n`);
        }
        break;
      }

      case 'proxy': {
        const sub = rest[0]?.toLowerCase();
        const action = rest[1]?.toLowerCase();

        if (!sub || sub === 'status') {
          let proxyStatus = {
            running: false,
            port: 8899,
            host: '127.0.0.1',
            totalRequestsHandled: 0,
            totalIntercepted: 0,
            activeBreakpoint: false,
          };
          try {
            if (await client.isControllerAvailable()) {
              proxyStatus = await client.sendCommand(IPC_COMMANDS.PROXY_GET_STATUS);
            }
          } catch {}

          if (isJson) {
            console.log(JSON.stringify(proxyStatus, null, 2));
          } else {
            console.log(`\n${colors.bold}${colors.red}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
            console.log(`${colors.bold}${colors.red}║       DUALSURF HTTP INTERCEPTION PROXY & TRAFFIC ENGINE            ║${colors.reset}`);
            console.log(`${colors.bold}${colors.red}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
            console.log(`  Proxy Server:      ${proxyStatus.running ? colors.green + `RUNNING (http://${proxyStatus.host}:${proxyStatus.port})` : colors.yellow + `STOPPED (Configured: ${proxyStatus.host}:${proxyStatus.port})`}${colors.reset}`);
            console.log(`  Breakpoint Mode:   ${proxyStatus.activeBreakpoint ? colors.red + colors.bold + 'ACTIVE (Holding in-flight requests)' : colors.dim + 'INACTIVE (Traffic forwarding automatically)'}${colors.reset}`);
            console.log(`  Total Handled:     ${proxyStatus.totalRequestsHandled} requests`);
            console.log(`  Total Intercepted: ${proxyStatus.totalIntercepted} held requests\n`);
            console.log(`${colors.dim}Commands: "proxy start [port]", "proxy stop", "proxy intercept <on|off>", "proxy rules", "proxy queue"${colors.reset}\n`);
          }
        } else if (sub === 'start') {
          const port = rest[1] ? parseInt(rest[1], 10) : 8899;
          const host = '127.0.0.1';
          let started = false;
          try {
            if (await client.isControllerAvailable()) {
              const res = await client.sendCommand(IPC_COMMANDS.PROXY_START, { port, host });
              started = res?.success || false;
            }
          } catch {}

          if (!started) {
            const { InterceptProxyEngine } = await import('@dualsurf/controller');
            const standaloneEngine = new InterceptProxyEngine();
            const res = await standaloneEngine.startProxyServer(port, host);
            started = res.success;
            if (started) {
              console.log(`${colors.green}✔ Standalone DualSurf loopback proxy listening at:${colors.reset} ${colors.bold}http://${host}:${port}${colors.reset}`);
              console.log(`${colors.dim}Configure browser or curl: curl -x http://${host}:${port} https://target.corp -k${colors.reset}`);
              console.log(`${colors.cyan}Press Ctrl+C to terminate proxy server.${colors.reset}`);
              await new Promise(() => {});
            } else {
              console.error(`${colors.red}Error starting proxy:${colors.reset} ${res.error}`);
            }
            break;
          }

          if (isJson) {
            console.log(JSON.stringify({ running: true, port, host }, null, 2));
          } else {
            console.log(`${colors.green}✔ DualSurf HTTP proxy started on:${colors.reset} ${colors.bold}http://${host}:${port}${colors.reset}`);
          }
        } else if (sub === 'stop') {
          try {
            if (await client.isControllerAvailable()) {
              await client.sendCommand(IPC_COMMANDS.PROXY_STOP);
              console.log(`${colors.yellow}DualSurf HTTP proxy stopped.${colors.reset}`);
            } else {
              console.log(`${colors.yellow}No active controller proxy running.${colors.reset}`);
            }
          } catch (err: any) {
            console.error(`${colors.red}Error stopping proxy:${colors.reset} ${err.message}`);
          }
        } else if (sub === 'intercept' || sub === 'breakpoint') {
          const targetState = action === 'on' ? true : action === 'off' ? false : undefined;
          try {
            if (await client.isControllerAvailable()) {
              const res = await client.sendCommand(IPC_COMMANDS.PROXY_TOGGLE_BREAKPOINT, { active: targetState });
              const newState = res?.isBreakpointActive;
              console.log(`${colors.green}✔ Breakpoint holding mode:${colors.reset} ${newState ? colors.red + colors.bold + 'ENABLED (Holding in-flight requests)' : colors.dim + 'DISABLED'}${colors.reset}`);
            } else {
              console.log(`${colors.yellow}[Notice] Start DualSurf desktop/controller to toggle active Electron session breakpoints.${colors.reset}`);
            }
          } catch (err: any) {
            console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
          }
        } else if (sub === 'rules') {
          let rules: any[] = [];
          try {
            if (await client.isControllerAvailable()) {
              rules = await client.sendCommand(IPC_COMMANDS.PROXY_GET_RULES);
            }
          } catch {}
          if (!rules || rules.length === 0) {
            const { InterceptProxyEngine } = await import('@dualsurf/controller');
            rules = new InterceptProxyEngine().getRules();
          }

          if (isJson) {
            console.log(JSON.stringify(rules, null, 2));
          } else {
            console.log(`\n${colors.bold}${colors.red}DUALSURF PROXY INTERCEPTION & TAMPERING RULES (${rules.length}):${colors.reset}`);
            console.log(`${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`);
            rules.forEach((r: any) => {
              const badge = r.enabled ? `${colors.green}[ENABLED] ${colors.reset}` : `${colors.dim}[DISABLED]${colors.reset}`;
              console.log(`  ${badge} ${colors.bold}${r.id}${colors.reset}: ${r.name} (${colors.cyan}${r.action}${colors.reset})`);
              if (r.modifications?.addHeaders) {
                console.log(`      ${colors.dim}Add Headers:${colors.reset} ${JSON.stringify(r.modifications.addHeaders)}`);
              }
              if (r.modifications?.removeHeaders) {
                console.log(`      ${colors.dim}Strip Headers:${colors.reset} ${r.modifications.removeHeaders.join(', ')}`);
              }
            });
            console.log('');
          }
        } else if (sub === 'queue' || sub === 'pending') {
          let pending: any[] = [];
          try {
            if (await client.isControllerAvailable()) {
              pending = await client.sendCommand(IPC_COMMANDS.PROXY_GET_PENDING);
            }
          } catch {}

          if (isJson) {
            console.log(JSON.stringify(pending, null, 2));
          } else {
            console.log(`\n${colors.bold}${colors.red}HELD IN-FLIGHT BREAKPOINT REQUESTS (${pending.length}):${colors.reset}`);
            console.log(`${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`);
            if (pending.length === 0) {
              console.log(`  ${colors.dim}No requests currently paused in breakpoint queue.${colors.reset}`);
            } else {
              pending.forEach((req: any) => {
                console.log(`  • [${colors.bold}${req.id}${colors.reset}] ${colors.yellow}${req.method}${colors.reset} ${req.url}`);
              });
            }
            console.log(`\n${colors.dim}Commands: "proxy forward <id>", "proxy drop <id>"${colors.reset}\n`);
          }
        } else if (sub === 'forward') {
          const id = rest[1];
          if (!id) {
            console.error(`${colors.yellow}Usage: dualsurf proxy forward <request-id>${colors.reset}`);
            process.exit(1);
          }
          try {
            const res = await client.sendCommand(IPC_COMMANDS.PROXY_FORWARD, { id });
            console.log(res?.forwarded ? `${colors.green}✔ Forwarded request ${id}.${colors.reset}` : `${colors.yellow}Request ${id} not found in queue.${colors.reset}`);
          } catch (err: any) {
            console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
          }
        } else if (sub === 'drop') {
          const id = rest[1];
          if (!id) {
            console.error(`${colors.yellow}Usage: dualsurf proxy drop <request-id>${colors.reset}`);
            process.exit(1);
          }
          try {
            const res = await client.sendCommand(IPC_COMMANDS.PROXY_DROP, { id });
            console.log(res?.dropped ? `${colors.red}✔ Dropped / aborted request ${id}.${colors.reset}` : `${colors.yellow}Request ${id} not found in queue.${colors.reset}`);
          } catch (err: any) {
            console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
          }
        } else {
          console.log(`${colors.yellow}Usage: dualsurf proxy [status | start [port] | stop | intercept <on|off> | rules | queue | forward <id> | drop <id>]${colors.reset}`);
        }
        break;
      }

      case 'repeater': {
        const sub = rest[0]?.toLowerCase();
        let targetUrl = rest[1] || '';
        if (sub !== 'send' && sub && !sub.startsWith('--')) {
          targetUrl = rest[0];
        }

        if (!targetUrl) {
          console.error(
            `${colors.yellow}Usage: dualsurf repeater send <url> [--method GET|POST|PUT|DELETE] [--header "Key: Value"] [--body "data"]${colors.reset}`
          );
          process.exit(1);
        }

        const normalizedUrl = /^https?:\/\//i.test(targetUrl.trim()) ? targetUrl.trim() : `https://${targetUrl.trim()}`;
        const methodIdx = rest.indexOf('--method');
        const method = (methodIdx !== -1 && rest[methodIdx + 1] ? rest[methodIdx + 1] : 'GET').toUpperCase();

        const headers: Record<string, string> = {};
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '--header' && rest[i + 1]) {
            const parts = rest[i + 1].split(':');
            if (parts.length >= 2) {
              const k = parts[0].trim();
              const v = parts.slice(1).join(':').trim();
              headers[k] = v;
            }
          }
        }

        const bodyIdx = rest.indexOf('--body');
        const body = bodyIdx !== -1 && rest[bodyIdx + 1] ? rest[bodyIdx + 1] : undefined;

        let response: any;
        const startTime = Date.now();
        try {
          if (await client.isControllerAvailable()) {
            response = await client.sendCommand(IPC_COMMANDS.REPEATER_SEND, {
              url: normalizedUrl,
              method,
              headers,
              body,
            });
          }
        } catch {}

        if (!response) {
          try {
            const resp = await fetch(normalizedUrl, {
              method,
              headers,
              body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
            });
            const latencyMs = Date.now() - startTime;
            const respHeaders: Record<string, string> = {};
            resp.headers.forEach((v, k) => {
              respHeaders[k] = v;
            });
            const bodyText = await resp.text();
            response = {
              success: true,
              status: resp.status,
              statusText: resp.statusText,
              headers: respHeaders,
              body: bodyText,
              latencyMs,
            };
          } catch (err: any) {
            response = {
              success: false,
              error: err.message,
              latencyMs: Date.now() - startTime,
            };
          }
        }

        if (isJson) {
          console.log(JSON.stringify(response, null, 2));
        } else {
          console.log(`\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
          console.log(`${colors.bold}${colors.cyan}║                 DUALSURF RAW HTTP REPEATER RESPONSE                ║${colors.reset}`);
          console.log(`${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`);
          console.log(`  Target URL:    ${colors.bold}${normalizedUrl}${colors.reset}`);
          console.log(`  Method:        ${colors.yellow}${method}${colors.reset}`);
          if (response.success) {
            const statusColor = response.status < 300 ? colors.green : response.status < 400 ? colors.cyan : colors.red;
            console.log(`  Status:        ${statusColor}${response.status} ${response.statusText}${colors.reset} (Latency: ${response.latencyMs}ms)`);
            console.log(`  Body Size:     ${response.body ? Buffer.byteLength(response.body, 'utf8') : 0} bytes`);

            console.log(`\n  ${colors.bold}Response Headers:${colors.reset}`);
            for (const [k, v] of Object.entries(response.headers || {})) {
              console.log(`    ${colors.dim}${k}:${colors.reset} ${v}`);
            }

            console.log(`\n  ${colors.bold}Response Body Preview:${colors.reset}`);
            const preview = (response.body || '').slice(0, 800);
            console.log(`  ${colors.green}${preview}${response.body && response.body.length > 800 ? '\n  ... [truncated]' : ''}${colors.reset}`);
          } else {
            console.log(`  Status:        ${colors.red}FAILED${colors.reset}`);
            console.log(`  Error:         ${colors.red}${response.error}${colors.reset}`);
          }

          const headerArgs = Object.entries(headers).map(([k, v]) => `-H "${k}: ${v}"`).join(' ');
          const dataArg = body ? `--data '${body.replace(/'/g, "'\\''")}'` : '';
          console.log(`\n  ${colors.bold}Reproducible cURL Command:${colors.reset}`);
          console.log(`  ${colors.yellow}curl -i -s -k -X ${method} "${normalizedUrl}" ${headerArgs} ${dataArg}${colors.reset}\n`);
        }
        break;
      }

      case 'offline': {
        console.log(`\n${colors.bold}${colors.cyan}DualSurf Offline Mode Capabilities:${colors.reset}`);
        console.log(`  ${colors.green}✓ Local Files:${colors.reset}    Open offline files with "dualsurf open file:///path/to/file.html" or "dualsurf open ./test.html"`);
        console.log(`  ${colors.green}✓ Local Labs:${colors.reset}     Connect directly to localhost, 127.0.0.1, 10.x.x.x, 192.168.x.x subnets`);
        console.log(`  ${colors.green}✓ Local AI:${colors.reset}       Ollama runs 100% offline at http://127.0.0.1:11434 with llama3.2:1b`);
        console.log(`  ${colors.green}✓ Shell Tools:${colors.reset}    Execute any local Kali/Unix tool with "dualsurf sh <cmd>" or "! <cmd>" in REPL`);
        console.log(`  ${colors.green}✓ Tool Audit:${colors.reset}     Run "dualsurf tools" to see available utilities on your system\n`);
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

${colors.bold}${colors.cyan}SEMANTIC & NAVIGATION COMMANDS:${colors.reset}
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

${colors.bold}${colors.cyan}WEB SECURITY & RECONNAISSANCE:${colors.reset}
  ${colors.bold}assess <url> [file] [--html] [--json]${colors.reset} Complete single-command security assessment: attack surface to vulnerability report
  ${colors.bold}scan <url> [file] [--html] [--json]${colors.reset} Automated end-to-end security audit pipeline with CVSS scoring & HTML/JSON reports
  ${colors.bold}scan diff <prev.json> <curr.json>${colors.reset}    Compare security scans to track vulnerability remediation deltas
  ${colors.bold}attack-surface / asm <domain>${colors.reset} Passive external asset discovery, CT subdomains, cloud buckets & takeovers
  ${colors.bold}dns <host>${colors.reset}                    Passive DNS records (A, AAAA, MX, TXT) and SPF/DMARC email security audit
  ${colors.bold}ports [scan] <target> [--profile <web|common|db|all>]${colors.reset} Automated network port audit & service perimeter scanner
  ${colors.bold}report <file.html|.md|.json>${colors.reset}         Open or display generated security assessment report
  ${colors.bold}recon / audit${colors.reset}                  Full target reconnaissance (correlate endpoints & headers)
  ${colors.bold}sec-audit / vuln${colors.reset}               Passive vulnerability & DOM hygiene audit (CSRF, tabnabbing, secrets, CSP)
  ${colors.bold}cert [host]${colors.reset}                    Inspect TLS/SSL certificate, expiration, SAN subdomains & cipher
  ${colors.bold}cors [url]${colors.reset}                     Analyze CORS policy, wildcard origin & credential reflection risks
  ${colors.bold}tech [url]${colors.reset}                     Fingerprint web server, frameworks, CMS, and CDN/WAF infrastructure
  ${colors.bold}secrets${colors.reset}                        Scan DOM snippet and client storage for leaked tokens and API keys
  ${colors.bold}headers [url]${colors.reset}                  Analyze HTTP response security headers
  ${colors.bold}cookies / storage${colors.reset}              Inspect session cookies and localStorage items
  ${colors.bold}export [file]${colors.reset}                  Export full security & DOM audit report to Markdown
  ${colors.bold}status${colors.reset}                         Display full session status, active user & local AI

${colors.bold}${colors.blue}BLUE TEAM & DEFENSIVE SECURITY (SOC / SIEM / DFIR / IR / SOAR):${colors.reset}
  ${colors.bold}siem [file]${colors.reset}                    Ingest and parse security logs (auth, web access, syslog) for attacks
  ${colors.bold}ioc [text/url]${colors.reset}                 Extract, defang & triage indicators of compromise (IP, domain, hash)
  ${colors.bold}case [new/view/list]${colors.reset}           Manage incident response tickets & generate containment playbooks
  ${colors.bold}hash <file>${colors.reset}                    Compute SHA-256/SHA-1/MD5 forensic evidence hashes for chain of custody
  ${colors.bold}soar [target]${colors.reset}                  Execute automated triage, enrichment, and response recommendation playbook
  ${colors.bold}mitre [activity]${colors.reset}               Map observed behaviors and threats to MITRE ATT&CK tactics & techniques

${colors.bold}${colors.red}HTTP INTERCEPTION PROXY & REPEATER:${colors.reset}
  ${colors.bold}dualsurf proxy [status]${colors.reset}            Display local proxy server status (127.0.0.1:8899) and breakpoint state
  ${colors.bold}dualsurf proxy start [port]${colors.reset}        Start local loopback interception proxy server
  ${colors.bold}dualsurf proxy stop${colors.reset}                Stop local loopback proxy server
  ${colors.bold}dualsurf proxy intercept <on|off>${colors.reset}  Toggle in-flight breakpoint request holding
  ${colors.bold}dualsurf proxy rules${colors.reset}               List active request modification and header injection rules
  ${colors.bold}dualsurf proxy queue${colors.reset}               Inspect held requests in breakpoint queue
  ${colors.bold}dualsurf proxy forward <id>${colors.reset}        Forward intercepted request to target server
  ${colors.bold}dualsurf proxy drop <id>${colors.reset}           Drop / cancel intercepted request
  ${colors.bold}dualsurf repeater send <url>${colors.reset}        Dispatch raw HTTP/S request with latency and status inspection

${colors.bold}${colors.red}RED TEAM & OFFENSIVE OPERATIONS (PENTEST / SCOPE / ADVERSARY EMULATION):${colors.reset}
  ${colors.bold}dualsurf red [domain <n>]${colors.reset}       Browse complete 32-domain Red Team roadmap & syllabus
  ${colors.bold}dualsurf red spec <role>${colors.reset}        Explore offensive career pathways (web, network, ad, cloud, exploit)
  ${colors.bold}dualsurf red study${colors.reset}             6-Month Accelerated Red Team study plan
  ${colors.bold}dualsurf red checklist${colors.reset}         Interactive 25-task Red Team skills master checklist (0/25)
  ${colors.bold}dualsurf roe [list|check]${colors.reset}       Rules of Engagement scope manager: verify authorized targets
  ${colors.bold}dualsurf finding [list|view]${colors.reset}    Manage penetration testing findings & CVSS v3.1 reports
  ${colors.bold}dualsurf finding export [burp|zap|json]${colors.reset} Export findings to Burp Suite XML or OWASP ZAP format
  ${colors.bold}dualsurf purple [matrix|view]${colors.reset}   Collaborative purple team adversary emulation & detection matrix

${colors.bold}${colors.cyan}TAB MANAGEMENT & DATA:${colors.reset}
  ${colors.bold}tabs${colors.reset}                           List all open tabs
  ${colors.bold}tab <number | "name">${colors.reset}         Switch to tab by index OR tab name keyword
  ${colors.bold}tab new [url]${colors.reset}                  Create a new tab
  ${colors.bold}tab close [number]${colors.reset}             Close a tab
  ${colors.bold}bookmarks${colors.reset}                      List saved bookmarks
  ${colors.bold}bookmark add [url]${colors.reset}             Save a bookmark
  ${colors.bold}bookmark rm <id>${colors.reset}               Remove a bookmark
  ${colors.bold}history [--search Q]${colors.reset}           Display or search browsing history
  ${colors.bold}downloads${colors.reset}                      List recent download activity
  ${colors.bold}gui${colors.reset}                            Launch / show graphical browser window
  ${colors.bold}clear-data${colors.reset}                     Clear history and cached data
  ${colors.bold}shutdown${colors.reset}                       Stop background browser engine
  ${colors.bold}settings${colors.reset}                       View browser preferences
  ${colors.bold}help${colors.reset}                           Show this help message

${colors.bold}${colors.yellow}SYSTEM TOOLS & OFFLINE:${colors.reset}
  ${colors.bold}sudo <cmd> / sudo su${colors.reset}          Execute command with elevated/root privileges or enter root shell
  ${colors.bold}sh <cmd> / exec <cmd>${colors.reset}         Execute local terminal/Kali command (e.g. nmap, curl, ping)
  ${colors.bold}tools${colors.reset}                          Audit installed security, network, and Kali utilities
  ${colors.bold}offline${colors.reset}                        Display offline capabilities and diagnostics

${colors.bold}OPTIONS:${colors.reset}
  ${colors.bold}--json${colors.reset}                         Output results in structured JSON format
`);
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
