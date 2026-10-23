import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAttackSurfaceRegister,
  formatAttackSurfaceTerminal,
} from '../../apps/cli/dist/tools/attackSurface.js';
import {
  generateFullAuditReport,
  generateHtmlAuditReport,
  formatAutoAuditTerminal,
} from '../../apps/cli/dist/tools/autoAudit.js';
import { generateSarifReport } from '../../apps/cli/dist/tools/sarif.js';
import { generateDeterministicRemediationGuide } from '../../apps/cli/dist/tools/aiRemediation.js';
import { scanFrontendDependencies, compareSemver } from '../../apps/cli/dist/tools/dependencyScanner.js';
import { auditTlsCrypto } from '../../apps/cli/dist/tools/securityAudit.js';
import { generateGitHubActionWorkflow } from '../../apps/cli/dist/tools/cicdWorkflow.js';

describe('Complete Attack Surface Discovery & Assessment Engine', () => {
  describe('Attack Surface Asset Register Construction', () => {
    it('correlates domain, TLS SAN subdomains, and endpoints into classified asset register', () => {
      const host = 'dualsurf.security';
      const ipList = ['104.21.45.10', '172.67.180.20'];
      const sanList = [
        'dualsurf.security',
        '*.dualsurf.security',
        'api.dualsurf.security',
        'admin.dualsurf.security',
        'staging.dualsurf.security',
        'dev-test.dualsurf.security',
        'mail.dualsurf.security',
        'storage-cdn.dualsurf.security',
      ];
      const endpoints = [
        { id: 1, url: 'https://api.dualsurf.security/v1/auth', path: '/v1/auth', category: 'api', isExternal: false },
        { id: 2, url: 'https://portal.dualsurf.security/dashboard', path: '/dashboard', category: 'action', isExternal: false },
      ];

      const register = buildAttackSurfaceRegister(host, ipList, sanList, endpoints);

      assert.ok(register.length >= 7, 'Should discover and categorize at least 7 unique assets');

      const apex = register.find((a) => a.hostname === 'dualsurf.security');
      assert.ok(apex);
      assert.equal(apex.assetType, 'domain');
      assert.equal(apex.environment, 'production');
      assert.equal(apex.ip, '104.21.45.10');

      const apiAsset = register.find((a) => a.hostname === 'api.dualsurf.security');
      assert.ok(apiAsset);
      assert.equal(apiAsset.assetType, 'api');
      assert.equal(apiAsset.environment, 'production');

      const adminAsset = register.find((a) => a.hostname === 'admin.dualsurf.security');
      assert.ok(adminAsset);
      assert.equal(adminAsset.assetType, 'admin');

      const stagingAsset = register.find((a) => a.hostname === 'staging.dualsurf.security');
      assert.ok(stagingAsset);
      assert.equal(stagingAsset.assetType, 'staging');
      assert.equal(stagingAsset.environment, 'staging');

      const devAsset = register.find((a) => a.hostname === 'dev-test.dualsurf.security');
      assert.ok(devAsset);
      assert.equal(devAsset.environment, 'development');

      const portalAsset = register.find((a) => a.hostname === 'portal.dualsurf.security');
      assert.ok(portalAsset);
      assert.equal(portalAsset.source, 'endpoint');
    });
  });

  describe('Terminal Attack Surface & Email Posture Formatter', () => {
    it('formats attack surface and domain authentication posture into colorized terminal text', () => {
      const mockAssets = [
        {
          hostname: 'app.example.com',
          assetType: 'domain',
          environment: 'production',
          source: 'dns',
          publiclyExposed: true,
          inScope: true,
        },
        {
          hostname: 'staging.example.com',
          assetType: 'staging',
          environment: 'staging',
          source: 'san',
          publiclyExposed: true,
          inScope: true,
        },
      ];

      const mockEmail = {
        hasSpf: true,
        spfRecord: 'v=spf1 include:_spf.google.com ~all',
        hasDmarc: true,
        dmarcPolicy: 'reject',
        dmarcRecord: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com',
        mxRecords: ['aspmx.l.google.com (Priority: 1)'],
        issues: [],
      };

      const mockAdminChecks = [
        {
          path: '/.env',
          url: 'https://app.example.com/.env',
          status: 403,
          exposed: false,
          notes: 'Protected interface detected.',
        },
        {
          path: '/admin',
          url: 'https://app.example.com/admin',
          status: 200,
          exposed: true,
          notes: 'Administrative interface directly accessible.',
        },
      ];

      const output = formatAttackSurfaceTerminal(mockAssets, mockEmail, mockAdminChecks);

      assert.ok(output.includes('EXTERNAL ATTACK SURFACE & ASSET INVENTORY'));
      assert.ok(output.includes('app.example.com'));
      assert.ok(output.includes('staging.example.com'));
      assert.ok(output.includes('EMAIL & DOMAIN AUTHENTICATION POSTURE'));
      assert.ok(output.includes('SPF Record:'));
      assert.ok(output.includes('DMARC Policy:'));
      assert.ok(output.includes('REJECT'));
      assert.ok(output.includes('ADMINISTRATIVE & SENSITIVE INTERFACES PROBED'));
      assert.ok(output.includes('/admin'));
    });
  });

  describe('Single-Command Assessment Report Integration', () => {
    const fullMockResult = {
      targetUrl: 'https://bank.secure.internal',
      normalizedUrl: 'https://bank.secure.internal/',
      host: 'bank.secure.internal',
      port: 443,
      protocol: 'https',
      timestamp: '2026-10-14T05:30:00.000Z',
      reachable: true,
      statusCode: 200,
      durationMs: 120,
      inScope: true,
      riskRating: 'CRITICAL',
      securityScore: 40,
      grade: 'D',
      techProfile: {
        servers: ['nginx/1.24.0'],
        frameworks: ['Next.js'],
        cms: [],
        cdnWaf: ['Cloudflare'],
      },
      headers: {
        score: 75,
        grade: 'B',
        serverBanner: 'nginx',
        items: [],
      },
      cors: {
        risk: 'CLEAN',
        verdict: 'Origins restricted',
      },
      secretsDetected: [],
      endpointsDetected: [],
      findings: [
        {
          id: 'FIND-2026-001',
          title: 'Critical Public Exposure: Environment Configuration File (/.env)',
          severity: 'CRITICAL',
          cvssScore: 9.8,
          affectedAsset: 'https://bank.secure.internal/',
          category: 'A05:2021 Security Misconfiguration',
          description: 'Live .env file exposed publicly.',
          impact: 'Full database and token compromise.',
          remediation: 'Deny web access to dotfiles in Nginx.',
          status: 'Open',
          createdAt: '2026-10-14T05:30:00.000Z',
        },
        {
          id: 'FIND-2026-002',
          title: 'Missing RFC 7489 DMARC Domain Authentication Policy',
          severity: 'MEDIUM',
          cvssScore: 5.8,
          affectedAsset: 'https://bank.secure.internal/',
          category: 'A05:2021 Security Misconfiguration',
          description: 'No DMARC policy defined in DNS.',
          impact: 'Email impersonation / phishing susceptibility.',
          remediation: 'Publish DMARC TXT record.',
          status: 'Open',
          createdAt: '2026-10-14T05:30:00.000Z',
        },
        {
          id: 'FIND-2026-003',
          title: 'Missing Content-Security-Policy (CSP) Header',
          severity: 'HIGH',
          cvssScore: 7.5,
          affectedAsset: 'https://bank.secure.internal/',
          category: 'A05:2021 Security Misconfiguration',
          description: 'No Content-Security-Policy header defined.',
          impact: 'Allows XSS and unauthorized script execution.',
          remediation: 'Configure Content-Security-Policy header.',
          status: 'Open',
          createdAt: '2026-10-14T05:30:00.000Z',
        },
      ],
      dnsRecords: [
        { type: 'A', value: '198.51.100.1' },
        { type: 'MX', value: 'mail.bank.secure.internal (Priority: 10)' },
      ],
      emailSecurity: {
        hasSpf: true,
        spfRecord: 'v=spf1 mx -all',
        hasDmarc: false,
        dmarcPolicy: 'missing',
        mxRecords: ['mail.bank.secure.internal (Priority: 10)'],
        issues: ['Missing RFC 7489 DMARC policy record at _dmarc.bank.secure.internal'],
      },
      attackSurfaceRegister: [
        {
          hostname: 'bank.secure.internal',
          ip: '198.51.100.1',
          assetType: 'domain',
          environment: 'production',
          source: 'dns',
          publiclyExposed: true,
          inScope: true,
        },
        {
          hostname: 'api.bank.secure.internal',
          assetType: 'api',
          environment: 'production',
          source: 'san',
          publiclyExposed: true,
          inScope: true,
        },
        {
          hostname: 'staging.bank.secure.internal',
          assetType: 'staging',
          environment: 'staging',
          source: 'san',
          publiclyExposed: true,
          inScope: true,
        },
      ],
      adminInterfaces: [
        {
          path: '/.env',
          url: 'https://bank.secure.internal/.env',
          status: 200,
          exposed: true,
          notes: 'Critical: Sensitive environment configuration file exposed publicly!',
        },
        {
          path: '/admin',
          url: 'https://bank.secure.internal/admin',
          status: 401,
          exposed: false,
          notes: 'Protected interface detected (Authentication required).',
        },
      ],
      portAudit: {
        host: 'bank.secure.internal',
        scannedPortsCount: 12,
        openPortsCount: 1,
        highRiskCount: 0,
        durationMs: 40,
        openPorts: [
          {
            port: 443,
            protocol: 'tcp',
            state: 'open',
            service: 'HTTPS',
            risk: 'INFO',
            latencyMs: 12,
          },
        ],
        timestamp: '2026-10-14T05:30:00.000Z',
      },
      cloudStorage: [
        {
          provider: 'aws',
          bucketName: 'bank-secure-backup',
          url: 'https://bank-secure-backup.s3.amazonaws.com',
          status: 'open',
          publiclyReadable: true,
          listingEnabled: true,
          details: 'Critical: Public cloud storage bucket with directory listing enabled!',
        },
      ],
      subdomainTakeovers: [
        {
          subdomain: 'status.bank.secure.internal',
          cnameDestination: 'bank-status.herokuapp.com',
          service: 'Heroku',
          vulnerable: true,
          evidence: 'CNAME points to bank-status.herokuapp.com. Destination returns signature "no such app".',
        },
      ],
      apiDiscovery: {
        openApiFound: true,
        openApiUrl: 'https://bank.secure.internal/openapi.json',
        openApiTitle: 'Bank Core API',
        endpointsCount: 42,
        graphQlFound: true,
        graphQlUrl: 'https://bank.secure.internal/graphql',
        graphQlIntrospectionEnabled: true,
        typesCount: 28,
      },
      aiRemediationSummary: '### Tailored Security Remediation\n1. Add Strict-Transport-Security: max-age=31536000\n2. Bind port 3306 to 127.0.0.1.',
      sarifReportPath: '/tmp/audit-bank.sarif',
      authenticatedAudit: true,
    };

    it('renders attack surface register, DNS posture, admin routes, cloud buckets, and takeovers in Markdown report', () => {
      const md = generateFullAuditReport(fullMockResult);
      assert.ok(md.includes('## 1.5. Discovered Attack Surface & Asset Register'));
      assert.ok(md.includes('api.bank.secure.internal'));
      assert.ok(md.includes('staging.bank.secure.internal'));
      assert.ok(md.includes('## 1.6. DNS & Email Authentication Posture'));
      assert.ok(md.includes('SPF (Sender Policy Framework)'));
      assert.ok(md.includes('DMARC Policy (RFC 7489)'));
      assert.ok(md.includes('## 1.7. Sensitive & Administrative Interface Probes'));
      assert.ok(md.includes('/.env'));
      assert.ok(md.includes('EXPOSED PUBLICLY'));
      assert.ok(md.includes('## 1.8. Cloud Storage Bucket Exposure Audit'));
      assert.ok(md.includes('bank-secure-backup'));
      assert.ok(md.includes('## 1.9. Subdomain Takeover & Dangling CNAME Audit'));
      assert.ok(md.includes('status.bank.secure.internal'));
      assert.ok(md.includes('## 1.10. Modern API Specifications & GraphQL Introspection'));
      assert.ok(md.includes('Bank Core API'));
      assert.ok(md.includes('## 9. Automated AI & DevSecOps Remediation Playbook'));
      assert.ok(md.includes('Tailored Security Remediation'));
    });

    it('renders complete attack surface sections, cloud buckets, and takeovers in Interactive HTML report', () => {
      const html = generateHtmlAuditReport(fullMockResult);
      assert.ok(html.includes('External Attack Surface &amp; Asset Register') || html.includes('External Attack Surface & Asset Register'));
      assert.ok(html.includes('Email &amp; Domain Authentication Posture') || html.includes('Email & Domain Authentication Posture'));
      assert.ok(html.includes('Administrative &amp; Sensitive Interface Probes') || html.includes('Administrative & Sensitive Interface Probes'));
      assert.ok(html.includes('Cloud Storage Bucket Exposure'));
      assert.ok(html.includes('bank-secure-backup'));
      assert.ok(html.includes('Subdomain Takeover &amp; Dangling CNAME Audits') || html.includes('Subdomain Takeover & Dangling CNAME Audits'));
      assert.ok(html.includes('API Specification &amp; GraphQL Introspection Audit') || html.includes('API Specification & GraphQL Introspection Audit'));
      assert.ok(html.includes('Automated AI &amp; DevSecOps Remediation Playbook') || html.includes('Automated AI & DevSecOps Remediation Playbook'));
      assert.ok(html.includes('api.bank.secure.internal'));
      assert.ok(html.includes('staging.bank.secure.internal'));
      assert.ok(html.includes('/.env'));
    });

    it('renders attack surface metrics, cloud buckets, takeovers, and SARIF in terminal audit display', () => {
      const term = formatAutoAuditTerminal(fullMockResult);
      assert.ok(term.includes('Attack Surface:'));
      assert.ok(term.includes('discovered external assets'));
      assert.ok(term.includes('Email Posture:'));
      assert.ok(term.includes('DMARC MISSING'));
      assert.ok(term.includes('Admin Interfaces:'));
      assert.ok(term.includes('/.env'));
      assert.ok(term.includes('Cloud Storage:'));
      assert.ok(term.includes('PUBLIC READ BUCKETS DETECTED'));
      assert.ok(term.includes('Subdomain Takeovers:'));
      assert.ok(term.includes('VULNERABLE TO TAKEOVER'));
      assert.ok(term.includes('APIs & GraphQL:'));
      assert.ok(term.includes('GitHub SARIF 2.1:'));
      assert.ok(term.includes('AUTHENTICATED'));
    });

    it('generates valid OASIS SARIF v2.1.0 document compliant with GitHub Code Scanning', () => {
      const sarif = generateSarifReport(fullMockResult);
      assert.equal(sarif.version, '2.1.0');
      assert.ok(Array.isArray(sarif.runs));
      assert.equal(sarif.runs.length, 1);
      const run = sarif.runs[0];
      assert.equal(run.tool.driver.name, 'DualSurf Security Assessment Engine');
      assert.ok(Array.isArray(run.tool.driver.rules));
      assert.ok(Array.isArray(run.results));
      assert.ok(run.tool.driver.rules.some((r) => r.id === 'FIND-2026-001'));
      assert.ok(run.results.some((res) => res.ruleId === 'FIND-2026-001' && res.level === 'error'));
    });

    it('generates deterministic technology-tailored remediation code snippets', () => {
      const playbook = generateDeterministicRemediationGuide(fullMockResult);
      assert.ok(playbook.includes('Automated Security Remediation Playbook'));
      assert.ok(playbook.includes('Nginx Configuration'));
      assert.ok(playbook.includes('Content-Security-Policy'));
      assert.ok(playbook.includes('v=DMARC1; p=reject'));
      assert.ok(playbook.includes('GraphQL Introspection Hardening'));
    });
  });

  describe('Next-Tier Advanced Security Audit Capabilities', () => {
    it('compares semantic versions accurately across minor and patch differences', () => {
      assert.equal(compareSemver('3.4.1', '3.5.0'), -1);
      assert.equal(compareSemver('4.17.21', '4.17.21'), 0);
      assert.equal(compareSemver('5.0.0', '4.3.1'), 1);
      assert.equal(compareSemver('v1.8.0', '1.8.0'), 0);
    });

    it('scans frontend dependencies in HTML and matches against CVE advisories', () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://code.jquery.com/jquery-3.4.1.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.15/lodash.min.js"></script>
          <script src="/static/js/bootstrap-4.2.1.js"></script>
        </head>
        <body><h1>Target App</h1></body>
        </html>
      `;

      const deps = scanFrontendDependencies(mockHtml);
      assert.ok(deps.length >= 3);

      const jq = deps.find((d) => d.library === 'jQuery');
      assert.ok(jq);
      assert.equal(jq.detectedVersion, '3.4.1');
      assert.ok(jq.cveList.some((c) => c.cveId === 'CVE-2020-11022'));

      const lodash = deps.find((d) => d.library === 'Lodash');
      assert.ok(lodash);
      assert.equal(lodash.detectedVersion, '4.17.15');
      assert.ok(lodash.cveList.some((c) => c.cveId === 'CVE-2021-23337'));

      const bs = deps.find((d) => d.library === 'Bootstrap');
      assert.ok(bs);
      assert.equal(bs.detectedVersion, '4.2.1');
      assert.ok(bs.cveList.some((c) => c.cveId === 'CVE-2019-8331'));
    });

    it('audits deep TLS cryptographic posture for legacy protocols and weak ciphers', () => {
      // Test 1: Insecure TLS 1.0 with CBC cipher
      const legacyTls = auditTlsCrypto('TLSv1.0', 'ECDHE-RSA-AES128-SHA');
      assert.equal(legacyTls.isDeprecatedProtocol, true);
      assert.ok(legacyTls.flaws.some((f) => f.includes('Deprecated and insecure transport protocol')));

      // Test 2: RC4 cipher
      const rc4Cipher = auditTlsCrypto('TLSv1.2', 'RC4-SHA');
      assert.equal(rc4Cipher.isWeakCipher, true);
      assert.ok(rc4Cipher.flaws.some((f) => f.includes('RC4')));

      // Test 3: Modern hardened TLS 1.3
      const modernTls = auditTlsCrypto('TLSv1.3', 'TLS_AES_256_GCM_SHA384');
      assert.equal(modernTls.isDeprecatedProtocol, false);
      assert.equal(modernTls.isWeakCipher, false);
      assert.equal(modernTls.hasPfs, true);
      assert.equal(modernTls.flaws.length, 0);
    });

    it('incorporates Certificate Transparency subdomains into attack surface register', () => {
      const host = 'airgap-enterprise.org';
      const ctSubdomains = ['ct-vault.airgap-enterprise.org', 'ct-api.airgap-enterprise.org'];
      const register = buildAttackSurfaceRegister(host, ['1.1.1.1'], [], [], ctSubdomains);

      assert.ok(register.some((a) => a.hostname === 'ct-vault.airgap-enterprise.org' && a.source === 'san'));
      assert.ok(register.some((a) => a.hostname === 'ct-api.airgap-enterprise.org' && a.assetType === 'api'));
    });

    it('generates compliant GitHub Actions continuous security workflow with SARIF upload', () => {
      const yaml = generateGitHubActionWorkflow({
        targetUrl: 'https://security.example.corp',
        workflowName: 'Nightly Pentest Gate',
      });

      assert.ok(yaml.includes('name: Nightly Pentest Gate'));
      assert.ok(yaml.includes('dualsurf assess'));
      assert.ok(yaml.includes('upload-sarif'));
      assert.ok(yaml.includes('reports/audit.sarif'));
      assert.ok(yaml.includes('security.example.corp'));
    });
  });
});

