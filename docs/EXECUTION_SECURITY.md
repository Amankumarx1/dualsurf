# DualSurf Execution Security & Process Isolation

## 1. Safe Process Invocation

DualSurf strictly avoids executing unvalidated shell strings or invoking `/bin/sh` or `cmd.exe` on arbitrary user input.

All tool executions:
1. Pass through `isArgumentSafe()` to verify that arguments do not contain shell metacharacters:
   - Semicolons (`;`)
   - Double ampersands (`&&`)
   - Pipes (`|`)
   - Backticks (`` ` ``)
   - Dollar command substitution (`$()`)
   - Redirection characters (`<`, `>`)
2. Use structured argument arrays (`execFile` / `spawn`) where arguments are passed directly to the operating system's process table without intermediate shell expansion.

---

## 2. Resource Limits and Timeouts

To prevent hung background processes and resource exhaustion:
- **Default Execution Timeout:** 60 seconds for recon probes; 120 seconds for web and port scans.
- **Max Output Stream Buffer:** 2MB stdout/stderr per process execution.
- **Process Cleanup:** Upon timeout or user cancellation (`SIGINT`), DualSurf terminates child processes and cleans up temporary execution artifacts.

---

## 3. Secret Redaction Policy

DualSurf scrubs credentials and tokens before persisting evidence, displaying terminal logs, or compiling assessment reports:
- Bearer tokens (`Bearer [a-zA-Z0-9_\-\.]+`) -> `Bearer [REDACTED]`
- AWS Access Keys (`AKIA[0-9A-Z]{16}`) -> `[REDACTED_AWS_KEY]`
- Private Keys (`-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----`) -> `[REDACTED_PRIVATE_KEY]`
- Basic Auth credentials in URLs (`https://user:password@host`) -> `https://user:[REDACTED]@host`
- Session cookies (`PHPSESSID=...`, `JSESSIONID=...`) -> `[SESSION_TOKEN_REDACTED]`

---

## 4. Controlled Lab Frameworks Policy

Exploit-capable frameworks (such as Metasploit Framework) are restricted by policy:
- Must have an approved scope profile with `environment: 'lab'`.
- Must require explicit operator confirmation before launch.
- Automatic payload deployment, persistence establishment, and uncontrolled post-exploitation chaining are disabled by default.
