import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import {
  BLUE_TEAM_OPERATIONAL_PILLARS,
  formatBlueTeamPillarsList,
  formatBlueTeamPillarDetail,
  BLUE_TEAM_WORKFLOW,
  formatBlueTeamWorkflow,
  BLUE_TEAM_ROLE_PERSONAS,
  formatBlueTeamDailyOperations,
  BLUE_TEAM_METRICS,
  formatBlueTeamMetrics,
  BLUE_TEAM_TOOL_CATALOG,
  searchBlueTeamCatalog,
  formatBlueTeamCatalog,
  BLUE_TEAM_LEARNING_ROADMAP,
  formatBlueTeamRoadmap,
  executeBlueTeamTool,
} from '../../apps/cli/dist/tools/blueTeam.js';

import {
  SecurityEvidenceStore,
  formatEvidenceList,
  formatEvidenceDetail,
} from '../../apps/cli/dist/tools/evidenceStore.js';

import {
  detectHostBlueTeamTools,
  formatToolDetectionReport,
  getToolInfoGuidance,
  validateArgumentsSafety,
  redactSensitiveData,
} from '../../apps/cli/dist/tools/executionEngine.js';

describe('Blue Team Operations 13 Pillars & Toolset', () => {
  it('defines all 13 core operational pillars with complete metadata', () => {
    assert.equal(BLUE_TEAM_OPERATIONAL_PILLARS.length, 13);

    const titles = BLUE_TEAM_OPERATIONAL_PILLARS.map((p) => p.title);
    assert.ok(titles.includes('Security monitoring and SOC operations'));
    assert.ok(titles.includes('Endpoint Detection and Response (EDR/XDR)'));
    assert.ok(titles.includes('Threat hunting'));
    assert.ok(titles.includes('Incident response and containment'));
    assert.ok(titles.includes('Digital forensics and malware analysis'));
    assert.ok(titles.includes('Network Detection and Response (NDR)'));
    assert.ok(titles.includes('Vulnerability management and security hardening'));
    assert.ok(titles.includes('Identity and access security'));
    assert.ok(titles.includes('Cloud security monitoring and defense'));
    assert.ok(titles.includes('Email security and phishing defense'));
    assert.ok(titles.includes('Security automation and SOAR'));
    assert.ok(titles.includes('Threat intelligence and indicator analysis'));
    assert.ok(titles.includes('Security architecture, deception, and resilience'));

    for (const p of BLUE_TEAM_OPERATIONAL_PILLARS) {
      assert.ok(p.id >= 1 && p.id <= 13);
      assert.ok(p.number.length === 2);
      assert.ok(p.objective.length > 20);
      assert.ok(p.description.length > 20);
      assert.ok(p.toolGroups.length >= 1);
      assert.ok(p.investigationWorkflow.length >= 4);
      assert.ok(p.commandTriggers.length >= 2);
    }
  });

  it('formats pillars list and detailed pillar views accurately', () => {
    const listText = formatBlueTeamPillarsList();
    assert.ok(listText.includes('13 CORE PILLARS OF BLUE TEAM OPERATIONS'));
    assert.ok(listText.includes('Pillar 01: Security monitoring and SOC operations'));
    assert.ok(listText.includes('Pillar 13: Security architecture, deception, and resilience'));

    const detailText = formatBlueTeamPillarDetail(1);
    assert.ok(detailText.includes('SECURITY MONITORING AND SOC OPERATIONS'));
    assert.ok(detailText.includes('1.1 SIEM platforms'));
    assert.ok(detailText.includes('Microsoft Sentinel'));
    assert.ok(detailText.includes('Investigation Workflow Steps'));
  });

  it('defines the complete 6-phase Blue Team operational workflow', () => {
    assert.equal(BLUE_TEAM_WORKFLOW.length, 6);
    assert.equal(BLUE_TEAM_WORKFLOW[0].title, 'Collect telemetry');
    assert.equal(BLUE_TEAM_WORKFLOW[1].title, 'Detect suspicious activity');
    assert.equal(BLUE_TEAM_WORKFLOW[2].title, 'Triage and investigate');
    assert.equal(BLUE_TEAM_WORKFLOW[3].title, 'Contain and remediate');
    assert.equal(BLUE_TEAM_WORKFLOW[4].title, 'Recover and verify');
    assert.equal(BLUE_TEAM_WORKFLOW[5].title, 'Improve defenses');

    const workflowText = formatBlueTeamWorkflow();
    assert.ok(workflowText.includes('THE COMPLETE BLUE TEAM OPERATIONAL WORKFLOW'));
    assert.ok(workflowText.includes('Phase 1: COLLECT TELEMETRY'));
    assert.ok(workflowText.includes('Phase 6: IMPROVE DEFENSES'));
  });

  it('defines the 4 Blue Team operational role personas and working days', () => {
    assert.equal(BLUE_TEAM_ROLE_PERSONAS.length, 4);
    const roles = BLUE_TEAM_ROLE_PERSONAS.map((r) => r.role);
    assert.ok(roles.includes('soc_tier1'));
    assert.ok(roles.includes('soc_tier2'));
    assert.ok(roles.includes('hunter_engineer'));
    assert.ok(roles.includes('dfir_analyst'));

    const dailyText = formatBlueTeamDailyOperations();
    assert.ok(dailyText.includes('SOC Analyst — Tier 1 (Triage & Monitoring)'));
    assert.ok(dailyText.includes('DFIR / Malware Analyst'));
    assert.ok(dailyText.includes('Typical Working Day Schedule'));
  });

  it('defines the 12 core Blue Team metrics with formulas', () => {
    assert.equal(BLUE_TEAM_METRICS.length, 12);
    const metricNames = BLUE_TEAM_METRICS.map((m) => m.metric);
    assert.ok(metricNames.includes('MTTD'));
    assert.ok(metricNames.includes('MTTA'));
    assert.ok(metricNames.includes('MTTR'));
    assert.ok(metricNames.includes('False-Positive Rate'));
    assert.ok(metricNames.includes('Detection Coverage'));
    assert.ok(metricNames.includes('Endpoint Coverage'));
    assert.ok(metricNames.includes('Backup Restoration Success'));

    const metricsText = formatBlueTeamMetrics();
    assert.ok(metricsText.includes('METRICS BLUE TEAM PROFESSIONALS ARE EXPECTED TO UNDERSTAND'));
    assert.ok(metricsText.includes('MTTD'));
  });

  it('searches the comprehensive 200+ tool reference catalog', () => {
    assert.ok(BLUE_TEAM_TOOL_CATALOG.length >= 16);

    const allCats = searchBlueTeamCatalog();
    assert.equal(allCats.length, BLUE_TEAM_TOOL_CATALOG.length);

    const splunkResults = searchBlueTeamCatalog('splunk');
    assert.ok(splunkResults.length > 0);
    for (const cat of splunkResults) {
      assert.ok(cat.tools.some((t) => t.toLowerCase().includes('splunk')));
    }

    const catalogText = formatBlueTeamCatalog('zeek');
    assert.ok(catalogText.includes('BLUE TEAM SEARCHABLE TOOL CATALOG'));
    assert.ok(catalogText.includes('Zeek'));
  });

  it('defines the 16-week learning roadmap and 3 portfolio projects', () => {
    assert.equal(BLUE_TEAM_LEARNING_ROADMAP.length, 4);
    assert.equal(BLUE_TEAM_LEARNING_ROADMAP[0].timeline, 'Weeks 1–4');
    assert.equal(BLUE_TEAM_LEARNING_ROADMAP[1].timeline, 'Weeks 5–8');
    assert.equal(BLUE_TEAM_LEARNING_ROADMAP[2].timeline, 'Weeks 9–12');
    assert.equal(BLUE_TEAM_LEARNING_ROADMAP[3].timeline, 'Weeks 13–16');

    const roadmapText = formatBlueTeamRoadmap();
    assert.ok(roadmapText.includes('PRACTICAL BLUE TEAM LEARNING ROADMAP (16 WEEKS)'));
    assert.ok(roadmapText.includes('Mini SOC'));
    assert.ok(roadmapText.includes('Windows Threat-Hunting Lab'));
    assert.ok(roadmapText.includes('Official Learning References'));
  });
});

