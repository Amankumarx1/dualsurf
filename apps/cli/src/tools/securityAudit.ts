import * as tls from 'tls';
import * as net from 'net';
import type { PageMetadata, SecurityHeaderItem, TlsCryptoAudit } from '@dualsurf/shared-types';
import { colors } from '../formatters.js';

export function auditTlsCrypto(protocol: string, cipherName: string): TlsCryptoAudit {
  const flaws: string[] = [];
  const protoLower = (protocol || '').toLowerCase();
  const cipherUpper = (cipherName || '').toUpperCase();

  const isDeprecatedProtocol =
    protoLower.includes('tls 1.0') ||
    protoLower.includes('tlsv1.0') ||
    protoLower.includes('tlsv1.1') ||
    protoLower.includes('tls 1.1') ||
    protoLower.includes('ssl');

  if (isDeprecatedProtocol) {
    flaws.push(`Deprecated and insecure transport protocol in use: ${protocol}. Vulnerable to POODLE and downgrade attacks.`);
  }

  const isCbc = cipherUpper.includes('_CBC_') || cipherUpper.includes('-CBC');
  const isRc4 = cipherUpper.includes('RC4');
  const is3Des = cipherUpper.includes('3DES') || cipherUpper.includes('DES-CBC3');
  const hasPfs =
    cipherUpper.includes('ECDHE') ||
    cipherUpper.includes('DHE') ||
    protoLower.includes('tls 1.3') ||
    protoLower.includes('tlsv1.3');

  const isWeakCipher = isCbc || isRc4 || is3Des || !hasPfs;

  if (isRc4) {
    flaws.push(`Insecure stream cipher RC4 detected (${cipherName}). Cryptographically broken.`);
  }
  if (is3Des) {
    flaws.push(`Legacy 64-bit block cipher 3DES detected (${cipherName}). Vulnerable to Sweet32 attack (CVE-2016-2183).`);
  }
  if (isCbc) {
    flaws.push(`CBC-mode cipher in use (${cipherName}). Potential susceptibility to Lucky13 padding oracle timing attacks.`);
  }
  if (!hasPfs) {
    flaws.push(`Cipher suite lacks Ephemeral Diffie-Hellman (PFS). Session keys can be retroactively decrypted if private key is compromised.`);
  }

  return {
    protocol,
    cipherName,
    isDeprecatedProtocol,
    isWeakCipher,
    hasPfs,
    flaws,
  };
}

export type VulnerabilitySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface SecurityIssue {
  id: string;
  title: string;
  severity: VulnerabilitySeverity;
  category: 'Transport' | 'Headers' | 'DOM/Forms' | 'Secrets' | 'Exposure';
  description: string;
  evidence?: string;
  remediation: string;
}

export interface SecurityAuditReport {
  url: string;
  timestamp: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
  score: number; // 0 to 100 (100 = completely clean)
  issues: SecurityIssue[];
  stats: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
  };
}

export interface TlsCertResult {
  host: string;
  port: number;
  authorized: boolean;
  subject: {
    commonName?: string;
    organization?: string;
  };
  issuer: {
    commonName?: string;
    organization?: string;
  };
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  isExpired: boolean;
  subjectAltNames: string[];
  protocol: string;
  cipherName: string;
}

export interface CorsAnalysisResult {
  url: string;
  allowOrigin?: string;
  allowCredentials?: boolean;
  allowMethods?: string;
  allowHeaders?: string;
  isWildcard: boolean;
  isReflected: boolean;
  isNullAllowed: boolean;
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
  verdict: string;
}

export interface TechProfileResult {
  url: string;
  servers: string[];
  frameworks: string[];
  cms: string[];
  cdnWaf: string[];
  confidenceScore: number;
}

/**
 * Scan DOM text snippet and storage for exposed secrets and internal endpoints.
 */
