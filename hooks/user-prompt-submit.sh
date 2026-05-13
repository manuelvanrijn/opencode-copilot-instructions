#!/bin/sh
SCRIPT_NAME=$(basename "$0")
HOOK_NAME=$(basename "$0" .sh)

PLUGIN_ROOT=""
if [ -f "./.claude-plugin/plugin.json" ]; then
  PLUGIN_ROOT=$(pwd)
fi

if [ -z "$PLUGIN_ROOT" ]; then
  for dir in ~/.factory/plugins/cache/opencode-copilot-instructions/copilot-instructions-plugin/*/; do
    if [ -f "$dir/.claude-plugin/plugin.json" ]; then
      PLUGIN_ROOT="$dir"
      break
    fi
  done
fi

if [ -z "$PLUGIN_ROOT" ]; then
  echo "ERROR: Could not find plugin root for $SCRIPT_NAME" >&2
  exit 1
fi

exec node "${PLUGIN_ROOT}dist/src/claude/hooks/${HOOK_NAME}.js"
