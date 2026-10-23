import React, { useEffect, useState, useRef } from 'react';
import { ExternalLink, Shield, Send, Database } from 'lucide-react';
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
import { AppMatrixModal } from './components/AppMatrixModal';
import { PageMetadataDrawer } from './components/PageMetadataDrawer';
import { TabSearchModal } from './components/TabSearchModal';
import { ClearBrowsingDataModal } from './components/ClearBrowsingDataModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ReaderModeModal } from './components/ReaderModeModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { OllamaSetupModal } from './components/OllamaSetupModal';
import { AiCopilotSidebar } from './components/AiCopilotSidebar';
import { CyberShieldDropdown } from './components/CyberShieldDropdown';
import { TrafficSnifferModal } from './components/TrafficSnifferModal';
import { ProxySwitcherModal } from './components/ProxySwitcherModal';
import { CookieEditorModal } from './components/CookieEditorModal';
import { UserAgentModal } from './components/UserAgentModal';
import { AttackSurfaceGraphModal } from './components/AttackSurfaceGraphModal';
import { CyberToolsModal } from './components/CyberToolsModal';
import { HttpRepeaterModal } from './components/HttpRepeaterModal';
import { PrivacyAuditModal } from './components/PrivacyAuditModal';
import { RedTeamWorkspace } from './components/security/RedTeamWorkspace';
import { BlueTeamWorkspace } from './components/security/BlueTeamWorkspace';
import { PurpleTeamWorkspace } from './components/security/PurpleTeamWorkspace';
import { WorkspaceAccessModal } from './components/terminal/WorkspaceAccessModal';
import type {
  TabState,
  BrowserControllerState,
  ActiveSessionState,
  BrowserSettings,
  WorkspaceGroup,
  PageMetadata,
  ProxyConfig,
  RawHttpRequest,
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const [isAppMatrixOpen, setIsAppMatrixOpen] = useState(false);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isMetadataDrawerOpen, setIsMetadataDrawerOpen] = useState(false);
  const [isTabSearchOpen, setIsTabSearchOpen] = useState(false);
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isReaderModeOpen, setIsReaderModeOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isOllamaSetupOpen, setIsOllamaSetupOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isTrafficSnifferOpen, setIsTrafficSnifferOpen] = useState(false);
  const [isShieldDropdownOpen, setIsShieldDropdownOpen] = useState(false);
  const [isProxyModalOpen, setIsProxyModalOpen] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isUserAgentModalOpen, setIsUserAgentModalOpen] = useState(false);
  const [isAttackSurfaceModalOpen, setIsAttackSurfaceModalOpen] = useState(false);
  const [isCyberToolsModalOpen, setIsCyberToolsModalOpen] = useState(false);
  const [isRepeaterOpen, setIsRepeaterOpen] = useState(false);
  const [repeaterInitialReq, setRepeaterInitialReq] = useState<RawHttpRequest | null>(null);
  const [isPrivacyAuditOpen, setIsPrivacyAuditOpen] = useState(false);
  const [isWorkspaceAccessOpen, setIsWorkspaceAccessOpen] = useState(false);
  const [workspaceDir, setWorkspaceDir] = useState<string>('');
  const [pageMetadata, setPageMetadata] = useState<PageMetadata | null>(null);
  const [pageSnapshot, setPageSnapshot] = useState<string | null>(null);
  const [activeProxyConfig, setActiveProxyConfig] = useState<ProxyConfig>({ mode: 'direct' });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');
  const [workspaces, setWorkspaces] = useState<WorkspaceGroup[]>([
    { id: 'default', name: 'General', color: '#ffffff', tabIds: [] },
    { id: 'recon', name: 'Recon & Security', color: '#ff0055', tabIds: [] },
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
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const headerRef = useRef<HTMLDivElement>(null);

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

    // Check if Kali workspace directory access has been granted
    if (window.dualsurf.getWorkspaceSandboxDir) {
      window.dualsurf.getWorkspaceSandboxDir().then((res) => {
        if (res?.path) setWorkspaceDir(res.path);
        if (!res?.hasGranted) {
          setIsWorkspaceAccessOpen(true);
        }
      }).catch(() => {});
    }

    // Check if Ollama setup onboarding has been completed and sync settings
    window.dualsurf.getSettings().then((s: BrowserSettings) => {
      setSettings(s);
      if (s.workspaceSandboxDir) {
        setWorkspaceDir(s.workspaceSandboxDir);
      }
      if (s.proxy) {
        setActiveProxyConfig(s.proxy);
      }
      if (s.workspaces && s.workspaces.length > 0) {
        setWorkspaces(s.workspaces);
      }
      if (s.activeWorkspaceId) {
        setActiveWorkspaceId(s.activeWorkspaceId);
      }
      const onboarded = s.ollama?.onboardingCompleted || localStorage.getItem('dualsurf_ollama_onboarded') === 'true';
      if (!onboarded) {
        setIsOllamaSetupOpen(true);
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
  // Whenever any modal/overlay is open, hide the native WebContentsView so the modal renders in full glory on top!
  const isAnyModalOpen = Boolean(
    isSettingsOpen ||
    isHistoryOpen ||
    isBookmarksOpen ||
    isDownloadsOpen ||
    isAppMatrixOpen ||
    isTabSearchOpen ||
    isClearDataOpen ||
    isShortcutsOpen ||
    isReaderModeOpen ||
    isCommandPaletteOpen ||
    isOllamaSetupOpen ||
    isCopilotOpen ||
    isTrafficSnifferOpen ||
    isShieldDropdownOpen ||
    isProxyModalOpen ||
    isCookieModalOpen ||
    isUserAgentModalOpen ||
    isAttackSurfaceModalOpen ||
    isCyberToolsModalOpen ||
    isRepeaterOpen ||
    isPrivacyAuditOpen ||
    isMetadataDrawerOpen ||
    isWorkspaceAccessOpen
  );

  const handleGrantWorkspaceAccess = async (selectedPath: string) => {
    if (window.dualsurf?.setWorkspaceSandboxDir) {
      const res = await window.dualsurf.setWorkspaceSandboxDir(selectedPath);
      if (res?.success) {
        setWorkspaceDir(res.path);
        setSettings((prev) => prev ? { ...prev, workspaceSandboxDir: res.path, hasGrantedWorkspaceAccess: true } : null);
      }
    } else {
      setWorkspaceDir(selectedPath);
      localStorage.setItem('dualsurf_workspace_granted', 'true');
    }
    setIsWorkspaceAccessOpen(false);
  };

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

  // Update top bar layout height for WebContentsView positioning
  const updateLayoutBounds = () => {
    if (headerRef.current && window.dualsurf) {
      const height = headerRef.current.offsetHeight;
      window.dualsurf.setTopBarHeight(height);
    }
  };

  useEffect(() => {
    updateLayoutBounds();
    window.addEventListener('resize', updateLayoutBounds);
    return () => window.removeEventListener('resize', updateLayoutBounds);
  }, [tabs.length]);

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

  const handleOpenAttackSurface = async () => {
    if (window.dualsurf && activeTabId) {
      try {
        const meta = await window.dualsurf.getPageMetadata(activeTabId);
        setPageMetadata(meta);
      } catch { }
    }
    setIsAttackSurfaceModalOpen(true);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!window.dualsurf) return;

      if (e.key === 'Escape') {
        if (isRepeaterOpen) setIsRepeaterOpen(false);
        if (isPrivacyAuditOpen) setIsPrivacyAuditOpen(false);
        if (isProxyModalOpen) setIsProxyModalOpen(false);
        if (isCookieModalOpen) setIsCookieModalOpen(false);
        if (isUserAgentModalOpen) setIsUserAgentModalOpen(false);
        if (isAttackSurfaceModalOpen) setIsAttackSurfaceModalOpen(false);
        if (isCyberToolsModalOpen) setIsCyberToolsModalOpen(false);
        if (isCopilotOpen) setIsCopilotOpen(false);
        if (isTrafficSnifferOpen) setIsTrafficSnifferOpen(false);
        if (isShieldDropdownOpen) setIsShieldDropdownOpen(false);
        if (isOllamaSetupOpen) setIsOllamaSetupOpen(false);
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
        if (isAppMatrixOpen) setIsAppMatrixOpen(false);
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
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsProxyModalOpen((prev) => !prev);
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsCookieModalOpen((prev) => !prev);
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setIsUserAgentModalOpen((prev) => !prev);
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCyberToolsModalOpen((prev) => !prev);
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsRepeaterOpen((prev) => !prev);
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsPrivacyAuditOpen((prev) => !prev);
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
      } else if (e.ctrlKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsCopilotOpen((prev) => !prev);
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setIsTrafficSnifferOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyModalOpen, activeTabId, mode, splitTabId, tabs, isFindOpen, isMetadataDrawerOpen, isTabSearchOpen, isClearDataOpen, isShortcutsOpen, isHistoryOpen, isBookmarksOpen, isDownloadsOpen, isAppMatrixOpen, isSettingsOpen, isReaderModeOpen, isCommandPaletteOpen, isOllamaSetupOpen, isCopilotOpen, isTrafficSnifferOpen, isShieldDropdownOpen, isProxyModalOpen, isCookieModalOpen, isUserAgentModalOpen, isAttackSurfaceModalOpen, isCyberToolsModalOpen, isRepeaterOpen, isPrivacyAuditOpen]);

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
      {/* Top Application Chrome Header */}
      <header className="dualsurf-header-chrome" ref={headerRef}>
        <TitleBar
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenWorkspaceModal={() => setIsWorkspaceAccessOpen(true)}
          workspaceDir={workspaceDir || settings?.workspaceSandboxDir}
          onToggleTheme={handleToggleTheme}
          currentTheme={theme}
          mode={mode}
          onSwitchMode={handleModeChange}
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
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenBookmarks={() => setIsBookmarksOpen(true)}
          onOpenDownloads={() => setIsDownloadsOpen(true)}
          onOpenFind={() => setIsFindOpen(true)}
          onNewTab={() => handleNewTab()}
          onDuplicateTab={handleDuplicateTab}
          onOpenMetadataDrawer={() => setIsMetadataDrawerOpen((prev) => !prev)}
          onRunTool={(tool) => {
            setTerminalCommand(tool);
            handleModeChange('terminal');
          }}
          onOpenTabSearch={() => setIsTabSearchOpen(true)}
          onOpenClearData={() => setIsClearDataOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenReaderMode={() => setIsReaderModeOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onToggleSplitTab={handleToggleSplitTab}
          onOpenOllamaSetup={() => setIsOllamaSetupOpen(true)}
          onToggleCopilot={() => setIsCopilotOpen((prev) => !prev)}
          isCopilotOpen={isCopilotOpen}
          onToggleShieldDropdown={() => setIsShieldDropdownOpen((prev) => !prev)}
          isShieldDropdownOpen={isShieldDropdownOpen}
          onOpenTrafficSniffer={() => setIsTrafficSnifferOpen(true)}
          onOpenProxyModal={() => setIsProxyModalOpen(true)}
          activeProxyMode={activeProxyConfig.mode}
          onOpenCookieModal={() => setIsCookieModalOpen(true)}
          onOpenUserAgentModal={() => setIsUserAgentModalOpen(true)}
          onOpenAttackSurfaceModal={handleOpenAttackSurface}
          onOpenCyberTools={() => setIsCyberToolsModalOpen(true)}
          onOpenHttpRepeater={() => setIsRepeaterOpen(true)}
          onOpenPrivacyAudit={() => setIsPrivacyAuditOpen(true)}
        />

        <BookmarksBar
          activeTab={activeTab}
          onNavigate={handleNavigate}
          onNewTab={(url) => handleNewTab(url)}
          onOpenAppMatrix={() => setIsAppMatrixOpen(true)}
          mode={mode}
        />
      </header>

      {/* Floating Find in Page Bar */}
      <FindInPageBar
        isOpen={isFindOpen}
        activeTabId={activeTabId}
        onClose={() => setIsFindOpen(false)}
      />

      {/* Workspace Area: Left Navigation Sidebar + Right Main Card Viewport */}
      <div className="dualsurf-workspace-layout">
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
              setIsSettingsOpen(true);
            } else if (sec === 'about') {
              setIsAppMatrixOpen(true);
            }
          }}
          onSwitchMode={handleModeChange}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAbout={() => setIsAppMatrixOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenBookmarks={() => setIsBookmarksOpen(true)}
          onOpenDownloads={() => setIsDownloadsOpen(true)}
          onOpenTools={() => setIsCyberToolsModalOpen(true)}
          onOpenNetwork={handleOpenAttackSurface}
          onOpenProxy={() => setIsProxyModalOpen(true)}
          onOpenRepeater={() => setIsRepeaterOpen(true)}
          onOpenRedTeam={() => {
            setActiveSection('red-team');
            if (mode === 'terminal') handleModeChange('gui');
          }}
          onOpenBlueTeam={() => {
            setActiveSection('blue-team');
            if (mode === 'terminal') handleModeChange('gui');
          }}
          onOpenPurpleTeam={() => {
            setActiveSection('purple-team');
            if (mode === 'terminal') handleModeChange('gui');
          }}
          onOpenTabSearch={() => setIsTabSearchOpen(true)}
        />

        <main className="dualsurf-main-viewport">
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
          ) : activeSection === 'blue-team' ? (
            <BlueTeamWorkspace
              onSwitchToTerminal={(cmd) => {
                setTerminalCommand(cmd);
                handleModeChange('terminal');
              }}
              activeUrl={activeTab?.url}
            />
          ) : activeSection === 'red-team' ? (
            <RedTeamWorkspace
              onSwitchToTerminal={(cmd) => {
                setTerminalCommand(cmd);
                handleModeChange('terminal');
              }}
              activeUrl={activeTab?.url}
            />
          ) : activeSection === 'purple-team' ? (
            <PurpleTeamWorkspace
              onSwitchToTerminal={(cmd) => {
                setTerminalCommand(cmd);
                handleModeChange('terminal');
              }}
              activeUrl={activeTab?.url}
            />
          ) : isBlankTab ? (
            /* Mode A: New Tab Hero Page matching Screenshot 1 */
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
              onOpenAbout={() => setIsAppMatrixOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenCyberTools={() => setIsCyberToolsModalOpen(true)}
              onOpenTrafficSniffer={() => setIsTrafficSnifferOpen(true)}
              onOpenProxyModal={() => setIsProxyModalOpen(true)}
              activeTab={activeTab}
              activeSession={activeSession}
              activeProxyMode={activeProxyConfig.mode}
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
                      <span className="mock-sandbox-badge">Sandboxed Cyber Browser Preview</span>
                    </div>
                    <div className="mock-viewport-actions">
                      <button
                        className="mock-action-btn"
                        onClick={() => setIsPrivacyAuditOpen(true)}
                        title="Audit Target Security"
                      >
                        <Shield size={12} />
                        <span>Audit</span>
                      </button>
                      <button
                        className="mock-action-btn"
                        onClick={() => setIsRepeaterOpen(true)}
                        title="Open HTTP Repeater"
                      >
                        <Send size={12} />
                        <span>Repeater</span>
                      </button>
                      <button
                        className="mock-action-btn"
                        onClick={() => setIsTrafficSnifferOpen(true)}
                        title="Inspect Traffic Logs"
                      >
                        <Database size={12} />
                        <span>Sniffer</span>
                      </button>
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

      {/* Browser Modals */}
      <ErrorBoundary fallbackTitle="Settings Error" onReset={() => setIsSettingsOpen(false)}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onOpenOllamaSetup={() => setIsOllamaSetupOpen(true)}
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

      <AppMatrixModal
        isOpen={isAppMatrixOpen}
        onClose={() => setIsAppMatrixOpen(false)}
        onOpenSection={(sec) => {
          if (sec === 'history') setIsHistoryOpen(true);
          else if (sec === 'bookmarks') setIsBookmarksOpen(true);
          else if (sec === 'downloads') setIsDownloadsOpen(true);
          else if (sec === 'settings') setIsSettingsOpen(true);
        }}
        onOpenTool={(tool) => {
          if (tool === 'repeater') setIsRepeaterOpen(true);
          else if (tool === 'sniffer') setIsTrafficSnifferOpen(true);
          else if (tool === 'proxy') setIsProxyModalOpen(true);
          else if (tool === 'audit') setIsPrivacyAuditOpen(true);
          else if (tool === 'surface') handleOpenAttackSurface();
          else if (tool === 'cookies') setIsCookieModalOpen(true);
          else if (tool === 'cybertools') setIsCyberToolsModalOpen(true);
          else if (tool === 'useragent') setIsUserAgentModalOpen(true);
          else {
            setTerminalCommand(tool);
            handleModeChange('terminal');
          }
        }}
      />

      {/* Page Inspection & DOM Metadata Drawer */}
      <PageMetadataDrawer
        isOpen={isMetadataDrawerOpen}
        onClose={() => setIsMetadataDrawerOpen(false)}
        activeTabId={activeTabId}
        onFollowLink={handleFollowNumberedLink}
        onRunTool={(tool) => {
          setTerminalCommand(tool);
          handleModeChange('terminal');
        }}
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
        onRunTool={(tool) => {
          setTerminalCommand(tool);
          handleModeChange('terminal');
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenDownloads={() => setIsDownloadsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenClearData={() => setIsClearDataOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenMetadataDrawer={() => setIsMetadataDrawerOpen(true)}
        onOpenOllamaSetup={() => {
          setIsCommandPaletteOpen(false);
          setIsOllamaSetupOpen(true);
        }}
        onToggleCopilot={() => {
          setIsCommandPaletteOpen(false);
          setIsCopilotOpen((prev) => !prev);
        }}
        onOpenTrafficSniffer={() => {
          setIsCommandPaletteOpen(false);
          setIsTrafficSnifferOpen(true);
        }}
        onOpenHttpRepeater={() => {
          setIsCommandPaletteOpen(false);
          setIsRepeaterOpen(true);
        }}
        onOpenPrivacyAudit={() => {
          setIsCommandPaletteOpen(false);
          setIsPrivacyAuditOpen(true);
        }}
      />

      {/* Ollama Setup & Configuration Wizard Modal */}
      <OllamaSetupModal
        isOpen={isOllamaSetupOpen}
        onClose={() => setIsOllamaSetupOpen(false)}
      />

      {/* Cyber Shield Dropdown */}
      <CyberShieldDropdown
        isOpen={isShieldDropdownOpen}
        onClose={() => setIsShieldDropdownOpen(false)}
        activeTab={activeTab}
        onOpenTrafficSniffer={() => setIsTrafficSnifferOpen(true)}
        onOpenPrivacyAudit={() => setIsPrivacyAuditOpen(true)}
        onOpenProxyModal={() => setIsProxyModalOpen(true)}
      />

      {/* AI Copilot Sidebar */}
      <AiCopilotSidebar
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeTab={activeTab}
        ollamaSettings={settings?.ollama}
        onOpenOllamaSetup={() => setIsOllamaSetupOpen(true)}
      />

      {/* Live Cyber Traffic Sniffer Modal */}
      <TrafficSnifferModal
        isOpen={isTrafficSnifferOpen}
        onClose={() => setIsTrafficSnifferOpen(false)}
        activeTab={activeTab}
        onSendToRepeater={(req) => {
          setRepeaterInitialReq({
            url: req.url,
            method: req.method,
            headers: req.headers,
          });
          setIsTrafficSnifferOpen(false);
          setIsRepeaterOpen(true);
        }}
      />

      {/* Proxy & Anonymity Switcher Modal */}
      <ProxySwitcherModal
        isOpen={isProxyModalOpen}
        onClose={() => setIsProxyModalOpen(false)}
        onProxyChanged={(cfg) => setActiveProxyConfig(cfg)}
      />

      {/* Cookie & Session Inspector Modal */}
      <CookieEditorModal
        isOpen={isCookieModalOpen}
        onClose={() => setIsCookieModalOpen(false)}
        activeTab={activeTab || undefined}
      />

      {/* User-Agent & Anti-Fingerprint Cloak Modal */}
      <UserAgentModal
        isOpen={isUserAgentModalOpen}
        onClose={() => setIsUserAgentModalOpen(false)}
      />

      {/* Attack Surface Graph Modal */}
      <AttackSurfaceGraphModal
        isOpen={isAttackSurfaceModalOpen}
        onClose={() => setIsAttackSurfaceModalOpen(false)}
        metadata={pageMetadata}
        activeTab={activeTab || undefined}
        onOpenUrl={handleNavigate}
        onRunAudit={(target) => {
          setIsAttackSurfaceModalOpen(false);
          setTerminalCommand(`auto-audit ${target}`);
          handleModeChange('terminal');
        }}
      />

      {/* Cyber Swiss Army Knife Modal */}
      <CyberToolsModal
        isOpen={isCyberToolsModalOpen}
        onClose={() => setIsCyberToolsModalOpen(false)}
      />

      {/* Burp-style HTTP Request Repeater Modal */}
      <HttpRepeaterModal
        isOpen={isRepeaterOpen}
        onClose={() => setIsRepeaterOpen(false)}
        initialRequest={repeaterInitialReq}
      />

      {/* Privacy Health & Leak Diagnostic Suite Modal */}
      <PrivacyAuditModal
        isOpen={isPrivacyAuditOpen}
        onClose={() => setIsPrivacyAuditOpen(false)}
        onOpenProxyModal={() => {
          setIsPrivacyAuditOpen(false);
          setIsProxyModalOpen(true);
        }}
        onOpenUserAgentModal={() => {
          setIsPrivacyAuditOpen(false);
          setIsUserAgentModalOpen(true);
        }}
      />

      {/* Kali Workspace Sandbox Permission Modal */}
      <WorkspaceAccessModal
        isOpen={isWorkspaceAccessOpen}
        onClose={() => setIsWorkspaceAccessOpen(false)}
        currentSandboxDir={workspaceDir || settings?.workspaceSandboxDir}
        onGrantAccess={handleGrantWorkspaceAccess}
        forcePrompt={false}
      />
    </div>
  );
};
