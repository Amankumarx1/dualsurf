import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Sliders,
  Palette,
  Globe,
  Shield,
  Terminal,
  Keyboard,
  Info,
  Search,
  Check,
  RotateCcw,
  Folder,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import type {
  BrowserSettings,
  SearchEngine,
  PlatformDiagnostics,
} from '@dualsurf/shared-types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenClearData?: () => void;
  initialCategory?: SettingsCategory;
}

type SettingsCategory =
  | 'general'
  | 'appearance'
  | 'browser'
  | 'privacy'
  | 'terminal'
  | 'shortcuts'
  | 'about';

interface CategoryItem {
  id: SettingsCategory;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  description: string;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'general', label: 'General', icon: Sliders, description: 'Startup behavior, home page, and search provider' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Themes, density, and interface styling' },
  { id: 'browser', label: 'Browser', icon: Globe, description: 'Tabs, downloads location, and page zoom' },
  { id: 'privacy', label: 'Privacy & Data', icon: Shield, description: 'Browsing data, cookies, and tracking prevention' },
  { id: 'terminal', label: 'Terminal', icon: Terminal, description: 'Default shell, font size, and cursor appearance' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, description: 'Complete keybindings and navigation hotkeys' },
  { id: 'about', label: 'About DualSurf', icon: Info, description: 'Version information, architecture, and licensing' },
];

interface SearchableSetting {
  id: string;
  category: SettingsCategory;
  categoryLabel: string;
  title: string;
  description: string;
  keywords: string[];
}

