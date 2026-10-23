import React from 'react';
import type { TabState, ActiveSessionState } from '@dualsurf/shared-types';
import { DualSurfTerminalWorkspace } from './DualSurfTerminalWorkspace';

interface TerminalModeProps {
  activeTab: TabState | null;
  activeSession?: ActiveSessionState;
  initialCommand?: string;
  onClearInitialCommand?: () => void;
  onSwitchToGui: () => void;
  onFollowLink?: (linkId: number) => void;
}

export const TerminalMode: React.FC<TerminalModeProps> = ({
  activeTab,
  activeSession,
  initialCommand,
  onClearInitialCommand,
  onSwitchToGui,
}) => {
  return (
    <div className="terminal-mode-root dualsurf-terminal-workspace terminal-workspace-container" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <DualSurfTerminalWorkspace
        activeTab={activeTab}
        activeSession={activeSession}
        onSwitchToGui={onSwitchToGui}
        externalInput={initialCommand}
        onClearExternalInput={onClearInitialCommand}
      />
    </div>
  );
};
