# codex-observational-memory Execute Plan

## 1. Product Decision

Build `codex-observational-memory` as a Codex-native plugin that supplements Codex compaction with source-backed observational memory.

Do not replace Codex native compaction. Do not edit Codex session JSONL files. The effective context after compaction should be:

```text
Codex native compacted context
+
OM reflections
+
OM active observations
```

Recommend this Codex setting in the README, but never write it automatically:

```toml
# ~/.codex/config.toml
model_auto_compact_token_limit = 160000
```

Default OM thresholds:

```json
{
  "observeAfterTokens": 10000,
  "reflectAfterTokens": 20000,
  "observationsPoolMaxTokens": 20000,
  "observationsPoolTargetTokens": 10000
}
```

## 2. Source-Backed Provider Plan

Provider docs checked on 2026-07-08:

| Provider | v1 status | Default/suggested model | Docs |
| --- | --- | --- | --- |
| Codex CLI | Default, works out of the box | `gpt-5.4-mini` | Local `codex debug models` shows only `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, and hidden `codex-auto-review`. |
| OpenRouter | Supported | `deepseek/deepseek-v4-flash` | https://openrouter.ai/docs/quickstart, https://openrouter.ai/docs/api/reference/overview, https://openrouter.ai/deepseek/deepseek-v4-flash |
| OpenCode Go | Supported | `deepseek-v4-flash` | https://opencode.ai/docs/go/, https://opencode.ai/docs/providers/ |
| OpenAI API | Supported | `gpt-5.4-nano` | https://developers.openai.com/api/docs/models/gpt-5.4-nano |
| Gemini | Supported | `gemini-3.1-flash-lite` | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-lite, https://ai.google.dev/gemini-api/docs/api-key, https://ai.google.dev/api/generate-content |

Important provider facts for implementers:

- OpenRouter uses `POST https://openrouter.ai/api/v1/chat/completions` with OpenAI-compatible chat-completion schema and `Authorization: Bearer <OPENROUTER_API_KEY>`.
- OpenRouter DeepSeek V4 Flash model ID is `deepseek/deepseek-v4-flash`.
- OpenCode Go DeepSeek V4 Flash uses `POST https://opencode.ai/zen/go/v1/chat/completions` with `@ai-sdk/openai-compatible` semantics and model ID `deepseek-v4-flash`.
- OpenCode Go docs also list Anthropic-compatible `/messages` endpoints for some models. v1 only needs the OpenAI-compatible `/chat/completions` path because the requested default is DeepSeek V4 Flash.
- OpenAI API `gpt-5.4-nano` is documented for lower-cost, high-volume work, but it is not exposed in this local Codex CLI catalog. Treat it as an external OpenAI API worker option only.
- Gemini `gemini-3.1-flash-lite` is GA and cost/latency optimized. Use Gemini generate-content style requests for v1.

## 3. Configuration Contract

Configuration precedence:

```text
environment variables
>
$CODEX_HOME/observational-memory/config.json
>
built-in defaults
```

Primary user-editable config file:

```text
$CODEX_HOME/observational-memory/config.json
```

Default `CODEX_HOME` fallback:

```text
~/.codex
```

This means the default config path is:

```text
~/.codex/observational-memory/config.json
```

Config file schema:

```json
{
  "llm": {
    "provider": "codex",
    "model": "gpt-5.4-mini",
    "apiKey": ""
  },
  "memory": {
    "observeAfterTokens": 10000,
    "reflectAfterTokens": 20000,
    "observationsPoolMaxTokens": 20000,
    "observationsPoolTargetTokens": 10000
  },
  "debug": false
}
```

The plugin code reads this file. Codex itself does not interpret these keys. The LLM must never receive `apiKey`, provider config, or full config contents in prompts.

Security warning for README: `config.json` is plaintext local config. It is convenient for desktop use, but environment variables are safer for secrets in shared machines, shell history-conscious workflows, or automation.

Environment variable overrides:

```bash
OM_LLM_PROVIDER=codex
OM_LLM_MODEL=gpt-5.4-mini
OM_LLM_API_KEY=
OM_OBSERVE_AFTER_TOKENS=10000
OM_REFLECT_AFTER_TOKENS=20000
OM_OBSERVATIONS_POOL_MAX_TOKENS=20000
OM_OBSERVATIONS_POOL_TARGET_TOKENS=10000
OM_DEBUG=0
```

Default no-env behavior:

```bash
OM_LLM_PROVIDER=codex
OM_LLM_MODEL=gpt-5.4-mini
```

README config examples:

```json
{
  "llm": {
    "provider": "openrouter",
    "apiKey": "sk-or-...",
    "model": "deepseek/deepseek-v4-flash"
  }
}
```

```json
{
  "llm": {
    "provider": "opencode-go",
    "apiKey": "...",
    "model": "deepseek-v4-flash"
  }
}
```

```json
{
  "llm": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-5.4-nano"
  }
}
```

