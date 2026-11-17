import { IPC_COMMANDS } from '@dualsurf/ipc-protocol';
import type { BrowserControllerState, PageMetadata, TabState } from '@dualsurf/shared-types';
import type { IpcClient } from '../IpcClient.js';
import type { OllamaTool } from '../ollama/OllamaClient.js';
import { findBestMatchingLink, findBestMatchingTab } from '../semantic/fuzzyMatcher.js';

export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  message: string;
  data?: any;
}

export function normalizeToolArgs(rawArgs: any): Record<string, any> {
  if (!rawArgs) return {};
  let parsed = rawArgs;
  if (typeof rawArgs === 'string') {
    try {
      parsed = JSON.parse(rawArgs);
    } catch {
      return {};
    }
  }
  if (parsed && typeof parsed === 'object') {
    if (parsed.properties && typeof parsed.properties === 'object' && !parsed.url && !parsed.query) {
      return parsed.properties;
    }
    if (parsed.arguments) {
      return normalizeToolArgs(parsed.arguments);
    }
    return parsed;
  }
  return {};
}

/**
 * Ollama tool definitions for browser operations.
 */
export const BROWSER_TOOL_DEFINITIONS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate the active tab to a URL or domain (e.g. "https://github.com" or "news.ycombinator.com")',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The destination URL or web domain' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web using the default search engine (DuckDuckGo/Google)',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords or question' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click_link_by_text',
      description: 'Click a link or button on the current page matching its text label or keyword (e.g. "Pricing", "Documentation", "Login")',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Label, button text, or keyword of the link to click' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click_link',
      description: 'Click an actionable link by its numeric link ID on the current page',
      parameters: {
        type: 'object',
        properties: {
          link_id: { type: 'number', description: 'The numeric identifier of the link' },
        },
        required: ['link_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_content',
      description: 'Inspect the current page to read its title, URL, headings, readable text snippet, and actionable links',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tabs',
      description: 'List all open browser tabs and identify which tab is currently active',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_tab',
      description: 'Switch active tab to a specific index (1, 2...) or by matching title/url keyword (e.g. "github", "docs")',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Tab index number or tab title keyword' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_tab',
      description: 'Open a new browser tab, optionally navigating to an initial URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Optional initial URL for the new tab' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_tab',
      description: 'Close the specified tab by index or close the active tab',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'number', description: 'Optional 1-based index of the tab to close' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'go_back',
      description: 'Navigate back in browser history in the active tab',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_in_page',
      description: 'Search for text keywords occurrences inside the active page',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keyword or phrase to find on the page' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_tabs',
      description: 'Compare the active page with another open tab by tab index or title',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Tab index number or tab title keyword to compare against' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_endpoints',
      description: 'Detect and list all HTTP, API, authentication, and form endpoints found on the active page, with optional filtering (api, auth, download, form)',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Optional category filter: "api", "auth", "download", "form"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bookmark_page',
      description: 'Bookmark the currently loaded webpage',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

export async function executeBrowserTool(
  client: IpcClient,
  toolName: string,
  rawArgs: any
): Promise<ToolExecutionResult> {
  const args = normalizeToolArgs(rawArgs);

  try {
    switch (toolName) {
      case 'navigate': {
        const url = args.url || args.target || args.destination;
        if (!url) {
          return { tool: toolName, success: false, message: 'Missing "url" parameter' };
        }
        await client.sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url });
        return {
          tool: toolName,
          success: true,
          message: `Navigated active tab to: ${url}`,
          data: { url },
        };
      }

      case 'search_web': {
        const query = args.query || args.q || args.text;
        if (!query) {
          return { tool: toolName, success: false, message: 'Missing "query" parameter' };
        }
        await client.sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: query });
        return {
          tool: toolName,
          success: true,
          message: `Dispatched search for: "${query}"`,
          data: { query },
        };
      }

      case 'click_link_by_text': {
        const text = args.text || args.label || args.query || args.name;
        if (!text) {
          return { tool: toolName, success: false, message: 'Missing "text" parameter' };
        }
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const match = findBestMatchingLink(text, meta.links || []);
        if (!match) {
          return {
            tool: toolName,
            success: false,
            message: `Could not find any link matching "${text}" on page "${meta.title}".`,
          };
        }
        await client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId: match.item.id });
        return {
          tool: toolName,
          success: true,
          message: `Clicked link [${match.item.id}] "${match.item.label}" -> ${match.item.href}`,
          data: match.item,
        };
      }

      case 'click_link': {
        const linkId = parseInt(args.link_id ?? args.linkId ?? args.id, 10);
        if (isNaN(linkId)) {
          return { tool: toolName, success: false, message: 'Missing or invalid "link_id"' };
        }
        await client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId });
        return {
          tool: toolName,
          success: true,
          message: `Activated link ID [${linkId}].`,
          data: { linkId },
        };
      }

      case 'get_page_content': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const topLinks = (meta.links || []).slice(0, 15).map((l) => `[${l.id}] ${l.label} (${l.endpoint || l.href})`);
        const topEndpoints = (meta.endpoints || []).slice(0, 10).map((e) => `[${e.category.toUpperCase()}] ${e.method || 'GET'} ${e.path}`);
        return {
          tool: toolName,
          success: true,
          message: `Page: "${meta.title}" (${meta.url}) - ${meta.endpoints?.length || 0} endpoints detected`,
          data: {
            title: meta.title,
            url: meta.url,
            headings: (meta.headings || []).slice(0, 8),
            textSnippet: (meta.textSnippet || '').substring(0, 1500),
            topLinks,
            topEndpoints,
          },
        };
      }

      case 'list_endpoints': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const filterCat = args.category?.toLowerCase();
        let endpoints = meta.endpoints || [];
        if (filterCat) {
          endpoints = endpoints.filter((e) => e.category.toLowerCase().includes(filterCat));
        }
        return {
          tool: toolName,
          success: true,
          message: `Detected ${endpoints.length} endpoints on "${meta.title}".`,
          data: {
            total: endpoints.length,
            endpoints: endpoints.slice(0, 25).map((e) => ({
              id: e.id,
              path: e.path,
              category: e.category,
              method: e.method || 'GET',
              label: e.label,
              url: e.url,
            })),
          },
        };
      }

      case 'list_tabs': {
        const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        const tabSummaries = state.tabs.map((t, idx) => ({
          index: idx + 1,
          id: t.id,
          title: t.title,
          url: t.url,
          isActive: t.id === state.activeTabId,
        }));
        return {
          tool: toolName,
          success: true,
          message: `Open tabs count: ${state.tabs.length}`,
          data: { activeTabId: state.activeTabId, tabs: tabSummaries },
        };
      }

      case 'switch_tab': {
        const target = String(args.target ?? args.index ?? args.query ?? '');
        const numeric = parseInt(target, 10);
        if (!isNaN(numeric)) {
          await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { index: numeric });
          return { tool: toolName, success: true, message: `Switched to tab index [${numeric}].` };
        }

        const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        const match = findBestMatchingTab(target, state.tabs);
        if (match) {
          await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: match.tab.id });
          return {
            tool: toolName,
            success: true,
            message: `Switched to tab [${match.index}] "${match.tab.title}".`,
          };
        }
        return { tool: toolName, success: false, message: `No matching tab found for "${target}".` };
      }

      case 'create_tab': {
        const url = args.url || undefined;
        const newTab = await client.sendCommand(IPC_COMMANDS.TABS_CREATE, { url });
        return {
          tool: toolName,
          success: true,
          message: `Opened new tab: ${newTab.id} (${newTab.url})`,
          data: newTab,
        };
      }

      case 'close_tab': {
        const index = args.index !== undefined ? parseInt(args.index, 10) : undefined;
        await client.sendCommand(IPC_COMMANDS.TABS_CLOSE, { index });
        return { tool: toolName, success: true, message: 'Closed tab.' };
      }

      case 'go_back': {
        await client.sendCommand(IPC_COMMANDS.NAV_BACK);
        return { tool: toolName, success: true, message: 'Navigated back in active tab.' };
      }

      case 'search_in_page': {
        const query = args.query || args.q || args.text;
        if (!query) {
          return { tool: toolName, success: false, message: 'Missing "query" parameter' };
        }
        const result = await client.sendCommand(IPC_COMMANDS.PAGE_FIND, { query });
        return {
          tool: toolName,
          success: true,
          message: `Found ${result.count} occurrences of "${query}".`,
          data: result,
        };
      }

      case 'compare_tabs': {
        const target = String(args.target ?? args.index ?? '');
        const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        const match = findBestMatchingTab(target, state.tabs);
        if (!match) {
          return { tool: toolName, success: false, message: `Could not find target tab "${target}" to compare.` };
        }
        const currentMeta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        return {
          tool: toolName,
          success: true,
          message: `Comparison target tab located: [${match.index}] "${match.tab.title}"`,
          data: {
            currentTab: { title: currentMeta.title, url: currentMeta.url },
            targetTab: { index: match.index, id: match.tab.id, title: match.tab.title, url: match.tab.url },
          },
        };
      }

      case 'bookmark_page': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const bm = await client.sendCommand(IPC_COMMANDS.BOOKMARKS_ADD, {
          url: meta.url,
          title: meta.title,
        });
        return {
          tool: toolName,
          success: true,
          message: `Saved bookmark: "${bm.title}" (${bm.url})`,
          data: bm,
        };
      }

      default: {
        return { tool: toolName, success: false, message: `Unknown tool: ${toolName}` };
      }
    }
  } catch (err) {
    return {
      tool: toolName,
      success: false,
      message: `Execution failed: ${(err as Error).message}`,
    };
  }
}
