# DualSurf Blue Team CLI Command Reference

This document provides complete syntax, subcommands, and examples for all Blue Team operational commands in DualSurf.

---

## 1. Blue Team Operations Overview

### `dualsurf blue status`
Display high-level operational status: installed tools count, missing tools, stored evidence records, active cases, and host OS.
```bash
dualsurf blue status
```

### `dualsurf blue pillars`
List the 13 Core Operational Pillars of Blue Team defense.
```bash
dualsurf blue pillars
```

### `dualsurf blue pillar <1-13>`
Inspect in-depth details, sub-tables of tools, investigation workflows, and CLI execution triggers for a specific pillar.
```bash
dualsurf blue pillar 1
dualsurf blue pillar 5
```

---

## 2. Tool Discovery & Catalog

### `dualsurf blue tools check`
Audit the local host system PATH and report which defensive security tools are actually installed and active.
```bash
dualsurf blue tools check
```

### `dualsurf blue tools info <tool-id>`
Inspect installation requirements, supported OS, binary name, and official documentation for any registered tool.
```bash
dualsurf blue tools info osquery
dualsurf blue tools info zeek
```

### `dualsurf blue catalog [search-query]`
Search the comprehensive reference library of 200+ Blue Team tools across 16 categories.
```bash
dualsurf blue catalog
dualsurf blue catalog splunk
dualsurf blue catalog forensics
```

---

## 3. Evidence Store Management

### `dualsurf blue evidence list`
List all cryptographic evidence records stored on disk with timestamps, source tools, and execution states.
```bash
dualsurf blue evidence list
```

### `dualsurf blue evidence show <evidence-id>`
Inspect full provenance, execution timestamps, duration, exit code, SHA-256 hash, and raw stdout/stderr for an evidence record.
```bash
dualsurf blue evidence show EVD-1792226770431-30fad0e2
```

### `dualsurf blue evidence export <evidence-id> [raw|json]`
Export untruncated evidence archive in raw text or structured JSON format.
```bash
dualsurf blue evidence export EVD-1792226770431-30fad0e2 json
```

---

## 4. Operational Workflows, Metrics & Roles

### `dualsurf blue workflow`
Display the continuous 6-phase Blue Team operational lifecycle (Collect, Detect, Triage, Contain, Recover, Improve).
```bash
dualsurf blue workflow
```

### `dualsurf blue day`
View detailed operational personas and typical daily schedules for Tier 1 SOC Analysts, Tier 2 Responders, Threat Hunters, and DFIR Analysts.
```bash
dualsurf blue day
```

### `dualsurf blue metrics`
Inspect the 12 core industry performance metrics (MTTD, MTTA, MTTR, False-positive rate, Detection coverage, etc.).
```bash
dualsurf blue metrics
```

### `dualsurf blue roadmap`
Display the 16-week structured Blue Team learning roadmap, 3 portfolio projects, and official documentation resources.
```bash
dualsurf blue roadmap
```

---

## 5. Direct Defensive Inspection Triggers

### `dualsurf dmarc <domain>`
Execute real live DNS queries to audit SPF, DKIM, and DMARC mail authentication.
```bash
dualsurf dmarc google.com
```

### `dualsurf edr`
Query live endpoint telemetry: active process table, memory usage, and listening TCP/UDP sockets.
```bash
dualsurf edr
```

### `dualsurf siem [logfile]`
Parse and analyze authentication and web access logs for brute-force attacks, SQL injection, path traversal, and web shells.
```bash
dualsurf siem /var/log/auth.log
```

### `dualsurf hunt [telemetry]`
Run the threat hunting engine to detect C2 beaconing, scanner signatures, and anomalous process execution.
```bash
dualsurf hunt
```

### `dualsurf hash <filepath>`
Compute cryptographic SHA-256, SHA-1, and MD5 hashes of a target file for chain of custody.
```bash
dualsurf hash sample.exe
```

### `dualsurf soar <action> <target>`
Generate automated containment playbooks (firewall rules, host isolation, DNS sinkhole) with rollback commands.
```bash
dualsurf soar block 198.51.100.42
dualsurf soar isolate 192.168.1.100
dualsurf soar sinkhole evil.com
```

