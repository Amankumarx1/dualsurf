import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeTargetUrl,
  runAutomatedSecurityAudit,
  generateFullAuditReport,
  formatAutoAuditTerminal,
  auditCookiesFromHeaders,
  auditCspDirectives,
  detectOpenRedirectSuspects,
  generateHtmlAuditReport,
  compareAuditResults,
  formatAuditComparisonTerminal,
} from '../../apps/cli/dist/tools/autoAudit.js';
import { BROWSER_TOOL_DEFINITIONS, executeBrowserTool } from '../../apps/cli/dist/agent/browserTools.js';

describe('Automated Security Audit & Reporting Subsystem', () => {
  const mockResult = {
    targetUrl: 'https://security-lab.internal',
    normalizedUrl: 'https://security-lab.internal/',
    host: 'security-lab.internal',
    port: 443,
    protocol: 'https',
    timestamp: '2026-10-13T12:00:00.000Z',
    reachable: true,
    statusCode: 200,
    durationMs: 42,
    inScope: true,
    scopeNotes: 'Target authorized under RoE Scope: Client Engagement',
    riskRating: 'HIGH',
    securityScore: 65,
    grade: 'D',
    tls: {
      authorized: true,
      issuer: 'Let\'s Encrypt Authority X3',
      validTo: '2026-12-31',
      daysRemaining: 79,
      isExpired: false,
      protocol: 'TLSv1.3',
      cipherName: 'TLS_AES_256_GCM_SHA384',
      subjectAltNames: ['security-lab.internal', 'api.security-lab.internal'],
    },
    headers: {
      score: 40,
      grade: 'F',
      serverBanner: 'nginx/1.24.0',
      items: [
        { name: 'Content-Security-Policy', value: null, status: 'MISSING', severity: 'HIGH', description: 'Mitigates XSS' },
        { name: 'Strict-Transport-Security', value: 'max-age=31536000', status: 'OK', severity: 'PASS', description: 'Enforces HTTPS' },
      ],
    },
    cors: {
      risk: 'HIGH',
      verdict: 'Wildcard origin with credentials allowed',
      allowOrigin: '*',
      allowCredentials: true,
    },
    techProfile: {
      servers: ['nginx/1.24.0'],
      frameworks: ['Express.js', 'React'],
      cms: [],
      cdnWaf: ['Cloudflare'],
    },
    secretsDetected: [
      { type: 'Exposed JWT Token', snippet: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    ],
    endpointsDetected: [
      { id: 1, url: 'https://security-lab.internal/api/v1/users', path: '/api/v1/users', method: 'GET', category: 'api', isExternal: false },
      { id: 2, url: 'https://security-lab.internal/auth/login', path: '/auth/login', method: 'POST', category: 'auth', isExternal: false },
    ],
    findings: [
      {
        id: 'F-001',
        title: 'Missing Content-Security-Policy (CSP)',
        severity: 'HIGH',
        category: 'Security Headers',
        cvssScore: 7.2,
        affectedAsset: 'https://security-lab.internal/',
        description: 'No Content-Security-Policy header defined.',
        impact: 'Elevated risk of Cross-Site Scripting (XSS).',
        remediation: 'Configure strict CSP headers.',
        status: 'Open',
      },
    ],
    reportFilePath: 'audit-report-test.md',
  };

  describe('normalizeTargetUrl()', () => {
    it('prepends https and defaults to port 443 for bare domain', () => {
      const res = normalizeTargetUrl('example.com');
      assert.strictEqual(res.host, 'example.com');
      assert.strictEqual(res.port, 443);
      assert.strictEqual(res.protocol, 'https');
      assert.ok(res.normalizedUrl.startsWith('https://example.com'));
    });

    it('parses custom port and http scheme correctly', () => {
      const res = normalizeTargetUrl('http://127.0.0.1:8080/api/v1');
      assert.strictEqual(res.host, '127.0.0.1');
      assert.strictEqual(res.port, 8080);
      assert.strictEqual(res.protocol, 'http');
      assert.strictEqual(res.normalizedUrl, 'http://127.0.0.1:8080/api/v1');
    });

    it('preserves existing https scheme and port', () => {
      const res = normalizeTargetUrl('https://app.target.internal:8443/auth');
      assert.strictEqual(res.host, 'app.target.internal');
      assert.strictEqual(res.port, 8443);
      assert.strictEqual(res.protocol, 'https');
      assert.strictEqual(res.normalizedUrl, 'https://app.target.internal:8443/auth');
    });
  });

  describe('generateFullAuditReport() and formatAutoAuditTerminal()', () => {
    it('generates structured Markdown report with all compliance sections', () => {
      const markdown = generateFullAuditReport(mockResult);
      assert.ok(markdown.includes('Automated Security Assessment & Penetration Test Report'));
      assert.ok(markdown.includes('## 1. Executive Summary'));
      assert.ok(markdown.includes('## 2. Infrastructure & Technical Fingerprint'));
      assert.ok(markdown.includes('## 3. SSL / TLS Certificate Analysis'));
      assert.ok(markdown.includes('## 4. HTTP Security Headers Matrix'));
      assert.ok(markdown.includes('## 5. Cross-Origin Resource Sharing (CORS) Audit'));
      assert.ok(markdown.includes('## 6. Leaked Secrets & Sensitive Credentials Analysis'));
      assert.ok(markdown.includes('## 7. Attack Surface Endpoints & Forms'));
      assert.ok(markdown.includes('## 8. Detailed Vulnerability Findings & Actionable Remediation'));
      assert.ok(markdown.includes('CVSS v3.1'));
      assert.ok(markdown.includes('7.2'));
    });

    it('formats colorized terminal summary card with key security metrics', () => {
      const terminalCard = formatAutoAuditTerminal(mockResult);
      assert.ok(terminalCard.includes('DUALSURF AUTOMATED SECURITY AUDIT & VULNERABILITY REPORT'));
      assert.ok(terminalCard.includes('security-lab.internal'));
      assert.ok(terminalCard.includes('65 / 100'));
      assert.ok(terminalCard.includes('HIGH'));
      assert.ok(terminalCard.includes('TLS Certificate'));
      assert.ok(terminalCard.includes('Security Headers'));
      assert.ok(terminalCard.includes('CORS Security'));
      assert.ok(terminalCard.includes('TOP SECURITY FINDINGS IDENTIFIED'));
      assert.ok(terminalCard.includes('audit-report-test.md'));
    });
  });

  describe('runAutomatedSecurityAudit() pipeline execution', () => {
    it('executes end-to-end security audit and exports report file to disk', async () => {
      const tempReport = path.join(process.cwd(), `test-audit-${Date.now()}.md`);

      const result = await runAutomatedSecurityAudit('http://127.0.0.1:9999/test-portal', {
        outputPath: tempReport,
        autoExportReport: true,
      });

      assert.ok(result);
      assert.strictEqual(result.host, '127.0.0.1');
      assert.strictEqual(result.port, 9999);
      assert.strictEqual(result.protocol, 'http');
      assert.ok(result.timestamp);
      assert.ok(Array.isArray(result.findings));
      assert.ok(result.reportFilePath);

      // Verify file was written to disk
      assert.ok(fs.existsSync(tempReport), 'Audit report file must exist on disk');
      const content = fs.readFileSync(tempReport, 'utf8');
      assert.ok(content.includes('Automated Security Assessment & Penetration Test Report'));
      assert.ok(content.includes('127.0.0.1'));

      // Clean up test file
      if (fs.existsSync(tempReport)) fs.unlinkSync(tempReport);
      const tempHtml = tempReport.replace(/\.md$/, '.html');
      if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
      const tempJson = tempReport.replace(/\.md$/, '.json');
      if (fs.existsSync(tempJson)) fs.unlinkSync(tempJson);
    });
  });

  describe('AI Agent Tool Definition & Execution', () => {
    it('registers run_automated_security_scan in BROWSER_TOOL_DEFINITIONS', () => {
      const tool = BROWSER_TOOL_DEFINITIONS.find((t) => t.function.name === 'run_automated_security_scan');
      assert.ok(tool, 'Tool run_automated_security_scan must be registered');
      assert.strictEqual(tool.function.parameters.type, 'object');
      assert.ok(tool.function.parameters.properties.url);
    });

    it('executes run_automated_security_scan through executeBrowserTool', async () => {
      const tempReport = path.join(process.cwd(), `test-agent-audit-${Date.now()}.md`);
      const mockClient = {
        sendCommand: async () => ({ url: 'http://127.0.0.1:8888', title: 'Local Test' }),
      };

      const res = await executeBrowserTool(
        mockClient,
        'run_automated_security_scan',
        { url: 'http://127.0.0.1:8888', output_file: tempReport }
      );

      assert.strictEqual(res.tool, 'run_automated_security_scan');
      assert.strictEqual(res.success, true);
      assert.ok(res.data);
      assert.ok(res.message.includes('DUALSURF AUTOMATED SECURITY AUDIT & VULNERABILITY REPORT'));

      if (fs.existsSync(tempReport)) fs.unlinkSync(tempReport);
      const tempHtml = tempReport.replace(/\.md$/, '.html');
      if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
      const tempJson = tempReport.replace(/\.md$/, '.json');
      if (fs.existsSync(tempJson)) fs.unlinkSync(tempJson);
    });
  });

  describe('auditCookiesFromHeaders()', () => {
    it('audits session and standard cookies with missing security flags', () => {
      const rawHeaders = [
        'session_id=abc123xyz; Path=/; Domain=example.com',
        'auth_token=jwt999; Secure; SameSite=Lax; HttpOnly',
        'tracking_pref=dark; SameSite=None',
      ];

      const res = auditCookiesFromHeaders(rawHeaders);
      assert.strictEqual(res.length, 3);

      const sessionCookie = res.find((c) => c.name === 'session_id');
      assert.ok(sessionCookie);
      assert.strictEqual(sessionCookie.hasSecure, false);
      assert.strictEqual(sessionCookie.hasHttpOnly, false);
      assert.strictEqual(sessionCookie.isSessionCookie, true);
      assert.strictEqual(sessionCookie.sameSite, 'Missing');
      assert.ok(sessionCookie.issues.length >= 2);

      const authCookie = res.find((c) => c.name === 'auth_token');
      assert.ok(authCookie);
      assert.strictEqual(authCookie.hasSecure, true);
      assert.strictEqual(authCookie.hasHttpOnly, true);
      assert.strictEqual(authCookie.sameSite, 'Lax');
      assert.strictEqual(authCookie.issues.length, 0);

      const trackCookie = res.find((c) => c.name === 'tracking_pref');
      assert.ok(trackCookie);
      assert.strictEqual(trackCookie.sameSite, 'None');
      assert.ok(trackCookie.issues.some((i) => i.includes('SameSite=None configured without Secure')));
    });
  });

  describe('auditCspDirectives()', () => {
    it('detects unsafe-inline, unsafe-eval, wildcard, and missing base-uri', () => {
      const rawCsp = "default-src 'self' *; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src *";
      const audit = auditCspDirectives(rawCsp);

      assert.strictEqual(audit.hasUnsafeInline, true);
      assert.strictEqual(audit.hasUnsafeEval, true);
      assert.strictEqual(audit.hasWildcard, true);
      assert.strictEqual(audit.missingBaseUri, true);
      assert.ok(audit.issues.length >= 3);
    });

    it('returns hardened result for strict CSP', () => {
      const cleanCsp = "default-src 'self'; script-src 'self' 'nonce-rAnd0m'; object-src 'none'; base-uri 'self';";
      const audit = auditCspDirectives(cleanCsp);

      assert.strictEqual(audit.hasUnsafeInline, false);
      assert.strictEqual(audit.hasUnsafeEval, false);
      assert.strictEqual(audit.hasWildcard, false);
      assert.strictEqual(audit.missingBaseUri, false);
      assert.strictEqual(audit.issues.length, 0);
    });
  });

  describe('detectOpenRedirectSuspects()', () => {
    it('identifies URLs containing redirect, return, and next query parameters', () => {
      const endpoints = [
        { id: 1, url: 'https://app.target.com/login?redirect=https://evil.com', path: '/login?redirect=https://evil.com', method: 'GET', category: 'auth' },
        { id: 2, url: 'https://app.target.com/auth/callback?next=/dashboard', path: '/auth/callback?next=/dashboard', method: 'GET', category: 'auth' },
        { id: 3, url: 'https://app.target.com/api/v1/users', path: '/api/v1/users', method: 'GET', category: 'api' },
      ];

      const suspects = detectOpenRedirectSuspects(endpoints);
      assert.strictEqual(suspects.length, 2);
      assert.ok(suspects.some((s) => s.includes('redirect=')));
      assert.ok(suspects.some((s) => s.includes('next=')));
    });
  });

  describe('generateHtmlAuditReport()', () => {
    it('renders self-contained, air-gap compliant interactive HTML report', () => {
      const html = generateHtmlAuditReport(mockResult);

      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('<html lang="en">'));
      assert.ok(html.includes('Automated Penetration Test & Security Audit Report'));
      assert.ok(html.includes('security-lab.internal'));
      assert.ok(html.includes('65%'));
      assert.ok(html.includes('Grade D'));
      assert.ok(html.includes('Missing Content-Security-Policy'));
      assert.ok(html.includes('@media print'));
      // Verify 100% offline (no CDN references)
      assert.ok(!html.includes('cdn.'), 'Report must not reference external CDNs');
      assert.ok(!html.includes('googleapis.com'), 'Report must not fetch remote fonts');
    });
  });

  describe('compareAuditResults() & formatAuditComparisonTerminal()', () => {
    it('calculates score deltas and partitions resolved vs new findings', () => {
      const prevResult = {
        ...mockResult,
        timestamp: '2026-10-10T10:00:00.000Z',
        securityScore: 50,
        grade: 'F',
        findings: [
          { id: 'F-001', title: 'Missing Content-Security-Policy (CSP)', severity: 'HIGH', cvssScore: 7.2, remediation: 'Fix CSP' },
          { id: 'F-002', title: 'Cleartext HTTP Transport', severity: 'HIGH', cvssScore: 7.5, remediation: 'Enable HTTPS' },
        ],
      };

      const currResult = {
        ...mockResult,
        timestamp: '2026-10-13T12:00:00.000Z',
        securityScore: 78,
        grade: 'B',
        findings: [
          // Cleartext HTTP fixed!
          // Missing CSP persists:
          { id: 'F-001', title: 'Missing Content-Security-Policy (CSP)', severity: 'HIGH', cvssScore: 7.2, remediation: 'Fix CSP' },
          // New finding introduced:
          { id: 'F-003', title: 'Sensitive Session Cookie Missing HttpOnly Flag', severity: 'MEDIUM', cvssScore: 6.5, remediation: 'Add HttpOnly' },
        ],
      };

      const diff = compareAuditResults(prevResult, currResult);
      assert.strictEqual(diff.previousScore, 50);
      assert.strictEqual(diff.currentScore, 78);
      assert.strictEqual(diff.scoreDelta, 28);
      assert.strictEqual(diff.gradeChange, 'F -> B');

      assert.strictEqual(diff.resolvedFindings.length, 1);
      assert.strictEqual(diff.resolvedFindings[0].title, 'Cleartext HTTP Transport');

      assert.strictEqual(diff.newFindings.length, 1);
      assert.strictEqual(diff.newFindings[0].title, 'Sensitive Session Cookie Missing HttpOnly Flag');

      assert.strictEqual(diff.unresolvedFindings.length, 1);
      assert.strictEqual(diff.unresolvedFindings[0].title, 'Missing Content-Security-Policy (CSP)');

      const terminalOutput = formatAuditComparisonTerminal(diff);
      assert.ok(terminalOutput.includes('+28 pts'));
      assert.ok(terminalOutput.includes('F -> B'));
      assert.ok(terminalOutput.includes('RESOLVED VULNERABILITIES'));
      assert.ok(terminalOutput.includes('Cleartext HTTP Transport'));
      assert.ok(terminalOutput.includes('NEW VULNERABILITIES DETECTED'));
      assert.ok(terminalOutput.includes('Sensitive Session Cookie Missing HttpOnly Flag'));
    });
  });
});

