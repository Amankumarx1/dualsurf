# DualSurf 🏄‍♂️

A streamlined, modern dual-mode web browser offering seamless operation across both **Graphical UI (GUI)** and **Command-Line Interface (CLI)** environments.

---

## 🌟 Modes of Operation

### 1. GUI Mode (Graphical Browser)
A lightweight Electron-based browser equipped with core navigation capabilities:
- **Tab Management**: Multi-tab browsing, tab search (`Ctrl+Shift+A`), split-view tabs, duplicate, mute, and pin.
- **Bookmarks & History**: Built-in bookmarks bar, manager dialogs, and persistent history search.
- **Reading & Inspection**: Reader mode modal (`Ctrl+Shift+R`), page metadata drawer, find-in-page (`Ctrl+F`).
- **Modern UI**: Full keyboard navigation, dark/light theme toggle, custom downloads directory selector.

### 2. CLI Mode (Terminal & REPL)
Control your browser directly from any command-line prompt or interactively inside the terminal:
- **Interactive REPL**: Launch with `dualsurf --terminal` (or `dualsurf attach`).
- **Direct Commands**:
  - `dualsurf open <url>` — Open/navigate active tab to a URL or domain.
  - `dualsurf search <query>` — Search the web via default search engine.
  - `dualsurf tabs` — View all active tabs.
  - `dualsurf tab new [url]` / `dualsurf tab close [index]` — Manage tabs.
  - `dualsurf text` — Extract clean, readable text from the page.
  - `dualsurf links` — View numbered links on the active page.
  - `dualsurf click <number|label>` — Follow numbered link.
  - `dualsurf bookmarks` / `dualsurf history` / `dualsurf downloads` — Access browser data.
  - `dualsurf gui` — Launch or focus the graphical window.

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation & Build
```bash
# Clone the repository
git clone https://github.com/your-username/dualsurf.git
cd dualsurf

# Install dependencies
npm install

# Build all packages (Controller, Desktop, CLI)
npm run build
```

### Running DualSurf

#### Start the GUI Desktop Browser:
```bash
npm run dev:desktop
```

#### Launch the Interactive CLI:
```bash
npm run dev:cli -- --terminal
```

---

## 🏗️ Architecture

```
DualSurf/
├── apps/
│   ├── desktop/       # Electron GUI application (React + Vite + TypeScript)
│   └── cli/           # CLI tool & interactive REPL client
└── packages/
    ├── controller/    # Core browser controller & IPC server
    ├── ipc-protocol/  # IPC protocol definitions & communication contracts
    ├── shared-types/  # TypeScript interfaces for tabs, settings, bookmarks
    └── storage/       # SQLite persistence for history, bookmarks, and downloads
```

## 📜 License
MIT License.
