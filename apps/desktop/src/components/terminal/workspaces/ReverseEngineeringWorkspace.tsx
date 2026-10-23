import React, { useState } from 'react';
import { Cpu, Terminal, Shield, Play, Code, Layers, FileCode } from 'lucide-react';

interface ReverseEngineeringWorkspaceProps {
  onRunInTerminal?: (command: string) => void;
}

export const ReverseEngineeringWorkspace: React.FC<ReverseEngineeringWorkspaceProps> = ({ onRunInTerminal }) => {
  const [binaryPath, setBinaryPath] = useState<string>('/usr/bin/sudo');

  const handleChecksec = () => {
    onRunInTerminal?.(`checksec --file="${binaryPath}"`);
  };

  const handleReadelf = () => {
    onRunInTerminal?.(`readelf -h "${binaryPath}"`);
  };

  const handleObjdump = () => {
    onRunInTerminal?.(`objdump -d -M intel "${binaryPath}" | head -n 60`);
  };

  const handleRadare2 = () => {
    onRunInTerminal?.(`r2 -A -q -c "iI; afl" "${binaryPath}"`);
  };

  const handleGhidraLaunch = () => {
    onRunInTerminal?.(`ghidra &`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c1017', color: '#e6edf3', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#00d2ff' }}>
          <Cpu size={20} />
          <span>Reverse Engineering & Binary Analysis Workspace</span>
        </h2>
        <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
          ELF/PE header examination, mitigation inspection (checksec), disassembly, and Ghidra integration
        </div>
      </div>

      {/* Target Binary Bar */}
      <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 600 }}>BINARY PATH:</span>
        <input
          type="text"
          value={binaryPath}
          onChange={(e) => setBinaryPath(e.target.value)}
          placeholder="/path/to/binary"
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
          onClick={handleChecksec}
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
          <Shield size={12} />
          <span>Checksec</span>
        </button>
      </div>

      {/* Operations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Checksec Card */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Mitigation Audit (Checksec)</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>Security</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Check for NX stack protection, Full RELRO, Stack Canaries, PIE (ASLR), and RPATH vulnerabilities.
          </p>
          <button
            onClick={handleChecksec}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Audit Binary Mitigations</span>
          </button>
        </div>

        {/* Readelf Card */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>ELF Headers & Sections</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>readelf</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Inspect entry points, machine architecture, program headers, dynamic symbols, and ABI version.
          </p>
          <button
            onClick={handleReadelf}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Parse ELF Headers</span>
          </button>
        </div>

        {/* Objdump Intel Disassembly */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Disassembly (Intel Syntax)</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>objdump</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Disassemble `.text` section into x86_64 assembly instructions using objdump with Intel syntax.
          </p>
          <button
            onClick={handleObjdump}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Disassemble Assembly</span>
          </button>
        </div>

        {/* Radare2 Analysis */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Radare2 Function Analysis</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>r2</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Analyze basic blocks, function boundaries, cross-references, and symbols via radare2.
          </p>
          <button
            onClick={handleRadare2}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Analyze Functions</span>
          </button>
        </div>
      </div>

      {/* Native GUI Launcher */}
      <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8f8f2' }}>NSA Ghidra Decompiler Suite</div>
          <div style={{ fontSize: '12px', color: '#8b949e' }}>
            Launch the official NSA Ghidra GUI application inside the Kali X11/Wayland display server
          </div>
        </div>
        <button
          onClick={handleGhidraLaunch}
          style={{
            background: 'linear-gradient(135deg, #00d2ff 0%, #00ffc8 100%)',
            border: 'none',
            color: '#0c1017',
            padding: '8px 18px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Play size={13} fill="#0c1017" />
          <span>Launch Ghidra GUI</span>
        </button>
      </div>
    </div>
  );
};
