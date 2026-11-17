import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as XTermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  Terminal as TermIcon,
  Plus,
  X,
  RotateCcw,
  Globe,
  Trash2,
} from 'lucide-react';
import type { TabState, ActiveSessionState } from '@dualsurf/shared-types';

interface DualSurfTerminalWorkspaceProps {
  activeTab: TabState | null;
  activeSession?: ActiveSessionState;
  onSwitchToGui: () => void;
  externalInput?: string;
  onClearExternalInput?: () => void;
}

interface TerminalTab {
  id: string;
  title: string;
  shell?: string;
}

export const DualSurfTerminalWorkspace: React.FC<DualSurfTerminalWorkspaceProps> = ({
  onSwitchToGui,
  externalInput,
  onClearExternalInput,
}) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'term-1', title: 'Terminal 1' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('term-1');
  const [shellName, setShellName] = useState<string>('Shell');

  const containerRef = useRef<HTMLDivElement>(null);
  const termInstances = useRef<Map<string, { term: XTermTerminal; fitAddon: FitAddon }>>(new Map());
  const activeTabIdRef = useRef<string>(activeTabId);
  activeTabIdRef.current = activeTabId;

  // Initialize or attach xterm instance for a given tab
  const setupTerminal = useCallback(async (tabId: string) => {
    if (!containerRef.current) return;

    // If instance already exists, re-attach container DOM element
    let instance = termInstances.current.get(tabId);
    if (!instance) {
      const term = new XTermTerminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace",
        theme: {
          background: '#0a0d14',
          foreground: '#e2e8f0',
          cursor: '#00ffc8',
          cursorAccent: '#0a0d14',
          selectionBackground: 'rgba(0, 255, 200, 0.25)',
          black: '#1e293b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f8fafc',
          brightBlack: '#475569',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#fde047',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff',
        },
        allowTransparency: true,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      instance = { term, fitAddon };
      termInstances.current.set(tabId, instance);

      // Create native backend PTY session
      if (window.dualsurf?.ptyCreate) {
        try {
          const res = await window.dualsurf.ptyCreate(tabId, 'default', {
            cols: term.cols,
            rows: term.rows,
          });
          if (res?.shell) {
            setShellName(res.shell);
          }
        } catch (err: any) {
          term.writeln(`\r\n\x1b[31m[DualSurf Terminal Error] Failed to start shell session: ${err.message}\x1b[0m\r\n`);
        }
      }

      // Listen for data from user keyboard -> send to PTY
      term.onData((data) => {
        if (window.dualsurf?.ptyWrite) {
          window.dualsurf.ptyWrite(tabId, data);
        }
      });

      // Listen for data from backend PTY -> write to xterm
      if (window.dualsurf?.onPtyData) {
        window.dualsurf.onPtyData(tabId, (incomingData: string) => {
          term.write(incomingData);
        });
      }

      // Listen for PTY exit
      if (window.dualsurf?.onPtyExit) {
        window.dualsurf.onPtyExit(tabId, (code: number) => {
          term.writeln(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
        });
      }
    }

    // Mount into DOM container
    containerRef.current.innerHTML = '';
    instance.term.open(containerRef.current);
    try {
      instance.fitAddon.fit();
    } catch {}

    // Tell PTY about the new size
    if (window.dualsurf?.ptyResize) {
      window.dualsurf.ptyResize(tabId, instance.term.cols, instance.term.rows);
    }

    instance.term.focus();
  }, []);

  // Set up terminal when active tab changes
  useEffect(() => {
    setupTerminal(activeTabId);
  }, [activeTabId, setupTerminal]);

  // Handle container and window resize
  useEffect(() => {
    const handleResize = () => {
      const instance = termInstances.current.get(activeTabIdRef.current);
      if (instance) {
        try {
          instance.fitAddon.fit();
          if (window.dualsurf?.ptyResize) {
            window.dualsurf.ptyResize(activeTabIdRef.current, instance.term.cols, instance.term.rows);
          }
        } catch {}
      }
    };

    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  // Handle external input command
  useEffect(() => {
    if (externalInput && externalInput.trim()) {
      const activeInstance = termInstances.current.get(activeTabId);
      if (activeInstance && window.dualsurf?.ptyWrite) {
        window.dualsurf.ptyWrite(activeTabId, `${externalInput.trim()}\r`);
        if (onClearExternalInput) {
          onClearExternalInput();
        }
      }
    }
  }, [externalInput, activeTabId, onClearExternalInput]);

  // Add new terminal tab
  const handleAddTab = () => {
    const newId = `term-${Date.now()}`;
    const newTabNumber = tabs.length + 1;
    const newTab: TerminalTab = {
      id: newId,
      title: `Terminal ${newTabNumber}`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Close a terminal tab
  const handleCloseTab = (tabIdToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return; // Keep at least one tab

    // Kill PTY backend
    if (window.dualsurf?.ptyKill) {
      window.dualsurf.ptyKill(tabIdToClose);
    }

    // Dispose xterm instance
    const instance = termInstances.current.get(tabIdToClose);
    if (instance) {
      try {
        instance.term.dispose();
      } catch {}
      termInstances.current.delete(tabIdToClose);
    }

    const remaining = tabs.filter((t) => t.id !== tabIdToClose);
    setTabs(remaining);

    if (activeTabId === tabIdToClose) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  // Clear active terminal
  const handleClear = () => {
    const instance = termInstances.current.get(activeTabId);
    if (instance) {
      instance.term.clear();
      if (window.dualsurf?.ptyWrite) {
        window.dualsurf.ptyWrite(activeTabId, 'clear\r');
      }
    }
  };

  // Restart active terminal
  const handleRestart = () => {
    if (window.dualsurf?.ptyKill) {
      window.dualsurf.ptyKill(activeTabId);
    }
    const instance = termInstances.current.get(activeTabId);
    if (instance) {
      try {
        instance.term.dispose();
      } catch {}
      termInstances.current.delete(activeTabId);
    }
    setupTerminal(activeTabId);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0d14',
        color: '#f8fafc',
        overflow: 'hidden',
      }}
    >
      {/* Clean Top Navigation Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          backgroundColor: '#0f1420',
          borderBottom: '1px solid #1e293b',
          minHeight: '38px',
          userSelect: 'none',
        }}
      >
        {/* Left: Tab list */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <TermIcon size={14} style={{ color: '#00ffc8' }} />
            <span>Terminal</span>
          </div>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#334155', margin: '0 4px' }} />

          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  border: isActive ? '1px solid #334155' : '1px solid transparent',
                  transition: 'background-color 0.15s',
                }}
              >
                <span>{tab.title}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '2px',
                      opacity: 0.7,
                    }}
                    title="Close Tab"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={handleAddTab}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              backgroundColor: 'transparent',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
            title="New Terminal Tab"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              fontFamily: 'monospace',
            }}
          >
            {shellName}
          </span>

          <button
            onClick={handleClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: 'transparent',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#94a3b8',
              fontSize: '11px',
              cursor: 'pointer',
            }}
            title="Clear Terminal Output"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>

          <button
            onClick={handleRestart}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: 'transparent',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#94a3b8',
              fontSize: '11px',
              cursor: 'pointer',
            }}
            title="Restart Shell Session"
          >
            <RotateCcw size={12} />
            <span>Restart</span>
          </button>

          <button
            onClick={onSwitchToGui}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              backgroundColor: '#00ffc8',
              border: 'none',
              borderRadius: '4px',
              color: '#0a0d14',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Switch back to Browser Mode"
          >
            <Globe size={12} />
            <span>Browser Mode</span>
          </button>
        </div>
      </div>

      {/* Main Terminal Output Viewport */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          height: 'calc(100% - 38px)',
          padding: '8px 12px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: '#0a0d14',
        }}
        onClick={() => {
          const instance = termInstances.current.get(activeTabId);
          if (instance) instance.term.focus();
        }}
      />
    </div>
  );
};
