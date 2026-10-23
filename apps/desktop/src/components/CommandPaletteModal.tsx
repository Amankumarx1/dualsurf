import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Columns2,
  BookOpen,
  Volume2,
  VolumeX,
  Terminal,
  Shield,
  Lock,
  Code2,
  History,
  Bookmark,
  Download,
  Settings,
  Copy,
  Trash2,
  Maximize2,
  RotateCw,
  Globe,
  Zap,
  ArrowRight,
  Layers,
  Bot,
  Activity,
  Send,
} from 'lucide-react';
import type { TabState } from '@dualsurf/shared-types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: TabState[];
  activeTabId: string | null;
  splitTabId?: string | null;
  onActivateTab: (tabId: string) => void;
  onNewTab: (url?: string) => void;
  onCloseTab: (tabId: string) => void;
  onToggleSplitTab: (tabId: string) => void;
  onToggleMuteTab: (tabId: string) => void;
  onOpenReaderMode: () => void;
  onSwitchMode: (mode: 'gui' | 'terminal') => void;
  onRunTool: (tool: string) => void;
  onOpenHistory: () => void;
  onOpenBookmarks: () => void;
  onOpenDownloads: () => void;
  onOpenSettings: () => void;
  onOpenClearData: () => void;
  onOpenShortcuts: () => void;
  onOpenMetadataDrawer: () => void;
  onOpenOllamaSetup?: () => void;
  onToggleCopilot?: () => void;
  onOpenTrafficSniffer?: () => void;
  onOpenHttpRepeater?: () => void;
  onOpenPrivacyAudit?: () => void;
}

