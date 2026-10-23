import React, { useEffect, useState } from 'react';
import { Moon, Sun, Settings, Minus, Square, Copy, X, Terminal, Globe } from 'lucide-react';
import dualsurfLogo from '../assets/dualsurf-logo.png';

interface TitleBarProps {
  onOpenSettings: () => void;
  onOpenWorkspaceModal?: () => void;
  workspaceDir?: string;
  onToggleTheme?: () => void;
  currentTheme?: 'dark' | 'light';
  mode?: 'gui' | 'terminal';
  onSwitchMode?: (mode: 'gui' | 'terminal') => void;
  children?: React.ReactNode;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onOpenSettings,
  onOpenWorkspaceModal,
  workspaceDir,
  onToggleTheme,
  currentTheme = 'dark',
  mode = 'gui',
  onSwitchMode,
  children,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.dualsurf?.isMaximized) {
      window.dualsurf.isMaximized().then(setIsMaximized).catch(() => {});
    }
    const unsub = window.dualsurf?.onMaximizedChange?.((max: boolean) => {
      setIsMaximized(max);
    });
    return () => {
      unsub?.();
    };
  }, []);

  const handleMinimize = () => {
    if (typeof window.dualsurf?.minimizeWindow === 'function') {
      window.dualsurf.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (typeof window.dualsurf?.maximizeWindow === 'function') {
      window.dualsurf.maximizeWindow();
    }
  };

  const handleClose = () => {
    if (typeof window.dualsurf?.closeWindow === 'function') {
      window.dualsurf.closeWindow();
    }
  };

  const handleDoubleClick = () => {
    handleMaximize();
  };

  return (
    <div className="dualsurf-titlebar-strip" onDoubleClick={handleDoubleClick}>
      {/* Brand Identity */}
      <div className="titlebar-brand">
        <img
          src={dualsurfLogo}
          alt="DualSurf Logo"
          className="dualsurf-brand-logo-img"
        />
        <span className="titlebar-brand-name">DualSurf</span>
      </div>

      {/* Center Tabs Strip */}
      <div className="titlebar-center-tabs">
        {children}
      </div>

      {/* Right controls (non-draggable) */}
      <div className="titlebar-actions">
        {onOpenWorkspaceModal && (
          <button
            className="titlebar-sandbox-pill"
            onClick={onOpenWorkspaceModal}
            title={`Kali Sandbox Directory: ${workspaceDir || 'Default'}\nClick to change folder access permission`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontFamily: 'monospace',
              background: 'rgba(0, 164, 228, 0.12)',
              border: '1px solid rgba(0, 164, 228, 0.35)',
              color: '#00a4e4',
              cursor: 'pointer',
              marginRight: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '11px' }}>🔒</span>
            <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
              {workspaceDir ? workspaceDir.split(/[\\/]/).pop() || 'Kali Root' : 'Kali Jail'}
            </span>
          </button>
        )}

        {onSwitchMode && (
          <button
            className="titlebar-mode-toggle-btn"
            onClick={() => onSwitchMode(mode === 'gui' ? 'terminal' : 'gui')}
            title={mode === 'gui' ? 'Switch to Kali Terminal (Ctrl+`)' : 'Switch to Browser View (Ctrl+`)'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              background: mode === 'terminal' ? 'rgba(0, 164, 228, 0.22)' : 'rgba(255, 255, 255, 0.06)',
              border: mode === 'terminal' ? '1px solid rgba(0, 164, 228, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
              color: mode === 'terminal' ? '#38bdf8' : '#cbd5e1',
              cursor: 'pointer',
              marginRight: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            {mode === 'terminal' ? (
              <>
                <Globe size={12} />
                <span>Browser</span>
              </>
            ) : (
              <>
                <Terminal size={12} />
                <span>Kali Terminal</span>
              </>
            )}
          </button>
        )}

        <button
          className="titlebar-icon-btn"
          onClick={onToggleTheme}
          title={currentTheme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
          aria-label="Toggle Theme"
        >
          {currentTheme === 'light' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button
          className="titlebar-icon-btn"
          onClick={onOpenSettings}
          title="Settings"
        >
          <Settings size={15} />
        </button>

        <div className="titlebar-window-buttons">
          <button className="win-ctrl-btn minimize" onClick={handleMinimize} title="Minimize">
            <Minus size={13} />
          </button>
          <button
            className="win-ctrl-btn maximize"
            onClick={handleMaximize}
            title={isMaximized ? 'Restore Window' : 'Maximize Window'}
          >
            {isMaximized ? <Copy size={11} /> : <Square size={11} />}
          </button>
          <button className="win-ctrl-btn close" onClick={handleClose} title="Close">
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

