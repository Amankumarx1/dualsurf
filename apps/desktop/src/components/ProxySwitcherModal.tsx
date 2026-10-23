import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  Shield,
  Layers,
  Check,
  AlertCircle,
  Radio,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { ProxyConfig } from '@dualsurf/shared-types';

interface ProxySwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProxyChanged?: (config: ProxyConfig) => void;
}

export const ProxySwitcherModal: React.FC<ProxySwitcherModalProps> = ({
  isOpen,
  onClose,
  onProxyChanged,
}) => {
  const [currentMode, setCurrentMode] = useState<ProxyConfig['mode']>('direct');
  const [customServer, setCustomServer] = useState('');
  const [bypassListStr, setBypassListStr] = useState('localhost; 127.0.0.1; <local>');
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    if (isOpen && window.dualsurf) {
      window.dualsurf.getSettings().then((s) => {
        if (s.proxy) {
          setCurrentMode(s.proxy.mode || 'direct');
          if (s.proxy.server) setCustomServer(s.proxy.server);
          if (s.proxy.bypassList && s.proxy.bypassList.length > 0) {
            setBypassListStr(s.proxy.bypassList.join('; '));
          }
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = async (mode: ProxyConfig['mode'], serverOverride?: string) => {
    setIsApplying(true);
    setStatusMessage(null);

    const bypassArray = bypassListStr
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    const config: ProxyConfig = {
      mode,
      server: mode === 'custom' ? (serverOverride || customServer) : undefined,
      bypassList: bypassArray,
    };

    try {
      if (window.dualsurf) {
        const success = await window.dualsurf.setProxy(config);
        if (success) {
          setCurrentMode(mode);
          setStatusMessage({ text: `Routing mode updated to: ${mode.toUpperCase()}` });
          if (onProxyChanged) onProxyChanged(config);
        } else {
          setStatusMessage({ text: 'Failed to update proxy settings in Electron session.', isError: true });
        }
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error configuring proxy', isError: true });
    } finally {
      setIsApplying(false);
    }
  };

  const PROXY_MODES = [
    {
      id: 'direct' as const,
      name: 'Direct Connection',
      badge: 'NORMAL',
      badgeClass: 'badge-direct',
      desc: 'Standard local DNS & direct network routing without proxy encapsulation.',
      icon: <Globe size={18} className="text-cyan" />,
      target: 'Direct socket route',
    },
    {
      id: 'tor' as const,
      name: 'Tor Onion Router',
      badge: 'ANONYMOUS',
      badgeClass: 'badge-tor',
      desc: 'Routes all browser traffic through local Tor SOCKS5 proxy (socks5://127.0.0.1:9050). Encrypts multiple hops.',
      icon: <Shield size={18} className="text-purple" />,
      target: 'socks5://127.0.0.1:9050',
    },
    {
      id: 'burp' as const,
      name: 'Burp Suite / OWASP ZAP',
      badge: 'INTERCEPTOR',
      badgeClass: 'badge-burp',
      desc: 'Routes traffic into local web security proxy (http://127.0.0.1:8080) for packet interception, tampering, and auditing.',
      icon: <Layers size={18} className="text-orange" />,
      target: 'http://127.0.0.1:8080',
    },
    {
      id: 'custom' as const,
      name: 'Custom SOCKS5 / HTTP Proxy',
      badge: 'MANUAL',
      badgeClass: 'badge-custom',
      desc: 'Connect via custom upstream proxy server (e.g. socks5://192.168.1.50:1080 or http://proxy.corp:3128).',
      icon: <Radio size={18} className="text-green" />,
      target: customServer || 'Configurable',
    },
  ];

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="proxy-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="proxy-modal-header">
          <div className="proxy-title-group">
            <div className="proxy-icon-halo">
              <Layers size={20} className="text-cyan" />
            </div>
            <div>
              <h2 className="proxy-modal-title">Proxy &amp; Anonymity Switcher</h2>
              <p className="proxy-modal-subtitle">
                Switch between Direct, Tor, Burp Suite, or Custom SOCKS5 upstream proxies instantly
              </p>
            </div>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {statusMessage && (
          <div className={`proxy-status-banner ${statusMessage.isError ? 'error' : 'success'}`}>
            {statusMessage.isError ? <AlertCircle size={15} /> : <Check size={15} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="proxy-modes-list">
          {PROXY_MODES.map((mode) => {
            const isSelected = currentMode === mode.id;
            return (
              <div
                key={mode.id}
                className={`proxy-mode-card ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  if (mode.id !== 'custom') {
                    handleApply(mode.id);
                  } else {
                    setCurrentMode('custom');
                  }
                }}
              >
                <div className="proxy-card-left">
                  <div className="proxy-card-radio-circle">
                    {isSelected && <div className="proxy-radio-dot" />}
                  </div>
                  <div className="proxy-card-icon-box">{mode.icon}</div>
                  <div className="proxy-card-info">
                    <div className="proxy-card-title-row">
                      <span className="proxy-card-name">{mode.name}</span>
                      <span className={`proxy-badge ${mode.badgeClass}`}>{mode.badge}</span>
                      {isSelected && <span className="proxy-active-pill">ACTIVE</span>}
                    </div>
                    <p className="proxy-card-desc">{mode.desc}</p>
                    <div className="proxy-card-route">
                      <span className="route-label">Endpoint:</span>
                      <code>{mode.target}</code>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {currentMode === 'custom' && (
          <div className="custom-proxy-config-box">
            <label className="custom-proxy-label">Custom Proxy URL (SOCKS5 / HTTP):</label>
            <div className="custom-proxy-input-row">
              <input
                type="text"
                className="custom-proxy-input"
                placeholder="socks5://127.0.0.1:1080 or http://10.0.0.1:8080"
                value={customServer}
                onChange={(e) => setCustomServer(e.target.value)}
              />
              <button
                className="btn-apply-custom-proxy"
                disabled={!customServer.trim() || isApplying}
                onClick={() => handleApply('custom')}
              >
                {isApplying ? <RefreshCw size={14} className="spin-icon" /> : 'Apply Route'}
              </button>
            </div>
          </div>
        )}

        <div className="proxy-bypass-section">
          <label className="bypass-label">Bypass List (Hosts that bypass the proxy):</label>
          <input
            type="text"
            className="bypass-input"
            value={bypassListStr}
            onChange={(e) => setBypassListStr(e.target.value)}
            placeholder="localhost; 127.0.0.1; <local>"
          />
          <span className="bypass-hint">Semicolon-separated hostnames or IP patterns</span>
        </div>

        <div className="proxy-modal-footer">
          <div className="proxy-footer-note">
            <Shield size={14} className="text-cyan" />
            <span>Applies immediately to all tabs in the active session without browser restart.</span>
          </div>
          <button className="proxy-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
