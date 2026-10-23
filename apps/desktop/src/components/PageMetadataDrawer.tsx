import React, { useEffect, useState } from 'react';
import {
  Terminal,
  X,
  RefreshCw,
  Shield,
  Search,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Radio,
  Lock,
  Cookie,
  Database,
  ArrowRight,
  Crosshair,
  Layers,
} from 'lucide-react';
import type { PageMetadata, LinkItem, EndpointItem, IocFinding } from '@dualsurf/shared-types';
import { AttackSurfaceVisualizer } from './AttackSurfaceVisualizer';

interface PageMetadataDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTabId: string | null;
  onFollowLink: (linkId: number) => void;
  onRunTool?: (toolName: string) => void;
}

type DrawerTab = 'overview' | 'iocs' | 'surface' | 'links' | 'endpoints' | 'headings' | 'text';

export const PageMetadataDrawer: React.FC<PageMetadataDrawerProps> = ({
  isOpen,
  onClose,
  activeTabId,
  onFollowLink,
  onRunTool,
}) => {
  const [metadata, setMetadata] = useState<PageMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [linkSearch, setLinkSearch] = useState('');
  const [iocSearch, setIocSearch] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedIocVal, setCopiedIocVal] = useState<string | null>(null);

  const handleCopyIoc = (defanged: string) => {
    navigator.clipboard.writeText(defanged);
    setCopiedIocVal(defanged);
    setTimeout(() => setCopiedIocVal(null), 2000);
  };

  const fetchMetadata = async () => {
    if (!window.dualsurf || !activeTabId) return;
    setLoading(true);
    try {
      const data = await window.dualsurf.getPageMetadata(activeTabId);
      setMetadata(data);
    } catch (err) {
      console.error('Failed to inspect page:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTabId) {
      fetchMetadata();
      setLinkSearch('');
      setIocSearch('');
    }
  }, [isOpen, activeTabId]);

  const handleCopyText = () => {
    if (!metadata?.textSnippet) return;
    navigator.clipboard.writeText(metadata.textSnippet);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  if (!isOpen) return null;

  const filteredLinks = (metadata?.links || []).filter((l: LinkItem) => {
    const q = linkSearch.toLowerCase();
    return (
      (l.label && l.label.toLowerCase().includes(q)) ||
      (l.href && l.href.toLowerCase().includes(q))
    );
  });

  const endpoints = metadata?.endpoints || [];
  const forms = metadata?.forms || [];
  const cookies = metadata?.cookies || [];
  const storage = metadata?.storage || [];
  const iocs = metadata?.iocs || [];

  const filteredIocs = iocs.filter((ioc: IocFinding) => {
    const q = iocSearch.toLowerCase();
    return (
      ioc.value.toLowerCase().includes(q) ||
      ioc.defanged.toLowerCase().includes(q) ||
      ioc.type.toLowerCase().includes(q) ||
      ioc.reputation.toLowerCase().includes(q) ||
      ioc.mitreTags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="inspector-drawer-backdrop" onClick={onClose}>
      <aside
        className="inspector-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Page Metadata & Security Inspector"
      >
        {/* Header Bar */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <Terminal size={15} className="drawer-title-icon" />
            <span className="drawer-title-text">Page Inspector &amp; DOM Metadata</span>
            {metadata && (
              <>
                <span className="drawer-badge">{metadata.links?.length || 0} links</span>
                {iocs.length > 0 && (
                  <span className="drawer-badge" style={{ background: '#1e293b', color: '#f59e0b' }}>
                    {iocs.length} IOCs
                  </span>
                )}
              </>
            )}
          </div>
          <div className="drawer-header-actions">
            <button
              className="drawer-action-btn"
              onClick={fetchMetadata}
              title="Refresh snapshot"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'tab-loading-spinner' : ''} />
            </button>
            <button className="drawer-action-btn" onClick={onClose} title="Close drawer (Esc)">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Quick Security & Recon Action Strip */}
        <div className="drawer-quick-actions-strip">
          <button
            className="drawer-quick-btn"
            style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.1)' }}
            onClick={() => {
              onClose();
              onRunTool?.('assess');
            }}
            title="Run complete 1-command security assessment: attack surface, DNS, email, admin, ports & CVSS report"
          >
            <Shield size={12} style={{ color: '#ef4444' }} />
            <span style={{ color: '#f87171', fontWeight: 600 }}>Assess</span>
          </button>
          <button
            className="drawer-quick-btn"
            onClick={() => {
              onClose();
              onRunTool?.('recon');
            }}
            title="Run live reconnaissance & headers in terminal"
          >
            <Globe size={12} />
            <span>Recon</span>
          </button>
          <button
            className="drawer-quick-btn"
            onClick={() => {
              onClose();
              onRunTool?.('sec-audit');
            }}
            title="Run passive security audit in terminal"
          >
            <Shield size={12} />
            <span>Audit</span>
          </button>
          <button
            className="drawer-quick-btn"
            onClick={() => {
              onClose();
              onRunTool?.('cert');
            }}
            title="Inspect TLS/SSL certificate in terminal"
          >
            <Lock size={12} />
            <span>Cert</span>
          </button>
          <button
            className="drawer-quick-btn"
            onClick={() => {
              onClose();
              onRunTool?.('secrets');
            }}
            title="Scan DOM and storage for leaked secrets"
          >
            <Radio size={12} />
            <span>Secrets</span>
          </button>
          <button
            className="drawer-quick-btn"
            onClick={() => {
              setActiveTab('iocs');
            }}
            title="Inspect in-page harvested IOCs & defanged indicators"
          >
            <Crosshair size={12} />
            <span>IOCs ({iocs.length})</span>
          </button>
          <button
            className="drawer-quick-btn"
            onClick={() => {
              onClose();
              onRunTool?.('endpoints');
            }}
            title="List detected endpoints in terminal"
          >
            <ArrowRight size={12} />
            <span>Endpoints</span>
          </button>
          <button
            className="drawer-quick-btn"
            onClick={() => {
              setActiveTab('surface');
            }}
            title="Interactive Attack Surface & Network Topology Graph"
            style={{ borderColor: 'rgba(255, 255, 255, 0.25)', background: 'rgba(255, 255, 255, 0.08)' }}
          >
            <Layers size={12} style={{ color: '#ffffff' }} />
            <span style={{ color: '#ffffff', fontWeight: 600 }}>Surface</span>
          </button>
          <button
            className="drawer-quick-btn"
            onClick={() => {
              onClose();
              onRunTool?.('ports');
            }}
            title="Scan perimeter network ports and fingerprint exposed services"
          >
            <Database size={12} />
            <span>Ports</span>
          </button>
        </div>

        {/* Drawer Tabs Navigation */}
        <div className="drawer-tabs-strip">
          <button
            className={`drawer-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'iocs' ? 'active' : ''}`}
            onClick={() => setActiveTab('iocs')}
          >
            IOCs ({iocs.length})
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'surface' ? 'active' : ''}`}
            onClick={() => setActiveTab('surface')}
          >
            Attack Surface
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'links' ? 'active' : ''}`}
            onClick={() => setActiveTab('links')}
          >
            Links ({metadata?.links?.length || 0})
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'endpoints' ? 'active' : ''}`}
            onClick={() => setActiveTab('endpoints')}
          >
            Endpoints ({endpoints.length})
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'headings' ? 'active' : ''}`}
            onClick={() => setActiveTab('headings')}
          >
            Headings ({metadata?.headings?.length || 0})
          </button>
          <button
            className={`drawer-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            Text Stream
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="drawer-body-scroll">
          {activeTab === 'overview' && (
            <div className="drawer-section-stack">
              <div className="drawer-card">
                <div className="drawer-card-label">PAGE TITLE</div>
                <div className="drawer-card-val-strong">{metadata?.title || 'No Title'}</div>
                <div className="drawer-card-label" style={{ marginTop: 8 }}>URL</div>
                <div className="drawer-card-val-link">{metadata?.url || 'about:blank'}</div>
              </div>

              <div className="drawer-stat-grid">
                <div className="drawer-stat-box" onClick={() => setActiveTab('iocs')} style={{ cursor: 'pointer' }}>
                  <span className="stat-count" style={{ color: iocs.length > 0 ? '#ffffff' : undefined }}>{iocs.length}</span>
                  <span className="stat-name">In-Page IOCs</span>
                </div>
                <div className="drawer-stat-box">
                  <span className="stat-count">{metadata?.links?.length || 0}</span>
                  <span className="stat-name">Numbered Links</span>
                </div>
                <div className="drawer-stat-box">
                  <span className="stat-count">{endpoints.length}</span>
                  <span className="stat-name">Endpoints</span>
                </div>
                <div className="drawer-stat-box">
                  <span className="stat-count">{cookies.length}</span>
                  <span className="stat-name">Cookies</span>
                </div>
              </div>

              {/* Cookies & Storage Snapshot */}
              <div className="drawer-card">
                <div className="drawer-card-title-row">
                  <Cookie size={14} />
                  <span>Session Cookies ({cookies.length})</span>
                </div>
                {cookies.length > 0 ? (
                  <div className="drawer-items-list">
                    {cookies.slice(0, 10).map((c, i) => (
                      <div key={i} className="drawer-cookie-row">
                        <span className="cookie-name">{c.name}</span>
                        <span className="cookie-val">{c.value || '(empty)'}</span>
                      </div>
                    ))}
                    {cookies.length > 10 && (
                      <div className="drawer-more-hint">...and {cookies.length - 10} more cookies</div>
                    )}
                  </div>
                ) : (
                  <div className="drawer-empty-text">No cookies detected on active page.</div>
                )}
              </div>

              {/* Storage */}
              <div className="drawer-card">
                <div className="drawer-card-title-row">
                  <Database size={14} />
                  <span>LocalStorage ({storage.length})</span>
                </div>
                {storage.length > 0 ? (
                  <div className="drawer-items-list">
                    {storage.slice(0, 8).map((s, i) => (
                      <div key={i} className="drawer-cookie-row">
                        <span className="cookie-name">{s.key}</span>
                        <span className="cookie-val">{s.value || '(empty)'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="drawer-empty-text">No localStorage items found.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'surface' && (
            <div style={{ height: '100%', minHeight: '480px' }}>
              <AttackSurfaceVisualizer
                metadata={metadata}
                onOpenUrl={(url) => {
                  onClose();
                  window.dualsurf?.createTab({ url });
                }}
                onRunAudit={(target) => {
                  onClose();
                  onRunTool?.(`assess ${target}`);
                }}
              />
            </div>
          )}

          {activeTab === 'iocs' && (
            <div className="drawer-section-stack">
              <div className="drawer-search-wrap">
                <Search size={13} className="search-icon" />
                <input
                  type="text"
                  className="drawer-search-input"
                  placeholder="Filter IOCs by indicator, type, hash, reputation, or MITRE tag..."
                  value={iocSearch}
                  onChange={(e) => setIocSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="drawer-card" style={{ padding: '8px 12px', background: '#090d16', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Passively harvested &amp; auto-defanged from active page DOM &amp; scripts:
                  </span>
                  <span className="drawer-badge" style={{ background: '#27272a', color: '#ffffff' }}>
                    {filteredIocs.length} detected
                  </span>
                </div>
              </div>

              <div className="drawer-iocs-scroll-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredIocs.length > 0 ? (
                  filteredIocs.map((ioc, idx) => (
                    <div
                      key={idx}
                      className="drawer-ioc-card"
                      style={{
                        padding: '10px 12px',
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span
                            className="endpoint-badge"
                            style={{
                              background: '#27272a',
                              color: '#ffffff',
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {ioc.type.toUpperCase()}
                          </span>
                          {ioc.isPrivate && (
                            <span
                              style={{
                                background: '#14532d',
                                color: '#4ade80',
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              RFC1918 Private
                            </span>
                          )}
                          <span
                            style={{
                              background:
                                ioc.reputation === 'MALICIOUS'
                                  ? '#7f1d1d'
                                  : ioc.reputation === 'SUSPICIOUS'
                                  ? '#78350f'
                                  : ioc.reputation === 'BENIGN'
                                  ? '#14532d'
                                  : '#1e293b',
                              color:
                                ioc.reputation === 'MALICIOUS'
                                  ? '#fca5a5'
                                  : ioc.reputation === 'SUSPICIOUS'
                                  ? '#fcd34d'
                                  : ioc.reputation === 'BENIGN'
                                  ? '#86efac'
                                  : '#94a3b8',
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontWeight: 500,
                            }}
                          >
                            {ioc.reputation}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="drawer-copy-text-btn"
                            style={{ padding: '3px 8px', fontSize: '11px', height: 24 }}
                            onClick={() => handleCopyIoc(ioc.defanged)}
                            title="Copy defanged indicator to clipboard"
                          >
                            {copiedIocVal === ioc.defanged ? (
                              <Check size={11} color="#10b981" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{copiedIocVal === ioc.defanged ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            className="drawer-copy-text-btn"
                            style={{ padding: '3px 8px', fontSize: '11px', height: 24, color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.3)' }}
                            onClick={() => {
                              onClose();
                              onRunTool?.(`ioc ${ioc.value}`);
                            }}
                            title="Triage this IOC in terminal"
                          >
                            <span>Triage</span>
                          </button>
                          <button
                            className="drawer-copy-text-btn"
                            style={{ padding: '3px 8px', fontSize: '11px', height: 24, color: '#f87171', borderColor: '#b91c1c' }}
                            onClick={() => {
                              onClose();
                              onRunTool?.(`soar block ${ioc.value}`);
                            }}
                            title="Generate SOAR drop rule for this IOC"
                          >
                            <span>SOAR Block</span>
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: '#f8fafc',
                          wordBreak: 'break-all',
                          background: '#020617',
                          padding: '6px 8px',
                          borderRadius: 4,
                          border: '1px solid #1e293b',
                        }}
                      >
                        {ioc.defanged}
                      </div>

                      {ioc.mitreTags && ioc.mitreTags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                          {ioc.mitreTags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              style={{
                                fontSize: '10px',
                                color: '#a78bfa',
                                background: 'rgba(167, 139, 250, 0.1)',
                                padding: '2px 6px',
                                borderRadius: 3,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="drawer-empty-text">No IOCs match your filter.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="drawer-section-stack">
              <div className="drawer-search-wrap">
                <Search size={13} className="search-icon" />
                <input
                  type="text"
                  className="drawer-search-input"
                  placeholder="Filter links by label or URL..."
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="drawer-links-scroll-list">
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((link) => (
                    <div
                      key={link.id}
                      className="drawer-numbered-link-row"
                      onClick={() => {
                        onFollowLink(link.id);
                        onClose();
                      }}
                      title={`Click to navigate to link #${link.id}: ${link.href}`}
                    >
                      <span className="link-num-badge">[{link.id}]</span>
                      <div className="link-content-col">
                        <span className="link-label-text">{link.label}</span>
                        <span className="link-url-text">{link.href}</span>
                      </div>
                      <ExternalLink size={12} className="link-action-icon" />
                    </div>
                  ))
                ) : (
                  <div className="drawer-empty-text">No links match your filter.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'endpoints' && (
            <div className="drawer-section-stack">
              <div className="drawer-card">
                <div className="drawer-card-title-row">
                  <ArrowRight size={14} />
                  <span>Detected DOM Endpoints ({endpoints.length})</span>
                </div>
                {endpoints.length > 0 ? (
                  <div className="drawer-endpoints-list">
                    {endpoints.map((ep: EndpointItem) => (
                      <div key={ep.id} className="drawer-endpoint-row">
                        <span className={`endpoint-badge category-${ep.category}`}>
                          {ep.category.toUpperCase()}
                        </span>
                        <span className="endpoint-method">{ep.method}</span>
                        <span className="endpoint-path" title={ep.url}>{ep.path}</span>
                        {ep.isExternal && <span className="endpoint-ext-tag">EXT</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="drawer-empty-text">No endpoints detected on this page.</div>
                )}
              </div>

              {forms.length > 0 && (
                <div className="drawer-card">
                  <div className="drawer-card-title-row">
                    <Shield size={14} />
                    <span>Form Security Analysis ({forms.length})</span>
                  </div>
                  <div className="drawer-forms-list">
                    {forms.map((f, i) => (
                      <div key={i} className="drawer-form-row">
                        <div className="form-method-tag">{f.method}</div>
                        <div className="form-info-col">
                          <span className="form-action-text">{f.action}</span>
                          <div className="form-flags-row">
                            {f.hasPassword && <span className="flag-pill warning">password</span>}
                            {f.hasCsrfToken ? (
                              <span className="flag-pill success">csrf-protected</span>
                            ) : (
                              <span className="flag-pill danger">no-csrf</span>
                            )}
                            {f.isCleartext && <span className="flag-pill danger">CLEARTEXT</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'headings' && (
            <div className="drawer-section-stack">
              {metadata?.headings && metadata.headings.length > 0 ? (
                <div className="drawer-headings-tree">
                  {metadata.headings.map((h, i) => (
                    <div
                      key={i}
                      className={`drawer-heading-item level-${h.level}`}
                      style={{ paddingLeft: `${(h.level - 1) * 14}px` }}
                    >
                      <span className="heading-tag">H{h.level}</span>
                      <span className="heading-text">{h.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="drawer-empty-text">No headings detected on active page.</div>
              )}
            </div>
          )}

          {activeTab === 'text' && (
            <div className="drawer-section-stack">
              <div className="drawer-text-toolbar">
                <span className="drawer-text-meta">
                  {metadata?.textSnippet ? `${metadata.textSnippet.length} characters extracted` : '0 characters'}
                </span>
                <button
                  className="drawer-copy-text-btn"
                  onClick={handleCopyText}
                  disabled={!metadata?.textSnippet}
                >
                  {copiedText ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
              <pre className="drawer-text-stream-box">
                {metadata?.textSnippet || 'No readable text content extracted.'}
              </pre>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
