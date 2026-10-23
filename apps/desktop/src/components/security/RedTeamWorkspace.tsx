import React, { useState, useEffect } from 'react';
import {
  Crosshair,
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
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

interface RedTeamWorkspaceProps {
  onSwitchToTerminal: (command?: string) => void;
  activeUrl?: string;
}

export const RedTeamWorkspace: React.FC<RedTeamWorkspaceProps> = ({
  onSwitchToTerminal,
  activeUrl = '',
}) => {
  const [activeTab, setActiveTab] = useState<'pillars' | 'findings' | 'scope' | 'checklist'>('pillars');
  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [targetInput, setTargetInput] = useState(activeUrl);
  const [scopeResult, setScopeResult] = useState<{ checked: boolean; inScope?: boolean; reason?: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.dualsurf) {
        const data = await window.dualsurf.getSpecialistWorkspaceData('red');
        setWorkspaceData(data);
      }
    } catch (err: any) {
      console.warn('Failed to load red team workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (activeUrl && !targetInput) {
      setTargetInput(activeUrl);
    }
  }, [activeUrl]);

  const handleValidateScope = () => {
    if (!targetInput.trim()) return;
    try {
      let hostname = targetInput.trim();
      try {
        hostname = new URL(targetInput.startsWith('http') ? targetInput : `https://${targetInput}`).hostname;
      } catch {}

      const scopes = workspaceData?.engagementScopes || [];
      if (scopes.length === 0) {
        setScopeResult({
          checked: true,
          inScope: true,
          reason: `No strict RoE boundaries defined. Target ${hostname} permitted under general assessment scope.`,
        });
        return;
      }

      let inScope = false;
      let matchedScope = '';
      for (const scope of scopes) {
        if (scope.targets && scope.targets.some((t: string) => hostname.includes(t) || t === '*' || t.includes(hostname))) {
          inScope = true;
          matchedScope = scope.name;
          break;
        }
      }

      setScopeResult({
        checked: true,
        inScope,
        reason: inScope
          ? `Target ${hostname} is explicitly authorized under engagement: "${matchedScope}".`
          : `Target ${hostname} is NOT listed in active Rules of Engagement scope! Obtain authorization before testing.`,
      });
    } catch {
      setScopeResult({ checked: true, inScope: false, reason: 'Invalid target address entered.' });
    }
  };

  const handleLaunchScan = async () => {
    if (!targetInput.trim()) return;
    setIsScanning(true);
    setScanMessage('Verifying target scope and launching DualSurf automated security audit...');
    try {
      if (window.dualsurf) {
        const res = await window.dualsurf.generateSecurityReport(targetInput);
        if (res?.success) {
          setScanMessage(`Audit completed with Security Score ${res.result?.securityScore}/100. ${res.result?.findings?.length || 0} findings recorded.`);
          loadData();
        } else {
          setScanMessage(`Scan error: ${res?.error || 'Target unreachable'}`);
        }
      }
    } catch (err: any) {
      setScanMessage(`Failed to execute assessment: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const pillars = workspaceData?.redPillars || [
    {
      id: 1,
      title: 'Reconnaissance & Asset Discovery',
      description: 'Passive DNS enumeration, Certificate Transparency, subdomain discovery, and attack surface mapping.',
      tools: ['subfinder', 'amass', 'theHarvester', 'assetfinder', 'dnsx', 'httpx'],
      sampleCommand: 'dualsurf recon',
    },
    {
      id: 2,
      title: 'Perimeter & Port Scanning',
      description: 'TCP/UDP port scanning, service version detection, TLS certificate analysis, and banner grabbing.',
      tools: ['nmap', 'naabu', 'rustscan', 'masscan', 'wireshark'],
      sampleCommand: 'dualsurf ports',
    },
    {
      id: 3,
      title: 'Web Application & API Pentesting',
      description: 'OWASP Top 10 evaluation, CORS auditing, security headers, endpoints, parameter fuzzing, and secret leakage.',
      tools: ['nuclei', 'ffuf', 'sqlmap', 'dalfox', 'whatweb', 'nikto'],
      sampleCommand: 'dualsurf sec-audit',
    },
    {
      id: 4,
      title: 'Internal Network & Active Directory',
      description: 'Kerberos abuse, BloodHound graph analysis, SMB enumeration, and privilege escalation.',
      tools: ['bloodhound', 'impacket', 'netexec', 'certipy', 'enum4linux'],
      sampleCommand: 'dualsurf red',
    },
    {
      id: 5,
      title: 'Cloud & Container Security',
      description: 'AWS/Azure/GCP misconfigurations, IAM privilege escalation, open S3 buckets, and Kubernetes auditing.',
      tools: ['prowler', 'scoutsuite', 'trivy', 'checkov', 'kube-bench'],
      sampleCommand: 'dualsurf pillars',
    },
    {
      id: 6,
      title: 'Wireless, RF & Physical',
      description: '802.11 WPA2/WPA3 enterprise inspection, rogue AP detection, and Bluetooth LE analysis.',
      tools: ['aircrack-ng', 'kismet', 'wifite', 'bettercap'],
      sampleCommand: 'dualsurf tools',
    },
    {
      id: 7,
      title: 'Social Engineering & Emulation',
      description: 'Phishing campaign simulation, credential harvesting defense verification, and payload delivery testing.',
      tools: ['gophish', 'social-engineer-toolkit', 'caldera'],
      sampleCommand: 'dualsurf purple',
    },
  ];

  const findings = workspaceData?.findingsList || [];
  const checklist = workspaceData?.redChecklist || [];

  return (
    <div className="specialist-workspace-container red-team-workspace security-workspace">
      {/* Workspace Header */}
      <div className="workspace-header-strip">
        <div className="workspace-title-group">
          <div className="workspace-icon-box red-accent">
            <Crosshair size={20} color="#f43f5e" />
          </div>
          <div>
            <div className="workspace-heading">Red Team Operations Workspace</div>
            <div className="workspace-subheading">
              Ethical Offensive Assessment · Rules of Engagement Scope · 7 Security Pillars · Findings Store
            </div>
          </div>
        </div>

        <div className="workspace-actions-group">
          <button className="workspace-action-btn secondary" onClick={loadData} title="Refresh data">
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="workspace-action-btn primary"
            onClick={() => onSwitchToTerminal('dualsurf red')}
            title="Launch Red Team CLI in Terminal"
          >
            <Terminal size={14} />
            <span>Open Terminal CLI</span>
          </button>
        </div>
      </div>

      {/* Target Scope Verification Bar */}
      <div className="workspace-target-bar">
        <div className="target-input-wrap">
          <span className="target-prefix">Target Scope:</span>
          <input
            type="text"
            className="workspace-target-input"
            placeholder="e.g. https://target-app.internal or domain.com"
            value={targetInput}
            onChange={(e) => {
              setTargetInput(e.target.value);
              setScopeResult(null);
            }}
          />
        </div>

        <div className="target-buttons-wrap">
          <button className="scope-check-btn" onClick={handleValidateScope}>
            <Shield size={14} />
            <span>Validate RoE Scope</span>
          </button>
          <button
            className="scope-scan-btn"
            onClick={handleLaunchScan}
            disabled={isScanning}
          >
            <Play size={14} />
            <span>{isScanning ? 'Auditing...' : 'Run Security Audit'}</span>
          </button>
        </div>
      </div>

      {/* Scope Result Feedback */}
      {scopeResult && (
        <div className={`scope-feedback-banner ${scopeResult.inScope ? 'in-scope' : 'out-of-scope'}`}>
          {scopeResult.inScope ? (
            <CheckCircle2 size={16} color="#10b981" />
          ) : (
            <AlertTriangle size={16} color="#f43f5e" />
          )}
          <span>{scopeResult.reason}</span>
        </div>
      )}

      {scanMessage && (
        <div className="scan-status-banner">
          <Info size={15} color="#38bdf8" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* Workspace Navigation Tabs */}
      <div className="workspace-tabs-row">
        <button
          className={`workspace-tab-btn ${activeTab === 'pillars' ? 'active' : ''}`}
          onClick={() => setActiveTab('pillars')}
        >
          <Layers size={14} />
          <span>7 Operational Pillars</span>
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'findings' ? 'active' : ''}`}
          onClick={() => setActiveTab('findings')}
        >
          <AlertTriangle size={14} />
          <span>Pentest Findings ({findings.length})</span>
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('checklist')}
        >
          <CheckCircle2 size={14} />
          <span>Skills Checklist ({checklist.length})</span>
        </button>
        <button
          className={`workspace-tab-btn ${activeTab === 'scope' ? 'active' : ''}`}
          onClick={() => setActiveTab('scope')}
        >
          <FolderLock size={14} />
          <span>Rules of Engagement Scopes</span>
        </button>
      </div>

      {/* Tab 1: 7 Operational Pillars */}
      {activeTab === 'pillars' && (
        <div className="workspace-tab-content">
          <div className="pillars-grid">
            {pillars.map((pillar: any) => (
              <div key={pillar.id} className="pillar-card">
                <div className="pillar-card-header">
                  <div className="pillar-num-badge">Pillar 0{pillar.id}</div>
                  <h3 className="pillar-title">{pillar.title}</h3>
                </div>
                <p className="pillar-desc">{pillar.description}</p>

                <div className="pillar-tools-section">
                  <div className="tools-label">Supported Tools & Utilities:</div>
                  <div className="tools-tag-row">
                    {pillar.tools.map((tool: string) => (
                      <span key={tool} className="tool-tag">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pillar-card-footer">
                  <button
                    className="pillar-run-btn"
                    onClick={() => onSwitchToTerminal(pillar.sampleCommand || 'dualsurf')}
                    title={`Run ${pillar.title} in Terminal`}
                  >
                    <Terminal size={13} />
                    <span>Run in Terminal</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Pentest Findings Store */}
      {activeTab === 'findings' && (
        <div className="workspace-tab-content">
          {findings.length === 0 ? (
            <div className="workspace-empty-card">
              <CheckCircle2 size={32} color="#10b981" />
              <h4>No security findings recorded yet</h4>
              <p>Run an automated security audit or command assessment above to log real findings with CVSS scores and remediations.</p>
            </div>
          ) : (
            <div className="findings-table-card">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Vulnerability Title</th>
                    <th>Category</th>
                    <th>Affected Asset</th>
                    <th>Remediation</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f: any, idx: number) => {
                    const sev = (f.severity || 'LOW').toUpperCase();
                    const badgeClass =
                      sev === 'CRITICAL' ? 'badge-crit' : sev === 'HIGH' ? 'badge-high' : sev === 'MEDIUM' ? 'badge-med' : 'badge-low';
                    return (
                      <tr key={f.id || idx}>
                        <td>
                          <span className={`severity-badge ${badgeClass}`}>{sev}</span>
                        </td>
                        <td>
                          <div className="finding-title-bold">{f.title}</div>
                          {f.cveList && f.cveList.length > 0 && (
                            <div className="finding-cve-sub">{f.cveList.join(', ')}</div>
                          )}
                        </td>
                        <td>{f.category || 'General'}</td>
                        <td>
                          <code className="asset-code">{f.affectedAsset || targetInput || 'Host'}</code>
                        </td>
                        <td className="remediation-text">{f.remediation || 'Apply security updates and review permissions.'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Skills Checklist */}
      {activeTab === 'checklist' && (
        <div className="workspace-tab-content">
          <div className="checklist-card">
            <div className="checklist-header">
              <div className="checklist-title">Red Team Methodology & Verification Checklist</div>
              <div className="checklist-sub">32-Domain Security Engineering & Assessment Readiness</div>
            </div>
            <div className="checklist-items-list">
              {checklist.length === 0 ? (
                <div className="workspace-empty-card">
                  <Info size={24} color="#71717a" />
                  <p>Standard checklist initializing from core engine...</p>
                </div>
              ) : (
                checklist.map((item: any) => (
                  <div key={item.id} className={`checklist-row ${item.completed ? 'completed' : ''}`}>
                    <div className="check-box-icon">
                      {item.completed ? <CheckCircle2 size={16} color="#10b981" /> : <div className="uncheck-dot" />}
                    </div>
                    <div className="check-text-group">
                      <div className="check-category">{item.category}</div>
                      <div className="check-task">{item.task}</div>
                    </div>
                    {item.completed && <span className="completed-tag">Verified</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Scope / Rules of Engagement */}
      {activeTab === 'scope' && (
        <div className="workspace-tab-content">
          <div className="scope-register-card">
            <div className="scope-header">
              <h4>Authorized Rules of Engagement Scopes</h4>
              <p>Targets authorized for vulnerability scanning, port mapping, and exploit verification.</p>
            </div>
            <div className="scope-list">
              {(workspaceData?.engagementScopes || []).length === 0 ? (
                <div className="scope-item default-scope">
                  <div className="scope-title">Default Localhost & Lab Boundary</div>
                  <div className="scope-targets">
                    <code>localhost</code>, <code>127.0.0.1</code>, <code>*.local</code>, <code>*.internal</code>
                  </div>
                  <div className="scope-status in-scope">Active / Pre-authorized for Safe Self-Testing</div>
                </div>
              ) : (
                workspaceData.engagementScopes.map((scope: any) => (
                  <div key={scope.id} className="scope-item">
                    <div className="scope-title">{scope.name}</div>
                    <div className="scope-targets">
                      {scope.targets?.map((t: string) => (
                        <code key={t}>{t}</code>
                      ))}
                    </div>
                    <div className="scope-status in-scope">Authorized Scope</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
