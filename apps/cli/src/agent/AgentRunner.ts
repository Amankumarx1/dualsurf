import type { BrowserControllerState, PageMetadata } from '@dualsurf/shared-types';
import { IPC_COMMANDS } from '@dualsurf/ipc-protocol';
import type { IpcClient } from '../IpcClient.js';
import { OllamaClient, type ChatMessage } from '../ollama/OllamaClient.js';
import { classifyUserIntent } from '../ollama/intentClassifier.js';
import {
  BROWSER_TOOL_DEFINITIONS,
  executeBrowserTool,
  normalizeToolArgs,
} from './browserTools.js';
import { findBestMatchingLink, findBestMatchingTab } from '../semantic/fuzzyMatcher.js';
import { colors } from '../formatters.js';

export interface AgentRunOptions {
  client: IpcClient;
  ollama: OllamaClient;
  userGoal: string;
  maxSteps?: number;
  verbose?: boolean;
}

export class AgentRunner {
  private client: IpcClient;
  private ollama: OllamaClient;

  constructor(client: IpcClient, ollama?: OllamaClient) {
    this.client = client;
    this.ollama = ollama || new OllamaClient();
  }

  public async runGoal(userGoal: string, maxSteps = 6): Promise<string> {
    const isAvailable = await this.ollama.isAvailable();
    if (!isAvailable) {
      console.log(
        `${colors.yellow}[DualSurf Agent]${colors.reset} Local Ollama is not running at ${this.ollama.getBaseUrl()}.\n` +
          `Please run ${colors.bold}"ollama run llama3.2:1b"${colors.reset} in a terminal, or set DUALSURF_OLLAMA_HOST.`
      );
      return 'Ollama service unavailable.';
    }

    const modelName = await this.ollama.getOrSelectModel();
    console.log(
      `\n${colors.cyan}🤖 [DualSurf Agent]${colors.reset} Model: ${colors.bold}${modelName}${colors.reset} | Goal: "${colors.bold}${userGoal}${colors.reset}"`
    );

    // 1. Fast Intent Classification & Routing
    const intent = classifyUserIntent(userGoal);

    // Intent Fast-Path A: Direct Page Q&A
    if (intent.type === 'direct_qa') {
      try {
        const meta: PageMetadata = await this.client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        console.log(`\n${colors.cyan}🤖 [DualSurf AI Q&A]:${colors.reset} Reading "${meta.title || meta.url}"...\n`);
        let answer = '';
        await this.ollama.askAboutPage(meta, userGoal, (token) => {
          answer += token;
          process.stdout.write(token);
        });
        console.log('\n');
        return answer;
      } catch (err) {
        console.log(`${colors.yellow}Direct Q&A error, falling back to agent loop...${colors.reset}`);
      }
    }

    // Intent Fast-Path B: Direct Page Summarization
    if (intent.type === 'summarize') {
      try {
        const meta: PageMetadata = await this.client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        console.log(
          `\n${colors.cyan}🤖 [DualSurf Summary]:${colors.reset} ${colors.bold}${meta.title || meta.url}${colors.reset}\n`
        );
        let summary = '';
        await this.ollama.summarizePage(meta, {
          style: intent.metadata?.style || 'bullets',
          onToken: (token) => {
            summary += token;
            process.stdout.write(token);
          },
        });
        console.log('\n');
        return summary;
      } catch (err) {
        console.log(`${colors.yellow}Summary error, falling back to agent loop...${colors.reset}`);
      }
    }

    // Intent Fast-Path C: Tab Comparison
    if (intent.type === 'compare_tabs') {
      try {
        const state: BrowserControllerState = await this.client.sendCommand(IPC_COMMANDS.TABS_LIST);
        const match = findBestMatchingTab(intent.metadata?.targetTab || '', state.tabs);
        if (match) {
          const currentMeta: PageMetadata = await this.client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          // Switch to target tab to get its metadata
          await this.client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: match.tab.id });
          const targetMeta: PageMetadata = await this.client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          // Switch back to original
          if (state.activeTabId) {
            await this.client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: state.activeTabId });
          }

