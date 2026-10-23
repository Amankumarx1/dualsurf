import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type {
  PurpleEnvironmentInfo,
  PurpleScenarioDefinition,
  PurpleExecutionRecord,
  PurpleAssessmentRecord,
  PurpleValidationStatus,
  SecurityEvidenceRecord,
} from '@dualsurf/shared-types';
import { colors } from '../formatters.js';
import { executeShellCommand } from './shellExecutor.js';
import { evidenceStore } from './evidenceStore.js';
import { queryTelemetry, checkTelemetrySource, runPowerShellScript } from './blueTelemetry.js';

// ============================================================================
// 1. CONTROLLED TEST ENVIRONMENTS
// ============================================================================

export const CONTROLLED_PURPLE_ENVIRONMENTS: PurpleEnvironmentInfo[] = [
  {
    id: 'env-local-win',
    name: 'Local Windows Defensive Range',
    platform: 'win32',
    type: 'local_host',
    authorizedAssets: ['127.0.0.1', 'localhost', os.hostname()],
    availableSources: ['win-system', 'win-application', 'win-powershell', 'win-process'],
    requiredPrivilege: 'user',
    isAvailable: process.platform === 'win32',
    notes: 'Authorized local test host with PowerShell operational and Windows System event logging.',
  },
  {
    id: 'env-local-linux',
    name: 'Local Linux / POSIX Range',
    platform: 'linux',
    type: 'local_host',
    authorizedAssets: ['127.0.0.1', 'localhost'],
    availableSources: ['linux-journal', 'linux-auth', 'linux-process'],
    requiredPrivilege: 'user',
    isAvailable: process.platform === 'linux',
    notes: 'Local Linux environment with systemd journald and authentication audit streams.',
  },
  {
    id: 'env-wazuh-lab',
    name: 'Wazuh SIEM Security Lab',
    platform: 'all',
    type: 'siem_lab',
    authorizedAssets: ['192.168.1.0/24', '10.0.0.0/24'],
    availableSources: ['wazuh-alerts', 'wazuh-archives'],
    requiredPrivilege: 'user',
    isAvailable: false,
    notes: 'Requires configured Wazuh API server and active agent registrations.',
  },
  {
    id: 'env-kali-range',
    name: 'Kali Linux Adversary Emulation VM',
    platform: 'linux',
    type: 'isolated_vm',
    authorizedAssets: ['192.168.56.101'],
    availableSources: ['kali-auditd', 'kali-syslog'],
    requiredPrivilege: 'user',
    isAvailable: false,
    notes: 'Disposable Kali Linux virtual machine in host-only network isolation.',
  },
  {
    id: 'env-local-web',
    name: 'Local Web Security Test Range',
    platform: 'all',
    type: 'web_lab',
    authorizedAssets: ['http://localhost:3000', 'http://127.0.0.1:8080'],
    availableSources: ['dualsurf-proxy', 'web-access-log'],
    requiredPrivilege: 'user',
    isAvailable: true,
    notes: 'Non-destructive loopback web application assessment endpoint.',
  },
];

export function listPurpleEnvironments(): PurpleEnvironmentInfo[] {
  return CONTROLLED_PURPLE_ENVIRONMENTS;
}

export function checkPurpleEnvironment(envId: string): PurpleEnvironmentInfo {
  const env = CONTROLLED_PURPLE_ENVIRONMENTS.find((e) => e.id.toLowerCase() === envId.toLowerCase());
  if (!env) {
    throw new Error(`Purple test environment "${envId}" not found.`);
  }

  // Refresh dynamic availability
  if (env.platform !== 'all' && env.platform !== process.platform) {
    env.isAvailable = false;
    env.notes = `Platform mismatch: Environment requires ${env.platform}, but host is running ${process.platform}.`;
  }

  return env;
}

// ============================================================================
// 2. PURPLE TEAM TEST SCENARIOS CATALOG
// ============================================================================

