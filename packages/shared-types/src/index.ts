/**
 * DualSurf: Shared Domain Types
 * Shared across GUI, Shared Controller, CLI, and IPC layer.
 */

export type TabId = string;
export type ProfileId = string;

export interface TabState {
  id: TabId;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  pinned: boolean;
  muted: boolean;
  isAudioPlaying?: boolean;
  error?: {
    code: number | string;
    description: string;
    failingUrl?: string;
  } | null;
  createdAt: number;
  lastAccessedAt: number;
}

export interface BrowserControllerState {
  tabs: TabState[];
  activeTabId: TabId | null;
  splitTabId?: TabId | null;
  profileId: ProfileId;
  windowBounds?: {
    width: number;
    height: number;
  };
}

export interface NavigationOptions {
  tabId?: TabId;
  newTab?: boolean;
  activate?: boolean;
}

export type SearchEngine = 'duckduckgo' | 'google' | 'brave' | 'bing' | 'ecosia' | 'yahoo';

export interface OllamaSettings {
  enabled: boolean;
  host: string;
  model: string;
  onboardingCompleted: boolean;
  autoSummarize?: boolean;
}

export interface BrowserSettings {
  searchEngine: SearchEngine;
  homeUrl: string;
  restoreSessionOnStartup: boolean;
  terminalTheme: 'dracula' | 'gruvbox' | 'nord' | 'matrix';
  defaultDownloadDir: string;
  ollama?: OllamaSettings;
  cyberShieldEnabled?: boolean;
  tabLayout?: 'horizontal' | 'vertical';
  autoHibernateTabs?: boolean;
  activeWorkspaceId?: string;
  workspaces?: WorkspaceGroup[];
  proxy?: ProxyConfig;
  activeUserAgentId?: string;
  antiFingerprintEnabled?: boolean;
  themeMode?: 'dark' | 'light' | 'system';
  uiDensity?: 'compact' | 'comfortable';
  defaultShell?: 'default' | 'powershell' | 'cmd' | 'bash' | 'wsl';
  terminalDefaultWorkingDir?: string;
  terminalRestoreSessions?: boolean;
  terminalShowWelcome?: boolean;
  terminalDefaultRuntime?: string;
  terminalFontSize?: number;
  terminalFontFamily?: string;
  terminalScrollback?: number;
  scopeEnforcementStrict?: boolean;
  autoClearDataOnExit?: boolean;
  blockThirdPartyCookies?: boolean;
  doNotTrack?: boolean;
  evidenceAutoHash?: boolean;
  defaultZoom?: number;
  workspaceSandboxDir?: string;
  hasGrantedWorkspaceAccess?: boolean;
}

export interface PlatformDiagnostics {
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  v8Version: string;
  platform: string;
  arch: string;
  osRelease: string;
  hostname: string;
  uptimeSeconds: number;
  memoryRssMb: number;
  memoryHeapUsedMb: number;
  memoryHeapTotalMb: number;
  userDataPath: string;
  downloadsPath: string;
}

export interface ProxyConfig {
  mode: 'direct' | 'tor' | 'burp' | 'custom';
  server?: string;
  bypassList?: string[];
}

export interface UserAgentProfile {
  id: string;
  name: string;
  userAgent: string;
  platform: string;
  deviceType: 'desktop' | 'mobile' | 'bot';
}

export interface EditableCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
  expirationDate?: number;
}

export interface SecurityPayload {
  id: string;
  category: 'XSS' | 'SQLi' | 'LFI' | 'SSRF' | 'Command';
  name: string;
  payload: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'domain' | 'subdomain' | 'endpoint' | 'port' | 'tech';
  status: 'safe' | 'warning' | 'danger';
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface CveNewsItem {
  id: string;
  cveId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  description: string;
  affected: string;
  publishedDate: string;
  link: string;
}

export interface CyberShieldStats {
  enabled: boolean;
  totalBlocked: number;
  trackersBlocked: number;
  adsBlocked: number;
  malwareBlocked: number;
  tabBlockedCount: number;
  whitelistedDomains: string[];
  recentBlocked: Array<{
    url: string;
    domain: string;
    category: 'tracker' | 'ad' | 'malware' | 'telemetry';
    timestamp: number;
  }>;
}

export interface TrafficLogEntry {
  id: string;
  tabId?: string;
  timestamp: number;
  method: string;
  url: string;
  domain: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  latencyMs?: number;
  blocked?: boolean;
  blockReason?: string;
  securityIssues?: string[];
}

export interface RawHttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface RawHttpResponse {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  latencyMs?: number;
  error?: string;
}

export interface InterceptRule {
  id: string;
  name: string;
  enabled: boolean;
  action: 'modify_headers' | 'drop' | 'redirect' | 'inject_header' | 'breakpoint';
  match: {
    urlPattern?: string;
    methods?: string[];
    domainPattern?: string;
  };
  modifications?: {
    addHeaders?: Record<string, string>;
    removeHeaders?: string[];
    redirectTo?: string;
  };
}

export interface InterceptedRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  tabId?: string;
  status: 'pending' | 'forwarded' | 'dropped' | 'modified';
}

