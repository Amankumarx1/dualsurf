import React, { useState, useEffect } from 'react';
import { Target, Shield, Play, RotateCcw, Camera, CheckCircle, AlertTriangle, Terminal, Plus } from 'lucide-react';
import type { LabEnvironmentProfile } from '@dualsurf/shared-types';

interface LabManagerWorkspaceProps {
  onRunInTerminal?: (command: string) => void;
}

export const LabManagerWorkspace: React.FC<LabManagerWorkspaceProps> = ({ onRunInTerminal }) => {
  const [labs, setLabs] = useState<LabEnvironmentProfile[]>([]);
  const [selectedLab, setSelectedLab] = useState<LabEnvironmentProfile | null>(null);

  useEffect(() => {
    if (window.dualsurf?.getKaliLabs) {
      window.dualsurf.getKaliLabs().then((data) => {
        setLabs(data);
        if (data.length > 0) setSelectedLab(data[0]);
      }).catch(console.error);
    }
  }, []);

  const handleLaunchScan = (lab: LabEnvironmentProfile) => {
    onRunInTerminal?.(`nmap -sV -Pn ${lab.targetHost}`);
  };

  const handleRevertSnapshot = (lab: LabEnvironmentProfile, snapshot: string) => {
    onRunInTerminal?.(`echo "[Lab Manager] Reverting ${lab.name} to snapshot '${snapshot}'..."`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c1017', color: '#e6edf3', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#00d2ff' }}>
          <Target size={20} />
          <span>Lab & Snapshot Environment Manager</span>
        </h2>
        <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
          Isolated targets with enforced Rules of Engagement (RoE), VM snapshots, and disposable environment resets
        </div>
      </div>

      {/* Lab Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {labs.map((lab) => {
          const isSelected = selectedLab?.id === lab.id;
          return (
            <div
              key={lab.id}
              onClick={() => setSelectedLab(lab)}
              style={{
                background: isSelected ? '#161e2e' : '#131822',
                border: isSelected ? '1px solid #00d2ff' : '1px solid #21262d',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#f8f8f2' }}>{lab.name}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: lab.status === 'running' ? 'rgba(63,185,80,0.15)' : 'rgba(139,148,158,0.15)',
                    color: lab.status === 'running' ? '#3fb950' : '#8b949e',
                    fontWeight: 600,
                  }}
                >
                  {lab.status.toUpperCase()}
                </span>
              </div>

              <div style={{ fontSize: '12px', color: '#8b949e' }}>{lab.description}</div>

              <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#00ffc8' }}>
                TARGET: {lab.targetHost}
              </div>

              {/* RoE Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#79c0ff', background: 'rgba(56,139,253,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                <Shield size={12} />
                <span>RoE: {lab.scope}</span>
              </div>

              {/* Snapshots */}
              <div style={{ borderTop: '1px solid #21262d', paddingTop: '8px' }}>
                <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Camera size={11} />
                  <span>Available Snapshots:</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {lab.snapshots.map((snap) => (
                    <button
                      key={snap}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRevertSnapshot(lab, snap);
                      }}
                      style={{
                        background: '#21262d',
                        border: '1px solid #30363d',
                        color: '#c9d1d9',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <RotateCcw size={10} />
                      <span>{snap}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLaunchScan(lab);
                  }}
                  style={{
                    flex: 1,
                    background: '#00d2ff',
                    border: 'none',
                    color: '#0c1017',
                    padding: '6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Play size={11} fill="#0c1017" />
                  <span>Scan Target</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
