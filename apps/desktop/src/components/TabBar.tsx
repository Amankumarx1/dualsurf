import React from 'react';
import { Globe, Plus, X, Terminal } from 'lucide-react';
import type { TabState } from '@dualsurf/shared-types';

interface TabBarProps {
  tabs: TabState[];
  activeTabId: string | null;
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
  onNewTab,
}) => {
  return (
    <div className="tab-bar-container">
      {/* Brand logo & title */}
      <div className="brand-badge" title="DualSurf Linux Browser">
        <Terminal className="brand-icon" />
        <span className="brand-name">DualSurf</span>
      </div>

      {/* Tabs */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`tab-item ${isActive ? 'active' : ''}`}
            onClick={() => onActivateTab(tab.id)}
            title={tab.url}
          >
            {tab.isLoading ? (
              <div className="tab-loading-spinner" />
            ) : tab.favicon ? (
              <img src={tab.favicon} alt="" className="tab-favicon" onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }} />
            ) : (
              <Globe size={14} className="tab-favicon" style={{ opacity: 0.7 }} />
            )}

            <span className="tab-title">{tab.title || 'Untitled'}</span>

            <button
              className="tab-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              title="Close Tab (Ctrl+W)"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {/* New tab button */}
      <button
        className="new-tab-btn"
        onClick={onNewTab}
        title="New Tab (Ctrl+T)"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};
