# Step 2 Prompt: Traffic Capture, Interception and Repeater

> Read `01_PROJECT_CONTEXT.md` first. Step 1 must be finished and its tests green.

## Your task

Give DualSurf eyes on its own traffic. Capture every request and response from browser tabs, store them, let the user browse them, optionally pause and edit requests in flight (interception), and resend a captured request with changes (repeater). All of it must be commands that work from both GUI and CLI.

## Phase 0: Inspect and plan

1. Check how tabs and sessions are created in `packages/controller`: one session per tab, per container profile, or shared?
2. Check the existing `@dualsurf/storage` schema and migration approach.
3. Report your plan, including where capture hooks attach and how isolated container sessions are handled. Then continue.

## Design decisions (already made)

- **Passive capture** uses Electron's `session.webRequest` hooks. Electron allows only **one listener per event per session**, so capture registers those listeners once, centrally. Everything else (plugins, panels) learns about traffic through the event bus events `traffic:request` and `traffic:response`. Nothing else may register `webRequest` listeners.
- **Active interception** uses the Chrome DevTools Protocol through a tab's `webContents.debugger` and its Fetch domain (pause a request, then continue, modify or fail it). No MITM proxy, no root certificate installation, no system proxy changes.
- **Repeater** resends a stored request through the same tab session so cookies and container isolation apply.

## Capture requirements

- Attach to every session that tabs use, including newly created container or profile sessions. Detach cleanly when a session or tab goes away.
- Record per request: capture id, tab id, timestamp, method, URL, request headers, request body size (and the body when small and textual), resource type, and the initiator if available.
- Record per response: status, status text, headers, mime type, size, timing, redirect target, and a body **only on demand** (fetched through DevTools when the user opens or exports it, subject to a size cap and a content-type allow-list; never store binary bodies by default).
- Emit `traffic:request` and `traffic:response` events with the payload types defined in Step 1. Requests and responses are linked by capture id.
- Storage: new tables in `@dualsurf/storage` with indexes on timestamp, host and tab. Write in batches so heavy pages don't block the main process. Apply a retention policy (default: keep the last 50,000 entries or 7 days, whichever is smaller; configurable).
- Private/incognito containers: capture is **off** by default and can be switched on explicitly per container.
- Sensitive headers (`Authorization`, `Cookie`, `Set-Cookie` and any header matching the redaction rules) are stored in full (the repeater needs them) but **masked in default displays** in both GUI and CLI. Showing them needs an explicit flag or toggle.

## Interception requirements

- Per-tab toggle. While off, there must be zero DevTools Fetch interception and zero effect on page loads.
- While on: paused requests go into a queue visible to GUI and CLI. For each queued request the user can forward as is, forward with edits (method, URL, headers, body), or drop it.
- **Safety valves:** auto-forward after a configurable timeout (default 120 seconds) so a forgotten queue never hangs a page; a filter option "only intercept in-scope hosts"; clear everything when the tab closes or the user turns interception off.
- Handle the case where DevTools is already attached by the user: detect it, tell the user, and don't crash.
- Requires the plugin permission `network:intercept`; expose the interceptor to plugins only through the plugin API's `intercept` capability that Step 1 stubbed.
- Intercepting and editing is the user's own browser traffic, so it needs no scope; **resending** is different (see the repeater).

## Commands

| Command | Purpose | Scope-required? |
|---|---|---|
| `traffic.list` | filter by host, method, status, mime, tab, text search, time range; paginated | no |
| `traffic.show` | one entry in full (headers masked by default); optional body fetch | no |
| `traffic.clear` | delete entries (all, or by filter) | no |
| `traffic.export` | export a selection as a HAR file | no |
| `intercept.on` / `intercept.off` | toggle for a tab; options: scope-only, timeout | no |
| `intercept.queue` | list paused requests | no |
| `intercept.forward` | forward a queued request, with optional edits | no |
| `intercept.drop` | drop a queued request | no |
| `repeater.send` | clone a captured request, apply edits, send it, store the response with a link to the original | **yes**, target is the request URL's host |

Define each command with a zod schema, descriptions on every field, and positional names (for example, `traffic.show` takes the capture id). CLI output for lists must be a compact table (time, id, method, status, host, path, size).

## Repeater requirements

- The edited request must be shown back to the user before it is sent when run from the GUI; from the CLI a `--dry-run` flag prints the exact request without sending.
- Allow overriding method, URL, headers (set, remove) and body. Reject header edits that would make the request invalid and say why.
- Store the result as a new traffic entry flagged as a repeater run and linked to its original; offer a diff between two responses (status, headers, body size, and a body diff when textual).
- Rate-limit repeater sends (default one per 250 ms per host) to avoid accidental flooding.
- Follow redirects only if the user asks, and re-check scope on every redirect hop. A hop outside scope stops the chain with a scope error.

## GUI requirements (describe, don't over-design)

- **Traffic panel:** a table with live updates, filter bar, a detail pane (request and response, headers masked by default with a reveal toggle) and context actions (send to repeater, copy as curl, export HAR).
- **Intercept bar:** on/off switch, queue counter, and an editor to change then forward or drop.
- **Repeater panel:** editable request on the left, response on the right, history of runs, and a diff view.
- All of these only call commands through the bridge from Step 1.

## Security rules for this step

- No feature may disable scope for repeater sends.
- The capture database may contain secrets. Create it with owner-only permissions, never log bodies or sensitive headers, and provide a "clear all captured data" command.
- Treat captured content as untrusted data: when rendering in the GUI, escape it. Never render response bodies as HTML in the shell window.
- Cap memory: no unbounded queues, bodies or buffers.

## Tests to write

- one central listener per session (a second registration attempt is blocked or logged);
- capture records request and response and links them; events are emitted with correct payloads;
- sensitive headers masked by default and visible with the flag;
- retention trims old entries;
- interception: off means no pausing; on pauses; forward, edit-and-forward and drop each behave; timeout auto-forwards; closing the tab clears the queue;
- repeater: blocked for out-of-scope hosts; allowed in scope; redirect to an out-of-scope host stops with a scope error; dry-run sends nothing; the response is stored and linked;
- HAR export round-trips basic fields;
- CLI and GUI return the same data for `traffic.list` and `traffic.show`.

## Acceptance (manual)

1. Browse a few sites. `traffic.list` in the CLI shows them; the Traffic panel shows the same entries.
2. `intercept.on` on a tab, load a page, edit a header on one request, forward it, and confirm the edit reached the server (use a local test server that echoes headers).
3. Turn interception off and confirm pages load normally.
4. `scope.add` a local test host, then `repeater.send` a captured request with a changed parameter. Confirm the response is stored and a diff is available.
5. Try `repeater.send` to a host that isn't in scope and confirm the scope error and a `denied` audit row.

## Do not

- Do not install certificates, change system proxy settings, or run a separate proxy process.
- Do not register extra `webRequest` listeners outside the capture layer.
- Do not store binary response bodies by default.
- Do not give web pages any access to captured data.

## Report back

Use the report format from the context file. Also list the storage schema you created, the retention defaults you chose, and any session type you could not attach capture to.
