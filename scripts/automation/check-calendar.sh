#!/usr/bin/env bash
set -euo pipefail

# Stable wrapper for scheduled calendar checks.
# Intended to run under launchd with logs redirected by the plist.

PROFILE="${PROFILE:-calendar_full}"
WORKDIR="${WORKDIR:-/Users/sweiss/code/me-os}"
PROMPT="${PROMPT:-Run /calendar today to see what the day looks like.}"

# launchd PATH is often minimal; include common locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
# Add Node from nvm installs when launchd starts with a stripped environment.
if [[ -d "${HOME}/.nvm/versions/node" ]]; then
  latest_nvm_bin="$(ls -1d "${HOME}/.nvm/versions/node/"*/bin 2>/dev/null | tail -n 1 || true)"
  if [[ -n "${latest_nvm_bin}" ]]; then
    export PATH="${latest_nvm_bin}:${PATH}"
  fi
fi

CODEX_BIN="${CODEX_BIN:-}"
if [[ -z "${CODEX_BIN}" ]]; then
  if command -v codex >/dev/null 2>&1; then
    CODEX_BIN="$(command -v codex)"
  elif [[ -x "/Applications/Codex.app/Contents/Resources/codex" ]]; then
    CODEX_BIN="/Applications/Codex.app/Contents/Resources/codex"
  fi
fi
if [[ -z "${CODEX_BIN}" || ! -x "${CODEX_BIN}" ]]; then
  echo "ERROR: codex binary not found. PATH=$PATH"
  exit 127
fi

echo "=== check-calendar start $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
echo "profile=${PROFILE}"
echo "workdir=${WORKDIR}"
echo "codex_bin=${CODEX_BIN}"
echo "node_bin=$(command -v node || echo 'node-not-found')"

set +e
"${CODEX_BIN}" exec -p "${PROFILE}" -C "${WORKDIR}" "${PROMPT}"
status=$?
set -e

echo "exit_code=${status}"
echo "=== check-calendar end $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
exit "${status}"
