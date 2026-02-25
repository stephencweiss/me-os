#!/bin/bash
# Removes a git worktree and optionally deletes the branch

WORKTREE_BASE="../worktrees/$(basename "$PWD")"

usage() {
    echo "Usage: $0 [-d] <feature-name>"
    echo "  -d  Also delete the local branch"
    exit 1
}

DELETE_BRANCH=false
while getopts "d" flag; do
    case "${flag}" in
        d) DELETE_BRANCH=true;;
        *) usage;;
    esac
done
shift $((OPTIND-1))

FEATURE_NAME=$1
if [ -z "$FEATURE_NAME" ]; then usage; fi

TARGET_PATH="$WORKTREE_BASE/$FEATURE_NAME"

# Remove worktree
git worktree remove "$TARGET_PATH" || {
    echo "Error: Failed to remove worktree. Try: git worktree remove --force $TARGET_PATH"
    exit 1
}

# Optionally delete branch
if [ "$DELETE_BRANCH" = true ]; then
    git branch -d "$FEATURE_NAME" 2>/dev/null || \
    git branch -D "$FEATURE_NAME" && echo "Branch '$FEATURE_NAME' deleted"
fi

echo "Worktree removed: $TARGET_PATH"
