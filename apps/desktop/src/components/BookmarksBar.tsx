import React, { useEffect, useState, useRef } from 'react';
import {
  Plus,
  LayoutGrid,
  ExternalLink,
  ClipboardCopy,
  Trash2,
} from 'lucide-react';
import type { BookmarkEntry, TabState } from '@dualsurf/shared-types';

interface BookmarksBarProps {
  activeTab: TabState | null;
  onNavigate: (url: string) => void;
  onOpenAppMatrix?: () => void;
  onNewTab?: (url: string) => void;
  mode?: 'gui' | 'terminal';
}

interface BookmarkContextMenu {
  isOpen: boolean;
  x: number;
  y: number;
  url: string;
  title: string;
  bookmarkId?: string;
}

export const BookmarksBar: React.FC<BookmarksBarProps> = ({
  activeTab,
  onNavigate,
  onOpenAppMatrix,
  onNewTab,
  mode,
}) => {
  const [userBookmarks, setUserBookmarks] = useState<BookmarkEntry[]>([]);
  const [contextMenu, setContextMenu] = useState<BookmarkContextMenu>({
    isOpen: false,
    x: 0,
    y: 0,
    url: '',
    title: '',
  });

  const chipsListRef = useRef<HTMLDivElement>(null);

  const loadBookmarks = () => {
    if (window.dualsurf) {
      window.dualsurf.getBookmarks().then(setUserBookmarks).catch(console.error);
    }
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenu.isOpen) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [contextMenu.isOpen]);

  const handleAddBookmark = async () => {
    if (!activeTab || !window.dualsurf) return;
    await window.dualsurf.addBookmark(activeTab.url, activeTab.title || activeTab.url);
    loadBookmarks();
  };

  const handleContextMenu = (e: React.MouseEvent, url: string, title: string, bookmarkId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: e.clientY,
      url,
      title,
      bookmarkId,
    });
  };

  const handleDeleteBookmark = async (id: string) => {
    if (window.dualsurf) {
      await window.dualsurf.removeBookmark(id);
      loadBookmarks();
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (chipsListRef.current && e.deltaY !== 0) {
      chipsListRef.current.scrollLeft += e.deltaY;
    }
  };

  // High-fidelity SVG icons matching reference screenshots
  const defaultChips = [
    {
      label: 'Google',
      url: 'https://google.com',
      icon: (
        <span className="brand-dot-icon google-icon">
          <svg width="13" height="13" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        </span>
      ),
    },
    {
      label: 'YouTube',
      url: 'https://youtube.com',
      icon: (
        <span className="brand-dot-icon youtube-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </span>
      ),
    },
    {
      label: 'GitHub',
      url: 'https://github.com',
      icon: (
        <span className="brand-dot-icon github-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </span>
      ),
    },
    {
      label: 'ChatGPT',
      url: 'https://chatgpt.com',
      icon: (
        <span className="brand-dot-icon chatgpt-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#10A37F">
            <path d="M22.28 10.63a5.55 5.55 0 0 0-.48-4.54 5.65 5.65 0 0 0-3.9-2.73 5.55 5.55 0 0 0-4.64.96A5.55 5.55 0 0 0 8.9 3.03a5.66 5.66 0 0 0-3.8 2.86 5.57 5.57 0 0 0-.84 4.66 5.57 5.57 0 0 0-2.86 3.8 5.63 5.63 0 0 0 .97 4.63 5.56 5.56 0 0 0 .48 4.54 5.66 5.66 0 0 0 3.9 2.73 5.56 5.56 0 0 0 4.64-.96 5.56 5.56 0 0 0 4.36 1.29 5.65 5.65 0 0 0 3.8-2.86 5.57 5.57 0 0 0 .84-4.66 5.56 5.56 0 0 0 2.86-3.8 5.63 5.63 0 0 0-.97-4.63z" />
          </svg>
        </span>
      ),
    },
    {
      label: 'Stack Overflow',
      url: 'https://stackoverflow.com',
      icon: (
        <span className="brand-dot-icon so-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#F48024">
            <path d="M18.986 21.865v-6.408h2.134V24H1.84v-8.543h2.133v6.408h15.013zM6.111 19.731h10.68v-2.134H6.11v2.134zm.447-4.492l10.37 2.617.51-2.072-10.37-2.617-.51 2.072zm1.61-4.838l9.44 5.163.99-1.89-9.44-5.163-.99 1.89zm3.327-4.786l7.73 7.37 1.45-1.57-7.73-7.37-1.45 1.57zm5.55-5.615l-1.8 1.15 5.8 8.97 1.8-1.15-5.8-8.97z" />
          </svg>
        </span>
      ),
    },
    {
      label: 'Docs',
      url: 'https://developer.mozilla.org',
      icon: (
        <span className="brand-dot-icon docs-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </span>
      ),
    },
    {
      label: 'Hacker News',
      url: 'https://news.ycombinator.com',
      icon: (
        <span className="brand-dot-icon hn-icon">
          <span style={{ background: '#ff6600', color: '#fff', fontWeight: 800, padding: '0 3px', borderRadius: '2px', fontSize: '9px' }}>Y</span>
        </span>
      ),
    },
    {
      label: 'Wikipedia',
      url: 'https://wikipedia.org',
      icon: (
        <span className="brand-dot-icon wiki-icon">
          <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '10px', fontFamily: 'serif' }}>W</span>
        </span>
      ),
    },
  ];

  return (
    <div className="bookmarks-strip">
      <div
        className="bookmarks-chips-list"
        ref={chipsListRef}
        onWheel={handleWheel}
      >
        {/* Default Chips */}
        {defaultChips.map((chip) => (
          <button
            key={chip.url}
            className="bookmark-item-btn"
            onClick={() => onNavigate(chip.url)}
            onContextMenu={(e) => handleContextMenu(e, chip.url, chip.label)}
            title={chip.url}
          >
            {chip.icon}
            <span className="bookmark-title-text">{chip.label}</span>
          </button>
        ))}

        {/* User Saved Bookmarks */}
        {userBookmarks.map((bm) => (
          <button
            key={bm.id}
            className="bookmark-item-btn custom"
            onClick={() => onNavigate(bm.url)}
            onContextMenu={(e) => handleContextMenu(e, bm.url, bm.title || bm.url, bm.id)}
            title={`${bm.title || bm.url} (${bm.url})`}
          >
            <span className="brand-dot-icon">★</span>
            <span className="bookmark-title-text">{bm.title || bm.url}</span>
          </button>
        ))}

        {/* Add Bookmark Button */}
        <button
          className="bookmark-item-btn add-btn"
          onClick={handleAddBookmark}
          title="Add current tab to Bookmarks"
        >
          <Plus size={12} />
          <span>Add</span>
        </button>
      </div>

      {/* Right side utilities (App Matrix Grid Launcher) */}
      <div className="bookmarks-right-tools">
        {/* DualSurf App Matrix Launcher Button */}
        <button
          className="grid-apps-btn"
          onClick={() => {
            if (onOpenAppMatrix) onOpenAppMatrix();
          }}
          title="DualSurf App Matrix & Tools Launcher"
        >
          <LayoutGrid size={15} />
        </button>
      </div>

      {/* Context Menu for Bookmark Chips */}
      {contextMenu.isOpen && (
        <div
          className="tab-context-menu-popup"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              onNavigate(contextMenu.url);
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
          >
            <ExternalLink size={13} />
            <span>Open in Current Tab</span>
          </button>

          {onNewTab && (
            <button
              className="context-menu-item"
              onClick={() => {
                onNewTab(contextMenu.url);
                setContextMenu((prev) => ({ ...prev, isOpen: false }));
              }}
            >
              <Plus size={13} />
              <span>Open in New Tab</span>
            </button>
          )}

          <button
            className="context-menu-item"
            onClick={() => handleCopyUrl(contextMenu.url)}
          >
            <ClipboardCopy size={13} />
            <span>Copy URL</span>
          </button>

          {contextMenu.bookmarkId && (
            <>
              <div className="context-menu-divider" />
              <button
                className="context-menu-item danger"
                onClick={() => handleDeleteBookmark(contextMenu.bookmarkId!)}
              >
                <Trash2 size={13} />
                <span>Delete Bookmark</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
