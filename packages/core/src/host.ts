export interface BrowserTab {
  id: string;
  url: string;
  title: string;
}

export interface BrowserHost {
  kind: 'electron' | 'headless';
  listTabs(): Promise<BrowserTab[]>;
  getActiveTab(): Promise<BrowserTab | null>;
  fetch(url: string, init?: RequestInit, tabId?: string): Promise<Response>;
}

export class HeadlessBrowserHost implements BrowserHost {
  public readonly kind = 'headless' as const;

  async listTabs(): Promise<BrowserTab[]> {
    return [];
  }

  async getActiveTab(): Promise<BrowserTab | null> {
    return null;
  }

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(url, init);
  }
}

