import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeToolArgs,
  BROWSER_TOOL_DEFINITIONS,
  executeBrowserTool,
} from '../../apps/cli/dist/agent/browserTools.js';
import { OllamaClient } from '../../apps/cli/dist/ollama/OllamaClient.js';
import { classifyUserIntent } from '../../apps/cli/dist/ollama/intentClassifier.js';

describe('DualSurf Ollama Agent Tools & Normalizer', () => {
  it('normalizes various argument formats returned by local LLMs', () => {
    // Direct object
    assert.deepEqual(normalizeToolArgs({ url: 'https://github.com' }), {
      url: 'https://github.com',
    });

    // Stringified JSON
    assert.deepEqual(normalizeToolArgs('{"query":"electron"}'), {
      query: 'electron',
    });

    // Nested properties (schema reflection from smaller models)
    assert.deepEqual(
      normalizeToolArgs({
        type: 'object',
        properties: { text: 'Documentation' },
      }),
      { text: 'Documentation' }
    );

    // Empty or invalid input
    assert.deepEqual(normalizeToolArgs(null), {});
    assert.deepEqual(normalizeToolArgs('invalid json string'), {});
  });

  it('provides comprehensive tool specifications for Ollama', () => {
    const toolNames = BROWSER_TOOL_DEFINITIONS.map((t) => t.function.name);
    assert.ok(toolNames.includes('navigate'));
    assert.ok(toolNames.includes('search_web'));
    assert.ok(toolNames.includes('click_link_by_text'));
    assert.ok(toolNames.includes('click_link'));
    assert.ok(toolNames.includes('get_page_content'));
    assert.ok(toolNames.includes('list_tabs'));
    assert.ok(toolNames.includes('switch_tab'));
    assert.ok(toolNames.includes('create_tab'));
    assert.ok(toolNames.includes('close_tab'));
    assert.ok(toolNames.includes('search_in_page'));
    assert.ok(toolNames.includes('compare_tabs'));
  });

  it('validates tool arguments and rejects missing parameters gracefully', async () => {
    const mockClient = {
      sendCommand: async () => ({}),
    };

    const res1 = await executeBrowserTool(mockClient, 'navigate', {});
    assert.equal(res1.success, false);
    assert.ok(res1.message.includes('url'));

    const res2 = await executeBrowserTool(mockClient, 'search_web', {});
    assert.equal(res2.success, false);
    assert.ok(res2.message.includes('query'));

    const res3 = await executeBrowserTool(mockClient, 'unknown_tool', {});
    assert.equal(res3.success, false);
    assert.ok(res3.message.includes('Unknown tool'));
  });

  it('initializes OllamaClient with defaults and detects baseUrl', () => {
    const client = new OllamaClient('http://127.0.0.1:11434', 'llama3.2:1b');
    assert.equal(client.getBaseUrl(), 'http://127.0.0.1:11434');
  });

  it('recovers fenced JSON tool calls emitted into text by small models (format-healing)', () => {
    const client = new OllamaClient();

    // Markdown fence
    const markdownText = 'I will now navigate to GitHub:\n```json\n{"name": "navigate", "arguments": {"url": "https://github.com"}}\n```';
    const calls1 = client.extractFencedToolCalls(markdownText);
    assert.equal(calls1.length, 1);
    assert.equal(calls1[0].function.name, 'navigate');
    assert.deepEqual(calls1[0].function.arguments, { url: 'https://github.com' });

    // Raw JSON string
    const rawJsonText = '{"tool": "click_link_by_text", "parameters": {"text": "Pricing"}}';
    const calls2 = client.extractFencedToolCalls(rawJsonText);
    assert.equal(calls2.length, 1);
    assert.equal(calls2[0].function.name, 'click_link_by_text');
    assert.deepEqual(calls2[0].function.arguments, { text: 'Pricing' });
  });

  it('classifies user intents rapidly for fast-path routing', () => {
    const i1 = classifyUserIntent('summarize this page');
    assert.equal(i1.type, 'summarize');

    const i2 = classifyUserIntent('what are the system prerequisites?');
    assert.equal(i2.type, 'direct_qa');

    const i3 = classifyUserIntent('compare this with tab 2');
    assert.equal(i3.type, 'compare_tabs');
    assert.equal(i3.metadata?.targetTab, '2');

    const i4 = classifyUserIntent('extract pricing tiers as json');
    assert.equal(i4.type, 'extract_data');

    const i5 = classifyUserIntent('click "Sign In"');
    assert.equal(i5.type, 'semantic_click');

    const i6 = classifyUserIntent('search for electron docs and open the official guide');
    assert.equal(i6.type, 'agent_action');
  });
});
