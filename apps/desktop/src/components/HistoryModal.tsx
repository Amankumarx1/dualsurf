import React, { useState, useEffect, useRef } from 'react';
import { History, Search, Trash2, X, ExternalLink, Clock, Globe } from 'lucide-react';
import type { HistoryEntry } from '@dualsurf/shared-types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
  onOpenNewTab?: (url: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenNewTab,
}) => {
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    if (window.dualsurf) {
      try {
        const items = await window.dualsurf.getHistory(200);
        setHistoryItems(items || []);
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setIsConfirmingClear(false);
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

  const handleClearHistory = async () => {
    if (window.dualsurf) {
      await window.dualsurf.clearHistory();
      setHistoryItems([]);
      setIsConfirmingClear(false);
    }
  };

  const handleOpenInNewTab = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenNewTab) {
      onOpenNewTab(url);
    } else if (window.dualsurf?.createTab) {
      window.dualsurf.createTab(url, true);
    }
    onClose();
  };

  const filteredItems = historyItems.filter((item) => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      item.url.toLowerCase().includes(q)
    );
  });

  const formatTimestamp = (timestamp: number) => {
    const d = new Date(timestamp);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div
        className="modal-dialog-box history-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header-strip">
          <div className="modal-title-group" id="history-modal-title">
            <History size={17} />
            <span>Browsing History</span>
            <span className="badge-count" title={`${historyItems.length} entries recorded`}>
              {historyItems.length} entries
            </span>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            title="Close dialog (Esc)"
            aria-label="Close Browsing History"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search bar & Clear history action */}
        <div className="history-toolbar">
          <div className="history-search-input-wrap">
            <Search size={14} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="history-search-input"
              placeholder="Search history by title or URL..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Search browsing history"
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

          {isConfirmingClear ? (
            <div className="clear-confirm-group">
              <span className="confirm-prompt">Clear all history?</span>
              <button
                className="confirm-yes-btn"
                onClick={handleClearHistory}
                title="Confirm clear all browsing history"
              >
                Yes, Clear All
              </button>
              <button
                className="confirm-no-btn"
                onClick={() => setIsConfirmingClear(false)}
                title="Cancel clear"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="clear-history-action-btn"
              onClick={() => setIsConfirmingClear(true)}
              disabled={historyItems.length === 0}
              title={historyItems.length === 0 ? 'No history to clear' : 'Clear all browsing history'}
              aria-label="Clear all browsing history"
            >
              <Trash2 size={13} />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {/* History List */}
        <div className="modal-body-scroll history-list-container">
          {filteredItems.length === 0 ? (
            <div className="empty-state-notice">
              {searchFilter ? (
                <>
                  <Search size={32} opacity={0.35} />
                  <p>No matching history entries found for &ldquo;{searchFilter}&rdquo;</p>
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
                  <Clock size={36} opacity={0.3} />
                  <p>No browsing history recorded yet</p>
                  <span className="empty-state-hint">
                    Webpages you visit will appear here for fast retrieval.
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="history-items-list" role="list">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="history-entry-row"
                  onClick={() => {
                    onNavigate(item.url);
                    onClose();
                  }}
                  role="listitem"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onNavigate(item.url);
                      onClose();
                    }
                  }}
                  title={`Open: ${item.url}`}
                  aria-label={`History entry: ${item.title || item.url}`}
                >
                  <div className="history-entry-time">
                    {formatTimestamp(item.visitedAt)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: 'var(--ds-text-muted, #a0a7b2)',
                      }}
                    >
                      <Globe size={13} />
                    </div>
                    <div className="history-entry-details">
                      <div className="history-entry-title">
                        {item.title || item.url}
                      </div>
                      <div className="history-entry-url">{item.url}</div>
                    </div>
                  </div>
                  <div className="bookmark-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="bookmark-action-icon-btn"
                      onClick={(e) => handleOpenInNewTab(item.url, e)}
                      title="Open in new tab"
                      aria-label="Open history entry in new tab"
                    >
                      <ExternalLink size={13} />
                    </button>
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
