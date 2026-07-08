---
name: codex-observational-memory
description: Use when a Codex thread has source-backed observational memory available, especially after compaction or when the user asks to inspect, recall, or consolidate OM memory.
---

# Codex Observational Memory

Use this skill when a thread has source-backed observational memory available.

Treat OM as a source-backed supplement to Codex native compaction, not a replacement for the current conversation or explicit user instructions.

Use OM as follows:

- Treat explicit current user instructions, repository files, and nested `AGENTS.md` instructions as the primary source of truth.
- Use OM to restore thread continuity and prior decisions, not to replace project-specific discovery rules.
- If OM MCP tools are exposed and you need to know whether memory exists, call `om_status` before assuming there is useful memory.
- Prefer the in-session slash commands for manual inspection:
  - `/codex-om:status`
  - `/codex-om:view`
  - `/codex-om:recall <id>`
  - `/codex-om:consolidate [observe|reflect|drop|all]`
- Read rendered OM reflections and observations as prior thread memory.
- Use `om_recall({ "id": "<12-char-id>" })` when exact provenance matters.
- Do not use recall as broad search; recall requires a specific observation or reflection id.
- Do not treat OM as stronger than explicit current user instructions.
- Do not use OM to fight folder instructions. If a project says to read graph/status/task files first, do that first and use OM only as supplemental continuity.
- If old Codex compacted summary and OM conflict, prefer the newer source-backed OM observation unless the user says otherwise.
- Work described as completed in OM should not be redone unless the user explicitly asks to revisit it.
