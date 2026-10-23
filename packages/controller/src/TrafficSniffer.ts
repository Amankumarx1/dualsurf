import { EventEmitter } from 'events';
import type { Session } from 'electron';
import type { TrafficLogEntry } from '@dualsurf/shared-types';

export class TrafficSniffer extends EventEmitter {
  private entries: TrafficLogEntry[] = [];
  private maxEntries: number = 500;
  private pendingRequests: Map<string, { startTime: number; method: string; url: string; headers: Record<string, string>; tabId?: string }> = new Map();
  private isEnabled: boolean = true;

  constructor(maxEntries: number = 500) {
    super();
    this.maxEntries = maxEntries;
  }

  public attachToSession(ses: Session): void {
    // 1. Capture outgoing requests & headers
    ses.webRequest.onSendHeaders({ urls: ['http://*/*', 'https://*/*'] }, (details) => {
      if (!this.isEnabled) return;
      const reqId = `${details.id}_${details.url}`;
      const headersMap: Record<string, string> = {};
      if (details.requestHeaders) {
        for (const [k, v] of Object.entries(details.requestHeaders)) {
          headersMap[k] = String(v);
        }
      }

      const tabId = details.webContentsId ? String(details.webContentsId) : undefined;
      this.pendingRequests.set(reqId, {
        startTime: Date.now(),
        method: details.method,
        url: details.url,
        headers: headersMap,
        tabId,
      });
    });

    // 2. Capture incoming responses & headers
    ses.webRequest.onResponseStarted({ urls: ['http://*/*', 'https://*/*'] }, (details) => {
      if (!this.isEnabled) return;
      const reqId = `${details.id}_${details.url}`;
      const pending = this.pendingRequests.get(reqId);
      const startTime = pending ? pending.startTime : Date.now();
      const latencyMs = Date.now() - startTime;
      if (pending) {
        this.pendingRequests.delete(reqId);
      }

      const responseHeaders: Record<string, string> = {};
      if (details.responseHeaders) {
        for (const [k, v] of Object.entries(details.responseHeaders)) {
          responseHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
        }
      }

      let parsedDomain = '';
      try {
        parsedDomain = new URL(details.url).hostname;
      } catch {}

      // Analyze security headers
      const securityIssues: string[] = [];
      if (details.url.startsWith('http://') && !parsedDomain.includes('localhost') && !parsedDomain.includes('127.0.0.1')) {
        securityIssues.push('Unencrypted HTTP Transport');
      }
      if (!responseHeaders['content-security-policy']) {
        securityIssues.push('Missing Content-Security-Policy (CSP)');
      }
      if (!responseHeaders['strict-transport-security'] && details.url.startsWith('https://')) {
        securityIssues.push('Missing Strict-Transport-Security (HSTS)');
      }
      if (!responseHeaders['x-frame-options'] && !responseHeaders['content-security-policy']?.includes('frame-ancestors')) {
        securityIssues.push('Missing Clickjacking Protection (X-Frame-Options)');
      }
      if (!responseHeaders['x-content-type-options']) {
        securityIssues.push('Missing MIME Sniffing Protection (X-Content-Type-Options)');
      }

      const entry: TrafficLogEntry = {
        id: `traffic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tabId: pending?.tabId || (details.webContentsId ? String(details.webContentsId) : undefined),
        timestamp: Date.now(),
        method: details.method,
        url: details.url,
        domain: parsedDomain,
        resourceType: details.resourceType || 'other',
        status: details.statusCode,
        statusText: details.statusLine || `${details.statusCode}`,
        headers: pending?.headers || {},
        responseHeaders,
        latencyMs,
        securityIssues,
      };

      this.addEntry(entry);
    });

    // 3. Capture errors
    ses.webRequest.onErrorOccurred({ urls: ['http://*/*', 'https://*/*'] }, (details) => {
      if (!this.isEnabled) return;
      const reqId = `${details.id}_${details.url}`;
      const pending = this.pendingRequests.get(reqId);
      const latencyMs = pending ? Date.now() - pending.startTime : 0;
      this.pendingRequests.delete(reqId);

      let parsedDomain = '';
      try {
        parsedDomain = new URL(details.url).hostname;
      } catch {}

      const entry: TrafficLogEntry = {
        id: `traffic_err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tabId: pending?.tabId || (details.webContentsId ? String(details.webContentsId) : undefined),
        timestamp: Date.now(),
        method: details.method,
        url: details.url,
        domain: parsedDomain,
        resourceType: details.resourceType || 'other',
        status: 0,
        statusText: details.error,
        headers: pending?.headers || {},
        latencyMs,
        securityIssues: [`Network Error: ${details.error}`],
      };

      this.addEntry(entry);
    });
  }

  public recordBlocked(info: { url: string; domain: string; category: string; description: string; tabId?: string }): void {
    const entry: TrafficLogEntry = {
      id: `traffic_blk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tabId: info.tabId,
      timestamp: Date.now(),
      method: 'BLOCKED',
      url: info.url,
      domain: info.domain,
      resourceType: 'script',
      status: 403,
      statusText: `Blocked by CyberShield (${info.category})`,
      blocked: true,
      blockReason: info.description,
      securityIssues: [`CyberShield Block: ${info.description}`],
    };

    this.addEntry(entry);
  }

  public addEntry(entry: TrafficLogEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }
    this.emit('traffic:entry', entry);
  }

  public getEntries(filter?: { tabId?: string; search?: string; method?: string }): TrafficLogEntry[] {
    let result = [...this.entries];
    if (filter?.tabId) {
      result = result.filter((e) => e.tabId === filter.tabId);
    }
    if (filter?.method && filter.method !== 'ALL') {
      result = result.filter((e) => e.method.toUpperCase() === filter.method?.toUpperCase());
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((e) => e.url.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q));
    }
    return result;
  }

  public clear(): void {
    this.entries = [];
    this.pendingRequests.clear();
    this.emit('traffic:cleared');
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}
