# DualSurf Technical Architecture & Security Specification

## 1. System Overview

DualSurf is an integrated dual-mode web browser for Linux environments (with cross-platform development support). It merges graphical browsing (Mode A) and terminal-driven browsing (Mode B) by routing all navigation, tab lifecycle, session, and page inspection operations through a centralized **Shared Browser Controller**.

```
+-------------------------------------------------------+
|                   Client Interfaces                   |
|  +-------------------------+  +--------------------+  |
|  | Graphical Chrome (GUI)  |  | CLI / TUI Client   |  |
|  | React + TypeScript      |  | TypeScript         |  |
|  +------------+------------+  +---------+----------+  |
+---------------|-------------------------|-------------+
                | Electron IPC            | Unix Domain Socket
                | (contextBridge)         | (Named Pipe on Win)
                v                         v
+-------------------------------------------------------+
|               Shared Browser Controller               |
|                                                       |
|  +------------------+  +---------------------------+  |
|  | Tab Manager      |  | Navigation Service        |  |
|  +------------------+  +---------------------------+  |
|  +------------------+  +---------------------------+  |
|  | Page Inspector   |  | Session & Profile Manager |  |
|  +------------------+  +---------------------------+  |
|  +------------------+  +---------------------------+  |
|  | Download Manager |  | Persistence Service (DB)  |  |
|  +------------------+  +---------------------------+  |
+---------------------------+---------------------------+
                            |
           +----------------+----------------+
           |                                 |
           v                                 v
+-----------------------+        +----------------------+
| Chromium Engine       |        | Storage Layer        |
| (WebContentsView)     |        | SQLite Database      |
+-----------------------+        +----------------------+
```

---

## 2. Shared Browser Controller Architecture

### 2.1 Tab Management
- Tab identity is governed by unique UUIDs (`tab-xxx`).
- Each tab corresponds to an underlying Chromium `WebContentsView` (Electron 29+ modern embedding API, replacing deprecated `BrowserView`).
- Tab state tracked:
  - `id`: Unique identifier
  - `url`: Current loaded URL
  - `title`: Current webpage title
  - `isLoading`: Boolean state indicator
  - `canGoBack` / `canGoForward`: Navigation stack status
  - `favicon`: Optional URI
  - `view`: Reference to the `WebContentsView` instance

### 2.2 Navigation Service
- URL validation and scheme sanitization (restricting by default to `http://`, `https://`, `about:blank`, `dualsurf://`).
- Smart search engine dispatch (distinguishing valid URLs / domains from raw search queries).
- Load timeout management and user-friendly error pages (`dualsurf://error`).

### 2.3 Page Content Inspector
- Provides deterministic, read-only extraction of webpage state:
  - Structured text (headings H1-H6, paragraphs, lists).
  - Numbered, actionable links snapshot (`[1]`, `[2]`, ...).
  - Forms and basic input descriptors.
- Sanitizes and enforces safety: Remote webpage JavaScript cannot invoke arbitrary commands or breach isolation boundaries.

---

## 3. IPC Protocol Design

Communication between the CLI/TUI and the Controller occurs over:
- Linux/macOS: Unix Domain Socket (default: `/tmp/dualsurf-$UID.sock` or `$XDG_RUNTIME_DIR/dualsurf.sock`)
- Windows (dev): Named Pipe (e.g., `\\.\pipe\dualsurf-$USERNAME`)

### 3.1 Request Frame Format
```json
{
  "protocolVersion": 1,
  "requestId": "req-1712750000000-001",
  "command": "tabs.list",
  "params": {}
}
```

### 3.2 Response Frame Format
```json
{
  "protocolVersion": 1,
  "requestId": "req-1712750000000-001",
  "success": true,
  "data": {
    "activeTabId": "tab-001",
    "tabs": [
      {
        "id": "tab-001",
        "title": "DualSurf Documentation",
        "url": "https://docs.dualsurf.local",
        "isLoading": false
      }
    ]
  },
  "error": null
}
```

---

## 4. Security Model & Mitigations

| Threat | Required Mitigation |
| :--- | :--- |
| **Malicious Webpage Execution** | Electron Context Isolation enabled (`contextIsolation: true`), `nodeIntegration: false`, webview tag disabled. |
| **Command Injection via Page/URL** | URL parsing uses strict WHATWG URL specification. Command arguments are typed and validated through JSON schema. No raw shell execution. |
| **Socket Hijacking / IPC Abuse** | Unix socket restricted to current user (`chmod 0600`). Protocol validation rejects unauthenticated or malformed payloads. |
| **Insecure Downloads** | Downloads tracked explicitly; executable extensions trigger mandatory GUI/CLI safety prompts; auto-execution disabled. |
| **Profile & Cookie Leakage** | Explicit Chromium session partitions. Command history omits passwords and query parameters flagged sensitive. |

---

## 5. Agentic & Semantic CLI Subsystem (Mode B Intelligence)

To move beyond rigid rule-based command dispatching, DualSurf Mode B incorporates an intent-driven semantic and agentic layer powered by local Ollama models (`llama3.2:1b`, `qwen2.5`):

