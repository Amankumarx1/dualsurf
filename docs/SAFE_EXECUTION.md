# DualSurf Safe Execution & Authorization Model

## 1. Defensive Philosophy and Risk Mitigation

DualSurf is primarily a defensive and observational platform. Its goal is to provide maximum visibility into systems and security telemetry while strictly preventing unintended disruption to production environments.

### Core Safety Safeguards:
1. **No Untrusted Shell Concatenation:** Process invocations use structured arguments passed directly to the operating system's process spawn API. Untrusted inputs are never interpolated directly into shell strings.
2. **Argument Safety Validation:** The Controlled Process Runner rejects command requests containing shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, `>`, `<`, newline characters) within argument tokens.
3. **Automatic Secret Redaction:** Tokens, passwords, AWS secret access keys, GitHub personal access tokens, and Authorization headers are automatically redacted with `***REDACTED***` before writing to logs, displaying in terminal, or persisting to the Evidence Store.
4. **Execution Timeouts & Resource Boundaries:** Every command has an enforceable timeout (default 25 seconds). If a process exceeds this limit, it is cleanly terminated and logged with state `TIMED_OUT`. Memory output buffers are capped at 2MB to prevent memory exhaustion.
5. **Approval Guardrails for Disruptive Actions:** Disruptive containment actions (firewall blocks, endpoint network isolation, process termination, account disabling) require explicit human approval via the `--approve` flag. DualSurf will never automatically execute disruptive responses proposed by heuristics or AI.

---

## 2. Authorization and Least Privilege

- **Read-Only Defaults:** Telemetry collection, log parsing, DNS queries, and file hashing operate in read-only mode by default.
- **Elevation Transparency:** When an operation requires administrative or root privileges (e.g. Sysmon configuration or raw packet captures), DualSurf explicitly notes the requirement and uses auditable workflows.
- **Dry-Run and Playbook Previews:** SOAR containment commands generate reversible, inspectable playbooks first (displaying exact `iptables`, `netsh advfirewall`, and DNS sinkhole rules alongside rollback commands) before any execution.
