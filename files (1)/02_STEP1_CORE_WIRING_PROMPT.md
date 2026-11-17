# Step 1 Prompt: Core Wiring

> Read `01_PROJECT_CONTEXT.md` first and follow its rules.

## Your task

Turn the DualSurf skeleton into a working core. At the end, one command (`headers.analyze`) must run identically from the GUI and from the CLI. It must pass through validation, scope checks and auditing, and be reachable by the standalone CLI over a secured local socket.

## Phase 0: Inspect before you build

1. Read the existing packages (`core`, `controller`, `ipc-protocol`, `storage`, `shared-types`, `apps/desktop`, `apps/cli`).
2. Write a short report: what already exists, what is missing compared to this spec, and how you will map the tab controller to the `BrowserHost` interface.
3. If code matching this spec already exists, **audit it against the spec and fix the gaps** instead of rewriting it.
4. Then continue without waiting, unless you are blocked by a decision only I can make (in that case ask one clear question).

## Phase 1: `packages/ipc-protocol`

- **Wire format:** JSON-RPC 2.0, one JSON message per line, UTF-8. The decoder must handle multi-byte characters split across chunks, reject invalid JSON, and refuse messages over 4 MB.
- **Methods:** `auth` (params: token), `commands.list`, `commands.execute` (params: command id and input).
- **Error codes:** exactly the table in the context file.
- **Command summary** (returned by `commands.list`): id, title, description, category, owner (core or plugin id), scope-required flag, positional argument names, and a field list (name, type, optional flag, description).
- **GUI bridge types:** a result envelope (either ok with data, or not ok with an error object) and a bridge interface with two functions: execute a command and list commands.
- **Paths:**
  - Runtime directory: on Linux/macOS use the XDG runtime dir (or a per-user folder under the temp dir); on Windows use a per-user folder under LOCALAPPDATA. Allow an environment variable to override it (used by tests).
  - Unix socket file and token file live in that directory. On Windows use a named pipe whose name includes the username and a short hash of the runtime directory.
  - Provide a check that the runtime directory is a real directory (not a symlink), owned by the current user, with no group/other permissions. Both the server and the client must call it. It protects against another local user pre-creating the folder to hijack the socket.

## Phase 2: `packages/core`

### Types and errors
- Command definition fields: id, title, description, category (network, audit, recon, inspection, malware, intel, system), zod input schema, optional positional names, optional scope-required flag, optional target-extraction function, and a run function that receives validated input and a context.
- Command context: caller, host, event bus, logger, an assert-in-scope function (accepts one or several targets), and the plugin API (null for core commands).
- Plugin command definitions are the same, but the context always has the plugin API.
- Typed errors (not found, validation with per-field issues, scope, permission, unauthorised) carrying the stable codes. A serialiser turns any thrown value into a plain error object and never leaks stack traces.

### Browser host
- Interface: kind (electron or headless), list tabs, get active tab, and a fetch function that can optionally target a tab's session.
- Provide a headless implementation: no tabs, plain global fetch.

### Event bus
- Typed publish/subscribe. A handler that throws must not affect other handlers; log it.
- Events: command started, command finished (id, caller, ok, milliseconds), scope changed, plugin loaded, plugin unloaded, traffic request, traffic response (the last two are emitted in Step 2; define their payload types now).
- Subscribing returns an unsubscribe function.

### Scope manager
Behaviour is the most important part of this step. Implement exactly this.

| Rule form | Example | Matches |
|---|---|---|
| Domain | `example.com` | that exact host only, **not** subdomains |
| Wildcard | `*.example.com` | subdomains at any depth, **not** the apex |
| IP | `10.0.0.5`, an IPv6 address | that address (IPv6 normalised) |
| CIDR | `10.0.0.0/24` | IPv4 addresses in the range |

