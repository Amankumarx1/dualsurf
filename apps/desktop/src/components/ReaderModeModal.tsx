import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  X,
  Copy,
  Check,
  Clock,
  FileText,
  AlignLeft,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { ReaderArticle } from '@dualsurf/shared-types';

interface ReaderModeModalProps {
  isOpen: boolean;
  activeTabId: string | null;
  onClose: () => void;
}

export const ReaderModeModal: React.FC<ReaderModeModalProps> = ({
  isOpen,
  activeTabId,
  onClose,
}) => {
  const [article, setArticle] = useState<ReaderArticle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fontSize, setFontSize] = useState<number>(18);
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [columnWidth, setColumnWidth] = useState<'narrow' | 'medium' | 'wide'>('medium');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = async () => {
    if (!window.dualsurf || !activeTabId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.dualsurf.getReaderArticle(activeTabId);
      if (result && result.content && result.content.trim()) {
        setArticle(result);
      } else {
        setError('Could not extract readable article content from this page.');
        setArticle(null);
      }
    } catch (err: any) {
      console.error('Reader mode error:', err);
      setError(err?.message || 'Failed to extract article content.');
      setArticle(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchArticle();
    } else {
      setArticle(null);
      setError(null);
    }
  }, [isOpen, activeTabId]);

  const handleCopyMarkdown = () => {
    if (!article) return;
    const fullText = `# ${article.title}\n\n${article.byline ? `*By ${article.byline}*\n\n` : ''}${article.content}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const fontStyleClass =
    fontFamily === 'serif' ? 'reader-font-serif' : fontFamily === 'mono' ? 'reader-font-mono' : 'reader-font-sans';

  const widthStyleClass =
    columnWidth === 'narrow' ? 'reader-width-narrow' : columnWidth === 'wide' ? 'reader-width-wide' : 'reader-width-medium';

  return (
    <div className="reader-modal-overlay" onClick={onClose}>
      <div
        className="reader-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Reader Top Controls Toolbar */}
        <header className="reader-toolbar">
          <div className="reader-toolbar-left">
            <div className="reader-badge">
              <BookOpen size={14} className="reader-badge-icon" />
              <span>Reader Mode</span>
            </div>
            {article && (
              <>
                <div className="reader-stat-pill" title="Estimated reading time">
                  <Clock size={12} />
                  <span>{article.readingTimeMinutes} min read</span>
                </div>
                <div className="reader-stat-pill" title="Total word count">
                  <FileText size={12} />
                  <span>{article.length.toLocaleString()} words</span>
                </div>
                {article.siteName && (
                  <span className="reader-sitename-badge">{article.siteName}</span>
                )}
              </>
            )}
          </div>

          <div className="reader-toolbar-right">
            {/* Font Family Switcher */}
            <div className="reader-control-group">
              <button
                className={`reader-btn-icon ${fontFamily === 'sans' ? 'active' : ''}`}
                onClick={() => setFontFamily('sans')}
                title="Sans-serif font"
              >
                Sans
              </button>
              <button
                className={`reader-btn-icon ${fontFamily === 'serif' ? 'active' : ''}`}
                onClick={() => setFontFamily('serif')}
                title="Serif font (classic reading)"
              >
                Serif
              </button>
              <button
                className={`reader-btn-icon ${fontFamily === 'mono' ? 'active' : ''}`}
                onClick={() => setFontFamily('mono')}
                title="Monospace font"
              >
                Mono
              </button>
            </div>

            {/* Font Size Adjusters */}
            <div className="reader-control-group">
              <button
                className="reader-btn-icon"
                onClick={() => setFontSize((s) => Math.max(13, s - 1))}
                title="Decrease font size"
              >
                A-
              </button>
              <span className="reader-size-label">{fontSize}px</span>
              <button
                className="reader-btn-icon"
                onClick={() => setFontSize((s) => Math.min(28, s + 1))}
                title="Increase font size"
              >
                A+
              </button>
            </div>

            {/* Column Width */}
            <div className="reader-control-group">
              <button
                className={`reader-btn-icon ${columnWidth === 'narrow' ? 'active' : ''}`}
                onClick={() => setColumnWidth('narrow')}
                title="Narrow column"
              >
                <Minimize2 size={13} />
              </button>
              <button
                className={`reader-btn-icon ${columnWidth === 'medium' ? 'active' : ''}`}
                onClick={() => setColumnWidth('medium')}
                title="Standard column"
              >
                <AlignLeft size={13} />
              </button>
              <button
                className={`reader-btn-icon ${columnWidth === 'wide' ? 'active' : ''}`}
                onClick={() => setColumnWidth('wide')}
                title="Wide column"
              >
                <Maximize2 size={13} />
              </button>
            </div>

            {/* Action Buttons */}
            {article && (
              <button
                className={`reader-action-pill ${copied ? 'copied' : ''}`}
                onClick={handleCopyMarkdown}
                title="Copy article as clean Markdown"
              >
                {copied ? <Check size={13} color="var(--ds-success)" /> : <Copy size={13} />}
                <span>{copied ? 'Copied Markdown' : 'Copy'}</span>
              </button>
            )}

            <button
              className="reader-btn-icon"
              onClick={fetchArticle}
              title="Refresh reader content"
              disabled={isLoading}
            >
              <RefreshCw size={13} className={isLoading ? 'spinning' : ''} />
            </button>

            <button
              className="reader-btn-close"
              onClick={onClose}
              title="Close Reader Mode (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Reader Body Content Viewport */}
        <div className="reader-scroll-viewport">
          <article
            className={`reader-article-prose ${fontStyleClass} ${widthStyleClass}`}
            style={{ fontSize: `${fontSize}px` }}
          >
            {isLoading ? (
              <div className="reader-skeleton-wrap">
                <div className="reader-skeleton-title" />
                <div className="reader-skeleton-subtitle" />
                <div className="reader-skeleton-line full" />
                <div className="reader-skeleton-line half" />
                <div className="reader-skeleton-line full" />
                <div className="reader-skeleton-line three-quarter" />
                <div className="reader-skeleton-line full" />
              </div>
            ) : error ? (
              <div className="reader-empty-state">
                <Sparkles size={32} className="reader-empty-icon" />
                <h3>No Article Extracted</h3>
                <p>{error}</p>
                <button className="reader-retry-btn" onClick={fetchArticle}>
                  <RefreshCw size={13} /> Retry Extraction
                </button>
              </div>
            ) : article ? (
              <>
                <header className="reader-article-header">
                  <h1 className="reader-article-title">{article.title}</h1>
                  {(article.byline || article.siteName) && (
                    <div className="reader-byline">
                      {article.byline && <span>By {article.byline}</span>}
                      {article.byline && article.siteName && <span> • </span>}
                      {article.siteName && <span>{article.siteName}</span>}
                    </div>
                  )}
                </header>

                {/* Table of contents if headings exist in content */}
                {(() => {
                  const headings = article.content
                    .split('\n')
                    .filter((l) => l.trim().startsWith('#'))
                    .map((l) => {
                      const level = l.match(/^#+/)?.[0].length || 1;
                      const text = l.replace(/^#+\s*/, '');
                      return { level, text };
                    });

                  if (headings.length <= 2) return null;

                  return (
                    <nav className="reader-toc">
                      <span className="reader-toc-title">Article Outline</span>
                      <ul>
                        {headings.slice(0, 8).map((h, i) => (
                          <li key={i} className={`reader-toc-item lvl-${h.level}`}>
                            {h.text}
                          </li>
                        ))}
                      </ul>
                    </nav>
                  );
                })()}

                <div className="reader-article-content">
                  {article.content.split('\n\n').map((paragraph, index) => {
                    const trimmed = paragraph.trim();
                    if (!trimmed) return null;
                    if (trimmed.startsWith('# ')) {
                      return <h1 key={index}>{trimmed.replace('# ', '')}</h1>;
                    }
                    if (trimmed.startsWith('## ')) {
                      return <h2 key={index}>{trimmed.replace('## ', '')}</h2>;
                    }
                    if (trimmed.startsWith('### ')) {
                      return <h3 key={index}>{trimmed.replace('### ', '')}</h3>;
                    }
                    if (trimmed.startsWith('> ')) {
                      return <blockquote key={index}>{trimmed.replace(/^>\s*/gm, '')}</blockquote>;
                    }
                    return <p key={index}>{trimmed}</p>;
                  })}
                </div>
              </>
            ) : null}
          </article>
        </div>
      </div>
    </div>
  );
};
