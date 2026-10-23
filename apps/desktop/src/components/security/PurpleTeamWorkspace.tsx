import React, { useState, useEffect } from 'react';
import {
  Layers,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Play,
  Terminal,
  ExternalLink,
  Search,
  Filter,
  Check,
  RefreshCw,
  FolderLock,
  ChevronRight,
  Info,
  Server,
  Zap,
  Activity,
  FileText,
  BarChart2,
  XCircle,
  HelpCircle,
} from 'lucide-react';

interface PurpleTeamWorkspaceProps {
  onSwitchToTerminal: (command?: string) => void;
  activeUrl?: string;
}

export const PurpleTeamWorkspace: React.FC<PurpleTeamWorkspaceProps> = ({
  onSwitchToTerminal,
  activeUrl = '',
}) => {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'environments' | 'matrix' | 'assessments'>('scenarios');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<any>(null);
  const [executingScenarioId, setExecutingScenarioId] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [newAssessmentTitle, setNewAssessmentTitle] = useState('');
  const [selectedEnvId, setSelectedEnvId] = useState('env-local-win');
  const [targetRangeInput, setTargetRangeInput] = useState('127.0.0.1');

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.dualsurf?.executePurpleAction) {
        const res = await window.dualsurf.executePurpleAction('getOverview');
        setData(res);
      }
    } catch (err: any) {
      console.warn('Failed to load purple team overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunScenario = async (scenario: any) => {
    if (!window.dualsurf?.executePurpleAction) return;
    setExecutingScenarioId(scenario.id);
    setExecutionResult(null);
    try {
      const res = await window.dualsurf.executePurpleAction('executeScenario', {
        scenarioId: scenario.id,
        environmentId: selectedEnvId,
        operator: 'Operator',
      });
      setExecutionResult(res);
      await loadData();
    } catch (err: any) {
      setExecutionResult({
        status: 'FAILED',
        error: err.message,
      });
    } finally {
      setExecutingScenarioId(null);
    }
  };

  const handleCreateAssessment = async () => {
    if (!newAssessmentTitle.trim() || !window.dualsurf?.executePurpleAction) return;
    try {
      await window.dualsurf.executePurpleAction('createAssessment', {
        title: newAssessmentTitle.trim(),
        environmentId: selectedEnvId,
        targetRange: targetRangeInput,
        operator: 'Purple Team Lead',
      });
      setNewAssessmentTitle('');
      await loadData();
    } catch (err: any) {
      console.error('Failed to create purple assessment:', err);
    }
  };

  const scenarios = data?.scenarios || [];
  const environments = data?.environments || [];
  const testCases = data?.testCases || [];
  const assessments = data?.assessments || [];

  const filteredScenarios = scenarios.filter((s: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.id.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      s.techniqueId.toLowerCase().includes(q) ||
      s.tactic.toLowerCase().includes(q)
    );
  });

  const availableEnvs = environments.filter((e: any) => e.isAvailable);

  return (
    <div className="specialist-workspace-container purple-workspace purple-team-workspace security-workspace">
      {/* Workspace Header */}
      <div className="workspace-hero-banner">
        <div className="workspace-hero-left">
          <div className="workspace-hero-badge purple-badge">
            <Layers size={13} />
            <span>Adversary Emulation &amp; Detection Validation</span>
          </div>
          <h1 className="workspace-hero-title">Purple Team Collaborative Range</h1>
          <p className="workspace-hero-subtitle">
            Validate detection engineering telemetry against authentic, controlled adversary simulations with strict chain-of-custody tracking.
          </p>
        </div>

        <div className="workspace-hero-actions">
          <button
            className="workspace-action-btn terminal-btn"
            onClick={() => onSwitchToTerminal('dualsurf purple-team')}
            title="Launch Purple Team CLI Suite"
          >
            <Terminal size={14} />
            <span>Open Purple CLI</span>
          </button>

          <button
            className="workspace-action-btn refresh-btn"
            onClick={loadData}
            title="Refresh Environment &amp; Assessments"
          >
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
          </button>
        </div>
      </div>

      {/* Metric Health Cards */}
      <div className="workspace-metrics-row">
        <div className="metric-glass-card">
          <div className="metric-card-top">
            <span className="metric-card-lbl">Controlled Ranges</span>
            <Server size={14} className="metric-card-icon text-cyan" />
          </div>
          <div className="metric-card-val">
            {availableEnvs.length} <span className="metric-card-sub">/ {environments.length} Online</span>
          </div>
        </div>

        <div className="metric-glass-card">
          <div className="metric-card-top">
            <span className="metric-card-lbl">Standardized Scenarios</span>
            <Zap size={14} className="metric-card-icon text-purple" />
          </div>
          <div className="metric-card-val">{scenarios.length}</div>
        </div>

        <div className="metric-glass-card">
          <div className="metric-card-top">
            <span className="metric-card-lbl">ATT&CK Test Matrix</span>
            <BarChart2 size={14} className="metric-card-icon text-warning" />
          </div>
          <div className="metric-card-val">{testCases.length}</div>
        </div>

        <div className="metric-glass-card">
          <div className="metric-card-top">
            <span className="metric-card-lbl">Completed Assessments</span>
            <CheckCircle2 size={14} className="metric-card-icon text-success" />
          </div>
          <div className="metric-card-val">{assessments.length}</div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="workspace-tabs-bar">
        <button
          className={`ws-tab-btn ${activeTab === 'scenarios' ? 'active' : ''}`}
          onClick={() => setActiveTab('scenarios')}
        >
          <Zap size={14} />
          <span>Emulation Scenarios ({scenarios.length})</span>
        </button>

        <button
          className={`ws-tab-btn ${activeTab === 'environments' ? 'active' : ''}`}
          onClick={() => setActiveTab('environments')}
        >
          <Server size={14} />
          <span>Test Environments ({environments.length})</span>
        </button>

        <button
          className={`ws-tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
          onClick={() => setActiveTab('matrix')}
        >
          <Layers size={14} />
          <span>ATT&CK Detection Matrix ({testCases.length})</span>
        </button>

        <button
          className={`ws-tab-btn ${activeTab === 'assessments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assessments')}
        >
          <BarChart2 size={14} />
          <span>Assessments &amp; Scorecards ({assessments.length})</span>
        </button>
      </div>

      {/* Tab 1: Scenarios & Emulation Runner */}
      {activeTab === 'scenarios' && (
        <div className="ws-tab-content">
          <div className="ws-filter-bar">
            <div className="ws-search-wrap">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Filter scenarios by technique (e.g. T1059, PowerShell, C2)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ws-search-input"
              />
            </div>

            <div className="ws-env-select-wrap">
              <label className="ws-field-label">Target Range:</label>
              <select
                className="ws-dropdown"
                value={selectedEnvId}
                onChange={(e) => setSelectedEnvId(e.target.value)}
              >
                {environments.map((env: any) => (
                  <option key={env.id} value={env.id}>
                    {env.name} ({env.isAvailable ? 'AVAILABLE' : 'OFFLINE'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {executionResult && (
            <div className={`purple-execution-banner ${executionResult.validationStatus || executionResult.status}`}>
              <div className="banner-header">
                <strong>Emulation Outcome: {executionResult.validationStatus || executionResult.status}</strong>
                <button className="banner-close" onClick={() => setExecutionResult(null)}>×</button>
              </div>
              <div className="banner-body">
                <div><strong>Scenario:</strong> {executionResult.scenarioTitle || executionResult.scenarioId}</div>
                {executionResult.techniqueId && <div><strong>MITRE:</strong> {executionResult.techniqueId}</div>}
                {executionResult.evidenceHash && (
                  <div className="evidence-hash">
                    <strong>Evidence SHA-256:</strong> <code>{executionResult.evidenceHash}</code>
                  </div>
                )}
                {executionResult.executionStdout && (
                  <pre className="banner-pre">{executionResult.executionStdout}</pre>
                )}
                {executionResult.error && (
                  <div className="banner-error">{executionResult.error}</div>
                )}
              </div>
            </div>
          )}

          <div className="purple-scenarios-grid">
            {filteredScenarios.map((sc: any) => {
              const isRunning = executingScenarioId === sc.id;
              return (
                <div key={sc.id} className="purple-scenario-card">
                  <div className="scenario-card-top">
                    <span className="scenario-id-badge">{sc.id}</span>
                    <span className="mitre-tag">{sc.techniqueId}</span>
                    <span className="tactic-tag">{sc.tactic}</span>
                  </div>

                  <h3 className="scenario-title">{sc.title}</h3>
                  <p className="scenario-desc">{sc.description}</p>

                  <div className="scenario-meta-row">
                    <span className="meta-item">
                      <strong>Privilege:</strong> {sc.requiredPrivilege}
                    </span>
                    <span className="meta-item">
                      <strong>Expected Detection:</strong> {sc.expectedDetectionOutcome}
                    </span>
                  </div>

                  <div className="scenario-actions">
                    <button
                      className="run-scenario-btn"
                      disabled={isRunning}
                      onClick={() => handleRunScenario(sc)}
                    >
                      {isRunning ? (
                        <>
                          <RefreshCw size={13} className="spin-icon" />
                          <span>Emulating...</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} />
                          <span>Execute Emulation</span>
                        </>
                      )}
                    </button>

                    <button
                      className="inspect-rule-btn"
                      onClick={() => setSelectedScenario(selectedScenario?.id === sc.id ? null : sc)}
                    >
                      <Info size={13} />
                      <span>{selectedScenario?.id === sc.id ? 'Hide Logic' : 'View Detection Logic'}</span>
                    </button>
                  </div>

                  {selectedScenario?.id === sc.id && (
                    <div className="scenario-logic-drawer">
                      <div className="logic-section">
                        <strong>Payload Command:</strong>
                        <pre><code>{sc.simulationPayload}</code></pre>
                      </div>
                      <div className="logic-section">
                        <strong>Detection Rules:</strong>
                        <ul>
                          {sc.detectionRules?.map((r: any, idx: number) => (
                            <li key={idx}>
                              <code>{r.ruleId}</code> ({r.sourceId}): {r.queryExpression}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Test Environments */}
      {activeTab === 'environments' && (
        <div className="ws-tab-content">
          <div className="environments-grid">
            {environments.map((env: any) => (
              <div key={env.id} className={`env-card ${env.isAvailable ? 'available' : 'unavailable'}`}>
                <div className="env-card-top">
                  <div className="env-title-group">
                    <Server size={16} />
                    <span className="env-name">{env.name}</span>
                  </div>
                  <span className={`env-status-pill ${env.isAvailable ? 'active' : 'offline'}`}>
                    {env.isAvailable ? 'ONLINE / CONNECTED' : 'NOT DETECTED'}
                  </span>
                </div>

                <div className="env-body">
                  <p className="env-notes">{env.notes}</p>
                  <div className="env-attributes">
                    <div><strong>Platform:</strong> {env.platform}</div>
                    <div><strong>Range Type:</strong> {env.type}</div>
                    <div><strong>Required Privilege:</strong> {env.requiredPrivilege}</div>
                    <div><strong>Authorized Assets:</strong> {env.authorizedAssets?.join(', ')}</div>
                    <div><strong>Available Sources:</strong> {env.availableSources?.join(', ')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: ATT&CK Detection Matrix */}
      {activeTab === 'matrix' && (
        <div className="ws-tab-content">
          <div className="table-responsive-wrapper">
            <table className="purple-matrix-table">
              <thead>
                <tr>
                  <th>Test Case ID</th>
                  <th>MITRE Technique</th>
                  <th>Tactic</th>
                  <th>Attack Scenario</th>
                  <th>Expected Rule</th>
                  <th>Coverage Status</th>
                </tr>
              </thead>
              <tbody>
                {testCases.map((tc: any) => (
                  <tr key={tc.id}>
                    <td><code>{tc.id}</code></td>
                    <td><span className="mitre-tag">{tc.techniqueId}</span> {tc.techniqueName}</td>
                    <td><span className="tactic-tag">{tc.tactic}</span></td>
                    <td>{tc.scenarioName}</td>
                    <td><code>{tc.expectedRuleId || 'SIGMA-RULE'}</code></td>
                    <td>
                      <span className={`status-badge ${tc.status || 'UNTESTED'}`}>
                        {tc.status || 'UNTESTED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Assessments & Scorecards */}
      {activeTab === 'assessments' && (
        <div className="ws-tab-content">
          <div className="create-assessment-card">
            <h3>Start New Purple Team Assessment</h3>
            <div className="create-assessment-form">
              <input
                type="text"
                placeholder="Assessment Title (e.g. Q4 Adversary Emulation & EDR Audit)..."
                value={newAssessmentTitle}
                onChange={(e) => setNewAssessmentTitle(e.target.value)}
                className="ws-input-field"
              />
              <input
                type="text"
                placeholder="Target Range (e.g. 127.0.0.1, 10.10.10.0/24)..."
                value={targetRangeInput}
                onChange={(e) => setTargetRangeInput(e.target.value)}
                className="ws-input-field"
              />
              <button
                className="btn-create-assessment"
                onClick={handleCreateAssessment}
                disabled={!newAssessmentTitle.trim()}
              >
                Create Assessment
              </button>
            </div>
          </div>

          <div className="assessments-list">
            {assessments.length === 0 ? (
              <div className="empty-assessments">
                <Info size={24} />
                <p>No purple team assessments created yet. Launch an assessment above or run a scenario from the library.</p>
              </div>
            ) : (
              assessments.map((a: any) => (
                <div key={a.id} className="assessment-card">
                  <div className="assessment-top">
                    <div>
                      <span className="assessment-id">{a.id}</span>
                      <h4 className="assessment-title">{a.title}</h4>
                    </div>
                    <span className="assessment-status">{a.status}</span>
                  </div>

                  <div className="assessment-meta">
                    <span><strong>Target:</strong> {a.targetRange}</span>
                    <span><strong>Environment:</strong> {a.environmentId}</span>
                    <span><strong>Operator:</strong> {a.operator}</span>
                    <span><strong>Created:</strong> {new Date(a.createdAt).toLocaleString()}</span>
                  </div>

                  {a.scorecard && (
                    <div className="assessment-scorecard">
                      <div className="score-stat">
                        <span className="score-num">{a.scorecard.detectionRatePercent}%</span>
                        <span className="score-lbl">Detection Rate</span>
                      </div>
                      <div className="score-stat">
                        <span className="score-num">{a.scorecard.detectedCount}</span>
                        <span className="score-lbl">Detected</span>
                      </div>
                      <div className="score-stat">
                        <span className="score-num">{a.scorecard.missedCount}</span>
                        <span className="score-lbl">Missed</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
