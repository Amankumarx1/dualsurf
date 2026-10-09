import type { WebContents } from 'electron';
import { PageMetadata, HeadingItem, LinkItem } from '@dualsurf/shared-types';

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
      };
    }

    const title = webContents.getTitle();
    const url = webContents.getURL();
    const isLoading = webContents.isLoading();

    try {
      const extractionScript = `
        (() => {
          // Extract headings
          const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
          const headings = headingElements.slice(0, 50).map(el => ({
            level: parseInt(el.tagName.substring(1), 10),
            text: (el.textContent || '').trim().replace(/\\s+/g, ' ')
          })).filter(h => h.text.length > 0);

          // Extract actionable links with deterministic numbering
          const anchorElements = Array.from(document.querySelectorAll('a[href]'));
          let linkId = 1;
          const links = [];
          for (const a of anchorElements) {
            const rawHref = a.getAttribute('href') || '';
            const fullHref = a.href || '';
            const label = (a.innerText || a.textContent || a.title || rawHref).trim().replace(/\\s+/g, ' ');
            if (label && fullHref && !fullHref.startsWith('javascript:')) {
              links.push({
                id: linkId++,
                label: label.substring(0, 100),
                href: fullHref
              });
              if (linkId > 100) break; // Cap at 100 links per snapshot
            }
          }

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

          return { headings, links, textSnippet };
        })()
      `;

      const result = await webContents.executeJavaScript(extractionScript, true);

      return {
        title,
        url,
        isLoading,
        headings: result.headings || [],
        links: result.links || [],
        textSnippet: result.textSnippet || '',
      };
    } catch (err) {
      return {
        title,
        url,
        isLoading,
        headings: [],
        links: [],
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
              if (currentId === ${linkId}) {
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
}
