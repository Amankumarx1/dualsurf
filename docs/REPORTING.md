# DualSurf Red Team Assessment Reporting Engine

## 1. Multi-Format Report Generation

DualSurf features a native reporting engine producing technical and executive reports directly from verified findings, collected evidence, and Rules of Engagement scopes.

Supported output formats:
- **Markdown (`markdown`)**: Clean, GitHub-flavored markdown report suitable for Git-based delivery and client documentation.
- **HTML (`html`)**: Self-contained, styling-embedded executive report featuring DualSurf's black-and-white visual identity, monospace typography, and severity scorecards.
- **JSON (`json`)**: Structured, schema-validated dataset containing assessment profiles, scope boundaries, severity metrics, CWE mappings, findings, and evidence digests for SIEM/SOAR/DefectDojo ingestion.

---

## 2. Report Structure and Sections

Every report contains five mandatory sections:

### Section 1: Scope and Authorization Boundaries
- Client organization and assessment name.
- Rules of Engagement identifier and approval status.
- Authorized in-scope domains and wildcard subdomain policy.
- Authorized IP ranges and CIDR subnets.
- Explicit exclusions list.
- Testing window and emergency contact references.

### Section 2: Executive Risk Summary & Scorecard
- High-level vulnerability distribution table (Critical, High, Medium, Low, Informational).
- Remediation SLA timelines (e.g. 24h for Critical, 7d for High).
- Overall engagement risk classification.

### Section 3: Verified Vulnerabilities & Reproducible Proof-of-Concepts
For each recorded finding:
- Title, severity, CVSS v3.1 score, and CWE classification.
- Affected in-scope asset.
- Technical vulnerability description.
- Demonstrated business impact.
- Copy-pasteable reproducible cURL PoC.
- Prescriptive remediation recommendations.

### Section 4: Evidence Provenance & Cryptographic Integrity Ledger
- Table listing evidence records linked to findings.
- Source tool, target, exit code, and execution state.
- SHA-256 cryptographic digest proving that the evidence has not been altered.

### Section 5: Assessment Limitations & Non-Destructive Methodology Disclaimer
- **Zero-Fabrication Contract:** Acknowledges that all findings originate from actual executions and live probes.
- **Negative Inference Disclaimer:** Explains that an empty scanner result indicates that no signatures were triggered under that specific test configuration—not that the target is completely secure.
- **Safe Testing Constraints:** Certifies that DoS, data destruction, and unauthorized secondary target tests were avoided.

---

## 3. Generating Reports via CLI

```bash
# Generate Markdown report to stdout
dualsurf red report ASSESS-2026-001 markdown

# Generate HTML report and pipe to file
dualsurf red report ASSESS-2026-001 html > report.html

# Generate structured JSON archive
dualsurf red report ASSESS-2026-001 json > report.json
```
