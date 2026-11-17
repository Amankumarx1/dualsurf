import { z } from 'zod';
import type { PluginCommandDefinition } from '@dualsurf/core';

export type HeaderCheckSeverity = 'high' | 'medium' | 'low';
export type HeaderCheckStatus = 'ok' | 'weak' | 'missing';

export interface HeaderFinding {
  header: string;
  status: HeaderCheckStatus;
  severity: HeaderCheckSeverity;
  note?: string;
}

export interface HeadersAnalyzeOutput {
  url: string;
  status: number;
  score: number;
  findings: HeaderFinding[];
  headers: Record<string, string>;
}

/**
 * Note: This command makes its own direct network request via BrowserHost and is only
 * a stand-in until Step 3 replaces it with passive traffic captured from live browsing.
 */
export const headersAnalyzeCommand: PluginCommandDefinition<
  { url?: string },
  HeadersAnalyzeOutput
> = {
  id: 'headers.analyze',
  title: 'Analyze Security Headers',
  description: 'Audits HTTP response headers for missing or weak security controls (HSTS, CSP, XFO, etc.)',
  category: 'audit',
  positional: ['url'],
  scopeRequired: true,
  extractTargets: (input) => (input.url ? [input.url] : []),
  inputSchema: z.object({
    url: z
      .string()
      .optional()
      .describe('Target URL to inspect (defaults to the active tab URL if omitted)'),
  }),
  run: async (input, ctx) => {
    let targetUrl = input.url?.trim();

    if (!targetUrl) {
      const activeTab = await ctx.host.getActiveTab();
      if (activeTab?.url && activeTab.url !== 'about:blank' && !activeTab.url.startsWith('dualsurf:')) {
        targetUrl = activeTab.url;
      }
    }

    if (!targetUrl) {
      throw new Error(
        "No URL provided and no active tab URL available to analyze. Usage: headers.analyze <url>"
      );
    }

    // Ensure scheme is present
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    // Explicitly assert in scope
    ctx.assertInScope(targetUrl);

    // Make GET request without following redirects, read only headers and cancel body
    const res = await ctx.pluginApi.network.fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
    });

    try {
      if (res.body && typeof res.body.cancel === 'function') {
        await res.body.cancel();
      }
    } catch {}

    const rawHeaders: Record<string, string> = {};
    res.headers.forEach((value, name) => {
      rawHeaders[name.toLowerCase()] = value;
    });

    const isHttps = targetUrl.startsWith('https://');
    const findings: HeaderFinding[] = [];

    interface CheckSpec {
      header: string;
      severity: HeaderCheckSeverity;
      weight: number;
      evaluate: () => { status: HeaderCheckStatus; note?: string } | null;
    }

    const checks: CheckSpec[] = [
      // 1. Strict-Transport-Security (high: 3, evaluated only for https)
      {
        header: 'Strict-Transport-Security',
        severity: 'high',
        weight: 3,
        evaluate: () => {
          if (!isHttps) return null; // Only evaluated for https URLs
          const val = rawHeaders['strict-transport-security'];
          if (!val) {
            return { status: 'missing', note: 'HSTS header missing on HTTPS endpoint' };
          }
          return { status: 'ok', note: val };
        },
      },
      // 2. Content-Security-Policy (high: 3)
      {
        header: 'Content-Security-Policy',
        severity: 'high',
        weight: 3,
        evaluate: () => {
          const val = rawHeaders['content-security-policy'];
          if (!val) {
            return { status: 'missing', note: 'Content-Security-Policy header is missing' };
          }
          const lower = val.toLowerCase();
          if (
            lower.includes('unsafe-inline') ||
            lower.includes('unsafe-eval') ||
            lower.includes(' * ') ||
            lower.includes(' *;') ||
            lower.endsWith(' *')
          ) {
            return {
              status: 'weak',
              note: 'Contains unsafe-inline, unsafe-eval, or wildcard source directive',
            };
          }
          return { status: 'ok', note: 'Strict CSP configured' };
        },
      },
      // 3. X-Frame-Options or CSP frame-ancestors (medium: 2)
      {
        header: 'X-Frame-Options / CSP frame-ancestors',
        severity: 'medium',
        weight: 2,
        evaluate: () => {
          const xfo = rawHeaders['x-frame-options'];
          const csp = rawHeaders['content-security-policy']?.toLowerCase();
          const hasFrameAncestors = csp && csp.includes('frame-ancestors');

          if (hasFrameAncestors || xfo) {
            return {
              status: 'ok',
              note: hasFrameAncestors ? 'Protected via CSP frame-ancestors' : `Protected via XFO (${xfo})`,
            };
          }

          return {
            status: 'missing',
            note: 'Clickjacking protection missing (neither X-Frame-Options nor CSP frame-ancestors)',
          };
        },
      },
      // 4. X-Content-Type-Options = nosniff (medium: 2)
      {
        header: 'X-Content-Type-Options',
        severity: 'medium',
        weight: 2,
        evaluate: () => {
          const val = rawHeaders['x-content-type-options'];
          if (!val) {
            return { status: 'missing', note: 'MIME-sniffing protection header is missing' };
          }
          if (val.trim().toLowerCase() !== 'nosniff') {
            return { status: 'weak', note: `Expected 'nosniff', got '${val}'` };
          }
          return { status: 'ok', note: 'nosniff' };
        },
      },
      // 5. Referrer-Policy (low: 1)
      {
        header: 'Referrer-Policy',
        severity: 'low',
        weight: 1,
        evaluate: () => {
          const val = rawHeaders['referrer-policy'];
          if (!val) {
            return { status: 'missing', note: 'Referrer-Policy header is missing' };
          }
          return { status: 'ok', note: val };
        },
      },
      // 6. Permissions-Policy (low: 1)
      {
        header: 'Permissions-Policy',
        severity: 'low',
        weight: 1,
        evaluate: () => {
          const val = rawHeaders['permissions-policy'] || rawHeaders['feature-policy'];
          if (!val) {
            return { status: 'missing', note: 'Permissions-Policy / Feature-Policy header is missing' };
          }
          return { status: 'ok', note: val };
        },
      },
    ];

    let totalWeight = 0;
    let lostWeight = 0;

    for (const check of checks) {
      const outcome = check.evaluate();
      if (!outcome) continue; // Not evaluated (e.g. HSTS for plain HTTP)

      totalWeight += check.weight;
      if (outcome.status === 'missing') {
        lostWeight += check.weight * 1.0;
      } else if (outcome.status === 'weak') {
        lostWeight += check.weight * 0.5;
      }

      findings.push({
        header: check.header,
        status: outcome.status,
        severity: check.severity,
        note: outcome.note,
      });
    }

    const rawScore = totalWeight > 0 ? 100 * (1 - lostWeight / totalWeight) : 100;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    return {
      url: targetUrl,
      status: res.status,
      score,
      findings,
      headers: rawHeaders,
    };
  },
};
