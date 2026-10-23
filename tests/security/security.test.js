import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NavigationService } from '../../packages/controller/dist/NavigationService.js';
import { PageInspector } from '../../packages/controller/dist/PageInspector.js';
import { PROTOCOL_VERSION } from '../../packages/ipc-protocol/dist/index.js';

describe('DualSurf Security Hardening Suite', () => {
  const nav = new NavigationService('duckduckgo');
  const inspector = new PageInspector();

  it('rejects or sanitizes dangerous javascript: URLs in navigation', () => {
    const malicious = 'javascript:alert(document.cookie)';
    const normalized = nav.normalizeUrl(malicious);

    // Must be treated as a web search query or blocked, never executed as raw script
    assert.ok(
      normalized.startsWith('https://duckduckgo.com/?q=') || !normalized.startsWith('javascript:'),
      'javascript: scheme must never be directly navigated'
    );
  });

  it('rejects vbscript: pseudo-scheme in navigation', () => {
    const malicious = 'vbscript:msgbox("hacked")';
    const normalized = nav.normalizeUrl(malicious);
    assert.ok(
      normalized.startsWith('https://duckduckgo.com/?q=') || !normalized.startsWith('vbscript:'),
      'vbscript: scheme must never be directly navigated'
    );
  });

  it('safely rejects non-integer or malicious linkId values in clickNumberedLink', async () => {
    // Malicious or NaN inputs must safely return null without throwing or script execution
    const res1 = await inspector.clickNumberedLink(null, NaN);
    assert.equal(res1, null);

    const res2 = await inspector.clickNumberedLink(null, -1);
    assert.equal(res2, null);

    const res3 = await inspector.clickNumberedLink(null, 0);
    assert.equal(res3, null);
  });

  it('rejects shell metacharacters and escapes search parameters safely', () => {
    const shellInjection = 'test; rm -rf /; echo "pwned"';
    const normalized = nav.normalizeUrl(shellInjection);

    assert.ok(normalized.startsWith('https://duckduckgo.com/?q='));
    // Ensure properly URL-encoded
    assert.ok(normalized.includes('%3B'));
    assert.ok(!normalized.includes('; '));
  });

  it('safely handles non-existent or destroyed webContents without uncaught exceptions', async () => {
    const nullResult = await inspector.inspectPage(null);
    assert.equal(nullResult.title, '');
    assert.equal(nullResult.headings.length, 0);
    assert.equal(nullResult.links.length, 0);
  });

  it('enforces protocol version match in IPC protocol', () => {
    assert.equal(PROTOCOL_VERSION, 1);
  });
});
