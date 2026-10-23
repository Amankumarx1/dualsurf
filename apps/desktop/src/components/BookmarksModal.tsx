import React, { useState, useEffect, useRef } from 'react';
import {
  Bookmark,
  Search,
  Trash2,
  X,
  Plus,
  ExternalLink,
  Check,
  AlertCircle,
  Globe,
} from 'lucide-react';
import type { BookmarkEntry, TabState } from '@dualsurf/shared-types';

interface BookmarksModalProps {
  isOpen: boolean;
  activeTab: TabState | null;
  onClose: () => void;
  onNavigate: (url: string) => void;
  onOpenNewTab?: (url: string) => void;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({
  isOpen,
  activeTab,
  onClose,
  onNavigate,
  onOpenNewTab,
}) => {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchBookmarks = async () => {
    if (window.dualsurf) {
      try {
        const items = await window.dualsurf.getBookmarks();
        setBookmarks(items || []);
      } catch (err) {
        console.error('Failed to load bookmarks:', err);
        setErrorMessage('Failed to load saved bookmarks.');
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBookmarks();
      setSearchFilter('');
      setJustAdded(false);
      setErrorMessage(null);
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

  const handleDeleteBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.dualsurf) {
      try {
        await window.dualsurf.removeBookmark(id);
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      } catch (err) {
        console.error('Failed to delete bookmark:', err);
        setErrorMessage('Failed to remove bookmark.');
      }
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

  const isCurrentTabValid = Boolean(
    activeTab &&
    activeTab.url &&
    activeTab.url !== 'about:blank' &&
    !activeTab.url.startsWith('dualsurf://')
  );

  const isAlreadyBookmarked = Boolean(
    activeTab?.url && bookmarks.some((b) => b.url === activeTab.url)
  );

  const handleAddCurrent = async () => {
    if (!activeTab || !isCurrentTabValid || isAlreadyBookmarked || !window.dualsurf) return;
    try {
      await window.dualsurf.addBookmark(activeTab.url, activeTab.title || activeTab.url);
      setJustAdded(true);
      await fetchBookmarks();
      setTimeout(() => {
        setJustAdded(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to add bookmark:', err);
      setErrorMessage('Failed to bookmark this page.');
    }
  };

  const filteredBookmarks = bookmarks.filter((bm) => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      (bm.title && bm.title.toLowerCase().includes(q)) ||
      bm.url.toLowerCase().includes(q)
    );
  });

  const getAddButtonTooltip = () => {
    if (justAdded) return 'Bookmark saved successfully!';
    if (isAlreadyBookmarked) return 'This page is already saved in bookmarks';
    if (!isCurrentTabValid) return 'Cannot bookmark internal or empty tabs';
    return `Bookmark current page: ${activeTab?.title || activeTab?.url}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookmarks-modal-title"
    >
      <div
        className="modal-dialog-box bookmarks-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Section 1: Modal Header */}
        <div className="modal-header-strip">
          <div className="modal-title-group" id="bookmarks-modal-title">
            <Bookmark size={17} />
            <span>Bookmarks Manager</span>
            <span className="badge-count" title={`${bookmarks.length} saved bookmarks`}>
              {bookmarks.length} saved
            </span>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            title="Close dialog (Esc)"
            aria-label="Close Bookmarks Manager"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error notification banner if any */}
        {errorMessage && (
          <div
            style={{
              padding: '8px 16px',
              background: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={14} />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Section 2: Toolbar & Primary Actions */}
        <div className="history-toolbar">
          <div className="history-search-input-wrap">
            <Search size={14} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="history-search-input"
              placeholder="Search saved bookmarks by title or URL..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Search bookmarks"
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
            className={`add-current-tab-btn ${justAdded ? 'btn-saved-success' : ''}`}
            onClick={handleAddCurrent}
            disabled={!isCurrentTabValid || isAlreadyBookmarked || justAdded}
            title={getAddButtonTooltip()}
            aria-label={getAddButtonTooltip()}
          >
            {justAdded ? (
              <>
                <Check size={14} />
                <span>Saved!</span>
              </>
            ) : isAlreadyBookmarked ? (
              <>
                <Bookmark size={14} />
                <span>Bookmarked</span>
              </>
            ) : (
              <>
                <Plus size={14} />
                <span>Bookmark Current</span>
              </>
            )}
          </button>
        </div>

        {/* Section 3: Scrollable Bookmarks List */}
        <div className="modal-body-scroll history-list-container">
          {filteredBookmarks.length === 0 ? (
            <div className="empty-state-notice">
              {searchFilter ? (
                <>
                  <Search size={32} opacity={0.35} />
                  <p>No bookmarks matching &ldquo;{searchFilter}&rdquo;</p>
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
                  <Bookmark size={36} opacity={0.3} />
                  <p>No bookmarks saved yet</p>
                  <span className="empty-state-hint">
                    Visit websites and click &ldquo;Bookmark Current&rdquo; or press Ctrl+B to manage your favorites.
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="history-items-list" role="list">
              {filteredBookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="history-entry-row bookmark-entry-row"
                  onClick={() => {
                    onNavigate(bm.url);
                    onClose();
                  }}
                  role="listitem"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onNavigate(bm.url);
                      onClose();
                    }
                  }}
                  title={`Open in active tab: ${bm.url}`}
                  aria-label={`Bookmark: ${bm.title || bm.url}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
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
                      <Globe size={14} />
                    </div>
                    <div className="history-entry-details">
                      <div className="history-entry-title">
                        {bm.title || bm.url}
                      </div>
                      <div className="history-entry-url">{bm.url}</div>
                    </div>
                  </div>

                  <div className="bookmark-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="bookmark-action-icon-btn"
                      onClick={(e) => handleOpenInNewTab(bm.url, e)}
                      title="Open in new tab"
                      aria-label="Open bookmark in new tab"
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button
                      className="bookmark-delete-icon-btn"
                      onClick={(e) => handleDeleteBookmark(bm.id, e)}
                      title="Delete bookmark"
                      aria-label="Delete bookmark"
                    >
                      <Trash2 size={13} />
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
