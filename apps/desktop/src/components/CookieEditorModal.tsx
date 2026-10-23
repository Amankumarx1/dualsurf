import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Cookie,
  Plus,
  Trash2,
  Edit2,
  Save,
  Search,
  Copy,
  Check,
  RefreshCw,
  Shield,
  Key,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import type { EditableCookie, TabState } from '@dualsurf/shared-types';

interface CookieEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabState | undefined;
}

export const CookieEditorModal: React.FC<CookieEditorModalProps> = ({
  isOpen,
  onClose,
  activeTab,
}) => {
  const [cookies, setCookies] = useState<EditableCookie[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [decodedJwt, setDecodedJwt] = useState<{ raw: string; header: any; payload: any } | null>(null);

  // Editing state
  const [editingCookie, setEditingCookie] = useState<EditableCookie | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New cookie state
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newPath, setNewPath] = useState('/');
  const [newSecure, setNewSecure] = useState(false);
  const [newHttpOnly, setNewHttpOnly] = useState(false);
  const [newSameSite, setNewSameSite] = useState<'lax' | 'strict' | 'no_restriction' | 'unspecified'>('lax');

  const currentUrl = activeTab?.url || '';
  const currentDomain = useMemo(() => {
    try {
      return new URL(currentUrl).hostname;
    } catch {
      return '';
    }
  }, [currentUrl]);

  const loadCookies = async () => {
    if (!window.dualsurf || !currentUrl) return;
    setLoading(true);
    try {
      const list = await window.dualsurf.getCookies(currentUrl);
      setCookies(list);
    } catch (err) {
      console.error('Failed to load cookies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentUrl) {
      loadCookies();
      setNewDomain(currentDomain);
    }
  }, [isOpen, currentUrl, currentDomain]);

  if (!isOpen) return null;

  const filteredCookies = cookies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.value.toLowerCase().includes(search.toLowerCase()) ||
      c.domain.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (cookie: EditableCookie) => {
    if (!window.dualsurf) return;
    const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
    await window.dualsurf.removeCookie(cookieUrl, cookie.name);
    await loadCookies();
  };

  const handleSaveEdit = async () => {
    if (!editingCookie || !window.dualsurf) return;
    const targetUrl = `http${editingCookie.secure ? 's' : ''}://${editingCookie.domain.replace(/^\./, '')}${editingCookie.path}`;
    await window.dualsurf.setCookie(editingCookie, targetUrl);
    setEditingCookie(null);
    await loadCookies();
  };

  const handleCreateCookie = async () => {
    if (!newName.trim() || !window.dualsurf) return;
    const targetUrl = `http${newSecure ? 's' : ''}://${newDomain.replace(/^\./, '')}${newPath}`;
    const cookie: EditableCookie = {
      name: newName.trim(),
      value: newValue,
      domain: newDomain.trim(),
      path: newPath.trim() || '/',
      secure: newSecure,
      httpOnly: newHttpOnly,
      sameSite: newSameSite,
    };
    await window.dualsurf.setCookie(cookie, targetUrl);
    setIsCreatingNew(false);
    setNewName('');
    setNewValue('');
    await loadCookies();
  };

  const handleCopyCurlHeader = () => {
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    navigator.clipboard.writeText(`Cookie: ${cookieString}`);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const tryDecodeJwt = (value: string) => {
    const parts = value.split('.');
    if (parts.length === 3) {
      try {
        const header = JSON.parse(atob(parts[0]));
        const payload = JSON.parse(atob(parts[1]));
        setDecodedJwt({ raw: value, header, payload });
      } catch {
        setDecodedJwt(null);
      }
    } else {
      setDecodedJwt(null);
    }
  };

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="cookie-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cookie-modal-header">
          <div className="cookie-title-group">
            <div className="cookie-icon-halo">
              <Cookie size={20} className="text-orange" />
            </div>
            <div>
              <h2 className="cookie-modal-title">Cookie &amp; Session Inspector</h2>
              <p className="cookie-modal-subtitle">
                Target: <span className="text-cyan">{currentDomain || currentUrl}</span> • {cookies.length} session cookie{cookies.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="cookie-header-actions">
            <button
              className="cookie-action-pill-btn"
              onClick={handleCopyCurlHeader}
              title="Copy all cookies as cURL header format"
            >
              {copiedCurl ? <Check size={14} className="text-green" /> : <Copy size={14} />}
              <span>{copiedCurl ? 'Copied Header' : 'Copy cURL Header'}</span>
            </button>
            <button className="cookie-action-pill-btn" onClick={loadCookies} title="Refresh cookies">
              <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>
            <button className="modal-close-icon-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="cookie-toolbar-row">
          <div className="cookie-search-wrap">
            <Search size={14} className="cookie-search-icon" />
            <input
              type="text"
              className="cookie-search-input"
              placeholder="Filter cookies by name, value, or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`cookie-add-btn ${isCreatingNew ? 'active' : ''}`}
            onClick={() => setIsCreatingNew(!isCreatingNew)}
          >
            <Plus size={15} />
            <span>Add Cookie</span>
          </button>
        </div>

        {/* Create Cookie Form */}
        {isCreatingNew && (
          <div className="cookie-create-drawer">
            <div className="create-drawer-header">
              <span className="create-title">New Cookie Vector</span>
              <button className="close-mini-btn" onClick={() => setIsCreatingNew(false)}>
                <X size={13} />
              </button>
            </div>
            <div className="create-inputs-grid">
              <div className="create-field">
                <label>Name:</label>
                <input
                  type="text"
                  placeholder="e.g. session_id, token, auth"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="create-field">
                <label>Value:</label>
                <input
                  type="text"
                  placeholder="value string..."
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
              <div className="create-field">
                <label>Domain:</label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
              </div>
              <div className="create-field">
                <label>Path:</label>
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                />
              </div>
              <div className="create-field-checkboxes">
                <label className="checkbox-pill">
                  <input
                    type="checkbox"
                    checked={newSecure}
                    onChange={(e) => setNewSecure(e.target.checked)}
                  />
                  <span>Secure (HTTPS)</span>
                </label>
                <label className="checkbox-pill">
                  <input
                    type="checkbox"
                    checked={newHttpOnly}
                    onChange={(e) => setNewHttpOnly(e.target.checked)}
                  />
                  <span>HttpOnly</span>
                </label>
              </div>
              <div className="create-field">
                <label>SameSite:</label>
                <select
                  value={newSameSite}
                  onChange={(e) => setNewSameSite(e.target.value as any)}
                >
                  <option value="lax">Lax</option>
                  <option value="strict">Strict</option>
                  <option value="no_restriction">None (No Restriction)</option>
                  <option value="unspecified">Unspecified</option>
                </select>
              </div>
            </div>
            <div className="create-submit-row">
              <button className="btn-save-cookie" onClick={handleCreateCookie}>
                <Save size={13} />
                <span>Save Cookie</span>
              </button>
            </div>
          </div>
        )}

        {/* Cookies Table */}
        <div className="cookie-table-container">
          <table className="cyber-cookie-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Name</th>
                <th style={{ width: '38%' }}>Value</th>
                <th style={{ width: '18%' }}>Domain</th>
                <th style={{ width: '12%' }}>Attributes</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCookies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="no-cookies-cell">
                    {loading ? 'Reading cookies from active session...' : 'No cookies found matching query.'}
                  </td>
                </tr>
              ) : (
                filteredCookies.map((cookie) => {
                  const isEditing = editingCookie?.name === cookie.name;
                  const isJwt = cookie.value.split('.').length === 3;
                  return (
                    <tr key={`${cookie.domain}-${cookie.name}`}>
                      {/* Name */}
                      <td className="cookie-name-cell">
                        <span className="cookie-name-label">{cookie.name}</span>
                        {isJwt && (
                          <button
                            className="jwt-badge-btn"
                            onClick={() => tryDecodeJwt(cookie.value)}
                            title="Decode JSON Web Token (JWT)"
                          >
                            <Key size={10} />
                            <span>JWT</span>
                          </button>
                        )}
                      </td>

                      {/* Value */}
                      <td className="cookie-value-cell">
                        {isEditing ? (
                          <input
                            type="text"
                            className="cookie-inline-edit"
                            value={editingCookie.value}
                            onChange={(e) =>
                              setEditingCookie({ ...editingCookie, value: e.target.value })
                            }
                            autoFocus
                          />
                        ) : (
                          <span
                            className="cookie-value-preview"
                            title={cookie.value}
                            onClick={() => setEditingCookie(cookie)}
                          >
                            {cookie.value}
                          </span>
                        )}
                      </td>

                      {/* Domain & Path */}
                      <td className="cookie-domain-cell">
                        <span className="domain-text">{cookie.domain}</span>
                        <span className="path-text">{cookie.path}</span>
                      </td>

                      {/* Attributes */}
                      <td className="cookie-attrs-cell">
                        <div className="attr-pill-row">
                          {cookie.httpOnly && <span className="attr-pill pill-httponly">HttpOnly</span>}
                          {cookie.secure && <span className="attr-pill pill-secure">Secure</span>}
                          {cookie.sameSite && cookie.sameSite !== 'unspecified' && (
                            <span className="attr-pill pill-samesite">{cookie.sameSite}</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="cookie-actions-cell">
                        {isEditing ? (
                          <button
                            className="cookie-icon-action-btn save"
                            onClick={handleSaveEdit}
                            title="Save Changes"
                          >
                            <Save size={14} />
                          </button>
                        ) : (
                          <button
                            className="cookie-icon-action-btn edit"
                            onClick={() => setEditingCookie(cookie)}
                            title="Edit Cookie"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        <button
                          className="cookie-icon-action-btn delete"
                          onClick={() => handleDelete(cookie)}
                          title="Delete Cookie"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* JWT Decoder Panel */}
        {decodedJwt && (
          <div className="jwt-decoder-drawer">
            <div className="jwt-header-row">
              <div className="jwt-title">
                <FileCode size={16} className="text-purple" />
                <span>Decoded JSON Web Token</span>
              </div>
              <button className="close-mini-btn" onClick={() => setDecodedJwt(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="jwt-blocks-grid">
              <div className="jwt-block">
                <span className="jwt-block-title">Header (Algorithm &amp; Token Type)</span>
                <pre>{JSON.stringify(decodedJwt.header, null, 2)}</pre>
              </div>
              <div className="jwt-block">
                <span className="jwt-block-title">Payload (Claims &amp; Expiry)</span>
                <pre>{JSON.stringify(decodedJwt.payload, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="cookie-modal-footer">
          <div className="cookie-footer-note">
            <Shield size={14} className="text-cyan" />
            <span>Changes directly manipulate Chromium's in-memory session cookie jar.</span>
          </div>
          <button className="proxy-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
