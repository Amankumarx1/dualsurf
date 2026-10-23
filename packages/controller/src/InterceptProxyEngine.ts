import { EventEmitter } from 'events';
import * as http from 'http';
import * as net from 'net';
import { URL } from 'url';
import type { Session } from 'electron';
import type {
  InterceptRule,
  InterceptedRequest,
  LocalProxyServerStatus,
  TrafficLogEntry,
} from '@dualsurf/shared-types';

interface PendingQueueItem {
  request: InterceptedRequest;
  resolve: (action: { drop?: boolean; modifiedHeaders?: Record<string, string>; redirectUrl?: string }) => void;
  timer: NodeJS.Timeout;
}

export class InterceptProxyEngine extends EventEmitter {
  private rules: InterceptRule[] = [];
  private isBreakpointActive: boolean = false;
  private pendingQueue: Map<string, PendingQueueItem> = new Map();
  private proxyServer: http.Server | null = null;
  private proxyPort: number = 8899;
  private proxyHost: string = '127.0.0.1';
  private totalRequestsHandled: number = 0;
  private totalIntercepted: number = 0;
  private attachedSession: Session | null = null;

  constructor() {
    super();
    this.seedDefaultRules();
  }

  private seedDefaultRules(): void {
    this.rules = [
      {
        id: 'rule_strip_csp',
        name: 'Strip CSP & Clickjacking Protection',
        enabled: false,
        action: 'modify_headers',
        match: {},
        modifications: {
          removeHeaders: ['content-security-policy', 'x-frame-options', 'strict-transport-security'],
        },
      },
      {
        id: 'rule_spoof_ip',
        name: 'Spoof Internal IP (X-Forwarded-For)',
        enabled: false,
        action: 'inject_header',
        match: {},
        modifications: {
          addHeaders: {
            'X-Forwarded-For': '127.0.0.1',
            'X-Real-IP': '127.0.0.1',
            'X-Client-IP': '127.0.0.1',
          },
        },
      },
      {
        id: 'rule_bug_bounty_auth',
        name: 'Inject Red Team Authorization Header',
        enabled: false,
        action: 'inject_header',
        match: {},
        modifications: {
          addHeaders: {
            'X-Security-Research': 'DualSurf-Authorized-Assessment',
          },
        },
      },
    ];
  }

  // ==========================================================================
  // 1. ELECTRON SESSION INTEGRATION (IN-LINE INTERCEPT & TAMPERING)
  // ==========================================================================

