import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Plus,
  X,
  Github,
  RotateCw,
  Copy,
  Layers,
  ArrowRightToLine,
  ClipboardCopy,
  Pin,
  PinOff,
  Search,
  Undo2,
  Volume2,
  VolumeX,
  Columns2,
  ChevronDown,
  Check,
  Home,
  Terminal,
} from 'lucide-react';
import type { TabState, WorkspaceGroup } from '@dualsurf/shared-types';
import { DualSurfLogo } from './DualSurfLogo';

interface TabBarProps {
  tabs: TabState[];
  activeTabId: string | null;
  splitTabId?: string | null;
  mode?: 'gui' | 'terminal';
  onSwitchMode?: (mode: 'gui' | 'terminal') => void;
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onReloadTab?: (tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  onToggleMuteTab?: (tabId: string) => void;
  onToggleSplitTab?: (tabId: string) => void;
  onOpenTabSearch?: () => void;
  workspaces?: WorkspaceGroup[];
  activeWorkspaceId?: string;
  onSelectWorkspace?: (wsId: string) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  tabId: string;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  splitTabId,
  mode = 'gui',
  onSwitchMode,
  onActivateTab,
  onCloseTab,
  onNewTab,
  onReloadTab,
  onTogglePinTab,
  onToggleMuteTab,
  onToggleSplitTab,
  onOpenTabSearch,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    tabId: '',
  });

  const [isWsMenuOpen, setIsWsMenuOpen] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close workspace dropdown on outside click
  useEffect(() => {
    const handleWsOutsideClick = (e: MouseEvent) => {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setIsWsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleWsOutsideClick);
    return () => window.removeEventListener('mousedown', handleWsOutsideClick);
  }, []);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleCloseMenu = () => {
      if (contextMenu.isOpen) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('contextmenu', handleCloseMenu);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('contextmenu', handleCloseMenu);
    };
  }, [contextMenu.isOpen]);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: e.clientY,
      tabId,
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollRef.current && e.deltaY !== 0) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleTogglePin = async (tabId: string) => {
    if (onTogglePinTab) {
      onTogglePinTab(tabId);
    } else if (window.dualsurf) {
      await window.dualsurf.togglePinTab(tabId);
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleToggleMute = async (tabId: string) => {
    if (onToggleMuteTab) {
      onToggleMuteTab(tabId);
    } else if (window.dualsurf) {
      await window.dualsurf.toggleMuteTab(tabId);
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleToggleSplit = async (tabId: string) => {
    if (onToggleSplitTab) {
      onToggleSplitTab(tabId);
    } else if (window.dualsurf) {
      const isAlreadySplit = splitTabId === tabId;
      await window.dualsurf.setSplitTab(isAlreadySplit ? null : tabId);
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleDuplicate = async (tabId: string) => {
    if (window.dualsurf) {
      await window.dualsurf.duplicateTab(tabId);
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCloseOthers = async (tabId: string) => {
    if (window.dualsurf) {
      await window.dualsurf.closeOtherTabs(tabId);
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCloseRight = async (tabId: string) => {
    if (window.dualsurf) {
      await window.dualsurf.closeTabsToTheRight(tabId);
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCopyUrl = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.url) {
      navigator.clipboard.writeText(tab.url);
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleReopenClosed = async () => {
    if (window.dualsurf) {
      await window.dualsurf.reopenClosedTab();
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const getTabIcon = (tab: TabState) => {
    if (tab.isLoading) {
      return <div className="tab-spinner" />;
    }
    if (tab.favicon) {
      return (
        <img
          src={tab.favicon}
          alt=""
          className="tab-favicon"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    const lower = (tab.url || '').toLowerCase();
    if (!lower || lower === 'about:blank' || lower.startsWith('dualsurf:')) {
      return <DualSurfLogo size={13} variant="orange" className="tab-favicon" />;
    }
    if (lower.includes('github.com')) {
      return <Github size={13} className="tab-favicon" />;
    }
    if (lower.includes('duckduckgo.com')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#de5833',
            color: '#fff',
            fontSize: 9,
            fontWeight: 800,
          }}
        >
          D
        </span>
      );
    }
    return <Globe size={13} className="tab-favicon fallback" />;
  };

  const targetTab = tabs.find((t) => t.id === contextMenu.tabId);

  return (
    <div className="tab-bar-strip">
      {workspaces && workspaces.length > 0 && (() => {
        const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
        return (
          <div className="workspace-selector-container" ref={wsMenuRef}>
            <button
              className="workspace-selector-trigger"
              onClick={() => setIsWsMenuOpen(!isWsMenuOpen)}
              title={`Workspace: ${activeWs.name} (Click to switch)`}
            >
              <span className="workspace-color-dot" style={{ backgroundColor: activeWs.color }} />
              <span className="workspace-selector-name">{activeWs.name}</span>
              <ChevronDown size={11} className={`ws-chevron ${isWsMenuOpen ? 'open' : ''}`} />
            </button>

            {isWsMenuOpen && (
              <div className="workspace-dropdown-menu">
                <div className="ws-dropdown-header">WORKSPACES</div>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    className={`ws-dropdown-item ${activeWorkspaceId === ws.id ? 'active' : ''}`}
                    onClick={() => {
                      onSelectWorkspace?.(ws.id);
                      setIsWsMenuOpen(false);
                    }}
                  >
                    <span className="workspace-color-dot" style={{ backgroundColor: ws.color }} />
                    <span className="ws-item-name">{ws.name}</span>
                    {activeWorkspaceId === ws.id && <Check size={12} className="ws-item-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      <div
        className="tabs-scroll-container"
        ref={scrollRef}
        onWheel={handleWheel}
      >
        {mode === 'terminal' ? (
          <>
            <div
              className="tab-chip"
              onClick={() => onSwitchMode?.('gui')}
              title="Home (Browser Mode)"
              style={{ cursor: 'pointer' }}
            >
              <Home size={13} className="tab-favicon" />
              <span className="tab-title-text">Home</span>
            </div>
            <div
              className="tab-chip active terminal-tab-chip"
              title="Terminal Workspace"
              style={{
                cursor: 'default',
              }}
            >
              <Terminal size={13} className="tab-favicon" color="var(--ds-orange, #F45B19)" />
              <span className="tab-title-text" style={{ fontWeight: 600 }}>Terminal</span>
              <button
                className="tab-close-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwitchMode?.('gui');
                }}
                title="Close Terminal (Ctrl+W)"
              >
                <X size={12} />
              </button>
            </div>
            <button
              className="tab-add-btn"
              onClick={onNewTab}
              title="New Tab (Ctrl+T)"
            >
              <Plus size={15} />
            </button>
          </>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            let displayTitle = tab.title && tab.title !== 'about:blank' ? tab.title : 'New Tab';
            if (displayTitle.toLowerCase() === 'newtab' || displayTitle === 'dualsurf://newtab') {
              displayTitle = 'New Tab';
            }

            return (
              <div
                key={tab.id}
                className={`tab-chip ${isActive ? 'active' : ''} ${tab.pinned ? 'pinned' : ''} ${tab.id === splitTabId ? 'split-active' : ''} ${tab.isLoading ? 'loading' : ''}`}
                onClick={() => onActivateTab(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1 && !tab.pinned) {
                    e.preventDefault();
                    onCloseTab(tab.id);
                  }
                }}
                title={tab.pinned ? `${displayTitle} (Pinned) - ${tab.url}` : `${displayTitle} - ${tab.url}`}
              >
                {getTabIcon(tab)}
                {!tab.pinned && <span className="tab-title-text">{displayTitle}</span>}
                {tab.pinned && <Pin size={10} className="tab-pinned-indicator" />}

                {/* Split Screen Indicator */}
                {tab.id === splitTabId && (
                  <span className="tab-split-badge" title="Active in Dual Split Screen">
                    <Columns2 size={11} />
                  </span>
                )}

                {/* Audio Playback & Mute Indicator */}
                {(tab.isAudioPlaying || tab.muted) && (
                  <button
                    className={`tab-audio-icon ${tab.muted ? 'muted' : 'playing'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleMute(tab.id);
                    }}
                    title={tab.muted ? 'Tab is muted (click to unmute)' : 'Tab is playing audio (click to mute)'}
                  >
                    {tab.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  </button>
                )}

                {!tab.pinned && (
                  <button
                    className="tab-close-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    title="Close Tab (Ctrl+W)"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })
        )}

        {mode !== 'terminal' && (
          <button
            className="tab-add-btn"
            onClick={onNewTab}
            title="New Tab (Ctrl+T)"
          >
            <Plus size={15} />
          </button>
        )}

        {/* Tab Search Fast Switcher Button */}
        {onOpenTabSearch && (
          <button
            className="tab-add-btn tab-search-toggle-btn"
            onClick={onOpenTabSearch}
            title="Search Tabs (Ctrl+Shift+A)"
          >
            <Search size={13} />
          </button>
        )}
      </div>

      {/* Tab Context Menu */}
      {contextMenu.isOpen && (
        <div
          className="tab-context-menu-popup"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => handleTogglePin(contextMenu.tabId)}
          >
            {targetTab?.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            <span>{targetTab?.pinned ? 'Unpin Tab' : 'Pin Tab'}</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleToggleMute(contextMenu.tabId)}
          >
            {targetTab?.muted ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{targetTab?.muted ? 'Unmute Tab' : 'Mute Tab'}</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleToggleSplit(contextMenu.tabId)}
          >
            <Columns2 size={13} />
            <span>{splitTabId === contextMenu.tabId ? 'Close Split View' : 'Split View to Right'}</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              if (onReloadTab) onReloadTab(contextMenu.tabId);
              else if (window.dualsurf) window.dualsurf.reload(contextMenu.tabId);
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
          >
            <RotateCw size={13} />
            <span>Reload Tab</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleDuplicate(contextMenu.tabId)}
          >
            <Copy size={13} />
            <span>Duplicate Tab</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleCopyUrl(contextMenu.tabId)}
          >
            <ClipboardCopy size={13} />
            <span>Copy URL</span>
          </button>
          <button
            className="context-menu-item"
            onClick={handleReopenClosed}
          >
            <Undo2 size={13} />
            <span>Reopen Closed Tab</span>
          </button>
          <div className="context-menu-divider" />
          {!targetTab?.pinned && (
            <button
              className="context-menu-item"
              onClick={() => {
                onCloseTab(contextMenu.tabId);
                setContextMenu((prev) => ({ ...prev, isOpen: false }));
              }}
            >
              <X size={13} />
              <span>Close Tab</span>
            </button>
          )}
          <button
            className="context-menu-item"
            onClick={() => handleCloseOthers(contextMenu.tabId)}
          >
            <Layers size={13} />
            <span>Close Other Tabs</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleCloseRight(contextMenu.tabId)}
          >
            <ArrowRightToLine size={13} />
            <span>Close Tabs to the Right</span>
          </button>
        </div>
      )}
    </div>
  );
};
