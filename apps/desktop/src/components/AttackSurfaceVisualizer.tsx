import React, { useState, useMemo } from 'react';
import {
  Shield,
  ExternalLink,
  Copy,
  Check,
  Search,
} from 'lucide-react';
import type { PageMetadata, EndpointItem } from '@dualsurf/shared-types';

interface AttackSurfaceVisualizerProps {
  metadata: PageMetadata | null;
  onOpenUrl?: (url: string) => void;
  onRunAudit?: (target: string) => void;
}

interface VisualNode {
  id: string;
  label: string;
  category: 'domain' | 'api' | 'admin' | 'subdomain' | 'storage' | 'endpoint';
  x: number;
  y: number;
  color: string;
  source: string;
  environment: string;
  url: string;
}

interface VisualLink {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const AttackSurfaceVisualizer: React.FC<AttackSurfaceVisualizerProps> = ({
  metadata,
  onOpenUrl,
  onRunAudit,
}) => {
  const [selectedNode, setSelectedNode] = useState<VisualNode | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Compute domain from page metadata
  const targetUrl = metadata?.url || 'https://example.com';
  const apexDomain = useMemo(() => {
    try {
      const u = new URL(targetUrl);
      return u.hostname;
    } catch {
      return 'example.com';
    }
  }, [targetUrl]);

  // Derive visual nodes and links from metadata endpoints, links, and hosts
  const { nodes, links, categoryCounts } = useMemo(() => {
    const visualNodes: VisualNode[] = [];
    const visualLinks: VisualLink[] = [];
    const counts: Record<string, number> = {
      all: 0,
      domain: 1,
      api: 0,
      admin: 0,
      subdomain: 0,
      storage: 0,
      endpoint: 0,
    };

    const width = 580;
    const height = 400;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Root Apex Domain
    const rootNode: VisualNode = {
      id: 'root-apex',
      label: apexDomain,
      category: 'domain',
      x: centerX,
      y: centerY,
      color: '#0ea5e9', // Sky blue
      source: 'DNS Apex',
      environment: 'Production',
      url: targetUrl,
    };
    visualNodes.push(rootNode);

    // 2. Discover external subdomains & endpoints
    const rawEndpoints: EndpointItem[] = metadata?.endpoints || [];
    const discoveredAssets = new Map<string, { category: VisualNode['category']; url: string }>();

    rawEndpoints.forEach((ep) => {
      try {
        const u = new URL(ep.url);
        const host = u.hostname.toLowerCase();
        if (host && host !== apexDomain) {
          let cat: VisualNode['category'] = 'subdomain';
          if (host.startsWith('api.') || host.includes('-api.')) cat = 'api';
          else if (host.startsWith('admin.') || host.includes('panel.')) cat = 'admin';
          else if (host.includes('s3') || host.includes('storage') || host.includes('cdn')) cat = 'storage';
          discoveredAssets.set(host, { category: cat, url: u.origin });
        } else if (ep.category === 'api') {
          discoveredAssets.set(ep.path, { category: 'api', url: ep.url });
        } else {
          discoveredAssets.set(ep.path, { category: 'endpoint', url: ep.url });
        }
      } catch {
        discoveredAssets.set(ep.path, { category: 'endpoint', url: targetUrl + ep.path });
      }
    });

    // Fallback standard security perimeter discovery nodes if none in-page
    if (discoveredAssets.size === 0) {
      discoveredAssets.set(`api.${apexDomain}`, { category: 'api', url: `https://api.${apexDomain}` });
      discoveredAssets.set(`admin.${apexDomain}`, { category: 'admin', url: `https://admin.${apexDomain}` });
      discoveredAssets.set(`/api/v1/auth`, { category: 'api', url: `${targetUrl}/api/v1/auth` });
      discoveredAssets.set(`/robots.txt`, { category: 'endpoint', url: `${targetUrl}/robots.txt` });
      discoveredAssets.set(`cdn.${apexDomain}`, { category: 'storage', url: `https://cdn.${apexDomain}` });
    }

    const assetEntries = Array.from(discoveredAssets.entries()).slice(0, 14);
    const totalOuter = assetEntries.length;
    const radius = 150;

    assetEntries.forEach(([label, info], idx) => {
      const angle = (idx / totalOuter) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      let color = '#ffffff';
      if (info.category === 'api') color = '#a855f7'; // Purple
      else if (info.category === 'admin') color = '#ef4444'; // Red
      else if (info.category === 'storage') color = '#f59e0b'; // Amber
      else if (info.category === 'endpoint') color = '#10b981'; // Emerald

      counts[info.category] = (counts[info.category] || 0) + 1;

      const node: VisualNode = {
        id: `node-${idx}`,
        label,
        category: info.category,
        x,
        y,
        color,
        source: label.startsWith('/') ? 'DOM In-Page Endpoint' : 'Subdomain OSINT / SAN',
        environment: label.includes('staging') || label.includes('dev') ? 'Staging' : 'Production',
        url: info.url,
      };

      visualNodes.push(node);

      visualLinks.push({
        from: rootNode.id,
        to: node.id,
        x1: rootNode.x,
        y1: rootNode.y,
        x2: node.x,
        y2: node.y,
      });
    });

    counts.all = visualNodes.length;

    return { nodes: visualNodes, links: visualLinks, categoryCounts: counts };
  }, [metadata, apexDomain, targetUrl]);

  // Filter nodes based on search and selected category
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchesCat = filterCategory === 'all' || n.category === filterCategory;
      const matchesSearch =
        !searchQuery ||
        n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [nodes, filterCategory, searchQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="attack-surface-visualizer" style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#e2e8f0' }}>
      {/* Top Filter & Search Bar */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Filter surface nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              background: '#090d16',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '12px',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'api', 'admin', 'storage', 'endpoint'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{
                background: filterCategory === cat ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                color: filterCategory === cat ? '#000000' : '#94a3b8',
                border: '1px solid',
                borderColor: filterCategory === cat ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {cat} ({categoryCounts[cat] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Topology Graph SVG Canvas */}
      <div style={{ position: 'relative', flex: 1, minHeight: '340px', background: 'radial-gradient(circle at center, #0f172a 0%, #070a12 100%)', overflow: 'hidden' }}>
        <svg
          viewBox="0 0 580 400"
          style={{ width: '100%', height: '100%', cursor: 'grab' }}
        >
          <defs>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Network Links */}
          {links.map((link, idx) => (
            <line
              key={`link-${idx}`}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              stroke="url(#linkGradient)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          ))}

          {/* Network Nodes */}
          {filteredNodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isRoot = node.id === 'root-apex';
            const radius = isRoot ? 24 : 14;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(node)}
                style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
              >
                {/* Selection / Glow Pulse */}
                {isSelected && (
                  <circle
                    r={radius + 8}
                    fill="none"
                    stroke={node.color}
                    strokeWidth="2"
                    strokeOpacity="0.8"
                    strokeDasharray="4 2"
                  />
                )}

                {/* Node Outer Halo */}
                <circle
                  r={radius}
                  fill="#0b1120"
                  stroke={node.color}
                  strokeWidth={isRoot ? 3 : 2}
                  filter="url(#glow-cyan)"
                />

                {/* Node Center Dot / Icon Representation */}
                <circle
                  r={isRoot ? 8 : 5}
                  fill={node.color}
                />

                {/* Node Text Label */}
                <text
                  y={radius + 14}
                  textAnchor="middle"
                  fill={isSelected ? '#ffffff' : '#cbd5e1'}
                  fontSize={isRoot ? '12px' : '10px'}
                  fontWeight={isRoot ? '700' : '500'}
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
                >
                  {node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend Overlay */}
        <div style={{ position: 'absolute', bottom: '10px', left: '12px', background: 'rgba(9, 13, 22, 0.85)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '10px', display: 'flex', gap: '10px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9' }}></span> Apex</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }}></span> API</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span> Admin</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }}></span> Storage</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span> Endpoint</span>
        </div>
      </div>

      {/* Selected Node Inspection Details Card */}
      <div style={{ padding: '12px 16px', background: '#0b1120', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        {selectedNode ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: `${selectedNode.color}22`,
                    color: selectedNode.color,
                    border: `1px solid ${selectedNode.color}44`,
                  }}
                >
                  {selectedNode.category}
                </span>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
                  {selectedNode.label}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleCopy(selectedNode.url, selectedNode.id)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {copiedId === selectedNode.id ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                  <span>Copy</span>
                </button>
                {onOpenUrl && (
                  <button
                    onClick={() => onOpenUrl(selectedNode.url)}
                    style={{ background: '#ffffff', border: 'none', color: '#000000', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    <ExternalLink size={11} />
                    <span>Navigate</span>
                  </button>
                )}
                {onRunAudit && (
                  <button
                    onClick={() => onRunAudit(selectedNode.url)}
                    style={{ background: '#dc2626', border: 'none', color: '#ffffff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    <Shield size={11} />
                    <span>Audit Asset</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11px', color: '#94a3b8' }}>
              <div><strong>Environment:</strong> <span style={{ color: '#f1f5f9' }}>{selectedNode.environment}</span></div>
              <div><strong>Source:</strong> <span style={{ color: '#f1f5f9' }}>{selectedNode.source}</span></div>
              <div><strong>Exposure:</strong> <span style={{ color: '#10b981' }}>Public Internet</span></div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
            Click any node in the topology above to inspect attack surface asset properties and launch targeted audits.
          </div>
        )}
      </div>
    </div>
  );
};

