import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  X,
  Lock,
  Unlock,
  Star,
  Terminal,
  Globe,
  MoreVertical,
  User,
  Plus,
  Copy,
  History,
  Bookmark,
  Download,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code2,
  Settings,
  Check,
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileText,
  ChevronRight,
  Send,
  Clock,
  Zap,
  Trash2,
  Keyboard,
  BookOpen,
  Columns2,
  Command,
  Bot,
  Activity,
  Layers,
  Cookie,
  Fingerprint,
  Network,
  Wrench,
  Database,
} from 'lucide-react';
import type { TabState, SystemInfo, HistoryEntry, BookmarkEntry, PageSecurityInfo, SearchEngine } from '@dualsurf/shared-types';

interface NavigationBarProps {
  searchEngine?: SearchEngine;
  activeTab: TabState | null;
  tabs?: TabState[];
  splitTabId?: string | null;
  mode: 'gui' | 'terminal' | 'dual';
  onModeChange: (newMode: 'gui' | 'terminal' | 'dual') => void;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onStop: () => void;
  onHome?: () => void;
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
  onOpenBookmarks?: () => void;
  onOpenDownloads?: () => void;
  onOpenFind?: () => void;
  onNewTab?: () => void;
  onDuplicateTab?: () => void;
  onOpenMetadataDrawer?: () => void;
  onRunTool?: (toolName: string) => void;
  onOpenTabSearch?: () => void;
  onOpenClearData?: () => void;
  onOpenShortcuts?: () => void;
  onOpenReaderMode?: () => void;
  onOpenCommandPalette?: () => void;
  onToggleSplitTab?: (tabId: string) => void;
  onOpenOllamaSetup?: () => void;
  onToggleCopilot?: () => void;
  isCopilotOpen?: boolean;
  onToggleShieldDropdown?: () => void;
  isShieldDropdownOpen?: boolean;
  onOpenTrafficSniffer?: () => void;
  onOpenProxyModal?: () => void;
  activeProxyMode?: string;
  onOpenCookieModal?: () => void;
  onOpenUserAgentModal?: () => void;
  onOpenAttackSurfaceModal?: () => void;
  onOpenCyberTools?: () => void;
  onOpenHttpRepeater?: () => void;
  onOpenPrivacyAudit?: () => void;
}

interface OmniboxItem {
  id: string;
  type: 'bang' | 'search' | 'bookmark' | 'history' | 'url';
  title: string;
  subtitle: string;
  targetUrl: string;
  badge?: string;
}

