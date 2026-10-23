import React, { useState, useEffect, useRef } from 'react';
import { Download, FolderOpen, X, File, CheckCircle2, Search } from 'lucide-react';

interface DownloadsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadsModal: React.FC<DownloadsModalProps> = ({ isOpen, onClose }) => {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchDownloads = async () => {
    if (window.dualsurf) {
      try {
        const items = await window.dualsurf.getDownloads(100);
        setDownloads(items || []);
      } catch (err) {
        console.error('Failed to load downloads:', err);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDownloads();
      setSearchFilter('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard shortcut listener: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleOpenFolder = async () => {
    if (window.dualsurf) {
      await window.dualsurf.openDownloadsFolder();
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const filteredDownloads = downloads.filter((item) => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.filename && item.filename.toLowerCase().includes(q)) ||
      (item.url && item.url.toLowerCase().includes(q)) ||
      (item.savePath && item.savePath.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="downloads-modal-title"
    >
      <div
        className="modal-dialog-box downloads-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header-strip">
          <div className="modal-title-group" id="downloads-modal-title">
            <Download size={17} />
            <span>Downloads</span>
            <span className="badge-count" title={`${downloads.length} downloads in session`}>
              {downloads.length} files
            </span>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            title="Close dialog (Esc)"
            aria-label="Close Downloads"
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar & Filter */}
        <div className="history-toolbar">
          <div className="history-search-input-wrap">
            <Search size={14} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="history-search-input"
              placeholder="Search downloads by filename or source URL..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Search downloads"
            />
            {searchFilter && (
              <button
                className="history-search-clear-btn"
                onClick={() => setSearchFilter('')}
                title="Clear search"
                aria-label="Clear search filter"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            className="open-folder-action-btn"
            onClick={handleOpenFolder}
            title="Open default downloads folder in File Explorer"
            aria-label="Open default downloads folder in File Explorer"
          >
            <FolderOpen size={14} />
            <span>Open Folder</span>
          </button>
        </div>

        {/* Downloads List */}
        <div className="modal-body-scroll history-list-container">
          {filteredDownloads.length === 0 ? (
            <div className="empty-state-notice">
              {searchFilter ? (
                <>
                  <Search size={32} opacity={0.35} />
                  <p>No downloads matching &ldquo;{searchFilter}&rdquo;</p>
                  <button
                    className="history-search-clear-btn"
                    style={{
                      background: '#22272e',
                      border: '1px solid #373e47',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      color: '#e8eaed',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                    onClick={() => setSearchFilter('')}
                  >
                    Clear search filter
                  </button>
                </>
              ) : (
                <>
                  <Download size={36} opacity={0.3} />
                  <p>No active or past downloads in this session</p>
                  <span className="empty-state-hint">
                    Files downloaded from websites will appear here.
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="history-items-list" role="list">
              {filteredDownloads.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="history-entry-row download-entry-row"
                  tabIndex={0}
                  role="listitem"
                  title={`File: ${item.filename || 'Downloaded File'}`}
                  aria-label={`Downloaded file: ${item.filename || 'Downloaded File'}`}
                >
                  <div className="download-file-icon">
                    <File size={16} />
                  </div>
                  <div className="history-entry-details">
                    <div className="history-entry-title">
                      {item.filename || 'Downloaded File'}
                    </div>
                    <div className="history-entry-url">
                      {item.url || item.savePath}
                    </div>
                  </div>
                  <div className="download-meta-badges">
                    <span className="download-size-badge">
                      {formatFileSize(item.totalBytes)}
                    </span>
                    <span className="download-status-badge">
                      <CheckCircle2 size={12} color="var(--ds-success)" />
                      <span>{item.state || 'Completed'}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