- Rules are trimmed and lower-cased. Reject (with a clear message) anything with a scheme, path, whitespace, `?`, `#` or `@`; the bare `*`; wildcards whose suffix has no dot (like `*.com`); malformed IPs; and CIDRs with prefix shorter than /8.
- Hostname extraction from a target: accept full URLs, `host:port`, or bare hosts. Use standard URL parsing so punycode and odd IP forms are normalised. Strip IPv6 brackets and a trailing dot. If parsing fails, the target is not allowed.
- Decision order: deny rules first, then allow rules. An empty allow-list denies everything. A decision reports allowed or not, the reason, the extracted host and the matching rule.
- The traps to defend against: `example.com.evil.net` must not match `example.com`; `http://example.com@evil.net/` must resolve to host `evil.net`.
- Persistence: JSON file `scope.json` in the data directory, written atomically with owner-only permissions, loaded at start. Emit the scope-changed event on every change.
- Methods: list, add (to allow or deny), remove, check (returns the decision), is-allowed, assert-allowed (throws the scope error).

### Audit log
- Stored in its **own SQLite file** (`audit.db` in the data directory), separate from the app database.
- Columns: id, timestamp (ms), caller, command, outcome, input (JSON text), detail (text), previous hash, hash.
- Outcomes: started, ok, error, denied, invalid.
- Hash chain: the hash of each row is SHA-256 over the previous row's hash plus that row's timestamp, caller, command, outcome, input and detail, joined with a separator. The first row's previous hash is 64 zeros.
- Database triggers must abort UPDATE and DELETE on the table.
- Redaction before storing: keys matching pass/password, secret, token, api key, authorization, cookie or credential become the text `[redacted]`; strings over 2000 characters are truncated with a marker; arrays are capped at 100 items; nesting depth is capped at 6; bigint becomes a string; functions and undefined become null. Detail text is capped at 1000 characters.
- Methods: log, tail (last N rows), verify (recompute the chain, return ok flag, number checked and the id of the first broken row).
- Define a small sink interface so tests can use an in-memory sink; the SQLite sink is the default.

