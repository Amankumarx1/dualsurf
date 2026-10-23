import test from 'node:test';
import assert from 'node:assert/strict';
import {
  engagementStore,
  assessmentStore,
  findingStore,
  generateRedTeamReport,
  executeRedTeamTool,
  formatScopeList,
  formatScopeDetail,
  formatScopeValidation,
  formatAssessmentList,
  formatAssessmentDetail,
} from '../../apps/cli/dist/tools/redTeam.js';
import {
  detectHostRedTeamTools,
  formatRedToolDetectionReport,
  getRedToolInfoGuidance,
  isArgumentSafe,
} from '../../apps/cli/dist/tools/executionEngine.js';

test('DualSurf Red Team Backend Scope & Execution Security Suite', async (t) => {
  await t.test('enforces in-scope exact domain matching and wildcard subdomains', () => {
    const scope = engagementStore.createScope('Enterprise Target Alpha', ['targetcorp.com', 'alpha-sec.io'], ['10.50.0.0/16'], {
      allowSubdomains: true,
      exclusions: ['internal-admin.targetcorp.com'],
      status: 'Active',
    });

    // Valid in-scope domains
    const res1 = engagementStore.validateTargetScope(scope.id, 'targetcorp.com', 'nmap');
    assert.equal(res1.allowed, true, 'Exact domain must be allowed');
    assert.equal(res1.state, 'VERIFIED');

    const res2 = engagementStore.validateTargetScope(scope.id, 'api.targetcorp.com', 'nuclei');
    assert.equal(res2.allowed, true, 'Subdomain must be allowed when allowSubdomains is true');

    const res3 = engagementStore.validateTargetScope(scope.id, 'https://sub.alpha-sec.io/api/v1', 'zap');
    assert.equal(res3.allowed, true, 'URL hostname must be extracted and evaluated');

    // Unrelated out-of-scope domain
    const res4 = engagementStore.validateTargetScope(scope.id, 'malicious-domain.com', 'nmap');
    assert.equal(res4.allowed, false, 'Unrelated domain must be rejected');
    assert.equal(res4.state, 'OUT_OF_SCOPE');
    assert.ok(res4.reason.includes('NOT listed in authorized domains or IP ranges'));
  });

  await t.test('enforces IPv4 CIDR subnet mask matching', () => {
    const scope = engagementStore.createScope('Subnet Target Beta', ['beta.local'], ['192.168.10.0/24'], {
      exclusions: ['192.168.10.1'], // Gateway excluded
      status: 'Active',
    });

    const res1 = engagementStore.validateTargetScope(scope.id, '192.168.10.55', 'nmap');
    assert.equal(res1.allowed, true, 'IP inside /24 subnet must be allowed');

    const res2 = engagementStore.validateTargetScope(scope.id, '192.168.11.55', 'nmap');
    assert.equal(res2.allowed, false, 'IP outside subnet must be rejected');
    assert.equal(res2.state, 'OUT_OF_SCOPE');
  });

  await t.test('prioritizes explicit exclusions over broad ranges and subdomains', () => {
    const scope = engagementStore.createScope('Exclusion Priority Scope', ['corp.com'], ['172.16.0.0/16'], {
      allowSubdomains: true,
      exclusions: ['vault.corp.com', '172.16.0.1'],
      status: 'Active',
    });

    // Excluded domain
    const res1 = engagementStore.validateTargetScope(scope.id, 'vault.corp.com', 'web');
    assert.equal(res1.allowed, false, 'Explicitly excluded domain must be blocked');
    assert.ok(res1.reason.includes('OUT-OF-SCOPE in the scope exclusions list'));

    // Allowed sibling domain
    const res2 = engagementStore.validateTargetScope(scope.id, 'portal.corp.com', 'web');
    assert.equal(res2.allowed, true, 'Non-excluded sibling subdomain must be allowed');

    // Excluded IP
    const res3 = engagementStore.validateTargetScope(scope.id, '172.16.0.1', 'nmap');
    assert.equal(res3.allowed, false, 'Explicitly excluded IP must be blocked');

    // Allowed sibling IP
    const res4 = engagementStore.validateTargetScope(scope.id, '172.16.0.2', 'nmap');
    assert.equal(res4.allowed, true, 'Non-excluded IP in subnet must be allowed');
  });

  await t.test('enforces assessment testing window and expiry', () => {
    const pastScope = engagementStore.createScope('Expired Engagement', ['expired.local'], ['10.0.0.0/24'], {
      status: 'Active',
      testingWindow: {
        start: new Date(Date.now() - 100000).toISOString(),
        end: new Date(Date.now() - 50000).toISOString(), // Expired
      },
    });

    const resExpired = engagementStore.validateTargetScope(pastScope.id, 'expired.local', 'nmap');
    assert.equal(resExpired.allowed, false, 'Expired assessment window must reject execution');
    assert.ok(resExpired.reason.includes('expired'));

    const futureScope = engagementStore.createScope('Future Engagement', ['future.local'], ['10.0.0.0/24'], {
      status: 'Active',
      testingWindow: {
        start: new Date(Date.now() + 50000).toISOString(), // Not started
        end: new Date(Date.now() + 100000).toISOString(),
      },
    });

    const resFuture = engagementStore.validateTargetScope(futureScope.id, 'future.local', 'nmap');
    assert.equal(resFuture.allowed, false, 'Not-yet-started assessment window must reject execution');
    assert.ok(resFuture.reason.includes('has not yet begun'));
  });

  await t.test('rejects execution when scope is in Draft or Suspended status', () => {
    const draftScope = engagementStore.createScope('Draft Scope', ['draft.test'], ['127.0.0.1'], {
      status: 'Draft',
    });

    const resDraft = engagementStore.validateTargetScope(draftScope.id, 'draft.test', 'nmap');
    assert.equal(resDraft.allowed, false, 'Draft scope must reject execution');
    assert.ok(resDraft.reason.includes('must be Active or Approved'));
  });

  await t.test('validates argument safety to prevent shell command injection', () => {
    assert.equal(isArgumentSafe('-p80,443'), true);
    assert.equal(isArgumentSafe('https://target.com/api'), true);
    assert.equal(isArgumentSafe('target; rm -rf /'), false, 'Semicolon must be rejected');
    assert.equal(isArgumentSafe('target && whoami'), false, 'Double ampersand must be rejected');
    assert.equal(isArgumentSafe('target | cat /etc/passwd'), false, 'Pipe must be rejected');
    assert.equal(isArgumentSafe('`whoami`'), false, 'Backticks must be rejected');
    assert.equal(isArgumentSafe('$(id)'), false, 'Dollar parenthesis must be rejected');
  });

  await t.test('truthfully audits host tools and discovers real system state', async () => {
    const tools = await detectHostRedTeamTools();
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length >= 35, 'Must catalog all registered tools');

    const formattedReport = formatRedToolDetectionReport(tools);
    assert.ok(formattedReport.includes('DUALSURF RED TEAM TOOL CENTER & HOST DISCOVERY'));
    assert.ok(formattedReport.includes('Installed'));

    const uninstalledTool = tools.find((t) => !t.installed);
    if (uninstalledTool) {
      assert.equal(uninstalledTool.status, 'NOT_INSTALLED');
      assert.equal(uninstalledTool.executablePath, undefined);
      assert.ok(uninstalledTool.documentationUrl && uninstalledTool.documentationUrl.startsWith('http'));
      assert.equal(uninstalledTool.installed, false);
    }
  });

  await t.test('provides official documentation and install guidance for uninstalled tools', () => {
    const info = getRedToolInfoGuidance('nuclei');
    assert.ok(info.includes('NUCLEI'));
    assert.ok(info.toLowerCase().includes('projectdiscovery'));
    assert.ok(info.includes('https://github.com/projectdiscovery/nuclei'));

    const missingInfo = getRedToolInfoGuidance('non-existent-tool');
    assert.ok(missingInfo.includes('not in the registered Red Team integration catalog'));
  });

  await t.test('creates and retrieves Red Team assessments with RoE linkage', () => {
    const scopes = engagementStore.listScopes();
    const activeScope = scopes[0];

    const assessment = assessmentStore.createAssessment({
      name: 'Q4 External Network Penetration Test',
      organization: 'Acme Financial Inc.',
      scopeId: activeScope.id,
      leadOperator: 'Senior Security Consultant',
      environment: 'Staging',
      status: 'PLANNING',
      objective: 'Assess public-facing perimeter resilience and API authentication controls',
    });

    assert.ok(assessment.id.startsWith('ASSESS-'));
    assert.equal(assessment.organization, 'Acme Financial Inc.');
    assert.equal(assessment.status, 'PLANNING');

    const retrieved = assessmentStore.getAssessment(assessment.id);
    assert.equal(retrieved?.name, 'Q4 External Network Penetration Test');

    const formattedList = formatAssessmentList();
    assert.ok(formattedList.includes('ACTIVE RED TEAM ASSESSMENTS'));
    assert.ok(formattedList.includes(assessment.id));

    const formattedDetail = formatAssessmentDetail(assessment.id);
    assert.ok(formattedDetail.includes('RED TEAM ASSESSMENT:'));
    assert.ok(formattedDetail.includes(activeScope.id));
  });

  await t.test('generates comprehensive evidence-backed reports in Markdown, JSON, and HTML', () => {
    const assessments = assessmentStore.listAssessments();
    const targetId = assessments[0].id;

    // Markdown report
    const mdReport = generateRedTeamReport(targetId, 'markdown');
    assert.ok(mdReport.includes('# DUALSURF RED TEAM PENETRATION TESTING & SECURITY ASSESSMENT REPORT'));
    assert.ok(mdReport.includes('## 1. SCOPE AND AUTHORIZATION BOUNDARIES'));
    assert.ok(mdReport.includes('## 2. EXECUTIVE RISK SUMMARY & SCORECARD'));
    assert.ok(mdReport.includes('## 3. VERIFIED VULNERABILITIES & REPRODUCIBLE PROOF-OF-CONCEPTS'));
    assert.ok(mdReport.includes('## 5. ASSESSMENT LIMITATIONS & NON-DESTRUCTIVE METHODOLOGY DISCLAIMER'));

    // JSON report
    const jsonReport = generateRedTeamReport(targetId, 'json');
    const parsed = JSON.parse(jsonReport);
    assert.ok(parsed.assessment);
    assert.ok(parsed.scope);
    assert.ok(Array.isArray(parsed.findings));
    assert.ok(parsed.riskSummary);

    // HTML report
    const htmlReport = generateRedTeamReport(targetId, 'html');
    assert.ok(htmlReport.includes('<!DOCTYPE html>'));
    assert.ok(htmlReport.includes('<title>DualSurf Red Team Penetration Testing Report</title>'));
    assert.ok(htmlReport.includes('font-family:'));
  });

  await t.test('executes tool scope validation and blocks unauthorized targets at runtime', async () => {
    const result = await executeRedTeamTool('nmap', 'unauthorized-external-bank.com');
    assert.equal(result.status, 'ERROR');
    assert.ok(result.output.includes('DualSurf Backend Scope Manager: OPERATION REJECTED'));
    assert.ok(result.output.includes('OUT_OF_SCOPE'));
  });
});
