#!/bin/bash
# Creates a jj workspace for feature work and copies local config from the main checkout.
#
# Usage:
#   ./scripts/jj-workspace-start.sh [-o|--open] [-a|--agent] <workspace-name>
#
# Examples:
#   ./scripts/jj-workspace-start.sh capacitor-ios
#   ./scripts/jj-workspace-start.sh -o capacitor-ios   # also open in Cursor

set -e

REPO_NAME="$(basename "$PWD")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    echo "Usage: $0 [-o|--open] [-a|--agent] <workspace-name>"
    echo "  -o, --open   Open the workspace in Cursor after creation"
    echo "  -a, --agent  Create agent workspace with ai- prefix"
    echo ""
    echo "Creates a jj workspace at ../worktrees/${REPO_NAME}/<workspace-name> and copies env/config."
    exit 1
}

OPEN_CURSOR=false
AGENT_MODE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -o|--open)
            OPEN_CURSOR=true
            shift
            ;;
        -a|--agent)
            AGENT_MODE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        -*)
            echo "Unknown option: $1"
            usage
            ;;
        *)
            WORKSPACE_NAME="$1"
            shift
            ;;
    esac
done

if [ -z "${WORKSPACE_NAME:-}" ]; then
    usage
fi

if [ "$AGENT_MODE" = true ]; then
    WORKSPACE_NAME="ai-${WORKSPACE_NAME}"
fi

WORKTREE_BASE="../worktrees/${REPO_NAME}"
WORKSPACE_PATH="${WORKTREE_BASE}/${WORKSPACE_NAME}"

mkdir -p "$WORKTREE_BASE"

if ! jj root &>/dev/null; then
    echo "Error: Not in a jj repository."
    echo "From repo root: jj git init --colocate"
    exit 1
fi

if [ -d "$WORKSPACE_PATH" ]; then
    echo "Error: Directory already exists: $WORKSPACE_PATH"
    exit 1
fi

echo "Creating jj workspace: $WORKSPACE_NAME"
jj workspace add "$WORKSPACE_PATH"

echo ""
echo "Copying config and env files..."
(cd "$WORKSPACE_PATH" && "$SCRIPT_DIR/worktree-setup-env.sh")

echo ""
echo "Installing dependencies (pnpm workspace)..."
(cd "$WORKSPACE_PATH" && pnpm install)

echo ""
if [ "$AGENT_MODE" = true ]; then
    echo "========================================="
    echo "Agent workspace ready at: $WORKSPACE_PATH"
    echo "  cd $WORKSPACE_PATH"
    echo "========================================="
else
    echo "========================================="
    echo "Workspace ready at: $WORKSPACE_PATH"
    echo ""
    echo "  cd $WORKSPACE_PATH"
    echo "  jj new -m \"Your first change\""
    echo ""
    echo "When done: ./scripts/jj-workspace-done.sh $WORKSPACE_NAME"
    echo "========================================="

    if [ "$OPEN_CURSOR" = true ]; then
        echo ""
        echo "Opening in Cursor..."
        cursor "$WORKSPACE_PATH"
    fi
fi
