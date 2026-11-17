# DualSurf Security Toolkit Audit & Live Website Assessment — Final Technical Report

**Assessment Reference:** `DUALSURF-SEC-2026-10-24`  
**Assessment Date:** 2026-10-24  
**Assessor:** DualSurf Security Research Team & Automated Tooling Engine  
**Host Platform:** Windows 11 Enterprise (Win32NT 10.0.26300.0 x64)  
**Primary Target:** [https://www.amankumarx1.xyz/](https://www.amankumarx1.xyz/)  

---

## 1. Executive Summary

A structured, evidence-based security assessment of the web application at `https://www.amankumarx1.xyz/` and an end-to-end integration audit of DualSurf's 14 core security tools was conducted on **October 24, 2026**.

The assessment evaluated three functional security modules:
1. **Network Reconnaissance** (Nmap, Wireshark, TShark, Netcat, Ncat, Masscan)
2. **Web Application Testing** (Burp Suite, OWASP ZAP, Browser Developer Tools, ffuf)
3. **Active Directory & Identity Assessment** (BloodHound, SharpHound, Impacket, NetExec)

### Overall Assessment Status
- **Target Accessibility:** `https://www.amankumarx1.xyz/` is fully operational, hosted on Vercel's global Anycast Edge Network (Mumbai POP `bom1`).
- **Transport Security:** HTTP requests (port 80) forcefully redirect via `308 Permanent Redirect` to HTTPS (port 443). TLS 1.2/1.3 handshakes succeed with valid certificates.
- **Security Defenses in Place:** HSTS is enforced (`max-age=63072000; includeSubDomains; preload`), Clickjacking protection is enabled (`X-Frame-Options: DENY`), MIME-sniffing protection is active (`X-Content-Type-Options: nosniff`), and Permissions-Policy is configured.
- **Confirmed Vulnerabilities & Observations:**
  - **Medium (1):** [SEC-WEB-001] Missing `Content-Security-Policy` (CSP) Header on HTML document (CVSS 5.4).
  - **Low (2):** [SEC-WEB-002] Server Banner Information Disclosure (`Server: Vercel`, `X-Vercel-Id`) (CVSS 2.6); [SEC-WEB-003] Overly Permissive Wildcard `Access-Control-Allow-Origin: *` on root HTML document (CVSS 3.7).
- **Major Environmental Limitations:**
  - The target is hosted on Vercel's multi-tenant Anycast IP (`76.76.21.164`). Masscan and broad port scans were strictly excluded to protect third-party tenant infrastructure.
  - The target website does not run an Active Directory Domain Controller; live AD collection and domain enumeration were marked **NOT APPLICABLE**.
  - Host tools not present in PATH were truthfully reported as `NOT INSTALLED` without simulated output.

---

## 2. Scope & Methodology

### In-Scope Assets
- **Primary FQDN:** `www.amankumarx1.xyz`
- **Apex Domain:** `amankumarx1.xyz`
- **Ports & Protocols:** TCP port 80 (HTTP redirect inspection), TCP port 443 (HTTPS inspection)

### Explicitly Excluded Assets
- Non-web ports on Vercel's Anycast IPs (`76.76.21.164`, `66.33.60.34`, `76.76.21.21`).
- Third-party social links (LinkedIn, GitHub, Instagram).
- Vercel hosting platform management planes and internal infrastructure.

### Assessment Methodology
The audit adhered to the OWASP Web Security Testing Guide (WSTG) and PTES standards:
1. **Passive DNS & Infrastructure Fingerprinting:** Resolution, CNAME inspection, Anycast identification.
2. **Transport Layer & Protocol Auditing:** TLS handshake validation, ALPN negotiation, HTTP-to-HTTPS redirect verification.
3. **HTTP Header & Response Analysis:** Security header review (HSTS, CSP, XFO, XCTO, Referrer-Policy, CORS).
4. **Client-Side Behavioral Audit:** DualSurf Chromium DevTools inspection of JavaScript console, local storage, cookies, and DOM resources.
5. **Tool Integration & Lifecycle Auditing:** Validation of DualSurf's CLI commands, PTY shell execution, IPC message channels, and test suite execution.

---

## 3. Tool Availability & Capability Matrix

The following table reflects the **actual detection and execution state** of all 14 tools on the Windows 11 host:

| Tool Family | Module | Detected Status | Version / Edition | Executable Path | Integration Status | Live Target Applicability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Nmap** | Network Recon | **NOT INSTALLED** | None | None | CLI & PTY Supported | Applicable (Port 80/443 check only) |
| **Wireshark** | Network Recon | **NOT INSTALLED** | None | None | GUI Launcher Supported | Local capture only; requires Npcap |
| **TShark** | Network Recon | **NOT INSTALLED** | None | None | CLI Headless Supported | Applicable for local test session capture |
| **Ncat** | Network Recon | **NOT INSTALLED** | None | None | Socket Probing Supported | Applicable for TLS socket handshake |
| **Netcat (`nc`)** | Network Recon | **NOT INSTALLED** | None | None | Socket Probing Supported | Raw port reachability diagnostics |
| **Masscan** | Network Recon | **NOT INSTALLED** | None | None | Bounded Rate Supported | **EXCLUDED BY POLICY** (Multi-tenant CDN) |
| **Burp Suite** | Web Testing | **NOT INSTALLED** | None (Java 21 present) | None | Proxy Routing Supported | Applicable via local proxy `127.0.0.1:8080` |
| **OWASP ZAP** | Web Testing | **NOT INSTALLED** | None (Java 21 present) | None | Automation Plan Supported | Applicable for passive scanning |
| **Browser DevTools** | Web Testing | **INSTALLED** | Chrome 130 (Electron 33) | DualSurf WebEngine | **VERIFIED ACTIVE** | **EXECUTED & VERIFIED ON TARGET** |
| **ffuf** | Web Testing | **NOT INSTALLED** | None | None | Fuzzing Wizard Supported | Applicable under rate-limited profile |
| **BloodHound** | Identity Audit | **NOT INSTALLED** | Ports 8080/7474 offline | None | CE / Neo4j Bridge Supported | **NOT APPLICABLE** (No AD domain) |
| **SharpHound** | Identity Audit | **NOT INSTALLED** | None | None | Wizard & RoE Gate Supported | **NOT APPLICABLE** (No AD domain) |
| **Impacket** | Identity Audit | **NOT INSTALLED** | None (Python 3.13 present)| None | Script Catalog Supported | **NOT APPLICABLE** (No SMB/LDAP/MSRPC) |
| **NetExec (`nxc`)** | Identity Audit | **NOT INSTALLED** | None | None | CLI Native Supported | **NOT APPLICABLE** (No SMB/LDAP) |

---

## 4. Network Reconnaissance Findings

### 4.1 DNS Resolution & Infrastructure Identification
- `www.amankumarx1.xyz` resolves via CNAME to `cname.vercel-dns.com`.
- A-records point to `76.76.21.164` and `66.33.60.34`.
- Apex domain `amankumarx1.xyz` resolves to `76.76.21.21`.
- Raw Evidence: [`raw-output/network/dns_lookup.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/raw-output/network/dns_lookup.txt)

### 4.2 Port & Service Reachability
- **Port 80 (HTTP):** Open. Returns `HTTP/1.0 308 Permanent Redirect` with `Location: https://www.amankumarx1.xyz/`. Unencrypted traffic is blocked and upgraded.
- **Port 443 (HTTPS):** Open. Returns `HTTP/1.1 200 OK`. Responds with Vercel edge node header `X-Vercel-Id: bom1::259gf-1792850563558-a2d3799ca336`.
- **Non-Web Ports:** Excluded by policy. Masscan and SYN port sweeps against `76.76.21.164` were prohibited.
- Raw Evidence: [`raw-output/network/reachability.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/raw-output/network/reachability.txt)

### 4.3 TLS Negotiation
- Handshake negotiation using native Windows Schannel completed successfully.
- Protocol negotiated: TLS 1.2 / TLS 1.3 with ALPN `http/1.1`.
- Raw Evidence: [`raw-output/network/tls_handshake.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/raw-output/network/tls_handshake.txt)

---

## 5. Web Application Findings

### 5.1 Confirmed Findings Summary
| Finding ID | Title | Category | Severity | CVSS v3.1 | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-WEB-001** | Missing Content-Security-Policy (CSP) Header | Insecure Headers | **MEDIUM** | 5.4 | Confirmed Vulnerability |
| **SEC-WEB-002** | Server Banner Information Disclosure (Vercel) | Info Disclosure | **LOW** | 2.6 | Confirmed Observation |
| **SEC-WEB-003** | Wildcard Access-Control-Allow-Origin on HTML | Insecure CORS | **LOW** | 3.7 | Confirmed Observation |

### 5.2 Detailed Finding Descriptions

#### [SEC-WEB-001] Missing Content-Security-Policy (CSP) Header
- **Affected URL:** `https://www.amankumarx1.xyz/`
- **Severity:** Medium (CVSS 5.4 — `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N`)
- **Observation:** Full response header audit revealed no `Content-Security-Policy` header.
- **Impact:** In the event of a Cross-Site Scripting (XSS) vulnerability in user input or third-party dependencies, modern browsers cannot restrict script origins or prevent data exfiltration.
- **Remediation:** Add a CSP header in `vercel.json`:
  ```json
  {
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
          }
        ]
      }
    ]
  }
  ```
- **Evidence:** [`evidence/missing_csp_evidence.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/evidence/missing_csp_evidence.txt)

#### [SEC-WEB-002] Server Banner Information Disclosure
- **Affected URL:** `https://www.amankumarx1.xyz/`
- **Severity:** Low (CVSS 2.6 — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`)
- **Observation:** Server responds with `Server: Vercel` and internal POP identifier `X-Vercel-Id: bom1::...`.
- **Impact:** Discloses underlying cloud architecture, assisting attackers in targeting provider-specific behavior.
- **Remediation:** Suppress or normalize the Server header where permissible.
- **Evidence:** [`evidence/vercel_edge_headers.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/evidence/vercel_edge_headers.txt)

#### [SEC-WEB-003] Overly Permissive Wildcard Access-Control-Allow-Origin
- **Affected URL:** `https://www.amankumarx1.xyz/`
- **Severity:** Low (CVSS 3.7 — `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N`)
- **Observation:** Server responds with `Access-Control-Allow-Origin: *` on top-level HTML requests.
- **Impact:** While benign on a static portfolio, setting wildcard CORS on HTML document roots creates risk if authenticated session features are added later.
- **Remediation:** Restrict CORS headers to public assets or API paths rather than the root document.
- **Evidence:** [`evidence/cors_wildcard_evidence.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/evidence/cors_wildcard_evidence.txt)

### 5.3 Verified Positive Security Controls
- **Strict-Transport-Security (HSTS):** `max-age=63072000; includeSubDomains; preload` (2-year preload readiness).
- **X-Frame-Options:** `DENY` (Full clickjacking prevention).
- **X-Content-Type-Options:** `nosniff` (MIME sniffing blocked).
- **Permissions-Policy:** Sensitive browser APIs (camera, microphone, geolocation, payment) restricted.
- **Referrer-Policy:** `strict-origin-when-cross-origin` enforced.

---

## 6. Active Directory & Identity Assessment

### 6.1 Applicability Assessment
- **Target Applicability:** **NOT APPLICABLE**.
- **Rationale:** The target `https://www.amankumarx1.xyz/` is a public web application running on Vercel's multi-tenant Edge network. It does not possess an Active Directory domain controller, LDAP directory, Kerberos realm, or SMB infrastructure.
- **Policy Enforcement:** In strict compliance with the Master Prompt instructions: **No fake domain objects, mock users, or simulated attack paths were generated.**

### 6.2 Offline Parser & Evidence Pipeline Verification
DualSurf's internal BloodHound JSON ingestion engine, cryptographic evidence logging, and statistics extractors were verified against test fixtures in the unit test suite:
- **Test Suite:** [`tests/unit/ad-identity.test.js`](file:///c:/D%20Drive/Aman/DualSurf/tests/unit/ad-identity.test.js) (9 / 9 passed).
- **Verified Capabilities:**
  - Parsing BloodHound v4 and CE v5 JSON collections.
  - Automatic SHA-256 evidence fingerprint generation.
  - Extraction of Users, High-Privilege Users, Computers, Groups, Trusts, and GPOs.
  - Registration in [`SecurityEvidenceStore`](file:///c:/D%20Drive/Aman/DualSurf/apps/cli/src/securityEvidenceStore.ts).
- Raw Evidence: [`raw-output/identity/bloodhound_fixture_test.json`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/raw-output/identity/bloodhound_fixture_test.json)

---

## 7. DualSurf Integration Findings

The audit evaluated DualSurf's implementation across its terminal, CLI, Electron main process, preload security bridge, and renderer UI:

1. **PTY Terminal & Working Directory Resolution:**
   - **Status:** **VERIFIED SECURE**.
   - Terminal sessions default to user home directory (`$HOME` / `os.homedir()`).
   - Virtual script stubs in [`main.ts`](file:///c:/D%20Drive/Aman/DualSurf/apps/desktop/electron/main.ts) provide honest diagnostics when tools are not installed.

2. **Electron Security Boundaries & Context Isolation:**
   - **Status:** **VERIFIED SECURE**.
   - Context isolation is strictly enabled (`contextIsolation: true`).
   - No direct `nodeIntegration` is exposed to web pages.
   - All IPC channels validate input arguments and return sanitized JSON data.

3. **Rules of Engagement (RoE) Authorization Gates:**
   - **Status:** **VERIFIED SECURE**.
   - The SharpHound Collection Wizard requires explicit user confirmation of written authorization before staging commands into the terminal.
   - DualSurf CLI commands (`ds ad environment`, `ds ad report`) track scope confirmation.

4. **Full Regression Test Suite:**
   - **Status:** **337 / 337 tests passed (0 failures)** across 102 suites.
   - Raw Evidence: [`evidence/test_suite_execution_summary.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/evidence/test_suite_execution_summary.txt)

---

## 8. Comprehensive Command Catalogs

Detailed command references with complete option sets, syntax guides, and scope labels are documented in dedicated catalog files:
- **Network Reconnaissance:** [`command-catalog/network-tools.md`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/command-catalog/network-tools.md) (Nmap, Wireshark, TShark, Netcat, Ncat, Masscan)
- **Web Application Testing:** [`command-catalog/web-tools.md`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/command-catalog/web-tools.md) (Burp Suite, OWASP ZAP, Browser Developer Tools, ffuf)
- **Active Directory Assessment:** [`command-catalog/identity-tools.md`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/command-catalog/identity-tools.md) (BloodHound, SharpHound, Impacket, NetExec)

---

## 9. Evidence Index

| Evidence Artifact | Description | Location |
| :--- | :--- | :--- |
| `EVD-DNS-01` | Raw DNS lookup results for target and apex | [`raw-output/network/dns_lookup.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/raw-output/network/dns_lookup.txt) |
| `EVD-TLS-01` | Raw TLS handshake & Schannel ALPN output | [`raw-output/network/tls_handshake.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/raw-output/network/tls_handshake.txt) |
| `EVD-PORT-01` | HTTP (80) and HTTPS (443) reachability log | [`raw-output/network/reachability.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/raw-output/network/reachability.txt) |
| `EVD-HEADERS-01` | Complete HTTP response headers | [`raw-output/web/http_response_headers.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/raw-output/web/http_response_headers.txt) |
| `EVD-REDIRECT-01` | Port 80 to 443 redirect chain output | [`raw-output/web/redirect_chain.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/raw-output/web/redirect_chain.txt) |
| `EVD-CSP-MISSING-01`| Missing Content-Security-Policy evidence | [`evidence/missing_csp_evidence.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/evidence/missing_csp_evidence.txt) |
| `EVD-VERCEL-EDGE-01`| Server banner disclosure evidence | [`evidence/vercel_edge_headers.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/evidence/vercel_edge_headers.txt) |
| `EVD-CORS-WILDCARD-01`| Wildcard CORS origin evidence | [`evidence/cors_wildcard_evidence.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/evidence/cors_wildcard_evidence.txt) |
| `EVD-TEST-SUMMARY-01`| Full test suite 337/337 passing results | [`evidence/test_suite_execution_summary.txt`](file:///c:/D%20Drive/Aman/DualSurf/reports/security-assessment-2026-10-24/evidence/test_suite_execution_summary.txt) |

---

## 10. Prioritized Remediation Plan

### Phase 1: High Priority (Remediate within 14 days)
1. **Implement Content-Security-Policy [SEC-WEB-001]:** Deploy a restrictive CSP header in `vercel.json` defining trusted script, style, and font sources.

### Phase 2: Medium Priority (Hardening within 30 days)
2. **Scope CORS Headers [SEC-WEB-003]:** Remove `Access-Control-Allow-Origin: *` from root HTML responses, applying it only to dedicated public API or asset routes.
3. **Suppress Server Headers [SEC-WEB-002]:** Where possible, strip or normalize the `Server: Vercel` banner to reduce infrastructure reconnaissance.

### Phase 3: Toolkit Environment Recommendations
4. **Install Missing Tool Binaries:**
   - On Windows: Run `winget install Insecure.Nmap`, `winget install WiresharkFoundation.Wireshark`, and `pip install impacket netexec`.
   - On Linux/WSL: Run `sudo apt update && sudo apt install -y nmap tshark ncat ffuf bloodhound python3-impacket netexec`.

---

## 11. Limitations & Unperformed Tests

- **Shared Vercel Infrastructure:** Broad port sweeps and Masscan asynchronous scanning were prohibited to avoid impacting third-party tenant infrastructure.
- **Active Directory Assessment:** The target is a static public portfolio website, not an Active Directory domain; live directory collection was excluded.
- **Missing CLI Tools:** Tools not found on the host system were marked `NOT INSTALLED` without simulation or fabricated output.

---

## 12. Safe Reproducibility Instructions

All executed observations and evidence can be safely reproduced using standard command-line tools:

```bash
# 1. Reproduce DNS Resolution
nslookup www.amankumarx1.xyz

# 2. Reproduce HTTP to HTTPS Redirect
curl.exe -I -s -S http://www.amankumarx1.xyz/

# 3. Reproduce HTTPS Response Headers & Validate Missing CSP
curl.exe -I -s -S https://www.amankumarx1.xyz/

# 4. Reproduce TLS Handshake Details
curl.exe -vI --max-time 10 https://www.amankumarx1.xyz/

# 5. Reproduce DualSurf Unit & Integration Test Suite
npm test
```
