import React, { useState, useEffect, useRef } from 'react';
import { Keyboard, X, Search } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'Tabs & Navigation' | 'Terminal & Shell' | 'Security & Inspect' | 'Data & Window';
}

const SHORTCUTS: ShortcutItem[] = [
  // Tabs & Navigation
  { keys: ['Ctrl', 'K'], description: 'Open Command Palette (or Ctrl+P)', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', 'T'], description: 'Open new tab', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', 'W'], description: 'Close active tab', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', '\\'], description: 'Toggle Dual Split Screen (side-by-side)', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', 'Shift', 'R'], description: 'Toggle Reader Mode (clean article view)', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', 'M'], description: 'Mute / Unmute active tab audio stream', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', 'Shift', 'T'], description: 'Reopen recently closed tab', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', 'Shift', 'A'], description: 'Fast tab switcher & fuzzy search', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', 'R'], description: 'Reload page (or F5)', category: 'Tabs & Navigation' },
  { keys: ['Alt', '←'], description: 'Navigate back', category: 'Tabs & Navigation' },
  { keys: ['Alt', '→'], description: 'Navigate forward', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', 'L'], description: 'Focus address bar (Omnibox)', category: 'Tabs & Navigation' },
  { keys: ['Esc'], description: 'Stop page loading / Close popups', category: 'Tabs & Navigation' },

  // Terminal & Shell
  { keys: ['Ctrl', '`'], description: 'Toggle Terminal / Browser mode', category: 'Terminal & Shell' },
  { keys: ['Ctrl', 'Shift', 'M'], description: 'Alternate toggle Terminal mode', category: 'Terminal & Shell' },
  { keys: ['Ctrl', 'R'], description: 'Reverse incremental history search', category: 'Terminal & Shell' },
  { keys: ['Ctrl', 'L'], description: 'Clear terminal screen buffer', category: 'Terminal & Shell' },
  { keys: ['Tab'], description: 'Autocomplete command name', category: 'Terminal & Shell' },
  { keys: ['↑', '↓'], description: 'Browse previous command history', category: 'Terminal & Shell' },

  // Security & Inspect
  { keys: ['Ctrl', 'I'], description: 'Toggle Page Inspector & DOM Drawer', category: 'Security & Inspect' },
  { keys: ['F12'], description: 'Toggle Chromium Developer Tools', category: 'Security & Inspect' },
  { keys: ['Ctrl', 'F'], description: 'Find text occurrences in page', category: 'Security & Inspect' },

  // Data & Window
  { keys: ['Ctrl', 'Shift', 'Del'], description: 'Clear browsing data (history, cookies, cache)', category: 'Data & Window' },
  { keys: ['Ctrl', 'H'], description: 'Open browsing history', category: 'Data & Window' },
  { keys: ['Ctrl', 'B'], description: 'Open saved bookmarks (or Ctrl+Shift+O)', category: 'Data & Window' },
  { keys: ['Ctrl', 'J'], description: 'Open downloads manager', category: 'Data & Window' },
  { keys: ['F11'], description: 'Toggle full screen mode', category: 'Data & Window' },
  { keys: ['Ctrl', '/'], description: 'Show keyboard shortcuts cheat sheet', category: 'Data & Window' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const filtered = SHORTCUTS.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.keys.some((k) => k.toLowerCase().includes(q))
    );
  });

  const categories = Array.from(new Set(filtered.map((s) => s.category)));

  return (
    <div className="tab-search-backdrop" onClick={onClose}>
      <div className="shortcuts-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <div className="shortcuts-title-box">
            <Keyboard size={18} className="shortcuts-title-icon" />
            <div>
              <div className="shortcuts-title">Keyboard Shortcuts</div>
              <div className="shortcuts-subtitle">DualSurf global navigation and operational hotkeys</div>
            </div>
          </div>
          <button className="tab-search-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={15} />
          </button>
        </div>

        <div className="shortcuts-search-wrap">
          <Search size={15} className="shortcuts-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="shortcuts-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter shortcuts (e.g. tab, terminal, inspect, history)..."
            spellCheck={false}
          />
        </div>

        <div className="shortcuts-list">
          {categories.length === 0 ? (
            <div className="shortcuts-empty">No shortcuts matching &quot;{query}&quot;</div>
          ) : (
            categories.map((cat) => {
              const catItems = filtered.filter((s) => s.category === cat);
              return (
                <div key={cat} className="shortcuts-category-group">
                  <div className="shortcuts-category-title">{cat}</div>
                  <div className="shortcuts-category-items">
                    {catItems.map((item, idx) => (
                      <div key={idx} className="shortcut-row">
                        <span className="shortcut-desc">{item.description}</span>
                        <div className="shortcut-keys-box">
                          {item.keys.map((k, kidx) => (
                            <React.Fragment key={kidx}>
                              <kbd className="shortcut-key-badge">{k}</kbd>
                              {kidx < item.keys.length - 1 && <span className="shortcut-plus">+</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="shortcuts-footer">
          <span>Tip: Press <kbd className="shortcut-key-badge">Ctrl</kbd> + <kbd className="shortcut-key-badge">/</kbd> or <kbd className="shortcut-key-badge">?</kbd> at any time to reopen this guide</span>
        </div>
      </div>
    </div>
  );
};
