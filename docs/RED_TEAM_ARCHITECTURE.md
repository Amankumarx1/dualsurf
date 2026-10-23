# DualSurf Red Team Operations Terminal: System Architecture

## 1. Overview and Core Philosophy

DualSurf Red Team Operations Terminal is a dual-mode, Linux-centric security operations workstation designed for authorized penetration testers, offensive security consultants, and adversary emulation teams. It integrates a conventional Chromium-based web browser with a terminal-driven offensive testing platform.

The core design principle is **Zero-Fabrication & Evidence Provenance**:
- DualSurf reports strictly what host-installed tools, live DNS records, and real network socket probes observe.
- Uninstalled tools are reported truthfully as `NOT_INSTALLED` with exit code 127, official documentation links, and platform-specific installation instructions.
- Empty scanner results are never misinterpreted as proof of security.
- Out-of-scope executions are blocked at the trusted backend broker before any process spawns or network packet transmits.

---

## 2. Multi-Tier System Topology

DualSurf follows a segregated multi-tier architecture to enforce least-privilege execution:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GUI LAYER (Electron Renderer)                   │
│  - Black-and-white minimalist interface with monospace typography       │
│  - Assessment dashboard, RoE scope manager, Findings & Evidence Viewer │
│  - Web Browser Tab Controller & In-page Security Inspectors            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (contextBridge / preload)
┌───────────────────────────────────▼────────────────────────────────────┐
│                  ELECTRON MAIN PROCESS & PROCESS RUNNER                │
│  - Window lifecycle, WebContents management, Host Shell Broker         │
│  - Command line validation & DUALSURF_DIRECT_COMMANDS dispatch         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Node.js Child Process / CLI
┌───────────────────────────────────▼────────────────────────────────────┐
│                    DUALSURF CLI & EXECUTION BROKER                     │
│  apps/cli/src/tools/redTeam.ts & apps/cli/src/tools/executionEngine.ts │
│                                                                        │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Backend Scope Manager  │  │ Tool Center & Registry               │  │
│  │ - Exact domain match   │  │ - 40+ cataloged Red Team tools       │  │
│  │ - Subdomain checks     │  │ - PATH & alias discovery             │  │
│  │ - IPv4 CIDR matching   │  │ - Safe execution with argument arrays│  │
│  │ - Exclusion priorities │  │ - Zero-fabrication error handling    │  │
│  │ - Expiry window check  │  └──────────────────────────────────────┘  │
│  └───────────┬────────────┘                                            │
│              │                                                         │
│  ┌───────────▼────────────┐  ┌──────────────────────────────────────┐  │
│  │ Assessment Store       │  │ Evidence Store & Integrity Ledger    │  │
│  │ - RoE profile linkage  │  │ - SHA-256 raw output hashing         │  │
│  │ - Environment tiers    │  │ - 15 standardized evidence states    │  │
│  │ - Findings linkage     │  │ - cURL PoCs & CVSS v3.1 scoring      │  │
│  └────────────────────────┘  └──────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Safe Process Spawning (execFile)
┌───────────────────────────────────▼────────────────────────────────────┐
│                  HOST OPERATING SYSTEM & SECURITY TOOLS                │
│  - Nmap, Subfinder, Amass, Nuclei, ZAP, sqlmap, Trivy, ffuf, etc.      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Seven Operational Pillars

DualSurf organizes Red Team capabilities into 7 structured operational pillars:

1. **Reconnaissance and OSINT:** Domain discovery, certificate transparency enumeration, passive DNS resolution (`subfinder`, `amass`, `theHarvester`, `httpx`).
2. **Network and Infrastructure Scanning:** Controlled port enumeration, banner grabbing, service identification (`nmap`, `naabu`, `rustscan`, `masscan`).
3. **Web Application & API Security:** Automated vulnerability scanning, directory fuzzing, SQL injection testing (`nuclei`, `zap`, `ffuf`, `feroxbuster`, `sqlmap`).
4. **Identity & Privilege Escalation:** Domain trust auditing, Windows/Linux privilege inspection, service protocol auditing (`bloodhound`, `impacket`, `netexec`, `powershell`).
5. **Cloud & Container Security:** Infrastructure-as-code audits, Kubernetes configuration scanning, container image vulnerability scans (`prowler`, `scoutsuite`, `trivy`, `checkov`).
6. **Adversary Emulation & MITRE ATT&CK:** Detection coverage scorecards, atomic test executions, blue team validation (`mitre`, `atomic`, `caldera`).
7. **Evidence, Reporting & Retesting:** Cryptographic evidence persistence, CVSS v3.1 scoring, reproducible cURL PoC generation, and live finding retesting.

---

## 4. Evidence State Machine

DualSurf standardizes 15 explicit statuses across storage, CLI, and reporting:

- `VERIFIED`: Directly observed and corroborated by collected output.
- `OBSERVED`: Reported by an automated scanner, awaiting independent analyst validation.
- `VALIDATED`: Corroborated using an approved secondary validation method.
- `CORRELATED`: Supported by multiple distinct evidence records.
- `ANALYST_REVIEW`: Requires human verification.
- `INFERRED`: Derived interpretation from indirect signals.
- `UNKNOWN`: Insufficient evidence to determine status.
- `NOT_TESTED`: Check was not performed.
- `OUT_OF_SCOPE`: Prohibited by assessment scope boundaries.
- `NOT_INSTALLED`: Binary not detected on host PATH.
- `NOT_CONFIGURED`: Missing required credentials or API configuration.
- `PERMISSION_DENIED`: Blocked by local system permissions.
- `FAILED`: Execution terminated with non-zero exit code or process error.
- `TIMED_OUT`: Exceeded configured timeout duration.
- `PARTIAL`: Incomplete execution or truncated output.
