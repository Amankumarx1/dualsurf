import * as fs from 'fs';
import * as path from 'path';
import type { PageMetadata, SecurityHeaderItem, EndpointItem } from '@dualsurf/shared-types';
import { colors } from '../formatters.js';

export interface SecurityHeaderAnalysisResult {
  url: string;
  statusCode?: number;
  headers: Record<string, string>;
  items: SecurityHeaderItem[];
  score: number; // 0 to 100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  serverBanner?: string;
  cookiesAnalysis?: Array<{ name: string; hasHttpOnly: boolean; hasSecure: boolean; sameSite?: string }>;
}

export function normalizeHttpUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Fetch and evaluate security headers for a target URL.
 */
export async function analyzeSecurityHeaders(url: string): Promise<SecurityHeaderAnalysisResult> {
  const targetUrl = normalizeHttpUrl(url);
  let headers: Record<string, string> = {};
  let statusCode = 200;
  let rawCookies: string[] = [];

  try {
    const res = await fetch(targetUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DualSurf/1.0',
      },
      signal: AbortSignal.timeout(6000),
    });
    statusCode = res.status;
    res.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      rawCookies.push(setCookie);
    }
  } catch {
    // If HEAD fails, try GET with short timeout
    try {
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DualSurf/1.0',
        },
        signal: AbortSignal.timeout(6000),
      });
      statusCode = res.status;
      res.headers.forEach((val, key) => {
        headers[key.toLowerCase()] = val;
      });
    } catch {
      // If HTTPS fails and URL was auto-prefixed, try HTTP fallback
      if (targetUrl.startsWith('https://') && !/^https?:\/\//i.test(url.trim())) {
        try {
          const httpFallback = `http://${url.trim()}`;
          const res = await fetch(httpFallback, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DualSurf/1.0',
            },
            signal: AbortSignal.timeout(6000),
          });
          statusCode = res.status;
          res.headers.forEach((val, key) => {
            headers[key.toLowerCase()] = val;
          });
        } catch {
          // Return empty headers if network is completely offline
        }
      }
    }
  }

  const items: SecurityHeaderItem[] = [
    {
      name: 'Content-Security-Policy',
      value: headers['content-security-policy'],
      status: headers['content-security-policy'] ? 'good' : 'missing',
      description: 'Restricts sources for scripts, styles, and other resources to mitigate XSS attacks.',
    },
    {
      name: 'Strict-Transport-Security',
      value: headers['strict-transport-security'],
      status: headers['strict-transport-security'] ? 'good' : 'missing',
      description: 'Enforces HTTPS communication and prevents SSL-stripping man-in-the-middle attacks.',
    },
    {
      name: 'X-Frame-Options',
      value: headers['x-frame-options'],
      status: headers['x-frame-options'] ? 'good' : 'missing',
      description: 'Prevents page embedding in iframes to protect against clickjacking.',
    },
    {
      name: 'X-Content-Type-Options',
      value: headers['x-content-type-options'],
      status: headers['x-content-type-options'] === 'nosniff' ? 'good' : 'missing',
      description: 'Blocks browsers from MIME-type sniffing away from declared content-type.',
    },
    {
      name: 'Referrer-Policy',
      value: headers['referrer-policy'],
      status: headers['referrer-policy'] ? 'good' : 'missing',
      description: 'Controls amount of referrer information sent with outbound requests.',
    },
    {
      name: 'Permissions-Policy',
      value: headers['permissions-policy'],
      status: headers['permissions-policy'] ? 'good' : 'missing',
      description: 'Controls access to camera, microphone, geolocation, and browser features.',
    },
  ];

  // Server banner leak check
  const server = headers['server'] || headers['x-powered-by'] || headers['x-aspnet-version'];
  if (server) {
    items.push({
      name: 'Server Information Disclosure',
      value: server,
      status: 'warning',
      description: 'Exposes underlying web server/framework version to reconnaissance scanners.',
    });
  }

  const goodCount = items.filter((i) => i.status === 'good').length;
  const score = Math.round((goodCount / 6) * 100);
  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 50) grade = 'C';
  else if (score >= 30) grade = 'D';

  return {
    url,
    statusCode,
    headers,
    items,
    score,
    grade,
    serverBanner: server,
  };
}

/**
 * Format security headers analysis into a terminal table.
 */
