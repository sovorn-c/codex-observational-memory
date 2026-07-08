---
description: Manually run Codex Observational Memory consolidation for the current thread.
---

# /codex-om:consolidate

Manually run OM consolidation for this thread.

## Arguments

- `observe`: run observer only.
- `reflect`: run reflector only.
- `drop`: run dropper only.
- `all`: run the full eligible pipeline. Default.

## Workflow

1. Parse `$ARGUMENTS` as one of `observe`, `reflect`, `drop`, or `all`.
2. Call `om_consolidate` with that mode.
3. Report what changed.

## Guardrails

This is a maintenance/debug command. Normal session continuity should be automatic through hooks and thresholds.

## Output

Return a short result summary. Do not run shell commands unless the MCP tool is unavailable.