interface CommandItem {
  id: string;
  category: 'Tabs' | 'Navigation' | 'Security & Tools' | 'System';
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  tabs,
  activeTabId,
  splitTabId,
  onActivateTab,
  onNewTab,
  onCloseTab,
  onToggleSplitTab,
  onToggleMuteTab,
  onOpenReaderMode,
  onSwitchMode,
  onRunTool,
  onOpenHistory,
  onOpenBookmarks,
  onOpenDownloads,
  onOpenSettings,
  onOpenClearData,
  onOpenShortcuts,
  onOpenMetadataDrawer,
  onOpenOllamaSetup,
  onToggleCopilot,
  onOpenTrafficSniffer,
  onOpenHttpRepeater,
  onOpenPrivacyAudit,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Build command catalogue
  const getCommands = (): CommandItem[] => {
    const list: CommandItem[] = [
      // Navigation & Tabs
      {
        id: 'cmd-new-tab',
        category: 'Navigation',
        title: 'New Tab',
        subtitle: 'Open a blank browser tab',
        shortcut: 'Ctrl+T',
        icon: <Plus size={15} />,
        action: () => onNewTab(),
      },
      {
        id: 'cmd-close-tab',
        category: 'Navigation',
        title: 'Close Active Tab',
        subtitle: 'Dismiss current tab',
        shortcut: 'Ctrl+W',
        icon: <Trash2 size={15} />,
        action: () => {
          if (activeTabId) onCloseTab(activeTabId);
        },
      },
      {
        id: 'cmd-split-view',
        category: 'Navigation',
        title: splitTabId ? 'Close Split Screen View' : 'Split Screen View (Dual-Surf)',
        subtitle: splitTabId
          ? 'Revert to single tab layout'
          : 'Display secondary tab side-by-side with 50/50 bounds',
        shortcut: 'Ctrl+\\',
        icon: <Columns2 size={15} />,
        action: () => {
          if (splitTabId) {
            onToggleSplitTab(splitTabId);
          } else if (tabs.length > 1) {
            const secondary = tabs.find((t) => t.id !== activeTabId);
            if (secondary) onToggleSplitTab(secondary.id);
          }
        },
      },
      {
        id: 'cmd-reader-mode',
        category: 'Navigation',
        title: 'Toggle Reader Mode',
        subtitle: 'Distraction-free article reading with clean markdown & typography',
        shortcut: 'Ctrl+Shift+R',
        icon: <BookOpen size={15} />,
        action: () => onOpenReaderMode(),
      },
      {
        id: 'cmd-mute-tab',
        category: 'Navigation',
        title: activeTab?.muted ? 'Unmute Active Tab' : 'Mute Active Tab',
        subtitle: activeTab?.muted ? 'Restore audio output' : 'Mute tab audio stream',
        shortcut: 'Ctrl+M',
        icon: activeTab?.muted ? <Volume2 size={15} /> : <VolumeX size={15} />,
        action: () => {
          if (activeTabId) onToggleMuteTab(activeTabId);
        },
      },
      {
        id: 'cmd-duplicate-tab',
        category: 'Navigation',
        title: 'Duplicate Current Tab',
        subtitle: 'Clone active URL into a fresh isolated tab',
        icon: <Copy size={15} />,
        action: () => {
          if (activeTab && window.dualsurf) window.dualsurf.duplicateTab(activeTab.id);
        },
      },
      {
        id: 'cmd-reload-tab',
        category: 'Navigation',
        title: 'Reload Active Page',
        subtitle: 'Refresh current URL',
        shortcut: 'Ctrl+R',
        icon: <RotateCw size={15} />,
        action: () => {
          if (activeTab && window.dualsurf) window.dualsurf.reload(activeTab.id);
        },
      },

      // Security & Tools
      {
        id: 'cmd-page-inspector',
        category: 'Security & Tools',
        title: 'Page Inspector & DOM Drawer',
        subtitle: 'View headings, numbered links, forms, cookies, and live metadata',
        shortcut: 'Ctrl+I',
        icon: <Layers size={15} />,
        action: () => onOpenMetadataDrawer(),
      },
      {
        id: 'cmd-sec-audit',
        category: 'Security & Tools',
        title: 'Run Passive Security Audit (sec-audit)',
        subtitle: 'Audit CSP, CSRF tokens, secret leaks & tabnabbing',
        icon: <Shield size={15} />,
        action: () => onRunTool('sec-audit'),
      },
      {
        id: 'cmd-recon',
        category: 'Security & Tools',
        title: 'Run Target Reconnaissance (recon)',
        subtitle: 'Correlate response headers, endpoints & TLS ciphers',
        icon: <Search size={15} />,
        action: () => onRunTool('recon'),
      },
      {
        id: 'cmd-cert',
        category: 'Security & Tools',
        title: 'Inspect TLS Certificate (cert)',
        subtitle: 'Verify certificate chain, SAN entries, and expiration',
        icon: <Lock size={15} />,
        action: () => onRunTool('cert'),
      },
      {
        id: 'cmd-clear-data',
        category: 'Security & Tools',
        title: 'Clear Browsing Data',
        subtitle: 'Wipe cache, cookies, browsing history & download logs',
        shortcut: 'Ctrl+Shift+Del',
        icon: <Trash2 size={15} />,
        action: () => onOpenClearData(),
      },

      // System & Views
      {
        id: 'cmd-switch-terminal',
        category: 'System',
        title: 'Toggle Terminal CLI Mode',
        subtitle: 'Switch between graphical WebContents and hacker terminal console',
        shortcut: 'Ctrl+`',
        icon: <Terminal size={15} />,
        action: () => onSwitchMode('terminal'),
      },
      {
        id: 'cmd-devtools',
        category: 'System',
        title: 'Toggle Developer Tools',
        subtitle: 'Open Chromium DevTools for the active tab',
        shortcut: 'F12',
        icon: <Code2 size={15} />,
        action: () => {
          if (activeTabId && window.dualsurf) window.dualsurf.toggleDevTools(activeTabId);
        },
      },
      {
        id: 'cmd-fullscreen',
        category: 'System',
        title: 'Toggle Fullscreen',
        subtitle: 'Maximize workspace into borderless display',
        shortcut: 'F11',
        icon: <Maximize2 size={15} />,
        action: () => {
          if (window.dualsurf) window.dualsurf.toggleFullScreen();
        },
      },
      {
        id: 'cmd-history',
        category: 'System',
        title: 'Open History',
        subtitle: 'Browse chronological visit log',
        shortcut: 'Ctrl+H',
        icon: <History size={15} />,
        action: () => onOpenHistory(),
      },
      {
        id: 'cmd-bookmarks',
        category: 'System',
        title: 'Open Bookmarks',
        subtitle: 'Manage pinned bookmarks and tags',
        shortcut: 'Ctrl+B',
        icon: <Bookmark size={15} />,
        action: () => onOpenBookmarks(),
      },
      {
        id: 'cmd-copilot',
        category: 'System',
        title: 'Toggle AI Copilot Sidebar',
        subtitle: 'Chat with local Ollama LLM, summarize page, or audit code',
        shortcut: 'Ctrl+J',
        icon: <Bot size={15} />,
        action: () => {
          if (onToggleCopilot) onToggleCopilot();
        },
      },
      {
        id: 'cmd-traffic-sniffer',
        category: 'Security & Tools',
        title: 'Open Live Traffic Sniffer',
        subtitle: 'Inspect HTTP requests, headers, latency, and vulnerabilities',
        shortcut: 'Ctrl+Shift+T',
        icon: <Activity size={15} />,
        action: () => {
          if (onOpenTrafficSniffer) onOpenTrafficSniffer();
        },
      },
      {
        id: 'cmd-repeater',
        category: 'Security & Tools',
        title: 'HTTP Request Repeater & Header Tamperer',
        subtitle: 'Craft, replay, and tamper with raw HTTP requests bypassing browser CORS',
        shortcut: 'Ctrl+Shift+E',
        icon: <Send size={15} />,
        action: () => {
          if (onOpenHttpRepeater) onOpenHttpRepeater();
        },
      },
      {
        id: 'cmd-privacy-audit',
        category: 'Security & Tools',
        title: 'Privacy Health & Leak Diagnostics Suite',
        subtitle: 'Audit WebRTC IP leaks, DNS privacy, canvas entropy, and tracking barriers',
        shortcut: 'Ctrl+Shift+L',
        icon: <Shield size={15} />,
        action: () => {
          if (onOpenPrivacyAudit) onOpenPrivacyAudit();
        },
      },
      {
        id: 'cmd-downloads',
        category: 'System',
        title: 'Open Downloads',
        subtitle: 'View active and completed file downloads',
        shortcut: 'Ctrl+J',
        icon: <Download size={15} />,
        action: () => onOpenDownloads(),
      },
      {
        id: 'cmd-shortcuts',
        category: 'System',
        title: 'Keyboard Shortcuts Cheat Sheet',
        subtitle: 'Reference list of hotkeys and power operations',
        shortcut: 'Ctrl+/',
        icon: <Zap size={15} />,
        action: () => onOpenShortcuts(),
      },
      {
        id: 'cmd-ollama-setup',
        category: 'System',
        title: 'Ollama AI Setup & Model Config',
        subtitle: 'Configure local AI assistant, autonomous agents & on-device models',
        icon: <Bot size={15} />,
        action: () => {
          if (onOpenOllamaSetup) onOpenOllamaSetup();
        },
      },
      {
        id: 'cmd-settings',
        category: 'System',
        title: 'Browser Settings',
        subtitle: 'Configure search engine, sandbox policies, theme & telemetry',
        icon: <Settings size={15} />,
        action: () => onOpenSettings(),
      },
    ];

    // Append all open tabs so users can quickly switch to any tab
    tabs.forEach((tab) => {
      list.push({
        id: `tab-jump-${tab.id}`,
        category: 'Tabs',
        title: tab.title || 'Untitled Tab',
        subtitle: tab.url,
        icon: <Globe size={15} />,
        action: () => onActivateTab(tab.id),
      });
    });

    return list;
  };

