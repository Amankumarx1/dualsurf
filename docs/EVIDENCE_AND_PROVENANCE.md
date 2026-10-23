# DualSurf Evidence Store & Provenance Tracking

## 1. Principles of Defensive Evidence Preservation

Digital forensic investigations and legal proceedings depend on unshakeable chain-of-custody and evidence integrity. DualSurf treats every command execution, log ingestion, and network query as a potential piece of forensic evidence.

### Core Provenance Guarantees:
1. **Raw Output Preservation:** DualSurf stores unmodified stdout and stderr. Parsed findings are derived representations and never replace the original raw output.
2. **Cryptographic SHA-256 Hashing:** Upon process completion or network collection, DualSurf immediately calculates a SHA-256 hash across the raw output stream.
3. **Traceable Evidence IDs:** Every record receives a stable identifier formatted as `EVD-<timestamp>-<shortHash>`.
4. **Separation of Fact and Inference:** Observations directly recorded from tools are marked `VERIFIED` or `OBSERVED`. Analyst interpretations are marked `INFERRED`. Findings needing validation are marked `ANALYST_REVIEW`.
5. **Persistence Across Reboots:** Evidence records are written to durable storage (`~/.dualsurf/evidence/`) and reloaded automatically upon launching DualSurf.

---

## 2. Evidence Record Schema

Every evidence entry in the DualSurf Evidence Store satisfies the `SecurityEvidenceRecord` specification:

```typescript
export interface SecurityEvidenceRecord {
  id: string;                  // e.g. "EVD-1792226770431-30fad0e2"
  executionId: string;         // e.g. "EXEC-DNS-1792226770431"
  toolId: string;              // e.g. "email-dns", "osquery", "wireshark"
  toolName: string;            // e.g. "Email Security DNS Analyzer"
  toolVersion?: string;        // Detected version string
  executablePath?: string;     // Binary path on host system
  target?: string;             // Host, domain, IP, or log file analyzed
  commandExecuted: string;     // Redacted command string executed
  executedAt: string;          // ISO 8601 start timestamp
  completedAt: string;         // ISO 8601 completion timestamp
  durationMs: number;          // Total execution elapsed time
  exitCode: number;            // Process exit code (0 = success)
  stdout: string;              // Raw standard output
  stderr: string;              // Raw standard error
  state: EvidenceState;        // VERIFIED, OBSERVED, FAILED, NOT_INSTALLED, etc.
  integrityHash: string;       // SHA-256 hash of stdout + stderr
  parsedFindings: any[];       // Structured JSON findings extracted by parser
  limitations?: string;        // Any collection or parsing limitations
  sourceCoverage?: {           // Telemetry source completeness
    endpointLogs: boolean;
    networkLogs: boolean;
    dnsLogs: boolean;
    cloudAudit: boolean;
    identityLogs: boolean;
    missingSources: string[];
  };
}
```

---

## 3. Working with Evidence in Terminal

### Listing Evidence:
```bash
dualsurf blue evidence list
```

### Inspecting Detailed Provenance:
```bash
dualsurf blue evidence show EVD-1792226770431-30fad0e2
```

### Exporting Full Untruncated Archive:
```bash
dualsurf blue evidence export EVD-1792226770431-30fad0e2 raw > evidence_dump.txt
dualsurf blue evidence export EVD-1792226770431-30fad0e2 json > evidence_dump.json
```
