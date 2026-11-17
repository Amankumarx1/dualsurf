import React, { useEffect, useState, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { TitleBar } from './components/TitleBar';
import { TabBar } from './components/TabBar';
import { NavigationBar } from './components/NavigationBar';
import { BookmarksBar } from './components/BookmarksBar';
import { Sidebar } from './components/Sidebar';
import { TerminalMode } from './components/terminal/TerminalMode';
import { NewTabPage } from './components/NewTabPage';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FindInPageBar } from './components/FindInPageBar';
import { HistoryModal } from './components/HistoryModal';
import { BookmarksModal } from './components/BookmarksModal';
import { DownloadsModal } from './components/DownloadsModal';

import { PageMetadataDrawer } from './components/PageMetadataDrawer';
import { TabSearchModal } from './components/TabSearchModal';
import { ClearBrowsingDataModal } from './components/ClearBrowsingDataModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ReaderModeModal } from './components/ReaderModeModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import type {
  TabState,
  BrowserControllerState,
  ActiveSessionState,
  BrowserSettings,
  WorkspaceGroup,
} from '@dualsurf/shared-types';

export const App: React.FC = () => {
  const [mode, setMode] = useState<'gui' | 'terminal'>('gui');
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState<string | undefined>(undefined);

  // Modals & Floating Overlays
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<'general' | 'appearance' | 'browser' | 'privacy' | 'terminal' | 'shortcuts' | 'about'>('general');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isMetadataDrawerOpen, setIsMetadataDrawerOpen] = useState(false);
  const [isTabSearchOpen, setIsTabSearchOpen] = useState(false);
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isReaderModeOpen, setIsReaderModeOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [pageSnapshot, setPageSnapshot] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [workspaces, setWorkspaces] = useState<WorkspaceGroup[]>([
    { id: 'default', name: 'General', color: '#ffffff', tabIds: [] },
    { id: 'dev', name: 'Development', color: '#00ff88', tabIds: [] },
  ]);
  const [settings, setSettings] = useState<BrowserSettings | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('dualsurf:theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.remove('light-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    localStorage.setItem('dualsurf:theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    document.documentElement.classList.add('ds-theme-transitioning');
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    setTimeout(() => {
      document.documentElement.classList.remove('ds-theme-transitioning');
    }, 220);
  };

  const titleBarRef = useRef<HTMLDivElement>(null);
  const navHeaderRef = useRef<HTMLDivElement>(null);
  const mainViewportRef = useRef<HTMLElement>(null);

  // Synchronize with Electron main process / Shared Controller
  useEffect(() => {
    if (!window.dualsurf) {
      console.warn('DualSurf API is not available on window. Ensure running in Electron.');
      return;
    }

    // Initial state fetch
    window.dualsurf.getState().then((state: BrowserControllerState) => {
      setTabs(state.tabs);
      setActiveTabId(state.activeTabId);
      setSplitTabId(state.splitTabId ?? null);
    });

    // Sync settings
    window.dualsurf.getSettings().then((s: BrowserSettings) => {
      setSettings(s);
      if (s.workspaces && s.workspaces.length > 0) {
        setWorkspaces(s.workspaces);
      }
      if (s.activeWorkspaceId) {
        setActiveWorkspaceId(s.activeWorkspaceId);
      }
    }).catch(() => { });

    // Subscribe to state changes from controller
    const unsubscribeState = window.dualsurf.onStateChanged((state: BrowserControllerState) => {
      setTabs(state.tabs);
      setActiveTabId(state.activeTabId);
      setSplitTabId(state.splitTabId ?? null);
    });

    // Subscribe to tab updates
    const unsubscribeTab = window.dualsurf.onTabUpdated((updatedTab: TabState) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === updatedTab.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedTab;
          return next;
        }
        return [...prev, updatedTab];
      });
    });

    return () => {
      unsubscribeState();
      unsubscribeTab();
    };
  }, []);

  // Synchronize modal state with Electron WebContentsView visibility
  const isAnyModalOpen = Boolean(
    isSettingsOpen ||
    isHistoryOpen ||
    isBookmarksOpen ||
    isDownloadsOpen ||
    isTabSearchOpen ||
    isClearDataOpen ||
    isShortcutsOpen ||
    isReaderModeOpen ||
    isCommandPaletteOpen ||
    isMetadataDrawerOpen
  );

  useEffect(() => {
    if (window.dualsurf?.setViewsVisible) {
      if (mode === 'gui') {
        window.dualsurf.setViewsVisible(!isAnyModalOpen);
      }
    }
  }, [isAnyModalOpen, mode]);

  // Workspace management & Tab isolation
  useEffect(() => {
    if (tabs.length === 0) return;
    setWorkspaces((prev) => {
      let modified = false;
      const allAssignedTabIds = new Set(prev.flatMap((w) => w.tabIds));
      const existingTabIds = new Set(tabs.map((t) => t.id));

      const next = prev.map((w) => {
        let currentTabIds = w.tabIds.filter((id) => existingTabIds.has(id));
        if (currentTabIds.length !== w.tabIds.length) {
          modified = true;
        }

        if (w.id === activeWorkspaceId) {
          const unassigned = tabs.filter((t) => !allAssignedTabIds.has(t.id)).map((t) => t.id);
          if (unassigned.length > 0) {
            modified = true;
            currentTabIds = [...currentTabIds, ...unassigned];
          }
        }

        return { ...w, tabIds: currentTabIds };
      });

      return modified ? next : prev;
    });
  }, [tabs, activeWorkspaceId]);

  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const visibleTabs = tabs.filter((t) => {
    if (currentWorkspace && currentWorkspace.tabIds.length > 0) {
      return currentWorkspace.tabIds.includes(t.id);
    }
    return true;
  });

  const handleSelectWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
    const targetWs = workspaces.find((w) => w.id === wsId);
    if (targetWs && targetWs.tabIds.length > 0) {
      const firstTab = targetWs.tabIds[0];
      if (firstTab && window.dualsurf) {
        window.dualsurf.activateTab(firstTab);
      }
    } else {
      if (window.dualsurf) {
        window.dualsurf.createTab('dualsurf://newtab');
      }
    }
  };

  // Update top bar layout height and content bounds for WebContentsView positioning
  const updateLayoutBounds = () => {
    if (window.dualsurf) {
      const titleHeight = titleBarRef.current?.offsetHeight || 38;
      const navHeight = navHeaderRef.current?.offsetHeight || 76;
      let totalTopHeight = titleHeight + navHeight;
      let sidebarWidth = isSidebarCollapsed ? 54 : 210;
      let availableWidth = Math.max(window.innerWidth - sidebarWidth, 100);
      let availableHeight = Math.max(window.innerHeight - totalTopHeight, 100);

      if (mainViewportRef.current) {
        const rect = mainViewportRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          sidebarWidth = Math.round(rect.left);
          totalTopHeight = Math.round(rect.top);
          const maxAvail = Math.max(window.innerWidth - sidebarWidth, 100);
          availableWidth = Math.max(100, Math.min(Math.round(rect.width), maxAvail));
          availableHeight = Math.max(Math.round(rect.height), 100);
        }
      }

      window.dualsurf.setContentBounds?.({
        x: sidebarWidth,
        y: totalTopHeight,
        width: availableWidth,
        height: availableHeight,
      });
    }
  };

  useEffect(() => {
    updateLayoutBounds();
    window.addEventListener('resize', updateLayoutBounds);

    const unsubMax = window.dualsurf?.onMaximizedChange?.(() => {
      updateLayoutBounds();
      setTimeout(updateLayoutBounds, 50);
      setTimeout(updateLayoutBounds, 150);
    });

    const unsubResized = window.dualsurf?.onWindowResized?.(() => {
      updateLayoutBounds();
      setTimeout(updateLayoutBounds, 50);
      setTimeout(updateLayoutBounds, 150);
    });

    let observer: ResizeObserver | null = null;
    if (mainViewportRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateLayoutBounds();
      });
      observer.observe(mainViewportRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateLayoutBounds);
      unsubMax?.();
      unsubResized?.();
      observer?.disconnect();
    };
  }, [tabs.length, isSidebarCollapsed, mode, activeSection]);

  // Handle Mode Switching: tell Electron main process to show/hide WebContentsView
  const handleModeChange = (newMode: 'gui' | 'terminal') => {
    setMode(newMode);
    setActiveSection(newMode === 'terminal' ? 'terminal' : 'home');
    if (window.dualsurf) {
      window.dualsurf.setTerminalMode(newMode === 'terminal');
    }
  };

  // Actions
  const handleActivateTab = (tabId: string) => {
    if (window.dualsurf) window.dualsurf.activateTab(tabId);
  };

  const handleCloseTab = (tabId: string) => {
    if (window.dualsurf) window.dualsurf.closeTab(tabId);
  };

  const handleToggleMuteTab = async (tabId: string) => {
    if (window.dualsurf) {
      await window.dualsurf.toggleMuteTab(tabId);
    }
  };

  const handleToggleSplitTab = async (tabId: string) => {
    if (window.dualsurf) {
      const isAlreadySplit = splitTabId === tabId;
      await window.dualsurf.setSplitTab(isAlreadySplit ? null : tabId);
    }
  };

  const handleNewTab = (initialUrl?: string) => {
    if (window.dualsurf) window.dualsurf.createTab(initialUrl);
  };

  const handleDuplicateTab = () => {
    if (window.dualsurf && activeTabId) {
      window.dualsurf.duplicateTab(activeTabId);
    }
  };

  const handleOpenSettings = (cat: 'general' | 'appearance' | 'browser' | 'privacy' | 'terminal' | 'shortcuts' | 'about' = 'general') => {
    setSettingsCategory(cat);
    setIsSettingsOpen(true);
  };

  const handleOpenAbout = () => {
    handleOpenSettings('about');
  };

  const handleNavigate = (url: string) => {
    if (window.dualsurf) window.dualsurf.navigate(activeTabId || undefined, url);
  };

  const handleGoBack = () => {
    if (window.dualsurf) window.dualsurf.goBack(activeTabId || undefined);
  };

  const handleGoForward = () => {
    if (window.dualsurf) window.dualsurf.goForward(activeTabId || undefined);
  };

  const handleReload = () => {
    if (window.dualsurf) window.dualsurf.reload(activeTabId || undefined);
  };

  const handleStop = () => {
    if (window.dualsurf) window.dualsurf.stop(activeTabId || undefined);
  };

  const handleFollowNumberedLink = (linkId: number) => {
    if (window.dualsurf) window.dualsurf.clickNumberedLink(activeTabId || undefined, linkId);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!window.dualsurf) return;

      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        if (isReaderModeOpen) setIsReaderModeOpen(false);
        if (isFindOpen) setIsFindOpen(false);
        if (isMetadataDrawerOpen) setIsMetadataDrawerOpen(false);
        if (isTabSearchOpen) setIsTabSearchOpen(false);
        if (isClearDataOpen) setIsClearDataOpen(false);
        if (isShortcutsOpen) setIsShortcutsOpen(false);
        if (isHistoryOpen) setIsHistoryOpen(false);
        if (isBookmarksOpen) setIsBookmarksOpen(false);
        if (isDownloadsOpen) setIsDownloadsOpen(false);
        if (isSettingsOpen) setIsSettingsOpen(false);
        return;
      }

      // If any modal/overlay is open, do not execute background tab/browser shortcuts
      if (isAnyModalOpen) return;

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p') && !e.shiftKey) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsReaderModeOpen((prev) => !prev);
      } else if ((isCtrlOrMeta && e.key.toLowerCase() === 'l' && !e.shiftKey) || (e.altKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('dualsurf:focus-address-bar'));
      } else if (isCtrlOrMeta && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1) {
          const currentIdx = tabs.findIndex((t) => t.id === activeTabId);
          if (e.shiftKey) {
            const prevIdx = (currentIdx - 1 + tabs.length) % tabs.length;
            handleActivateTab(tabs[prevIdx].id);
          } else {
            const nextIdx = (currentIdx + 1) % tabs.length;
            handleActivateTab(tabs[nextIdx].id);
          }
        }
      } else if (isCtrlOrMeta && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const digit = parseInt(e.key, 10);
        if (digit === 9 && tabs.length > 0) {
          handleActivateTab(tabs[tabs.length - 1].id);
        } else if (digit - 1 < tabs.length) {
          handleActivateTab(tabs[digit - 1].id);
        }
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'm' && !e.shiftKey) {
        e.preventDefault();
        if (activeTabId) handleToggleMuteTab(activeTabId);
      } else if (isCtrlOrMeta && e.key === '\\') {
        e.preventDefault();
        if (splitTabId) {
          handleToggleSplitTab(splitTabId);
        } else if (tabs.length > 1) {
          const other = tabs.find((t) => t.id !== activeTabId);
          if (other) handleToggleSplitTab(other.id);
        }
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab();
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) handleCloseTab(activeTabId);
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        window.dualsurf.reopenClosedTab();
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReload();
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsHistoryOpen(true);
      } else if (isCtrlOrMeta && (e.key.toLowerCase() === 'b' || (e.shiftKey && e.key.toLowerCase() === 'o'))) {
        e.preventDefault();
        setIsBookmarksOpen(true);
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsDownloadsOpen(true);
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFindOpen((prev) => !prev);
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsMetadataDrawerOpen((prev) => !prev);
      } else if (isCtrlOrMeta && (e.key === '`' || (e.shiftKey && e.key.toLowerCase() === 'm'))) {
        e.preventDefault();
        handleModeChange(mode === 'gui' ? 'terminal' : 'gui');
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsTabSearchOpen((prev) => !prev);
      } else if (isCtrlOrMeta && e.shiftKey && (e.key === 'Delete' || e.key === 'Del')) {
        e.preventDefault();
        setIsClearDataOpen(true);
      } else if ((isCtrlOrMeta && e.key === '/') || (!isCtrlOrMeta && e.key === '?' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'F11') {
        e.preventDefault();
        window.dualsurf.toggleFullScreen();
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (activeTabId) window.dualsurf.toggleDevTools(activeTabId);
      } else if (isCtrlOrMeta && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        if (activeTabId && window.dualsurf?.setZoom && window.dualsurf?.getZoom) {
          window.dualsurf.getZoom(activeTabId).then((curr: number) => {
            const next = Math.min(3.0, Math.round(((curr || 1.0) + 0.1) * 10) / 10);
            window.dualsurf.setZoom(activeTabId, next);
          }).catch(() => {});
        }
      } else if (isCtrlOrMeta && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        if (activeTabId && window.dualsurf?.setZoom && window.dualsurf?.getZoom) {
          window.dualsurf.getZoom(activeTabId).then((curr: number) => {
            const next = Math.max(0.5, Math.round(((curr || 1.0) - 0.1) * 10) / 10);
            window.dualsurf.setZoom(activeTabId, next);
          }).catch(() => {});
        }
      } else if (isCtrlOrMeta && e.key === '0') {
        e.preventDefault();
        if (activeTabId && window.dualsurf?.setZoom) {
          window.dualsurf.setZoom(activeTabId, 1.0).catch(() => {});
        }
      } else if ((isCtrlOrMeta && e.key === '[') || (e.altKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyModalOpen, activeTabId, mode, splitTabId, tabs, isFindOpen, isMetadataDrawerOpen, isTabSearchOpen, isClearDataOpen, isShortcutsOpen, isHistoryOpen, isBookmarksOpen, isDownloadsOpen, isSettingsOpen, isReaderModeOpen, isCommandPaletteOpen]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  const activeSession: ActiveSessionState = {
    activeTabId,
    url: activeTab?.url || 'about:blank',
    title: activeTab?.title || (activeTab?.isLoading ? 'Loading...' : 'New Tab'),
    mode,
    ipcConnected: Boolean(window.dualsurf),
    sessionConnected: Boolean(activeTab && !activeTab.error && activeTab.url && activeTab.url !== 'about:blank'),
    isLoading: Boolean(activeTab?.isLoading),
    canGoBack: Boolean(activeTab?.canGoBack),
    canGoForward: Boolean(activeTab?.canGoForward),
    error: activeTab?.error?.description || null,
  };

  // Determine if active tab is in a blank/new-tab state
  const isBlankTab =
    !activeTab ||
    activeTab.url === 'about:blank' ||
    activeTab.url === '' ||
    activeTab.url === 'dualsurf:newtab' ||
    activeTab.url === 'dualsurf://newtab' ||
    activeTab.url.startsWith('dualsurf://newtab');

  // Capture page snapshot when modal opens so native WebContentsView can be hidden without leaving a pitch-black void
  useEffect(() => {
    if (isAnyModalOpen) {
      if (!isBlankTab && window.dualsurf?.captureActivePage) {
        window.dualsurf.captureActivePage().then((dataUrl) => {
          if (dataUrl) setPageSnapshot(dataUrl);
        }).catch(() => {});
      }
    } else {
      setPageSnapshot(null);
    }
  }, [isAnyModalOpen, isBlankTab]);

  return (
    <div className="dualsurf-app-shell">
      {/* 1. Full-width Top Desktop Application TitleBar Header */}
      <div className="dualsurf-titlebar-wrapper" ref={titleBarRef}>
        <TitleBar
          onOpenSettings={() => handleOpenSettings('general')}
          onToggleTheme={handleToggleTheme}
          currentTheme={theme}
          mode={mode}
          onSwitchMode={handleModeChange}
          isConnected={Boolean(window.dualsurf)}
        >
          <TabBar
            tabs={visibleTabs.length > 0 ? visibleTabs : tabs}
            activeTabId={activeTabId}
            splitTabId={splitTabId}
            mode={mode}
            onSwitchMode={handleModeChange}
            onActivateTab={handleActivateTab}
            onCloseTab={handleCloseTab}
            onNewTab={() => handleNewTab()}
            onReloadTab={(id) => {
              if (window.dualsurf) window.dualsurf.reload(id);
            }}
            onTogglePinTab={(id) => {
              if (window.dualsurf) window.dualsurf.togglePinTab(id);
            }}
            onToggleMuteTab={handleToggleMuteTab}
            onToggleSplitTab={handleToggleSplitTab}
            onOpenTabSearch={() => setIsTabSearchOpen(true)}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={handleSelectWorkspace}
          />
        </TitleBar>
      </div>

      {/* Floating Find in Page Bar */}
      <FindInPageBar
        isOpen={isFindOpen}
        activeTabId={activeTabId}
        onClose={() => setIsFindOpen(false)}
      />

      {/* 2. Main Body Container: Left Sidebar + Right Main Browser Column */}
      <div className="dualsurf-body-container">
        <Sidebar
          mode={mode}
          activeSection={activeSection}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onSelectSection={(sec) => {
            setActiveSection(sec);
            if (sec === 'home') {
              handleNavigate('dualsurf://newtab');
              if (mode === 'terminal') handleModeChange('gui');
            } else if (sec === 'terminal') {
              handleModeChange('terminal');
            } else if (sec === 'history') {
              setIsHistoryOpen(true);
            } else if (sec === 'bookmarks') {
              setIsBookmarksOpen(true);
            } else if (sec === 'downloads') {
              setIsDownloadsOpen(true);
            } else if (sec === 'settings') {
              handleOpenSettings('general');
            } else if (sec === 'about') {
              handleOpenAbout();
            }
          }}
          onSwitchMode={handleModeChange}
          onOpenSettings={() => handleOpenSettings('general')}
          onOpenAbout={handleOpenAbout}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenBookmarks={() => setIsBookmarksOpen(true)}
          onOpenDownloads={() => setIsDownloadsOpen(true)}
          onOpenTabSearch={() => setIsTabSearchOpen(true)}
        />

        <div className="dualsurf-main-column">
          {/* Main Column Navigation & Bookmarks Header */}
          <header className="dualsurf-main-nav-header" ref={navHeaderRef}>
            <NavigationBar
              searchEngine={settings?.searchEngine || 'google'}
              activeTab={activeTab}
              tabs={tabs}
              splitTabId={splitTabId}
              mode={mode}
              onModeChange={handleModeChange}
              onNavigate={handleNavigate}
              onGoBack={handleGoBack}
              onGoForward={handleGoForward}
              onReload={handleReload}
              onStop={handleStop}
              onHome={() => handleNavigate('dualsurf://newtab')}
              onOpenSettings={() => handleOpenSettings('general')}
              onOpenHistory={() => setIsHistoryOpen(true)}
              onOpenBookmarks={() => setIsBookmarksOpen(true)}
              onOpenDownloads={() => setIsDownloadsOpen(true)}
              onOpenFind={() => setIsFindOpen(true)}
              onNewTab={() => handleNewTab()}
              onDuplicateTab={handleDuplicateTab}
              onOpenMetadataDrawer={() => setIsMetadataDrawerOpen((prev) => !prev)}
              onOpenTabSearch={() => setIsTabSearchOpen(true)}
              onOpenClearData={() => setIsClearDataOpen(true)}
              onOpenShortcuts={() => setIsShortcutsOpen(true)}
              onOpenReaderMode={() => setIsReaderModeOpen(true)}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              onToggleSplitTab={handleToggleSplitTab}
              onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
              isSidebarCollapsed={isSidebarCollapsed}
            />

            <BookmarksBar
              activeTab={activeTab}
              onNavigate={handleNavigate}
              onNewTab={(url) => handleNewTab(url)}
              mode={mode}
            />
          </header>

          <main className="dualsurf-main-viewport" ref={mainViewportRef}>
            {mode === 'terminal' ? (
              /* Mode B: Fullscreen Terminal Browser Workspace */
              <TerminalMode
                activeTab={activeTab}
                activeSession={activeSession}
                initialCommand={terminalCommand}
                onClearInitialCommand={() => setTerminalCommand(undefined)}
                onSwitchToGui={() => handleModeChange('gui')}
                onFollowLink={handleFollowNumberedLink}
              />
            ) : isBlankTab ? (
              /* Mode A: New Tab Hero Page */
              <NewTabPage
                searchEngine={settings?.searchEngine || 'google'}
                onUpdateSearchEngine={(engine) => {
                  if (window.dualsurf) {
                    window.dualsurf.updateSettings({ searchEngine: engine });
                  }
                  setSettings((prev) => (prev ? { ...prev, searchEngine: engine } : null));
                }}
                onNavigate={handleNavigate}
                onSwitchToTerminal={() => handleModeChange('terminal')}
                onNewTab={() => handleNewTab()}
                onOpenAbout={handleOpenAbout}
                onOpenSettings={() => handleOpenSettings('general')}
                activeTab={activeTab}
                activeSession={activeSession}
                theme={theme}
                onToggleTheme={handleToggleTheme}
              />
            ) : (
              /* Mode A: Native WebContentsView fills this space beneath the chrome in Electron */
              <div className="gui-viewport-container">
                {pageSnapshot && isAnyModalOpen && !isBlankTab && (
                  <div
                    className="gui-viewport-snapshot-bg"
                    style={{ backgroundImage: `url(${pageSnapshot})` }}
                  />
                )}
                {(window as any).isBrowserMock && activeTab?.url && (
                  <div className="browser-mock-web-viewport">
                    <div className="mock-viewport-header">
                      <div className="mock-viewport-left">
                        <span className="mock-url-badge">{activeTab.url}</span>
                        <span className="mock-sandbox-badge">Browser Preview</span>
                      </div>
                      <div className="mock-viewport-actions">
                        <a
                          href={activeTab.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mock-action-btn external"
                          title="Open in new window"
                        >
                          <ExternalLink size={12} />
                          <span>Open Direct</span>
                        </a>
                      </div>
                    </div>
                    <iframe
                      key={activeTab.url}
                      src={activeTab.url}
                      title={activeTab.title || 'Web View'}
                      className="mock-web-iframe"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Browser Modals */}
      <ErrorBoundary fallbackTitle="Settings Error" onReset={() => setIsSettingsOpen(false)}>
        <SettingsModal
          isOpen={isSettingsOpen}
          initialCategory={settingsCategory}
          onClose={() => setIsSettingsOpen(false)}
          onOpenClearData={() => setIsClearDataOpen(true)}
        />
      </ErrorBoundary>

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onNavigate={handleNavigate}
        onOpenNewTab={(url) => handleNewTab(url)}
      />

      <BookmarksModal
        isOpen={isBookmarksOpen}
        activeTab={activeTab}
        onClose={() => setIsBookmarksOpen(false)}
        onNavigate={handleNavigate}
        onOpenNewTab={(url) => handleNewTab(url)}
      />

      <DownloadsModal
        isOpen={isDownloadsOpen}
        onClose={() => setIsDownloadsOpen(false)}
      />

      {/* Page Inspection & DOM Metadata Drawer */}
      <PageMetadataDrawer
        isOpen={isMetadataDrawerOpen}
        onClose={() => setIsMetadataDrawerOpen(false)}
        activeTabId={activeTabId}
        onFollowLink={handleFollowNumberedLink}
      />

      {/* Fast Tab Switcher Modal (Ctrl+Shift+A) */}
      <TabSearchModal
        isOpen={isTabSearchOpen}
        tabs={tabs}
        activeTabId={activeTabId}
        onClose={() => setIsTabSearchOpen(false)}
        onActivateTab={handleActivateTab}
        onCloseTab={handleCloseTab}
        onTogglePinTab={(id) => {
          if (window.dualsurf) window.dualsurf.togglePinTab(id);
        }}
      />

      {/* Clear Browsing Data Modal (Ctrl+Shift+Del) */}
      <ClearBrowsingDataModal
        isOpen={isClearDataOpen}
        onClose={() => setIsClearDataOpen(false)}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal (Ctrl+/) */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Reader Mode Modal (Ctrl+Shift+R) */}
      <ReaderModeModal
        isOpen={isReaderModeOpen}
        activeTabId={activeTabId}
        onClose={() => setIsReaderModeOpen(false)}
      />

      {/* Command Palette Modal (Ctrl+K / Ctrl+P) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tabs={tabs}
        activeTabId={activeTabId}
        splitTabId={splitTabId}
        onActivateTab={handleActivateTab}
        onNewTab={() => handleNewTab()}
        onCloseTab={handleCloseTab}
        onToggleSplitTab={handleToggleSplitTab}
        onToggleMuteTab={handleToggleMuteTab}
        onOpenReaderMode={() => {
          setIsCommandPaletteOpen(false);
          setIsReaderModeOpen(true);
        }}
        onSwitchMode={handleModeChange}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenDownloads={() => setIsDownloadsOpen(true)}
        onOpenSettings={() => handleOpenSettings('general')}
        onOpenClearData={() => setIsClearDataOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenMetadataDrawer={() => setIsMetadataDrawerOpen(true)}
      />
    </div>
  );
};
