import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Shield,
  Zap,
  Lock,
  Download,
  Check,
  Copy,
  RefreshCw,
  X,
  ExternalLink,
  ChevronRight,
  Terminal,
  Server,
  Sliders,
} from 'lucide-react';
import type { BrowserSettings, OllamaSettings } from '@dualsurf/shared-types';

interface OllamaSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export const OllamaSetupModal: React.FC<OllamaSetupModalProps> = ({
  isOpen,
  onClose,
  onCompleted,
}) => {
  const [host, setHost] = useState('http://localhost:11434');
  const [selectedModel, setSelectedModel] = useState('llama3.2');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [enableAi, setEnableAi] = useState(true);
  const [autoSummarize, setAutoSummarize] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<{ status: string; percent?: number; completed?: number; total?: number } | null>(null);
  const [customPullInput, setCustomPullInput] = useState('');

  useEffect(() => {
    if (!window.dualsurf?.onOllamaPullProgress) return;
    const cleanup = window.dualsurf.onOllamaPullProgress((progress) => {
      setPullProgress(progress);
      if (progress.status === 'success' || (progress.percent && progress.percent >= 100)) {
        setTimeout(() => {
          setPullingModel(null);
          setPullProgress(null);
          checkConnection(host);
        }, 1200);
      }
    });
    return cleanup;
  }, [host]);

  const handlePullModel = async (modelToPull: string) => {
    const target = modelToPull.trim();
    if (!target || pullingModel || !window.dualsurf?.pullOllamaModel) return;
    setPullingModel(target);
    setPullProgress({ status: `Connecting & downloading ${target}...`, percent: 0 });
    try {
      const res = await window.dualsurf.pullOllamaModel(target, host);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to pull model');
        setPullingModel(null);
        setPullProgress(null);
      } else {
        setSelectedModel(target);
        checkConnection(host);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setPullingModel(null);
      setPullProgress(null);
    }
  };

  const checkConnection = async (targetHost = host) => {
    if (!window.dualsurf) return;
    setIsChecking(true);
    setErrorMsg(null);
    try {
      const res = await window.dualsurf.checkOllama(targetHost);
      setIsConnected(res.available);
      setLatencyMs(res.latencyMs);
      if (res.available) {
        setAvailableModels(res.models);
        if (res.models.length > 0 && !res.models.includes(selectedModel)) {
          setSelectedModel(res.models[0]);
        }
      } else {
        setErrorMsg(res.error || 'Connection refused (daemon not running)');
      }
    } catch (err: any) {
      setIsConnected(false);
      setErrorMsg(err?.message || 'Failed to ping host');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Load current settings if already configured
      if (window.dualsurf) {
        window.dualsurf.getSettings().then((s: BrowserSettings) => {
          if (s.ollama) {
            setHost(s.ollama.host || 'http://localhost:11434');
            setSelectedModel(s.ollama.model || 'llama3.2');
            setEnableAi(s.ollama.enabled ?? true);
            setAutoSummarize(s.ollama.autoSummarize ?? false);
          }
        }).catch(() => {});
      }
      checkConnection(host);
    }
  }, [isOpen]);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('ollama run llama3.2');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const handleOpenDownload = () => {
    if (window.dualsurf) {
      window.dualsurf.createTab('https://ollama.com/download');
    } else {
      window.open('https://ollama.com/download', '_blank');
    }
  };

  const handleSaveAndProceed = async () => {
    if (window.dualsurf) {
      const ollamaConfig: OllamaSettings = {
        enabled: enableAi,
        host: host.trim(),
        model: selectedModel.trim() || 'llama3.2',
        onboardingCompleted: true,
        autoSummarize,
      };
      await window.dualsurf.updateSettings({ ollama: ollamaConfig });
    }
    localStorage.setItem('dualsurf_ollama_onboarded', 'true');
    if (onCompleted) onCompleted();
    onClose();
  };

  const handleSkip = async () => {
    if (window.dualsurf) {
      await window.dualsurf.updateSettings({
        ollama: {
          enabled: false,
          host: 'http://localhost:11434',
          model: 'llama3.2',
          onboardingCompleted: true,
          autoSummarize: false,
        },
      });
    }
    localStorage.setItem('dualsurf_ollama_onboarded', 'true');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="ollama-modal-overlay" onClick={onClose}>
      <div
        className="ollama-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header Strip with Glowing Badge */}
        <header className="ollama-modal-header">
          <div className="ollama-title-wrap">
            <div className="ollama-icon-halo">
              <Bot size={22} className="ollama-icon-bot" />
              <Sparkles size={12} className="ollama-sparkle-star" />
            </div>
            <div>
              <div className="ollama-modal-title">Configure Local Ollama AI</div>
              <div className="ollama-modal-subtitle">
                Supercharge DualSurf with private, zero-latency on-device intelligence
              </div>
            </div>
          </div>
          <button className="ollama-close-btn" onClick={handleSkip} title="Skip setup for now">
            <X size={16} />
          </button>
        </header>

        {/* Modal Body Content */}
        <div className="ollama-modal-body">
          {step === 1 ? (
            <>
              {/* Feature Cards Grid */}
              <div className="ollama-features-grid">
                <div className="ollama-feature-card">
                  <div className="ollama-card-icon-box cyan">
                    <Zap size={16} />
                  </div>
                  <div className="ollama-card-text">
                    <h4>Autonomous Web Agents</h4>
                    <p>Execute multi-step tasks, follow links, and search documentation hands-free.</p>
                  </div>
                </div>

                <div className="ollama-feature-card">
                  <div className="ollama-card-icon-box purple">
                    <Sparkles size={16} />
                  </div>
                  <div className="ollama-card-text">
                    <h4>Instant Page Summaries</h4>
                    <p>Digest lengthy articles, research papers, and news into concise executive bullet points.</p>
                  </div>
                </div>

                <div className="ollama-feature-card">
                  <div className="ollama-card-icon-box green">
                    <Shield size={16} />
                  </div>
                  <div className="ollama-card-text">
                    <h4>Security &amp; Vulnerability Audits</h4>
                    <p>Detect leaked keys, insecure cookies, and misconfigured headers with AI remediation.</p>
                  </div>
                </div>

                <div className="ollama-feature-card">
                  <div className="ollama-card-icon-box orange">
                    <Lock size={16} />
                  </div>
                  <div className="ollama-card-text">
                    <h4>100% Private &amp; Offline</h4>
                    <p>No telemetry, no external API keys, and no subscriptions. Runs entirely on your hardware.</p>
                  </div>
                </div>
              </div>

              {/* Live Connection Diagnostics Section */}
              <div className="ollama-status-banner">
                <div className="ollama-status-left">
                  <div className={`ollama-status-dot ${isChecking ? 'checking' : isConnected ? 'online' : 'offline'}`} />
                  <div className="ollama-status-info">
                    <div className="ollama-status-headline">
                      {isChecking
                        ? 'Pinging Ollama daemon...'
                        : isConnected
                        ? `Connected to Ollama (${latencyMs}ms)`
                        : 'Ollama is not running locally'}
                    </div>
                    <div className="ollama-status-sub">
                      {isConnected
                        ? `${availableModels.length} models installed (${availableModels.slice(0, 3).join(', ') || 'ready to pull'})`
                        : errorMsg
                        ? `Daemon status: ${errorMsg}`
                        : 'DualSurf will help you install and run your first model in seconds.'}
                    </div>
                  </div>
                </div>

                <button
                  className="ollama-btn-test"
                  onClick={() => checkConnection(host)}
                  disabled={isChecking}
                >
                  <RefreshCw size={13} className={isChecking ? 'spinning' : ''} />
                  <span>{isChecking ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>

              {/* Installation helper if not connected */}
              {!isConnected && !isChecking && (
                <div className="ollama-install-box">
                  <div className="ollama-install-header">
                    <Server size={15} className="ollama-install-icon" />
                    <span>Quick 2-Step Ollama Setup</span>
                  </div>

                  <div className="ollama-steps-list">
                    <div className="ollama-step-item">
                      <div className="ollama-step-num">1</div>
                      <div className="ollama-step-content">
                        <span>Install the free Ollama app for Windows</span>
                        <button className="ollama-btn-download" onClick={handleOpenDownload}>
                          <Download size={13} />
                          <span>Download Ollama (Windows Installer)</span>
                          <ExternalLink size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="ollama-step-item">
                      <div className="ollama-step-num">2</div>
                      <div className="ollama-step-content">
                        <span>Run this command in PowerShell or Command Prompt to launch your first model:</span>
                        <div className="ollama-cmd-snippet" onClick={handleCopyCommand} title="Click to copy command">
                          <Terminal size={13} className="ollama-cmd-icon" />
                          <code>ollama run llama3.2</code>
                          <button className="ollama-btn-copy-code">
                            {copiedCmd ? <Check size={13} color="var(--ds-success)" /> : <Copy size={13} />}
                            <span>{copiedCmd ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* In-App Model Puller (When Connected) */}
              {isConnected && (
                <div className="ollama-pull-manager-box">
                  <div className="pull-manager-header">
                    <Sparkles size={15} className="text-cyan" />
                    <span>In-App AI Model Installer</span>
                  </div>

                  {pullingModel && pullProgress && (
                    <div className="pull-active-progress-card">
                      <div className="progress-info-row">
                        <span className="pulling-name">Downloading: <strong>{pullingModel}</strong></span>
                        <span className="pulling-pct">{pullProgress.percent !== undefined ? `${pullProgress.percent}%` : 'Pulling...'}</span>
                      </div>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${pullProgress.percent || 15}%` }}
                        />
                      </div>
                      <span className="progress-status-text">{pullProgress.status}</span>
                    </div>
                  )}

                  <div className="popular-models-grid">
                    {[
                      { id: 'llama3.2', name: 'Llama 3.2 (3B)', desc: 'Fast, official Meta LLM' },
                      { id: 'llama3.2:1b', name: 'Llama 3.2 (1B)', desc: 'Ultra-light, runs on any PC' },
                      { id: 'deepseek-r1:1.5b', name: 'DeepSeek-R1 (1.5B)', desc: 'Advanced reasoning' },
                      { id: 'mistral', name: 'Mistral (7B)', desc: 'Great for coding & analysis' },
                    ].map((model) => {
                      const isInstalled = availableModels.includes(model.id) || availableModels.some((m) => m.startsWith(model.id));
                      return (
                        <div key={model.id} className={`model-install-card ${isInstalled ? 'installed' : ''}`}>
                          <div className="model-card-info">
                            <span className="model-card-title">{model.name}</span>
                            <span className="model-card-desc">{model.desc}</span>
                          </div>
                          {isInstalled ? (
                            <span className="model-badge-installed">
                              <Check size={12} /> Installed
                            </span>
                          ) : (
                            <button
                              className="model-btn-pull"
                              onClick={() => handlePullModel(model.id)}
                              disabled={Boolean(pullingModel)}
                            >
                              <Download size={12} /> Pull
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="custom-pull-row">
                    <input
                      type="text"
                      className="custom-pull-input"
                      placeholder="Or enter any Ollama model name (e.g. qwen2.5, phi4, codellama)..."
                      value={customPullInput}
                      onChange={(e) => setCustomPullInput(e.target.value)}
                      disabled={Boolean(pullingModel)}
                    />
                    <button
                      className="custom-pull-btn"
                      onClick={() => {
                        handlePullModel(customPullInput);
                        setCustomPullInput('');
                      }}
                      disabled={!customPullInput.trim() || Boolean(pullingModel)}
                    >
                      <Download size={13} /> Pull Model
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Step 2: Advanced Configuration Settings */
            <div className="ollama-config-form">
              <div className="ollama-form-group">
                <label className="ollama-form-label">
                  <span>Enable AI Features in DualSurf</span>
                  <input
                    type="checkbox"
                    className="setting-toggle-checkbox"
                    checked={enableAi}
                    onChange={(e) => setEnableAi(e.target.checked)}
                  />
                </label>
                <span className="ollama-form-hint">Enables browser agent tools, quick summaries, and AI audit recommendations.</span>
              </div>

              <div className="ollama-form-group">
                <label className="ollama-form-label-text">Ollama Host Address</label>
                <div className="ollama-input-group">
                  <input
                    type="text"
                    className="ollama-text-field"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                  <button className="ollama-btn-test-sm" onClick={() => checkConnection(host)}>
                    Ping
                  </button>
                </div>
                <span className="ollama-form-hint">Default is http://localhost:11434. You can also specify an Ollama instance on your LAN.</span>
              </div>

              <div className="ollama-form-group">
                <label className="ollama-form-label-text">Active AI Model</label>
                {availableModels.length > 0 ? (
                  <select
                    className="ollama-select-field"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m} (Installed)
                      </option>
                    ))}
                    <option value="llama3.2">llama3.2 (Meta Llama 3.2 3B)</option>
                    <option value="mistral">mistral (Mistral 7B)</option>
                    <option value="qwen2.5">qwen2.5 (Alibaba Qwen 2.5)</option>
                    <option value="deepseek-r1:7b">deepseek-r1:7b (DeepSeek Reasoning)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    className="ollama-text-field"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    placeholder="llama3.2"
                  />
                )}
                <span className="ollama-form-hint">Recommended models: llama3.2 (fast &amp; lightweight), mistral (great for code), deepseek-r1 (reasoning).</span>
              </div>

              <div className="ollama-form-group">
                <label className="ollama-form-label">
                  <span>Auto-Summarize in Reader Mode</span>
                  <input
                    type="checkbox"
                    className="setting-toggle-checkbox"
                    checked={autoSummarize}
                    onChange={(e) => setAutoSummarize(e.target.checked)}
                  />
                </label>
                <span className="ollama-form-hint">Automatically generate an executive TL;DR whenever you enter Reader Mode.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <footer className="ollama-modal-footer">
          <button className="ollama-btn-secondary" onClick={handleSkip}>
            Skip for Now
          </button>

          <div className="ollama-footer-right">
            {step === 1 ? (
              <button
                className="ollama-btn-configure"
                onClick={() => setStep(2)}
              >
                <Sliders size={14} />
                <span>Configure Options</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                className="ollama-btn-secondary"
                onClick={() => setStep(1)}
              >
                Back
              </button>
            )}

            <button
              className="ollama-btn-primary"
              onClick={handleSaveAndProceed}
            >
              <Check size={15} />
              <span>{isConnected ? 'Start Browsing with AI' : 'Save & Continue'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