export function scanForSecrets(content: string): Array<{ type: string; snippet: string }> {
  const findings: Array<{ type: string; snippet: string }> = [];

  // AWS Access Key ID
  const awsMatch = content.match(/\b(AKIA[0-9A-Z]{16})\b/);
  if (awsMatch) {
    findings.push({ type: 'AWS Access Key ID', snippet: awsMatch[1] });
  }

  // Generic JWT Tokens
  const jwtMatch = content.match(/\b(eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,})\b/);
  if (jwtMatch) {
    findings.push({ type: 'Exposed JWT Token', snippet: jwtMatch[1].substring(0, 30) + '...' });
  }

  // Private Key Headers
  const pkeyMatch = content.match(/-----BEGIN (?:RSA|EC|DSA|OPENSSH)? PRIVATE KEY-----/);
  if (pkeyMatch) {
    findings.push({ type: 'Private Key Header Exposure', snippet: pkeyMatch[0] });
  }

  // Internal RFC1918 Private IP addresses (strictly bounded octets 0-255, not version numbers like 10.669.606.225)
  const octet = '(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
  const rfc1918Regex = new RegExp(
    `\\b(?:10\\.${octet}\\.${octet}\\.${octet}|192\\.168\\.${octet}\\.${octet}|172\\.(?:1[6-9]|2[0-9]|3[0-1])\\.${octet}\\.${octet})\\b`
  );
  const internalIpMatch = content.match(rfc1918Regex);
  if (internalIpMatch) {
    findings.push({ type: 'Internal IP Leakage', snippet: internalIpMatch[0] });
  }

  // High entropy / API key patterns
  const apiKeyMatch = content.match(/\b(?:api[_-]?key|client[_-]?secret|auth[_-]?token)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/i);
  if (apiKeyMatch) {
    findings.push({ type: 'Exposed API Key Variable', snippet: apiKeyMatch[1].substring(0, 16) + '...' });
  }

  return findings;
}

/**
 * Audit passive security vulnerabilities and DOM hygiene on active page.
 */
