# Step 3 Prompt: Blue Team and SOC Pack

> Read `01_PROJECT_CONTEXT.md` first. Steps 1 and 2 must be finished and their tests green.

## Your task

Build the blue-team and SOC analysis pack in `plugins/blue-soc`: passive analysis of what the browser sees, IOC handling, optional threat-intel lookups, and a case workspace for notes, timeline and reporting. Most of this is **passive** (it analyses captured traffic or pasted data) and needs no scope. Anything that sends data to a third party needs explicit user consent.

## Phase 0: Inspect and plan

1. Review the Step 2 traffic store and events, and the existing `headers.analyze` placeholder.
2. Report which commands you will build in which order, and how you will store cases (see below). Then continue.

## Commands

Build in this order. Each is a plugin command with a zod schema, field descriptions, and tests.

| Command | What it does | Permissions |
|---|---|---|
| `headers.analyze` (rewrite) | Analyse the **captured** response headers for a traffic entry or the active tab's main document, instead of making a new request. Keep the Step 1 checks, severities and scoring so results stay comparable. Add: `Cross-Origin-*` headers, `Set-Cookie` handoff to the cookie audit, and information-leak headers (`Server`, `X-Powered-By` with versions). If no captured response exists, say so. Do not fall back to making a request. | `network:read` |
| `cookies.audit` | For captured `Set-Cookie` headers and the tab's cookies: flag missing Secure, HttpOnly, SameSite, overly broad Domain/Path, long lifetimes on session-like names. | `network:read` |
| `tls.inspect` | Certificate subject, issuer, validity dates, days to expiry, SANs, key type, protocol and cipher where available, and chain problems. Read from the connection the tab already made. | `network:read` |
| `url.analyze` | Static analysis only, **no network**: punycode and mixed-script homograph detection, lookalike distance against a user-supplied brand list, URL length and entropy, excessive subdomains, IP-literal hosts, suspicious TLDs, known shorteners, embedded credentials, encoded redirects. Produce a risk score and the reasons. | none |
| `ioc.extract` | Extract IPs (v4 and v6), domains, URLs, emails, hashes (MD5, SHA-1, SHA-256) and common CVE ids from page text, a captured body, or pasted input. Deduplicate; support **defanged** input (such as `hxxp`, `[.]`) and refanging; output typed lists with counts. | none |
| `intel.lookup` | Look up an IOC with enabled providers (VirusTotal, URLhaus, AbuseIPDB, urlscan.io, AlienVault OTX to start). Normalise each provider's answer into one shape: verdict, confidence, tags, first/last seen, link. | `network:read`, `storage` |
| `keys.set` / `keys.list` / `keys.delete` | Manage provider API keys. Keys live in Electron `safeStorage`. `keys.list` shows only provider names and whether a key is set; nothing ever echoes a key. | `storage` |
| `case.new` / `case.list` / `case.show` | Create and view investigation cases. | `storage` |
| `case.note` | Add a note to a case. | `storage` |
| `case.attach` | Attach evidence (a traffic entry, an IOC set, an analysis result) to a case. | `storage` |
| `case.tag` | Tag a case or item with MITRE ATT&CK technique ids from a bundled static list. | `storage` |
| `case.timeline` | Show events in time order. | `storage` |
| `case.export` | Export a case as a Markdown report with timeline, evidence summary and IOCs. | `filesystem` |

## Privacy and consent rules for `intel.lookup`

- **Off by default per provider.** The user enables each provider once, and the setting is stored.
- Before the first lookup of a session, show what will be sent (the IOC value only, never page content, cookies or headers) and to whom. In the CLI, require `--yes` or an interactive confirmation; in the GUI, a confirm dialog.
- For URLs and domains, send only the value the user asked about. Never auto-submit captured traffic.
- Cache results (default 24 hours) and respect each provider's rate limits with a simple per-provider limiter and backoff. Show rate-limit and quota errors clearly.
- Offline mode: if the user disables all providers, `intel.lookup` returns a clear "no providers enabled" message instead of failing.
- Providers are adapters behind one interface so adding another provider doesn't touch the command.

## Case storage

- Cases, notes, attachments and tags in SQLite via the storage package (new tables, migrations).
- Attachments store references plus a small snapshot, not whole traffic bodies.
- A case belongs to the local user only. Include a command to delete a case and everything in it.

## GUI requirements

- A **SOC workspace** preset that opens: Traffic panel, a Findings panel (results of header, cookie, TLS and URL analysis for the current tab, refreshed as traffic arrives), an IOC panel (extracted IOCs with "look up" actions and consent prompts), and a Case panel (timeline and notes).
- Every action in these panels is just a command call; nothing is implemented in the renderer.
- Findings must be sortable by severity and exportable into the open case.

## Security rules for this step

- No command here may send data anywhere without the consent rules above.
- API keys never appear in logs, audit rows, command output, error messages or exported reports.
- Treat page content, headers and provider responses as untrusted: escape when rendering; never evaluate or execute them.
- Bundled data files (TLDs, shorteners, ATT&CK ids) are static assets with a documented update procedure; don't download them at runtime.

## Tests to write

- `headers.analyze` on captured data gives the same findings as Step 1 for the same headers, and never makes a network request;
- cookie audit flags each missing attribute correctly;
- `url.analyze` catches a punycode homograph, an IP-literal host, embedded credentials and an encoded redirect, with no network calls (assert this);
- `ioc.extract` handles defanged input, deduplicates, and doesn't extract hashes of the wrong length;
- `intel.lookup` refuses without consent and with all providers disabled; caches; backs off on rate limits (use fake provider adapters);
- keys never appear in `keys.list` output, audit rows or error messages;
- case commands create, tag, attach, timeline and export; the exported Markdown contains no secrets.

## Acceptance (manual)

1. Browse a test site that sets weak cookies and lacks security headers. Run `headers.analyze` and `cookies.audit` from the CLI and compare with the Findings panel.
2. Paste a block of text containing defanged URLs and hashes into `ioc.extract` and check the results.
3. Enable one provider with a test key, run `intel.lookup` on a known-benign test indicator and confirm that the consent prompt appeared first.
4. Create a case, attach findings and IOCs, tag a technique, and export the Markdown report.
5. Run `audit.tail` and confirm none of the entries contain keys.

## Do not

- Do not make network requests from `url.analyze`, `ioc.extract` or the case commands.
- Do not upload files or page content to any provider.
- Do not ship API keys or put them in config files.

## Report back

Use the context file's report format. Also list the providers implemented, the cache and rate-limit defaults, and the data files bundled.
