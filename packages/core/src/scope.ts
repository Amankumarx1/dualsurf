import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import type { EventBus } from './eventBus.js';
import { ScopeViolationError } from './errors.js';

export interface ScopeDecision {
  allowed: boolean;
  reason: string;
  host: string;
  matchingRule?: string;
}

export interface ScopeRules {
  allow: string[];
  deny: string[];
}

export class ScopeManager {
  private allowRules: Set<string> = new Set();
  private denyRules: Set<string> = new Set();
  private dataDir?: string;
  private events?: EventBus;

  constructor(dataDir?: string, events?: EventBus) {
    this.dataDir = dataDir;
    this.events = events;
    if (this.dataDir) {
      this.load();
    }
  }

  public list(): ScopeRules {
    return {
      allow: Array.from(this.allowRules),
      deny: Array.from(this.denyRules),
    };
  }

  public add(pattern: string, isDeny = false): { pattern: string; list: 'allow' | 'deny' } {
    const normalized = this.validateAndNormalizeRule(pattern);
    const targetSet = isDeny ? this.denyRules : this.allowRules;
    const oppositeSet = isDeny ? this.allowRules : this.denyRules;

    targetSet.add(normalized);
    // If it was in the other set, remove it
    oppositeSet.delete(normalized);

    this.save();
    this.emitChange();

    return {
      pattern: normalized,
      list: isDeny ? 'deny' : 'allow',
    };
  }

  public remove(pattern: string): boolean {
    const raw = pattern.trim().toLowerCase();
    const removedFromAllow = this.allowRules.delete(raw);
    const removedFromDeny = this.denyRules.delete(raw);
    const removed = removedFromAllow || removedFromDeny;

    if (removed) {
      this.save();
      this.emitChange();
    }

    return removed;
  }

  public check(target: string): ScopeDecision {
    const host = this.extractHost(target);
    if (!host) {
      return {
        allowed: false,
        reason: `Could not parse valid hostname or IP from target '${target}'`,
        host: '',
      };
    }

    // 1. Check deny rules first
    for (const rule of this.denyRules) {
      if (this.matchesRule(host, rule)) {
        return {
          allowed: false,
          reason: `Target matched deny rule '${rule}'`,
          host,
          matchingRule: rule,
        };
      }
    }

    // 2. Empty allow list denies everything
    if (this.allowRules.size === 0) {
      return {
        allowed: false,
        reason: 'Authorized scope is empty (empty scope denies all targets)',
        host,
      };
    }

    // 3. Check allow rules
    for (const rule of this.allowRules) {
      if (this.matchesRule(host, rule)) {
        return {
          allowed: true,
          reason: `Target matched allow rule '${rule}'`,
          host,
          matchingRule: rule,
        };
      }
    }

    return {
      allowed: false,
      reason: 'Target is not in the authorized scope allow-list',
      host,
    };
  }

  public isAllowed(target: string): boolean {
    return this.check(target).allowed;
  }

  public assertAllowed(target: string | string[]): void {
    const targets = Array.isArray(target) ? target : [target];
    for (const t of targets) {
      const decision = this.check(t);
      if (!decision.allowed) {
        throw new ScopeViolationError(t, decision.reason);
      }
    }
  }

