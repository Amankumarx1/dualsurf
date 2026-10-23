import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  defangIoc,
  refangIoc,
  isPrivateIp,
  extractIocs,
  mapToMitreAttack,
  analyzeSecurityLogs,
  computeForensicHash,
  incidentStore,
  runSoarTriagePlaybook,
  formatIocFindings,
  formatSiemReport,
  formatForensicEvidence,
  formatIncidentCase,
  formatSoarTriage,
  BLUE_TEAM_DOMAINS,
  checklistManager,
  generateSigmaRule,
  formatSigmaYaml,
  generateYaraRule,
  huntThreats,
  formatThreatHuntReport,
  getSpecializationGuide,
  formatBlueTeamDomainList,
  formatBlueTeamDomainDetail,
  transpileSigma,
  formatSigmaTranspileReport,
  generateSoarPlaybook,
  formatSoarPlaybook,
  executeBlueTeamTool,
} from '../../apps/cli/dist/tools/blueTeam.js';
import {
  buildCaseTimeline,
  generateBlueTeamReport,
} from '../../apps/cli/dist/tools/blueTelemetry.js';
import { BROWSER_TOOL_DEFINITIONS } from '../../apps/cli/dist/agent/browserTools.js';

describe('Blue Team Defensive Operations Suite (BlueOps)', () => {
  describe('Threat Intelligence & IOC Triage', () => {
    it('defangs and refangs indicators safely', () => {
      const url = 'https://malicious.evil.com/payload.exe';
      const defanged = defangIoc(url);
      assert.strictEqual(defanged, 'hxxps[://]malicious[.]evil[.]com/payload[.]exe');
      const restored = refangIoc(defanged);
      assert.strictEqual(restored, url);
    });

    it('identifies RFC1918 private vs external public IP addresses', () => {
      assert.strictEqual(isPrivateIp('127.0.0.1'), true);
      assert.strictEqual(isPrivateIp('192.168.1.50'), true);
      assert.strictEqual(isPrivateIp('10.10.10.254'), true);
      assert.strictEqual(isPrivateIp('172.16.0.1'), true);
      assert.strictEqual(isPrivateIp('8.8.8.8'), false);
      assert.strictEqual(isPrivateIp('185.220.101.5'), false);
    });

    it('extracts and classifies IOCs from unstructured text', () => {
      const sampleText = `
        Incident report: Host connected to C2 at https://c2.evil-corp.xyz/beacon
        Attacker IP: 185.220.101.5 and internal pivoting to 192.168.1.100
        Downloaded payload hash: d41d8cd98f00b204e9800998ecf8427e (MD5)
        SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        Phishing contact: attacker@phish-domain.com
      `;

      const iocs = extractIocs(sampleText);
      assert.ok(iocs.some((i) => i.type === 'url' && i.defanged.includes('hxxps[://]')));
      assert.ok(iocs.some((i) => i.type === 'ipv4' && i.value === '185.220.101.5' && !i.isPrivate));
      assert.ok(iocs.some((i) => i.type === 'ipv4' && i.value === '192.168.1.100' && i.isPrivate));
      assert.ok(iocs.some((i) => i.type === 'md5' && i.value === 'd41d8cd98f00b204e9800998ecf8427e'));
      assert.ok(iocs.some((i) => i.type === 'sha256'));
      assert.ok(iocs.some((i) => i.type === 'domain' && i.value.includes('evil-corp.xyz')));
      assert.ok(iocs.some((i) => i.type === 'email' && i.value === 'attacker@phish-domain.com'));
    });

    it('formats IOC findings into colorized terminal output', () => {
      const iocs = extractIocs('Connection to 203.0.113.195 and test.malicious.net');
      const output = formatIocFindings(iocs);
      assert.ok(output.includes('EXTRACTED INDICATORS OF COMPROMISE'));
      assert.ok(output.includes('203[.]0[.]113[.]195'));
    });

    it('extracts CVEs, persistence registry keys, staging file paths, and crypto addresses', () => {
      const complexText = `
        Threat Advisory: Exploitation of CVE-2024-3094 observed in the wild.
        Persistence was established via HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Backdoor.
        The payload was staged at C:\\Windows\\Temp\\loader.exe and /tmp/mimikatz.bin.
        Ransom extortion wallet: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa (BTC).
      `;
      const iocs = extractIocs(complexText);

      assert.ok(iocs.some((i) => i.type === 'cve' && i.value === 'CVE-2024-3094'), 'Must extract CVE identifiers');
      assert.ok(iocs.some((i) => i.type === 'registry_key' && i.value.includes('CurrentVersion\\Run')), 'Must extract registry keys');
      assert.ok(iocs.some((i) => i.type === 'file_path' && i.value.includes('Windows\\Temp')), 'Must extract Windows temp paths');
      assert.ok(iocs.some((i) => i.type === 'file_path' && i.value.includes('/tmp/mimikatz.bin')), 'Must extract Linux /tmp paths');
      assert.ok(iocs.some((i) => i.type === 'crypto_wallet' && i.value.startsWith('1A1z')), 'Must extract Bitcoin wallet addresses');

      const formatted = formatIocFindings(iocs);
      assert.ok(formatted.includes('[CVE]'));
      assert.ok(formatted.includes('[REG]'));
      assert.ok(formatted.includes('[PATH]'));
      assert.ok(formatted.includes('[CRYPTO]'));
    });
  });

  describe('MITRE ATT&CK Mapping', () => {
    it('correlates event patterns with MITRE ATT&CK techniques', () => {
      const activity = 'Multiple failed password attempts followed by powershell -enc downloadstring and union select attack';
      const mappings = mapToMitreAttack(activity);

      assert.ok(mappings.some((m) => m.id === 'T1110' && m.technique === 'Brute Force'));
      assert.ok(mappings.some((m) => m.id === 'T1059.001' && m.tactic === 'Execution'));
      assert.ok(mappings.some((m) => m.id === 'T1190' && m.tactic === 'Initial Access'));
    });
  });

  describe('SOC & SIEM Log Analyzer', () => {
    it('detects authentication brute force and web application attacks in logs', () => {
      const logs = [
        'Oct 13 14:00:01 kali sshd[1234]: Failed password for invalid user admin from 192.168.1.200 port 4567 ssh2',
        'Oct 13 14:00:02 kali sshd[1235]: Failed password for invalid user admin from 192.168.1.200 port 4568 ssh2',
        'Oct 13 14:00:15 kali sudo: pam_unix(sudo:auth): authentication failure; logname= user=badactor',
        '185.220.101.5 - - [13/Oct/2026:14:01:00 +0000] "GET /products.php?id=1%20UNION%20SELECT%20null,username,password%20FROM%20users HTTP/1.1" 200 4521',
        '185.220.101.5 - - [13/Oct/2026:14:01:05 +0000] "GET /../../etc/passwd HTTP/1.1" 404 128',
        '185.220.101.5 - - [13/Oct/2026:14:01:10 +0000] "GET /uploads/c99.php HTTP/1.1" 200 15200',
      ].join('\n');

      const report = analyzeSecurityLogs(logs);

      assert.strictEqual(report.totalLinesAnalyzed, 6);
      assert.ok(report.totalAlerts >= 5, 'Should trigger alerts for each attack pattern');
      assert.strictEqual(report.riskRating, 'CRITICAL', 'SQLi and webshell must escalate risk to CRITICAL');
      assert.ok(report.alerts.some((a) => a.ruleId === 'SIGMA-AUTH-BRUTEFORCE'));
      assert.ok(report.alerts.some((a) => a.ruleId === 'SIGMA-WEB-SQLI'));
      assert.ok(report.alerts.some((a) => a.ruleId === 'SIGMA-WEB-TRAVERSAL'));
      assert.ok(report.alerts.some((a) => a.ruleId === 'SIGMA-WEB-WEBSHELL'));
      assert.ok(report.topAttackers.some((a) => a.ip === '185.220.101.5'));
    });

    it('formats SIEM report with threat breakdown', () => {
      const logs = 'Oct 13 14:00:01 kali sshd[1234]: Failed password for root from 10.0.0.5';
      const report = analyzeSecurityLogs(logs);
      const output = formatSiemReport(report);
      assert.ok(output.includes('DUALSURF SOC & SIEM LOG ANALYSIS REPORT'));
      assert.ok(output.includes('Analyzed Events:'));
    });

    it('detects command injection, SSRF cloud metadata, Windows Event IDs, and Suricata NIDS alerts', () => {
      const diverseLogs = [
        '198.51.100.80 - - [18/Oct/2026:10:00:00 +0000] "GET /cgi-bin/test?cmd=;%20whoami HTTP/1.1" 200 120',
        '198.51.100.81 - - [18/Oct/2026:10:01:00 +0000] "GET /proxy?url=http://169.254.169.254/latest/meta-data/ HTTP/1.1" 200 450',
        '2026-10-18T10:02:00 Windows Security EventID: 4625 An account failed to log on. Account Name: targetadmin Source Network Address: 198.51.100.90',
        '2026-10-18T10:03:00 Windows System EventID: 7045 A new service was installed in the system. Service Name: MaliciousSvc',
        '2026-10-18T10:04:00 Windows Security EventID: 1102 The audit log was cleared.',
        '{"timestamp":"2026-10-18T10:05:00.000000+0000","event_type":"alert","src_ip":"198.51.100.99","src_port":4444,"dest_ip":"192.168.1.10","dest_port":80,"alert":{"action":"allowed","gid":1,"signature_id":2024001,"rev":1,"signature":"ET EXPLOIT Apache Struts RCE Detected","category":"Attempted Administrator Privilege Gain","severity":1}}',
      ].join('\n');

      const report = analyzeSecurityLogs(diverseLogs);
      assert.strictEqual(report.totalLinesAnalyzed, 6);
      assert.strictEqual(report.riskRating, 'CRITICAL');

      assert.ok(report.alerts.some((a) => a.ruleId === 'SIGMA-WEB-CMDINJ'), 'Must detect command injection');
      assert.ok(report.alerts.some((a) => a.ruleId === 'SIGMA-WEB-SSRF-METADATA'), 'Must detect SSRF metadata access');
      assert.ok(report.alerts.some((a) => a.ruleId === 'SIGMA-WIN-FAILED-LOGON-4625'), 'Must detect Windows Event 4625');
      assert.ok(report.alerts.some((a) => a.ruleId === 'SIGMA-WIN-SERVICE-INSTALL-7045'), 'Must detect Windows Event 7045');
      assert.ok(report.alerts.some((a) => a.ruleId === 'SIGMA-WIN-LOG-CLEARED-1102'), 'Must detect Windows Event 1102 audit clear');
      assert.ok(report.alerts.some((a) => a.ruleId.startsWith('SURICATA-')), 'Must parse Suricata NIDS EVE JSON alerts');
    });
  });

  describe('Digital Forensics & Cryptographic Evidence', () => {
    it('computes MD5, SHA-1, and SHA-256 hashes of target file', () => {
      const tempPath = path.resolve('./temp-forensics-test.txt');
      fs.writeFileSync(tempPath, 'DualSurf Forensic Evidence Acquisition Sample Data');
      try {
        const evidence = computeForensicHash(tempPath, 'Forensic Examiner 01');
        assert.strictEqual(evidence.fileName, 'temp-forensics-test.txt');
        assert.strictEqual(evidence.sha256.length, 64);
        assert.strictEqual(evidence.sha1.length, 40);
        assert.strictEqual(evidence.md5.length, 32);
        assert.strictEqual(evidence.acquiredBy, 'Forensic Examiner 01');

        const formatted = formatForensicEvidence(evidence);
        assert.ok(formatted.includes('DIGITAL FORENSIC EVIDENCE PRESERVATION'));
        assert.ok(formatted.includes(evidence.sha256));
      } finally {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    });
  });

  describe('Incident Response & Case Management', () => {
    it('creates, lists, and updates incident response cases', () => {
      const c = incidentStore.createCase('Critical Web Application Breach', 'P1-CRITICAL', 'Data Breach', {
        affectedHosts: ['10.10.10.15'],
        affectedUsers: ['admin'],
        iocs: ['185.220.101.5'],
      });

      assert.ok(c.id.startsWith('INC-'));
      assert.strictEqual(c.severity, 'P1-CRITICAL');
      assert.strictEqual(c.status, 'New');
      assert.ok(c.containmentSteps.length > 0);

      const retrieved = incidentStore.getCase(c.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.title, 'Critical Web Application Breach');

      incidentStore.updateCaseStatus(c.id, 'Contained', 'Host isolated from VLAN');
      assert.strictEqual(retrieved.status, 'Contained');

      const formatted = formatIncidentCase(c);
      assert.ok(formatted.includes('INCIDENT RESPONSE CASE'));
      assert.ok(formatted.includes(c.id));
    });

    it('links evidence, reassigns analyst, updates severity, and marks false positive on cases', () => {
      const c = incidentStore.createCase('Suspicious Beaconing Triage', 'P2-HIGH', 'Network Anomaly', {
        affectedHosts: ['10.10.10.20'],
      });

      // Link evidence
      const evId = 'EVD-TEST-999';
      incidentStore.linkEvidence(c.id, evId);
      assert.ok(c.evidenceIds?.includes(evId), 'Case must store linked evidence ID');

      // Update severity
      incidentStore.updateSeverity(c.id, 'P1-CRITICAL', 'Escalated by SOC Lead');
      assert.strictEqual(c.severity, 'P1-CRITICAL');

      // Reassign analyst
      incidentStore.assignAnalyst(c.id, 'Senior Incident Handler');
      assert.strictEqual(c.assignedTo, 'Senior Incident Handler');

      // Mark False Positive
      incidentStore.markFalsePositive(c.id, 'Authorized penetration test activity');
      assert.strictEqual(c.status, 'Resolved');
      assert.strictEqual(c.isFalsePositive, true);
      assert.ok(c.falsePositiveReason?.includes('Authorized penetration test'));

      const formatted = formatIncidentCase(c);
      assert.ok(formatted.includes('FALSE POSITIVE'));
      assert.ok(formatted.includes(evId));
    });

    it('builds case timelines and generates forensic markdown and json reports', () => {
      const c = incidentStore.createCase('DFIR Report Assessment Test', 'P2-HIGH', 'Host Compromise', {
        affectedHosts: ['192.168.1.55'],
        iocs: ['198.51.100.99'],
        mitreTechniques: ['T1059.001'],
      });

      incidentStore.linkEvidence(c.id, 'EVD-SAMPLE-01');
      const timeline = buildCaseTimeline(c.id);
      assert.ok(timeline.length > 0, 'Timeline must contain initialization and note events');

      const mdReport = generateBlueTeamReport(c.id, 'markdown');
      assert.ok(mdReport.filePath.endsWith('.md'));
      assert.ok(mdReport.reportContent.includes('DUALSURF BLUE TEAM INCIDENT INVESTIGATION REPORT'));
      assert.ok(mdReport.reportContent.includes(c.id));

      const jsonReport = generateBlueTeamReport(c.id, 'json');
      assert.ok(jsonReport.filePath.endsWith('.json'));
      const parsed = JSON.parse(jsonReport.reportContent);
      assert.strictEqual(parsed.case.id, c.id);
      assert.ok(Array.isArray(parsed.timeline));
    });

    it('executes real EDR telemetry across services, tasks, network, and processes', async () => {
      const edrOverview = await executeBlueTeamTool('edr', 'all');
      assert.strictEqual(edrOverview.status, 'SUCCESS');
      assert.ok(edrOverview.output.includes('[DualSurf Real Endpoint Detection & Response Telemetry Engine]'));

      const edrProcs = await executeBlueTeamTool('edr', 'procs');
      assert.strictEqual(edrProcs.status, 'SUCCESS');
      assert.ok(edrProcs.output.includes('Active Running Processes'));

      const edrSockets = await executeBlueTeamTool('edr', 'sockets');
      assert.strictEqual(edrSockets.status, 'SUCCESS');
      assert.ok(edrSockets.output.includes('Active Network Socket Listeners'));
    });
  });

  describe('SOAR Automated Triage Playbook', () => {
    it('triages target and generates automated containment recommendations', async () => {
      const target = '198.51.100.44 with payload union select password from users';
      const result = await runSoarTriagePlaybook(target);

      assert.strictEqual(result.priority, 'P1-CRITICAL');
      assert.ok(result.mitreTechniques.some((m) => m.id === 'T1190'));
      assert.ok(result.recommendedContainment.length > 0);

      const formatted = formatSoarTriage(result);
      assert.ok(formatted.includes('SOAR AUTOMATED TRIAGE REPORT'));
      assert.ok(formatted.includes('Triage Priority:'));
    });
  });

  describe('Blue Team 31-Domain Roadmap Knowledge Base', () => {
    it('contains all 31 core defensive cybersecurity domains', () => {
      assert.strictEqual(BLUE_TEAM_DOMAINS.length, 31);
      assert.strictEqual(BLUE_TEAM_DOMAINS[0].title, 'Security Fundamentals');
      assert.strictEqual(BLUE_TEAM_DOMAINS[1].title, 'Security Operations Center (SOC)');
      assert.strictEqual(BLUE_TEAM_DOMAINS[2].title, 'SIEM and Log Management');
      assert.strictEqual(BLUE_TEAM_DOMAINS[7].title, 'Incident Response (IR)');
      assert.strictEqual(BLUE_TEAM_DOMAINS[8].title, 'Digital Forensics (DFIR)');
      assert.strictEqual(BLUE_TEAM_DOMAINS[9].title, 'Detection Engineering');
    });

    it('formats domain list and domain details properly', () => {
      const list = formatBlueTeamDomainList();
      assert.ok(list.includes('BLUE TEAM CYBERSECURITY — COMPLETE DOMAIN ROADMAP'));
      assert.ok(list.includes('[01]') && list.includes('Security Fundamentals'));

      const detail = formatBlueTeamDomainDetail(10);
      assert.ok(detail.includes('DOMAIN 10: DETECTION ENGINEERING'));
      assert.ok(detail.includes('Detection-as-Code'));
    });
  });

  describe('Blue Team Master Skills Checklist (30 Skills)', () => {
    it('tracks, checks, unchecks, and formats 30-skill mastery checklist', () => {
      checklistManager.resetChecklist();
      const initial = checklistManager.getStats();
      assert.strictEqual(initial.total, 30);
      assert.strictEqual(initial.completed, 0);

      const checked = checklistManager.checkItem(1, 'Mastered subnetting in lab');
      assert.strictEqual(checked?.completed, true);
      assert.strictEqual(checked?.notes, 'Mastered subnetting in lab');

      const afterCheck = checklistManager.getStats();
      assert.strictEqual(afterCheck.completed, 1);
      assert.strictEqual(afterCheck.percentage, 3);

      const report = checklistManager.formatReport();
      assert.ok(report.includes('BLUE TEAM MASTER CHECKLIST & PROGRESS TRACKER'));
      assert.ok(report.includes('[✔]') && report.includes('Explain TCP/IP'));

      checklistManager.uncheckItem(1);
      const afterUncheck = checklistManager.getStats();
      assert.strictEqual(afterUncheck.completed, 0);
    });
  });

  describe('Detection Engineering: Sigma & YARA Generation', () => {
    it('generates production Sigma YAML detection rules for attacks', () => {
      const rule = generateSigmaRule('sqli');
      assert.strictEqual(rule.level, 'critical');
      assert.ok(rule.tags.includes('attack.t1190'));

      const yaml = formatSigmaYaml(rule);
      assert.ok(yaml.includes('title: Web Application SQL Injection'));
      assert.ok(yaml.includes('union select'));
      assert.ok(yaml.includes('condition: selection'));
    });

    it('generates defensive YARA signatures for artifact scanning', () => {
      const yara = generateYaraRule('sample_backdoor', ['eval(base64_decode', 'c99.php']);
      assert.ok(yara.includes('rule DualSurf_sample_backdoor'));
      assert.ok(yara.includes('$s1 = "eval(base64_decode"'));
      assert.ok(yara.includes('condition:'));
    });
  });

  describe('Threat Hunting Analytics Engine', () => {
    it('detects automated offensive scanner tools in telemetry', () => {
      const log = '10.0.0.5 - - [13/Oct/2026:15:00:00] "GET /test HTTP/1.1" 200 - "sqlmap/1.6#stable"';
      const findings = huntThreats(log);
      assert.ok(findings.some((f) => f.type === 'RARE_USER_AGENT' && f.evidence.toLowerCase().includes('sqlmap')));
    });

    it('detects anomalous parent-child process execution', () => {
      const telemetry = 'winword.exe spawned powershell.exe -enc aWVY';
      const findings = huntThreats(telemetry);
      assert.ok(findings.some((f) => f.type === 'RARE_PROCESS' && f.severity === 'CRITICAL'));
    });

    it('detects C2 beaconing with low jitter intervals', () => {
      const beaconLogs = [
        '2026-10-13 15:00:00 outbound socket 198.51.100.1',
        '2026-10-13 15:00:30 outbound socket 198.51.100.1',
        '2026-10-13 15:01:00 outbound socket 198.51.100.1',
        '2026-10-13 15:01:30 outbound socket 198.51.100.1',
        '2026-10-13 15:02:00 outbound socket 198.51.100.1',
      ].join('\n');
      const findings = huntThreats(beaconLogs);
      assert.ok(findings.some((f) => f.type === 'BEACONING' && f.mitreTechnique.includes('T1071.001')));

      const formatted = formatThreatHuntReport(findings);
      assert.ok(formatted.includes('PROACTIVE THREAT HUNTING FINDINGS'));
    });
  });

  describe('Career Specialization Pathways', () => {
    it('returns tailored guidance for defensive specializations', () => {
      const socGuide = getSpecializationGuide('soc');
      assert.ok(socGuide.includes('SOC Analyst'));
      assert.ok(socGuide.includes('Microsoft Sentinel'));

      const dfirGuide = getSpecializationGuide('dfir');
      assert.ok(dfirGuide.includes('Digital Forensics'));
      assert.ok(dfirGuide.includes('Volatility 3'));
    });
  });

  describe('Sigma-to-SIEM Query Transpiler', () => {
    it('transpiles Sigma rule into Splunk, Elastic, Sentinel, and CrowdStrike queries', () => {
      const rule = generateSigmaRule('sqli');
      const transpiled = transpileSigma(rule);
      assert.strictEqual(transpiled.ruleId, rule.id);
      assert.ok(transpiled.splunkSpl.includes('sourcetype='), 'Must generate Splunk sourcetype clause');
      assert.ok(transpiled.splunkSpl.includes('cs-uri-query='), 'Must include target selection key');
      assert.ok(transpiled.elasticKql.includes('cs-uri-query:'), 'Must generate Elastic KQL format');
      assert.ok(transpiled.sentinelKql.includes('Syslog') || transpiled.sentinelKql.includes('SecurityEvent'), 'Must target Sentinel table');
      assert.ok(transpiled.sentinelKql.includes('| where'), 'Must contain Sentinel where statement');
      assert.ok(transpiled.crowdstrike.includes('#event_simpleName='), 'Must contain CrowdStrike event name');

      const report = formatSigmaTranspileReport(rule);
      assert.ok(report.includes('SIGMA MULTI-SIEM QUERY TRANSPILER'));
      assert.ok(report.includes('Splunk SPL Query'));
      assert.ok(report.includes('Elasticsearch (KQL)'));
      assert.ok(report.includes('Microsoft Sentinel (KQL)'));
      assert.ok(report.includes('CrowdStrike Falcon'));
    });
  });

  describe('SOAR Automated Containment Playbooks', () => {
    it('generates immediate perimeter drop rules for IP IOCs', () => {
      const playbook = generateSoarPlaybook('block', '198.51.100.25');
      assert.strictEqual(playbook.action, 'block');
      assert.strictEqual(playbook.target, '198.51.100.25');
      assert.ok(playbook.iptablesRule.includes('-s 198.51.100.25 -j DROP'));
      assert.ok(playbook.ufwRule.includes('deny from 198.51.100.25 to any'));
      assert.ok(playbook.windowsFirewallRule.includes('netsh advfirewall firewall add rule'));
      assert.ok(playbook.windowsFirewallRule.includes('action=block'));
      assert.ok(playbook.verificationCommand.includes('iptables -L INPUT'));
      assert.ok(playbook.rollbackCommand.includes('-D INPUT'));

      const formatted = formatSoarPlaybook(playbook);
      assert.ok(formatted.includes('SOAR AUTOMATED CONTAINMENT PLAYBOOK'));
      assert.ok(formatted.includes('Immediate Network Perimeter Drop'));
    });

    it('generates endpoint isolation and DNS sinkhole playbooks', () => {
      const isolate = generateSoarPlaybook('isolate', 'host-alpha');
      assert.strictEqual(isolate.action, 'isolate');
      assert.ok(isolate.iptablesRule.includes('INPUT DROP'));
      assert.ok(isolate.windowsFirewallRule.includes('DualSurf_Emergency_Isolation'));

      const sinkhole = generateSoarPlaybook('sinkhole', 'evil-c2.attacker.xyz');
      assert.strictEqual(sinkhole.action, 'sinkhole');
      assert.ok(sinkhole.dnsSinkholeRule.includes('evil-c2.attacker.xyz'));
      assert.ok(sinkhole.rollbackCommand.includes('sed -i'));
    });
  });

  describe('AI Agent Browser Tools Integration', () => {
    it('registers all Blue Team defensive tools in BROWSER_TOOL_DEFINITIONS', () => {
      const names = BROWSER_TOOL_DEFINITIONS.map((t) => t.function.name);
      assert.ok(names.includes('analyze_security_logs'), 'analyze_security_logs must be registered');
      assert.ok(names.includes('triage_iocs'), 'triage_iocs must be registered');
      assert.ok(names.includes('manage_incident_case'), 'manage_incident_case must be registered');
      assert.ok(names.includes('run_soar_playbook'), 'run_soar_playbook must be registered');
      assert.ok(names.includes('compute_forensic_hash'), 'compute_forensic_hash must be registered');
      assert.ok(names.includes('browse_blue_team_roadmap'), 'browse_blue_team_roadmap must be registered');
      assert.ok(names.includes('manage_blue_team_checklist'), 'manage_blue_team_checklist must be registered');
      assert.ok(names.includes('generate_detection_rule'), 'generate_detection_rule must be registered');
      assert.ok(names.includes('hunt_threats'), 'hunt_threats must be registered');
    });
  });
});
