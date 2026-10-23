import React, { useState, useEffect, useCallback } from 'react';
import {
  Terminal as TermIcon,
  Wifi,
  Globe,
  Search,
  Cpu,
  Cloud,
  Target,
  Bot,
  Package,
  Columns,
  Plus,
  X,
  ChevronDown,
  Layers,
  ArrowRight,
  Maximize2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import type { TabState, ActiveSessionState, KaliRuntimeProfile, SpecialistWorkspaceMode } from '@dualsurf/shared-types';
import { XTermPanel } from './XTermPanel';
import { NetworkWorkspace } from './workspaces/NetworkWorkspace';
import { WebApiWorkspace } from './workspaces/WebApiWorkspace';
import { ForensicsWorkspace } from './workspaces/ForensicsWorkspace';
import { ReverseEngineeringWorkspace } from './workspaces/ReverseEngineeringWorkspace';
import { CloudContainerWorkspace } from './workspaces/CloudContainerWorkspace';
import { LabManagerWorkspace } from './workspaces/LabManagerWorkspace';
import { CopilotPanel } from './workspaces/CopilotPanel';
import { MetapackagesModal } from './workspaces/MetapackagesModal';

interface RealTerminalWorkspaceProps {
  activeTab: TabState | null;
  activeSession?: ActiveSessionState;
  onSwitchToGui: () => void;
  onSwitchToClassicConsole?: () => void;
  externalInput?: string;
  onClearExternalInput?: () => void;
}

export const RealTerminalWorkspace: React.FC<RealTerminalWorkspaceProps> = ({
  activeTab,
  activeSession,
  onSwitchToGui,
  onSwitchToClassicConsole,
  externalInput,
  onClearExternalInput,
}) => {
  // Navigation State
  const [activeWorkspace, setActiveWorkspace] = useState<SpecialistWorkspaceMode>('terminal');
  const [runtimes, setRuntimes] = useState<KaliRuntimeProfile[]>([]);
  const [activeRuntime, setActiveRuntime] = useState<KaliRuntimeProfile | null>(null);
  const [isRuntimeMenuOpen, setIsRuntimeMenuOpen] = useState<boolean>(false);
  const [isMetapackagesOpen, setIsMetapackagesOpen] = useState<boolean>(false);

  // Terminal Sessions
  const [sessions, setSessions] = useState<string[]>(['session-1']);
  const [activeSessionId, setActiveSessionId] = useState<string>('session-1');
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const [splitSessionId, setSplitSessionId] = useState<string>('session-2');

  // Load available runtimes from backend
  useEffect(() => {
    if (window.dualsurf?.getKaliRuntimes) {
      window.dualsurf
        .getKaliRuntimes()
        .then((items) => {
          setRuntimes(items);
          const active = items.find((r) => r.isDefault) || items[0];
          if (active) setActiveRuntime(active);
        })
        .catch(console.error);
    }
  }, []);

  // Handle incoming external input
  useEffect(() => {
    if (externalInput && window.dualsurf?.ptyWrite) {
      window.dualsurf.ptyWrite(activeSessionId, externalInput + '\n');
      onClearExternalInput?.();
    }
  }, [externalInput, activeSessionId, onClearExternalInput]);

  const handleSelectRuntime = async (runtime: KaliRuntimeProfile) => {
    setIsRuntimeMenuOpen(false);
    setActiveRuntime(runtime);
    if (window.dualsurf?.setActiveKaliRuntime) {
      await window.dualsurf.setActiveKaliRuntime(runtime.id);
    }
  };

  const handleCreateSession = () => {
    const nextNum = sessions.length + 1;
    const newId = `session-${nextNum}`;
    setSessions((prev) => [...prev, newId]);
    setActiveSessionId(newId);
  };

  const handleCloseSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) return; // Keep at least one session

    const filtered = sessions.filter((s) => s !== id);
    setSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0]);
    }
    if (splitSessionId === id) {
      setSplitSessionId(filtered[filtered.length - 1]);
    }
    if (window.dualsurf?.ptyKill) {
      window.dualsurf.ptyKill(id).catch(() => {});
    }
  };

  const handleRunInTerminal = useCallback(
    (command: string) => {
      setActiveWorkspace('terminal');
      if (window.dualsurf?.ptyWrite) {
        window.dualsurf.ptyWrite(activeSessionId, command + '\n');
      }
    },
    [activeSessionId]
  );

  const navItems = [
    { id: 'terminal', label: 'Kali Shells', icon: TermIcon },
    { id: 'network', label: 'Network & PCAP', icon: Wifi },
    { id: 'web', label: 'Web & API', icon: Globe },
    { id: 'forensics', label: 'Forensics / DFIR', icon: Search },
    { id: 'reverse', label: 'Reverse Eng', icon: Cpu },
    { id: 'cloud', label: 'Containers & Cloud', icon: Cloud },
    { id: 'labs', label: 'Lab Environments', icon: Target },
    { id: 'copilot', label: 'AI Copilot', icon: Bot },
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        background: '#0c1017',
        color: '#e6edf3',
        overflow: 'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* 1. Left Specialist & Runtime Navigation Sidebar */}
      <div
        style={{
          width: '210px',
          background: '#0e131d',
          borderRight: '1px solid #21262d',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        {/* Top: Workstation Brand & Runtime Selector */}
        <div>
          {/* Header Brand */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #21262d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#00ffc8',
                  boxShadow: '0 0 8px #00ffc8',
                }}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '0.5px',
                  background: 'linear-gradient(90deg, #00d2ff 0%, #00ffc8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                DUALSURF KALI
              </span>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <span
                onClick={onSwitchToGui}
                title="Return to Browser Mode"
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#ff5f56',
                  cursor: 'pointer',
                  display: 'inline-block',
                }}
              />
            </div>
          </div>

          {/* Runtime Selector Pill */}
          <div style={{ padding: '8px 10px', position: 'relative' }}>
            <button
              onClick={() => setIsRuntimeMenuOpen((prev) => !prev)}
              style={{
                width: '100%',
                background: '#161b22',
                border: '1px solid #30363d',
                color: '#e6edf3',
                padding: '6px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <Layers size={12} color="#00d2ff" />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {activeRuntime ? activeRuntime.name : 'Detecting Linux...'}
                </span>
              </div>
              <ChevronDown size={12} color="#8b949e" />
            </button>

            {/* Runtime Dropdown Menu */}
            {isRuntimeMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '40px',
                  left: '10px',
                  right: '10px',
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '6px 10px', fontSize: '10px', color: '#8b949e', borderBottom: '1px solid #21262d' }}>
                  AVAILABLE LINUX RUNTIMES
                </div>
                {runtimes.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRuntime(r)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      background: activeRuntime?.id === r.id ? '#1f242c' : 'transparent',
                      color: activeRuntime?.id === r.id ? '#00ffc8' : '#c9d1d9',
                      borderBottom: '1px solid #21262d',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: '9px', color: '#8b949e' }}>
                      {r.type.toUpperCase()} | {r.distro || r.shell}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Specialist Workspaces Nav */}
          <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ padding: '4px 8px', fontSize: '10px', color: '#484f58', fontWeight: 600 }}>
              SECURITY WORKSPACES
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeWorkspace === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveWorkspace(item.id as SpecialistWorkspaceMode)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: isSelected ? '#1c2128' : 'transparent',
                    color: isSelected ? '#00d2ff' : '#8b949e',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={14} color={isSelected ? '#00ffc8' : '#8b949e'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Sidebar Controls */}
        <div style={{ padding: '10px', borderTop: '1px solid #21262d', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Metapackages Button */}
          <button
            onClick={() => setIsMetapackagesOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #30363d',
              background: '#161b22',
              color: '#c9d1d9',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <Package size={13} color="#00d2ff" />
            <span>Kali Metapackages</span>
          </button>

          {/* Browser Bridge Notice */}
          {activeTab?.url && activeTab.url !== 'about:blank' && (
            <div
              onClick={() => handleRunInTerminal(`curl -I "${activeTab.url}"`)}
              title="Click to probe active URL in Kali shell"
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                background: 'rgba(0, 210, 255, 0.08)',
                border: '1px solid rgba(0, 210, 255, 0.2)',
                color: '#00d2ff',
                fontSize: '10px',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowRight size={10} />
                <span>Active Target</span>
              </div>
              <div style={{ fontFamily: 'monospace', color: '#8b949e' }}>
                {activeTab.url.replace(/^https?:\/\//, '').split('/')[0]}
              </div>
            </div>
          )}

          {/* Switch to Classic Console if requested */}
          {onSwitchToClassicConsole && (
            <button
              onClick={onSwitchToClassicConsole}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '4px 6px',
                background: 'transparent',
                border: 'none',
                color: '#484f58',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              <span>Classic Console</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Central Work Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Top Session & View Bar */}
        <div
          style={{
            height: '38px',
            background: '#131822',
            borderBottom: '1px solid #21262d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            userSelect: 'none',
          }}
        >
          {/* Terminal Tabs (when in terminal mode) or Current Workspace Title */}
          {activeWorkspace === 'terminal' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
              {sessions.map((sId) => {
                const isActive = activeSessionId === sId;
                return (
                  <div
                    key={sId}
                    onClick={() => setActiveSessionId(sId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      background: isActive ? '#0c1017' : '#161b22',
                      borderTop: isActive ? '2px solid #00d2ff' : '2px solid transparent',
                      borderRadius: '4px 4px 0 0',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: isActive ? '#00ffc8' : '#8b949e',
                      cursor: 'pointer',
                    }}
                  >
                    <TermIcon size={12} />
                    <span>{sId}</span>
                    {sessions.length > 1 && (
                      <X
                        size={11}
                        onClick={(e) => handleCloseSession(sId, e)}
                        style={{ color: '#484f58', cursor: 'pointer' }}
                      />
                    )}
                  </div>
                );
              })}

              <button
                onClick={handleCreateSession}
                title="New Shell Session"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#8b949e',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Workspace:</span>
              <span style={{ color: '#00d2ff' }}>{navItems.find((n) => n.id === activeWorkspace)?.label}</span>
            </div>
          )}

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeWorkspace === 'terminal' && (
              <button
                onClick={() => {
                  if (!isSplitView) {
                    // If creating split view, ensure a second session exists
                    if (!sessions.includes('session-2')) {
                      setSessions((prev) => [...prev, 'session-2']);
                    }
                    setSplitSessionId('session-2');
                  }
                  setIsSplitView((prev) => !prev);
                }}
                title={isSplitView ? 'Collapse to Single Pane' : 'Split Terminal Vertically'}
                style={{
                  background: isSplitView ? '#1f242c' : 'transparent',
                  border: isSplitView ? '1px solid #00d2ff' : '1px solid transparent',
                  color: isSplitView ? '#00d2ff' : '#8b949e',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Columns size={12} />
                <span>{isSplitView ? 'Split (2x)' : 'Split'}</span>
              </button>
            )}

            <button
              onClick={onSwitchToGui}
              title="Switch to Browser Mode"
              style={{
                background: '#21262d',
                border: '1px solid #30363d',
                color: '#c9d1d9',
                cursor: 'pointer',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              Browser Mode
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, height: 'calc(100% - 38px)', position: 'relative', overflow: 'hidden' }}>
          {/* Terminal Mode */}
          {activeWorkspace === 'terminal' && (
            <div
              style={{
                display: 'flex',
                height: '100%',
                width: '100%',
                overflow: 'hidden',
              }}
            >
              {/* Primary Pane */}
              <div style={{ flex: 1, height: '100%', position: 'relative' }}>
                <XTermPanel
                  sessionId={activeSessionId}
                  runtimeId={activeRuntime?.id}
                  runtimeName={activeRuntime?.name}
                  isActive={true}
                />
              </div>

              {/* Split Secondary Pane (if enabled) */}
              {isSplitView && (
                <div
                  style={{
                    flex: 1,
                    height: '100%',
                    borderLeft: '2px solid #21262d',
                    position: 'relative',
                  }}
                >
                  <XTermPanel
                    sessionId={splitSessionId}
                    runtimeId={activeRuntime?.id}
                    runtimeName={activeRuntime?.name}
                    isActive={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Specialist Workspaces */}
          {activeWorkspace === 'network' && (
            <NetworkWorkspace onRunInTerminal={handleRunInTerminal} activeUrl={activeTab?.url} />
          )}

          {activeWorkspace === 'web' && (
            <WebApiWorkspace onRunInTerminal={handleRunInTerminal} activeUrl={activeTab?.url} />
          )}

          {activeWorkspace === 'forensics' && (
            <ForensicsWorkspace onRunInTerminal={handleRunInTerminal} />
          )}

          {activeWorkspace === 'reverse' && (
            <ReverseEngineeringWorkspace onRunInTerminal={handleRunInTerminal} />
          )}

          {activeWorkspace === 'cloud' && (
            <CloudContainerWorkspace onRunInTerminal={handleRunInTerminal} />
          )}

          {activeWorkspace === 'labs' && (
            <LabManagerWorkspace onRunInTerminal={handleRunInTerminal} />
          )}

          {activeWorkspace === 'copilot' && (
            <CopilotPanel onRunInTerminal={handleRunInTerminal} activeUrl={activeTab?.url} />
          )}
        </div>
      </div>

      {/* 3. Metapackages Modal */}
      <MetapackagesModal
        isOpen={isMetapackagesOpen}
        onClose={() => setIsMetapackagesOpen(false)}
        onRunInTerminal={handleRunInTerminal}
      />
    </div>
  );
};