  public extractHost(target: string): string | null {
    if (!target || typeof target !== 'string') return null;
    let s = target.trim();
    if (!s) return null;

    // Reject target if it contains control chars or whitespace
    if (/\s/.test(s)) return null;

    try {
      let parsedUrl: URL;
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
        parsedUrl = new URL(s);
      } else if (s.startsWith('//')) {
        parsedUrl = new URL(`http:${s}`);
      } else {
        parsedUrl = new URL(`http://${s}`);
      }

      let host = parsedUrl.hostname.toLowerCase();
      // Strip trailing dots
      if (host.endsWith('.')) {
        host = host.slice(0, -1);
      }
      // Strip IPv6 brackets
      if (host.startsWith('[') && host.endsWith(']')) {
        host = host.slice(1, -1);
      }

      return host || null;
    } catch {
      return null;
    }
  }

  private validateAndNormalizeRule(pattern: string): string {
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Scope pattern cannot be empty');
    }

    const trimmed = pattern.trim().toLowerCase();
    if (!trimmed) {
      throw new Error('Scope pattern cannot be empty');
    }

    // Reject whitespace, scheme, paths, query, hash, or userinfo
    if (/\s/.test(trimmed)) {
      throw new Error('Scope pattern cannot contain whitespace');
    }
    if (trimmed.includes('://')) {
      throw new Error('Scope pattern cannot contain a URL scheme (use host, IP, or wildcard)');
    }
    if (trimmed.includes('?') || trimmed.includes('#') || trimmed.includes('@')) {
      throw new Error("Scope pattern cannot contain '?', '#', or '@'");
    }
    if (trimmed === '*') {
      throw new Error("Bare '*' wildcard is not permitted in scope");
    }

    // Check if it is a CIDR notation: a.b.c.d/prefix
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length !== 2) {
        throw new Error("Invalid CIDR notation: must be 'IP/prefix'");
      }

      const ipPart = parts[0];
      const prefixStr = parts[1];
      const prefix = parseInt(prefixStr, 10);

      if (net.isIPv4(ipPart) !== true) {
        throw new Error(`CIDR base '${ipPart}' is not a valid IPv4 address`);
      }

      if (isNaN(prefix) || prefix.toString() !== prefixStr) {
        throw new Error(`CIDR prefix '${prefixStr}' must be a valid integer`);
      }

      // Prefix must be >= 8 and <= 32
      if (prefix < 8 || prefix > 32) {
        throw new Error(`CIDR prefix /${prefix} is out of bounds; prefix must be between /8 and /32`);
      }

      return `${ipPart}/${prefix}`;
    }

    // Wildcard domain: *.domain.tld
    if (trimmed.startsWith('*.')) {
      const suffix = trimmed.slice(2);
      if (!suffix.includes('.')) {
        throw new Error(`Wildcard rule '${trimmed}' is too broad; suffix '${suffix}' must contain at least one dot`);
      }
      if (suffix.startsWith('.') || suffix.endsWith('.')) {
        throw new Error(`Invalid wildcard domain rule: '${trimmed}'`);
      }
      return trimmed;
    }

    // If starts with * but not *.
    if (trimmed.startsWith('*')) {
      throw new Error(`Wildcard pattern must start with '*.' (e.g. '*.example.com'), got '${trimmed}'`);
    }

    // Check if valid IP
    if (net.isIP(trimmed)) {
      // Normalise IPv4 / IPv6
      return trimmed;
    }

    // Must be a valid domain name
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(trimmed)) {
      throw new Error(`Invalid domain or hostname pattern: '${trimmed}'`);
    }

    return trimmed;
  }

  private matchesRule(host: string, rule: string): boolean {
    const isHostIp4 = net.isIPv4(host);
    const isHostIp6 = net.isIPv6(host);

    // 1. CIDR Rule (IPv4 only)
    if (rule.includes('/')) {
      if (!isHostIp4) return false;
      return this.isIpInCidr(host, rule);
    }

    // 2. Wildcard Rule (*.suffix)
    if (rule.startsWith('*.')) {
      // Wildcards only apply to domain names, not raw IPs
      if (isHostIp4 || isHostIp6) return false;

      const suffix = rule.slice(2);
      // Wildcard matches subdomains at any depth, but NOT the apex itself
      return host.endsWith(`.${suffix}`);
    }

    // 3. Exact IP match
    if (net.isIP(rule)) {
      if (isHostIp4 && net.isIPv4(rule)) {
        return host === rule;
      }
      if (isHostIp6 && net.isIPv6(rule)) {
        return host === rule;
      }
      return false;
    }

    // 4. Exact domain match (does NOT match subdomains or supersets)
    return host === rule;
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    const ipInt = this.ipv4ToInt(ip);
    const rangeInt = this.ipv4ToInt(range);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;

    return (ipInt & mask) === (rangeInt & mask);
  }

  private ipv4ToInt(ip: string): number {
    return (
      ip
        .split('.')
        .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0) >>> 0
    );
  }

  private save(): void {
    if (!this.dataDir) return;
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
      }

      const filePath = path.join(this.dataDir, 'scope.json');
      const tempPath = path.join(this.dataDir, `scope.json.tmp.${Date.now()}`);
      const data = JSON.stringify(this.list(), null, 2);

      fs.writeFileSync(tempPath, data, { mode: 0o600 });
      fs.renameSync(tempPath, filePath);
    } catch {
      // Ignored if saving fails in volatile test mode
    }
  }

  private load(): void {
    if (!this.dataDir) return;
    const filePath = path.join(this.dataDir, 'scope.json');
    if (!fs.existsSync(filePath)) return;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content) as ScopeRules;
      if (Array.isArray(parsed.allow)) {
        this.allowRules = new Set(parsed.allow.map((r) => r.trim().toLowerCase()));
      }
      if (Array.isArray(parsed.deny)) {
        this.denyRules = new Set(parsed.deny.map((r) => r.trim().toLowerCase()));
      }
    } catch {
      // Fallback to empty scope
    }
  }

  private emitChange(): void {
    if (this.events) {
      this.events.emit('scope:changed', this.list());
    }
  }
}

