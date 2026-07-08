#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recursionGuarded } from "../config.js";
import { foldLedger, rawTokensSinceObservationCoverage, rawTokensSinceReflectionCoverage } from "../ledger/fold.js";
import { renderMemory } from "../ledger/render.js";
import { appendLedger, appendDebug, appendSources, makeSourceEntry, readLedger, readSources, readState, threadStore, writeSessionIndex, writeState } from "../storage.js";
import { localTimestamp, hashId } from "../tokens.js";
import { loadConfig } from "../config.js";
import { findCodexSessionFile, readSessionSources } from "./session-source.js";

type HookPayload = Record<string, unknown>;

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString("utf8");
}

function parsePayload(raw: string): HookPayload {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? parsed as HookPayload : {};
  } catch {
    return { raw };
  }
}

function stringField(payload: HookPayload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function threadId(payload: HookPayload): string {
  return stringField(payload, ["threadId", "thread_id", "conversationId", "conversation_id"])
    || sessionId(payload)
    || process.env.CODEX_THREAD_ID
    || hashId(process.cwd());
}

function sessionId(payload: HookPayload): string | undefined {
  return stringField(payload, ["sessionId", "session_id"]) || process.env.CODEX_SESSION_ID;
}

function turnId(payload: HookPayload): string | undefined {
  return stringField(payload, ["turnId", "turn_id", "id"]);
}

function possibleText(payload: HookPayload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object" && "content" in value && typeof (value as { content?: unknown }).content === "string") {
      return (value as { content: string }).content;
    }
  }
  return undefined;
}

function extractSources(payload: HookPayload, tid: string): ReturnType<typeof makeSourceEntry>[] {
  const sid = sessionId(payload);
  const turn = turnId(payload);
  const sources: ReturnType<typeof makeSourceEntry>[] = [];
  const user = possibleText(payload, ["prompt", "userPrompt", "user_prompt", "input"]);
  if (user) sources.push(makeSourceEntry({ threadId: tid, sessionId: sid, turnId: turn, role: "user", kind: "prompt", content: user }));
  const assistant = possibleText(payload, ["response", "assistantResponse", "assistant_response", "output"]);
  if (assistant) sources.push(makeSourceEntry({ threadId: tid, sessionId: sid, turnId: turn, role: "assistant", kind: "response", content: assistant }));
  const messages = payload.messages;
  if (Array.isArray(messages)) {
    for (const message of messages) {
      if (!message || typeof message !== "object") continue;
      const record = message as Record<string, unknown>;
      const content = typeof record.content === "string" ? record.content : undefined;
      if (!content) continue;
      const role = record.role === "user" || record.role === "assistant" || record.role === "tool" || record.role === "system" ? record.role : "unknown";
      sources.push(makeSourceEntry({ threadId: tid, sessionId: sid, turnId: turn, role, kind: "message", content }));
    }
  }
  if (sources.length === 0 && typeof payload.raw === "string" && payload.raw.trim()) {
    sources.push(makeSourceEntry({ threadId: tid, sessionId: sid, turnId: turn, role: "hook", kind: "raw", content: payload.raw }));
  }
  return sources;
}

function renderForThread(tid: string): string {
  const store = threadStore(tid);
  const folded = foldLedger(readLedger(store));
  return renderMemory(folded.reflections, folded.activeObservations);
}

function injectIfDue(tid: string, reason: string): void {
  const store = threadStore(tid);
  const state = readState(store);
  const rendered = renderForThread(tid);
  if (!rendered) return;
  if (reason !== "SessionStart" && !state.injectionDue) return;
  process.stdout.write(`\n${rendered}\n`);
  appendLedger(store, { type: "om.injected", timestamp: localTimestamp(), reason });
  writeState(store, { ...state, injectionDue: false, lastInjectedAt: localTimestamp() });
}

function maybeSpawnConsolidation(tid: string): void {
  const config = loadConfig();
  const store = threadStore(tid);
  const ledger = readLedger(store);
  const sources = readSources(store);
  const observeDue = rawTokensSinceObservationCoverage(ledger, sources) >= config.memory.observeAfterTokens;
  const reflectDue = rawTokensSinceReflectionCoverage(ledger, sources) >= config.memory.reflectAfterTokens;
  if (!observeDue && !reflectDue) return;
  const cli = resolve(dirname(fileURLToPath(import.meta.url)), "../cli.js");
  const child = spawn(process.execPath, [cli, "consolidate", "--thread", tid], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env }
  });
  child.unref();
}

function sanitizedEnv(): Record<string, string | undefined> {
  return {
    CODEX_HOME: process.env.CODEX_HOME,
    CODEX_THREAD_ID: process.env.CODEX_THREAD_ID,
    CODEX_SESSION_ID: process.env.CODEX_SESSION_ID,
    PWD: process.env.PWD
  };
}

async function main(): Promise<void> {
  const event = argValue("--event") ?? "unknown";
  const raw = await readStdin();
  const payload = parsePayload(raw);

  if (event === "dump") {
    appendDebug("dump", { env: sanitizedEnv(), payload });
    return;
  }
  if (recursionGuarded()) return;

  const tid = threadId(payload);
  writeSessionIndex({ sessionId: sessionId(payload), threadId: tid });
  if (event === "SessionStart" || event === "UserPromptSubmit") {
    injectIfDue(tid, event);
    return;
  }
  if (event === "Stop") {
    const store = threadStore(tid);
    const state = readState(store);
    const sid = sessionId(payload);
    const sessionPath = sid ? findCodexSessionFile(sid) : undefined;
    const sessionCapture = sid && sessionPath
      ? readSessionSources({ path: sessionPath, offset: state.sessionSourceOffsets?.[sid] ?? 0, threadId: tid, sessionId: sid })
      : undefined;
    const directSources = sessionCapture && sessionCapture.sources.length > 0 ? [] : extractSources(payload, tid);
    const existingIds = new Set(readSources(store).map((source) => source.id));
    const sources = [...directSources, ...(sessionCapture?.sources ?? [])].filter((source) => !existingIds.has(source.id));
    appendSources(store, sources);
    if (sessionCapture && sid) {
      writeState(store, {
        ...readState(store),
        sessionSourceOffsets: { ...readState(store).sessionSourceOffsets, [sid]: sessionCapture.nextOffset }
      });
    }
    maybeSpawnConsolidation(tid);
    return;
  }
  if (event === "PreCompact") return;
  if (event === "PostCompact") {
    const store = threadStore(tid);
    appendLedger(store, { type: "om.compaction", timestamp: localTimestamp(), native: true });
    writeState(store, { ...readState(store), injectionDue: true });
  }
}

main().catch((error) => {
  appendDebug("hook.error", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