export interface LocalProxyServerStatus {
  running: boolean;
  port: number;
  host: string;
  totalRequestsHandled: number;
  totalIntercepted: number;
  activeBreakpoint: boolean;
}

export interface PrivacyDiagnosticResult {
  webrtcLeaking: boolean;
  webrtcIps: string[];
  canvasHash: string;
  antiFingerprintActive: boolean;
  proxyMode: string;
  cyberShieldActive: boolean;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
}

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
  error?: string;
}

export interface WorkspaceGroup {
  id: string;
  name: string;
  color: string;
  icon?: string;
  tabIds: string[];
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  pageContext?: {
    title?: string;
    url?: string;
  };
  isStreaming?: boolean;
}

export interface ClearBrowsingDataOptions {
  timeRangeMs?: number; // 0 for all time, or milliseconds (e.g. 3600000 for 1h)
  history?: boolean;
  cookies?: boolean;
  cache?: boolean;
  storage?: boolean;
}

export type EndpointCategory =
  | 'api'
  | 'auth'
  | 'download'
  | 'action'
  | 'form'
  | 'internal'
  | 'external';

export interface EndpointItem {
  id: number;
  url: string;
  path: string;
  category: EndpointCategory;
  method?: string; // 'GET', 'POST', 'PUT', 'DELETE', etc.
  label?: string;
  isExternal: boolean;
  origin?: string;
}

export interface LinkItem {
  id: number;
  label: string;
  href: string;
  category?: EndpointCategory;
  endpoint?: string;
  isExternal?: boolean;
  method?: string;
}

export interface HeadingItem {
  level: number;
  text: string;
}

export interface CookieItem {
  name: string;
  value: string;
}

export interface StorageItem {
  key: string;
  value: string;
}

export interface SecurityHeaderItem {
  name: string;
  value?: string;
  status: 'good' | 'warning' | 'missing';
  description: string;
}

export interface FormSecurityItem {
  id: string;
  name?: string;
  action: string;
  method: string;
  hasPassword: boolean;
  hasCsrfToken: boolean;
  isCleartext: boolean;
}

export interface SecuritySignals {
  insecureLinksCount: number;
  tabnabbingCount: number;
  scriptsCount: number;
  externalScriptsCount: number;
  metaGenerator?: string;
  hasPasswordField: boolean;
}

export interface ReaderArticle {
  title: string;
  byline?: string;
  content: string;
  textContent: string;
  length: number;
  readingTimeMinutes: number;
  siteName?: string;
  url: string;
}

export interface PageSecurityInfo {
  url: string;
  hostname: string;
  isHttps: boolean;
  securityScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  protocol?: string;
  cipherSuite?: string;
  certificate?: {
    issuer: string;
    validFrom: string;
    validTo: string;
    daysRemaining: number;
    subjectAltNames: string[];
    isExpired: boolean;
  };
  headers: SecurityHeaderItem[];
  cookiesCount: number;
  hasInsecureContent: boolean;
}

export interface PageMetadata {
  title: string;
  url: string;
  isLoading: boolean;
  headings: HeadingItem[];
  links: LinkItem[];
  endpoints?: EndpointItem[];
  cookies?: CookieItem[];
  storage?: StorageItem[];
  forms?: FormSecurityItem[];
  securitySignals?: SecuritySignals;
  scripts?: string[];
  textSnippet?: string;
  iocs?: IocFinding[];
  openPorts?: OpenPortInfo[];
  readerArticle?: ReaderArticle;
  securityInfo?: PageSecurityInfo;
}

export interface FindMatch {
  index: number;
  snippet: string;
}

export interface FindResult {
  query: string;
  count: number;
  matches: FindMatch[];
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
  visitCount: number;
}