---

## 6. Red Team Operations CLI Reference

DualSurf provides a unified, structured command interface for offensive operations under `dualsurf red` and direct command aliases.

### 6.1 Status and Overview
```bash
# View active assessments, authorized boundaries, tool discovery status, and findings
dualsurf red status
```

### 6.2 Rules of Engagement & Scope Management
```bash
# List all registered RoE scope profiles
dualsurf red scope list

# Show detailed boundaries, CIDRs, and exclusions for a scope
dualsurf red scope show ROE-2026-001

# Validate whether a target domain or IP is authorized
dualsurf red scope validate ROE-2026-001 127.0.0.1
dualsurf red scope validate ROE-2026-001 targetcorp.com
dualsurf red scope validate ROE-2026-001 excluded.targetcorp.com

# Create a new authorized scope profile
dualsurf red scope create "FinTech Audit Scope" --domains "fintech.internal" --ips "10.0.0.0/24"
```

### 6.3 Tool Discovery and Registry
```bash
# Audit the host system for all 40+ registered Red Team tools
dualsurf red tools check

# Inspect status, version, prerequisites, and install instructions for a tool
dualsurf red tools info nuclei
dualsurf red tools info nmap
dualsurf red tools info sqlmap
```

### 6.4 Assessment Management
```bash
# List tracked penetration testing assessments
dualsurf red assessment list

# Show detailed assessment profile, linked findings, and executions
dualsurf red assessment show ASSESS-2026-001

# Create a new assessment linked to an approved scope
dualsurf red assessment create "Q4 External Assessment" --scope ROE-2026-001 --client "Acme Corp"
```

### 6.5 Targeted Execution Engine
```bash
# Run reconnaissance against an in-scope target
dualsurf red recon run ROE-2026-001 --target targetcorp.com

# Run network service scanning against an in-scope IP/range
dualsurf red network run ROE-2026-001 --target 127.0.0.1

# Run web application audit against an authorized URL
dualsurf red web run ROE-2026-001 --target https://targetcorp.com
```

### 6.6 Findings and Reproducible PoCs
```bash
# List all recorded findings grouped by severity and validation status
dualsurf red findings list

# Show detailed finding breakdown with remediation and CWE details
dualsurf red findings show FIND-2026-001

# Inspect the reproducible cURL Proof-of-Concept command
dualsurf red findings poc FIND-2026-001

# Retest a finding against the live asset to confirm remediation
dualsurf red findings verify FIND-2026-001
```

### 6.7 Cryptographic Evidence Management
```bash
# List all evidence records with SHA-256 digests and execution states
dualsurf red evidence list

# Inspect full provenance, raw stdout/stderr, and exit code
dualsurf red evidence show <evidence-id>

# Export evidence archive in raw text or structured JSON
dualsurf red evidence export <evidence-id> json
```

### 6.8 Professional Report Compilation
```bash
# Generate evidence-backed technical and executive reports
dualsurf red report ASSESS-2026-001 markdown
dualsurf red report ASSESS-2026-001 html
dualsurf red report ASSESS-2026-001 json
```

### 6.9 Direct Security Tool Aliases
DualSurf routes commands directly when entered in the terminal:
```bash
# Recon & OSINT
dualsurf subfinder -d targetcorp.com
dualsurf httpx -u https://targetcorp.com -status-code -title
dualsurf dnsrecon -d targetcorp.com

# Network & Port Auditing
dualsurf nmap -sV -p 80,443 127.0.0.1
dualsurf naabu -host 127.0.0.1 -p 80,443,8080

# Web & API Assessment
dualsurf nuclei -u https://targetcorp.com -t cves/
dualsurf ffuf -u https://targetcorp.com/FUZZ -w wordlist.txt
dualsurf sqlmap -u "https://targetcorp.com/item?id=1" --batch

# Cloud & Containers
dualsurf checkov -d .
dualsurf trivy .
dualsurf prowler
```

