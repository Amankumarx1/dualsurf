# DualSurf Command Reference & IPC Specification

## 1. CLI Commands Reference

All commands connect to the active running DualSurf instance over the protected local IPC socket.

### Navigation & Tabs
| Command | Arguments | Description | Example |
| :--- | :--- | :--- | :--- |
| `dualsurf` | *(none)* | Shows current status if running, or starts the application. | `dualsurf` |
| `dualsurf --terminal` | *(none)* | Enters interactive terminal mode (REPL) with command prompt. | `dualsurf --terminal` |
| `dualsurf attach` | *(none)* | Alias for `--terminal`. Attaches to the active browser session. | `dualsurf attach` |
| `dualsurf tabs` | `[--json]` | Lists all open tabs, marking active tab with `*`. | `dualsurf tabs` |
| `dualsurf tab <n>` | `<number>` | Switches focus to tab by 1-based index or tab ID. | `dualsurf tab 2` |
| `dualsurf tab new` | `[url]` | Creates a new tab (optionally navigating to URL). | `dualsurf tab new https://github.com` |
| `dualsurf tab close` | `[number]` | Closes tab by index (or active tab if omitted). | `dualsurf tab close 2` |
| `dualsurf open` | `<url/domain>` | Navigates the active tab to a URL or domain. | `dualsurf open https://archlinux.org` |
| `dualsurf search` | `<query>` | Executes a web search using the configured search engine. | `dualsurf search "linux epoll tutorial"` |
| `dualsurf back` | *(none)* | Navigates history backward in active tab. | `dualsurf back` |
| `dualsurf forward` | *(none)* | Navigates history forward in active tab. | `dualsurf forward` |
| `dualsurf reload` | *(none)* | Reloads the current page. | `dualsurf reload` |
| `dualsurf stop` | *(none)* | Stops page loading. | `dualsurf stop` |

### Page Inspection & Interaction
| Command | Arguments | Description | Example |
| :--- | :--- | :--- | :--- |
| `dualsurf page` | `[--json]` | Displays page metadata: Title, URL, and loading state. | `dualsurf page` |
| `dualsurf text` | `[--json]` | Prints structured, readable content of the active page. | `dualsurf text` |
| `dualsurf links` | `[--json]` | Extracts numbered actionable links (`[1]`, `[2]`, ...). | `dualsurf links` |
| `dualsurf click <n>` | `<number>` | Activates the numbered link corresponding to `[n]`. | `dualsurf click 3` |
| `dualsurf headings` | `[--json]` | Lists H1–H6 headings in document hierarchical order. | `dualsurf headings` |

---

## 2. Interactive Terminal Session (REPL)

When launched with `dualsurf --terminal` or `dualsurf attach`:

```text
DUALSURF  |  TERMINAL MODE
─────────────────────────────────────────────────────
Connected to live DualSurf browser session.
Type "help" for available commands, or "quit" to exit.

dualsurf> open https://docs.example.org
Navigating to: https://docs.example.org...
Navigation initiated.

dualsurf> text
DUALSURF  |  TERMINAL MODE
─────────────────────────────────────────────────────
Title: Example Documentation
URL:   https://docs.example.org

Headings (2)
  [H1] Example Documentation
    [H2] Getting Started

Content:
Welcome to the documentation...

Links (2)
  [1] Getting Started Guide
      https://docs.example.org/start
  [2] API Reference
      https://docs.example.org/api

dualsurf> click 1
Following link [1]...
Link [1] activated.

dualsurf> back
Navigated back.

dualsurf> quit
Exiting interactive terminal mode.
```

---

## 3. JSON Output for Automated Evaluation & Scripting

Appending `--json` returns raw structured output, ideal for research benchmarking:

```bash
dualsurf tabs --json
```
```json
{
  "tabs": [
    {
      "id": "tab-1712750000000-a1b2",
      "url": "https://duckduckgo.com",
      "title": "DuckDuckGo — Privacy, simplified.",
      "isLoading": false,
      "canGoBack": false,
      "canGoForward": false,
      "pinned": false
    }
  ],
  "activeTabId": "tab-1712750000000-a1b2",
  "profileId": "default"
}
```
