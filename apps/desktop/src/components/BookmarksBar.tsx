import React from 'react';
import { Bookmark, Code, Terminal, BookOpen, Compass, Shield } from 'lucide-react';

interface BookmarksBarProps {
  onNavigate: (url: string) => void;
}

export const BookmarksBar: React.FC<BookmarksBarProps> = ({ onNavigate }) => {
  const quickLinks = [
    { title: 'DuckDuckGo', url: 'https://duckduckgo.com', icon: <Compass size={12} /> },
    { title: 'GitHub', url: 'https://github.com', icon: <Code size={12} /> },
    { title: 'ArchWiki', url: 'https://wiki.archlinux.org', icon: <Terminal size={12} /> },
    { title: 'Hacker News', url: 'https://news.ycombinator.com', icon: <BookOpen size={12} /> },
    { title: 'Kernel Docs', url: 'https://www.kernel.org/doc/html/latest/', icon: <Shield size={12} /> },
  ];

  return (
    <div className="bookmarks-bar">
      <Bookmark size={12} style={{ color: 'var(--text-muted)', marginLeft: 4 }} />
      {quickLinks.map((item) => (
        <button
          key={item.url}
          className="bookmark-chip"
          onClick={() => onNavigate(item.url)}
          title={item.url}
        >
          {item.icon}
          <span>{item.title}</span>
        </button>
      ))}
    </div>
  );
};