const BANG_CATALOG = [
  { prefix: '!gh', name: 'GitHub', template: (q: string) => `https://github.com/search?q=${encodeURIComponent(q)}` },
  { prefix: '!w', name: 'Wikipedia', template: (q: string) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}` },
  { prefix: '!yt', name: 'YouTube', template: (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  { prefix: '!g', name: 'Google', template: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { prefix: '!d', name: 'DuckDuckGo', template: (q: string) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { prefix: '!cve', name: 'CVE Mitre', template: (q: string) => `https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=${encodeURIComponent(q)}` },
  { prefix: '!shodan', name: 'Shodan', template: (q: string) => `https://www.shodan.io/search?query=${encodeURIComponent(q)}` },
  { prefix: '!exploit', name: 'Exploit-DB', template: (q: string) => `https://www.exploit-db.com/search?q=${encodeURIComponent(q)}` },
  { prefix: '!so', name: 'StackOverflow', template: (q: string) => `https://stackoverflow.com/search?q=${encodeURIComponent(q)}` },
  { prefix: '!r', name: 'Reddit', template: (q: string) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}` },
];

export const NavigationBar: React.FC<NavigationBarProps> = ({
  activeTab,
  tabs = [],
  splitTabId,
  mode,
  onModeChange,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onStop,
  onHome,
  onOpenSettings,
  onOpenHistory,
  onOpenBookmarks,
  onOpenDownloads,
  onOpenFind,
  onNewTab,
  onDuplicateTab,
  onOpenMetadataDrawer,
  onRunTool,
  onOpenTabSearch,
  onOpenClearData,
  onOpenShortcuts,
  onOpenReaderMode,
  onOpenCommandPalette,
  onToggleSplitTab,
  onOpenOllamaSetup,
  onToggleCopilot,
  isCopilotOpen = false,
  onToggleShieldDropdown,
  isShieldDropdownOpen = false,
  onOpenTrafficSniffer,
  onOpenProxyModal,
  activeProxyMode = 'direct',
  onOpenCookieModal,
  onOpenUserAgentModal,
  onOpenAttackSurfaceModal,
  onOpenCyberTools,
  onOpenHttpRepeater,
  onOpenPrivacyAudit,
  searchEngine = 'google',
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [securityInfo, setSecurityInfo] = useState<PageSecurityInfo | null>(null);
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [copiedDiag, setCopiedDiag] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Omnibox suggestions
  const [historyCache, setHistoryCache] = useState<HistoryEntry[]>([]);
  const [bookmarkCache, setBookmarkCache] = useState<BookmarkEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);
  const omniboxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused && activeTab) {
      const url = activeTab.url;
      if (
        !url ||
        url === 'about:blank' ||
        url === 'dualsurf:newtab' ||
        url === 'dualsurf://newtab' ||
        url.startsWith('dualsurf://newtab')
      ) {
        setUrlInput('');
      } else {
        setUrlInput(url);
      }
    }
  }, [activeTab?.url, isFocused]);

  // Load real-time security diagnostics when security popover opens
  useEffect(() => {
    if (isSecurityOpen && activeTab && window.dualsurf) {
      setIsLoadingSecurity(true);
      window.dualsurf
        .getPageSecurityInfo(activeTab.id)
        .then((info: PageSecurityInfo | null) => setSecurityInfo(info))
        .catch(() => setSecurityInfo(null))
        .finally(() => setIsLoadingSecurity(false));
    }
  }, [isSecurityOpen, activeTab?.id, activeTab?.url]);

  useEffect(() => {
    if (window.dualsurf) {
      window.dualsurf.getSystemInfo().then(setSystemInfo).catch(console.error);
    }
  }, []);

  // Fetch history & bookmarks on focus for omnibox suggestions
  useEffect(() => {
    if (isFocused && window.dualsurf) {
      window.dualsurf.getHistory(40).then(setHistoryCache).catch(() => { });
      window.dualsurf.getBookmarks().then(setBookmarkCache).catch(() => { });
    }
  }, [isFocused]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsAppMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (securityRef.current && !securityRef.current.contains(e.target as Node)) {
        setIsSecurityOpen(false);
      }
      if (omniboxRef.current && !omniboxRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for global shortcut to focus address bar (Ctrl+L)
  useEffect(() => {
    const handleFocusEvent = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('dualsurf:focus-address-bar', handleFocusEvent);
    return () => window.removeEventListener('dualsurf:focus-address-bar', handleFocusEvent);
  }, []);

  useEffect(() => {
    if (!activeTab?.url || activeTab.url === 'about:blank' || activeTab.url.startsWith('dualsurf:')) {
      setIsBookmarked(false);
      return;
    }
    if (window.dualsurf) {
      window.dualsurf.getBookmarks().then((bms: BookmarkEntry[]) => {
        const found = bms.some((b: BookmarkEntry) => b.url === activeTab.url);
        setIsBookmarked(found);
      }).catch(() => {});
    }
  }, [activeTab?.url]);

  const handleBookmarkToggle = async () => {
    if (!activeTab?.url || !window.dualsurf || activeTab.url === 'about:blank' || activeTab.url.startsWith('dualsurf:')) return;
    const bms: BookmarkEntry[] = await window.dualsurf.getBookmarks();
    const existing = bms.find((b: BookmarkEntry) => b.url === activeTab.url);
    if (existing) {
      await window.dualsurf.removeBookmark(existing.id);
      setIsBookmarked(false);
    } else {
      await window.dualsurf.addBookmark(activeTab.url, activeTab.title || activeTab.url);
      setIsBookmarked(true);
    }
  };

  const handleCopyUrl = () => {
    if (activeTab?.url) {
      navigator.clipboard.writeText(activeTab.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  // Build Omnibox Suggestions
  const getSuggestions = (): OmniboxItem[] => {
    const trimmed = urlInput.trim();
    if (!trimmed) return [];

    const items: OmniboxItem[] = [];
    const lower = trimmed.toLowerCase();

    // 1. Check Bang Shortcuts
    if (trimmed.startsWith('!')) {
      const parts = trimmed.split(/\s+/);
      const prefix = parts[0].toLowerCase();
      const query = parts.slice(1).join(' ').trim();

      const matchedBangs = BANG_CATALOG.filter((b) => b.prefix.startsWith(prefix));
      for (const bang of matchedBangs) {
        items.push({
          id: `bang-${bang.prefix}`,
          type: 'bang',
          title: query ? `Search ${bang.name} for "${query}"` : `Search ${bang.name} (${bang.prefix})`,
          subtitle: bang.template(query || 'query'),
          targetUrl: bang.template(query),
          badge: bang.prefix,
        });
      }
    }

    // 2. Direct Search suggestion
    if (!trimmed.startsWith('!') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const engine = searchEngine || 'google';
      const engineName = engine.charAt(0).toUpperCase() + engine.slice(1);
      const searchUrl =
        engine === 'google'
          ? `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
          : engine === 'brave'
            ? `https://search.brave.com/search?q=${encodeURIComponent(trimmed)}`
            : engine === 'bing'
              ? `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`
              : engine === 'ecosia'
                ? `https://www.ecosia.org/search?q=${encodeURIComponent(trimmed)}`
                : engine === 'yahoo'
                  ? `https://search.yahoo.com/search?p=${encodeURIComponent(trimmed)}`
                  : `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;

      items.push({
        id: 'search-default',
        type: 'search',
        title: `Search ${engineName} for "${trimmed}"`,
        subtitle: searchUrl,
        targetUrl: trimmed,
        badge: 'Search',
      });
    }

    // 3. Matched Bookmarks
    const matchedBookmarks = bookmarkCache.filter(
      (b) => b.title.toLowerCase().includes(lower) || b.url.toLowerCase().includes(lower)
    );
    for (const bm of matchedBookmarks.slice(0, 4)) {
      items.push({
        id: `bm-${bm.id}`,
        type: 'bookmark',
        title: bm.title || bm.url,
        subtitle: bm.url,
        targetUrl: bm.url,
        badge: 'Bookmark',
      });
    }

    // 4. Matched History
    const matchedHistory = historyCache.filter(
      (h) => h.title.toLowerCase().includes(lower) || h.url.toLowerCase().includes(lower)
    );
    for (const h of matchedHistory.slice(0, 5)) {
      if (!items.some((i) => i.targetUrl === h.url)) {
        items.push({
          id: `h-${h.id}`,
          type: 'history',
          title: h.title || h.url,
          subtitle: h.url,
          targetUrl: h.url,
          badge: 'History',
        });
      }
    }

    return items.slice(0, 8);
  };

  const suggestions = getSuggestions();

  useEffect(() => {
    setSelectedIndex(0);
  }, [urlInput]);

  const handleSelectSuggestion = (item: OmniboxItem) => {
    setUrlInput(item.targetUrl);
    setIsFocused(false);
    onNavigate(item.targetUrl);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setIsFocused(false);
      if (suggestions.length > 0 && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        onNavigate(urlInput);
      }
      e.currentTarget.blur();
    } else if (e.key === 'Tab') {
      if (suggestions.length > 0 && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        setUrlInput(suggestions[selectedIndex].targetUrl);
      }
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      if (activeTab) {
        const url = activeTab.url;
        setUrlInput(!url || url === 'about:blank' || url.startsWith('dualsurf:') ? '' : url);
      }
      e.currentTarget.blur();
    }
  };

  const handleZoom = async (delta: number) => {
    const nextZoom = Math.max(50, Math.min(300, zoomLevel + delta));
    setZoomLevel(nextZoom);
    if (window.dualsurf && activeTab) {
      await window.dualsurf.setZoom(activeTab.id, nextZoom / 100);
    }
  };

  const handleResetZoom = async () => {
    setZoomLevel(100);
    if (window.dualsurf && activeTab) {
      await window.dualsurf.setZoom(activeTab.id, 1.0);
    }
  };

  const handleToggleDevTools = async () => {
    if (window.dualsurf && activeTab) {
      await window.dualsurf.toggleDevTools(activeTab.id);
    }
    setIsAppMenuOpen(false);
  };

  const handleToggleFullScreen = async () => {
    if (window.dualsurf) {
      await window.dualsurf.toggleFullScreen();
    }
    setIsAppMenuOpen(false);
  };

  const handleCopyDiagnostics = () => {
    if (!systemInfo) return;
    const report = [
      `DualSurf Host System Report`,
      `User: ${systemInfo.username}@${systemInfo.hostname}`,
      `OS: ${systemInfo.osName}`,
      `Shell: ${systemInfo.shellName} (${systemInfo.shellPath})`,
      `Active Tab ID: ${activeTab?.id || 'none'}`,
      `Active URL: ${activeTab?.url || 'about:blank'}`,
      `Sandbox: Chromium WebContentsView Isolation Enabled`,
    ].join('\n');
    navigator.clipboard.writeText(report);
    setCopiedDiag(true);
    setTimeout(() => setCopiedDiag(false), 2000);
  };

  const isHttps = urlInput.startsWith('https://');
  const isHttp = urlInput.startsWith('http://');

  return (
    <div className="nav-toolbar-row">
      {/* Navigation history controls: Back, Forward, Reload, Home */}
      <div className="nav-history-controls">
        <button
          className="nav-action-btn"
          disabled={!activeTab?.canGoBack}
          onClick={onGoBack}
          title="Back (Alt+Left)"
        >
          <ArrowLeft size={16} />
        </button>

        <button
          className="nav-action-btn"
          disabled={!activeTab?.canGoForward}
          onClick={onGoForward}
          title="Forward (Alt+Right)"
        >
          <ArrowRight size={16} />
        </button>

        {activeTab?.isLoading ? (
          <button className="nav-action-btn stop-loading-btn" onClick={onStop} title="Stop Loading (Esc)">
            <X size={16} />
          </button>
        ) : (
          <button className="nav-action-btn reload-btn" onClick={onReload} title="Reload (Ctrl+R)">
            <RotateCw size={15} />
          </button>
        )}

        <button
          className="nav-action-btn"
          onClick={() => {
            if (onHome) onHome();
            else onNavigate('about:blank');
          }}
          title="Home"
        >
          <Home size={16} />
        </button>
      </div>

      {/* Center Address Input Bar & Omnibox Anchor */}
      <div className={`address-bar-container ${activeTab?.isLoading ? 'is-loading' : ''}`} ref={omniboxRef}>
        <div className="address-security-anchor" ref={securityRef}>
          <button
            className={`address-security-indicator-btn ${isSecurityOpen ? 'active' : ''}`}
            onClick={() => {
              setIsSecurityOpen(!isSecurityOpen);
              setIsProfileOpen(false);
              setIsAppMenuOpen(false);
            }}
            title={
              isHttps
                ? 'Connection is secure (HTTPS) — Click for security & DOM inspection'
                : isHttp
                  ? 'Connection is not secure (HTTP Cleartext) — Click for security & DOM inspection'
                  : 'DualSurf System Page'
            }
          >
            {isHttps ? (
              <Lock size={13} className="lock-icon secure" />
            ) : isHttp ? (
              <Unlock size={13} className="lock-icon insecure" />
            ) : (
              <Shield size={13} className="lock-icon default-lock" />
            )}
          </button>

          {isSecurityOpen && (
            <div className="security-popover-card" onClick={(e) => e.stopPropagation()}>
              <div className="security-card-header">
                <div className={`security-shield-icon-box ${isHttps ? 'secure' : isHttp ? 'insecure' : 'neutral'}`}>
                  {isHttps ? <ShieldCheck size={18} /> : isHttp ? <ShieldAlert size={18} /> : <Shield size={18} />}
                </div>
                <div className="security-header-text">
                  <div className="security-state-title">
                    <span>
                      {isHttps
                        ? 'Connection is secure'
                        : isHttp
                          ? 'Not secure (Cleartext HTTP)'
                          : 'DualSurf Internal Page'}
                    </span>
                    {securityInfo?.grade && (
                      <span className={`security-grade-badge grade-${securityInfo.grade.toLowerCase()}`}>
                        Grade {securityInfo.grade}
                      </span>
                    )}
                    {isLoadingSecurity && <span className="tab-spinner" style={{ width: 12, height: 12, marginLeft: 6 }} />}
                  </div>
                  <div className="security-state-sub">
                    {securityInfo?.securityScore !== undefined && isHttps
                      ? `Security rating: ${securityInfo.securityScore}/100 • Encrypted TLS Transport`
                      : isHttps
                        ? 'Encrypted TLS transport with validated identity'
                        : isHttp
                          ? 'Data transferred over this connection is unencrypted'
                          : 'Sandboxed browser environment'}
                  </div>
                </div>
              </div>

              <div className="security-info-grid">
                <div className="security-info-item">
                  <span className="sec-lbl">Host</span>
                  <span className="sec-val">
                    {(() => {
                      try {
                        return new URL(activeTab?.url || '').hostname || 'Local';
                      } catch {
                        return activeTab?.url || 'Local';
                      }
                    })()}
                  </span>
                </div>
                <div className="security-info-item">
                  <span className="sec-lbl">Protocol</span>
                  <span className="sec-val">
                    {securityInfo?.protocol || (isHttps ? 'TLS 1.3 / HTTPS' : isHttp ? 'HTTP Cleartext' : 'dualsurf://')}
                  </span>
                </div>
                {securityInfo?.cipherSuite && (
                  <div className="security-info-item sec-col-span-2">
                    <span className="sec-lbl">Cipher Suite</span>
                    <span className="sec-val text-mono">{securityInfo.cipherSuite}</span>
                  </div>
                )}
                {securityInfo?.certificate?.issuer && (
                  <div className="security-info-item sec-col-span-2">
                    <span className="sec-lbl">Certificate Issuer</span>
                    <span className="sec-val">{securityInfo.certificate.issuer}</span>
                  </div>
                )}
                {securityInfo?.hasInsecureContent && (
                  <div className="security-mixed-content-warning">
                    <ShieldAlert size={14} />
                    <span>Mixed content warning: Insecure HTTP elements detected on this HTTPS page</span>
                  </div>
                )}
              </div>

              <div className="security-popover-actions">
                <button
                  className="sec-action-row-btn"
                  onClick={() => {
                    setIsSecurityOpen(false);
                    if (onOpenMetadataDrawer) onOpenMetadataDrawer();
                  }}
                  title="Open live DOM metadata, headings, and numbered links drawer"
                >
                  <FileText size={14} />
                  <div className="sec-btn-text">
                    <span className="sec-btn-main">Inspect Page &amp; DOM Drawer</span>
                    <span className="sec-btn-desc">Headings, numbered links, forms, and cookies</span>
                  </div>
                  <ChevronRight size={13} className="sec-arrow" />
                </button>

                <button
                  className="sec-action-row-btn"
                  onClick={() => {
                    setIsSecurityOpen(false);
                    if (onRunTool) onRunTool('recon');
                  }}
                  title="Run target reconnaissance against active tab"
                >
                  <Search size={14} />
                  <div className="sec-btn-text">
                    <span className="sec-btn-main">Target Reconnaissance (`recon`)</span>
                    <span className="sec-btn-desc">Correlate response headers, endpoints &amp; ciphers</span>
                  </div>
                  <ChevronRight size={13} className="sec-arrow" />
                </button>

                <button
                  className="sec-action-row-btn"
                  onClick={() => {
                    setIsSecurityOpen(false);
                    if (onRunTool) onRunTool('sec-audit');
                  }}
                  title="Run passive security audit pipeline"
                >
                  <Shield size={14} />
                  <div className="sec-btn-text">
                    <span className="sec-btn-main">Passive Security Audit (`sec-audit`)</span>
                    <span className="sec-btn-desc">Check CSP, CSRF tokens, secrets &amp; tabnabbing</span>
                  </div>
                  <ChevronRight size={13} className="sec-arrow" />
                </button>

                <button
                  className="sec-action-row-btn"
                  onClick={() => {
                    setIsSecurityOpen(false);
                    if (onRunTool) onRunTool('cert');
                  }}
                  title="Inspect TLS certificate and cipher suite"
                >
                  <Lock size={14} />
                  <div className="sec-btn-text">
                    <span className="sec-btn-main">Inspect TLS Certificate (`cert`)</span>
                    <span className="sec-btn-desc">Check certificate issuer, validity &amp; SAN domains</span>
                  </div>
                  <ChevronRight size={13} className="sec-arrow" />
                </button>
              </div>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          className="address-text-field address-input"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onFocus={(e) => {
            setIsFocused(true);
            e.target.select();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            !activeTab?.url || activeTab.url === 'about:blank' || activeTab.url.startsWith('dualsurf:')
              ? `Search ${searchEngine ? (searchEngine.charAt(0).toUpperCase() + searchEngine.slice(1)) : 'the web'} or enter a URL...`
              : "Search or enter a URL (e.g. !gh, !w, !cve, or domain)..."
          }
          spellCheck={false}
          autoComplete="off"
        />

        {/* Omnibox Tools Strip - Minimal, clean, professional */}
        <div className="address-right-tools">
          {urlInput && isFocused && (
            <button
              className="address-tool-btn"
              onClick={() => {
                setUrlInput('');
                inputRef.current?.focus();
              }}
              title="Clear input"
            >
              <X size={13} />
            </button>
          )}

          {/* Reader Mode Button */}
          {onOpenReaderMode && activeTab && activeTab.url && !activeTab.url.startsWith('dualsurf:') && activeTab.url !== 'about:blank' && (
            <button
              className="address-tool-btn reader-mode-btn"
              onClick={onOpenReaderMode}
              title="Reader Mode (Ctrl+Shift+R)"
            >
              <BookOpen size={13} />
            </button>
          )}

          {/* Copy URL Button */}
          {activeTab && activeTab.url && !activeTab.url.startsWith('dualsurf:') && activeTab.url !== 'about:blank' && (
            <button
              className={`address-tool-btn ${copiedUrl ? 'copied' : ''}`}
              onClick={handleCopyUrl}
              title={copiedUrl ? 'URL Copied!' : 'Copy Page URL'}
            >
              {copiedUrl ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
            </button>
          )}

          <button
            className={`address-tool-btn ${isBookmarked ? 'bookmarked' : ''}`}
            onClick={handleBookmarkToggle}
            title={isBookmarked ? 'Saved to bookmarks' : 'Bookmark this tab'}
          >
            <Star
              size={14}
              fill={isBookmarked ? '#f59e0b' : 'none'}
              color={isBookmarked ? '#f59e0b' : 'currentColor'}
            />
          </button>
        </div>

        {/* Omnibox Dropdown Autocomplete */}
        {isFocused && suggestions.length > 0 && (
          <div className="omnibox-dropdown-card" onClick={(e) => e.stopPropagation()}>
            {suggestions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`omnibox-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectSuggestion(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="omnibox-item-icon">
                    {item.type === 'bang' ? (
                      <Zap size={14} className="icon-bang" />
                    ) : item.type === 'bookmark' ? (
                      <Star size={14} className="icon-bm" fill="#f59e0b" color="#f59e0b" />
                    ) : item.type === 'history' ? (
                      <Clock size={14} className="icon-hist" />
                    ) : (
                      <Search size={14} className="icon-search" />
                    )}
                  </div>
                  <div className="omnibox-item-text">
                    <div className="omnibox-title-row">
                      <span className="omnibox-item-title">{item.title}</span>
                      {item.badge && <span className="omnibox-badge">{item.badge}</span>}
                    </div>
                    <span className="omnibox-item-sub">{item.subtitle}</span>
                  </div>
                </div>
              );
            })}
            <div className="omnibox-footer-hint">
              <span><kbd>↑↓</kbd> Select</span>
              <span><kbd>Tab</kbd> Autocomplete</span>
              <span><kbd>↵</kbd> Navigate</span>
              <span><kbd>Esc</kbd> Close</span>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Mode Switcher & Menu Cluster */}
      {/* Right side: Mode Switcher & Menu Cluster */}
      <div className="nav-right-cluster">
        {/* Downloads Tray Button */}
        {onOpenDownloads && (
          <button
            className="nav-action-btn"
            onClick={onOpenDownloads}
            title="Downloads Manager (Ctrl+J)"
          >
            <Download size={15} />
          </button>
        )}

        {/* Cyber Shield Protection */}
        {onToggleShieldDropdown && (
          <button
            className={`nav-action-btn ${isShieldDropdownOpen ? 'active' : ''}`}
            onClick={onToggleShieldDropdown}
            title="Cyber Shield Protection"
          >
            <ShieldCheck size={15} className={isShieldDropdownOpen ? 'text-cyan' : ''} />
          </button>
        )}

        {/* Traffic Sniffer / Request Database */}
        {onOpenTrafficSniffer && (
          <button
            className="nav-action-btn"
            onClick={onOpenTrafficSniffer}
            title="HTTP Traffic Sniffer & Request DB"
          >
            <Database size={15} />
          </button>
        )}


        {/* User Profile / Host Diagnostics Button & Popover */}
        <div className="nav-popover-anchor" ref={profileRef}>
          <button
            className={`nav-action-btn user-btn ${isProfileOpen ? 'active' : ''}`}
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsAppMenuOpen(false);
            }}
            title="Host System & Session Info"
          >
            <User size={15} />
          </button>

          {isProfileOpen && (
            <div className="profile-popover-card" onClick={(e) => e.stopPropagation()}>
              <div className="profile-card-header">
                <div className="profile-avatar-wrap">
                  <User size={18} />
                </div>
                <div className="profile-user-info">
                  <div className="profile-user-name">
                    {systemInfo ? `${systemInfo.username}@${systemInfo.hostname}` : 'DualSurf User'}
                  </div>
                  <div className="profile-os-badge">
                    {systemInfo ? systemInfo.osName : 'Host Machine'}
                  </div>
                </div>
              </div>

              <div className="profile-details-grid">
                <div className="profile-detail-item">
                  <span className="detail-key">Shell:</span>
                  <span className="detail-val">{systemInfo?.shellName || 'bash'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-key">Mode:</span>
                  <span className="detail-val">{mode === 'gui' ? 'Browser (GUI)' : 'Terminal (CLI)'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-key">Isolation:</span>
                  <span className="detail-val text-success">WebContents Sandbox</span>
                </div>
              </div>

              <div className="profile-actions-strip">
                <button
                  className="profile-action-btn"
                  onClick={handleCopyDiagnostics}
                  title="Copy diagnostics report to clipboard"
                >
                  {copiedDiag ? <Check size={12} color="var(--ds-success)" /> : <Copy size={12} />}
                  <span>{copiedDiag ? 'Copied!' : 'Copy Diagnostics'}</span>
                </button>
                <button
                  className="profile-action-btn"
                  onClick={() => {
                    setIsProfileOpen(false);
                    if (onOpenSettings) onOpenSettings();
                  }}
                >
                  <Settings size={12} />
                  <span>Settings</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* More Options / Main Browser App Menu */}
        <div className="nav-popover-anchor" ref={menuRef}>
          <button
            className={`nav-action-btn ${isAppMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setIsAppMenuOpen(!isAppMenuOpen);
              setIsProfileOpen(false);
            }}
            title="More options"
          >
            <MoreVertical size={16} />
          </button>

          {isAppMenuOpen && (
            <div className="app-menu-dropdown-popup" onClick={(e) => e.stopPropagation()}>
              {/* Tab Management */}
              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onNewTab) onNewTab();
                }}
              >
                <Plus size={14} />
                <span>New Tab</span>
                <span className="menu-shortcut">Ctrl+T</span>
              </button>

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onOpenTabSearch) onOpenTabSearch();
                }}
              >
                <Search size={14} />
                <span>Search Tabs</span>
                <span className="menu-shortcut">Ctrl+Shift+A</span>
              </button>

              {onToggleSplitTab && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    if (splitTabId) {
                      onToggleSplitTab(splitTabId);
                    } else if (tabs.length > 1) {
                      const other = tabs.find((t) => t.id !== activeTab?.id);
                      if (other) onToggleSplitTab(other.id);
                    } else {
                      if (onNewTab) onNewTab();
                    }
                  }}
                >
                  <Columns2 size={14} />
                  <span>{splitTabId ? 'Close Split View' : 'Split View Side-by-Side'}</span>
                </button>
              )}

              {onOpenCommandPalette && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenCommandPalette();
                  }}
                >
                  <Command size={14} />
                  <span>Command Palette</span>
                  <span className="menu-shortcut">Ctrl+K</span>
                </button>
              )}

              {onOpenReaderMode && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenReaderMode();
                  }}
                >
                  <BookOpen size={14} />
                  <span>Reader Mode</span>
                  <span className="menu-shortcut">Ctrl+Shift+R</span>
                </button>
              )}

              {onOpenOllamaSetup && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenOllamaSetup();
                  }}
                >
                  <Bot size={14} />
                  <span>Ollama AI Setup &amp; Config</span>
                </button>
              )}

              {onToggleCopilot && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onToggleCopilot();
                  }}
                >
                  <Bot size={14} />
                  <span>DualSurf AI Copilot</span>
                  <span className="menu-shortcut">Ctrl+J</span>
                </button>
              )}

              {onOpenTrafficSniffer && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenTrafficSniffer();
                  }}
                >
                  <Activity size={14} />
                  <span>Live Traffic Sniffer</span>
                </button>
              )}

              {onOpenProxyModal && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenProxyModal();
                  }}
                >
                  <Layers size={14} />
                  <span>Proxy &amp; Anonymity Switcher</span>
                </button>
              )}

              {onOpenCookieModal && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenCookieModal();
                  }}
                >
                  <Cookie size={14} />
                  <span>Cookie &amp; Session Inspector</span>
                </button>
              )}

              {onOpenUserAgentModal && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenUserAgentModal();
                  }}
                >
                  <Fingerprint size={14} />
                  <span>User-Agent &amp; Anti-Fingerprint</span>
                </button>
              )}

              {onOpenAttackSurfaceModal && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenAttackSurfaceModal();
                  }}
                >
                  <Network size={14} />
                  <span>Attack Surface Visualizer</span>
                </button>
              )}

              {onOpenCyberTools && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenCyberTools();
                  }}
                >
                  <Wrench size={14} />
                  <span>Cyber &amp; Dev Swiss Army Knife</span>
                </button>
              )}

              {onOpenHttpRepeater && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenHttpRepeater();
                  }}
                >
                  <Send size={14} />
                  <span>HTTP Request Repeater</span>
                  <span className="menu-shortcut">Ctrl+Shift+E</span>
                </button>
              )}

              {onOpenPrivacyAudit && (
                <button
                  className="app-menu-item"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    onOpenPrivacyAudit();
                  }}
                >
                  <Shield size={14} />
                  <span>Privacy Health &amp; Leak Audit</span>
                  <span className="menu-shortcut">Ctrl+Shift+L</span>
                </button>
              )}

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onDuplicateTab) onDuplicateTab();
                  else if (window.dualsurf && activeTab) window.dualsurf.duplicateTab(activeTab.id);
                }}
              >
                <Copy size={14} />
                <span>Duplicate Tab</span>
              </button>

              <div className="app-menu-divider" />

              {/* Navigation Drawers */}
              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onOpenHistory) onOpenHistory();
                }}
              >
                <History size={14} />
                <span>History</span>
                <span className="menu-shortcut">Ctrl+H</span>
              </button>

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onOpenBookmarks) onOpenBookmarks();
                }}
              >
                <Bookmark size={14} />
                <span>Bookmarks</span>
                <span className="menu-shortcut">Ctrl+B</span>
              </button>

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onOpenDownloads) onOpenDownloads();
                }}
              >
                <Download size={14} />
                <span>Downloads</span>
                <span className="menu-shortcut">Ctrl+J</span>
              </button>

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onOpenFind) onOpenFind();
                }}
              >
                <Search size={14} />
                <span>Find in Page</span>
                <span className="menu-shortcut">Ctrl+F</span>
              </button>

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onOpenMetadataDrawer) onOpenMetadataDrawer();
                }}
              >
                <Terminal size={14} />
                <span>Page Inspector &amp; DOM</span>
                <span className="menu-shortcut">Ctrl+I</span>
              </button>

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onOpenClearData) onOpenClearData();
                }}
              >
                <Trash2 size={14} />
                <span>Clear Browsing Data</span>
                <span className="menu-shortcut">Ctrl+Shift+Del</span>
              </button>

              <div className="app-menu-divider" />

              {/* Zoom Controls */}
              <div className="app-menu-zoom-row">
                <span className="zoom-label">Zoom</span>
                <div className="zoom-btn-cluster">
                  <button
                    className="zoom-stepper-btn"
                    onClick={() => handleZoom(-10)}
                    title="Zoom Out"
                  >
                    <ZoomOut size={13} />
                  </button>
                  <button
                    className="zoom-value-btn"
                    onClick={handleResetZoom}
                    title="Reset Zoom to 100%"
                  >
                    {zoomLevel}%
                  </button>
                  <button
                    className="zoom-stepper-btn"
                    onClick={() => handleZoom(10)}
                    title="Zoom In"
                  >
                    <ZoomIn size={13} />
                  </button>
                </div>
              </div>

              <div className="app-menu-divider" />

              {/* Developer & System */}
              <button className="app-menu-item" onClick={handleToggleDevTools}>
                <Code2 size={14} />
                <span>Developer Tools</span>
                <span className="menu-shortcut">F12</span>
              </button>

              <button className="app-menu-item" onClick={handleToggleFullScreen}>
                <Maximize2 size={14} />
                <span>Toggle Fullscreen</span>
                <span className="menu-shortcut">F11</span>
              </button>

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  onModeChange(mode === 'gui' ? 'terminal' : 'gui');
                }}
              >
                <Terminal size={14} />
                <span>Switch to {mode === 'gui' ? 'Terminal' : 'Browser'}</span>
                <span className="menu-shortcut">Ctrl+`</span>
              </button>

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onOpenShortcuts) onOpenShortcuts();
                }}
              >
                <Keyboard size={14} />
                <span>Keyboard Shortcuts</span>
                <span className="menu-shortcut">Ctrl+/</span>
              </button>

              <div className="app-menu-divider" />

              <button
                className="app-menu-item"
                onClick={() => {
                  setIsAppMenuOpen(false);
                  if (onOpenSettings) onOpenSettings();
                }}
              >
                <Settings size={14} />
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
