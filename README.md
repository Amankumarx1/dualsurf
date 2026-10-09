# DualSurf 🌊

> **Dual-Mode Linux Browser**: Bridging modern graphical web browsing with a powerful, command-driven terminal interface through a shared browser controller.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20(Dev)-lightgrey.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-Latest-47848F.svg)](https://www.electronjs.org/)

---

## 🎯 Vision & Principles

DualSurf is designed specifically for power users, developers, sysadmins, and security researchers who navigate the web both graphically and from the shell. Rather than keeping GUI and terminal browsing in isolated silos, DualSurf introduces a **unified browsing session** managed by a **Shared Browser Controller**.

### Core Principles
1. **Linux-First**: Native desktop environment integration, X11/Wayland support, packaging (`.deb`, `AppImage`, `.rpm`), and shell integration (Bash, Zsh, Fish).
2. **Two Interfaces, One Product**: A single running browser instance whose tabs, session, history, and downloads can be driven identically from the GUI or the terminal.
3. **Modern Web Compatibility**: Built on Chromium via Electron (`WebContentsView`) to ensure 100% compatibility with modern HTML5, CSS3, ESNext, and complex SPAs.
4. **Terminal-Native**: Rich text rendering, numbered actionable links, form interaction, keyboard navigation, and CLI automation.
5. **Security by Design**: Web content isolation, strict context isolation, permission boundaries, and zero arbitrary shell execution from web content.
6. **Research-Ready**: Architecture instrumented for measuring task efficiency, IPC latency, accessibility, and navigation overhead.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   DualSurf Interfaces                  │
├───────────────────────────┬────────────────────────────┤
│   Mode A: Graphical GUI   │   Mode B: CLI & TUI        │
│   (React + TypeScript)    │   (One-shot CLI & TUI)     │
└─────────────┬─────────────┴─────────────┬──────────────┘
              │                           │
              │ Electron IPC              │ Unix Domain Socket
              │ (Preload / ContextBridge) │ (Named Pipe on Win)
              ▼                           ▼
┌────────────────────────────────────────────────────────┐
│               Shared Browser Controller                │
│  - Tab Management & Lifecycle (tab IDs, focus, bounds) │
│  - Navigation Engine & URL Normalization               │
│  - Page Content Inspector (Text & Numbered Links)      │
│  - Session & Profile Manager (Cookies, Storage)        │
│  - Download Manager & Permission Broker                │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     Chromium Engine       │ │     Persistence Layer     │
│   (WebContentsView)       │ │     (SQLite Storage)      │
└───────────────────────────┘ └───────────────────────────┘
```

---

## ⌨️ Terminal Command Reference

| Command | Expected Behavior |
| :--- | :--- |
| `dualsurf` | Launch graphical browser mode |
| `dualsurf --terminal` | Launch interactive terminal mode (TUI) |
| `dualsurf open <url>` | Open URL in active tab (or `--new-tab`) |
| `dualsurf tabs` | List all currently open tabs with IDs and titles |
| `dualsurf tab <n>` | Switch focus to tab `<n>` |
| `dualsurf tab new [url]` | Open a new tab |
| `dualsurf tab close <n>` | Close tab `<n>` |
| `dualsurf page` | Print current page metadata, title, and URL |
| `dualsurf text` | Extract and print readable structured page text |
| `dualsurf links` | Extract numbered actionable links |
| `dualsurf click <n>` | Follow numbered link `<n>` |
| `dualsurf back` / `forward` | History back and forward navigation |
| `dualsurf reload` / `stop` | Reload or stop page loading |
| `dualsurf bookmarks` | List saved bookmarks |
| `dualsurf history` | Show visit history |

---

## 🗺️ Roadmap & Phases

- [ ] **Phase 1: Browser Foundation** — Electron + React + TypeScript with `WebContentsView`, multi-tab management, address bar, navigation controls.
- [ ] **Phase 2: Browser Controller** — Decoupled controller API, tab lifecycle events, loading state tracker, session ownership.
- [ ] **Phase 3: CLI & IPC Server** — Local Unix Domain Socket / Named Pipe IPC, command protocol, `dualsurf` CLI client.
- [ ] **Phase 4: Interactive Terminal Browsing** — Text extraction engine, numbered links snapshot, interactive TUI keyboard shortcuts.
- [ ] **Phase 5: Persistence & Utilities** — SQLite storage for bookmarks, history, profiles, settings, downloads.
- [ ] **Phase 6: Headless Linux Mode** — Operable without X11/Wayland display for headless Linux servers.
- [ ] **Phase 7: Security Hardening** — Content security policy, sandbox enforcement, IPC authorization, permission prompts.
- [ ] **Phase 8: Release Engineering** — Packaging (`.deb`, `AppImage`), desktop shortcuts, man pages, shell completion.

---

## 📁 Repository Structure

```
dualsurf/
├── apps/
│   ├── desktop/          # Electron main, preload, and React GUI
│   ├── cli/              # dualsurf CLI executable & command handlers
│   └── terminal/         # Interactive TUI application
├── packages/
│   ├── controller/       # Shared Browser Controller & Tab Manager
│   ├── ipc-protocol/     # Typed IPC request/response schema & versioning
│   ├── page-inspector/   # DOM/Text extraction & link numbering
│   ├── storage/          # SQLite schema, migrations, queries
│   └── shared-types/     # Shared domain entities & interfaces
├── docs/                 # Architecture, security, command specs
└── tests/                # Unit, integration, E2E tests
```
