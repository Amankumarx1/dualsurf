import * as fs from 'fs';
import * as path from 'path';
import type {
  AutoAuditOptions,
  FullSecurityAuditResult,
  PentestFinding,
  EndpointItem,
  SecurityHeaderItem,
  PageMetadata,
  CookieSecurityCheck,
  CspDirectiveAudit,
  AuditComparisonDiff,
  PortScanReport,
  OpenPortInfo,
  DnsAuditRecord,
  EmailSecurityPosture,
  AttackSurfaceAsset,
  AdminInterfaceCheck,
  CloudStorageAudit,
  SubdomainTakeoverCheck,
  ApiDiscoveryResult,
  VulnerableDependency,
  TlsCryptoAudit,
} from '@dualsurf/shared-types';
import { analyzeSecurityHeaders, type SecurityHeaderAnalysisResult } from './recon.js';
import {
  inspectTlsCertificate,
  analyzeCorsPolicy,
  detectTechnologies,
  scanForSecrets,
  auditTlsCrypto,
} from './securityAudit.js';
import { engagementStore } from './redTeam.js';
import { colors } from '../formatters.js';
import { scanPorts } from './portScan.js';
import {
  auditDnsAndEmail,
  probeAdminInterfaces,
  buildAttackSurfaceRegister,
  auditCloudStorageBuckets,
  auditSubdomainTakeovers,
  auditApiAndGraphQl,
  harvestCertificateTransparencySubdomains,
} from './attackSurface.js';
import { exportSarifToDisk, sendSecurityWebhook } from './sarif.js';
import { generateAiRemediationPlan } from './aiRemediation.js';
import { scanFrontendDependencies } from './dependencyScanner.js';
import { writeGitHubActionWorkflow } from './cicdWorkflow.js';
import { OllamaClient } from '../ollama/index.js';

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeTargetUrl(target: string): {
  normalizedUrl: string;
  host: string;
  port: number;
  protocol: 'http' | 'https';
} {
  let raw = (target || '').trim();
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = `https://${raw}`;
  }
  const u = new URL(raw);
  const protocol: 'http' | 'https' = u.protocol === 'http:' ? 'http' : 'https';
  const port = u.port ? parseInt(u.port, 10) : protocol === 'https' ? 443 : 80;
  return {
    normalizedUrl: u.toString(),
    host: u.hostname,
    port,
    protocol,
  };
}

/**
 * Extract links and form actions from HTML and categorize them.
 */
