import React from 'react';
import {
  Home,
  Bookmark,
  History,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Network,
  GitBranch,
  RotateCcw,
  TerminalSquare,
  Folder,
  Info,
  Crosshair,
  ShieldCheck,
  Layers,
  Terminal,
} from 'lucide-react';

interface SidebarProps {
  mode: 'gui' | 'terminal';
  activeSection: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectSection: (section: string) => void;
  onSwitchMode: (mode: 'gui' | 'terminal') => void;
  onOpenSettings: () => void;
  onOpenAbout?: () => void;
  onOpenHistory?: () => void;
  onOpenBookmarks?: () => void;
  onOpenDownloads?: () => void;
  onOpenTools?: () => void;
  onOpenNetwork?: () => void;
  onOpenProxy?: () => void;
  onOpenRepeater?: () => void;
  onOpenRedTeam?: () => void;
  onOpenBlueTeam?: () => void;
  onOpenPurpleTeam?: () => void;
  onOpenTabSearch?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mode,
  activeSection,
  isCollapsed = false,
  onToggleCollapse,
  onSelectSection,
  onSwitchMode,
  onOpenSettings,
  onOpenAbout,
  onOpenHistory,
  onOpenBookmarks,
  onOpenDownloads,
  onOpenTools,
  onOpenNetwork,
  onOpenProxy,
  onOpenRepeater,
  onOpenRedTeam,
  onOpenBlueTeam,
  onOpenPurpleTeam,
  onOpenTabSearch,
}) => {
  const isTerminal = mode === 'terminal';

  const navGroups = [
    {
      title: 'BROWSER',
      items: [
        {
          id: 'home',
          label: 'Home',
          icon: Home,
          action: () => {
            onSelectSection('home');
            if (isTerminal) onSwitchMode('gui');
          },
          isActive: !isTerminal && activeSection === 'home',
        },
        {
          id: 'terminal',
          label: 'Kali Terminal',
          icon: Terminal,
          action: () => {
            onSelectSection('terminal');
            onSwitchMode('terminal');
          },
          isActive: isTerminal,
        },
        {
          id: 'bookmarks',
          label: 'Bookmarks',
          icon: Bookmark,
          action: () => {
            onSelectSection('bookmarks');
            onOpenBookmarks?.();
          },
          isActive: activeSection === 'bookmarks',
        },
        {
          id: 'history',
          label: 'History',
          icon: History,
          action: () => {
            onSelectSection('history');
            onOpenHistory?.();
          },
          isActive: activeSection === 'history',
        },
        {
          id: 'downloads',
          label: 'Downloads',
          icon: Download,
          action: () => {
            onSelectSection('downloads');
            onOpenDownloads?.();
          },
          isActive: activeSection === 'downloads',
        },
      ],
    },
    {
      title: 'WORKSPACE',
      items: [
        {
          id: 'tools',
          label: 'Tools',
          icon: Wrench,
          action: () => {
            onSelectSection('tools');
            onOpenTools?.();
          },
          isActive: activeSection === 'tools',
        },
        {
          id: 'network',
          label: 'Network',
          icon: Network,
          action: () => {
            onSelectSection('network');
            onOpenNetwork?.();
          },
          isActive: activeSection === 'network',
        },
        {
          id: 'proxy',
          label: 'Proxy',
          icon: GitBranch,
          action: () => {
            onSelectSection('proxy');
            onOpenProxy?.();
          },
          isActive: activeSection === 'proxy',
        },
        {
          id: 'repeater',
          label: 'Repeater',
          icon: RotateCcw,
          action: () => {
            onSelectSection('repeater');
            onOpenRepeater?.();
          },
          isActive: activeSection === 'repeater',
        },
      ],
    },
    {
      title: 'SECURITY OPS',
      items: [
        {
          id: 'red-team',
          label: 'Red Team',
          icon: Crosshair,
          action: () => {
            onSelectSection('red-team');
            onOpenRedTeam?.();
          },
          isActive: activeSection === 'red-team',
        },
        {
          id: 'blue-team',
          label: 'Blue Team',
          icon: ShieldCheck,
          action: () => {
            onSelectSection('blue-team');
            onOpenBlueTeam?.();
          },
          isActive: activeSection === 'blue-team',
        },
        {
          id: 'purple-team',
          label: 'Purple Team',
          icon: Layers,
          action: () => {
            onSelectSection('purple-team');
            onOpenPurpleTeam?.();
          },
          isActive: activeSection === 'purple-team',
        },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        {
          id: 'sessions',
          label: 'Sessions',
          icon: TerminalSquare,
          action: () => {
            onSelectSection('sessions');
            onOpenTabSearch?.();
          },
          isActive: activeSection === 'sessions',
        },
        {
          id: 'files',
          label: 'Files',
          icon: Folder,
          action: () => {
            onSelectSection('files');
            onOpenDownloads?.();
          },
          isActive: activeSection === 'files',
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          action: () => {
            onSelectSection('settings');
            onOpenSettings();
          },
          isActive: activeSection === 'settings',
        },
        {
          id: 'about',
          label: 'About',
          icon: Info,
          action: () => {
            onSelectSection('about');
            onOpenAbout?.();
          },
          isActive: activeSection === 'about',
        },
      ],
    },
  ];

  return (
    <aside
      className={`dualsurf-sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}
      style={{
        width: isCollapsed ? '54px' : '176px',
        minWidth: isCollapsed ? '54px' : '176px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        userSelect: 'none',
        transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        overflowX: 'hidden',
        overflowY: 'auto',
        boxSizing: 'border-box',
        padding: '12px 6px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {navGroups.map((group) => (
          <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {!isCollapsed && (
              <div
                className="sidebar-heading"
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                  padding: '2px 10px 4px 10px',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                }}
              >
                {group.title}
              </div>
            )}

            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  title={item.label}
                  className={`sidebar-nav-item ${item.isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isCollapsed ? '0' : '10px',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '8px 0' : '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: item.isActive ? 600 : 400,
                    cursor: 'pointer',
                    outline: 'none',
                    textAlign: 'left',
                    transition: 'all 0.12s ease',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <Icon
                    size={15}
                    className="sidebar-nav-icon"
                    strokeWidth={item.isActive ? 2.2 : 1.8}
                  />
                  {!isCollapsed && (
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom collapse / expand toggle matching Screenshot 2 */}
      <div
        className="sidebar-collapse-container"
        style={{
          paddingTop: '8px',
          marginTop: '8px',
          display: 'flex',
          justifyContent: isCollapsed ? 'center' : 'flex-end',
          paddingRight: isCollapsed ? '0' : '8px',
        }}
      >
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="sidebar-collapse-btn"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
        >
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
};

