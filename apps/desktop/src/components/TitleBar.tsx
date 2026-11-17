import React, { useEffect, useState } from 'react';
import { Moon, Sun, Settings, Minus, Square, Copy, X } from 'lucide-react';
import { DualSurfLogo } from './DualSurfLogo';

interface TitleBarProps {
  onOpenSettings: () => void;
  onOpenWorkspaceModal?: () => void;
  workspaceDir?: string;
  onToggleTheme?: () => void;
  currentTheme?: 'dark' | 'light';
  mode?: 'gui' | 'terminal';
  onSwitchMode?: (mode: 'gui' | 'terminal') => void;
  isConnected?: boolean;
  children?: React.ReactNode;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onOpenSettings,
  onToggleTheme,
  currentTheme = 'dark',
  isConnected = true,
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
      {/* Brand Identity on Top Left */}
      <div className="titlebar-brand">
        <DualSurfLogo size={18} variant={currentTheme === 'light' ? 'dark' : 'white'} />
        <span className="titlebar-brand-name">DualSurf</span>
      </div>

      {/* Center Tabs Strip with Workspace Selector */}
      <div className="titlebar-center-tabs">
        {children}
      </div>

      {/* Right Controls: Connection Status, Theme Toggle, Settings, Window Buttons */}
      <div className="titlebar-actions">
        {/* Connection Status Indicator */}
        <div className="titlebar-connection-status" title="Connected to DualSurf runtime & controller">
          <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
          <span className="status-label">{isConnected ? 'Connected' : 'Offline'}</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          className="titlebar-icon-btn"
          onClick={onToggleTheme}
          title={currentTheme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
          aria-label="Toggle Theme"
        >
          {currentTheme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Settings Shortcut Button */}
        <button
          className="titlebar-icon-btn"
          onClick={onOpenSettings}
          title="Browser Settings"
          aria-label="Settings"
        >
          <Settings size={14} />
        </button>

        {/* Electron Window Controls */}
        <div className="titlebar-window-buttons">
          <button className="win-ctrl-btn minimize" onClick={handleMinimize} title="Minimize" aria-label="Minimize">
            <Minus size={12} />
          </button>
          <button
            className="win-ctrl-btn maximize"
            onClick={handleMaximize}
            title={isMaximized ? 'Restore Window' : 'Maximize Window'}
            aria-label="Maximize"
          >
            {isMaximized ? <Copy size={10} /> : <Square size={10} />}
          </button>
          <button className="win-ctrl-btn close" onClick={handleClose} title="Close" aria-label="Close">
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