export function extractEndpointsFromHtml(html: string, baseUrl: string): EndpointItem[] {
  const endpoints: EndpointItem[] = [];
  let currentOrigin = '';
  try {
    currentOrigin = new URL(baseUrl).origin;
  } catch {
    currentOrigin = '';
  }

  const seen = new Set<string>();
  let idCounter = 1;

  // Extract <form action="..." method="...">
  const formRegex = /<form\b[^>]*?\baction=(["'])(.*?)\1[^>]*>/gi;
  let formMatch: RegExpExecArray | null;
  while ((formMatch = formRegex.exec(html)) !== null) {
    const rawAction = formMatch[2];
    const fullTag = formMatch[0];
    const methodMatch = fullTag.match(/\bmethod=(["'])(.*?)\1/i);
    const method = methodMatch ? methodMatch[2].toUpperCase() : 'GET';
    try {
      const fullUrl = new URL(rawAction, baseUrl).toString();
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        const parsed = new URL(fullUrl);
        endpoints.push({
          id: idCounter++,
          url: fullUrl,
          path: parsed.pathname + (parsed.search || ''),
          method,
          category: 'form',
          isExternal: currentOrigin ? parsed.origin !== currentOrigin : false,
        });
      }
    } catch {}
  }

  // Extract <a href="...">
  const aRegex = /<a\b[^>]*?\bhref=(["'])(.*?)\1[^>]*>/gi;
  let aMatch: RegExpExecArray | null;
  while ((aMatch = aRegex.exec(html)) !== null) {
    const rawHref = aMatch[2].trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) continue;
    try {
      const fullUrl = new URL(rawHref, baseUrl).toString();
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        const parsed = new URL(fullUrl);
        const urlPath = parsed.pathname.toLowerCase();
        const urlHost = parsed.hostname.toLowerCase();
        const isExternal = currentOrigin ? parsed.origin !== currentOrigin : false;
        let category: EndpointItem['category'] = 'internal';

        if (isExternal) {
          category = 'external';
        } else if (/\.(zip|tar\.gz|tgz|gz|deb|rpm|appimage|exe|dmg|pkg|iso|pdf|docx?|xlsx?)$/i.test(urlPath)) {
          category = 'download';
        } else if (/(^|\/)api(\/|$)|graphql|\/v\d+\/|\.json|\.xml|rest/i.test(urlPath) || /^api\./i.test(urlHost)) {
          category = 'api';
        } else if (/(login|signin|logout|signout|signup|register|oauth|auth|sso|session|password|forgot)/i.test(urlPath)) {
          category = 'auth';
        } else if (/(create|update|delete|edit|checkout|cart|subscribe|webhook)/i.test(urlPath)) {
          category = 'action';
        }

        const endpointPath = isExternal
          ? parsed.hostname + (parsed.pathname === '/' ? '' : parsed.pathname) + (parsed.search || '')
          : parsed.pathname + (parsed.search || '');

        endpoints.push({
          id: idCounter++,
          url: fullUrl,
          path: endpointPath,
          method: 'GET',
          category,
          isExternal,
        });
      }
    } catch {}
  }

  return endpoints;
}

/**
 * Audit Set-Cookie response headers for security flags (Secure, HttpOnly, SameSite).
 */
export function auditCookiesFromHeaders(setCookieHeaders: string[]): CookieSecurityCheck[] {
  const results: CookieSecurityCheck[] = [];
  for (const raw of setCookieHeaders) {
    const parts = raw.split(';').map((p) => p.trim());
    if (!parts.length) continue;
    const [nameVal] = parts;
    const cookieName = nameVal.split('=')[0]?.trim() || '';
    if (!cookieName) continue;

    const lowerParts = parts.map((p) => p.toLowerCase());
    const hasSecure = lowerParts.some((p) => p === 'secure');
    const hasHttpOnly = lowerParts.some((p) => p === 'httponly');

    let sameSite: 'Strict' | 'Lax' | 'None' | 'Missing' = 'Missing';
    const sameSitePart = lowerParts.find((p) => p.startsWith('samesite='));
    if (sameSitePart) {
      if (sameSitePart.includes('strict')) sameSite = 'Strict';
      else if (sameSitePart.includes('lax')) sameSite = 'Lax';
      else if (sameSitePart.includes('none')) sameSite = 'None';
    }

    const isSessionCookie = /session|token|auth|id|jwt|sid|login/i.test(cookieName);
    const issues: string[] = [];
    if (!hasSecure) issues.push('Missing Secure flag (cleartext transmission risk)');
    if (isSessionCookie && !hasHttpOnly) issues.push('Missing HttpOnly flag on sensitive session cookie (XSS theft risk)');
    if (sameSite === 'Missing') issues.push('Missing SameSite attribute (CSRF risk)');
    else if (sameSite === 'None' && !hasSecure) issues.push('SameSite=None configured without Secure flag');

    results.push({
      name: cookieName,
      hasSecure,
      hasHttpOnly,
      sameSite,
      isSessionCookie,
      issues,
    });
  }
  return results;
}

/**
 * Deep inspection of Content-Security-Policy directives for bypasses and weaknesses.
 */
export function auditCspDirectives(cspHeaderValue?: string | null): CspDirectiveAudit {
  if (!cspHeaderValue) {
    return {
      hasUnsafeInline: false,
      hasUnsafeEval: false,
      hasWildcard: false,
      missingBaseUri: true,
      issues: ['No Content-Security-Policy header defined.'],
    };
  }

  const issues: string[] = [];
  const lower = cspHeaderValue.toLowerCase();
  const hasUnsafeInline = lower.includes("'unsafe-inline'");
  const hasUnsafeEval = lower.includes("'unsafe-eval'");
  const hasWildcard = /(?:script-src|default-src)[^;]*\s+\*(?:\s|;|$)/.test(lower);
  const missingBaseUri = !lower.includes('base-uri');

  if (hasUnsafeInline) issues.push("CSP permits 'unsafe-inline' script execution, significantly weakening XSS mitigation.");
  if (hasUnsafeEval) issues.push("CSP permits 'unsafe-eval' dynamic code evaluation (eval / Function constructor).");
  if (hasWildcard) issues.push("CSP script-src or default-src allows wildcard '*' origin, enabling script inclusion from arbitrary origins.");
  if (missingBaseUri) issues.push("Missing 'base-uri' directive permits base tag hijacking to redirect relative scripts.");

  return {
    rawDirective: cspHeaderValue,
    hasUnsafeInline,
    hasUnsafeEval,
    hasWildcard,
    missingBaseUri,
    issues,
  };
}

/**
 * Identify potential open redirect parameters from discovered surface links.
 */
export function detectOpenRedirectSuspects(endpoints: EndpointItem[]): string[] {
  const suspectParams = ['redirect', 'url', 'next', 'return', 'dest', 'target', 'rdir', 'goto', 'out'];
  const suspects: string[] = [];

  for (const ep of endpoints) {
    try {
      const parsed = new URL(ep.url);
      for (const param of suspectParams) {
        if (parsed.searchParams.has(param)) {
          suspects.push(ep.url);
          break;
        }
      }
    } catch {
      if (/[?&](?:redirect|url|next|return|dest|target|rdir|goto)=/i.test(ep.path)) {
        suspects.push(ep.path);
      }
    }
  }
  return Array.from(new Set(suspects));
}

/**
 * Execute automated full-spectrum security assessment on a target website URL.
 */
export async function runAutomatedSecurityAudit(
  target: string,
  options: AutoAuditOptions = {}
): Promise<FullSecurityAuditResult> {
  const startTime = Date.now();
  const { normalizedUrl, host, port, protocol } = normalizeTargetUrl(target);
  const timestamp = new Date().toISOString();

  const isLocalOrIp = host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host === '0.0.0.0' || host.endsWith('.internal') || host.endsWith('.local');

  // 1. Rules of Engagement Scope Verification
  let inScope: boolean | undefined = undefined;
  let scopeNotes: string | undefined = undefined;
  const scopes = engagementStore.listScopes();
  if (scopes.length > 0) {
    const scopeId = options.scopeId || scopes[0].id;
    const scopeCheck = engagementStore.isTargetInScope(scopeId, host);
    inScope = scopeCheck.inScope;
    scopeNotes = scopeCheck.reason;
  }

  // 2. Network Reachability & Response Probe
  let reachable = false;
  let statusCode: number | undefined = undefined;
  let bodyHtml = '';
  let serverBanner: string | undefined = undefined;
  const setCookieHeaders: string[] = [];

  try {
    const probeHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DualSurf-SecurityScanner/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(options.customHeaders || {}),
    };
    if (options.authCookie) {
      probeHeaders['Cookie'] = options.authCookie;
    }
    if (options.bearerToken) {
      probeHeaders['Authorization'] = options.bearerToken.startsWith('Bearer ')
        ? options.bearerToken
        : `Bearer ${options.bearerToken}`;
    }

    const probeRes = await fetch(normalizedUrl, {
      method: 'GET',
      headers: probeHeaders,
      signal: AbortSignal.timeout(options.timeoutMs ? options.timeoutMs : (isLocalOrIp ? 800 : 5000)),
    });
    reachable = true;
    statusCode = probeRes.status;
    serverBanner = probeRes.headers.get('server') || undefined;
    bodyHtml = await probeRes.text();

    if (typeof (probeRes.headers as any).getSetCookie === 'function') {
      setCookieHeaders.push(...(probeRes.headers as any).getSetCookie());
    } else {
      const single = probeRes.headers.get('set-cookie');
      if (single) setCookieHeaders.push(single);
    }
  } catch {
    // If GET failed, try basic reachability fallback
    reachable = false;
  }

  // 3. TLS / SSL Certificate Deep Inspection
  let tlsResult: FullSecurityAuditResult['tls'] | undefined = undefined;
  let tlsCryptoResult: TlsCryptoAudit | undefined = undefined;
  if (protocol === 'https') {
    try {
      const cert = await inspectTlsCertificate(normalizedUrl);
      tlsResult = {
        authorized: cert.authorized,
        issuer: cert.issuer.organization || cert.issuer.commonName,
        validTo: cert.validTo,
        daysRemaining: cert.daysRemaining,
        isExpired: cert.isExpired,
        protocol: cert.protocol,
        cipherName: cert.cipherName,
        subjectAltNames: cert.subjectAltNames,
      };
      if (options.deepTlsCrypto !== false) {
        tlsCryptoResult = auditTlsCrypto(cert.protocol, cert.cipherName);
      }
    } catch {
      // TLS probe timed out or host offline
    }
  }

  // 4. HTTP Security Headers Audit
  const fallbackHeaderItems: SecurityHeaderItem[] = [
    { name: 'Content-Security-Policy', value: undefined, status: 'missing', description: 'Target host unreachable' },
  ];
  const headersAnalysis: SecurityHeaderAnalysisResult = reachable
    ? await analyzeSecurityHeaders(normalizedUrl)
    : {
        url: normalizedUrl,
        statusCode: 0,
        headers: {},
        score: 0,
        grade: 'F',
        serverBanner: undefined,
        items: fallbackHeaderItems,
      };

  // 5. CORS Policy Evaluation
  const corsResult = reachable
    ? await analyzeCorsPolicy(normalizedUrl)
    : {
        url: normalizedUrl,
        isWildcard: false,
        isReflected: false,
        isNullAllowed: false,
        risk: 'CLEAN' as const,
        verdict: 'Target host unreachable; could not evaluate CORS.',
      };

  // 6. Technology & WAF Fingerprinting
  const techProfileRaw = detectTechnologies(normalizedUrl, [], headersAnalysis.headers);

  // 7. Exposed Secrets & Sensitive Tokens Scan
  const secrets = scanForSecrets(bodyHtml);

  // 7.5. Frontend Dependency Vulnerability & Supply Chain Scanner
  let vulnerableDependencies: VulnerableDependency[] = [];
  if (options.checkDependencies !== false && bodyHtml) {
    try {
      vulnerableDependencies = scanFrontendDependencies(bodyHtml);
    } catch {}
  }

  // 8. Surface Endpoints & Forms Discovery
  const endpoints = extractEndpointsFromHtml(bodyHtml, normalizedUrl);

  // 9. Cookie Security & Session Flags Audit
  const cookiesAudited = auditCookiesFromHeaders(setCookieHeaders);

  // 10. CSP Deep Directive Inspection
  const cspHeaderObj = headersAnalysis.items.find((i) => i.name === 'Content-Security-Policy');
  const cspAudit = auditCspDirectives(cspHeaderObj?.value);

  // 11. Open Redirect Suspect Parameters
  const openRedirectSuspects = detectOpenRedirectSuspects(endpoints);

  // 12. Search Engine & Compliance Discovery (/robots.txt & /.well-known/security.txt)
  const robotsPathsDiscovered: string[] = [];
  let securityTxtDisclosed = false;

  if (reachable) {
    try {
      const robotsUrl = new URL('/robots.txt', normalizedUrl).toString();
      const rRes = await fetch(robotsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 DualSurf-SecurityScanner/1.0' },
        signal: AbortSignal.timeout(3000),
      });
      if (rRes.ok) {
        const rText = await rRes.text();
        const rLines = rText.split('\n');
        for (const l of rLines) {
          const match = l.match(/^\s*Disallow:\s*([^\s#]+)/i);
          if (match && match[1] && match[1] !== '/') {
            robotsPathsDiscovered.push(match[1].trim());
          }
        }
      }
    } catch {
      // offline / not found
    }

    try {
      const secUrl = new URL('/.well-known/security.txt', normalizedUrl).toString();
      const sRes = await fetch(secUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 DualSurf-SecurityScanner/1.0' },
        signal: AbortSignal.timeout(3000),
      });
      if (sRes.ok) {
        const sText = await sRes.text();
        if (sText.toLowerCase().includes('contact:')) {
          securityTxtDisclosed = true;
        }
      }
    } catch {
      // offline / not found
    }
  }

  // 12.3. DNS & Email Authentication Posture Analysis
  let dnsResult: { dnsRecords: DnsAuditRecord[]; emailSecurity: EmailSecurityPosture; ipList: string[] } | undefined = undefined;
  if (!isLocalOrIp && options.checkDns !== false) {
    try {
      dnsResult = await auditDnsAndEmail(host);
    } catch {}
  }

  // 12.4. Sensitive & Administrative Interface Probing
  let adminChecks: AdminInterfaceCheck[] = [];
  if (reachable && options.checkAdminRoutes !== false) {
    try {
      adminChecks = await probeAdminInterfaces(normalizedUrl, {
        timeoutMs: 2500,
        authCookie: options.authCookie,
        bearerToken: options.bearerToken,
        customHeaders: options.customHeaders,
      });
    } catch {}
  }

  // 12.5. Automated Network Perimeter Port & Service Discovery
  let portReport: PortScanReport | undefined = undefined;
  if (options.scanPorts !== false) {
    try {
      portReport = await scanPorts(host, {
        profile: options.portProfile || 'web',
        ports: options.customPorts,
        timeoutMs: options.timeoutMs ? Math.min(options.timeoutMs, 2000) : (isLocalOrIp ? 400 : 1500),
        scopeCheck: options.scopeId !== undefined || scopes.length > 0,
      });
    } catch {
      // safe fallback if network socket denied
    }
  }

  // 12.55. Certificate Transparency (crt.sh) Subdomain Discovery
  let ctSubdomains: string[] = [];
  if (!isLocalOrIp && options.checkCertificateTransparency !== false) {
    try {
      ctSubdomains = await harvestCertificateTransparencySubdomains(host, { timeoutMs: 4000 });
    } catch {}
  }

  // 12.6. Complete Attack Surface Asset Register
  const attackSurfaceRegister = buildAttackSurfaceRegister(
    host,
    dnsResult?.ipList || [],
    tlsResult?.subjectAltNames || [],
    endpoints,
    ctSubdomains
  );

  // 12.7. Cloud Storage Bucket Exposure Probing
  let cloudBuckets: CloudStorageAudit[] = [];
  if (!isLocalOrIp && options.checkCloudBuckets !== false) {
    try {
      cloudBuckets = await auditCloudStorageBuckets(host, { timeoutMs: 2500 });
    } catch {}
  }

  // 12.8. Subdomain Takeover & Dangling CNAME Probing
  let subdomainTakeovers: SubdomainTakeoverCheck[] = [];
  if (!isLocalOrIp && options.checkSubdomainTakeover !== false && attackSurfaceRegister.length > 0) {
    try {
      subdomainTakeovers = await auditSubdomainTakeovers(
        attackSurfaceRegister.map((a) => a.hostname),
        { timeoutMs: 2500 }
      );
    } catch {}
  }

  // 12.9. API Specification & GraphQL Introspection Probing
  let apiDiscovery: ApiDiscoveryResult | undefined = undefined;
  if (reachable && options.discoverApis !== false) {
    try {
      apiDiscovery = await auditApiAndGraphQl(normalizedUrl, {
        timeoutMs: 2500,
        authCookie: options.authCookie,
        bearerToken: options.bearerToken,
        customHeaders: options.customHeaders,
      });
    } catch {}
  }

  // 13. Vulnerability Synthesis & CVSS v3.1 Scoring
  const findings: PentestFinding[] = [];
  let findingCounter = 1;

  const addFinding = (
    title: string,
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL',
    cvssScore: number,
    category: string,
    description: string,
    impact: string,
    remediation: string,
    references: string[] = []
  ) => {
    findings.push({
      id: `FIND-${new Date().getFullYear()}-${String(findingCounter++).padStart(3, '0')}`,
      title,
      severity,
      cvssScore,
      affectedAsset: normalizedUrl,
      category,
      description,
      impact,
      remediation,
      references,
      status: 'Open',
      createdAt: timestamp,
    });
  };

  // Rule: Cleartext HTTP transport
  if (protocol !== 'https') {
    addFinding(
      'Unencrypted Cleartext HTTP Communication',
      'HIGH',
      7.5,
      'A02:2021 Cryptographic Failures',
      'The web application is accessible over unencrypted HTTP protocol without TLS enforcement.',
      'Attacker on the same network segment can inspect credentials, session cookies, and inject malicious scripts.',
      'Deploy TLS certificate (HTTPS) and enforce HTTP Strict Transport Security (HSTS) with automatic redirects.',
      ['CWE-319', 'OWASP Top 10 A02']
    );
  }

  // Rule: TLS certificate expiration or untrusted CA
  if (tlsResult) {
    if (tlsResult.isExpired) {
      addFinding(
        'Expired TLS/SSL Certificate in Production',
        'HIGH',
        7.4,
        'A02:2021 Cryptographic Failures',
        `The SSL/TLS certificate for ${host} expired on ${tlsResult.validTo}.`,
        'Browsers display prominent security warnings, and communication integrity cannot be verified.',
        'Renew certificate immediately and automate renewals with ACME / Let\'s Encrypt.',
        ['CWE-295']
      );
    } else if (tlsResult.daysRemaining < 14) {
      addFinding(
        'TLS Certificate Approaching Imminent Expiration',
        'MEDIUM',
        5.3,
        'A02:2021 Cryptographic Failures',
        `The TLS certificate will expire in ${tlsResult.daysRemaining} days (${tlsResult.validTo}).`,
        'Risk of service disruption and security warnings if renewal is not completed before cutoff.',
        'Schedule certificate renewal and configure monitoring alerts at 30 days remaining.',
        ['CWE-295']
      );
    }

    if (!tlsResult.authorized) {
      addFinding(
        'Untrusted or Self-Signed TLS Certificate',
        'HIGH',
        7.1,
        'A02:2021 Cryptographic Failures',
        'The TLS certificate authority cannot be validated against standard public root stores.',
        'Users will encounter security interstitials, increasing susceptibility to Man-in-the-Middle (MitM) attacks.',
        'Install a certificate issued by a trusted Certificate Authority (CA).',
        ['CWE-295']
      );
    }

    if (tlsCryptoResult) {
      if (tlsCryptoResult.isDeprecatedProtocol) {
        addFinding(
          `Deprecated Insecure Transport Protocol (${tlsCryptoResult.protocol})`,
          'HIGH',
          7.5,
          'A02:2021 Cryptographic Failures',
          `The server negotiates legacy protocol ${tlsCryptoResult.protocol}, which is formally deprecated by RFC 8996.`,
          'Known cryptographic vulnerabilities (BEAST, POODLE) allow adversaries to decrypt communications or perform downgrade attacks.',
          'Disable TLS 1.0 and TLS 1.1 across all web servers and load balancers. Enforce TLS 1.2 and TLS 1.3 only.',
          ['RFC 8996', 'CWE-326', 'OWASP Top 10 A02']
        );
      }
      if (tlsCryptoResult.isWeakCipher) {
        addFinding(
          `Insecure / Legacy TLS Cipher Suite (${tlsCryptoResult.cipherName})`,
          'MEDIUM',
          5.8,
          'A02:2021 Cryptographic Failures',
          `The server negotiated cipher suite "${tlsCryptoResult.cipherName}", which utilizes weak primitives (e.g., CBC mode, RC4, or 3DES). Flaws: ${tlsCryptoResult.flaws.join('; ')}`,
          'Susceptible to padding oracle attacks (e.g. Lucky13), collision attacks (Sweet32), or stream cipher biases.',
          'Configure high-security AEAD cipher suites (e.g., ECDHE-ECDSA-AES128-GCM-SHA256, ECDHE-RSA-AES256-GCM-SHA384, CHACHA20-POLY1305).',
          ['CWE-327', 'OWASP Top 10 A02']
        );
      }
      if (!tlsCryptoResult.hasPfs) {
        addFinding(
          'Lack of Perfect Forward Secrecy (PFS)',
          'LOW',
          3.7,
          'A02:2021 Cryptographic Failures',
          `The negotiated cipher suite "${tlsCryptoResult.cipherName}" does not use ephemeral key exchange (ECDHE or DHE).`,
          'If the server private key is compromised in the future, past recorded encrypted traffic sessions can be retroactively decrypted.',
          'Enforce ephemeral Diffie-Hellman key exchange ciphers (ECDHE).',
          ['RFC 8446', 'CWE-326']
        );
      }
    }
  }

  // Rule: Missing Content Security Policy
  const cspHeader = headersAnalysis.items.find((i) => i.name === 'Content-Security-Policy');
  if (cspHeader && cspHeader.status === 'missing') {
    addFinding(
      'Missing Content Security Policy (CSP)',
      'MEDIUM',
      6.1,
      'A05:2021 Security Misconfiguration',
      'The HTTP response lacks a Content-Security-Policy header to restrict content origins.',
      'Increases vulnerability to Cross-Site Scripting (XSS), data exfiltration, and malicious script injection.',
      'Define a strict CSP header disallowing unsafe-inline scripts and restricting connect/script sources.',
      ['CWE-1021', 'OWASP Top 10 A05']
    );
  }

  // Rule: Missing Strict-Transport-Security (HSTS)
  const hstsHeader = headersAnalysis.items.find((i) => i.name === 'Strict-Transport-Security');
  if (hstsHeader && hstsHeader.status === 'missing' && protocol === 'https') {
    addFinding(
      'Missing HTTP Strict Transport Security (HSTS)',
      'MEDIUM',
      5.4,
      'A05:2021 Security Misconfiguration',
      'The application does not declare an HSTS header to mandate HTTPS transport.',
      'Attacker on local network can execute SSL-stripping attacks to downgrade connections to plain HTTP.',
      'Set Strict-Transport-Security: max-age=31536000; includeSubDomains; preload.',
      ['CWE-319', 'OWASP Top 10 A05']
    );
  }

  // Rule: Missing X-Frame-Options (Clickjacking)
  const xfoHeader = headersAnalysis.items.find((i) => i.name === 'X-Frame-Options');
  if (xfoHeader && xfoHeader.status === 'missing') {
    addFinding(
      'Clickjacking Protection Missing (X-Frame-Options)',
      'LOW',
      4.3,
      'A05:2021 Security Misconfiguration',
      'The response omits X-Frame-Options or frame-ancestors directive in CSP.',
      'Attacker can embed the application inside a transparent iframe to hijack user clicks and actions.',
      'Send X-Frame-Options: DENY or SAMEORIGIN, or configure frame-ancestors in CSP.',
      ['CWE-1021']
    );
  }

  // Rule: Server banner leakage
  if (headersAnalysis.serverBanner) {
    addFinding(
      'Web Server Version Information Disclosure',
      'LOW',
      3.7,
      'A05:2021 Security Misconfiguration',
      `The HTTP response header discloses underlying server banner: "${headersAnalysis.serverBanner}".`,
      'Reveals precise server software and version numbers, streamlining attacker exploit research.',
      'Disable server tokens (e.g. server_tokens off in Nginx; ServerSignature Off in Apache).',
      ['CWE-200']
    );
  }

  // Rule: Permissive CORS configuration
  if (corsResult.risk === 'HIGH') {
    addFinding(
      'Insecure CORS Misconfiguration with Credentials Allowed',
      'HIGH',
      8.1,
      'A01:2021 Broken Access Control',
      `Cross-Origin Resource Sharing permits arbitrary origins with credentials enabled: ${corsResult.verdict}`,
      'Malicious websites can issue authenticated background API requests and read sensitive responses.',
      'Remove wildcard origin reflection when Access-Control-Allow-Credentials is true; allowlist specific origins.',
      ['CWE-942', 'OWASP Top 10 A01']
    );
  } else if (corsResult.risk === 'MEDIUM') {
    addFinding(
      'Permissive Cross-Origin Resource Sharing (CORS) Policy',
      'MEDIUM',
      5.3,
      'A01:2021 Broken Access Control',
      `CORS configuration permits excessive access: ${corsResult.verdict}`,
      'Unintended domains may read API responses if sensitive data is not guarded.',
      'Strictly restrict Access-Control-Allow-Origin to trusted application domains.',
      ['CWE-942']
    );
  }

  // Rule: Exposed secrets
  secrets.forEach((sec) => {
    addFinding(
      `Exposed Credential / Secret in Page Body (${sec.type})`,
      'CRITICAL',
      9.1,
      'A07:2021 Identification and Authentication Failures',
      `A sensitive token matching pattern for ${sec.type} was detected directly in response text: "${sec.snippet}"`,
      'Immediate compromise of credentials, API services, or internal network topology.',
      'Revoke exposed credentials immediately, rotate tokens, and eliminate hardcoded keys from frontend code.',
      ['CWE-798', 'OWASP Top 10 A07']
    );
  });

  // Rule: Cookie Security & Session Flags
  cookiesAudited.forEach((ck) => {
    if (!ck.hasSecure && protocol === 'https') {
      addFinding(
        `Insecure Cookie Transmission Without Secure Flag (${ck.name})`,
        'MEDIUM',
        5.4,
        'A05:2021 Security Misconfiguration',
        `Cookie "${ck.name}" does not specify the "Secure" flag over an HTTPS connection.`,
        'May be transmitted in unencrypted cleartext if the user accesses HTTP endpoints, exposing session data to MitM eavesdropping.',
        `Configure Set-Cookie: ${ck.name}=...; Secure; SameSite=Lax.`,
        ['CWE-614', 'OWASP Top 10 A05']
      );
    }
    if (ck.isSessionCookie && !ck.hasHttpOnly) {
      addFinding(
        `Sensitive Session Cookie Missing HttpOnly Flag (${ck.name})`,
        'MEDIUM',
        6.5,
        'A07:2021 Identification and Authentication Failures',
        `Authentication/session cookie "${ck.name}" lacks the "HttpOnly" attribute.`,
        'Vulnerable to unauthorized extraction by client-side JavaScript in the event of Cross-Site Scripting (XSS).',
        `Append "HttpOnly" attribute to Set-Cookie: ${ck.name}=...; HttpOnly; Secure.`,
        ['CWE-1004', 'OWASP Top 10 A07']
      );
    }
    if (ck.sameSite === 'Missing') {
      addFinding(
        `Missing SameSite Cookie Attribute (${ck.name})`,
        'LOW',
        4.3,
        'A01:2021 Broken Access Control',
        `Cookie "${ck.name}" does not enforce a SameSite policy (Strict or Lax).`,
        'Increases surface area for Cross-Site Request Forgery (CSRF) across third-party site navigations.',
        `Specify SameSite=Lax or SameSite=Strict on cookie "${ck.name}".`,
        ['CWE-1275']
      );
    }
  });

  // Rule: CSP Weakness / Bypasses
  if (cspAudit.hasUnsafeInline) {
    addFinding(
      "Content Security Policy Permits 'unsafe-inline' Execution",
      'HIGH',
      7.2,
      'A05:2021 Security Misconfiguration',
      "The Content-Security-Policy allows 'unsafe-inline' script execution, significantly weakening script execution boundaries.",
      'Allows injected inline scripts to execute unrestricted, disabling the primary defense against XSS.',
      "Replace 'unsafe-inline' with cryptographic script nonces (nonce-...) or SHA-256 hashes.",
      ['CWE-79', 'OWASP Top 10 A05']
    );
  }
  if (cspAudit.hasWildcard) {
    addFinding(
      "Content Security Policy Contains Overly Permissive Wildcard '*'",
      'MEDIUM',
      6.3,
      'A05:2021 Security Misconfiguration',
      "CSP directives contain a wildcard '*' source, allowing resource loading from any domain.",
      'Attacker can load remote payloads or exfiltrate sensitive data to arbitrary external domains.',
      'Explicitly enumerate trusted domains and subdomains rather than using wildcard source definitions.',
      ['CWE-1021']
    );
  }

  // Rule: Open Redirect Parameter Candidates
  if (openRedirectSuspects.length > 0) {
    addFinding(
      `Potential Open Redirect Parameters Identified (${openRedirectSuspects.length} links)`,
      'MEDIUM',
      6.1,
      'A01:2021 Broken Access Control',
      `Identified endpoints containing redirect parameter names: ${openRedirectSuspects.slice(0, 3).join(', ')}.`,
      'If destination parameter validation is missing, attackers can craft phishing links that bounce off the trusted domain.',
      'Validate redirect URLs against strict internal allowlists or relative path checks.',
      ['CWE-601', 'OWASP Top 10 A01']
    );
  }

  // Rule: Sensitive Robots.txt Disallow Disclosures
  const sensitiveRobots = robotsPathsDiscovered.filter((p) =>
    /admin|api|internal|secret|backup|config|auth|private|debug|upload/i.test(p)
  );
  if (sensitiveRobots.length > 0) {
    addFinding(
      `Sensitive Administrative Routes Disclosed in robots.txt (${sensitiveRobots.length} paths)`,
      'LOW',
      3.9,
      'A05:2021 Security Misconfiguration',
      `robots.txt explicitly lists hidden sensitive paths: ${sensitiveRobots.slice(0, 5).join(', ')}.`,
      'Attackers inspect robots.txt to discover unlinked admin portals, hidden API routes, and staging paths.',
      'Rely on robust authentication and authorization rather than relying on robots.txt for obscurity.',
      ['CWE-200']
    );
  }

  // Rule: Missing RFC 9116 security.txt
  if (!securityTxtDisclosed && reachable && protocol === 'https') {
    addFinding(
      'Missing RFC 9116 security.txt Vulnerability Disclosure Policy',
      'LOW',
      2.5,
      'Security Operations & Vulnerability Disclosure',
      'No /.well-known/security.txt file was found to specify security contact and reporting guidelines.',
      'Security researchers encountering vulnerabilities may lack an official channel to report issues responsibly.',
      'Publish a security.txt file at /.well-known/security.txt following the RFC 9116 standard.',
      ['RFC 9116']
    );
  }

  // Rule: Exposed High / Critical Network Ports & Insecure Services
  if (portReport && portReport.openPorts.length > 0) {
    portReport.openPorts.forEach((p) => {
      if (p.risk === 'CRITICAL') {
        addFinding(
          `Critical Service Exposure: ${p.service.toUpperCase()} (Port ${p.port}/${p.protocol})`,
          'CRITICAL',
          9.0,
          'A05:2021 Security Misconfiguration',
          `Critical risk service ${p.service} was detected accessible from the network on port ${p.port}/${p.protocol}. ${p.riskReason || ''} (Banner: "${p.banner || 'open'}").`,
          'May allow unauthorized administrative access, credential dumping, or immediate remote code execution.',
          p.hardeningAdvice || 'Immediately isolate or close this port using firewall rules, or restrict access to local loopback (127.0.0.1).',
          p.mitreTechnique ? [p.mitreTechnique, 'CWE-284', 'CWE-200'] : ['CWE-284', 'CWE-200']
        );
      } else if (p.risk === 'HIGH') {
        addFinding(
          `High Risk Port Exposed: ${p.service.toUpperCase()} (Port ${p.port}/${p.protocol})`,
          'HIGH',
          7.5,
          'A05:2021 Security Misconfiguration',
          `Service ${p.service} is openly exposed to network connections on port ${p.port}/${p.protocol}. ${p.riskReason || ''} (Banner: "${p.banner || 'open'}").`,
          'Exposed service expands external attack surface and may reveal sensitive data or allow brute-force credential guessing.',
          p.hardeningAdvice || 'Enforce transport encryption, restrict inbound connections via firewall/security groups, and disable legacy services.',
          p.mitreTechnique ? [p.mitreTechnique, 'CWE-319', 'CWE-200'] : ['CWE-319', 'CWE-200']
        );
      } else if (p.risk === 'MEDIUM' && p.port !== 80 && p.port !== 443) {
        addFinding(
          `Uncommon Port Exposed: ${p.service.toUpperCase()} (Port ${p.port}/${p.protocol})`,
          'MEDIUM',
          5.3,
          'A05:2021 Security Misconfiguration',
          `Port ${p.port} (${p.service}) is accessible from the network. ${p.riskReason || ''} (Banner: "${p.banner || 'open'}").`,
          'Increases target fingerprintability and reconnaissance surface for automated adversaries.',
          p.hardeningAdvice || 'Verify whether this service must be accessible externally. Close unused ports or restrict ingress to authorized IP addresses.',
          p.mitreTechnique ? [p.mitreTechnique] : ['CWE-200']
        );
      }
    });
  }

  // Rule: Email Security & DNS Authentication Gaps
  if (dnsResult?.emailSecurity) {
    if (!dnsResult.emailSecurity.hasDmarc) {
      addFinding(
        'Missing RFC 7489 DMARC Domain Authentication Policy',
        'MEDIUM',
        5.8,
        'A05:2021 Security Misconfiguration',
        `Domain ${host} does not publish an RFC 7489 DMARC policy record at _dmarc.${host}.`,
        'Permits unauthorized adversaries to spoof emails purporting to originate from this domain, increasing phishing and brand impersonation risks.',
        `Publish an explicit DMARC policy TXT record at _dmarc.${host} starting with "v=DMARC1; p=quarantine;" or "p=reject;".`,
        ['RFC 7489', 'CWE-345']
      );
    } else if (dnsResult.emailSecurity.dmarcPolicy === 'none') {
      addFinding(
        "Weak DMARC Policy in Monitoring Mode ('p=none')",
        'LOW',
        3.8,
        'A05:2021 Security Misconfiguration',
        `Domain ${host} DMARC policy is set to 'p=none' (monitoring only without quarantine or reject enforcement).`,
        'Receiving mail servers will not reject unauthorized emails forged with this domain header.',
        'Review legitimate sending services in DMARC aggregate reports (rua) and transition policy to p=quarantine and eventually p=reject.',
        ['RFC 7489']
      );
    }
    if (!dnsResult.emailSecurity.hasSpf) {
      addFinding(
        'Missing SPF (Sender Policy Framework) Record',
        'LOW',
        3.5,
        'A05:2021 Security Misconfiguration',
        `Domain ${host} does not define a TXT record starting with v=spf1.`,
        'Receiving mail servers cannot cryptographically verify whether sending mail relays are authorized by domain owners.',
        'Configure an explicit SPF TXT record: v=spf1 mx -all (or include authorized ESPs).',
        ['RFC 7208']
      );
    }
  }

  // Rule: Exposed Administrative & Sensitive Interfaces
  adminChecks.forEach((ac) => {
    if (ac.exposed) {
      if (ac.path === '/.env') {
        addFinding(
          'Critical Public Exposure: Environment Configuration File (/.env)',
          'CRITICAL',
          9.8,
          'A05:2021 Security Misconfiguration',
          `The server publicly serves the environment file at ${ac.url}. Contains database credentials, secret keys, or API tokens.`,
          'Immediate and complete compromise of application databases, cloud APIs, and identity providers.',
          'Block web access to dotfiles (location ~ /\\.env { deny all; }) and remove .env from public webroot immediately.',
          ['CWE-552', 'CWE-200', 'OWASP Top 10 A05']
        );
      } else if (ac.path === '/.git/HEAD') {
        addFinding(
          'Critical Public Exposure: Git Source Repository Metadata (/.git/HEAD)',
          'CRITICAL',
          9.1,
          'A05:2021 Security Misconfiguration',
          `The server publicly serves Git metadata at ${ac.url}. Attackers can reconstruct the complete source code history.`,
          'Full disclosure of proprietary source code, past commits, hardcoded passwords, and internal API routes.',
          'Deny web access to all hidden .git directories across reverse proxy and web server configs.',
          ['CWE-552', 'CWE-200']
        );
      } else if (ac.path.startsWith('/actuator')) {
        addFinding(
          `Exposed Unauthenticated Spring Boot Actuator (${ac.path})`,
          'HIGH',
          7.7,
          'A05:2021 Security Misconfiguration',
          `Spring Boot administrative monitoring endpoint is accessible without authentication at ${ac.url}.`,
          'Exposes internal server health, thread dumps, application configurations, and memory metrics.',
          'Configure management.endpoints.web.exposure.exclude=* or enforce strict authentication in Spring Security.',
          ['CWE-284', 'CWE-200']
        );
      } else {
        addFinding(
          `Publicly Accessible Administrative Interface (${ac.path})`,
          'MEDIUM',
          5.3,
          'A01:2021 Broken Access Control',
          `Administrative interface or documentation portal is directly accessible from the public Internet at ${ac.url}.`,
          'Exposes administrative surface area to automated credential brute-force attacks and targeted phishing.',
          'Restrict access using IP whitelisting, VPN, corporate SSO, and enforce Multi-Factor Authentication (MFA).',
          ['CWE-284']
        );
      }
    }
  });

  // Rule: Exposed Cloud Storage Buckets
  cloudBuckets.forEach((b) => {
    // Only flag if the target page markup or scripts actually reference this bucket
    const isReferencedInApp = Boolean(bodyHtml && (bodyHtml.includes(b.bucketName) || bodyHtml.includes(b.url)));
    if (!isReferencedInApp) return;

    if (b.publiclyReadable && b.listingEnabled) {
      addFinding(
        `Critical Cloud Storage Exposure: Public Read + Directory Listing (${b.provider.toUpperCase()} Bucket "${b.bucketName}")`,
        'CRITICAL',
        9.1,
        'A05:2021 Security Misconfiguration',
        `Cloud storage bucket "${b.bucketName}" on ${b.provider.toUpperCase()} (${b.url}) allows anonymous public reading and listing of all bucket objects.`,
        'Complete exposure of database backups, private documents, logs, and sensitive customer data.',
        'Disable public access on the bucket ACL and block public access settings in your cloud console.',
        ['CWE-200', 'CWE-284', 'OWASP Top 10 A05']
      );
    } else if (b.publiclyReadable) {
      addFinding(
        `Exposed Cloud Storage Bucket (${b.provider.toUpperCase()} Bucket "${b.bucketName}")`,
        'HIGH',
        7.5,
        'A05:2021 Security Misconfiguration',
        `Cloud storage bucket "${b.bucketName}" on ${b.provider.toUpperCase()} (${b.url}) is accessible to unauthenticated callers.`,
        'Unintended public disclosure of hosted assets, documents, or proprietary files.',
        'Enforce IAM policies requiring authentication and restrict access to authorized service identities.',
        ['CWE-200', 'CWE-284']
      );
    }
  });

  // Rule: Subdomain Takeover & Dangling CNAMEs
  subdomainTakeovers.forEach((t) => {
    if (t.vulnerable) {
      addFinding(
        `Critical Subdomain Takeover: Dangling CNAME on ${t.subdomain}`,
        'CRITICAL',
        9.3,
        'A05:2021 Security Misconfiguration',
        `Subdomain ${t.subdomain} points via CNAME to an unclaimed external resource: ${t.evidence || t.cnameDestination}.`,
        'An adversary can register the orphan service resource to serve arbitrary malicious content under your trusted domain.',
        'Remove the stale CNAME DNS record immediately or claim the associated service resource.',
        ['CWE-284', 'OWASP Top 10 A05']
      );
    } else if (t.cnameDestination) {
      addFinding(
        `Dangling Third-Party CNAME Destination (${t.subdomain})`,
        'LOW',
        3.5,
        'A05:2021 Security Misconfiguration',
        `Subdomain ${t.subdomain} aliases to external provider destination "${t.cnameDestination}".`,
        'If the third-party subscription or bucket is decommissioned without updating DNS, it becomes vulnerable to domain hijacking.',
        'Ensure DNS records are synchronized with active cloud services and remove stale aliases.',
        ['CWE-200']
      );
    }
  });

  // Rule: API Specification & GraphQL Introspection
  if (apiDiscovery) {
    if (apiDiscovery.graphQlIntrospectionEnabled) {
      addFinding(
        `Unauthenticated GraphQL Schema Introspection Enabled (${apiDiscovery.graphQlUrl || '/graphql'})`,
        'MEDIUM',
        5.5,
        'A01:2021 Broken Access Control',
        `GraphQL schema introspection is enabled without authentication, exposing ${apiDiscovery.typesCount || 'internal'} database models and query types.`,
        'Allows attackers to extract the complete database schema, private relations, hidden fields, and administrative queries.',
        'Disable schema introspection in production environments (e.g. introspection: false in Apollo Server / GraphQL Yoga).',
        ['CWE-200', 'OWASP Top 10 A01']
      );
    }
    if (apiDiscovery.openApiFound) {
      addFinding(
        `Publicly Disclosed OpenAPI / Swagger Specification (${apiDiscovery.openApiTitle || 'API Spec'})`,
        'LOW',
        2.5,
        'A05:2021 Security Misconfiguration',
        `Interactive API documentation is publicly reachable at ${apiDiscovery.openApiUrl} disclosing ${apiDiscovery.endpointsCount || 0} API paths.`,
        'Provides adversaries with detailed request parameters, schemas, and routes for targeted fuzzing.',
        'Restrict access to API documentation via VPN, reverse proxy authentication, or disable in production.',
        ['CWE-200']
      );
    }
  }

  // Rule: Known Vulnerable Frontend Dependencies & Supply Chain Risks
  vulnerableDependencies.forEach((dep) => {
    dep.cveList.forEach((cve) => {
      addFinding(
        `Vulnerable Frontend Dependency: ${dep.library} v${dep.detectedVersion} (${cve.cveId})`,
        cve.severity,
        cve.cvssScore,
        'A06:2021 Vulnerable and Outdated Components',
        `The application loads "${dep.library}" version ${dep.detectedVersion} at ${dep.sourceUrl}. Affected by ${cve.cveId}: ${cve.summary}`,
        `Adversaries can exploit this known vulnerability: ${cve.summary}`,
        `Upgrade ${dep.library} to version ${cve.fixedIn || 'the latest stable release'} immediately and verify integrity via Subresource Integrity (SRI) hashes.`,
        ['CWE-1104', 'CWE-1035', 'OWASP Top 10 A06', `https://nvd.nist.gov/vuln/detail/${cve.cveId}`]
      );
    });
  });

  // Calculate overall Security Score (0 to 100) and Risk Rating
  const critCount = findings.filter((f) => f.severity === 'CRITICAL').length;
  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const medCount = findings.filter((f) => f.severity === 'MEDIUM').length;
  const lowCount = findings.filter((f) => f.severity === 'LOW').length;

  let calculatedScore = 100 - critCount * 30 - highCount * 18 - medCount * 8 - lowCount * 3;
  if (!reachable) calculatedScore = 0;
  calculatedScore = Math.max(0, Math.min(100, calculatedScore));

  let riskRating: FullSecurityAuditResult['riskRating'] = 'CLEAN';
  if (critCount > 0 || calculatedScore < 40) riskRating = 'CRITICAL';
  else if (highCount > 0 || calculatedScore < 65) riskRating = 'HIGH';
  else if (medCount > 0 || calculatedScore < 85) riskRating = 'MEDIUM';
  else if (lowCount > 0) riskRating = 'LOW';

  const grade: FullSecurityAuditResult['grade'] =
    calculatedScore >= 90 ? 'A' : calculatedScore >= 75 ? 'B' : calculatedScore >= 60 ? 'C' : calculatedScore >= 40 ? 'D' : 'F';

  // Sort findings by CVSS descending
  findings.sort((a, b) => b.cvssScore - a.cvssScore);

  const durationMs = Date.now() - startTime;

  const result: FullSecurityAuditResult = {
    targetUrl: target,
    normalizedUrl,
    host,
    port,
    protocol,
    timestamp,
    reachable,
    statusCode,
    durationMs,
    inScope,
    scopeNotes,
    riskRating,
    securityScore: calculatedScore,
    grade,
    tls: tlsResult,
    headers: {
      score: headersAnalysis.score,
      grade: headersAnalysis.grade,
      items: headersAnalysis.items,
      serverBanner: headersAnalysis.serverBanner,
    },
    cors: {
      risk: corsResult.risk,
      verdict: corsResult.verdict,
      allowOrigin: corsResult.allowOrigin,
      allowCredentials: corsResult.allowCredentials,
    },
    techProfile: {
      servers: techProfileRaw.servers,
      frameworks: techProfileRaw.frameworks,
      cms: techProfileRaw.cms,
      cdnWaf: techProfileRaw.cdnWaf,
    },
    secretsDetected: secrets,
    endpointsDetected: endpoints,
    findings,
    cookiesAudited,
    cspAudit,
    robotsPathsDiscovered,
    securityTxtDisclosed,
    openRedirectSuspects,
    openPorts: portReport?.openPorts,
    portAudit: portReport,
    dnsRecords: dnsResult?.dnsRecords,
    emailSecurity: dnsResult?.emailSecurity,
    attackSurfaceRegister,
    adminInterfaces: adminChecks,
    cloudStorage: cloudBuckets,
    subdomainTakeovers,
    apiDiscovery,
    authenticatedAudit: Boolean(options.authCookie || options.bearerToken),
    dependencies: vulnerableDependencies,
    tlsCrypto: tlsCryptoResult,
    ctSubdomainsDiscovered: ctSubdomains.length,
  };

  // 13.5. Local AI / Ollama Executive Remediation Synthesis
  if (options.useAiRemediation !== false) {
    try {
      const ollamaClient = new OllamaClient();
      result.aiRemediationSummary = await generateAiRemediationPlan(result, ollamaClient);
    } catch {
      // safe fallback if AI service unavailable
    }
  }

  // 14. Generate and export reports (Markdown, Interactive HTML, JSON, SARIF)
  if (options.exportReport !== false && options.autoExportReport !== false) {
    const reportMd = generateFullAuditReport(result);
    const safeHost = host.replace(/[^a-zA-Z0-9.-]/g, '_');
    const defaultFilename = `audit-${safeHost}-${Date.now()}.md`;
    const targetFile = options.outputPath || options.exportPath || defaultFilename;
    const resolvedPath = path.isAbsolute(targetFile) ? targetFile : path.resolve(process.cwd(), targetFile);

    try {
      const parentDir = path.dirname(resolvedPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(resolvedPath, reportMd, 'utf8');
      result.reportFilePath = resolvedPath;
    } catch {
      // ignore disk write failure in restricted sandbox
    }

    // Export HTML Report
    try {
      const htmlFile = resolvedPath.endsWith('.md')
        ? resolvedPath.replace(/\.md$/, '.html')
        : `${resolvedPath}.html`;
      const htmlPath = options.htmlReportPath
        ? (path.isAbsolute(options.htmlReportPath) ? options.htmlReportPath : path.resolve(process.cwd(), options.htmlReportPath))
        : htmlFile;
      const htmlContent = generateHtmlAuditReport(result);
      fs.writeFileSync(htmlPath, htmlContent, 'utf8');
      result.htmlReportPath = htmlPath;
    } catch {
      // ignore
    }

    // Export JSON Report if requested
    if (options.exportJson || options.format === 'json' || options.format === 'all') {
      try {
        const jsonFile = resolvedPath.endsWith('.md')
          ? resolvedPath.replace(/\.md$/, '.json')
          : `${resolvedPath}.json`;
        const jsonPath = options.jsonReportPath
          ? (path.isAbsolute(options.jsonReportPath) ? options.jsonReportPath : path.resolve(process.cwd(), options.jsonReportPath))
          : jsonFile;
        fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
        result.jsonReportPath = jsonPath;
      } catch {
        // ignore
      }
    }

    // Export SARIF 2.1.0 Report if requested
    if (options.exportSarif || options.format === 'all') {
      try {
        const sarifFile = resolvedPath.endsWith('.md')
          ? resolvedPath.replace(/\.md$/, '.sarif')
          : `${resolvedPath}.sarif`;
        const sarifPath = options.sarifReportPath
          ? (path.isAbsolute(options.sarifReportPath) ? options.sarifReportPath : path.resolve(process.cwd(), options.sarifReportPath))
          : sarifFile;
        result.sarifReportPath = exportSarifToDisk(result, sarifPath);
      } catch {
        // ignore
      }
    }

    // Trigger Security Webhook if configured
    if (options.webhookUrl) {
      try {
        await sendSecurityWebhook(options.webhookUrl, result);
      } catch {
        // ignore
      }
    }

    // Generate GitHub Actions CI/CD Security Gate if requested
    if (options.generateCiWorkflow) {
      try {
        result.ciWorkflowPath = writeGitHubActionWorkflow(undefined, {
          targetUrl: normalizedUrl,
        });
      } catch {
        // ignore
      }
    }
  }

  return result;
}

/**
 * Generate comprehensive Executive & Technical Markdown penetration test report.
 */
export function generateFullAuditReport(result: FullSecurityAuditResult): string {
  const lines: string[] = [
    `# Automated Security Assessment & Penetration Test Report`,
    ``,
    `> **Target:** \`${result.normalizedUrl}\` | **Date:** ${result.timestamp} | **Duration:** ${result.durationMs}ms`,
    ``,
    `---`,
    ``,
    `## 1. Executive Summary`,
    ``,
    `- **Target Host:** \`${result.host}:${result.port}\` (${result.protocol.toUpperCase()})`,
    `- **Reachability:** ${result.reachable ? `✅ Online (HTTP ${result.statusCode})` : '❌ Offline / Unreachable'}`,
    `- **Overall Security Hygiene Score:** **${result.securityScore} / 100** (Grade **${result.grade}**)`,
    `- **Overall Risk Rating:** **${result.riskRating}**`,
  ];

  if (result.inScope !== undefined) {
    lines.push(
      `- **Rules of Engagement Scope:** ${
        result.inScope ? '✅ **AUTHORIZED IN-SCOPE**' : '⚠️ **UNAUTHORIZED / OUT OF SCOPE**'
      } (${result.scopeNotes || 'Evaluated'})`
    );
  }

  const crit = result.findings.filter((f) => f.severity === 'CRITICAL').length;
  const high = result.findings.filter((f) => f.severity === 'HIGH').length;
  const med = result.findings.filter((f) => f.severity === 'MEDIUM').length;
  const low = result.findings.filter((f) => f.severity === 'LOW').length;

  lines.push(
    ``,
    `### Findings Breakdown (CVSS v3.1)`,
    ``,
    `| Severity | Count | Color Flag |`,
    `| :--- | :---: | :--- |`,
    `| **CRITICAL** | **${crit}** | 🔴 Immediate business risk |`,
    `| **HIGH** | **${high}** | 🟠 Severe vulnerability |`,
    `| **MEDIUM** | **${med}** | 🟡 Moderate defense gap |`,
    `| **LOW** | **${low}** | 🔵 Informational / Hardening |`,
    ``,
    `---`,
    ``,
    `## 2. Infrastructure & Technical Fingerprint`,
    ``,
    `- **Web Servers:** ${result.techProfile.servers.length ? result.techProfile.servers.map((s) => `\`${s}\``).join(', ') : '*None detected*'}`,
    `- **Frameworks & Runtimes:** ${result.techProfile.frameworks.length ? result.techProfile.frameworks.map((f) => `\`${f}\``).join(', ') : '*None detected*'}`,
    `- **CMS Platform:** ${result.techProfile.cms.length ? result.techProfile.cms.map((c) => `\`${c}\``).join(', ') : '*None detected*'}`,
    `- **WAF / CDN Protection:** ${result.techProfile.cdnWaf.length ? result.techProfile.cdnWaf.map((w) => `\`${w}\``).join(', ') : '*Direct connection*'}`,
    ``
  );

  // Attack Surface Section
  if (result.attackSurfaceRegister && result.attackSurfaceRegister.length > 0) {
    lines.push(
      `## 1.5. Discovered Attack Surface & Asset Register (${result.attackSurfaceRegister.length} Assets)`,
      ``,
      `| Asset Hostname | Asset Type | Environment | Discovery Source | Exposure Status |`,
      `| :--- | :---: | :---: | :---: | :---: |`
    );
    result.attackSurfaceRegister.forEach((a) => {
      lines.push(
        `| \`${a.hostname}\` | \`${a.assetType}\` | **${a.environment}** | \`${a.source}\` | ${a.publiclyExposed ? '🌐 Public Internet' : '🔒 Internal / Private'} |`
      );
    });
    lines.push(``);
  }

  // DNS & Email Security Section
  if (result.emailSecurity) {
    lines.push(
      `## 1.6. DNS & Email Authentication Posture`,
      ``,
      `| Protocol / Check | Status | Published DNS Value | Assessment Risk |`,
      `| :--- | :---: | :--- | :--- |`,
      `| **SPF (Sender Policy Framework)** | ${result.emailSecurity.hasSpf ? '✅ Configured' : '❌ Missing'} | \`${result.emailSecurity.spfRecord || 'None'}\` | ${result.emailSecurity.hasSpf ? 'Low' : 'High Phishing / Spoofing Risk'} |`,
      `| **DMARC Policy (RFC 7489)** | ${result.emailSecurity.dmarcPolicy === 'reject' || result.emailSecurity.dmarcPolicy === 'quarantine' ? '✅ Enforced' : result.emailSecurity.dmarcPolicy === 'none' ? '⚠️ Monitoring Only' : '❌ Missing'} | \`${result.emailSecurity.dmarcRecord || 'None'}\` | ${result.emailSecurity.dmarcPolicy === 'reject' || result.emailSecurity.dmarcPolicy === 'quarantine' ? 'Hardened' : 'High Spoofing Risk'} |`,
      `| **MX Mail Exchangers** | ${result.emailSecurity.mxRecords.length > 0 ? '✅ Active' : 'ℹ️ None'} | ${result.emailSecurity.mxRecords.slice(0, 3).map((m) => `\`${m}\``).join(', ') || '*No MX records*'} | Informational |`,
      ``
    );
  }

  // Administrative Interfaces Section
  if (result.adminInterfaces && result.adminInterfaces.length > 0) {
    lines.push(
      `## 1.7. Sensitive & Administrative Interface Probes`,
      ``,
      `| Endpoint Path | HTTP Status | Exposure State | Security Impact |`,
      `| :--- | :---: | :---: | :--- |`
    );
    result.adminInterfaces.forEach((ai) => {
      const badge = ai.exposed ? '🚨 EXPOSED PUBLICLY' : '🔒 Protected / Non-200';
      lines.push(
        `| \`${ai.path}\` | \`HTTP ${ai.status}\` | ${badge} | ${ai.notes || 'No active risk identified'} |`
      );
    });
    lines.push(``);
  }

  // Cloud Storage Section
  if (result.cloudStorage && result.cloudStorage.length > 0) {
    lines.push(
      `## 1.8. Cloud Storage Bucket Exposure Audit`,
      ``,
      `| Provider | Bucket Name | Public Read | Listing Enabled | Status / Notes |`,
      `| :---: | :--- | :---: | :---: | :--- |`
    );
    result.cloudStorage.forEach((b) => {
      lines.push(
        `| **${b.provider.toUpperCase()}** | \`${b.bucketName}\` | ${b.publiclyReadable ? '🚨 YES (Public)' : '🔒 Private'} | ${b.listingEnabled ? '🚨 OPEN (Dir Listing)' : '🔒 Disabled'} | ${b.details || 'Audited'} |`
      );
    });
    lines.push(``);
  }

  // Subdomain Takeovers Section
  if (result.subdomainTakeovers && result.subdomainTakeovers.length > 0) {
    lines.push(
      `## 1.9. Subdomain Takeover & Dangling CNAME Audit`,
      ``,
      `| Subdomain | Provider / Service | CNAME Destination | Vulnerability Status |`,
      `| :--- | :---: | :--- | :---: |`
    );
    result.subdomainTakeovers.forEach((t) => {
      lines.push(
        `| \`${t.subdomain}\` | **${t.service || 'Third-Party'}** | \`${t.cnameDestination}\` | ${t.vulnerable ? '🚨 **CRITICAL: VULNERABLE TO TAKEOVER**' : '🔒 Not Vulnerable'} |`
      );
    });
    lines.push(``);
  }

  // API Discovery Section
  if (result.apiDiscovery && (result.apiDiscovery.openApiFound || result.apiDiscovery.graphQlFound)) {
    lines.push(
      `## 1.10. Modern API Specifications & GraphQL Introspection`,
      ``,
      `| Component | Discovered | Introspection / Route Count | Location / URL |`,
      `| :--- | :---: | :---: | :--- |`,
      `| **OpenAPI / Swagger** | ${result.apiDiscovery.openApiFound ? `✅ Found (${result.apiDiscovery.openApiTitle || 'API Spec'})` : '❌ Not Found'} | ${result.apiDiscovery.endpointsCount !== undefined ? `${result.apiDiscovery.endpointsCount} endpoints` : 'N/A'} | \`${result.apiDiscovery.openApiUrl || 'None'}\` |`,
      `| **GraphQL API** | ${result.apiDiscovery.graphQlFound ? '✅ Found' : '❌ Not Found'} | ${result.apiDiscovery.graphQlIntrospectionEnabled ? `🚨 **OPEN (${result.apiDiscovery.typesCount || 0} types)**` : '🔒 Hardened / Disabled'} | \`${result.apiDiscovery.graphQlUrl || 'None'}\` |`,
      ``
    );
  }

  // Network Ports Section
  if (result.portAudit && result.portAudit.openPorts.length > 0) {
    lines.push(
      `## 2.5. Exposed Perimeter Ports & Services (${result.portAudit.openPorts.length} Open)`,
      ``,
      `| Port | Protocol | Service | Risk Rating | Latency | Banner / Response | Hardening Guidance |`,
      `| :---: | :---: | :--- | :---: | :---: | :--- | :--- |`
    );
    result.portAudit.openPorts.forEach((p) => {
      lines.push(
        `| **${p.port}** | \`${p.protocol}\` | \`${p.service}\` | **${p.risk}** | ${p.latencyMs || 0}ms | \`${(p.banner || 'None').replace(/\|/g, '/')}\` | ${p.hardeningAdvice || 'Review exposure'} |`
      );
    });
    lines.push(``);
  }

  // Frontend Dependencies Section
  if (result.dependencies && result.dependencies.length > 0) {
    lines.push(
      `## 2.8. Frontend Dependencies & Known Supply Chain CVEs (${result.dependencies.length} Libraries)`,
      ``,
      `| Library | Version | Fixed In | Known Vulnerabilities | Script Location |`,
      `| :--- | :---: | :---: | :--- | :--- |`
    );
    result.dependencies.forEach((d) => {
      const cveItems = d.cveList.map((c) => `\`${c.cveId}\` [${c.severity}] ${c.summary}`).join('<br/>');
      lines.push(
        `| **${d.library}** | \`${d.detectedVersion}\` | \`${d.cveList[0]?.fixedIn || 'Latest'}\` | ${cveItems} | \`${d.sourceUrl.slice(0, 50)}\` |`
      );
    });
    lines.push(``);
  }

  // TLS Section
  if (result.tls) {
    lines.push(
      `## 3. SSL / TLS Certificate Analysis`,
      ``,
      `| Metric | Value |`,
      `| :--- | :--- |`,
      `| **CA Trust Status** | ${result.tls.authorized ? '✅ Valid / Trusted Authority' : '❌ Untrusted / Self-Signed'} |`,
      `| **Issuer** | \`${result.tls.issuer || 'Unknown'}\` |`,
      `| **Valid Until** | \`${result.tls.validTo}\` (${result.tls.daysRemaining} days remaining) |`,
      `| **Protocol & Cipher** | \`${result.tls.protocol}\` (${result.tls.cipherName}) |`,
      `| **Subject Alt Names (SANs)** | ${result.tls.subjectAltNames.length ? result.tls.subjectAltNames.slice(0, 8).map((s) => `\`${s}\``).join(', ') : '*None*'} |`,
      ``
    );

    if (result.tlsCrypto) {
      lines.push(
        `### 3.1. Deep TLS Protocol & Cipher Suite Cryptographic Audit`,
        ``,
        `| Cryptographic Property | Evaluated Configuration | Security Assessment |`,
        `| :--- | :--- | :--- |`,
        `| **Transport Protocol** | \`${result.tlsCrypto.protocol}\` | ${result.tlsCrypto.isDeprecatedProtocol ? '🚨 **DEPRECATED (RFC 8996)**' : '✅ Modern Protocol'} |`,
        `| **Negotiated Cipher** | \`${result.tlsCrypto.cipherName}\` | ${result.tlsCrypto.isWeakCipher ? '⚠️ **WEAK PRIMITIVE**' : '✅ High-Security AEAD'} |`,
        `| **Perfect Forward Secrecy (PFS)** | \`${result.tlsCrypto.hasPfs ? 'ECDHE / DHE' : 'Static RSA'}\` | ${result.tlsCrypto.hasPfs ? '✅ Supported' : '⚠️ Not Enforced'} |`,
        ``
      );
    }
  }

  // Security Headers Section
  lines.push(
    `## 4. HTTP Security Headers Matrix`,
    ``,
    `- **Headers Compliance Score:** ${result.headers.score}% (Grade **${result.headers.grade}**)`,
    `- **Server Banner:** \`${result.headers.serverBanner || 'Hidden (Secure)'}\``,
    ``,
    `| Header Name | Status | Standard Functionality |`,
    `| :--- | :---: | :--- |`
  );

  result.headers.items.forEach((item) => {
    const badge = item.status === 'good' ? '✅ PASS' : item.status === 'warning' ? '⚠️ WARN' : '❌ MISSING';
    lines.push(`| \`${item.name}\` | ${badge} | ${item.description} |`);
  });

  // CORS Section
  if (result.cors) {
    lines.push(
      ``,
      `## 5. Cross-Origin Resource Sharing (CORS) Audit`,
      ``,
      `- **Risk Rating:** \`${result.cors.risk}\``,
      `- **Evaluation Verdict:** ${result.cors.verdict}`,
      `- **Access-Control-Allow-Origin:** \`${result.cors.allowOrigin || '(Not configured)'}\``,
      `- **Access-Control-Allow-Credentials:** \`${result.cors.allowCredentials ? 'true' : 'false'}\``,
      ``
    );
  }

  // Secrets Section
  if (result.secretsDetected.length > 0) {
    lines.push(
      `## 6. Leaked Secrets & Sensitive Credentials Analysis`,
      ``,
      `⚠️ **${result.secretsDetected.length} potential secrets or internal addresses identified in response body:**`,
      ``,
      `| Type | Extracted Evidence Snippet |`,
      `| :--- | :--- |`
    );
    result.secretsDetected.forEach((s) => {
      lines.push(`| **${s.type}** | \`${s.snippet}\` |`);
    });
    lines.push(``);
  }

  // Attack Surface Endpoints
  lines.push(
    `## 7. Attack Surface Endpoints & Forms (${result.endpointsDetected.length} Detected)`,
    ``
  );
  if (result.endpointsDetected.length > 0) {
    lines.push(
      `| ID | Category | Method | Path / Endpoint |`,
      `| :--- | :---: | :---: | :--- |`
    );
    result.endpointsDetected.slice(0, 25).forEach((ep) => {
      lines.push(`| #${ep.id} | \`${ep.category.toUpperCase()}\` | \`${ep.method || 'GET'}\` | \`${ep.path}\` |`);
    });
    if (result.endpointsDetected.length > 25) {
      lines.push(`\n*... and ${result.endpointsDetected.length - 25} additional endpoints omitted for brevity.*`);
    }
  } else {
    lines.push(`*No actionable links or forms detected on target URL.*`);
  }

  // Detailed Findings & Remediation Section
  lines.push(
    ``,
    `## 8. Detailed Vulnerability Findings & Actionable Remediation`,
    ``
  );

  if (result.findings.length === 0) {
    lines.push(`*No high-severity vulnerabilities identified during automated passive assessment.*`);
  } else {
    result.findings.forEach((f, idx) => {
      lines.push(
        `### 8.${idx + 1} [${f.severity}] ${f.title}`,
        ``,
        `- **Finding ID:** \`${f.id}\` | **CVSS v3.1:** \`${f.cvssScore}\` | **Category:** ${f.category}`,
        `- **Affected Asset:** \`${f.affectedAsset}\``,
        ``,
        `**Technical Description:**`,
        `${f.description}`,
        ``,
        `**Demonstrated Security Impact:**`,
        `${f.impact}`,
        ``,
        `**Recommended Remediation:**`,
        `> ${f.remediation}`,
        ``,
        `- **References:** ${(f.references || []).join(', ') || 'N/A'}`,
        ``
      );
    });
  }

  if (result.aiRemediationSummary) {
    lines.push(
      `## 9. Automated AI & DevSecOps Remediation Playbook`,
      ``,
      result.aiRemediationSummary,
      ``
    );
  }

  lines.push(
    `---`,
    `*Report autonomously compiled by DualSurf Cybersecurity Engine. Generated 100% offline and air-gap compliant.*`
  );

  return lines.join('\n');
}