export interface BookmarkEntry {
  id: string;
  title: string;
  url: string;
  folderId?: string;
  createdAt: number;
}

/**
 * Controller-to-Interface Event Payloads
 */
export type ControllerEventType =
  | 'state:updated'
  | 'tab:created'
  | 'tab:closed'
  | 'tab:activated'
  | 'tab:updated'
  | 'navigation:failed';

export interface ControllerEvent<T = unknown> {
  type: ControllerEventType;
  payload: T;
  timestamp: number;
}

/**
 * Blue Team & SOC Defensive Operations Types
 */
export type IncidentSeverity = 'P1-CRITICAL' | 'P2-HIGH' | 'P3-MEDIUM' | 'P4-LOW';
export type IncidentStatus = 'New' | 'Triage' | 'Investigating' | 'Contained' | 'Eradicated' | 'Resolved' | 'Closed';

export interface IncidentCase {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  category: string;
  assignedTo?: string;
  affectedHosts: string[];
  affectedUsers: string[];
  iocs: string[];
  mitreTechniques: string[];
  notes: Array<{ timestamp: string; author: string; text: string }>;
  containmentSteps: string[];
  evidenceIds?: string[];
  isFalsePositive?: boolean;
  falsePositiveReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type IocType = 'ipv4' | 'ipv6' | 'domain' | 'url' | 'md5' | 'sha1' | 'sha256' | 'email' | 'cve' | 'registry_key' | 'file_path' | 'crypto_wallet';

export interface IocFinding {
  value: string;
  type: IocType;
  defanged: string;
  isPrivate?: boolean;
  reputation: 'MALICIOUS' | 'SUSPICIOUS' | 'BENIGN' | 'UNKNOWN';
  mitreTags: string[];
  context?: string;
}

export interface SiemAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  sourceIp?: string;
  targetIp?: string;
  user?: string;
  techniqueId?: string;
  description: string;
  evidence: string;
}

export interface ForensicEvidence {
  filePath: string;
  fileName: string;
  sha256: string;
  sha1: string;
  md5: string;
  sizeBytes: number;
  acquiredAt: string;
  acquiredBy: string;
}

export interface BlueTeamChecklistItem {
  id: number;
  category: string;
  task: string;
  completed: boolean;
  notes?: string;
  completedAt?: string;
}

export interface BlueTeamDomainInfo {
  id: number;
  number: string;
  title: string;
  goal: string;
  subdomains: string[];
  toolsAndPractice: string[];
  keyDistinctions?: string;
}

export interface SigmaRuleDefinition {
  title: string;
  id: string;
  status: 'experimental' | 'test' | 'stable';
  description: string;
  references?: string[];
  author?: string;
  date?: string;
  tags: string[];
  logsource: {
    category?: string;
    product?: string;
    service?: string;
  };
  detection: {
    selection: Record<string, any>;
    condition: string;
  };
  falsepositives?: string[];
  level: 'low' | 'medium' | 'high' | 'critical';
}

export interface ThreatHuntingFinding {
  type: 'BEACONING' | 'RARE_PROCESS' | 'RARE_USER_AGENT' | 'KERBEROAST' | 'CLOUD_PRIV_ESC';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  evidence: string;
  mitreTechnique: string;
  recommendedAction: string;
}

/**
 * Red Team & Offensive Assessment Types
 */
export interface RedTeamChecklistItem {
  id: number;
  category: string;
  task: string;
  completed: boolean;
  notes?: string;
  completedAt?: string;
}

export interface BlueTeamToolEntry {
  name: string;
  primaryPurpose: string;
}

export interface BlueTeamToolGroup {
  name: string;
  tools: BlueTeamToolEntry[];
}

export interface BlueTeamPillar {
  id: number;
  number: string;
  title: string;
  objective: string;
  description: string;
  toolGroups: BlueTeamToolGroup[];
  investigationWorkflow: string[];
  commandTriggers: string[];
}

export interface BlueTeamToolExecutionResult {
  tool: string;
  pillarId: number;
  pillarTitle: string;
  isHostNative: boolean;
  commandExecuted: string;
  output: string;
  status: 'SUCCESS' | 'PARTIAL' | 'ERROR';
  durationMs: number;
  data?: any;
}

export interface BlueTeamMetric {
  metric: string;
  whatItMeasures: string;
  operationalFormula?: string;
  industryBenchmark?: string;
}

