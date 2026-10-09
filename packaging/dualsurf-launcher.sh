#!/usr/bin/env bash
# DualSurf Linux Environment Launcher
# Detects whether GUI or Headless/TTY environment is active and routes accordingly

set -euo pipefail

DUALSURF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check if DISPLAY or WAYLAND_DISPLAY is available
if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "[DualSurf] No graphical display detected. Launching in Terminal Browsing Mode..."
  exec node "$DUALSURF_ROOT/apps/cli/dist/index.js" --terminal "$@"
else
  # Display is available; check if CLI command was passed or launch GUI
  if [[ "$#" -gt 0 ]]; then
    exec node "$DUALSURF_ROOT/apps/cli/dist/index.js" "$@"
  else
    exec npm run dev:desktop --prefix "$DUALSURF_ROOT"
  fi
fi