```json
{
  "llm": {
    "provider": "gemini",
    "apiKey": "...",
    "model": "gemini-3.1-flash-lite"
  }
}
```

For user shorthand, accept `OM_LLM_PROVIDER=deepseek` as an alias for `openrouter` in v1. Normalize it internally to:

```bash
OM_LLM_PROVIDER=openrouter
OM_LLM_MODEL=deepseek/deepseek-v4-flash
```

Emit a warning recommending `openrouter` or `opencode-go` as the explicit provider.

## 4. Repository Implementation

Use TypeScript/Node for the first implementation.

Create this package layout:

```text
package.json
tsconfig.json
README.md
execute-plan.md
.codex-plugin/plugin.json
hooks/hooks.json
skills/codex-observational-memory/SKILL.md
src/cli.ts
src/config.ts
src/storage.ts
src/tokens.ts
src/ledger/types.ts
src/ledger/fold.ts
src/ledger/render.ts
src/ledger/recall.ts
src/workers/prompts.ts
src/workers/run-observer.ts
src/workers/run-reflector.ts
src/workers/run-dropper.ts
src/providers/index.ts
src/providers/codex.ts
src/providers/openai-compatible.ts
src/providers/openai.ts
src/providers/gemini.ts
src/hooks/entry.ts
src/mcp/server.ts
test/
```

Plugin manifest:

- Name: `codex-observational-memory`
- Version: `0.1.0`
- Description: `Source-backed observational memory for long Codex sessions.`
- Bundle the skill, MCP server config, and hooks.

MCP tools:

```text
om_status()
om_view({ full?: boolean })
om_recall({ id: string })
om_consolidate({ mode?: "observe" | "reflect" | "drop" | "all" })
```

Primary in-session slash commands:

```text
/codex-om:status
/codex-om:view
/codex-om:view full
/codex-om:recall <id>
/codex-om:consolidate [observe|reflect|drop|all]
```

The slash commands are the manual UX. MCP tools are the implementation surface underneath. Shell CLI commands are internal/debug only and should not be presented as the normal user workflow.

Hook events:

```text
SessionStart: print/inject current OM render if available.
UserPromptSubmit: print/inject OM render when the thread has memory and injection is due.
Stop: persist new source entries and enqueue consolidation if token thresholds are reached.
PreCompact: flush lightweight pending writes; do not block on slow worker calls.
PostCompact: write an om.compaction marker and mark OM injection due for the next turn.
```

Add a hook payload probe as the first implementation task:

```text
src/hooks/entry.ts --event dump
```

It should log sanitized hook stdin and env metadata to:

```text
$CODEX_HOME/observational-memory/debug/hooks.ndjson
```

Use it only during development to confirm exact Codex hook payloads. Keep it disabled by default.

Recursion guard:

```bash
CODEX_OBSERVATIONAL_MEMORY_WORKER=1
```

When this env var is set, hooks must exit without observing, reflecting, dropping, or injecting memory.

## 5. Storage And Data Model

Store generated OM state under:

```text
$CODEX_HOME/observational-memory/
```

Default `CODEX_HOME` fallback:

```text
~/.codex
```

Storage layout:

```text
$CODEX_HOME/observational-memory/
  config.json
  debug/hooks.ndjson
  threads/<thread-id>/ledger.jsonl
  threads/<thread-id>/sources.jsonl
  threads/<thread-id>/state.json
  sessions/<session-id>/index.json
```

Do not store secrets in OM files.

Ledger record types:

```text
om.source.recorded
om.observations.recorded
om.reflections.recorded
om.observations.dropped
om.compaction
om.injected
om.worker.error
```

Observation schema:

```ts
type Observation = {
  id: string; // 12 lowercase hex chars
  content: string;
  timestamp: string; // YYYY-MM-DD HH:mm
  relevance: "low" | "medium" | "high" | "critical";
  sourceEntryIds: string[];
  tokenCount: number;
};
```

Reflection schema:

```ts
type Reflection = {
  id: string; // 12 lowercase hex chars
  content: string;
  supportingObservationIds: string[];
  tokenCount: number;
};
```

Source record schema:

```ts
type SourceEntry = {
  id: string;
  threadId: string;
  turnId?: string;
  sessionId?: string;
  timestamp: string;
  role: "user" | "assistant" | "tool" | "system" | "hook" | "unknown";
  kind: string;
  content: string;
  tokenCount: number;
};
```

Use first-valid-record-wins for observations/reflections. Drops are tombstones that remove observations from active memory but not recall history.

Rendered memory:

```md
These are source-backed observational memories for this Codex thread.

- Reflections are durable facts distilled from prior observations.
- Observations are timestamped records from earlier thread history.
- Use om_recall(id) when exact source evidence matters.
- If Codex compacted summary conflicts with OM, prefer the newest source-backed observation unless the user says otherwise.

## Reflections
[abc123def456] Durable fact.

## Observations
[def456abc123] 2026-07-08 14:30 [high] Concrete observation.
```

## 6. Worker Execution

Worker interface:

