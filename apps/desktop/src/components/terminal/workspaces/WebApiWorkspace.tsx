import React, { useState, useEffect } from 'react';
import { Globe, Shield, Terminal, ArrowRight, Server, Key, Play, RefreshCw, ExternalLink } from 'lucide-react';

interface WebApiWorkspaceProps {
  onRunInTerminal?: (command: string) => void;
  activeUrl?: string;
}

export const WebApiWorkspace: React.FC<WebApiWorkspaceProps> = ({
  onRunInTerminal,
  activeUrl,
}) => {
  const [targetUrl, setTargetUrl] = useState<string>(activeUrl || 'https://example.com');
  const [proxyEnabled, setProxyEnabled] = useState<boolean>(false);
  const [proxyHost, setProxyHost] = useState<string>('127.0.0.1:8080');
  const [selectedTool, setSelectedTool] = useState<string>('headers');

  useEffect(() => {
    if (activeUrl && activeUrl !== 'about:blank') {
      setTargetUrl(activeUrl);
    }
  }, [activeUrl]);

  const handleInspectHeaders = () => {
    onRunInTerminal?.(`curl -I -sS -L "${targetUrl}"`);
  };

  const handleWhatWeb = () => {
    onRunInTerminal?.(`whatweb -v "${targetUrl}"`);
  };

  const handleNikto = () => {
    onRunInTerminal?.(`nikto -h "${targetUrl}" -Tuning 1,2,3,4`);
  };

  const handleSqlmap = () => {
    onRunInTerminal?.(`sqlmap -u "${targetUrl}" --batch --banner --level=1`);
  };

  const handleDirb = () => {
    onRunInTerminal?.(`gobuster dir -u "${targetUrl}" -w /usr/share/wordlists/dirb/common.txt -q -t 20`);
  };

  const handleSyncFromBrowser = () => {
    if (activeUrl && activeUrl !== 'about:blank') {
      setTargetUrl(activeUrl);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c1017', color: '#e6edf3', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#00d2ff' }}>
            <Globe size={20} />
            <span>Web & API Security Workspace</span>
          </h2>
          <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
            Browser-to-Terminal proxy interceptor, security header analysis, and authorized assessment tools
          </div>
        </div>

        {activeUrl && activeUrl !== 'about:blank' && (
          <button
            onClick={handleSyncFromBrowser}
            style={{
              background: 'rgba(0, 210, 255, 0.1)',
              border: '1px solid #00d2ff',
              color: '#00d2ff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowRight size={12} />
            <span>Bridge URL from Active Browser Tab</span>
          </button>
        )}
      </div>

      {/* Target Bar */}
      <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 600 }}>TARGET:</span>
        <input
          type="text"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
          style={{
            flex: 1,
            background: '#0c1017',
            border: '1px solid #30363d',
            color: '#00ffc8',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'monospace',
          }}
        />
        <button
          onClick={handleInspectHeaders}
          style={{
            background: '#00d2ff',
            border: 'none',
            color: '#0c1017',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Play size={12} />
          <span>Inspect Headers</span>
        </button>
      </div>

      {/* Tool Launch Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Nikto Card */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Nikto Web Scanner</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>v2.5.0</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Scan for dangerous files, outdated server software, and misconfigured SSL.
          </p>
          <button
            onClick={handleNikto}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Launch Nikto in Terminal</span>
          </button>
        </div>

        {/* WhatWeb Card */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>WhatWeb Tech Fingerprint</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>v0.5.5</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Identify CMS platforms, web servers, JavaScript libraries, and embedded analytics.
          </p>
          <button
            onClick={handleWhatWeb}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Fingerprint Technologies</span>
          </button>
        </div>

        {/* Gobuster Card */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Directory & API Enumeration</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>Gobuster / Dirb</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Brute-force hidden URIs, endpoints, and administration portals using Kali wordlists.
          </p>
          <button
            onClick={handleDirb}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Enumerate Directories</span>
          </button>
        </div>

        {/* SQLMap Card */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>SQLMap Injection Audit</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>v1.7</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Test parameters for SQL injection vulnerabilities and fingerprint backend databases.
          </p>
          <button
            onClick={handleSqlmap}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Launch SQLMap Audit</span>
          </button>
        </div>
      </div>

      {/* Proxy Integration Section */}
      <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={16} color="#00d2ff" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Upstream Intercepting Proxy (Burp Suite / OWASP ZAP)</span>
          </div>
          <span style={{ fontSize: '11px', color: proxyEnabled ? '#3fb950' : '#8b949e' }}>
            {proxyEnabled ? `Routing via ${proxyHost}` : 'Direct Connection'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setProxyHost('127.0.0.1:8080');
              setProxyEnabled(true);
              window.dualsurf?.setProxy?.({ type: 'http', host: '127.0.0.1', port: 8080 });
            }}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              color: '#f8f8f2',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Set Burp Suite (127.0.0.1:8080)
          </button>
          <button
            onClick={() => {
              setProxyHost('127.0.0.1:8081');
              setProxyEnabled(true);
              window.dualsurf?.setProxy?.({ type: 'http', host: '127.0.0.1', port: 8081 });
            }}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              color: '#f8f8f2',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Set OWASP ZAP (127.0.0.1:8081)
          </button>
          <button
            onClick={() => {
              setProxyEnabled(false);
              window.dualsurf?.setProxy?.({ type: 'direct' });
            }}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              color: '#f85149',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Disable Proxy
          </button>
        </div>
      </div>
    </div>
  );
};
