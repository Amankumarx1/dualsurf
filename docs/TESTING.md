# DualSurf Automated Testing & Verification Suite

## 1. Overview

DualSurf incorporates a comprehensive, multi-layer automated test suite executed via Node.js's native test runner (`node --test`).

Testing verifies:
- Backend scope enforcement (exact domains, wildcard subdomains, CIDRs, explicit exclusions, and expiry).
- Argument safety validation to prevent command injection.
- Truthful tool detection across installed and uninstalled states (Zero-Fabrication Contract).
- Real network socket auditing, live certificate transparency discovery, and passive DNS resolution.
- Cryptographic evidence persistence and SHA-256 integrity calculation.
- Reproducible cURL PoC generation and CVSS v3.1 scoring.
- Multi-format report compilation (Markdown, HTML, JSON).
- Live finding retesting and state transitions.

---

## 2. Running Automated Tests

```bash
# Run the entire test suite across all 217+ test cases
npm test

# Run the dedicated Red Team Scope & Execution Security test suite
node --test tests/unit/redTeamScope.test.js

# Run the 7 Red Team Pillars test suite
node --test tests/unit/redTeamPillars.test.js

# Run the offensive career and roadmap knowledge base test suite
node --test tests/unit/red-team.test.js
```

---

## 3. Test Coverage Breakdown

| Test Suite | File | Focus Areas |
|---|---|---|
| **Red Team Scope & Security** | `tests/unit/redTeamScope.test.js` | Backend scope enforcement, CIDR math, exclusion priorities, expiry, argument sanitization, tool auditing, report generation |
| **7 Operational Pillars** | `tests/unit/redTeamPillars.test.js` | Pillar definitions, host tool discovery, real OSINT/DNS enumeration, socket port auditing, local privilege review, finding retesting |
| **Red Team Operations & Purple Team** | `tests/unit/red-team.test.js` | 32-domain knowledge base, 25-skills checklist, RoE creation, finding store, Purple team emulation matrix, 6-month study plan |
| **Perimeter Port Scanning** | `tests/unit/port-scan.test.js` | Real TCP socket connection testing, service fingerprinting, banner grabbing |
| **Attack Surface & Hygiene** | `tests/unit/attack-surface.test.js` | Certificate transparency harvesting, secret scanning (AWS keys, JWTs), passive security auditing |
| **Live Controller Regression** | `tests/unit/regression.test.js` | URL normalization, safe handling of WebContents, in-page search |
