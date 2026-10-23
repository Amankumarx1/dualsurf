import React from 'react';
import {
  LayoutGrid,
  ShieldAlert,
  Repeat,
  Activity,
  GitBranch,
  Layers,
  Cookie,
  Wrench,
  Fingerprint,
  History,
  Bookmark,
  Download,
  Settings,
  X,
} from 'lucide-react';

interface AppMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSection: (section: string) => void;
  onOpenTool: (toolName: string) => void;
}

export const AppMatrixModal: React.FC<AppMatrixModalProps> = ({
  isOpen,
  onClose,
  onOpenSection,
  onOpenTool,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const appTools = [
    {
      id: 'repeater',
      title: 'HTTP Request Repeater',
      category: 'Security',
      desc: 'Tamper, craft, and replay raw HTTP/S headers and request bodies',
      icon: <Repeat size={20} />,
      action: () => {
        onClose();
        onOpenTool('repeater');
      },
    },
    {
      id: 'sniffer',
      title: 'Live Traffic Sniffer',
      category: 'Security',
      desc: 'Inspect inbound and outbound network packets and response streams',
      icon: <Activity size={20} />,
      action: () => {
        onClose();
        onOpenTool('sniffer');
      },
    },
    {
      id: 'proxy',
      title: 'Upstream Proxy Switcher',
      category: 'Networking',
      desc: 'Route browser traffic through Burp Suite, OWASP ZAP, Tor, or SOCKS5',
      icon: <GitBranch size={20} />,
      action: () => {
        onClose();
        onOpenTool('proxy');
      },
    },
    {
      id: 'audit',
      title: 'Automated Security Audit',
      category: 'Audit',
      desc: 'Scan active target for secret leaks, missing headers, and insecure forms',
      icon: <ShieldAlert size={20} />,
      action: () => {
        onClose();
        onOpenTool('audit');
      },
    },
    {
      id: 'surface',
      title: 'Attack Surface Visualizer',
      category: 'Recon',
      desc: 'Interactive topology map of discovered endpoints, APIs, and domains',
      icon: <Layers size={20} />,
      action: () => {
        onClose();
        onOpenTool('surface');
      },
    },
    {
      id: 'cookies',
      title: 'Cookie & Storage Editor',
      category: 'Inspection',
      desc: 'Inspect, modify, inject, and purge live session cookies and tokens',
      icon: <Cookie size={20} />,
      action: () => {
        onClose();
        onOpenTool('cookies');
      },
    },
    {
      id: 'cybertools',
      title: 'Cyber Tools & Encoders',
      category: 'Utilities',
      desc: 'Instant MD5/SHA256 hashing, Base64/URL encoding, and JWT decoding',
      icon: <Wrench size={20} />,
      action: () => {
        onClose();
        onOpenTool('cybertools');
      },
    },
    {
      id: 'useragent',
      title: 'User-Agent & Fingerprint',
      category: 'Privacy',
      desc: 'Spoof browser identity, platform fingerprints, and canvas telemetry',
      icon: <Fingerprint size={20} />,
      action: () => {
        onClose();
        onOpenTool('useragent');
      },
    },
    {
      id: 'history',
      title: 'Browsing History',
      category: 'Navigation',
      desc: 'Searchable local SQLite database of visited sites',
      icon: <History size={20} />,
      action: () => {
        onClose();
        onOpenSection('history');
      },
    },
    {
      id: 'bookmarks',
      title: 'Bookmarks Manager',
      category: 'Navigation',
      desc: 'Organize and access saved pages and research assets',
      icon: <Bookmark size={20} />,
      action: () => {
        onClose();
        onOpenSection('bookmarks');
      },
    },
    {
      id: 'downloads',
      title: 'Downloads Vault',
      category: 'Storage',
      desc: 'Track and reveal downloaded tools, scripts, and logs',
      icon: <Download size={20} />,
      action: () => {
        onClose();
        onOpenSection('downloads');
      },
    },
    {
      id: 'settings',
      title: 'Browser Settings',
      category: 'System',
      desc: 'Search engines, sandbox profiles, and security preferences',
      icon: <Settings size={20} />,
      action: () => {
        onClose();
        onOpenSection('settings');
      },
    },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog-box app-matrix-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-strip">
          <div className="modal-title-group">
            <LayoutGrid size={16} />
            <span>DualSurf App Matrix</span>
            <span className="badge-count">Quick Launcher</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        <div className="app-matrix-grid-container">
          {appTools.map((app) => (
            <div
              key={app.id}
              className="app-matrix-card"
              onClick={app.action}
              role="button"
              tabIndex={0}
            >
              <div className="app-card-icon-wrap">{app.icon}</div>
              <div className="app-card-text">
                <div className="app-card-category">{app.category}</div>
                <div className="app-card-title">{app.title}</div>
                <div className="app-card-desc">{app.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