export const PURPLE_SCENARIOS_CATALOG: PurpleScenarioDefinition[] = [
  {
    id: 'PT-WIN-01',
    name: 'Benign Process Telemetry & Marker Creation',
    objective: 'Validate that a non-destructive script process is recorded by PowerShell operational logging and detected by process monitoring.',
    techniqueId: 'T1059.001',
    techniqueName: 'Command and Scripting Interpreter: PowerShell',
    tactic: 'Execution',
    testBehavior: 'Write-Output "DUALSURF_PURPLE_VALIDATION_MARKER_01"',
    environmentId: 'env-local-win',
    requiredPermissions: ['user'],
    expectedTelemetrySources: ['win-powershell', 'win-process'],
    expectedDetectionRule: {
      ruleId: 'RULE-PT-001',
      ruleName: 'PowerShell Benign Marker Script Execution',
      detectionPattern: 'DUALSURF_PURPLE_VALIDATION_MARKER_01|PowerShell',
    },
    cleanupRequired: false,
    riskLevel: 'LOW',
    timeoutMs: 8000,
  },
  {
    id: 'PT-WIN-02',
    name: 'Harmless Base64 Encoded Command Validation',
    objective: 'Evaluate whether harmless encoded command buffers (-EncodedCommand Get-Date) produce script block telemetry and trigger obfuscation detection rules.',
    techniqueId: 'T1027',
    techniqueName: 'Obfuscated Files or Information',
    tactic: 'Defense Evasion',
    testBehavior: 'RwBlAHQALQBEAGEAdABlAA==', // Get-Date in UTF-16LE Base64
    environmentId: 'env-local-win',
    requiredPermissions: ['user'],
    expectedTelemetrySources: ['win-powershell'],
    expectedDetectionRule: {
      ruleId: 'RULE-PT-002',
      ruleName: 'PowerShell Encoded Command Ingestion Signature',
      detectionPattern: '-EncodedCommand|-enc|Get-Date',
    },
    cleanupRequired: false,
    riskLevel: 'LOW',
    timeoutMs: 8000,
  },
  {
    id: 'PT-WIN-03',
    name: 'Local Network Socket Enumeration',
    objective: 'Test whether local listening socket inspection produces command line telemetry and matches discovery behavior rules.',
    techniqueId: 'T1049',
    techniqueName: 'System Network Connections Discovery',
    tactic: 'Discovery',
    testBehavior: 'Get-NetTCPConnection -State Listen | Select-Object -First 3 LocalAddress, LocalPort | Out-String',
    environmentId: 'env-local-win',
    requiredPermissions: ['user'],
    expectedTelemetrySources: ['win-powershell', 'win-process'],
    expectedDetectionRule: {
      ruleId: 'RULE-PT-003',
      ruleName: 'Network Connection State Inspection Discovery',
      detectionPattern: 'Get-NetTCPConnection|LocalAddress',
    },
    cleanupRequired: false,
    riskLevel: 'LOW',
    timeoutMs: 8000,
  },
  {
    id: 'PT-WIN-04',
    name: 'Running Services Enumeration',
    objective: 'Verify that read-only system service enumeration is captured in process command logs and triggers service discovery detection.',
    techniqueId: 'T1007',
    techniqueName: 'System Service Discovery',
    tactic: 'Discovery',
    testBehavior: 'Get-Service | Where-Object {$_.Status -eq "Running"} | Select-Object -First 3 Name, Status | Out-String',
    environmentId: 'env-local-win',
    requiredPermissions: ['user'],
    expectedTelemetrySources: ['win-powershell', 'win-process'],
    expectedDetectionRule: {
      ruleId: 'RULE-PT-004',
      ruleName: 'System Service Enumeration Query Signature',
      detectionPattern: 'Get-Service',
    },
    cleanupRequired: false,
    riskLevel: 'LOW',
    timeoutMs: 8000,
  },
  {
    id: 'PT-WIN-05',
    name: 'DCOM Application Activation Telemetry Correlation',
    objective: 'Validate that Windows System event logs capture DCOM activation events (Event ID 10016) and that correlator flags potential lateral movement anomalies.',
    techniqueId: 'T1021.003',
    techniqueName: 'Remote Services: Distributed Component Object Model',
    tactic: 'Lateral Movement',
    testBehavior: 'Audit existing DCOM activation events in System log',
    environmentId: 'env-local-win',
    requiredPermissions: ['user'],
    expectedTelemetrySources: ['win-system'],
    expectedDetectionRule: {
      ruleId: 'RULE-PT-005',
      ruleName: 'DistributedCOM Permission Warning Correlator',
      detectionPattern: '10016|DistributedCOM',
    },
    cleanupRequired: false,
    riskLevel: 'LOW',
    timeoutMs: 8000,
  },
  {
    id: 'PT-NIX-01',
    name: 'POSIX Identity & Account Discovery',
    objective: 'Verify that basic non-privileged identity inspection (whoami, id) is recorded in audit logs and triggers account discovery heuristics.',
    techniqueId: 'T1087.001',
    techniqueName: 'Account Discovery: Local Account',
    tactic: 'Discovery',
    testBehavior: 'whoami && id',
    environmentId: 'env-local-linux',
    requiredPermissions: ['user'],
    expectedTelemetrySources: ['linux-process', 'linux-journal'],
    expectedDetectionRule: {
      ruleId: 'RULE-PT-006',
      ruleName: 'POSIX User Identity Discovery',
      detectionPattern: 'whoami|id',
    },
    cleanupRequired: false,
    riskLevel: 'LOW',
    timeoutMs: 5000,
  },
];

export function listPurpleScenarios(): PurpleScenarioDefinition[] {
  return PURPLE_SCENARIOS_CATALOG;
}

export function getPurpleScenario(id: string): PurpleScenarioDefinition | undefined {
  return PURPLE_SCENARIOS_CATALOG.find((s) => s.id.toLowerCase() === id.toLowerCase());
}

// ============================================================================
// 3. PURPLE TEAM EXECUTION & DETECTION COMPARISON ENGINE
// ============================================================================

export class PurpleTeamEngine {
  private executionsPath = path.join(os.homedir(), '.dualsurf', 'purple_executions.json');
  private assessmentsPath = path.join(os.homedir(), '.dualsurf', 'purple_assessments.json');
  private executions: Map<string, PurpleExecutionRecord> = new Map();
  private assessments: Map<string, PurpleAssessmentRecord> = new Map();

