import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RED_TEAM_7_PILLARS,
  formatRedTeamPillarsList,
  formatRedTeamPillarDetail,
  executeRedTeamTool,
  retestFinding,
  findingStore,
} from '../../apps/cli/dist/tools/redTeam.js';
import {
  auditRedTeamTools,
  formatRedTeamToolsAudit,
} from '../../apps/cli/dist/tools/shellExecutor.js';

test('Red Team 7 Operational Pillars Suite', async (t) => {
  await t.test('defines all 7 core pillars with exact tools and operational scopes', () => {
    assert.equal(RED_TEAM_7_PILLARS.length, 7, 'Must define exactly 7 operational pillars');

    const expectedPillars = [
      { id: 1, title: 'Reconnaissance and OSINT', tools: ['Nmap', 'Amass', 'Subfinder', 'theHarvester', 'Maltego'] },
      { id: 2, title: 'Network and infrastructure penetration testing', tools: ['Nmap', 'Wireshark', 'Metasploit', 'Nessus'] },
      { id: 3, title: 'Web application and API attacks', tools: ['Burp Suite', 'OWASP ZAP', 'Postman', 'Browser developer tools'] },
      { id: 4, title: 'Identity and privilege escalation testing', tools: ['BloodHound', 'Impacket', 'NetExec', 'PowerShell'] },
      { id: 5, title: 'Cloud and container security testing', tools: ['Prowler', 'ScoutSuite', 'Trivy', 'Cloud-provider security tools'] },
      { id: 6, title: 'Adversary simulation and security-control testing', tools: ['MITRE ATT&CK', 'Atomic Red Team', 'Caldera', 'Controlled custom scripts'] },
      { id: 7, title: 'Evidence, reporting and retesting', tools: ['Verified findings', 'Reproduce vulnerabilities', 'Demonstrate business impact safely', 'Recommend fixes', 'Retest after remediation'] },
    ];

    expectedPillars.forEach((expected, idx) => {
      const actual = RED_TEAM_7_PILLARS[idx];
      assert.equal(actual.id, expected.id);
      assert.equal(actual.title, expected.title);
      assert.ok(actual.description && actual.description.length > 20, 'Must have description');
      assert.ok(Array.isArray(actual.tools) && actual.tools.length >= 4, 'Must list associated tools');
      assert.ok(Array.isArray(actual.commandTriggers) && actual.commandTriggers.length >= 1, 'Must have command triggers');
    });
  });

  await t.test('formats 7 pillars list and detailed pillar report', () => {
    const listOutput = formatRedTeamPillarsList();
    assert.ok(listOutput.includes('7 CORE PILLARS OF RED TEAM OPERATIONS'));
    assert.ok(listOutput.includes('Reconnaissance and OSINT'));
    assert.ok(listOutput.includes('Evidence, reporting and retesting'));

    const detailPillar1 = formatRedTeamPillarDetail(1);
    assert.ok(detailPillar1.includes('PILLAR 01: RECONNAISSANCE AND OSINT'));
    assert.ok(detailPillar1.includes('Subfinder'));
    assert.ok(detailPillar1.includes('theHarvester'));

    const detailPillar7 = formatRedTeamPillarDetail(7);
    assert.ok(detailPillar7.includes('PILLAR 07: EVIDENCE, REPORTING AND RETESTING'));
    assert.ok(detailPillar7.includes('retest <target>'));
  });

  await t.test('audits installed host tools across all 7 pillars', () => {
    const audits = auditRedTeamTools();
    assert.equal(audits.length, 7, 'Must audit all 7 pillars');

    const formatted = formatRedTeamToolsAudit(audits);
    assert.ok(formatted.includes('RED TEAM OPERATIONS: 7 CORE PILLARS & TOOL INTEGRATION'));
    assert.ok(formatted.includes('1. Reconnaissance and OSINT'));
    assert.ok(formatted.includes('4. Identity and privilege escalation testing'));
    assert.ok(formatted.includes('5. Cloud and container security testing'));
  });

  await t.test('executes Pillar 1 real OSINT & Subfinder DNS discovery with authentic data', async () => {
    const subfinderResult = await executeRedTeamTool('subfinder', 'google.com');
    assert.equal(subfinderResult.pillarId, 1);
    assert.equal(subfinderResult.tool, 'SUBFINDER');
    assert.equal(subfinderResult.status, 'SUCCESS');
    assert.ok(subfinderResult.output.includes('Target Domain: google.com'));
    assert.ok(subfinderResult.output.includes('Discovered Subdomains'));

    const osintResult = await executeRedTeamTool('osint', '127.0.0.1');
    assert.equal(osintResult.pillarId, 1);
    assert.equal(osintResult.status, 'SUCCESS');
    assert.ok(osintResult.output.includes('Target: 127.0.0.1'));
  });

  await t.test('executes Pillar 2 Nmap socket port auditing with authentic port data', async () => {
    const nmapResult = await executeRedTeamTool('nmap', '127.0.0.1');
    assert.equal(nmapResult.pillarId, 2);
    assert.equal(nmapResult.tool, 'Nmap');
    assert.equal(nmapResult.status, 'SUCCESS');
    assert.ok(nmapResult.output.includes('Target: 127.0.0.1') || nmapResult.output.includes('PORT AUDIT'));
  });

  await t.test('executes Pillar 4 real privilege & identity inspection with authentic host data', async () => {
    const impacketResult = await executeRedTeamTool('impacket');
    assert.equal(impacketResult.pillarId, 4);
    assert.ok(impacketResult.output.includes('Active Principal:'));
    assert.ok(impacketResult.output.includes('Operating System:'));
    assert.equal(impacketResult.status, 'SUCCESS');
  });

  await t.test('executes Pillar 5 Trivy manifest vulnerability scanning with real package data', async () => {
    const trivyResult = await executeRedTeamTool('trivy');
    assert.equal(trivyResult.pillarId, 5);
    assert.equal(trivyResult.tool, 'Trivy');
    assert.ok(trivyResult.output.includes('Trivy Vulnerability & Manifest Audit Engine'));
    assert.ok(trivyResult.output.includes('Advisory Database'));
  });

  await t.test('executes Pillar 6 Adversary Emulation & MITRE ATT&CK testing', async () => {
    const mitreResult = await executeRedTeamTool('mitre');
    assert.equal(mitreResult.pillarId, 6);
    assert.ok(mitreResult.output.includes('MITRE ATT&CK Enterprise Matrix'));
    assert.ok(mitreResult.output.includes('Detection Coverage'));
  });

  await t.test('executes Pillar 7 finding retesting and updates verification status', async () => {
    // Create a finding first
    const finding = findingStore.createFinding({
      title: 'Missing Authorization on Internal Admin Route',
      affectedAsset: 'https://127.0.0.1:65530/admin',
      severity: 'HIGH',
    });

    const retestResult = await retestFinding(finding.id);
    assert.equal(retestResult.findingId, finding.id);
    assert.ok(retestResult.newStatus === 'Retested' || retestResult.newStatus === 'Remediated');
    assert.ok(retestResult.verificationEvidence.length > 10);

    const toolRetest = await executeRedTeamTool('retest', finding.id);
    assert.equal(toolRetest.pillarId, 7);
    assert.ok(toolRetest.output.includes(finding.id));
  });
});