          console.log(`\n${colors.cyan}🤖 [DualSurf Tab Comparison]:${colors.reset} "${currentMeta.title}" vs "${targetMeta.title}"\n`);
          let comparison = '';
          await this.ollama.comparePages(currentMeta, targetMeta, userGoal, (token) => {
            comparison += token;
            process.stdout.write(token);
          });
          console.log('\n');
          return comparison;
        }
      } catch {
        // fall back to agent loop
      }
    }

    // Intent Fast-Path D: Semantic Click
    if (intent.type === 'semantic_click' && intent.extractedQuery) {
      try {
        const meta: PageMetadata = await this.client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const match = findBestMatchingLink(intent.extractedQuery, meta.links || []);
        if (match) {
          console.log(
            `\n${colors.magenta}⚡ [Action]${colors.reset} Followed link [${match.item.id}] "${colors.bold}${match.item.label}${colors.reset}" -> ${match.item.href}`
          );
          await this.client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId: match.item.id });
          return `Activated link: "${match.item.label}"`;
        }
      } catch {
        // fall back to agent loop
      }
    }

    // Intent Fast-Path E: Structured Data Extraction
    if (intent.type === 'extract_data') {
      try {
        const meta: PageMetadata = await this.client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        console.log(`\n${colors.cyan}🤖 [Extracting Data as JSON]...${colors.reset}\n`);
        const extracted = await this.ollama.extractStructuredData(meta, intent.extractedQuery);
        if (extracted) {
          console.log(JSON.stringify(extracted, null, 2));
          return JSON.stringify(extracted);
        }
      } catch {
        // fall back to agent loop
      }
    }

    // 2. Multi-Step ReAct Autonomous Agent Loop
    let meta: PageMetadata = { title: '', url: 'about:blank', isLoading: false, headings: [], links: [] };
    let tabsState: BrowserControllerState | null = null;

    try {
      meta = await this.client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
    } catch {
      // ignore
    }

    try {
      tabsState = await this.client.sendCommand(IPC_COMMANDS.TABS_LIST);
    } catch {
      // ignore
    }

    const initialSnapshot = this.buildInitialStatePrompt(meta, tabsState);

    const systemPrompt = `You are DualSurf Agent, an AI browsing assistant operating inside a terminal browser.
You control the user's live Chromium browser using available tool calls.
Always check the current state before taking unnecessary actions.
If the user's intent is simple (e.g. clicking a link, searching, or switching tabs), execute the tool directly.
If the user asks a question about the current page, answer it directly without unnecessary tool calls.
When you finish the goal or have the answer, output your response without any tool calls.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Current Browser State:\n${initialSnapshot}\n\nUser Goal:\n${userGoal}`,
      },
    ];

    let step = 0;
    while (step < maxSteps) {
      step++;
      process.stdout.write(`${colors.dim}Thinking (step ${step}/${maxSteps})...${colors.reset}\r`);

      let response: ChatMessage;
      try {
        response = await this.ollama.chat({
          messages,
          tools: BROWSER_TOOL_DEFINITIONS,
          temperature: 0.1,
          num_ctx: 8192,
        });
      } catch (err) {
        console.log(`${colors.red}❌ [Ollama Error]: ${(err as Error).message}${colors.reset}`);
        return `Failed to communicate with Ollama: ${(err as Error).message}`;
      }

      // Check for tool calls (including format-healing recovery for small models)
      let toolCalls = response.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        toolCalls = this.ollama.extractFencedToolCalls(response.content);
      }

      if (toolCalls && toolCalls.length > 0) {
        messages.push(response);

        for (const call of toolCalls) {
          const fnName = call.function.name;
          const fnArgs = normalizeToolArgs(call.function.arguments);

          const speedBadge = response.stats?.tokensPerSecond
            ? ` ${colors.dim}(${response.stats.tokensPerSecond} tok/s)${colors.reset}`
            : '';

          console.log(
            `\n${colors.magenta}⚡ [Action ${step}/${maxSteps}]${colors.reset} ${colors.bold}${fnName}${colors.reset}(${JSON.stringify(fnArgs)})${speedBadge}`
          );

          const result = await executeBrowserTool(this.client, fnName, fnArgs);

          if (result.success) {
            console.log(`  ${colors.green}✓${colors.reset} ${result.message}`);
          } else {
            console.log(`  ${colors.yellow}⚠${colors.reset} ${result.message}`);
          }

          // If navigation or link click occurred, give brief pause for Chromium to load
          if (
            fnName === 'navigate' ||
            fnName === 'click_link' ||
            fnName === 'click_link_by_text' ||
            fnName === 'search_web'
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            try {
              const updatedMeta: PageMetadata = await this.client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
              result.data = {
                ...result.data,
                currentPage: {
                  title: updatedMeta.title,
                  url: updatedMeta.url,
                  headings: (updatedMeta.headings || []).slice(0, 5),
                  snippet: (updatedMeta.textSnippet || '').substring(0, 800),
                },
              };
            } catch {
              // ignore
            }
          }

          messages.push({
            role: 'tool',
            name: fnName,
            content: JSON.stringify(result),
          });
        }
      } else {
        // Model provided final answer or text response
        const answer = response.content?.trim() || 'Task completed.';
        const speedBadge = response.stats?.tokensPerSecond
          ? ` ${colors.dim}(${response.stats.tokensPerSecond} tokens/sec)${colors.reset}`
          : '';

        console.log(`\n${colors.cyan}💬 [DualSurf Agent Answer]${speedBadge}:${colors.reset}`);
        console.log(answer);
        return answer;
      }
    }

    console.log(`\n${colors.yellow}Reached step limit (${maxSteps}). Task ended.${colors.reset}`);
    return 'Agent reached step limit.';
  }

  private buildInitialStatePrompt(meta: PageMetadata, tabs: BrowserControllerState | null): string {
    const lines: string[] = [
      `Active URL: ${meta.url || 'about:blank'}`,
      `Active Title: ${meta.title || '(No title)'}`,
    ];

    if (tabs && tabs.tabs.length > 0) {
      lines.push(
        `Open Tabs (${tabs.tabs.length}): ` +
          tabs.tabs.map((t, i) => `[${i + 1}] "${t.title}" (${t.url})`).join(', ')
      );
    }

    if (meta.headings && meta.headings.length > 0) {
      lines.push(
        `Key Headings: ` +
          meta.headings
            .slice(0, 8)
            .map((h) => h.text)
            .join(' | ')
      );
    }

    if (meta.links && meta.links.length > 0) {
      lines.push(
        `Sample Actionable Links: ` +
          meta.links
            .slice(0, 10)
            .map((l) => `[${l.id}] "${l.label}"`)
            .join(', ')
      );
    }

    return lines.join('\n');
  }
}