```
+-------------------------------------------------------------+
|                      DualSurf CLI Mode                      |
|                                                             |
|   User Input: "click the pricing link and summarize plans"  |
+------------------------------+------------------------------+
                               |
                               v
                     Intent Classifier / Router
                     ├── Exact Match? (e.g. "q", "exit", "--json") -> Fast IPC Path
                     └── Natural Language / Fuzzy? ───────────────┐
                                                                  v
+-----------------------------------------------------------------+
|                    DualSurf Agent (Local Ollama)                |
|               (ReAct Loop: Thought -> Action -> Obs)            |
+------------------------------+----------------------------------+
                               | Tool Calls
                               v
+-----------------------------------------------------------------+
|                        Browser Toolset                          |
|  • navigate(url)         • click_link_by_text(text)             |
|  • click_link(id)        • get_page_content()                   |
|  • switch_tab(target)    • list_tabs()                          |
+------------------------------+----------------------------------+
                               | IPC frames
                               v
+-----------------------------------------------------------------+
|          Shared Browser Controller (Unix Socket / Pipe)         |
+-----------------------------------------------------------------+
```

### 5.1 Subsystem Components
1. **Semantic & Fuzzy Resolver (`apps/cli/src/semantic`)**:
   - Dispatches link clicks (`click <text>`) and tab switching (`tab <name>`) using fuzzy and phrase-level ranking without requiring link numbers or indices.
2. **Ollama Integration (`apps/cli/src/ollama`)**:
   - Native HTTP client connecting to local Ollama daemon (`http://127.0.0.1:11434`) with zero external dependencies.
   - **Context Window Management**: Configures expanded 8192-token context (`num_ctx`) to prevent page truncation.
   - **Format-Healing Tool Recovery**: Automatically parses markdown-fenced or raw JSON function blocks from small models (e.g. `llama3.2:1b`, `qwen2.5:0.5b`) when native `tool_calls` are emitted into content.
   - **Performance Telemetry**: Computes generation speed (tokens/sec) and connection latency.
   - **Structured JSON Extraction**: Dedicated extraction engine for entity tables, specs, and price lists.
   - **Cross-Tab Comparative Synthesis**: Side-by-side analysis and trade-off comparison between two open tabs.
   - **Model Management**: In-terminal model pulling (`model pull <name>`) and switching.
3. **Intent-Routed Agent Runner (`apps/cli/src/agent`)**:
   - **Fast-Path Heuristic Classifier**: Routes direct Q&A, summaries, and tab comparisons into instantaneous single-shot streaming paths (<500ms) bypassing multi-turn agent loops.
   - **Autonomous ReAct Engine**: For open-ended browsing goals, executes planned multi-step browser actions with step limits and formatted terminal output.

---

## 6. Offline Mode & Local System Tools Architecture

DualSurf provides native support for **air-gapped operations, local security labs, and Kali Linux workflows**:

```
+---------------------------------------------------------------+
|             DualSurf Offline & Tool Execution Layer           |
+-------------------------------+-------------------------------+
                                |
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 Local Navigation         Host Shell Tools        Local Ollama (AI)
 ├── file:///...          ├── ! <cmd> in REPL     ├── 100% Offline
 ├── ./relative.html      ├── dualsurf sh <cmd>   ├── http://127.0.0.1:11434
 └── Subnets (127.0.0.1,  ├── Tool Audit (audit)  └── llama3.2:1b / qwen
     10.x, 192.168.x)     └── run_terminal_command
```

### 6.1 Offline URL Resolution
- The Navigation Service checks for offline file targets (`file://`, absolute filesystem paths, and relative paths like `./doc.html`) and resolves them to local file URLs.
- Private subnets (`localhost`, `127.0.0.1`, `0.0.0.0`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`) are treated as authoritative internal hosts, preventing inadvertent attempts to query public search engines.

### 6.2 Host Tool Execution (`shellExecutor.ts`)
- Standard Unix shell escape conventions (`!<cmd>` in REPL, `dualsurf sh <cmd>` in CLI) allow executing any tool available on the host machine (`nmap`, `curl`, `dig`, `whois`, `tcpdump`, `traceroute`, custom penetration testing scripts).
- Execution streams real-time `stdout` and `stderr` directly into the user terminal session, preserving terminal paging and color escape codes.
- `auditInstalledTools()` probes the host system PATH to report which networking, reconnaissance, and security utilities are installed.

### 6.3 Security Sandboxing Boundaries
- **Renderer Isolation**: Untrusted JavaScript executed in remote or local webpages continues to run in strictly isolated Chromium renderers (`contextIsolation: true`, `nodeIntegration: false`). Remote web pages have zero access to the host shell or `executeShellCommand`.
- **User Authorization**: Shell execution is strictly bounded to the CLI process running under the interactive user's host credentials.

### 6.4 Web Reconnaissance & Target Assessment Architecture (`recon.ts`)
- **Automated Target Reconnaissance**: Unites DOM attack surfaces (REST APIs `/api/`, auth portals `/login`, forms, downloads) with network host and port details.
- **Security Headers Analyzer**: Evaluates CSP, HSTS, X-Frame-Options, MIME-sniffing protection, referrer policies, permissions policies, and server banner information disclosure.
- **Audit Report Generator**: Exports comprehensive security assessments with endpoint inventories directly to Markdown files (`export audit.md`).
- **Session State Snapshots**: Extracts active cookies and localStorage data from the active tab.

