# DUALSURF — SECURITY TOOL INTEGRATION MATRIX & ADAPTER CATALOG

**Document Version:** 2.0  
**Target:** DualSurf Offensive Security Workspace & CLI Execution Engine  
**Classification:** Technical Tooling Catalog & Integration Specification  
**Date:** October 2026  

---

## 1. Overview & Integration Architecture

DualSurf uses a three-tier tool execution model designed around **Truthful Verification**:

1. **Tier 1 (Built-In In-Process Engines):** Pure Node.js and Electron native modules executing directly inside the application (e.g., Native Socket Port Scanner, In-Line Intercept Proxy, Passive Secret & Technology Profiler, Raw HTTP Repeater). These require no third-party binary installations.
2. **Tier 2 (Managed CLI Adapters):** Structured adapters for industry-standard CLI tools (e.g., Nmap, Sqlmap, Httpx, Nuclei, Subfinder, ffuf). DualSurf provides argument sanitization, scope boundary checks, automated execution timeouts, cancellation via SIGINT, structured output parsers, and SHA-256 evidence hashing.
3. **Tier 3 (Interactive PTY & Workstation Shell):** Unrestricted interactive terminal execution in the operator's choice of runtime (WSL 2 Kali/Ubuntu, Git Bash, Windows PowerShell). Supports long-running, interactive, and terminal-based tools (Metasploit `msfconsole`, `netexec`, `john`, `hashcat`, `wireshark`/`tshark`).

---

## 2. Comprehensive Tool Integration Matrix

### 2.1 Built-in Native Analyzers (Zero-Dependency)
| Tool / Engine | Purpose | Adapter Status | Parsing | Evidence Provenance | Rating |
|---|---|:---:|---|:---:|:---:|
| **In-Line Intercept Proxy** | Active HTTP/HTTPS interception, breakpoint queue, header tampering | Built-in | AST / Headers | TrafficStore | **10 / 10** |
| **HTTP Repeater** | Raw HTTP request crafting, replay, parameter tampering, cURL export | Built-in | Raw + JSON | FindingStore + PoC | **10 / 10** |
| **Passive Secret Scanner** | Scans web pages for AWS keys, JWTs, private keys, internal IPs | Built-in | Regex AST | SecurityAudit Report | **10 / 10** |
| **Tech & WAF Profiler** | Detects web frameworks, CMS, servers, and WAF signatures | Built-in | Signature Map | PageMetadata Drawer | **10 / 10** |
| **Perimeter Port Scanner** | Fast TCP connect & service banner grabbing across port profiles | Built-in | Structured Table | Audit Report | **9.5 / 10** |
| **RoE Scope Engine** | CIDR, wildcard domain, and exclusion boundary enforcement | Built-in | Engine Guard | AssessmentStore | **10 / 10** |

---

### 2.2 Reconnaissance & Perimeter Discovery
| Tool | Primary Purpose | Runtime Support | Detection Method | Parsing Status | Evidence Store | Rating |
|---|---|---|---|---|:---:|:---:|
| **Nmap** | Port scanning, OS fingerprinting, NSE scripts | WSL / Host Linux | `which nmap` | Structured Table + Raw | EvidenceStore | **9.5 / 10** |
| **Httpx** | Fast multi-purpose HTTP probe & technology grabber | Host PATH / WSL | `which httpx` | JSON Lines | TargetRecon Store | **9.5 / 10** |
| **Subfinder** | Fast passive DNS subdomain enumeration | Host PATH / WSL | `which subfinder`| Newline List | TargetRecon Store | **9.0 / 10** |
| **Amass** | In-depth OSINT, network mapping, ASN discovery | WSL / Host | `which amass` | Stdout Stream | EvidenceStore | **8.5 / 10** |
| **Naabu** | High-speed SYN/TCP port scanner | Host / WSL | `which naabu` | JSON Lines | EvidenceStore | **8.5 / 10** |
| **Masscan** | Asynchronous internet-scale port scanner | WSL (sudo) | `which masscan` | Binary / Text | EvidenceStore | **8.0 / 10** |
| **Katana** | Next-generation web crawler & spider | Host / WSL | `which katana` | JSON Lines | EndpointStore | **8.5 / 10** |
| **Dnsx** | Multi-purpose DNS toolkit & resolver | Host / WSL | `which dnsx` | JSON Lines | TargetRecon Store | **8.5 / 10** |

---

### 2.3 Web Application Assessment
| Tool | Primary Purpose | Runtime Support | Detection Method | Parsing Status | Evidence Store | Rating |
|---|---|---|---|---|:---:|:---:|
| **Sqlmap** | Automated SQL injection & database takeover | WSL / Host | `which sqlmap` | Raw Output + Findings | FindingStore | **9.5 / 10** |
| **Nuclei** | Fast template-based vulnerability scanner | Host / WSL | `which nuclei` | JSON / YAML | FindingStore + CWE | **9.5 / 10** |
| **ffuf** | High-speed web fuzzer and directory discovery | Host / WSL | `which ffuf` | JSON Output | EndpointStore | **9.0 / 10** |
| **Feroxbuster** | Recursive directory and content discovery | Host / WSL | `which feroxbuster`| Stdout / JSON | EndpointStore | **8.5 / 10** |
| **Gobuster** | URI, DNS subdomain, and vhost brute-forcing | Host / WSL | `which gobuster` | Plain Text | EndpointStore | **8.5 / 10** |
| **Nikto** | Web server vulnerability scanner | WSL / Host | `which nikto` | Plain Text / XML | EvidenceStore | **8.0 / 10** |
| **OWASP ZAP** | Web application vulnerability scanner & proxy | Host / WSL daemon | API / CLI | Alerts JSON Schema | FindingStore | **8.5 / 10** |
| **Burp Suite** | Web application proxy & security testing suite | Host / WSL GUI | XML Exporter | PortSwigger XML | ReportStore | **9.0 / 10** |
| **Arjun** | HTTP parameter discovery suite | WSL / Host | `which arjun` | JSON Output | EndpointStore | **8.0 / 10** |
| **Dalfox** | Parameter analysis & XSS scanner | Host / WSL | `which dalfox` | JSON Output | FindingStore | **8.5 / 10** |

