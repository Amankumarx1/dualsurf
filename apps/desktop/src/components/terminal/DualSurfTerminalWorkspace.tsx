import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as XTermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  Terminal as TermIcon,
  Plus,
  X,
  ChevronDown,
  Columns,
  Maximize2,
  Minimize2,
  Trash2,
  MoreHorizontal,
  Search,
  Upload,
  Folder,
  ArrowRight,
  RefreshCw,
  Eye,
  Shield,
  Layers,
  Activity,
  HardDrive,
  Globe,
  Radio,
  FileText,
  Send,
  Copy,
  Check,
  RotateCw,
  Pause,
  Play,
  Flame,
  Zap,
} from 'lucide-react';
import type { TabState, ActiveSessionState, KaliRuntimeProfile, InterceptedRequest } from '@dualsurf/shared-types';

interface DualSurfTerminalWorkspaceProps {
  activeTab: TabState | null;
  activeSession?: ActiveSessionState;
  onSwitchToGui: () => void;
  externalInput?: string;
  onClearExternalInput?: () => void;
}

interface TerminalSessionTab {
  id: string;
  name: string;
  icon?: string;
  runtime: string;
  cwd: string;
  startedAt: number;
  status: 'active' | 'idle';
}

interface ToolShortcutItem {
  id: string;
  name: string;
  bin: string;
  command: string;
  color: string;
  installed?: boolean;
}

interface FileItem {
  name: string;
  isDir: boolean;
  modified: string;
  size?: number;
}

interface LiveProcessItem {
  pid: string;
  user: string;
  pri: string;
  ni: string;
  virt: string;
  res: string;
  shr: string;
  s: string;
  cpu: string;
  mem: string;
  time: string;
  cmd: string;
}

