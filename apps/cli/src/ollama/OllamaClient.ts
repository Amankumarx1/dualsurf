import type { PageMetadata } from '@dualsurf/shared-types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: Array<{
    id?: string;
    function: {
      name: string;
      arguments: Record<string, any> | string;
    };
  }>;
  stats?: GenerationStats;
}

export interface GenerationStats {
  totalDurationMs?: number;
  promptEvalCount?: number;
  evalCount?: number;
  evalDurationMs?: number;
  tokensPerSecond?: number;
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ChatOptions {
  messages: ChatMessage[];
  tools?: OllamaTool[];
  stream?: boolean;
  onToken?: (token: string) => void;
  temperature?: number;
  num_ctx?: number;
  top_p?: number;
  format?: 'json';
  timeoutMs?: number;
}

export interface SummarizeOptions {
  style?: 'bullets' | 'tldr' | 'executive';
  onToken?: (token: string) => void;
  temperature?: number;
}

export class OllamaClient {
  private baseUrl: string;
  private selectedModel: string | null = null;
  private defaultNumCtx: number;

  constructor(host?: string, model?: string, defaultNumCtx = 8192) {
    this.baseUrl = (host || process.env.DUALSURF_OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.selectedModel = model || process.env.DUALSURF_OLLAMA_MODEL || null;
    this.defaultNumCtx = defaultNumCtx;
  }

  /**
   * Check if local Ollama daemon is reachable.
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Ping Ollama and measure connection latency and available model count.
   */
  public async ping(): Promise<{ ok: boolean; latencyMs: number; modelCount: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) return { ok: false, latencyMs, modelCount: 0 };
      const data: any = await res.json();
      const modelCount = Array.isArray(data.models) ? data.models.length : 0;
      return { ok: true, latencyMs, modelCount };
    } catch {
      return { ok: false, latencyMs: Date.now() - start, modelCount: 0 };
    }
  }

