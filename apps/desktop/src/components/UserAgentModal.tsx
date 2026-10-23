import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Monitor,
  Bot,
  Shield,
  Check,
  EyeOff,
  Fingerprint,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import type { UserAgentProfile } from '@dualsurf/shared-types';

interface UserAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileChanged?: (profile: UserAgentProfile) => void;
}

const UA_PROFILES: UserAgentProfile[] = [
  {
    id: 'default',
    name: 'Default (Native Chromium)',
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    deviceType: 'desktop',
  },
  {
    id: 'win-chrome',
    name: 'Google Chrome (Windows 11)',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    platform: 'Win32',
    deviceType: 'desktop',
  },
  {
    id: 'mac-safari',
    name: 'Apple Safari 18 (macOS Sequoia)',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
    platform: 'MacIntel',
    deviceType: 'desktop',
  },
  {
    id: 'linux-firefox',
    name: 'Mozilla Firefox 134 (Linux x86_64)',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
    platform: 'Linux x86_64',
    deviceType: 'desktop',
  },
  {
    id: 'iphone-safari',
    name: 'Mobile Safari (iPhone 16 Pro / iOS 18)',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    deviceType: 'mobile',
  },
  {
    id: 'android-chrome',
    name: 'Chrome Mobile (Google Pixel 9 / Android 15)',
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    deviceType: 'mobile',
  },
  {
    id: 'googlebot',
    name: 'Googlebot Crawler (Search Engine Bot)',
    userAgent:
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    platform: 'Linux',
    deviceType: 'bot',
  },
  {
    id: 'sec-auditor',
    name: 'DualSurf Security Auditor (Research Mode)',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DualSurf-SecurityAuditEngine/2.0 (Defensive Research)',
    platform: 'Win32',
    deviceType: 'bot',
  },
];

export const UserAgentModal: React.FC<UserAgentModalProps> = ({
  isOpen,
  onClose,
  onProfileChanged,
}) => {
  const [activeId, setActiveId] = useState('default');
  const [antiFingerprint, setAntiFingerprint] = useState(false);
  const [customUa, setCustomUa] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && window.dualsurf) {
      window.dualsurf.getSettings().then((s) => {
        if (s.activeUserAgentId) setActiveId(s.activeUserAgentId);
        if (s.antiFingerprintEnabled !== undefined) setAntiFingerprint(s.antiFingerprintEnabled);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectProfile = async (profile: UserAgentProfile) => {
    setActiveId(profile.id);
    setIsCustomMode(false);
    if (window.dualsurf) {
      await window.dualsurf.setUserAgent(profile.userAgent, profile.id);
      setStatusMsg(`User-Agent updated to ${profile.name}`);
      setTimeout(() => setStatusMsg(null), 3000);
      if (onProfileChanged) onProfileChanged(profile);
    }
  };

  const handleApplyCustomUa = async () => {
    if (!customUa.trim() || !window.dualsurf) return;
    await window.dualsurf.setUserAgent(customUa.trim(), 'custom');
    setActiveId('custom');
    setStatusMsg('Custom User-Agent applied to active session.');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleToggleAntiFingerprint = async () => {
    const next = !antiFingerprint;
    setAntiFingerprint(next);
    if (window.dualsurf) {
      await window.dualsurf.toggleAntiFingerprint(next);
    }
  };

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="ua-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="ua-modal-header">
          <div className="ua-title-group">
            <div className="ua-icon-halo">
              <Fingerprint size={20} className="text-cyan" />
            </div>
            <div>
              <h2 className="ua-modal-title">User-Agent &amp; Anti-Fingerprint Cloak</h2>
              <p className="ua-modal-subtitle">
                Spoof browser identity and protect against canvas/audio fingerprinting trackers
              </p>
            </div>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {statusMsg && (
          <div className="ua-status-banner">
            <Check size={14} className="text-green" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Anti-Fingerprint Cloak Toggle Card */}
        <div className="anti-fp-toggle-card">
          <div className="anti-fp-info">
            <div className="anti-fp-title-row">
              <EyeOff size={16} className={antiFingerprint ? 'text-green' : 'text-gray'} />
              <span className="anti-fp-title">Anti-Fingerprint Noise Mask</span>
              <span className={`fp-status-badge ${antiFingerprint ? 'badge-on' : 'badge-off'}`}>
                {antiFingerprint ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <p className="anti-fp-desc">
              Adds subtle, non-disruptive cryptographic noise to Canvas, WebGL, and AudioContext APIs to scramble device tracking hashes.
            </p>
          </div>
          <button
            className={`anti-fp-switch-btn ${antiFingerprint ? 'active' : ''}`}
            onClick={handleToggleAntiFingerprint}
          >
            <div className="switch-handle" />
          </button>
        </div>

        {/* Profiles Grid */}
        <div className="ua-profiles-grid">
          {UA_PROFILES.map((profile) => {
            const isSelected = activeId === profile.id;
            return (
              <div
                key={profile.id}
                className={`ua-profile-card ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectProfile(profile)}
              >
                <div className="ua-profile-top">
                  <div className="ua-device-icon">
                    {profile.deviceType === 'mobile' ? (
                      <Smartphone size={16} />
                    ) : profile.deviceType === 'bot' ? (
                      <Bot size={16} />
                    ) : (
                      <Monitor size={16} />
                    )}
                  </div>
                  <div className="ua-profile-name-box">
                    <span className="ua-profile-name">{profile.name}</span>
                    <span className="ua-platform-badge">{profile.platform}</span>
                  </div>
                  {isSelected && <span className="ua-selected-dot" />}
                </div>
                <div className="ua-string-preview" title={profile.userAgent}>
                  {profile.userAgent}
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom User-Agent input */}
        <div className="ua-custom-section">
          <div className="ua-custom-toggle-row" onClick={() => setIsCustomMode(!isCustomMode)}>
            <Sliders size={14} className="text-cyan" />
            <span className="custom-toggle-label">Enter Custom User-Agent String</span>
          </div>
          {isCustomMode && (
            <div className="custom-ua-box">
              <input
                type="text"
                className="custom-ua-input"
                placeholder="Enter complete custom User-Agent string..."
                value={customUa}
                onChange={(e) => setCustomUa(e.target.value)}
              />
              <button
                className="btn-apply-custom-ua"
                disabled={!customUa.trim()}
                onClick={handleApplyCustomUa}
              >
                Apply Custom UA
              </button>
            </div>
          )}
        </div>

        <div className="ua-modal-footer">
          <div className="ua-footer-note">
            <Shield size={14} className="text-cyan" />
            <span>Updates `navigator.userAgent` and HTTP `User-Agent` request header instantaneously.</span>
          </div>
          <button className="proxy-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
