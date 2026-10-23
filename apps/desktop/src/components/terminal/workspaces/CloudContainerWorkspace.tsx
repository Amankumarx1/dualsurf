import React, { useState } from 'react';
import { Cloud, Box, Terminal, Shield, Play, AlertTriangle, Layers } from 'lucide-react';

interface CloudContainerWorkspaceProps {
  onRunInTerminal?: (command: string) => void;
}

export const CloudContainerWorkspace: React.FC<CloudContainerWorkspaceProps> = ({ onRunInTerminal }) => {
  const [imageName, setImageName] = useState<string>('alpine:3.18');

  const handleTrivyScan = () => {
    onRunInTerminal?.(`trivy image --severity HIGH,CRITICAL "${imageName}"`);
  };

  const handleDockerPs = () => {
    onRunInTerminal?.(`docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"`);
  };

  const handleCheckCapabilities = () => {
    onRunInTerminal?.(`capsh --print`);
  };

  const handleContainerEscapeCheck = () => {
    onRunInTerminal?.(`cat /proc/1/cgroup && ls -la /dev`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c1017', color: '#e6edf3', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#00d2ff' }}>
          <Cloud size={20} />
          <span>Cloud & Container Security Workspace</span>
        </h2>
        <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
          Container image CVE auditing, Kubernetes configuration posture, and Linux capability breakout checks
        </div>
      </div>

      {/* Target Image Bar */}
      <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 600 }}>IMAGE TAG:</span>
        <input
          type="text"
          value={imageName}
          onChange={(e) => setImageName(e.target.value)}
          placeholder="e.g. nginx:latest, alpine:3.18"
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
          onClick={handleTrivyScan}
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
          <span>Trivy CVE Scan</span>
        </button>
      </div>

      {/* Tool Operations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {/* Trivy Card */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Trivy Vulnerability Scanner</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>trivy</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Scan container OS packages and language-specific dependencies for known CVEs.
          </p>
          <button
            onClick={handleTrivyScan}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Scan Image Vulnerabilities</span>
          </button>
        </div>

        {/* Docker Daemons */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Local Docker Daemon</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>docker ps</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            List running containers, mapped network ports, mounts, and container status.
          </p>
          <button
            onClick={handleDockerPs}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>List Running Containers</span>
          </button>
        </div>

        {/* Capability Audit */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Linux Capabilities Check</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>capsh</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Check for dangerous capabilities (`CAP_SYS_ADMIN`, `CAP_NET_RAW`, `CAP_SYS_PTRACE`).
          </p>
          <button
            onClick={handleCheckCapabilities}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Audit Permissions</span>
          </button>
        </div>

        {/* Breakout Audit */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Container Escape Audit</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>cgroup</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Inspect cgroups, mounted docker socket `/var/run/docker.sock`, and privileged device nodes.
          </p>
          <button
            onClick={handleContainerEscapeCheck}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Audit Container Isolation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
