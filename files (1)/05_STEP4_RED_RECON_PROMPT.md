# Step 4 Prompt: Red Team Recon Pack

> Read `01_PROJECT_CONTEXT.md` first. Steps 1 to 3 must be finished. This step depends heavily on the scope manager and audit log from Step 1.

## Your task

Build `plugins/red-recon`: reconnaissance for **authorised** engagements, with scope enforcement and auditing as the defining feature, not an afterthought. Start with passive techniques, then add a safe adapter layer for well-known external tools. DualSurf wraps and constrains these tools; it does not replace them.

## Phase 0: Inspect and plan

1. Review the scope manager and the registry's scope-required path from Step 1.
2. Report how you will handle: target expansion (CIDR to hosts), DNS resolution rechecks, and the engagement profile described below. Then continue.

## Engagement profile (build first)

An engagement is a named record the user creates before any active command can run:

- name, notes, the scope rules in force (allow and deny; reuse the scope manager), an optional time window (start and end), a global rate limit (requests per second) and a maximum concurrency;
- commands `engagement.new`, `engagement.list`, `engagement.use`, `engagement.show`, `engagement.close`;
- exactly one engagement is active at a time. **Active commands refuse to run when no engagement is active, or outside its time window.** Passive commands (those that touch only third-party public data or captured traffic) work without one;
- every audit row written while an engagement is active includes the engagement name in its detail so reports can filter by it;
- closing an engagement locks it (no further active commands) and keeps its audit history.

## Scope rules specific to this step

- Every active command is scope-required and declares **all** targets it will touch.
- **DNS recheck:** when a target is a hostname, resolve it just before acting. If it resolves to an address that is not in scope, refuse, unless the user explicitly added that address (or its range) to scope. This blocks a domain that points to someone else's infrastructure. Re-resolve at execution time, not only at validation time, and again for each redirect hop.
- **CIDR and ranges:** expand a range target and check that the whole range is in scope. Refuse partial overlaps.
- Refuse private, loopback and link-local addresses **unless** the user's scope explicitly includes them (internal engagements are legitimate, but nothing may be implicit).
- No command may take a "skip scope" flag. There is no override.

## Passive commands (no engagement needed, no packets to the target)

