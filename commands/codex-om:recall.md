---
description: Recall source evidence for a Codex Observational Memory id.
---

# /codex-om:recall

Recall exact source evidence for a source-backed OM observation or reflection id.

## Arguments

- `id`: required 12-character lowercase hex memory id.

## Workflow

1. Read the first argument from `$ARGUMENTS` as the memory id.
2. If no id is provided, ask for the id.
3. Call `om_recall` with the id.
4. Return the recalled observation/reflection and source evidence.

## Guardrails

- Do not use recall as broad search.
- Do not recall every id preemptively.
- Use recall only when exact provenance, wording, commands, errors, paths, decisions, or rationale matter.

## Output

Show the relevant evidence compactly. Do not run shell commands unless the MCP tool is unavailable.