  public attachToSession(ses: Session): void {
    this.attachedSession = ses;

    // 1. onBeforeSendHeaders: Handle Header Injection, Custom Headers, and Breakpoint Interception
    ses.webRequest.onBeforeSendHeaders(
      { urls: ['http://*/*', 'https://*/*'] },
      (details, callback) => {
        const headers = details.requestHeaders || {};
        let shouldDrop = false;
        let modified = false;

        // Apply enabled rules
        for (const rule of this.rules) {
          if (!rule.enabled) continue;
          if (!this.matchesRule(details.url, details.method, rule)) continue;

          if (rule.action === 'drop') {
            shouldDrop = true;
            break;
          }

          if (rule.action === 'modify_headers' || rule.action === 'inject_header') {
            if (rule.modifications?.addHeaders) {
              for (const [k, v] of Object.entries(rule.modifications.addHeaders)) {
                headers[k] = v;
                modified = true;
              }
            }
            if (rule.modifications?.removeHeaders) {
              for (const h of rule.modifications.removeHeaders) {
                delete headers[h];
                delete headers[h.toLowerCase()];
                modified = true;
              }
            }
          }
        }

        if (shouldDrop) {
          callback({ cancel: true });
          return;
        }

        // Breakpoint mode check
        if (this.isBreakpointActive && this.shouldBreakpoint(details.url, details.method)) {
          this.totalIntercepted++;
          const reqId = `intercept_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const headersMap: Record<string, string> = {};
          for (const [k, v] of Object.entries(headers)) {
            headersMap[k] = String(v);
          }

          const interceptedReq: InterceptedRequest = {
            id: reqId,
            timestamp: Date.now(),
            method: details.method,
            url: details.url,
            headers: headersMap,
            tabId: details.webContentsId ? String(details.webContentsId) : undefined,
            status: 'pending',
          };

          // Hold callback until operator clicks Forward or Drop (with 45s safety timeout)
          const timer = setTimeout(() => {
            this.pendingQueue.delete(reqId);
            callback({ cancel: false, requestHeaders: headers });
          }, 45000);

          this.pendingQueue.set(reqId, {
            request: interceptedReq,
            resolve: (action) => {
              clearTimeout(timer);
              if (action.drop) {
                callback({ cancel: true });
              } else if (action.modifiedHeaders) {
                callback({ cancel: false, requestHeaders: action.modifiedHeaders });
              } else {
                callback({ cancel: false, requestHeaders: headers });
              }
            },
            timer,
          });

          this.emit('intercept:pending', interceptedReq);
          return;
        }

        callback({ cancel: false, requestHeaders: modified ? headers : details.requestHeaders });
      }
    );

    // 2. onHeadersReceived: Handle Dynamic Response Stripping (CSP, X-Frame-Options, HSTS)
    ses.webRequest.onHeadersReceived(
      { urls: ['http://*/*', 'https://*/*'] },
      (details, callback) => {
        const respHeaders = details.responseHeaders || {};
        let modified = false;

        for (const rule of this.rules) {
          if (!rule.enabled) continue;
          if (!this.matchesRule(details.url, details.method, rule)) continue;

          if (rule.modifications?.removeHeaders) {
            for (const h of rule.modifications.removeHeaders) {
              const lower = h.toLowerCase();
              for (const headerKey of Object.keys(respHeaders)) {
                if (headerKey.toLowerCase() === lower) {
                  delete respHeaders[headerKey];
                  modified = true;
                }
              }
            }
          }
        }

        callback({
          cancel: false,
          responseHeaders: modified ? respHeaders : details.responseHeaders,
          statusLine: details.statusLine,
        });
      }
    );
  }

  private matchesRule(urlStr: string, method: string, rule: InterceptRule): boolean {
    if (rule.match.methods && rule.match.methods.length > 0) {
      if (!rule.match.methods.includes(method.toUpperCase())) return false;
    }

    if (rule.match.domainPattern) {
      try {
        const parsed = new URL(urlStr);
        if (!parsed.hostname.includes(rule.match.domainPattern)) return false;
      } catch {
        return false;
      }
    }

    if (rule.match.urlPattern) {
      try {
        const regex = new RegExp(rule.match.urlPattern, 'i');
        if (!regex.test(urlStr)) return false;
      } catch {
        if (!urlStr.includes(rule.match.urlPattern)) return false;
      }
    }

    return true;
  }

  private shouldBreakpoint(urlStr: string, method: string): boolean {
    // Check if breakpoint rules exist, or default to all non-static requests
    const breakpointRules = this.rules.filter((r) => r.enabled && r.action === 'breakpoint');
    if (breakpointRules.length > 0) {
      return breakpointRules.some((r) => this.matchesRule(urlStr, method, r));
    }
    // Default breakpoint ignores static media
    const isStatic = /\.(png|jpe?g|gif|svg|woff2?|ttf|css|ico)(\?.*)?$/i.test(urlStr);
    return !isStatic;
  }

  // ==========================================================================
  // 2. BREAKPOINT QUEUE MANAGEMENT (OPERATOR MANUAL CONTROL)
  // ==========================================================================

  public setBreakpointActive(active: boolean): void {
    this.isBreakpointActive = active;
    if (!active) {
      // Forward all pending if disabled
      this.forwardAll();
    }
    this.emit('breakpoint:toggled', this.isBreakpointActive);
  }

  public getBreakpointActive(): boolean {
    return this.isBreakpointActive;
  }

  public getPendingRequests(): InterceptedRequest[] {
    return Array.from(this.pendingQueue.values()).map((item) => item.request);
  }

  public forwardRequest(id: string, modifiedHeaders?: Record<string, string>): boolean {
    const item = this.pendingQueue.get(id);
    if (!item) return false;
    this.pendingQueue.delete(id);
    item.request.status = modifiedHeaders ? 'modified' : 'forwarded';
    item.resolve({ modifiedHeaders });
    this.emit('intercept:resolved', item.request);
    return true;
  }

  public dropRequest(id: string): boolean {
    const item = this.pendingQueue.get(id);
    if (!item) return false;
    this.pendingQueue.delete(id);
    item.request.status = 'dropped';
    item.resolve({ drop: true });
    this.emit('intercept:resolved', item.request);
    return true;
  }

  public forwardAll(): void {
    for (const [id, item] of this.pendingQueue.entries()) {
      clearTimeout(item.timer);
      item.request.status = 'forwarded';
      item.resolve({});
      this.emit('intercept:resolved', item.request);
    }
    this.pendingQueue.clear();
  }

  // ==========================================================================
  // 3. RULES CRUD
  // ==========================================================================

  public getRules(): InterceptRule[] {
    return [...this.rules];
  }

  public setRules(rules: InterceptRule[]): void {
    this.rules = rules;
    this.emit('rules:updated', this.rules);
  }

  public addRule(rule: Omit<InterceptRule, 'id'>): InterceptRule {
    const newRule: InterceptRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    this.rules.push(newRule);
    this.emit('rules:updated', this.rules);
    return newRule;
  }

  public toggleRule(id: string): boolean {
    const r = this.rules.find((rule) => rule.id === id);
    if (!r) return false;
    r.enabled = !r.enabled;
    this.emit('rules:updated', this.rules);
    return r.enabled;
  }

  public deleteRule(id: string): boolean {
    const prev = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== id);
    const deleted = this.rules.length < prev;
    if (deleted) this.emit('rules:updated', this.rules);
    return deleted;
  }

  // ==========================================================================
  // 4. BUILT-IN LOCAL FORWARDING PROXY SERVER (FOR EXTERNAL CLI TOOLS)
  // ==========================================================================

  public async startProxyServer(port: number = 8899, host: string = '127.0.0.1'): Promise<{ success: boolean; error?: string }> {
    if (this.proxyServer) {
      return { success: true };
    }

    return new Promise((resolve) => {
      this.proxyPort = port;
      this.proxyHost = host;

      const server = http.createServer((clientReq, clientRes) => {
        this.totalRequestsHandled++;
        const parsedUrl = new URL(clientReq.url || '/', `http://${clientReq.headers.host || 'localhost'}`);
        const startTime = Date.now();

        // Prepare request headers with active rewrite rules
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(clientReq.headers)) {
          if (v !== undefined) {
            headers[k] = Array.isArray(v) ? v.join(', ') : v;
          }
        }

        // Apply custom injection rules
        for (const rule of this.rules) {
          if (!rule.enabled) continue;
          if (!this.matchesRule(parsedUrl.href, clientReq.method || 'GET', rule)) continue;
          if (rule.modifications?.addHeaders) {
            for (const [hk, hv] of Object.entries(rule.modifications.addHeaders)) {
              headers[hk] = hv;
            }
          }
        }

        const options: http.RequestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 80,
          path: parsedUrl.pathname + parsedUrl.search,
          method: clientReq.method,
          headers,
        };

        const proxyReq = http.request(options, (proxyRes) => {
          clientRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(clientRes);

          // Emit traffic log entry
          const entry: TrafficLogEntry = {
            id: `proxy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
            method: clientReq.method || 'GET',
            url: parsedUrl.href,
            domain: parsedUrl.hostname,
            resourceType: 'cli-proxy',
            status: proxyRes.statusCode,
            statusText: proxyRes.statusMessage || 'OK',
            headers,
            latencyMs: Date.now() - startTime,
            securityIssues: ['Proxied from external tool / CLI'],
          };
          this.emit('proxy:traffic', entry);
        });

        proxyReq.on('error', (err) => {
          clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
          clientRes.end(`DualSurf Proxy Error: ${err.message}`);
        });

        clientReq.pipe(proxyReq);
      });

      // Handle HTTPS CONNECT tunnel
      server.on('connect', (req, clientSocket, head) => {
        this.totalRequestsHandled++;
        const parts = (req.url || '').split(':');
        const targetHost = parts[0];
        const targetPort = parseInt(parts[1], 10) || 443;

        const serverSocket = net.connect(targetPort, targetHost, () => {
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          serverSocket.write(head);
          serverSocket.pipe(clientSocket);
          clientSocket.pipe(serverSocket);

          const entry: TrafficLogEntry = {
            id: `tunnel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
            method: 'CONNECT',
            url: `https://${targetHost}:${targetPort}`,
            domain: targetHost,
            resourceType: 'tls-tunnel',
            status: 200,
            statusText: 'Tunnel Established',
            headers: {},
            latencyMs: 0,
            securityIssues: ['HTTPS TLS Tunnel Established'],
          };
          this.emit('proxy:traffic', entry);
        });

        serverSocket.on('error', () => {
          clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        });
      });

      server.on('error', (err: any) => {
        this.proxyServer = null;
        resolve({ success: false, error: err.message });
      });

      server.listen(port, host, () => {
        this.proxyServer = server;
        this.emit('proxy:started', { port, host });
        resolve({ success: true });
      });
    });
  }

  public async stopProxyServer(): Promise<void> {
    if (!this.proxyServer) return;
    return new Promise((resolve) => {
      this.proxyServer?.close(() => {
        this.proxyServer = null;
        this.emit('proxy:stopped');
        resolve();
      });
    });
  }

  public getStatus(): LocalProxyServerStatus {
    return {
      running: this.proxyServer !== null,
      port: this.proxyPort,
      host: this.proxyHost,
      totalRequestsHandled: this.totalRequestsHandled,
      totalIntercepted: this.totalIntercepted,
      activeBreakpoint: this.isBreakpointActive,
    };
  }
}
