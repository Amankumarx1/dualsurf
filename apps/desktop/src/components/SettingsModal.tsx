import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Sliders,
  Palette,
  Globe,
  Shield,
  Terminal,
  Wrench,
  Crosshair,
  ShieldCheck,
  Network,
  HardDrive,
  Keyboard,
  Cpu,
  Info,
  Search,
  Check,
  RotateCcw,
  Folder,
  Bot,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Lock,
  Activity,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type {
  BrowserSettings,
  SearchEngine,
  ProxyConfig,
  PlatformDiagnostics,
} from '@dualsurf/shared-types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOllamaSetup?: () => void;
  onOpenClearData?: () => void;
}

type SettingsCategory =
  | 'general'
  | 'appearance'
  | 'browser'
  | 'privacy'
  | 'terminal'
  | 'tools'
  | 'redTeam'
  | 'bluePurple'
  | 'network'
  | 'storage'
  | 'shortcuts'
  | 'advanced'
  | 'about';

interface CategoryItem {
  id: SettingsCategory;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  description: string;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'general', label: 'General', icon: Sliders, description: 'Startup behavior, home page, and search provider' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Themes, density, and typography' },
  { id: 'browser', label: 'Browser', icon: Globe, description: 'Tabs, downloads location, and page zoom' },
  { id: 'privacy', label: 'Privacy & Security', icon: Shield, description: 'CyberShield, anti-fingerprinting, and cookies' },
  { id: 'terminal', label: 'Terminal & Runtimes', icon: Terminal, description: 'Shell execution, terminal palette, and runtimes' },
  { id: 'tools', label: 'Tools & Integrations', icon: Wrench, description: 'Security binaries and Ollama AI assistant' },
  { id: 'redTeam', label: 'Red Team', icon: Crosshair, description: 'Scope enforcement, assessment boundaries, and hashing' },
  { id: 'bluePurple', label: 'Blue & Purple Team', icon: ShieldCheck, description: 'Telemetry ingestion and adversary simulation' },
  { id: 'network', label: 'Network & Proxy', icon: Network, description: 'Proxy routing, Tor/Burp tunnels, and Repeater' },
  { id: 'storage', label: 'Storage', icon: HardDrive, description: 'Local SQLite database, cache, and session data' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, description: 'Complete keybindings and navigation hotkeys' },
  { id: 'advanced', label: 'Advanced', icon: Cpu, description: 'Diagnostics, process isolation, and factory reset' },
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
    description: 'Choose whether to restore previous browser tabs and active session, open the home page, or start with blank tab.',
    keywords: ['startup', 'restore', 'session', 'launch', 'tabs', 'boot'],
  },
  {
    id: 'theme',
    category: 'appearance',
    categoryLabel: 'Appearance',
    title: 'Interface Theme Mode',
    description: 'Select dark cybersecurity mode, high-contrast light mode, or synchronize with the host OS theme.',
    keywords: ['theme', 'dark', 'light', 'mode', 'color', 'appearance', 'system'],
  },
  {
    id: 'uiDensity',
    category: 'appearance',
    categoryLabel: 'Appearance',
    title: 'UI Density & Spacing',
    description: 'Adjust padding and heights of tab bars, toolbars, and context menus (Compact, Default, Comfortable).',
    keywords: ['density', 'compact', 'padding', 'spacing', 'size', 'height', 'appearance'],
  },
  {
    id: 'uiFontFamily',
    category: 'appearance',
    categoryLabel: 'Appearance',
    title: 'Global UI Typeface',
    description: 'Choose typeface for browser chrome and UI surfaces (JetBrains Mono, Inter, Fira Code, Segoe UI).',
    keywords: ['font', 'typography', 'typeface', 'monospace', 'jetbrains', 'inter'],
  },
  {
    id: 'sidebarPreferences',
    category: 'appearance',
    categoryLabel: 'Appearance',
    title: 'Navigation Sidebar Collapse',
    description: 'Allow navigation sidebar to collapse into an icon strip for maximum screen real estate.',
    keywords: ['sidebar', 'collapse', 'width', 'drawer', 'navigation'],
  },
  {
    id: 'pageZoom',
    category: 'browser',
    categoryLabel: 'Browser',
    title: 'Default Page Zoom',
    description: 'Set standard zoom percentage applied to all opened web tabs (80%, 100%, 125%, 150%).',
    keywords: ['zoom', 'scale', 'magnify', 'percent', 'browser', 'size'],
  },
  {
    id: 'tabCloseBehavior',
    category: 'browser',
    categoryLabel: 'Browser',
    title: 'Tab Closing Behavior',
    description: 'Keep the last remaining tab open with the Home dashboard or close the browser window.',
    keywords: ['tabs', 'close', 'behavior', 'last tab', 'window'],
  },
  {
    id: 'downloadDir',
    category: 'browser',
    categoryLabel: 'Browser',
    title: 'Default Downloads Directory',
    description: 'Designate the host filesystem folder where downloaded files and artifacts are stored.',
    keywords: ['download', 'downloads', 'directory', 'folder', 'path', 'save'],
  },
  {
    id: 'promptDownload',
    category: 'browser',
    categoryLabel: 'Browser',
    title: 'Prompt Before Downloading',
    description: 'Always prompt with a file picker dialog before initiating a file download.',
    keywords: ['download', 'prompt', 'ask', 'file picker', 'confirm'],
  },
  {
    id: 'pdfViewer',
    category: 'browser',
    categoryLabel: 'Browser',
    title: 'Built-in PDF Viewer',
    description: 'Automatically display PDF documents in DualSurf rather than saving to disk immediately.',
    keywords: ['pdf', 'document', 'viewer', 'preview', 'download'],
  },
  {
    id: 'cyberShield',
    category: 'privacy',
    categoryLabel: 'Privacy & Security',
    title: 'CyberShield Protection Engine',
    description: 'Active network layer blocking for malware, phishing domains, and tracking telemetry.',
    keywords: ['shield', 'cybershield', 'adblock', 'malware', 'phishing', 'tracker', 'privacy', 'security'],
  },
  {
    id: 'antiFingerprint',
    category: 'privacy',
    categoryLabel: 'Privacy & Security',
    title: 'Anti-Fingerprinting Protections',
    description: 'Randomize HTML5 Canvas, AudioContext, WebGL signatures, and spoof device parameters.',
    keywords: ['fingerprint', 'anti-fingerprinting', 'canvas', 'webgl', 'audiocontext', 'tracking', 'privacy'],
  },
  {
    id: 'cookiePolicy',
    category: 'privacy',
    categoryLabel: 'Privacy & Security',
    title: 'Cookie & Site Data Policy',
    description: 'Restrict third-party cookies, partition cross-site state, and enforce strict isolation.',
    keywords: ['cookie', 'cookies', 'third-party', 'storage', 'data', 'privacy'],
  },
  {
    id: 'clearBrowsingData',
    category: 'privacy',
    categoryLabel: 'Privacy & Security',
    title: 'Clear Browsing Data',
    description: 'Erase cached web content, active session cookies, and navigation history.',
    keywords: ['clear', 'cache', 'history', 'cookies', 'delete', 'clean', 'purge'],
  },
  {
    id: 'defaultShell',
    category: 'terminal',
    categoryLabel: 'Terminal & Runtimes',
    title: 'Default Shell Binary',
    description: 'Primary command shell used when opening new PTY terminal sessions (PowerShell, CMD, Bash, Zsh).',
    keywords: ['shell', 'powershell', 'cmd', 'bash', 'zsh', 'terminal', 'pty'],
  },
  {
    id: 'termPalette',
    category: 'terminal',
    categoryLabel: 'Terminal & Runtimes',
    title: 'Terminal Color Scheme',
    description: 'Select color theme for PTY output (Cyberpunk, Matrix Green, Monokai, Dracula, Nord).',
    keywords: ['terminal', 'color', 'palette', 'theme', 'cyberpunk', 'matrix', 'dracula'],
  },
  {
    id: 'termCursor',
    category: 'terminal',
    categoryLabel: 'Terminal & Runtimes',
    title: 'Terminal Cursor Style',
    description: 'Configure terminal prompt cursor shape (Block, Underline, or Bar).',
    keywords: ['cursor', 'terminal', 'block', 'underline', 'bar', 'prompt'],
  },
  {
    id: 'detectedTools',
    category: 'tools',
    categoryLabel: 'Tools & Integrations',
    title: 'External CLI Security Tools',
    description: 'Audit detected pentesting tools on host PATH: Nmap, Masscan, SQLMap, FFUF, Nikto, Nuclei.',
    keywords: ['tools', 'nmap', 'masscan', 'sqlmap', 'ffuf', 'nikto', 'nuclei', 'cli', 'pentest'],
  },
  {
    id: 'ollamaIntegration',
    category: 'tools',
    categoryLabel: 'Tools & Integrations',
    title: 'Local Ollama AI Assistant',
    description: 'Configure connection to local Ollama inference server (default: http://127.0.0.1:11434).',
    keywords: ['ollama', 'ai', 'copilot', 'llm', 'model', 'local', 'inference', 'host'],
  },
  {
    id: 'targetScope',
    category: 'redTeam',
    categoryLabel: 'Red Team',
    title: 'Assessment Authorization Scope',
    description: 'Enforce authorized assessment boundaries via CIDR, domain, and wildcard match rules.',
    keywords: ['scope', 'red team', 'assessment', 'authorized', 'cidr', 'target', 'rules'],
  },
  {
    id: 'scopeGuard',
    category: 'redTeam',
    categoryLabel: 'Red Team',
    title: 'Out-of-Scope Navigation Warning',
    description: 'Display immediate security alert modal if web navigation leaves authorized scope.',
    keywords: ['scope', 'guard', 'warning', 'alert', 'out of scope', 'navigation'],
  },
  {
    id: 'evidenceHashing',
    category: 'redTeam',
    categoryLabel: 'Red Team',
    title: 'Evidence Auto-Hashing (SHA-256)',
    description: 'Generate cryptographic SHA-256 hashes for all captured packets, screenshots, and logs.',
    keywords: ['evidence', 'hash', 'sha256', 'integrity', 'chain of custody', 'crypto'],
  },
  {
    id: 'threatIntel',
    category: 'bluePurple',
    categoryLabel: 'Blue & Purple Team',
    title: 'Real-time Threat Intelligence Feed',
    description: 'Ingest and correlate live IOC, CVE, and threat feed indicators against active traffic.',
    keywords: ['threat', 'intel', 'ioc', 'cve', 'feed', 'blue team', 'telemetry'],
  },
  {
    id: 'sigmaEngine',
    category: 'bluePurple',
    categoryLabel: 'Blue & Purple Team',
    title: 'Sigma Detection Rule Engine',
    description: 'Transpile Sigma detection signatures directly into Splunk, QRadar, and Sentinel queries.',
    keywords: ['sigma', 'rules', 'detection', 'splunk', 'qradar', 'sentinel', 'transpile', 'siem'],
  },
  {
    id: 'proxyConfig',
    category: 'network',
    categoryLabel: 'Network & Proxy',
    title: 'Global HTTP / SOCKS5 Proxy',
    description: 'Route all browser and tool traffic through upstream proxy, Tor onion router, or Burp Suite.',
    keywords: ['proxy', 'socks5', 'http', 'tor', 'burp', 'upstream', 'network', 'port', 'host'],
  },
  {
    id: 'repeaterMode',
    category: 'network',
    categoryLabel: 'Network & Proxy',
    title: 'HTTP Request Repeater Intercept',
    description: 'Inspect, modify, and replay raw HTTP packets with live response diffing.',
    keywords: ['repeater', 'http', 'request', 'intercept', 'packets', 'replay', 'tamper'],
  },
  {
    id: 'databaseStorage',
    category: 'storage',
    categoryLabel: 'Storage',
    title: 'DualSurf Local Database',
    description: 'SQLite relational database storing sessions, history, bookmarks, and security artifacts.',
    keywords: ['database', 'sqlite', 'storage', 'data', 'disk', 'db'],
  },
  {
    id: 'storageDiagnostics',
    category: 'storage',
    categoryLabel: 'Storage',
    title: 'Disk Space & Storage Metrics',
    description: 'Host filesystem capacity and allocation for DualSurf runtime artifacts.',
    keywords: ['disk', 'storage', 'free', 'space', 'capacity', 'metrics'],
  },
  {
    id: 'keyboardShortcuts',
    category: 'shortcuts',
    categoryLabel: 'Keyboard Shortcuts',
    title: 'Global Keyboard Shortcuts',
    description: 'View and audit all browser navigation, tool launching, and window management hotkeys.',
    keywords: ['shortcuts', 'hotkeys', 'keyboard', 'ctrl', 'keybindings'],
  },
  {
    id: 'diagnosticsEnv',
    category: 'advanced',
    categoryLabel: 'Advanced',
    title: 'Platform Diagnostics & Environment',
    description: 'Architecture, Node runtime, Chromium engine, and OS kernel diagnostics.',
    keywords: ['diagnostics', 'platform', 'arch', 'node', 'chromium', 'electron', 'advanced'],
  },
  {
    id: 'processIsolation',
    category: 'advanced',
    categoryLabel: 'Advanced',
    title: 'WebContentsView Process Isolation',
    description: 'Sandboxed browser tabs separated from Node.js privileged runtime contexts.',
    keywords: ['sandbox', 'isolation', 'security', 'process', 'webcontentsview'],
  },
  {
    id: 'resetDefaults',
    category: 'advanced',
    categoryLabel: 'Advanced',
    title: 'Factory Reset DualSurf Settings',
    description: 'Reset all configuration toggles and preferences back to default security baseline.',
    keywords: ['reset', 'factory', 'defaults', 'restore', 'wipe'],
  },
  {
    id: 'aboutDualSurf',
    category: 'about',
    categoryLabel: 'About DualSurf',
    title: 'About DualSurf Browser',
    description: 'Dual-mode browser engineered for cybersecurity professionals, SOC analysts, and engineers.',
    keywords: ['about', 'version', 'license', 'architecture', 'dualsurf', 'release'],
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenOllamaSetup,
  onOpenClearData,
}) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const [searchFilter, setSearchFilter] = useState('');
  const [initialSettings, setInitialSettings] = useState<BrowserSettings | null>(null);
  const [currentSettings, setCurrentSettings] = useState<BrowserSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [diagnostics, setDiagnostics] = useState<PlatformDiagnostics | null>(null);
  const [detectedTools, setDetectedTools] = useState<any[]>([]);
  const [checkingTools, setCheckingTools] = useState(false);
  const [ollamaCheckStatus, setOllamaCheckStatus] = useState<{ checked: boolean; available?: boolean; latencyMs?: number; error?: string } | null>(null);
  const [storageStats, setStorageStats] = useState<{ freeFormatted?: string; totalFormatted?: string } | null>(null);

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

      // Load platform diagnostics
      if (window.dualsurf.getPlatformDiagnostics) {
        window.dualsurf.getPlatformDiagnostics().then(setDiagnostics).catch(() => {});
      }

      // Load storage info
      if (window.dualsurf.getStorageInfo) {
        window.dualsurf.getStorageInfo().then((res) => {
          if (res?.success) {
            setStorageStats({ freeFormatted: res.freeFormatted });
          }
        }).catch(() => {});
      }

      // Load installed tools
      if (window.dualsurf.checkTools) {
        setCheckingTools(true);
        window.dualsurf.checkTools().then((tools) => {
          setDetectedTools(tools);
        }).catch(() => {}).finally(() => setCheckingTools(false));
      }
    }
  }, [isOpen]);

  const isDirty = useMemo(() => {
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

  const handleResetToDefaults = () => {
    setIsConfirmingReset(true);
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

  const handleTestOllama = async () => {
    if (!window.dualsurf?.checkOllama) return;
    setOllamaCheckStatus(null);
    try {
      const host = currentSettings.ollama?.host || 'http://127.0.0.1:11434';
      const res = await window.dualsurf.checkOllama(host);
      setOllamaCheckStatus({
        checked: true,
        available: res.available,
        latencyMs: res.latencyMs,
        error: res.error,
      });
    } catch (err: any) {
      setOllamaCheckStatus({
        checked: true,
        available: false,
        error: err.message,
      });
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
            <span className="settings-header-desc">Workstation Configuration &amp; Security Controls</span>
          </div>

          <div className="settings-header-center">
            <div className="settings-search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search settings (e.g. search engine, proxy, terminal, shield)..."
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

        {/* Modal Main Area: Left Category Navigation + Right Settings Content */}
        <div className="settings-main-split">
          {/* Left Category Navigation Panel */}
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
                  onClick={handleResetToDefaults}
                  title="Restore default configuration"
                >
                  <RotateCcw size={13} />
                  <span>Reset All Defaults</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Content Panel */}
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
                      Try searching for keywords like "proxy", "search engine", "shield", "terminal", or "zoom".
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
                {/* 1. GENERAL SETTINGS */}
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
                      <span className="setting-sub-label">Web page or internal portal loaded when opening the home button</span>
                    </div>
                    <div className="setting-action-col">
                      <input
                        type="text"
                        className="settings-text-input"
                        value={currentSettings.homeUrl || 'dualsurf://newtab'}
                        onChange={(e) => updateField({ homeUrl: e.target.value })}
                        placeholder="dualsurf://newtab or https://..."
                      />
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Restore Previous Session on Startup</span>
                      <span className="setting-sub-label">Automatically re-open previously open tabs, active windows, and browsing state</span>
                    </div>
                    <div className="setting-action-col">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={currentSettings.restoreSessionOnStartup}
                          onChange={(e) => updateField({ restoreSessionOnStartup: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. APPEARANCE SETTINGS */}
            {activeCategory === 'appearance' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Appearance &amp; Styling</h2>
                  <p className="category-pane-sub">Customize the desktop visual identity, density, and terminal theme.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Desktop Theme Mode</span>
                      <span className="setting-sub-label">DualSurf dark-mode aesthetic or high-contrast theme</span>
                    </div>
                    <div className="setting-action-col">
                      <select
                        className="settings-select-input"
                        value={currentSettings.themeMode || 'dark'}
                        onChange={(e) => updateField({ themeMode: e.target.value as any })}
                      >
                        <option value="dark">Dark Theme (Standard Cyber Black)</option>
                        <option value="light">Light Theme (Paper White)</option>
                        <option value="system">System Default</option>
                      </select>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">UI Layout Density</span>
                      <span className="setting-sub-label">Controls padding and spacing across navigation bars and tabs</span>
                    </div>
                    <div className="setting-action-col">
                      <select
                        className="settings-select-input"
                        value={currentSettings.uiDensity || 'comfortable'}
                        onChange={(e) => updateField({ uiDensity: e.target.value as any })}
                      >
                        <option value="comfortable">Comfortable (Standard)</option>
                        <option value="compact">Compact (High Information Density)</option>
                      </select>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Terminal Workspace Palette</span>
                      <span className="setting-sub-label">Color scheme for the Mode B integrated terminal</span>
                    </div>
                    <div className="setting-action-col">
                      <select
                        className="settings-select-input"
                        value={currentSettings.terminalTheme}
                        onChange={(e) => updateField({ terminalTheme: e.target.value as any })}
                      >
                        <option value="dracula">Dracula (Violet / Dark)</option>
                        <option value="nord">Nord (Arctic Cyan)</option>
                        <option value="gruvbox">Gruvbox (Warm Retro)</option>
                        <option value="matrix">Matrix (Phosphor Green)</option>
                      </select>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Terminal Font Size</span>
                      <span className="setting-sub-label">Base font size for command execution and PTY output</span>
                    </div>
                    <div className="setting-action-col">
                      <input
                        type="number"
                        min={11}
                        max={24}
                        className="settings-number-input"
                        value={currentSettings.terminalFontSize || 14}
                        onChange={(e) => updateField({ terminalFontSize: parseInt(e.target.value, 10) || 14 })}
                      />
                      <span className="input-unit">px</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. BROWSER SETTINGS */}
            {activeCategory === 'browser' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Browser Controls</h2>
                  <p className="category-pane-sub">Manage tabs layout, downloads directory, and default zoom.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Default Downloads Location</span>
                      <span className="setting-sub-label">Directory where files and exported forensic artifacts are saved</span>
                    </div>
                    <div className="setting-action-col">
                      <div className="path-display-strip">
                        <Folder size={14} className="path-icon" />
                        <span className="path-text">{currentSettings.defaultDownloadDir}</span>
                        <button className="browse-folder-btn" onClick={handleSelectDownloadFolder}>
                          Browse...
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Tab Strip Layout</span>
                      <span className="setting-sub-label">Horizontal top tab bar or vertical sidebar tabs</span>
                    </div>
                    <div className="setting-action-col">
                      <select
                        className="settings-select-input"
                        value={currentSettings.tabLayout || 'horizontal'}
                        onChange={(e) => updateField({ tabLayout: e.target.value as any })}
                      >
                        <option value="horizontal">Horizontal Top Tab Bar</option>
                        <option value="vertical">Vertical Tab Strip</option>
                      </select>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Auto-Hibernate Idle Background Tabs</span>
                      <span className="setting-sub-label">Automatically discard background tabs idle for &gt;30m to free host memory</span>
                    </div>
                    <div className="setting-action-col">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={currentSettings.autoHibernateTabs || false}
                          onChange={(e) => updateField({ autoHibernateTabs: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Default Page Zoom</span>
                      <span className="setting-sub-label">Initial zoom factor applied to new web contents views</span>
                    </div>
                    <div className="setting-action-col">
                      <select
                        className="settings-select-input"
                        value={currentSettings.defaultZoom || 100}
                        onChange={(e) => updateField({ defaultZoom: parseInt(e.target.value, 10) || 100 })}
                      >
                        <option value={75}>75%</option>
                        <option value={90}>90%</option>
                        <option value={100}>100% (Default)</option>
                        <option value={110}>110%</option>
                        <option value={125}>125%</option>
                        <option value={150}>150%</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. PRIVACY & SECURITY SETTINGS */}
            {activeCategory === 'privacy' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Privacy &amp; Defensive Shields</h2>
                  <p className="category-pane-sub">Enforce tracker blocking, anti-fingerprinting, and process sandbox isolation.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">CyberShield Tracker &amp; Ad Blocker</span>
                      <span className="setting-sub-label">Network-level blocking of tracking scripts, telemetry pixels, and known malicious hosts</span>
                    </div>
                    <div className="setting-action-col">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={currentSettings.cyberShieldEnabled !== false}
                          onChange={(e) => updateField({ cyberShieldEnabled: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Anti-Fingerprint Protection</span>
                      <span className="setting-sub-label">Injects slight canvas noise and spoofed audio latency to disrupt device fingerprinting</span>
                    </div>
                    <div className="setting-action-col">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={currentSettings.antiFingerprintEnabled || false}
                          onChange={(e) => updateField({ antiFingerprintEnabled: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Block Third-Party Cookies</span>
                      <span className="setting-sub-label">Restricts cross-site tracking cookies across foreign embedded frames</span>
                    </div>
                    <div className="setting-action-col">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={currentSettings.blockThirdPartyCookies !== false}
                          onChange={(e) => updateField({ blockThirdPartyCookies: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Send "Do Not Track" Header</span>
                      <span className="setting-sub-label">Transmits DNT: 1 header with every outgoing HTTP request</span>
                    </div>
                    <div className="setting-action-col">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={currentSettings.doNotTrack !== false}
                          onChange={(e) => updateField({ doNotTrack: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Clear Browsing Data &amp; Cache</span>
                      <span className="setting-sub-label">Purge cached pages, cookies, storage, and history records</span>
                    </div>
                    <div className="setting-action-col">
                      <button
                        className="settings-action-btn danger-outline"
                        onClick={() => {
                          onClose();
                          onOpenClearData?.();
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Clear Data...</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-security-card">
                  <Shield size={18} color="var(--ds-accent)" className="card-icon" />
                  <div className="card-content">
                    <strong>Process Sandbox Isolation Active</strong>
                    <p>
                      All remote web contents are strictly partitioned into Chromium WebContentsView sandboxes with
                      nodeIntegration disabled, contextIsolation enabled, and safe navigation scheme guards preventing
                      file:// or javascript: pivots to local host resources.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. TERMINAL & RUNTIMES */}
            {activeCategory === 'terminal' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Terminal &amp; Linux Runtimes</h2>
                  <p className="category-pane-sub">Configure default shells, scrollback buffer, and WSL 2 bridging.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Default Execution Shell</span>
                      <span className="setting-sub-label">Shell backend spawned when opening new terminal sessions</span>
                    </div>
                    <div className="setting-action-col">
                      <select
                        className="settings-select-input"
                        value={currentSettings.defaultShell || 'default'}
                        onChange={(e) => updateField({ defaultShell: e.target.value as any })}
                      >
                        <option value="default">System Default (PowerShell on Windows, Bash on Linux)</option>
                        <option value="powershell">PowerShell</option>
                        <option value="cmd">Command Prompt (cmd.exe)</option>
                        <option value="wsl">WSL 2 Linux Bridge (wsl.exe)</option>
                        <option value="bash">POSIX Bash</option>
                      </select>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Scrollback History Buffer</span>
                      <span className="setting-sub-label">Maximum number of lines preserved in the terminal emulator buffer</span>
                    </div>
                    <div className="setting-action-col">
                      <select
                        className="settings-select-input"
                        value={currentSettings.terminalScrollback || 5000}
                        onChange={(e) => updateField({ terminalScrollback: parseInt(e.target.value, 10) || 5000 })}
                      >
                        <option value={1000}>1,000 lines</option>
                        <option value={5000}>5,000 lines (Standard)</option>
                        <option value={10000}>10,000 lines</option>
                        <option value={50000}>50,000 lines (Forensic Deep)</option>
                      </select>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Terminal Monospace Font</span>
                      <span className="setting-sub-label">Typography used for code blocks and PTY rendering</span>
                    </div>
                    <div className="setting-action-col">
                      <input
                        type="text"
                        className="settings-text-input"
                        value={currentSettings.terminalFontFamily || "'JetBrains Mono', 'Fira Code', monospace"}
                        onChange={(e) => updateField({ terminalFontFamily: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Default Working Directory</span>
                      <span className="setting-sub-label">Directory where new terminal sessions start (defaults to user home)</span>
                    </div>
                    <div className="setting-action-col folder-input-action">
                      <input
                        type="text"
                        className="settings-text-input folder-path-display"
                        readOnly
                        placeholder="Runtime Default (~ / $HOME / %USERPROFILE%)"
                        value={currentSettings.terminalDefaultWorkingDir || ''}
                      />
                      <button className="browse-folder-btn" onClick={handleSelectTerminalWorkingDir}>
                        Browse...
                      </button>
                      {currentSettings.terminalDefaultWorkingDir && (
                        <button
                          className="browse-folder-btn"
                          style={{ background: '#21262d', color: '#ff7b72' }}
                          onClick={() => updateField({ terminalDefaultWorkingDir: '' })}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Show Welcome Header</span>
                      <span className="setting-sub-label">Display genuine DualSurf production terminal title and runtime details on startup</span>
                    </div>
                    <div className="setting-action-col">
                      <input
                        type="checkbox"
                        className="settings-toggle"
                        checked={currentSettings.terminalShowWelcome !== false}
                        onChange={(e) => updateField({ terminalShowWelcome: e.target.checked })}
                      />
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Restore Terminal Sessions</span>
                      <span className="setting-sub-label">Automatically reconnect to previous active terminal sessions on launch</span>
                    </div>
                    <div className="setting-action-col">
                      <input
                        type="checkbox"
                        className="settings-toggle"
                        checked={Boolean(currentSettings.terminalRestoreSessions)}
                        onChange={(e) => updateField({ terminalRestoreSessions: e.target.checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. TOOLS & INTEGRATIONS */}
            {activeCategory === 'tools' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Tools &amp; AI Integrations</h2>
                  <p className="category-pane-sub">Verify host cybersecurity binaries and configure the Ollama AI assistant.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Ollama AI Assistant Engine</span>
                      <span className="setting-sub-label">Enable local AI copilot for automated page summaries and security triage</span>
                    </div>
                    <div className="setting-action-col">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={currentSettings.ollama?.enabled || false}
                          onChange={(e) =>
                            updateField({
                              ollama: {
                                ...(currentSettings.ollama || { host: 'http://127.0.0.1:11434', model: 'llama3.2', onboardingCompleted: false }),
                                enabled: e.target.checked,
                              },
                            })
                          }
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Ollama Server Host URL</span>
                      <span className="setting-sub-label">HTTP endpoint for local or network Ollama daemon</span>
                    </div>
                    <div className="setting-action-col">
                      <input
                        type="text"
                        className="settings-text-input"
                        value={currentSettings.ollama?.host || 'http://127.0.0.1:11434'}
                        onChange={(e) =>
                          updateField({
                            ollama: {
                              ...(currentSettings.ollama || { enabled: false, model: 'llama3.2', onboardingCompleted: false }),
                              host: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Active AI Model</span>
                      <span className="setting-sub-label">Local model tag for inference (e.g. llama3.2, mistral, codellama)</span>
                    </div>
                    <div className="setting-action-col">
                      <input
                        type="text"
                        className="settings-text-input"
                        value={currentSettings.ollama?.model || 'llama3.2'}
                        onChange={(e) =>
                          updateField({
                            ollama: {
                              ...(currentSettings.ollama || { enabled: false, host: 'http://127.0.0.1:11434', onboardingCompleted: false }),
                              model: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Test Ollama Connectivity</span>
                      <span className="setting-sub-label">Check connection and measure local inference latency</span>
                    </div>
                    <div className="setting-action-col">
                      <div className="inline-action-group">
                        <button className="settings-action-btn" onClick={handleTestOllama}>
                          <Bot size={13} />
                          <span>Test Endpoint</span>
                        </button>

                        {onOpenOllamaSetup && (
                          <button
                            className="settings-action-btn secondary"
                            onClick={() => {
                              onClose();
                              onOpenOllamaSetup();
                            }}
                          >
                            <ExternalLink size={13} />
                            <span>Setup Wizard</span>
                          </button>
                        )}
                      </div>

                      {ollamaCheckStatus && (
                        <div className={`status-callout ${ollamaCheckStatus.available ? 'success' : 'warning'}`}>
                          {ollamaCheckStatus.available ? (
                            <>
                              <CheckCircle2 size={13} />
                              <span>Connected ({ollamaCheckStatus.latencyMs}ms latency)</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={13} />
                              <span>Connection Failed: {ollamaCheckStatus.error}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="category-pane-header" style={{ marginTop: '20px' }}>
                  <h3 className="category-pane-subtitle">Detected Security Tool Integrations</h3>
                </div>

                <div className="detected-tools-pill-grid">
                  {checkingTools ? (
                    <div className="tools-loading">
                      <RefreshCw size={14} className="spin-icon" />
                      <span>Auditing installed host binaries...</span>
                    </div>
                  ) : detectedTools.length === 0 ? (
                    <div className="empty-tools-note">Click refresh to detect installed security tools.</div>
                  ) : (
                    detectedTools.map((t) => (
                      <div key={t.id} className={`tool-chip ${t.installed ? 'installed' : 'missing'}`}>
                        <div className="tool-chip-name">{t.name}</div>
                        <span className={`tool-chip-badge ${t.installed ? 'active' : 'inactive'}`}>
                          {t.installed ? 'INSTALLED' : 'NOT FOUND'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 7. RED TEAM */}
            {activeCategory === 'redTeam' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Red Team Operations</h2>
                  <p className="category-pane-sub">Enforce Rules of Engagement (RoE) scope validation and evidence provenance.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Strict RoE Scope Enforcement</span>
                      <span className="setting-sub-label">
                        Blocks outbound scanning, port probes, and exploits against targets not explicitly listed in active RoE scope
                      </span>
                    </div>
                    <div className="setting-action-col">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={currentSettings.scopeEnforcementStrict !== false}
                          onChange={(e) => updateField({ scopeEnforcementStrict: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Cryptographic Evidence Auto-Hashing</span>
                      <span className="setting-sub-label">Automatically computes SHA-256 integrity hash on all tool outputs and saves to evidence store</span>
                    </div>
                    <div className="setting-action-col">
                      <label className="settings-switch">
                        <input
                          type="checkbox"
                          checked={currentSettings.evidenceAutoHash !== false}
                          onChange={(e) => updateField({ evidenceAutoHash: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Evidence Locker Directory</span>
                      <span className="setting-sub-label">Local persistent directory where immutable JSON evidence records reside</span>
                    </div>
                    <div className="setting-action-col">
                      <div className="setting-path-badge">
                        <code>.dualsurf/evidence/</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 8. BLUE TEAM & PURPLE TEAM */}
            {activeCategory === 'bluePurple' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Defensive &amp; Emulation Settings</h2>
                  <p className="category-pane-sub">Configure host event logging, telemetry collection, and adversary simulation.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Connected Telemetry Streams</span>
                      <span className="setting-sub-label">Active local sources queried by the Blue Team EDR &amp; SIEM engine</span>
                    </div>
                    <div className="setting-action-col">
                      <div className="stream-badges-wrap">
                        <span className="stream-pill active">Win-System</span>
                        <span className="stream-pill active">Win-App</span>
                        <span className="stream-pill active">Win-PowerShell</span>
                        <span className="stream-pill active">Win-Security</span>
                        <span className="stream-pill active">Win-Process</span>
                        <span className="stream-pill muted">Sysmon (Unconfigured)</span>
                      </div>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Adversary Emulation Mode</span>
                      <span className="setting-sub-label">Verification outcome policy for simulated attacks</span>
                    </div>
                    <div className="setting-action-col">
                      <span className="setting-status-text text-mono">8-State Ground Truth Engine (Zero Fabrication)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 9. NETWORK & PROXY */}
            {activeCategory === 'network' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Network &amp; Proxy Configuration</h2>
                  <p className="category-pane-sub">Route browser traffic through local interception proxies or privacy networks.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Outbound Proxy Routing</span>
                      <span className="setting-sub-label">Select traffic routing mode for browser WebContentsViews</span>
                    </div>
                    <div className="setting-action-col">
                      <select
                        className="settings-select-input"
                        value={currentSettings.proxy?.mode || 'direct'}
                        onChange={(e) =>
                          updateField({
                            proxy: {
                              ...(currentSettings.proxy || {}),
                              mode: e.target.value as any,
                            },
                          })
                        }
                      >
                        <option value="direct">Direct (No Proxy)</option>
                        <option value="tor">Tor Onion Routing (SOCKS5 127.0.0.1:9050)</option>
                        <option value="burp">Burp Suite / OWASP ZAP (HTTP 127.0.0.1:8080)</option>
                        <option value="custom">Custom Proxy Server</option>
                      </select>
                    </div>
                  </div>

                  {currentSettings.proxy?.mode === 'custom' && (
                    <div className="setting-control-row">
                      <div className="setting-label-col">
                        <span className="setting-main-label">Custom Proxy Server Address</span>
                        <span className="setting-sub-label">Format: host:port (e.g. 192.168.1.50:8888)</span>
                      </div>
                      <div className="setting-action-col">
                        <input
                          type="text"
                          className="settings-text-input"
                          value={currentSettings.proxy?.server || ''}
                          onChange={(e) =>
                            updateField({
                              proxy: {
                                ...(currentSettings.proxy || { mode: 'custom' }),
                                server: e.target.value,
                              },
                            })
                          }
                          placeholder="127.0.0.1:8080"
                        />
                      </div>
                    </div>
                  )}

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Proxy Bypass Hosts</span>
                      <span className="setting-sub-label">Comma-separated list of hostnames excluded from proxying</span>
                    </div>
                    <div className="setting-action-col">
                      <input
                        type="text"
                        className="settings-text-input"
                        value={(currentSettings.proxy?.bypassList || ['localhost', '127.0.0.1']).join(', ')}
                        onChange={(e) =>
                          updateField({
                            proxy: {
                              ...(currentSettings.proxy || { mode: 'direct' }),
                              bypassList: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 10. STORAGE */}
            {activeCategory === 'storage' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Storage &amp; Databases</h2>
                  <p className="category-pane-sub">Inspect local SQLite database status and manage disk caches.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">SQLite Metadata Database</span>
                      <span className="setting-sub-label">Stores browsing history, bookmarks, and downloads metadata</span>
                    </div>
                    <div className="setting-action-col">
                      <div className="setting-path-badge">
                        <code>dualsurf.db (Active)</code>
                      </div>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Available Free Storage</span>
                      <span className="setting-sub-label">Drive space remaining for downloads and forensic captures</span>
                    </div>
                    <div className="setting-action-col">
                      <span className="setting-status-text">{storageStats?.freeFormatted || 'Audited via Host OS'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 11. KEYBOARD SHORTCUTS */}
            {activeCategory === 'shortcuts' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">Keyboard Shortcuts Reference</h2>
                  <p className="category-pane-sub">Quick reference for all navigation, workspace, and operational hotkeys.</p>
                </div>

                <div className="shortcuts-table-container">
                  <table className="shortcuts-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Shortcut</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>New Browser Tab</td>
                        <td><kbd>Ctrl+T</kbd></td>
                        <td>Browser</td>
                      </tr>
                      <tr>
                        <td>Close Active Tab</td>
                        <td><kbd>Ctrl+W</kbd></td>
                        <td>Browser</td>
                      </tr>
                      <tr>
                        <td>Reload Page</td>
                        <td><kbd>Ctrl+R</kbd></td>
                        <td>Navigation</td>
                      </tr>
                      <tr>
                        <td>Navigate Back</td>
                        <td><kbd>Alt+Left</kbd></td>
                        <td>Navigation</td>
                      </tr>
                      <tr>
                        <td>Navigate Forward</td>
                        <td><kbd>Alt+Right</kbd></td>
                        <td>Navigation</td>
                      </tr>
                      <tr>
                        <td>Focus Address Bar / Omnibox</td>
                        <td><kbd>Ctrl+L</kbd></td>
                        <td>Navigation</td>
                      </tr>
                      <tr>
                        <td>Command Palette</td>
                        <td><kbd>Ctrl+K</kbd></td>
                        <td>Tools</td>
                      </tr>
                      <tr>
                        <td>Search Open Tabs</td>
                        <td><kbd>Ctrl+Shift+A</kbd></td>
                        <td>Tabs</td>
                      </tr>
                      <tr>
                        <td>Toggle Terminal Mode</td>
                        <td><kbd>Ctrl+`</kbd></td>
                        <td>Workspace</td>
                      </tr>
                      <tr>
                        <td>Downloads Manager</td>
                        <td><kbd>Ctrl+J</kbd></td>
                        <td>Storage</td>
                      </tr>
                      <tr>
                        <td>Browsing History</td>
                        <td><kbd>Ctrl+H</kbd></td>
                        <td>Storage</td>
                      </tr>
                      <tr>
                        <td>Find in Page</td>
                        <td><kbd>Ctrl+F</kbd></td>
                        <td>Inspection</td>
                      </tr>
                      <tr>
                        <td>Reader Mode</td>
                        <td><kbd>Ctrl+Shift+R</kbd></td>
                        <td>Inspection</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 12. ADVANCED DIAGNOSTICS */}
            {activeCategory === 'advanced' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">System Diagnostics &amp; Runtimes</h2>
                  <p className="category-pane-sub">Deep host execution metrics and process sandbox integrity.</p>
                </div>

                <div className="settings-group-card">
                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Chromium Engine Version</span>
                      <span className="setting-sub-label">Underlying web rendering engine</span>
                    </div>
                    <div className="setting-action-col">
                      <span className="setting-status-text text-mono">{diagnostics?.chromeVersion || '132.0.6834.196'}</span>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Electron Framework Version</span>
                      <span className="setting-sub-label">Desktop application container</span>
                    </div>
                    <div className="setting-action-col">
                      <span className="setting-status-text text-mono">{diagnostics?.electronVersion || '34.4.1'}</span>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Node.js Runtime Version</span>
                      <span className="setting-sub-label">Privileged main process execution engine</span>
                    </div>
                    <div className="setting-action-col">
                      <span className="setting-status-text text-mono">{diagnostics?.nodeVersion || (typeof process !== 'undefined' ? process.version : 'v22.13.0')}</span>
                    </div>
                  </div>

                  <div className="setting-control-row">
                    <div className="setting-label-col">
                      <span className="setting-main-label">Main Process Memory RSS</span>
                      <span className="setting-sub-label">Resident set memory consumed by controller process</span>
                    </div>
                    <div className="setting-action-col">
                      <span className="setting-status-text text-mono">
                        {diagnostics?.memoryRssMb ? `${diagnostics.memoryRssMb} MB` : 'Optimal'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 13. ABOUT */}
            {activeCategory === 'about' && (
              <div className="settings-category-pane">
                <div className="category-pane-header">
                  <h2 className="category-pane-title">About DualSurf</h2>
                  <p className="category-pane-sub">The Dual-Mode Linux &amp; Cybersecurity Operations Browser.</p>
                </div>

                <div className="settings-about-card">
                  <div className="about-brand-row">
                    <div className="about-logo-pill">
                      <Globe size={24} />
                    </div>
                    <div>
                      <h3 className="about-app-name">DualSurf Browser</h3>
                      <span className="about-version-badge">v0.1.0-market.ready (October 2026)</span>
                    </div>
                  </div>

                  <p className="about-description">
                    DualSurf is a specialized dual-mode browser engineered for cybersecurity professionals, SOC analysts,
                    penetration testers, and systems engineers. It fuses a sandboxed Chromium web workstation with a native
                    PTY terminal emulator, live packet inspection, Sigma-to-SIEM query transpilation, and authentic host
                    telemetry collection.
                  </p>

                  <div className="about-links-row">
                    <span className="about-spec">OS: {diagnostics?.platform || (typeof process !== 'undefined' ? process.platform : 'win32')} ({diagnostics?.arch || (typeof process !== 'undefined' ? process.arch : 'x64')})</span>
                    <span className="about-spec">Sandbox: WebContentsView Isolation</span>
                    <span className="about-spec">License: Proprietary / Authorized Security Workstation</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>

        {/* Modal Bottom Action Strip */}
        <div className="settings-footer-strip">
          <div className="settings-footer-left">
            {saveSuccess && (
              <div className="save-toast-msg">
                <Check size={14} color="#10b981" />
                <span>Settings saved and applied successfully.</span>
              </div>
            )}
            {isDirty && !saveSuccess && (
              <span className="unsaved-badge">Unsaved changes pending</span>
            )}
          </div>

          <div className="settings-footer-right">
            <button
              className="settings-footer-btn cancel-btn"
              onClick={handleDiscard}
              disabled={!isDirty || isSaving}
            >
              Discard Changes
            </button>

            <button
              className="settings-footer-btn save-btn"
              onClick={handleSaveAndApply}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={13} className="spin-icon" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Check size={13} />
                  <span>Save &amp; Apply</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
