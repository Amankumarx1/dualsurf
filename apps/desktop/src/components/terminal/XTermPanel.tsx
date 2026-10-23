import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, AlertCircle, RefreshCw, Copy, Check } from 'lucide-react';

interface XTermPanelProps {
  sessionId: string;
  runtimeId?: string;
  runtimeName?: string;
  isActive?: boolean;
  onPtyExit?: (exitCode: number) => void;
  className?: string;
}

export const XTermPanel: React.FC<XTermPanelProps> = ({
  sessionId,
  runtimeId = 'default',
  runtimeName = 'Host Shell',
  isActive = true,
  onPtyExit,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const initTerminal = useCallback(async () => {
    if (!containerRef.current) return;

    // Destroy existing terminal if re-initializing
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.dispose();
      terminalInstanceRef.current = null;
    }

    setErrorMsg(null);
    setIsConnected(false);

    try {
      // 1. Instantiate xterm with Kali-themed aesthetic
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
        fontSize: 13,
        lineHeight: 1.25,
        letterSpacing: 0,
        scrollback: 5000,
        theme: {
          background: '#0c1017',
          foreground: '#e6edf3',
          cursor: '#00ffc8',
          cursorAccent: '#0c1017',
          selectionBackground: 'rgba(0, 210, 255, 0.3)',
          black: '#161b22',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#57c7ff',
          magenta: '#ff79c6',
          cyan: '#8be9fd',
          white: '#f8f8f2',
          brightBlack: '#6272a4',
          brightRed: '#ff6e6e',
          brightGreen: '#69ff94',
          brightYellow: '#ffffa5',
          brightBlue: '#d6acff',
          brightMagenta: '#ff92df',
          brightCyan: '#a4ffff',
          brightWhite: '#ffffff',
        },
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      // Open terminal in container DOM
      containerRef.current.innerHTML = '';
      term.open(containerRef.current);
      fitAddon.fit();

      terminalInstanceRef.current = term;
      fitAddonRef.current = fitAddon;

      const cols = term.cols || 80;
      const rows = term.rows || 24;

      // 2. Spawn backend PTY via IPC
      if (window.dualsurf?.ptyCreate) {
        const res = await window.dualsurf.ptyCreate(sessionId, runtimeId, { cols, rows });
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to spawn PTY session');
          term.writeln(`\r\n\x1b[31;1m[DualSurf Error]\x1b[0m ${res.error || 'PTY spawn failed'}\r\n`);
          return;
        }

        setIsConnected(true);

        // 3. Pipe backend PTY stdout into xterm
        const removeDataSub = window.dualsurf.onPtyData(sessionId, (data: string) => {
          term.write(data);
        });

        // 4. Pipe xterm user keystrokes into backend PTY stdin
        const termDataDisposable = term.onData((data: string) => {
          window.dualsurf.ptyWrite(sessionId, data);
        });

        // 5. Handle PTY exit
        const removeExitSub = window.dualsurf.onPtyExit(sessionId, (code: number) => {
          setIsConnected(false);
          term.writeln(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`);
          onPtyExit?.(code);
        });

        // Window resize observer
        const handleResize = () => {
          if (!containerRef.current || !fitAddonRef.current || !terminalInstanceRef.current) return;
          try {
            fitAddonRef.current.fit();
            const newCols = terminalInstanceRef.current.cols;
            const newRows = terminalInstanceRef.current.rows;
            window.dualsurf?.ptyResize(sessionId, newCols, newRows);
          } catch {
            // Ignore transient fit errors during tab transitions
          }
        };

        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(containerRef.current);

        return () => {
          removeDataSub();
          removeExitSub();
          termDataDisposable.dispose();
          resizeObserver.disconnect();
        };
      } else {
        // Fallback for non-Electron or simulated environments
        term.writeln('\x1b[1;36m[DualSurf Terminal]\x1b[0m \x1b[90m— Preview Mode\x1b[0m');
        term.writeln('\x1b[32mdualsurf@terminal\x1b[0m:\x1b[34m~\x1b[0m$ ');
      }
    } catch (err: any) {
      console.error('[XTermPanel] Init error:', err);
      setErrorMsg(err.message || 'Error initializing terminal');
    }
  }, [sessionId, runtimeId, onPtyExit]);

  useEffect(() => {
    let cleanupPromise: Promise<(() => void) | undefined> | undefined;
    cleanupPromise = initTerminal();

    return () => {
      cleanupPromise?.then((clean) => clean?.());
      if (window.dualsurf?.ptyKill) {
        window.dualsurf.ptyKill(sessionId).catch(() => {});
      }
      terminalInstanceRef.current?.dispose();
    };
  }, [initTerminal, sessionId]);

  // Focus terminal when active
  useEffect(() => {
    if (isActive && terminalInstanceRef.current) {
      terminalInstanceRef.current.focus();
      fitAddonRef.current?.fit();
    }
  }, [isActive]);

  const handleCopy = () => {
    if (terminalInstanceRef.current) {
      const selection = terminalInstanceRef.current.getSelection();
      if (selection) {
        navigator.clipboard?.writeText(selection);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    }
  };

  const handleRestart = () => {
    initTerminal();
  };

  return (
    <div
      className={`xterm-panel-wrapper ${className}`}
      style={{
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#0c1017',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Session Micro Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          background: '#131822',
          borderBottom: '1px solid #21262d',
          fontSize: '11px',
          color: '#8b949e',
          fontFamily: 'monospace',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={12} color="#00ffc8" />
          <span style={{ color: '#00d2ff', fontWeight: 600 }}>{sessionId}</span>
          <span style={{ color: '#484f58' }}>|</span>
          <span style={{ color: '#c9d1d9' }}>{runtimeName}</span>
          {isConnected ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: '#3fb950',
                background: 'rgba(63, 185, 80, 0.1)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '10px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#3fb950',
                  boxShadow: '0 0 6px #3fb950',
                }}
              />
              PTY CONNECTED
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: '#f85149',
                background: 'rgba(248, 81, 73, 0.1)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '10px',
              }}
            >
              DISCONNECTED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleCopy}
            title="Copy Selection"
            style={{
              background: 'transparent',
              border: 'none',
              color: copied ? '#3fb950' : '#8b949e',
              cursor: 'pointer',
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '4px',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleRestart}
            title="Restart Session"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '4px',
            }}
          >
            <RefreshCw size={12} />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* Error alert if PTY spawn failed */}
      {errorMsg && (
        <div
          style={{
            background: 'rgba(248, 81, 73, 0.15)',
            borderBottom: '1px solid #f85149',
            padding: '6px 12px',
            color: '#f85149',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* DOM Node where xterm attaches */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          padding: '8px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};
