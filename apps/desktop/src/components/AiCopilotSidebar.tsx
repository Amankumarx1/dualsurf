import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  X,
  Sparkles,
  ShieldAlert,
  FileText,
  Search,
  Table,
  RotateCcw,
  Cpu,
  Check,
  Copy,
  ChevronRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { CopilotMessage, OllamaSettings, TabState } from '@dualsurf/shared-types';

interface AiCopilotSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabState | null;
  ollamaSettings?: OllamaSettings;
  onOpenOllamaSetup: () => void;
}

export const AiCopilotSidebar: React.FC<AiCopilotSidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  ollamaSettings,
  onOpenOllamaSetup,
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 Greetings! I am your **DualSurf Local AI Copilot** powered by Ollama. I have real-time contextual awareness of your active tab. Ask me anything, or choose a quick action below!',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Listen for streaming tokens from main process
  useEffect(() => {
    if (!window.dualsurf?.onCopilotToken) return;

    const cleanup = window.dualsurf.onCopilotToken((token) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.isStreaming) {
          const updated = { ...last, content: last.content + token };
          return [...prev.slice(0, -1), updated];
        }
        return prev;
      });
    });

    return () => {
      cleanup();
    };
  }, []);

  // Adjust content bounds when Copilot opens or closes
  useEffect(() => {
    if (!window.dualsurf?.setContentBounds) return;
    const sidebarWidth = isOpen ? 360 : 0;
    // Shrink content view width by sidebarWidth so page is not covered
    const [winWidth, winHeight] = [window.innerWidth, window.innerHeight];
    window.dualsurf.setContentBounds({
      x: 0,
      y: 78,
      width: Math.max(winWidth - sidebarWidth, 300),
      height: Math.max(winHeight - 78, 200),
    });
  }, [isOpen]);

  const handleSend = async (userPrompt?: string) => {
    const text = (userPrompt || input).trim();
    if (!text || isGenerating) return;

    // Check if Ollama is configured
    if (!ollamaSettings?.enabled && !localStorage.getItem('dualsurf_ollama_onboarded')) {
      onOpenOllamaSetup();
      return;
    }

    const userMsg: CopilotMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      pageContext: activeTab
        ? { title: activeTab.title, url: activeTab.url }
        : undefined,
    };

    const assistantMsg: CopilotMessage = {
      id: `asst_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsGenerating(true);

    try {
      // Gather active page metadata for context
      let pageContextSnippet = '';
      if (activeTab?.id && window.dualsurf?.getPageMetadata) {
        try {
          const meta = await window.dualsurf.getPageMetadata(activeTab.id);
          if (meta) {
            const headingList = meta.headings?.slice(0, 8).map((h) => h.text).join(' | ') || 'None';
            const epList = meta.endpoints && meta.endpoints.length > 0
              ? meta.endpoints.slice(0, 30).map((e) => `- [${e.method}] ${e.path} (${e.category}${e.isExternal ? ', external' : ''})`).join('\n')
              : 'No endpoints detected on this page.';
            const formList = meta.forms && meta.forms.length > 0
              ? meta.forms.slice(0, 8).map((f) => `- [${f.method}] ${f.action}${f.hasPassword ? ' [password field]' : ''}`).join('\n')
              : 'No forms detected.';
            const snippet = meta.textSnippet ? meta.textSnippet.substring(0, 2500) : '(No text content)';

            pageContextSnippet = `\n[Active Page Ground Truth Context]
URL: ${meta.url}
Title: ${meta.title}
Headings: ${headingList}

Verified DOM Endpoints:
${epList}

Verified Forms:
${formList}

Webpage Text Content:
${snippet}
[/End Active Page Ground Truth]`;
          }
        } catch {}
      }

      const systemPrompt = `You are the DualSurf Cyber Browser Copilot. You are private, concise, extremely technical, and cyber-aware.
Help the user analyze web pages, explain tech concepts, audit security risks, or answer research queries. Format your answers in clean Markdown with bolding and code blocks where helpful.

CRITICAL ANTI-HALLUCINATION GUARDRAILS:
1. ONLY refer to endpoints, URLs, routes, forms, and features that are EXPLICITLY present in the [Active Page Ground Truth Context] above.
2. NEVER invent, fabricate, or hallucinate non-existent API routes (such as /api/v1/..., /auth, /users) if they are not listed above.
3. If the user asks about endpoints, routes, forms, or technologies that are absent from the page, clearly state that they are NOT present on this page.${pageContextSnippet}`;

      const historyPayload = [
        { role: 'system', content: systemPrompt },
        ...messages
          .filter((m) => m.id !== 'welcome')
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];

      const res = await window.dualsurf.copilotChat(
        historyPayload,
        ollamaSettings?.model || 'llama3.2',
        ollamaSettings?.host || 'http://127.0.0.1:11434'
      );

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: res.success ? (last.content || res.content || '') : `⚠️ Error: ${res.error || 'Failed to connect to Ollama. Make sure the daemon is running.'}`,
              isStreaming: false,
            },
          ];
        }
        return prev;
      });
    } catch (err: any) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: `⚠️ Request failed: ${err.message}. Is Ollama running?`,
              isStreaming: false,
            },
          ];
        }
        return prev;
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Chat cleared. Ready for your next query or page analysis!',
        timestamp: Date.now(),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <aside className="dualsurf-copilot-sidebar">
      {/* Header */}
      <div className="copilot-header">
        <div className="copilot-title-group">
          <div className="copilot-avatar">
            <Bot size={18} className="copilot-bot-icon" />
          </div>
          <div>
            <div className="copilot-name-row">
              <span className="copilot-name">DualSurf Copilot</span>
              <span className="copilot-model-badge">
                <Cpu size={11} /> {ollamaSettings?.model || 'llama3.2'}
              </span>
            </div>
            <span className="copilot-status-indicator">
              <span className="copilot-dot-pulse" /> 100% Local & Private
            </span>
          </div>
        </div>

        <div className="copilot-header-actions">
          <button
            className="copilot-icon-btn"
            onClick={clearChat}
            title="Clear Chat History"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="copilot-icon-btn"
            onClick={onOpenOllamaSetup}
            title="Configure AI Model"
          >
            <Cpu size={14} />
          </button>
          <button
            className="copilot-icon-btn close"
            onClick={onClose}
            title="Close Copilot"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Active Tab Preview Chip */}
      {activeTab && (
        <div className="copilot-tab-chip">
          <span className="copilot-chip-label">Active Tab:</span>
          <span className="copilot-chip-title" title={activeTab.url}>
            {activeTab.title || activeTab.url}
          </span>
        </div>
      )}

      {/* Quick Action Chips */}
      <div className="copilot-quick-actions">
        <button
          className="copilot-chip-btn"
          onClick={() => handleSend('Summarize this page in 3 clear bullet points with the key takeaways.')}
          disabled={isGenerating}
        >
          <FileText size={12} /> Summarize
        </button>
        <button
          className="copilot-chip-btn"
          onClick={() => handleSend('Perform a security and privacy evaluation of this page and its external links.')}
          disabled={isGenerating}
        >
          <ShieldAlert size={12} /> Audit Page
        </button>
        <button
          className="copilot-chip-btn"
          onClick={() => handleSend('Explain the core technical concepts and jargon found on this page.')}
          disabled={isGenerating}
        >
          <Sparkles size={12} /> Explain
        </button>
        <button
          className="copilot-chip-btn"
          onClick={() => handleSend('Extract any data, tables, or key metrics from this page into clean Markdown tables.')}
          disabled={isGenerating}
        >
          <Table size={12} /> Extract Data
        </button>
      </div>

      {/* Chat Messages */}
      <div className="copilot-messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`copilot-bubble-row ${msg.role === 'user' ? 'user' : 'assistant'}`}
          >
            {msg.role === 'assistant' && (
              <div className="copilot-msg-avatar">
                <Bot size={14} />
              </div>
            )}
            <div className="copilot-bubble">
              <div className="copilot-bubble-text">{msg.content}</div>
              {msg.isStreaming && (
                <span className="copilot-typing-cursor">▊</span>
              )}
              {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                <div className="copilot-bubble-actions">
                  <button
                    className="copilot-copy-btn"
                    onClick={() => copyToClipboard(msg.id, msg.content)}
                    title="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <Check size={12} className="text-success" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isGenerating && messages[messages.length - 1]?.content === '' && (
          <div className="copilot-bubble-row assistant">
            <div className="copilot-msg-avatar">
              <Bot size={14} />
            </div>
            <div className="copilot-bubble loading">
              <Loader2 size={14} className="spin-slow text-cyan" />
              <span>Thinking with local AI...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form
        className="copilot-input-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="copilot-input"
          placeholder="Ask Copilot about this page..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isGenerating}
        />
        <button
          type="submit"
          className="copilot-send-btn"
          disabled={!input.trim() || isGenerating}
        >
          {isGenerating ? <Loader2 size={15} className="spin-slow" /> : <Send size={15} />}
        </button>
      </form>
    </aside>
  );
};