export function auditPassiveSecurity(
  meta: PageMetadata,
  headers?: { headers: Record<string, string>; items: SecurityHeaderItem[]; serverBanner?: string }
): SecurityAuditReport {
  const issues: SecurityIssue[] = [];

  // 1. Cleartext Transmission Check
  if (meta.url.startsWith('http://') && !meta.url.includes('localhost') && !meta.url.includes('127.0.0.1')) {
    issues.push({
      id: 'SEC-TRANS-01',
      title: 'Insecure Cleartext Transport (HTTP)',
      severity: 'HIGH',
      category: 'Transport',
      description: 'Communication is transmitted over unencrypted HTTP, exposing traffic to eavesdropping and MITM tampering.',
      remediation: 'Migrate service to HTTPS and enforce Strict-Transport-Security (HSTS).',
    });
  }

  // 2. Forms Security Analysis
  const forms = meta.forms || [];
  for (const form of forms) {
    if (form.isCleartext) {
      issues.push({
        id: 'SEC-FORM-01',
        title: `Form Actions over Cleartext HTTP (${form.name || form.id})`,
        severity: 'HIGH',
        category: 'DOM/Forms',
        description: `Form "${form.name || form.id}" submits data to an unencrypted endpoint: ${form.action}`,
        remediation: 'Ensure all form action targets use HTTPS.',
      });
    }

    if (form.hasPassword && form.method !== 'POST') {
      issues.push({
        id: 'SEC-FORM-02',
        title: `Password Form uses ${form.method} method`,
        severity: 'HIGH',
        category: 'DOM/Forms',
        description: `Password input inside form "${form.name || form.id}" submits via ${form.method}, exposing credentials in URL logs.`,
        remediation: 'Always submit password and authentication credentials via HTTPS POST.',
      });
    }

    if (form.method === 'POST' && !form.hasCsrfToken) {
      issues.push({
        id: 'SEC-FORM-03',
        title: `Possible Missing CSRF Token in Form (${form.name || form.id})`,
        severity: 'MEDIUM',
        category: 'DOM/Forms',
        description: `Form "${form.name || form.id}" performs POST mutation without an identified anti-CSRF token.`,
        remediation: 'Include unpredictable anti-CSRF tokens in all state-changing HTML forms.',
      });
    }
  }

  // 3. Reverse Tabnabbing
  if (meta.securitySignals && meta.securitySignals.tabnabbingCount > 0) {
    issues.push({
      id: 'SEC-DOM-01',
      title: `Reverse Tabnabbing Vulnerability (${meta.securitySignals.tabnabbingCount} links)`,
      severity: 'MEDIUM',
      category: 'DOM/Forms',
      description: 'Links with target="_blank" are missing rel="noopener noreferrer", allowing new windows to access window.opener.',
      remediation: 'Add rel="noopener noreferrer" to all external links opening in new tabs.',
    });
  }

  // 4. Insecure Mixed Content
  if (meta.securitySignals && meta.securitySignals.insecureLinksCount > 0) {
    issues.push({
      id: 'SEC-DOM-02',
      title: `Insecure Mixed Content (${meta.securitySignals.insecureLinksCount} references)`,
      severity: 'LOW',
      category: 'DOM/Forms',
      description: 'HTTPS page contains references to insecure http:// sub-resources or links.',
      remediation: 'Upgrade all linked resources and endpoints to HTTPS.',
    });
  }

  // 5. Server Information Disclosure
  if (headers && headers.serverBanner) {
    issues.push({
      id: 'SEC-HEAD-01',
      title: `Server Software Version Leaked`,
      severity: 'LOW',
      category: 'Headers',
      evidence: headers.serverBanner,
      description: `Underlying server discloses software version (${headers.serverBanner}), facilitating targeted vulnerability reconnaissance.`,
      remediation: 'Disable Server and X-Powered-By banners in web server configuration.',
    });
  }

  // 6. Security Headers Check
  if (headers && headers.items) {
    const missingCsp = headers.items.find((i) => i.name === 'Content-Security-Policy' && i.status === 'missing');
    if (missingCsp) {
      issues.push({
        id: 'SEC-HEAD-02',
        title: 'Missing Content-Security-Policy (CSP)',
        severity: 'MEDIUM',
        category: 'Headers',
        description: 'Page lacks CSP header, eliminating a primary defense-in-depth barrier against XSS and data injection.',
        remediation: 'Implement a strict Content-Security-Policy restricting script sources.',
      });
    }

    const missingXframe = headers.items.find((i) => i.name === 'X-Frame-Options' && i.status === 'missing');
    if (missingXframe) {
      issues.push({
        id: 'SEC-HEAD-03',
        title: 'Missing Clickjacking Protection (X-Frame-Options)',
        severity: 'MEDIUM',
        category: 'Headers',
        description: 'Page lacks X-Frame-Options or CSP frame-ancestors, enabling iframe framing and clickjacking attacks.',
        remediation: 'Set X-Frame-Options: DENY or SAMEORIGIN.',
      });
    }
  }

  // 7. Secrets & Sensitive Token Exposure Check
  const combinedText = [
    meta.textSnippet || '',
    (meta.storage || []).map((s) => s.key + '=' + s.value).join(' '),
    (meta.cookies || []).map((c) => c.name + '=' + c.value).join(' '),
  ].join(' ');

  const detectedSecrets = scanForSecrets(combinedText);
  for (const s of detectedSecrets) {
    issues.push({
      id: 'SEC-SEC-01',
      title: `Sensitive Secret Leaked in DOM/Storage (${s.type})`,
      severity: 'CRITICAL',
      category: 'Secrets',
      evidence: s.snippet,
      description: `Potential sensitive credential or internal topology identifier identified: ${s.type}`,
      remediation: 'Ensure keys and sensitive tokens are never serialized into client-side DOM or local storage.',
    });
  }

  // Compute stats and overall risk
  const stats = {
    criticalCount: issues.filter((i) => i.severity === 'CRITICAL').length,
    highCount: issues.filter((i) => i.severity === 'HIGH').length,
    mediumCount: issues.filter((i) => i.severity === 'MEDIUM').length,
    lowCount: issues.filter((i) => i.severity === 'LOW').length,
    infoCount: issues.filter((i) => i.severity === 'INFO').length,
  };

  let score = 100 - stats.criticalCount * 35 - stats.highCount * 20 - stats.mediumCount * 10 - stats.lowCount * 3;
  score = Math.max(0, Math.min(100, score));

  let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN' = 'CLEAN';
  if (stats.criticalCount > 0 || score < 30) riskLevel = 'CRITICAL';
  else if (stats.highCount > 0 || score < 60) riskLevel = 'HIGH';
  else if (stats.mediumCount > 0 || score < 85) riskLevel = 'MEDIUM';
  else if (stats.lowCount > 0) riskLevel = 'LOW';

  return {
    url: meta.url,
    timestamp: new Date().toISOString(),
    riskLevel,
    score,
    issues,
    stats,
  };
}

