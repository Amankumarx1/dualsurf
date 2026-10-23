import React from 'react';
import { X, Network, ExternalLink, Shield } from 'lucide-react';
import { AttackSurfaceVisualizer } from './AttackSurfaceVisualizer';
import type { PageMetadata, TabState } from '@dualsurf/shared-types';

interface AttackSurfaceGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: PageMetadata | null;
  activeTab: TabState | undefined;
  onOpenUrl: (url: string) => void;
  onRunAudit: (target: string) => void;
}

export const AttackSurfaceGraphModal: React.FC<AttackSurfaceGraphModalProps> = ({
  isOpen,
  onClose,
  metadata,
  activeTab,
  onOpenUrl,
  onRunAudit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="attack-surface-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="attack-modal-header">
          <div className="attack-title-group">
            <div className="attack-icon-halo">
              <Network size={20} className="text-cyan" />
            </div>
            <div>
              <h2 className="attack-modal-title">Interactive Attack Surface Visualizer</h2>
              <p className="attack-modal-subtitle">
                Target: <span className="text-cyan">{metadata?.url || activeTab?.url || 'Active Page'}</span> • Graph topology of endpoints, subdomains &amp; APIs
              </p>
            </div>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="attack-surface-modal-body">
          <AttackSurfaceVisualizer
            metadata={metadata}
            onOpenUrl={onOpenUrl}
            onRunAudit={onRunAudit}
          />
        </div>

        <div className="attack-modal-footer">
          <div className="attack-footer-note">
            <Shield size={14} className="text-cyan" />
            <span>Click any node to copy asset URL or pivot reconnaissance tools in terminal.</span>
          </div>
          <button className="proxy-done-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
