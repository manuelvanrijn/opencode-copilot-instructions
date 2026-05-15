---
description: Show active and pending .github/instructions
allowed-tools: Bash(node:*)
---

Run the instruction status check and display the current state.

!`node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/instructions.cjs status --project-dir "$CLAUDE_PROJECT_DIR" --state-dir "${CLAUDE_PLUGIN_ROOT}/hooks/state"`

Review the status output above. Tell the user:
- Which instruction files are always active
- Which conditional instructions exist and what paths activate them
- How many active sessions there are and what paths they've accumulated