export interface BlueTeamRolePersona {
  role: string;
  title: string;
  tier: string;
  responsibilities: string[];
  typicalDay: string[];
  primaryTools: string[];
}

export interface BlueTeamLearningPhase {
  phase: string;
  title: string;
  timeline: string;
  description: string;
  topics: string[];
  portfolioProject?: string;
}

export type EvidenceState =
  | 'VERIFIED'
  | 'OBSERVED'
  | 'VALIDATED'
  | 'CORRELATED'
  | 'ANALYST_REVIEW'
  | 'INFERRED'
  | 'UNKNOWN'
  | 'NOT_TESTED'
  | 'OUT_OF_SCOPE'
  | 'NOT_INSTALLED'
  | 'NOT_CONFIGURED'
  | 'PERMISSION_DENIED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'PARTIAL';

export interface RedTeamAssessment {
  id: string; // ASSESS-<year>-<num>
  name: string;
  clientOrLab: string;
  organization?: string;
  scopeId: string;
  environment: 'production' | 'staging' | 'lab' | 'external' | string;
  status: 'Draft' | 'Active' | 'Paused' | 'Completed' | 'Archived' | 'PLANNING' | string;
  leadTester?: string;
  leadOperator?: string;
  objective?: string;
  testingWindow: {
    start: string;
    end: string;
  };
  findingIds: string[];
  executionIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RedTeamScope {
  id: string; // ROE-<year>-<num>
  name: string;
  organization: string;
  inScopeDomains: string[];
  allowSubdomains: boolean;
  inScopeIpRanges: string[];
  exclusions: string[];
  permittedMethods: string[];
  prohibitedMethods: string[];
  permittedPorts?: number[] | 'all';
  rateLimitRps?: number;
  maxConcurrency?: number;
  testingWindow: {
    start: string;
    end: string;
  };
  emergencyContact: string;
  authorizedBy: string;
  status: 'Draft' | 'Approved' | 'Active' | 'Expired' | 'Revoked';
  auditTrail: Array<{
    timestamp: string;
    action: string;
    actor: string;
    details: string;
  }>;
  createdAt: string;
}

export interface ScopeValidationResult {
  allowed: boolean;
  state: EvidenceState;
  target: string;
  normalizedTarget: string;
  scopeId?: string;
  reason: string;
  matchedRule?: string;
  isExcluded?: boolean;
  auditId?: string;
}

export interface DiscoveredAsset {
  id: string;
  asset: string;
  type: 'domain' | 'subdomain' | 'ip' | 'port' | 'endpoint' | 'cloud_bucket';
  discoveredByTool: string;
  discoveredAt: string;
  evidenceId: string;
  scopeStatus: 'IN_SCOPE' | 'AWAITING_APPROVAL' | 'EXCLUDED';
  details?: Record<string, any>;
}

export interface RedTeamRiskScore {
  technicalSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  cvssScore: number;
  cvssVector?: string;
  exploitability: 'CONFIRMED_POC' | 'THEORETICAL' | 'UNPROVEN' | 'BLOCKED';
  exposure: 'PUBLIC_INTERNET' | 'PARTNER_NETWORK' | 'INTERNAL' | 'ISOLATED_LAB';
  confidence: 'VERIFIED' | 'VALIDATED' | 'HIGH' | 'MEDIUM' | 'LOW';
  overallScore: number; // 0.0 - 10.0 DualSurf-derived
  scoreRationale: string;
}

export type ToolDetectionStatus =
  | 'INSTALLED_ACTIVE'
  | 'INSTALLED_NO_ADAPTER'
  | 'INSTALLED_UNCONFIGURED'
  | 'NOT_INSTALLED'
  | 'UNSUPPORTED_OS'
  | 'PERMISSION_DENIED';

export interface ToolDetectionResult {
  toolId: string;
  name: string;
  category: string;
  installed: boolean;
  version?: string;
  executablePath?: string;
  status: ToolDetectionStatus;
  supportedOs: ('win32' | 'linux' | 'darwin')[];
  requiredPrivilege: 'user' | 'admin' | 'root';
  isConfigured: boolean;
  adapterImplemented: boolean;
  detectionCommand?: string;
  documentationUrl?: string;
  lastChecked: string;
}

export interface SecurityEvidenceRecord {
  id: string; // EVD-<timestamp>-<hash>
  executionId: string;
  toolId: string;
  toolName: string;
  toolVersion?: string;
  executablePath?: string;
  target?: string;
  commandExecuted: string;
  executedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  state: EvidenceState;
  integrityHash: string; // SHA-256 of raw stdout+stderr
  parsedFindings: any[];
  limitations?: string;
  sourceCoverage?: {
    endpointLogs: boolean;
    networkLogs: boolean;
    dnsLogs: boolean;
    cloudAudit: boolean;
    identityLogs: boolean;
    missingSources: string[];
  };
}

export interface CaseTimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  evidenceId?: string;
  sourceTool?: string;
  analyst?: string;
}

