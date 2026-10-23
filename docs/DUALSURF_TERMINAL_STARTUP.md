# DualSurf Production Terminal Startup & Runtime Identity Specification

## Executive Summary

DualSurf features a dual-mode browsing and terminal architecture. Prior to this fix, opening the Terminal mode exhibited two critical defects:
1. **Development Directory Exposure**: The terminal working directory defaulted to the developer's local repository path (`C:/D Drive/Aman/DualSurf`), exposing internal project files and configuration to end users.
2. **Fabricated / Inconsistent Kali Identity**: The terminal tabs opened with synthetic tabs (`kali`, `root`, `logs`, `nmap`) and printed an artificial Kali Linux 2024.4 neofetch banner, despite the underlying host shell executing Git Bash (`MINGW64`) or Windows PowerShell.

This document outlines the root causes, architecture redesign, directory resolution algorithms, and settings controls implemented to ensure a clean, production-grade first-run experience.

---

## 1. Root Cause Analysis

### 1.1 Directory Leak Root Cause
In `apps/desktop/electron/main.ts`:
- **Line 1316**: `const defaultCwd = app.isPackaged ? os.homedir() : (findRepoRoot(app.getAppPath() || process.cwd()) || os.homedir());`
  During development, unpacked runs, or portable distributions where `app.isPackaged` evaluated to `false`, `defaultCwd` unconditionally searched parent directories for a repository root (`findRepoRoot`), resolving to `C:/D Drive/Aman/DualSurf`.
- **Line 704**: In `dualsurf:getSystemInfo`, the reported system directory was explicitly set to `findRepoRoot(process.cwd())`.
- **Line 1321**: `dualsurf:ptyCreate` defaulted `options?.cwd` to `defaultCwd`, starting every shell session inside the developer repository.

### 1.2 Inconsistent Runtime Identity Root Cause
In `apps/desktop/src/components/terminal/DualSurfTerminalWorkspace.tsx`:
- **Lines 96–102**: The React session tabs state was pre-initialized with four static tabs:
  - `kali` (`runtime: 'kali (WSL)'`, `cwd: '~'`)
  - `root` (`icon: '💀'`, `cwd: '/root'`)
  - `logs` (`icon: '📄'`, `cwd: '~/logs'`)
  - `nmap` (`icon: '🌐'`, `cwd: '~/scans'`)
- **Lines 427–454**: The `displayNeofetchBanner()` function unconditionally wrote a static 25-line ASCII neofetch banner to the xterm buffer claiming `OS: Kali Linux 2024.4 x86_64`, `Kernel: 6.6.0-kali`, and `Shell: zsh 5.9`.
- When `dualsurf:ptyCreate` subsequently spawned on Windows, it resolved the local host shell (Git Bash or PowerShell), causing the real shell prompt (e.g. `amank@Lenovo MINGW64 /c/d drive/aman/dualsurf`) to print directly beneath the fake Kali banner.

---

## 2. Architecture & Implementation Changes

### 2.1 Runtime-Specific Working Directory Resolution
A central resolution function `resolveTerminalWorkingDir(requestedCwd?: string, userDefaultDir?: string): string` was introduced in `apps/desktop/electron/main.ts`:

```typescript
function resolveTerminalWorkingDir(requestedCwd?: string, userDefaultDir?: string): string {
  // 1. Explicit requested cwd (e.g., project folder picker or restored session)
  if (requestedCwd && typeof requestedCwd === 'string') {
    let clean = requestedCwd.trim();
    if (clean === '~' || clean === '$HOME' || clean === '%USERPROFILE%') {
      return os.homedir();
    }
    if (clean.startsWith('~/') || clean.startsWith('~\\')) {
      clean = path.join(os.homedir(), clean.slice(2));
    }
    if (path.isAbsolute(clean) && fs.existsSync(clean)) {
      try {
        const stat = fs.statSync(clean);
        if (stat.isDirectory()) return clean;
      } catch {}
    }
  }

  // 2. User configured default working directory from BrowserSettings
  if (userDefaultDir && typeof userDefaultDir === 'string') {
    let clean = userDefaultDir.trim();
    if (clean.startsWith('~/') || clean.startsWith('~\\')) {
      clean = path.join(os.homedir(), clean.slice(2));
    }
    if (path.isAbsolute(clean) && fs.existsSync(clean)) {
      try {
        const stat = fs.statSync(clean);
        if (stat.isDirectory()) return clean;
      } catch {}
    }
  }

  // 3. Fallback: OS user home directory (NEVER repository root or development path)
  return os.homedir();
}
```

### 2.2 Runtime-Specific Target Directories
| Runtime Environment | Default Working Directory | Argument / Resolution Logic |
| :--- | :--- | :--- |
| **Windows PowerShell** | User `$HOME` | `os.homedir()` / `%USERPROFILE%` |
| **Windows Command Prompt** | `%USERPROFILE%` | `os.homedir()` |
| **Git Bash (MINGW64)** | Actual user home (`~`) | `os.homedir()` with `HOME` & `USERPROFILE` env variables set |
| **WSL 2 Linux** | Genuine Linux user home (`~`) | `wsl.exe -d <distro> --cd ~` (or `--cd <winPath>` for project directories) |
| **Native Linux / Kali** | `$HOME` | `os.homedir()` from active user environment |
| **Container (Docker)** | `/root` or runtime default | Spawned inside container; reports unavailable if Docker daemon offline |

