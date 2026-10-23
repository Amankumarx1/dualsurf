# DualSurf Blue Team Operations Architecture

## 1. System Overview and Mission

DualSurf is an enterprise cybersecurity browser and terminal operating platform designed for defensive security practitioners, SOC analysts, detection engineers, and incident responders.

DualSurf provides two complementary operational modes:
1. **Browser Mode:** Clean graphical interface for navigating target web applications, cloud consoles, SIEM dashboards, and interactive HTML audit reports.
2. **Terminal Mode:** A genuine, evidence-grounded terminal interface enabling analysts to run authorized defensive tools, query local telemetry, triage security logs, and preserve cryptographic chain-of-custody evidence.

---

## 2. The Non-Negotiable Accuracy Requirement

Unlike simulated dashboards or probabilistic LLM interfaces that fabricate synthetic command outputs, DualSurf adheres to a **Zero-Hallucination Policy**:

1. **Never Fabricate Output:** If a tool is not installed on the host system, DualSurf reports `NOT_INSTALLED` with installation guidance. It will **never** manufacture fake stdout/stderr or pretend a tool ran.
2. **One Source of Truth:** Every finding, metric, alert, and timeline entry is grounded in raw stdout/stderr collected directly from host processes, event logs, or live DNS queries.
3. **Explicit Evidence States:** Every finding and execution record carries a mandatory evidence state:
   - `VERIFIED` — Directly proven by collected tool output or cryptographically checked data.
   - `OBSERVED` — Observed in telemetry but not independently verified.
   - `CORRELATED` — Corroborated across multiple independent evidence sources.
   - `ANALYST_REVIEW` — Potential finding awaiting human validation.
   - `INFERRED` — Analytical interpretation, clearly differentiated from direct observation.
   - `UNKNOWN` — Insufficient telemetry to reach a conclusion.
   - `NOT_TESTED` — No collection or test was performed.
   - `NOT_INSTALLED` — Required binary not found on host.
   - `NOT_CONFIGURED` — Integration exists but lacks credentials/configuration.
   - `PERMISSION_DENIED` — Operation blocked by OS access controls.
   - `FAILED` — Command executed but failed (non-zero exit code).
   - `TIMED_OUT` — Process exceeded execution timeout.
   - `PARTIAL` — Incomplete telemetry collected.
4. **Evidence-Linked Summaries:** Any AI-assisted summary or correlation must explicitly cite valid, stored evidence IDs (`EVD-...`). AI cannot invent evidence IDs or fabricate telemetry.

---

## 3. Platform Architecture

```text
DualSurf Operating Platform
├── apps/
│   ├── desktop/
│   │   ├── electron/main.ts           # Privileged broker, child process isolation, IPC router
│   │   └── src/components/terminal/   # Terminal Console, Command Sidebar, Registry
│   └── cli/
│       ├── src/index.ts               # CLI command dispatcher & terminal runner
│       └── src/tools/
│           ├── executionEngine.ts     # Controlled process runner, argument validation, tool discovery
│           ├── evidenceStore.ts       # Persistent, SHA-256 hashed evidence repository
│           ├── blueTeam.ts            # 13 Operational Pillars, catalog, metrics, workflow
│           └── shellExecutor.ts       # Host PATH audit & tool inspection
└── packages/
    ├── shared-types/                  # Typed interfaces across Electron, CLI, and Renderer
    └── storage/                       # Durable metadata and session storage
```

### Component Responsibilities:
- **Electron Main Process:** Manages system-level child processes, enforces permission checks, manages Unix domain socket/IPC, and dispatches terminal commands.
- **Controlled Execution Engine:** Validates command arguments against injection schemas, prevents arbitrary shell concatenation, enforces timeouts, captures stdout/stderr, and redacts credentials.
- **Security Evidence Store:** Maintains immutable, disk-backed JSON records of raw outputs, computed SHA-256 integrity hashes, parsed findings, and telemetry source coverage. Persists across application restarts.
- **Blue Team Knowledge & Workflow Engine:** Encapsulates the 13 Operational Pillars, 200+ tool reference catalog, 6-phase operational lifecycle, role personas, and 12 core SOC metrics.

---

## 4. Multi-Source Telemetry Coverage

DualSurf explicitly records the coverage level of every investigation:
- **Endpoint Logs:** Process creations, DLL modules, registry autoruns, open sockets.
- **Network Logs:** Zeek connection metadata, Suricata alerts, packet captures.
- **DNS Logs:** Live resolver queries, SPF/DKIM/DMARC records.
- **Cloud Audit:** CloudTrail, Azure Activity, GCP Audit logs.
- **Identity Logs:** Authentication failures, sign-in locations, privileged role assignments.

If an investigation only has access to endpoint logs, DualSurf explicitly reports the missing sources (e.g., `Missing: dnsLogs, cloudAudit`) and refrains from asserting that the entire system is clean.
