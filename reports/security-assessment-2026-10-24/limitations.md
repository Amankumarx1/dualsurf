# Assessment Limitations & Environmental Constraints

This document details the operational constraints, unperformed tests, and technical boundaries encountered during the security assessment of `https://www.amankumarx1.xyz/` and the DualSurf security toolkit.

---

## 1. Target Scope & Architecture Constraints

1. **Shared Multi-Tenant CDN Infrastructure:**
   - The target hostname `www.amankumarx1.xyz` resolves via CNAME to Vercel's global edge network (`cname.vercel-dns.com` -> `76.76.21.164`, `66.33.60.34`).
   - These IP addresses are multi-tenant edge nodes routing traffic for hundreds of thousands of independent websites.
   - Performing broad port sweeps, aggressive banner grabs, or running Masscan against these shared IPs would violate ethical testing boundaries and probe infrastructure outside the authorized tenant scope.

2. **Absence of Active Directory Domain:**
   - The target website is a static HTML5/CSS3/JavaScript portfolio application.
   - It does not host a Windows Domain Controller, LDAP directory, Kerberos Key Distribution Center (KDC), or SMB file shares.
   - Live Active Directory collection (SharpHound), relationship analysis (BloodHound), and Windows protocol inspection (Impacket, NetExec) are **NOT APPLICABLE** to this web target.
   - DualSurf's AD parser and evidence mechanisms were verified via offline test fixtures in `tests/unit/ad-identity.test.js`.

---

## 2. Host Tool Installation Constraints

The host machine running DualSurf is Windows 11 Enterprise (`win32` x64). During the Phase 2 audit:
1. **Installed & Verified:**
   - Browser Developer Tools (Built-in Chromium Engine, Chrome 130.0 / Electron 33.0).
   - Java Runtime Environment (Microsoft OpenJDK 21.0.12.1).
   - Python 3 Runtime (Python 3.13.14).
   - DualSurf Native HTTP Repeater, Proxy Router, and CLI (`@dualsurf/cli`).
2. **Missing from Host PATH:**
   - Nmap, Wireshark, TShark, Ncat, Netcat, Masscan.
   - Burp Suite, OWASP ZAP, ffuf.
   - BloodHound, SharpHound, Impacket (Python module not in pip), NetExec.
3. **Handling of Missing Tools:**
   - In accordance with the Master Prompt instructions: **No tool versions or scan outputs were fabricated or simulated.** Missing tools were truthfully identified as `NOT INSTALLED` in the inventory matrix and DualSurf's UI/CLI.
   - Detailed installation instructions for each platform (winget, apt, brew) and complete option references are provided in the Command Catalog.

---

## 3. High-Impact & Destructive Testing Policies

1. **Masscan:** Excluded by policy (`NOT RUN — explicit infrastructure scope and rate approval required`).
2. **Denial-of-Service (DoS):** Aggressive stress testing and concurrent connection exhaustion were strictly prohibited.
3. **Data Modification:** No write operations or state modifications were performed against the target server.