### 2.3 Truthful Runtime Detection & Shell Preference
In `apps/desktop/electron/main.ts`:
- `resolveHostShell(preferred?: string)` respects the user's preference configured in Settings (`powershell`, `cmd`, `bash`, `wsl`, or `default`).
- On Windows, the default is **PowerShell** (the native Windows management shell), with Git Bash and Command Prompt available as alternatives.
- WSL 2 is probed dynamically via `kaliRuntimeManager.probeAvailableRuntimes()`. If WSL is not installed or has no distributions, DualSurf reports an accurate error message (`WSL 2 is not installed or configured`) rather than silently spawning Git Bash and claiming it is Kali Linux.

### 2.4 Production First-Run Experience & Banner
In `apps/desktop/src/components/terminal/DualSurfTerminalWorkspace.tsx`:
- Removed `displayNeofetchBanner()` and all synthetic Kali ASCII art.
- Replaced initial sessions state with a single, genuine session tab (`Terminal 1`).
- Display a clean, neutral production header:
  ```text
  DualSurf Production Terminal — High-Performance Security & Development Shell
  Runtime: <Genuine Runtime Name>  |  Working Directory: <User Home or Selected Path>
  Ready for standard shell commands. Click "Open Folder" to set a project workspace.
  ```
- Provided an **Open Folder** button in the toolbar that launches the native OS folder picker (`dialog.showOpenDialog`) to set the active terminal working directory without polluting other sessions.

### 2.5 Configurable Terminal Settings
In `packages/shared-types`, `packages/controller/src/SessionStore.ts`, and `apps/desktop/src/components/SettingsModal.tsx`:
- `defaultShell`: Select between System Default, PowerShell, Command Prompt, WSL 2, or POSIX Bash.
- `terminalDefaultWorkingDir`: Custom default working directory with **Browse...** and **Reset** buttons (defaults to empty = user home).
- `terminalShowWelcome`: Toggle to display or suppress the production startup header.
- `terminalRestoreSessions`: Toggle to restore or discard previous terminal sessions upon application launch.

---

## 3. Files Modified

| File | Changes Made |
| :--- | :--- |
| `apps/desktop/electron/main.ts` | Removed `findRepoRoot` from `defaultCwd` and `dualsurf:getSystemInfo`; implemented `resolveTerminalWorkingDir`; updated `resolveHostShell` for shell preference; updated `dualsurf:ptyCreate` with authentic WSL `--cd ~` and fallback; added `dualsurf:selectFolder` IPC handler. |
| `apps/desktop/electron/preload.ts` | Added `selectFolder` to `DualSurfAPI`; expanded `ptyCreate` return type signature with metadata (`runtimeName`, `shellExe`, `cwd`, `username`, `hostname`). |
| `apps/desktop/src/components/terminal/DualSurfTerminalWorkspace.tsx` | Removed fake `kali`, `root`, `logs`, `nmap` tabs; removed `displayNeofetchBanner()`; added neutral DualSurf header; wired dynamic `ptyCreate` metadata to tab headers; added **Open Folder** toolbar action. |
| `apps/desktop/src/components/terminal/XTermPanel.tsx` | Changed fallback `runtimeName` from `Kali Linux` to `Host Shell`; removed synthetic `dualsurf㉿kali` prompt in preview mode. |
| `apps/desktop/src/mockBrowserBridge.ts` | Removed hardcoded developer username `amank`; removed duplicate `defaultShell`; replaced fake Kali neofetch with neutral terminal status; added `selectFolder`. |
| `apps/desktop/src/components/SettingsModal.tsx` | Added UI controls for Default Working Directory (with directory picker), Show Welcome Header toggle, and Restore Terminal Sessions toggle. |
| `packages/shared-types/src/index.ts` | Added `terminalDefaultWorkingDir`, `terminalRestoreSessions`, `terminalShowWelcome`, and `terminalDefaultRuntime` to `BrowserSettings`. |
| `packages/controller/src/SessionStore.ts` | Added default values for terminal settings to `DEFAULT_SETTINGS`. |
| `apps/cli/src/tools/purpleTeam.ts` | Replaced hardcoded developer hostname `Aman` with dynamic `os.hostname()`. |
| `tests/unit/terminal-startup.test.js` | Created 17 automated tests covering directory resolution, runtime labels, missing runtimes, and sanitized defaults. |

---

## 4. Verification & Status

1. **Automated Unit Tests**: All 17 tests in `tests/unit/terminal-startup.test.js` pass with 0 failures.
2. **Workspace Regression Suite**: All 286 tests across the repository pass with 0 failures.
3. **Live UI Inspection**: Verified using the browser subagent in the running DualSurf instance (`http://localhost:5173/`).
   - Clean initial session tabs (`Terminal 1`).
   - Truthful runtime identity and home directory (`~`).
   - Open Folder dialog integration.
   - Secondary session creation (`Terminal 2`).
   - Settings modal configuration persistence.