describe('Execution Engine & Security Safeguards', () => {
  it('detects command injection attempts in argument tokens', () => {
    assert.equal(validateArgumentsSafety(['--target', '192.168.1.1']).safe, true);
    assert.equal(validateArgumentsSafety(['--target', '192.168.1.1; rm -rf /']).safe, false);
    assert.equal(validateArgumentsSafety(['--target', 'host && whoami']).safe, false);
    assert.equal(validateArgumentsSafety(['--target', '`calc.exe`']).safe, false);
  });

  it('redacts sensitive credentials, tokens, and keys', () => {
    const raw = 'Login with --password SecretPassword123 and token=ghp_ABC123XYZ456 and Bearer eyJhbGciOi...';
    const redacted = redactSensitiveData(raw);
    assert.ok(!redacted.includes('SecretPassword123'));
    assert.ok(!redacted.includes('ghp_ABC123XYZ456'));
    assert.ok(redacted.includes('***REDACTED***'));
  });

  it('audits host tools and accurately categorizes installed vs missing', async () => {
    const tools = await detectHostBlueTeamTools();
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length >= 15);

    const report = formatToolDetectionReport(tools);
    assert.ok(report.includes('DUALSURF BLUE TEAM TOOL CENTER & HOST DISCOVERY'));
    assert.ok(report.includes('Platform:'));

    const zeekGuidance = getToolInfoGuidance('zeek');
    assert.ok(zeekGuidance.includes('DUALSURF TOOL INTEGRATION: ZEEK'));
    assert.ok(zeekGuidance.includes('https://zeek.org'));
  });
});

