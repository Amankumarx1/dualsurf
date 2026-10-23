import React, { useState, useEffect } from 'react';
import { Package, Download, Terminal, Check, Copy, ExternalLink, X, Search } from 'lucide-react';
import type { KaliMetapackage } from '@dualsurf/shared-types';

interface MetapackagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunInTerminal?: (command: string) => void;
}

export const MetapackagesModal: React.FC<MetapackagesModalProps> = ({ isOpen, onClose, onRunInTerminal }) => {
  const [packages, setPackages] = useState<KaliMetapackage[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [copiedPkg, setCopiedPkg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && window.dualsurf?.getKaliMetapackages) {
      window.dualsurf.getKaliMetapackages().then(setPackages).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = packages.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.description.toLowerCase().includes(filter.toLowerCase()) ||
      p.category.toLowerCase().includes(filter.toLowerCase())
  );

  const handleCopy = (pkg: KaliMetapackage) => {
    navigator.clipboard?.writeText(pkg.installCommand);
    setCopiedPkg(pkg.name);
    setTimeout(() => setCopiedPkg(null), 1500);
  };

  const handleInstallInTerminal = (pkg: KaliMetapackage) => {
    onRunInTerminal?.(pkg.installCommand);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#0c1017',
          border: '1px solid #30363d',
          borderRadius: '12px',
          width: '840px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #21262d',
            background: '#131822',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={20} color="#00d2ff" />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8f8f2' }}>
                Kali Linux Metapackage Manager
              </div>
              <div style={{ fontSize: '11px', color: '#8b949e' }}>
                Official curated tool suites from the Kali Linux distribution catalog
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #21262d', background: '#0e131d', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={14} color="#8b949e" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search metapackages (e.g. web, forensics, wireless, reverse-engineering)..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#e6edf3',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Package list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((pkg) => (
            <div
              key={pkg.name}
              style={{
                background: '#131822',
                border: '1px solid #21262d',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#00d2ff', fontSize: '14px', fontFamily: 'monospace' }}>
                    {pkg.name}
                  </span>
                  <span style={{ fontSize: '10px', background: 'rgba(0, 210, 255, 0.1)', color: '#00d2ff', padding: '2px 6px', borderRadius: '4px' }}>
                    {pkg.category}
                  </span>
                  <span style={{ fontSize: '10px', background: '#21262d', color: '#8b949e', padding: '2px 6px', borderRadius: '4px' }}>
                    ~{pkg.toolsCount} tools
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleCopy(pkg)}
                    style={{
                      background: '#21262d',
                      border: '1px solid #30363d',
                      color: copiedPkg === pkg.name ? '#3fb950' : '#c9d1d9',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {copiedPkg === pkg.name ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedPkg === pkg.name ? 'Copied' : 'Copy apt'}</span>
                  </button>

                  <button
                    onClick={() => handleInstallInTerminal(pkg)}
                    style={{
                      background: '#238636',
                      border: 'none',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Terminal size={11} />
                    <span>Run in Shell</span>
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#8b949e' }}>{pkg.description}</div>

              <div style={{ background: '#0c1017', padding: '6px 10px', borderRadius: '4px', border: '1px solid #21262d', fontSize: '11px', fontFamily: 'monospace', color: '#00ffc8' }}>
                $ {pkg.installCommand}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
