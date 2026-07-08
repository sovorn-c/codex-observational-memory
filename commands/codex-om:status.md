---
description: Show Codex Observational Memory status for the current thread.
---

# /codex-om:status

Show the current Codex Observational Memory status for this thread.

## Workflow

1. Call `om_status` for the current thread.
2. Report observations recorded, active observations, dropped observations, reflections, and worker state if available.
3. Keep the output concise. This command is for session-continuity diagnostics, not a general memory conversation.

## Output

Use a compact status block. Do not run shell commands unless the MCP tool is unavailable.