/**
 * Inspect TLS certificate and cipher suite details via socket.
 */
export async function inspectTlsCertificate(urlOrHost: string): Promise<TlsCertResult> {
  let hostname = urlOrHost;
  let port = 443;

  try {
    const u = new URL(urlOrHost.includes('://') ? urlOrHost : `https://${urlOrHost}`);
    hostname = u.hostname;
    port = u.port ? parseInt(u.port, 10) : 443;
  } catch {
    // fallback
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 6000,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const authorized = socket.authorized;
          const protocol = socket.getProtocol() || 'Unknown';
          const cipher = socket.getCipher() || { name: 'Unknown' };

          const validFrom = cert.valid_from || '';
          const validTo = cert.valid_to || '';
          const expiryTime = new Date(validTo).getTime();
          const now = Date.now();
          const daysRemaining = Math.round((expiryTime - now) / (1000 * 60 * 60 * 24));
          const isExpired = daysRemaining <= 0;

          const sans = cert.subjectaltname
            ? cert.subjectaltname.split(',').map((s) => s.trim().replace(/^DNS:/, ''))
            : [];

          const parseCertField = (val: string | string[] | undefined): string | undefined => {
            if (!val) return undefined;
            return Array.isArray(val) ? val.join(', ') : val;
          };

          socket.end();
          resolve({
            host: hostname,
            port,
            authorized,
            subject: {
              commonName: parseCertField(cert.subject?.CN),
              organization: parseCertField(cert.subject?.O),
            },
            issuer: {
              commonName: parseCertField(cert.issuer?.CN),
              organization: parseCertField(cert.issuer?.O),
            },
            validFrom,
            validTo,
            daysRemaining,
            isExpired,
            subjectAltNames: sans,
            protocol,
            cipherName: cipher.name,
          });
        } catch (err) {
          socket.destroy();
          reject(err);
        }
      }
    );

    socket.on('error', (err) => {
      reject(err);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Connection timed out while probing TLS certificate'));
    });
  });
}

/**
 * Analyze CORS headers and test origin reflection.
 */
export async function analyzeCorsPolicy(url: string, testOrigin = 'https://evil-attacker.example'): Promise<CorsAnalysisResult> {
  const trimmed = (url || '').trim();
  const targetUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const res = await fetch(targetUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: testOrigin,
        'Access-Control-Request-Method': 'POST',
      },
      signal: AbortSignal.timeout(6000),
    });

    const allowOrigin = res.headers.get('access-control-allow-origin') || undefined;
    const credsHeader = res.headers.get('access-control-allow-credentials');
    const allowCredentials = credsHeader === 'true';
    const allowMethods = res.headers.get('access-control-allow-methods') || undefined;
    const allowHeaders = res.headers.get('access-control-allow-headers') || undefined;

    const isWildcard = allowOrigin === '*';
    const isReflected = allowOrigin === testOrigin;
    const isNullAllowed = allowOrigin === 'null';

    let risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN' = 'CLEAN';
    let verdict = 'No permissive CORS policy detected.';

    if (isReflected && allowCredentials) {
      risk = 'HIGH';
      verdict = 'CRITICAL CORS MISCONFIGURATION: Arbitrary origin reflected with Access-Control-Allow-Credentials enabled!';
    } else if (isReflected) {
      risk = 'MEDIUM';
      verdict = 'Origin reflection detected without credentials.';
    } else if (isWildcard && allowCredentials) {
      risk = 'HIGH';
      verdict = 'Insecure wildcard origin with credentials enabled.';
    } else if (isWildcard) {
      risk = 'LOW';
      verdict = 'Public wildcard CORS allowed (acceptable for public APIs).';
    } else if (isNullAllowed) {
      risk = 'MEDIUM';
      verdict = 'Null origin permitted, vulnerable to sandbox iframe bypass.';
    }

    return {
      url,
      allowOrigin,
      allowCredentials,
      allowMethods,
      allowHeaders,
      isWildcard,
      isReflected,
      isNullAllowed,
      risk,
      verdict,
    };
  } catch (err: any) {
    return {
      url,
      isWildcard: false,
      isReflected: false,
      isNullAllowed: false,
      risk: 'CLEAN',
      verdict: `CORS check failed or endpoint does not respond to preflight (${err.message})`,
    };
  }
}

