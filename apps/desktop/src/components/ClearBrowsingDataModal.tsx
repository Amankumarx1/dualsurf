import React, { useState } from 'react';
import { Trash2, X, Clock, Database, Cookie, HardDrive, Terminal, Check } from 'lucide-react';
import type { ClearBrowsingDataOptions } from '@dualsurf/shared-types';

interface ClearBrowsingDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCleared?: () => void;
  onClearTerminalHistory?: () => void;
}

export const ClearBrowsingDataModal: React.FC<ClearBrowsingDataModalProps> = ({
  isOpen,
  onClose,
  onCleared,
  onClearTerminalHistory,
}) => {
  const [timeRange, setTimeRange] = useState<number>(3600000); // default last 1 hour
  const [clearHistory, setClearHistory] = useState(true);
  const [clearCookies, setClearCookies] = useState(true);
  const [clearCache, setClearCache] = useState(true);
  const [clearTerminal, setClearTerminal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

  const handleClear = async () => {
    setIsClearing(true);
    try {
      const options: ClearBrowsingDataOptions = {
        timeRangeMs: timeRange,
        history: clearHistory,
        cookies: clearCookies,
        cache: clearCache,
        storage: clearCookies,
      };

      if (window.dualsurf) {
        await window.dualsurf.clearBrowsingData(options);
      }

      if (clearTerminal && onClearTerminalHistory) {
        onClearTerminalHistory();
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsClearing(false);
        onCleared?.();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to clear browsing data:', err);
      setIsClearing(false);
    }
  };

  return (
    <div className="tab-search-backdrop clear-data-overlay modal-overlay" onClick={onClose}>
      <div className="clear-data-card clear-data-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="clear-data-header">
          <div className="clear-data-title-box">
            <Trash2 size={18} className="clear-data-icon" />
            <div>
              <div className="clear-data-title">Clear Browsing Data</div>
              <div className="clear-data-subtitle">Choose time range and data types to purge</div>
            </div>
          </div>
          <button className="tab-search-close-btn modal-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={15} />
          </button>
        </div>

        <div className="clear-data-body">
          {/* Time Range Selector */}
          <div className="clear-data-field-group">
            <label className="clear-data-field-label">
              <Clock size={13} />
              <span>Time range</span>
            </label>
            <select
              className="clear-data-select"
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
            >
              <option value={3600000}>Last 1 hour</option>
              <option value={86400000}>Last 24 hours</option>
              <option value={604800000}>Last 7 days</option>
              <option value={2419200000}>Last 4 weeks</option>
              <option value={0}>All time</option>
            </select>
          </div>

          {/* Options Checklist */}
          <div className="clear-data-options-list">
            <label className="clear-data-checkbox-row">
              <input
                type="checkbox"
                checked={clearHistory}
                onChange={(e) => setClearHistory(e.target.checked)}
              />
              <Database size={15} className="clear-opt-icon" />
              <div className="clear-opt-text">
                <span className="clear-opt-title">Browsing history</span>
                <span className="clear-opt-desc">Clears URLs, titles, and visit timestamps from local database</span>
              </div>
            </label>

            <label className="clear-data-checkbox-row">
              <input
                type="checkbox"
                checked={clearCookies}
                onChange={(e) => setClearCookies(e.target.checked)}
              />
              <Cookie size={15} className="clear-opt-icon" />
              <div className="clear-opt-text">
                <span className="clear-opt-title">Cookies and site storage</span>
                <span className="clear-opt-desc">Signs you out of most web sites and clears localStorage/IndexedDB</span>
              </div>
            </label>

            <label className="clear-data-checkbox-row">
              <input
                type="checkbox"
                checked={clearCache}
                onChange={(e) => setClearCache(e.target.checked)}
              />
              <HardDrive size={15} className="clear-opt-icon" />
              <div className="clear-opt-text">
                <span className="clear-opt-title">Cached images and files</span>
                <span className="clear-opt-desc">Frees disk space; pages may load slightly slower on next visit</span>
              </div>
            </label>

            <label className="clear-data-checkbox-row">
              <input
                type="checkbox"
                checked={clearTerminal}
                onChange={(e) => setClearTerminal(e.target.checked)}
              />
              <Terminal size={15} className="clear-opt-icon" />
              <div className="clear-opt-text">
                <span className="clear-opt-title">Terminal session command history</span>
                <span className="clear-opt-desc">Clears in-memory bash/powershell history buffer in DualSurf</span>
              </div>
            </label>
          </div>
        </div>

        <div className="clear-data-footer">
          <button className="clear-btn-cancel" onClick={onClose} disabled={isClearing}>
            Cancel
          </button>
          <button
            className={`clear-btn-submit ${isSuccess ? 'success' : ''}`}
            onClick={handleClear}
            disabled={isClearing || (!clearHistory && !clearCookies && !clearCache && !clearTerminal)}
          >
            {isSuccess ? (
              <>
                <Check size={14} /> Data Cleared!
              </>
            ) : isClearing ? (
              'Clearing...'
            ) : (
              'Clear Data'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
