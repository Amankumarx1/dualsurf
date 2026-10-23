import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNumberedLinks,
  formatEndpoints,
  getCategoryBadge,
} from '../../apps/cli/dist/formatters.js';
import {
  BROWSER_TOOL_DEFINITIONS,
  executeBrowserTool,
} from '../../apps/cli/dist/agent/browserTools.js';

describe('DualSurf Endpoint Detection & Classification', () => {
  const sampleLinks = [
    {
      id: 1,
      label: 'Home',
      href: 'https://dualsurf.local/',
      category: 'internal',
      endpoint: '/',
      isExternal: false,
    },
    {
      id: 2,
      label: 'REST API v1',
      href: 'https://dualsurf.local/api/v1/status',
      category: 'api',
      endpoint: '/api/v1/status',
      isExternal: false,
    },
    {
      id: 3,
      label: 'Login Portal',
      href: 'https://dualsurf.local/auth/login',
      category: 'auth',
      endpoint: '/auth/login',
      isExternal: false,
    },
    {
      id: 4,
      label: 'Download Linux Package',
      href: 'https://dualsurf.local/packages/dualsurf-latest.deb',
      category: 'download',
      endpoint: '/packages/dualsurf-latest.deb',
      isExternal: false,
    },
    {
      id: 5,
      label: 'External Docs',
      href: 'https://docs.electronjs.org/api/web-contents',
      category: 'external',
      endpoint: '/api/web-contents',
      isExternal: true,
    },
  ];

  const sampleEndpoints = [
    {
      id: 1,
      url: 'https://dualsurf.local/api/v1/status',
      path: '/api/v1/status',
      category: 'api',
      method: 'GET',
      label: 'Status API',
      isExternal: false,
    },
    {
      id: 2,
      url: 'https://dualsurf.local/auth/login',
      path: '/auth/login',
      category: 'auth',
      method: 'POST',
      label: 'User Authentication',
      isExternal: false,
    },
    {
      id: 3,
      url: 'https://dualsurf.local/downloads/dualsurf.deb',
      path: '/downloads/dualsurf.deb',
      category: 'download',
      method: 'GET',
      label: 'Debian Package',
      isExternal: false,
    },
    {
      id: 4,
      url: 'https://dualsurf.local/search',
      path: '/search',
      category: 'form',
      method: 'GET',
      label: '[FORM: GET] Search Box',
      isExternal: false,
    },
  ];

  it('assigns colorful descriptive badges to categories', () => {
    assert.ok(getCategoryBadge('api').includes('[API]'));
    assert.ok(getCategoryBadge('auth').includes('[AUTH]'));
    assert.ok(getCategoryBadge('download').includes('[DOWNLOAD]'));
    assert.ok(getCategoryBadge('form').includes('[FORM]'));
    assert.ok(getCategoryBadge('external', true).includes('[EXT]'));
    assert.ok(getCategoryBadge('internal', false).includes('[INT]'));
  });

  it('formats numbered links with visible endpoints and category tags', () => {
    const formatted = formatNumberedLinks(sampleLinks);
    assert.ok(formatted.includes('[API]'));
    assert.ok(formatted.includes('[AUTH]'));
    assert.ok(formatted.includes('[DOWNLOAD]'));
    assert.ok(formatted.includes('Endpoint:'));
    assert.ok(formatted.includes('/api/v1/status'));
    assert.ok(formatted.includes('/auth/login'));
  });

  it('formats endpoints grouped by category', () => {
    const formatted = formatEndpoints(sampleEndpoints);
    assert.ok(formatted.includes('API ENDPOINTS'));
    assert.ok(formatted.includes('AUTH ENDPOINTS'));
    assert.ok(formatted.includes('DOWNLOAD ENDPOINTS'));
    assert.ok(formatted.includes('FORM ENDPOINTS'));
    assert.ok(formatted.includes('/api/v1/status'));
    assert.ok(formatted.includes('/auth/login'));
  });

  it('supports filtering endpoints by category keyword', () => {
    const apiOnly = formatEndpoints(sampleEndpoints, 'api');
    assert.ok(apiOnly.includes('/api/v1/status'));
    assert.ok(!apiOnly.includes('/downloads/dualsurf.deb'));

    const authOnly = formatEndpoints(sampleEndpoints, 'auth');
    assert.ok(authOnly.includes('/auth/login'));
    assert.ok(!authOnly.includes('/search'));
  });

  it('includes list_endpoints tool in browser tools suite', async () => {
    const tool = BROWSER_TOOL_DEFINITIONS.find((t) => t.function.name === 'list_endpoints');
    assert.ok(tool);

    const mockClient = {
      sendCommand: async () => ({
        title: 'Test Page',
        url: 'https://dualsurf.local',
        endpoints: sampleEndpoints,
        links: sampleLinks,
      }),
    };

    const res = await executeBrowserTool(mockClient, 'list_endpoints', { category: 'api' });
    assert.equal(res.success, true);
    assert.equal(res.data.total, 1);
    assert.equal(res.data.endpoints[0].category, 'api');
  });
});
