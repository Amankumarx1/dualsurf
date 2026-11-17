import React, { useEffect, useState } from 'react';
import {
  X,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Database,
  Link2,
  FileText,
  AlignLeft,
} from 'lucide-react';
import type { PageMetadata, LinkItem, EndpointItem } from '@dualsurf/shared-types';

interface PageMetadataDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTabId: string | null;
  onFollowLink: (linkId: number) => void;
}

type DrawerTab = 'overview' | 'links' | 'endpoints' | 'headings' | 'text';

export const PageMetadataDrawer: React.FC<PageMetadataDrawerProps> = ({
  isOpen,
  onClose,
  activeTabId,
  onFollowLink,
}) => {
  const [metadata, setMetadata] = useState<PageMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [linkSearch, setLinkSearch] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (isOpen && activeTabId && window.dualsurf?.getPageMetadata) {
      setLoading(true);
      window.dualsurf
        .getPageMetadata(activeTabId)
        .then((meta: PageMetadata) => {
          setMetadata(meta);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, activeTabId]);

  if (!isOpen) return null;

  const links: LinkItem[] = metadata?.links || [];
  const endpoints: EndpointItem[] = metadata?.endpoints || [];
  const headings = metadata?.headings || [];
  const cookies = metadata?.cookies || [];
  const storage = metadata?.storage || [];

  const filteredLinks = linkSearch
    ? links.filter(
        (l) =>
          l.label.toLowerCase().includes(linkSearch.toLowerCase()) ||
          l.href.toLowerCase().includes(linkSearch.toLowerCase())
      )
    : links;

  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1500);
  };

  return (
    <div className="dualsurf-page-metadata-drawer">
      <div className="drawer-header">
        <div className="drawer-title-row">
          <Globe size={16} />
          <span className="drawer-title">Page Inspector &amp; Details</span>
          {loading && <RefreshCw size={12} className="spin ml-2" />}
        </div>
        <button className="drawer-close-btn" onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <div className="drawer-tab-bar">
        <button
          className={`drawer-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`drawer-tab-btn ${activeTab === 'links' ? 'active' : ''}`}
          onClick={() => setActiveTab('links')}
        >
          Links ({links.length})
        </button>
        <button
          className={`drawer-tab-btn ${activeTab === 'endpoints' ? 'active' : ''}`}
          onClick={() => setActiveTab('endpoints')}
        >
          Endpoints ({endpoints.length})
        </button>
        <button
          className={`drawer-tab-btn ${activeTab === 'headings' ? 'active' : ''}`}
          onClick={() => setActiveTab('headings')}
        >
          Headings ({headings.length})
        </button>
        <button
          className={`drawer-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          Text Content
        </button>
      </div>

      <div className="drawer-content-body">
        {activeTab === 'overview' && (
          <div className="drawer-section-stack">
            <div className="drawer-card">
              <div className="drawer-card-label">Title</div>
              <div className="drawer-card-val font-semibold">{metadata?.title || 'Unknown Title'}</div>
            </div>

            <div className="drawer-card">
              <div className="drawer-card-label">URL</div>
              <div className="drawer-card-val break-all font-mono text-xs">{metadata?.url || ''}</div>
            </div>

            {metadata?.description && (
              <div className="drawer-card">
                <div className="drawer-card-label">Description</div>
                <div className="drawer-card-val text-xs text-muted-foreground">{metadata.description}</div>
              </div>
            )}

            <div className="drawer-card">
              <div className="drawer-card-title-row">
                <Database size={14} />
                <span>Cookies ({cookies.length})</span>
              </div>
              {cookies.length > 0 ? (
                <div className="drawer-items-list">
                  {cookies.slice(0, 8).map((c, i) => (
                    <div key={i} className="drawer-cookie-row">
                      <span className="cookie-name">{c.name}</span>
                      <span className="cookie-val">{c.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="drawer-empty-text">No cookies detected for this page.</div>
              )}
            </div>

            <div className="drawer-card">
              <div className="drawer-card-title-row">
                <Database size={14} />
                <span>LocalStorage ({storage.length})</span>
              </div>
              {storage.length > 0 ? (
                <div className="drawer-items-list">
                  {storage.slice(0, 8).map((s, i) => (
                    <div key={i} className="drawer-cookie-row">
                      <span className="cookie-name">{s.key}</span>
                      <span className="cookie-val">{s.value || '(empty)'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="drawer-empty-text">No localStorage items found.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="drawer-section-stack">
            <div className="drawer-search-wrap">
              <Search size={13} className="search-icon" />
              <input
                type="text"
                className="drawer-search-input"
                placeholder="Search links..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
              />
            </div>
            <div className="drawer-links-scroll-list">
              {filteredLinks.length > 0 ? (
                filteredLinks.map((l) => (
                  <div
                    key={l.id}
                    className="drawer-link-item"
                    onClick={() => {
                      onFollowLink(l.id);
                      onClose();
                    }}
                  >
                    <span className="link-num-badge">#{l.id}</span>
                    <span className="link-text-label">{l.label}</span>
                    <span className="link-href-sub">{l.href}</span>
                  </div>
                ))
              ) : (
                <div className="drawer-empty-text">No links matched search.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'endpoints' && (
          <div className="drawer-section-stack">
            <div className="drawer-links-scroll-list">
              {endpoints.length > 0 ? (
                endpoints.map((ep, i) => (
                  <div key={i} className="drawer-endpoint-card">
                    <span className="endpoint-badge">{ep.category.toUpperCase()}</span>
                    <span className="endpoint-path font-mono text-xs">{ep.path}</span>
                  </div>
                ))
              ) : (
                <div className="drawer-empty-text">No endpoints discovered.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'headings' && (
          <div className="drawer-section-stack">
            <div className="drawer-links-scroll-list">
              {headings.length > 0 ? (
                headings.map((h, i) => (
                  <div key={i} className="drawer-heading-row" style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
                    <span className="heading-badge">H{h.level}</span>
                    <span className="heading-text">{h.text}</span>
                  </div>
                ))
              ) : (
                <div className="drawer-empty-text">No headings found on page.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="drawer-section-stack">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                className="drawer-quick-btn"
                onClick={() => handleCopyText(metadata?.text || '')}
              >
                {copiedText ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
            <pre className="drawer-raw-text font-mono text-xs p-3 rounded bg-zinc-950 border border-zinc-800 whitespace-pre-wrap">
              {metadata?.text || 'No text extracted.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
