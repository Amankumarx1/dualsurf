# DualSurf Prompt Pack: How to Use

These files are prompts and specs for an AI coding agent (Claude Code, Cursor, Copilot Agent, etc.). They contain no source code. The agent writes the code from the specs, so you keep the design while it does the typing.

## Files

| File | Use it for |
|---|---|
| `01_PROJECT_CONTEXT.md` | Shared context and non-negotiable rules. Read at the start of every session. |
| `02_STEP1_CORE_WIRING_PROMPT.md` | Command registry, scope, audit log, plugins, IPC, CLI and GUI bridge. **Do this first.** |
| `03_STEP2_TRAFFIC_CAPTURE_PROMPT.md` | Traffic capture, interception and repeater. |
| `04_STEP3_BLUE_SOC_PROMPT.md` | Blue team and SOC tools. |
| `05_STEP4_RED_RECON_PROMPT.md` | Red-team recon and tool adapters, with scope enforcement. |
| `06_STEP5_MALWARE_STATIC_PROMPT.md` | Download quarantine and static malware triage. |
| `07_REVIEW_PROMPT.md` | Security and quality review to run after every step. |

## Workflow (repeat for each step)

1. **Set the context once.** Copy `01_PROJECT_CONTEXT.md` into your repo as `CLAUDE.md` (Claude Code), `AGENTS.md`, or `.cursorrules` so the agent loads it automatically. Otherwise paste it at the start of each session.
2. **One step per session.** Paste the step file as the prompt. Don't combine steps, because the agent loses precision when asked to do too much.
3. **Let the agent plan first.** Every step file begins with "inspect the repo and report". Read that report before telling it to proceed. This is where you catch wrong assumptions about your existing `controller` and `storage` packages.
4. **Insist on tests.** Each step lists behaviours that must become automated tests. Don't accept "done" without a passing test run.
5. **Commit after each step.** Then run `07_REVIEW_PROMPT.md` in a fresh session and fix what it finds before starting the next step.

## Tips

- If the agent proposes something that breaks a rule in the context file (for example, a command that imports Electron), tell it to re-read the rules rather than arguing the case.
- If a step feels too big, ask the agent to split it into sub-tasks and finish one at a time.
- If you already merged the earlier reference implementation (`DualSurf-step1.zip`), tell the agent that in the Step 1 session. The Step 1 prompt has a section for auditing existing code against the spec instead of rewriting it.
- Keep the step files in `docs/prompts/` in your repo so your team and future sessions use the same specs.

## Order and dependencies

Step 1 → Step 2 → Step 3 → Step 4 → Step 5. Step 4 needs the scope manager from Step 1. Steps 3 to 5 need the traffic events from Step 2. Don't skip ahead.