| Command | What it does |
|---|---|
| `dns.lookup` | A, AAAA, MX, NS, TXT, CNAME, SOA via the system resolver (queries go to the user's resolver, not the target) |
| `certs.crtsh` | Certificate-transparency lookup for a domain, deduplicated names |
| `subdomain.passive` | Combine certificate-transparency names with DNS resolution; report which names resolve |
| `tech.fingerprint` | Identify technologies from **captured** headers, cookies, HTML meta tags and script paths (use the Step 2 traffic store); no new requests |
| `whois.lookup` | Registration data via a public service |

Third-party lookups still send the queried domain to that third party. Apply the same consent approach as `intel.lookup` in Step 3 (first use confirmation, and a per-service on/off setting).

## Active commands (engagement active, scope-required, rate-limited, audited)

| Command | What it does |
|---|---|
| `web.probe` | Fetch the root page, `robots.txt`, `sitemap.xml` and `/.well-known/security.txt` of an in-scope host; report status and headers (single request each) |
| `web.paths` | Check a **user-supplied** list of paths against one in-scope host with strict rate limiting |
| `port.check` | TCP connect check for a short, explicit list of ports on in-scope hosts (no raw packets; connect only) |
| `tool.run` | Run an allow-listed external tool through the adapter layer (see below) |

Do not ship large wordlists, credential lists or default payload sets. Wordlists are always supplied by the user.

## Tool adapter layer

Design one adapter interface and implement adapters for **nmap, ffuf, nuclei and whatweb** (each optional; the user installs them).

For every adapter:

- **Discovery:** locate the binary (user-configured path first, then PATH), report its version, and refuse to run an unknown or unconfigured binary.
- **Argument allow-list:** the adapter accepts structured options and builds the argument array itself. Only allow-listed flags exist; the user can't append raw arguments. Block flags that disable safety, read arbitrary files for execution, or write outside the engagement's output folder.
- **No shell, ever.** Spawn with an argument array. Never join arguments into a string. Never put target values, page content or file contents into a command line in a way that could be parsed as a flag (use a separator before targets and reject targets starting with a dash).
- **Targets come only from scope-checked, DNS-rechecked values.** The adapter receives validated hosts; it never receives free text.
- **Limits:** a timeout, a maximum output size, a concurrency cap, and the engagement's rate limit mapped to each tool's rate option. If a tool can't honour the rate limit, refuse to run it.
- **Dry run:** a `--dry-run` option prints the exact executable and argument array that would run, and runs nothing. Use it in the GUI as a "preview" step before every run.
- **Output:** parse the tool's structured output (for example, XML or JSON) into a normalised findings list (host, port, service, finding title, severity if provided, evidence). Keep the raw output in the engagement's output folder with owner-only permissions.
- **Cancellation:** every run can be cancelled; cancellation kills the whole process tree.
- **Nuclei specifics:** templates are supplied by the user; do not auto-update or auto-download templates from within DualSurf. Disable any template categories that involve brute force by default.

## Output and reporting

- Store normalised findings in SQLite (new tables) linked to the engagement.
- Commands `findings.list`, `findings.show`, `findings.export` (Markdown or JSON) that never include raw credentials or tokens.
- The Step 3 case commands should be able to attach findings (provide the glue; don't duplicate the case system).

## GUI requirements

- **Red Team workspace** preset: Traffic and Repeater panels (Step 2), an Engagement bar (active engagement, scope summary, time window, rate limit), a Recon panel (passive results), and a Tool Runner (pick a tool, fill structured options, **mandatory preview of the exact command**, run, live output, cancel).
- Out-of-scope or no-engagement states must be shown clearly with the reason, not as a generic error.

## Security rules for this step

- No command may bypass the registry's scope check. Test this by trying to register a command that does its own network call and confirming the structure gives it no way around the rules.
- All target and tool inputs are untrusted; validate strictly with zod and reject anything unexpected.
- Never log credentials found in responses; redact before storing.
- Active commands from a plugin require the right permission (`network:read`; `filesystem` only for the engagement output folder).

## Tests to write

- active commands refuse with no engagement, outside the time window, or after closing;
- out-of-scope host refused; hostname resolving outside scope refused (fake the resolver); hostname that re-resolves to a different address between validation and execution is refused;
- partial CIDR overlap refused; private/loopback refused unless explicitly in scope;
- redirect hops are rechecked;
- rate limiter enforces the limit under concurrency;
- adapters: arguments are an array, never a string; targets starting with a dash are rejected; unknown flags rejected; dry run runs nothing; timeouts and cancellation kill the process tree; output size cap enforced (use a fake binary for tests);
- output parsers produce normalised findings from sample tool output;
- audit rows include the engagement name.

## Acceptance (manual)

1. Without an engagement: `web.probe` on a lab host fails with a clear message.
2. Create and activate an engagement with a lab target in scope. `web.probe` works; the same command against another host is refused with a scope error and a `denied` audit row.
3. Point a hostname you control at an out-of-scope address and confirm the DNS recheck refuses it.
4. Run a tool through the adapter with `--dry-run`, confirm the printed argument list, then run it for real against the lab target and see normalised findings.
5. Close the engagement and confirm active commands stop working but the audit history remains.

## Do not

- Do not add exploit modules, payloads, credential attacks, evasion options, or ways to disable scope.
- Do not download tools, templates or wordlists automatically.
- Do not accept raw command-line strings from the user or from page content.

## Report back

Use the context file's report format. Also list each adapter's allow-listed options, the defaults for rate and concurrency limits, and any tool whose rate limit you could not map.
