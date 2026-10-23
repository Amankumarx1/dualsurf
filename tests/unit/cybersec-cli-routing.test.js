import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHttpUrl } from '../../apps/cli/dist/tools/recon.js';
import { findingStore, exportBurpSuiteXml, exportOwaspZapJson } from '../../apps/cli/dist/tools/redTeam.js';
import { auditDnsAndEmail, buildAttackSurfaceRegister } from '../../apps/cli/dist/tools/attackSurface.js';
import { InterceptProxyEngine } from '../../packages/controller/dist/InterceptProxyEngine.js';

describe('Cybersecurity CLI Engine & Interoperability Suite', () => {
  describe('URL Normalization', () => {
    it('prepends https:// to bare domain strings', () => {
      assert.equal(normalizeHttpUrl('github.com'), 'https://github.com');
      assert.equal(normalizeHttpUrl('api.target.corp'), 'https://api.target.corp');
      assert.equal(normalizeHttpUrl('target.internal:8080/path'), 'https://target.internal:8080/path');
    });

    it('preserves explicit http:// and https:// schemes', () => {
      assert.equal(normalizeHttpUrl('http://scanme.nmap.org'), 'http://scanme.nmap.org');
      assert.equal(normalizeHttpUrl('https://example.com/api'), 'https://example.com/api');
    });

    it('safely handles empty or whitespace inputs', () => {
      assert.equal(normalizeHttpUrl(''), '');
      assert.equal(normalizeHttpUrl('   '), '');
    });
  });

  describe('DNS & Attack Surface Discovery', () => {
    it('executes passive DNS audit and extracts structure for localhost/local address', async () => {
      const res = await auditDnsAndEmail('127.0.0.1');
      assert.ok(res, 'Returns result object');
      assert.ok(Array.isArray(res.dnsRecords), 'Contains dnsRecords array');
      assert.ok(res.emailSecurity, 'Contains emailSecurity posture object');
    });

    it('builds attack surface register correlating hosts, SANs and IP addresses', () => {
      const host = 'pentest.corp';
      const ips = ['192.168.1.100'];
      const sans = ['pentest.corp', 'api.pentest.corp', 'admin.pentest.corp', 'staging.pentest.corp'];
      const register = buildAttackSurfaceRegister(host, ips, sans);

      assert.ok(register.length >= 4, 'Registers all related assets');
      const api = register.find((a) => a.hostname === 'api.pentest.corp');
      assert.ok(api, 'Found api asset');
      assert.equal(api.assetType, 'api');

      const admin = register.find((a) => a.hostname === 'admin.pentest.corp');
      assert.ok(admin, 'Found admin asset');
      assert.equal(admin.assetType, 'admin');

      const staging = register.find((a) => a.hostname === 'staging.pentest.corp');
      assert.ok(staging, 'Found staging asset');
      assert.equal(staging.environment, 'staging');
    });
  });

  describe('Intercept Proxy Engine Standalone Capabilities', () => {
    it('initializes default tampering rules and enables toggling breakpoints', () => {
      const proxy = new InterceptProxyEngine();
      const rules = proxy.getRules();
      assert.ok(Array.isArray(rules), 'Returns array of rules');
      assert.ok(rules.length >= 3, 'Has at least 3 default rules');

      assert.equal(proxy.getBreakpointActive(), false, 'Breakpoint initially inactive');
      proxy.setBreakpointActive(true);
      assert.equal(proxy.getBreakpointActive(), true, 'Breakpoint toggled active');
      proxy.setBreakpointActive(false);
      assert.equal(proxy.getBreakpointActive(), false, 'Breakpoint toggled inactive');
    });
  });

  describe('Finding Export Interoperability (Burp Suite XML & OWASP ZAP JSON)', () => {
    it('generates DTD-compliant Burp Suite XML with issue details and remediation', () => {
      const findings = findingStore.listFindings();
      assert.ok(findings.length > 0, 'Seed findings exist');

      const xml = exportBurpSuiteXml(findings);
      assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'), 'Has XML header');
      assert.ok(xml.includes('<!DOCTYPE issues SYSTEM "https://portswigger.net/burp/dtd/issues.dtd">'), 'Has Burp DTD declaration');
      assert.ok(xml.includes('<issues burpVersion="2026.1"'), 'Root element issues exists');
      assert.ok(xml.includes('<issue>'), 'Contains issue tags');
      assert.ok(xml.includes('<name>'), 'Contains name tag');
      assert.ok(xml.includes('<severity>'), 'Contains severity tag');
      assert.ok(xml.includes('<issueBackground>'), 'Contains issue background');
      assert.ok(xml.includes('<remediationBackground>'), 'Contains remediation background');
    });

    it('generates compliant OWASP ZAP JSON report with site and alert structures', () => {
      const findings = findingStore.listFindings();
      const jsonStr = exportOwaspZapJson(findings);
      const parsed = JSON.parse(jsonStr);

      assert.ok(parsed['@version'], 'Contains OWASP ZAP version tag');
      assert.ok(Array.isArray(parsed.site), 'Contains site array');
      assert.ok(parsed.site.length > 0, 'Site array has entries');
      assert.ok(Array.isArray(parsed.site[0].alerts), 'Site contains alerts array');
      
      const alert = parsed.site[0].alerts[0];
      assert.ok(alert.pluginid, 'Alert has pluginid');
      assert.ok(alert.alert, 'Alert has title');
      assert.ok(alert.riskcode, 'Alert has riskcode');
      assert.ok(alert.solution, 'Alert has solution');
    });
  });
});
