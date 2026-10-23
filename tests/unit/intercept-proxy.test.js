import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { InterceptProxyEngine } from '../../packages/controller/dist/InterceptProxyEngine.js';
import { BrowserController } from '../../packages/controller/dist/BrowserController.js';

describe('Sprint 1: In-Line HTTP Intercepting Proxy & Tampering Engine', () => {
  let engine;

  before(() => {
    engine = new InterceptProxyEngine();
  });

  after(async () => {
    await engine.stopProxyServer();
  });

  it('1. Initializes with active offensive default tampering rules', () => {
    const rules = engine.getRules();
    assert.ok(Array.isArray(rules), 'Rules must be an array');
    assert.ok(rules.length >= 3, 'Must contain default offensive rules');

    const cspRule = rules.find((r) => r.id === 'rule_strip_csp');
    assert.ok(cspRule, 'Must contain CSP stripping rule');
    assert.ok(cspRule.modifications.removeHeaders.includes('content-security-policy'));

    const spoofRule = rules.find((r) => r.id === 'rule_spoof_ip');
    assert.ok(spoofRule, 'Must contain IP spoofing rule');
    assert.equal(spoofRule.modifications.addHeaders['X-Forwarded-For'], '127.0.0.1');
  });

  it('2. Supports Rules CRUD (add, toggle, delete)', () => {
    const newRule = engine.addRule({
      name: 'Custom Auth Token Injection',
      enabled: true,
      action: 'inject_header',
      match: { domainPattern: 'api.target.corp' },
      modifications: {
        addHeaders: { Authorization: 'Bearer test-redteam-token' },
      },
    });

    assert.ok(newRule.id.startsWith('rule_'));
    const found = engine.getRules().find((r) => r.id === newRule.id);
    assert.ok(found, 'Added rule must exist');
    assert.equal(found.enabled, true);

    // Toggle rule
    const toggled = engine.toggleRule(newRule.id);
    assert.equal(toggled, false);
    assert.equal(engine.getRules().find((r) => r.id === newRule.id).enabled, false);

    // Delete rule
    const deleted = engine.deleteRule(newRule.id);
    assert.equal(deleted, true);
    assert.equal(engine.getRules().find((r) => r.id === newRule.id), undefined);
  });

  it('3. Breakpoint state management and queue resolution', () => {
    assert.equal(engine.getBreakpointActive(), false);
    engine.setBreakpointActive(true);
    assert.equal(engine.getBreakpointActive(), true);

    // Simulate an attached session with a mock webRequest
    let beforeSendHeadersHandler;
    const mockSession = {
      webRequest: {
        onBeforeSendHeaders: (filter, handler) => {
          beforeSendHeadersHandler = handler;
        },
        onHeadersReceived: () => {},
      },
    };

    engine.attachToSession(mockSession);
    assert.ok(beforeSendHeadersHandler, 'onBeforeSendHeaders handler must be registered');

    // Simulate an outgoing request intercepted at breakpoint
    let callbackResult = null;
    beforeSendHeadersHandler(
      {
        url: 'https://api.target.corp/v1/user/profile',
        method: 'POST',
        requestHeaders: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
        webContentsId: 42,
      },
      (res) => {
        callbackResult = res;
      }
    );

    // Verify pending intercept
    const pending = engine.getPendingRequests();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].url, 'https://api.target.corp/v1/user/profile');
    assert.equal(pending[0].method, 'POST');

    // Tamper and Forward
    const forwarded = engine.forwardRequest(pending[0].id, {
      ...pending[0].headers,
      'X-Injected-Header': 'RedTeamTamperValue',
    });
    assert.equal(forwarded, true);
    assert.equal(callbackResult.cancel, false);
    assert.equal(callbackResult.requestHeaders['X-Injected-Header'], 'RedTeamTamperValue');
    assert.equal(engine.getPendingRequests().length, 0);

    engine.setBreakpointActive(false);
  });

  it('4. Local Forwarding Proxy Server operates on 127.0.0.1 and captures traffic', async () => {
    // Start local proxy on port 9876
    const startRes = await engine.startProxyServer(9876, '127.0.0.1');
    assert.equal(startRes.success, true);

    const status = engine.getStatus();
    assert.equal(status.running, true);
    assert.equal(status.port, 9876);

    // Create a local test target server
    const targetServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Server': 'TestTarget/1.0' });
      res.end(JSON.stringify({ status: 'ok', receivedHeaders: req.headers }));
    });

    await new Promise((resolve) => targetServer.listen(9877, '127.0.0.1', resolve));

    let trafficCaptured = null;
    engine.on('proxy:traffic', (entry) => {
      trafficCaptured = entry;
    });

    // Make an HTTP request through our local proxy
    const proxyOptions = {
      hostname: '127.0.0.1',
      port: 9876,
      path: 'http://127.0.0.1:9877/api/test',
      method: 'GET',
      headers: {
        'Host': '127.0.0.1:9877',
        'User-Agent': 'DualSurf-Test-Client/1.0',
      },
    };

    const responseData = await new Promise((resolve, reject) => {
      const req = http.request(proxyOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });
      req.on('error', reject);
      req.end();
    });

    assert.equal(responseData.statusCode, 200);
    const parsed = JSON.parse(responseData.body);
    assert.equal(parsed.status, 'ok');

    // Verify proxy captured traffic entry
    assert.ok(trafficCaptured, 'Proxy must emit traffic event');
    assert.equal(trafficCaptured.method, 'GET');
    assert.equal(trafficCaptured.status, 200);

    // Clean up
    await new Promise((resolve) => targetServer.close(resolve));
    await engine.stopProxyServer();
    assert.equal(engine.getStatus().running, false);
  });

  it('5. BrowserController cleanly orchestrates InterceptProxyEngine', async () => {
    const ctrl = new BrowserController({ inMemory: true });
    assert.ok(ctrl.getInterceptEngine(), 'Must provide getInterceptEngine');

    const rules = ctrl.getInterceptRules();
    assert.ok(Array.isArray(rules));

    // Toggle breakpoint
    const bp = ctrl.toggleBreakpoint(true);
    assert.equal(bp, true);
    assert.equal(ctrl.getInterceptEngine().getBreakpointActive(), true);

    const bpOff = ctrl.toggleBreakpoint(false);
    assert.equal(bpOff, false);

    // Status check
    const status = ctrl.getLocalProxyStatus();
    assert.equal(typeof status.running, 'boolean');
    assert.equal(typeof status.port, 'number');
  });
});
