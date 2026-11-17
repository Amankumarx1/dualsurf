import React, { useState } from 'react';
import {
  Home,
  Terminal,
  Bookmark,
  History,
  Download,
  Settings,
  Info,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DualSurfLogo } from './DualSurfLogo';

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
  onOpenTabSearch?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  action: () => void;
  isActive: boolean;
  subRow?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
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
  onOpenTabSearch,
}) => {
  const isTerminal = mode === 'terminal';
  const [isSystemExpanded, setIsSystemExpanded] = useState(true);

  const navGroups: NavGroup[] = [
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
          label: 'Terminal',
          icon: Terminal,
          action: () => {
            onSelectSection('terminal');
            onSwitchMode('terminal');
          },
          isActive: isTerminal || activeSection === 'terminal',
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
      title: 'SYSTEM',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          action: () => {
            onSelectSection('settings');
            onOpenSettings();
          },
          isActive: activeSection === 'settings',
          subRow: true,
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
          subRow: true,
        },
      ],
    },
  ];

  return (
    <aside
      className={`dualsurf-sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}
      aria-label="Main Navigation"
    >
      {/* Top Sidebar Header with DualSurf Orange Logo */}
      <div className="sidebar-brand-header">
        <DualSurfLogo size={24} variant="orange" className="sidebar-brand-logo" />
        {!isCollapsed && <span className="sidebar-brand-name">DualSurf</span>}
      </div>

      <div className="sidebar-nav-scroll">
        {/* GROUP 1: BROWSER */}
        <div className="sidebar-group" data-group="browser">
          {navGroups[0].items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                data-testid={`sidebar-${item.id}`}
                className={`sidebar-row-btn sidebar-nav-item ${item.isActive ? 'active' : ''}`}
                onClick={item.action}
                title={item.label}
              >
                <div className="sidebar-row-indicator" />
                <Icon size={16} className="sidebar-row-icon" />
                {!isCollapsed && <span className="sidebar-row-label">{item.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="sidebar-divider" />

        {/* GROUP 2: SYSTEM (Collapsible Accordion) */}
        <div className="sidebar-group" data-group="system">
          <button
            className="sidebar-accordion-header"
            onClick={() => setIsSystemExpanded(!isSystemExpanded)}
            title="Toggle System Group"
          >
            <div className="sidebar-accordion-left">
              <Settings size={16} className="sidebar-row-icon" />
              {!isCollapsed && <span className="sidebar-row-label">System</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown
                size={14}
                className={`sidebar-chevron ${isSystemExpanded ? 'expanded' : ''}`}
              />
            )}
          </button>

          {(!isCollapsed ? isSystemExpanded : true) && (
            <div className="sidebar-accordion-subitems">
              {navGroups[1].items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    data-testid={`sidebar-${item.id}`}
                    className={`sidebar-row-btn sidebar-nav-item sub-row ${item.isActive ? 'active' : ''}`}
                    onClick={item.action}
                    title={item.label}
                  >
                    <div className="sidebar-row-indicator" />
                    <Icon size={15} className="sidebar-row-icon" />
                    {!isCollapsed && <span className="sidebar-row-label">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Subtle Sidebar Collapse / Expand Toggle at Bottom */}
      {onToggleCollapse && (
        <div className="sidebar-footer-collapse">
          <button
            className="sidebar-collapse-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle Sidebar Width"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      )}
    </aside>
  );
};
