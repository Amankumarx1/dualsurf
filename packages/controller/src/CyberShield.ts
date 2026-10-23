import { EventEmitter } from 'events';
import type { Session } from 'electron';
import type { CyberShieldStats } from '@dualsurf/shared-types';

export interface BlockRule {
  domain: string;
  category: 'tracker' | 'ad' | 'malware' | 'telemetry';
  description: string;
}

const DEFAULT_BLOCKLIST: BlockRule[] = [
  // Trackers & Telemetry
  { domain: 'google-analytics.com', category: 'tracker', description: 'Google Analytics Tracking' },
  { domain: 'analytics.google.com', category: 'tracker', description: 'Google Analytics' },
  { domain: 'googletagmanager.com', category: 'tracker', description: 'Google Tag Manager' },
  { domain: 'hotjar.com', category: 'tracker', description: 'Hotjar Behavioral Recording' },
  { domain: 'segment.io', category: 'tracker', description: 'Segment Customer Data Platform' },
  { domain: 'segment.com', category: 'tracker', description: 'Segment Analytics' },
  { domain: 'mixpanel.com', category: 'tracker', description: 'Mixpanel Analytics' },
  { domain: 'amplitude.com', category: 'tracker', description: 'Amplitude Behavioral Analytics' },
  { domain: 'crazyegg.com', category: 'tracker', description: 'CrazyEgg Heatmaps' },
  { domain: 'fullstory.com', category: 'tracker', description: 'FullStory Session Recording' },
  { domain: 'scorecardresearch.com', category: 'tracker', description: 'Comscore ScorecardResearch' },
  { domain: 'quantserve.com', category: 'tracker', description: 'Quantcast Audience Tracker' },
  { domain: 'criteo.com', category: 'tracker', description: 'Criteo Retargeting Tracker' },
  { domain: 'criteo.net', category: 'tracker', description: 'Criteo CDN' },
  { domain: 'taboola.com', category: 'tracker', description: 'Taboola Content Recommendation' },
  { domain: 'outbrain.com', category: 'tracker', description: 'Outbrain Recommendation Engine' },
  { domain: 'yandex.ru/metrika', category: 'tracker', description: 'Yandex Metrika Tracker' },
  { domain: 'clarity.ms', category: 'tracker', description: 'Microsoft Clarity Analytics' },
  { domain: 'bat.bing.com', category: 'tracker', description: 'Bing Ads Universal Event Tracking' },
  { domain: 'facebook.net/en_US/fbevents.js', category: 'tracker', description: 'Facebook Pixel Tracker' },
  { domain: 'connect.facebook.net', category: 'tracker', description: 'Meta / Facebook Connect Tracking' },

  // Ads & Ad Networks
  { domain: 'doubleclick.net', category: 'ad', description: 'Google DoubleClick Ad Network' },
  { domain: 'adservice.google.com', category: 'ad', description: 'Google AdService' },
  { domain: 'googlesyndication.com', category: 'ad', description: 'Google AdSense Syndication' },
  { domain: 'adnxs.com', category: 'ad', description: 'AppNexus / Xandr Ad Exchange' },
  { domain: 'rubiconproject.com', category: 'ad', description: 'Magnite / Rubicon Ad Exchange' },
  { domain: 'pubmatic.com', category: 'ad', description: 'PubMatic SSP' },
  { domain: 'openx.net', category: 'ad', description: 'OpenX Ad Marketplace' },
  { domain: 'casalemedia.com', category: 'ad', description: 'Index Exchange Ad Network' },
  { domain: 'popads.net', category: 'ad', description: 'PopAds Pop-under Network' },
  { domain: 'propellerads.com', category: 'ad', description: 'PropellerAds Push & Pop Ads' },
  { domain: 'infolinks.com', category: 'ad', description: 'Infolinks In-text Ads' },
  { domain: 'adform.net', category: 'ad', description: 'Adform DSP' },
  { domain: 'smartadserver.com', category: 'ad', description: 'Equativ / Smart AdServer' },
  { domain: 'advertising.com', category: 'ad', description: 'Yahoo / AOL Advertising' },
  { domain: 'moatads.com', category: 'ad', description: 'Oracle Moat Ad Measurement' },
  { domain: 'exponential.com', category: 'ad', description: 'Tribal Fusion / Exponential Ads' },
  { domain: 'zedo.com', category: 'ad', description: 'Zedo Ad Server' },
  { domain: 'adcolony.com', category: 'ad', description: 'AdColony Video Ads' },

  // Malware & Cryptominers
  { domain: 'coin-hive.com', category: 'malware', description: 'Coinhive Cryptominer' },
  { domain: 'coinhive.com', category: 'malware', description: 'Coinhive In-browser Mining' },
  { domain: 'crypto-loot.com', category: 'malware', description: 'Crypto-Loot Web Miner' },
  { domain: 'authedmine.com', category: 'malware', description: 'AuthedMine Monero Miner' },
  { domain: 'minr.pw', category: 'malware', description: 'Minr Web Worker Mining' },
  { domain: 'webminepool.com', category: 'malware', description: 'WebMinePool Cryptominer' },
  { domain: 'jsecoin.com', category: 'malware', description: 'JSECoin Web Mining' },
  { domain: 'monerominer.rocks', category: 'malware', description: 'MoneroMiner In-browser Mining' },
];

