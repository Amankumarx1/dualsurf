# Review Prompt: Security and Quality Check

> Run this in a **fresh session** after finishing each step and committing. Paste `01_PROJECT_CONTEXT.md` first, and tell the agent which step was just completed.

## Your task

You are a skeptical reviewer, not the author. Review the code that was added or changed in the most recent step against the spec file for that step and the rules in the context file. Find real problems, rank them, and fix the ones that are clearly defects. Do not rewrite working code for style.

Don't trust comments, test names or earlier claims. Check what the code actually does, and run the tests yourself.

## Part 1: Rule compliance

For each rule in the context file's "Non-negotiable rules", say **pass**, **fail** or **unclear**, with the file and function that shows it. Pay particular attention to:

1. **Single execution path:** search for any place that runs command logic without going through the registry's execute step (direct function calls from the GUI handlers, the CLI, IPC code or other plugins).
2. **Frontend logic:** any feature logic in React components, preload, or the CLI that should be a command.
3. **Electron imports** inside `packages/core` or any plugin.
4. **Fail-closed behaviour:** empty scope, audit-write failure, invalid input, unknown plugin permission.
5. **Scope:** every command that makes its own network request is marked scope-required and declares all targets; redirects and DNS resolution are rechecked where the spec says so.
6. **Shell safety:** any use of a shell, string-built command lines, or user-controlled values placed in arguments without a separator or validation.
7. **Secrets:** search the code, logs, audit rows, test fixtures and exports for API keys, tokens, cookies and passwords. Check the redaction rules.
8. **Preload exposure:** confirm only the shell window has the preload, only two bridge functions are exposed, and the sender check exists on every command IPC handler.
9. **Downloads and files:** nothing is executed, opened or auto-previewed; no arbitrary path accepted where the spec says "by id only".
10. **Error handling:** stable error codes, no stack traces crossing process boundaries.

## Part 2: Attacker's-eye review

Think like someone trying to abuse DualSurf. For each item, try to find a concrete way it could be exploited and say how you checked.

- A malicious web page in a tab trying to call the command bridge, read captured traffic, or reach the IPC socket.
- Another local user or process trying to use the CLI socket (permissions, token handling, race on socket creation, stale files).
- A hostile target returning crafted headers, redirects, huge bodies, slow responses or odd encodings.
- A hostile file (malformed archive, giant file, path-traversal names) fed to a parser.
- A plugin trying to exceed its permissions, overwrite core commands, or tamper with the audit log.
- A user (or script) trying to run active commands out of scope: unusual URL forms, userinfo tricks, trailing dots, punycode, IPv6 forms, DNS that changes between check and use.
- Resource exhaustion: unbounded queues, buffers, logs or database growth.

## Part 3: Test quality

- Run the full test suite and report results.
- List behaviours in the step's "Tests to write" section that have **no test** or only a weak one.
- Identify tests that pass trivially (they would pass even if the feature were broken). Try breaking the feature on purpose (in a scratch branch) and see whether the test fails.
- Check for flaky tests (timing, ports, temp files, shared state).

## Part 4: Output format

Give me:

1. A table of findings: id, severity (critical, high, medium, low), file and location, what is wrong, how you confirmed it, and the proposed fix.
2. The list of fixes you actually made (only clear defects), each with the test that proves it.
3. Things you were unsure about, as questions for me.
4. A final verdict: ready to commit and move on, or not, and why.

## Rules for the review

- Don't introduce new features.
- Don't weaken a rule or delete a test to get a pass.
- If a spec requirement seems wrong or contradictory, report it instead of changing it silently.
- If you can't verify something, say so plainly. "Unclear" is an acceptable answer; a confident guess is not.
