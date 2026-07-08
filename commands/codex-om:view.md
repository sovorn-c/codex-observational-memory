---
description: View source-backed Codex Observational Memory for the current thread.
---

# /codex-om:view

View rendered Codex Observational Memory for this thread.

## Arguments

- `full`: optional. If present, include full recorded observations rather than only active observations.

## Workflow

1. Parse `$ARGUMENTS`.
2. Call `om_view` with `full: true` only when the user passed `full`.
3. Show the rendered memory exactly enough to be useful inside the session.
4. Do not use this as broad transcript search. Use `/codex-om:recall <id>` for exact source evidence.

## Output

Return the rendered OM text. Do not run shell commands unless the MCP tool is unavailable.