export const DualSurfTerminalWorkspace: React.FC<DualSurfTerminalWorkspaceProps> = ({
  activeTab,
  activeSession,
  onSwitchToGui,
  externalInput,
  onClearExternalInput,
}) => {
  // 1. Session Tabs State
  const [sessions, setSessions] = useState<TerminalSessionTab[]>([
    { id: 'term-1', name: 'Terminal 1', runtime: 'default', cwd: '~', startedAt: Date.now(), status: 'active' },
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>('term-1');

  // 2. Runtime Selection
  const [runtimes, setRuntimes] = useState<KaliRuntimeProfile[]>([]);
  const [selectedRuntime, setSelectedRuntime] = useState<string>('default');
  const [isRuntimeMenuOpen, setIsRuntimeMenuOpen] = useState<boolean>(false);

  // 3. Layout Controls (Splits, Maximization)
  const [isLowerPanesOpen, setIsLowerPanesOpen] = useState<boolean>(true);
  const [lowerSplitFocus, setLowerSplitFocus] = useState<'both' | 'htop' | 'nmap'>('both');
  const [toolSearch, setToolSearch] = useState<string>('');

  // 4. Tools state
  const [tools, setTools] = useState<ToolShortcutItem[]>([
    { id: 'nmap', name: 'Nmap', bin: 'nmap', command: 'nmap -sV 127.0.0.1', color: '#29b6f6' },
    { id: 'burp', name: 'Burp', bin: 'burpsuite', command: 'burpsuite', color: '#ff6d00' },
    { id: 'wireshark', name: 'Wireshark', bin: 'wireshark', command: 'wireshark', color: '#0288d1' },
    { id: 'metasploit', name: 'Metasploit', bin: 'msfconsole', command: 'msfconsole', color: '#00acc1' },
    { id: 'sqlmap', name: 'Sqlmap', bin: 'sqlmap', command: 'sqlmap -h', color: '#e53935' },
    { id: 'nuclei', name: 'Nuclei', bin: 'nuclei', command: 'nuclei -version', color: '#00bfa5' },
    { id: 'hydra', name: 'Hydra', bin: 'hydra', command: 'hydra -h', color: '#00e5ff' },
    { id: 'hashcat', name: 'Hashcat', bin: 'hashcat', command: 'hashcat --help', color: '#ffb300' },
  ]);

  // 5. Filesystem state
  const [currentPath, setCurrentPath] = useState<string>('~/');
  const [rawPath, setRawPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([
    { name: 'Desktop', isDir: true, modified: 'Aug 26 10:12' },
    { name: 'Downloads', isDir: true, modified: 'Aug 26 09:41' },
    { name: 'Projects', isDir: true, modified: 'Aug 26 08:55' },
    { name: 'Tools', isDir: true, modified: 'Aug 25 22:17' },
    { name: 'Reports', isDir: true, modified: 'Aug 25 18:03' },
  ]);

  // Terminal DOM references
  const mainTermContainerRef = useRef<HTMLDivElement>(null);
  const mainTermRef = useRef<XTermTerminal | null>(null);
  const mainFitRef = useRef<FitAddon | null>(null);

  const nmapTermContainerRef = useRef<HTMLDivElement>(null);
  const nmapTermRef = useRef<XTermTerminal | null>(null);
  const nmapFitRef = useRef<FitAddon | null>(null);

  // Live system monitor data
  const [systemUptime, setSystemUptime] = useState('02:14:05');
  const [cpuUsage, setCpuUsage] = useState({ cpu0: 6.5, cpu1: 8.1 });
  const [memUsage, setMemUsage] = useState({ used: '3.0G', total: '15.5G' });
  const [liveProcesses, setLiveProcesses] = useState<LiveProcessItem[]>([]);

  // Sprint 2: In-Workspace HTTP Repeater & Tamperer State
  const [lowerPaneTab, setLowerPaneTab] = useState<'panes' | 'repeater' | 'intercept'>('panes');
  const [repeaterMethod, setRepeaterMethod] = useState<string>('GET');
  const [repeaterUrl, setRepeaterUrl] = useState<string>(
    activeTab?.url && activeTab.url.startsWith('http') ? activeTab.url : 'https://httpbin.org/get'
  );
  const [repeaterHeaders, setRepeaterHeaders] = useState<string>('User-Agent: DualSurf-Repeater/1.0\nAccept: application/json');
  const [repeaterBody, setRepeaterBody] = useState<string>('{\n  "test": "redteam_payload"\n}');
  const [repeaterSubTab, setRepeaterSubTab] = useState<'headers' | 'body'>('headers');
  const [repeaterRespSubTab, setRepeaterRespSubTab] = useState<'body' | 'headers'>('body');
  const [repeaterLoading, setRepeaterLoading] = useState<boolean>(false);
  const [repeaterResponse, setRepeaterResponse] = useState<any>(null);
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);
  const [copiedResp, setCopiedResp] = useState<boolean>(false);

  // Sprint 2: Breakpoint Intercept Queue State
  const [isBreakpointOn, setIsBreakpointOn] = useState<boolean>(false);
  const [pendingIntercepts, setPendingIntercepts] = useState<InterceptedRequest[]>([]);

  useEffect(() => {
    if (activeTab?.url && activeTab.url.startsWith('http')) {
      setRepeaterUrl(activeTab.url);
    }
  }, [activeTab?.url]);

  useEffect(() => {
    if (window.dualsurf?.proxyGetStatus) {
      window.dualsurf.proxyGetStatus().then((s: any) => {
        if (s) setIsBreakpointOn(Boolean(s.activeBreakpoint));
      }).catch(() => {});
    }
    if (window.dualsurf?.proxyGetPendingIntercepts) {
      window.dualsurf.proxyGetPendingIntercepts().then((items: any) => {
        if (Array.isArray(items)) setPendingIntercepts(items);
      }).catch(() => {});
    }
    if (window.dualsurf?.onInterceptPending) {
      const unsub = window.dualsurf.onInterceptPending((req: any) => {
        setPendingIntercepts((prev) => [req, ...prev]);
        setLowerPaneTab('intercept');
      });
      return unsub;
    }
  }, []);

  const handleSendRepeater = async () => {
    if (!repeaterUrl.trim()) return;
    setRepeaterLoading(true);
    setRepeaterResponse(null);

    const parsedHeaders: Record<string, string> = {};
    repeaterHeaders.split('\n').forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const k = line.substring(0, idx).trim();
        const v = line.substring(idx + 1).trim();
        if (k) parsedHeaders[k] = v;
      }
    });

    try {
      if (window.dualsurf?.sendRawRequest) {
        const res = await window.dualsurf.sendRawRequest({
          url: repeaterUrl.trim(),
          method: repeaterMethod,
          headers: parsedHeaders,
          body: repeaterMethod !== 'GET' && repeaterMethod !== 'HEAD' ? repeaterBody : undefined,
        });
        setRepeaterResponse(res);
      } else {
        const start = Date.now();
        const res = await fetch(repeaterUrl.trim(), {
          method: repeaterMethod,
          headers: parsedHeaders,
          body: repeaterMethod !== 'GET' && repeaterMethod !== 'HEAD' ? repeaterBody : undefined,
        });
        const text = await res.text();
        const h: Record<string, string> = {};
        res.headers.forEach((v, k) => (h[k] = v));
        setRepeaterResponse({
          success: true,
          status: res.status,
          statusText: res.statusText,
          headers: h,
          body: text,
          latencyMs: Date.now() - start,
        });
      }
    } catch (err: any) {
      setRepeaterResponse({ success: false, error: err.message });
    } finally {
      setRepeaterLoading(false);
    }
  };

  const handleCopyAsCurl = () => {
    let curl = `curl -X ${repeaterMethod} "${repeaterUrl}"`;
    repeaterHeaders.split('\n').forEach((line) => {
      if (line.includes(':')) curl += ` -H "${line.trim()}"`;
    });
    if (repeaterMethod !== 'GET' && repeaterMethod !== 'HEAD' && repeaterBody) {
      curl += ` -d '${repeaterBody.replace(/'/g, "\\'")}'`;
    }
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleCopyResponse = () => {
    if (repeaterResponse?.body) {
      navigator.clipboard.writeText(repeaterResponse.body);
      setCopiedResp(true);
      setTimeout(() => setCopiedResp(false), 2000);
    }
  };

  const handleToggleBreakpoint = async () => {
    if (window.dualsurf?.proxyToggleBreakpoint) {
      const active = await window.dualsurf.proxyToggleBreakpoint(!isBreakpointOn);
      setIsBreakpointOn(Boolean(active));
    } else {
      setIsBreakpointOn(!isBreakpointOn);
    }
  };

  const handleForwardIntercept = async (id: string) => {
    if (window.dualsurf?.proxyForwardIntercept) {
      await window.dualsurf.proxyForwardIntercept(id);
      setPendingIntercepts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleDropIntercept = async (id: string) => {
    if (window.dualsurf?.proxyDropIntercept) {
      await window.dualsurf.proxyDropIntercept(id);
      setPendingIntercepts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchMetrics = async () => {
      if (window.dualsurf?.getRealSystemMetrics) {
        try {
          const metrics = await window.dualsurf.getRealSystemMetrics();
          if (mounted && metrics) {
            if (metrics.uptimeFormatted) setSystemUptime(metrics.uptimeFormatted);
            if (metrics.cpuUsage0 && metrics.cpuUsage1) {
              setCpuUsage({ cpu0: parseFloat(metrics.cpuUsage0), cpu1: parseFloat(metrics.cpuUsage1) });
            }
            if (metrics.usedMemFormatted && metrics.totalMemFormatted) {
              setMemUsage({ used: metrics.usedMemFormatted, total: metrics.totalMemFormatted });
            }
            if (Array.isArray(metrics.processes) && metrics.processes.length > 0) {
              setLiveProcesses(metrics.processes);
            }
          }
        } catch {}
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Format session duration
  const getSessionDuration = (startedAt: number) => {
    const diffSec = Math.floor((Date.now() - startedAt) / 1000);
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    return `${diffHr}h ${remMin}m`;
  };

  // 1. Probe real available runtimes
  useEffect(() => {
    if (window.dualsurf?.getKaliRuntimes) {
      window.dualsurf.getKaliRuntimes().then((items) => {
        if (Array.isArray(items) && items.length > 0) {
          setRuntimes(items);
          const host = items.find((r) => r.type === 'host-local') || items[0];
          if (host) setSelectedRuntime(host.name);
        }
      }).catch(console.error);
    }
  }, []);

  // 2. Check real tool installation
  useEffect(() => {
    if (window.dualsurf?.checkTools) {
      window.dualsurf.checkTools().then((checked) => {
        if (Array.isArray(checked)) {
          setTools((prev) =>
            prev.map((t) => {
              const match = checked.find((c) => c.id === t.id);
              return match ? { ...t, installed: match.installed } : t;
            })
          );
        }
      }).catch(() => {});
    }
  }, []);

  // 3. Load genuine filesystem listing
  const loadFiles = useCallback((targetDir?: string) => {
    if (window.dualsurf?.listFiles) {
      window.dualsurf.listFiles(targetDir).then((res) => {
        if (res?.success) {
          setCurrentPath(res.currentPath);
          setRawPath(res.rawPath || '');
          setParentPath(res.parentPath || null);
          if (res.files && res.files.length > 0) {
            setFiles(res.files);
          }
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // 4. Initialize Main Upper Terminal with real PTY
  useEffect(() => {
    if (!mainTermContainerRef.current) return;

    const term = new XTermTerminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontSize: 12.5,
      lineHeight: 1.25,
      scrollback: 5000,
      theme: {
        background: '#08090b',
        foreground: '#e6edf3',
        cursor: '#00ffc8',
        cursorAccent: '#08090b',
        selectionBackground: 'rgba(41, 182, 246, 0.3)',
        black: '#161b22',
        red: '#ff5555',
        green: '#21d477',
        yellow: '#f1fa8c',
        blue: '#29b6f6',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    mainTermContainerRef.current.innerHTML = '';
    term.open(mainTermContainerRef.current);
    fitAddon.fit();

    mainTermRef.current = term;
    mainFitRef.current = fitAddon;

    const activeSessionObj = sessions.find((s) => s.id === activeSessionId);
    const sessionRuntime = activeSessionObj?.runtime || selectedRuntime || 'default';
    const sessionCwd = activeSessionObj?.cwd || '~';

    // Authentic Kali Linux Terminal Header & Fallback
    const displayKaliFallbackHeader = () => {
      const banner = [
        '\x1b[1;34m  ..............\x1b[0m',
        '\x1b[1;34m             ..,;:ccc,.\x1b[0m',
        '\x1b[1;34m           ......\'\'\';lxO.\x1b[0m',
        '\x1b[1;34m  .....\'\'\'\'..........,:ld;\x1b[0m',
        '\x1b[1;34m             .\',;;:ccc;..:ko.\x1b[0m',
        '\x1b[1;34m          ..:::clllcccc:;:lo:.\x1b[0m',
        '\x1b[1;34m        ......\'\'\'\'...,:lx:\x1b[0m',
        '\x1b[1;34m                 .\';:clc:.\x1b[0m',
        '\x1b[1;36m┌── Kali GNU/Linux Rolling 2026.1 (WSL Sandboxed Jail)\x1b[0m',
        `\x1b[90m├── Runtime: \x1b[32m${sessionRuntime}\x1b[0m \x1b[90m| Sandbox Root: \x1b[33m${sessionCwd}\x1b[0m`,
        '\x1b[90m└── Boundary: \x1b[36mRestricted to granted folder (\'sudo su\' supported)\x1b[0m\r\n',
        '\x1b[1;34m┌──(\x1b[1;34mkali\x1b[1;37m㉿\x1b[1;34mdualsurf\x1b[1;34m)-[\x1b[1;37m~\x1b[1;34m]\x1b[0m\r\n\x1b[1;34m└─\x1b[1;31m$\x1b[0m ',
      ];
      term.writeln(banner.join('\r\n'));
    };

    if (!window.dualsurf?.ptyCreate) {
      displayKaliFallbackHeader();
    }

    // Attach real PTY backend if available
    let cleanupPty: (() => void) | undefined;
    if (window.dualsurf?.ptyCreate) {
      window.dualsurf
        .ptyCreate(activeSessionId, sessionRuntime, {
          cols: term.cols || 80,
          rows: term.rows || 20,
          cwd: sessionCwd === '~' ? undefined : sessionCwd,
        })
        .then((res) => {
          if (res?.success) {
            if (res.runtimeName || res.cwd) {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === activeSessionId
                    ? {
                        ...s,
                        runtime: res.runtimeName || s.runtime,
                        cwd: res.cwd || s.cwd,
                        name: s.name === 'Terminal 1' && res.runtimeName
                          ? `${res.runtimeName.split(' ')[0]} 1`
                          : s.name,
                      }
                    : s
                )
              );
              if (res.cwd) {
                setCurrentPath(res.cwd);
                loadFiles(res.cwd);
              }
            }
            cleanupPty = window.dualsurf.onPtyData(activeSessionId, (data) => {
              term.write(data);
            });
          } else if (res?.error) {
            term.writeln(`\r\n\x1b[31;1m[DualSurf Error]\x1b[0m ${res.error}\r\n`);
          }
        })
        .catch((err) => {
          term.writeln(`\r\n\x1b[31;1m[DualSurf Error]\x1b[0m ${err.message || 'PTY spawn failed'}\r\n`);
        });

      term.onData((data) => {
        window.dualsurf.ptyWrite(activeSessionId, data);
      });
    }

    const handleResize = () => {
      try {
        fitAddon.fit();
        window.dualsurf?.ptyResize?.(activeSessionId, term.cols, term.rows);
      } catch {}
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mainTermContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      cleanupPty?.();
      term.dispose();
    };
  }, [activeSessionId]);

  // 5. Initialize Lower Right Nmap Scan Terminal
  useEffect(() => {
    if (!nmapTermContainerRef.current) return;

    const term = new XTermTerminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', Consolas, monospace",
      fontSize: 11.5,
      lineHeight: 1.25,
      theme: {
        background: '#08090b',
        foreground: '#e6edf3',
        cursor: '#00ffc8',
        cyan: '#29b6f6',
        green: '#21d477',
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    nmapTermContainerRef.current.innerHTML = '';
    term.open(nmapTermContainerRef.current);
    fitAddon.fit();

    nmapTermRef.current = term;
    nmapFitRef.current = fitAddon;

    // Output authentic nmap scan console
    term.writeln('\x1b[1;36m[DualSurf Network Scanner Console]\x1b[0m');
    term.writeln('\x1b[90mReady for target execution. Use the Tools menu or enter scanning commands.\x1b[0m\r\n');
    term.write('\x1b[32mscanner@dualsurf\x1b[0m:\x1b[34m~\x1b[0m$ ');

    term.onData((data) => {
      term.write(data);
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {}
    };

    const observer = new ResizeObserver(() => handleResize());
    observer.observe(nmapTermContainerRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
    };
  }, []);

  // Handle external command execution
  useEffect(() => {
    if (externalInput && mainTermRef.current) {
      mainTermRef.current.writeln(`\r\n\x1b[36m$ ${externalInput}\x1b[0m`);
      if (window.dualsurf?.ptyWrite) {
        window.dualsurf.ptyWrite(activeSessionId, externalInput + '\n');
      }
      onClearExternalInput?.();
    }
  }, [externalInput, activeSessionId, onClearExternalInput]);

  const handleRunTool = (tool: ToolShortcutItem) => {
    if (mainTermRef.current) {
      mainTermRef.current.writeln(`\r\n\x1b[36m$ ${tool.command}\x1b[0m`);
      if (window.dualsurf?.ptyWrite) {
        window.dualsurf.ptyWrite(activeSessionId, tool.command + '\n');
      }
    }
  };

  const handleClearTerminal = () => {
    mainTermRef.current?.clear();
  };

  const handleCreateSession = (customCwd?: string) => {
    const nextNum = sessions.length + 1;
    const newSession: TerminalSessionTab = {
      id: `session-${nextNum}`,
      name: `Terminal ${nextNum}`,
      runtime: selectedRuntime,
      cwd: typeof customCwd === 'string' ? customCwd : '~',
      startedAt: Date.now(),
      status: 'active',
    };
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  };

  const handleOpenProjectFolder = async () => {
    if (window.dualsurf?.selectFolder) {
      const res = await window.dualsurf.selectFolder('Select Project Directory for Terminal');
      if (res?.success && res.path) {
        const chosenPath = res.path;
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, cwd: chosenPath } : s))
        );
        setCurrentPath(chosenPath);
        loadFiles(chosenPath);
        if (window.dualsurf?.ptyWrite) {
          window.dualsurf.ptyWrite(activeSessionId, `cd "${chosenPath}"\r`);
        }
      }
    }
  };

  const handleCloseSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) return;
    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0].id);
    }
    if (window.dualsurf?.ptyKill) {
      window.dualsurf.ptyKill(id).catch(() => {});
    }
  };

  const handleNavigateFolder = (folderName: string) => {
    if (folderName === '..') {
      if (parentPath) loadFiles(parentPath);
    } else {
      const target = rawPath ? `${rawPath}/${folderName}` : folderName;
      loadFiles(target);
    }
    if (mainTermRef.current) {
      mainTermRef.current.writeln(`\r\n\x1b[36m$ cd "${folderName}"\x1b[0m`);
      window.dualsurf?.ptyWrite?.(activeSessionId, `cd "${folderName}"\n`);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        background: '#08090b',
        color: '#e8eaed',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Central Terminal Workstation Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          borderRight: '1px solid #21262d',
        }}
      >
        {/* Terminal Header Bar matching Screenshot 2 */}
        <div
          style={{
            height: '38px',
            background: '#0d0f12',
            borderBottom: '1px solid #21262d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            userSelect: 'none',
          }}
        >
          {/* Left: Terminal Icon + Title + Session Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: '#161b22',
                  border: '1px solid #30363d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TermIcon size={11} color="#e8eaed" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Terminal</span>
            </div>

            <button
              onClick={handleCreateSession}
              title="New Terminal Tab"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Plus size={14} />
            </button>

            {/* Session Tabs: kali, root, logs, nmap, + */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {sessions.map((tab) => {
                const isActive = activeSessionId === tab.id;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveSessionId(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 10px',
                      borderRadius: '5px',
                      background: isActive ? '#161b22' : 'transparent',
                      border: isActive ? '1px solid rgba(41, 182, 246, 0.4)' : '1px solid transparent',
                      color: isActive ? '#ffffff' : '#8b949e',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                    }}
                  >
                    {isActive && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#21d477',
                        }}
                      />
                    )}
                    {tab.icon && <span>{tab.icon}</span>}
                    <span>{tab.name}</span>
                    <X
                      size={11}
                      onClick={(e) => handleCloseSession(tab.id, e)}
                      style={{ color: '#6e7681', cursor: 'pointer' }}
                    />
                  </div>
                );
              })}

              <button
                onClick={() => handleCreateSession()}
                title="Add Session"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6e7681',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <Plus size={12} />
              </button>

              <button
                onClick={handleOpenProjectFolder}
                title="Open Project Folder in Terminal"
                style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '4px',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginLeft: '4px',
                }}
              >
                <Folder size={11} style={{ color: '#29b6f6' }} />
                <span>Open Folder</span>
              </button>
            </div>
          </div>

          {/* Right: Runtime Pill & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            {/* Runtime Dropdown Pill */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsRuntimeMenuOpen(!isRuntimeMenuOpen)}
                style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '14px',
                  padding: '3px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#e8eaed',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#21d477',
                  }}
                />
                <span>Session: {selectedRuntime}</span>
                <ChevronDown size={11} color="#8b949e" />
              </button>

              {isRuntimeMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '28px',
                    right: 0,
                    background: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    zIndex: 200,
                    width: '210px',
                    overflow: 'hidden',
                  }}
                >
                  {runtimes.length > 0 ? (
                    runtimes.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedRuntime(r.name);
                          setIsRuntimeMenuOpen(false);
                          if (window.dualsurf?.setActiveKaliRuntime) {
                            window.dualsurf.setActiveKaliRuntime(r.id);
                          }
                        }}
                        style={{
                          padding: '7px 10px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          color: selectedRuntime === r.name ? '#29b6f6' : '#c9d1d9',
                          background: selectedRuntime === r.name ? '#1f242c' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{r.name}</span>
                        <span style={{ fontSize: '9px', color: r.status === 'online' ? '#21d477' : '#8b949e' }}>
                          {r.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    ['PowerShell (Host)', 'Command Prompt (cmd)', 'Git Bash', 'WSL 2 Linux'].map((r) => (
                      <div
                        key={r}
                        onClick={() => {
                          setSelectedRuntime(r);
                          setIsRuntimeMenuOpen(false);
                        }}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          color: selectedRuntime === r ? '#29b6f6' : '#c9d1d9',
                          background: selectedRuntime === r ? '#1f242c' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        {r}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Split Screen Control */}
            <button
              onClick={() => setIsLowerPanesOpen(!isLowerPanesOpen)}
              title={isLowerPanesOpen ? 'Hide Lower Panes' : 'Split Panes (htop & nmap)'}
              style={{
                background: isLowerPanesOpen ? '#1f242c' : 'transparent',
                border: '1px solid #30363d',
                borderRadius: '4px',
                color: isLowerPanesOpen ? '#29b6f6' : '#8b949e',
                cursor: 'pointer',
                padding: '3px 6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Columns size={12} />
            </button>

            {/* Maximize Terminal Control */}
            <button
              onClick={() => setIsLowerPanesOpen(!isLowerPanesOpen)}
              title="Maximize Terminal"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                padding: '3px',
              }}
            >
              {isLowerPanesOpen ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>

            {/* Clear / Trash Control */}
            <button
              onClick={handleClearTerminal}
              title="Clear Terminal Buffer"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                padding: '3px',
              }}
            >
              <Trash2 size={12} />
            </button>

            {/* More Menu Control */}
            <button
              title="More Actions"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                padding: '3px',
              }}
            >
              <MoreHorizontal size={13} />
            </button>
          </div>
        </div>

        {/* Main Terminal Pane (Top Half) */}
        <div
          ref={mainTermContainerRef}
          style={{
            flex: isLowerPanesOpen ? '1 1 54%' : '1 1 100%',
            height: isLowerPanesOpen ? '54%' : '100%',
            width: '100%',
            background: '#08090b',
            padding: '10px 14px',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        />

        {/* Lower Split-Terminal Panes (Bottom Half) */}
        {isLowerPanesOpen && (
          <div
            style={{
              flex: '1 1 46%',
              height: '46%',
              width: '100%',
              borderTop: '1px solid #21262d',
              display: 'flex',
              flexDirection: 'column',
              background: '#08090b',
              overflow: 'hidden',
            }}
          >
            {/* Lower Pane Workspace Tab Switcher */}
            <div
              style={{
                height: '27px',
                background: '#0d0f12',
                borderBottom: '1px solid #21262d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                fontSize: '11px',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setLowerPaneTab('panes')}
                  style={{
                    background: lowerPaneTab === 'panes' ? '#161b22' : 'transparent',
                    border: 'none',
                    color: lowerPaneTab === 'panes' ? '#00ffc8' : '#8b949e',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: lowerPaneTab === 'panes' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Columns size={11} />
                  <span>Panes (htop & nmap)</span>
                </button>
                <button
                  onClick={() => setLowerPaneTab('repeater')}
                  style={{
                    background: lowerPaneTab === 'repeater' ? '#161b22' : 'transparent',
                    border: 'none',
                    color: lowerPaneTab === 'repeater' ? '#29b6f6' : '#8b949e',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: lowerPaneTab === 'repeater' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Send size={11} />
                  <span>HTTP Repeater</span>
                </button>
                <button
                  onClick={() => setLowerPaneTab('intercept')}
                  style={{
                    background: lowerPaneTab === 'intercept' ? '#161b22' : 'transparent',
                    border: 'none',
                    color: pendingIntercepts.length > 0 ? '#ffb300' : (lowerPaneTab === 'intercept' ? '#ff5555' : '#8b949e'),
                    padding: '2px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: lowerPaneTab === 'intercept' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Pause size={11} />
                  <span>Intercept Breakpoint</span>
                  {pendingIntercepts.length > 0 && (
                    <span style={{ background: '#ff5555', color: '#fff', borderRadius: '8px', padding: '0 5px', fontSize: '9px', fontWeight: 700 }}>
                      {pendingIntercepts.length}
                    </span>
                  )}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => setIsLowerPanesOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '2px' }}
                  title="Close Lower Pane"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Lower Pane Main Content Area */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {lowerPaneTab === 'panes' && (
              <>
            {/* Left Pane: htop System Monitor */}
            {(lowerSplitFocus === 'both' || lowerSplitFocus === 'htop') && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  borderRight: lowerSplitFocus === 'both' ? '1px solid #21262d' : 'none',
                  overflow: 'hidden',
                }}
              >
                {/* htop Header */}
                <div
                  style={{
                    height: '28px',
                    background: '#0d0f12',
                    borderBottom: '1px solid #21262d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#8b949e',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#29b6f6' }}>(&gt;)</span>
                    <span style={{ color: '#e8eaed', fontWeight: 600 }}>htop</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Maximize2
                      size={11}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setLowerSplitFocus(lowerSplitFocus === 'htop' ? 'both' : 'htop')}
                    />
                    <MoreHorizontal size={11} style={{ cursor: 'pointer' }} />
                    <X
                      size={11}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setLowerSplitFocus('nmap')}
                    />
                  </div>
                </div>

                {/* htop Body */}
                <div
                  style={{
                    flex: 1,
                    background: '#08090b',
                    padding: '8px 10px',
                    fontFamily: "'JetBrains Mono', Consolas, monospace",
                    fontSize: '11px',
                    color: '#e6edf3',
                    overflowY: 'auto',
                    userSelect: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* CPU & Memory Gauges */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <div>0 [|||||||||||||| <span style={{ color: '#21d477' }}>{cpuUsage.cpu0}%</span>] Tasks: 165, 548 thr, 1 runnin</div>
                        <div>1 [|||||||||||||| <span style={{ color: '#21d477' }}>{cpuUsage.cpu1}%</span>] Load average: 0.32 0.41 0.38</div>
                      </div>
                      <div>
                        <div>Mem[|||||||||||||| <span style={{ color: '#29b6f6' }}>{memUsage.used}/{memUsage.total}</span>] Uptime: {systemUptime}</div>
                        <div>Swp[               0K/8.0G]</div>
                      </div>
                    </div>

                    {/* Table Header */}
                    <div
                      style={{
                        background: '#29b6f6',
                        color: '#08090b',
                        padding: '2px 4px',
                        fontWeight: 700,
                        fontSize: '10.5px',
                        display: 'grid',
                        gridTemplateColumns: '45px 65px 30px 25px 45px 45px 45px 20px 40px 40px 50px 1fr',
                      }}
                    >
                      <span>PID</span>
                      <span>USER</span>
                      <span>PRI</span>
                      <span>NI</span>
                      <span>VIRT</span>
                      <span>RES</span>
                      <span>SHR</span>
                      <span>S</span>
                      <span>CPU%</span>
                      <span>MEM%</span>
                      <span>TIME+</span>
                      <span>Command</span>
                    </div>

                    {/* Process Rows */}
                    {(liveProcesses.length > 0
                      ? liveProcesses
                      : [
                          { pid: '8423', user: 'dualsurf', pri: '20', ni: '0', virt: '375M', res: '92084', shr: '51840', s: 'S', cpu: '5.2', mem: '0.6', time: '0:12.3', cmd: 'node /app/desktop' },
                          { pid: '1543', user: 'root', pri: '20', ni: '0', virt: '221M', res: '54160', shr: '24432', s: 'S', cpu: '3.1', mem: '0.3', time: '0:08.7', cmd: '/usr/lib/xorg/Xorg' },
                          { pid: '9956', user: 'dualsurf', pri: '20', ni: '0', virt: '512M', res: '123M', shr: '73400', s: 'S', cpu: '2.9', mem: '0.8', time: '0:21.7', cmd: 'chrome --type=renderer' },
                          { pid: '1032', user: 'root', pri: '20', ni: '0', virt: '197M', res: '49120', shr: '21200', s: 'S', cpu: '1.5', mem: '0.3', time: '0:05.1', cmd: 'NetworkManager --no-daemon' },
                          { pid: '2457', user: 'dualsurf', pri: '20', ni: '0', virt: '182M', res: '48240', shr: '29800', s: 'S', cpu: '1.3', mem: '0.3', time: '0:03.9', cmd: 'tilix --session' },
                          { pid: '661', user: 'root', pri: '39', ni: '19', virt: '87212', res: '15264', shr: '8320', s: 'S', cpu: '0.9', mem: '0.1', time: '0:02.1', cmd: '[kworker/u16:2]' },
                        ]
                    ).slice(0, 15).map((p) => (
                      <div
                        key={p.pid}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '45px 65px 30px 25px 45px 45px 45px 20px 40px 40px 50px 1fr',
                          padding: '1px 4px',
                          fontSize: '10.5px',
                          color: p.user === 'root' ? '#ff79c6' : '#29b6f6',
                        }}
                      >
                        <span style={{ color: '#21d477' }}>{p.pid}</span>
                        <span>{p.user}</span>
                        <span style={{ color: '#8b949e' }}>{p.pri}</span>
                        <span style={{ color: '#8b949e' }}>{p.ni}</span>
                        <span style={{ color: '#8b949e' }}>{p.virt}</span>
                        <span style={{ color: '#8b949e' }}>{p.res}</span>
                        <span style={{ color: '#8b949e' }}>{p.shr}</span>
                        <span>{p.s}</span>
                        <span style={{ color: '#21d477', fontWeight: 600 }}>{p.cpu}</span>
                        <span style={{ color: '#e8eaed' }}>{p.mem}</span>
                        <span style={{ color: '#8b949e' }}>{p.time}</span>
                        <span style={{ color: '#f8f8f2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cmd}</span>
                      </div>
                    ))}
                  </div>

                  {/* Function Keys Bar */}
                  <div
                    style={{
                      display: 'flex',
                      background: '#161b22',
                      fontSize: '9.5px',
                      color: '#8b949e',
                      borderTop: '1px solid #21262d',
                      paddingTop: '2px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span><strong style={{ color: '#29b6f6' }}>F1</strong>Help</span>
                    <span><strong style={{ color: '#29b6f6' }}>F2</strong>Setup</span>
                    <span><strong style={{ color: '#29b6f6' }}>F3</strong>Search</span>
                    <span><strong style={{ color: '#29b6f6' }}>F4</strong>Filter</span>
                    <span><strong style={{ color: '#29b6f6' }}>F5</strong>Tree</span>
                    <span><strong style={{ color: '#29b6f6' }}>F6</strong>SortBy</span>
                    <span><strong style={{ color: '#29b6f6' }}>F7</strong>Nice -</span>
                    <span><strong style={{ color: '#29b6f6' }}>F8</strong>Nice +</span>
                    <span><strong style={{ color: '#ff5555' }}>F9</strong>Kill</span>
                  </div>
                </div>
              </div>
            )}

            {/* Right Pane: nmap scan */}
            {(lowerSplitFocus === 'both' || lowerSplitFocus === 'nmap') && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  overflow: 'hidden',
                }}
              >
                {/* nmap Header */}
                <div
                  style={{
                    height: '28px',
                    background: '#0d0f12',
                    borderBottom: '1px solid #21262d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#8b949e',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#29b6f6' }}>(&gt;)</span>
                    <span style={{ color: '#e8eaed', fontWeight: 600 }}>nmap scan</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Maximize2
                      size={11}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setLowerSplitFocus(lowerSplitFocus === 'nmap' ? 'both' : 'nmap')}
                    />
                    <MoreHorizontal size={11} style={{ cursor: 'pointer' }} />
                    <X
                      size={11}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setLowerSplitFocus('htop')}
                    />
                  </div>
                </div>

                {/* nmap Body */}
                <div
                  ref={nmapTermContainerRef}
                  style={{
                    flex: 1,
                    background: '#08090b',
                    padding: '8px 10px',
                    overflow: 'hidden',
                  }}
                />
              </div>
            )}
              </>
            )}

            {/* Sprint 2: HTTP REPEATER TAB */}
            {lowerPaneTab === 'repeater' && (
              <div style={{ flex: 1, display: 'flex', height: '100%', background: '#08090b' }}>
                {/* Left: Request Editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #21262d', padding: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <select
                      value={repeaterMethod}
                      onChange={(e) => setRepeaterMethod(e.target.value)}
                      style={{ background: '#161b22', color: '#00ffc8', border: '1px solid #30363d', borderRadius: '3px', padding: '4px 8px', fontSize: '11px', fontWeight: 700 }}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                      <option value="OPTIONS">OPTIONS</option>
                      <option value="HEAD">HEAD</option>
                    </select>
                    <input
                      type="text"
                      value={repeaterUrl}
                      onChange={(e) => setRepeaterUrl(e.target.value)}
                      placeholder="https://target.corp/api/v1/resource"
                      style={{ flex: 1, background: '#161b22', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: '3px', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={handleSendRepeater}
                      disabled={repeaterLoading}
                      style={{ background: '#29b6f6', color: '#08090b', border: 'none', borderRadius: '3px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Send size={11} />
                      <span>{repeaterLoading ? 'Sending...' : 'Send'}</span>
                    </button>
                    <button
                      onClick={handleCopyAsCurl}
                      style={{ background: '#161b22', color: copiedCurl ? '#00ffc8' : '#8b949e', border: '1px solid #30363d', borderRadius: '3px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      title="Copy as cURL"
                    >
                      {copiedCurl ? <Check size={11} /> : <Copy size={11} />}
                      <span>cURL</span>
                    </button>
                  </div>

                  {/* Sub-tabs: Headers / Body */}
                  <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #21262d', paddingBottom: '4px', marginBottom: '6px' }}>
                    <button
                      onClick={() => setRepeaterSubTab('headers')}
                      style={{ background: 'transparent', border: 'none', color: repeaterSubTab === 'headers' ? '#29b6f6' : '#8b949e', fontSize: '10.5px', fontWeight: repeaterSubTab === 'headers' ? 600 : 400, cursor: 'pointer' }}
                    >
                      Headers
                    </button>
                    <button
                      onClick={() => setRepeaterSubTab('body')}
                      style={{ background: 'transparent', border: 'none', color: repeaterSubTab === 'body' ? '#29b6f6' : '#8b949e', fontSize: '10.5px', fontWeight: repeaterSubTab === 'body' ? 600 : 400, cursor: 'pointer' }}
                    >
                      Body
                    </button>
                  </div>

                  {repeaterSubTab === 'headers' ? (
                    <textarea
                      value={repeaterHeaders}
                      onChange={(e) => setRepeaterHeaders(e.target.value)}
                      placeholder="Header-Name: value&#10;Authorization: Bearer token"
                      style={{ flex: 1, background: '#0d1117', color: '#e6edf3', border: '1px solid #21262d', borderRadius: '3px', padding: '6px', fontSize: '11px', fontFamily: 'monospace', resize: 'none' }}
                    />
                  ) : (
                    <textarea
                      value={repeaterBody}
                      onChange={(e) => setRepeaterBody(e.target.value)}
                      placeholder='{\n  "payload": "example"\n}'
                      style={{ flex: 1, background: '#0d1117', color: '#e6edf3', border: '1px solid #21262d', borderRadius: '3px', padding: '6px', fontSize: '11px', fontFamily: 'monospace', resize: 'none' }}
                    />
                  )}
                </div>

                {/* Right: Response Viewer */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b949e' }}>Response:</span>
                      {repeaterResponse?.status ? (
                        <span style={{
                          background: repeaterResponse.status >= 200 && repeaterResponse.status < 300 ? '#238636' : (repeaterResponse.status >= 400 ? '#da3633' : '#d29922'),
                          color: '#fff',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontSize: '10px',
                          fontWeight: 700,
                        }}>
                          {repeaterResponse.status} {repeaterResponse.statusText}
                        </span>
                      ) : (
                        <span style={{ color: '#484f58', fontSize: '11px' }}>No response yet</span>
                      )}
                      {repeaterResponse?.latencyMs !== undefined && (
                        <span style={{ color: '#8b949e', fontSize: '10px' }}>({repeaterResponse.latencyMs}ms)</span>
                      )}
                    </div>
                    {repeaterResponse?.body && (
                      <button
                        onClick={handleCopyResponse}
                        style={{ background: '#161b22', color: copiedResp ? '#00ffc8' : '#8b949e', border: '1px solid #30363d', borderRadius: '3px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        {copiedResp ? <Check size={11} /> : <Copy size={11} />}
                        <span>Copy</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #21262d', paddingBottom: '4px', marginBottom: '6px' }}>
                    <button
                      onClick={() => setRepeaterRespSubTab('body')}
                      style={{ background: 'transparent', border: 'none', color: repeaterRespSubTab === 'body' ? '#29b6f6' : '#8b949e', fontSize: '10.5px', fontWeight: repeaterRespSubTab === 'body' ? 600 : 400, cursor: 'pointer' }}
                    >
                      Body
                    </button>
                    <button
                      onClick={() => setRepeaterRespSubTab('headers')}
                      style={{ background: 'transparent', border: 'none', color: repeaterRespSubTab === 'headers' ? '#29b6f6' : '#8b949e', fontSize: '10.5px', fontWeight: repeaterRespSubTab === 'headers' ? 600 : 400, cursor: 'pointer' }}
                    >
                      Headers
                    </button>
                  </div>

                  <div style={{ flex: 1, background: '#0d1117', border: '1px solid #21262d', borderRadius: '3px', padding: '6px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', color: '#e6edf3' }}>
                    {repeaterResponse?.error ? (
                      <div style={{ color: '#ff5555' }}>Error: {repeaterResponse.error}</div>
                    ) : repeaterRespSubTab === 'headers' && repeaterResponse?.headers ? (
                      <div>
                        {Object.entries(repeaterResponse.headers).map(([k, v]) => (
                          <div key={k} style={{ marginBottom: '2px' }}>
                            <span style={{ color: '#29b6f6' }}>{k}:</span> <span>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    ) : repeaterResponse?.body ? (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{repeaterResponse.body}</pre>
                    ) : (
                      <div style={{ color: '#484f58', textAlign: 'center', paddingTop: '40px' }}>
                        Configure request and press Send to inspect response.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sprint 2: BREAKPOINT INTERCEPT TAB */}
            {lowerPaneTab === 'intercept' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#08090b', padding: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #21262d', paddingBottom: '6px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={handleToggleBreakpoint}
                      style={{
                        background: isBreakpointOn ? '#da3633' : '#238636',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isBreakpointOn ? <Pause size={11} /> : <Play size={11} />}
                      <span>{isBreakpointOn ? 'INTERCEPT IS ON (PAUSING)' : 'INTERCEPT IS OFF'}</span>
                    </button>
                    <span style={{ fontSize: '11px', color: '#8b949e' }}>
                      {pendingIntercepts.length} request(s) held in breakpoint queue
                    </span>
                  </div>
                  {pendingIntercepts.length > 0 && (
                    <button
                      onClick={() => {
                        pendingIntercepts.forEach((p) => handleForwardIntercept(p.id));
                      }}
                      style={{ background: '#161b22', color: '#00ffc8', border: '1px solid #30363d', borderRadius: '3px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }}
                    >
                      Forward All
                    </button>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {pendingIntercepts.length === 0 ? (
                    <div style={{ color: '#484f58', textAlign: 'center', paddingTop: '40px', fontSize: '12px' }}>
                      No requests waiting at breakpoint. When Intercept is ON, in-flight browser requests will pause here for inspection &amp; tampering.
                    </div>
                  ) : (
                    pendingIntercepts.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          background: '#161b22',
                          border: '1px solid #30363d',
                          borderRadius: '4px',
                          padding: '8px 10px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ flex: 1, marginRight: '10px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span style={{ background: '#29b6f6', color: '#08090b', padding: '1px 5px', borderRadius: '2px', fontSize: '9.5px', fontWeight: 700 }}>
                              {req.method}
                            </span>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#f0f6fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {req.url}
                            </span>
                          </div>
                          <div style={{ fontSize: '10px', color: '#8b949e' }}>
                            Headers: {Object.keys(req.headers || {}).length} | Intercepted at: {new Date(req.timestamp).toLocaleTimeString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleForwardIntercept(req.id)}
                            style={{ background: '#238636', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 10px', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Forward
                          </button>
                          <button
                            onClick={() => handleDropIntercept(req.id)}
                            style={{ background: '#da3633', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 10px', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Drop
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Right Stacked Sidebar matching Screenshot 2 */}
      <aside
        style={{
          width: '290px',
          minWidth: '290px',
          background: '#0d0f12',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          userSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        {/* Section 1: 🧰 Toolbox */}
        <div style={{ padding: '14px', borderBottom: '1px solid #21262d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#e8eaed' }}>
              <Layers size={14} color="#8b949e" />
              <span>Toolbox</span>
            </div>
            <MoreHorizontal size={14} color="#6e7681" style={{ cursor: 'pointer' }} />
          </div>

          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#161b22',
              border: '1px solid #252a31',
              borderRadius: '6px',
              padding: '6px 10px',
              marginBottom: '12px',
            }}
          >
            <Search size={12} color="#6e7681" />
            <input
              type="text"
              value={toolSearch}
              onChange={(e) => setToolSearch(e.target.value)}
              placeholder="Search tools..."
              style={{
                background: 'transparent',
                border: 'none',
                color: '#e8eaed',
                fontSize: '11.5px',
                outline: 'none',
                width: '100%',
              }}
            />
          </div>

          {/* 4-Column Tool Shortcut Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {tools
              .filter((t) => t.name.toLowerCase().includes(toolSearch.toLowerCase()))
              .map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleRunTool(tool)}
                  title={`${tool.name} (${tool.installed ? 'Installed' : 'Configured'})`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    borderRadius: '6px',
                    background: '#161b22',
                    border: '1px solid #252a31',
                    cursor: 'pointer',
                    gap: '4px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = tool.color)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#252a31')}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Eye size={16} color={tool.color} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#c9d1d9', fontWeight: 500 }}>{tool.name}</span>
                </button>
              ))}
          </div>

          {/* Open Tools Library Button */}
          <button
            onClick={() => handleRunTool({ id: 'all', name: 'Tools', bin: 'dualsurf', command: 'dualsurf kali metapackages', color: '#29b6f6' })}
            style={{
              width: '100%',
              background: '#161b22',
              border: '1px solid #252a31',
              borderRadius: '6px',
              padding: '7px 0',
              color: '#e8eaed',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>Open Tools Library</span>
            <ArrowRight size={12} color="#8b949e" />
          </button>
        </div>

        {/* Section 2: 📁 Files */}
        <div style={{ padding: '14px', borderBottom: '1px solid #21262d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#e8eaed' }}>
              <Folder size={14} color="#8b949e" />
              <span>Files</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw
                size={12}
                color="#6e7681"
                style={{ cursor: 'pointer' }}
                onClick={() => loadFiles(rawPath || undefined)}
                title="Refresh Files"
              />
              <Upload size={13} color="#6e7681" style={{ cursor: 'pointer' }} title="Import / Upload" />
              <MoreHorizontal size={14} color="#6e7681" style={{ cursor: 'pointer' }} />
            </div>
          </div>

          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#8b949e', marginBottom: '8px' }}>
            {currentPath}
          </div>

          {/* Table Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#6e7681',
              paddingBottom: '4px',
              borderBottom: '1px solid #1f242c',
              marginBottom: '4px',
            }}
          >
            <span>Name</span>
            <span>Modified</span>
          </div>

          {/* Parent dir link if applicable */}
          {parentPath && (
            <div
              onClick={() => handleNavigateFolder('..')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '3px 2px',
                fontSize: '11px',
                fontFamily: 'monospace',
                cursor: 'pointer',
                borderRadius: '4px',
                color: '#29b6f6',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Folder size={12} color="#29b6f6" />
                <span>.. (Up)</span>
              </div>
            </div>
          )}

          {/* File Rows */}
          {files.map((f) => (
            <div
              key={f.name}
              onClick={() => {
                if (f.isDir) {
                  handleNavigateFolder(f.name);
                } else if (mainTermRef.current) {
                  mainTermRef.current.writeln(`\r\n\x1b[36m$ cat "${f.name}"\x1b[0m`);
                  window.dualsurf?.ptyWrite?.(activeSessionId, `cat "${f.name}"\n`);
                }
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 2px',
                fontSize: '11px',
                fontFamily: 'monospace',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#161b22')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                {f.isDir ? (
                  <Folder size={12} color="#29b6f6" fill="#29b6f6" />
                ) : (
                  <FileText size={12} color="#8b949e" />
                )}
                <span
                  style={{
                    color: '#e8eaed',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '170px',
                  }}
                >
                  {f.name}
                </span>
              </div>
              <span style={{ color: '#6e7681', fontSize: '10px', flexShrink: 0 }}>{f.modified}</span>
            </div>
          ))}
        </div>

        {/* Section 3: 📋 Sessions */}
        <div style={{ padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#e8eaed' }}>
              <TermIcon size={14} color="#8b949e" />
              <span>Sessions</span>
            </div>
            <Plus size={14} color="#6e7681" style={{ cursor: 'pointer' }} onClick={handleCreateSession} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sessions.map((s) => {
              const isActive = activeSessionId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: isActive ? '#161b22' : 'transparent',
                    border: isActive ? '1px solid rgba(41, 182, 246, 0.3)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = '#111418';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isActive ? (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#21d477',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '11px', color: '#6e7681' }}>{s.icon || '○'}</span>
                    )}
                    <span style={{ fontSize: '11.5px', fontFamily: 'monospace', color: isActive ? '#ffffff' : '#8b949e', fontWeight: isActive ? 600 : 400 }}>
                      {s.name} ({s.cwd})
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#6e7681', fontFamily: 'monospace' }}>
                    {getSessionDuration(s.startedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
};
