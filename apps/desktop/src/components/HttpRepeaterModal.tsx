import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  RotateCw,
  Copy,
  Check,
  Plus,
  Trash2,
  Clock,
  Layers,
  FileCode,
  Shield,
  Code2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type { RawHttpRequest, RawHttpResponse } from '@dualsurf/shared-types';

interface HttpRepeaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRequest?: RawHttpRequest | null;
}

export const HttpRepeaterModal: React.FC<HttpRepeaterModalProps> = ({
  isOpen,
  onClose,
  initialRequest,
}) => {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [headers, setHeaders] = useState<Array<{ key: string; value: string; enabled: boolean }>>([
    { key: 'User-Agent', value: 'DualSurf-Repeater/1.0', enabled: true },
    { key: 'Accept', value: 'application/json', enabled: true },
  ]);
  const [body, setBody] = useState('');
  const [activeTab, setActiveTab] = useState<'headers' | 'body'>('headers');
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body');

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RawHttpResponse | null>(null);
  const [copiedBody, setCopiedBody] = useState(false);

  useEffect(() => {
    if (initialRequest) {
      setUrl(initialRequest.url || '');
      setMethod(initialRequest.method || 'GET');
      if (initialRequest.headers) {
        const headerList = Object.entries(initialRequest.headers).map(([key, value]) => ({
          key,
          value,
          enabled: true,
        }));
        setHeaders(headerList);
      }
      if (initialRequest.body) {
        setBody(initialRequest.body);
      }
    }
  }, [initialRequest]);

  if (!isOpen) return null;

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }]);
  };

  const handleUpdateHeader = (index: number, field: 'key' | 'value' | 'enabled', val: any) => {
    const updated = [...headers];
    updated[index] = { ...updated[index], [field]: val };
    setHeaders(updated);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, idx) => idx !== index));
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(body);
      setBody(JSON.stringify(parsed, null, 2));
    } catch {
      // Ignore if not valid JSON
    }
  };

  const handleSend = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResponse(null);

    const activeHeaders: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.enabled && h.key.trim()) {
        activeHeaders[h.key.trim()] = h.value;
      }
    });

    const req: RawHttpRequest = {
      url: url.trim(),
      method,
      headers: activeHeaders,
      body: method !== 'GET' && method !== 'HEAD' && body ? body : undefined,
    };

    try {
      if (window.dualsurf?.sendRawRequest) {
        const res = await window.dualsurf.sendRawRequest(req);
        setResponse(res);
      } else {
        // Fallback for standalone/dev
        const startTime = Date.now();
        const fetchRes = await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });
        const latencyMs = Date.now() - startTime;
        const text = await fetchRes.text();
        const respHeaders: Record<string, string> = {};
        fetchRes.headers.forEach((v, k) => {
          respHeaders[k] = v;
        });
        setResponse({
          success: true,
          status: fetchRes.status,
          statusText: fetchRes.statusText,
          headers: respHeaders,
          body: text,
          latencyMs,
        });
      }
    } catch (err: any) {
      setResponse({
        success: false,
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResponseBody = () => {
    if (response?.body) {
      navigator.clipboard.writeText(response.body);
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
  };

  const getStatusColor = (status?: number) => {
    if (!status) return '#64748b';
    if (status >= 200 && status < 300) return '#10b981';
    if (status >= 300 && status < 400) return '#ffffff';
    if (status >= 400 && status < 500) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="repeater-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="repeater-modal-header">
          <div className="repeater-title-group">
            <div className="repeater-icon-halo">
              <Send size={20} className="text-cyan" />
            </div>
            <div>
              <h2 className="repeater-modal-title">HTTP Request Repeater &amp; Tamperer</h2>
              <p className="repeater-modal-subtitle">
                Craft, tamper, and replay HTTP requests with raw header manipulation (CORS-bypassing)
              </p>
            </div>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* URL & Method Input Bar */}
        <div className="repeater-url-bar">
          <select
            className="repeater-method-select"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="OPTIONS">OPTIONS</option>
            <option value="HEAD">HEAD</option>
          </select>
          <input
            type="text"
            className="repeater-url-input"
            placeholder="https://api.example.com/v1/endpoint"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
          />
          <button
            className="repeater-send-btn"
            disabled={loading || !url.trim()}
            onClick={handleSend}
          >
            {loading ? <RotateCw size={14} className="spin-icon" /> : <Send size={14} />}
            <span>{loading ? 'Sending...' : 'Send'}</span>
          </button>
        </div>

        {/* Split View: Request on Left, Response on Right */}
        <div className="repeater-split-container">
          {/* Left Panel: Request Configuration */}
          <div className="repeater-pane left">
            <div className="repeater-pane-header">
              <div className="repeater-tab-strip">
                <button
                  className={`repeater-pane-tab ${activeTab === 'headers' ? 'active' : ''}`}
                  onClick={() => setActiveTab('headers')}
                >
                  Headers ({headers.filter((h) => h.enabled).length})
                </button>
                <button
                  className={`repeater-pane-tab ${activeTab === 'body' ? 'active' : ''}`}
                  onClick={() => setActiveTab('body')}
                >
                  Body
                </button>
              </div>
              {activeTab === 'headers' && (
                <button className="repeater-add-header-btn" onClick={handleAddHeader}>
                  <Plus size={13} />
                  <span>Add Header</span>
                </button>
              )}
              {activeTab === 'body' && (
                <button className="repeater-add-header-btn" onClick={handleFormatJson}>
                  <Code2 size={13} />
                  <span>Format JSON</span>
                </button>
              )}
            </div>

            <div className="repeater-pane-body">
              {activeTab === 'headers' && (
                <div className="repeater-headers-list">
                  {headers.map((h, idx) => (
                    <div key={idx} className="repeater-header-row">
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={(e) => handleUpdateHeader(idx, 'enabled', e.target.checked)}
                      />
                      <input
                        type="text"
                        className="header-key-input"
                        placeholder="Header Key (e.g. Authorization)"
                        value={h.key}
                        onChange={(e) => handleUpdateHeader(idx, 'key', e.target.value)}
                      />
                      <input
                        type="text"
                        className="header-val-input"
                        placeholder="Header Value"
                        value={h.value}
                        onChange={(e) => handleUpdateHeader(idx, 'value', e.target.value)}
                      />
                      <button
                        className="header-del-btn"
                        onClick={() => handleRemoveHeader(idx)}
                        title="Remove header"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'body' && (
                <textarea
                  className="repeater-body-textarea"
                  placeholder='Paste JSON, form-data or raw request payload here...'
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Right Panel: Response Inspector */}
          <div className="repeater-pane right">
            <div className="repeater-pane-header">
              <div className="repeater-tab-strip">
                <button
                  className={`repeater-pane-tab ${responseTab === 'body' ? 'active' : ''}`}
                  onClick={() => setResponseTab('body')}
                >
                  Response Body
                </button>
                <button
                  className={`repeater-pane-tab ${responseTab === 'headers' ? 'active' : ''}`}
                  onClick={() => setResponseTab('headers')}
                >
                  Headers ({response?.headers ? Object.keys(response.headers).length : 0})
                </button>
              </div>

              {response && (
                <div className="repeater-response-meta">
                  {response.status && (
                    <span
                      className="repeater-status-pill"
                      style={{
                        backgroundColor: `${getStatusColor(response.status)}20`,
                        color: getStatusColor(response.status),
                        borderColor: `${getStatusColor(response.status)}50`,
                      }}
                    >
                      {response.status} {response.statusText}
                    </span>
                  )}
                  <span className="repeater-latency-tag">
                    <Clock size={11} />
                    <span>{response.latencyMs} ms</span>
                  </span>
                  {response.body && (
                    <button
                      className="btn-copy-mini"
                      onClick={handleCopyResponseBody}
                      title="Copy response body"
                    >
                      {copiedBody ? <Check size={11} className="text-green" /> : <Copy size={11} />}
                      <span>{copiedBody ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="repeater-pane-body">
              {!response && !loading && (
                <div className="repeater-empty-response">
                  <Send size={28} className="text-cyan-muted" />
                  <p>Send a request to inspect real-time HTTP response and headers.</p>
                </div>
              )}

              {loading && (
                <div className="repeater-empty-response">
                  <RotateCw size={24} className="spin-icon text-cyan" />
                  <p>Awaiting server response...</p>
                </div>
              )}

              {response && !response.success && (
                <div className="repeater-error-box">
                  <span className="error-title">Request Execution Failed:</span>
                  <p>{response.error}</p>
                </div>
              )}

              {response && response.success && responseTab === 'body' && (
                <pre className="repeater-response-pre">{response.body || '(Empty Response Body)'}</pre>
              )}

              {response && response.success && responseTab === 'headers' && (
                <div className="repeater-response-headers-list">
                  {Object.entries(response.headers || {}).map(([key, val]) => (
                    <div key={key} className="resp-header-row">
                      <span className="resp-header-key">{key}:</span>
                      <span className="resp-header-val">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="repeater-modal-footer">
          <div className="repeater-footer-note">
            <Shield size={14} className="text-cyan" />
            <span>Dispatched via Electron host socket. Bypasses browser CORS &amp; SameSite blocks.</span>
          </div>
          <button className="proxy-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