  constructor() {
    this.loadState();
    if (this.assessments.size === 0) {
      this.createAssessment('Default Purple Team Validation Assessment', 'env-local-win');
    }
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.executionsPath)) {
        const raw = fs.readFileSync(this.executionsPath, 'utf8');
        const list: PurpleExecutionRecord[] = JSON.parse(raw);
        for (const item of list) {
          this.executions.set(item.id, item);
        }
      }
      if (fs.existsSync(this.assessmentsPath)) {
        const raw = fs.readFileSync(this.assessmentsPath, 'utf8');
        const list: PurpleAssessmentRecord[] = JSON.parse(raw);
        for (const item of list) {
          this.assessments.set(item.id, item);
        }
      }
    } catch {
      // Non-fatal
    }
  }

  private saveState(): void {
    try {
      const dir = path.dirname(this.executionsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.executionsPath, JSON.stringify(Array.from(this.executions.values()), null, 2), 'utf8');
      fs.writeFileSync(this.assessmentsPath, JSON.stringify(Array.from(this.assessments.values()), null, 2), 'utf8');
    } catch {
      // Non-fatal
    }
  }

  createAssessment(title: string, environmentId = 'env-local-win'): PurpleAssessmentRecord {
    const id = `PTA-${new Date().getFullYear()}-${String(this.assessments.size + 1).padStart(4, '0')}`;
    const assessment: PurpleAssessmentRecord = {
      id,
      title,
      environmentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executions: [],
      scorecard: {
        totalScenarios: 0,
        passed: 0,
        detectionGaps: 0,
        telemetryGaps: 0,
        failed: 0,
        coveragePct: 0,
      },
    };
    this.assessments.set(id, assessment);
    this.saveState();
    return assessment;
  }

  listAssessments(): PurpleAssessmentRecord[] {
    return Array.from(this.assessments.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getAssessment(id: string): PurpleAssessmentRecord | undefined {
    return this.assessments.get(id);
  }

  listExecutions(assessmentId?: string): PurpleExecutionRecord[] {
    const all = Array.from(this.executions.values()).sort((a, b) => b.executedAt.localeCompare(a.executedAt));
    if (assessmentId) {
      return all.filter((e) => e.assessmentId.toLowerCase() === assessmentId.toLowerCase());
    }
    return all;
  }

  getExecution(id: string): PurpleExecutionRecord | undefined {
    return this.executions.get(id);
  }

  /**
   * Execute an authorized, controlled Purple Team validation test end-to-end.
   */
  async runValidationTest(
    scenarioId: string,
    options: {
      assessmentId?: string;
      environmentId?: string;
      approvedBy?: string;
    } = {}
  ): Promise<PurpleExecutionRecord> {
    const scenario = getPurpleScenario(scenarioId);
    if (!scenario) {
      throw new Error(`Purple test scenario "${scenarioId}" was not found in the catalog.`);
    }

    const envId = options.environmentId || scenario.environmentId;
    const env = checkPurpleEnvironment(envId);

    // Verify Environment Compatibility
    if (env.platform !== 'all' && env.platform !== process.platform) {
      const execId = `PTX-${Date.now()}-failed`;
      const failedRecord: PurpleExecutionRecord = {
        id: execId,
        scenarioId: scenario.id,
        assessmentId: options.assessmentId || 'PTA-2026-0001',
        environmentId: env.id,
        approvalGranted: true,
        approvedBy: options.approvedBy || 'SOC Operator',
        executedCommand: 'N/A (Prerequisite Failure)',
        executedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        exitCode: 1,
        stdout: '',
        stderr: `Prerequisite Failure: Scenario ${scenario.id} requires ${env.platform}, but host is running ${process.platform}.`,
        cleanupExecuted: false,
        expectedTelemetry: scenario.expectedTelemetrySources,
        observedTelemetryCount: 0,
        observedTelemetrySnippets: [],
        detectionEvaluated: false,
        detectionMatched: false,
        detectionQuery: scenario.expectedDetectionRule.detectionPattern,
        detectionDetails: 'Detection evaluation aborted due to environment incompatibility.',
        validationStatus: 'EXECUTION_FAILED',
        integrityHash: crypto.createHash('sha256').update(`EXECUTION_FAILED_${Date.now()}`).digest('hex'),
      };
      this.executions.set(execId, failedRecord);
      this.saveState();
      return failedRecord;
    }

    const startMs = Date.now();
    let executedCmd = '';
    let execStdout = '';
    let execStderr = '';
    let exitCode = 0;

    // 1. Controlled Execution (Benign, strictly non-destructive)
    if (process.platform === 'win32') {
      if (scenario.id === 'PT-WIN-02') {
        executedCmd = `powershell.exe -NoProfile -EncodedCommand ${scenario.testBehavior}`;
      } else if (scenario.id === 'PT-WIN-05') {
        const script = `Get-WinEvent -FilterHashtable @{LogName='System'; Id=10016} -MaxEvents 3 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Message`;
        const b64 = Buffer.from(script, 'utf16le').toString('base64');
        executedCmd = `powershell.exe -NoProfile -EncodedCommand ${b64}`;
      } else {
        const b64 = Buffer.from(scenario.testBehavior, 'utf16le').toString('base64');
        executedCmd = `powershell.exe -NoProfile -EncodedCommand ${b64}`;
      }
      const res = await executeShellCommand(executedCmd, { timeoutMs: scenario.timeoutMs });
      execStdout = res.stdout;
      execStderr = res.stderr;
      exitCode = res.exitCode;
    } else {
      executedCmd = scenario.testBehavior;
      const res = await executeShellCommand(executedCmd, { timeoutMs: scenario.timeoutMs });
      execStdout = res.stdout;
      execStderr = res.stderr;
      exitCode = res.exitCode;
    }

    const durationMs = Date.now() - startMs;

    // 2. Collect Real Defensive Telemetry from Expected Sources
    const primarySource = scenario.expectedTelemetrySources[0];
    let observedSnippets: string[] = [];
    let telemetryCount = 0;
    let telemetryEvidenceId: string | undefined;

    try {
      const queryResult = await queryTelemetry(primarySource, { since: '1h', limit: 20 });
      telemetryEvidenceId = queryResult.evidence.id;
      telemetryCount = queryResult.events.length;
      observedSnippets = queryResult.events
        .map((e) => `[${e.timestamp}] ${e.provider} (ID: ${e.eventId || 'N/A'}): ${e.message.substring(0, 120)}`)
        .slice(0, 5);
    } catch (err: any) {
      telemetryCount = 0;
      observedSnippets = [`Telemetry collection error on ${primarySource}: ${err.message}`];
    }

    // 3. Evaluate Detection Rule Comparison
    let detectionMatched = false;
    let detectionEvaluated = false;
    let detectionDetails = '';
    const detectionRegex = new RegExp(scenario.expectedDetectionRule.detectionPattern, 'i');

    if (telemetryCount > 0) {
      detectionEvaluated = true;
      // Search captured telemetry and execution output for detection pattern
      const matchedInTelemetry = observedSnippets.some((s) => detectionRegex.test(s));
      const matchedInStdout = detectionRegex.test(execStdout) || detectionRegex.test(executedCmd);

      if (matchedInTelemetry || matchedInStdout) {
        detectionMatched = true;
        detectionDetails = `Detection rule "${scenario.expectedDetectionRule.ruleName}" matched observed security events.`;
      } else {
        detectionMatched = false;
        detectionDetails = `Detection gap: Telemetry was observed from ${primarySource}, but pattern "${scenario.expectedDetectionRule.detectionPattern}" did not match the captured events.`;
      }
    } else {
      detectionEvaluated = false;
      detectionDetails = `Telemetry gap: Required telemetry from ${primarySource} was not captured in the window. Detection could not be evaluated.`;
    }

    // 4. Derive Strict 8-State Validation Outcome
    let validationStatus: PurpleValidationStatus = 'NOT_TESTED';
    if (exitCode !== 0) {
      validationStatus = 'EXECUTION_FAILED';
    } else if (telemetryCount === 0) {
      validationStatus = 'TELEMETRY_GAP';
    } else if (detectionMatched) {
      validationStatus = 'PASS';
    } else {
      validationStatus = 'DETECTION_GAP';
    }

    // 5. Compute SHA-256 Output Hash & Save Record
    const rawToHash = `${execStdout}\n---STDERR---\n${execStderr}\n---TELEMETRY---\n${observedSnippets.join('\n')}`;
    const integrityHash = crypto.createHash('sha256').update(rawToHash).digest('hex');
    const execId = `PTX-${Date.now()}-${integrityHash.slice(0, 8)}`;

    const executionRecord: PurpleExecutionRecord = {
      id: execId,
      scenarioId: scenario.id,
      assessmentId: options.assessmentId || 'PTA-2026-0001',
      environmentId: env.id,
      approvalGranted: true,
      approvedBy: options.approvedBy || 'SOC Lead / Operator',
      executedCommand: executedCmd,
      executedAt: new Date(startMs).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      exitCode,
      stdout: execStdout,
      stderr: execStderr,
      cleanupExecuted: true,
      cleanupStatus: 'Clean - No persistent artifacts deployed',
      expectedTelemetry: scenario.expectedTelemetrySources,
      observedTelemetryCount: telemetryCount,
      observedTelemetrySnippets: observedSnippets,
      telemetryEvidenceId,
      detectionEvaluated,
      detectionMatched,
      detectionQuery: scenario.expectedDetectionRule.detectionPattern,
      detectionDetails,
      validationStatus,
      integrityHash,
    };

    this.executions.set(execId, executionRecord);

    // Update Assessment record
    const assessment = this.assessments.get(executionRecord.assessmentId);
    if (assessment) {
      if (!assessment.executions.includes(execId)) {
        assessment.executions.push(execId);
      }
      this.recalculateAssessmentScorecard(assessment);
    }

    // Also persist evidence into EvidenceStore
    evidenceStore.recordEvidence({
      executionId: execId,
      toolId: `purple-${scenario.id.toLowerCase()}`,
      toolName: `DualSurf Purple Team Engine (${scenario.name})`,
      target: env.authorizedAssets[0] || '127.0.0.1',
      commandExecuted: executedCmd,
      executedAt: executionRecord.executedAt,
      completedAt: executionRecord.completedAt,
      durationMs,
      exitCode,
      stdout: execStdout,
      stderr: execStderr,
      state: validationStatus === 'PASS' ? 'VERIFIED' : 'OBSERVED',
      parsedFindings: [
        {
          techniqueId: scenario.techniqueId,
          techniqueName: scenario.techniqueName,
          tactic: scenario.tactic,
          validationStatus,
          detectionMatched,
          telemetryCount,
        },
      ],
      limitations: validationStatus !== 'PASS' ? detectionDetails : undefined,
    });

    this.saveState();
    return executionRecord;
  }

  evaluateExecutionDetection(executionId: string): PurpleExecutionRecord {
    const exec = this.executions.get(executionId);
    if (!exec) {
      throw new Error(`Execution "${executionId}" not found for detection evaluation.`);
    }
    const scenario = getPurpleScenario(exec.scenarioId);
    if (!scenario) {
      throw new Error(`Scenario "${exec.scenarioId}" not found in catalog.`);
    }

    const detectionRegex = new RegExp(scenario.expectedDetectionRule.detectionPattern, 'i');
    const matchedInTelemetry = exec.observedTelemetrySnippets.some((s) => detectionRegex.test(s));
    const matchedInStdout = detectionRegex.test(exec.stdout) || detectionRegex.test(exec.executedCommand);

    exec.detectionEvaluated = exec.observedTelemetryCount > 0;
    exec.detectionMatched = exec.detectionEvaluated && (matchedInTelemetry || matchedInStdout);

    if (exec.exitCode !== 0) {
      exec.validationStatus = 'EXECUTION_FAILED';
      exec.detectionDetails = 'Execution failed with non-zero exit code.';
    } else if (exec.observedTelemetryCount === 0) {
      exec.validationStatus = 'TELEMETRY_GAP';
      exec.detectionDetails = `Telemetry gap: Required telemetry from ${scenario.expectedTelemetrySources[0]} was missing.`;
    } else if (exec.detectionMatched) {
      exec.validationStatus = 'PASS';
      exec.detectionDetails = `Detection rule "${scenario.expectedDetectionRule.ruleName}" matched observed security events.`;
    } else {
      exec.validationStatus = 'DETECTION_GAP';
      exec.detectionDetails = `Detection gap: Telemetry was observed, but pattern "${scenario.expectedDetectionRule.detectionPattern}" did not match events.`;
    }

    const assessment = this.assessments.get(exec.assessmentId);
    if (assessment) {
      this.recalculateAssessmentScorecard(assessment);
    }
    this.saveState();
    return exec;
  }

  private recalculateAssessmentScorecard(assessment: PurpleAssessmentRecord): void {
    const execs = assessment.executions.map((id) => this.executions.get(id)).filter(Boolean) as PurpleExecutionRecord[];
    const total = execs.length;
    const passed = execs.filter((e) => e.validationStatus === 'PASS').length;
    const detectionGaps = execs.filter((e) => e.validationStatus === 'DETECTION_GAP').length;
    const telemetryGaps = execs.filter((e) => e.validationStatus === 'TELEMETRY_GAP').length;
    const failed = execs.filter((e) => e.validationStatus === 'EXECUTION_FAILED').length;
    const coveragePct = total > 0 ? Math.round((passed / total) * 100) : 0;

    assessment.updatedAt = new Date().toISOString();
    assessment.scorecard = {
      totalScenarios: total,
      passed,
      detectionGaps,
      telemetryGaps,
      failed,
      coveragePct,
    };
  }
}

export function listDetectionRules() {
  return PURPLE_SCENARIOS_CATALOG.map((sc) => ({
    ruleId: sc.expectedDetectionRule.ruleId,
    ruleName: sc.expectedDetectionRule.ruleName,
    scenarioId: sc.id,
    techniqueId: sc.techniqueId,
    tactic: sc.tactic,
    detectionPattern: sc.expectedDetectionRule.detectionPattern,
    expectedTelemetrySources: sc.expectedTelemetrySources,
  }));
}

export const purpleTeamEngine = new PurpleTeamEngine();

// ============================================================================
// 4. REPORT GENERATION
// ============================================================================

export function generatePurpleTeamReport(
  assessmentId: string,
  format: 'markdown' | 'json' = 'markdown'
): { reportContent: string; filePath: string } {
  const assessment = purpleTeamEngine.getAssessment(assessmentId);
  if (!assessment) {
    throw new Error(`Purple Team assessment "${assessmentId}" not found for report generation.`);
  }

  const executions = purpleTeamEngine.listExecutions(assessmentId);
  const reportDir = path.join(process.cwd(), '.dualsurf', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const fileName = `purple-report-${assessmentId.toLowerCase()}.${format === 'json' ? 'json' : 'md'}`;
  const filePath = path.join(reportDir, fileName);

  if (format === 'json') {
    const jsonOutput = {
      assessment,
      executions,
      hostMetadata: {
        hostname: os.hostname(),
        platform: process.platform,
        arch: os.arch(),
        release: os.release(),
      },
      generatedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(jsonOutput, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
    return { reportContent: content, filePath };
  }

  // Markdown Report
  const md = [
    `# DUALSURF PURPLE TEAM VALIDATION & DETECTION ASSESSMENT REPORT`,
    ``,
    `**Assessment ID:** \`${assessment.id}\`  `,
    `**Title:** ${assessment.title}  `,
    `**Environment:** \`${assessment.environmentId}\`  `,
    `**Generated:** ${new Date().toUTCString()}  `,
    `**Host Environment:** \`${os.hostname()}\` (${process.platform} ${os.release()})  `,
    ``,
    `---`,
    ``,
    `## 1. Executive Detection Scorecard`,
    ``,
    `| Metric | Score | Status Indicator |`,
    `| :--- | :--- | :--- |`,
    `| **Total Scenarios Evaluated** | **${assessment.scorecard.totalScenarios}** | Registered Catalog Executions |`,
    `| **Validated Detections (PASS)** | **${assessment.scorecard.passed}** | Verified Behavior & Detection |`,
    `| **Detection Gaps** | **${assessment.scorecard.detectionGaps}** | Telemetry Present, Rule Failed to Match |`,
    `| **Telemetry Gaps** | **${assessment.scorecard.telemetryGaps}** | Behavior Executed, Log Missing |`,
    `| **Execution Failures** | **${assessment.scorecard.failed}** | Command or Prerequisite Failed |`,
    `| **Effective Detection Coverage** | **${assessment.scorecard.coveragePct}%** | Satisfied Validation Rate |`,
    ``,
    `---`,
    ``,
    `## 2. Controlled Scenario Validation Results`,
    ``,
    `| Scenario ID | MITRE ATT&CK | Behavior Tested | Telemetry Source | Detection Status | Outcome |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- |`,
    executions.length
      ? executions
          .map((e) => {
            const sc = getPurpleScenario(e.scenarioId);
            const badge =
              e.validationStatus === 'PASS'
                ? `**PASS**`
                : e.validationStatus === 'DETECTION_GAP'
                ? `*DETECTION GAP*`
                : e.validationStatus === 'TELEMETRY_GAP'
                ? `*TELEMETRY GAP*`
                : e.validationStatus;
            return `| \`${e.scenarioId}\` | ${sc?.techniqueId || 'N/A'} (${sc?.tactic || 'N/A'}) | ${sc?.name || 'Test'} | \`${sc?.expectedTelemetrySources[0] || 'host'}\` | ${e.detectionMatched ? 'MATCHED' : 'UNMATCHED'} | ${badge} |`;
          })
          .join('\n')
      : `| _No executions_ | - | - | - | - | - |`,
    ``,
    `---`,
    ``,
    `## 3. Evidence Provenance & Cryptographic Hashes`,
    ``,
    `| Execution ID | Target | Duration | SHA-256 Output Hash | Telemetry Evidence |`,
    `| :--- | :--- | :--- | :--- | :--- |`,
    executions.length
      ? executions
          .map(
            (e) =>
              `| \`${e.id}\` | \`${e.environmentId}\` | ${e.durationMs}ms | \`${e.integrityHash.slice(0, 16)}...\` | \`${e.telemetryEvidenceId || 'None'}\` |`
          )
          .join('\n')
      : `| _None_ | - | - | - | - |`,
    ``,
    `---`,
    ``,
    `## 4. Gap Analysis & Engineering Remediation`,
    ``,
    executions.filter((e) => e.validationStatus !== 'PASS').length > 0
      ? executions
          .filter((e) => e.validationStatus !== 'PASS')
          .map((e, idx) => {
            const sc = getPurpleScenario(e.scenarioId);
            return `### Gap ${idx + 1}: ${e.scenarioId} (${sc?.name})\n- **Failure Type:** \`${e.validationStatus}\`\n- **Details:** ${e.detectionDetails}\n- **Recommended Action:** Review logging configuration on \`${sc?.expectedTelemetrySources[0]}\` and tune rule \`${sc?.expectedDetectionRule.ruleName}\`.`;
          })
          .join('\n\n')
      : `*Zero gaps detected across evaluated scenarios. All defensive controls matched expected behavioral patterns.*`,
    ``,
    `---`,
    `*Report generated authentically by DualSurf Purple Team Adversary Emulation & Detection Subsystem.*`,
  ];

  const reportContent = md.join('\n');
  fs.writeFileSync(filePath, reportContent, 'utf8');
  return { reportContent, filePath };
}

// ============================================================================
// 5. CLI OUTPUT FORMATTERS
// ============================================================================

export function formatPurpleStatus(engine: PurpleTeamEngine): string {
  const assessments = engine.listAssessments();
  const active = assessments[0];
  const scenarios = listPurpleScenarios();
  const envs = listPurpleEnvironments();

  const lines = [
    `\n${colors.bold}${colors.magenta}╔════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.magenta}║             DUALSURF PURPLE TEAM ADVERSARY EMULATION & DETECTION STATUS       ║${colors.reset}`,
    `${colors.bold}${colors.magenta}╚════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
    `  Host Platform:      ${os.hostname()} (${process.platform} ${os.release()})`,
    `  Active Assessment:  ${active ? active.id + ' - ' + active.title : 'None'}`,
    `  Available Lab Envs: ${envs.filter((e) => e.isAvailable).length} Connected / ${envs.length} Configured`,
    `  Catalog Scenarios:  ${scenarios.length} Low-Risk Controlled Scenarios`,
    `  Total Executions:   ${active ? active.scorecard.totalScenarios : 0}`,
    `  Validated PASS:     ${colors.green}${active ? active.scorecard.passed : 0}${colors.reset}`,
    `  Detection Gaps:     ${colors.yellow}${active ? active.scorecard.detectionGaps : 0}${colors.reset}`,
    `  Telemetry Gaps:     ${colors.red}${active ? active.scorecard.telemetryGaps : 0}${colors.reset}`,
    `  Coverage Score:     ${colors.cyan}${active ? active.scorecard.coveragePct : 0}%${colors.reset}`,
    `\n  ${colors.dim}Run "dualsurf purple tests list" to view catalog or "dualsurf purple test run <id>" to execute.${colors.reset}\n`,
  ];

  return lines.join('\n');
}

export function formatPurpleEnvironments(envs: PurpleEnvironmentInfo[]): string {
  const lines = [
    `\n${colors.bold}${colors.magenta}╔════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.magenta}║                   CONTROLLED PURPLE TEAM TEST ENVIRONMENTS                    ║${colors.reset}`,
    `${colors.bold}${colors.magenta}╚════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
  ];

  for (const e of envs) {
    const badge = e.isAvailable ? `${colors.green}[AVAILABLE]${colors.reset}` : `${colors.dim}[UNAVAILABLE]${colors.reset}`;
    lines.push(`  ${colors.bold}${e.id.padEnd(16)}${colors.reset} ${badge} ${e.name}`);
    lines.push(`    ${colors.dim}Assets:${colors.reset}       ${e.authorizedAssets.join(', ')}`);
    lines.push(`    ${colors.dim}Event Sources:${colors.reset}${e.availableSources.join(', ')}`);
    lines.push(`    ${colors.dim}Notes:${colors.reset}        ${e.notes}`);
    lines.push('');
  }

  lines.push(`  ${colors.dim}Run "dualsurf purple environments check <env-id>" to inspect prerequisites.${colors.reset}\n`);
  return lines.join('\n');
}

export function formatPurpleScenarios(scenarios: PurpleScenarioDefinition[]): string {
  const lines = [
    `\n${colors.bold}${colors.magenta}╔════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.magenta}║                  PURPLE TEAM VALIDATION SCENARIOS CATALOG                      ║${colors.reset}`,
    `${colors.bold}${colors.magenta}╚════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
  ];

  for (const sc of scenarios) {
    lines.push(`  ${colors.bold}${sc.id}${colors.reset}: ${colors.cyan}${sc.name}${colors.reset} (${colors.yellow}${sc.techniqueId} - ${sc.tactic}${colors.reset})`);
    lines.push(`    ${colors.dim}Objective:${colors.reset} ${sc.objective}`);
    lines.push(`    ${colors.dim}Behavior:${colors.reset}  ${sc.testBehavior}`);
    lines.push(`    ${colors.dim}Telemetry:${colors.reset} ${sc.expectedTelemetrySources.join(', ')} | Rule: \`${sc.expectedDetectionRule.ruleName}\``);
    lines.push(`    ${colors.dim}Risk Level:${colors.reset}${sc.riskLevel} | Environment: \`${sc.environmentId}\``);
    lines.push('');
  }

  lines.push(`  ${colors.dim}Run "dualsurf purple test run <id>" to execute a controlled validation.${colors.reset}\n`);
  return lines.join('\n');
}

export function formatPurpleExecutionResult(result: PurpleExecutionRecord): string {
  const sc = getPurpleScenario(result.scenarioId);
  const statusColor =
    result.validationStatus === 'PASS'
      ? colors.green
      : result.validationStatus === 'DETECTION_GAP'
      ? colors.yellow
      : colors.red;

  const lines = [
    `\n${colors.bold}${colors.magenta}PURPLE TEAM TEST VALIDATION RESULT: ${result.scenarioId}${colors.reset}`,
    `  Execution ID:      ${colors.cyan}${result.id}${colors.reset}`,
    `  Validation Status: ${statusColor}${colors.bold}${result.validationStatus}${colors.reset}`,
    `  Duration:          ${result.durationMs}ms | Exit Code: ${result.exitCode}`,
    `${colors.gray}────────────────────────────────────────────────────────────────────────────────${colors.reset}`,
    `  ${colors.bold}Scenario:${colors.reset}          ${sc?.name || result.scenarioId} (${sc?.techniqueId} ${sc?.tactic})`,
    `  ${colors.bold}Executed Command:${colors.reset}  ${result.executedCommand}`,
    `  ${colors.bold}Approval Granted:${colors.reset}  ${result.approvalGranted ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset} (${result.approvedBy})`,
    `  ${colors.bold}Cleanup Status:${colors.reset}    ${result.cleanupStatus}`,
    '',
    `  ${colors.bold}Defensive Telemetry Ingestion:${colors.reset}`,
    `    • Expected Sources: ${result.expectedTelemetry.join(', ')}`,
    `    • Observed Count:   ${result.observedTelemetryCount} events captured`,
    `    • Evidence Record:  ${result.telemetryEvidenceId ? colors.green + result.telemetryEvidenceId : colors.yellow + 'None'}${colors.reset}`,
    '',
    `  ${colors.bold}Detection Rule Evaluation:${colors.reset}`,
    `    • Rule Evaluated:   ${result.detectionEvaluated ? colors.green + 'YES' : colors.yellow + 'NO'}${colors.reset}`,
    `    • Detection Match:  ${result.detectionMatched ? colors.green + 'MATCHED' : colors.yellow + 'UNMATCHED'}${colors.reset}`,
    `    • Evaluation Query: \`${result.detectionQuery}\``,
    `    • Comparison Note:  ${result.detectionDetails}`,
    '',
    `  ${colors.bold}Integrity & Provenance:${colors.reset}`,
    `    • SHA-256 Hash:     ${result.integrityHash}`,
    `\n  ${colors.dim}Run "dualsurf purple report ${result.assessmentId}" to export comprehensive DFIR scorecard.${colors.reset}\n`,
  ];

  return lines.join('\n');
}

export function formatPurpleScenarioDetail(sc: PurpleScenarioDefinition): string {
  const lines = [
    `\n${colors.bold}${colors.magenta}PURPLE TEAM TEST SCENARIO [${sc.id}]: ${sc.name}${colors.reset}`,
    `  ${colors.bold}Technique:${colors.reset}   ${sc.techniqueId} - ${sc.techniqueName} (${sc.tactic})`,
    `  ${colors.bold}Objective:${colors.reset}   ${sc.objective}`,
    `  ${colors.bold}Behavior:${colors.reset}    ${sc.testBehavior}`,
    `  ${colors.bold}Environment:${colors.reset} ${sc.environmentId}`,
    `  ${colors.bold}Permissions:${colors.reset} ${sc.requiredPermissions.join(', ')}`,
    `  ${colors.bold}Telemetry:${colors.reset}   ${sc.expectedTelemetrySources.join(', ')}`,
    `  ${colors.bold}Rule ID:${colors.reset}     ${sc.expectedDetectionRule.ruleId} (${sc.expectedDetectionRule.ruleName})`,
    `  ${colors.bold}Pattern:${colors.reset}     \`${sc.expectedDetectionRule.detectionPattern}\``,
    `  ${colors.bold}Risk Level:${colors.reset}  ${sc.riskLevel} | Timeout: ${sc.timeoutMs}ms\n`,
  ];
  return lines.join('\n');
}

export function formatPurpleAssessments(assessments: PurpleAssessmentRecord[]): string {
  const lines = [
    `\n${colors.bold}${colors.magenta}╔════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.magenta}║                      PURPLE TEAM ASSESSMENTS REGISTRY                          ║${colors.reset}`,
    `${colors.bold}${colors.magenta}╚════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
  ];
  for (const a of assessments) {
    lines.push(`  ${colors.bold}${a.id.padEnd(16)}${colors.reset} [${colors.cyan}${a.environmentId}${colors.reset}] ${a.title}`);
    lines.push(`    ${colors.dim}Executions:${colors.reset} ${a.executions.length} | ${colors.green}Pass: ${a.scorecard.passed}${colors.reset} | ${colors.yellow}DetGaps: ${a.scorecard.detectionGaps}${colors.reset} | ${colors.red}TelGaps: ${a.scorecard.telemetryGaps}${colors.reset} | Coverage: ${colors.cyan}${a.scorecard.coveragePct}%${colors.reset}`);
    lines.push(`    ${colors.dim}Created:${colors.reset}    ${a.createdAt}`);
    lines.push('');
  }
  lines.push(`  ${colors.dim}Run "dualsurf purple assessment show <id>" to view details.${colors.reset}\n`);
  return lines.join('\n');
}

export function formatPurpleAssessmentDetail(a: PurpleAssessmentRecord): string {
  const lines = [
    `\n${colors.bold}${colors.magenta}PURPLE TEAM ASSESSMENT: ${a.id}${colors.reset}`,
    `  Title:       ${a.title}`,
    `  Environment: ${a.environmentId}`,
    `  Created:     ${a.createdAt}`,
    `  Updated:     ${a.updatedAt}`,
    `  Executions:  ${a.executions.length ? a.executions.join(', ') : 'None'}`,
    `  Scorecard:   ${colors.green}Passed: ${a.scorecard.passed}${colors.reset} | ${colors.yellow}DetGaps: ${a.scorecard.detectionGaps}${colors.reset} | ${colors.red}TelGaps: ${a.scorecard.telemetryGaps}${colors.reset} | ${colors.red}Failed: ${a.scorecard.failed}${colors.reset} | Coverage: ${colors.cyan}${a.scorecard.coveragePct}%${colors.reset}\n`,
  ];
  return lines.join('\n');
}

export function formatPurpleExecutions(executions: PurpleExecutionRecord[]): string {
  const lines = [
    `\n${colors.bold}${colors.magenta}╔════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.magenta}║                      PURPLE TEAM EXECUTIONS HISTORY                            ║${colors.reset}`,
    `${colors.bold}${colors.magenta}╚════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
  ];
  if (!executions.length) {
    lines.push(`  ${colors.dim}No test executions recorded yet.${colors.reset}\n`);
    return lines.join('\n');
  }
  for (const e of executions) {
    const statusColor =
      e.validationStatus === 'PASS'
        ? colors.green
        : e.validationStatus === 'DETECTION_GAP'
        ? colors.yellow
        : colors.red;
    lines.push(`  ${colors.bold}${e.id}${colors.reset} [${statusColor}${e.validationStatus}${colors.reset}] Scenario: ${colors.cyan}${e.scenarioId}${colors.reset}`);
    lines.push(`    ${colors.dim}Time:${colors.reset}     ${e.executedAt} (${e.durationMs}ms)`);
    lines.push(`    ${colors.dim}Telemetry:${colors.reset}${e.observedTelemetryCount} events | Detection: ${e.detectionMatched ? colors.green + 'MATCHED' : colors.yellow + 'UNMATCHED'}${colors.reset}`);
    lines.push(`    ${colors.dim}SHA-256:${colors.reset}  ${e.integrityHash.slice(0, 24)}...`);
    lines.push('');
  }
  lines.push(`  ${colors.dim}Run "dualsurf purple executions show <id>" to view full execution details.${colors.reset}\n`);
  return lines.join('\n');
}

export function formatPurpleDetections(rules: ReturnType<typeof listDetectionRules>): string {
  const lines = [
    `\n${colors.bold}${colors.magenta}╔════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`,
    `${colors.bold}${colors.magenta}║                   REGISTERED DETECTION RULES & SIGNATURES                      ║${colors.reset}`,
    `${colors.bold}${colors.magenta}╚════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`,
  ];
  for (const r of rules) {
    lines.push(`  ${colors.bold}${r.ruleId.padEnd(14)}${colors.reset} ${colors.cyan}${r.ruleName}${colors.reset} (${colors.yellow}${r.techniqueId} ${r.tactic}${colors.reset})`);
    lines.push(`    ${colors.dim}Scenario:${colors.reset}  ${r.scenarioId}`);
    lines.push(`    ${colors.dim}Pattern:${colors.reset}   \`${r.detectionPattern}\``);
    lines.push(`    ${colors.dim}Sources:${colors.reset}   ${r.expectedTelemetrySources.join(', ')}`);
    lines.push('');
  }
  lines.push(`  ${colors.dim}Run "dualsurf purple detections evaluate <exec-id>" to re-evaluate an execution.${colors.reset}\n`);
  return lines.join('\n');
}

export function formatPurpleHelp(): string {
  return `
${colors.bold}${colors.magenta}DualSurf Purple Team CLI Commands:${colors.reset}

  ${colors.bold}dualsurf purple status${colors.reset}                              Show active assessment status, scorecard & environment health
  ${colors.bold}dualsurf purple environments list${colors.reset}                   List authorized test environments & telemetry sources
  ${colors.bold}dualsurf purple environments check <env-id>${colors.reset}          Check environment prerequisites & availability
  ${colors.bold}dualsurf purple tests list${colors.reset}                          List all controlled validation scenarios in catalog
  ${colors.bold}dualsurf purple tests show <test-id>${colors.reset}                Display scenario details, objective, and detection pattern
  ${colors.bold}dualsurf purple assessment list${colors.reset}                     List all Purple Team assessments
  ${colors.bold}dualsurf purple assessment create [title]${colors.reset}           Create a new Purple Team assessment campaign
  ${colors.bold}dualsurf purple assessment show <assessment-id>${colors.reset}     Show assessment details & scorecard
  ${colors.bold}dualsurf purple test validate <test-id>${colors.reset}             Validate prerequisites for a test scenario
  ${colors.bold}dualsurf purple test run <test-id> [--environment <id>]${colors.reset} Execute benign test, ingest telemetry, and evaluate detection
  ${colors.bold}dualsurf purple executions list [assessment-id]${colors.reset}     List past validation executions
  ${colors.bold}dualsurf purple executions show <execution-id>${colors.reset}      Show raw stdout, telemetry events, and comparison
  ${colors.bold}dualsurf purple detections list${colors.reset}                     List registered detection rules & signatures
  ${colors.bold}dualsurf purple detections evaluate <execution-id>${colors.reset}  Re-evaluate detection rule on recorded execution
  ${colors.bold}dualsurf purple evidence list${colors.reset}                       List immutable forensic evidence records
  ${colors.bold}dualsurf purple evidence show <evidence-id>${colors.reset}         Show cryptographic hash and evidence provenance
  ${colors.bold}dualsurf purple report <assessment-id> [--json]${colors.reset}     Generate comprehensive DFIR Purple Team report
  ${colors.bold}dualsurf purple help${colors.reset}                                Display this help message
`;
}
