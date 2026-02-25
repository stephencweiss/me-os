#!/bin/bash
# Creates a git worktree for a feature branch

REPO_NAME="$(basename "$PWD")"

usage() {
    echo "Usage: $0 [-o|--open] <feature-name>"
    echo "  -o, --open  Open the worktree in Cursor"
    exit 1
}

OPEN_CURSOR=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -o|--open)
            OPEN_CURSOR=true
            shift
            ;;
        -*)
            usage
            ;;
        *)
            FEATURE_NAME="$1"
            shift
            ;;
    esac
done

if [ -z "$FEATURE_NAME" ]; then usage; fi

WORKTREE_BASE="../worktrees/${REPO_NAME}"
TARGET_PATH="${WORKTREE_BASE}/${FEATURE_NAME}"

# Ensure worktree base directory exists
mkdir -p "$WORKTREE_BASE"

# Create worktree (reuse existing branch or create new one)
if git show-ref --verify --quiet refs/heads/"$FEATURE_NAME"; then
    git worktree add "$TARGET_PATH" "$FEATURE_NAME" || {
        echo "Error: Branch '$FEATURE_NAME' may already be checked out. See: git worktree list"
        exit 1
    }
else
    git worktree add "$TARGET_PATH" -b "$FEATURE_NAME" || {
        echo "Error: Failed to create worktree at $TARGET_PATH"
        exit 1
    }
fi

echo "Worktree ready at: $TARGET_PATH"
echo "  cd $TARGET_PATH"

# Open in Cursor if requested
if [ "$OPEN_CURSOR" = true ]; then
    cursor "$TARGET_PATH"
fi
