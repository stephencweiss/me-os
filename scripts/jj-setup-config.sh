#!/bin/bash
# Copies version-controlled jj config into the colocated repo and optionally installs lazyjj.
#
# Usage: ./scripts/jj-setup-config.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_SOURCE="$REPO_ROOT/config/jj-repo-config.toml"
CONFIG_DEST="$REPO_ROOT/.jj/repo/config.toml"

if ! command -v jj &>/dev/null; then
    echo "Error: jj is not installed. Install with: brew install jj"
    exit 1
fi

if [ ! -d "$REPO_ROOT/.jj" ]; then
    echo "Error: .jj not found. From repo root run: jj git init --colocate"
    exit 1
fi

if [ ! -f "$CONFIG_SOURCE" ]; then
    echo "Error: Missing $CONFIG_SOURCE"
    exit 1
fi

echo "Copying jj config..."
cp "$CONFIG_SOURCE" "$CONFIG_DEST"
echo "  Updated $CONFIG_DEST"

echo ""
if command -v lazyjj &>/dev/null; then
    echo "lazyjj is already installed."
else
    echo "lazyjj provides a live graph for monitoring agent workspaces."
    read -p "Install lazyjj via brew? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        brew install lazyjj
        echo "  lazyjj installed"
    else
        echo "  Skipped. Install later: brew install lazyjj"
        echo "  Or: watch -n 1 --color jj log"
    fi
fi

echo ""
echo "Aliases: jj ls  jj stack  jj amend"
echo "Done."
