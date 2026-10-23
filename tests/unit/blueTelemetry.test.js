import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  listTelemetrySources,
  checkTelemetrySource,
  queryTelemetry,
  listThreatHunts,
  runThreatHunt,
  buildCaseTimeline,
  generateBlueTeamReport,
  previewResponseAction,
} from '../../apps/cli/dist/tools/blueTelemetry.js';
import { incidentStore } from '../../apps/cli/dist/tools/blueTeam.js';
import { evidenceStore } from '../../apps/cli/dist/tools/evidenceStore.js';

describe('DualSurf Blue Team End-to-End Telemetry & Investigation Suite', () => {
  it('discovers host telemetry sources and verifies real availability', async () => {
    const sources = await listTelemetrySources();
    assert.ok(Array.isArray(sources), 'Sources must be an array');
    assert.ok(sources.length > 0, 'Must discover at least one telemetry source');

    for (const src of sources) {
      assert.ok(src.id, 'Source must have an ID');
      assert.ok(src.name, 'Source must have a descriptive name');
      assert.ok(
        ['windows_event', 'local_syslog', 'zeek_eve', 'suricata_eve', 'siem_api', 'cloudtrail'].includes(src.type),
        `Source type ${src.type} must match recognized union`
      );
      assert.ok(
        ['ACTIVE', 'DISCONNECTED', 'PERMISSION_DENIED', 'UNCONFIGURED'].includes(src.status),
        `Source status ${src.status} must match valid lifecycle state`
      );
    }
  });

  it('performs deep preflight check on a registered telemetry source', async () => {
    const isWindows = process.platform === 'win32';
    const testSourceId = isWindows ? 'win-system' : 'linux-process';

    const source = await checkTelemetrySource(testSourceId);
    assert.equal(source.id, testSourceId);
    assert.equal(source.connected, true);
    assert.equal(source.status, 'ACTIVE');

    if (isWindows && source.lastEventTime) {
      assert.ok(!isNaN(new Date(source.lastEventTime).getTime()), 'Timestamp must be valid ISO date');
    }
  });

  it('truthfully rejects unknown or unconfigured telemetry sources', async () => {
    await assert.rejects(
      async () => {
        await checkTelemetrySource('nonexistent-cloudtrail-stream');
      },
      /is not a recognized DualSurf telemetry provider/
    );
  });

  it('ingests live host telemetry and stores evidence with cryptographic hash', async () => {
    const isWindows = process.platform === 'win32';
    const sourceId = isWindows ? 'win-system' : 'linux-process';

    const result = await queryTelemetry(sourceId, { since: '24h', limit: 5 });
    assert.ok(result.source, 'Result must contain source metadata');
    assert.ok(Array.isArray(result.events), 'Events must be an array');
    assert.ok(result.evidence, 'Evidence record must be generated');
    assert.ok(result.evidence.id.startsWith('EVD-'), 'Evidence ID must have EVD prefix');
    assert.ok(result.evidence.integrityHash.length === 64, 'Integrity hash must be SHA-256');

    // Verify evidence record exists in persistent evidence store
    const stored = evidenceStore.getEvidence(result.evidence.id);
    assert.ok(stored, 'Evidence must be retrievable from evidence store');
    assert.equal(stored.integrityHash, result.evidence.integrityHash);
  });

  it('captures live process telemetry and parses working set memory', async () => {
    const isWindows = process.platform === 'win32';
    const procSourceId = isWindows ? 'win-process' : 'linux-process';

    const result = await queryTelemetry(procSourceId, { limit: 5 });
    assert.ok(result.events.length > 0, 'Must capture running processes');
    const firstProc = result.events[0];
    assert.ok(firstProc.provider, 'Process must have a name / provider');
    assert.ok(firstProc.message.includes('Process:'), 'Message must contain formatted process details');
  });

  it('maintains registered threat hunting hypotheses with MITRE ATT&CK techniques', () => {
    const hunts = listThreatHunts();
    assert.ok(hunts.length >= 5, 'Must define at least 5 standard threat hunts');
    for (const h of hunts) {
      assert.ok(h.id.startsWith('HUNT-'), 'Hunt ID must have HUNT prefix');
      assert.ok(h.hypothesis.length > 10, 'Hunt must define a hypothesis');
      assert.ok(h.dataSources.length > 0, 'Hunt must specify required data sources');
      assert.ok(h.mitreTechniques.length > 0, 'Hunt must map to MITRE ATT&CK techniques');
    }
  });

  it('executes a threat hunt against real host telemetry and preserves evidence', async () => {
    const isWindows = process.platform === 'win32';
    const huntId = isWindows ? 'HUNT-002' : 'HUNT-005';

    const result = await runThreatHunt(huntId);
    assert.equal(result.hunt.id, huntId);
    assert.equal(result.hunt.status, 'Completed');
    assert.ok(Array.isArray(result.matches), 'Matches must be an array');
    assert.ok(result.evidence, 'Must link to security evidence record');
    assert.ok(result.explanation.length > 0, 'Must provide an analyst explanation');
  });

  it('builds a chronological incident timeline linked to evidence', () => {
    const cases = incidentStore.listCases();
    assert.ok(cases.length > 0, 'Must have at least one active incident case');
    const targetCase = cases[0];

    const timeline = buildCaseTimeline(targetCase.id);
    assert.ok(Array.isArray(timeline), 'Timeline must be an array');
    if (timeline.length > 1) {
      for (let i = 1; i < timeline.length; i++) {
        assert.ok(
          timeline[i].timestamp >= timeline[i - 1].timestamp,
          'Timeline events must be sorted chronologically'
        );
      }
    }
  });

  it('generates Markdown and JSON investigation reports and writes to disk', () => {
    const cases = incidentStore.listCases();
    const caseId = cases[0].id;

    // Markdown
    const mdResult = generateBlueTeamReport(caseId, 'markdown');
    assert.ok(fs.existsSync(mdResult.filePath), 'Markdown report must exist on disk');
    assert.ok(mdResult.reportContent.includes(caseId), 'Report content must reference Case ID');
    assert.ok(mdResult.reportContent.includes('Executive Summary'), 'Report must include Executive Summary');
    assert.ok(mdResult.reportContent.includes('Chronological Incident Timeline'), 'Report must include Timeline');

    // JSON
    const jsonResult = generateBlueTeamReport(caseId, 'json');
    assert.ok(fs.existsSync(jsonResult.filePath), 'JSON report must exist on disk');
    const parsed = JSON.parse(jsonResult.reportContent);
    assert.equal(parsed.case.id, caseId);
    assert.ok(parsed.hostMetadata.hostname, 'JSON report must record host metadata');
  });

  it('strictly enforces PREVIEW_ONLY and approval gates on response actions', () => {
    const preview = previewResponseAction('isolate-host', '192.168.1.150');
    assert.equal(preview.action, 'isolate-host');
    assert.equal(preview.status, 'PREVIEW_ONLY');
    assert.equal(preview.requiresApproval, true);
    assert.ok(preview.proposedCommand.length > 0, 'Must formulate proposed command');
    assert.ok(preview.expectedImpact.includes('Sever all inbound'), 'Must describe expected network impact');
  });
});
