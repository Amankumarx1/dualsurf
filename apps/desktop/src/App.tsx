import React, { useEffect, useState, useRef } from 'react';
import { TabBar } from './components/TabBar';
import { NavigationBar } from './components/NavigationBar';
import { BookmarksBar } from './components/BookmarksBar';
import { PageMetadataDrawer } from './components/PageMetadataDrawer';
import { SettingsModal } from './components/SettingsModal';
import type { TabState, BrowserControllerState } from '@dualsurf/shared-types';

export const App: React.FC = () => {
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    });

    // Subscribe to state changes from controller
    const unsubscribeState = window.dualsurf.onStateChanged((state: BrowserControllerState) => {
      setTabs(state.tabs);
      setActiveTabId(state.activeTabId);
    });

    // Subscribe to tab updates
    const unsubscribeTab = window.dualsurf.onTabUpdated((updatedTab: TabState) => {
      setTabs((prev) => prev.map((t) => (t.id === updatedTab.id ? updatedTab : t)));
    });

    return () => {
      unsubscribeState();
      unsubscribeTab();
    };
  }, []);

  // Update top bar layout height for WebContentsView positioning
  useEffect(() => {
    if (headerRef.current && window.dualsurf) {
      const height = headerRef.current.offsetHeight;
      window.dualsurf.setTopBarHeight(height);
    }
  }, [tabs.length]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!window.dualsurf) return;

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta && e.key.toLowerCase() === 't') {
        e.preventDefault();
        window.dualsurf.createTab();
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) window.dualsurf.closeTab(activeTabId);
      } else if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        window.dualsurf.reopenClosedTab();
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (activeTabId) window.dualsurf.reload(activeTabId);
      } else if (isCtrlOrMeta && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Actions
  const handleActivateTab = (tabId: string) => {
    if (window.dualsurf) window.dualsurf.activateTab(tabId);
  };

  const handleCloseTab = (tabId: string) => {
    if (window.dualsurf) window.dualsurf.closeTab(tabId);
  };

  const handleNewTab = () => {
    if (window.dualsurf) window.dualsurf.createTab();
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

  return (
    <div className="browser-chrome">
      {/* Top Header Chrome */}
      <div className="chrome-header" ref={headerRef}>
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onActivateTab={handleActivateTab}
          onCloseTab={handleCloseTab}
          onNewTab={handleNewTab}
        />

        <NavigationBar
          activeTab={activeTab}
          onNavigate={handleNavigate}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onReload={handleReload}
          onStop={handleStop}
          onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
          isInspectorOpen={isInspectorOpen}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <BookmarksBar onNavigate={handleNavigate} />
      </div>

      {/* Mode B Live Page Inspector Drawer */}
      <PageMetadataDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        activeTabId={activeTabId}
        onFollowLink={handleFollowNumberedLink}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
