#!/bin/sh
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
exec node "${SCRIPT_DIR}/../dist/src/claude/hooks/pre-tool-use.js"
