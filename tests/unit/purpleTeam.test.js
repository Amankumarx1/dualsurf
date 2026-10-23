import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  purpleTeamEngine,
  listPurpleEnvironments,
  checkPurpleEnvironment,
  listPurpleScenarios,
  getPurpleScenario,
  listDetectionRules,
  generatePurpleTeamReport,
} from '../../apps/cli/dist/tools/purpleTeam.js';
import { evidenceStore } from '../../apps/cli/dist/tools/evidenceStore.js';

describe('DualSurf Purple Team Integration & Adversary Emulation Suite', () => {
  it('discovers authorized lab environments and verifies real availability', () => {
    const envs = listPurpleEnvironments();
    assert.ok(Array.isArray(envs), 'Environments must be an array');
    assert.ok(envs.length >= 4, 'Must define at least 4 test environments');

    for (const env of envs) {
      assert.ok(env.id, 'Environment must have an ID');
      assert.ok(env.name, 'Environment must have a descriptive name');
      assert.ok(Array.isArray(env.authorizedAssets), 'Authorized assets must be an array');
      assert.ok(Array.isArray(env.availableSources), 'Available sources must be an array');
      assert.ok(typeof env.isAvailable === 'boolean', 'isAvailable must be boolean');
    }

    if (process.platform === 'win32') {
      const winEnv = envs.find((e) => e.id === 'env-local-win');
      assert.ok(winEnv, 'Local Windows environment must be present on win32');
      assert.equal(winEnv.isAvailable, true, 'Local Windows environment must be marked available on win32');
    }
  });

  it('performs prerequisite check on a registered environment and rejects unknown environments', () => {
    const isWindows = process.platform === 'win32';
    const envId = isWindows ? 'env-local-win' : 'env-local-linux';
    const checked = checkPurpleEnvironment(envId);
    assert.equal(checked.id, envId);
    assert.equal(checked.isAvailable, true);

    assert.throws(
      () => {
        checkPurpleEnvironment('nonexistent-lab-id');
      },
      /not found/i
    );
  });

  it('lists standardized validation scenarios with valid MITRE ATT&CK metadata', () => {
    const scenarios = listPurpleScenarios();
    assert.ok(Array.isArray(scenarios), 'Scenarios must be an array');
    assert.ok(scenarios.length >= 5, 'Must contain standard scenario catalog');

    for (const sc of scenarios) {
      assert.ok(sc.id.startsWith('PT-'), 'Scenario ID must follow PT- prefix convention');
      assert.ok(sc.name, 'Scenario must have a name');
      assert.ok(sc.techniqueId.startsWith('T'), 'Technique ID must follow MITRE ATT&CK format');
      assert.ok(sc.techniqueName, 'Technique name must be provided');
      assert.ok(sc.tactic, 'Tactic must be specified');
      assert.ok(sc.testBehavior, 'Safe test behavior must be defined');
      assert.ok(sc.expectedTelemetrySources.length > 0, 'Expected telemetry sources must be defined');
      assert.ok(sc.expectedDetectionRule.ruleId, 'Detection rule must be assigned');
      assert.equal(sc.riskLevel, 'LOW', 'All validation scenarios must adhere to safe LOW risk level');
    }

    const win01 = getPurpleScenario('PT-WIN-01');
    assert.ok(win01);
    assert.equal(win01.id, 'PT-WIN-01');
    assert.equal(win01.techniqueId, 'T1059.001');

    const nonExistent = getPurpleScenario('PT-NONEXISTENT');
    assert.equal(nonExistent, undefined);
  });

  it('creates, persists, and lists Purple Team assessments with scorecard calculation', () => {
    const assessmentTitle = `Automated Purple Team Test Campaign - ${Date.now()}`;
    const assessment = purpleTeamEngine.createAssessment(assessmentTitle, 'env-local-win');

    assert.ok(assessment.id.startsWith('PTA-'));
    assert.equal(assessment.title, assessmentTitle);
    assert.ok(Array.isArray(assessment.executions));
    assert.ok(assessment.scorecard);
    assert.equal(typeof assessment.scorecard.coveragePct, 'number');

    const retrieved = purpleTeamEngine.getAssessment(assessment.id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, assessment.id);
    assert.equal(retrieved.title, assessmentTitle);

    const allAssessments = purpleTeamEngine.listAssessments();
    assert.ok(allAssessments.some((a) => a.id === assessment.id));
  });

  it('enforces explicit 8-state validation outcomes without fabrication', async () => {
    if (process.platform === 'win32') {
      const assessment = purpleTeamEngine.createAssessment('Controlled Test Execution Run');
      const result = await purpleTeamEngine.runValidationTest('PT-WIN-01', {
        assessmentId: assessment.id,
        approvedBy: 'Unit Test Runner',
      });

      assert.ok(result.id.startsWith('PTX-'));
      assert.equal(result.scenarioId, 'PT-WIN-01');
      assert.equal(result.approvalGranted, true);
      assert.equal(typeof result.exitCode, 'number');
      assert.equal(result.cleanupExecuted, true);

      // Verify that the outcome is one of the strictly allowed 8 validation states
      const allowedStates = [
        'PASS',
        'DETECTION_GAP',
        'TELEMETRY_GAP',
        'EXECUTION_FAILED',
        'DETECTION_FAILED',
        'PARTIAL',
        'INCONCLUSIVE',
        'NOT_TESTED',
      ];
      assert.ok(
        allowedStates.includes(result.validationStatus),
        `Outcome ${result.validationStatus} must belong to 8-state model`
      );

      // Verify cryptographic SHA-256 integrity hash is computed
      assert.ok(result.integrityHash, 'SHA-256 hash must be present');
      assert.equal(result.integrityHash.length, 64, 'SHA-256 hash must be 64 characters hex');

      // Verify evidence provenance
      assert.ok(result.telemetryEvidenceId, 'Telemetry evidence ID must be linked');
      const ev = evidenceStore.getEvidence(result.telemetryEvidenceId);
      assert.ok(ev, 'Linked telemetry evidence record must exist in evidenceStore');
    }
  });

  it('truthfully refuses or marks execution failed when environment is incompatible or unavailable', async () => {
    const res = await purpleTeamEngine.runValidationTest('PT-WIN-01', {
      environmentId: 'env-kali-range', // Disposable VM unavailable
    });
    assert.equal(res.validationStatus, 'EXECUTION_FAILED');
    assert.ok(res.stderr.includes('Prerequisite Failure'));
  });

  it('evaluates detection rules against recorded executions', () => {
    const rules = listDetectionRules();
    assert.ok(Array.isArray(rules));
    assert.ok(rules.length >= 5);

    const executions = purpleTeamEngine.listExecutions();
    if (executions.length > 0) {
      const exec = executions[0];
      const reevaluated = purpleTeamEngine.evaluateExecutionDetection(exec.id);
      assert.equal(reevaluated.id, exec.id);
      assert.equal(typeof reevaluated.detectionEvaluated, 'boolean');
    }
  });

  it('generates immutable DFIR Purple Team reports in Markdown and JSON', () => {
    const assessments = purpleTeamEngine.listAssessments();
    assert.ok(assessments.length > 0);
    const assessmentId = assessments[0].id;

    // Test Markdown Generation
    const mdReport = generatePurpleTeamReport(assessmentId, 'markdown');
    assert.ok(mdReport.reportContent.includes('DUALSURF PURPLE TEAM VALIDATION & DETECTION ASSESSMENT REPORT'));
    assert.ok(mdReport.reportContent.includes('Executive Detection Scorecard'));
    assert.ok(mdReport.reportContent.includes('Controlled Scenario Validation Results'));
    assert.ok(mdReport.reportContent.includes('Evidence Provenance & Cryptographic Hashes'));
    assert.ok(fs.existsSync(mdReport.filePath));

    // Test JSON Generation
    const jsonReport = generatePurpleTeamReport(assessmentId, 'json');
    const parsed = JSON.parse(jsonReport.reportContent);
    assert.equal(parsed.assessment.id, assessmentId);
    assert.ok(parsed.assessment.scorecard);
    assert.ok(Array.isArray(parsed.executions));
  });
});
