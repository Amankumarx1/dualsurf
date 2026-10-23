import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RED_TEAM_DOMAINS,
  redChecklistManager,
  engagementStore,
  findingStore,
  purpleTeamStore,
  formatRedTeamDomainList,
  formatRedTeamDomainDetail,
  formatEngagementScope,
  formatPentestFinding,
  formatPentestReport,
  formatPurpleTeamMatrix,
  getRedSpecializationGuide,
  getRedTeamStudyPlan,
  generateCurlPoc,
  formatFindingPoc,
  calculatePurpleTeamScorecard,
  formatPurpleScorecard,
} from '../../apps/cli/dist/tools/redTeam.js';
import { BROWSER_TOOL_DEFINITIONS, executeBrowserTool } from '../../apps/cli/dist/agent/browserTools.js';

describe('Red Team Offensive Operations & Purple Teaming Suite', () => {
  describe('Red Team 32-Domain Roadmap Knowledge Base', () => {
    it('contains all 32 core red teaming and offensive domains', () => {
      assert.strictEqual(RED_TEAM_DOMAINS.length, 32);
      RED_TEAM_DOMAINS.forEach((domain, idx) => {
        assert.strictEqual(domain.id, idx + 1);
        assert.ok(domain.number, `Domain #${domain.id} must have a number`);
        assert.ok(domain.title, `Domain #${domain.id} must have a title`);
        assert.ok(domain.goal, `Domain #${domain.id} must have a goal`);
        assert.ok(Array.isArray(domain.subdomains) && domain.subdomains.length > 0);
        assert.ok(Array.isArray(domain.tools) && domain.tools.length > 0);
        assert.ok(domain.assessmentFocus, `Domain #${domain.id} must have assessmentFocus`);
      });
    });

    it('verifies key domain titles match the complete roadmap', () => {
      assert.strictEqual(RED_TEAM_DOMAINS[0].title, 'Foundations & Ethical Hacking');
      assert.strictEqual(RED_TEAM_DOMAINS[1].title, 'Reconnaissance & Asset Discovery');
      assert.strictEqual(RED_TEAM_DOMAINS[2].title, 'Open-Source Intelligence (OSINT)');
      assert.strictEqual(RED_TEAM_DOMAINS[3].title, 'Network Penetration Testing');
      assert.strictEqual(RED_TEAM_DOMAINS[4].title, 'Web Application Penetration Testing');
      assert.strictEqual(RED_TEAM_DOMAINS[8].title, 'Active Directory Security Assessment');
      assert.strictEqual(RED_TEAM_DOMAINS[13].title, 'Adversary Emulation & MITRE ATT&CK');
      assert.strictEqual(RED_TEAM_DOMAINS[14].title, 'Cloud Penetration Testing');
      assert.strictEqual(RED_TEAM_DOMAINS[20].title, 'Exploit Development Fundamentals');
      assert.strictEqual(RED_TEAM_DOMAINS[27].title, 'Purple Teaming Collaboration');
      assert.strictEqual(RED_TEAM_DOMAINS[28].title, 'Reporting, Risk & Professional Communication');
      assert.strictEqual(RED_TEAM_DOMAINS[31].title, 'Specialized Enterprise Environments (OT / Hybrid)');
    });

    it('formats domain overview list and individual domain syllabus', () => {
      const listOutput = formatRedTeamDomainList();
      assert.ok(listOutput.includes('RED TEAM CYBERSECURITY — COMPLETE DOMAIN ROADMAP'));
      assert.ok(listOutput.includes('Scope · Reconnaissance · Validate · Exploit'));
      assert.ok(listOutput.includes('[01]'));
      assert.ok(listOutput.includes('[32]'));

      const detail1 = formatRedTeamDomainDetail(1);
      assert.ok(detail1.includes('FOUNDATIONS & ETHICAL HACKING'));
      assert.ok(detail1.includes('Core Subdomains & Skills:'));
      assert.ok(detail1.includes('Assessment Focus:'));

      const detailInvalid = formatRedTeamDomainDetail(999);
      assert.ok(detailInvalid.includes('not found'));
    });
  });

  describe('Red Team Master Skills Checklist (25 Skills)', () => {
    it('manages 25 tasks across 5 proficiency tiers with progress tracking', () => {
      redChecklistManager.resetChecklist();
      let stats = redChecklistManager.getStats();
      assert.strictEqual(stats.total, 25);
      assert.strictEqual(stats.completed, 0);
      assert.strictEqual(stats.percentage, 0);

      // Check item #1
      const item1 = redChecklistManager.checkItem(1, 'Reviewed RFC 793 and subnetting rules');
      assert.strictEqual(item1?.completed, true);
      assert.strictEqual(item1?.notes, 'Reviewed RFC 793 and subnetting rules');
      assert.ok(item1?.completedAt);

      // Check item #5
      redChecklistManager.checkItem(5, 'Completed RoE template for lab');
      stats = redChecklistManager.getStats();
      assert.strictEqual(stats.completed, 2);
      assert.strictEqual(stats.percentage, 8);

      // Uncheck item #1
      const unchecked = redChecklistManager.uncheckItem(1);
      assert.strictEqual(unchecked?.completed, false);
      stats = redChecklistManager.getStats();
      assert.strictEqual(stats.completed, 1);

      // Reset
      redChecklistManager.resetChecklist();
      stats = redChecklistManager.getStats();
      assert.strictEqual(stats.completed, 0);
    });

    it('formats a detailed progress report with visual status badges', () => {
      redChecklistManager.resetChecklist();
      redChecklistManager.checkItem(2, 'Linux CLI bash mastery');
      const report = redChecklistManager.formatReport();
      assert.ok(report.includes('RED TEAM MASTER CHECKLIST & PROGRESS TRACKER'));
      assert.ok(report.includes('1/25'));
      assert.ok(report.includes('Linux and Windows command-line'));
    });
  });

  describe('Rules of Engagement (RoE) Scope Authorization', () => {
    it('seeds and verifies authorized vs unauthorized targets', () => {
      const scopes = engagementStore.listScopes();
      assert.ok(scopes.length >= 1);
      const defaultScope = scopes[0];
      assert.ok(defaultScope.id.startsWith('ROE-'));

      // Check in-scope domain
      const check1 = engagementStore.isTargetInScope(defaultScope.id, 'lab.internal');
      assert.strictEqual(check1.inScope, true);

      // Check in-scope subdomain
      const checkSub = engagementStore.isTargetInScope(defaultScope.id, 'api.lab.internal');
      assert.strictEqual(checkSub.inScope, true);

      // Check in-scope IP address
      const checkIp = engagementStore.isTargetInScope(defaultScope.id, '192.168.1.42');
      assert.strictEqual(checkIp.inScope, true);

      // Check out-of-scope external target
      const checkExternal = engagementStore.isTargetInScope(defaultScope.id, 'unauthorized-bank.com');
      assert.strictEqual(checkExternal.inScope, false);
      assert.ok(checkExternal.reason.includes('NOT listed'));
    });

    it('creates new engagement scopes with custom boundaries', () => {
      const newScope = engagementStore.createScope({
        clientName: 'Acme Financial Pentest',
        targetDomains: ['acme.example.corp', 'dev.acme.example.corp'],
        targetIpRanges: ['10.50.0.0/16'],
      });

      assert.ok(newScope.id.startsWith('ROE-'));
      assert.strictEqual(newScope.clientName, 'Acme Financial Pentest');
      assert.strictEqual(newScope.status, 'Approved');

      const checkAllowed = engagementStore.isTargetInScope(newScope.id, 'https://dev.acme.example.corp/login');
      assert.strictEqual(checkAllowed.inScope, true);

      const checkForbidden = engagementStore.isTargetInScope(newScope.id, '192.168.1.1');
      assert.strictEqual(checkForbidden.inScope, false);

      const formatted = formatEngagementScope(newScope);
      assert.ok(formatted.includes('Acme Financial Pentest'));
      assert.ok(formatted.includes('acme.example.corp'));
    });
  });

  describe('Penetration Testing Finding & Risk Store', () => {
    it('creates, lists, and updates pentest findings with CVSS scores', () => {
      const countBefore = findingStore.listFindings().length;

      const finding = findingStore.createFinding({
        title: 'Remote Command Injection in Backup Download Endpoint',
        severity: 'CRITICAL',
        affectedAsset: 'https://staging.lab.internal/backup?file=test',
        description: 'Parameter is passed unescaped to shell execution function.',
        impact: 'Full compromise of the host server filesystem and service accounts.',
        remediation: 'Sanitize input, remove shell call, and enforce strict parameter allowlisting.',
      });

      assert.ok(finding.id.startsWith('FIND-'));
      assert.strictEqual(finding.severity, 'CRITICAL');
      assert.strictEqual(finding.cvssScore, 9.8);
      assert.strictEqual(finding.status, 'Open');

      const all = findingStore.listFindings();
      assert.strictEqual(all.length, countBefore + 1);

      // Update status to Remediated
      const updated = findingStore.updateStatus(finding.id, 'Remediated');
      assert.strictEqual(updated?.status, 'Remediated');

      const single = findingStore.getFinding(finding.id);
      assert.strictEqual(single?.status, 'Remediated');

      const report = formatPentestReport(findingStore.listFindings());
      assert.ok(report.includes('EXECUTIVE PENETRATION TESTING & SECURITY ASSESSMENT'));
      assert.ok(report.includes('Remote Command Injection'));
    });

    it('formats individual finding with remediation guidelines', () => {
      const findings = findingStore.listFindings();
      const first = findings[0];
      const formatted = formatPentestFinding(first);
      assert.ok(formatted.includes(first.id));
      assert.ok(formatted.includes(first.title));
      assert.ok(formatted.includes('CVSS v3.1:'));
      assert.ok(formatted.includes('Recommended Remediation:'));
    });

    it('generates reproducible cURL PoC and CWE verification evidence', () => {
      const testFinding = {
        id: 'FIND-TEST-001',
        title: 'CORS Wildcard with Credentials Allowed',
        severity: 'HIGH',
        cvssScore: 7.5,
        affectedAsset: 'https://api.test.internal/v1/data',
        category: 'CORS Misconfiguration',
        description: 'Access-Control-Allow-Origin is dynamically reflected.',
        impact: 'Unauthorized cross-origin read of sensitive data.',
        remediation: 'Restrict origins to trusted domains.',
        references: ['CWE-942'],
        status: 'Open',
        createdAt: new Date().toISOString(),
      };

      const curl = generateCurlPoc(testFinding);
      assert.ok(curl.includes('curl -i -s -k'));
      assert.ok(curl.includes('Origin: https://untrusted-origin.evil'));

      const pocReport = formatFindingPoc(testFinding);
      assert.ok(pocReport.includes('REPRODUCIBLE PENTEST PoC & EVIDENCE VERIFICATION'));
      assert.ok(pocReport.includes('CWE-942'));
      assert.ok(pocReport.includes('Reproduction Steps:'));
      assert.ok(pocReport.includes('cURL Reproduction Command:'));
    });
  });

  describe('Purple Team Adversary Emulation Matrix', () => {
    it('manages collaborative test cases and updates detection status', () => {
      const tests = purpleTeamStore.listTestCases();
      assert.ok(tests.length >= 4);

      const pt1 = purpleTeamStore.getTestCase('PT-01');
      assert.ok(pt1);
      assert.strictEqual(pt1?.techniqueId, 'T1059.001');

      // Update detection status
      const updated = purpleTeamStore.updateDetectionStatus('PT-02', 'DETECTED', 'Correlation rule enabled for distributed spray');
      assert.strictEqual(updated?.detectionStatus, 'DETECTED');
      assert.strictEqual(updated?.remediationNotes, 'Correlation rule enabled for distributed spray');

      const matrix = formatPurpleTeamMatrix(purpleTeamStore.listTestCases());
      assert.ok(matrix.includes('PURPLE TEAM ADVERSARY EMULATION & DETECTION MATRIX'));
      assert.ok(matrix.includes('T1059.001'));
      assert.ok(matrix.includes('Detection Coverage:'));
    });

    it('calculates automated MITRE ATT&CK detection coverage scorecard and gap recommendations', () => {
      const scorecard = calculatePurpleTeamScorecard();
      assert.ok(scorecard.totalTests >= 4);
      assert.ok(typeof scorecard.detectionCoveragePct === 'number');
      assert.ok(scorecard.detectionCoveragePct >= 0 && scorecard.detectionCoveragePct <= 100);
      assert.ok(scorecard.tacticCoverage['Execution'], 'Must track Execution tactic');
      assert.ok(Array.isArray(scorecard.criticalGaps));

      const formattedScorecard = formatPurpleScorecard(scorecard);
      assert.ok(formattedScorecard.includes('PURPLE TEAM ADVERSARY EMULATION & DETECTION SCORECARD'));
      assert.ok(formattedScorecard.includes('Overall Detection Coverage:'));
      assert.ok(formattedScorecard.includes('MITRE ATT&CK TACTIC COVERAGE:'));
    });
  });

  describe('Offensive Career Pathways & 6-Month Study Plan', () => {
    it('returns tailored specializations for all core red team roles', () => {
      const roles = ['web', 'network', 'ad', 'cloud', 'exploit', 'ai'];
      roles.forEach((r) => {
        const guide = getRedSpecializationGuide(r);
        assert.ok(guide.includes('RED TEAM SPECIALIZATION PATHWAY:'));
        assert.ok(guide.includes('Core Technical Competencies:'));
        assert.ok(guide.includes('Recommended Hands-On Lab Focus:'));
      });

      // Default fallback
      const fallback = getRedSpecializationGuide('unknown');
      assert.ok(fallback.includes('RED TEAM SPECIALIZATION PATHWAY:'));
    });

    it('returns the 6-Month Accelerated Red Team Study Plan', () => {
      const plan = getRedTeamStudyPlan();
      assert.ok(plan.includes('6-MONTH RED TEAM ACCELERATED STUDY PLAN'));
      assert.ok(plan.includes('Month 1'));
      assert.ok(plan.includes('Month 2'));
      assert.ok(plan.includes('Month 3'));
      assert.ok(plan.includes('Month 4'));
      assert.ok(plan.includes('Month 5'));
      assert.ok(plan.includes('Month 6'));
    });
  });

  describe('AI Agent Browser Tools Integration', () => {
    it('registers all Red Team offensive tools in BROWSER_TOOL_DEFINITIONS', () => {
      const toolNames = BROWSER_TOOL_DEFINITIONS.map((t) => t.function.name);
      assert.ok(toolNames.includes('browse_red_team_roadmap'));
      assert.ok(toolNames.includes('manage_red_team_checklist'));
      assert.ok(toolNames.includes('manage_engagement_scope'));
      assert.ok(toolNames.includes('manage_pentest_findings'));
      assert.ok(toolNames.includes('manage_purple_team_tests'));
    });

    it('executes browse_red_team_roadmap via executeBrowserTool', async () => {
      const mockClient = { sendCommand: async () => ({}) };

      // List all
      const listRes = await executeBrowserTool(mockClient, 'browse_red_team_roadmap', {});
      assert.strictEqual(listRes.success, true);
      assert.strictEqual(listRes.data.domainsCount, 32);

      // Domain detail
      const detailRes = await executeBrowserTool(mockClient, 'browse_red_team_roadmap', { domain_id: 5 });
      assert.strictEqual(detailRes.success, true);
      assert.strictEqual(detailRes.data.id, 5);

      // Study plan
      const studyRes = await executeBrowserTool(mockClient, 'browse_red_team_roadmap', { show_study_plan: true });
      assert.strictEqual(studyRes.success, true);
      assert.ok(studyRes.message.includes('6-MONTH RED TEAM ACCELERATED STUDY PLAN'));

      // Specialization
      const specRes = await executeBrowserTool(mockClient, 'browse_red_team_roadmap', { specialization: 'cloud' });
      assert.strictEqual(specRes.success, true);
      assert.ok(specRes.message.includes('Cloud Security Tester'));
    });

    it('executes manage_red_team_checklist via executeBrowserTool', async () => {
      const mockClient = { sendCommand: async () => ({}) };

      // Check item
      const checkRes = await executeBrowserTool(mockClient, 'manage_red_team_checklist', {
        action: 'check',
        item_id: 3,
        notes: 'Python automation test written',
      });
      assert.strictEqual(checkRes.success, true);
      assert.strictEqual(checkRes.data.id, 3);
      assert.strictEqual(checkRes.data.completed, true);

      // Uncheck item
      const uncheckRes = await executeBrowserTool(mockClient, 'manage_red_team_checklist', {
        action: 'uncheck',
        item_id: 3,
      });
      assert.strictEqual(uncheckRes.success, true);
      assert.strictEqual(uncheckRes.data.completed, false);

      // Status
      const statusRes = await executeBrowserTool(mockClient, 'manage_red_team_checklist', { action: 'status' });
      assert.strictEqual(statusRes.success, true);
      assert.ok(statusRes.message.includes('RED TEAM MASTER CHECKLIST & PROGRESS TRACKER'));
    });

    it('executes manage_engagement_scope via executeBrowserTool', async () => {
      const mockClient = { sendCommand: async () => ({}) };

      // List scopes
      const listRes = await executeBrowserTool(mockClient, 'manage_engagement_scope', { action: 'list' });
      assert.strictEqual(listRes.success, true);
      assert.ok(Array.isArray(listRes.data));

      // Check authorized target
      const checkAuth = await executeBrowserTool(mockClient, 'manage_engagement_scope', {
        action: 'check_target',
        target: 'lab.internal',
      });
      assert.strictEqual(checkAuth.success, true);
      assert.strictEqual(checkAuth.data.inScope, true);

      // Check unauthorized target
      const checkUnauth = await executeBrowserTool(mockClient, 'manage_engagement_scope', {
        action: 'check_target',
        target: 'forbidden-site.org',
      });
      assert.strictEqual(checkUnauth.success, false);
      assert.strictEqual(checkUnauth.data.inScope, false);
    });

    it('executes manage_pentest_findings via executeBrowserTool', async () => {
      const mockClient = { sendCommand: async () => ({}) };

      // Create finding
      const createRes = await executeBrowserTool(mockClient, 'manage_pentest_findings', {
        action: 'create',
        title: 'IDOR in Billing Invoices API',
        affected_asset: 'https://api.lab.internal/invoices/100',
        severity: 'HIGH',
      });
      assert.strictEqual(createRes.success, true);
      assert.strictEqual(createRes.data.title, 'IDOR in Billing Invoices API');
      const findingId = createRes.data.id;

      // Update finding status
      const updateRes = await executeBrowserTool(mockClient, 'manage_pentest_findings', {
        action: 'update_status',
        finding_id: findingId,
        status: 'Remediated',
      });
      assert.strictEqual(updateRes.success, true);
      assert.strictEqual(updateRes.data.status, 'Remediated');

      // List findings
      const listRes = await executeBrowserTool(mockClient, 'manage_pentest_findings', { action: 'list' });
      assert.strictEqual(listRes.success, true);
      assert.ok(listRes.message.includes('IDOR in Billing Invoices API'));
    });

    it('executes manage_purple_team_tests via executeBrowserTool', async () => {
      const mockClient = { sendCommand: async () => ({}) };

      // Get test
      const getRes = await executeBrowserTool(mockClient, 'manage_purple_team_tests', {
        action: 'get',
        test_id: 'PT-01',
      });
      assert.strictEqual(getRes.success, true);
      assert.strictEqual(getRes.data.id, 'PT-01');

      // Update detection status
      const updateRes = await executeBrowserTool(mockClient, 'manage_purple_team_tests', {
        action: 'update_status',
        test_id: 'PT-01',
        status: 'DETECTED',
        notes: 'Sysmon Event 1 alerted within 3 seconds',
      });
      assert.strictEqual(updateRes.success, true);
      assert.strictEqual(updateRes.data.detectionStatus, 'DETECTED');

      // List matrix
      const listRes = await executeBrowserTool(mockClient, 'manage_purple_team_tests', { action: 'list' });
      assert.strictEqual(listRes.success, true);
      assert.ok(listRes.message.includes('PURPLE TEAM ADVERSARY EMULATION & DETECTION MATRIX'));
    });
  });
});
