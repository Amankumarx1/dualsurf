import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Lock,
  Unlock,
  Search,
  Settings,
  Terminal,
  Bookmark,
  ExternalLink,
} from 'lucide-react';
import type { TabState } from '@dualsurf/shared-types';

interface NavigationBarProps {
  activeTab: TabState | null;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onStop: () => void;
  onToggleInspector: () => void;
  isInspectorOpen: boolean;
  onOpenSettings: () => void;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  activeTab,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onStop,
  onToggleInspector,
  isInspectorOpen,
  onOpenSettings,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused && activeTab) {
      setUrlInput(activeTab.url);
    }
  }, [activeTab?.url, isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      onNavigate(urlInput);
    } else if (e.key === 'Escape') {
      if (activeTab) {
        setUrlInput(activeTab.url);
      }
      e.currentTarget.blur();
    }
  };

  const getSchemeType = (url: string) => {
    if (url.startsWith('https://')) return 'secure';
    if (url.startsWith('http://')) return 'insecure';
    return 'search';
  };

  const schemeType = getSchemeType(urlInput);

  return (
    <div className="nav-toolbar">
      {/* Navigation Controls */}
      <div className="nav-controls">
        <button
          className="nav-btn"
          disabled={!activeTab?.canGoBack}
          onClick={onGoBack}
          title="Back (Alt+Left)"
        >
          <ArrowLeft size={16} />
        </button>

        <button
          className="nav-btn"
          disabled={!activeTab?.canGoForward}
          onClick={onGoForward}
          title="Forward (Alt+Right)"
        >
          <ArrowRight size={16} />
        </button>

        {activeTab?.isLoading ? (
          <button className="nav-btn" onClick={onStop} title="Stop Loading (Esc)">
            <X size={16} />
          </button>
        ) : (
          <button className="nav-btn" onClick={onReload} title="Reload (Ctrl+R)">
            <RotateCw size={16} />
          </button>
        )}
      </div>

      {/* Smart Address Bar */}
      <div className="address-bar-wrapper">
        <div
          className={`address-scheme-badge ${schemeType}`}
          title={
            schemeType === 'secure'
              ? 'Secure connection (HTTPS)'
              : schemeType === 'insecure'
              ? 'Not secure (HTTP)'
              : 'Search engine query'
          }
        >
          {schemeType === 'secure' && <Lock size={12} />}
          {schemeType === 'insecure' && <Unlock size={12} />}
          {schemeType === 'search' && <Search size={12} />}
          <span>{schemeType === 'secure' ? 'HTTPS' : schemeType === 'insecure' ? 'HTTP' : 'SEARCH'}</span>
        </div>

        <input
          type="text"
          className="address-input"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search DuckDuckGo or enter URL"
          spellCheck={false}
          autoComplete="off"
        />

        <div className="address-actions">
          {activeTab?.url && (
            <button
              className="action-icon-btn"
              onClick={() => {
                navigator.clipboard.writeText(activeTab.url);
              }}
              title="Copy URL"
            >
              <ExternalLink size={14} />
            </button>
          )}

          <button className="action-icon-btn" title="Bookmark this page">
            <Bookmark size={14} />
          </button>
        </div>
      </div>

      {/* Terminal Mode Inspector Trigger */}
      <button
        className={`terminal-inspector-btn ${isInspectorOpen ? 'active' : ''}`}
        onClick={onToggleInspector}
        title="Toggle Mode B Terminal Inspector (Links, Headings, Text Snapshot)"
      >
        <Terminal size={14} />
        <span>TUI Inspector</span>
      </button>

      {/* Settings */}
      <button
        className="nav-btn"
        onClick={onOpenSettings}
        title="Browser Settings"
      >
        <Settings size={16} />
      </button>
    </div>
  );
};
