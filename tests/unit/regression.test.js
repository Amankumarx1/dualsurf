import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NavigationService } from '../../packages/controller/dist/NavigationService.js';
import { PageInspector } from '../../packages/controller/dist/PageInspector.js';

describe('DualSurf Live Controller Regression Suite', () => {
  const navService = new NavigationService('duckduckgo');
  const inspector = new PageInspector();

  it('normalizes queries and URLs consistently across navigation commands', () => {
    assert.equal(navService.normalizeUrl('example.com'), 'https://example.com');
    assert.equal(navService.normalizeUrl('https://example.com/test'), 'https://example.com/test');
    assert.ok(navService.normalizeUrl('what is the largest number').includes('duckduckgo.com/?q=what%20is%20the%20largest%20number'));
  });

  it('safely handles null, unattached or destroyed WebContents in PageInspector', async () => {
    const meta = await inspector.inspectPage(null);
    assert.equal(meta.title, '');
    assert.equal(meta.url, '');
    assert.equal(meta.headings.length, 0);
    assert.equal(meta.links.length, 0);

    const clicked = await inspector.clickNumberedLink(null, 1);
    assert.equal(clicked, null);

    const findRes = await inspector.findInPage(null, 'test');
    assert.equal(findRes.count, 0);
    assert.equal(findRes.matches.length, 0);
  });

  it('safely handles empty queries in findInPage without throwing', async () => {
    const findRes = await inspector.findInPage(null, '   ');
    assert.equal(findRes.count, 0);
    assert.equal(findRes.matches.length, 0);
  });
});
