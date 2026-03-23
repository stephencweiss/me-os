#!/bin/bash
# Forgets a jj workspace and removes its directory.
#
# Usage: ./scripts/jj-workspace-done.sh [-d] <workspace-name>
#   -d  Also delete a jj bookmark with the same name, if present

set -e

REPO_NAME="$(basename "$PWD")"
WORKTREE_BASE="../worktrees/${REPO_NAME}"

usage() {
    echo "Usage: $0 [-d] <workspace-name>"
    echo "  -d  Also delete bookmark named <workspace-name> if it exists"
    exit 1
}

DELETE_BOOKMARK=false
while getopts "d" flag; do
    case "${flag}" in
        d) DELETE_BOOKMARK=true ;;
        *) usage ;;
    esac
done
shift $((OPTIND - 1))

WORKSPACE_NAME=$1
if [ -z "$WORKSPACE_NAME" ]; then
    usage
fi

WORKSPACE_PATH="$WORKTREE_BASE/$WORKSPACE_NAME"

if ! jj root &>/dev/null; then
    echo "Error: Not in a jj repository"
    exit 1
fi

if ! jj workspace list | grep -qE "^${WORKSPACE_NAME}:"; then
    echo "Error: Workspace '$WORKSPACE_NAME' not found."
    echo ""
    jj workspace list
    exit 1
fi

echo "Forgetting jj workspace: $WORKSPACE_NAME"
jj workspace forget "$WORKSPACE_NAME" || {
    echo "Warning: jj workspace forget failed (may already be forgotten)"
}

if [ -d "$WORKSPACE_PATH" ]; then
    echo "Removing directory: $WORKSPACE_PATH"
    rm -rf "$WORKSPACE_PATH"
else
    echo "Directory already absent: $WORKSPACE_PATH"
fi

if [ "$DELETE_BOOKMARK" = true ]; then
    if jj bookmark list | grep -qE "^${WORKSPACE_NAME} "; then
        echo "Deleting bookmark: $WORKSPACE_NAME"
        jj bookmark delete "$WORKSPACE_NAME"
    else
        echo "No bookmark named '$WORKSPACE_NAME'"
    fi
fi

echo ""
echo "Workspace '$WORKSPACE_NAME' cleaned up."
