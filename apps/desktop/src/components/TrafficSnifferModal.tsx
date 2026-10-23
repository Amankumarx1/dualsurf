import React, { useState, useEffect } from 'react';
import {
  Activity,
  X,
  Search,
  Filter,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  Layers,
  FileCode,
  Shield,
  Send,
  Copy,
  Check,
} from 'lucide-react';
import type { TrafficLogEntry, TabState } from '@dualsurf/shared-types';

interface TrafficSnifferModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabState | null;
  onSendToRepeater?: (req: { url: string; method: string; headers: Record<string, string> }) => void;
}

export const TrafficSnifferModal: React.FC<TrafficSnifferModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSendToRepeater,
}) => {
  const [entries, setEntries] = useState<TrafficLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [onlyCurrentTab, setOnlyCurrentTab] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TrafficLogEntry | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const loadTraffic = async () => {
    if (window.dualsurf?.getTrafficLogs) {
      try {
        const logs = await window.dualsurf.getTrafficLogs({
          tabId: onlyCurrentTab && activeTab ? activeTab.id : undefined,
          search: search.trim() || undefined,
          method: methodFilter !== 'ALL' ? methodFilter : undefined,
        });
        setEntries(logs || []);
        if (logs && logs.length > 0 && !selectedEntry) {
          setSelectedEntry(logs[0]);
        }
      } catch (err) {
        console.warn('Failed to load traffic logs:', err);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTraffic();
    }
  }, [isOpen, search, methodFilter, onlyCurrentTab]);

  useEffect(() => {
    if (!isOpen || !window.dualsurf?.onTrafficEntry) return;

    const cleanup = window.dualsurf.onTrafficEntry((entry) => {
      setEntries((prev) => {
        if (onlyCurrentTab && activeTab && entry.tabId !== activeTab.id) {
          return prev;
        }
        return [entry, ...prev.slice(0, 499)];
      });
    });

    return cleanup;
  }, [isOpen, onlyCurrentTab, activeTab]);

  const handleClear = async () => {
    if (window.dualsurf?.clearTrafficLogs) {
      await window.dualsurf.clearTrafficLogs();
      setEntries([]);
      setSelectedEntry(null);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `dualsurf-traffic-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyCurl = (entry: TrafficLogEntry) => {
    let curl = `curl -X ${entry.method} "${entry.url}"`;
    if (entry.headers) {
      Object.entries(entry.headers).forEach(([k, v]) => {
        curl += ` \\\n  -H "${k}: ${v}"`;
      });
    }
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  if (!isOpen) return null;

  const filteredEntries = entries.filter((e) => {
    if (methodFilter !== 'ALL' && e.method !== methodFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return e.url.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q);
    }
    return true;
  });

  const getStatusColor = (status?: number, blocked?: boolean) => {
    if (blocked) return '#ef4444';
    if (!status) return '#64748b';
    if (status >= 200 && status < 300) return '#10b981';
    if (status >= 300 && status < 400) return '#ffffff';
    if (status >= 400 && status < 500) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="traffic-sniffer-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sniffer-header">
          <div className="sniffer-title-box">
            <div className="sniffer-icon-halo">
              <Activity size={20} className="text-cyan" />
            </div>
            <div>
              <h2 className="sniffer-modal-title">Live Cyber Traffic Sniffer</h2>
              <p className="sniffer-modal-subtitle">
                Inspect in-flight HTTP requests, latency, headers, and security flaws in real-time
              </p>
            </div>
          </div>

          <div className="sniffer-header-actions">
            <button className="sniffer-action-btn" onClick={handleExportJson} title="Export Traffic Log">
              <Download size={14} />
              <span>Export</span>
            </button>
            <button className="sniffer-action-btn danger" onClick={handleClear} title="Clear Traffic Log">
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
            <button className="modal-close-icon-btn" onClick={onClose} title="Close (Esc)">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="sniffer-toolbar">
          <div className="sniffer-search-box">
            <Search size={14} className="text-cyan-muted" />
            <input
              type="text"
              placeholder="Filter by URL or hostname..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="sniffer-filter-group">
            <select
              className="sniffer-select"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="ALL">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="OPTIONS">OPTIONS</option>
            </select>

            <button
              className={`sniffer-tab-toggle ${onlyCurrentTab ? 'active' : ''}`}
              onClick={() => setOnlyCurrentTab(!onlyCurrentTab)}
            >
              <Filter size={13} />
              <span>Current Tab Only</span>
            </button>
          </div>
        </div>

        {/* Content Layout: Left Table, Right Inspection Drawer */}
        <div className="sniffer-body-layout">
          {/* Requests Table */}
          <div className="sniffer-table-container">
            <table className="sniffer-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Host &amp; Path</th>
                  <th>Latency</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="sniffer-empty-row">
                      No matching network requests recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`sniffer-row ${selectedEntry?.id === entry.id ? 'selected' : ''}`}
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td>
                        <span className={`method-badge ${entry.method.toLowerCase()} ${entry.blocked ? 'blocked' : ''}`}>
                          {entry.blocked ? 'BLOCK' : entry.method}
                        </span>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            color: getStatusColor(entry.status, entry.blocked),
                            backgroundColor: `${getStatusColor(entry.status, entry.blocked)}18`,
                          }}
                        >
                          {entry.blocked ? '403 (Shield)' : entry.status || '---'}
                        </span>
                      </td>
                      <td className="url-cell" title={entry.url}>
                        <span className="domain-part">{entry.domain}</span>
                        <span className="path-part">
                          {entry.url.replace(`https://${entry.domain}`, '').replace(`http://${entry.domain}`, '') || '/'}
                        </span>
                      </td>
                      <td className="latency-cell">
                        {entry.latencyMs !== undefined ? `${entry.latencyMs}ms` : '---'}
                      </td>
                      <td className="type-cell">{entry.resourceType}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Right Inspection Details Panel */}
          {selectedEntry && (
            <div className="sniffer-detail-panel">
              <div className="detail-header">
                <div className="detail-title-row">
                  <span className={`method-badge ${selectedEntry.method.toLowerCase()}`}>
                    {selectedEntry.method}
                  </span>
                  <span className="detail-status" style={{ color: getStatusColor(selectedEntry.status, selectedEntry.blocked) }}>
                    {selectedEntry.blocked ? 'BLOCKED' : `${selectedEntry.status || 200} ${selectedEntry.statusText || 'OK'}`}
                  </span>
                </div>

                <div className="detail-action-buttons">
                  {onSendToRepeater && (
                    <button
                      className="btn-detail-action highlight"
                      onClick={() => onSendToRepeater({
                        url: selectedEntry.url,
                        method: selectedEntry.method,
                        headers: selectedEntry.headers || {},
                      })}
                      title="Send request to Burp-Style Repeater"
                    >
                      <Send size={12} />
                      <span>Send to Repeater</span>
                    </button>
                  )}
                  <button
                    className="btn-detail-action"
                    onClick={() => handleCopyCurl(selectedEntry)}
                    title="Copy cURL command to clipboard"
                  >
                    {copiedCurl ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                    <span>{copiedCurl ? 'Copied' : 'cURL'}</span>
                  </button>
                </div>
              </div>

              <div className="detail-content">
                {/* General */}
                <div className="detail-section">
                  <div className="section-label">General</div>
                  <div className="detail-kv">
                    <span className="key">Request URL:</span>
                    <span className="val break-all">{selectedEntry.url}</span>
                  </div>
                  <div className="detail-kv">
                    <span className="key">Host:</span>
                    <span className="val">{selectedEntry.domain}</span>
                  </div>
                  <div className="detail-kv">
                    <span className="key">Resource:</span>
                    <span className="val">{selectedEntry.resourceType}</span>
                  </div>
                  {selectedEntry.latencyMs !== undefined && (
                    <div className="detail-kv">
                      <span className="key">Latency:</span>
                      <span className="val">{selectedEntry.latencyMs} ms</span>
                    </div>
                  )}
                </div>

                {/* Security Flags */}
                {selectedEntry.securityIssues && selectedEntry.securityIssues.length > 0 && (
                  <div className="detail-section">
                    <div className="section-label text-orange">Security Anomalies</div>
                    <ul className="security-flaws-list">
                      {selectedEntry.securityIssues.map((issue, idx) => (
                        <li key={idx} className="flaw-item">
                          <AlertTriangle size={12} />
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Request Headers */}
                <div className="detail-section">
                  <div className="section-label">Request Headers</div>
                  <div className="headers-box">
                    {selectedEntry.headers && Object.keys(selectedEntry.headers).length > 0 ? (
                      Object.entries(selectedEntry.headers).map(([k, v]) => (
                        <div key={k} className="header-line">
                          <span className="header-k">{k}:</span>
                          <span className="header-v">{v}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-muted text-xs">No custom headers recorded</span>
                    )}
                  </div>
                </div>

                {/* Response Headers */}
                {selectedEntry.responseHeaders && Object.keys(selectedEntry.responseHeaders).length > 0 && (
                  <div className="detail-section">
                    <div className="section-label">Response Headers</div>
                    <div className="headers-box">
                      {Object.entries(selectedEntry.responseHeaders).map(([k, v]) => (
                        <div key={k} className="header-line">
                          <span className="header-k">{k}:</span>
                          <span className="header-v">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
