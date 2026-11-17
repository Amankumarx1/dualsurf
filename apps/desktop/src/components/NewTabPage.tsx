import React, { useState, useEffect } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { DualSurfLogo } from './DualSurfLogo';
import type { SearchEngine, TabState, ActiveSessionState } from '@dualsurf/shared-types';

interface NewTabPageProps {
  onNavigate: (url: string) => void;
  onSwitchToTerminal: () => void;
  onNewTab?: () => void;
  onOpenAbout?: () => void;
  onOpenSettings?: () => void;
  activeTab?: TabState | null;
  activeSession?: ActiveSessionState;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  searchEngine?: SearchEngine;
  onUpdateSearchEngine?: (engine: SearchEngine) => void;
}

export const NewTabPage: React.FC<NewTabPageProps> = ({
  onNavigate,
  searchEngine = 'google',
  theme = 'dark',
}) => {
  const [query, setQuery] = useState('');
  const isLight = theme === 'light';

  // Real System Clock & Dynamic Date
  const [currentTime, setCurrentTime] = useState({
    timeStr: '18:14',
    dateStr: 'Fri, 23 Oct 2026',
  });

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Check for direct valid URL or localhost/IP
    const isUrl =
      /^(https?:\/\/|[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i.test(
        trimmed
      );

    if (isUrl) {
      const target = trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('dualsurf://')
        ? trimmed
        : `https://${trimmed}`;
      onNavigate(target);
    } else {
      // Execute via active search engine
      let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
      if (searchEngine === 'duckduckgo') {
        searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
      } else if (searchEngine === 'brave') {
        searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(trimmed)}`;
      } else if (searchEngine === 'bing') {
        searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`;
      }
      onNavigate(searchUrl);
    }
  };

  // 4 Default Shortcuts Matching Screenshot
  const shortcuts = [
    {
      name: 'Google',
      url: 'https://google.com',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
      ),
    },
    {
      name: 'YouTube',
      url: 'https://youtube.com',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#FF0000">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
    },
    {
      name: 'GitHub',
      url: 'https://github.com',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill={isLight ? '#111827' : '#F4F5F7'}>
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      ),
    },
    {
      name: 'ChatGPT',
      url: 'https://chatgpt.com',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill={isLight ? '#111827' : '#F4F5F7'}>
          <path d="M22.28 10.63a5.55 5.55 0 0 0-.48-4.54 5.65 5.65 0 0 0-3.9-2.73 5.55 5.55 0 0 0-4.64.96A5.55 5.55 0 0 0 8.9 3.03a5.66 5.66 0 0 0-3.8 2.86 5.57 5.57 0 0 0-.84 4.66 5.57 5.57 0 0 0-2.86 3.8 5.63 5.63 0 0 0 .97 4.63 5.56 5.56 0 0 0 .48 4.54 5.66 5.66 0 0 0 3.9 2.73 5.56 5.56 0 0 0 4.64-.96 5.56 5.56 0 0 0 4.36 1.29 5.65 5.65 0 0 0 3.8-2.86 5.57 5.57 0 0 0 .84-4.66 5.56 5.56 0 0 0 2.86-3.8 5.63 5.63 0 0 0-.97-4.63z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="dualsurf-newtab-hero">
      {/* Cinematic Dark Wallpaper Background with Orange Dune Rim Light */}
      <div className="newtab-hero-wallpaper-layer" />
      <div className="newtab-hero-dark-overlay" />

      {/* Main Central Content Workspace */}
      <div className="newtab-hero-center-content">
        {/* Upper-Middle DualSurf Branding */}
        <div className="newtab-brand-container">
          <div className="newtab-brand-lockup">
            <DualSurfLogo size={48} variant="orange" className="newtab-brand-logo" />
            <h1 className="newtab-brand-wordmark">DualSurf</h1>
          </div>
          <div className="newtab-brand-descriptor">
            <span>Simple Dual-Mode Browser</span>
            <span className="descriptor-dot">•</span>
            <span>GUI &amp; CLI</span>
          </div>
        </div>

        {/* Central Search Bar */}
        <form className="newtab-search-bar" onSubmit={handleSearch}>
          <Search size={18} className="newtab-search-icon" />
          <input
            type="text"
            className="newtab-search-input"
            placeholder="Search the web or enter a URL..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            spellCheck={false}
          />
          <button type="submit" className="newtab-search-submit" title="Navigate">
            <ArrowRight size={18} />
          </button>
        </form>

        {/* 4 Default Quick-Launch Shortcuts */}
        <div className="newtab-shortcuts-container">
          {shortcuts.map((sc) => (
            <button
              key={sc.name}
              className="newtab-shortcut-card"
              onClick={() => onNavigate(sc.url)}
              title={sc.name}
            >
              <div className="shortcut-icon-tile">{sc.icon}</div>
              <span className="shortcut-label">{sc.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lower-Left System Clock & Date */}
      <div className="newtab-lower-left-clock">
        <div className="clock-time-row">
          <span className="clock-accent-bar" />
          <span className="clock-digits">{currentTime.timeStr}</span>
        </div>
        <div className="clock-date-label">{currentTime.dateStr}</div>
      </div>

      {/* Lower-Right Tagline */}
      <div className="newtab-lower-right-tagline">
        <div className="tagline-line-1">&gt; Fast &amp; Minimal.</div>
        <div className="tagline-line-2">
          <span>Dual-mode browsing.</span>
          <span className="tagline-cursor" />
        </div>
      </div>
    </div>
  );
};
