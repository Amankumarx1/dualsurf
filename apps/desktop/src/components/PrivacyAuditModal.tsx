import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  Radio,
  Lock,
  Check,
  Cpu,
} from 'lucide-react';
import type { PrivacyDiagnosticResult, BrowserSettings } from '@dualsurf/shared-types';

interface PrivacyAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProxyModal?: () => void;
  onOpenUserAgentModal?: () => void;
}

export const PrivacyAuditModal: React.FC<PrivacyAuditModalProps> = ({
  isOpen,
  onClose,
  onOpenProxyModal,
  onOpenUserAgentModal,
}) => {
  const [running, setRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<PrivacyDiagnosticResult | null>(null);
  const [settings, setSettings] = useState<BrowserSettings | null>(null);

  const runAudit = async () => {
    setRunning(true);
    const issues: string[] = [];
    let score = 100;

    // 1. Fetch current settings
    let currentSettings: BrowserSettings | null = null;
    if (window.dualsurf) {
      try {
        currentSettings = await window.dualsurf.getSettings();
        setSettings(currentSettings);
      } catch {}
    }

    // 2. WebRTC Leak Detection via RTCPeerConnection
    const webrtcIps: string[] = [];
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pc.createDataChannel('');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          pc.close();
          resolve();
        }, 1500);

        pc.onicecandidate = (ice) => {
          if (!ice || !ice.candidate || !ice.candidate.candidate) {
            clearTimeout(timeout);
            pc.close();
            resolve();
            return;
          }
          const cand = ice.candidate.candidate;
          const ipMatch = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(cand);
          if (ipMatch && !webrtcIps.includes(ipMatch[1])) {
            webrtcIps.push(ipMatch[1]);
          }
        };
      });
    } catch {
      // RTCPeerConnection might be blocked by environment
    }

    const webrtcLeaking = webrtcIps.length > 0;
    if (webrtcLeaking) {
      score -= 25;
      issues.push(`WebRTC candidate leak detected: ${webrtcIps.join(', ')}. Your local ISP IP may be exposed even over proxies.`);
    }

    // 3. Canvas Fingerprinting Entropy Test
    let canvasHash = 'unknown';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 40;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(10, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('DualSurf-AntiFP-Entropy', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('DualSurf-AntiFP-Entropy', 4, 17);
        const dataUrl = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < dataUrl.length; i++) {
          hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
          hash |= 0;
        }
        canvasHash = `0x${Math.abs(hash).toString(16).padStart(8, '0')}`;
      }
    } catch {}

    const antiFingerprintActive = Boolean(currentSettings?.antiFingerprintEnabled);
    if (!antiFingerprintActive) {
      score -= 15;
      issues.push('Canvas & WebGL anti-fingerprinting noise mask is currently inactive.');
    }

    // 4. Proxy / Anonymity Routing
    const proxyMode = currentSettings?.proxy?.mode || 'direct';
    if (proxyMode === 'direct') {
      score -= 20;
      issues.push('Traffic routing directly via clearnet (no Tor or anonymizing SOCKS5 proxy configured).');
    }

    // 5. Cyber Shield status
    const cyberShieldActive = currentSettings?.cyberShieldEnabled !== false;
    if (!cyberShieldActive) {
      score -= 25;
      issues.push('Cyber Shield in-flight telemetry and ad-blocker is paused.');
    }

    // Final Grade Calculation
    score = Math.max(0, Math.min(100, score));
    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
    if (score < 60) grade = 'F';
    else if (score < 75) grade = 'C';
    else if (score < 85) grade = 'B';
    else grade = 'A';

    setDiagnostics({
      webrtcLeaking,
      webrtcIps,
      canvasHash,
      antiFingerprintActive,
      proxyMode,
      cyberShieldActive,
      overallScore: score,
      grade,
      issues,
    });
    setRunning(false);
  };

  useEffect(() => {
    if (isOpen) {
      runAudit();
    }
  }, [isOpen]);

  const handleOneClickHarden = async () => {
    if (!window.dualsurf) return;
    setRunning(true);
    try {
      // 1. Enable Tor proxy route
      await window.dualsurf.setProxy({ mode: 'tor' });
      // 2. Enable Anti-fingerprint noise
      await window.dualsurf.toggleAntiFingerprint(true);
      // 3. Enable Cyber Shield
      if (window.dualsurf.toggleShield) {
        await window.dualsurf.toggleShield();
      }
      // Re-run diagnostic
      await runAudit();
    } catch (err) {
      console.warn('Failed to harden privacy:', err);
    } finally {
      setRunning(false);
    }
  };

  if (!isOpen) return null;

  const getScoreColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return '#00ff88';
      case 'B':
        return '#ffffff';
      case 'C':
        return '#f59e0b';
      default:
        return '#ef4444';
    }
  };

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="privacy-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="privacy-modal-header">
          <div className="repeater-title-group">
            <div
              className="repeater-icon-halo"
              style={{
                background: 'rgba(0, 255, 136, 0.12)',
                borderColor: 'rgba(0, 255, 136, 0.3)',
              }}
            >
              <ShieldCheck size={20} className="text-green" />
            </div>
            <div>
              <h2 className="repeater-modal-title">Privacy Health &amp; Leak Diagnostics</h2>
              <p className="repeater-modal-subtitle">
                Proactively inspect WebRTC STUN leaks, Canvas entropy profiling, and routing isolation
              </p>
            </div>
          </div>
          <div className="cookie-header-actions">
            <button
              className="sniffer-action-btn"
              onClick={runAudit}
              disabled={running}
              title="Re-run Diagnostics"
            >
              <RefreshCw size={13} className={running ? 'spin-icon' : ''} />
              <span>{running ? 'Probing...' : 'Re-test'}</span>
            </button>
            <button className="modal-close-icon-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Hero Score Card */}
        {diagnostics && (
          <div className="privacy-score-hero">
            <div className="score-ring-wrap">
              <div
                className="score-badge-circle"
                style={{
                  borderColor: getScoreColor(diagnostics.grade),
                  boxShadow: `0 0 20px ${getScoreColor(diagnostics.grade)}30`,
                }}
              >
                <span className="score-grade-letter" style={{ color: getScoreColor(diagnostics.grade) }}>
                  {diagnostics.grade}
                </span>
                <span className="score-val-label">{diagnostics.overallScore}/100</span>
              </div>
            </div>

            <div className="score-summary-text">
              <div className="summary-title-row">
                <span className="summary-title">
                  {diagnostics.grade === 'A'
                    ? 'Excellent Privacy Isolation'
                    : diagnostics.grade === 'B'
                    ? 'Strong Defensive Posture'
                    : 'Privacy Vulnerabilities Detected'}
                </span>
                <span
                  className="privacy-mode-pill"
                  style={{ color: getScoreColor(diagnostics.grade) }}
                >
                  ROUTE: {diagnostics.proxyMode.toUpperCase()}
                </span>
              </div>
              <p className="summary-desc">
                {diagnostics.issues.length === 0
                  ? 'All privacy defenses are operational. WebRTC is quarantined, anti-fingerprinting noise mask is active, and tracker shielding is enforced.'
                  : `${diagnostics.issues.length} potential tracking or identity leakage vectors were identified.`}
              </p>
              {diagnostics.overallScore < 85 && (
                <button className="btn-one-click-harden" onClick={handleOneClickHarden}>
                  <ShieldCheck size={14} />
                  <span>1-Click Maximum Privacy Harden (Tor + Anti-Fingerprint + Shield)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Diagnostic Probes Grid */}
        {diagnostics && (
          <div className="privacy-probes-grid">
            {/* Probe 1: WebRTC */}
            <div className={`probe-card ${diagnostics.webrtcLeaking ? 'warning' : 'safe'}`}>
              <div className="probe-top">
                <Radio size={16} className={diagnostics.webrtcLeaking ? 'text-red' : 'text-green'} />
                <span className="probe-title">WebRTC IP Probe</span>
                <span className={`probe-badge ${diagnostics.webrtcLeaking ? 'badge-warn' : 'badge-good'}`}>
                  {diagnostics.webrtcLeaking ? 'LEAK RISK' : 'SECURE'}
                </span>
              </div>
              <p className="probe-desc">
                {diagnostics.webrtcIps.length === 0
                  ? 'No STUN candidates leaked. Public IP is safely masked.'
                  : `Candidates discovered: ${diagnostics.webrtcIps.join(', ')}`}
              </p>
            </div>

            {/* Probe 2: Anti-Fingerprint Noise */}
            <div className={`probe-card ${diagnostics.antiFingerprintActive ? 'safe' : 'warning'}`}>
              <div className="probe-top">
                <Fingerprint size={16} className={diagnostics.antiFingerprintActive ? 'text-green' : 'text-orange'} />
                <span className="probe-title">Canvas / Audio Entropy</span>
                <span className={`probe-badge ${diagnostics.antiFingerprintActive ? 'badge-good' : 'badge-warn'}`}>
                  {diagnostics.antiFingerprintActive ? 'CLOAKED' : 'UNMASKED'}
                </span>
              </div>
              <p className="probe-desc">
                Current Canvas digest: <code>{diagnostics.canvasHash}</code>.
                {diagnostics.antiFingerprintActive
                  ? ' Cryptographic jitter is actively scrambling tracking hashes.'
                  : ' Static hash enables cross-site device profiling.'}
              </p>
            </div>

            {/* Probe 3: Proxy & Anonymity */}
            <div className={`probe-card ${diagnostics.proxyMode !== 'direct' ? 'safe' : 'neutral'}`}>
              <div className="probe-top">
                <Globe size={16} className={diagnostics.proxyMode !== 'direct' ? 'text-purple' : 'text-cyan'} />
                <span className="probe-title">Network Routing Mode</span>
                <span className="probe-badge badge-neutral">{diagnostics.proxyMode.toUpperCase()}</span>
              </div>
              <p className="probe-desc">
                {diagnostics.proxyMode === 'tor'
                  ? 'Multi-hop Onion routing via local Tor SOCKS5 proxy.'
                  : diagnostics.proxyMode === 'burp'
                  ? 'Intercepting proxy route via Burp Suite / OWASP ZAP.'
                  : 'Direct TCP connection. Switch to Tor for onion anonymity.'}
              </p>
            </div>

            {/* Probe 4: Cyber Shield */}
            <div className={`probe-card ${diagnostics.cyberShieldActive ? 'safe' : 'warning'}`}>
              <div className="probe-top">
                <ShieldCheck size={16} className={diagnostics.cyberShieldActive ? 'text-green' : 'text-red'} />
                <span className="probe-title">Cyber Shield Blocker</span>
                <span className={`probe-badge ${diagnostics.cyberShieldActive ? 'badge-good' : 'badge-warn'}`}>
                  {diagnostics.cyberShieldActive ? 'ENFORCED' : 'OFF'}
                </span>
              </div>
              <p className="probe-desc">
                {diagnostics.cyberShieldActive
                  ? 'Known telemetry, cryptominers, and ad tracking hosts are blocked in-flight.'
                  : 'Protection disabled. Third-party trackers can monitor navigation.'}
              </p>
            </div>
          </div>
        )}

        {/* Issues List */}
        {diagnostics && diagnostics.issues.length > 0 && (
          <div className="privacy-issues-panel">
            <span className="issues-header-label">Recommended Remediation Steps:</span>
            <div className="issues-list">
              {diagnostics.issues.map((iss, idx) => (
                <div key={idx} className="issue-row">
                  <AlertTriangle size={13} className="text-orange" />
                  <span>{iss}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="privacy-modal-footer">
          <div className="privacy-footer-note">
            <Lock size={14} className="text-cyan" />
            <span>Audited client-side against active Chromium session flags.</span>
          </div>
          <button className="proxy-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
