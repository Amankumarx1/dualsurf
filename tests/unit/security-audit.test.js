import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scanForSecrets,
  auditPassiveSecurity,
  detectTechnologies,
  formatSecurityAudit,
  formatCorsAnalysis,
  formatTechProfile,
} from '../../apps/cli/dist/tools/securityAudit.js';
import { BROWSER_TOOL_DEFINITIONS } from '../../apps/cli/dist/agent/browserTools.js';

describe('Cyber Security Audit & Hygiene Subsystem', () => {
  describe('scanForSecrets()', () => {
    it('detects AWS access keys', () => {
      const content = 'Config: AWS_KEY="AKIAIOSFODNN7EXAMPLE" in production env';
      const results = scanForSecrets(content);
      assert.ok(results.length > 0, 'Must detect AWS key');
      assert.strictEqual(results[0].type, 'AWS Access Key ID');
      assert.strictEqual(results[0].snippet, 'AKIAIOSFODNN7EXAMPLE');
    });

    it('detects exposed JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const content = `localStorage.setItem('auth_token', '${jwt}');`;
      const results = scanForSecrets(content);
      assert.ok(results.some((r) => r.type === 'Exposed JWT Token'), 'Must detect JWT token');
    });

    it('detects private key headers', () => {
      const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...';
      const results = scanForSecrets(content);
      assert.ok(results.some((r) => r.type === 'Private Key Header Exposure'));
    });

    it('detects internal RFC1918 private IP addresses', () => {
      const content = 'Connecting to backend cluster at 192.168.1.150:8080 and 10.0.0.5';
      const results = scanForSecrets(content);
      assert.ok(results.some((r) => r.type === 'Internal IP Leakage'));
    });

    it('returns empty array on clean text', () => {
      const content = 'Welcome to DualSurf documentation and standard portal.';
      const results = scanForSecrets(content);
      assert.strictEqual(results.length, 0);
    });
  });

  describe('auditPassiveSecurity()', () => {
    const mockInsecureMeta = {
      title: 'Insecure Lab Portal',
      url: 'http://lab.local/login',
      isLoading: false,
      headings: [{ level: 1, text: 'Login' }],
      links: [
        { id: 1, label: 'External Partner', href: 'https://partner.com', target: '_blank', rel: '' },
      ],
      endpoints: [],
      forms: [
        {
          id: 'login-form',
          name: 'login',
          action: 'http://lab.local/auth',
          method: 'POST',
          hasPassword: true,
          hasCsrfToken: false,
          isCleartext: true,
          inputs: [{ name: 'user', type: 'text' }, { name: 'pass', type: 'password' }],
        },
      ],
      securitySignals: {
        tabnabbingCount: 1,
        insecureLinksCount: 2,
        externalScriptsCount: 3,
        metaGenerator: 'WordPress 5.8',
      },
      textSnippet: 'Contact admin at 10.10.10.254',
      storage: [],
      cookies: [],
    };

    it('flags unencrypted transport and cleartext form actions', () => {
      const report = auditPassiveSecurity(mockInsecureMeta);
      assert.ok(report.issues.some((i) => i.id === 'SEC-TRANS-01'), 'Must flag plain HTTP URL');
      assert.ok(report.issues.some((i) => i.id === 'SEC-FORM-01'), 'Must flag plain HTTP form action');
      assert.ok(report.issues.some((i) => i.id === 'SEC-FORM-03'), 'Must flag form missing CSRF token');
      assert.ok(report.issues.some((i) => i.id === 'SEC-DOM-01'), 'Must flag reverse tabnabbing');
      assert.ok(report.issues.some((i) => i.id === 'SEC-DOM-02'), 'Must flag mixed content');
      assert.ok(report.score < 60, `Score should reflect vulnerabilities (got ${report.score})`);
      assert.ok(['CRITICAL', 'HIGH'].includes(report.riskLevel));
    });

    it('evaluates clean modern HTTPS metadata with high score', () => {
      const cleanMeta = {
        title: 'Secure Dashboard',
        url: 'https://secure.dualsurf.local/app',
        isLoading: false,
        headings: [{ level: 1, text: 'Dashboard' }],
        links: [],
        endpoints: [],
        forms: [
          {
            id: 'secure-form',
            action: 'https://secure.dualsurf.local/api/save',
            method: 'POST',
            hasPassword: false,
            hasCsrfToken: true,
            isCleartext: false,
            inputs: [{ name: 'csrf_token', type: 'hidden' }],
          },
        ],
        securitySignals: {
          tabnabbingCount: 0,
          insecureLinksCount: 0,
          externalScriptsCount: 1,
        },
        textSnippet: 'All systems operational.',
        storage: [],
        cookies: [],
      };

      const mockSecureHeaders = {
        url: cleanMeta.url,
        score: 100,
        grade: 'A+',
        missing: [],
        present: [
          { name: 'Content-Security-Policy', value: "default-src 'self'", status: 'present', description: 'CSP' },
          { name: 'Strict-Transport-Security', value: 'max-age=31536000', status: 'present', description: 'HSTS' },
          { name: 'X-Frame-Options', value: 'DENY', status: 'present', description: 'Clickjacking' },
          { name: 'X-Content-Type-Options', value: 'nosniff', status: 'present', description: 'MIME' },
        ],
        warnings: [],
      };

      const report = auditPassiveSecurity(cleanMeta, mockSecureHeaders);
      assert.strictEqual(report.riskLevel, 'CLEAN');
      assert.strictEqual(report.score, 100);
      assert.strictEqual(report.issues.length, 0);
    });

    it('formats security audit output with colored summary', () => {
      const report = auditPassiveSecurity(mockInsecureMeta);
      const formatted = formatSecurityAudit(report);
      assert.ok(formatted.includes('CYBER SECURITY VULNERABILITY AUDIT'));
      assert.ok(formatted.includes('Risk Rating:'));
      assert.ok(formatted.includes('Security Hygiene Score:'));
    });
  });

  describe('detectTechnologies()', () => {
    it('detects server, frameworks, CMS and WAF from signals', () => {
      const url = 'https://portal.example.com';
      const scripts = [
        'https://cdn.example.com/assets/react.production.min.js',
        'https://cdn.example.com/wp-content/themes/theme/main.js',
      ];
      const headers = {
        url,
        score: 80,
        grade: 'B',
        missing: [],
        present: [
          { name: 'Server', value: 'cloudflare', status: 'warning', description: 'Server banner' },
          { name: 'X-Powered-By', value: 'Express', status: 'warning', description: 'Framework' },
        ],
        warnings: [],
      };

      const tech = detectTechnologies(url, scripts, headers);
      assert.ok(tech.frameworks.some((f) => f.includes('React')), 'Must detect React');
      assert.ok(tech.frameworks.includes('Express.js'), 'Must detect Express.js');
      assert.ok(tech.cms.includes('WordPress'), 'Must detect WordPress');
      assert.ok(tech.cdnWaf.includes('Cloudflare'), 'Must detect Cloudflare');
    });

    it('formats tech profile into structured text', () => {
      const tech = detectTechnologies('https://test.com', [], undefined);
      const formatted = formatTechProfile(tech);
      assert.ok(formatted.includes('TECHNOLOGY & INFRASTRUCTURE FINGERPRINT'));
    });
  });

  describe('AI Agent Browser Tools Integration', () => {
    it('registers all cyber security tools in BROWSER_TOOL_DEFINITIONS', () => {
      const toolNames = BROWSER_TOOL_DEFINITIONS.map((t) => t.function.name);
      assert.ok(toolNames.includes('audit_security_hygiene'), 'audit_security_hygiene must be registered');
      assert.ok(toolNames.includes('get_tls_certificate'), 'get_tls_certificate must be registered');
      assert.ok(toolNames.includes('analyze_cors'), 'analyze_cors must be registered');
      assert.ok(toolNames.includes('detect_technologies'), 'detect_technologies must be registered');
      assert.ok(toolNames.includes('scan_secrets'), 'scan_secrets must be registered');
    });
  });
});