export interface BlueTeamCaseRecord {
  id: string; // CASE-<year>-<num>
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  confidence: 'CONFIRMED' | 'HIGH' | 'MODERATE' | 'LOW' | 'UNVERIFIED';
  status: 'Open' | 'Investigating' | 'Contained' | 'Remediated' | 'Closed';
  assignedTo?: string;
  affectedAssets: string[];
  affectedAccounts: string[];
  evidenceIds: string[];
  timeline: CaseTimelineEvent[];
  findings: string[];
  analystNotes: Array<{ timestamp: string; analyst: string; note: string }>;
  responsePlaybook?: {
    actions: Array<{ action: string; status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'FAILED'; executedAt?: string }>;
    containmentSummary?: string;
  };
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface BlueTeamHuntRecord {
  id: string; // HUNT-<id>
  title: string;
  hypothesis: string;
  dataSources: string[];
  query: string;
  timeWindow: string;
  findings: string[];
  limitations: string;
  analystConclusion: string;
  mitreTechniques: string[];
  linkedEvidenceIds: string[];
  status: 'Draft' | 'Running' | 'Completed' | 'Inconclusive';
  createdAt: string;
}

export interface LogSourceInfo {
  id: string;
  name: string;
  type: 'local_syslog' | 'windows_event' | 'zeek_eve' | 'suricata_eve' | 'siem_api' | 'cloudtrail';
  pathOrEndpoint: string;
  connected: boolean;
  lastEventTime?: string;
  eventsCount?: number;
  status: 'ACTIVE' | 'DISCONNECTED' | 'PERMISSION_DENIED' | 'UNCONFIGURED';
}

export interface CoverageReport {
  timestamp: string;
  connectedSources: string[];
  missingSources: string[];
  coveragePercentage: number;
  investigationGaps: string[];
}

export interface RedTeamDomainInfo {
  id: number;
  number: string;
  title: string;
  goal: string;
  subdomains: string[];
  tools: string[];
  assessmentFocus: string;
}

export interface RedTeamPillar {
  id: number;
  number: string;
  title: string;
  description: string;
  tools: string[];
  operationalScope: string;
  commandTriggers: string[];
}

export interface RedTeamToolExecutionResult {
  tool: string;
  pillarId: number;
  pillarTitle: string;
  isHostNative: boolean;
  commandExecuted: string;
  output: string;
  status: 'SUCCESS' | 'PARTIAL' | 'ERROR';
  durationMs: number;
  data?: any;
}

export interface EngagementScope {
  id: string;
  clientName: string;
  targetDomains: string[];
  targetIpRanges: string[];
  testingWindow: {
    start: string;
    end: string;
  };
  allowedTechniques: string[];
  prohibitedTechniques: string[];
  emergencyContact: string;
  status: 'Draft' | 'Approved' | 'Active' | 'Completed';
  createdAt: string;
}

export interface PentestFinding {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  cvssScore: number;
  affectedAsset: string;
  category: string;
  description: string;
  impact: string;
  remediation: string;
  references: string[];
  status: 'Open' | 'Retested' | 'Remediated';
  createdAt: string;
  curlPoc?: string;
  reproductionSteps?: string[];
  evidenceSnippet?: string;
  cweId?: string;
}

export interface PurpleTeamTestCase {
  id: string;
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  testBehavior: string;
  prerequisites: string[];
  expectedTelemetry: string[];
  detectionStatus: 'DETECTED' | 'BLIND_SPOT' | 'PARTIAL';
  remediationNotes: string;
}

export interface PurpleTeamScorecard {
  totalTests: number;
  detectedCount: number;
  blindSpotCount: number;
  partialCount: number;
  detectionCoveragePct: number;
  tacticCoverage: Record<string, { total: number; detected: number; pct: number }>;
  criticalGaps: Array<{
    techniqueId: string;
    techniqueName: string;
    tactic: string;
    recommendedDetection: string;
  }>;
}

export type PurpleValidationStatus =
  | 'PASS'
  | 'DETECTION_GAP'
  | 'TELEMETRY_GAP'
  | 'EXECUTION_FAILED'
  | 'DETECTION_FAILED'
  | 'PARTIAL'
  | 'INCONCLUSIVE'
  | 'NOT_TESTED';

export interface PurpleEnvironmentInfo {
  id: string;
  name: string;
  platform: 'win32' | 'linux' | 'darwin' | 'all';
  type: 'local_host' | 'isolated_vm' | 'siem_lab' | 'network_lab' | 'web_lab';
  authorizedAssets: string[];
  availableSources: string[];
  requiredPrivilege: 'user' | 'admin' | 'root';
  isAvailable: boolean;
  notes: string;
}

export interface PurpleScenarioDefinition {
  id: string;
  name: string;
  objective: string;
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  testBehavior: string;
  environmentId: string;
  requiredPermissions: string[];
  expectedTelemetrySources: string[];
  expectedDetectionRule: {
    ruleId: string;
    ruleName: string;
    detectionPattern: string;
  };
  cleanupRequired: boolean;
  cleanupCommand?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timeoutMs: number;
}

export interface PurpleExecutionRecord {
  id: string; // PTX-<timestamp>-<hash>
  scenarioId: string;
  assessmentId: string;
  environmentId: string;
  approvalGranted: boolean;
  approvedBy: string;
  executedCommand: string;
  executedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  cleanupExecuted: boolean;
  cleanupStatus?: string;
  expectedTelemetry: string[];
  observedTelemetryCount: number;
  observedTelemetrySnippets: string[];
  telemetryEvidenceId?: string;
  detectionEvaluated: boolean;
  detectionMatched: boolean;
  detectionQuery: string;
  detectionDetails: string;
  validationStatus: PurpleValidationStatus;
  integrityHash: string;
}

export interface PurpleAssessmentRecord {
  id: string; // PTA-<year>-<num>
  title: string;
  environmentId: string;
  createdAt: string;
  updatedAt: string;
  executions: string[]; // PTX IDs
  scorecard: {
    totalScenarios: number;
    passed: number;
    detectionGaps: number;
    telemetryGaps: number;
    failed: number;
    coveragePct: number;
  };
}

export interface SoarPlaybookResult {
  action: 'block' | 'isolate' | 'sinkhole';
  target: string;
  iptablesRule: string;
  ufwRule: string;
  windowsFirewallRule: string;
  cloudflareRule?: string;
  dnsSinkholeRule?: string;
  verificationCommand: string;
  rollbackCommand: string;
}

export interface SigmaTranspileResult {
  ruleTitle: string;
  ruleId: string;
  splunkSpl: string;
  elasticKql: string;
  sentinelKql: string;
  crowdstrike: string;
}

export interface CookieSecurityCheck {
  name: string;
  hasSecure: boolean;
  hasHttpOnly: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None' | 'Missing';
  isSessionCookie: boolean;
  issues: string[];
}

export interface CspDirectiveAudit {
  rawDirective?: string;
  hasUnsafeInline: boolean;
  hasUnsafeEval: boolean;
  hasWildcard: boolean;
  missingBaseUri: boolean;
  issues: string[];
}

export interface AutoAuditOptions {
  exportReport?: boolean;
  autoExportReport?: boolean;
  exportPath?: string;
  outputPath?: string;
  format?: 'markdown' | 'html' | 'json' | 'all';
  exportHtml?: boolean;
  exportJson?: boolean;
  htmlReportPath?: string;
  jsonReportPath?: string;
  deepInspect?: boolean;
  scopeId?: string;
  timeoutMs?: number;
  scanPorts?: boolean;
  portProfile?: 'web' | 'common' | 'db' | 'top20' | 'all';
  customPorts?: number[];
  checkDns?: boolean;
  checkEmailSecurity?: boolean;
  checkAdminRoutes?: boolean;
  deepAttackSurface?: boolean;
  checkCloudBuckets?: boolean;
  checkSubdomainTakeover?: boolean;
  discoverApis?: boolean;
  authCookie?: string;
  bearerToken?: string;
  customHeaders?: Record<string, string>;
  webhookUrl?: string;
  exportSarif?: boolean;
  sarifReportPath?: string;
  useAiRemediation?: boolean;
  checkDependencies?: boolean;
  checkCertificateTransparency?: boolean;
  deepTlsCrypto?: boolean;
  generateCiWorkflow?: boolean;
}

export interface DependencyCve {
  cveId: string;
  cvssScore: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  fixedIn?: string;
}

export interface VulnerableDependency {
  library: string;
  detectedVersion: string;
  sourceUrl: string;
  cveList: DependencyCve[];
}

export interface TlsCryptoAudit {
  protocol: string;
  cipherName: string;
  isDeprecatedProtocol: boolean;
  isWeakCipher: boolean;
  hasPfs: boolean;
  flaws: string[];
}

export interface CloudStorageAudit {
  provider: 'aws' | 'gcp' | 'azure';
  bucketName: string;
  url: string;
  status: 'open' | 'protected' | 'not_found' | 'error';
  publiclyReadable: boolean;
  listingEnabled: boolean;
  details?: string;
}

export interface SubdomainTakeoverCheck {
  subdomain: string;
  cnameDestination?: string;
  service?: string;
  vulnerable: boolean;
  evidence?: string;
}

export interface ApiDiscoveryResult {
  openApiFound: boolean;
  openApiUrl?: string;
  openApiTitle?: string;
  endpointsCount?: number;
  graphQlFound: boolean;
  graphQlUrl?: string;
  graphQlIntrospectionEnabled: boolean;
  typesCount?: number;
}

export interface DnsAuditRecord {
  type: 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME';
  value: string;
}

export interface EmailSecurityPosture {
  hasSpf: boolean;
  spfRecord?: string;
  hasDmarc: boolean;
  dmarcPolicy?: 'reject' | 'quarantine' | 'none' | 'missing';
  dmarcRecord?: string;
  mxRecords: string[];
  issues: string[];
}

export interface AttackSurfaceAsset {
  hostname: string;
  ip?: string;
  assetType: 'domain' | 'subdomain' | 'api' | 'admin' | 'staging' | 'mail' | 'storage' | 'unknown';
  environment: 'production' | 'staging' | 'development' | 'internal' | 'unknown';
  source: 'dns' | 'san' | 'endpoint' | 'href' | 'origin';
  publiclyExposed: boolean;
  inScope?: boolean;
}

export interface AdminInterfaceCheck {
  path: string;
  url: string;
  status: number;
  exposed: boolean;
  title?: string;
  notes?: string;
}

export type PortServiceType =
  | 'HTTP'
  | 'HTTPS'
  | 'SSH'
  | 'FTP'
  | 'Telnet'
  | 'SMTP'
  | 'DNS'
  | 'MySQL'
  | 'PostgreSQL'
  | 'MSSQL'
  | 'Redis'
  | 'MongoDB'
  | 'RDP'
  | 'SMB'
  | 'VNC'
  | 'Proxy'
  | 'Development'
  | 'Unknown';

export interface OpenPortInfo {
  port: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered';
  service: PortServiceType;
  banner?: string;
  latencyMs?: number;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  riskReason?: string;
  mitreTechnique?: string;
  hardeningAdvice?: string;
}

export interface PortScanReport {
  host: string;
  ip?: string;
  scannedPortsCount: number;
  openPortsCount: number;
  durationMs: number;
  openPorts: OpenPortInfo[];
  highRiskCount: number;
  timestamp: string;
  inScope?: boolean;
}

export interface AuditComparisonDiff {
  previousTarget: string;
  currentTarget: string;
  previousTimestamp: string;
  currentTimestamp: string;
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  gradeChange: string;
  resolvedFindings: PentestFinding[];
  newFindings: PentestFinding[];
  unresolvedFindings: PentestFinding[];
}

export interface FullSecurityAuditResult {
  targetUrl: string;
  normalizedUrl: string;
  host: string;
  port: number;
  protocol: string;
  timestamp: string;
  reachable: boolean;
  statusCode?: number;
  durationMs: number;
  inScope?: boolean;
  scopeNotes?: string;
  riskRating: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
  securityScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  tls?: {
    authorized: boolean;
    issuer?: string;
    validTo: string;
    daysRemaining: number;
    isExpired: boolean;
    protocol: string;
    cipherName: string;
    subjectAltNames: string[];
  };
  headers: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    items: SecurityHeaderItem[];
    serverBanner?: string;
  };
  cors?: {
    risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
    verdict: string;
    allowOrigin?: string;
    allowCredentials?: boolean;
  };
  techProfile: {
    servers: string[];
    frameworks: string[];
    cms: string[];
    cdnWaf: string[];
  };
  secretsDetected: Array<{ type: string; snippet: string }>;
  endpointsDetected: EndpointItem[];
  findings: PentestFinding[];
  cookiesAudited?: CookieSecurityCheck[];
  cspAudit?: CspDirectiveAudit;
  robotsPathsDiscovered?: string[];
  securityTxtDisclosed?: boolean;
  openRedirectSuspects?: string[];
  openPorts?: OpenPortInfo[];
  portAudit?: PortScanReport;
  dnsRecords?: DnsAuditRecord[];
  emailSecurity?: EmailSecurityPosture;
  attackSurfaceRegister?: AttackSurfaceAsset[];
  adminInterfaces?: AdminInterfaceCheck[];
  cloudStorage?: CloudStorageAudit[];
  subdomainTakeovers?: SubdomainTakeoverCheck[];
  apiDiscovery?: ApiDiscoveryResult;
  aiRemediationSummary?: string;
  sarifReportPath?: string;
  authenticatedAudit?: boolean;
  dependencies?: VulnerableDependency[];
  tlsCrypto?: TlsCryptoAudit;
  ctSubdomainsDiscovered?: number;
  ciWorkflowPath?: string;
  reportFilePath?: string;
  htmlReportPath?: string;
  jsonReportPath?: string;
}

