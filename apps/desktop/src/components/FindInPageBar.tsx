import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import type { FindResult } from '@dualsurf/shared-types';

interface FindInPageBarProps {
  isOpen: boolean;
  activeTabId: string | null;
  onClose: () => void;
}

export const FindInPageBar: React.FC<FindInPageBarProps> = ({
  isOpen,
  activeTabId,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<FindResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
      setResult(null);
      setCurrentIndex(0);
    }
  }, [isOpen]);

  const executeSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim() || !window.dualsurf) {
      setResult(null);
      setCurrentIndex(0);
      return;
    }

    try {
      const res = await window.dualsurf.findInPage(activeTabId || undefined, text);
      setResult(res);
      setCurrentIndex(res.count > 0 ? 1 : 0);
    } catch (err) {
      console.error('Find in page error:', err);
    }
  };

  const handleNext = () => {
    if (!result || result.count === 0) return;
    setCurrentIndex((prev) => (prev % result.count) + 1);
  };

  const handlePrev = () => {
    if (!result || result.count === 0) return;
    setCurrentIndex((prev) => (prev <= 1 ? result.count : prev - 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="find-in-page-floating-bar" role="search" aria-label="Find in page">
      <div className="find-input-wrapper">
        <Search size={14} className="find-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="find-text-input"
          placeholder="Find in page..."
          value={query}
          onChange={(e) => executeSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
      </div>

      <div className="find-status-indicator">
        {query ? (
          result && result.count > 0 ? (
            <span className="find-matches-count">
              {currentIndex} of {result.count}
            </span>
          ) : (
            <span className="find-no-matches">0 matches</span>
          )
        ) : null}
      </div>

      <div className="find-nav-buttons">
        <button
          className="find-action-btn"
          onClick={handlePrev}
          disabled={!result || result.count === 0}
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp size={14} />
        </button>
        <button
          className="find-action-btn"
          onClick={handleNext}
          disabled={!result || result.count === 0}
          title="Next match (Enter)"
        >
          <ChevronDown size={14} />
        </button>
        <button
          className="find-action-btn close"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
