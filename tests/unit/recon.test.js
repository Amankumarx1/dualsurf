import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  analyzeSecurityHeaders,
  formatSecurityHeaders,
  formatCookies,
  formatStorage,
  formatReconSummary,
  generateMarkdownReport,
  exportReportToFile,
} from '../../apps/cli/dist/tools/recon.js';
import {
  BROWSER_TOOL_DEFINITIONS,
  executeBrowserTool,
} from '../../apps/cli/dist/agent/browserTools.js';

describe('Web Security Reconnaissance & Audit Subsystem', () => {
  const sampleMeta = {
    title: 'DualSurf Admin Portal',
    url: 'https://admin.dualsurf.local/dashboard',
    isLoading: false,
    headings: [
      { level: 1, text: 'Admin Console' },
      { level: 2, text: 'API Status' },
    ],
    links: [
      { id: 1, label: 'Login', href: 'https://admin.dualsurf.local/login', category: 'auth', endpoint: '/login' },
      { id: 2, label: 'API v1', href: 'https://admin.dualsurf.local/api/v1/metrics', category: 'api', endpoint: '/api/v1/metrics' },
    ],
    endpoints: [
      { id: 1, url: 'https://admin.dualsurf.local/login', path: '/login', category: 'auth', method: 'GET', isExternal: false },
      { id: 2, url: 'https://admin.dualsurf.local/api/v1/metrics', path: '/api/v1/metrics', category: 'api', method: 'GET', isExternal: false },
      { id: 3, url: 'https://admin.dualsurf.local/export.csv', path: '/export.csv', category: 'download', method: 'GET', isExternal: false },
      { id: 4, url: 'https://admin.dualsurf.local/auth', path: '/auth', category: 'form', method: 'POST', isExternal: false },
    ],
    cookies: [
      { name: 'session_id', value: 'xyz987654321' },
      { name: 'theme', value: 'dark' },
    ],
    storage: [
      { key: 'jwt_token', value: 'bearer-test-token-123' },
      { key: 'user_pref', value: 'compact' },
    ],
  };

  it('includes security recon tools in BROWSER_TOOL_DEFINITIONS', () => {
    const headerTool = BROWSER_TOOL_DEFINITIONS.find((t) => t.function.name === 'get_security_headers');
    const cookieTool = BROWSER_TOOL_DEFINITIONS.find((t) => t.function.name === 'get_cookies');
    const exportTool = BROWSER_TOOL_DEFINITIONS.find((t) => t.function.name === 'export_report');

    assert.ok(headerTool, 'get_security_headers must be defined');
    assert.ok(cookieTool, 'get_cookies must be defined');
    assert.ok(exportTool, 'export_report must be defined');
  });

  it('formats active cookies and storage snapshots', () => {
    const cookiesOutput = formatCookies(sampleMeta);
    assert.ok(cookiesOutput.includes('ACTIVE COOKIES (2 found)'));
    assert.ok(cookiesOutput.includes('session_id'));

    const storageOutput = formatStorage(sampleMeta);
    assert.ok(storageOutput.includes('LOCALSTORAGE ITEMS (2 found)'));
    assert.ok(storageOutput.includes('jwt_token'));
  });

  it('formats target reconnaissance summary with Kali recommendations', () => {
    const mockHeaders = {
      url: sampleMeta.url,
      statusCode: 200,
      headers: {},
      items: [],
      score: 67,
      grade: 'C',
      serverBanner: 'nginx/1.24.0',
    };

    const summary = formatReconSummary(sampleMeta, mockHeaders);
    assert.ok(summary.includes('TARGET RECONNAISSANCE'));
    assert.ok(summary.includes('admin.dualsurf.local:443'));
    assert.ok(summary.includes('API: 1'));
    assert.ok(summary.includes('Auth: 1'));
    assert.ok(summary.includes('nmap -sV -p 443 admin.dualsurf.local'));
    assert.ok(summary.includes('export audit.md'));
  });

  it('generates markdown audit report with full breakdown', () => {
    const mockHeaders = {
      url: sampleMeta.url,
      statusCode: 200,
      headers: {},
      items: [
        { name: 'Content-Security-Policy', status: 'missing', description: 'Mitigate XSS' },
        { name: 'Strict-Transport-Security', status: 'good', description: 'HTTPS enforcement' },
      ],
      score: 50,
      grade: 'C',
    };

    const md = generateMarkdownReport(sampleMeta, mockHeaders);
    assert.ok(md.includes('# DualSurf Web Audit & Security Reconnaissance Report'));
    assert.ok(md.includes('Target URL:'));
    assert.ok(md.includes('/api/v1/metrics'));
    assert.ok(md.includes('session_id'));
    assert.ok(md.includes('jwt_token'));
    assert.ok(md.includes('Content-Security-Policy'));
  });

  it('exports report to file on disk', () => {
    const testFile = path.join(process.cwd(), 'scratch-test-recon.md');
    try {
      const savedPath = exportReportToFile(testFile, '# Test Recon Output\nSample content');
      assert.ok(fs.existsSync(savedPath));
      const content = fs.readFileSync(savedPath, 'utf-8');
      assert.ok(content.includes('Test Recon Output'));
    } finally {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  });

  it('executes get_cookies and export_report via executeBrowserTool', async () => {
    const mockClient = {
      sendCommand: async () => sampleMeta,
    };

    const cookieRes = await executeBrowserTool(mockClient, 'get_cookies', {});
    assert.equal(cookieRes.success, true);
    assert.equal(cookieRes.data.cookies.length, 2);

    const testExportPath = path.join(process.cwd(), 'scratch-tool-export.md');
    try {
      const exportRes = await executeBrowserTool(mockClient, 'export_report', { filename: testExportPath });
      assert.equal(exportRes.success, true);
      assert.ok(fs.existsSync(testExportPath));
    } finally {
      if (fs.existsSync(testExportPath)) {
        fs.unlinkSync(testExportPath);
      }
    }
  });
});
