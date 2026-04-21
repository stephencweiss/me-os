#!/usr/bin/env bash
# Task ledger helpers (MeOS). Usage: source .claude/skills/orchestrate/ledger-helpers.sh
#
# Artifact dirs match .tasks/README.md (typescript reviews, not Swift).

set -euo pipefail

LEDGER_PATH="${LEDGER_PATH:-.tasks/ledger.json}"

ledger_init() {
    local goal="$1"
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    mkdir -p .tasks/artifacts/{architect,developer,reviews/{staff,dba,typescript,security,performance},qa,tester}

    cat > "$LEDGER_PATH" <<EOF
{
  "version": "1.0",
  "goal": "$goal",
  "created": "$timestamp",
  "updated": "$timestamp",
  "status": "planning",
  "tasks": []
}
EOF

    echo "Ledger initialized at $LEDGER_PATH"
}

# Usage: ledger_add_task "task-id" "description" "persona" "workspace" "dep1,dep2"
ledger_add_task() {
    local task_id="$1"
    local description="$2"
    local persona="$3"
    local workspace="${4:-null}"
    local dependencies="${5:-}"
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    local deps_json="[]"
    if [ -n "$dependencies" ]; then
        deps_json=$(echo "$dependencies" | jq -R 'split(",") | map(. | gsub("^\\s+|\\s+$";""))')
    fi

    local workspace_json="null"
    if [ "$workspace" != "null" ]; then
        workspace_json="\"$workspace\""
    fi

    local new_task
    new_task=$(cat <<EOF
{
  "id": "$task_id",
  "description": "$description",
  "persona": "$persona",
  "status": "pending",
  "workspace": $workspace_json,
  "artifact": null,
  "created": "$timestamp",
  "completed": null,
  "dependencies": $deps_json,
  "metadata": {}
}
EOF
)

    jq --argjson task "$new_task" '.tasks += [$task] | .updated = "'$timestamp'"' "$LEDGER_PATH" > "$LEDGER_PATH.tmp"
    mv "$LEDGER_PATH.tmp" "$LEDGER_PATH"

    echo "Added task: $task_id"
}

# Usage: ledger_update_status "task-id" "new-status" "artifact-path"
ledger_update_status() {
    local task_id="$1"
    local new_status="$2"
    local artifact="${3:-null}"
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    local artifact_json="null"
    if [ "$artifact" != "null" ]; then
        artifact_json="\"$artifact\""
    fi

    local completed_json="null"
    if [ "$new_status" = "done" ]; then
        completed_json="\"$timestamp\""
    fi

    jq '.tasks |= map(
        if .id == "'$task_id'" then
            .status = "'$new_status'" |
            .artifact = '$artifact_json' |
            .completed = '$completed_json' |
            .updated = "'$timestamp'"
        else . end
    ) | .updated = "'$timestamp'"' "$LEDGER_PATH" > "$LEDGER_PATH.tmp"
    mv "$LEDGER_PATH.tmp" "$LEDGER_PATH"

    echo "Updated task $task_id: status=$new_status"
}

ledger_check_deps() {
    local task_id="$1"

    local deps
    deps=$(jq -r '.tasks[] | select(.id == "'$task_id'") | .dependencies[]' "$LEDGER_PATH" 2>/dev/null || echo "")

    if [ -z "$deps" ]; then
        echo "✅ Task $task_id has no dependencies"
        return 0
    fi

    local all_done=true
    for dep in $deps; do
        local dep_status
        dep_status=$(jq -r '.tasks[] | select(.id == "'$dep'") | .status' "$LEDGER_PATH")

        if [ "$dep_status" != "done" ]; then
            echo "❌ Dependency $dep not done (status: $dep_status)"
            all_done=false
        else
            echo "✅ Dependency $dep is done"
        fi
    done

    if [ "$all_done" = true ]; then
        return 0
    else
        return 1
    fi
}

ledger_get_ready_tasks() {
    echo "Tasks ready to run:"

    jq -r '.tasks[] | select(.status == "pending") | .id' "$LEDGER_PATH" | while read -r task_id; do
        if ledger_check_deps "$task_id" 2>/dev/null; then
            local desc
            desc=$(jq -r '.tasks[] | select(.id == "'$task_id'") | .description' "$LEDGER_PATH")
            echo "  - $task_id: $desc"
        fi
    done
}

ledger_summary() {
    echo "=== Task Ledger Summary ==="
    echo
    echo "Goal: $(jq -r '.goal' "$LEDGER_PATH")"
    echo "Status: $(jq -r '.status' "$LEDGER_PATH")"
    echo "Updated: $(jq -r '.updated' "$LEDGER_PATH")"
    echo
    echo "Tasks:"
    jq -r '.tasks[] | "  [\(.status)] \(.id) - \(.description) (persona: \(.persona))"' "$LEDGER_PATH"
    echo
    echo "Progress: $(jq '[.tasks[] | select(.status == "done")] | length' "$LEDGER_PATH")/$(jq '.tasks | length' "$LEDGER_PATH") tasks complete"
}

ledger_complete() {
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    jq '.status = "completed" | .updated = "'$timestamp'"' "$LEDGER_PATH" > "$LEDGER_PATH.tmp"
    mv "$LEDGER_PATH.tmp" "$LEDGER_PATH"

    echo "✅ Ledger marked as completed"
}

export -f ledger_init
export -f ledger_add_task
export -f ledger_update_status
export -f ledger_check_deps
export -f ledger_get_ready_tasks
export -f ledger_summary
export -f ledger_complete
