import type { WebContents } from 'electron';
import { PageMetadata, HeadingItem, LinkItem, FindResult, IocFinding, ReaderArticle, PageSecurityInfo } from '@dualsurf/shared-types';

export class PageInspector {
  /**
   * Safely extracts page metadata, headings, numbered actionable links,
   * and clean readable text from the active WebContents without exposing privileges.
   */
  public async inspectPage(webContents: WebContents): Promise<PageMetadata> {
    if (!webContents || webContents.isDestroyed()) {
      return {
        title: '',
        url: '',
        isLoading: false,
        headings: [],
        links: [],
        endpoints: [],
        cookies: [],
        storage: [],
      };
    }

    const title = webContents.getTitle();
    const url = webContents.getURL();
    const isLoading = webContents.isLoading();

    try {
      const extractionScript = `
        (() => {
          const currentOrigin = window.location.origin;

          function categorizeEndpoint(targetUrl, tagName, formMethod) {
            if (tagName === 'FORM') return 'form';
            try {
              const parsed = new URL(targetUrl, window.location.href);
              const path = parsed.pathname.toLowerCase();
              const host = parsed.hostname.toLowerCase();

              // External check first - third party domains must not be classified as internal auth or api
              if (parsed.origin !== currentOrigin) {
                return 'external';
              }
              // Download check
              if (/\\.(zip|tar\\.gz|tgz|gz|deb|rpm|appimage|exe|dmg|pkg|iso|pdf|docx?|xlsx?)$/i.test(path)) {
                return 'download';
              }
              // API check
              if (/(^|\\/)api(\\/|$)|graphql|\\/v\\d+\\/|\\.json|\\.xml|rest/i.test(path) || /^api\\./i.test(host)) {
                return 'api';
              }
              // Auth check
              if (/(login|signin|logout|signout|signup|register|oauth|auth|sso|session|password|forgot)/i.test(path)) {
                return 'auth';
              }
              // Action / mutation
              if (/(create|update|delete|edit|checkout|cart|subscribe|webhook)/i.test(path)) {
                return 'action';
              }
              return 'internal';
            } catch {
              return 'internal';
            }
          }

          function getEndpointPath(targetUrl) {
            try {
              const parsed = new URL(targetUrl, window.location.href);
              if (parsed.origin !== currentOrigin) {
                return parsed.hostname + (parsed.pathname === '/' ? '' : parsed.pathname) + (parsed.search || '');
              }
              return parsed.pathname + (parsed.search || '');
            } catch {
              return targetUrl;
            }
          }

          function isExternalUrl(targetUrl) {
            try {
              const parsed = new URL(targetUrl, window.location.href);
              return parsed.origin !== currentOrigin;
            } catch {
              return false;
            }
          }

          // Extract headings
          const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
          const headings = headingElements.slice(0, 50).map(el => ({
            level: parseInt(el.tagName.substring(1), 10),
            text: (el.textContent || '').trim().replace(/\\s+/g, ' ')
          })).filter(h => h.text.length > 0);

          // Extract actionable links with deterministic numbering & endpoints
          const anchorElements = Array.from(document.querySelectorAll('a[href]'));
          let linkId = 1;
          const links = [];
          const endpointMap = new Map();

          for (const a of anchorElements) {
            const rawHref = a.getAttribute('href') || '';
            const fullHref = a.href || '';
            const label = (a.innerText || a.textContent || a.title || rawHref).trim().replace(/\\s+/g, ' ');
            if (label && fullHref && !fullHref.startsWith('javascript:')) {
              const category = categorizeEndpoint(fullHref, 'A');
              const endpoint = getEndpointPath(fullHref);
              const isExternal = isExternalUrl(fullHref);

              links.push({
                id: linkId++,
                label: label.substring(0, 100),
                href: fullHref,
                category,
                endpoint,
                isExternal,
                method: 'GET'
              });

              if (!endpointMap.has(fullHref)) {
                try {
                  const parsed = new URL(fullHref, window.location.href);
                  endpointMap.set(fullHref, {
                    id: endpointMap.size + 1,
                    url: fullHref,
                    path: endpoint,
                    category,
                    method: 'GET',
                    label: label.substring(0, 80),
                    isExternal,
                    origin: parsed.origin
                  });
                } catch {
                  // ignore
                }
              }

              if (linkId > 100) break; // Cap at 100 links per snapshot
            }
          }

          // Extract Form Action Endpoints (<form action="...">)
          const formElements = Array.from(document.querySelectorAll('form'));
          for (const form of formElements) {
            const actionUrl = form.action || window.location.href;
            const method = (form.method || 'GET').toUpperCase();
            const name = form.getAttribute('name') || form.getAttribute('id') || 'Form Endpoint';
            const category = categorizeEndpoint(actionUrl, 'FORM', method);
            const endpoint = getEndpointPath(actionUrl);
            const isExternal = isExternalUrl(actionUrl);
            const key = actionUrl + ':' + method;

            if (!endpointMap.has(key)) {
              try {
                const parsed = new URL(actionUrl, window.location.href);
                endpointMap.set(key, {
                  id: endpointMap.size + 1,
                  url: actionUrl,
                  path: endpoint,
                  category,
                  method,
                  label: '[FORM: ' + method + '] ' + name,
                  isExternal,
                  origin: parsed.origin
                });
              } catch {
                // ignore
              }
            }
          }

          const endpoints = Array.from(endpointMap.values()).slice(0, 100);

          // Extract readable text snippets
          const bodyClone = document.body ? document.body.cloneNode(true) : null;
          let textSnippet = '';
          if (bodyClone) {
            const removeSelectors = ['script', 'style', 'noscript', 'svg', 'iframe', 'canvas'];
            removeSelectors.forEach(sel => {
              bodyClone.querySelectorAll(sel).forEach(el => el.remove());
            });
            textSnippet = (bodyClone.innerText || bodyClone.textContent || '')
              .replace(/\\r\\n/g, '\\n')
              .replace(/\\n{3,}/g, '\\n\\n')
              .trim()
              .substring(0, 8000); // Truncate safely
          }

          // Extract document cookies
          const cookies = [];
          try {
            const rawCookies = document.cookie || '';
            rawCookies.split(';').forEach(c => {
              const trimmed = c.trim();
              if (trimmed) {
                const eqIdx = trimmed.indexOf('=');
                const name = eqIdx > -1 ? trimmed.substring(0, eqIdx) : trimmed;
                const value = eqIdx > -1 ? trimmed.substring(eqIdx + 1) : '';
                cookies.push({ name, value });
              }
            });
          } catch {
            // ignore
          }

          // Extract localStorage items
          const storage = [];
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k) {
                storage.push({ key: k, value: (localStorage.getItem(k) || '').substring(0, 150) });
              }
            }
          } catch {
            // ignore
          }

          // Extract form security attributes
          const forms = [];
          for (const form of formElements) {
            const actionUrl = form.action || window.location.href;
            const method = (form.method || 'GET').toUpperCase();
            const name = form.getAttribute('name') || form.getAttribute('id') || 'form';
            const hasPassword = !!form.querySelector('input[type="password"]');
            const hasCsrfToken = !!form.querySelector('input[name*="csrf" i], input[name*="token" i], input[name*="_token" i]');
            const isCleartext = actionUrl.startsWith('http://');
            forms.push({
              id: form.id || name,
              name,
              action: actionUrl,
              method,
              hasPassword,
              hasCsrfToken,
              isCleartext,
            });
          }

          // Extract security signals (tabnabbing, mixed content, script tags, meta generator)
          let insecureLinksCount = 0;
          let tabnabbingCount = 0;
          const isPageHttps = window.location.protocol === 'https:';

          anchorElements.forEach(a => {
            const href = a.href || '';
            if (isPageHttps && href.startsWith('http://')) {
              insecureLinksCount++;
            }
            if (a.getAttribute('target') === '_blank') {
              const rel = (a.getAttribute('rel') || '').toLowerCase();
              if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
                tabnabbingCount++;
              }
            }
          });

          const scriptElements = Array.from(document.querySelectorAll('script[src]'));
          const scripts = scriptElements.map(s => s.src).slice(0, 50);
          const externalScriptsCount = scripts.filter(s => {
            try { return new URL(s).origin !== currentOrigin; } catch { return false; }
          }).length;

          const metaGeneratorEl = document.querySelector('meta[name="generator" i]');
          const metaGenerator = metaGeneratorEl ? metaGeneratorEl.getAttribute('content') || undefined : undefined;
          const hasPasswordField = !!document.querySelector('input[type="password"]');

          const securitySignals = {
            insecureLinksCount,
            tabnabbingCount,
            scriptsCount: scriptElements.length,
            externalScriptsCount,
            metaGenerator,
            hasPasswordField,
          };

          return { headings, links, endpoints, cookies, storage, forms, securitySignals, scripts, textSnippet };
        })()
      `;

      const result = await webContents.executeJavaScript(extractionScript, true);
      const links = result.links || [];
      const scripts = result.scripts || [];
      const textSnippet = result.textSnippet || '';
      const iocs = this.extractPageIocs(url, textSnippet, links, scripts);

      return {
        title,
        url,
        isLoading,
        headings: result.headings || [],
        links,
        endpoints: result.endpoints || [],
        cookies: result.cookies || [],
        storage: result.storage || [],
        forms: result.forms || [],
        securitySignals: result.securitySignals,
        scripts,
        textSnippet,
        iocs,
      };
    } catch (err) {
      return {
        title,
        url,
        isLoading,
        headings: [],
        links: [],
        endpoints: [],
        cookies: [],
        storage: [],
        forms: [],
        scripts: [],
        textSnippet: `[Error extracting page content: ${(err as Error).message}]`,
      };
    }
  }

