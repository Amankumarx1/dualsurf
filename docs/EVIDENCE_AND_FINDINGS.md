# DualSurf Evidence Provenance & Findings Management

## 1. Cryptographic Evidence Integrity

Every tool execution in DualSurf produces an immutable evidence record stored in `~/.dualsurf/evidence.json`.

For each execution, DualSurf records:
- **`id`**: Unique execution identifier (`EXEC-<timestamp>-<hash>`).
- **`assessmentId`**: Linked assessment profile (`ASSESS-2026-001`).
- **`target`**: Exact target hostname, IP, or URL tested.
- **`toolId` / `toolName`**: Originating security tool (e.g., `NMAP`, `SUBFINDER`, `NUCLEI`).
- **`commandExecuted`**: Complete command arguments with credentials and secrets redacted.
- **`executedAt` / `completedAt`**: ISO timestamps of process start and finish.
- **`durationMs`**: Measured execution duration.
- **`exitCode`**: Process exit code (or 127 for missing tool).
- **`stdout` / `stderr`**: Raw process output streams (kept strictly unmodified).
- **`integrityHash`**: Cryptographic SHA-256 digest calculated directly over `stdout + "\n" + stderr`.
- **`state`**: Standardized status (`VERIFIED`, `OBSERVED`, `VALIDATED`, `OUT_OF_SCOPE`, `NOT_INSTALLED`, etc.).
- **`parsedFindings`**: Normalized findings mapped to CWE identifiers and CVSS v3.1 scores.

---

## 2. Findings Schema and Risk Scoring

Findings are persisted in `~/.dualsurf/findings.json`:

```typescript
export interface PentestFinding {
  id: string; // FIND-<year>-<num>
  title: string;
  affectedAsset: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  cvssScore: number; // 0.0 to 10.0
  cweId: string; // e.g. CWE-89, CWE-79, CWE-287
  description: string;
  impact: string;
  remediation: string;
  curlPoc?: string; // Reproducible cURL command
  evidenceIds: string[]; // Linked cryptographic evidence
  status: 'Open' | 'Retested' | 'Remediated' | 'Accepted Risk' | 'False Positive';
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Reproducible cURL Proof-of-Concepts

To ensure that reported vulnerabilities can be corroborated by defense teams and stakeholders, DualSurf automatically generates reproducible cURL Proof-of-Concept commands for web findings.

Example:
```bash
# Generated reproducible PoC for FIND-2026-001
curl -s -k -X GET "https://127.0.0.1:8080/api/v1/user?id=1' UNION SELECT username,password FROM users--" \
  -H "Accept: application/json" \
  -H "User-Agent: DualSurf-Audit/1.0"
```

---

## 4. Live Finding Retesting (Pillar 7)

DualSurf includes automated retesting capability to confirm remediation:
```bash
# Retest a finding against the live affected asset
dualsurf red findings verify FIND-2026-001
# or
dualsurf red retest FIND-2026-001
```

Retest operations probe the affected asset's socket or endpoint, record a new evidence record, and update the finding status to `Retested` or `Remediated`.
