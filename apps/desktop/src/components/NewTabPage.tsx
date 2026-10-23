import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ArrowRight,
  Plus,
  X,
  Globe,
  Wifi,
  RefreshCw,
  Wrench,
  Database,
  Sun,
  Moon,
  Laptop,
  Monitor,
  Terminal as TermIcon,
  Layers,
  Edit3,
} from 'lucide-react';
import dualsurfLogo from '../assets/dualsurf-logo.png';
import type { SearchEngine, TabState, ActiveSessionState } from '@dualsurf/shared-types';

interface NewTabPageProps {
  onNavigate: (url: string) => void;
  onSwitchToTerminal: () => void;
  onNewTab?: () => void;
  onOpenAbout?: () => void;
  onOpenSettings?: () => void;
  onOpenTrafficSniffer?: () => void;
  onOpenCyberTools?: () => void;
  onOpenProxyModal?: () => void;
  activeTab?: TabState | null;
  activeSession?: ActiveSessionState;
  activeProxyMode?: string;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  searchEngine?: SearchEngine;
  onUpdateSearchEngine?: (engine: SearchEngine) => void;
}

interface CustomShortcut {
  id: string;
  name: string;
  url: string;
}

export const NewTabPage: React.FC<NewTabPageProps> = ({
  onNavigate,
  onSwitchToTerminal,
  onNewTab,
  onOpenAbout,
  onOpenSettings,
  onOpenTrafficSniffer,
  onOpenCyberTools,
  onOpenProxyModal,
  activeTab,
  activeSession,
  activeProxyMode = 'direct',
  theme = 'dark',
  onToggleTheme,
  searchEngine = 'google',
  onUpdateSearchEngine,
}) => {
  const [query, setQuery] = useState('');
  const [customShortcuts, setCustomShortcuts] = useState<CustomShortcut[]>([]);
  const [isAddShortcutOpen, setIsAddShortcutOpen] = useState(false);
  const [newShortcutName, setNewShortcutName] = useState('');
  const [newShortcutUrl, setNewShortcutUrl] = useState('');

  // Real Clock & Date
  const [currentTime, setCurrentTime] = useState({
    timeStr: '10:24',
    dateStr: 'Tue, 26 Aug 2025',
  });

  // Real System Status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [storageFormatted, setStorageFormatted] = useState('2.4 GB Free');
  const [selectedThemeMode, setSelectedThemeMode] = useState<'light' | 'dark' | 'auto'>('dark');

  // Load clock & date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayName = days[now.getDay()];
      const dayNum = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();

      setCurrentTime({
        timeStr: `${hours}:${minutes}`,
        dateStr: `${dayName}, ${dayNum} ${monthName} ${year}`,
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch real storage status
  useEffect(() => {
    if (window.dualsurf?.getStorageInfo) {
      window.dualsurf.getStorageInfo().then((res) => {
        if (res?.success && res.freeFormatted) {
          setStorageFormatted(res.freeFormatted);
        }
      }).catch(() => {});
    }
  }, []);

  // Load saved user shortcuts
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dualsurf_user_shortcuts');
      if (stored) {
        setCustomShortcuts(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Initialize theme mode
  useEffect(() => {
    const savedTheme = localStorage.getItem('dualsurf:theme_mode') as 'light' | 'dark' | 'auto';
    if (savedTheme) {
      setSelectedThemeMode(savedTheme);
    } else {
      setSelectedThemeMode(theme === 'light' ? 'light' : 'dark');
    }
  }, [theme]);

  const handleSetTheme = (mode: 'light' | 'dark' | 'auto') => {
    setSelectedThemeMode(mode);
    localStorage.setItem('dualsurf:theme_mode', mode);

    let effectiveTheme: 'light' | 'dark' = 'dark';
    if (mode === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
    } else {
      effectiveTheme = mode;
    }

    if (effectiveTheme === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.remove('light-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    localStorage.setItem('dualsurf:theme', effectiveTheme);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('dualsurf://') ||
      trimmed.startsWith('file://') ||
      (trimmed.includes('.') && !trimmed.includes(' '))
    ) {
      onNavigate(trimmed.startsWith('http') || trimmed.startsWith('dualsurf') || trimmed.startsWith('file') ? trimmed : `https://${trimmed}`);
      return;
    }

    const encoded = encodeURIComponent(trimmed);
    let target = `https://www.google.com/search?q=${encoded}`;
    if (searchEngine === 'duckduckgo') target = `https://duckduckgo.com/?q=${encoded}`;
    else if (searchEngine === 'brave') target = `https://search.brave.com/search?q=${encoded}`;
    else if (searchEngine === 'bing') target = `https://www.bing.com/search?q=${encoded}`;

    onNavigate(target);
  };

  const handleSaveShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcutName.trim() || !newShortcutUrl.trim()) return;

    let formattedUrl = newShortcutUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const newSc: CustomShortcut = {
      id: `sc-${Date.now()}`,
      name: newShortcutName.trim(),
      url: formattedUrl,
    };

    const updated = [...customShortcuts, newSc];
    setCustomShortcuts(updated);
    try {
      localStorage.setItem('dualsurf_user_shortcuts', JSON.stringify(updated));
    } catch {}

    setNewShortcutName('');
    setNewShortcutUrl('');
    setIsAddShortcutOpen(false);
  };

  const handleDeleteShortcut = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customShortcuts.filter((s) => s.id !== id);
    setCustomShortcuts(updated);
    try {
      localStorage.setItem('dualsurf_user_shortcuts', JSON.stringify(updated));
    } catch {}
  };

  // Target Screenshot 1 shortcut tiles
  const defaultShortcuts = [
    {
      name: 'Google',
      url: 'https://google.com',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
      ),
    },
    {
      name: 'YouTube',
      url: 'https://youtube.com',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF0000">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
    },
    {
      name: 'GitHub',
      url: 'https://github.com',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      ),
    },
    {
      name: 'ChatGPT',
      url: 'https://chatgpt.com',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 7.79 4.5M12 3a9 9 0 0 0-7.79 4.5M21 12a9 9 0 0 1-4.5 7.79M3 12a9 9 0 0 0 4.5 7.79M16.5 19.79A9 9 0 0 1 12 21M7.5 19.79A9 9 0 0 0 12 21" />
        </svg>
      ),
    },
    {
      name: 'Stack Overflow',
      url: 'https://stackoverflow.com',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#F48024">
          <path d="M18.986 21.865v-6.408h2.134V24H1.84v-8.543h2.133v6.408h15.013zM6.111 19.731h10.68v-2.134H6.11v2.134zm.447-4.492l10.37 2.617.51-2.072-10.37-2.617-.51 2.072zm1.61-4.838l9.44 5.163.99-1.89-9.44-5.163-.99 1.89zm3.327-4.786l7.73 7.37 1.45-1.57-7.73-7.37-1.45 1.57zm5.55-5.615l-1.8 1.15 5.8 8.97 1.8-1.15-5.8-8.97z" />
        </svg>
      ),
    },
  ];

  const browserDisplayUrl =
    activeTab?.url && activeTab.url !== 'about:blank' && !activeTab.url.startsWith('dualsurf:')
      ? activeTab.url
      : 'https://www.google.com';

  return (
    <div className="dualsurf-home-page-container">
      {/* 1. Main Center Canvas */}
      <div className="home-center-canvas">
        {/* Subtle dark landscape background image */}
        <div className="home-canvas-backdrop" />

        {/* Central Brand, Search & Shortcuts Stack */}
        <div className="home-center-stack">
          {/* Brand Lockup */}
          <div className="home-brand-row">
            <div className="home-brand-lockup">
              <img
                src={dualsurfLogo}
                alt="DualSurf Logo"
                className="home-brand-shield"
              />
              <div className="home-brand-text-block">
                <h1 className="home-brand-title">DualSurf</h1>
                <div className="home-brand-subtags">
                  <span>Browse</span>
                  <span className="dot">|</span>
                  <span>Inspect</span>
                  <span className="dot">|</span>
                  <span>Analyze</span>
                  <span className="dot">|</span>
                  <span>Secure</span>
                </div>
              </div>
            </div>

            <div className="home-brand-side-tagline">
              <div className="home-tagline-rule" />
              <div className="home-tagline-text">
                <span>A Browser</span>
                <span>Built for Exploration</span>
              </div>
            </div>
          </div>

          {/* Search Input Bar */}
          <form className="home-search-pill-form" onSubmit={handleSearch}>
            <Search size={16} className="search-pill-icon" />
            <input
              type="text"
              className="search-pill-input"
              placeholder="Search the web or enter a URL..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button type="submit" className="search-pill-submit-btn" title="Navigate">
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Shortcut Tiles Row */}
          <div className="home-shortcuts-row">
            {defaultShortcuts.map((sc) => (
              <div
                key={sc.name}
                className="home-shortcut-card"
                onClick={() => onNavigate(sc.url)}
                title={sc.name}
              >
                <div className="shortcut-tile-box">{sc.icon}</div>
                <span className="shortcut-tile-label">{sc.name}</span>
              </div>
            ))}

            {/* User Custom Shortcuts */}
            {customShortcuts.map((sc) => (
              <div
                key={sc.id}
                className="home-shortcut-card custom"
                onClick={() => onNavigate(sc.url)}
                title={sc.name}
              >
                <button
                  className="shortcut-delete-badge"
                  onClick={(e) => handleDeleteShortcut(sc.id, e)}
                  title="Remove shortcut"
                >
                  <X size={10} />
                </button>
                <div className="shortcut-tile-box">
                  <Globe size={20} color="#e8eaed" />
                </div>
                <span className="shortcut-tile-label">{sc.name}</span>
              </div>
            ))}

            {/* Add Shortcut Tile */}
            <div
              className="home-shortcut-card add-btn"
              onClick={() => setIsAddShortcutOpen(true)}
              title="Add Shortcut"
            >
              <div className="shortcut-tile-box add-box">
                <Plus size={20} color="#9299a5" />
              </div>
              <span className="shortcut-tile-label">Add</span>
            </div>
          </div>
        </div>

        {/* Lower Left Time & Date */}
        <div className="home-lower-left-clock">
          <div className="clock-time">{currentTime.timeStr}</div>
          <div className="clock-date">{currentTime.dateStr}</div>
        </div>

        {/* Lower Right Secondary Quote */}
        <div className="home-lower-right-motto">
          <div className="motto-cyan-accent" />
          <div className="motto-text-block">
            <span>&ldquo;Explore deeper.</span>
            <span>Control more.&rdquo;</span>
          </div>
        </div>
      </div>

      {/* 2. Right-Side Utility Panel matching Screenshot 1 */}
      <aside className="home-right-utility-panel">
        {/* Panel Section 1: Quick Actions */}
        <div className="utility-section">
          <div className="utility-section-header">
            <div className="section-title-wrap">
              <Edit3 size={14} className="section-header-icon" />
              <span className="section-title">Quick Actions</span>
            </div>
            <button
              className="section-add-btn"
              onClick={() => onNewTab?.()}
              title="New Tab"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="quick-actions-grid">
            <button
              className="quick-action-tile"
              onClick={() => onNewTab?.()}
              title="Open a new browser tab"
            >
              <div className="action-tile-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </div>
              <span className="action-tile-label">New Tab</span>
            </button>

            <button
              className="quick-action-tile"
              onClick={onSwitchToTerminal}
              title="Open integrated terminal"
            >
              <div className="action-tile-icon">
                <TermIcon size={14} />
              </div>
              <span className="action-tile-label">New Terminal</span>
            </button>

            <button
              className="quick-action-tile"
              onClick={onOpenTrafficSniffer}
              title="Capture HTTP network traffic"
            >
              <div className="action-tile-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5" r="3" />
                  <line x1="12" y1="8" x2="12" y2="14" />
                  <circle cx="6" cy="19" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="6" y1="16" x2="10" y2="14" />
                  <line x1="18" y1="16" x2="14" y2="14" />
                </svg>
              </div>
              <span className="action-tile-label">Capture Traffic</span>
            </button>

            <button
              className="quick-action-tile"
              onClick={onOpenCyberTools}
              title="Open security tools library"
            >
              <div className="action-tile-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <span className="action-tile-label">Open Tools</span>
            </button>
          </div>
        </div>

        {/* Panel Section 2: Active Session */}
        <div className="utility-section">
          <div className="utility-section-header">
            <div className="section-title-wrap">
              <Monitor size={14} className="section-header-icon" />
              <span className="section-title">Active Session</span>
            </div>
          </div>

          <div className="active-session-cards-stack">
            {/* Browser Active Session Card */}
            <div
              className="session-status-card"
              onClick={() => {
                if (activeTab?.url && activeTab.url !== 'about:blank') {
                  onNavigate(activeTab.url);
                }
              }}
              title="Active GUI Browser Session"
            >
              <div className="session-icon-box">
                <Globe size={15} />
              </div>
              <div className="session-info-meta">
                <div className="session-name">Browser</div>
                <div className="session-target">{browserDisplayUrl}</div>
              </div>
              <span className="session-badge active">Active</span>
            </div>

            {/* Terminal Active Session Card */}
            <div
              className="session-status-card"
              onClick={onSwitchToTerminal}
              title="Switch to Terminal Workspace"
            >
              <div className="session-icon-box">
                <TermIcon size={15} />
              </div>
              <div className="session-info-meta">
                <div className="session-name">Terminal</div>
                <div className="session-target">bash ~</div>
              </div>
              <span className="session-badge idle">Idle</span>
            </div>
          </div>
        </div>

        {/* Panel Section 3: System Status */}
        <div className="utility-section">
          <div className="utility-section-header">
            <div className="section-title-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="section-header-icon">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span className="section-title">System Status</span>
            </div>
          </div>

          <div className="system-status-list">
            <div className="status-row-item">
              <div className="status-item-left">
                <Wifi size={14} className="status-item-icon" />
                <span className="status-item-name">Network</span>
              </div>
              <span className="status-item-value text-connected">
                <span className="live-dot" />
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>

            <div
              className="status-row-item clickable"
              onClick={onOpenProxyModal}
              title="Configure Network Proxy"
            >
              <div className="status-item-left">
                <RefreshCw size={14} className="status-item-icon" />
                <span className="status-item-name">Proxy</span>
              </div>
              <span className="status-item-value text-muted">
                {activeProxyMode && activeProxyMode !== 'direct' ? activeProxyMode.toUpperCase() : 'Not Configured'}
              </span>
            </div>

            <div
              className="status-row-item clickable"
              onClick={onOpenCyberTools}
              title="Open Security Tools Library"
            >
              <div className="status-item-left">
                <Wrench size={14} className="status-item-icon" />
                <span className="status-item-name">Tools</span>
              </div>
              <span className="status-item-value text-ready">
                <span className="live-dot green" />
                Ready
              </span>
            </div>

            <div className="status-row-item">
              <div className="status-item-left">
                <Database size={14} className="status-item-icon" />
                <span className="status-item-name">Storage</span>
              </div>
              <span className="status-item-value text-muted">{storageFormatted}</span>
            </div>
          </div>
        </div>

        {/* Panel Section 4: Theme */}
        <div className="utility-section theme-section">
          <div className="utility-section-header">
            <div className="section-title-wrap">
              <Sun size={14} className="section-header-icon" />
              <span className="section-title">Theme</span>
            </div>
          </div>

          <div className="theme-toggle-row">
            <button
              className={`theme-button-pill ${selectedThemeMode === 'light' ? 'selected' : ''}`}
              onClick={() => handleSetTheme('light')}
              title="Light Theme"
            >
              <Sun size={16} />
              <span>Light</span>
            </button>

            <button
              className={`theme-button-pill ${selectedThemeMode === 'dark' ? 'selected' : ''}`}
              onClick={() => handleSetTheme('dark')}
              title="Dark Theme"
            >
              <Moon size={16} />
              <span>Dark</span>
            </button>

            <button
              className={`theme-button-pill ${selectedThemeMode === 'auto' ? 'selected' : ''}`}
              onClick={() => handleSetTheme('auto')}
              title="Follow System Theme"
            >
              <Laptop size={16} />
              <span>Auto</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Add Shortcut Modal */}
      {isAddShortcutOpen && (
        <div className="modal-overlay" onClick={() => setIsAddShortcutOpen(false)}>
          <div className="modal-dialog-box" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-strip">
              <div className="modal-title-group">
                <Plus size={15} color="#29b6f6" />
                <span>Add Shortcut</span>
              </div>
              <button className="modal-close-btn" onClick={() => setIsAddShortcutOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveShortcut}>
              <div className="modal-body-scroll" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9299a5' }}>Shortcut Name</label>
                  <input
                    type="text"
                    className="modal-search-input"
                    placeholder="e.g. Hacker News"
                    value={newShortcutName}
                    onChange={(e) => setNewShortcutName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9299a5' }}>URL</label>
                  <input
                    type="text"
                    className="modal-search-input"
                    placeholder="e.g. news.ycombinator.com"
                    value={newShortcutUrl}
                    onChange={(e) => setNewShortcutUrl(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 20px', borderTop: '1px solid var(--ds-border, #21262d)' }}>
                <button
                  type="button"
                  className="profile-action-btn"
                  onClick={() => setIsAddShortcutOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="profile-action-btn primary-save-btn"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