export class CyberShield extends EventEmitter {
  private enabled: boolean = true;
  private totalBlocked: number = 0;
  private trackersBlocked: number = 0;
  private adsBlocked: number = 0;
  private malwareBlocked: number = 0;
  private tabBlockedMap: Map<string, number> = new Map();
  private whitelistedDomains: Set<string> = new Set();
  private recentBlocked: Array<{
    url: string;
    domain: string;
    category: 'tracker' | 'ad' | 'malware' | 'telemetry';
    timestamp: number;
  }> = [];

  constructor(enabled: boolean = true) {
    super();
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.emit('stats:updated', this.getStats());
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    this.emit('stats:updated', this.getStats());
    return this.enabled;
  }

  public isWhitelisted(domain: string): boolean {
    const clean = domain.toLowerCase().replace(/:\d+$/, '');
    return this.whitelistedDomains.has(clean);
  }

  public toggleWhitelist(domain: string): boolean {
    const clean = domain.toLowerCase().replace(/:\d+$/, '');
    if (this.whitelistedDomains.has(clean)) {
      this.whitelistedDomains.delete(clean);
      this.emit('stats:updated', this.getStats());
      return false;
    } else {
      this.whitelistedDomains.add(clean);
      this.emit('stats:updated', this.getStats());
      return true;
    }
  }

  public attachToSession(ses: Session): void {
    // Intercept network requests before sending
    ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
      if (!this.enabled) {
        callback({ cancel: false });
        return;
      }

      const parsedUrl = this.safeParseUrl(details.url);
      if (!parsedUrl) {
        callback({ cancel: false });
        return;
      }

      const host = parsedUrl.hostname.toLowerCase();

      // Check if domain or main site is whitelisted
      if (this.isWhitelisted(host)) {
        callback({ cancel: false });
        return;
      }

      // Check against block rules
      const rule = this.matchRule(details.url, host);
      if (rule) {
        // Increment metrics
        this.totalBlocked++;
        if (rule.category === 'tracker' || rule.category === 'telemetry') {
          this.trackersBlocked++;
        } else if (rule.category === 'ad') {
          this.adsBlocked++;
        } else if (rule.category === 'malware') {
          this.malwareBlocked++;
        }

        // Record for recent log (capped at 50)
        this.recentBlocked.unshift({
          url: details.url,
          domain: host,
          category: rule.category,
          timestamp: Date.now(),
        });
        if (this.recentBlocked.length > 50) {
          this.recentBlocked.pop();
        }

        const tabKey = details.webContentsId ? String(details.webContentsId) : 'general';
        const currentCount = this.tabBlockedMap.get(tabKey) || 0;
        this.tabBlockedMap.set(tabKey, currentCount + 1);

        this.emit('shield:blocked', {
          url: details.url,
          domain: host,
          category: rule.category,
          description: rule.description,
          webContentsId: details.webContentsId,
          totalBlocked: this.totalBlocked,
        });

        this.emit('stats:updated', this.getStats());
        callback({ cancel: true });
        return;
      }

      callback({ cancel: false });
    });
  }

  private matchRule(fullUrl: string, host: string): BlockRule | null {
    for (const rule of DEFAULT_BLOCKLIST) {
      if (rule.domain.includes('/')) {
        // Path-based match
        if (fullUrl.toLowerCase().includes(rule.domain.toLowerCase())) {
          return rule;
        }
      } else {
        // Domain match (exact or subdomain)
        if (host === rule.domain || host.endsWith('.' + rule.domain)) {
          return rule;
        }
      }
    }
    return null;
  }

  private safeParseUrl(urlStr: string): URL | null {
    try {
      return new URL(urlStr);
    } catch {
      return null;
    }
  }

  public getStats(webContentsId?: string | number): CyberShieldStats {
    const tabKey = webContentsId ? String(webContentsId) : undefined;
    const tabBlockedCount = tabKey ? (this.tabBlockedMap.get(tabKey) || 0) : 0;

    return {
      enabled: this.enabled,
      totalBlocked: this.totalBlocked,
      trackersBlocked: this.trackersBlocked,
      adsBlocked: this.adsBlocked,
      malwareBlocked: this.malwareBlocked,
      tabBlockedCount,
      whitelistedDomains: Array.from(this.whitelistedDomains),
      recentBlocked: [...this.recentBlocked],
    };
  }

  public clearStats(): void {
    this.totalBlocked = 0;
    this.trackersBlocked = 0;
    this.adsBlocked = 0;
    this.malwareBlocked = 0;
    this.tabBlockedMap.clear();
    this.recentBlocked = [];
    this.emit('stats:updated', this.getStats());
  }
}
