import React, { useEffect, useState } from 'react';
import { Terminal, X, RefreshCw, Hash, Link as LinkIcon, FileText } from 'lucide-react';
import type { PageMetadata } from '@dualsurf/shared-types';

interface PageMetadataDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTabId: string | null;
  onFollowLink: (linkId: number) => void;
}

export const PageMetadataDrawer: React.FC<PageMetadataDrawerProps> = ({
  isOpen,
  onClose,
  activeTabId,
  onFollowLink,
}) => {
  const [metadata, setMetadata] = useState<PageMetadata | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetadata = async () => {
    if (!window.dualsurf || !activeTabId) return;
    setLoading(true);
    try {
      const data = await window.dualsurf.getPageMetadata(activeTabId);
      setMetadata(data);
    } catch (err) {
      console.error('Failed to inspect page:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTabId) {
      fetchMetadata();
    }
  }, [isOpen, activeTabId]);

  if (!isOpen) return null;

  return (
    <div className="inspector-drawer">
      <div className="drawer-header">
        <div className="drawer-title">
          <Terminal size={16} />
          <span>MODE B · TERMINAL INSPECTOR</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="action-icon-btn"
            onClick={fetchMetadata}
            title="Refresh Inspection Snapshot"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'tab-loading-spinner' : ''} />
          </button>
          <button className="action-icon-btn" onClick={onClose} title="Close Drawer">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="drawer-content">
        {/* Page Overview */}
        <div className="inspector-section">
          <div className="inspector-section-title">PAGE METADATA</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
            {metadata?.title || 'No Title'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, wordBreak: 'break-all' }}>
            {metadata?.url || 'about:blank'}
          </div>
        </div>

        {/* Headings */}
        {metadata?.headings && metadata.headings.length > 0 && (
          <div className="inspector-section">
            <div className="inspector-section-title">
              <Hash size={12} style={{ display: 'inline', marginRight: 4 }} />
              STRUCTURED HEADINGS ({metadata.headings.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
              {metadata.headings.map((h, i) => (
                <div key={i} style={{ paddingLeft: (h.level - 1) * 8, color: 'var(--text-accent)' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>H{h.level}</span>
                  {h.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Numbered Actionable Links */}
        <div className="inspector-section">
          <div className="inspector-section-title">
            <LinkIcon size={12} style={{ display: 'inline', marginRight: 4 }} />
            NUMBERED ACTIONABLE LINKS ({metadata?.links.length || 0})
          </div>
          <div className="link-list">
            {metadata?.links && metadata.links.length > 0 ? (
              metadata.links.map((link) => (
                <div
                  key={link.id}
                  className="numbered-link-item"
                  onClick={() => onFollowLink(link.id)}
                  title={`Follow link: ${link.href}`}
                >
                  <span className="link-badge">[{link.id}]</span>
                  <span className="link-label">{link.label}</span>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>No links detected on this page.</div>
            )}
          </div>
        </div>

        {/* Readable Content Text Snippet */}
        {metadata?.textSnippet && (
          <div className="inspector-section">
            <div className="inspector-section-title">
              <FileText size={12} style={{ display: 'inline', marginRight: 4 }} />
              READABLE TEXT STREAM (CLI SNAPSHOT)
            </div>
            <pre
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                maxHeight: 180,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'rgba(0,0,0,0.2)',
                padding: 8,
                borderRadius: 4,
              }}
            >
              {metadata.textSnippet}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