  /**
   * Retrieve list of installed models from local Ollama.
   */
  public async getAvailableModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      if (Array.isArray(data.models)) {
        return data.models.map((m: any) => m.name || m.model).filter(Boolean);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Automatically select best model:
   * 1. Explicit model if configured
   * 2. llama3.2:1b (fast, excellent tool calling)
   * 3. qwen2.5:0.5b or any installed model
   * 4. Fallback default
   */
  public async getOrSelectModel(): Promise<string> {
    if (this.selectedModel) {
      return this.selectedModel;
    }

    const available = await this.getAvailableModels();
    if (available.length > 0) {
      const preferred =
        available.find((m) => m.includes('llama3.2:1b')) ||
        available.find((m) => m.includes('llama3.2')) ||
        available.find((m) => m.includes('qwen2.5')) ||
        available.find((m) => m.includes('mistral')) ||
        available[0];

      this.selectedModel = preferred;
      return preferred;
    }

    this.selectedModel = 'llama3.2:1b';
    return this.selectedModel;
  }

  public setModel(model: string): void {
    this.selectedModel = model;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Send a chat request to Ollama with tool calling, context window expansion, and streaming.
   */
  public async chat(options: ChatOptions): Promise<ChatMessage> {
    const model = await this.getOrSelectModel();
    const timeoutMs = options.timeoutMs ?? 60000;

    const body: Record<string, any> = {
      model,
      messages: options.messages,
      stream: Boolean(options.stream && options.onToken),
      options: {
        temperature: options.temperature ?? 0.1,
        num_ctx: options.num_ctx ?? this.defaultNumCtx,
        top_p: options.top_p ?? 0.9,
      },
    };

    if (options.format) {
      body.format = options.format;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errText}`);
    }

    // Handle streaming response
    if (options.stream && options.onToken && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let toolCalls: any[] = [];
      let finalStats: GenerationStats = {};

      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const chunk = JSON.parse(trimmed);
              const delta = chunk.message?.content || '';
              if (delta) {
                fullContent += delta;
                options.onToken(delta);
              }
              if (chunk.message?.tool_calls) {
                toolCalls = toolCalls.concat(chunk.message.tool_calls);
              }
              if (chunk.done) {
                finalStats = this.extractMetrics(chunk);
              }
            } catch {
              // ignore partial chunk parse errors
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const resultMessage: ChatMessage = {
        role: 'assistant',
        content: fullContent,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        stats: finalStats,
      };

      // Format-healing: recover tool calls if small model emitted JSON into text
      if (!resultMessage.tool_calls) {
        const recovered = this.extractFencedToolCalls(fullContent);
        if (recovered.length > 0) {
          resultMessage.tool_calls = recovered;
        }
      }

      return resultMessage;
    }

    // Non-streaming response
    const data: any = await response.json();
    const message: ChatMessage = data.message || { role: 'assistant', content: '' };
    message.stats = this.extractMetrics(data);

    // Format-healing for non-streaming response as well
    if (!message.tool_calls && message.content) {
      const recovered = this.extractFencedToolCalls(message.content);
      if (recovered.length > 0) {
        message.tool_calls = recovered;
      }
    }

    return message;
  }

  /**
   * Format-healing: Extracts JSON tool calls when small local models output tool
   * specifications inside markdown code fences or raw content instead of tool_calls field.
   */
  public extractFencedToolCalls(content: string): Array<{ function: { name: string; arguments: any } }> {
    if (!content) return [];
    const calls: Array<{ function: { name: string; arguments: any } }> = [];

    // Pattern 1: ```json { "name": "...", "arguments": { ... } } ```
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.name && typeof parsed.name === 'string') {
          calls.push({ function: { name: parsed.name, arguments: parsed.arguments || {} } });
        } else if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.name) calls.push({ function: { name: item.name, arguments: item.arguments || {} } });
          }
        }
      } catch {
        // ignore invalid json in block
      }
    }

    // Pattern 2: Raw inline JSON object with action/tool property
    if (calls.length === 0 && content.trim().startsWith('{') && content.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(content.trim());
        const toolName = parsed.name || parsed.tool || parsed.action || parsed.function;
        if (toolName && typeof toolName === 'string') {
          calls.push({
            function: {
              name: toolName,
              arguments: parsed.arguments || parsed.params || parsed.parameters || {},
            },
          });
        }
      } catch {
        // ignore
      }
    }

    return calls;
  }

  /**
   * Summarize the active page content with customizable styles.
   */
  public async summarizePage(
    meta: PageMetadata,
    options?: SummarizeOptions
  ): Promise<string> {
    const pageContext = this.formatPageContext(meta);
    const style = options?.style || 'bullets';

    let promptInstructions = '';
    switch (style) {
      case 'tldr':
        promptInstructions = 'Provide a punchy 1-2 sentence TL;DR followed by 3 key bullet points.';
        break;
      case 'executive':
        promptInstructions = 'Provide a structured executive briefing with: Core Purpose, Key Features/Findings, and Conclusion.';
        break;
      case 'bullets':
      default:
        promptInstructions = 'Summarize clearly in 4-6 concise markdown bullet points with bold keywords.';
        break;
    }

    const systemPrompt = `You are an elite web summarizer operating inside DualSurf terminal browser.
${promptInstructions}
Be strictly factual, direct, and avoid meta-commentary like "This article is about" or "In conclusion".`;

    const userPrompt = `Page Title: ${meta.title}
URL: ${meta.url}

Webpage Content:
${pageContext}

Please generate the summary.`;

    const res = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: Boolean(options?.onToken),
      onToken: options?.onToken,
      temperature: options?.temperature ?? 0.2,
      num_ctx: 8192,
    });

    return res.content;
  }

  /**
   * Ask targeted questions about current page content.
   */
  public async askAboutPage(
    meta: PageMetadata,
    question: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    const pageContext = this.formatPageContext(meta);

    const systemPrompt = `You are DualSurf AI Assistant, an expert web research analyst inside a terminal browser.
Answer the user's question directly and concisely based on the current page content.
- Strictly adhere to verified facts, headings, endpoints, and text present in the provided content.
- Do NOT hallucinate, invent, or assume endpoints, APIs, or vulnerabilities that are not explicitly present in the provided content.
- If information is missing from the page, state what is known and clarify what is absent.
- Format cleanly in terminal-friendly markdown.`;

    const userPrompt = `Active Webpage: "${meta.title}" (${meta.url})

Webpage Content:
${pageContext}

User Question: ${question}`;

    const res = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: Boolean(onToken),
      onToken,
      temperature: 0.1,
      num_ctx: 8192,
    });

    return res.content;
  }

  /**
   * Extract structured JSON data from the current page matching a user's criteria.
   */
  public async extractStructuredData<T = any>(
    meta: PageMetadata,
    extractionGoal: string
  ): Promise<T | null> {
    const pageContext = this.formatPageContext(meta);

    const systemPrompt = `You are a structured data extraction engine.
Extract the requested entities or data table from the webpage into valid JSON.
Return ONLY valid JSON without surrounding explanations or markdown commentary.`;

    const userPrompt = `Page: "${meta.title}" (${meta.url})
Goal: ${extractionGoal}

Page Content:
${pageContext}

Return JSON:`;

    const res = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.0,
      format: 'json',
      num_ctx: 8192,
    });

    try {
      return JSON.parse(res.content.trim()) as T;
    } catch {
      return null;
    }
  }

  /**
   * Compare two web pages side-by-side (e.g. across two tabs).
   */
  public async comparePages(
    pageA: PageMetadata,
    pageB: PageMetadata,
    focusQuery?: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    const systemPrompt = `You are DualSurf Tab Comparison Analyst.
Compare the two open webpages side-by-side. Highlight similarities, differences, trade-offs, and key takeaways in a concise terminal-friendly markdown format.`;

    const userPrompt = `Page 1: "${pageA.title}" (${pageA.url})
Content:
${this.formatPageContext(pageA).substring(0, 3000)}

---

Page 2: "${pageB.title}" (${pageB.url})
Content:
${this.formatPageContext(pageB).substring(0, 3000)}

${focusQuery ? `Comparison Focus: ${focusQuery}` : 'Provide a comprehensive comparison.'}`;

    const res = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: Boolean(onToken),
      onToken,
      temperature: 0.2,
      num_ctx: 8192,
    });

    return res.content;
  }

  /**
   * Pull a model from Ollama registry with progress reporting.
   */
  public async pullModel(
    modelName: string,
    onProgress?: (status: string, percent?: number) => void
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok || !response.body) return false;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.status && onProgress) {
              const percent = data.total && data.completed ? Math.round((data.completed / data.total) * 100) : undefined;
              onProgress(data.status, percent);
            }
          } catch {
            // ignore
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private formatPageContext(meta: PageMetadata): string {
    const parts: string[] = [];
    if (meta.headings && meta.headings.length > 0) {
      parts.push(
        'Headings:\n' +
          meta.headings
            .slice(0, 20)
            .map((h) => `${'#'.repeat(Math.min(6, h.level))} ${h.text}`)
            .join('\n')
      );
    }
    if (meta.endpoints && meta.endpoints.length > 0) {
      parts.push(
        'Actual DOM Endpoints:\n' +
          meta.endpoints
            .slice(0, 30)
            .map((e) => `- [${e.method}] ${e.path} (${e.category}${e.isExternal ? ', external' : ''})`)
            .join('\n')
      );
    }
    if (meta.forms && meta.forms.length > 0) {
      parts.push(
        'Actual Form Actions:\n' +
          meta.forms
            .slice(0, 10)
            .map((f) => `- [${f.method}] ${f.action}${f.hasPassword ? ' [password]' : ''}`)
            .join('\n')
      );
    }
    if (meta.textSnippet) {
      parts.push('Page Text:\n' + meta.textSnippet.substring(0, 5000));
    }
    return parts.join('\n\n') || '(No textual content found)';
  }

  private extractMetrics(data: any): GenerationStats {
    const totalDurationMs = data.total_duration ? Math.round(data.total_duration / 1e6) : undefined;
    const evalDurationMs = data.eval_duration ? Math.round(data.eval_duration / 1e6) : undefined;
    const evalCount = data.eval_count;
    let tokensPerSecond: number | undefined;

    if (evalCount && data.eval_duration && data.eval_duration > 0) {
      tokensPerSecond = Math.round((evalCount / (data.eval_duration / 1e9)) * 10) / 10;
    }

    return {
      totalDurationMs,
      promptEvalCount: data.prompt_eval_count,
      evalCount,
      evalDurationMs,
      tokensPerSecond,
    };
  }
}
