import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Globe, Pin, PinOff } from 'lucide-react';
import type { TabState } from '@dualsurf/shared-types';

interface TabSearchModalProps {
  isOpen: boolean;
  tabs: TabState[];
  activeTabId: string | null;
  onClose: () => void;
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
}

export const TabSearchModal: React.FC<TabSearchModalProps> = ({
  isOpen,
  tabs,
  activeTabId,
  onClose,
  onActivateTab,
  onCloseTab,
  onTogglePinTab,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredTabs = tabs.filter((t) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.url && t.url.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keep selected item in view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredTabs.length > 0 ? (prev + 1) % filteredTabs.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredTabs.length > 0 ? (prev - 1 + filteredTabs.length) % filteredTabs.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTabs[selectedIndex]) {
        onActivateTab(filteredTabs[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="tab-search-backdrop" onClick={onClose}>
      <div className="tab-search-card" onClick={(e) => e.stopPropagation()}>
        <div className="tab-search-header">
          <div className="tab-search-input-wrap">
            <Search size={16} className="tab-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="tab-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search open tabs by title or URL..."
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <span className="tab-search-count-badge">
            {filteredTabs.length} of {tabs.length} tabs
          </span>
          <button className="tab-search-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={15} />
          </button>
        </div>

        <div className="tab-search-list" ref={listRef}>
          {filteredTabs.length === 0 ? (
            <div className="tab-search-empty">
              No matching open tabs found for &quot;{query}&quot;
            </div>
          ) : (
            filteredTabs.map((tab, idx) => {
              const isSelected = idx === selectedIndex;
              const isActive = tab.id === activeTabId;
              const displayTitle = tab.title && tab.title !== 'about:blank' ? tab.title : 'New Tab';

              return (
                <div
                  key={tab.id}
                  className={`tab-search-item ${isSelected ? 'selected' : ''} ${isActive ? 'active-tab' : ''}`}
                  onClick={() => {
                    onActivateTab(tab.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="tab-search-item-left">
                    {tab.favicon ? (
                      <img
                        src={tab.favicon}
                        alt=""
                        className="tab-search-favicon"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Globe size={14} className="tab-search-favicon-fallback" />
                    )}

                    <div className="tab-search-item-details">
                      <div className="tab-search-item-title">
                        {displayTitle}
                        {isActive && <span className="tab-current-pill">Current</span>}
                        {tab.pinned && (
                          <span className="tab-pinned-pill" title="Pinned Tab">
                            <Pin size={10} /> Pinned
                          </span>
                        )}
                      </div>
                      <div className="tab-search-item-url">{tab.url}</div>
                    </div>
                  </div>

                  <div className="tab-search-item-actions" onClick={(e) => e.stopPropagation()}>
                    {onTogglePinTab && (
                      <button
                        className="tab-item-action-btn"
                        onClick={() => onTogglePinTab(tab.id)}
                        title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                      >
                        {tab.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                      </button>
                    )}
                    {!tab.pinned && (
                      <button
                        className="tab-item-action-btn close"
                        onClick={() => onCloseTab(tab.id)}
                        title="Close Tab"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="tab-search-footer">
          <span className="shortcut-hint"><kbd>↑↓</kbd> Navigate</span>
          <span className="shortcut-hint"><kbd>↵</kbd> Switch Tab</span>
          <span className="shortcut-hint"><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
};
