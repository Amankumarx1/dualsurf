import * as path from 'path';
import * as fs from 'fs';
import { BrowserSettings, SearchEngine } from '@dualsurf/shared-types';

export class NavigationService {
  private defaultEngine: SearchEngine = 'duckduckgo';

  constructor(engine?: SearchEngine) {
    if (engine) {
      this.defaultEngine = engine;
    }
  }

  public setSearchEngine(engine: SearchEngine): void {
    this.defaultEngine = engine;
  }

  public getSearchEngine(): SearchEngine {
    return this.defaultEngine;
  }

  /**
   * Normalizes an input string into a valid URL (including offline files,
   * local lab IPs, localhost, or search engine query URL).
   */
  public normalizeUrl(input: string, engine?: SearchEngine): string {
    const trimmed = input.trim();
    if (!trimmed) {
      return 'about:blank';
    }

    // Explicitly reject dangerous executable pseudo-schemes
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
      return this.buildSearchUrl(trimmed, engine);
    }

    // Special & offline schemes
    if (
      trimmed.startsWith('dualsurf://') ||
      trimmed.startsWith('about:') ||
      trimmed.startsWith('chrome://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('file://')
    ) {
      return trimmed;
    }

    // HTTP / HTTPS
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        new URL(trimmed);
        return trimmed;
      } catch {
        return this.buildSearchUrl(trimmed, engine);
      }
    }

    // Local filesystem files (offline HTML, Markdown, or text documents)
    if (
      trimmed.startsWith('./') ||
      trimmed.startsWith('../') ||
      /^[a-zA-Z]:[\\/]/.test(trimmed) ||
      (trimmed.startsWith('/') && !trimmed.includes(' ') && /\.(html?|txt|md|json|xml|svg|pdf)$/i.test(trimmed))
    ) {
      const resolved = path.resolve(trimmed);
      const normalizedPath = resolved.replace(/\\/g, '/').replace(/^\/+/, '');
      return process.platform === 'win32' ? `file:///${normalizedPath}` : `file://${resolved}`;
    }

    // Localhost, 127.0.0.1, 0.0.0.0, and Private / Lab Subnets (10.x, 172.16-31.x, 192.168.x)
    const privateIpRegex =
      /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|169\.254\.\d+\.\d+)(:\d+)?(\/.*)?$/i;
    if (privateIpRegex.test(trimmed)) {
      return `http://${trimmed}`;
    }

    // Standard public domain names (e.g. "github.com", "target.local")
    const domainRegex = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]+)?(\/.*)?$/;
    if (domainRegex.test(trimmed) && !trimmed.includes(' ')) {
      return `https://${trimmed}`;
    }

    // Otherwise, treat as search query
    return this.buildSearchUrl(trimmed, engine);
  }

  /**
   * Constructs search query URL for configured engine or bang shortcut.
   */
  public buildSearchUrl(query: string, engine?: SearchEngine): string {
    const trimmed = query.trim();

    // DuckDuckGo-style Bang Shortcuts
    if (trimmed.startsWith('!')) {
      const parts = trimmed.split(/\s+/);
      const bang = parts[0].toLowerCase();
      const bangQuery = encodeURIComponent(parts.slice(1).join(' ').trim());

      switch (bang) {
        case '!gh':
        case '!github':
          return bangQuery ? `https://github.com/search?q=${bangQuery}` : 'https://github.com';
        case '!w':
        case '!wiki':
        case '!wikipedia':
          return bangQuery ? `https://en.wikipedia.org/wiki/Special:Search?search=${bangQuery}` : 'https://en.wikipedia.org';
        case '!yt':
        case '!youtube':
          return bangQuery ? `https://www.youtube.com/results?search_query=${bangQuery}` : 'https://www.youtube.com';
        case '!g':
        case '!google':
          return bangQuery ? `https://www.google.com/search?q=${bangQuery}` : 'https://www.google.com';
        case '!d':
        case '!ddg':
        case '!duck':
          return bangQuery ? `https://duckduckgo.com/?q=${bangQuery}` : 'https://duckduckgo.com';
        case '!cve':
          return bangQuery ? `https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=${bangQuery}` : 'https://cve.mitre.org';
        case '!shodan':
          return bangQuery ? `https://www.shodan.io/search?query=${bangQuery}` : 'https://www.shodan.io';
        case '!exploit':
          return bangQuery ? `https://www.exploit-db.com/search?q=${bangQuery}` : 'https://www.exploit-db.com';
        case '!eco':
        case '!ecosia':
          return bangQuery ? `https://www.ecosia.org/search?q=${bangQuery}` : 'https://www.ecosia.org';
        case '!y':
        case '!yahoo':
          return bangQuery ? `https://search.yahoo.com/search?p=${bangQuery}` : 'https://search.yahoo.com';
        case '!b':
        case '!bing':
          return bangQuery ? `https://www.bing.com/search?q=${bangQuery}` : 'https://www.bing.com';
        case '!br':
        case '!brave':
          return bangQuery ? `https://search.brave.com/search?q=${bangQuery}` : 'https://search.brave.com';
        case '!so':
          return bangQuery ? `https://stackoverflow.com/search?q=${bangQuery}` : 'https://stackoverflow.com';
        case '!r':
        case '!reddit':
          return bangQuery ? `https://www.reddit.com/search/?q=${bangQuery}` : 'https://www.reddit.com';
      }
    }

    const activeEngine = engine || this.defaultEngine;
    const encoded = encodeURIComponent(trimmed);

    switch (activeEngine) {
      case 'google':
        return `https://www.google.com/search?q=${encoded}`;
      case 'brave':
        return `https://search.brave.com/search?q=${encoded}`;
      case 'bing':
        return `https://www.bing.com/search?q=${encoded}`;
      case 'ecosia':
        return `https://www.ecosia.org/search?q=${encoded}`;
      case 'yahoo':
        return `https://search.yahoo.com/search?p=${encoded}`;
      case 'duckduckgo':
      default:
        return `https://duckduckgo.com/?q=${encoded}`;
    }
  }
}