### Command registry
- Registration rules:
  - id must be lowercase `group.action` (letters and digits, dots between parts; hyphens allowed after the first part's start).
  - Namespaces `system.`, `scope.`, `audit.`, `plugins.` are reserved for owner "core".
  - **Duplicate ids throw.** No silent overwrite.
  - A scope-required command must provide a target-extraction function, or registration throws.
- Execution pipeline, in this order:
  1. Unknown id leads to the not-found error.
  2. Validate input with the zod schema (an undefined input counts as an empty object). On failure, write an `invalid` audit row and throw a validation error listing each field problem.
  3. If scope-required, extract targets and assert each is in scope. On failure, write a `denied` audit row and rethrow.
  4. Write a `started` audit row. **If this write fails, do not run the command.**
  5. Run the command. Write `ok` or `error` (with message). A failure to write this final row is logged but doesn't change the command's outcome.
  6. Emit command started and finished events.
- Summaries: list every command with the summary fields above. Derive the field list from the zod schema: unwrap optional, default, nullable and transform wrappers, report each field's type name, optional flag and description.
- Support unregistering all commands of an owner (used when unloading a plugin).

### Plugin API and loader
- **Plugin manifest:** id (lowercase letters, digits, hyphens), name, semver version, permissions list, an activate function (receives an activation object with the plugin API and a register-command function) and an optional deactivate.
- **Loader:** validates id, version and that every permission is known; rejects duplicate plugin ids; activates; if activation throws, **roll back** every command it registered and its subscriptions, then rethrow. Unload calls deactivate (errors logged), unregisters the plugin's commands and disposes its subscriptions. Emit loaded/unloaded events. A plugin that fails to load at start-up must not stop the app or other plugins.
- **Plugin API capabilities:**

| Capability | Requires | Behaviour |
|---|---|---|
| network | `network:read` | fetch routed through the BrowserHost |
| intercept | `network:intercept` | handle supplied in Step 2; for now throws "not available yet" |
| storage | `storage` | small key-value store, one JSON file per plugin, atomic writes, owner-only permissions |
| files | `filesystem` | read/write/list/exists restricted to one per-plugin folder; reject path traversal and symlinks that escape the folder |
| events | none, except `traffic:*` events need `network:read` | subscriptions auto-removed when the plugin unloads |

  Accessing a capability without the permission throws the permission error naming the plugin and permission.

### Built-in commands (owner core)
| Command | Input | Output |
|---|---|---|
| `scope.list` | none | allow list and deny list |
| `scope.add` | pattern (positional), optional deny flag | normalised rule added and which list |
| `scope.remove` | pattern (positional) | whether something was removed |
| `scope.check` | target (positional) | the scope decision |
| `audit.tail` | count (positional, 1 to 500, default 20) | recent rows with ISO time (no hashes) |
| `audit.verify` | none | verify result |
| `plugins.list` | none | loaded plugins with permissions and command ids |

Provide a shared boolean zod helper that accepts true, false, "true" and "false" (CLI values arrive as strings; numbers use zod coercion).

### Core factory
A single async factory takes the host, data directory, optional plugin list, optional audit sink, optional interceptor and optional logger. It creates the data directory (owner-only), builds the event bus, scope manager, audit log, registry and plugin loader, registers built-ins, loads plugins, and returns an object with those parts, an execute function (id, input, caller) and a dispose function.

### IPC server (in core)
- Starts with the core and the private-directory check. Writes a fresh random 32-byte hex token to the token file (owner-only) on every launch; socket permissions owner-only on Unix.
- If the socket path is in use: probe it. If something answers, fail with "another instance is running". If not, remove the stale socket and retry.
- Per connection: the **first** message must be `auth`. Compare tokens in constant time. Close the connection if authentication hasn't happened within 5 seconds or if it fails. Process requests one at a time, in order.
- Validate every request shape; map errors to the shared codes; return `null` for commands that return nothing; protect against non-serialisable results by returning an internal error.
- Stop removes the socket and token files and closes live connections.

## Phase 3: `plugins/blue-soc` with `headers.analyze`

- Permission: `network:read`. Input: optional URL (defaults to the active tab's URL; if neither exists, fail with a clear message). Positional name: url.
- Makes a GET request without following redirects, reads only the headers and cancels the body.
- Checks and severity:

| Check | Severity | Notes |
|---|---|---|
| Strict-Transport-Security | high | only evaluated for https URLs |
| Content-Security-Policy | high | "weak" if it contains unsafe-inline, unsafe-eval or a wildcard |
| X-Frame-Options or CSP frame-ancestors | medium | clickjacking protection |
| X-Content-Type-Options = nosniff | medium | |
| Referrer-Policy | low | |
| Permissions-Policy | low | |

- Result: URL, status, score (0 to 100), findings (header, status ok/missing/weak, severity, note) and the raw headers with lower-cased names.
- Score: weights high 3, medium 2, low 1; a weak finding counts half; score is 100 times (1 minus lost weight divided by total weight), rounded.
- Add a clear comment that this makes its own request and is only a stand-in until Step 3 replaces it with captured traffic.
- Export a list of all blue-soc plugins for the app and CLI to load.

## Phase 4: `apps/cli`

- **Usage:** with no command it starts an interactive shell; with a command it runs once and exits. Global flags (accepted before the command name): `--json` for raw JSON output, `--headless` to run the core in-process, and `-h`/`--help`.
- **Transports:** one interface (mode, list commands, execute, close) with two implementations: attached (socket client) and headless (in-process core with the headless host, data folder from an environment variable or `~/.dualsurf`). Load the headless implementation lazily so attached mode never loads the SQLite native module.
- **Attached client:** check the private runtime directory, read the token, connect with a 3-second timeout, authenticate, match responses to requests by id, and fail all pending requests if the connection closes. If no instance is running, print a friendly message and exit with code 2.
- **Argument grammar:** tokenise with support for double quotes, single quotes and backslash escapes (error on unterminated quote). Accept `--key value`, `--key=value`, `key=value` (key must be a plain identifier so URLs with `=` aren't misread), and a bare `--flag` meaning true. Map leftover positionals to the command's declared positional names; extra positionals, or a value given both ways, is an error. Values stay strings, except values that look like a JSON object or array, which are parsed.
- **Shell:** built-ins `help` (grouped by category), `help <command>` (title, description, scope requirement, positionals, each field with type, optional flag and description), `list`, `clear`, `exit`/`quit`. Tab-complete command ids. Unknown commands suggest ones in the same group.
- **Output:** with `--json`, pretty JSON. Otherwise: scalars as text; arrays of flat objects as aligned tables with cells truncated at 60 characters; objects as key/value lines with nested sections indented; empty results shown as "(empty)" or "(no output)". Use light colour only when output is a terminal.
- **Errors:** print `error [code]: message`, and for validation errors list each field problem on its own line. Exit codes: 0 success, 1 command error, 2 connection or usage problem.

## Phase 5: `apps/desktop`

- **Host adapter:** implement the BrowserHost for Electron on top of the existing tab controller through a small "tab source" interface (list of tabs with id and web contents, and the active tab id). Network requests go through the tab's session so cookies, proxy and container isolation apply; fall back to the default session. This adapter is the only place that knows how the controller stores tabs.
- **Boot function:** after the shell window exists, create the core (data directory under the app's user-data folder), register two IPC handlers (`dualsurf:execute`, `dualsurf:list`) and start the IPC server. Provide a matching stop function that removes handlers, stops the server and disposes the core.
- **Sender check on every IPC call:** the caller must be the shell window's web contents, and the call must come from its main frame. Anything else is rejected.
- **Result envelope:** return ok with data, or not ok with a serialised error. Strip anything not structured-cloneable by round-tripping through JSON.
- **Preload:** sandbox-compatible (only the `electron` module may be required). Expose exactly two functions to the page (execute command, list commands). Never expose the raw IPC object. **Only the shell window uses this preload; tab views must not.**
- **Main process:** request the single-instance lock; on quit, delay quitting until the stop function finishes.
- **Renderer:** a small hook that runs a command by id, tracks loading, data and error state, and returns the run function. Add one example panel for `headers.analyze` (URL box, button, score, findings list, error line; blank URL means the active tab). Declare the bridge on the window type.

## Tests to write (automated)

**Scope**
- empty scope denies everything; exact domain works via URL; apex rule excludes subdomains; wildcard works with ports and depth but excludes the apex; deny beats allow; CIDR in and out of range; `example.com.evil.net` rejected; `http://example.com@evil.net/` rejected; `*`, `*.com` and `0.0.0.0/0` refused.

**Registry**
- in-scope scoped command runs; out-of-scope is blocked with the scope error; bad input gives a validation error; duplicate ids throw; a scope-required command without target extraction fails to register.

**Plugins**
- a plugin with no permissions cannot use the network capability (permission error); a plugin cannot register `scope.add` or any reserved name and the failed load leaves core commands intact; unloading removes its commands and subscriptions.

**Audit**
- denied attempts are recorded; a started row appears before execution; the chain verifies; a password field never appears in stored rows; UPDATE and DELETE are blocked; if triggers are dropped and a row edited, verify reports a broken chain; if the sink throws on the started write, the command does not run.

**IPC and CLI**
- socket and token files are owner-only; result over IPC equals the in-process result; commands.list works; scope violations come back as code -32001; wrong token rejected; unauthenticated request refused and connection closed; a real CLI process produces the same JSON as the core for `headers.analyze` (use a local HTTP server with no Date header); positional arguments work (`audit.tail 3`, `scope.check <url>`); scope errors and validation details print and exit non-zero.

## Acceptance (manual)

Run these in order and confirm each works. The results of 2 and 3 must be identical JSON.

1. Start the app. In the CLI: `scope.add example.com`.
2. CLI: `headers.analyze https://example.com`.
3. GUI panel: Analyze with the same URL.
4. CLI: `audit.tail 5`, and confirm rows show started and ok for the run.
5. CLI: `audit.verify`, and confirm `ok: true`.
6. CLI: `scope.add 0.0.0.0/0`, and confirm it is refused.
7. Stop the app, and confirm the socket and token files are gone.

## Do not

- Do not import Electron anywhere in `packages/core` or plugins.
- Do not give tab views the preload script.
- Do not add features beyond this spec (no traffic capture yet; that is Step 2).
- Do not store the IPC token anywhere except the private runtime directory.
- Do not weaken a rule to make a test pass; fix the code.

## Report back

Follow the "How to report back" section of the context file, and list every place where the existing controller forced you to deviate.
