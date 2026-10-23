import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Check,
  X,
  Power,
  RefreshCw,
  Activity,
  Globe,
  Radio,
  ExternalLink,
} from 'lucide-react';
import type { CyberShieldStats, TabState } from '@dualsurf/shared-types';

interface CyberShieldDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabState | null;
  onOpenTrafficSniffer?: () => void;
  onOpenPrivacyAudit?: () => void;
  onOpenProxyModal?: () => void;
}

export const CyberShieldDropdown: React.FC<CyberShieldDropdownProps> = ({
  isOpen,
  onClose,
  activeTab,
  onOpenTrafficSniffer,
  onOpenPrivacyAudit,
  onOpenProxyModal,
}) => {
  const [stats, setStats] = useState<CyberShieldStats>({
    enabled: true,
    totalBlocked: 0,
    trackersBlocked: 0,
    adsBlocked: 0,
    malwareBlocked: 0,
    tabBlockedCount: 0,
    whitelistedDomains: [],
    recentBlocked: [],
  });
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);

  useEffect(() => {
    if (activeTab?.url) {
      try {
        const parsed = new URL(activeTab.url);
        setCurrentDomain(parsed.hostname);
        setIsWhitelisted(stats.whitelistedDomains.includes(parsed.hostname.toLowerCase()));
      } catch {
        setCurrentDomain('');
        setIsWhitelisted(false);
      }
    }
  }, [activeTab, stats.whitelistedDomains]);

  const loadStats = async () => {
    if (window.dualsurf?.getShieldStats) {
      try {
        const s = await window.dualsurf.getShieldStats(activeTab?.id);
        if (s) {
          setStats(s);
          if (currentDomain) {
            setIsWhitelisted(Array.isArray(s.whitelistedDomains) && s.whitelistedDomains.includes(currentDomain.toLowerCase()));
          }
        }
      } catch {}
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!window.dualsurf?.onShieldStats) return;
    const cleanup = window.dualsurf.onShieldStats((newStats) => {
      setStats(newStats);
      if (currentDomain) {
        setIsWhitelisted(Array.isArray(newStats?.whitelistedDomains) && newStats.whitelistedDomains.includes(currentDomain.toLowerCase()));
      }
    });
    return cleanup;
  }, [currentDomain]);

  const handleToggleShield = async () => {
    if (window.dualsurf?.toggleShield) {
      const enabled = await window.dualsurf.toggleShield();
      setStats((prev) => ({ ...prev, enabled }));
    }
  };

  const handleToggleWhitelist = async () => {
    if (!currentDomain || !window.dualsurf?.toggleShieldWhitelist) return;
    const whitelisted = await window.dualsurf.toggleShieldWhitelist(currentDomain);
    setIsWhitelisted(whitelisted);
    loadStats();
  };

  if (!isOpen) return null;

  return (
    <div className="dualsurf-shield-dropdown">
      <div className="shield-dropdown-header">
        <div className="shield-status-badge-row">
          <div className={`shield-icon-badge ${stats.enabled ? 'active' : 'disabled'}`}>
            {stats.enabled ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
          </div>
          <div>
            <h4 className="shield-title">
              {stats.enabled ? 'Cyber Shield Active' : 'Shield Protection Paused'}
            </h4>
            <span className="shield-subtitle">
              {stats.enabled
                ? 'Blocking ads, trackers, and cryptominers'
                : 'All web requests allowed'}
            </span>
          </div>
        </div>

        <button
          className={`shield-power-btn ${stats.enabled ? 'on' : 'off'}`}
          onClick={handleToggleShield}
          title={stats.enabled ? 'Disable Shield' : 'Enable Shield'}
        >
          <Power size={14} />
        </button>
      </div>

      {/* Metrics Row */}
      <div className="shield-metrics-grid">
        <div className="shield-metric-card highlight">
          <span className="metric-val">{stats.tabBlockedCount || stats.totalBlocked}</span>
          <span className="metric-lbl">Blocked on Tab</span>
        </div>
        <div className="shield-metric-card">
          <span className="metric-val">{stats.trackersBlocked}</span>
          <span className="metric-lbl">Trackers</span>
        </div>
        <div className="shield-metric-card">
          <span className="metric-val">{stats.adsBlocked}</span>
          <span className="metric-lbl">Ad Networks</span>
        </div>
        <div className="shield-metric-card">
          <span className="metric-val">{stats.malwareBlocked}</span>
          <span className="metric-lbl">Miners/Malware</span>
        </div>
      </div>

      {/* Domain Whitelist Row */}
      {currentDomain && (
        <div className="shield-site-setting">
          <div className="site-setting-info">
            <Globe size={14} className="site-icon" />
            <div className="site-text">
              <span className="site-domain">{currentDomain}</span>
              <span className="site-desc">
                {isWhitelisted ? 'Protection paused for this site' : 'Protected by Cyber Shield'}
              </span>
            </div>
          </div>

          <button
            className={`whitelist-toggle-btn ${isWhitelisted ? 'whitelisted' : 'protected'}`}
            onClick={handleToggleWhitelist}
          >
            {isWhitelisted ? 'Whitelisted' : 'Protected'}
          </button>
        </div>
      )}

      {/* Recent Blocked items list */}
      <div className="shield-recent-section">
        <div className="shield-section-header">
          <span className="section-title">Recent Interceptions</span>
          <span className="section-count">{stats.recentBlocked?.length || 0}</span>
        </div>

        <div className="shield-recent-list">
          {!stats.recentBlocked || stats.recentBlocked.length === 0 ? (
            <div className="shield-empty-recent">
              <ShieldCheck size={18} className="text-cyan mb-1" />
              <span>No malicious or tracking requests detected yet</span>
            </div>
          ) : (
            stats.recentBlocked.slice(0, 6).map((item, idx) => (
              <div key={idx} className="shield-recent-item">
                <span className={`category-tag ${item.category}`}>
                  {item.category.toUpperCase()}
                </span>
                <span className="recent-domain" title={item.url}>
                  {item.domain}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer link to Traffic Sniffer & Quick Tools */}
      <div className="shield-dropdown-footer">
        {onOpenTrafficSniffer && (
          <button
            className="shield-view-traffic-btn"
            onClick={() => {
              onClose();
              onOpenTrafficSniffer();
            }}
          >
            <Activity size={13} /> View Live Traffic Sniffer &amp; Headers <ExternalLink size={12} />
          </button>
        )}
        <div className="shield-footer-quick-row">
          {onOpenPrivacyAudit && (
            <button
              className="shield-quick-btn"
              onClick={() => {
                onClose();
                onOpenPrivacyAudit();
              }}
            >
              <Shield size={12} /> Run Leak Audit
            </button>
          )}
          {onOpenProxyModal && (
            <button
              className="shield-quick-btn"
              onClick={() => {
                onClose();
                onOpenProxyModal();
              }}
            >
              <Radio size={12} /> Switch Proxy / Tor
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
