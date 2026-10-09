import React, { useEffect, useState } from 'react';
import { X, Sliders, Shield, Terminal, HardDrive } from 'lucide-react';
import type { BrowserSettings, SearchEngine } from '@dualsurf/shared-types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<BrowserSettings | null>(null);

  useEffect(() => {
    if (isOpen && window.dualsurf) {
      window.dualsurf.getSettings().then(setSettings);
    }
  }, [isOpen]);

  if (!isOpen || !settings) return null;

  const handleUpdate = async (partial: Partial<BrowserSettings>) => {
    if (!window.dualsurf) return;
    const updated = await window.dualsurf.updateSettings(partial);
    setSettings(updated);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 16 }}>
            <Sliders size={18} color="var(--accent-cyan)" />
            <span>DualSurf Browser Preferences</span>
          </div>
          <button className="action-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Search Engine */}
          <div className="setting-row">
            <div>
              <div className="setting-label">Default Search Engine</div>
              <div className="setting-desc">Used when queries are typed directly into the address bar or terminal</div>
            </div>
            <select
              className="setting-select"
              value={settings.searchEngine}
              onChange={(e) => handleUpdate({ searchEngine: e.target.value as SearchEngine })}
            >
              <option value="duckduckgo">DuckDuckGo (Privacy)</option>
              <option value="google">Google</option>
              <option value="brave">Brave Search</option>
              <option value="bing">Bing</option>
            </select>
          </div>

          {/* Session Restore */}
          <div className="setting-row">
            <div>
              <div className="setting-label">Restore Session on Startup</div>
              <div className="setting-desc">Automatically restore previously open tabs and active states</div>
            </div>
            <input
              type="checkbox"
              checked={settings.restoreSessionOnStartup}
              onChange={(e) => handleUpdate({ restoreSessionOnStartup: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
          </div>

          {/* Terminal Theme */}
          <div className="setting-row">
            <div>
              <div className="setting-label">Terminal Mode Theme</div>
              <div className="setting-desc">Visual color scheme for Mode B CLI / TUI session</div>
            </div>
            <select
              className="setting-select"
              value={settings.terminalTheme}
              onChange={(e) => handleUpdate({ terminalTheme: e.target.value as any })}
            >
              <option value="dracula">Dracula (Dark Violet)</option>
              <option value="gruvbox">Gruvbox (Warm Retro)</option>
              <option value="nord">Nord (Arctic Blue)</option>
              <option value="matrix">Matrix (Phosphor Green)</option>
            </select>
          </div>

          {/* Security & Sandbox Info */}
          <div
            style={{
              padding: 12,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 240, 255, 0.05)',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <Shield size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Security Architecture: </strong>
              All web rendering is fully sandboxed in isolated Chromium WebContentsView instances.
              Node.js integration is disabled, preventing untrusted remote code execution.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
