#!/bin/bash
# Copies gitignored config from the colocated repo root into the current jj workspace
# or git worktree. Run from within the workspace/worktree after it is created.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

find_main_repo() {
    if [ -n "${ME_OS_MAIN_REPO_OVERRIDE:-}" ] && [ -d "$ME_OS_MAIN_REPO_OVERRIDE" ]; then
        echo "$(cd "$ME_OS_MAIN_REPO_OVERRIDE" && pwd)"
        return 0
    fi
    if command -v jj &>/dev/null && jj git root &>/dev/null; then
        echo "$(dirname "$(jj git root)")"
        return 0
    fi
    if git rev-parse --show-toplevel &>/dev/null; then
        git rev-parse --show-toplevel
        return 0
    fi
    return 1
}

copy_if_exists() {
    local src="$1"
    local dest="$2"
    if [ -e "$src" ]; then
        mkdir -p "$(dirname "$dest")"
        cp -r "$src" "$dest"
        echo "  Copied: $src -> $dest"
    fi
}

MAIN_REPO=$(find_main_repo) || {
    echo "Error: Could not resolve main me-os repo (jj git root / git toplevel)."
    echo "Set ME_OS_MAIN_REPO_OVERRIDE to your main checkout if needed."
    exit 1
}

echo "Main repo: $MAIN_REPO"
echo "Target:    $PWD"
echo ""

copy_if_exists "$MAIN_REPO/config/turso.json" "$PWD/config/turso.json"
copy_if_exists "$MAIN_REPO/config/calendars.json" "$PWD/config/calendars.json"
copy_if_exists "$MAIN_REPO/config/sensitive" "$PWD/config/sensitive"
copy_if_exists "$MAIN_REPO/web/.env.local" "$PWD/web/.env.local"
copy_if_exists "$MAIN_REPO/webapp/.env.local" "$PWD/webapp/.env.local"
copy_if_exists "$MAIN_REPO/.env.local" "$PWD/.env.local"

echo ""
echo "Done."