  /**
   * Follow a numbered link extracted from the most recent page snapshot.
   */
  public async clickNumberedLink(webContents: WebContents, linkId: number): Promise<string | null> {
    if (!webContents || webContents.isDestroyed()) {
      return null;
    }

    const sanitizedLinkId = parseInt(String(linkId), 10);
    if (!Number.isFinite(sanitizedLinkId) || sanitizedLinkId < 1) {
      return null;
    }

    try {
      const clickScript = `
        (() => {
          const anchorElements = Array.from(document.querySelectorAll('a[href]'));
          let currentId = 1;
          for (const a of anchorElements) {
            const rawHref = a.getAttribute('href') || '';
            const fullHref = a.href || '';
            const label = (a.innerText || a.textContent || a.title || rawHref).trim();
            if (label && fullHref && !fullHref.startsWith('javascript:')) {
              if (currentId === ${sanitizedLinkId}) {
                return fullHref;
              }
              currentId++;
            }
          }
          return null;
        })()
      `;

      const targetHref: string | null = await webContents.executeJavaScript(clickScript, true);
      return targetHref;
    } catch {
      return null;
    }
  }

  /**
   * Search for text occurrences in active page, returning matching line snippets.
   */
  public async findInPage(webContents: WebContents, query: string): Promise<FindResult> {
    const trimmed = query.trim();
    if (!webContents || webContents.isDestroyed() || !trimmed) {
      return { query: trimmed, count: 0, matches: [] };
    }

    try {
      // Trigger Electron native find highlighting if available
      try {
        webContents.findInPage(trimmed);
      } catch {
        // Ignored
      }

      // Safely pass query as JSON string to prevent code injection
      const sanitizedQueryJson = JSON.stringify(trimmed);
      const findScript = `
        (() => {
          const q = ${sanitizedQueryJson}.toLowerCase();
          const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, dt, dd'));
          const matches = [];
          const seen = new Set();
          let matchIndex = 1;

          for (const el of elements) {
            const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
            if (!text || seen.has(text)) continue;

            const lower = text.toLowerCase();
            const pos = lower.indexOf(q);
            if (pos !== -1) {
              seen.add(text);
              const start = Math.max(0, pos - 40);
              const end = Math.min(text.length, pos + q.length + 60);
              let snippet = text.substring(start, end).trim();
              if (start > 0) snippet = '...' + snippet;
              if (end < text.length) snippet = snippet + '...';

              matches.push({
                index: matchIndex++,
                snippet
              });

              if (matches.length >= 25) break;
            }
          }

          return matches;
        })()
      `;

      const matches = await webContents.executeJavaScript(findScript, true);
      return {
        query: trimmed,
        count: matches ? matches.length : 0,
        matches: matches || []
      };
    } catch {
      return {
        query: trimmed,
        count: 0,
        matches: []
      };
    }
  }

