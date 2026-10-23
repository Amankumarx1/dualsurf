import { IPC_COMMANDS } from '@dualsurf/ipc-protocol';
import type { BrowserControllerState, PageMetadata, TabState } from '@dualsurf/shared-types';
import type { IpcClient } from '../IpcClient.js';
import type { OllamaTool } from '../ollama/OllamaClient.js';
import { findBestMatchingLink, findBestMatchingTab } from '../semantic/fuzzyMatcher.js';

export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  message: string;
  data?: any;
}

export function normalizeToolArgs(rawArgs: any): Record<string, any> {
  if (!rawArgs) return {};
  let parsed = rawArgs;
  if (typeof rawArgs === 'string') {
    try {
      parsed = JSON.parse(rawArgs);
    } catch {
      return {};
    }
  }
  if (parsed && typeof parsed === 'object') {
    if (parsed.properties && typeof parsed.properties === 'object' && !parsed.url && !parsed.query) {
      return parsed.properties;
    }
    if (parsed.arguments) {
      return normalizeToolArgs(parsed.arguments);
    }
    return parsed;
  }
  return {};
}

/**
 * Ollama tool definitions for browser operations.
 */
export const BROWSER_TOOL_DEFINITIONS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate the active tab to a URL or domain (e.g. "https://github.com" or "news.ycombinator.com")',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The destination URL or web domain' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the web using the default search engine (DuckDuckGo/Google)',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords or question' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click_link_by_text',
      description: 'Click a link or button on the current page matching its text label or keyword (e.g. "Pricing", "Documentation", "Login")',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Label, button text, or keyword of the link to click' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click_link',
      description: 'Click an actionable link by its numeric link ID on the current page',
      parameters: {
        type: 'object',
        properties: {
          link_id: { type: 'number', description: 'The numeric identifier of the link' },
        },
        required: ['link_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_content',
      description: 'Inspect the current page to read its title, URL, headings, readable text snippet, and actionable links',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tabs',
      description: 'List all open browser tabs and identify which tab is currently active',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_tab',
      description: 'Switch active tab to a specific index (1, 2...) or by matching title/url keyword (e.g. "github", "docs")',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Tab index number or tab title keyword' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_tab',
      description: 'Open a new browser tab, optionally navigating to an initial URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Optional initial URL for the new tab' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_tab',
      description: 'Close the specified tab by index or close the active tab',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'number', description: 'Optional 1-based index of the tab to close' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'go_back',
      description: 'Navigate back in browser history in the active tab',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_in_page',
      description: 'Search for text keywords occurrences inside the active page',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keyword or phrase to find on the page' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_tabs',
      description: 'Compare the active page with another open tab by tab index or title',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Tab index number or tab title keyword to compare against' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_endpoints',
      description: 'Detect and list all HTTP, API, authentication, and form endpoints found on the active page, with optional filtering (api, auth, download, form)',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Optional category filter: "api", "auth", "download", "form"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_terminal_command',
      description: 'Execute a local shell command or diagnostic tool (e.g. ping, curl, dig, whois, nmap, ifconfig) and return output',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command or tool to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bookmark_page',
      description: 'Bookmark the currently loaded webpage',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_security_headers',
      description: 'Analyze HTTP security headers (CSP, HSTS, X-Frame-Options, server disclosure) for the active page',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cookies',
      description: 'Inspect active session cookies and localStorage items found on the current webpage',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_report',
      description: 'Generate a penetration testing / DOM security reconnaissance markdown report and save it to disk',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Target file path (e.g. "audit.md" or "recon-report.md")' },
        },
        required: ['filename'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_automated_security_scan',
      description: 'Run an end-to-end automated security audit pipeline on a target URL (or active tab): verifies RoE authorization, inspects TLS certificate, evaluates security headers, audits CORS policies, fingerprints tech/WAF stack, scans DOM for leaked secrets/tokens, identifies attack surface endpoints, scores CVSS vulnerabilities, and automatically exports a comprehensive Markdown report.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Target website URL (e.g. "https://example.com" or "localhost:3000")' },
          output_file: { type: 'string', description: 'Optional custom report output file path (e.g. "reports/audit-example.md")' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'audit_security_hygiene',
      description: 'Perform comprehensive passive security audit and DOM hygiene check on the active page (detects missing CSRF tokens, reverse tabnabbing, cleartext form actions, exposed secrets, and security header gaps)',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tls_certificate',
      description: 'Inspect the TLS/SSL X.509 certificate of the target domain, extracting validity dates, Subject Alternative Names (SANs / subdomains), and cipher suites',
      parameters: {
        type: 'object',
        properties: {
          host: { type: 'string', description: 'Optional hostname or URL (defaults to active tab URL)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_cors',
      description: 'Probe and analyze Cross-Origin Resource Sharing (CORS) headers and policies for vulnerabilities (wildcard origin, credentials allowed, origin reflection)',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Optional URL to probe (defaults to active tab URL)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detect_technologies',
      description: 'Fingerprint server infrastructure, frontend/backend frameworks, CMS, and WAF/CDN services for the target URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Optional URL to fingerprint (defaults to active tab URL)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scan_secrets',
      description: 'Scan the active page DOM text snippet and local storage for exposed API keys, JWT tokens, AWS credentials, and private keys',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_security_logs',
      description: 'Ingest and analyze security logs (auth.log, web access logs, syslog, Windows events) to detect brute force, SQLi, webshells, privilege escalation, and map to MITRE ATT&CK',
      parameters: {
        type: 'object',
        properties: {
          log_content: { type: 'string', description: 'Log content string or multi-line event log text' },
          file_path: { type: 'string', description: 'Optional path to log file on disk' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'triage_iocs',
      description: 'Extract, defang, classify (IP, domain, URL, hash), and correlate indicators of compromise from text or active page',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Optional text to parse for IOCs (defaults to active webpage content)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_incident_case',
      description: 'Create, view, or list incident response cases and generate containment action playbooks',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action to perform: "create", "list", "get"' },
          title: { type: 'string', description: 'Title of the incident case (for create)' },
          severity: { type: 'string', description: 'Severity: "P1-CRITICAL", "P2-HIGH", "P3-MEDIUM", "P4-LOW"' },
          category: { type: 'string', description: 'Category (e.g. Web Attack, Credential Compromise)' },
          case_id: { type: 'string', description: 'Case ID (e.g. INC-2026-0001 for get)' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_soar_playbook',
      description: 'Execute automated triage and enrichment SOAR playbook on a target IP, domain, hash, or suspicious event',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Target indicator, domain, IP, or event description to triage' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compute_forensic_hash',
      description: 'Compute cryptographic hashes (SHA-256, SHA-1, MD5) and chain of custody metadata for an artifact file',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to target artifact file on disk' },
        },
        required: ['file_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse_blue_team_roadmap',
      description: 'Query the Blue Team Cybersecurity 31-Domain Roadmap, learning priorities, and career specializations (SOC, IR, Hunt, Detection Eng, DFIR)',
      parameters: {
        type: 'object',
        properties: {
          domain_id: { type: 'number', description: 'Optional domain number (1 to 31) for in-depth syllabus and tools' },
          specialization: { type: 'string', description: 'Optional career path guide: "soc", "ir", "hunt", "detect", "dfir"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_blue_team_checklist',
      description: 'View or update progress across the 30-item Blue Team Master Skills Checklist (Foundations, SOC/SIEM, Endpoint, Investigation, Advanced, Readiness)',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action: "status", "check", "uncheck", "reset"' },
          item_id: { type: 'number', description: 'Item ID (1 to 30) for check/uncheck' },
          notes: { type: 'string', description: 'Optional notes or evidence when completing task' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_detection_rule',
      description: 'Generate standard Sigma YAML detection rule or YARA memory/disk artifact signature for a threat or technique',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Rule type: "sigma" (SIEM detection) or "yara" (file/memory signature)' },
          target: { type: 'string', description: 'Technique ID (e.g. T1190, T1110, T1548) or pattern description' },
          strings: { type: 'array', items: { type: 'string' }, description: 'Artifact strings for YARA rule generation' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hunt_threats',
      description: 'Run proactive threat hunting analytics on telemetry text (detects C2 beaconing with jitter analysis, rare offensive user-agents, anomalous process trees, and Kerberoasting)',
      parameters: {
        type: 'object',
        properties: {
          telemetry: { type: 'string', description: 'Multi-line log, network connection, or process telemetry text to hunt through' },
        },
        required: ['telemetry'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse_red_team_roadmap',
      description: 'Explore the Red Team Cybersecurity 32-Domain Roadmap, 6-Month Study Plan, and offensive specializations (Web, Network, AD, Cloud, Exploit Dev, AI Security)',
      parameters: {
        type: 'object',
        properties: {
          domain_id: { type: 'number', description: 'Optional domain number (1 to 32) to view in-depth syllabus, tools, and objectives' },
          specialization: { type: 'string', description: 'Optional career pathway: "web", "network", "ad", "cloud", "exploit", "ai"' },
          show_study_plan: { type: 'boolean', description: 'If true, returns the 6-Month Accelerated Study Plan' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_red_team_checklist',
      description: 'View or update progress across the 25-item Red Team Master Skills Checklist (Foundations, Reconnaissance, Systems & Identity, Specialized, Professional Delivery)',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action: "status", "check", "uncheck", "reset"' },
          item_id: { type: 'number', description: 'Task ID (1 to 25) to check or uncheck' },
          notes: { type: 'string', description: 'Optional verification notes or evidence' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_engagement_scope',
      description: 'Manage Rules of Engagement (RoE) scopes and verify whether target domains or IP ranges are explicitly authorized for assessment',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action: "list", "get", "check_target", "create"' },
          scope_id: { type: 'string', description: 'Optional scope ID (e.g. ROE-2026-001)' },
          target: { type: 'string', description: 'Domain, URL, or IP address to verify authorization against scope' },
          client_name: { type: 'string', description: 'Client or project name for scope creation' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_pentest_findings',
      description: 'Create, view, list, or update penetration testing findings with CVSS v3.1 risk scores and actionable remediation',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action: "list", "view", "create", "update_status"' },
          finding_id: { type: 'string', description: 'Finding ID (e.g. FIND-2026-001)' },
          title: { type: 'string', description: 'Finding title (for create)' },
          severity: { type: 'string', description: 'Severity: "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"' },
          affected_asset: { type: 'string', description: 'Vulnerable URL, host, or component' },
          status: { type: 'string', description: 'Status: "Open", "Retested", "Remediated"' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_purple_team_tests',
      description: 'Track and review Purple Team collaborative test cases and telemetry coverage across MITRE ATT&CK techniques',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action: "list", "get", "update_status"' },
          test_id: { type: 'string', description: 'Test ID (e.g. PT-01)' },
          status: { type: 'string', description: 'Detection status: "DETECTED", "BLIND_SPOT", "PARTIAL"' },
          notes: { type: 'string', description: 'Detection engineering tuning notes' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_red_team_tool',
      description: 'Execute tools from the 7 Red Team Operational Pillars (nmap, amass, subfinder, theharvester, maltego, wireshark, metasploit, nessus, burp, zap, postman, bloodhound, impacket, netexec, powershell, prowler, scoutsuite, trivy, atomic, caldera, retest) with live real data',
      parameters: {
        type: 'object',
        properties: {
          tool: { type: 'string', description: 'Name of the tool to execute' },
          target: { type: 'string', description: 'Optional target host, domain, or URL' },
          extra_args: { type: 'string', description: 'Optional extra command line parameters' },
        },
        required: ['tool'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'audit_red_team_tools',
      description: 'Audit system availability and DualSurf engine fallback status across all 7 Red Team operational pillars',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];



/**
 * Execute a browser tool call against the DualSurf Browser Controller via IPC.
 */
export async function executeBrowserTool(
  client: IpcClient,
  toolName: string,
  rawArgs: any
): Promise<ToolExecutionResult> {
  const args = normalizeToolArgs(rawArgs);

  try {
    switch (toolName) {
      case 'navigate': {
        const url = args.url || args.target || args.destination;
        if (!url) {
          return { tool: toolName, success: false, message: 'Missing "url" parameter' };
        }
        await client.sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url });
        return {
          tool: toolName,
          success: true,
          message: `Navigated active tab to: ${url}`,
          data: { url },
        };
      }

      case 'search_web': {
        const query = args.query || args.q || args.text;
        if (!query) {
          return { tool: toolName, success: false, message: 'Missing "query" parameter' };
        }
        await client.sendCommand(IPC_COMMANDS.PAGE_NAVIGATE, { url: query });
        return {
          tool: toolName,
          success: true,
          message: `Dispatched search for: "${query}"`,
          data: { query },
        };
      }

      case 'click_link_by_text': {
        const text = args.text || args.label || args.query || args.name;
        if (!text) {
          return { tool: toolName, success: false, message: 'Missing "text" parameter' };
        }
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const match = findBestMatchingLink(text, meta.links || []);
        if (!match) {
          return {
            tool: toolName,
            success: false,
            message: `Could not find any link matching "${text}" on page "${meta.title}".`,
          };
        }
        await client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId: match.item.id });
        return {
          tool: toolName,
          success: true,
          message: `Clicked link [${match.item.id}] "${match.item.label}" -> ${match.item.href}`,
          data: match.item,
        };
      }

      case 'click_link': {
        const linkId = parseInt(args.link_id ?? args.linkId ?? args.id, 10);
        if (isNaN(linkId)) {
          return { tool: toolName, success: false, message: 'Missing or invalid "link_id"' };
        }
        await client.sendCommand(IPC_COMMANDS.PAGE_CLICK_LINK, { linkId });
        return {
          tool: toolName,
          success: true,
          message: `Activated link ID [${linkId}].`,
          data: { linkId },
        };
      }

      case 'get_page_content': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const topLinks = (meta.links || []).slice(0, 15).map((l) => `[${l.id}] ${l.label} (${l.endpoint || l.href})`);
        const topEndpoints = (meta.endpoints || []).slice(0, 10).map((e) => `[${e.category.toUpperCase()}] ${e.method || 'GET'} ${e.path}`);
        return {
          tool: toolName,
          success: true,
          message: `Page: "${meta.title}" (${meta.url}) - ${meta.endpoints?.length || 0} endpoints detected`,
          data: {
            title: meta.title,
            url: meta.url,
            headings: (meta.headings || []).slice(0, 8),
            textSnippet: (meta.textSnippet || '').substring(0, 1500),
            topLinks,
            topEndpoints,
          },
        };
      }

      case 'list_endpoints': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const filterCat = args.category?.toLowerCase();
        let endpoints = meta.endpoints || [];
        if (filterCat) {
          endpoints = endpoints.filter((e) => e.category.toLowerCase().includes(filterCat));
        }
        return {
          tool: toolName,
          success: true,
          message: `Detected ${endpoints.length} endpoints on "${meta.title}".`,
          data: {
            total: endpoints.length,
            endpoints: endpoints.slice(0, 25).map((e) => ({
              id: e.id,
              path: e.path,
              category: e.category,
              method: e.method || 'GET',
              label: e.label,
              url: e.url,
            })),
          },
        };
      }

      case 'list_tabs': {
        const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        const tabSummaries = state.tabs.map((t, idx) => ({
          index: idx + 1,
          id: t.id,
          title: t.title,
          url: t.url,
          isActive: t.id === state.activeTabId,
        }));
        return {
          tool: toolName,
          success: true,
          message: `Open tabs count: ${state.tabs.length}`,
          data: { activeTabId: state.activeTabId, tabs: tabSummaries },
        };
      }

      case 'switch_tab': {
        const target = String(args.target ?? args.index ?? args.query ?? '');
        const numeric = parseInt(target, 10);
        if (!isNaN(numeric)) {
          await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { index: numeric });
          return { tool: toolName, success: true, message: `Switched to tab index [${numeric}].` };
        }

        const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        const match = findBestMatchingTab(target, state.tabs);
        if (match) {
          await client.sendCommand(IPC_COMMANDS.TABS_SWITCH, { tabId: match.tab.id });
          return {
            tool: toolName,
            success: true,
            message: `Switched to tab [${match.index}] "${match.tab.title}".`,
          };
        }
        return { tool: toolName, success: false, message: `No matching tab found for "${target}".` };
      }

      case 'create_tab': {
        const url = args.url || undefined;
        const newTab = await client.sendCommand(IPC_COMMANDS.TABS_CREATE, { url });
        return {
          tool: toolName,
          success: true,
          message: `Opened new tab: ${newTab.id} (${newTab.url})`,
          data: newTab,
        };
      }

      case 'close_tab': {
        const index = args.index !== undefined ? parseInt(args.index, 10) : undefined;
        await client.sendCommand(IPC_COMMANDS.TABS_CLOSE, { index });
        return { tool: toolName, success: true, message: 'Closed tab.' };
      }

      case 'go_back': {
        await client.sendCommand(IPC_COMMANDS.NAV_BACK);
        return { tool: toolName, success: true, message: 'Navigated back in active tab.' };
      }

      case 'search_in_page': {
        const query = args.query || args.q || args.text;
        if (!query) {
          return { tool: toolName, success: false, message: 'Missing "query" parameter' };
        }
        const result = await client.sendCommand(IPC_COMMANDS.PAGE_FIND, { query });
        return {
          tool: toolName,
          success: true,
          message: `Found ${result.count} occurrences of "${query}".`,
          data: result,
        };
      }

      case 'compare_tabs': {
        const target = String(args.target ?? args.index ?? '');
        const state: BrowserControllerState = await client.sendCommand(IPC_COMMANDS.TABS_LIST);
        const match = findBestMatchingTab(target, state.tabs);
        if (!match) {
          return { tool: toolName, success: false, message: `Could not find target tab "${target}" to compare.` };
        }
        const currentMeta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        return {
          tool: toolName,
          success: true,
          message: `Comparison target tab located: [${match.index}] "${match.tab.title}"`,
          data: {
            currentTab: { title: currentMeta.title, url: currentMeta.url },
            targetTab: { index: match.index, id: match.tab.id, title: match.tab.title, url: match.tab.url },
          },
        };
      }

      case 'run_terminal_command': {
        const cmd = args.command || args.cmd;
        if (!cmd) {
          return { tool: toolName, success: false, message: 'Missing "command" parameter' };
        }
        const { executeShellCommand } = await import('../tools/shellExecutor.js');
        const res = await executeShellCommand(cmd, { timeoutMs: 15000 });
        const output = (res.stdout || res.stderr || '(No output)').trim();
        return {
          tool: toolName,
          success: res.exitCode === 0,
          message: `Command executed with exit code ${res.exitCode} (${res.durationMs}ms):\n${output.substring(0, 800)}`,
          data: {
            command: cmd,
            exitCode: res.exitCode,
            output: output.substring(0, 1500),
            durationMs: res.durationMs,
          },
        };
      }

      case 'bookmark_page': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const bm = await client.sendCommand(IPC_COMMANDS.BOOKMARKS_ADD, {
          url: meta.url,
          title: meta.title,
        });
        return {
          tool: toolName,
          success: true,
          message: `Saved bookmark: "${bm.title}" (${bm.url})`,
          data: bm,
        };
      }

      case 'get_security_headers': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const { analyzeSecurityHeaders, formatSecurityHeaders } = await import('../tools/recon.js');
        const analysis = await analyzeSecurityHeaders(meta.url);
        return {
          tool: toolName,
          success: true,
          message: `Security headers for ${meta.url}: Grade ${analysis.grade} (${analysis.score}%)\n${formatSecurityHeaders(analysis)}`,
          data: analysis,
        };
      }

      case 'get_cookies': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const cookies = meta.cookies || [];
        const storage = meta.storage || [];
        return {
          tool: toolName,
          success: true,
          message: `Found ${cookies.length} cookies and ${storage.length} localStorage entries on ${meta.url}.`,
          data: { cookies, storage },
        };
      }

      case 'export_report': {
        const filename = String(args.filename || 'audit-report.md');
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const { analyzeSecurityHeaders, generateMarkdownReport, exportReportToFile } = await import('../tools/recon.js');
        let headers;
        try {
          headers = await analyzeSecurityHeaders(meta.url);
        } catch {
          // offline fallback
        }
        const report = generateMarkdownReport(meta, headers);
        const fullPath = exportReportToFile(filename, report);
        return {
          tool: toolName,
          success: true,
          message: `Successfully generated and saved DOM & Security audit report to: ${fullPath}`,
          data: { path: fullPath, sizeBytes: report.length },
        };
      }

      case 'run_automated_security_scan': {
        const { runAutomatedSecurityAudit, formatAutoAuditTerminal } = await import('../tools/autoAudit.js');
        let targetUrl = args.url;
        if (!targetUrl) {
          const meta = await client.sendCommand<PageMetadata>(IPC_COMMANDS.PAGE_GET_METADATA);
          targetUrl = meta?.url;
        }
        if (!targetUrl || targetUrl === 'about:blank') {
          return { tool: toolName, success: false, message: 'Target URL is required for automated security scan.' };
        }
        const auditResult = await runAutomatedSecurityAudit(targetUrl, {
          outputPath: args.output_file || args.filename,
          autoExportReport: true,
          deepInspect: true,
        });
        return {
          tool: toolName,
          success: true,
          message: formatAutoAuditTerminal(auditResult),
          data: auditResult,
        };
      }

      case 'audit_security_hygiene': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const { analyzeSecurityHeaders } = await import('../tools/recon.js');
        const { auditPassiveSecurity, formatSecurityAudit } = await import('../tools/securityAudit.js');
        let headers;
        try {
          headers = await analyzeSecurityHeaders(meta.url);
        } catch {
          // offline
        }
        const report = auditPassiveSecurity(meta, headers);
        return {
          tool: toolName,
          success: true,
          message: `Security Audit for ${meta.url}: Risk Level ${report.riskLevel} (Score ${report.score}/100, ${report.issues.length} issues found)\n${formatSecurityAudit(report)}`,
          data: report,
        };
      }

      case 'get_tls_certificate': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const target = args.host || args.url || meta.url;
        const { inspectTlsCertificate, formatTlsCertificate } = await import('../tools/securityAudit.js');
        const cert = await inspectTlsCertificate(target);
        return {
          tool: toolName,
          success: true,
          message: `TLS Certificate for ${cert.host}:${cert.port}:\n${formatTlsCertificate(cert)}`,
          data: cert,
        };
      }

      case 'analyze_cors': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const target = args.url || meta.url;
        const { analyzeCorsPolicy, formatCorsAnalysis } = await import('../tools/securityAudit.js');
        const cors = await analyzeCorsPolicy(target);
        return {
          tool: toolName,
          success: true,
          message: `CORS Policy Audit for ${cors.url}: Risk ${cors.risk} - ${cors.verdict}\n${formatCorsAnalysis(cors)}`,
          data: cors,
        };
      }

      case 'detect_technologies': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const target = args.url || meta.url;
        const { analyzeSecurityHeaders } = await import('../tools/recon.js');
        const { detectTechnologies, formatTechProfile } = await import('../tools/securityAudit.js');
        let headers;
        try {
          headers = await analyzeSecurityHeaders(target);
        } catch {
          // offline
        }
        const tech = detectTechnologies(target, meta.scripts, headers);
        return {
          tool: toolName,
          success: true,
          message: `Technology Profile for ${target}:\n${formatTechProfile(tech)}`,
          data: tech,
        };
      }

      case 'scan_secrets': {
        const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
        const { scanForSecrets } = await import('../tools/securityAudit.js');
        const combined = [
          meta.textSnippet || '',
          JSON.stringify(meta.storage || []),
          JSON.stringify(meta.cookies || []),
        ].join('\n');
        const findings = scanForSecrets(combined);
        return {
          tool: toolName,
          success: true,
          message: findings.length > 0
            ? `WARNING: Detected ${findings.length} potentially exposed secret(s) in DOM or storage:\n` +
              findings.map((f) => `  - [${f.type}] ${f.snippet}`).join('\n')
            : `Clean: No credentials, JWT tokens, AWS keys, or private keys found in active DOM snippet or storage.`,
          data: { count: findings.length, findings },
        };
      }

      case 'analyze_security_logs': {
        const { analyzeSecurityLogs, formatSiemReport } = await import('../tools/blueTeam.js');
        let content = args.log_content || args.logs || args.text;
        if (!content && args.file_path) {
          const fs = await import('fs');
          if (fs.existsSync(args.file_path)) {
            content = fs.readFileSync(args.file_path, 'utf8');
          } else {
            return { tool: toolName, success: false, message: `Log file not found: ${args.file_path}` };
          }
        }
        if (!content) {
          return { tool: toolName, success: false, message: 'Missing "log_content" or "file_path" parameter' };
        }
        const report = analyzeSecurityLogs(content);
        return {
          tool: toolName,
          success: true,
          message: `SIEM Log Analysis Complete: Risk Rating ${report.riskRating} (${report.totalAlerts} alerts from ${report.totalLinesAnalyzed} events)\n${formatSiemReport(report)}`,
          data: report,
        };
      }

      case 'triage_iocs': {
        const { extractIocs, formatIocFindings } = await import('../tools/blueTeam.js');
        let text = args.text || args.content || args.target;
        if (!text) {
          const meta: PageMetadata = await client.sendCommand(IPC_COMMANDS.PAGE_GET_METADATA);
          text = [meta.title, meta.url, meta.textSnippet || ''].join('\n');
        }
        const findings = extractIocs(text);
        return {
          tool: toolName,
          success: true,
          message: `IOC Triage Complete: Found ${findings.length} indicators\n${formatIocFindings(findings)}`,
          data: { count: findings.length, findings },
        };
      }

      case 'manage_incident_case': {
        const { incidentStore, formatIncidentCase } = await import('../tools/blueTeam.js');
        const action = (args.action || 'list').toLowerCase();
        if (action === 'create') {
          const title = args.title || 'Investigated Security Anomaly';
          const sev = args.severity || 'P3-MEDIUM';
          const cat = args.category || 'Threat Investigation';
          const newCase = incidentStore.createCase(title, sev, cat);
          return {
            tool: toolName,
            success: true,
            message: `Created Incident Case ${newCase.id}: ${newCase.title} [${newCase.severity}]\n${formatIncidentCase(newCase)}`,
            data: newCase,
          };
        } else if (action === 'get') {
          const c = incidentStore.getCase(args.case_id);
          if (!c) {
            return { tool: toolName, success: false, message: `Incident case not found: ${args.case_id}` };
          }
          return {
            tool: toolName,
            success: true,
            message: formatIncidentCase(c),
            data: c,
          };
        } else {
          const list = incidentStore.listCases();
          return {
            tool: toolName,
            success: true,
            message: `Active Incident Cases (${list.length}):\n` +
              list.map((c) => `  • [${c.id}] ${c.title} (${c.severity} - ${c.status})`).join('\n'),
            data: list,
          };
        }
      }

      case 'run_soar_playbook': {
        const target = args.target || args.indicator;
        if (!target) {
          return { tool: toolName, success: false, message: 'Missing "target" parameter' };
        }
        const { runSoarTriagePlaybook, formatSoarTriage } = await import('../tools/blueTeam.js');
        const result = await runSoarTriagePlaybook(target);
        return {
          tool: toolName,
          success: true,
          message: `SOAR Playbook Executed for "${target}":\n${formatSoarTriage(result)}`,
          data: result,
        };
      }

      case 'compute_forensic_hash': {
        const targetPath = args.file_path || args.path || args.file;
        if (!targetPath) {
          return { tool: toolName, success: false, message: 'Missing "file_path" parameter' };
        }
        const { computeForensicHash, formatForensicEvidence } = await import('../tools/blueTeam.js');
        try {
          const evidence = computeForensicHash(targetPath);
          return {
            tool: toolName,
            success: true,
            message: formatForensicEvidence(evidence),
            data: evidence,
          };
        } catch (err: any) {
          return { tool: toolName, success: false, message: err.message };
        }
      }

      case 'browse_blue_team_roadmap': {
        const {
          formatBlueTeamDomainList,
          formatBlueTeamDomainDetail,
          getSpecializationGuide,
          BLUE_TEAM_DOMAINS,
        } = await import('../tools/blueTeam.js');

        if (args.specialization) {
          const guide = getSpecializationGuide(args.specialization);
          return { tool: toolName, success: true, message: guide, data: { specialization: args.specialization } };
        }

        if (args.domain_id) {
          const domainNum = parseInt(String(args.domain_id), 10);
          const detail = formatBlueTeamDomainDetail(domainNum);
          const domainObj = BLUE_TEAM_DOMAINS.find((d) => d.id === domainNum);
          return { tool: toolName, success: !!domainObj, message: detail, data: domainObj };
        }

        const list = formatBlueTeamDomainList();
        return { tool: toolName, success: true, message: list, data: { domainsCount: BLUE_TEAM_DOMAINS.length } };
      }

      case 'manage_blue_team_checklist': {
        const { checklistManager } = await import('../tools/blueTeam.js');
        const action = (args.action || 'status').toLowerCase();

        if (action === 'check') {
          const id = parseInt(String(args.item_id || args.id), 10);
          if (isNaN(id) || id < 1 || id > 30) {
            return { tool: toolName, success: false, message: 'Invalid item_id. Must be between 1 and 30.' };
          }
          const item = checklistManager.checkItem(id, args.notes);
          return {
            tool: toolName,
            success: true,
            message: `✔ Marked task #${id} as Completed: "${item?.task}"\n${checklistManager.formatReport()}`,
            data: item,
          };
        } else if (action === 'uncheck') {
          const id = parseInt(String(args.item_id || args.id), 10);
          if (isNaN(id) || id < 1 || id > 30) {
            return { tool: toolName, success: false, message: 'Invalid item_id. Must be between 1 and 30.' };
          }
          const item = checklistManager.uncheckItem(id);
          return {
            tool: toolName,
            success: true,
            message: `Task #${id} marked as Incomplete: "${item?.task}"\n${checklistManager.formatReport()}`,
            data: item,
          };
        } else if (action === 'reset') {
          checklistManager.resetChecklist();
          return {
            tool: toolName,
            success: true,
            message: `Blue Team Master Checklist reset to 0/30.\n${checklistManager.formatReport()}`,
            data: checklistManager.getStats(),
          };
        } else {
          return {
            tool: toolName,
            success: true,
            message: checklistManager.formatReport(),
            data: checklistManager.getStats(),
          };
        }
      }

      case 'generate_detection_rule': {
        const target = args.target || args.technique || 'T1190';
        const type = (args.type || 'sigma').toLowerCase();
        const { generateSigmaRule, formatSigmaYaml, generateYaraRule } = await import('../tools/blueTeam.js');

        if (type === 'yara') {
          const patterns = Array.isArray(args.strings) ? args.strings : [target];
          const yaraRule = generateYaraRule(target, patterns);
          return {
            tool: toolName,
            success: true,
            message: `Generated YARA Rule:\n\n${yaraRule}`,
            data: { yaraRule },
          };
        }

        const ruleDef = generateSigmaRule(target);
        const yamlOutput = formatSigmaYaml(ruleDef);
        return {
          tool: toolName,
          success: true,
          message: `Generated Production Sigma YAML Rule:\n\n${yamlOutput}`,
          data: ruleDef,
        };
      }

      case 'hunt_threats': {
        const telemetry = args.telemetry || args.logs || '';
        if (!telemetry) {
          return { tool: toolName, success: false, message: 'Missing "telemetry" text parameter' };
        }
        const { huntThreats, formatThreatHuntReport } = await import('../tools/blueTeam.js');
        const findings = huntThreats(telemetry);
        return {
          tool: toolName,
          success: true,
          message: formatThreatHuntReport(findings),
          data: { count: findings.length, findings },
        };
      }

      case 'browse_red_team_roadmap': {
        const {
          RED_TEAM_DOMAINS,
          formatRedTeamDomainList,
          formatRedTeamDomainDetail,
          getRedSpecializationGuide,
          getRedTeamStudyPlan,
        } = await import('../tools/redTeam.js');

        if (args.show_study_plan) {
          const plan = getRedTeamStudyPlan();
          return { tool: toolName, success: true, message: plan, data: { plan: '6-Month Plan' } };
        }

        if (args.specialization) {
          const guide = getRedSpecializationGuide(args.specialization);
          return { tool: toolName, success: true, message: guide, data: { specialization: args.specialization } };
        }

        if (args.domain_id) {
          const domainNum = parseInt(String(args.domain_id), 10);
          const detail = formatRedTeamDomainDetail(domainNum);
          const domainObj = RED_TEAM_DOMAINS.find((d) => d.id === domainNum);
          return { tool: toolName, success: !!domainObj, message: detail, data: domainObj };
        }

        const list = formatRedTeamDomainList();
        return { tool: toolName, success: true, message: list, data: { domainsCount: RED_TEAM_DOMAINS.length } };
      }

      case 'manage_red_team_checklist': {
        const { redChecklistManager } = await import('../tools/redTeam.js');
        const action = (args.action || 'status').toLowerCase();

        if (action === 'check') {
          const id = parseInt(String(args.item_id || args.id), 10);
          if (isNaN(id) || id < 1 || id > 25) {
            return { tool: toolName, success: false, message: 'Invalid item_id. Must be between 1 and 25.' };
          }
          const item = redChecklistManager.checkItem(id, args.notes);
          return {
            tool: toolName,
            success: true,
            message: `✔ Marked task #${id} as Completed: "${item?.task}"\n${redChecklistManager.formatReport()}`,
            data: item,
          };
        } else if (action === 'uncheck') {
          const id = parseInt(String(args.item_id || args.id), 10);
          if (isNaN(id) || id < 1 || id > 25) {
            return { tool: toolName, success: false, message: 'Invalid item_id. Must be between 1 and 25.' };
          }
          const item = redChecklistManager.uncheckItem(id);
          return {
            tool: toolName,
            success: true,
            message: `Task #${id} marked as Incomplete: "${item?.task}"\n${redChecklistManager.formatReport()}`,
            data: item,
          };
        } else if (action === 'reset') {
          redChecklistManager.resetChecklist();
          return {
            tool: toolName,
            success: true,
            message: `Red Team Master Checklist reset to 0/25.\n${redChecklistManager.formatReport()}`,
            data: redChecklistManager.getStats(),
          };
        } else {
          return {
            tool: toolName,
            success: true,
            message: redChecklistManager.formatReport(),
            data: redChecklistManager.getStats(),
          };
        }
      }

      case 'manage_engagement_scope': {
        const { engagementStore, formatEngagementScope } = await import('../tools/redTeam.js');
        const action = (args.action || 'list').toLowerCase();

        if (action === 'check_target') {
          const target = args.target || '';
          if (!target) {
            return { tool: toolName, success: false, message: 'Missing "target" parameter to verify against scope.' };
          }
          const scopeId = args.scope_id || engagementStore.listScopes()[0]?.id || 'ROE-2026-001';
          const result = engagementStore.isTargetInScope(scopeId, target);
          return {
            tool: toolName,
            success: result.inScope,
            message: `Target Authorization Check [${scopeId}]: ${result.inScope ? 'AUTHORIZED' : 'UNAUTHORIZED / OUT OF SCOPE'}\n${result.reason}`,
            data: result,
          };
        } else if (action === 'get') {
          const scopeId = args.scope_id || 'ROE-2026-001';
          const scope = engagementStore.getScope(scopeId);
          if (!scope) {
            return { tool: toolName, success: false, message: `Engagement scope ${scopeId} not found.` };
          }
          return {
            tool: toolName,
            success: true,
            message: formatEngagementScope(scope),
            data: scope,
          };
        } else if (action === 'create') {
          const clientName = args.client_name || 'Client Engagement';
          const newScope = engagementStore.createScope({
            clientName,
            targetDomains: args.target_domains || ['target.internal'],
            targetIpRanges: args.target_ip_ranges || ['192.168.1.0/24'],
          });
          return {
            tool: toolName,
            success: true,
            message: `Created new Engagement Scope [${newScope.id}]:\n${formatEngagementScope(newScope)}`,
            data: newScope,
          };
        } else {
          const scopes = engagementStore.listScopes();
          const listText = scopes.map((s) => formatEngagementScope(s)).join('\n\n');
          return {
            tool: toolName,
            success: true,
            message: listText || 'No active engagement scopes defined.',
            data: scopes,
          };
        }
      }

      case 'manage_pentest_findings': {
        const { findingStore, formatPentestFinding, formatPentestReport } = await import('../tools/redTeam.js');
        const action = (args.action || 'list').toLowerCase();

        if (action === 'view') {
          const findingId = args.finding_id || '';
          const finding = findingStore.getFinding(findingId);
          if (!finding) {
            return { tool: toolName, success: false, message: `Finding ${findingId} not found.` };
          }
          return {
            tool: toolName,
            success: true,
            message: formatPentestFinding(finding),
            data: finding,
          };
        } else if (action === 'create') {
          const title = args.title || 'Untitled Assessment Finding';
          const affectedAsset = args.affected_asset || args.asset || 'https://target.internal';
          const newFinding = findingStore.createFinding({
            title,
            affectedAsset,
            severity: args.severity || 'HIGH',
            category: args.category || 'Web Application',
            description: args.description || 'Vulnerability identified during authorized testing.',
            impact: args.impact || 'Potential unauthorized access or compromise.',
            remediation: args.remediation || 'Apply input validation and patch vulnerable service.',
          });
          return {
            tool: toolName,
            success: true,
            message: `Created Pentest Finding [${newFinding.id}] (CVSS ${newFinding.cvssScore}):\n${formatPentestFinding(newFinding)}`,
            data: newFinding,
          };
        } else if (action === 'update_status') {
          const findingId = args.finding_id || '';
          const status = args.status || 'Remediated';
          const updated = findingStore.updateStatus(findingId, status);
          if (!updated) {
            return { tool: toolName, success: false, message: `Finding ${findingId} not found.` };
          }
          return {
            tool: toolName,
            success: true,
            message: `Updated Finding [${updated.id}] status to: ${updated.status}`,
            data: updated,
          };
        } else {
          const all = findingStore.listFindings();
          return {
            tool: toolName,
            success: true,
            message: formatPentestReport(all),
            data: all,
          };
        }
      }

      case 'manage_purple_team_tests': {
        const { purpleTeamStore, formatPurpleTeamMatrix } = await import('../tools/redTeam.js');
        const action = (args.action || 'list').toLowerCase();

        if (action === 'get') {
          const testId = args.test_id || '';
          const tc = purpleTeamStore.getTestCase(testId);
          if (!tc) {
            return { tool: toolName, success: false, message: `Purple Team test case ${testId} not found.` };
          }
          return {
            tool: toolName,
            success: true,
            message: `Purple Team Test [${tc.id}]: ${tc.techniqueId} - ${tc.techniqueName}\nTactic: ${tc.tactic}\nStatus: ${tc.detectionStatus}\nTest Behavior: ${tc.testBehavior}\nExpected Telemetry: ${tc.expectedTelemetry.join(', ')}\nRemediation Notes: ${tc.remediationNotes}`,
            data: tc,
          };
        } else if (action === 'update_status') {
          const testId = args.test_id || '';
          const status = args.status || 'DETECTED';
          const updated = purpleTeamStore.updateDetectionStatus(testId, status, args.notes);
          if (!updated) {
            return { tool: toolName, success: false, message: `Purple Team test case ${testId} not found.` };
          }
          return {
            tool: toolName,
            success: true,
            message: `Updated Purple Team test [${updated.id}] detection status to: ${updated.detectionStatus}`,
            data: updated,
          };
        } else {
          const tests = purpleTeamStore.listTestCases();
          return {
            tool: toolName,
            success: true,
            message: formatPurpleTeamMatrix(tests),
            data: tests,
          };
        }
      }

      case 'execute_red_team_tool': {
        const { executeRedTeamTool } = await import('../tools/redTeam.js');
        const tool = args.tool || 'osint';
        const target = args.target || '127.0.0.1';
        const extraArgs = args.extra_args ? args.extra_args.split(/\s+/) : [];
        const result = await executeRedTeamTool(tool, target, extraArgs);
        return {
          tool: toolName,
          success: result.status === 'SUCCESS' || result.status === 'PARTIAL',
          message: result.output,
          data: result,
        };
      }

      case 'audit_red_team_tools': {
        const { auditRedTeamTools, formatRedTeamToolsAudit } = await import('../tools/shellExecutor.js');
        const data = auditRedTeamTools();
        return {
          tool: toolName,
          success: true,
          message: formatRedTeamToolsAudit(data),
          data,
        };
      }

      default: {


        return { tool: toolName, success: false, message: `Unknown tool: ${toolName}` };
      }
    }
  } catch (err) {
    return {
      tool: toolName,
      success: false,
      message: `Execution failed: ${(err as Error).message}`,
    };
  }
}