/**
 * Generate rich, standalone, dark-themed, 100% offline Interactive HTML penetration test report.
 */
export function generateHtmlAuditReport(result: FullSecurityAuditResult): string {
  const crit = result.findings.filter((f) => f.severity === 'CRITICAL').length;
  const high = result.findings.filter((f) => f.severity === 'HIGH').length;
  const med = result.findings.filter((f) => f.severity === 'MEDIUM').length;
  const low = result.findings.filter((f) => f.severity === 'LOW').length;

  const scoreCircumference = 2 * Math.PI * 45; // r=45
  const scoreOffset = scoreCircumference - (result.securityScore / 100) * scoreCircumference;

  const gradeColor =
    result.grade === 'A'
      ? '#10b981'
      : result.grade === 'B'
      ? '#06b6d4'
      : result.grade === 'C'
      ? '#eab308'
      : result.grade === 'D'
      ? '#f97316'
      : '#ef4444';

  const riskBadgeClass =
    result.riskRating === 'CRITICAL'
      ? 'badge-crit'
      : result.riskRating === 'HIGH'
      ? 'badge-high'
      : result.riskRating === 'MEDIUM'
      ? 'badge-med'
      : result.riskRating === 'LOW'
      ? 'badge-low'
      : 'badge-clean';

  // Findings list items
  const findingsHtml = result.findings
    .map((f, idx) => {
      const sevClass =
        f.severity === 'CRITICAL'
          ? 'crit'
          : f.severity === 'HIGH'
          ? 'high'
          : f.severity === 'MEDIUM'
          ? 'med'
          : f.severity === 'LOW'
          ? 'low'
          : 'info';

      const refs = (f.references || [])
        .map((r) => `<span class="tag">${escapeHtml(r)}</span>`)
        .join(' ');

      return `
        <div class="finding-card ${sevClass}" data-severity="${f.severity}">
          <div class="finding-header" onclick="toggleFinding(this)">
            <div class="finding-title-row">
              <span class="badge badge-${sevClass}">${f.severity} ${f.cvssScore ? `(${f.cvssScore})` : ''}</span>
              <span class="finding-title">#${idx + 1} ${escapeHtml(f.title)}</span>
            </div>
            <div class="finding-meta">
              <span class="tag-id">${escapeHtml(f.id)}</span>
              <span class="tag-cat">${escapeHtml(f.category)}</span>
              <span class="chevron">▼</span>
            </div>
          </div>
          <div class="finding-body">
            <p><strong>Affected Asset:</strong> <code>${escapeHtml(f.affectedAsset)}</code></p>
            <div class="desc-box">
              <h4>Technical Description</h4>
              <p>${escapeHtml(f.description)}</p>
            </div>
            <div class="impact-box">
              <h4>Demonstrated Security Impact</h4>
              <p>${escapeHtml(f.impact)}</p>
            </div>
            <div class="rem-box">
              <h4>Actionable Remediation Guidance</h4>
              <p>${escapeHtml(f.remediation)}</p>
            </div>
            ${refs ? `<div class="refs-box"><h4>Standards & References:</h4> ${refs}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  // Headers table rows
  const headersRows = result.headers.items
    .map((item) => {
      const statusBadge =
        item.status === 'good'
          ? '<span class="status-pass">PASS</span>'
          : item.status === 'warning'
          ? '<span class="status-warn">WARN</span>'
          : '<span class="status-fail">MISSING</span>';
      return `
        <tr>
          <td><code>${escapeHtml(item.name)}</code></td>
          <td>${statusBadge}</td>
          <td>${escapeHtml(item.description)}</td>
          <td><code>${escapeHtml(item.value || '(Not configured)')}</code></td>
        </tr>
      `;
    })
    .join('');

  // Cookies table rows
  const cookiesRows = (result.cookiesAudited || [])
    .map((c) => {
      const secBadge = c.hasSecure ? '<span class="status-pass">YES</span>' : '<span class="status-fail">NO</span>';
      const httpBadge = c.hasHttpOnly ? '<span class="status-pass">YES</span>' : '<span class="status-fail">NO</span>';
      const sessBadge = c.isSessionCookie ? '<span class="status-warn">SESSION</span>' : '<span class="tag">STANDARD</span>';
      const issuesText = c.issues.length
        ? `<ul class="issues-list">${c.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
        : '<span class="status-pass">Secure</span>';

      return `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong> ${sessBadge}</td>
          <td>${secBadge}</td>
          <td>${httpBadge}</td>
          <td><code>${escapeHtml(c.sameSite)}</code></td>
          <td>${issuesText}</td>
        </tr>
      `;
    })
    .join('');

  // Endpoints rows
  const endpointsRows = result.endpointsDetected
    .slice(0, 30)
    .map((ep) => {
      const catClass =
        ep.category === 'api'
          ? 'badge-api'
          : ep.category === 'auth'
          ? 'badge-auth'
          : ep.category === 'form'
          ? 'badge-form'
          : 'badge-link';
      return `
        <tr>
          <td>#${ep.id}</td>
          <td><span class="badge ${catClass}">${ep.category.toUpperCase()}</span></td>
          <td><code>${escapeHtml(ep.method || 'GET')}</code></td>
          <td><code>${escapeHtml(ep.path)}</code></td>
          <td>${ep.isExternal ? '<span class="tag">External</span>' : '<span class="tag">Internal</span>'}</td>
        </tr>
      `;
    })
    .join('');

  // Secrets rows
  const secretsRows = result.secretsDetected
    .map(
      (s) => `
      <tr>
        <td><strong class="text-crit">${escapeHtml(s.type)}</strong></td>
        <td><code>${escapeHtml(s.snippet)}</code></td>
      </tr>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Audit Report - ${escapeHtml(result.host)}</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-header: #1f2937;
      --border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #0ea5e9;
      --crit: #ef4444;
      --high: #f97316;
      --med: #eab308;
      --low: #3b82f6;
      --clean: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo {
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 20px;
      color: #fff;
    }
    h1 { font-size: 24px; font-weight: 700; color: #fff; }
    .subtitle { font-size: 14px; color: var(--text-muted); }
    .actions { display: flex; gap: 10px; }
    .btn {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn:hover { background: #1f2937; border-color: var(--accent); }
    .btn-primary { background: var(--accent); color: #fff; border: none; }
    .btn-primary:hover { background: #0284c7; }

    /* Overview Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .kpi-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px; }
    .kpi-value { font-size: 28px; font-weight: 800; color: #fff; }
    .kpi-subtitle { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

    /* Score Gauge */
    .gauge-card { align-items: center; text-align: center; }
    .gauge-wrapper { position: relative; width: 120px; height: 120px; margin: 10px 0; }
    .gauge-wrapper svg { transform: rotate(-90deg); width: 120px; height: 120px; }
    .gauge-bg { fill: none; stroke: #1f2937; stroke-width: 10; }
    .gauge-fill {
      fill: none;
      stroke: ${gradeColor};
      stroke-width: 10;
      stroke-linecap: round;
      stroke-dasharray: ${scoreCircumference};
      stroke-dashoffset: ${scoreOffset};
      transition: stroke-dashoffset 1s ease;
    }
    .gauge-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 24px;
      font-weight: 800;
      color: #fff;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-crit { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }
    .badge-high { background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid #f97316; }
    .badge-med { background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid #eab308; }
    .badge-low { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #3b82f6; }
    .badge-clean { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; }
    .badge-api { background: rgba(14, 165, 233, 0.2); color: #38bdf8; }
    .badge-auth { background: rgba(234, 179, 8, 0.2); color: #fde047; }
    .badge-form { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
    .badge-link { background: rgba(156, 163, 175, 0.2); color: #9ca3af; }
    .status-pass { color: var(--clean); font-weight: 700; }
    .status-warn { color: var(--med); font-weight: 700; }
    .status-fail { color: var(--crit); font-weight: 700; }
    .text-crit { color: var(--crit); }

    /* Sections */
    .section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-btn {
      background: #1f2937;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 600;
    }
    .filter-btn.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    .search-input {
      background: #1f2937;
      border: 1px solid var(--border);
      color: #fff;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      margin-left: auto;
      min-width: 220px;
    }

    /* Finding Card */
    .finding-card {
      background: #151d30;
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 12px;
      overflow: hidden;
      border-left: 4px solid var(--accent);
    }
    .finding-card.crit { border-left-color: var(--crit); }
    .finding-card.high { border-left-color: var(--high); }
    .finding-card.med { border-left-color: var(--med); }
    .finding-card.low { border-left-color: var(--low); }

    .finding-header {
      padding: 14px 18px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.02);
      user-select: none;
    }
    .finding-header:hover { background: rgba(255, 255, 255, 0.05); }
    .finding-title-row { display: flex; align-items: center; gap: 12px; }
    .finding-title { font-weight: 600; font-size: 15px; color: #fff; }
    .finding-meta { display: flex; align-items: center; gap: 8px; }
    .tag-id { font-family: monospace; font-size: 11px; background: #1f2937; padding: 2px 6px; border-radius: 4px; }
    .tag-cat { font-size: 11px; color: var(--text-muted); }
    .chevron { font-size: 10px; color: var(--text-muted); transition: transform 0.2s; }
    .finding-card.open .chevron { transform: rotate(180deg); }

    .finding-body {
      padding: 18px;
      display: none;
      border-top: 1px solid var(--border);
      font-size: 14px;
    }
    .finding-card.open .finding-body { display: block; }
    .desc-box, .impact-box, .rem-box, .refs-box { margin-top: 14px; }
    .desc-box h4, .impact-box h4, .rem-box h4, .refs-box h4 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .rem-box {
      background: rgba(14, 165, 233, 0.08);
      border-left: 3px solid var(--accent);
      padding: 10px 14px;
      border-radius: 4px;
    }
    .tag {
      display: inline-block;
      background: #1f2937;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      color: #cbd5e1;
      margin-right: 4px;
    }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th {
      background: #1f2937;
      padding: 10px 14px;
      color: var(--text-muted);
      font-weight: 600;
      border-bottom: 1px solid var(--border);
    }
    td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }
    code { font-family: monospace; font-size: 12px; background: rgba(0, 0, 0, 0.3); padding: 2px 4px; border-radius: 4px; }
    .issues-list { margin-left: 18px; color: var(--med); }

    footer {
      text-align: center;
      padding: 24px;
      font-size: 12px;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      margin-top: 40px;
    }

    /* Print Styles */
    @media print {
      body { background: #fff !important; color: #111 !important; padding: 0; }
      .no-print { display: none !important; }
      .section, .kpi-card, .finding-card {
        background: #fff !important;
        border: 1px solid #ddd !important;
        box-shadow: none !important;
        color: #111 !important;
        page-break-inside: avoid;
      }
      .finding-body { display: block !important; }
      th { background: #f3f4f6 !important; color: #111 !important; }
      code { background: #f3f4f6 !important; color: #111 !important; }
      .rem-box { background: #f0fdf4 !important; border-left: 3px solid #16a34a !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-logo">DS</div>
        <div>
          <h1>Automated Penetration Test & Security Audit Report</h1>
          <div class="subtitle">Target: <strong>${escapeHtml(result.normalizedUrl)}</strong> | Date: ${result.timestamp} | Duration: ${result.durationMs}ms</div>
        </div>
      </div>
      <div class="actions no-print">
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
      </div>
    </header>

    <!-- KPI Metrics Grid -->
    <div class="kpi-grid">
      <div class="kpi-card gauge-card">
        <div class="kpi-title">Overall Security Score</div>
        <div class="gauge-wrapper">
          <svg>
            <circle class="gauge-bg" cx="60" cy="60" r="45"></circle>
            <circle class="gauge-fill" cx="60" cy="60" r="45"></circle>
          </svg>
          <div class="gauge-text">${result.securityScore}%</div>
        </div>
        <div class="kpi-subtitle">Compliance Rating: <strong>Grade ${result.grade}</strong></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">Overall Risk Posture</div>
        <div class="kpi-value"><span class="badge ${riskBadgeClass}" style="font-size: 20px; padding: 6px 14px;">${result.riskRating}</span></div>
        <div class="kpi-subtitle" style="margin-top: 14px;">
          Reachability: ${result.reachable ? '✅ Online (HTTP ' + result.statusCode + ')' : '❌ Unreachable'}<br>
          Scope RoE: ${result.inScope !== undefined ? (result.inScope ? '✅ Authorized' : '⚠️ Out of Scope') : 'Evaluated'}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">Identified Vulnerabilities</div>
        <div class="kpi-value">${result.findings.length}</div>
        <div class="kpi-subtitle" style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
          <span class="badge badge-crit">${crit} Critical</span>
          <span class="badge badge-high">${high} High</span>
          <span class="badge badge-med">${med} Med</span>
          <span class="badge badge-low">${low} Low</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">TLS / SSL Transport</div>
        <div class="kpi-value" style="font-size: 20px;">
          ${result.tls ? (result.tls.authorized ? '✅ Trusted CA' : '❌ Untrusted') : 'Unencrypted HTTP'}
        </div>
        <div class="kpi-subtitle" style="margin-top: 10px;">
          ${result.tls ? `Protocol: ${result.tls.protocol} | ${result.tls.daysRemaining} days remaining` : 'Cleartext transmission risk'}
        </div>
      </div>
    </div>

    <!-- Section: Vulnerability Findings -->
    <div class="section">
      <div class="section-title">
        <span>Detailed Vulnerability Findings (${result.findings.length})</span>
        <button class="btn no-print" onclick="toggleAllFindings()">Toggle All</button>
      </div>

      <div class="filter-bar no-print">
        <button class="filter-btn active" onclick="filterFindings('ALL', this)">All (${result.findings.length})</button>
        <button class="filter-btn" onclick="filterFindings('CRITICAL', this)">Critical (${crit})</button>
        <button class="filter-btn" onclick="filterFindings('HIGH', this)">High (${high})</button>
        <button class="filter-btn" onclick="filterFindings('MEDIUM', this)">Medium (${med})</button>
        <button class="filter-btn" onclick="filterFindings('LOW', this)">Low (${low})</button>
        <input type="text" class="search-input" placeholder="Search vulnerabilities..." oninput="searchFindings(this.value)">
      </div>

      <div id="findings-container">
        ${findingsHtml || '<p style="color: var(--text-muted);">No vulnerabilities identified during this scan.</p>'}
      </div>
    </div>

    <!-- Section: External Attack Surface & Asset Register -->
    ${
      result.attackSurfaceRegister && result.attackSurfaceRegister.length > 0
        ? `
      <div class="section">
        <div class="section-title">External Attack Surface & Asset Register (${result.attackSurfaceRegister.length} Discovered Assets)</div>
        <table>
          <thead>
            <tr>
              <th>Asset Hostname</th>
              <th>IP Address</th>
              <th>Type</th>
              <th>Environment</th>
              <th>Discovery Source</th>
              <th>Scope</th>
            </tr>
          </thead>
          <tbody>
            ${result.attackSurfaceRegister
              .map(
                (a) => `
              <tr>
                <td><code>${escapeHtml(a.hostname)}</code></td>
                <td><code>${escapeHtml(a.ip || '(DNS lookup)')}</code></td>
                <td><span class="tag">${escapeHtml(a.assetType)}</span></td>
                <td><span class="badge ${a.environment === 'production' ? 'badge-clean' : 'badge-med'}">${escapeHtml(a.environment)}</span></td>
                <td>${escapeHtml(a.source)}</td>
                <td>${a.inScope ? '✅ In Scope' : '⚠️ Out of Scope'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <!-- Section: Email & Domain Authentication Posture -->
    ${
      result.emailSecurity
        ? `
      <div class="section">
        <div class="section-title">Email & Domain Authentication Posture</div>
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <span class="tag">SPF: ${result.emailSecurity.hasSpf ? '<strong class="status-pass">Enforced</strong>' : '<strong class="text-crit">Missing (Spoofing Risk)</strong>'}</span>
          <span class="tag">DMARC Policy: ${result.emailSecurity.dmarcPolicy === 'reject' || result.emailSecurity.dmarcPolicy === 'quarantine' ? '<strong class="status-pass">' + (result.emailSecurity.dmarcPolicy || 'MISSING').toUpperCase() + '</strong>' : '<strong class="text-crit">' + (result.emailSecurity.dmarcPolicy || 'MISSING').toUpperCase() + '</strong>'}</span>
          <span class="tag">MX Mail Exchangers: <strong>${result.emailSecurity.mxRecords.length} configured</strong></span>
        </div>
        ${
          result.emailSecurity.issues.length
            ? `<ul class="issues-list">${result.emailSecurity.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
            : '<p class="status-pass">✔ Domain passes baseline email authentication checks.</p>'
        }
      </div>
    `
        : ''
    }

    <!-- Section: Administrative & Sensitive Interfaces -->
    ${
      result.adminInterfaces && result.adminInterfaces.length > 0
        ? `
      <div class="section">
        <div class="section-title">Administrative & Sensitive Interface Probes (${result.adminInterfaces.length} Responded)</div>
        <table>
          <thead>
            <tr>
              <th>Probed Path</th>
              <th>Status Code</th>
              <th>Exposure Status</th>
              <th>Observation / Finding</th>
            </tr>
          </thead>
          <tbody>
            ${result.adminInterfaces
              .map(
                (ai) => `
              <tr>
                <td><code>${escapeHtml(ai.path)}</code></td>
                <td><span class="badge ${ai.status === 200 ? (ai.exposed ? 'badge-crit' : 'badge-med') : 'badge-clean'}">HTTP ${ai.status}</span></td>
                <td>${ai.exposed ? '<span class="status-fail">EXPOSED PUBLICLY</span>' : '<span class="status-pass">RESTRICTED</span>'}</td>
                <td>${escapeHtml(ai.notes || 'Endpoint probed')}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <!-- Section: Cloud Storage Bucket Exposure -->
    ${
      result.cloudStorage && result.cloudStorage.length > 0
        ? `
      <div class="section">
        <div class="section-title">Cloud Storage Bucket Exposure (${result.cloudStorage.length} Discovered)</div>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Bucket Identifier</th>
              <th>Public Read Status</th>
              <th>Directory Listing</th>
              <th>Audit Observation</th>
            </tr>
          </thead>
          <tbody>
            ${result.cloudStorage
              .map(
                (b) => `
              <tr>
                <td><strong>${escapeHtml(b.provider.toUpperCase())}</strong></td>
                <td><code>${escapeHtml(b.bucketName)}</code></td>
                <td>${b.publiclyReadable ? '<span class="status-fail">PUBLIC READ</span>' : '<span class="status-pass">PROTECTED</span>'}</td>
                <td>${b.listingEnabled ? '<span class="status-fail">ENABLED</span>' : '<span class="status-pass">DISABLED</span>'}</td>
                <td>${escapeHtml(b.details || 'Bucket assessed')}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <!-- Section: Subdomain Takeover & Dangling CNAMEs -->
    ${
      result.subdomainTakeovers && result.subdomainTakeovers.length > 0
        ? `
      <div class="section">
        <div class="section-title">Subdomain Takeover & Dangling CNAME Audits (${result.subdomainTakeovers.length} Audited)</div>
        <table>
          <thead>
            <tr>
              <th>Subdomain</th>
              <th>Service Provider</th>
              <th>CNAME Target</th>
              <th>Takeover Risk</th>
            </tr>
          </thead>
          <tbody>
            ${result.subdomainTakeovers
              .map(
                (t) => `
              <tr>
                <td><code>${escapeHtml(t.subdomain)}</code></td>
                <td><strong>${escapeHtml(t.service || 'Third-Party')}</strong></td>
                <td><code>${escapeHtml(t.cnameDestination || '')}</code></td>
                <td>${t.vulnerable ? '<span class="status-fail">VULNERABLE TO TAKEOVER</span>' : '<span class="status-pass">NOT VULNERABLE</span>'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <!-- Section: API Discovery & GraphQL Introspection -->
    ${
      result.apiDiscovery && (result.apiDiscovery.openApiFound || result.apiDiscovery.graphQlFound)
        ? `
      <div class="section">
        <div class="section-title">API Specification & GraphQL Introspection Audit</div>
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <span class="tag">OpenAPI: ${result.apiDiscovery.openApiFound ? '<strong class="status-pass">Found (' + (result.apiDiscovery.endpointsCount ?? 0) + ' routes)</strong>' : '<strong class="status-warn">None</strong>'}</span>
          <span class="tag">GraphQL Introspection: ${result.apiDiscovery.graphQlIntrospectionEnabled ? '<strong class="status-fail">OPEN (' + (result.apiDiscovery.typesCount ?? 0) + ' types)</strong>' : '<strong class="status-pass">Hardened / None</strong>'}</span>
        </div>
      </div>
    `
        : ''
    }

    <!-- Section: Open Ports & Exposed Services -->
    ${
      result.portAudit && result.portAudit.openPorts.length > 0
        ? `
      <div class="section">
        <div class="section-title">Perimeter Ports & Exposed Services (${result.portAudit.openPorts.length} Open)</div>
        <table>
          <thead>
            <tr>
              <th>Port</th>
              <th>Protocol</th>
              <th>Service</th>
              <th>Risk</th>
              <th>Latency</th>
              <th>Banner / Signature</th>
              <th>Hardening Recommendation</th>
            </tr>
          </thead>
          <tbody>
            ${result.portAudit.openPorts
              .map(
                (p) => `
              <tr>
                <td><strong>${p.port}</strong></td>
                <td><code>${escapeHtml(p.protocol)}</code></td>
                <td><code>${escapeHtml(p.service)}</code></td>
                <td><span class="badge badge-${p.risk.toLowerCase()}">${p.risk}</span></td>
                <td>${p.latencyMs || 0}ms</td>
                <td><code>${escapeHtml(p.banner || '(open)')}</code></td>
                <td>${escapeHtml(p.hardeningAdvice || 'Harden service')}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <!-- Section: Cookie Security Audit -->
    ${
      result.cookiesAudited && result.cookiesAudited.length > 0
        ? `
      <div class="section">
        <div class="section-title">Cookie Security & Session Flags Audit (${result.cookiesAudited.length} Cookies)</div>
        <table>
          <thead>
            <tr>
              <th>Cookie Identifier</th>
              <th>Secure Flag</th>
              <th>HttpOnly</th>
              <th>SameSite</th>
              <th>Audit Findings</th>
            </tr>
          </thead>
          <tbody>
            ${cookiesRows}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <!-- Section: Content Security Policy Audit -->
    ${
      result.cspAudit
        ? `
      <div class="section">
        <div class="section-title">Content Security Policy (CSP) Deep Inspection</div>
        <p style="margin-bottom: 12px;"><strong>Raw Policy:</strong> <code>${escapeHtml(result.cspAudit.rawDirective || 'None declared')}</code></p>
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <span class="tag">unsafe-inline: ${result.cspAudit.hasUnsafeInline ? '<strong class="text-crit">Permitted (High Risk)</strong>' : '<strong class="status-pass">Blocked</strong>'}</span>
          <span class="tag">unsafe-eval: ${result.cspAudit.hasUnsafeEval ? '<strong class="text-crit">Permitted</strong>' : '<strong class="status-pass">Blocked</strong>'}</span>
          <span class="tag">Wildcard *: ${result.cspAudit.hasWildcard ? '<strong class="text-crit">Detected</strong>' : '<strong class="status-pass">None</strong>'}</span>
          <span class="tag">base-uri: ${result.cspAudit.missingBaseUri ? '<strong class="status-warn">Missing</strong>' : '<strong class="status-pass">Enforced</strong>'}</span>
        </div>
        ${
          result.cspAudit.issues.length
            ? `<ul class="issues-list">${result.cspAudit.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
            : '<p class="status-pass">✔ CSP directives pass basic hardening criteria.</p>'
        }
      </div>
    `
        : ''
    }

    <!-- Section: Deep TLS Protocol & Cryptographic Audit -->
    ${
      result.tlsCrypto
        ? `
      <div class="section">
        <div class="section-title">Deep TLS Protocol & Cipher Suite Cryptographic Audit</div>
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <span class="tag">Protocol: ${result.tlsCrypto.isDeprecatedProtocol ? '<strong class="text-crit">' + escapeHtml(result.tlsCrypto.protocol) + ' (DEPRECATED)</strong>' : '<strong class="status-pass">' + escapeHtml(result.tlsCrypto.protocol) + '</strong>'}</span>
          <span class="tag">Cipher: ${result.tlsCrypto.isWeakCipher ? '<strong class="text-crit">' + escapeHtml(result.tlsCrypto.cipherName) + ' (WEAK)</strong>' : '<strong class="status-pass">' + escapeHtml(result.tlsCrypto.cipherName) + '</strong>'}</span>
          <span class="tag">Perfect Forward Secrecy (PFS): ${result.tlsCrypto.hasPfs ? '<strong class="status-pass">Enforced</strong>' : '<strong class="text-crit">Missing</strong>'}</span>
        </div>
        ${
          result.tlsCrypto.flaws.length
            ? `<ul class="issues-list">${result.tlsCrypto.flaws.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
            : '<p class="status-pass">✔ Transport layer cryptography adheres to modern zero-trust standards.</p>'
        }
      </div>
    `
        : ''
    }

    <!-- Section: Frontend Dependency CVE & Supply Chain Scanner -->
    ${
      result.dependencies && result.dependencies.length > 0
        ? `
      <div class="section">
        <div class="section-title text-crit">Frontend Dependencies & Known Supply Chain CVEs (${result.dependencies.length} Libraries)</div>
        <table>
          <thead>
            <tr>
              <th>Library</th>
              <th>Detected Version</th>
              <th>Fixed In</th>
              <th>CVE Vulnerabilities</th>
              <th>Source Script</th>
            </tr>
          </thead>
          <tbody>
            ${result.dependencies
              .map(
                (d) => `
              <tr>
                <td><strong>${escapeHtml(d.library)}</strong></td>
                <td><code>${escapeHtml(d.detectedVersion)}</code></td>
                <td><span class="status-pass">${escapeHtml(d.cveList[0]?.fixedIn || 'Latest')}</span></td>
                <td>
                  ${d.cveList
                    .map(
                      (c) => `<span class="badge badge-${c.severity.toLowerCase()}">${escapeHtml(c.cveId)}</span> ${escapeHtml(c.summary)}`
                    )
                    .join('<br/>')}
                </td>
                <td><code>${escapeHtml(d.sourceUrl)}</code></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <!-- Section: HTTP Security Headers -->
    <div class="section">
      <div class="section-title">HTTP Security Headers Compliance Matrix (Score: ${result.headers.score}%)</div>
      <table>
        <thead>
          <tr>
            <th>Security Header</th>
            <th>Status</th>
            <th>Protection Focus</th>
            <th>Response Value</th>
          </tr>
        </thead>
        <tbody>
          ${headersRows}
        </tbody>
      </table>
    </div>

    <!-- Section: Secrets -->
    ${
      result.secretsDetected.length > 0
        ? `
      <div class="section">
        <div class="section-title text-crit">Exposed Credentials & Sensitive Tokens (${result.secretsDetected.length} detected)</div>
        <table>
          <thead>
            <tr>
              <th>Credential Type</th>
              <th>Detected Evidence Snippet</th>
            </tr>
          </thead>
          <tbody>
            ${secretsRows}
          </tbody>
        </table>
      </div>
    `
        : ''
    }

    <!-- Section: Endpoints -->
    <div class="section">
      <div class="section-title">Discovered Attack Surface Endpoints (${result.endpointsDetected.length} total)</div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Method</th>
            <th>Path / Query</th>
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          ${endpointsRows || '<tr><td colspan="5">No endpoints extracted.</td></tr>'}
        </tbody>
      </table>
    </div>

    ${
      result.aiRemediationSummary
        ? `
      <div class="section">
        <div class="section-title">Automated AI & DevSecOps Remediation Playbook</div>
        <div style="white-space: pre-wrap; font-family: monospace; font-size: 13px; background: rgba(0,0,0,0.4); padding: 18px; border-radius: 8px; line-height: 1.5; color: #e2e8f0; overflow-x: auto; border-left: 4px solid var(--accent);">${escapeHtml(result.aiRemediationSummary)}</div>
      </div>
    `
        : ''
    }

    <footer>
      Autonomous Penetration Testing & Vulnerability Assessment Report generated 100% offline by DualSurf Cybersecurity Engine.
    </footer>
  </div>

  <script>
    function toggleFinding(el) {
      el.parentElement.classList.toggle('open');
    }

    function toggleAllFindings() {
      const cards = document.querySelectorAll('.finding-card');
      const anyClosed = Array.from(cards).some(c => !c.classList.contains('open'));
      cards.forEach(c => {
        if (anyClosed) c.classList.add('open');
        else c.classList.remove('open');
      });
    }

    function filterFindings(sev, btn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cards = document.querySelectorAll('.finding-card');
      cards.forEach(card => {
        if (sev === 'ALL' || card.getAttribute('data-severity') === sev) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function searchFindings(query) {
      const q = query.toLowerCase().trim();
      const cards = document.querySelectorAll('.finding-card');
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (!q || text.includes(q)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Compare two automated audit results to track security remediation progress and score trajectories.
 */
export function compareAuditResults(
  previous: FullSecurityAuditResult,
  current: FullSecurityAuditResult
): AuditComparisonDiff {
  const previousTarget = previous.normalizedUrl || previous.targetUrl;
  const currentTarget = current.normalizedUrl || current.targetUrl;
  const previousTimestamp = previous.timestamp;
  const currentTimestamp = current.timestamp;
  const previousScore = previous.securityScore;
  const currentScore = current.securityScore;
  const scoreDelta = currentScore - previousScore;
  const gradeChange = `${previous.grade} -> ${current.grade}`;

  const prevFindings = previous.findings || [];
  const currFindings = current.findings || [];

  const currTitles = new Set(currFindings.map((f) => f.title.toLowerCase().trim()));
  const prevTitles = new Set(prevFindings.map((f) => f.title.toLowerCase().trim()));

  const resolvedFindings = prevFindings.filter(
    (pf) => !currTitles.has(pf.title.toLowerCase().trim())
  );
  const newFindings = currFindings.filter(
    (cf) => !prevTitles.has(cf.title.toLowerCase().trim())
  );
  const unresolvedFindings = currFindings.filter(
    (cf) => prevTitles.has(cf.title.toLowerCase().trim())
  );

  return {
    previousTarget,
    currentTarget,
    previousTimestamp,
    currentTimestamp,
    previousScore,
    currentScore,
    scoreDelta,
    gradeChange,
    resolvedFindings,
    newFindings,
    unresolvedFindings,
  };
}

/**
 * Format audit comparison diff into terminal output.
 */
export function formatAuditComparisonTerminal(diff: AuditComparisonDiff): string {
  const deltaColor =
    diff.scoreDelta > 0 ? colors.green : diff.scoreDelta < 0 ? colors.red : colors.cyan;
  const deltaSign = diff.scoreDelta > 0 ? `+${diff.scoreDelta}` : `${diff.scoreDelta}`;

  const lines = [
    `\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.cyan}║             DUALSURF SECURITY AUDIT COMPARISON & DIFF              ║${colors.reset}`,
    `${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`,
    `  ${colors.bold}Target:${colors.reset}           ${colors.cyan}${diff.currentTarget}${colors.reset}`,
    `  ${colors.bold}Previous Scan:${colors.reset}    ${diff.previousTimestamp} (Score: ${diff.previousScore})`,
    `  ${colors.bold}Current Scan:${colors.reset}     ${diff.currentTimestamp} (Score: ${diff.currentScore})`,
    `  ${colors.bold}Score Delta:${colors.reset}      ${deltaColor}${colors.bold}${deltaSign} pts${colors.reset} (Grade: ${diff.gradeChange})`,
    `  ${colors.bold}Remediation:${colors.reset}      ${colors.green}✔ ${diff.resolvedFindings.length} Resolved${colors.reset} | ${colors.red}✖ ${diff.newFindings.length} New${colors.reset} | ${colors.yellow}⚠ ${diff.unresolvedFindings.length} Unresolved${colors.reset}`,
    `${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (diff.resolvedFindings.length > 0) {
    lines.push(`\n  ${colors.bold}${colors.green}RESOLVED VULNERABILITIES (${diff.resolvedFindings.length}):${colors.reset}`);
    diff.resolvedFindings.forEach((f) => {
      lines.push(`    ${colors.green}✔ [${f.severity}] ${f.title}${colors.reset}`);
    });
  }

  if (diff.newFindings.length > 0) {
    lines.push(`\n  ${colors.bold}${colors.red}NEW VULNERABILITIES DETECTED (${diff.newFindings.length}):${colors.reset}`);
    diff.newFindings.forEach((f) => {
      lines.push(`    ${colors.red}✖ [${f.severity} CVSS ${f.cvssScore}] ${f.title}${colors.reset}`);
      lines.push(`      ${colors.dim}Fix: ${f.remediation}${colors.reset}`);
    });
  }

  if (diff.unresolvedFindings.length > 0) {
    lines.push(`\n  ${colors.bold}${colors.yellow}UNRESOLVED / PERSISTING (${diff.unresolvedFindings.length}):${colors.reset}`);
    diff.unresolvedFindings.slice(0, 5).forEach((f) => {
      lines.push(`    ${colors.yellow}⚠ [${f.severity}] ${f.title}${colors.reset}`);
    });
    if (diff.unresolvedFindings.length > 5) {
      lines.push(`    ${colors.dim}... and ${diff.unresolvedFindings.length - 5} more persisting findings.${colors.reset}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format automated security audit result for colorized CLI & terminal output.
 */
export function formatAutoAuditTerminal(result: FullSecurityAuditResult): string {
  const riskColor =
    result.riskRating === 'CRITICAL'
      ? colors.red
      : result.riskRating === 'HIGH'
      ? colors.yellow
      : result.riskRating === 'MEDIUM'
      ? colors.cyan
      : colors.green;

  const gradeColor =
    result.grade === 'A'
      ? colors.green
      : result.grade === 'B'
      ? colors.cyan
      : result.grade === 'C'
      ? colors.yellow
      : colors.red;

  const lines: string[] = [
    `\n${colors.bold}${colors.red}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.red}║       DUALSURF AUTOMATED SECURITY AUDIT & VULNERABILITY REPORT     ║${colors.reset}`,
    `${colors.bold}${colors.red}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`,
    `  ${colors.bold}Target URL:${colors.reset}       ${colors.cyan}${result.normalizedUrl}${colors.reset}`,
    `  ${colors.bold}Reachability:${colors.reset}     ${result.reachable ? `${colors.green}✔ Online (HTTP ${result.statusCode})${colors.reset}` : `${colors.red}✖ Host Unreachable${colors.reset}`} (${result.durationMs}ms)`,
    `  ${colors.bold}Risk Rating:${colors.reset}      ${riskColor}${colors.bold}${result.riskRating}${colors.reset}`,
    `  ${colors.bold}Security Score:${colors.reset}   ${gradeColor}${result.securityScore} / 100 (Grade ${result.grade})${colors.reset}`,
  ];

  if (result.inScope !== undefined) {
    const scopeBadge = result.inScope
      ? `${colors.green}✔ AUTHORIZED IN-SCOPE${colors.reset}`
      : `${colors.red}✖ OUT OF SCOPE / UNAUTHORIZED${colors.reset}`;
    lines.push(`  ${colors.bold}RoE Scope:${colors.reset}        ${scopeBadge} (${result.scopeNotes || 'Validated'})`);
  }

  // Findings summary
  const crit = result.findings.filter((f) => f.severity === 'CRITICAL').length;
  const high = result.findings.filter((f) => f.severity === 'HIGH').length;
  const med = result.findings.filter((f) => f.severity === 'MEDIUM').length;
  const low = result.findings.filter((f) => f.severity === 'LOW').length;

  lines.push(
    `  ${colors.bold}Vulnerabilities:${colors.reset} ${colors.red}${crit} Critical${colors.reset}, ${colors.yellow}${high} High${colors.reset}, ${colors.cyan}${med} Medium${colors.reset}, ${low} Low`,
    `${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`
  );

  // TLS & Infrastructure
  if (result.tls) {
    const certColor = result.tls.isExpired ? colors.red : result.tls.daysRemaining < 30 ? colors.yellow : colors.green;
    const cryptoInfo = result.tlsCrypto
      ? ` | PFS: ${result.tlsCrypto.hasPfs ? colors.green + '✔' : colors.yellow + '✖'}${colors.reset}${result.tlsCrypto.isDeprecatedProtocol ? colors.red + ' [DEPRECATED PROTOCOL]' + colors.reset : ''}${result.tlsCrypto.isWeakCipher ? colors.yellow + ' [WEAK CIPHER]' + colors.reset : ''}`
      : '';
    lines.push(
      `  ${colors.bold}TLS Certificate:${colors.reset} ${certColor}${result.tls.authorized ? 'Trusted CA' : 'Untrusted'}${colors.reset} | ${result.tls.protocol} (${result.tls.cipherName}) | ${certColor}${result.tls.daysRemaining} days remaining${colors.reset}${cryptoInfo}`
    );
  }

  lines.push(
    `  ${colors.bold}Security Headers:${colors.reset} Score: ${result.headers.score}% (${result.headers.grade}) | Server: ${result.headers.serverBanner || colors.dim + 'Hidden' + colors.reset}`,
    `  ${colors.bold}CORS Security:${colors.reset}    ${result.cors?.risk === 'HIGH' ? colors.red : result.cors?.risk === 'MEDIUM' ? colors.yellow : colors.green}${result.cors?.risk || 'CLEAN'}${colors.reset} (${result.cors?.verdict})`
  );

  if (result.portAudit) {
    const openCount = result.portAudit.openPortsCount;
    const scanned = result.portAudit.scannedPortsCount;
    const critPorts = result.portAudit.highRiskCount;
    const portBadge =
      openCount === 0
        ? `${colors.green}0 open (${scanned} probed)${colors.reset}`
        : `${critPorts > 0 ? colors.red : colors.cyan}${openCount} open${colors.reset} (${scanned} probed, ${critPorts} high/crit)`;
    lines.push(`  ${colors.bold}Open Ports:${colors.reset}       ${portBadge}`);
    if (result.portAudit.openPorts.length > 0) {
      result.portAudit.openPorts.forEach((p) => {
        const pColor =
          p.risk === 'CRITICAL' || p.risk === 'HIGH'
            ? colors.red
            : p.risk === 'MEDIUM'
            ? colors.yellow
            : colors.green;
        lines.push(
          `    ${colors.gray}• Port ${p.port}/${p.protocol}:${colors.reset} ${colors.bold}${p.service}${colors.reset} [${pColor}${p.risk}${colors.reset}]${p.banner ? ` - ${colors.dim}${p.banner.slice(0, 45)}${colors.reset}` : ''}`
        );
      });
    }
  }

  if (result.attackSurfaceRegister && result.attackSurfaceRegister.length > 0) {
    const subCount = result.attackSurfaceRegister.length;
    const apis = result.attackSurfaceRegister.filter((a) => a.assetType === 'api').length;
    const admin = result.attackSurfaceRegister.filter((a) => a.assetType === 'admin').length;
    const staging = result.attackSurfaceRegister.filter((a) => a.assetType === 'staging' || a.environment === 'staging').length;
    lines.push(
      `  ${colors.bold}Attack Surface:${colors.reset}   ${colors.cyan}${subCount} discovered external assets${colors.reset} (${apis} APIs, ${admin} admin, ${staging} non-prod environments)`
    );
  }

  if (result.emailSecurity) {
    const policy = result.emailSecurity.dmarcPolicy || 'missing';
    const dmarcBadge =
      policy === 'reject' || policy === 'quarantine'
        ? `${colors.green}✔ DMARC ${policy.toUpperCase()}${colors.reset}`
        : `${colors.red}✖ DMARC ${policy.toUpperCase()}${colors.reset}`;
    const spfBadge = result.emailSecurity.hasSpf
      ? `${colors.green}✔ SPF Configured${colors.reset}`
      : `${colors.yellow}✖ Missing SPF${colors.reset}`;
    lines.push(`  ${colors.bold}Email Posture:${colors.reset}    ${dmarcBadge} | ${spfBadge}`);
  }

  if (result.adminInterfaces && result.adminInterfaces.length > 0) {
    const exposedList = result.adminInterfaces.filter((a) => a.exposed);
    if (exposedList.length > 0) {
      lines.push(
        `  ${colors.bold}${colors.red}Admin Interfaces:${colors.reset} ${colors.red}${exposedList.length} accessible sensitive routes (${exposedList.map((a) => a.path).join(', ')})${colors.reset}`
      );
    }
  }

  if (result.cookiesAudited && result.cookiesAudited.length > 0) {
    const totalIssues = result.cookiesAudited.reduce((acc, c) => acc + c.issues.length, 0);
    lines.push(
      `  ${colors.bold}Cookies Audited:${colors.reset}  ${result.cookiesAudited.length} set (${totalIssues === 0 ? colors.green + 'All flags secure' : colors.yellow + totalIssues + ' security issues detected'}${colors.reset})`
    );
  }

  if (result.cspAudit) {
    const cspStatus =
      result.cspAudit.issues.length === 0
        ? `${colors.green}Hardened${colors.reset}`
        : `${colors.yellow}${result.cspAudit.issues.length} warnings (unsafe-inline: ${result.cspAudit.hasUnsafeInline ? 'Yes' : 'No'})${colors.reset}`;
    lines.push(`  ${colors.bold}CSP Policy:${colors.reset}       ${cspStatus}`);
  }

  if (result.robotsPathsDiscovered && result.robotsPathsDiscovered.length > 0) {
    lines.push(
      `  ${colors.bold}robots.txt:${colors.reset}       ${colors.cyan}${result.robotsPathsDiscovered.length} sensitive disallowed paths discovered${colors.reset}`
    );
  }

  if (result.securityTxtDisclosed !== undefined) {
    lines.push(
      `  ${colors.bold}security.txt:${colors.reset}     ${result.securityTxtDisclosed ? `${colors.green}✔ RFC 9116 Policy Disclosed${colors.reset}` : `${colors.dim}Missing${colors.reset}`}`
    );
  }

  if (result.techProfile.servers.length || result.techProfile.frameworks.length || result.techProfile.cdnWaf.length) {
    const stack = [
      ...result.techProfile.servers,
      ...result.techProfile.frameworks,
      ...result.techProfile.cms,
      ...result.techProfile.cdnWaf,
    ].join(', ');
    lines.push(`  ${colors.bold}Tech Stack:${colors.reset}       ${colors.dim}${stack}${colors.reset}`);
  }

  if (result.secretsDetected.length > 0) {
    lines.push(
      `  ${colors.bold}${colors.red}Secrets Found:${colors.reset}    ${colors.red}${result.secretsDetected.length} leaked credential patterns detected in DOM!${colors.reset}`
    );
  }

  lines.push(
    `  ${colors.bold}Attack Surface:${colors.reset}   ${result.endpointsDetected.length} total endpoints (${result.endpointsDetected.filter((e) => e.category === 'api').length} API, ${result.endpointsDetected.filter((e) => e.category === 'auth').length} Auth, ${result.endpointsDetected.filter((e) => e.category === 'form').length} Forms)`
  );

  if (result.authenticatedAudit) {
    lines.push(`  ${colors.bold}Audit Mode:${colors.reset}       ${colors.magenta}AUTHENTICATED (Privileged Session Tokens Active)${colors.reset}`);
  }

  if (result.cloudStorage && result.cloudStorage.length > 0) {
    const openBuckets = result.cloudStorage.filter((b) => b.publiclyReadable);
    const bucketBadge =
      openBuckets.length > 0
        ? `${colors.red}✖ ${openBuckets.length} PUBLIC READ BUCKETS DETECTED!${colors.reset}`
        : `${colors.green}✔ ${result.cloudStorage.length} Private/Protected${colors.reset}`;
    lines.push(`  ${colors.bold}Cloud Storage:${colors.reset}    ${bucketBadge} (${result.cloudStorage.map((b) => b.bucketName).join(', ')})`);
  }

  if (result.subdomainTakeovers && result.subdomainTakeovers.length > 0) {
    const vulnTakeovers = result.subdomainTakeovers.filter((t) => t.vulnerable);
    const toBadge =
      vulnTakeovers.length > 0
        ? `${colors.red}✖ ${vulnTakeovers.length} VULNERABLE TO TAKEOVER!${colors.reset}`
        : `${colors.cyan}${result.subdomainTakeovers.length} third-party CNAMEs audited${colors.reset}`;
    lines.push(`  ${colors.bold}Subdomain Takeovers:${colors.reset} ${toBadge}`);
  }

  if (result.apiDiscovery && (result.apiDiscovery.openApiFound || result.apiDiscovery.graphQlFound)) {
    const apiParts: string[] = [];
    if (result.apiDiscovery.openApiFound) {
      apiParts.push(`OpenAPI (${result.apiDiscovery.endpointsCount ?? 0} routes)`);
    }
    if (result.apiDiscovery.graphQlFound) {
      apiParts.push(
        result.apiDiscovery.graphQlIntrospectionEnabled
          ? `${colors.red}GraphQL Introspection Open${colors.reset}`
          : `${colors.green}GraphQL Hardened${colors.reset}`
      );
    }
    lines.push(`  ${colors.bold}APIs & GraphQL:${colors.reset}   ${apiParts.join(' | ')}`);
  }

  if (result.dependencies && result.dependencies.length > 0) {
    const totalCves = result.dependencies.reduce((sum, d) => sum + d.cveList.length, 0);
    const depColor = totalCves > 0 ? colors.red : colors.green;
    const depList = result.dependencies.map((d) => `${d.library}@${d.detectedVersion} (${d.cveList.length} CVEs)`).join(', ');
    lines.push(
      `  ${colors.bold}Dependencies:${colors.reset}   ${depColor}${totalCves} Known Supply Chain CVEs${colors.reset} in loaded frontend scripts: ${depList}`
    );
  }

  // Top Findings
  if (result.findings.length > 0) {
    lines.push(`\n  ${colors.bold}${colors.yellow}TOP SECURITY FINDINGS IDENTIFIED:${colors.reset}`);
    result.findings.slice(0, 5).forEach((f) => {
      const sevColor = f.severity === 'CRITICAL' ? colors.red : f.severity === 'HIGH' ? colors.yellow : colors.cyan;
      lines.push(`    • [${sevColor}${f.severity}${colors.reset} CVSS ${f.cvssScore}] ${colors.bold}${f.title}${colors.reset}`);
      lines.push(`      ${colors.dim}Fix: ${f.remediation}${colors.reset}`);
    });
    if (result.findings.length > 5) {
      lines.push(`    ${colors.dim}... and ${result.findings.length - 5} additional findings in report file.${colors.reset}`);
    }
  }

  if (result.reportFilePath || result.htmlReportPath || result.jsonReportPath || result.sarifReportPath) {
    lines.push(`\n  ${colors.bold}${colors.green}✔ Security Assessment Reports Generated:${colors.reset}`);
    if (result.reportFilePath) lines.push(`    ${colors.gray}• Markdown:${colors.reset}        ${colors.cyan}${result.reportFilePath}${colors.reset}`);
    if (result.htmlReportPath) lines.push(`    ${colors.gray}• Interactive HTML:${colors.reset} ${colors.green}${result.htmlReportPath}${colors.reset}`);
    if (result.jsonReportPath) lines.push(`    ${colors.gray}• CI/CD JSON Data:${colors.reset}  ${colors.yellow}${result.jsonReportPath}${colors.reset}`);
    if (result.sarifReportPath) lines.push(`    ${colors.gray}• GitHub SARIF 2.1:${colors.reset} ${colors.magenta}${result.sarifReportPath}${colors.reset}`);
    if (result.ciWorkflowPath) lines.push(`    ${colors.gray}• CI/CD Workflow:${colors.reset}    ${colors.cyan}${result.ciWorkflowPath}${colors.reset}`);
    lines.push('');
  } else {
    lines.push('');
  }

  return lines.join('\n');
}

