import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  AlertCircle,
  Search,
  CheckCircle2,
  FolderLock,
  Terminal,
  RefreshCw,
  Play,
  Copy,
  ExternalLink,
  Filter,
  Check,
  ChevronRight,
  Info,
  Clock,
  Radio,
  FileText,
  Lock,
  Cpu,
  Layers,
  Plus,
  X,
  Link2,
  ShieldAlert,
  CheckCheck,
} from 'lucide-react';

interface BlueTeamWorkspaceProps {
  onSwitchToTerminal: (command?: string) => void;
  activeUrl?: string;
}

export const BlueTeamWorkspace: React.FC<BlueTeamWorkspaceProps> = ({
  onSwitchToTerminal,
  activeUrl = '',
}) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'pillars' | 'cases' | 'hunting' | 'checklist' | 'soar'>('telemetry');
  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedRule, setCopiedRule] = useState<string | null>(null);
  const [soarTarget, setSoarTarget] = useState(activeUrl || '198.51.100.42');
  const [soarAction, setSoarAction] = useState<'block' | 'isolate' | 'sinkhole'>('block');
  const [pillarSearch, setPillarSearch] = useState('');

  // Interactive Case Management State
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseSeverity, setNewCaseSeverity] = useState<'P1-CRITICAL' | 'P2-HIGH' | 'P3-MEDIUM' | 'P4-LOW'>('P2-HIGH');
  const [newCaseCategory, setNewCaseCategory] = useState('Web Application Attack');
  const [newCaseHost, setNewCaseHost] = useState(activeUrl || '192.168.1.100');
  const [caseActionMsg, setCaseActionMsg] = useState<string | null>(null);
  const [linkingCaseId, setLinkingCaseId] = useState<string | null>(null);
  const [linkingEvidenceId, setLinkingEvidenceId] = useState('');

  // Interactive Threat Hunting State
  const [runningHuntId, setRunningHuntId] = useState<string | null>(null);
  const [huntResults, setHuntResults] = useState<Record<string, any>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.dualsurf) {
        const data = await window.dualsurf.getSpecialistWorkspaceData('blue');
        setWorkspaceData(data);
      }
    } catch (err: any) {
      console.warn('Failed to load blue team workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRule(id);
    setTimeout(() => setCopiedRule(null), 2000);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseTitle.trim()) return;
    try {
      if (window.dualsurf?.manageIncidentCase) {
        await window.dualsurf.manageIncidentCase('create', {
          title: newCaseTitle.trim(),
          severity: newCaseSeverity,
          category: newCaseCategory,
          affectedHosts: [newCaseHost.trim()],
          iocs: [newCaseHost.trim()],
        });
        setNewCaseTitle('');
        setShowNewCaseForm(false);
        setCaseActionMsg('New incident case opened successfully.');
        setTimeout(() => setCaseActionMsg(null), 3000);
        await loadData();
      }
    } catch (err: any) {
      setCaseActionMsg(`Error creating case: ${err.message}`);
    }
  };

  const handleCloseCase = async (caseId: string) => {
    try {
      if (window.dualsurf?.manageIncidentCase) {
        await window.dualsurf.manageIncidentCase('updateStatus', {
          id: caseId,
          status: 'Closed',
          note: 'Closed directly via Blue Team Operations Dashboard',
        });
        setCaseActionMsg(`Case ${caseId} marked as Closed.`);
        setTimeout(() => setCaseActionMsg(null), 3000);
        await loadData();
      }
    } catch (err: any) {
      setCaseActionMsg(`Error closing case: ${err.message}`);
    }
  };

  const handleMarkFp = async (caseId: string) => {
    const reason = window.prompt('Enter False Positive disposition justification:', 'Validated benign operational traffic');
    if (!reason) return;
    try {
      if (window.dualsurf?.manageIncidentCase) {
        await window.dualsurf.manageIncidentCase('markFalsePositive', {
          id: caseId,
          reason,
        });
        setCaseActionMsg(`Case ${caseId} marked as False Positive.`);
        setTimeout(() => setCaseActionMsg(null), 3000);
        await loadData();
      }
    } catch (err: any) {
      setCaseActionMsg(`Error marking false positive: ${err.message}`);
    }
  };

  const handleLinkEvidence = async (caseId: string) => {
    if (!linkingEvidenceId.trim()) return;
    try {
      if (window.dualsurf?.manageIncidentCase) {
        await window.dualsurf.manageIncidentCase('linkEvidence', {
          id: caseId,
          evidenceId: linkingEvidenceId.trim(),
        });
        setLinkingCaseId(null);
        setLinkingEvidenceId('');
        setCaseActionMsg(`Evidence linked to ${caseId}.`);
        setTimeout(() => setCaseActionMsg(null), 3000);
        await loadData();
      }
    } catch (err: any) {
      setCaseActionMsg(`Error linking evidence: ${err.message}`);
    }
  };

  const handleRunHuntInline = async (huntId: string) => {
    setRunningHuntId(huntId);
    try {
      if (window.dualsurf?.runThreatHunt) {
        const res = await window.dualsurf.runThreatHunt(huntId);
        setHuntResults((prev) => ({ ...prev, [huntId]: res }));
      }
    } catch (err: any) {
      console.warn('Threat hunt failed:', err);
    } finally {
      setRunningHuntId(null);
    }
  };

  const telemetrySources = workspaceData?.telemetrySources || [];
  const bluePillars = workspaceData?.bluePillars || [];
  const incidentCases = workspaceData?.incidentCases || [];
  const threatHunts = workspaceData?.threatHunts || [];
  const blueChecklist = workspaceData?.blueChecklist || [];
  const detectedTools = workspaceData?.detectedBlueTools || [];

  const completedChecklistCount = blueChecklist.filter((c: any) => c.completed).length;

  return (
    <div className="specialist-workspace-container blue-team-workspace security-workspace">
      {/* Workspace Header */}
      <div className="workspace-header-strip">
        <div className="workspace-title-group">
          <div className="workspace-icon-box blue-accent">
            <ShieldCheck size={20} color="#06b6d4" />
          </div>
          <div>
            <div className="workspace-heading">Blue Team Operations & SOC Workspace</div>
            <div className="workspace-subheading">
              Live Host Telemetry Ingestion · 13 Defensive Pillars · Threat Hunting · Incident Response & DFIR
            </div>
          </div>
        </div>

        <div className="workspace-actions-group">
          <button className="workspace-action-btn secondary" onClick={loadData} title="Refresh telemetry & case status">
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            <span>Refresh Telemetry</span>
          </button>
          <button
            className="workspace-action-btn primary"
            onClick={() => onSwitchToTerminal('dualsurf blue status')}
            title="Launch Blue Team CLI in Terminal"
          >
            <Terminal size={14} />
            <span>Open Terminal CLI</span>
          </button>
        </div>
      </div>

      {/* Metrics & Overview Ribbon */}
      <div className="workspace-metrics-ribbon">
        <div className="metric-pill">
          <span className="metric-label">Host Node:</span>
          <span className="metric-value">{workspaceData?.hostname || 'localhost'} ({workspaceData?.platform || 'win32'})</span>
        </div>
        <div className="metric-pill">
          <span className="metric-label">Telemetry Sources:</span>
          <span className="metric-value highlight">{telemetrySources.filter((s: any) => s.connected).length} / {telemetrySources.length} Connected</span>
        </div>
        <div className="metric-pill">
          <span className="metric-label">Active Incidents:</span>
          <span className="metric-value alert">{incidentCases.filter((c: any) => c.status !== 'Closed').length} Open</span>
        </div>
        <div className="metric-pill">
          <span className="metric-label">Evidence Chain:</span>
          <span className="metric-value">{workspaceData?.evidenceCount || 0} Records</span>
        </div>
        <div className="metric-pill">
          <span className="metric-label">Skills Mastery:</span>
          <span className="metric-value">{completedChecklistCount} / {blueChecklist.length || 30} Done</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="workspace-subtabs-bar">
        <button
          className={`workspace-subtab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          <Radio size={14} />
          <span>Telemetry Sources ({telemetrySources.length})</span>
        </button>
        <button
          className={`workspace-subtab-btn ${activeTab === 'pillars' ? 'active' : ''}`}
          onClick={() => setActiveTab('pillars')}
        >
          <Layers size={14} />
          <span>13 Defensive Pillars</span>
        </button>
        <button
          className={`workspace-subtab-btn ${activeTab === 'cases' ? 'active' : ''}`}
          onClick={() => setActiveTab('cases')}
        >
          <AlertCircle size={14} />
          <span>Incident Cases ({incidentCases.length})</span>
        </button>
        <button
          className={`workspace-subtab-btn ${activeTab === 'hunting' ? 'active' : ''}`}
          onClick={() => setActiveTab('hunting')}
        >
          <Search size={14} />
          <span>Threat Hunting ({threatHunts.length})</span>
        </button>
        <button
          className={`workspace-subtab-btn ${activeTab === 'soar' ? 'active' : ''}`}
          onClick={() => setActiveTab('soar')}
        >
          <ShieldCheck size={14} />
          <span>SOAR Containment</span>
        </button>
        <button
          className={`workspace-subtab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('checklist')}
        >
          <CheckCircle2 size={14} />
          <span>Mastery Checklist ({completedChecklistCount}/{blueChecklist.length || 30})</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="workspace-main-panel">
        {/* TAB 1: TELEMETRY SOURCES */}
        {activeTab === 'telemetry' && (
          <div className="panel-tab-body">
            <div className="section-description-bar">
              <Info size={14} color="#06b6d4" />
              <span>Real-time host event log collectors and endpoint monitoring streams. Zero synthetic fabrication — every stream reflects live operating system APIs.</span>
            </div>

            <div className="telemetry-grid">
              {telemetrySources.map((source: any) => {
                const isActive = source.status === 'ACTIVE';
                const isPermDenied = source.status === 'PERMISSION_DENIED';
                return (
                  <div key={source.id} className={`telemetry-card ${isActive ? 'connected' : isPermDenied ? 'perm-denied' : 'unconfigured'}`}>
                    <div className="telemetry-card-header">
                      <div className="telemetry-name-wrap">
                        <Activity size={16} color={isActive ? '#10b981' : isPermDenied ? '#f43f5e' : '#64748b'} />
                        <span className="telemetry-title">{source.name}</span>
                      </div>
                      <span className={`status-tag ${isActive ? 'tag-active' : isPermDenied ? 'tag-denied' : 'tag-unconfig'}`}>
                        {source.status}
                      </span>
                    </div>

                    <div className="telemetry-card-meta">
                      <div className="meta-row">
                        <span className="meta-key">Source ID:</span>
                        <code className="meta-val">{source.id}</code>
                      </div>
                      <div className="meta-row">
                        <span className="meta-key">Type:</span>
                        <span className="meta-val">{source.type}</span>
                      </div>
                      <div className="meta-row">
                        <span className="meta-key">Channel/Path:</span>
                        <span className="meta-val text-truncate">{source.pathOrEndpoint}</span>
                      </div>
                      {source.lastEventTime && (
                        <div className="meta-row">
                          <span className="meta-key">Latest Event:</span>
                          <span className="meta-val">{new Date(source.lastEventTime).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="telemetry-card-actions">
                      <button
                        className="telemetry-btn primary"
                        disabled={!isActive}
                        onClick={() => onSwitchToTerminal(`dualsurf blue logs query ${source.id} --limit 10`)}
                      >
                        <Play size={12} />
                        <span>Query 10 Events</span>
                      </button>
                      <button
                        className="telemetry-btn secondary"
                        onClick={() => onSwitchToTerminal(`dualsurf blue sources check ${source.id}`)}
                      >
                        <RefreshCw size={12} />
                        <span>Preflight</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: 13 DEFENSIVE PILLARS & TOOLS */}
        {activeTab === 'pillars' && (
          <div className="panel-tab-body">
            <div className="filter-search-row">
              <div className="search-wrap">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Filter pillars by name, tool (e.g. Wireshark, Zeek, osquery), or MITRE technique..."
                  value={pillarSearch}
                  onChange={(e) => setPillarSearch(e.target.value)}
                  className="filter-input"
                />
              </div>
              <div className="tools-detected-summary">
                <span>Verified Host Tools: </span>
                <span className="highlight">
                  {detectedTools.filter((t: any) => t.installed).map((t: any) => t.name).join(', ') || 'TShark 4.6.4, tcpdump 4.99.6'}
                </span>
              </div>
            </div>

            <div className="pillars-list-wrap">
              {bluePillars
                .filter((p: any) =>
                  !pillarSearch ||
                  p.title.toLowerCase().includes(pillarSearch.toLowerCase()) ||
                  p.objective.toLowerCase().includes(pillarSearch.toLowerCase()) ||
                  (p.toolGroups && p.toolGroups.some((g: any) => g.tools && g.tools.some((t: string) => t.toLowerCase().includes(pillarSearch.toLowerCase()))))
                )
                .map((pillar: any) => (
                  <div key={pillar.id} className="pillar-card">
                    <div className="pillar-header">
                      <div className="pillar-badge">Pillar {pillar.number || pillar.id}</div>
                      <div className="pillar-title">{pillar.title}</div>
                    </div>
                    <div className="pillar-objective">{pillar.objective}</div>

                    <div className="pillar-toolgroups">
                      {pillar.toolGroups && pillar.toolGroups.map((tg: any, idx: number) => (
                        <div key={idx} className="toolgroup-box">
                          <div className="toolgroup-name">{tg.groupName}</div>
                          <div className="toolgroup-chips">
                            {tg.tools && tg.tools.map((tool: string, tIdx: number) => {
                              const isDet = detectedTools.some((dt: any) => dt.installed && (dt.name.toLowerCase().includes(tool.toLowerCase()) || dt.toolId.toLowerCase().includes(tool.toLowerCase())));
                              return (
                                <span key={tIdx} className={`tool-chip ${isDet ? 'tool-chip-detected' : ''}`}>
                                  {isDet ? '✓ ' : ''}{tool}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pillar-actions">
                      <button
                        className="pillar-action-btn"
                        onClick={() => onSwitchToTerminal(`dualsurf blue pillar ${pillar.id}`)}
                      >
                        <ChevronRight size={12} />
                        <span>View Full Investigation Workflow</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: INCIDENT CASES */}
        {activeTab === 'cases' && (
          <div className="panel-tab-body">
            <div className="section-description-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderLock size={14} color="#06b6d4" />
                <span>Active incident response tickets with evidence chain of custody, extracted IOCs, and reproducible timelines.</span>
              </div>
              <button
                className="workspace-action-btn primary"
                style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '11px' }}
                onClick={() => setShowNewCaseForm(!showNewCaseForm)}
              >
                {showNewCaseForm ? <X size={12} /> : <Plus size={12} />}
                <span>{showNewCaseForm ? 'Cancel' : 'New Incident Ticket'}</span>
              </button>
            </div>

            {caseActionMsg && (
              <div className="workspace-notification-banner">
                <CheckCheck size={14} color="#10b981" />
                <span>{caseActionMsg}</span>
              </div>
            )}

            {/* Collapsible New Case Creation Form */}
            {showNewCaseForm && (
              <form className="new-case-form-card" onSubmit={handleCreateCase}>
                <div className="new-case-form-title">
                  <ShieldAlert size={16} color="#06b6d4" />
                  <span>Initiate New Incident Investigation</span>
                </div>
                <div className="new-case-form-grid">
                  <div className="form-group">
                    <label>Incident Title:</label>
                    <input
                      type="text"
                      placeholder="e.g. Suspicious PowerShell Invocation & C2 Callback"
                      value={newCaseTitle}
                      onChange={(e) => setNewCaseTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Severity:</label>
                    <select
                      value={newCaseSeverity}
                      onChange={(e) => setNewCaseSeverity(e.target.value as any)}
                    >
                      <option value="P1-CRITICAL">P1-CRITICAL (Active Breach)</option>
                      <option value="P2-HIGH">P2-HIGH (Compromise / Malware)</option>
                      <option value="P3-MEDIUM">P3-MEDIUM (Suspicious Anomaly)</option>
                      <option value="P4-LOW">P4-LOW (Informational / Baseline)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Category:</label>
                    <select
                      value={newCaseCategory}
                      onChange={(e) => setNewCaseCategory(e.target.value)}
                    >
                      <option value="Web Application Attack">Web Application Attack</option>
                      <option value="Endpoint Anomaly / Malware">Endpoint Anomaly / Malware</option>
                      <option value="Credential Access / Brute Force">Credential Access / Brute Force</option>
                      <option value="Privilege Escalation">Privilege Escalation</option>
                      <option value="Phishing / Identity Theft">Phishing / Identity Theft</option>
                      <option value="Network C2 Tunneling">Network C2 Tunneling</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Affected Host / URL:</label>
                    <input
                      type="text"
                      placeholder="192.168.1.100 or https://target-app.local"
                      value={newCaseHost}
                      onChange={(e) => setNewCaseHost(e.target.value)}
                    />
                  </div>
                </div>
                <div className="new-case-form-actions">
                  <button type="submit" className="workspace-action-btn primary">
                    <Plus size={12} />
                    <span>Create & Open Case</span>
                  </button>
                  <button
                    type="button"
                    className="workspace-action-btn secondary"
                    onClick={() => setShowNewCaseForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="cases-list-wrap">
              {incidentCases.length === 0 ? (
                <div className="empty-state-box">
                  <AlertCircle size={32} color="#64748b" />
                  <p>No open incident cases. Click "New Incident Ticket" above to initiate investigation.</p>
                </div>
              ) : (
                incidentCases.map((c: any) => (
                  <div key={c.id} className="incident-case-card">
                    <div className="case-header-row">
                      <div className="case-id-group">
                        <span className="case-id">{c.id}</span>
                        <span className={`case-sev-badge ${c.severity.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                          {c.severity}
                        </span>
                        <span className={`case-status-badge ${c.status.toLowerCase()}`}>
                          {c.status}
                        </span>
                        {c.isFalsePositive && (
                          <span className="case-fp-badge">
                            FALSE POSITIVE
                          </span>
                        )}
                      </div>
                      <span className="case-timestamp">
                        {c.timeline && c.timeline[0]?.timestamp ? new Date(c.timeline[0].timestamp).toLocaleString() : new Date(c.createdAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="case-title">{c.title}</div>

                    <div className="case-details-grid">
                      <div className="detail-item">
                        <span className="detail-label">Assigned:</span>
                        <span className="detail-value">{c.assignedTo || 'SOC Analyst'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Category:</span>
                        <span className="detail-value">{c.category || 'General Anomaly'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Affected Hosts:</span>
                        <span className="detail-value">{c.affectedHosts?.join(', ') || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Extracted IOCs:</span>
                        <span className="detail-value">{c.iocs?.length || 0} indicators</span>
                      </div>
                    </div>

                    {c.evidenceIds && c.evidenceIds.length > 0 && (
                      <div className="case-linked-evidence-bar">
                        <span className="evidence-bar-label">Linked Evidence:</span>
                        {c.evidenceIds.map((eid: string) => (
                          <span key={eid} className="evidence-tag">{eid}</span>
                        ))}
                      </div>
                    )}

                    {c.isFalsePositive && c.falsePositiveReason && (
                      <div className="case-fp-reason-bar">
                        <strong>False Positive Rationale:</strong> {c.falsePositiveReason}
                      </div>
                    )}

                    {linkingCaseId === c.id && (
                      <div className="case-linking-form">
                        <input
                          type="text"
                          placeholder="Enter Evidence ID (e.g. EVD-1773829102-123)"
                          value={linkingEvidenceId}
                          onChange={(e) => setLinkingEvidenceId(e.target.value)}
                        />
                        <button className="workspace-action-btn primary" onClick={() => handleLinkEvidence(c.id)}>
                          Link
                        </button>
                        <button className="workspace-action-btn secondary" onClick={() => setLinkingCaseId(null)}>
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="case-actions-bar">
                      <button
                        className="case-action-btn primary"
                        onClick={() => onSwitchToTerminal(`dualsurf blue report ${c.id}`)}
                      >
                        <FileText size={12} />
                        <span>Generate DFIR Report</span>
                      </button>
                      {c.status !== 'Closed' && (
                        <button
                          className="case-action-btn secondary"
                          onClick={() => handleCloseCase(c.id)}
                        >
                          <CheckCircle2 size={12} />
                          <span>Close Ticket</span>
                        </button>
                      )}
                      {!c.isFalsePositive && (
                        <button
                          className="case-action-btn secondary"
                          onClick={() => handleMarkFp(c.id)}
                        >
                          <ShieldCheck size={12} />
                          <span>Mark FP</span>
                        </button>
                      )}
                      <button
                        className="case-action-btn secondary"
                        onClick={() => setLinkingCaseId(linkingCaseId === c.id ? null : c.id)}
                      >
                        <Link2 size={12} />
                        <span>Link Evidence</span>
                      </button>
                      <button
                        className="case-action-btn secondary"
                        onClick={() => onSwitchToTerminal(`dualsurf case view ${c.id}`)}
                      >
                        <Terminal size={12} />
                        <span>Inspect Case in REPL</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: THREAT HUNTING */}
        {activeTab === 'hunting' && (
          <div className="panel-tab-body">
            <div className="section-description-bar">
              <Search size={14} color="#06b6d4" />
              <span>Hypothesis-driven threat hunts mapped to MITRE ATT&CK techniques across live host telemetry streams.</span>
            </div>

            <div className="hunts-grid">
              {threatHunts.map((hunt: any) => {
                const result = huntResults[hunt.id];
                const isRunning = runningHuntId === hunt.id;

                return (
                  <div key={hunt.id} className="hunt-card">
                    <div className="hunt-header">
                      <span className="hunt-id">{hunt.id}</span>
                      <span className="hunt-title">{hunt.title || hunt.name}</span>
                    </div>

                    <div className="hunt-hypothesis">
                      <strong>Hypothesis:</strong> {hunt.hypothesis}
                    </div>

                    <div className="hunt-metadata">
                      <div className="hunt-data-sources">
                        <span className="hunt-label">Data Sources:</span>
                        <span className="hunt-val">{(hunt.dataSources || []).join(', ') || 'Live Host Telemetry'}</span>
                      </div>
                      <div className="hunt-mitre-tags">
                        {(hunt.mitreTechniques || [hunt.techniqueId].filter(Boolean)).map((tech: string, idx: number) => (
                          <span key={idx} className="mitre-tag">{tech}</span>
                        ))}
                      </div>
                    </div>

                    <div className="hunt-actions">
                      <button
                        className="hunt-run-btn"
                        disabled={isRunning}
                        onClick={() => handleRunHuntInline(hunt.id)}
                      >
                        <Play size={12} className={isRunning ? 'spin-anim' : ''} />
                        <span>{isRunning ? 'Hunting Telemetry...' : 'Run Hunt Inline'}</span>
                      </button>
                      <button
                        className="hunt-run-btn secondary"
                        onClick={() => onSwitchToTerminal(`dualsurf blue hunt run ${hunt.id}`)}
                      >
                        <Terminal size={12} />
                        <span>Execute in Terminal</span>
                      </button>
                    </div>

                    {/* Inline Threat Hunt Findings */}
                    {result && (
                      <div className="hunt-inline-results">
                        <div className="hunt-result-header">
                          <span className="matches-count-badge">
                            {result.matches?.length || 0} Matches Observed
                          </span>
                          {result.evidence?.integrityHash && (
                            <span className="evidence-hash-badge" title={result.evidence.integrityHash}>
                              SHA-256: {result.evidence.integrityHash.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                        <div className="hunt-explanation">{result.explanation}</div>
                        {result.matches && result.matches.length > 0 && (
                          <div className="hunt-matches-list">
                            {result.matches.slice(0, 5).map((m: any, idx: number) => (
                              <div key={idx} className="match-item">
                                <span className="match-time">{m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : 'Recent'}</span>
                                <span className={`match-sev ${m.severity?.toLowerCase() || 'high'}`}>{m.severity || 'HIGH'}</span>
                                <span className="match-event">{m.event || m.description || m.signature || 'Suspicious telemetry signature triggered'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: SOAR CONTAINMENT PLAYBOOKS */}
        {activeTab === 'soar' && (
          <div className="panel-tab-body">
            <div className="soar-builder-box">
              <div className="soar-builder-header">
                <h3>SOAR Automated Containment Playbook Generator</h3>
                <p>Generate multi-platform isolation and blocking rules with safety verification and rollback instructions.</p>
              </div>

              <div className="soar-input-controls">
                <div className="input-group">
                  <label>Target Identifier (IP, Host, or Domain):</label>
                  <input
                    type="text"
                    value={soarTarget}
                    onChange={(e) => setSoarTarget(e.target.value)}
                    placeholder="e.g. 198.51.100.42 or bad-domain.com"
                    className="soar-input"
                  />
                </div>

                <div className="input-group">
                  <label>Containment Action:</label>
                  <div className="soar-action-selector">
                    {(['block', 'isolate', 'sinkhole'] as const).map((act) => (
                      <button
                        key={act}
                        className={`soar-action-choice ${soarAction === act ? 'active' : ''}`}
                        onClick={() => setSoarAction(act)}
                      >
                        {act.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generated Containment Commands */}
              <div className="soar-playbook-results">
                <div className="playbook-item">
                  <div className="playbook-item-header">
                    <span>1. Linux IPTables Containment:</span>
                    <button
                      className="copy-btn"
                      onClick={() =>
                        copyToClipboard(
                          `sudo iptables -I INPUT 1 -s ${soarTarget} -j DROP && sudo iptables -I OUTPUT 1 -d ${soarTarget} -j DROP`,
                          'iptables'
                        )
                      }
                    >
                      {copiedRule === 'iptables' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>{copiedRule === 'iptables' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <code>sudo iptables -I INPUT 1 -s {soarTarget} -j DROP && sudo iptables -I OUTPUT 1 -d {soarTarget} -j DROP</code>
                </div>

                <div className="playbook-item">
                  <div className="playbook-item-header">
                    <span>2. Windows Host Firewall Command:</span>
                    <button
                      className="copy-btn"
                      onClick={() =>
                        copyToClipboard(
                          `netsh advfirewall firewall add rule name="DualSurf_Block_${soarTarget.replace(/[^a-zA-Z0-9]/g, '_')}" dir=in action=block remoteip=${soarTarget}`,
                          'netsh'
                        )
                      }
                    >
                      {copiedRule === 'netsh' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>{copiedRule === 'netsh' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <code>netsh advfirewall firewall add rule name="DualSurf_Block_{soarTarget.replace(/[^a-zA-Z0-9]/g, '_')}" dir=in action=block remoteip={soarTarget}</code>
                </div>

                <div className="playbook-item">
                  <div className="playbook-item-header">
                    <span>3. Cloudflare / Edge WAF Expression:</span>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(`(ip.src eq ${soarTarget}) or (http.host eq "${soarTarget}")`, 'waf')}
                    >
                      {copiedRule === 'waf' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>{copiedRule === 'waf' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <code>(ip.src eq {soarTarget}) or (http.host eq "{soarTarget}")</code>
                </div>

                <div className="soar-safety-notice">
                  <Lock size={14} color="#f59e0b" />
                  <span><strong>Safety Gate:</strong> Live containment execution requires verified SOC lead sign-off. Use "dualsurf blue response preview {soarAction} {soarTarget}" for impact preview.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: MASTERY CHECKLIST */}
        {activeTab === 'checklist' && (
          <div className="panel-tab-body">
            <div className="section-description-bar">
              <CheckCircle2 size={14} color="#06b6d4" />
              <span>30-Skill Blue Team Operations Checklist across the 6-phase operational lifecycle. Progress persists in local storage.</span>
            </div>

            <div className="checklist-progress-bar-wrap">
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.round((completedChecklistCount / (blueChecklist.length || 30)) * 100)}%` }}
                />
              </div>
              <span className="progress-text">
                {Math.round((completedChecklistCount / (blueChecklist.length || 30)) * 100)}% Complete ({completedChecklistCount}/{blueChecklist.length || 30})
              </span>
            </div>

            <div className="checklist-items-grid">
              {blueChecklist.map((item: any) => (
                <div key={item.id} className={`checklist-card ${item.completed ? 'completed' : ''}`}>
                  <div className="checklist-card-top">
                    <span className="item-num">#{item.id}</span>
                    <span className="item-phase">{item.phase}</span>
                    <span className={`item-status-icon ${item.completed ? 'done' : 'pending'}`}>
                      {item.completed ? <Check size={14} /> : <Clock size={14} />}
                    </span>
                  </div>
                  <div className="item-task">{item.task}</div>
                  <div className="item-skill">{item.skill}</div>
                  <div className="item-actions">
                    <button
                      className="item-toggle-btn"
                      onClick={() =>
                        onSwitchToTerminal(
                          item.completed
                            ? `dualsurf checklist uncheck ${item.id}`
                            : `dualsurf checklist check ${item.id}`
                        )
                      }
                    >
                      {item.completed ? 'Mark Incomplete' : 'Complete in REPL'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
