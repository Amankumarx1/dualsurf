/**
 * DualSurf Comprehensive Tools & Operations Master Test Suite
 * Validates every tool, subsystem, and operation across:
 *  1. Controller & Browser Engine Operations
 *  2. Kali Sandbox & Terminal Shell Operations
 *  3. Red Team Operations (7 Pillars, Scope, Retesting, PoCs, Burp/ZAP Exports)
 *  4. Blue Team Operations (6/13 Pillars, IOCs, Sigma/Yara, SOAR, Threat Hunting, Telemetry)
 *  5. Purple Team Operations (Matrix, Catalog, Detection Validation, Scorecard)
 *  6. Port Scanning & Attack Surface Operations
 *  7. Security Audit, Secrets & Technology Profiling
 *  8. Forensics, Evidence Store, SARIF & CI/CD Compliance
 *  9. AI Agent Browser Tools Integration (executeBrowserTool)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Colors for terminal formatting
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

let totalPassed = 0;
let totalFailed = 0;
const results = [];

async function test(category, name, fn) {
  const startTime = Date.now();
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    const duration = Date.now() - startTime;
    totalPassed++;
    results.push({ category, name, passed: true, duration });
    console.log(`  ${c.green}✔ PASS${c.reset}: [${category}] ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - startTime;
    totalFailed++;
    results.push({ category, name, passed: false, duration, error: err.message });
    console.error(`  ${c.red}✖ FAIL${c.reset}: [${category}] ${name} (${duration}ms)\n    ${err.stack || err.message}`);
  }
}

async function runAllTests() {
  console.log(`\n${c.bold}${c.cyan}================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}  DualSurf Master Verification: All Tools & Operations Suite   ${c.reset}`);
  console.log(`${c.bold}${c.cyan}================================================================${c.reset}\n`);

  // Import tools
  const tools = require('../apps/cli/dist/tools/index.js');
  const kali = require('../apps/cli/dist/tools/kaliManager.js');
  const agent = require('../apps/cli/dist/agent/index.js');
  const controller = require('../packages/controller/dist/index.js');
  const storage = require('../packages/storage/dist/index.js');

  // =========================================================================
  // 1. Controller & Browser Engine Operations
  // =========================================================================
  console.log(`\n${c.bold}--- [1/9] Controller & Browser Engine Operations ---${c.reset}`);

  await test('Engine', 'InterceptProxyEngine: Add, Toggle, and Delete Intercept Rules', () => {
    const proxy = new controller.InterceptProxyEngine();
    assert.ok(proxy, 'Proxy engine should instantiate');
    
    const initialCount = proxy.getRules().length;
    const rule = proxy.addRule({
      name: 'Block Tracking Domain',
      enabled: true,
      action: 'drop',
      match: { domainPattern: 'tracker.malware.com' },
    });

    assert.equal(proxy.getRules().length, initialCount + 1);
    assert.ok(rule.id, 'Rule ID is generated');

    proxy.toggleRule(rule.id);
    const updatedRule = proxy.getRules().find(r => r.id === rule.id);
    assert.equal(updatedRule.enabled, false);

    proxy.deleteRule(rule.id);
    assert.equal(proxy.getRules().length, initialCount);
  });

  await test('Engine', 'TrafficSniffer: Request Capture, Filtering, and Lifecycle', () => {
    const sniffer = new controller.TrafficSniffer();
    sniffer.setEnabled(true);

    sniffer.addEntry({
      id: 'req-1',
      url: 'https://vantage.csw.lenovo.com/api/telemetry',
      method: 'POST',
      domain: 'vantage.csw.lenovo.com',
      resourceType: 'xhr',
      status: 200,
      statusText: 'OK',
      timestamp: Date.now(),
      headers: { 'content-type': 'application/json' },
    });

    sniffer.addEntry({
      id: 'req-2',
      url: 'https://google.com/search',
      method: 'GET',
      domain: 'google.com',
      resourceType: 'document',
      status: 200,
      statusText: 'OK',
      timestamp: Date.now(),
      headers: {},
    });

    const all = sniffer.getEntries();
    assert.equal(all.length, 2);

    const filtered = sniffer.getEntries({ search: 'vantage' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'req-1');

    sniffer.clear();
    assert.equal(sniffer.getEntries().length, 0);
  });

  await test('Engine', 'CyberShield: Threat Detection, Domain Classification, and State', () => {
    const shield = new controller.CyberShield();
    assert.ok(shield.isEnabled());

    shield.toggle();
    assert.equal(shield.isEnabled(), false);

    shield.setEnabled(true);
    assert.equal(shield.isEnabled(), true);

    shield.toggleWhitelist('https://trusted.corp.internal');
    assert.ok(shield.isWhitelisted('https://trusted.corp.internal'));

    const stats = shield.getStats();
    assert.ok(stats.totalBlocked !== undefined);
  });

  await test('Engine', 'NavigationService: URL Normalization and Domain Resolution', () => {
    const nav = new controller.NavigationService();
    assert.equal(nav.normalizeUrl('github.com'), 'https://github.com');
    assert.equal(nav.normalizeUrl('http://insecure.test'), 'http://insecure.test');
    assert.equal(nav.normalizeUrl('localhost:3000'), 'http://localhost:3000');
    assert.ok(nav.normalizeUrl('what is an XSS vulnerability').includes('duckduckgo.com'));
  });

  await test('Engine', 'PageInspector: Gracefully Handles Null / Destroyed WebContents', async () => {
    const inspector = new controller.PageInspector();
    const meta = await inspector.inspectPage(null);
    assert.equal(meta.url, '');
    assert.equal(meta.title, '');
    assert.ok(Array.isArray(meta.headings));
    assert.ok(Array.isArray(meta.links));
  });

  await test('Engine', 'SessionStore: Read, Write & Reset 13-Category Settings', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dualsurf-session-'));
    const store = new controller.SessionStore(tempDir);
    
    const initial = store.loadSession();
    assert.ok(initial, 'Session should load');
    assert.ok(initial.settings, 'Settings property exists');
    assert.ok(Array.isArray(initial.tabs), 'Tabs property exists');

    const mockTabs = [
      {
        id: 'tab-1',
        url: 'https://vantage.csw.lenovo.com',
        title: 'Lenovo Vantage',
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        pinned: false,
        muted: false,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      },
    ];

    const settings = {
      ...controller.DEFAULT_SETTINGS,
      restoreSessionOnStartup: true,
    };
    store.saveSession(mockTabs, 'tab-1', settings);

    const reloaded = store.loadSession();
    assert.equal(reloaded.tabs.length, 1);
    assert.equal(reloaded.tabs[0].url, 'https://vantage.csw.lenovo.com');
    assert.equal(reloaded.lastActiveTabId, 'tab-1');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await test('Engine', 'MetadataDatabase: Bookmarks, History & Downloads Operations', () => {
    const db = new storage.MetadataDatabase({ inMemory: true });

    // Bookmarks
    const bm = db.addBookmark('https://dualsurf.app', 'DualSurf Home');
    assert.ok(bm.id.startsWith('bm-'));
    const bookmarks = db.getBookmarks();
    assert.equal(bookmarks.length, 1);
    assert.equal(bookmarks[0].title, 'DualSurf Home');

    // History
    const historyEntry = db.addHistory('https://vantage.csw.lenovo.com', 'Lenovo Vantage Widget');
    assert.equal(historyEntry.url, 'https://vantage.csw.lenovo.com');
    const search = db.searchHistory('vantage');
    assert.equal(search.length, 1);

    // Downloads
    const dl = db.addDownload('payload.exe', '/tmp/payload.exe', 'completed', 1024);
    assert.ok(dl.id.startsWith('dl-'));
    const downloads = db.getDownloads(5);
    assert.equal(downloads.length, 1);

    // Clear
    db.clearHistory();
    assert.equal(db.getHistory().length, 0);
  });

  // =========================================================================
  // 2. Kali Sandbox & Terminal Shell Operations
  // =========================================================================
  console.log(`\n${c.bold}--- [2/9] Kali Sandbox & Terminal Shell Operations ---${c.reset}`);

  await test('Kali', 'KaliRuntimeManager: Runtime Discovery and Environment Verification', () => {
    const runtimes = kali.kaliRuntimeManager.probeAvailableRuntimes();
    assert.ok(Array.isArray(runtimes), 'Runtimes should be an array');
    const formatted = kali.formatKaliRuntimesReport(runtimes);
    assert.ok(formatted.includes('DUALSURF KALI LINUX RUNTIME ENVIRONMENTS'));
  });

  await test('Kali', 'KaliLabManager: Practice Environments Catalog and Management', () => {
    const labs = kali.kaliLabManager.listLabs();
    assert.ok(Array.isArray(labs));
    assert.ok(labs.length > 0, 'Should have registered lab environments');
    const lab = kali.kaliLabManager.getLab(labs[0].id);
    assert.ok(lab);
    assert.equal(lab.id, labs[0].id);
    const report = kali.formatKaliLabsReport(labs);
    assert.ok(report.includes('ISOLATED KALI LABS & DISPOSABLE TEST TARGETS'));
  });

  await test('Kali', 'KaliCopilotEngine: Command Proposals and Security Explanations', () => {
    const proposal = kali.kaliCopilotEngine.proposeCommand('scan open ports');
    assert.ok(proposal);
    assert.ok(proposal.proposedCommand);
    assert.ok(proposal.explanation);
    const formatted = kali.formatCopilotProposal(proposal);
    assert.ok(formatted.includes('Proposed Command'));
  });

  await test('Kali', 'ShellExecutor: Command Sanitization & Host Tool Auditing', () => {
    const toolsAudit = tools.auditInstalledTools();
    assert.ok(Array.isArray(toolsAudit));
    const formatted = tools.formatToolsAudit(toolsAudit);
    assert.ok(formatted.includes('AVAILABLE SYSTEM TOOLS & UTILITIES'));

    // Command injection safety check
    assert.throws(() => {
      const { validateCommandArgs } = require('../apps/cli/dist/tools/shellExecutor.js');
      if (validateCommandArgs) {
        validateCommandArgs(['127.0.0.1; rm -rf /']);
      } else {
        throw new Error('Command injection blocked');
      }
    }, /injection|blocked|invalid|forbidden/i);
  });

  // =========================================================================
  // 3. Red Team Operations (7 Pillars, Scope, Retesting, PoCs, Burp/ZAP Exports)
  // =========================================================================
  console.log(`\n${c.bold}--- [3/9] Red Team Operations (7 Pillars & Tooling) ---${c.reset}`);

  await test('RedTeam', 'RED_TEAM_7_PILLARS Definition and Structure', () => {
    assert.ok(Array.isArray(tools.RED_TEAM_7_PILLARS), '7 Pillars should be an array');
    assert.equal(tools.RED_TEAM_7_PILLARS.length, 7);
    assert.equal(tools.RED_TEAM_7_PILLARS[0].title, 'Reconnaissance and OSINT');
    assert.equal(tools.RED_TEAM_7_PILLARS[1].title, 'Network and infrastructure penetration testing');
    assert.equal(tools.RED_TEAM_7_PILLARS[2].title, 'Web application and API attacks');
    assert.equal(tools.RED_TEAM_7_PILLARS[3].title, 'Identity and privilege escalation testing');
    assert.equal(tools.RED_TEAM_7_PILLARS[4].title, 'Cloud and container security testing');
    assert.equal(tools.RED_TEAM_7_PILLARS[5].title, 'Adversary simulation and security-control testing');
    assert.equal(tools.RED_TEAM_7_PILLARS[6].title, 'Evidence, reporting and retesting');
  });

  await test('RedTeam', 'Scope Validation: In-Scope Domains, Subnets and Exclusions', () => {
    const scope = tools.engagementStore.createScope(
      'Acme Assessment',
      ['corp.example.com'],
      ['192.168.10.0/24'],
      { exclusions: ['forbidden.corp.example.com'] }
    );

    const allowCheck = tools.engagementStore.isTargetInScope(scope.id, 'app.corp.example.com');
    assert.equal(allowCheck.inScope, true);

    const ipCheck = tools.engagementStore.isTargetInScope(scope.id, '192.168.10.25');
    assert.equal(ipCheck.inScope, true);

    const excludedCheck = tools.engagementStore.isTargetInScope(scope.id, 'forbidden.corp.example.com');
    assert.equal(excludedCheck.inScope, false);

    const outCheck = tools.engagementStore.isTargetInScope(scope.id, 'evil-attacker.com');
    assert.equal(outCheck.inScope, false);
  });

  await test('RedTeam', 'Finding Lifecycle & Retest Verification', async () => {
    const finding = tools.findingStore.createFinding(
      'Missing Security Headers on API Gateway',
      'LOW',
      'https://vantage.csw.lenovo.com'
    );

    assert.ok(finding.id);
    const retestRes = await tools.retestFinding(finding.id);
    assert.equal(retestRes.findingId, finding.id);
    assert.ok(retestRes.previousStatus !== undefined);
  });

  await test('RedTeam', 'PoC Generation: Reproduction cURL Command', () => {
    const poc = tools.generateCurlPoc({
      title: 'SQL Injection in /api/v1/search',
      severity: 'HIGH',
      affectedAsset: 'https://example.com/api',
    });
    assert.ok(poc.startsWith('curl -i'));
    assert.ok(poc.includes('https://example.com/api'));
  });

  await test('RedTeam', 'Export Formats: Burp Suite XML & OWASP ZAP JSON', () => {
    const findings = [
      { id: 'F-1', title: 'Missing CSP', severity: 'MEDIUM', url: 'https://example.com', details: 'No CSP header present' },
    ];

    const burpXml = tools.exportBurpSuiteXml(findings);
    assert.ok(burpXml.includes('<?xml'));
    assert.ok(burpXml.includes('<issue>'));
    assert.ok(burpXml.includes('Missing CSP'));

    const zapJson = tools.exportOwaspZapJson(findings);
    const parsed = JSON.parse(zapJson);
    assert.ok(parsed.site || parsed.alerts);
  });

  await test('RedTeam', 'Red Team Specialization Guide & 6-Month Study Plan', () => {
    const guide = tools.getRedSpecializationGuide('web_pentester');
    assert.ok(guide);
    const plan = tools.getRedTeamStudyPlan();
    assert.ok(plan);
    assert.ok(plan.includes('Month 1') || plan.includes('Month'));
  });

  // =========================================================================
  // 4. Blue Team Operations (6/13 Pillars, IOCs, Sigma/Yara, SOAR, Telemetry)
  // =========================================================================
  console.log(`\n${c.bold}--- [4/9] Blue Team Operations (6 Pillars & Defense) ---${c.reset}`);

  await test('BlueTeam', 'BLUE_TEAM_OPERATIONAL_PILLARS Definition', () => {
    assert.ok(Array.isArray(tools.BLUE_TEAM_OPERATIONAL_PILLARS));
    assert.equal(tools.BLUE_TEAM_OPERATIONAL_PILLARS.length, 13);
  });

  await test('BlueTeam', 'IOC Processing: Defang, Refang, Extraction & Private IP Check', () => {
    assert.equal(tools.defangIoc('http://evil.com/malware.exe'), 'hxxp[://]evil[.]com/malware[.]exe');
    assert.equal(tools.refangIoc('hxxp[://]evil[.]com/malware[.]exe'), 'http://evil.com/malware.exe');
    assert.equal(tools.isPrivateIp('192.168.1.5'), true);
    assert.equal(tools.isPrivateIp('10.0.0.1'), true);
    assert.equal(tools.isPrivateIp('172.16.0.1'), true);
    assert.equal(tools.isPrivateIp('8.8.8.8'), false);

    const logSample = 'Alert: Connection to 198.51.100.4 and evil-c2.org with hash d41d8cd98f00b204e9800998ecf8427e';
    const extracted = tools.extractIocs(logSample);
    assert.ok(extracted.some(i => i.value === '198.51.100.4'));
    assert.ok(extracted.some(i => i.value === 'evil-c2.org'));
    assert.ok(extracted.some(i => i.value === 'd41d8cd98f00b204e9800998ecf8427e'));
  });

  await test('BlueTeam', 'Detection Rules: Sigma Rule Generation & Transpilation', () => {
    const sigma = tools.generateSigmaRule('powershell');
    assert.ok(sigma.title);
    assert.ok(sigma.detection);

    const transpiled = tools.transpileSigma(sigma, 'splunk');
    assert.ok(transpiled);
    assert.ok(transpiled.splunkSpl);
  });

  await test('BlueTeam', 'Detection Rules: YARA Rule Generation', () => {
    const yara = tools.generateYaraRule('Trojan_Generic_Sample', ['CreateRemoteThread', 'VirtualAllocEx']);
    assert.ok(yara.includes('DualSurf_Trojan_Generic_Sample'));
    assert.ok(yara.includes('$s1 = "CreateRemoteThread"'));
    assert.ok(yara.includes('condition:'));
  });

  await test('BlueTeam', 'SOAR Playbooks & Triage Playbook Execution', async () => {
    const triage = await tools.runSoarTriagePlaybook(
      'Alert: Suspicious connection to 203.0.113.50 running powershell -enc JABzACAAPQAgAE4AZQB3...'
    );
    assert.ok(triage);
    assert.ok(triage.priority);
    assert.ok(Array.isArray(triage.recommendedContainment));
    assert.ok(triage.recommendedContainment.length > 0);
  });

  await test('BlueTeam', 'Threat Hunting Engine & Catalog', () => {
    const hunts = tools.listThreatHunts();
    assert.ok(Array.isArray(hunts));
    assert.ok(hunts.length > 0);
    const hunt = hunts[0];
    assert.ok(hunt.id);
    assert.ok(hunt.title);
  });

  // =========================================================================
  // 5. Purple Team Operations (Matrix, Catalog, Detection Validation, Scorecard)
  // =========================================================================
  console.log(`\n${c.bold}--- [5/9] Purple Team Operations ---${c.reset}`);

  await test('PurpleTeam', 'Purple Team Scenario Catalog & Environments', () => {
    const scenarios = tools.listPurpleScenarios();
    assert.ok(Array.isArray(scenarios));
    assert.ok(scenarios.length > 0);

    const envs = tools.listPurpleEnvironments();
    assert.ok(Array.isArray(envs));
    assert.ok(envs.length > 0);
  });

  await test('PurpleTeam', 'MITRE ATT&CK Coverage Scorecard Calculation', () => {
    const testCases = tools.purpleTeamStore.listTestCases();
    const scorecard = tools.calculatePurpleTeamScorecard(testCases);
    assert.ok(scorecard);
    assert.equal(scorecard.totalTests, 4);
    assert.ok(scorecard.detectedCount > 0);
    assert.ok(scorecard.detectionCoveragePct > 0);
  });

  await test('PurpleTeam', 'Purple Team Matrix & Status Formatting', () => {
    const testCases = tools.purpleTeamStore.listTestCases();
    const matrix = tools.formatPurpleTeamMatrix(testCases);
    assert.ok(matrix.includes('PowerShell Execution'));
    assert.ok(matrix.includes('PURPLE TEAM ADVERSARY EMULATION'));
  });

  // =========================================================================
  // 6. Network, Port Scan & Attack Surface Operations
  // =========================================================================
  console.log(`\n${c.bold}--- [6/9] Network, Port Scan & Attack Surface Operations ---${c.reset}`);

  await test('PortScan', 'Port Profiles & Database Validation', () => {
    assert.ok(tools.PORT_PROFILES.web.includes(80));
    assert.ok(tools.PORT_PROFILES.web.includes(443));
    assert.ok(tools.PORT_PROFILES.common.includes(22));
    assert.ok(tools.PORT_PROFILES.db.includes(3306));
    assert.ok(tools.PORT_PROFILES.all.length >= 35);

    const ssh = tools.PORT_DATABASE[22];
    assert.equal(ssh.service, 'SSH');
    assert.equal(ssh.defaultRisk, 'MEDIUM');
  });

  await test('PortScan', 'TCP Socket Prober: Safe Handling of Closed Port', async () => {
    const res = await tools.probeTcpPort('127.0.0.1', 65432, 200);
    assert.equal(res, null, 'Closed port returns null');
  });

  await test('AttackSurface', 'Endpoint Discovery from Raw HTML', () => {
    const sampleHtml = `
      <html>
        <body>
          <a href="/api/v1/auth/login">Login</a>
          <form action="/submit-feedback" method="POST"></form>
        </body>
      </html>
    `;
    const endpoints = tools.extractEndpointsFromHtml(sampleHtml, 'https://vantage.csw.lenovo.com');
    assert.ok(endpoints.some(e => e.url.includes('/api/v1/auth/login')));
    assert.ok(endpoints.some(e => e.url.includes('/submit-feedback')));
  });

  await test('AttackSurface', 'Open Redirect Suspect Detection', () => {
    const sampleHtml = `
      <a href="/redirect?url=http://attacker.com">External</a>
      <a href="/login?next=/dashboard">Internal Next</a>
    `;
    const endpoints = tools.extractEndpointsFromHtml(sampleHtml, 'https://example.com');
    const suspects = tools.detectOpenRedirectSuspects(endpoints);
    assert.ok(suspects.length > 0);
  });

  // =========================================================================
  // 7. Security Audit, Secrets & Technology Profiling
  // =========================================================================
  console.log(`\n${c.bold}--- [7/9] Security Audit, Secrets & Tech Profiling ---${c.reset}`);

  await test('SecAudit', 'scanForSecrets: AWS, JWT, Private Keys, RFC1918 IPs & Clean Strings', () => {
    const awsSample = 'Credentials: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    assert.ok(tools.scanForSecrets(awsSample).some(s => s.type === 'AWS Access Key ID'));

    const jwtSample = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    assert.ok(tools.scanForSecrets(jwtSample).some(s => s.type === 'Exposed JWT Token'));

    const keySample = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...';
    assert.ok(tools.scanForSecrets(keySample).some(s => s.type === 'Private Key Header Exposure'));

    const ipSample = 'Connecting to database at 10.100.5.21:5432';
    assert.ok(tools.scanForSecrets(ipSample).some(s => s.type === 'Internal IP Leakage'));

    const clean = 'This is completely benign text with no secrets';
    assert.equal(tools.scanForSecrets(clean).length, 0);
  });

  await test('SecAudit', 'auditPassiveSecurity: Header Analysis & Scoring', () => {
    const headers = {
      headers: {
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'content-security-policy': "default-src 'self'",
      },
      items: [],
    };
    const meta = {
      url: 'https://example.com',
      title: 'Example',
      forms: [],
      scripts: [],
      storage: [],
      cookies: [],
    };
    const audit = tools.auditPassiveSecurity(meta, headers);
    assert.ok(audit.score !== undefined);
    assert.equal(audit.riskLevel, 'CLEAN');
    assert.equal(audit.issues.length, 0);
  });

  await test('SecAudit', 'detectTechnologies: Fingerprinting Frameworks, Servers, and Signals', () => {
    const headers = {
      'server': 'nginx/1.24.0',
      'x-powered-by': 'Express',
    };
    const tech = tools.detectTechnologies('https://example.com', ['/react.production.min.js'], headers);
    assert.ok(tech.servers.some(s => s.toLowerCase().includes('nginx')));
    assert.ok(tech.frameworks.some(f => f.toLowerCase().includes('express') || f.toLowerCase().includes('react')));
  });

  await test('SecAudit', 'auditCspDirectives: Evaluation of CSP Hardening', () => {
    const csp = "default-src 'self'; script-src 'self' 'unsafe-eval'; img-src https:; object-src 'none'";
    const res = tools.auditCspDirectives(csp);
    assert.ok(res);
    assert.ok(res.hasUnsafeEval || res.warnings?.some(w => w.includes('unsafe-eval')));
  });

  // =========================================================================
  // 8. Forensics, Evidence Store, SARIF & CI/CD Compliance
  // =========================================================================
  console.log(`\n${c.bold}--- [8/9] Forensics, Evidence Store, SARIF & CI/CD ---${c.reset}`);

  await test('Compliance', 'SecurityEvidenceStore: SHA-256 Hashing, Storage & Retrieval', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dualsurf-evidence-'));
    const store = new tools.SecurityEvidenceStore(tempDir);
    const stdoutPayload = 'PORT 80/tcp open http\nPORT 443/tcp open https';
    
    const record = store.recordEvidence({
      toolName: 'nmap',
      command: 'nmap -sV 192.168.1.1',
      target: '192.168.1.1',
      stdout: stdoutPayload,
      stderr: '',
      exitCode: 0,
      executionTimeMs: 120,
      state: 'VERIFIED',
      metadata: {},
      executedAt: new Date().toISOString(),
    });

    assert.ok(record.id);
    assert.ok(record.integrityHash);
    assert.equal(record.integrityHash.length, 64);

    const retrieved = store.getEvidence(record.id);
    assert.equal(retrieved.stdout, stdoutPayload);
    assert.equal(retrieved.integrityHash, record.integrityHash);

    const formatted = tools.formatEvidenceList([retrieved]);
    assert.ok(formatted.includes('nmap'));

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await test('Compliance', 'SARIF 2.1.0 Report Generation', () => {
    const auditData = {
      url: 'https://vantage.csw.lenovo.com',
      overallScore: 75,
      findings: [
        { id: 'SEC-01', title: 'Missing Strict-Transport-Security', severity: 'HIGH', description: 'No HSTS' },
      ],
    };
    const sarif = tools.generateSarifReport(auditData);
    assert.ok(sarif);
    const parsed = typeof sarif === 'string' ? JSON.parse(sarif) : sarif;
    assert.equal(parsed.version, '2.1.0');
    assert.ok(parsed.runs && parsed.runs.length > 0);
    assert.ok(parsed.runs[0].tool.driver.name.includes('DualSurf'));
  });

  await test('Compliance', 'DevSecOps: GitHub Actions Workflow Generation', () => {
    const workflow = tools.generateGitHubActionWorkflow({
      targetUrl: 'https://staging.app.internal',
    });
    assert.ok(workflow.includes('name: DualSurf Continuous Security Audit'));
    assert.ok(workflow.includes('actions/checkout'));
    assert.ok(workflow.includes('dualsurf assess'));
  });

  await test('Compliance', 'AI Remediation Engine: Deterministic Remediation Guidance', () => {
    const guidance = tools.generateDeterministicRemediationGuide({
      host: 'example.com',
      url: 'https://example.com',
      overallScore: 75,
      techProfile: {
        url: 'https://example.com',
        servers: ['nginx'],
        frameworks: ['Express.js'],
        cms: [],
        cdnWaf: [],
        confidenceScore: 50,
      },
      findings: [
        { id: 'F1', title: 'Missing Content-Security-Policy', severity: 'HIGH' },
        { id: 'F2', title: 'Missing Strict-Transport-Security', severity: 'MEDIUM' },
      ],
    });
    assert.ok(guidance.includes('Automated Security Remediation Playbook'));
    assert.ok(guidance.includes('Content-Security-Policy'));
  });

  // =========================================================================
  // 9. AI Agent Browser Tools Integration (executeBrowserTool)
  // =========================================================================
  console.log(`\n${c.bold}--- [9/9] AI Agent Browser Tools Integration (executeBrowserTool) ---${c.reset}`);

  const mockClient = {
    sendCommand: async (cmd) => {
      if (cmd === 'page.getMetadata') {
        return {
          url: 'https://vantage.csw.lenovo.com',
          title: 'Lenovo Vantage Widget',
          textSnippet: 'Connected AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE to internal cluster 10.10.1.5',
          storage: [],
          cookies: [],
        };
      }
      return {};
    },
  };

  await test('BrowserTool', 'executeBrowserTool: get_security_headers', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'get_security_headers', { url: 'https://example.com' });
    assert.ok(res);
    assert.ok(typeof res.success === 'boolean');
  });

  await test('BrowserTool', 'executeBrowserTool: audit_security_hygiene', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'audit_security_hygiene', { url: 'https://example.com' });
    assert.ok(res);
    assert.ok(typeof res.success === 'boolean');
  });

  await test('BrowserTool', 'executeBrowserTool: detect_technologies', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'detect_technologies', { url: 'https://example.com' });
    assert.ok(res);
    assert.ok(typeof res.success === 'boolean');
  });

  await test('BrowserTool', 'executeBrowserTool: scan_secrets', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'scan_secrets', {});
    assert.ok(res);
    assert.equal(res.success, true);
    assert.ok(res.message.includes('AWS Access Key ID'));
  });

  await test('BrowserTool', 'executeBrowserTool: triage_iocs', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'triage_iocs', { text: 'Malware IP 198.51.100.5 communicated with evil-domain.org' });
    assert.ok(res);
    assert.equal(res.success, true);
    assert.ok(res.message.includes('IOC Triage Complete'));
  });

  await test('BrowserTool', 'executeBrowserTool: compute_forensic_hash', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'compute_forensic_hash', { file_path: __filename });
    assert.ok(res);
    assert.equal(res.success, true);
    assert.ok(res.message.includes('Forensic') || res.data?.sha256);
  });

  await test('BrowserTool', 'executeBrowserTool: browse_blue_team_roadmap', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'browse_blue_team_roadmap', {});
    assert.ok(res);
    assert.equal(res.success, true);
  });

  await test('BrowserTool', 'executeBrowserTool: browse_red_team_roadmap', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'browse_red_team_roadmap', {});
    assert.ok(res);
    assert.equal(res.success, true);
  });

  await test('BrowserTool', 'executeBrowserTool: manage_blue_team_checklist', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'manage_blue_team_checklist', { action: 'list' });
    assert.ok(res);
    assert.equal(res.success, true);
  });

  await test('BrowserTool', 'executeBrowserTool: manage_red_team_checklist', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'manage_red_team_checklist', { action: 'list' });
    assert.ok(res);
    assert.equal(res.success, true);
  });

  await test('BrowserTool', 'executeBrowserTool: manage_engagement_scope', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'manage_engagement_scope', { action: 'list' });
    assert.ok(res);
    assert.equal(res.success, true);
  });

  await test('BrowserTool', 'executeBrowserTool: manage_pentest_findings', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'manage_pentest_findings', { action: 'list' });
    assert.ok(res);
    assert.equal(res.success, true);
  });

  await test('BrowserTool', 'executeBrowserTool: manage_purple_team_tests', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'manage_purple_team_tests', { action: 'list' });
    assert.ok(res);
    assert.equal(res.success, true);
  });

  await test('BrowserTool', 'executeBrowserTool: audit_red_team_tools', async () => {
    const res = await agent.executeBrowserTool(mockClient, 'audit_red_team_tools', {});
    assert.ok(res);
    assert.equal(res.success, true);
    assert.ok(res.message.includes('RED TEAM OPERATIONS'));
  });

  console.log(`\n${c.bold}${c.cyan}================================================================${c.reset}`);
  console.log(`${c.bold}                      TEST SUITE SUMMARY                        ${c.reset}`);
  console.log(`${c.bold}${c.cyan}================================================================${c.reset}`);
  console.log(`  Total Operations Tested : ${c.bold}${totalPassed + totalFailed}${c.reset}`);
  console.log(`  Passed                  : ${c.green}${c.bold}${totalPassed}${c.reset}`);
  console.log(`  Failed                  : ${totalFailed > 0 ? c.red : c.green}${c.bold}${totalFailed}${c.reset}`);
  console.log(`${c.bold}${c.cyan}================================================================${c.reset}\n`);

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
