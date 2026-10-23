import React, { useState } from 'react';
import {
  X,
  Wrench,
  Key,
  Hash,
  Shield,
  FileCode,
  Copy,
  Check,
  RefreshCw,
  ArrowRightLeft,
} from 'lucide-react';

interface CyberToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CyberToolsModal: React.FC<CyberToolsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'encoder' | 'hasher' | 'jwt' | 'headers'>('encoder');

  // Encoder state
  const [encoderMode, setEncoderMode] = useState<'base64' | 'url' | 'hex'>('base64');
  const [inputData, setInputData] = useState('');
  const [outputData, setOutputData] = useState('');
  const [copied, setCopied] = useState(false);

  // Hasher state
  const [hashInput, setHashInput] = useState('');
  const [sha256Hash, setSha256Hash] = useState('');

  // JWT state
  const [jwtInput, setJwtInput] = useState('');
  const [jwtHeader, setJwtHeader] = useState('');
  const [jwtPayload, setJwtPayload] = useState('');

  if (!isOpen) return null;

  const handleEncode = () => {
    try {
      if (encoderMode === 'base64') {
        setOutputData(btoa(inputData));
      } else if (encoderMode === 'url') {
        setOutputData(encodeURIComponent(inputData));
      } else if (encoderMode === 'hex') {
        let hex = '';
        for (let i = 0; i < inputData.length; i++) {
          hex += inputData.charCodeAt(i).toString(16).padStart(2, '0');
        }
        setOutputData(hex);
      }
    } catch (err: any) {
      setOutputData(`[Error]: ${err.message}`);
    }
  };

  const handleDecode = () => {
    try {
      if (encoderMode === 'base64') {
        setOutputData(atob(inputData));
      } else if (encoderMode === 'url') {
        setOutputData(decodeURIComponent(inputData));
      } else if (encoderMode === 'hex') {
        let str = '';
        for (let i = 0; i < inputData.length; i += 2) {
          str += String.fromCharCode(parseInt(inputData.substr(i, 2), 16));
        }
        setOutputData(str);
      }
    } catch (err: any) {
      setOutputData(`[Error]: ${err.message}`);
    }
  };

  const handleComputeHash = async () => {
    if (!hashInput) return;
    try {
      const msgBuffer = new TextEncoder().encode(hashInput);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setSha256Hash(hashHex);
    } catch (err: any) {
      setSha256Hash(`[Error]: ${err.message}`);
    }
  };

  const handleParseJwt = () => {
    const parts = jwtInput.trim().split('.');
    if (parts.length >= 2) {
      try {
        setJwtHeader(JSON.stringify(JSON.parse(atob(parts[0])), null, 2));
        setJwtPayload(JSON.stringify(JSON.parse(atob(parts[1])), null, 2));
      } catch (e: any) {
        setJwtHeader('Invalid JSON in header');
        setJwtPayload(e.message);
      }
    } else {
      setJwtHeader('Malformed JWT (Requires at least 2 dot-separated parts)');
      setJwtPayload('');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop-blur" onClick={onClose}>
      <div className="cyber-tools-card" onClick={(e) => e.stopPropagation()}>
        <div className="cyber-tools-header">
          <div className="tools-title-group">
            <div className="tools-icon-halo">
              <Wrench size={20} className="text-cyan" />
            </div>
            <div>
              <h2 className="tools-modal-title">Cyber &amp; Dev Swiss Army Knife</h2>
              <p className="tools-modal-subtitle">
                Encoders, Hashers, JWT Parsers, and Security Headers Generator
              </p>
            </div>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="tools-tab-bar">
          <button
            className={`tools-tab-btn ${activeTab === 'encoder' ? 'active' : ''}`}
            onClick={() => setActiveTab('encoder')}
          >
            <ArrowRightLeft size={14} />
            <span>Encoder / Decoder</span>
          </button>
          <button
            className={`tools-tab-btn ${activeTab === 'hasher' ? 'active' : ''}`}
            onClick={() => setActiveTab('hasher')}
          >
            <Hash size={14} />
            <span>Hash Generator</span>
          </button>
          <button
            className={`tools-tab-btn ${activeTab === 'jwt' ? 'active' : ''}`}
            onClick={() => setActiveTab('jwt')}
          >
            <Key size={14} />
            <span>JWT Inspector</span>
          </button>
          <button
            className={`tools-tab-btn ${activeTab === 'headers' ? 'active' : ''}`}
            onClick={() => setActiveTab('headers')}
          >
            <Shield size={14} />
            <span>Security Headers</span>
          </button>
        </div>

        {/* Tab 1: Encoder / Decoder */}
        {activeTab === 'encoder' && (
          <div className="tools-tab-content">
            <div className="encoder-mode-pills">
              {(['base64', 'url', 'hex'] as const).map((m) => (
                <button
                  key={m}
                  className={`encoder-pill ${encoderMode === m ? 'active' : ''}`}
                  onClick={() => setEncoderMode(m)}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="tools-io-grid">
              <div className="io-panel">
                <label className="io-label">Input Plaintext / Ciphertext:</label>
                <textarea
                  className="tools-textarea"
                  rows={5}
                  placeholder="Paste or enter string..."
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                />
                <div className="io-btn-row">
                  <button className="btn-tool-action primary" onClick={handleEncode}>
                    Encode ({encoderMode.toUpperCase()})
                  </button>
                  <button className="btn-tool-action" onClick={handleDecode}>
                    Decode ({encoderMode.toUpperCase()})
                  </button>
                </div>
              </div>

              <div className="io-panel">
                <div className="io-header-row">
                  <label className="io-label">Result:</label>
                  {outputData && (
                    <button
                      className="btn-copy-mini"
                      onClick={() => copyToClipboard(outputData)}
                    >
                      {copied ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
                <textarea
                  className="tools-textarea output"
                  rows={5}
                  readOnly
                  placeholder="Output appears here..."
                  value={outputData}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hash Generator */}
        {activeTab === 'hasher' && (
          <div className="tools-tab-content">
            <div className="io-panel">
              <label className="io-label">Input Text to Hash:</label>
              <textarea
                className="tools-textarea"
                rows={3}
                placeholder="Enter string to generate cryptographic hashes..."
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
              />
              <button className="btn-tool-action primary" onClick={handleComputeHash}>
                Calculate SHA-256 Digest
              </button>
            </div>

            {sha256Hash && (
              <div className="hash-result-box">
                <span className="hash-algorithm">SHA-256</span>
                <code className="hash-digest">{sha256Hash}</code>
                <button
                  className="btn-copy-mini"
                  onClick={() => copyToClipboard(sha256Hash)}
                >
                  <Copy size={12} />
                  <span>Copy</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: JWT Inspector */}
        {activeTab === 'jwt' && (
          <div className="tools-tab-content">
            <div className="io-panel">
              <label className="io-label">Paste JSON Web Token (JWT):</label>
              <input
                type="text"
                className="jwt-input-field"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0..."
                value={jwtInput}
                onChange={(e) => setJwtInput(e.target.value)}
              />
              <button className="btn-tool-action primary" onClick={handleParseJwt}>
                Parse Token
              </button>
            </div>

            {jwtHeader && (
              <div className="jwt-inspect-grid">
                <div className="jwt-panel">
                  <span className="jwt-panel-title">Decoded Header</span>
                  <pre className="jwt-code-block">{jwtHeader}</pre>
                </div>
                <div className="jwt-panel">
                  <span className="jwt-panel-title">Decoded Payload Claims</span>
                  <pre className="jwt-code-block">{jwtPayload}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Security Headers Generator */}
        {activeTab === 'headers' && (
          <div className="tools-tab-content">
            <p className="headers-desc">
              Recommended battle-tested HTTP hardening headers for Nginx, Apache, or Cloudflare:
            </p>
            <div className="headers-preview-box">
              <pre className="headers-code">
{`# DualSurf Hardened Web Security Headers
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self';
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin`}
              </pre>
              <button
                className="btn-copy-mini copy-headers"
                onClick={() =>
                  copyToClipboard(
                    `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self';\nStrict-Transport-Security: max-age=63072000; includeSubDomains; preload\nX-Content-Type-Options: nosniff\nX-Frame-Options: DENY\nReferrer-Policy: strict-origin-when-cross-origin\nPermissions-Policy: geolocation=(), camera=(), microphone=(), payment=()`
                  )
                }
              >
                <Copy size={13} />
                <span>Copy All Headers</span>
              </button>
            </div>
          </div>
        )}

        <div className="tools-modal-footer">
          <div className="tools-footer-note">
            <Shield size={14} className="text-cyan" />
            <span>100% offline &amp; client-side execution. Zero data leaves your machine.</span>
          </div>
          <button className="proxy-done-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