/**
 * Host System & Active Shell Information
 */
export interface SystemInfo {
  platform: 'win32' | 'linux' | 'darwin';
  osName: string;
  osRelease: string;
  shellType: 'bash' | 'powershell' | 'cmd';
  shellName: string;
  shellPath: string;
  username: string;
  hostname: string;
  cwd: string;
}

/**
 * Live Active Browser Session State
 */
export interface ActiveSessionState {
  activeTabId: TabId | null;
  url: string;
  title: string;
  mode: 'gui' | 'terminal';
  ipcConnected: boolean;
  sessionConnected: boolean;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error?: string | null;
}

// ============================================================================
// KALI LINUX OPERATIONS WORKSTATION TYPES
// ============================================================================

export type KaliRuntimeType =
  | 'native-kali'
  | 'wsl-kali'
  | 'container-kali'
  | 'vm-kali'
  | 'host-local';

export interface KaliRuntimeProfile {
  id: string;
  name: string;
  type: KaliRuntimeType;
  status: 'online' | 'offline' | 'unconfigured' | 'probing';
  description: string;
  wslDistroName?: string;
  containerIdOrName?: string;
  sshConfig?: {
    host: string;
    port: number;
    username: string;
    authType: 'key' | 'password';
    privateKeyPath?: string;
  };
  systemDetails?: {
    osName?: string;
    kernelVersion?: string;
    architecture?: string;
    user?: string;
    kaliRelease?: string;
    packageManager?: string;
  };
  lastChecked?: string;
  error?: string;
}