export function formatSecurityHeaders(analysis: SecurityHeaderAnalysisResult): string {
  const gradeColor =
    analysis.grade === 'A'
      ? colors.green
      : analysis.grade === 'B'
      ? colors.cyan
      : analysis.grade === 'C'
      ? colors.yellow
      : colors.red;

  const header = [
    `\n${colors.bold}${colors.cyan}SECURITY HEADERS AUDIT:${colors.reset} ${colors.bold}${analysis.url}${colors.reset}`,
    `Status: ${colors.bold}${analysis.statusCode}${colors.reset} | Score: ${gradeColor}${analysis.score}% (Grade: ${analysis.grade})${colors.reset}`,
    `${colors.gray}───────────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  const rows = analysis.items.map((item) => {
    const icon =
      item.status === 'good'
        ? `${colors.green}✓ PASS${colors.reset}`
        : item.status === 'warning'
        ? `${colors.yellow}! WARN${colors.reset}`
        : `${colors.red}✗ MISS${colors.reset}`;

    const valueStr = item.value ? `\n      ${colors.dim}Value: ${item.value.substring(0, 75)}${colors.reset}` : '';
    return `  [${icon}] ${colors.bold}${item.name.padEnd(26, ' ')}${colors.reset} : ${item.description}${valueStr}`;
  });

  return [...header, ...rows].join('\n') + '\n';
}

/**
 * Format page cookies snapshot.
 */
export function formatCookies(meta: PageMetadata): string {
  const cookies = meta.cookies || [];
  if (cookies.length === 0) {
    return `\n${colors.dim}No cookies found on active page: ${meta.url}${colors.reset}\n`;
  }

  const out = [
    `\n${colors.bold}${colors.cyan}ACTIVE COOKIES (${cookies.length} found):${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  cookies.forEach((c, idx) => {
    out.push(`  [${idx + 1}] ${colors.bold}${c.name}${colors.reset} = ${colors.dim}${c.value}${colors.reset}`);
  });

  return out.join('\n') + '\n';
}

/**
 * Format page localStorage items snapshot.
 */
export function formatStorage(meta: PageMetadata): string {
  const storage = meta.storage || [];
  if (storage.length === 0) {
    return `\n${colors.dim}No localStorage keys found on active page: ${meta.url}${colors.reset}\n`;
  }

  const out = [
    `\n${colors.bold}${colors.cyan}LOCALSTORAGE ITEMS (${storage.length} found):${colors.reset}`,
    `${colors.gray}─────────────────────────────────────────────────────────────${colors.reset}`,
  ];

  storage.forEach((s, idx) => {
    out.push(`  [${idx + 1}] ${colors.bold}${s.key}${colors.reset} : ${colors.dim}${s.value}${colors.reset}`);
  });

  return out.join('\n') + '\n';
}

/**
 * Generate full Target Reconnaissance Summary uniting DOM endpoints + security headers + suggested Kali tools.
 */
export function formatReconSummary(meta: PageMetadata, headers?: SecurityHeaderAnalysisResult): string {
  let targetHost = 'localhost';
  let targetPort = '80';
  try {
    const u = new URL(meta.url);
    targetHost = u.hostname;
    targetPort = u.port || (u.protocol === 'https:' ? '443' : '80');
  } catch {
    // fallback
  }

  const endpoints = meta.endpoints || [];
  const apiCount = endpoints.filter((e) => e.category === 'api').length;
  const authCount = endpoints.filter((e) => e.category === 'auth').length;
  const formCount = endpoints.filter((e) => e.category === 'form').length;
  const downloadCount = endpoints.filter((e) => e.category === 'download').length;

  const lines = [
    `\n${colors.bold}${colors.magenta}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.magenta}║            DUALSURF TARGET RECONNAISSANCE & DOM AUDIT              ║${colors.reset}`,
    `${colors.bold}${colors.magenta}╚════════════════════════════════════════════════════════════════════╝${colors.reset}`,
    `  ${colors.bold}Target:${colors.reset}    ${colors.cyan}${meta.url}${colors.reset}`,
    `  ${colors.bold}Title:${colors.reset}     ${meta.title || '(No title)'}`,
    `  ${colors.bold}Host/Port:${colors.reset} ${targetHost}:${targetPort}`,
    `  ${colors.bold}Endpoints:${colors.reset} ${endpoints.length} total (${colors.green}API: ${apiCount}${colors.reset}, ${colors.yellow}Auth: ${authCount}${colors.reset}, ${colors.magenta}Forms: ${formCount}${colors.reset}, Downloads: ${downloadCount})`,
  ];

  if (headers) {
    const gradeColor =
      headers.grade === 'A'
        ? colors.green
        : headers.grade === 'B'
        ? colors.cyan
        : headers.grade === 'C'
        ? colors.yellow
        : colors.red;
    lines.push(`  ${colors.bold}Sec-Score:${colors.reset} ${gradeColor}${headers.score}% (Grade ${headers.grade})${colors.reset}`);
    if (headers.serverBanner) {
      lines.push(`  ${colors.bold}Server:${colors.reset}    ${colors.yellow}${headers.serverBanner}${colors.reset}`);
    }
  }

  lines.push(
    `\n${colors.bold}${colors.yellow}SUGGESTED KALI / HOST TOOLS TO RUN NEXT:${colors.reset}`,
    `  ${colors.cyan}! nmap -sV -p ${targetPort} ${targetHost}${colors.reset}       (Port & service inspection)`,
    `  ${colors.cyan}! curl -I ${meta.url}${colors.reset}                   (Raw HTTP headers check)`,
    `  ${colors.cyan}endpoints api${colors.reset}                            (List API routes on page)`,
    `  ${colors.cyan}endpoints auth${colors.reset}                           (List authentication endpoints)`,
    `  ${colors.cyan}export audit.md${colors.reset}                          (Generate full Markdown audit report)\n`
  );

  return lines.join('\n');
}

/**
 * Generate comprehensive Markdown report for penetration testers & developers.
 */
export function generateMarkdownReport(meta: PageMetadata, headers?: SecurityHeaderAnalysisResult): string {
  const timestamp = new Date().toISOString();
  const endpoints = meta.endpoints || [];
  const headings = meta.headings || [];
  const cookies = meta.cookies || [];
  const storage = meta.storage || [];

  let md = `# DualSurf Web Audit & Security Reconnaissance Report\n\n`;
  md += `- **Target URL:** ${meta.url}\n`;
  md += `- **Page Title:** ${meta.title || '(None)'}\n`;
  md += `- **Generated:** ${timestamp}\n`;
  md += `- **Total Endpoints Detected:** ${endpoints.length}\n`;
  md += `- **Total Headings:** ${headings.length}\n\n`;

  if (headers) {
    md += `## 1. Security Headers Analysis\n\n`;
    md += `- **Overall Grade:** ${headers.grade} (${headers.score}%)\n`;
    md += `- **Status Code:** ${headers.statusCode}\n`;
    if (headers.serverBanner) {
      md += `- **Server Banner:** \`${headers.serverBanner}\` (Information Disclosure Risk)\n`;
    }
    md += `\n| Header | Status | Description |\n`;
    md += `| :--- | :--- | :--- |\n`;
    headers.items.forEach((item) => {
      const badge = item.status === 'good' ? '✅ PASS' : item.status === 'warning' ? '⚠️ WARN' : '❌ MISSING';
      md += `| \`${item.name}\` | ${badge} | ${item.description} |\n`;
    });
    md += `\n`;
  }

  md += `## 2. Detected Endpoints & Attack Surfaces\n\n`;
  if (endpoints.length > 0) {
    md += `| ID | Category | Method | Path / Endpoint | Full URL |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    endpoints.forEach((ep) => {
      md += `| ${ep.id} | \`${ep.category.toUpperCase()}\` | ${ep.method || 'GET'} | \`${ep.path}\` | [Link](${ep.url}) |\n`;
    });
    md += `\n`;
  } else {
    md += `*No actionable endpoints detected on this page.*\n\n`;
  }

  if (cookies.length > 0) {
    md += `## 3. Session Cookies Snapshot\n\n`;
    md += `| Name | Value |\n`;
    md += `| :--- | :--- |\n`;
    cookies.forEach((c) => {
      md += `| \`${c.name}\` | \`${c.value}\` |\n`;
    });
    md += `\n`;
  }

  if (storage.length > 0) {
    md += `## 4. LocalStorage State\n\n`;
    md += `| Key | Value Snippet |\n`;
    md += `| :--- | :--- |\n`;
    storage.forEach((s) => {
      md += `| \`${s.key}\` | \`${s.value}\` |\n`;
    });
    md += `\n`;
  }

  if (headings.length > 0) {
    md += `## 5. Page Document Structure (Headings)\n\n`;
    headings.forEach((h) => {
      md += `${'  '.repeat(h.level - 1)}- **H${h.level}:** ${h.text}\n`;
    });
    md += `\n`;
  }

  md += `\n---\n*Report generated autonomously by DualSurf Browser Controller.*\n`;

  return md;
}

/**
 * Save audit report to disk with path sanitization.
 */
export function exportReportToFile(targetPath: string, content: string): string {
  const cleanPath = (targetPath || 'audit.md').replace(/\0/g, '');
  const resolved = path.resolve(process.cwd(), cleanPath);
  const parentDir = path.dirname(resolved);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  fs.writeFileSync(resolved, content, 'utf-8');
  return resolved;
}
