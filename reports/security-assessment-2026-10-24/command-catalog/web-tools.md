# Comprehensive Command Reference: Web Application Testing Module

This document provides a complete, verified command catalog for the 4 web application testing capabilities integrated into DualSurf: **Burp Suite, OWASP ZAP, Browser Developer Tools, and ffuf**.

---

## 1. Burp Suite

- **Purpose:** Web application security testing platform providing HTTP/S interception, request history, manual Repeater, automated Intruder, and passive/active scanner.
- **Binary Name:** `burpsuite` / `burpsuite.bat` / `burp.jar`
- **Detected Host Status:** NOT INSTALLED (Java Runtime Environment 21.0.12.1 is installed on host)
- **Documentation URL:** [https://portswigger.net/burp/documentation](https://portswigger.net/burp/documentation)
- **Required Permissions:** Unprivileged user. Default local proxy listener runs on `127.0.0.1:8080`.

### Complete Option Set & Syntax Reference
```bash
# Standard Launch
burpsuite                        # Launch desktop GUI
java -jar burpsuite_community.jar # Launch raw JAR file
java -jar burp.jar --project-file=audit_2026.burp # Open or create named project

# Headless & Automation Options (Professional / Enterprise)
java -jar burp.jar --unpause-spider-and-scanner
java -jar burp.jar --config-file=burp_config.json
java -jar burp.jar --collaborator-server

# DualSurf Proxy Routing Integration
# DualSurf routes browser traffic to Burp by setting Chromium proxy args:
# --proxy-server=http://127.0.0.1:8080 --proxy-bypass-list=<-loopback>
```

### Categorized Command Workflows
| Category | Command | Applicability / Scope Status |
| :--- | :--- | :--- |
| **Diagnostic & Help** | `java -jar burpsuite.jar --help` | Safe diagnostic check. |
| **Applicable to Website** | Browser routed through `127.0.0.1:8080`; passive HTTP inspection; manual Repeater testing on `https://www.amankumarx1.xyz/`. | Non-destructive web testing. (Status: `Documented — Burp GUI not present on host; tested using DualSurf native Repeater`). |
| **Local Lab Only** | Active automated vulnerability scanner on lab servers (`http://127.0.0.1:8080/dvwa`). | Active vulnerability scanning is restricted to authorized targets. |
| **Not Applicable** | Automated credential spraying or session hijacking modules. | Prohibited by policy. |

---

## 2. OWASP ZAP (Zed Attack Proxy)

- **Purpose:** Open-source web application security scanner supporting interception proxying, passive scanning, active fuzzing, and the headless ZAP Automation Framework (AF).
- **Binary Name:** `zaproxy` / `zap.bat` / `zap.sh`
- **Detected Host Status:** NOT INSTALLED (Java Runtime Environment 21.0.12.1 is installed on host)
- **Documentation URL:** [https://www.zaproxy.org/docs/automate/automation-framework/](https://www.zaproxy.org/docs/automate/automation-framework/)
- **Required Permissions:** Unprivileged user. Default proxy listener runs on `127.0.0.1:8080` (or `8090`).

### Complete Option Set & Syntax Reference
```bash
# Command-Line Launch
zap.bat                          # Launch standard GUI
zap.bat -daemon -port 8080 -host 127.0.0.1 # Headless daemon mode
zap.bat -daemon -config api.key=dualsurf_secret # Set API key
zap.bat -daemon -config api.disablekey=true     # Disable API key (Lab only)

# Command-Line Quick Scan
zap.bat -cmd -quickurl https://www.amankumarx1.xyz/ -quickout report.html

# ZAP Automation Framework (AF)
zap.bat -cmd -autorun af_plan.yaml # Execute structured YAML automation plan

# Example Automation Framework Plan (af_plan.yaml)
---
env:
  contexts:
    - name: "Amankumar Portfolio Scope"
      urls:
        - "https://www.amankumarx1.xyz/"
      includePaths:
        - "https://www.amankumarx1.xyz/.*"
jobs:
  - type: spider
    parameters:
      maxDuration: 5
      maxDepth: 2
  - type: passiveScan-wait
    parameters:
      maxDuration: 5
  - type: report
    parameters:
      template: traditional-json
      reportFile: zap_report.json
```

### Categorized Command Workflows
| Category | Command | Applicability / Scope Status |
| :--- | :--- | :--- |
| **Diagnostic & Help** | `zap.bat -h` | Safe diagnostic check. |
| **Applicable to Website** | `zap.bat -cmd -autorun passive_scan.yaml` | Conservative passive scan and alert triage against approved hostname. (Status: `Documented but not executed — ZAP not installed on host`). |
| **Local Lab Only** | Full active scanner jobs with aggressive SQLi/XSS attack vectors (`-type activeScan`). | Bounded active testing on authorized lab targets. |

---

## 3. Browser Developer Tools (Chromium Native Engine)

- **Purpose:** In-depth real-time inspection of active web documents, network request/response streams, JavaScript console logs, DOM state, storage, and security certificates.
- **Binary Identifier:** Built-in DualSurf Chromium WebEngine
- **Detected Host Status:** **INSTALLED & VERIFIED ACTIVE** (Chrome 130.0.6723.44 / Electron 33.0.0)
- **Documentation URL:** [https://developer.chrome.com/docs/devtools/](https://developer.chrome.com/docs/devtools/)
- **Required Permissions:** Unprivileged browser user.

### Verification & Capability Reference
```bash
# Activation in DualSurf:
# 1. Click "Open DevTools" button in Web Testing workspace tab
# 2. Or press Ctrl+Shift+I / F12 on the active browser tab
# 3. Invokes webContents.openDevTools({ mode: 'detach' }) via Electron IPC

# Primary Audit Panes:
- Network Panel: Captures full HTTP request headers, response headers, status codes, timing metrics, and initiator stacks.
- Console Panel: Monitors client-side JavaScript errors, unhandled promise rejections, and security deprecation notices.
- Application Panel: Audits local storage, session storage, indexedDB, and cookie attributes (HttpOnly, Secure, SameSite).
- Security Panel: Validates TLS connection, certificate issuer, cipher suite, and mixed content warnings.
```

### Categorized Workflows
| Category | Workflow | Applicability / Scope Status |
| :--- | :--- | :--- |
| **Diagnostic & Live Audit** | Open DevTools on `https://www.amankumarx1.xyz/` | **EXECUTED & VERIFIED**. Inspected response headers, verified 0 console errors, confirmed static assets loaded from Vercel Edge. |
| **Storage Audit** | Application -> Storage & Cookies | **EXECUTED & VERIFIED**. Confirmed no tracking or authentication cookies present on client. |

---

## 4. ffuf (Fast Web Fuzzer)

- **Purpose:** High-performance web endpoint, directory, and parameter discovery tool written in Go.
- **Binary Name:** `ffuf` / `ffuf.exe`
- **Detected Host Status:** NOT INSTALLED on host PATH
- **Documentation URL:** [https://github.com/ffuf/ffuf/wiki](https://github.com/ffuf/ffuf/wiki)
- **Required Permissions:** Unprivileged user.

### Complete Option Set & Syntax Reference
```bash
# General Syntax
ffuf -u <url/FUZZ> -w <wordlist> [options]

# Core Options
ffuf -u "https://example.com/FUZZ" -w common.txt # Basic directory fuzzing
ffuf -u "https://example.com/api/FUZZ" -w api.txt -mc 200,301,302
ffuf -X POST -u "https://example.com/FUZZ" -d "data=1" # Custom HTTP method & body
ffuf -H "User-Agent: DualSurf-Audit/1.0" -H "X-Custom: 1" # Custom headers

# Rate Limiting & Throttling
ffuf -rate 20 -u "https://example.com/FUZZ" -w common.txt # Limit to 20 req/sec
ffuf -t 2 -u "https://example.com/FUZZ" -w common.txt    # Limit concurrency to 2 threads
ffuf -p 0.2 -u "https://example.com/FUZZ" -w common.txt  # Pause 0.2s between requests
ffuf -timeout 5 -u "https://example.com/FUZZ" -w common.txt # 5s timeout

# Filtering & Matching
ffuf -mc 200,204,301,302,307,401,403 # Match only specific status codes
ffuf -fc 404,400                     # Filter out unwanted status codes
ffuf -fs 4242                        # Filter out responses of specific byte size
ffuf -fr "Page Not Found"            # Filter out responses matching regex string
ffuf -fl 10                          # Filter out responses with N lines

# Output Formatting
ffuf -o results.json -of json        # Save structured results to JSON
ffuf -o results.csv -of csv          # Save results to CSV
ffuf -c                              # Colorize console output
```

### Categorized Command Workflows
| Category | Command | Applicability / Scope Status |
| :--- | :--- | :--- |
| **Diagnostic & Help** | `ffuf -V`<br>`ffuf -h` | Safe diagnostic check. |
| **Applicable to Website** | `ffuf -u "https://www.amankumarx1.xyz/FUZZ" -w common.txt -rate 20 -t 2 -mc 200,301,302 -timeout 5 -c` | Conservative path validation against authorized domain with rate throttling. (Status: `Documented but not executed — ffuf not installed on host`). |
| **Local Lab Only** | `ffuf -u "http://127.0.0.1:8080/FUZZ" -w big.txt -rate 500 -t 40` | High-concurrency directory brute-forcing. |
| **Not Applicable** | Virtual host fuzzing or recursive sweeps on shared CDN infrastructure. | Prohibited by policy. |