```ts
type WorkerKind = "observer" | "reflector" | "dropper";

type WorkerRequest = {
  kind: WorkerKind;
  systemPrompt: string;
  userPrompt: string;
  responseSchemaName: string;
  maxOutputTokens: number;
};

type WorkerResponse = {
  provider: string;
  model: string;
  text: string;
  parsedJson?: unknown;
  inputTokens?: number;
  outputTokens?: number;
};
```

Provider adapters:

```ts
interface LlmProvider {
  name: string;
  model: string;
  runJson(request: WorkerRequest): Promise<WorkerResponse>;
}
```

Codex adapter:

```bash
CODEX_OBSERVATIONAL_MEMORY_WORKER=1 \
codex exec --ephemeral --ignore-rules -m "$OM_LLM_MODEL" -
```

Do not pass full thread history to worker calls. Pass only:

```text
current memory projection
source chunk since last observation coverage
JSON-only output instructions
```

OpenAI-compatible adapter:

- Used for OpenRouter and OpenCode Go DeepSeek.
- Request body shape:

```json
{
  "model": "<model>",
  "messages": [
    { "role": "system", "content": "<systemPrompt>" },
    { "role": "user", "content": "<userPrompt>" }
  ],
  "temperature": 0,
  "response_format": { "type": "json_object" }
}
```

OpenAI adapter:

- Use OpenAI API with `gpt-5.4-nano`.
- Prefer Responses API if available in SDK implementation; otherwise use Chat Completions with the same JSON-only prompt discipline.

Gemini adapter:

- Use Gemini generate-content style request.
- Put schema instructions in the prompt and parse the returned text as JSON.
- Fail loudly with a provider error if the returned text is not valid JSON.

Worker prompts:

- Observer emits new observations only, with exact `sourceEntryIds`.
- Reflector emits durable reflections with `supportingObservationIds`.
- Dropper emits observation IDs safe to tombstone, biased toward low relevance and already-covered observations.

Worker cadence:

- Run observer only when `rawTokensSinceObservationCoverage >= observeAfterTokens`.
- Run reflector only when `rawTokensSinceReflectionCoverage >= reflectAfterTokens`.
- Run dropper only after successful reflection and when active observation tokens exceed `observationsPoolTargetTokens`.
- Never run more than one worker pipeline per thread at a time.

## 7. Documentation Requirements

README must include:

- What OM adds over Codex native compaction.
- Why it does not edit Codex session files.
- Recommended `model_auto_compact_token_limit = 160000`.
- Default Codex worker path using `gpt-5.4-mini`.
- External provider setup examples for OpenRouter, OpenCode Go, OpenAI API, and Gemini.
- Provider docs links listed in section 2.
- Warning that `codex exec` has fixed prompt overhead, so workers are thresholded and batched.
- Security note: source records may contain user/project content; OM files are local generated state.

Skill instructions must tell Codex:

```text
Use OM as source-backed memory.
Use om_recall(id) for exact provenance.
Do not use recall as broad search.
Do not treat OM as stronger than explicit current user instructions.
When old Codex summary and OM conflict, prefer the newer source-backed OM observation.
```

## 8. Tests And Acceptance Criteria

Unit tests:

```text
config precedence and env aliases
provider adapter selection
OpenAI-compatible request construction
OpenCode Go model ID handling
Gemini JSON parse failure handling
ledger append/fold/drop semantics
rendered memory formatting
recall from active and dropped observations
token threshold calculations
recursion guard
```

Integration tests:

```text
source entries -> observer -> observations recorded
observations -> reflector -> reflections recorded
over-target active pool -> dropper -> tombstones recorded
PostCompact marker -> next injection due
Codex provider worker command includes --ephemeral and CODEX_OBSERVATIONAL_MEMORY_WORKER=1
external provider missing API key -> actionable error
```

Manual acceptance:

```text
Install plugin locally.
Start a new Codex thread; no OM injection appears before memory exists.
Generate enough source entries to cross observeAfterTokens; observations appear in om_view.
Cross reflectAfterTokens; reflections appear in om_view.
Run /compact or trigger native compaction; next turn receives OM render.
Run om_recall(id); original source evidence is returned.
Set ~/.codex/observational-memory/config.json to openrouter; confirm DeepSeek V4 Flash worker succeeds.
Set ~/.codex/observational-memory/config.json to opencode-go; confirm DeepSeek V4 Flash worker succeeds.
Set ~/.codex/observational-memory/config.json to openai; confirm gpt-5.4-nano worker succeeds if account has access.
Set ~/.codex/observational-memory/config.json to gemini; confirm gemini-3.1-flash-lite worker succeeds if key has access.
Set OM_LLM_PROVIDER env var over a conflicting config.json provider; confirm env override wins.
```

Definition of done:

- Plugin installs locally.
- Hooks do not recurse.
- Default Codex worker path works without external API keys.
- External providers are documented and wired through source-backed adapter code.
- OM survives Codex compaction by reinjecting rendered reflections and active observations.
- No code path mutates `~/.codex/sessions`.