---

### 2.4 Network, Packet Analysis & Sniffing
| Tool | Primary Purpose | Runtime Support | Detection Method | Parsing Status | Evidence Store | Rating |
|---|---|---|---|---|:---:|:---:|
| **TShark** | Terminal-based network packet analyzer | Host / WSL | `which tshark` | Text / PDML | EvidenceStore | **8.5 / 10** |
| **Wireshark** | Network protocol analyzer (GUI) | Host / WSL | Binary check | External Window | Desktop Bridge | **8.0 / 10** |
| **Tcpdump** | Command-line packet capture utility | WSL (sudo) | `which tcpdump` | PCAP / Text | EvidenceStore | **8.5 / 10** |
| **Zeek** | Network security monitoring & traffic analysis | WSL / Linux | `which zeek` | TSV Logs | BlueTeam Store | **8.0 / 10** |
| **Suricata** | High-performance Network IDS/IPS engine | WSL / Linux | `which suricata`| EVE JSON | BlueTeam Store | **8.0 / 10** |

---

### 2.5 Active Directory, Identity & Post-Exploitation
| Tool | Primary Purpose | Runtime Support | Detection Method | Parsing Status | Evidence Store | Rating |
|---|---|---|---|---|:---:|:---:|
| **NetExec (nxc)** | Network service exploitation & credential testing | WSL / Linux | `which nxc` | Colorized Text | FindingStore | **8.5 / 10** |
| **Impacket** | Network protocol manipulation (SMB/WMI/Kerberos)| WSL / Python | Python module | Stdout | EvidenceStore | **8.5 / 10** |
| **BloodHound CE**| Active Directory attack path graph analysis | Host / Container| Web UI / API | JSON Graph Export | AttackSurface Graph | **8.5 / 10** |
| **Hashcat** | World's fastest password hash cracker | Host / GPU | `which hashcat` | Potfile / Stdout | EvidenceStore | **8.5 / 10** |
| **John the Ripper**| Offline password auditing & hash cracking | WSL / Host | `which john` | Plain Text | EvidenceStore | **8.5 / 10** |
| **Responder** | LLMNR, NBT-NS, and MDNS poisoner & rogue server | WSL / Linux | `which responder`| Text Log | EvidenceStore | **8.0 / 10** |

---

### 2.6 Cloud, Container & Manifest Auditing
| Tool | Primary Purpose | Runtime Support | Detection Method | Parsing Status | Evidence Store | Rating |
|---|---|---|---|---|:---:|:---:|
| **Trivy** | Container, filesystem, and package vulnerability scan| Host / WSL | `which trivy` | JSON / Table | Pillar 5 Store | **9.0 / 10** |
| **Grype** | Vulnerability scanner for container images | Host / WSL | `which grype` | JSON Output | EvidenceStore | **8.5 / 10** |
| **Syft** | CLI tool for generating Software Bills of Materials | Host / WSL | `which syft` | CycloneDX / SPDX | EvidenceStore | **8.5 / 10** |
| **Checkov** | Infrastructure-as-Code (Terraform/K8s) scanner | Python / WSL | `which checkov` | JSON Output | EvidenceStore | **8.5 / 10** |
| **Kubescape** | Kubernetes security posture & compliance scanner | Host / WSL | `which kubescape`| JSON / Table | EvidenceStore | **8.0 / 10** |

---

## 3. Automated Discovery & Setup Commands

DualSurf provides direct operational commands to audit, discover, and configure these tools:

```bash
# 1. Audit all installed host and WSL tools across 7 operational pillars
dualsurf red tools check

# 2. Automatically probe and map binary paths in WSL 2 Linux
dualsurf kali discover

# 3. View official installation guidance and commands for missing tools
dualsurf red tools info <tool-name>

# 4. Generate automated setup script for WSL Kali Linux
dualsurf kali setup
```

---

## 4. Integration Quality Standards

Every integrated tool adapter in DualSurf satisfies four mandatory criteria:
1. **Zero Fake Outputs:** If a tool is not installed, DualSurf reports it as missing with installation guidance; it never outputs simulated or hardcoded data.
2. **Strict Scope Validation:** Targets are validated against active RoE boundaries before command execution.
3. **Execution Safety:** Arguments are validated through `validateArgumentSafety()` to reject command injection sequences.
4. **Cryptographic Provenance:** Raw outputs are hashed with SHA-256 and linked to assessment findings.