  const allCommands = getCommands();

  const filteredCommands = allCommands.filter((cmd) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
      cmd.category.toLowerCase().includes(q) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands.length > 0 && selectedIndex >= 0 && selectedIndex < filteredCommands.length) {
        const item = filteredCommands[selectedIndex];
        onClose();
        item.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Auto-scroll into view when selectedIndex changes
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector('.cmd-item.selected');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="cmd-modal-overlay" onClick={onClose}>
      <div
        className="cmd-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Search Input Bar */}
        <div className="cmd-input-wrapper">
          <Search size={18} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input-field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search tabs (e.g. split, reader, mute, cert, recon)..."
            spellCheck={false}
          />
          <span className="cmd-esc-hint">Esc</span>
        </div>

        {/* Results List */}
        <div className="cmd-results-list" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="cmd-empty-state">
              <span>No commands found matching "{query}"</span>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  className={`cmd-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onClose();
                    cmd.action();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="cmd-item-icon">{cmd.icon}</div>
                  <div className="cmd-item-details">
                    <div className="cmd-item-top">
                      <span className="cmd-item-title">{cmd.title}</span>
                      <span className="cmd-item-cat">{cmd.category}</span>
                    </div>
                    {cmd.subtitle && <span className="cmd-item-sub">{cmd.subtitle}</span>}
                  </div>
                  {cmd.shortcut && (
                    <div className="cmd-item-shortcut">
                      <kbd>{cmd.shortcut}</kbd>
                    </div>
                  )}
                  <ArrowRight size={13} className="cmd-item-arrow" />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info strip */}
        <footer className="cmd-footer-strip">
          <div className="cmd-footer-keys">
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Execute</span>
            <span><kbd>Esc</kbd> Dismiss</span>
          </div>
          <span className="cmd-footer-brand">DualSurf Command Engine</span>
        </footer>
      </div>
    </div>
  );
};
