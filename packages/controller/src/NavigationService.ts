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
   * Normalizes an input string into a valid URL or search engine query URL.
   */
  public normalizeUrl(input: string, engine?: SearchEngine): string {
    const trimmed = input.trim();
    if (!trimmed) {
      return 'about:blank';
    }

    // Special schemes
    if (
      trimmed.startsWith('dualsurf://') ||
      trimmed.startsWith('about:') ||
      trimmed.startsWith('chrome://') ||
      trimmed.startsWith('data:')
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

    // Localhost or IP address with optional port
    if (
      /^localhost(:\d+)?(\/.*)?$/i.test(trimmed) ||
      /^127\.0\.0\.1(:\d+)?(\/.*)?$/.test(trimmed)
    ) {
      return `http://${trimmed}`;
    }

    // Looks like a domain (e.g. "github.com", "news.ycombinator.com/item?id=123")
    const domainRegex = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]+)?(\/.*)?$/;
    if (domainRegex.test(trimmed) && !trimmed.includes(' ')) {
      return `https://${trimmed}`;
    }

    // Otherwise, treat as search query
    return this.buildSearchUrl(trimmed, engine);
  }

  /**
   * Constructs search query URL for configured engine.
   */
  public buildSearchUrl(query: string, engine?: SearchEngine): string {
    const activeEngine = engine || this.defaultEngine;
    const encoded = encodeURIComponent(query.trim());

    switch (activeEngine) {
      case 'google':
        return `https://www.google.com/search?q=${encoded}`;
      case 'brave':
        return `https://search.brave.com/search?q=${encoded}`;
      case 'bing':
        return `https://www.bing.com/search?q=${encoded}`;
      case 'duckduckgo':
      default:
        return `https://duckduckgo.com/?q=${encoded}`;
    }
  }
}
