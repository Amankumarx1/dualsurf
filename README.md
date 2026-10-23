# DualSurf 🌊

> **Dual-Mode Linux Browser**: Bridging modern graphical web browsing with a powerful, command-driven terminal interface through a shared browser controller.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20(Dev)-lightgrey.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-Latest-47848F.svg)](https://www.electronjs.org/)

---

## 🎯 Vision & Principles

DualSurf is designed specifically for power users, developers, sysadmins, and security researchers who navigate the web both graphically and from the shell. Rather than keeping GUI and terminal browsing in isolated silos, DualSurf introduces a **unified browsing session** managed by a **Shared Browser Controller**.

### Core Principles
1. **Linux-First**: Native desktop environment integration, X11/Wayland support, packaging (`.deb`, `AppImage`, `.rpm`), and shell integration (Bash, Zsh, Fish).
2. **Two Interfaces, One Product**: A single running browser instance whose tabs, session, history, and downloads can be driven identically from the GUI or the terminal.
3. **Modern Web Compatibility**: Built on Chromium via Electron (`WebContentsView`) to ensure 100% compatibility with modern HTML5, CSS3, ESNext, and complex SPAs.
4. **Terminal-Native**: Rich text rendering, numbered actionable links, form interaction, keyboard navigation, and CLI automation.
5. **Security by Design**: Web content isolation, strict context isolation, permission boundaries, and zero arbitrary shell execution from web content.
6. **Research-Ready**: Architecture instrumented for measuring task efficiency, IPC latency, accessibility, and navigation overhead.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   DualSurf Interfaces                  │
├───────────────────────────┬────────────────────────────┤
│   Mode A: Graphical GUI   │   Mode B: CLI & TUI        │
│   (React + TypeScript)    │   (One-shot CLI & TUI)     │
└─────────────┬─────────────┴─────────────┬──────────────┘
              │                           │
              │ Electron IPC              │ Unix Domain Socket
              │ (Preload / ContextBridge) │ (Named Pipe on Win)
              ▼                           ▼
┌────────────────────────────────────────────────────────┐
│               Shared Browser Controller                │
│  - Tab Management & Lifecycle (tab IDs, focus, bounds) │
│  - Navigation Engine & URL Normalization               │
│  - Page Content Inspector (Text & Numbered Links)      │
│  - Session & Profile Manager (Cookies, Storage)        │
│  - Download Manager & Permission Broker                │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     Chromium Engine       │ │     Persistence Layer     │
│   (WebContentsView)       │ │     (SQLite Storage)      │
└───────────────────────────┘ └───────────────────────────┘
```

---

## ⌨️ Terminal Command Reference

| Command | Expected Behavior |
| :--- | :--- |
| `dualsurf` | Launch graphical browser mode |
| `dualsurf --terminal` | Launch interactive terminal mode (TUI/REPL) |
| `dualsurf "<goal>"` / `do <goal>` | **Autonomous AI Agent**: Browse the web to satisfy a high-level goal using local Ollama |
| `dualsurf ask <question>` | **AI Q&A**: Ask questions and query content on the active webpage |
| `dualsurf summarize` | **AI Summary**: Generate concise key takeaways from the active page |
| `dualsurf open <url>` | Open URL in active tab (or search engine query) |
| `dualsurf search <query>` | Dispatch web search query |
| `dualsurf click <n \| "text">` | Follow link by numeric ID **OR** by semantic label (e.g. `click "Documentation"`) |
| `dualsurf tabs` | List all currently open tabs with IDs and titles |
| `dualsurf tab <n \| "name">` | Switch focus to tab by index `<n>` **OR** fuzzy title match (e.g. `tab "github"`) |
| `dualsurf tab new [url]` | Open a new tab |
| `dualsurf tab close [n]` | Close tab `<n>` |
| `dualsurf page` | Print current page metadata, title, and URL |
| `dualsurf text` | Extract and print readable structured page text |
| `dualsurf links` | Extract actionable links with detected endpoint routes & category badges |
| `dualsurf endpoints [filter]` | **Detect & classify page endpoints**: API (`/api/`), Auth (`/login`), Downloads, Forms |
| `dualsurf back` / `forward` | History back and forward navigation |
| `dualsurf reload` / `stop` | Reload or stop page loading |
| `dualsurf bookmarks` | List saved bookmarks |
| `dualsurf history` | Show visit history |
| `dualsurf scan <url> [file] [--html] [--json]` | **Automated Security Audit**: End-to-end passive pipeline (RoE, TLS, headers, cookies, CSP, CORS, tech, secrets, endpoints, robots, security.txt) with CVSS v3.1 scoring, HTML, Markdown & JSON report export |
| `dualsurf scan diff <prev.json> <curr.json>` | **Scan Diff & Remediation Tracker**: Compare two audit runs to compute score deltas, grade trajectories, and partition resolved vs new vulnerabilities |
| `dualsurf report <file>` | **Report Viewer / Browser**: Open interactive HTML reports in DualSurf browser tab or display Markdown/JSON in terminal |
| `dualsurf recon` / `audit` | **Target Reconnaissance**: Correlate DOM endpoints, headers, and suggest Kali scans |
| `dualsurf sec-audit` / `vuln` | **Passive Security Audit**: Scan for cleartext forms, missing CSRF tokens, tabnabbing, CSP & hygiene score |
| `dualsurf cert [host]` / `ssl` | **TLS/SSL Inspector**: Inspect certificate expiration, trusted CA, SAN subdomains & negotiated cipher |
| `dualsurf cors [url]` | **CORS Policy Audit**: Test for wildcard origins (`*`), origin reflection, and credential leak risks |
| `dualsurf tech [url]` | **Tech Fingerprinting**: Identify web servers, frameworks (React, Next, Express, Vue), CMS & Cloudflare WAF |
| `dualsurf secrets` | **DOM & Storage Secret Scanner**: Scan active page and client storage for AWS keys, JWT tokens & private keys |
| `dualsurf headers [url]` | **Security Headers**: Audit CSP, HSTS, X-Frame-Options, server disclosure |
| `dualsurf cookies` / `storage` | **Session Inspector**: Inspect active cookies and localStorage key/value entries |
| `dualsurf export [file]` | **Audit Report**: Export full penetration testing & DOM assessment to Markdown |
| `dualsurf status` | **Session Context**: View active tab, open tabs, detected endpoints, directory & local AI status |
| `dualsurf blue [domain \| spec]` | **31-Domain Roadmap**: Explore complete defensive cybersecurity domains & career paths |
| `dualsurf checklist [check \| reset]` | **Mastery Checklist**: Interactive 30-skill learning checklist & progress tracker |
| `dualsurf siem [file]` | **SOC & SIEM Log Analyzer**: Detect brute force, SQLi, web shells, LFI & map to ATT&CK |
| `dualsurf ioc [text/url]` | **Threat Intel & IOC Triage**: Extract, safely defang & classify IPs, domains, hashes |
| `dualsurf case [new/view/list]` | **Incident Response Cases**: Manage IR cases and generate automated containment playbooks |
| `dualsurf hash <file>` | **Digital Forensics Evidence**: Compute SHA-256, SHA-1, MD5 hashes with chain of custody |
| `dualsurf soar [target]` | **SOAR Playbook**: Execute automated triage, enrichment, and response recommendation |
| `dualsurf mitre [activity]` | **ATT&CK Matrix Correlation**: Map observed behavior to MITRE tactics & techniques |
| `dualsurf sigma [technique]` | **Detection Engineering**: Generate production Sigma YAML detection rules |
| `dualsurf hunt [file/text]` | **Threat Hunting Engine**: Hunt for C2 beaconing jitter, scanner tools, and process anomalies |
| `dualsurf yara [name] [patterns]` | **Defensive YARA Signatures**: Generate file & memory artifact signatures |
| `dualsurf red [domain \| spec \| study]` | **32-Domain Red Team Roadmap**: Complete offensive cybersecurity domains, career paths & 6-month study plan |
| `dualsurf red checklist [check \| reset]` | **Red Team Master Checklist**: Interactive 25-task offensive skills mastery tracker (0/25) |
| `dualsurf roe [list \| check <target>]` | **Rules of Engagement Scope Manager**: Verify whether targets are authorized for testing |
| `dualsurf finding [list \| view \| new]` | **Penetration Testing Findings**: Risk register with CVSS v3.1 scoring & actionable remediation |
| `dualsurf purple [matrix \| view \| status]` | **Purple Team Matrix**: Adversary emulation & MITRE ATT&CK detection coverage tracker |
| `dualsurf sudo <cmd>` | **Elevated Access**: Run commands with root/sudo privileges (e.g. `dualsurf sudo su`, `dualsurf sudo apt update`) |
| `dualsurf sh <cmd>` / `exec <cmd>` | **Execute Host Tool**: Run any system or Kali utility directly (`nmap`, `curl`, `ping`, `dig`) |
| `dualsurf tools` | **Audit Tools**: Check availability and paths of host networking and security tools |
| `dualsurf offline` | **Offline Mode**: Print offline environment status and local lab routing capabilities |
| `sudo su` *(in REPL)* | **Root Subshell**: Drop into interactive root subshell with full TTY stdin/stdout access |
| `cd <dir>` / `pwd` *(in REPL)* | **Directory Control**: Change or print active local working directory |
| `! <cmd>` *(in REPL)* | **Shell Escape**: Run arbitrary system command or script |

---

## 🛡️ All-in-One Browser + CLI + CMD (100% Offline & Root/Sudo Access)

DualSurf bridges the web browser and the operating system into a unified command and inspection environment:

1. **Root & Privileged Subshell (`sudo` & `sudo su`)**:
   - Run root commands directly in the CLI browser without leaving your session:
     ```bash
     dualsurf> sudo su
     # [sudo] password for user:
     root@kali:~# apt update && apt install nmap
     root@kali:~# exit
     dualsurf>
     ```
   - Standard TTY stdin/stdout is inherited: password prompts, interactive confirmation prompts (`[Y/n]`), and interactive shells (`bash`, `zsh`, `cmd`, `powershell`) work with full terminal access.
2. **All-in-One Browser + Shell Workflow**:
   - In the exact same prompt, switch tabs, inspect DOM links, run network scanners, and navigate local directories:
     ```text
     dualsurf> open https://example.local
     dualsurf> links
     dualsurf> click 2
     dualsurf> cd /var/www/html
     dualsurf> ls -la
     dualsurf> nmap -sV -p 80,443 localhost
     dualsurf> sudo systemctl restart nginx
     ```
3. **Desktop GUI Browser Terminal Integration**:
   - Switch to Terminal mode inside the graphical browser window to execute `sudo <cmd>`, `sh <cmd>`, `tools`, or host CLI commands with styled log output in real time.
4. **Air-gapped & Offline Lab Navigation**:
   - Open local files (`file:///...` or `./report.html`) and private subnets (`127.0.0.1`, `10.x.x.x`, `192.168.x.x`) without external DNS or search engine queries.
5. **100% Offline Local AI (Ollama)**:
   - Summarization, page Q&A, and autonomous ReAct agent loops communicate strictly with local loopback (`http://127.0.0.1:11434`), requiring zero internet connection.

---

## 🔒 Cyber Security & Defensive Reconnaissance Suite

DualSurf provides an end-to-end passive defensive security and reconnaissance toolkit built directly into both the terminal CLI and Desktop GUI:

1. **Passive Vulnerability & DOM Hygiene Audit (`sec-audit` / `vuln`)**:
   - Inspects active DOM structure, forms, and transport for security defects:
     - Cleartext transmission over plain HTTP
     - Form actions submitting sensitive data over unencrypted endpoints
     - Password forms submitting with insecure HTTP `GET`
     - Form mutations lacking anti-CSRF tokens
     - Reverse tabnabbing (`target="_blank"` without `rel="noopener noreferrer"`)
     - Insecure mixed content references
     - Missing defense-in-depth headers (CSP, HSTS, X-Frame-Options)
   - Assigns a weighted **Security Hygiene Score (0-100)** and risk rating (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `CLEAN`) with actionable remediation guidance.

2. **TLS/SSL Certificate Inspection & SAN Subdomain Recon (`cert` / `ssl`)**:
   - Native Node `tls.connect` analysis that operates 100% offline in air-gapped labs:
     - Certificate Common Name (CN), Organization (O), and Issuer CA
     - Validity dates, days remaining, and expiration alerts
     - Negotiated protocol (TLSv1.2, TLSv1.3) and cipher suite
     - **Subject Alternative Name (SAN) Enumeration**: Discovers hidden intranet and subdomains listed in the X.509 certificate.

3. **CORS Misconfiguration Analysis (`cors`)**:
   - Performs automated preflight origin probing to detect dangerous cross-origin setups:
     - Wildcard origin access (`Access-Control-Allow-Origin: *`)
     - Critical credential allowance (`Access-Control-Allow-Credentials: true`) with wildcard
     - Arbitrary attacker origin reflection (`Origin: https://evil.example.com` echoed back)
     - Null origin acceptance (`Origin: null`)

4. **Technology Stack & WAF Fingerprinting (`tech` / `fingerprint`)**:
   - Non-intrusive heuristic detection of target infrastructure:
     - Web Servers: Nginx, Apache, Caddy, LiteSpeed, IIS
     - Frameworks & Runtimes: React, Next.js, Vue, Nuxt, Angular, Express.js, ASP.NET, PHP, Django
     - CMS: WordPress, Drupal, Joomla, Shopify
     - Cloud & WAF/CDN: Cloudflare, AWS CloudFront, Fastly, Akamai

5. **Exposed Secrets & Credential Leakage Scanner (`secrets`)**:
   - High-performance regex scan across active DOM text snippets, `document.cookie`, and `localStorage`:
     - AWS Access Key IDs (`AKIA...`)
     - Unencrypted JSON Web Tokens (`eyJ...`)
     - Private key header blocks (`-----BEGIN RSA/EC PRIVATE KEY-----`)
     - Internal RFC1918 IP addresses (`10.x.x.x`, `192.168.x.x`, `172.16.x.x`)
     - Leaked API key variables

6. **Autonomous AI Security Tools**:
   - Local Ollama AI agents can invoke any security tool autonomously (`audit_security_hygiene`, `get_tls_certificate`, `analyze_cors`, `detect_technologies`, `scan_secrets`) to investigate, verify, and document findings during automated security assessments.

---

## 🛡️ Blue Team Cybersecurity Operations Station (BlueOps)

DualSurf includes a comprehensive Blue Team and defensive cybersecurity command center, supporting all **31 core domains** and the complete **30-skill learning checklist**:

### 1. 31-Domain Roadmap & Career Guides (`blue` / `roadmap`)
- **Full Domain Map**: Query any of the 31 domains (`blue` or `blue domain <1-31>`) for strategic goals, subdomains, and practical lab exercises:
  - `01 Security Fundamentals` • `02 SOC & SIEM` • `03 SIEM & Logs` • `04 Endpoint / EDR`
  - `05 Network Defense` • `06 Threat Intelligence` • `07 Threat Hunting` • `08 Incident Response`
  - `09 Digital Forensics` • `10 Detection Engineering` • `11 Identity & AD` • `12 Cloud Security`
  - `13 Application Security` • `14 Vulnerability Mgmt` • `15 Email Security` • `16 Data Security`
  - `17 Architecture & Zero Trust` • `18 Malware Analysis` • `19 SOAR Playbooks` • `20 Observability`
  - `21 Awareness & Human Risk` • `22 Secrets & PKI` • `23 DevSecOps / Supply Chain` • `24 DB Security`
  - `25 Mobile & IoT` • `26 OT / ICS / SCADA` • `27 Wireless Security` • `28 GRC & Frameworks`
  - `29 Privacy & Legal Holds` • `30 Security Research` • `31 Career Pathways`
- **Career Specialization Pathways**: View tailored day-in-the-life playbooks, required toolsets, and home lab guidance (`blue spec soc`, `blue spec ir`, `blue spec hunt`, `blue spec detect`, `blue spec dfir`).

### 2. Interactive 30-Skill Mastery Checklist (`checklist`)
- **Persistent Progress Tracker**: Tracks 30 defensive skills across 6 progressive tiers (Foundations, SOC & SIEM, Endpoint & Network, Investigation, Advanced Defense, Professional Readiness).
- Progress bar and completion statistics saved persistently to `~/.dualsurf/blue-checklist.json`:
  ```text
  dualsurf> checklist
  Mastery Status: [████████░░░░░░░░░░░░] 12/30 (40%)
  dualsurf> checklist check 9 "Created Sigma rule for SSH brute force"
  dualsurf> checklist uncheck 9
  dualsurf> checklist reset
  ```

### 3. SOC & SIEM Log Analyzer (`siem` / `logs`)
- Ingests auth logs, syslog, web access logs, and Windows event records.
- Identifies brute force spikes, unauthorized `sudo` elevation, SQL injection, path traversal / LFI, XSS, and web shells.
- Calculates overall **Threat Rating** (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `CLEAN`), isolates top attacker IPs, and maps events to MITRE ATT&CK.

### 4. Threat Intelligence & Safe IOC Triage (`ioc` / `ti`)
- Extracts IPv4, IPv6, URLs, domains, MD5, SHA-1, SHA-256 hashes, and emails.
- **Safe Defanging**: Automatically defangs malicious URLs (`hxxps[://]`) and IPs (`185[.]220[.]101[.]5`) to prevent accidental clicks or resolver queries.
- Distinguishes internal RFC1918 private subnets from external threat infrastructure.

### 5. Detection Engineering: Sigma & YARA Generator (`sigma` / `yara`)
- Generates production-ready **Sigma YAML rules** (`sigma sqli`, `sigma t1110`, `sigma sudo`) with logsource definitions, detection selections, and ATT&CK tags.
- Generates defensive **YARA signatures** (`yara webshell c99.php r57.php`) for file artifact and memory scanning.

### 6. Threat Hunting Analytics Engine (`hunt`)
- **C2 Beaconing Detection**: Analyzes network connection timestamps, calculating inter-arrival intervals and jitter standard deviation (<25% variance indicates automated beaconing).
- **Scanner Tool Detection**: Uncovers automated offensive scanners (`sqlmap`, `nikto`, `gobuster`, `nmap`).
- **Process Lineage Anomalies**: Flags suspicious process execution chains (e.g., `winword.exe -> powershell.exe`, `w3wp.exe -> cmd.exe`).
- **Identity & Cloud Auditing**: Flags Kerberoasting ticket requests (`0x17` rc4) and unauthorized IAM modifications (`CreateAccessKey`).

### 7. Incident Response Case Management (`case` / `ir`)
- Generates structured case tickets (`INC-YYYY-XXXX`) with severity levels (`P1-CRITICAL` to `P4-LOW`).
- Generates automated containment action items (network host isolation, credential revocation, evidence freezing).
- Maintains investigator notes and timeline audits.

### 8. Digital Forensics & Cryptographic Evidence (`hash` / `dfir`)
- Computes SHA-256, SHA-1, and MD5 hashes simultaneously via Node's native crypto engine (100% offline).
- Generates formal chain-of-custody acquisition records with investigator timestamps and byte counts.

### 9. SOAR Automated Triage Playbook (`soar`)
- Automated single-command triage for suspicious IPs, domains, or hashes.
- Determines incident priority, extracts IOCs, maps MITRE techniques, and generates containment checklists.

### 10. Autonomous AI Blue Team Agent
- Local Ollama AI models can autonomously invoke:
  - `analyze_security_logs` • `triage_iocs` • `manage_incident_case`
  - `run_soar_playbook` • `compute_forensic_hash` • `browse_blue_team_roadmap`
  - `manage_blue_team_checklist` • `generate_detection_rule` • `hunt_threats`

---

## 🔴 Red Team & Purple Team Cybersecurity Operations (RedOps)

DualSurf expands beyond defense into a comprehensive **Offensive Security and Adversary Emulation Operations Station**, empowering authorized security assessments, penetration testing, scope verification, and collaborative Purple Teaming:

### 1. 32-Domain Red Team Roadmap (`red` / `dualsurf red`)
- **Complete Offensive Domain Syllabus**: Query all 32 domains (`red` or `red domain <1-32>`) for objectives, subdomains, toolsets, and assessment focus:
  - `01 Foundations & Ethics` • `02 Reconnaissance` • `03 OSINT` • `04 Network Pentesting`
  - `05 Web Security` • `06 API Security` • `07 Linux Security` • `08 Windows Security`
  - `09 Active Directory` • `10 Privilege Escalation` • `11 Identity & Access` • `12 Internal Pentesting`
  - `13 Red-Team Operations` • `14 Adversary Emulation` • `15 Cloud Security` • `16 Containers & K8s`
  - `17 Wireless Security` • `18 Mobile Security` • `19 Social Engineering` • `20 Physical Security`
  - `21 Exploit Development` • `22 Reverse Engineering` • `23 Malware Research` • `24 Binary Exploitation`
  - `25 Cryptography` • `26 Wireless & IoT` • `27 Evasion & Detection Testing` • `28 Purple Teaming`
  - `29 Reporting & Risk` • `30 Research & Automation` • `31 Physical Attack Paths` • `32 Enterprise Environments`

### 2. 25-Skill Red Team Master Checklist (`red checklist`)
- **Interactive Offensive Skills Tracker**: Tracks 25 practical capabilities across 5 progressive tiers:
  - **Foundations**: Networking models, CLI tools, scripting, permissions, rules of engagement.
  - **Reconnaissance & Testing**: Scoped inventory, service enumeration, web functionality, access control, non-destructive validation.
  - **Systems & Identity**: Linux permissions, Windows security policies, Active Directory Kerberos, privilege boundaries, enterprise attack paths.
  - **Specialized Domains**: Cloud IAM, containers & Kubernetes, mobile assessments, binary analysis, ATT&CK mapping.
  - **Professional Delivery**: Reproducible technical findings, CVSS v3.1 impact, remediation, scope control, retesting.
- Persistent progress saved to `~/.dualsurf/red-checklist.json`:
  ```text
  dualsurf> red checklist
  Red Mastery Status: [████████░░░░░░░░░░░░] 8/25 (32%)
  dualsurf> red check 14 "Audited BloodHound attack path to Domain Admin"
  dualsurf> red uncheck 14
  dualsurf> red reset
  ```

### 3. Rules of Engagement (RoE) Scope Manager (`roe` / `scope`)
- **Explicit Authorization Safeguard**: Prevent testing forbidden hosts or third-party targets outside client authorization.
- Verify target reachability and permission instantly:
  ```text
  dualsurf> roe check target.internal
  ✔ AUTHORIZED IN-SCOPE: Target "target.internal" is explicitly authorized under ROE-2026-001 (Lab Testing Environment).

  dualsurf> roe check unauthorized-bank.com
  ✖ UNAUTHORIZED / OUT OF SCOPE: Target "unauthorized-bank.com" is NOT listed in authorized domains or IP ranges for ROE-2026-001.
  ```

### 4. Penetration Testing Findings & Risk Register (`finding` / `pentest`)
- **Standardized Technical Reporting**: Track identified vulnerabilities with CVSS v3.1 base scoring, affected assets, reproduction steps, demonstrated impact, and actionable remediation.
- Manage status workflow: `Open` -> `Retested` -> `Remediated`.
  ```text
  dualsurf> finding list
  dualsurf> finding view FIND-2026-001
  dualsurf> finding new "IDOR in User Profile API"
  dualsurf> finding status FIND-2026-001 Remediated
  ```

### 5. Purple Team Adversary Emulation Matrix (`purple` / `emulation`)
- **Collaborative Attack vs Defense Matrix**: Connect offensive test cases directly with defensive detection outcomes.
- Maps benign simulations to MITRE ATT&CK techniques with live detection status tracking (`DETECTED`, `PARTIAL`, `BLIND_SPOT`).
  ```text
  dualsurf> purple matrix
  Detection Coverage: 2 Detected, 1 Partial, 1 Blind Spots
  [✔ DETECTED]   T1059.001 - PowerShell Execution (Execution)
  [✖ BLIND SPOT] T1110.001 - Password Spraying (Credential Access)
  [✔ DETECTED]   T1190     - Exploit Public App (Initial Access)
  [▲ PARTIAL]    T1548.003 - Sudo Caching PrivEsc (Privilege Escalation)
  ```

### 6. 6-Month Accelerated Study Plan (`red study`)
- Month-by-month structured curriculum guiding learners from foundations (Networking, Linux, Windows, Python) to Core Testing, Enterprise AD, Cloud & Adversary Emulation, and Specialist Portfolio.

### 7. Offensive Specialization Pathways (`red spec <role>`)
- Detailed career pathways for:
  - `web` — Web Application Penetration Tester (OWASP Top 10, PortSwigger Academy, BSCP)
  - `network` — Network Penetration Tester (Segmentation, service hardening, OSCP)
  - `ad` — Active Directory Security Specialist (BloodHound, Kerberoasting, CRTP)
  - `cloud` — Cloud Security Tester (AWS/Azure IAM, CloudGoat, IMDSv2)
  - `exploit` — Exploit Developer & Binary Researcher (Memory safety, ROP, OSED)
  - `ai` — AI Security Researcher (LLM Red Teaming, prompt injection, PyRIT)

### 8. Autonomous AI Red & Purple Team Tools
- Local Ollama models can autonomously invoke:
  - `run_automated_security_scan`
  - `browse_red_team_roadmap` • `manage_red_team_checklist`
  - `manage_engagement_scope` • `manage_pentest_findings`
  - `manage_purple_team_tests`

---

## ⚡ Automated Website Security Audit Pipeline & Reporting (`scan`)

DualSurf provides an end-to-end automated security assessment and reporting pipeline. Simply provide any website URL, and the system executes 12 non-destructive passive auditing modules, calculates CVSS v3.1 risk scores, and compiles comprehensive reports across multiple formats (Interactive HTML, Markdown, and JSON):

```bash
# One-Shot CLI execution (generates Markdown, HTML, and JSON)
dualsurf scan https://target.internal audit-report.md --html --json

# Track vulnerability remediation trajectories over time
dualsurf scan diff previous-audit.json current-audit.json

# Open interactive HTML penetration report directly in DualSurf browser
dualsurf report audit-report.html

# Interactive Terminal REPL
dualsurf> scan https://target.internal
dualsurf> scan diff prev.json curr.json
dualsurf> report audit-report.html

# Autonomous AI Agent goal
dualsurf "perform a full security audit on https://target.internal and export the report"
```

### The 12 Automated Audit Modules:
1. **RoE Scope Verification**: Automatically cross-references configured Rules of Engagement scopes (`engagementStore.isTargetInScope`) to verify whether the target domain/IP is authorized.
2. **Connectivity & HTTP Response Analysis**: Probes HTTP reachability, status code, latency, and server banners.
3. **TLS/SSL Transport Security**: Socket handshake inspection of X.509 certificates, CA trust chain, expiration days remaining, protocol versions (TLS 1.2/1.3), cipher suites, and Subject Alternative Names (SANs / subdomain enumeration).
4. **HTTP Security Headers Matrix**: Rigorous compliance grading for `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and Server Information Disclosure.
5. **Cookie Security & Session Flags Hygiene**: Audits all `Set-Cookie` headers for `Secure`, `HttpOnly`, and `SameSite` (`Strict`, `Lax`, `None`) attributes, flagging session cookies vulnerable to MITRE XSS extraction or CSRF forgery.
6. **Content-Security-Policy (CSP) Deep Inspection**: Scans directives for bypasses and weaknesses (`'unsafe-inline'`, `'unsafe-eval'`, wildcard `*` origins, and missing `base-uri` protection).
7. **Cross-Origin Resource Sharing (CORS) Audit**: Probes CORS behavior with arbitrary origin headers to identify wildcard access (`*`), reflected origins, and dangerous credential leakage (`Access-Control-Allow-Credentials: true`).
8. **Open Redirect Suspect Parameter Detection**: Heuristically extracts query parameters (`redirect`, `url`, `next`, `return`, `dest`) across all discovered links to identify potential bounce and phishing vectors.
9. **Search Engine & Administrative Route Disclosure**: Probes `/robots.txt` and surfaces sensitive paths (`/admin`, `/api`, `/config`, `/backup`).
10. **RFC 9116 security.txt Vulnerability Disclosure**: Checks for official vulnerability disclosure policies under `/.well-known/security.txt`.
11. **Technology Stack & WAF Fingerprinting**: Identifies backend web servers (Nginx, Apache), frontend/backend frameworks (React, Next.js, Vue, Angular, Express, PHP, ASP.NET), CMS platforms (WordPress), and Edge CDN/WAF services (Cloudflare).
12. **DOM & Storage Secret Scanner**: Scans DOM response bodies and client storage for exposed AWS Access Keys (`AKIA...`), JWT Bearer tokens, private key headers, and RFC1918 internal IP address leaks.

### Multi-Format Reporting & CI/CD DevSecOps:
- **Interactive Standalone HTML Report (`.html`)**: 100% offline and air-gap compliant (zero CDN or external font dependencies). Includes SVG circular score gauge, KPI summary cards, interactive severity filter buttons, live search input, collapsible finding accordions, and `@media print` rules for clean, direct PDF generation via browser print.
- **Technical Penetration Testing Markdown (`.md`)**: Executive summary and technical Markdown tables suitable for Git repositories, wikis, and issue trackers.
- **Structured DevSecOps JSON (`.json`)**: Machine-readable JSON output for automated CI/CD security gating and pipeline regressions.
- **Remediation & Score Diffing (`dualsurf scan diff`)**: Calculates score deltas (`+28 pts`), grade trajectories (`F -> B`), and partitions findings into resolved, new, and persisting categories.

---

## 🗺️ Roadmap & Phases

- [ ] **Phase 1: Browser Foundation** — Electron + React + TypeScript with `WebContentsView`, multi-tab management, address bar, navigation controls.
- [ ] **Phase 2: Browser Controller** — Decoupled controller API, tab lifecycle events, loading state tracker, session ownership.
- [ ] **Phase 3: CLI & IPC Server** — Local Unix Domain Socket / Named Pipe IPC, command protocol, `dualsurf` CLI client.
- [ ] **Phase 4: Interactive Terminal Browsing** — Text extraction engine, numbered links snapshot, interactive TUI keyboard shortcuts.
- [ ] **Phase 5: Persistence & Utilities** — SQLite storage for bookmarks, history, profiles, settings, downloads.
- [ ] **Phase 6: Headless Linux Mode** — Operable without X11/Wayland display for headless Linux servers.
- [ ] **Phase 7: Security Hardening** — Content security policy, sandbox enforcement, IPC authorization, permission prompts.
- [ ] **Phase 8: Release Engineering** — Packaging (`.deb`, `AppImage`), desktop shortcuts, man pages, shell completion.

---

## 📁 Repository Structure

```
dualsurf/
├── apps/
│   ├── desktop/          # Electron main, preload, and React GUI
│   ├── cli/              # dualsurf CLI executable & command handlers
│   └── terminal/         # Interactive TUI application
├── packages/
│   ├── controller/       # Shared Browser Controller & Tab Manager
│   ├── ipc-protocol/     # Typed IPC request/response schema & versioning
│   ├── page-inspector/   # DOM/Text extraction & link numbering
│   ├── storage/          # SQLite schema, migrations, queries
│   └── shared-types/     # Shared domain entities & interfaces
├── docs/                 # Architecture, security, command specs
└── tests/                # Unit, integration, E2E tests
```
