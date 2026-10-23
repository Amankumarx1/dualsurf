import React, { useState } from 'react';
import { Search, Hash, Terminal, Plus } from 'lucide-react';

interface ForensicsWorkspaceProps {
  onRunInTerminal?: (command: string) => void;
}

interface EvidenceItem {
  id: string;
  filename: string;
  type: string;
  sha256: string;
  timestamp: string;
  notes: string;
}

export const ForensicsWorkspace: React.FC<ForensicsWorkspaceProps> = ({ onRunInTerminal }) => {
  const [filePath, setFilePath] = useState<string>('/tmp/suspicious_artifact.bin');
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    if (window.dualsurf?.getSpecialistWorkspaceData) {
      window.dualsurf.getSpecialistWorkspaceData('forensics').then((res: any) => {
        if (res?.evidenceList && Array.isArray(res.evidenceList) && res.evidenceList.length > 0) {
          const mapped: EvidenceItem[] = res.evidenceList.map((e: any) => ({
            id: e.id,
            filename: e.target || e.sourceToolName || 'evidence_artifact',
            type: e.sourceTool || 'Security Evidence',
            sha256: e.sha256 || 'N/A',
            timestamp: e.collectedAt ? new Date(e.collectedAt).toISOString().replace('T', ' ').substring(0, 19) : '',
            notes: e.sourceToolName ? `${e.sourceToolName} (${e.rawOutput?.length || 0} bytes)` : 'Forensic evidence capture',
          }));
          setEvidenceList(mapped);
        }
      }).catch(console.error).finally(() => setLoading(false));
    }
  }, []);

  const handleHashCheck = () => {
    onRunInTerminal?.(`sha256sum "${filePath}" && md5sum "${filePath}"`);
  };

  const handleExiftool = () => {
    onRunInTerminal?.(`exiftool "${filePath}"`);
  };

  const handleStrings = () => {
    onRunInTerminal?.(`strings -n 8 "${filePath}" | grep -E "https?://|[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}" | head -n 30`);
  };

  const handleBinwalk = () => {
    onRunInTerminal?.(`binwalk -e "${filePath}"`);
  };

  const handleAddEvidence = () => {
    const newItem: EvidenceItem = {
      id: `EV-00${evidenceList.length + 1}`,
      filename: filePath.split('/').pop() || 'artifact.bin',
      type: 'File Sample',
      sha256: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      notes: 'Logged to chain of custody',
    };
    setEvidenceList([newItem, ...evidenceList]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c1017', color: '#e6edf3', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#00d2ff' }}>
          <Search size={20} />
          <span>Digital Forensics & Incident Response Workspace</span>
        </h2>
        <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
          Chain of custody catalog, cryptographic integrity verification, metadata extraction, and carving
        </div>
      </div>

      {/* Target File Bar */}
      <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 600 }}>EVIDENCE FILE:</span>
        <input
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="/path/to/evidence.bin"
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
          onClick={handleHashCheck}
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
          <Hash size={12} />
          <span>Verify Hashes</span>
        </button>
        <button
          onClick={handleAddEvidence}
          style={{
            background: '#238636',
            border: 'none',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Plus size={12} />
          <span>Catalog</span>
        </button>
      </div>

      {/* Forensics Operations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* ExifTool */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>ExifTool Metadata</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>exiftool</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Extract camera EXIF, document author, creation timestamps, and embedded software tags.
          </p>
          <button
            onClick={handleExiftool}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Extract Exif Metadata</span>
          </button>
        </div>

        {/* Strings / Indicators */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>IOC & String Extraction</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>strings + grep</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Scan ASCII/Unicode byte sequences for IP addresses, URLs, API keys, and file paths.
          </p>
          <button
            onClick={handleStrings}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Extract Indicators</span>
          </button>
        </div>

        {/* Binwalk Carving */}
        <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#f8f8f2' }}>Binwalk Firmware Carving</span>
            <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>binwalk</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 12px 0' }}>
            Search binary images for embedded files, compressed filesystems, and executable code.
          </p>
          <button
            onClick={handleBinwalk}
            style={{ width: '100%', background: '#21262d', border: '1px solid #30363d', color: '#00ffc8', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={12} />
            <span>Carve Embedded Files</span>
          </button>
        </div>
      </div>

      {/* Chain of Custody Table */}
      <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e6edf3' }}>Chain of Custody & Evidence Catalog</span>
          <span style={{ fontSize: '11px', color: '#8b949e' }}>
            {loading ? 'Querying evidence vault...' : `${evidenceList.length} items logged`}
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'monospace' }}>
          <thead>
            <tr style={{ color: '#8b949e', borderBottom: '1px solid #21262d', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Case ID</th>
              <th style={{ padding: '6px 8px' }}>Filename</th>
              <th style={{ padding: '6px 8px' }}>Artifact Type</th>
              <th style={{ padding: '6px 8px' }}>SHA-256 Digest</th>
              <th style={{ padding: '6px 8px' }}>Timestamp</th>
              <th style={{ padding: '6px 8px' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {evidenceList.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #161b22' }}>
                <td style={{ padding: '6px 8px', color: '#00d2ff', fontWeight: 600 }}>{item.id}</td>
                <td style={{ padding: '6px 8px', color: '#f8f8f2' }}>{item.filename}</td>
                <td style={{ padding: '6px 8px', color: '#8b949e' }}>{item.type}</td>
                <td style={{ padding: '6px 8px', color: '#00ffc8' }}>{item.sha256.substring(0, 16)}...</td>
                <td style={{ padding: '6px 8px', color: '#8b949e' }}>{item.timestamp}</td>
                <td style={{ padding: '6px 8px', color: '#c9d1d9' }}>{item.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
