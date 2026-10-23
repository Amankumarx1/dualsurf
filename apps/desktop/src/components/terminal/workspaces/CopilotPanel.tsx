import React, { useState } from 'react';
import { Bot, Sparkles, Shield, AlertTriangle, Play, Terminal, CheckCircle, Info, ArrowRight } from 'lucide-react';
import type { AiCopilotCommandProposal } from '@dualsurf/shared-types';

interface CopilotPanelProps {
  onRunInTerminal?: (command: string) => void;
  activeUrl?: string;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({ onRunInTerminal, activeUrl }) => {
  const [taskPrompt, setTaskPrompt] = useState<string>('Analyze this packet capture and identify unusual DNS queries');
  const [target, setTarget] = useState<string>(activeUrl || '127.0.0.1');
  const [proposal, setProposal] = useState<AiCopilotCommandProposal | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [approved, setApproved] = useState<boolean>(false);

  const sampleTasks = [
    'Analyze this packet capture and identify unusual DNS queries',
    'Audit local Linux configuration for CIS benchmark compliance',
    'Scan authorized lab target for listening web services',
    'Find SUID binaries and audit privilege escalation vectors',
    'Inspect active HTTP proxy logs and TLS certificates',
  ];

  const handleGenerate = async (customTask?: string) => {
    const taskToRun = customTask || taskPrompt;
    setLoading(true);
    setApproved(false);
    try {
      if (window.dualsurf?.proposeCopilotCommand) {
        const res = await window.dualsurf.proposeCopilotCommand(taskToRun, target);
        setProposal(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndExecute = () => {
    if (!proposal) return;
    setApproved(true);
    onRunInTerminal?.(proposal.command);
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low':
        return '#3fb950';
      case 'medium':
        return '#d29922';
      case 'high':
        return '#f85149';
      case 'critical':
      case 'dangerous':
        return '#ff7b72';
      default:
        return '#58a6ff';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c1017', color: '#e6edf3', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#00d2ff' }}>
          <Bot size={20} />
          <span>AI Command Copilot & Task Orchestrator</span>
        </h2>
        <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
          Verified command synthesis, permission transparency, target scoping, and strict execution approval gating
        </div>
      </div>

      {/* Quick Prompts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {sampleTasks.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTaskPrompt(t);
              handleGenerate(t);
            }}
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              color: '#c9d1d9',
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Sparkles size={11} color="#00ffc8" />
            <span>{t}</span>
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div style={{ background: '#131822', border: '1px solid #21262d', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '12px', color: '#8b949e', display: 'block', marginBottom: '4px' }}>
            WHAT DO YOU WANT TO ACCOMPLISH?
          </label>
          <input
            type="text"
            value={taskPrompt}
            onChange={(e) => setTaskPrompt(e.target.value)}
            placeholder="Describe your security assessment goal..."
            style={{
              width: '100%',
              background: '#0c1017',
              border: '1px solid #30363d',
              color: '#e6edf3',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#8b949e' }}>Target Scope:</span>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Target host / IP"
              style={{
                background: '#0c1017',
                border: '1px solid #30363d',
                color: '#00ffc8',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                width: '160px',
              }}
            />
          </div>

          <button
            onClick={() => handleGenerate()}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #00d2ff 0%, #00ffc8 100%)',
              border: 'none',
              color: '#0c1017',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={13} fill="#0c1017" />
            <span>{loading ? 'Synthesizing...' : 'Generate Command Proposal'}</span>
          </button>
        </div>
      </div>

      {/* Generated Proposal Card */}
      {proposal && (
        <div
          style={{
            background: '#131822',
            border: '1px solid #30363d',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #21262d', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} color="#00d2ff" />
              <span style={{ fontWeight: 600, color: '#f8f8f2', fontSize: '14px' }}>
                Tool: {proposal.tool}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: `${getRiskColor(proposal.riskLevel)}22`,
                  color: getRiskColor(proposal.riskLevel),
                  border: `1px solid ${getRiskColor(proposal.riskLevel)}`,
                }}
              >
                RISK: {proposal.riskLevel.toUpperCase()}
              </span>

              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(201,209,217,0.1)',
                  color: '#c9d1d9',
                }}
              >
                PERM: {proposal.requiredPrivilege}
              </span>
            </div>
          </div>

          {/* Command Codeblock */}
          <div>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px' }}>PROPOSED COMMAND:</div>
            <pre
              style={{
                margin: 0,
                background: '#0c1017',
                border: '1px solid #21262d',
                borderRadius: '6px',
                padding: '12px',
                color: '#00ffc8',
                fontSize: '13px',
                fontFamily: 'monospace',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {proposal.command}
            </pre>
          </div>

          {/* Explanation */}
          <div style={{ fontSize: '12px', color: '#c9d1d9', background: 'rgba(56,139,253,0.06)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #00d2ff' }}>
            <strong style={{ color: '#00d2ff' }}>Explanation: </strong>
            {proposal.explanation}
          </div>

          {/* Execution Approval Gate */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #21262d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#8b949e' }}>
              <Shield size={13} color="#3fb950" />
              <span>Awaiting manual user approval before dispatching to Linux runtime</span>
            </div>

            <button
              onClick={handleApproveAndExecute}
              disabled={approved}
              style={{
                background: approved ? '#238636' : '#2ea043',
                border: 'none',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: approved ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {approved ? <CheckCircle size={14} /> : <Play size={14} fill="#fff" />}
              <span>{approved ? 'Executed in Terminal' : 'Approve & Execute in Terminal'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
