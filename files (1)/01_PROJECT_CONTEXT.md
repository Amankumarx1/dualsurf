# DualSurf: Project Context (read this first, every session)

## What DualSurf is

DualSurf is a desktop browser for cybersecurity practitioners. It has two equal front-ends over one headless core:

- **GUI mode:** a normal browser with security panels (traffic, repeater, inspectors, SOC workspace, malware workspace).
- **CLI mode:** a terminal (embedded in the GUI and as a standalone binary) where every feature is a command.

Users work in one of three workspaces: **Red Team** (authorised recon and testing), **Blue Team / SOC** (analysis and triage) and **Malware Analysis** (static triage in a safe environment). Each workspace is a preset that loads a set of plugins and a layout.

## Stack (already decided, don't change it)

- Electron 34, Node.js, TypeScript (strict), npm workspaces monorepo.
- GUI: React 19, Vite, Tailwind. Renderer runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Terminal in GUI: `@xterm/xterm` with `node-pty` over IPC.
- CLI: standalone Node binary in `apps/cli`. It can attach to a running DualSurf over a local socket or named pipe, or run headless.
- Storage: SQLite through `better-sqlite3` in `@dualsurf/storage`.
- Validation: `zod` (v3).

## Monorepo layout

- `packages/core`: headless engine (registry, scope, audit, plugins, event bus, IPC server).
- `packages/ipc-protocol`: wire format and shared types.
- `packages/controller`: Electron WebContentsView and tab lifecycle (existing).
- `packages/storage`: SQLite persistence (existing).
- `packages/shared-types`: shared domain types (existing).
- `apps/desktop`: Electron shell and React GUI.
- `apps/cli`: CLI frontend.
- `plugins/blue-soc`, `plugins/red-recon`, `plugins/static-malware`: feature packs.

Before changing anything, inspect what already exists and reuse it. Never create a second copy of something that already exists.

## Glossary

- **Command:** one feature, registered once, usable from GUI and CLI. Has an id like `headers.analyze` (lowercase, `group.action`), a title, a description, a category, a zod input schema, optional positional argument names, and a run function. Output must be JSON-serialisable.
- **Command registry:** the single place every command is executed from.
- **Plugin:** a package that declares an id, a semver version and a list of permissions, and registers commands when activated.
- **Permission:** one of `network:read`, `network:intercept`, `storage`, `filesystem`.
- **Scope:** the user's allow-list (and deny-list) of authorised targets: domains, wildcard domains, IPs, IPv4 CIDRs.
- **Audit log:** an append-only, hash-chained record of every command attempt.
- **BrowserHost:** the interface that tells core about tabs and performs network requests. Electron implements it; headless mode uses a stub.
- **Caller:** who triggered a command: `gui`, `cli` or `plugin`.

## Non-negotiable rules

1. **One execution path.** Every command from every caller goes through the registry's execute step: validate input, check scope, write "started" to the audit log, run, write the outcome. No frontend may bypass it.
2. **Features live in core or plugins, never in frontends.** The GUI and CLI only call commands and render results. If you are about to write feature logic in a React component or the CLI, stop and move it into a command.
3. **Commands never import Electron.** They use `BrowserHost` and the plugin API. This keeps headless mode working.
4. **Fail closed.** An empty scope allows nothing. If the audit log can't be written, the command doesn't run. Unknown input is rejected, not guessed.
5. **Active actions need scope.** Any command that sends its own network request to a target (as opposed to analysing traffic the user already generated) is marked scope-required and declares which target(s) it will touch.
6. **Plugins get capabilities, not the whole app.** A plugin receives only what its declared permissions allow, through the plugin API. Asking for anything else throws a permission error. This is capability discipline for first-party plugins, not a sandbox. Never document it as one.
7. **Never build shell strings.** When running external tools, spawn the executable with an argument array. No shell. No string interpolation of user, page, or network-derived data into a command line.
8. **Secrets stay secret.** API keys live in Electron `safeStorage`, never in plain config files, logs, audit rows or command output. Audit input is redacted for keys matching pass/password, secret, token, api key, authorization, cookie and credential.
9. **Downloaded files are never executed or auto-opened.** They go to a quarantine folder with no execute permission.
10. **Web content must never reach the command bridge.** Only the shell window gets the preload script. Tab views do not. The main process also verifies the sender of every command IPC call.
11. **Typed errors with stable codes.** Use the error table below everywhere (CLI, GUI and IPC).
12. **Strict TypeScript, no `any` in public APIs, zod for every input.** Add tests for every command.

## Product boundaries (what DualSurf must NOT include)

DualSurf is for authorised security work and defence. Do not build:

- exploit code, payload generators, or ready-to-run attack modules;
- malware, droppers, C2, packers, or anti-analysis or anti-detection features;
- credential brute-forcing or stuffing tools;
- anything that scans targets outside the user's declared scope, or ways to turn scope enforcement off.

Wrapping legitimate third-party tools (nmap, ffuf, nuclei, YARA and similar) behind scope enforcement and auditing is in scope. If a request would cross these lines, stop and tell the user.

## Error codes (shared by CLI, GUI and IPC)

| Code | Meaning |
|---|---|
| -32700 | Malformed JSON on the wire |
| -32600 | Invalid request shape |
| -32601 | Unknown command or method |
| -32602 | Invalid input (validation failed; details list each field) |
| -32603 | Internal error |
| -32000 | Command failed while running |
| -32001 | Scope violation |
| -32002 | Unauthorised (bad or missing IPC token) |
| -32003 | Permission denied (plugin lacked a permission) |

Stack traces never cross a process boundary.

## Conventions

- Command output: plain JSON objects and arrays, ISO-8601 timestamps, no class instances, no functions, no raw buffers (use hex or base64 strings).
- GUI and CLI must show the same data for the same command.
- Every command input field gets a zod `.describe()` text; it powers `help <command>` and the GUI forms.
- Long-running commands must support cancellation and have a timeout.
- Keep dependencies minimal and pin versions. Prefer Node built-ins.
- Write short comments that explain why, not what.

## How to report back

When a step is finished, end with: (1) files created or changed, (2) any place you deviated from the spec and why, (3) test results, (4) known gaps or risks. Don't claim something works unless you ran it.
