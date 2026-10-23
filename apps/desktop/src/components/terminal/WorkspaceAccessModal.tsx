import React, { useState, useEffect } from 'react';
import {
  FolderLock,
  FolderOpen,
  ShieldCheck,
  Terminal,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HardDrive,
  Sparkles,
  X,
} from 'lucide-react';

interface WorkspaceAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSandboxDir?: string;
  onGrantAccess: (selectedPath: string) => Promise<void>;
  forcePrompt?: boolean;
}

export const WorkspaceAccessModal: React.FC<WorkspaceAccessModalProps> = ({
  isOpen,
  onClose,
  currentSandboxDir,
  onGrantAccess,
  forcePrompt = false,
}) => {
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (currentSandboxDir) {
        setSelectedPath(currentSandboxDir);
      } else {
        // Pre-fill with a sensible default path
        setSelectedPath('~/DualSurf-Kali-Workspace');
      }
    }
  }, [isOpen, currentSandboxDir]);

  if (!isOpen) return null;

  const handleBrowseFolder = async () => {
    setIsSelecting(true);
    setErrorMsg(null);
    try {
      if (window.dualsurf?.selectFolder) {
        const res = await window.dualsurf.selectFolder('Select Kali Workspace Sandbox Directory');
        if (res?.success && res.path) {
          setSelectedPath(res.path);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Folder selection failed');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleUseDefault = () => {
    setSelectedPath('~/DualSurf-Kali-Workspace');
  };

  const handleSubmit = async () => {
    if (!selectedPath.trim()) {
      setErrorMsg('Please select a folder for the Kali workspace sandbox.');
      return;
    }
    setIsApplying(true);
    setErrorMsg(null);
    try {
      await onGrantAccess(selectedPath.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to grant workspace directory access.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      className="modal-overlay workspace-access-overlay"
      onClick={forcePrompt ? undefined : onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 8, 14, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="workspace-access-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'linear-gradient(180deg, #101622 0%, #0a0d14 100%)',
          border: '1px solid rgba(0, 164, 228, 0.35)',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75), 0 0 32px rgba(0, 164, 228, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header Strip */}
        <div
          style={{
            padding: '20px 24px 16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            background: 'rgba(0, 164, 228, 0.04)',
          }}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(0, 164, 228, 0.2) 0%, rgba(34, 197, 94, 0.15) 100%)',
                border: '1px solid rgba(0, 164, 228, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00a4e4',
                boxShadow: '0 0 16px rgba(0, 164, 228, 0.25)',
              }}
            >
              <FolderLock size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    color: '#00a4e4',
                    background: 'rgba(0, 164, 228, 0.12)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(0, 164, 228, 0.25)',
                  }}
                >
                  Kali Linux Sandbox
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    color: '#22c55e',
                    background: 'rgba(34, 197, 94, 0.12)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                  }}
                >
                  WSL Jail
                </span>
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#f8fafc',
                  letterSpacing: '-0.3px',
                }}
              >
                Grant Workspace Directory Access
              </h2>
            </div>
          </div>

          {!forcePrompt && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease',
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#94a3b8',
            }}
          >
            DualSurf requires full read/write and execution permissions for a dedicated workspace folder.
            This directory will act as your <strong style={{ color: '#00a4e4' }}>Kali Linux root filesystem (<code style={{ color: '#22c55e' }}>/</code> and <code style={{ color: '#22c55e' }}>~</code>)</strong>.
            Inside this folder, you have complete access through the Kali terminal. 
            <strong style={{ color: '#f1f5f9' }}> All operations are strictly jailed to this folder, preventing access to the rest of your computer.</strong>
          </p>

          {/* Directory Picker Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <HardDrive size={13} color="#00a4e4" />
              <span>Workspace Root Folder (Sandbox Directory):</span>
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                placeholder="C:\Users\...\DualSurf-Workspace"
                style={{
                  flex: 1,
                  background: '#0d121c',
                  border: '1px solid rgba(0, 164, 228, 0.3)',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '12.5px',
                  color: '#f8fafc',
                  fontFamily: "'JetBrains Mono', Consolas, monospace",
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                disabled={isSelecting}
                style={{
                  background: 'rgba(0, 164, 228, 0.12)',
                  border: '1px solid rgba(0, 164, 228, 0.4)',
                  borderRadius: '6px',
                  color: '#00a4e4',
                  padding: '0 16px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <FolderOpen size={14} />
                <span>Browse...</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                All Kali scripts, tools, and downloads will execute here.
              </span>
              <button
                type="button"
                onClick={handleUseDefault}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#00a4e4',
                  fontSize: '11px',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Use default (~/DualSurf-Kali-Workspace)
              </button>
            </div>
          </div>

          {/* Sandbox Security Features Callout */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#22c55e' }}>
              <ShieldCheck size={14} />
              <span>Full read, write, script execution &amp; package installations granted</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#00a4e4' }}>
              <Terminal size={14} />
              <span>Genuine Kali Linux prompt: <code style={{ color: '#00ffc8' }}>┌──(kali㉿dualsurf)-[~]</code></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#eab308' }}>
              <Lock size={14} />
              <span>Strict jail: <code style={{ color: '#cbd5e1' }}>cd ..</code> and paths outside this folder are blocked</span>
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#f87171',
                fontSize: '12px',
              }}
            >
              <AlertTriangle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          {!forcePrompt && (
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#cbd5e1',
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isApplying || !selectedPath.trim()}
            style={{
              background: 'linear-gradient(135deg, #00a4e4 0%, #0077b6 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              padding: '8px 20px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: isApplying ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(0, 164, 228, 0.35)',
              transition: 'opacity 0.15s ease',
              opacity: isApplying || !selectedPath.trim() ? 0.6 : 1,
            }}
          >
            {isApplying ? (
              <span>Configuring Kali Sandbox...</span>
            ) : (
              <>
                <span>Grant Full Access &amp; Launch Terminal</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
