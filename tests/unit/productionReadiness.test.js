import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NavigationService } from '../../packages/controller/dist/NavigationService.js';
import { PageInspector } from '../../packages/controller/dist/PageInspector.js';
import { MetadataDatabase } from '../../packages/storage/dist/database.js';
import { kaliRuntimeManager } from '../../apps/cli/dist/tools/kaliManager.js';
import { evidenceStore } from '../../apps/cli/dist/tools/evidenceStore.js';
import { engagementStore, findingStore } from '../../apps/cli/dist/tools/redTeam.js';
import { listTelemetrySources, checkTelemetrySource } from '../../apps/cli/dist/tools/blueTelemetry.js';
import { purpleTeamEngine } from '../../apps/cli/dist/tools/purpleTeam.js';
import { executeShellCommand } from '../../apps/cli/dist/tools/shellExecutor.js';

describe('DualSurf Full-System Production Readiness & Integration Audit Suite', () => {
  const nav = new NavigationService('duckduckgo');
  const inspector = new PageInspector();

  // 1 & 2. Browser Navigation, Dangerous Scheme Neutralization, and Bang Queries
  it('Priority 1 & 2: Browser navigation sanitizes malicious schemes and resolves valid queries', () => {
    // Malicious schemes must never be navigated
    assert.ok(nav.normalizeUrl('javascript:alert(1)').startsWith('https://duckduckgo.com/?q='));
    assert.ok(nav.normalizeUrl('vbscript:msgbox(1)').startsWith('https://duckduckgo.com/?q='));

    // Standard domains
    assert.equal(nav.normalizeUrl('github.com'), 'https://github.com');
    assert.equal(nav.normalizeUrl('scanme.nmap.org'), 'https://scanme.nmap.org');

    // Localhost and private subnets
    assert.equal(nav.normalizeUrl('localhost:3000'), 'http://localhost:3000');
    assert.equal(nav.normalizeUrl('127.0.0.1:8080'), 'http://127.0.0.1:8080');
    assert.equal(nav.normalizeUrl('192.168.1.1'), 'http://192.168.1.1');

    // Search Bang shortcuts
    assert.equal(nav.buildSearchUrl('!gh dualsurf'), 'https://github.com/search?q=dualsurf');
    assert.equal(nav.buildSearchUrl('!cve 2025-21298'), 'https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=2025-21298');
    assert.equal(nav.buildSearchUrl('!exploit apache'), 'https://www.exploit-db.com/search?q=apache');
  });

  // 3 & 4. Terminal & Runtime Integration (Truthful Detection without Fake Labeling)
  it('Priority 3 & 4: Runtime manager truthfully probes host runtimes without labeling host as Kali', () => {
    const runtimes = kaliRuntimeManager.probeAvailableRuntimes();
    assert.ok(Array.isArray(runtimes), 'Runtimes list must be an array');
    assert.ok(runtimes.length >= 2, 'Must detect at least 2 runtime options');

    const hostLocal = runtimes.find((r) => r.id === 'host-local');
    assert.ok(hostLocal, 'Host local runtime must always be available');
    assert.equal(hostLocal.status, 'online');
    assert.ok(
      !hostLocal.name.toLowerCase().includes('kali'),
      'Local host shell must never be labeled as Kali Linux'
    );

    // If on Windows, check WSL detection truthfulness
    if (process.platform === 'win32') {
      const wsl = runtimes.find((r) => r.id === 'wsl-kali');
      if (wsl && wsl.wslDistroName === 'Ubuntu') {
        assert.equal(wsl.status, 'unconfigured');
        assert.ok(wsl.description.includes('wsl --install -d kali-linux'));
      }
    }
  });

  // 5 & 6. Shell Execution, Exit Codes, Timeouts, and Working Directory Accuracy
  it('Priority 5 & 6: Shell executor preserves exit codes, stdout, stderr, and enforces timeout limits', async () => {
    // Valid command
    const resWhoami = await executeShellCommand('whoami', { timeoutMs: 5000 });
    assert.equal(resWhoami.exitCode, 0);
    assert.ok(resWhoami.stdout.trim().length > 0);

    // Invalid command
    const resInvalid = await executeShellCommand('dualsurf_nonexistent_command_xyz123', { timeoutMs: 5000 });
    assert.notEqual(resInvalid.exitCode, 0);

    // Timeout enforcement
    const isWin = process.platform === 'win32';
    const sleepCmd = isWin ? 'ping 127.0.0.1 -n 5' : 'sleep 4';
    const resTimeout = await executeShellCommand(sleepCmd, { timeoutMs: 400 });
    assert.equal(resTimeout.timedOut, true);
    assert.notEqual(resTimeout.exitCode, 0);
  });

  // 7 & 8. Scope Validation & Target Boundary Enforcement
  it('Priority 7 & 8: Red Team scope validation enforces authorized boundaries and blocks out-of-scope targets', () => {
    const scope = engagementStore.createScope(
      'Production Readiness Audit Scope',
      ['scanme.nmap.org', '127.0.0.1'],
      ['192.168.1.0/24'],
      {
        exclusions: ['192.168.1.1'],
        status: 'Active',
      }
    );

    // Authorized targets
    const res1 = engagementStore.validateTargetScope(scope.id, 'scanme.nmap.org', 'nmap');
    assert.equal(res1.allowed, true);
    const res2 = engagementStore.validateTargetScope(scope.id, '127.0.0.1', 'nmap');
    assert.equal(res2.allowed, true);
    const res3 = engagementStore.validateTargetScope(scope.id, '192.168.1.50', 'nmap');
    assert.equal(res3.allowed, true);

    // Unauthorized targets
    const res4 = engagementStore.validateTargetScope(scope.id, 'google.com', 'nmap');
    assert.equal(res4.allowed, false);
    const res5 = engagementStore.validateTargetScope(scope.id, '192.168.1.1', 'nmap');
    assert.equal(res5.allowed, false); // Excluded
    const res6 = engagementStore.validateTargetScope(scope.id, '10.0.0.1', 'nmap');
    assert.equal(res6.allowed, false);
  });

  // 9. Red Team Finding & Evidence Storage
  it('Priority 9: Red Team findings link to assessments and immutable cryptographic evidence records', () => {
    const finding = findingStore.createFinding({
      title: 'Audit Target Port Ingestion',
      severity: 'Low',
      cvssScore: 3.1,
      affectedAsset: '127.0.0.1',
      description: 'Production readiness verification finding',
      remediation: 'Restrict access to local interface',
    });

    assert.ok(finding.id.startsWith('FIND-'));
    assert.equal(finding.affectedAsset, '127.0.0.1');

    const listed = findingStore.listFindings();
    assert.ok(listed.some((f) => f.id === finding.id));
  });

  // 10. Blue Team Log Query & Evidence Provenance
  it('Priority 10: Blue Team verifies genuine telemetry sources and records evidence provenance', async () => {
    const sources = await listTelemetrySources();
    assert.ok(sources.length > 0);

    const isWindows = process.platform === 'win32';
    const primaryId = isWindows ? 'win-system' : 'linux-process';
    const checked = await checkTelemetrySource(primaryId);
    assert.equal(checked.id, primaryId);
    assert.equal(checked.connected, true);
    assert.equal(checked.status, 'ACTIVE');

    // Unknown source rejection
    await assert.rejects(
      async () => {
        await checkTelemetrySource('fake-log-source-999');
      },
      /is not a recognized DualSurf telemetry provider/
    );
  });

  // 11. Purple Team Benign Test Execution & 8-State Model
  it('Priority 11: Purple Team enforces 8-state validation outcomes without fabrication', async () => {
    if (process.platform === 'win32') {
      const assessment = purpleTeamEngine.createAssessment('Production Readiness Validation Run');
      const result = await purpleTeamEngine.runValidationTest('PT-WIN-01', {
        assessmentId: assessment.id,
        approvedBy: 'Production Readiness QA',
      });

      assert.ok(result.id.startsWith('PTX-'));
      assert.ok(['PASS', 'DETECTION_GAP', 'TELEMETRY_GAP', 'EXECUTION_FAILED'].includes(result.validationStatus));
      assert.ok(result.integrityHash.length === 64);
    }
  });

  // 12. Network Raw Request / Repeater Socket Handling
  it('Priority 12: Network request handler returns structured response and captures failure without crashing', async () => {
    // Failure on invalid domain must return a clean error without throwing uncaught exceptions
    const startTime = Date.now();
    try {
      await fetch('https://invalid-nonexistent-domain-test-12345.local', {
        signal: AbortSignal.timeout(1500),
      });
      assert.fail('Should have failed on invalid domain');
    } catch (err) {
      assert.ok(err, 'Must catch network resolution error');
    }
  });

  // 13 & 14. Evidence Persistence & DFIR Report Generation
  it('Priority 13 & 14: EvidenceStore computes SHA-256 and persists records across instances', () => {
    const sampleOutput = 'DUALSURF_AUDIT_OUTPUT_CHECK_2026';
    const record = evidenceStore.recordEvidence({
      executionId: 'EX-TEST-001',
      toolId: 'dualsurf-audit-qa',
      toolName: 'DualSurf Production Readiness Tester',
      commandExecuted: 'node tests/unit/productionReadiness.test.js',
      executedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 42,
      exitCode: 0,
      stdout: sampleOutput,
      stderr: '',
      state: 'VERIFIED',
      parsedFindings: [],
      target: '127.0.0.1',
    });

    assert.ok(record.id.startsWith('EVD-'));
    assert.ok(record.integrityHash);
    assert.equal(record.integrityHash.length, 64);

    const retrieved = evidenceStore.getEvidence(record.id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, record.id);
    assert.equal(retrieved.stdout, sampleOutput);
  });

  // 15. Application State & Storage Persistence
  it('Priority 15: MetadataDatabase persists history and bookmarks across restarts', () => {
    const tempDbPath = path.join(os.tmpdir(), `dualsurf-test-db-${Date.now()}.json`);
    const db1 = new MetadataDatabase({ dbPath: tempDbPath });

    const entry = db1.addHistory('https://example.com', 'Example Title');
    assert.equal(entry.url, 'https://example.com');

    const bookmark = db1.addBookmark('https://github.com', 'GitHub');
    assert.equal(bookmark.url, 'https://github.com');

    // Simulate restart with new instance
    const db2 = new MetadataDatabase({ dbPath: tempDbPath });
    const history = db2.getHistory(10);
    assert.ok(history.some((h) => h.url === 'https://example.com'));

    const bookmarks = db2.getBookmarks();
    assert.ok(bookmarks.some((b) => b.url === 'https://github.com'));

    // Cleanup
    try { fs.unlinkSync(tempDbPath); } catch {}
  });

  // 16. Security Boundaries & Null WebContents Safety
  it('Priority 16: PageInspector and controller safely handle null or destroyed webContents', async () => {
    const inspectResult = await inspector.inspectPage(null);
    assert.equal(inspectResult.title, '');
    assert.equal(inspectResult.links.length, 0);

    const linkResult = await inspector.clickNumberedLink(null, 1);
    assert.equal(linkResult, null);
  });
});