/**
 * Identify web technologies, frameworks, and WAF/CDN signatures.
 */
export function detectTechnologies(
  metaOrUrl: PageMetadata | string,
  scriptsOrHeaders?: string[] | any,
  maybeHeaders?: any
): TechProfileResult {
  let targetUrl = '';
  let scripts: string[] = [];
  let textSnippet = '';
  let metaGenerator = '';
  let headers: any = {};

  if (typeof metaOrUrl === 'string') {
    targetUrl = metaOrUrl;
    if (Array.isArray(scriptsOrHeaders)) {
      scripts = scriptsOrHeaders;
    }
    if (maybeHeaders && typeof maybeHeaders === 'object' && maybeHeaders.headers) {
      headers = maybeHeaders.headers;
    } else if (scriptsOrHeaders && typeof scriptsOrHeaders === 'object' && !Array.isArray(scriptsOrHeaders) && scriptsOrHeaders.headers) {
      headers = scriptsOrHeaders.headers;
    } else {
      headers = maybeHeaders || (Array.isArray(scriptsOrHeaders) ? {} : scriptsOrHeaders) || {};
    }
  } else {
    targetUrl = metaOrUrl.url || '';
    scripts = metaOrUrl.scripts || [];
    textSnippet = metaOrUrl.textSnippet || '';
    if (maybeHeaders && typeof maybeHeaders === 'object' && maybeHeaders.headers) {
      headers = maybeHeaders.headers;
    } else if (maybeHeaders) {
      headers = maybeHeaders;
    } else if (scriptsOrHeaders && typeof scriptsOrHeaders === 'object' && !Array.isArray(scriptsOrHeaders) && scriptsOrHeaders.headers) {
      headers = scriptsOrHeaders.headers;
    } else if (scriptsOrHeaders && !Array.isArray(scriptsOrHeaders)) {
      headers = scriptsOrHeaders;
    } else {
      headers = {};
    }
  }

  const servers = new Set<string>();
  const frameworks = new Set<string>();
  const cms = new Set<string>();
  const cdnWaf = new Set<string>();

  const headerStr = JSON.stringify(headers).toLowerCase();
  const scriptStr = scripts.join(' ').toLowerCase();
  const textStr = textSnippet.toLowerCase();
  const generator = metaGenerator.toLowerCase();

  // Servers
  const srv = headers['server'] || '';
  if (srv) servers.add(srv);
  if (headerStr.includes('nginx')) servers.add('Nginx');
  if (headerStr.includes('apache')) servers.add('Apache');
  if (headerStr.includes('caddy')) servers.add('Caddy');
  if (headerStr.includes('litespeed')) servers.add('LiteSpeed');

  // Frameworks & Runtimes
  const pby = headers['x-powered-by'] || '';
  if (pby) frameworks.add(pby);
  if (scriptStr.includes('react') || textStr.includes('__next') || headerStr.includes('next.js')) frameworks.add('React / Next.js');
  if (scriptStr.includes('vue') || scriptStr.includes('nuxt')) frameworks.add('Vue.js / Nuxt');
  if (scriptStr.includes('angular')) frameworks.add('Angular');
  if (headerStr.includes('express')) frameworks.add('Express.js');
  if (headerStr.includes('asp.net') || headerStr.includes('iis')) frameworks.add('ASP.NET');
  if (headerStr.includes('php') || (targetUrl && targetUrl.includes('.php'))) frameworks.add('PHP');
  if (headerStr.includes('django')) frameworks.add('Django / Python');

  // CMS
  if (generator.includes('wordpress') || scriptStr.includes('wp-content') || (targetUrl && targetUrl.includes('wp-login'))) cms.add('WordPress');
  if (generator.includes('drupal') || scriptStr.includes('drupal')) cms.add('Drupal');
  if (generator.includes('joomla')) cms.add('Joomla');
  if (headerStr.includes('shopify') || scriptStr.includes('shopify')) cms.add('Shopify');

  // CDN & WAF
  if (headers['cf-ray'] || headerStr.includes('cloudflare')) cdnWaf.add('Cloudflare');
  if (headers['x-amz-cf-id'] || headerStr.includes('cloudfront')) cdnWaf.add('AWS CloudFront');
  if (headers['x-fastly-request-id']) cdnWaf.add('Fastly');
  if (headers['x-akamai-transformed']) cdnWaf.add('Akamai');

  return {
    url: targetUrl,
    servers: Array.from(servers),
    frameworks: Array.from(frameworks),
    cms: Array.from(cms),
    cdnWaf: Array.from(cdnWaf),
    confidenceScore: Math.min(100, (servers.size + frameworks.size + cms.size + cdnWaf.size) * 25),
  };
}