describe('Security Evidence Store & Provenance', () => {
  let testStore;
  const tempDir = path.join(os.tmpdir(), `dualsurf-test-evidence-${Date.now()}`);

  before(() => {
    testStore = new SecurityEvidenceStore(tempDir);
  });

  after(() => {
    try {
      testStore.clearAll();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('creates, hashes, and verifies evidence records with cryptographic integrity', () => {
    const record = testStore.recordEvidence({
      executionId: 'EXEC-TEST-001',
      toolId: 'test-tool',
      toolName: 'Unit Test Tool',
      target: '127.0.0.1',
      commandExecuted: 'test --check',
      executedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 42,
      exitCode: 0,
      stdout: 'All security tests verified successfully.',
      stderr: '',
      state: 'VERIFIED',
      parsedFindings: [{ check: 'auth', status: 'pass' }],
    });

    assert.ok(record.id.startsWith('EVD-'));
    assert.ok(record.integrityHash.length === 64); // SHA-256

    // Retrieve by ID
    const retrieved = testStore.getEvidence(record.id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, record.id);
    assert.equal(retrieved.stdout, 'All security tests verified successfully.');

    // Verify cryptographic integrity
    const verification = testStore.verifyIntegrity(record.id);
    assert.equal(verification.valid, true);
    assert.equal(verification.storedHash, record.integrityHash);

    // Export formats
    const jsonExport = testStore.exportEvidence(record.id, 'json');
    assert.ok(jsonExport.includes('"state": "VERIFIED"'));

    const rawExport = testStore.exportEvidence(record.id, 'raw');
    assert.ok(rawExport.includes('=== DUALSURF EVIDENCE ARCHIVE:'));
    assert.ok(rawExport.includes('SHA-256 Integrity:'));

    // Formatter checks
    const listFormatted = formatEvidenceList([record]);
    assert.ok(listFormatted.includes(record.id));
    assert.ok(listFormatted.includes('VERIFIED'));

    const detailFormatted = formatEvidenceDetail(record);
    assert.ok(detailFormatted.includes(record.id));
    assert.ok(detailFormatted.includes('SHA-256 Hash:'));
  });
});

describe('Live Defensive Operations Ground Truth Execution', () => {
  it('executes real live DNS DMARC and SPF verification without hallucinations', async () => {
    const res = await executeBlueTeamTool('dmarc', 'google.com');
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.tool, 'Email Security');
    assert.equal(res.pillarId, 10);
    assert.ok(res.output.includes('Live DNS Mail Authentication Audit'));
    assert.ok(res.output.includes('DMARC Record'));
    assert.ok(res.output.includes('Evidence Stored:'));
  });

  it('executes real live EDR host telemetry without fabrication', async () => {
    const res = await executeBlueTeamTool('edr');
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.tool, 'EDR/XDR');
    assert.equal(res.pillarId, 2);
    assert.ok(res.output.includes('Real Endpoint Detection & Response Telemetry Engine'));
    assert.ok(res.output.includes('Active Running Processes'));
    assert.ok(res.output.includes('Evidence Stored:'));
  });

  it('truthfully reports NOT_INSTALLED when an uninstalled tool is requested', async () => {
    const res = await executeBlueTeamTool('zeek');
    assert.equal(res.status, 'ERROR');
    assert.equal(res.data?.status, 'NOT_INSTALLED');
    assert.ok(res.output.includes('Status: NOT_INSTALLED'));
    assert.ok(res.output.includes('Result: No analysis was executed.'));
    assert.ok(res.output.includes('Review verified installation instructions'));
  });
});