const SEARCHABLE_SETTINGS: SearchableSetting[] = [
  {
    id: 'searchEngine',
    category: 'general',
    categoryLabel: 'General Preferences',
    title: 'Default Search Provider',
    description: 'Configure omnibox queries and default search engine: Google, DuckDuckGo, Brave, Bing, Ecosia.',
    keywords: ['search', 'engine', 'google', 'duckduckgo', 'brave', 'bing', 'ecosia', 'omnibox', 'provider'],
  },
  {
    id: 'homePageUrl',
    category: 'general',
    categoryLabel: 'General Preferences',
    title: 'Home & Start Page URL',
    description: 'Custom landing page loaded when opening a new window or clicking the Home toolbar button.',
    keywords: ['home', 'homepage', 'url', 'start', 'landing', 'startup'],
  },
  {
    id: 'startupBehavior',
    category: 'general',
    categoryLabel: 'General Preferences',
    title: 'Startup Behavior & Session Restore',
    description: 'Choose whether to restore previous browser tabs and active session, or open the start page.',
    keywords: ['startup', 'restore', 'session', 'launch', 'tabs'],
  },
  {
    id: 'theme',
    category: 'appearance',
    categoryLabel: 'Appearance',
    title: 'Interface Theme Mode',
    description: 'Select dark mode or light mode for the browser interface.',
    keywords: ['theme', 'dark', 'light', 'mode', 'color', 'appearance'],
  },
  {
    id: 'uiDensity',
    category: 'appearance',
    categoryLabel: 'Appearance',
    title: 'UI Density & Spacing',
    description: 'Adjust padding and heights of tab bars, toolbars, and menus (Compact, Default, Comfortable).',
    keywords: ['density', 'compact', 'padding', 'spacing', 'size', 'height'],
  },
  {
    id: 'showBookmarksBar',
    category: 'appearance',
    categoryLabel: 'Appearance',
    title: 'Show Bookmarks Bar',
    description: 'Always display bookmarks bar below the main navigation address bar.',
    keywords: ['bookmarks', 'bar', 'toolbar', 'favorites'],
  },
  {
    id: 'pageZoom',
    category: 'browser',
    categoryLabel: 'Browser',
    title: 'Default Page Zoom',
    description: 'Set standard zoom percentage applied to web pages (80%, 100%, 125%, 150%).',
    keywords: ['zoom', 'scale', 'magnify', 'percent', 'browser', 'size'],
  },
  {
    id: 'downloadDir',
    category: 'browser',
    categoryLabel: 'Browser',
    title: 'Default Downloads Directory',
    description: 'Designate the filesystem folder where downloaded files are saved.',
    keywords: ['download', 'downloads', 'directory', 'folder', 'path', 'save'],
  },
  {
    id: 'promptDownload',
    category: 'browser',
    categoryLabel: 'Browser',
    title: 'Prompt Before Downloading',
    description: 'Always prompt with a file save dialog before initiating a download.',
    keywords: ['download', 'prompt', 'ask', 'file picker', 'confirm'],
  },
  {
    id: 'clearBrowsingData',
    category: 'privacy',
    categoryLabel: 'Privacy & Data',
    title: 'Clear Browsing Data',
    description: 'Erase cached web content, active session cookies, and navigation history.',
    keywords: ['clear', 'cache', 'history', 'cookies', 'delete', 'clean', 'purge'],
  },
  {
    id: 'doNotTrack',
    category: 'privacy',
    categoryLabel: 'Privacy & Data',
    title: 'Send Do Not Track Request',
    description: 'Send a "Do Not Track" request with all outgoing HTTP web traffic.',
    keywords: ['track', 'privacy', 'dnt', 'cookie'],
  },
  {
    id: 'defaultShell',
    category: 'terminal',
    categoryLabel: 'Terminal',
    title: 'Default Shell Binary',
    description: 'Primary command shell used when opening terminal sessions (PowerShell, Command Prompt, Git Bash).',
    keywords: ['shell', 'powershell', 'cmd', 'bash', 'zsh', 'terminal', 'pty'],
  },
  {
    id: 'termFontSize',
    category: 'terminal',
    categoryLabel: 'Terminal',
    title: 'Terminal Font Size',
    description: 'Adjust text size in the integrated terminal viewport.',
    keywords: ['font', 'size', 'terminal', 'text'],
  },
  {
    id: 'termCursor',
    category: 'terminal',
    categoryLabel: 'Terminal',
    title: 'Terminal Cursor Style',
    description: 'Configure terminal prompt cursor shape (Bar, Block, or Underline).',
    keywords: ['cursor', 'terminal', 'block', 'underline', 'bar', 'prompt'],
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenClearData,
  initialCategory = 'general',
}) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialCategory);

  useEffect(() => {
    if (isOpen && initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [isOpen, initialCategory]);
  const [searchFilter, setSearchFilter] = useState('');
  const [initialSettings, setInitialSettings] = useState<BrowserSettings | null>(null);
  const [currentSettings, setCurrentSettings] = useState<BrowserSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [diagnostics, setDiagnostics] = useState<PlatformDiagnostics | null>(null);

  // Compute search matches across settings
  const searchResults = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return [];
    return SEARCHABLE_SETTINGS.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.description.toLowerCase().includes(q)) return true;
      if (item.categoryLabel.toLowerCase().includes(q)) return true;
      return item.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [searchFilter]);

  // Compute category match counts for sidebar badges
  const categoryMatchCounts = useMemo(() => {
    if (!searchFilter.trim()) return {};
    const counts: Record<string, number> = {};
    searchResults.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [searchFilter, searchResults]);

  // Local Escape key handling
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isConfirmingReset) {
          setIsConfirmingReset(false);
        } else if (searchFilter !== '') {
          setSearchFilter('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchFilter, isConfirmingReset, onClose]);

  // Load settings on open
  useEffect(() => {
    if (isOpen && window.dualsurf) {
      window.dualsurf.getSettings().then((s) => {
        setInitialSettings(s);
        setCurrentSettings(s);
      }).catch(console.error);

      if (window.dualsurf.getPlatformDiagnostics) {
        window.dualsurf.getPlatformDiagnostics().then(setDiagnostics).catch(() => {});
      }
    }
  }, [isOpen]);

  // Determine if there are uncommitted edits
  const hasChanges = useMemo(() => {
    if (!initialSettings || !currentSettings) return false;
    return JSON.stringify(initialSettings) !== JSON.stringify(currentSettings);
  }, [initialSettings, currentSettings]);

  if (!isOpen || !currentSettings) return null;

  const updateField = (partial: Partial<BrowserSettings>) => {
    setCurrentSettings((prev) => (prev ? { ...prev, ...partial } : null));
  };

  const handleSaveAndApply = async () => {
    if (!window.dualsurf || !currentSettings) return;
    setIsSaving(true);
    try {
      const updated = await window.dualsurf.updateSettings(currentSettings);
      setInitialSettings(updated);
      setCurrentSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (initialSettings) {
      setCurrentSettings({ ...initialSettings });
    }
  };

  const executeReset = async () => {
    setIsConfirmingReset(false);
    if (window.dualsurf?.resetSettings) {
      try {
        const defaults = await window.dualsurf.resetSettings();
        setInitialSettings(defaults);
        setCurrentSettings(defaults);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } catch (err) {
        console.error('Failed to reset settings:', err);
      }
    }
  };

  const handleJumpToSetting = (category: SettingsCategory) => {
    setActiveCategory(category);
    setSearchFilter('');
  };

  const handleSelectDownloadFolder = async () => {
    if (window.dualsurf?.selectDownloadFolder) {
      try {
        const res = await window.dualsurf.selectDownloadFolder();
        if (res.success && res.path) {
          updateField({ defaultDownloadDir: res.path });
        }
      } catch (err) {
        console.error('Folder selection failed:', err);
      }
    }
  };

  const handleSelectTerminalWorkingDir = async () => {
    if (window.dualsurf?.selectFolder) {
      try {
        const res = await window.dualsurf.selectFolder('Select Default Terminal Directory');
        if (res?.success && res.path) {
          updateField({ terminalDefaultWorkingDir: res.path });
        }
      } catch (err) {
        console.error('Terminal directory selection failed:', err);
      }
    }
  };

  return (
    <div className="modal-overlay settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Settings Header Strip */}
        <div className="settings-header-strip">
          <div className="settings-header-left">
            <div className="settings-brand-pill">
              <Sliders size={16} />
              <span>DualSurf Settings</span>
            </div>
            <span className="settings-header-desc">Browser Preferences &amp; Controls</span>
          </div>

          <div className="settings-header-center">
            <div className="settings-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search settings (e.g. search engine, terminal, zoom)..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="settings-search-input"
              />
              {searchFilter && (
                <button className="clear-search-btn" onClick={() => setSearchFilter('')}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="settings-header-right">
            <button className="settings-close-x-btn" onClick={onClose} title="Close Settings (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Main Area: Left Navigation + Right Content */}
        <div className="settings-main-split">
          {/* Left Category Navigation */}
          <div className="settings-nav-sidebar">
            <div className="settings-nav-list">
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isActive = activeCategory === cat.id && !searchFilter.trim();
                const matchCount = categoryMatchCounts[cat.id];
                return (
                  <button
                    key={cat.id}
                    className={`settings-nav-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      if (searchFilter) setSearchFilter('');
                    }}
                  >
                    <IconComponent size={15} className="tab-icon" />
                    <span className="tab-label">{cat.label}</span>
                    {matchCount ? (
                      <span className="cat-match-badge" title={`${matchCount} matches in ${cat.label}`}>
                        {matchCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="settings-sidebar-bottom">
              {isConfirmingReset ? (
                <div className="settings-reset-confirm-banner" role="alert">
                  <div className="reset-confirm-text">
                    <AlertTriangle size={13} className="warning-icon" />
                    <span>Reset settings to factory defaults?</span>
                  </div>
                  <div className="reset-confirm-actions">
                    <button className="confirm-reset-btn" onClick={executeReset}>
                      Reset
                    </button>
                    <button className="cancel-reset-btn" onClick={() => setIsConfirmingReset(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="settings-factory-reset-btn"
                  onClick={() => setIsConfirmingReset(true)}
                  title="Restore all browser settings to factory defaults"
                >
                  <RotateCcw size={13} />
                  <span>Reset All Defaults</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Settings Content */}
          <div className="settings-content-viewport">
            {searchFilter.trim() !== '' ? (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Search Results</h2>
                  <p className="category-pane-sub">
                    {searchResults.length} {searchResults.length === 1 ? 'setting' : 'settings'} matching "{searchFilter}"
                  </p>
                </div>

                {searchResults.length === 0 ? (
                  <div className="settings-search-empty">
                    <Search size={32} className="empty-search-icon" />
                    <p className="empty-search-title">No matching settings found</p>
                    <p className="empty-search-sub">
                      Try searching for keywords like "search engine", "theme", "terminal", or "zoom".
                    </p>
                    <button className="clear-search-link-btn" onClick={() => setSearchFilter('')}>
                      Clear Search Filter
                    </button>
                  </div>
                ) : (
                  <div className="settings-search-results-list">
                    {searchResults.map((item) => (
                      <div key={item.id} className="settings-search-result-card">
                        <div className="search-result-left">
                          <span className="search-result-cat-pill">{item.categoryLabel}</span>
                          <h4 className="search-result-title">{item.title}</h4>
                          <p className="search-result-desc">{item.description}</p>
                        </div>
                        <button
                          className="search-result-jump-btn"
                          onClick={() => handleJumpToSetting(item.category)}
                          title={`Navigate to ${item.categoryLabel}`}
                        >
                          <span>Go to Setting</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* 1. GENERAL PREFERENCES */}
                {activeCategory === 'general' && (
                  <div className="settings-category-pane">
                    <div className="category-pane-header">
                      <h2 className="category-pane-title">General Preferences</h2>
                      <p className="category-pane-sub">Configure core startup behavior, home page, and default search engine.</p>
                    </div>

                    <div className="settings-group-card">
                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Default Search Provider</span>
                          <span className="setting-sub-label">Used for omnibox queries and address bar search terms</span>
                        </div>
                        <div className="setting-action-col">
                          <select
                            className="settings-select-input"
                            value={currentSettings.searchEngine}
                            onChange={(e) => updateField({ searchEngine: e.target.value as SearchEngine })}
                          >
                            <option value="google">Google (Default)</option>
                            <option value="duckduckgo">DuckDuckGo (Privacy-focused)</option>
                            <option value="brave">Brave Search (Independent Index)</option>
                            <option value="bing">Microsoft Bing</option>
                            <option value="ecosia">Ecosia (Eco-friendly)</option>
                            <option value="yahoo">Yahoo Search</option>
                          </select>
                        </div>
                      </div>

                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Home &amp; Start Page URL</span>
                          <span className="setting-sub-label">Web page loaded when clicking the home button or opening new tab</span>
                        </div>
                        <div className="setting-action-col">
                          <input
                            type="text"
                            className="settings-text-input"
                            value={currentSettings.homeUrl}
                            onChange={(e) => updateField({ homeUrl: e.target.value })}
                            placeholder="dualsurf://newtab"
                          />
                        </div>
                      </div>

                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Restore Previous Session on Startup</span>
                          <span className="setting-sub-label">Automatically re-open previously open tabs and browsing state</span>
                        </div>
                        <div className="setting-action-col">
                          <label className="settings-toggle-switch">
                            <input
                              type="checkbox"
                              checked={Boolean(currentSettings.restoreSessionOnStartup)}
                              onChange={(e) => updateField({ restoreSessionOnStartup: e.target.checked })}
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. APPEARANCE */}
                {activeCategory === 'appearance' && (
                  <div className="settings-category-pane">
                    <div className="category-pane-header">
                      <h2 className="category-pane-title">Appearance</h2>
                      <p className="category-pane-sub">Customize the visual theme, spacing, and browser layout.</p>
                    </div>

                    <div className="settings-group-card">
                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Interface Theme</span>
                          <span className="setting-sub-label">Choose dark mode or light mode</span>
                        </div>
                        <div className="setting-action-col">
                          <select
                            className="settings-select-input"
                            value={currentSettings.theme}
                            onChange={(e) => updateField({ theme: e.target.value as any })}
                          >
                            <option value="dark">Dark Theme (Default)</option>
                            <option value="light">Light Theme</option>
                            <option value="system">Follow Host OS Theme</option>
                          </select>
                        </div>
                      </div>

                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">UI Density</span>
                          <span className="setting-sub-label">Control spacing and padding across tabs and toolbars</span>
                        </div>
                        <div className="setting-action-col">
                          <select
                            className="settings-select-input"
                            value={currentSettings.uiDensity || 'default'}
                            onChange={(e) => updateField({ uiDensity: e.target.value as any })}
                          >
                            <option value="compact">Compact (More content space)</option>
                            <option value="default">Default</option>
                            <option value="comfortable">Comfortable</option>
                          </select>
                        </div>
                      </div>

                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Show Bookmarks Bar</span>
                          <span className="setting-sub-label">Keep the bookmarks bar visible underneath the address bar</span>
                        </div>
                        <div className="setting-action-col">
                          <label className="settings-toggle-switch">
                            <input
                              type="checkbox"
                              checked={currentSettings.showBookmarksBar !== false}
                              onChange={(e) => updateField({ showBookmarksBar: e.target.checked })}
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. BROWSER & TABS */}
                {activeCategory === 'browser' && (
                  <div className="settings-category-pane">
                    <div className="category-pane-header">
                      <h2 className="category-pane-title">Browser &amp; Tabs</h2>
                      <p className="category-pane-sub">Manage download behavior, tab zoom, and web page defaults.</p>
                    </div>

                    <div className="settings-group-card">
                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Default Page Zoom</span>
                          <span className="setting-sub-label">Standard magnification level applied to opened web pages</span>
                        </div>
                        <div className="setting-action-col">
                          <select
                            className="settings-select-input"
                            value={String(currentSettings.defaultZoomFactor || 1.0)}
                            onChange={(e) => updateField({ defaultZoomFactor: parseFloat(e.target.value) })}
                          >
                            <option value="0.8">80%</option>
                            <option value="0.9">90%</option>
                            <option value="1">100% (Default)</option>
                            <option value="1.1">110%</option>
                            <option value="1.25">125%</option>
                            <option value="1.5">150%</option>
                          </select>
                        </div>
                      </div>

                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Default Downloads Directory</span>
                          <span className="setting-sub-label font-mono text-xs">{currentSettings.defaultDownloadDir || 'Default (~/Downloads)'}</span>
                        </div>
                        <div className="setting-action-col">
                          <button className="settings-action-btn" onClick={handleSelectDownloadFolder}>
                            <Folder size={13} />
                            <span>Change Folder</span>
                          </button>
                        </div>
                      </div>

                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Prompt Before Downloading</span>
                          <span className="setting-sub-label">Ask where to save each file before downloading</span>
                        </div>
                        <div className="setting-action-col">
                          <label className="settings-toggle-switch">
                            <input
                              type="checkbox"
                              checked={Boolean(currentSettings.promptForDownloadLocation)}
                              onChange={(e) => updateField({ promptForDownloadLocation: e.target.checked })}
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. PRIVACY & DATA */}
                {activeCategory === 'privacy' && (
                  <div className="settings-category-pane">
                    <div className="category-pane-header">
                      <h2 className="category-pane-title">Privacy &amp; Data</h2>
                      <p className="category-pane-sub">Manage your browsing data, cookies, and privacy headers.</p>
                    </div>

                    <div className="settings-group-card">
                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Clear Browsing Data</span>
                          <span className="setting-sub-label">Erase browsing history, cache, cookies, and local session data</span>
                        </div>
                        <div className="setting-action-col">
                          <button
                            className="settings-action-btn btn-danger-subtle"
                            onClick={() => {
                              if (onOpenClearData) {
                                onClose();
                                onOpenClearData();
                              }
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Clear Data...</span>
                          </button>
                        </div>
                      </div>

                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Send "Do Not Track" Header</span>
                          <span className="setting-sub-label">Include DNT request header with all outgoing web requests</span>
                        </div>
                        <div className="setting-action-col">
                          <label className="settings-toggle-switch">
                            <input
                              type="checkbox"
                              checked={currentSettings.doNotTrack !== false}
                              onChange={(e) => updateField({ doNotTrack: e.target.checked })}
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. TERMINAL SETTINGS */}
                {activeCategory === 'terminal' && (
                  <div className="settings-category-pane">
                    <div className="category-pane-header">
                      <h2 className="category-pane-title">Terminal Settings</h2>
                      <p className="category-pane-sub">Configure default host shell and terminal appearance.</p>
                    </div>

                    <div className="settings-group-card">
                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Default Shell Binary</span>
                          <span className="setting-sub-label">Command shell spawned when opening terminal mode</span>
                        </div>
                        <div className="setting-action-col">
                          <select
                            className="settings-select-input"
                            value={currentSettings.defaultShell || 'powershell'}
                            onChange={(e) => updateField({ defaultShell: e.target.value as any })}
                          >
                            <option value="powershell">Windows PowerShell (Default)</option>
                            <option value="cmd">Windows Command Prompt (cmd.exe)</option>
                            <option value="bash">GNU Bash (Git Bash / Linux)</option>
                          </select>
                        </div>
                      </div>

                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Terminal Working Directory</span>
                          <span className="setting-sub-label font-mono text-xs">{currentSettings.terminalDefaultWorkingDir || 'Default User Home (~)'}</span>
                        </div>
                        <div className="setting-action-col">
                          <button className="settings-action-btn" onClick={handleSelectTerminalWorkingDir}>
                            <Folder size={13} />
                            <span>Browse...</span>
                          </button>
                        </div>
                      </div>

                      <div className="setting-control-row">
                        <div className="setting-label-col">
                          <span className="setting-main-label">Cursor Style</span>
                          <span className="setting-sub-label">Shape of the prompt cursor in the terminal</span>
                        </div>
                        <div className="setting-action-col">
                          <select
                            className="settings-select-input"
                            value={currentSettings.terminalCursorStyle || 'bar'}
                            onChange={(e) => updateField({ terminalCursorStyle: e.target.value as any })}
                          >
                            <option value="bar">Bar (Vertical Line)</option>
                            <option value="block">Block (Solid Square)</option>
                            <option value="underline">Underline</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. KEYBOARD SHORTCUTS */}
                {activeCategory === 'shortcuts' && (
                  <div className="settings-category-pane">
                    <div className="category-pane-header">
                      <h2 className="category-pane-title">Keyboard Shortcuts</h2>
                      <p className="category-pane-sub">Keyboard shortcuts for fast navigation and mode switching.</p>
                    </div>

                    <div className="settings-group-card">
                      <div className="shortcuts-reference-grid">
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">New Browser Tab</span>
                          <kbd className="shortcut-kbd">Ctrl + T</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Close Active Tab</span>
                          <kbd className="shortcut-kbd">Ctrl + W</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Reopen Closed Tab</span>
                          <kbd className="shortcut-kbd">Ctrl + Shift + T</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Toggle Terminal / GUI Mode</span>
                          <kbd className="shortcut-kbd">Ctrl + `</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Focus Address Bar</span>
                          <kbd className="shortcut-kbd">Ctrl + L</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Reload Page</span>
                          <kbd className="shortcut-kbd">Ctrl + R</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Find in Page</span>
                          <kbd className="shortcut-kbd">Ctrl + F</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Reader Mode</span>
                          <kbd className="shortcut-kbd">Ctrl + Shift + R</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Fast Tab Search</span>
                          <kbd className="shortcut-kbd">Ctrl + Shift + A</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Browsing History</span>
                          <kbd className="shortcut-kbd">Ctrl + H</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Bookmarks Manager</span>
                          <kbd className="shortcut-kbd">Ctrl + B</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Downloads Activity</span>
                          <kbd className="shortcut-kbd">Ctrl + J</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Toggle Fullscreen</span>
                          <kbd className="shortcut-kbd">F11</kbd>
                        </div>
                        <div className="shortcut-ref-row">
                          <span className="shortcut-desc">Developer Tools</span>
                          <kbd className="shortcut-kbd">F12</kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. ABOUT DUALSURF */}
                {activeCategory === 'about' && (
                  <div className="settings-category-pane">
                    <div className="category-pane-header">
                      <h2 className="category-pane-title">About DualSurf</h2>
                      <p className="category-pane-sub">Simple dual-mode browser offering GUI and CLI control.</p>
                    </div>

                    <div className="settings-group-card">
                      <div className="about-branding-row">
                        <div className="about-brand-text">
                          <h3 className="about-brand-title">DualSurf Browser</h3>
                          <span className="about-version-badge">Version 0.1.0</span>
                        </div>
                      </div>

                      <p className="about-description-text" style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                        DualSurf is a streamlined dual-mode browser that seamlessly unites a modern graphical tabbed browser
                        with an interactive command-line interface and terminal emulator.
                      </p>

                      <div className="about-runtime-specs">
                        <div className="spec-item">
                          <span className="spec-key">Electron:</span>
                          <span className="spec-val">{diagnostics?.electronVersion || '34.5.8'}</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-key">Chromium:</span>
                          <span className="spec-val">{diagnostics?.chromeVersion || '134.0'}</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-key">Node.js:</span>
                          <span className="spec-val">{diagnostics?.nodeVersion || '20.x'}</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-key">Platform:</span>
                          <span className="spec-val">{diagnostics?.platform || process.platform} ({diagnostics?.arch || process.arch})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="settings-footer-bar">
          <div className="footer-left-status">
            {saveSuccess && (
              <span className="save-success-indicator">
                <CheckCircle2 size={14} />
                <span>Settings saved successfully!</span>
              </span>
            )}
            {hasChanges && !saveSuccess && (
              <span className="unsaved-changes-pill">
                <span>Unsaved changes</span>
              </span>
            )}
          </div>

          <div className="footer-right-buttons">
            <button
              className="settings-footer-btn btn-secondary"
              onClick={handleDiscard}
              disabled={!hasChanges || isSaving}
            >
              Discard Changes
            </button>
            <button
              className="settings-footer-btn btn-primary"
              onClick={handleSaveAndApply}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? <Check size={14} className="spin" /> : <Check size={14} />}
              <span>Save &amp; Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
