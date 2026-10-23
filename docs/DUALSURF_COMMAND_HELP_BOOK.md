# DUALSURF — THE DEFINITIVE LINUX COMMAND HELP BOOK & OPERATOR MANUAL

**Document Reference:** `DUALSURF-HELPBOOK-2026-FINAL`  
**Classification:** Official Product Documentation & CLI Reference Manual  
**Target Environment:** Linux (Ubuntu / Debian / Kali / Arch / WSL 2) & Cross-Platform  
**Version:** `v0.1.0-rc1`  
**Author:** Principal Software Architect & Linux Systems Engineer  
**Status:** **AUTHORITATIVE & VERIFIED IN REAL LINUX RUNTIMES**  

---

## Table of Contents

1. [Dual-Mode Architecture & Linux Execution](#1-dual-mode-architecture--linux-execution)
2. [Interactive Terminal & REPL Mode](#2-interactive-terminal--repl-mode)
3. [Browser & Web Navigation Commands](#3-browser--web-navigation-commands)
4. [AI Security Copilot & Autonomous Agent](#4-ai-security-copilot--autonomous-agent)
5. [Web Security, Reconnaissance & Vulnerability Audit](#5-web-security-reconnaissance--vulnerability-audit)
6. [HTTP Interception Proxy & Raw Packet Repeater](#6-http-interception-proxy--raw-packet-repeater)
7. [External Attack Surface & Passive DNS Reconnaissance](#7-external-attack-surface--passive-dns-reconnaissance)
8. [Blue Team Defensive Security (SOC / SIEM / DFIR / SOAR)](#8-blue-team-defensive-security-soc--siem--dfir--soar)
9. [Red Team Offensive Operations & Enterprise Interoperability](#9-red-team-offensive-operations--enterprise-interoperability)
10. [Host Tools, Kali Linux Utilities & System Shell](#10-host-tools-kali-linux-utilities--system-shell)
11. [Command Quick Reference Cheat Sheet](#11-command-quick-reference-cheat-sheet)
12. [Conclusion](#12-conclusion)

---

## 1. Dual-Mode Architecture & Linux Execution

DualSurf operates under a unified **Dual-Mode Architecture**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DUALSURF LINUX RUNTIME MODEL                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [ CLI / REPL / SHELL MODE ]                  [ GUI DESKTOP MODE ]         │
│   • Runs headless or inside xterm / PTY        • Electron Desktop Window    │
│   • Zero desktop dependency for CLI tools      • React 18 Cyber Black UI    │
│   • Sub-millisecond execution engine           • Sandboxed WebContentsViews │
│                                                                             │
│                            │ (Unix Domain Socket / IPC)                     │
│                            ▼                                                │
│                                                                             │
│   [ BROWSER CONTROLLER & SECURITY ENGINES ]                                 │
│   • Rules of Engagement (RoE) Scope Guard                                   │
│   • SQLite Metadata Engine (History, Bookmarks, Downloads)                  │
│   • Forensic Cryptographic Evidence Store (SHA-256 / SHA-1 / MD5)           │
│   • Linux Host Binary Integrations (/usr/bin, /usr/sbin)                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Invoking DualSurf in Linux
Depending on your installation, DualSurf can be executed via:
```bash
# Direct CLI binary (if linked globally or in PATH)
dualsurf <command> [options]

# Directly via Node.js in the monorepo
node apps/cli/dist/index.js <command> [options]

# Under WSL 2 from Windows
wsl -d Ubuntu node "/mnt/c/D Drive/Aman/DualSurf/apps/cli/dist/index.js" <command> [options]
```

### 1.2 Output Modes
- **Human-Readable:** Colored, formatted ANSI cards, tables, and trees (default).
- **Machine-Readable JSON:** Append `--json` to any command for integration into CI/CD pipelines, SIEM ingestors, or Python automation scripts.

---

## 2. Interactive Terminal & REPL Mode

### `dualsurf --terminal` / `dualsurf attach`
* **Purpose:** Launch an interactive, persistent terminal session connecting directly to the DualSurf browser controller and security engines.
* **Syntax:** `dualsurf --terminal` or `dualsurf attach`
* **Features:**
  - Tab auto-completion for commands and active browser URLs.
  - Prefix with `!` to execute local Linux shell commands directly without leaving the REPL (e.g. `! uname -a`, `! nmap -sV 10.0.0.1`).
  - Native command history (Up/Down arrow keys).
* **Linux Execution Example:**
  ```text
  dualsurf> page
  dualsurf> click 2
  dualsurf> ! whoami
  aman
  dualsurf> exit
  ```

---

## 3. Browser & Web Navigation Commands

These commands allow direct programmatic control over the Chromium browser engine from the Linux terminal.

### `tabs`
* **Purpose:** List all currently open tabs with their indices, unique IDs, URLs, and page titles.
* **Syntax:** `dualsurf tabs [--json]`
* **Linux Example:**
  ```text
  $ dualsurf tabs
  ACTIVE TABS (2):
    [0] * Google - https://www.google.com (tab-1792345000001)
    [1]   GitHub - https://github.com (tab-1792345000002)
  ```

### `tab new [url]`
* **Purpose:** Spawn a new browser tab navigating to the specified URL (or configured default homepage).
* **Syntax:** `dualsurf tab new <url>`
* **Linux Example:**
  ```bash
  dualsurf tab new https://news.ycombinator.com
  # Output: Created new tab: tab-1792345012345 (https://news.ycombinator.com)
  ```

### `tab <number | "keyword">`
* **Purpose:** Switch active focus to a tab by its zero-based index or by matching keywords in its title/URL.
* **Syntax:** `dualsurf tab <index>` or `dualsurf tab <keyword>`
* **Linux Example:**
  ```bash
  dualsurf tab 1
  # Output: Switched to tab [1].

  dualsurf tab "github"
  # Output: Switched to tab [1]: "GitHub"
  ```

### `tab close [number]`
* **Purpose:** Close the target browser tab (or the active tab if omitted).
* **Syntax:** `dualsurf tab close [index]`
* **Linux Example:**
  ```bash
  dualsurf tab close 1
  # Output: Closed tab.
  ```

### `open <url>`
* **Purpose:** Navigate the currently active tab to the specified URL or local file path.
* **Syntax:** `dualsurf open <url>`
* **Linux Example:**
  ```bash
  dualsurf open https://scanme.nmap.org
  dualsurf open file:///var/log/syslog
  ```

### `search <query>`
* **Purpose:** Submit a search query using the configured search provider (DuckDuckGo, Google, Brave, StartPage).
* **Syntax:** `dualsurf search <search terms>`
* **Linux Example:**
  ```bash
  dualsurf search "MITRE ATT&CK credential dumping techniques"
  ```

### `click <number | "label">`
* **Purpose:** Programmatically follow an actionable hyperlink on the current page by its numbered link ID or by semantic text label.
* **Syntax:** `dualsurf click <id>` or `dualsurf click "<label>"`
* **Linux Example:**
  ```bash
  dualsurf click 14
  dualsurf click "Documentation"
  ```

### `page`
* **Purpose:** Display comprehensive metadata for the active webpage (title, URL, HTTP status, SSL cipher, DOM stats, headers).
* **Syntax:** `dualsurf page [--json]`

### `text`
* **Purpose:** Extract and print structured, clean, readable text content from the current page without raw HTML clutter.
* **Syntax:** `dualsurf text`

### `links`
* **Purpose:** Extract and print all actionable links on the current page, indexed by number with endpoint classification badges (`[API]`, `[AUTH]`, `[DOWNLOAD]`, `[FORM]`).
* **Syntax:** `dualsurf links`

### `endpoints [filter]`
* **Purpose:** List detected endpoints on the current page, filterable by category (`api`, `auth`, `download`, `form`).
* **Syntax:** `dualsurf endpoints [api|auth|download|form]`
* **Linux Example:**
  ```bash
  dualsurf endpoints auth
  # Returns all discovered login, token, OAuth, and SAML URLs on the page
  ```

### `headings`
* **Purpose:** Print the hierarchical heading tree (`H1`, `H2`, `H3`, `H4`) of the current document.
* **Syntax:** `dualsurf headings`

### `find <keyword>`
* **Purpose:** Search for occurrences of text or regular expressions within the active webpage.
* **Syntax:** `dualsurf find <keyword>`

### `back` / `forward`
* **Purpose:** Navigate back or forward in the active tab's browsing history.
* **Syntax:** `dualsurf back` or `dualsurf forward`

### `reload` / `stop`
* **Purpose:** Reload the active page or stop ongoing network transfer.
* **Syntax:** `dualsurf reload` or `dualsurf stop`

### `bookmarks` / `bookmark add` / `bookmark rm`
* **Purpose:** Manage saved bookmarks stored in DualSurf's SQLite database.
* **Syntax:**
  - `dualsurf bookmarks` (List all bookmarks)
  - `dualsurf bookmark add [url] [title]` (Save current or specified URL)
  - `dualsurf bookmark rm <id>` (Delete bookmark by ID)

### `history [--search <query>]`
* **Purpose:** Query persistent browsing history records from the SQLite database.
* **Syntax:** `dualsurf history` or `dualsurf history --search "github"`

### `downloads`
* **Purpose:** Display recent file download activities, progress states, and filesystem destinations.
* **Syntax:** `dualsurf downloads`

### `gui`
* **Purpose:** Signal the background browser engine to bring the desktop graphical window to the foreground.
* **Syntax:** `dualsurf gui`

### `clear-data`
* **Purpose:** Purge browsing history, cookies, session storage, and cached network artifacts from disk.
* **Syntax:** `dualsurf clear-data`

### `shutdown` / `kill`
* **Purpose:** Safely stop the background browser engine and release locked port listeners.
* **Syntax:** `dualsurf shutdown`

---

## 4. AI Security Copilot & Autonomous Agent

DualSurf includes deep integration with local LLMs (Ollama) running fully offline on your Linux host.

### `dualsurf "<goal>"` / `dualsurf do <goal>`
* **Purpose:** Execute a multi-step autonomous browsing goal using local AI intelligence.
* **Syntax:** `dualsurf "<goal description>"`
* **Linux Example:**
  ```bash
  dualsurf "open github.com and find trending security repositories"
  ```

### `dualsurf ask <question>`
* **Purpose:** Ask the AI Copilot analytical questions about the content, DOM, or security posture of the active page.
* **Syntax:** `dualsurf ask "<question>"`
* **Linux Example:**
  ```bash
  dualsurf ask "Does this webpage request any sensitive permissions or contain suspicious forms?"
  ```

### `dualsurf summarize`
* **Purpose:** Generate a structured, concise executive summary of the active webpage.
* **Syntax:** `dualsurf summarize`

### `dualsurf compare`
* **Purpose:** Analytically compare the content, headers, or security differences between two open browser tabs.
* **Syntax:** `dualsurf compare`

### `dualsurf extract`
* **Purpose:** Extract structured entities (emails, usernames, IP addresses, URLs, API keys) from the active webpage into JSON.
* **Syntax:** `dualsurf extract [--json]`

---

## 5. Web Security, Reconnaissance & Vulnerability Audit

DualSurf includes native, high-performance security auditing engines designed for instant CLI triage.

### `dualsurf cert <host/url>`
* **Purpose:** Inspect TLS/SSL certificates, negotiation protocols, cipher suites, expiration dates, and Subject Alternative Name (SAN) subdomains.
* **Syntax:** `dualsurf cert <domain | url>`
* **Linux Execution Output:**
  ```text
  $ dualsurf cert google.com

  TLS / SSL CERTIFICATE INSPECTION: google.com:443
  ─────────────────────────────────────────────────────────────
    Common Name (CN): *.google.com
    Issuer:           WE2 (Google Trust Services)
    Valid Period:     Sep 28 18:38:33 2026 GMT to Dec 21 18:38:32 2026 GMT
    Status:           64 days remaining
    Negotiated Protocol: TLSv1.3 (TLS_AES_256_GCM_SHA384)
    Authorized CA:   ✓ Trusted

    Subject Alternative Names (65 SANs):
      • *.google.com
      • *.appengine.google.com
      • *.cloud.google.com
      ... and 50 more subdomains
  ```

### `dualsurf headers <url>`
* **Purpose:** Evaluate HTTP response security headers against modern AppSec standards, assigning a security percentage and letter grade.
* **Syntax:** `dualsurf headers <url>`
* **Linux Execution Output:**
  ```text
  $ dualsurf headers https://google.com

  SECURITY HEADERS AUDIT: https://google.com
  Status: 200 | Score: 17% (Grade: F)
  ───────────────────────────────────────────────────────────────────
    [✗ MISS] Content-Security-Policy    : Restricts sources for scripts, styles, etc.
    [✗ MISS] Strict-Transport-Security  : Enforces HTTPS communication.
    [✓ PASS] X-Frame-Options            : Prevents page embedding in iframes.
        Value: SAMEORIGIN
    [✗ MISS] X-Content-Type-Options     : Blocks browsers from MIME-type sniffing.
    [! WARN] Server Information Disclosure : Exposes underlying web server.
        Value: gws
  ```

### `dualsurf cors <url>`
* **Purpose:** Audit Cross-Origin Resource Sharing (CORS) configurations, detecting wildcard `*` origins, credential reflection, and unauthorized origin trust.
* **Syntax:** `dualsurf cors <url>`
* **Linux Execution Output:**
  ```text
  $ dualsurf cors https://google.com

  CORS POLICY & CONFIGURATION AUDIT: https://google.com
  ─────────────────────────────────────────────────────────────
    Risk Level:        CLEAN
    Verdict:           No permissive CORS policy detected.
    Allow-Origin:      (None)
    Credentials:       false
  ```

### `dualsurf tech <url>`
* **Purpose:** Fingerprint web servers, runtime frameworks, CMS platforms, and CDN/WAF infrastructure using passive response signals.
* **Syntax:** `dualsurf tech <url>`

### `dualsurf ports [target] [--profile <web|common|db|all>]`
* **Purpose:** Automated perimeter port audit and service listener discovery with integrated Rules of Engagement (RoE) scope verification.
* **Syntax:** `dualsurf ports <target-ip-or-host> [--profile <web|common|db|all>]`
* **Linux Execution Output:**
  ```text
  $ dualsurf ports 127.0.0.1 --profile common

  Initiating network port audit for: 127.0.0.1 (Profile: common)...

  ╔════════════════════════════════════════════════════════════════════╗
  ║         AUTOMATED PORT AUDIT & SERVICE PERIMETER SCANNER           ║
  ╚════════════════════════════════════════════════════════════════════╝
    Target Host:    127.0.0.1 (127.0.0.1)
    Exposure Risk:  LOW RISK PERIMETER
    Scan Coverage:  0 open ports discovered out of 20 probed in 15ms
  ──────────────────────────────────────────────────────────────────────
    RoE Scope:      ✔ Authorized In-Scope Target
    ✔ All scanned ports are closed or filtered.
  ```

### `dualsurf assess <url> [report-file]`
* **Purpose:** Launch a complete single-command end-to-end security assessment: attack surface enumeration, header analysis, DOM hygiene, secret scanning, CVSS scoring, and HTML/Markdown report export.
* **Syntax:** `dualsurf assess <url> [output-path] [--html] [--json]`

### `dualsurf scan <url>`
* **Purpose:** Automated security audit pipeline with CVSS risk calculation and remediation advice.
* **Syntax:** `dualsurf scan <url>`

### `dualsurf secrets`
* **Purpose:** Scan active DOM text, cookies, and local/session storage for leaked AWS access keys, JWT tokens, private key headers, and internal RFC1918 addresses.
* **Syntax:** `dualsurf secrets`

---

## 6. HTTP Interception Proxy & Raw Packet Repeater

DualSurf includes a native loopback interception proxy engine (`127.0.0.1:8899`) and a raw HTTP/S packet repeater, providing Burp Suite / OWASP ZAP style traffic inspection and tampering directly in Linux CLI and GUI environments.

### `dualsurf proxy [status | start | stop | intercept | rules | queue | forward | drop]`
* **Purpose:** Inspect and manipulate in-flight HTTP/S traffic, inject custom security headers, strip browser security policies (CSP, X-Frame-Options), and hold requests at active breakpoints.
* **Syntax:**
  - `dualsurf proxy status`: Display proxy engine status, port, handled traffic, and active breakpoint state.
  - `dualsurf proxy start [port]`: Start local loopback interception proxy server (default: `8899`).
  - `dualsurf proxy stop`: Gracefully terminate the proxy server.
  - `dualsurf proxy intercept <on|off>`: Toggle in-flight request breakpoint holding.
  - `dualsurf proxy rules`: List active request modification and header injection rules.
  - `dualsurf proxy queue`: Inspect requests currently paused in the breakpoint queue.
  - `dualsurf proxy forward <id>`: Release and forward a held request to the target destination.
  - `dualsurf proxy drop <id>`: Drop and abort a held request.
* **Linux Execution Output:**
  ```text
  $ dualsurf proxy status

  ╔════════════════════════════════════════════════════════════════════╗
  ║       DUALSURF HTTP INTERCEPTION PROXY & TRAFFIC ENGINE            ║
  ╚════════════════════════════════════════════════════════════════════╝
    Proxy Server:      STOPPED (Configured: 127.0.0.1:8899)
    Breakpoint Mode:   INACTIVE (Traffic forwarding automatically)
    Total Handled:     0 requests
    Total Intercepted: 0 held requests

    Commands: "proxy start [port]", "proxy stop", "proxy intercept <on|off>", "proxy rules", "proxy queue"
  ```

### `dualsurf repeater send <url> [options]`
* **Purpose:** Craft, replay, and inspect raw HTTP/S requests with sub-millisecond round-trip latency calculation, full response header inspection, body preview, and reproducible cURL generation.
* **Syntax:** `dualsurf repeater send <url> [--method GET|POST|PUT|DELETE] [--header "Key: Value"] [--body "payload"]`
* **Linux Execution Output:**
  ```text
  $ dualsurf repeater send http://scanme.nmap.org --method GET

  ╔════════════════════════════════════════════════════════════════════╗
  ║                 DUALSURF RAW HTTP REPEATER RESPONSE                ║
  ╚════════════════════════════════════════════════════════════════════╝
    Target URL:    http://scanme.nmap.org
    Method:        GET
    Status:        200 OK (Latency: 1122ms)
    Body Size:     162 bytes

    Response Headers:
      date: Sun, 18 Oct 2026 18:35:10 GMT
      server: Apache/2.4.7 (Ubuntu)
      content-type: text/html

    Response Body Preview:
      <!DOCTYPE html><html><head><title>Go ahead and ScanMe!</title></head>...

    Reproducible cURL Command:
    curl -i -s -k -X GET "http://scanme.nmap.org"
  ```

---

## 7. External Attack Surface & Passive DNS Reconnaissance

DualSurf enables security practitioners to map attack surfaces, correlate certificate transparency logs, and audit email spoofing defenses without sending invasive packets to target servers.

### `dualsurf attack-surface <domain>` / `dualsurf asm <domain>`
* **Purpose:** Passive external asset inventory, Certificate Transparency (crt.sh) log harvesting, cloud storage bucket exposure checks (AWS S3, GCP, Azure Blob), dangling CNAME takeover detection, and sensitive administrative interface discovery.
* **Syntax:** `dualsurf attack-surface <domain/url> [--json]`
* **Linux Execution Output:**
  ```text
  $ dualsurf attack-surface github.com

  Initiating passive external attack surface discovery for: github.com...

    EXTERNAL ATTACK SURFACE & ASSET INVENTORY:
    ASSET HOSTNAME               TYPE         ENVIRONMENT    DISCOVERY
    ──────────────────────────   ──────────   ────────────   ────────────
    github.com                   domain       production     [dns]
    www.github.com               subdomain    production     [san]

    EMAIL & DOMAIN AUTHENTICATION POSTURE:
    • SPF Record:   ✔ Configured (v=spf1 ip4:192.30.252.0/22 include:spf.protection....)
    • DMARC Policy: QUARANTINE (v=DMARC1; p=quarantine; sp=reject; pct=100; r...)

    CLOUD STORAGE BUCKET EXPOSURE AUDIT:
    • [GCP] github -> PROTECTED (Private) (https://storage.googleapis.com/github)
    • [GCP] github-static -> PROTECTED (Private) (https://storage.googleapis.com/github-static)
    • [GCP] github-public -> PROTECTED (Private) (https://storage.googleapis.com/github-public)

    ADMINISTRATIVE & SENSITIVE INTERFACES PROBED:
    • /swagger-ui.html   -> HTTP 200 (Administrative/API documentation interface directly accessible.)
  ```

### `dualsurf dns <domain>`
* **Purpose:** Non-destructive passive DNS record enumeration (A, AAAA, MX, TXT) and domain authentication review (SPF, DMARC RFC 7489 policy enforcement).
* **Syntax:** `dualsurf dns <domain/host> [--json]`
* **Linux Execution Output:**
  ```text
  $ dualsurf dns github.com

  ╔════════════════════════════════════════════════════════════════════╗
  ║       DUALSURF DNS & EMAIL AUTHENTICATION SECURITY AUDIT           ║
  ╚════════════════════════════════════════════════════════════════════╝
    Target Host:    github.com
    IP Addresses:   20.207.73.82

    DNS Records Discovered (35):
      • [A    ] 20.207.73.82
      • [AAAA ] 64:ff9b::14cf:4952
      • [MX   ] github-com.mail.protection.outlook.com (Priority: 0)
      • [TXT  ] v=spf1 ip4:192.30.252.0/22 include:spf.protection.outlook.com ... ~all

    Email & Domain Security Posture:
      • SPF Record:   ✔ CONFIGURED (v=spf1 ...)
      • DMARC Policy: QUARANTINE (v=DMARC1; p=quarantine; sp=reject; pct=100; ...)

    ✔ Domain authentication posture complies with email spoofing defenses.
  ```

### `dualsurf port-scan <target>` / `ports`
* **Purpose:** High-speed network perimeter port audit with customizable port profiles (`web`, `common`, `db`, `all`) and custom port lists.
* **Syntax:** `dualsurf port-scan <target> [--profile <web|common|db|all>] [--ports 80,443,8080]`

---

## 8. Blue Team Defensive Security (SOC / SIEM / DFIR / SOAR)

DualSurf provides an enterprise-grade defensive security workstation in your Linux terminal.

### `dualsurf blue`
* **Purpose:** Display the 13 Core Pillars of Blue Team Operations, active defensive capabilities, and mapped commands.
* **Syntax:** `dualsurf blue`
* **Subcommands:**
  - `dualsurf blue pillar <1-13>`: Detailed methodology, tools, and investigation steps.
  - `dualsurf blue roadmap`: 16-week structured defensive learning syllabus.
  - `dualsurf blue checklist`: Interactive SOC operational readiness checklist.
  - `dualsurf blue roles`: Guidance for SOC Analysts, Incident Responders, Threat Hunters, and Detection Engineers.
  - `dualsurf blue metrics`: 12 SOC operational formulas (MTTD, MTTR, Dwell Time, False Positive Rate).

### `dualsurf siem <logfile | "log text">`
* **Purpose:** Ingest and parse security event logs (auth, syslog, web access, Windows EVTX, Suricata/Zeek EVE JSON), correlating attack patterns and mapping them to MITRE ATT&CK tactics.
* **Syntax:** `dualsurf siem <file-path | "log text string">`
* **Linux Execution Output:**
  ```text
  $ dualsurf siem "Failed password for root from 192.168.1.10 port 22 ssh2"

  ╔════════════════════════════════════════════════════════════════════╗
  ║               DUALSURF SOC & SIEM LOG ANALYSIS REPORT              ║
  ╚════════════════════════════════════════════════════════════════════╝
    Analyzed Events:   1 lines
    Threat Rating:     MEDIUM
    Security Alerts:   0 Critical, 0 High, 1 Medium
  ──────────────────────────────────────────────────────────────────────
    Top Attacking Source IPs:
      • 192.168.1.10 (1 alerts)
    Targeted User Accounts:
      • root (1 events)
    Mapped MITRE ATT&CK Tactics:
      • T1110 - Brute Force

    Sample Triggered SOC Detections:
      [MEDIUM] Failed Authentication Attempt / Brute Force (T1110)
        Evidence: Failed password for root from 192.168.1.10 port 22 ssh2
  ```

### `dualsurf ioc <text | url>`
* **Purpose:** Extract, defang, classify, and enrich Indicators of Compromise (IPv4/IPv6, domains, URLs, hashes) from unstructured text, adding MITRE ATT&CK technique tags.
* **Syntax:** `dualsurf ioc "<unstructured alert text>"`
* **Linux Execution Output:**
  ```text
  $ dualsurf ioc "Alert: connection to 198.51.100.24 and download from http://evil-c2.corp/payload.exe"

  EXTRACTED INDICATORS OF COMPROMISE (IOCs): (2 found)
  ──────────────────────────────────────────────────────────────────
    [URL]    hxxp[://]evil-c2[.]corp/payload[.]exe
           Raw: http://evil-c2.corp/payload.exe | Scope: External | Tags: T1071.001
    [IP]     198[.]51[.]100[.]24
           Raw: 198.51.100.24 | Scope: External | Tags: T1071
  ```

### `dualsurf hash <file>`
* **Purpose:** Compute cryptographic SHA-256, SHA-1, and MD5 hashes for digital forensic evidence preservation and chain-of-custody documentation.
* **Syntax:** `dualsurf hash <file-path>`
* **Linux Execution Output:**
  ```text
  $ dualsurf hash package.json

  DIGITAL FORENSIC EVIDENCE PRESERVATION: package.json
  ──────────────────────────────────────────────────────────────────────
    Target File:    package.json
    Size:           1217 bytes
    Acquisition:    2026-10-18T18:06:06.018Z by DualSurf Analyst
    SHA-256:        0a0c0f9c4c06c56fa3565cbe95a7309fa3f6e242f32ea92cac8403778d263411
    SHA-1:          b2f13e2ca1c5d9059f93ba3952445372e54589cd
    MD5:            5e2c5ee4628a26df285005f95726b26e
  ```

### `dualsurf case [list | new | view | close | link]`
* **Purpose:** Manage incident response tickets, escalate priorities, assign analysts, generate automated containment playbooks, and link cryptographic evidence.
* **Syntax:**
  - `dualsurf case list`: List active incident tickets.
  - `dualsurf case new "<title>"`: Create a new incident ticket.
  - `dualsurf case view <id>`: Inspect ticket details, containment steps, and investigator timeline.
  - `dualsurf case close <id>`: Mark ticket as Closed.
  - `dualsurf case link <case-id> <evidence-id>`: Link raw evidence record to the ticket.
* **Linux Execution Output:**
  ```text
  $ dualsurf case new "Suspicious lateral movement detected"

  INCIDENT RESPONSE CASE: INC-2026-0002 - Suspicious lateral movement detected
  ──────────────────────────────────────────────────────────────────────
    Severity:       P2-HIGH | Status: New
    Category:       Web / Endpoint Incident | Assigned: SOC Analyst Tier 1
    Hosts:          host-workstation

    Containment Playbook Action Items:
      1. Isolate endpoint(s) from network: host-workstation
      2. Revoke active sessions and invalidate Kerberos/SSO tokens
      3. Preserve volatile memory and disk artifacts before reboot
      4. Rotate service-account credentials and SSH keys
  ```

### `dualsurf soar <target>`
* **Purpose:** Execute automated triage, threat enrichment, and recommended containment actions for target IPs, domains, or compromised accounts.
* **Syntax:** `dualsurf soar <target-ip-or-domain>`

### `dualsurf mitre "<behavior>"`
* **Purpose:** Search and correlate adversary activity descriptions against the MITRE ATT&CK enterprise matrix.
* **Syntax:** `dualsurf mitre "<activity description>"`
* **Linux Execution Output:**
  ```text
  $ dualsurf mitre "lsass credential dumping"

  CORRELATED MITRE ATT&CK TECHNIQUES (1):
    • T1003: OS Credential Dumping (Credential Access)
      Adversary attempts to extract plaintext credentials or hashes from OS memory.
  ```

### `dualsurf dmarc <domain>` / `spf`
* **Purpose:** Query live DNS records to verify mail transfer authentication (SPF and DMARC enforcement policies), logging cryptographic SHA-256 evidence.
* **Syntax:** `dualsurf dmarc <domain>`
* **Linux Execution Output:**
  ```text
  $ dualsurf dmarc google.com

  [DualSurf Email Defense Engine: Live DNS Mail Authentication Audit]
  Target Domain: google.com
  ──────────────────────────────────────────────────────────────────────
  [+] DMARC Record (_dmarc.google.com):
      v=DMARC1; p=reject; rua=mailto:mailauth-reports@google.com
  [+] SPF Record (google.com):
      v=spf1 include:_spf.google.com ~all
  [+] Verification Status:
      DMARC Configured: PASS
      SPF Configured:   PASS
  [Evidence Stored: EVD-1792346787012 (SHA-256: 2cb9f79b15...)]
  ```

---

## 9. Red Team Offensive Operations & Enterprise Interoperability

DualSurf equips offensive security operators and red teams with rigorous scope governance (RoE), structured vulnerability lifecycle management, and seamless bidirectional export to industry-standard toolsets including PortSwigger Burp Suite Enterprise / Professional and OWASP ZAP.

### `dualsurf red`
* **Purpose:** Display the 7 Core Pillars of Red Team Operations, authorized tools, and operational scopes.
* **Syntax:** `dualsurf red`
* **Subcommands:**
  - `dualsurf red domain <1-32>`: Detailed curriculum for all 32 red team domains.
  - `dualsurf red spec <role>`: Specializations (web, network, ad, cloud, exploit).
  - `dualsurf red study`: 6-Month Accelerated Red Team study plan.
  - `dualsurf red checklist`: 25-task Red Team skills master checklist.

### `dualsurf roe [list | check <target>]`
* **Purpose:** Manage Rules of Engagement (RoE) testing scopes, verifying that assessment actions remain strictly within approved CIDR subnets and domain boundaries.
* **Syntax:**
  - `dualsurf roe list`: Display active RoE authorization scopes.
  - `dualsurf roe check <url/target>`: Validate whether a target is in-scope or out-of-scope.
* **Linux Execution Output:**
  ```text
  $ dualsurf roe check https://scanme.nmap.org
  ✔ AUTHORIZED IN-SCOPE: Target "https://scanme.nmap.org" is authorized under domain boundary "scanme.nmap.org" (ROE-2026-001 - Lab Testing Environment).

  $ dualsurf roe check https://unauthorized-bank.com
  ✖ UNAUTHORIZED / OUT OF SCOPE: Target "https://unauthorized-bank.com" is NOT listed in authorized domains or IP ranges for ROE-2026-001.
  ```

### `dualsurf finding [list | view | poc | new | status | export]`
* **Purpose:** Manage penetration testing findings with CVSS v3.1 scores, non-destructive reproduction steps, verifiable cURL proof-of-concept commands, and export to enterprise vulnerability management systems.
* **Syntax:**
  - `dualsurf finding list`: List all findings with severity ratings.
  - `dualsurf finding view <id>`: Detailed finding report with remediation advice.
  - `dualsurf finding poc <id>`: Display reproducible cURL PoC.
  - `dualsurf finding new "<title>"`: Record a new vulnerability finding.
  - `dualsurf finding status <id> <status>`: Update lifecycle status (`Open`, `Retested`, `Remediated`).
  - `dualsurf finding export [burp|zap|json|md] [--out <file>]`: Export findings into standard formats.
* **Enterprise Interoperability Formats:**
  - **PortSwigger Burp Suite XML (`burp` / `xml`):** Generates DTD-compliant XML conforming to PortSwigger's issue definition (`https://portswigger.net/burp/dtd/issues.dtd`), complete with issue types, severity mapping, host, path, remediation background, and request/response base64 evidence blocks.
  - **OWASP ZAP JSON (`zap`):** Generates structured alert dictionaries formatted for OWASP ZAP and DefectDojo vulnerability tracking ingestion (`@version 2.12.0`, `site`, `alerts` with `pluginid`, `riskcode`, and `cweid`).
  - **Executive Markdown (`md`):** Complete executive report with risk summary tables and immediate remediation plans.
* **Linux Execution Examples:**
  ```bash
  # Export findings to PortSwigger Burp Suite XML for direct import into Burp Enterprise
  dualsurf finding export burp --out /tmp/burp-issues.xml
  # Output: ✔ Exported 3 findings to (BURP): /tmp/burp-issues.xml

  # Export findings to OWASP ZAP JSON for DefectDojo / CI pipeline ingestion
  dualsurf finding export zap --out /tmp/zap-alerts.json
  # Output: ✔ Exported 3 findings to (ZAP): /tmp/zap-alerts.json

  # Output markdown report to stdout
  dualsurf finding export md
  ```

### `dualsurf purple [matrix | view | status | score]`
* **Purpose:** Collaborative Purple Team adversary emulation matrix, comparing offensive emulation execution against defensive detection coverage.
* **Syntax:**
  - `dualsurf purple matrix`: Display ATT&CK techniques, execution statuses, and detection ratings.
  - `dualsurf purple view <id>`: Inspect single test case telemetry and remediation.
  - `dualsurf purple score`: Calculate overall detection coverage percentage and blind spots.

---

## 10. Host Tools, Kali Linux Utilities & System Shell

DualSurf allows security operators to run host and Kali Linux utilities seamlessly.

### `dualsurf tools`
* **Purpose:** Non-destructive preflight audit that scans the host Linux filesystem (`/usr/bin`, `/usr/sbin`, etc.) and reports available binaries.
* **Syntax:** `dualsurf tools`
* **Linux Execution Output:**
  ```text
  $ dualsurf tools

  AVAILABLE SYSTEM TOOLS & UTILITIES:
  ─────────────────────────────────────────────────────
    curl           : ✓ Available (/usr/bin/curl)
    ping           : ✓ Available (/usr/bin/ping)
    dig            : ✓ Available (/usr/bin/dig)
    whois          : ✓ Available (/usr/bin/whois)
    nmap           : ✓ Available (/usr/bin/nmap)
    openssl        : ✓ Available (/usr/bin/openssl)
    traceroute     : ✓ Available (/usr/sbin/traceroute)
    tcpdump        : ✓ Available (/usr/bin/tcpdump)
    git            : ✓ Available (/usr/bin/git)
    python3        : ✓ Available (/usr/bin/python3)
  ```

### `dualsurf sh <cmd>` / `dualsurf exec <cmd>`
* **Purpose:** Execute any local Linux terminal or Kali command synchronously, capturing stdout, stderr, and exit status.
* **Syntax:** `dualsurf sh "<command>"`
* **Linux Execution Example:**
  ```bash
  dualsurf sh "uname -a && whoami"
  # Output:
  # Linux Aman 6.18.33.2-microsoft-standard-WSL2 x86_64 GNU/Linux
  # aman
  ```

### `dualsurf sudo <cmd>`
* **Purpose:** Execute a command with elevated superuser privileges in Linux.
* **Syntax:** `dualsurf sudo <command>`

### `dualsurf offline`
* **Purpose:** Display offline workstation capabilities, local AI connectivity status, and diagnostic endpoints.
* **Syntax:** `dualsurf offline`

---

## 11. Command Quick Reference Cheat Sheet

| Command | Category | Description | Example |
|:---|:---|:---|:---|
| `tabs` | Browser | List active tabs | `dualsurf tabs` |
| `tab new <url>` | Browser | Open URL in new tab | `dualsurf tab new https://example.com` |
| `tab <n>` | Browser | Switch tab by index | `dualsurf tab 0` |
| `open <url>` | Browser | Navigate active tab | `dualsurf open https://scanme.nmap.org` |
| `click <id>` | Browser | Click numbered link | `dualsurf click 3` |
| `page` | Browser | Display page metadata | `dualsurf page` |
| `text` | Browser | Extract clean page text | `dualsurf text` |
| `links` | Browser | List actionable links | `dualsurf links` |
| `endpoints` | Browser | Filter API/Auth routes | `dualsurf endpoints auth` |
| `cert <host>` | Recon / SSL | Inspect TLS certificate | `dualsurf cert google.com` |
| `headers <url>` | AppSec | Audit security headers | `dualsurf headers https://example.com` |
| `cors <url>` | AppSec | Audit CORS policies | `dualsurf cors https://example.com` |
| `tech <url>` | Recon | Fingerprint stack & WAF | `dualsurf tech https://example.com` |
| `ports <ip>` | Network | Audit port exposure | `dualsurf ports 127.0.0.1 --profile common` |
| `port-scan <host>` | Network | High-speed perimeter port audit | `dualsurf port-scan 127.0.0.1` |
| `attack-surface <dom>` | Recon / ASM | Discover CT subdomains, cloud buckets & takeovers | `dualsurf attack-surface github.com` |
| `dns <host>` | Recon / DNS | Live passive DNS & SPF/DMARC spoofing audit | `dualsurf dns github.com` |
| `proxy status` | Proxy | Display loopback proxy status & breakpoint queue | `dualsurf proxy status` |
| `proxy start [port]` | Proxy | Start loopback interception proxy (8899) | `dualsurf proxy start 8899` |
| `proxy intercept <on\|off>` | Proxy | Toggle HTTP request breakpoint holding | `dualsurf proxy intercept on` |
| `repeater send <url>` | AppSec | Dispatch raw HTTP request & inspect headers | `dualsurf repeater send http://scanme.nmap.org` |
| `assess <url>` | AppSec | Full security assessment | `dualsurf assess https://example.com` |
| `secrets` | AppSec | Scan for leaked secrets | `dualsurf secrets` |
| `blue` | Blue Team | 13 defensive pillars | `dualsurf blue` |
| `blue pillar <1-13>` | Blue Team | Detailed pillar guide | `dualsurf blue pillar 1` |
| `siem <log>` | Blue Team | SIEM log parsing & rules | `dualsurf siem "Failed password for root"` |
| `ioc <text>` | Blue Team | Extract & defang IOCs | `dualsurf ioc "198.51.100.24 c2.corp"` |
| `hash <file>` | DFIR | Evidence hashing (SHA256) | `dualsurf hash evidence.log` |
| `case list` | Blue Team | List active IR cases | `dualsurf case list` |
| `case new <title>` | Blue Team | Create IR case & playbook | `dualsurf case new "Ransomware alert"` |
| `soar <target>` | Blue Team | Automated triage action | `dualsurf soar 10.0.0.5` |
| `mitre <text>` | Blue Team | Map to ATT&CK technique | `dualsurf mitre "credential dumping"` |
| `dmarc <domain>` | Defense | DNS DMARC/SPF audit | `dualsurf dmarc google.com` |
| `red` | Red Team | 7 offensive pillars | `dualsurf red` |
| `red domain <1-32>` | Red Team | 32-domain red team roadmap | `dualsurf red domain 1` |
| `roe check <target>` | Red Team | Scope authorization check | `dualsurf roe check https://target.corp` |
| `finding list` | Red Team | List pentest findings | `dualsurf finding list` |
| `finding export <fmt>` | Red Team | Export findings to Burp XML, ZAP JSON, Markdown | `dualsurf finding export burp --out issues.xml` |
| `purple matrix` | Purple Team | Adversary emulation matrix | `dualsurf purple matrix` |
| `tools` | System | Audit installed utilities | `dualsurf tools` |
| `sh <cmd>` | System | Execute Linux command | `dualsurf sh "nmap -V"` |
| `offline` | System | Offline diagnostics | `dualsurf offline` |
| `--terminal` | System | Interactive REPL session | `dualsurf --terminal` |
| `help` | System | Display quick help | `dualsurf help` |

---

## 12. Conclusion

DualSurf's command surface provides a robust, resilient, and high-performance command-line operations center under Linux and WSL 2 environments. Every command has been verified to execute reliably, collect forensic evidence, and support both daily browsing workflows and elite cybersecurity missions.