/**
 * Format passive security audit report for terminal output.
 */
export function formatPassiveSecurityAudit(report: SecurityAuditReport): string {
  const riskColor =
    report.riskLevel === 'CRITICAL'
      ? colors.red
      : report.riskLevel === 'HIGH'
      ? colors.yellow
      : report.riskLevel === 'MEDIUM'
      ? colors.cyan
      : colors.green;

  const header = [
    `\n${colors.bold}${colors.magenta}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.magenta}║              DUALSURF CYBER SECURITY VULNERABILITY AUDIT           ║${colors.reset}`,
    `${colors.bold}${colors.magenta}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`,
    `  ${colors.bold}Target:${colors.reset}     ${colors.cyan}${report.url}${colors.reset}`,
    `  ${colors.bold}Risk Rating:${colors.reset} ${riskColor}${report.riskLevel}${colors.reset} (Security Hygiene Score: ${colors.bold}${report.score}/100${colors.reset})`,
    `  ${colors.bold}Findings:${colors.reset}    ${colors.red}${report.stats.criticalCount} Critical${colors.reset}, ${colors.yellow}${report.stats.highCount} High${colors.reset}, ${colors.cyan}${report.stats.mediumCount} Medium${colors.reset}, ${report.stats.lowCount} Low`,
    `${colors.gray}──────────────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  if (report.issues.length === 0) {
    header.push(`  ${colors.green}✔ No passive security vulnerabilities or DOM hygiene defects identified.${colors.reset}\n`);
    return header.join('\n');
  }

  const rows = report.issues.map((issue, idx) => {
    const sevBadge =
      issue.severity === 'CRITICAL'
        ? `${colors.red}[CRITICAL]${colors.reset}`
        : issue.severity === 'HIGH'
        ? `${colors.yellow}[HIGH]    ${colors.reset}`
        : issue.severity === 'MEDIUM'
        ? `${colors.cyan}[MEDIUM]  ${colors.reset}`
        : `${colors.gray}[LOW]     ${colors.reset}`;

    const ev = issue.evidence ? `\n      ${colors.dim}Evidence: ${issue.evidence}${colors.reset}` : '';
    return [
      `  ${sevBadge} ${colors.bold}${issue.title}${colors.reset}`,
      `      ${colors.dim}Category: ${issue.category} | ${issue.description}${colors.reset}${ev}`,
      `      ${colors.green}Fix: ${issue.remediation}${colors.reset}`,
    ].join('\n');
  });

  return [...header, ...rows].join('\n\n') + '\n';
}

export const formatSecurityAudit = formatPassiveSecurityAudit;

/**
 * Format TLS certificate inspection report for terminal output.
 */
export function formatTlsCertificate(cert: TlsCertResult): string {
  const expiryColor = cert.isExpired ? colors.red : cert.daysRemaining < 30 ? colors.yellow : colors.green;

  const lines = [
    `\n${colors.bold}${colors.cyan}TLS / SSL CERTIFICATE INSPECTION:${colors.reset} ${colors.bold}${cert.host}:${cert.port}${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────────────${colors.reset}`,
    `  ${colors.bold}Common Name (CN):${colors.reset} ${cert.subject.commonName || '(None)'}`,
    `  ${colors.bold}Organization (O):${colors.reset} ${cert.subject.organization || '(None)'}`,
    `  ${colors.bold}Issuer:${colors.reset}           ${cert.issuer.commonName || 'Unknown CA'} (${cert.issuer.organization || ''})`,
    `  ${colors.bold}Valid Period:${colors.reset}     ${cert.validFrom} to ${cert.validTo}`,
    `  ${colors.bold}Status:${colors.reset}           ${expiryColor}${cert.isExpired ? 'EXPIRED' : `${cert.daysRemaining} days remaining`}${colors.reset}`,
    `  ${colors.bold}Negotiated Protocol:${colors.reset} ${colors.green}${cert.protocol}${colors.reset} (${cert.cipherName})`,
    `  ${colors.bold}Authorized CA:${colors.reset}   ${cert.authorized ? colors.green + '✓ Trusted' : colors.yellow + '⚠ Untrusted / Self-signed'}${colors.reset}`,
  ];

  if (cert.subjectAltNames.length > 0) {
    lines.push(`\n  ${colors.bold}Subject Alternative Names (${cert.subjectAltNames.length} SANs):${colors.reset}`);
    cert.subjectAltNames.slice(0, 15).forEach((san) => {
      lines.push(`    • ${colors.cyan}${san}${colors.reset}`);
    });
    if (cert.subjectAltNames.length > 15) {
      lines.push(`    ${colors.dim}... and ${cert.subjectAltNames.length - 15} more subdomains${colors.reset}`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Format CORS analysis result for terminal output.
 */
export function formatCorsAnalysis(cors: CorsAnalysisResult): string {
  const riskColor = cors.risk === 'HIGH' ? colors.red : cors.risk === 'MEDIUM' ? colors.yellow : colors.green;

  return [
    `\n${colors.bold}${colors.cyan}CORS POLICY & CONFIGURATION AUDIT:${colors.reset} ${colors.bold}${cors.url}${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────────────${colors.reset}`,
    `  ${colors.bold}Risk Level:${colors.reset}        ${riskColor}${cors.risk}${colors.reset}`,
    `  ${colors.bold}Verdict:${colors.reset}           ${cors.verdict}`,
    `  ${colors.bold}Allow-Origin:${colors.reset}      ${cors.allowOrigin || '(None)'}`,
    `  ${colors.bold}Credentials:${colors.reset}       ${cors.allowCredentials ? colors.red + 'true (Credentials allowed)' : 'false'}`,
    `  ${colors.bold}Allowed Methods:${colors.reset}   ${cors.allowMethods || '(Default)'}`,
    `  ${colors.bold}Allowed Headers:${colors.reset}   ${cors.allowHeaders || '(Default)'}\n`,
  ].join('\n');
}

/**
 * Format technology profiling result for terminal output.
 */
export function formatTechProfile(tech: TechProfileResult): string {
  return [
    `\n${colors.bold}${colors.cyan}TECHNOLOGY & INFRASTRUCTURE FINGERPRINT:${colors.reset} ${colors.bold}${tech.url}${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────────────${colors.reset}`,
    `  ${colors.bold}Web Servers:${colors.reset}   ${tech.servers.length ? tech.servers.join(', ') : colors.dim + '(Not detected)' + colors.reset}`,
    `  ${colors.bold}Frameworks:${colors.reset}    ${tech.frameworks.length ? tech.frameworks.join(', ') : colors.dim + '(Not detected)' + colors.reset}`,
    `  ${colors.bold}CMS Platform:${colors.reset}  ${tech.cms.length ? tech.cms.join(', ') : colors.dim + '(Not detected)' + colors.reset}`,
    `  ${colors.bold}WAF / CDN:${colors.reset}     ${tech.cdnWaf.length ? tech.cdnWaf.join(', ') : colors.dim + '(Direct connection)' + colors.reset}\n`,
  ].join('\n');
}