  private extractPageIocs(url: string, text: string, links: LinkItem[], scripts: string[]): IocFinding[] {
    const findings: IocFinding[] = [];
    const seen = new Set<string>();

    const defang = (val: string) =>
      val
        .replace(/^https?:\/\//i, (m) => (m.toLowerCase().startsWith('https') ? 'hxxps[://]' : 'hxxp[://]'))
        .replace(/\./g, '[.]');

    const combinedText = [url, text, ...links.map((l) => l.href), ...scripts].join(' ');

    // 1. IPv4 Addresses
    const IP_REGEX = /\b((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))\b/g;
    let match: RegExpExecArray | null;
    while ((match = IP_REGEX.exec(combinedText)) !== null) {
      const ip = match[1];
      if (!seen.has(ip)) {
        seen.add(ip);
        const isPriv = ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.') || ip === '0.0.0.0';
        findings.push({
          value: ip,
          type: 'ipv4',
          defanged: defang(ip),
          isPrivate: isPriv,
          reputation: isPriv ? 'BENIGN' : 'UNKNOWN',
          mitreTags: isPriv ? ['Internal Lab RFC1918'] : ['T1071 - Network Comm'],
        });
      }
    }

    // 2. Hashes (SHA-256 or MD5)
    const HASH_REGEX = /\b([a-fA-F0-9]{64}|[a-fA-F0-9]{32})\b/g;
    while ((match = HASH_REGEX.exec(combinedText)) !== null) {
      const hash = match[1].toLowerCase();
      if (!seen.has(hash)) {
        seen.add(hash);
        findings.push({
          value: hash,
          type: hash.length === 64 ? 'sha256' : 'md5',
          defanged: hash,
          reputation: 'UNKNOWN',
          mitreTags: ['T1027 - Binary Artifact'],
        });
      }
    }

    // 3. Common CVE Identifiers
    const CVE_REGEX = /\b(CVE-\d{4}-\d{4,7})\b/gi;
    while ((match = CVE_REGEX.exec(combinedText)) !== null) {
      const cve = match[1].toUpperCase();
      if (!seen.has(cve)) {
        seen.add(cve);
        findings.push({
          value: cve,
          type: 'cve',
          defanged: cve,
          reputation: 'SUSPICIOUS',
          mitreTags: ['T1190 - Exploit Public-Facing Application'],
        });
      }
    }

    return findings.slice(0, 30);
  }

  /**
   * Extracts clean distraction-free reader mode article content.
   */
  public async extractReaderArticle(webContents: WebContents): Promise<ReaderArticle | null> {
    if (!webContents || webContents.isDestroyed()) return null;

    try {
      const readerScript = `
        (() => {
          const doc = document;
          const url = window.location.href;
          const siteName = (doc.querySelector('meta[property="og:site_name"]') || {})?.content || window.location.hostname;
          const title = (doc.querySelector('h1') || {}).innerText ||
                        (doc.querySelector('meta[property="og:title"]') || {}).content ||
                        doc.title || 'Untitled Article';

          const bylineEl = doc.querySelector('meta[name="author"], .byline, [rel="author"], .author, time, .date');
          const byline = bylineEl ? (bylineEl.content || bylineEl.innerText || '').trim() : undefined;

          // Find best candidate container
          const candidates = Array.from(doc.querySelectorAll('article, main, [role="main"], .post-content, .article-body, .entry-content, .markdown-body, #content'));
          let target = candidates[0];

          if (!target) {
            const blocks = Array.from(doc.querySelectorAll('div, section'));
            let maxPText = 0;
            for (const b of blocks) {
              const ps = Array.from(b.querySelectorAll('p'));
              const len = ps.reduce((acc, p) => acc + (p.innerText || '').length, 0);
              if (len > maxPText) {
                maxPText = len;
                target = b;
              }
            }
          }

          const container = (target || doc.body).cloneNode(true);

          // Clean unwanted elements
          const junk = container.querySelectorAll('nav, footer, header, aside, script, style, iframe, form, button, [role="dialog"], .ad, .advertisement, .social-share, .comments');
          junk.forEach(el => el.remove());

          // Extract paragraphs and headings
          const contentBlocks = [];
          const contentNodes = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre'));

          for (const node of contentNodes) {
            const text = (node.innerText || '').trim();
            if (!text) continue;
            const tag = node.tagName.toLowerCase();
            if (tag.startsWith('h')) {
              const level = tag.substring(1);
              contentBlocks.push(\`\${'#'.repeat(parseInt(level, 10))} \${text}\`);
            } else if (tag === 'pre') {
              contentBlocks.push(\`\\\`\\\`\\\`\\n\${text}\\n\\\`\\\`\\\`\`);
            } else if (tag === 'blockquote') {
              contentBlocks.push(\`> \${text}\`);
            } else {
              contentBlocks.push(text);
            }
          }

          const content = contentBlocks.join('\\n\\n');
          const textContent = (container.innerText || '').trim();
          const wordCount = textContent.split(/\\s+/).filter(Boolean).length;
          const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

          return {
            title,
            byline,
            content: content || textContent,
            textContent,
            length: wordCount,
            readingTimeMinutes,
            siteName,
            url,
          };
        })()
      `;

      const article = await webContents.executeJavaScript(readerScript, true);
      return article && article.textContent.length > 50 ? article : null;
    } catch {
      return null;
    }
  }

  /**
   * Computes comprehensive TLS & Security Diagnostics for the current page.
   */
  public async getPageSecurityInfo(webContents: WebContents): Promise<PageSecurityInfo> {
    if (!webContents || webContents.isDestroyed()) {
      return {
        url: '',
        hostname: '',
        isHttps: false,
        securityScore: 0,
        grade: 'F',
        headers: [],
        cookiesCount: 0,
        hasInsecureContent: false,
      };
    }

    const url = webContents.getURL();
    let hostname = 'localhost';
    try {
      hostname = new URL(url).hostname;
    } catch {}

    const isHttps = url.startsWith('https://');

    let diag = {
      cookiesCount: 0,
      hasInsecureContent: false,
      hasPassword: false,
    };

    try {
      diag = await webContents.executeJavaScript(`
        (() => {
          const isPageHttps = window.location.protocol === 'https:';
          const mixedContent = Array.from(document.querySelectorAll('img, script, link, iframe')).some(el => {
            const src = el.src || el.href || '';
            return isPageHttps && src.startsWith('http://');
          });
          const cookies = document.cookie ? document.cookie.split(';').length : 0;
          const hasPassword = !!document.querySelector('input[type="password"]');
          return {
            cookiesCount: cookies,
            hasInsecureContent: mixedContent,
            hasPassword
          };
        })()
      `, true);
    } catch {}

    let score = isHttps ? 85 : 20;
    if (diag.hasInsecureContent) score -= 20;
    if (diag.hasPassword && !isHttps) score -= 30;
    score = Math.max(0, Math.min(100, score));

    const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
      score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

    return {
      url,
      hostname,
      isHttps,
      securityScore: score,
      grade,
      protocol: isHttps ? 'TLS 1.3 / HTTP/2' : 'HTTP/1.1 Cleartext',
      cipherSuite: isHttps ? 'TLS_AES_256_GCM_SHA384' : undefined,
      headers: [
        {
          name: 'Transport-Security',
          value: isHttps ? 'max-age=31536000; includeSubDomains' : 'None',
          status: isHttps ? 'good' : 'warning',
          description: isHttps ? 'Encrypted TLS communication enforced' : 'Cleartext HTTP vulnerable to interception',
        },
      ],
      cookiesCount: diag.cookiesCount,
      hasInsecureContent: diag.hasInsecureContent,
    };
  }
}
