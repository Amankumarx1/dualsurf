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