export interface KaliMetapackage {
  name: string;
  title: string;
  category: string;
  description: string;
  installed: boolean;
  packageCount?: number;
  sampleTools: string[];
  installCommand: string;
}

export interface TerminalSessionInfo {
  id: string;
  title: string;
  runtimeId: string;
  cwd: string;
  createdAt: string;
  lastActive: string;
  status: 'running' | 'terminated';
}

export type SpecialistWorkspaceMode =
  | 'terminal'
  | 'network'
  | 'web-api'
  | 'forensics'
  | 'reverse-engineering'
  | 'cloud-container'
  | 'blue-team'
  | 'red-team'
  | 'purple-team'
  | 'labs'
  | 'copilot';

export interface AiCopilotCommandProposal {
  id: string;
  task: string;
  toolName: string;
  proposedCommand: string;
  runtimeId: string;
  explanation: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredPrivileges: 'user' | 'sudo' | 'root';
  target: string;
  inScope: boolean;
  requiresApproval: boolean;
  status: 'awaiting_approval' | 'approved' | 'rejected' | 'executed';
  executionOutput?: string;
  evidenceId?: string;
  createdAt: string;
}

export interface LabEnvironmentProfile {
  id: string;
  name: string;
  targetIpOrHost: string;
  type: 'vuln-vm' | 'ctf-container' | 'ad-lab' | 'cloud-sandbox';
  status: 'ready' | 'offline' | 'needs-reset';
  description: string;
  credentials?: Record<string, string>;
  snapshotSupported: boolean;
  linkedRoEScopeId: string;
  notes?: string;
}

