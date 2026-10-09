# DualSurf Security Model & Mitigation Architecture

## 1. Threat Matrix & Defense Strategy

DualSurf is designed from the ground up for power users, sysadmins, and security researchers. Exposing local commands and terminal control requires a rigorous defense-in-depth security model:

| Threat Category | Potential Attack Vector | DualSurf Defense & Mitigation |
| :--- | :--- | :--- |
| **Malicious Webpage Content** | Untrusted JS attempting to access OS APIs, filesystem, or shell | Web rendering strictly hosted inside Chromium `WebContentsView` with `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`. No Node globals exist in webpage contexts. |
| **Command Injection** | Crafted URLs or page text (e.g. `javascript:...` or shell metacharacters `; rm -rf /`) | URL schemes strictly whitelisted to `http`, `https`, `dualsurf`, `about:blank`. Free-text inputs are URL-encoded into search query strings. No raw strings are passed to shell execution. |
| **IPC Hijacking & Abuse** | Local malicious processes attempting to send commands to the browser controller | Unix domain sockets set to user-only permission (`chmod 0600`). On Windows, named pipes inherit the current user session ACL. Protocol version validation rejects unsupported or malformed frames. |
| **Data & Profile Leakage** | Leaking cookies, session tokens, or credentials into terminal logs or storage | SQLite database stores only structural metadata (`history`, `bookmarks`, `downloads`, `settings`). Live cookies and web authentication remain encapsulated in Chromium session partitions. |
| **Risky Downloads** | Websites attempting drive-by downloads or automatic execution of executables | Auto-execution of downloads is strictly prohibited. Executables trigger explicit confirmation prompts, and all downloads are recorded in the SQLite downloads ledger. |

---

## 2. Remote Web Content Isolation

In DualSurf, remote web pages are isolated using the modern Chromium multi-process architecture:

```
[ Electron Main Process ]  <--- Shared Controller Authority
        |
        | IPC (contextBridge, restricted API)
        v
[ Desktop GUI Chrome ]     <--- Isolated React Renderer (Node integration disabled)

[ Electron Main Process ]
        |
        | WebContentsView (Sandboxed Content Process)
        v
[ Untrusted Remote Webpage ] <-- Chromium Sandbox, zero OS access
```

Untrusted web code cannot:
1. Access the local filesystem or execute child processes.
2. Communicate directly with the Unix domain socket.
3. Access or tamper with DualSurf's SQLite database.
4. Forge controller commands.

---

## 3. Safe Page Inspection Policy

DualSurf's `PageInspector` extracts structured headings, numbered link snapshots, and readable text using deterministic DOM queries:
- Scripts executed for inspection do not accept untrusted caller parameters into the evaluated string.
- Extracted text snippets are length-bounded (capped at 8,000 characters per snapshot) to prevent memory denial-of-service attacks from pages containing abnormally huge DOM trees.
- Actionable numbered links snapshot verifies that `href` does not begin with `javascript:`.
