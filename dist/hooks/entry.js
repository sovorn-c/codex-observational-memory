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
function argValue(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}
async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return Buffer.concat(chunks).toString("utf8");
}
function parsePayload(raw) {
    if (!raw.trim())
        return {};
    try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "object" && parsed !== null ? parsed : {};
    }
    catch {
        return { raw };
    }
}
function stringField(payload, keys) {
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === "string" && value.trim())
            return value;
    }
    return undefined;
}
function threadId(payload) {
    return process.env.CODEX_THREAD_ID
        || stringField(payload, ["threadId", "thread_id", "conversationId", "conversation_id"])
        || hashId(process.cwd());
}
function sessionId(payload) {
    return process.env.CODEX_SESSION_ID || stringField(payload, ["sessionId", "session_id"]);
}
function turnId(payload) {
    return stringField(payload, ["turnId", "turn_id", "id"]);
}
function possibleText(payload, keys) {
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === "string" && value.trim())
            return value;
        if (value && typeof value === "object" && "content" in value && typeof value.content === "string") {
            return value.content;
        }
    }
    return undefined;
}
function extractSources(payload, tid) {
    const sid = sessionId(payload);
    const turn = turnId(payload);
    const sources = [];
    const user = possibleText(payload, ["prompt", "userPrompt", "user_prompt", "input"]);
    if (user)
        sources.push(makeSourceEntry({ threadId: tid, sessionId: sid, turnId: turn, role: "user", kind: "prompt", content: user }));
    const assistant = possibleText(payload, ["response", "assistantResponse", "assistant_response", "output"]);
    if (assistant)
        sources.push(makeSourceEntry({ threadId: tid, sessionId: sid, turnId: turn, role: "assistant", kind: "response", content: assistant }));
    const messages = payload.messages;
    if (Array.isArray(messages)) {
        for (const message of messages) {
            if (!message || typeof message !== "object")
                continue;
            const record = message;
            const content = typeof record.content === "string" ? record.content : undefined;
            if (!content)
                continue;
            const role = record.role === "user" || record.role === "assistant" || record.role === "tool" || record.role === "system" ? record.role : "unknown";
            sources.push(makeSourceEntry({ threadId: tid, sessionId: sid, turnId: turn, role, kind: "message", content }));
        }
    }
    if (sources.length === 0 && typeof payload.raw === "string" && payload.raw.trim()) {
        sources.push(makeSourceEntry({ threadId: tid, sessionId: sid, turnId: turn, role: "hook", kind: "raw", content: payload.raw }));
    }
    return sources;
}
function renderForThread(tid) {
    const store = threadStore(tid);
    const folded = foldLedger(readLedger(store));
    return renderMemory(folded.reflections, folded.activeObservations);
}
function injectIfDue(tid, reason) {
    const store = threadStore(tid);
    const state = readState(store);
    const rendered = renderForThread(tid);
    if (!rendered)
        return;
    if (reason !== "SessionStart" && !state.injectionDue)
        return;
    process.stdout.write(`\n${rendered}\n`);
    appendLedger(store, { type: "om.injected", timestamp: localTimestamp(), reason });
    writeState(store, { ...state, injectionDue: false, lastInjectedAt: localTimestamp() });
}
function maybeSpawnConsolidation(tid) {
    const config = loadConfig();
    const store = threadStore(tid);
    const ledger = readLedger(store);
    const sources = readSources(store);
    const observeDue = rawTokensSinceObservationCoverage(ledger, sources) >= config.memory.observeAfterTokens;
    const reflectDue = rawTokensSinceReflectionCoverage(ledger, sources) >= config.memory.reflectAfterTokens;
    if (!observeDue && !reflectDue)
        return;
    const cli = resolve(dirname(fileURLToPath(import.meta.url)), "../cli.js");
    const child = spawn(process.execPath, [cli, "consolidate", "--thread", tid], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env }
    });
    child.unref();
}
function sanitizedEnv() {
    return {
        CODEX_HOME: process.env.CODEX_HOME,
        CODEX_THREAD_ID: process.env.CODEX_THREAD_ID,
        CODEX_SESSION_ID: process.env.CODEX_SESSION_ID,
        PWD: process.env.PWD
    };
}
async function main() {
    const event = argValue("--event") ?? "unknown";
    const raw = await readStdin();
    const payload = parsePayload(raw);
    if (event === "dump") {
        appendDebug("dump", { env: sanitizedEnv(), payload });
        return;
    }
    if (recursionGuarded())
        return;
    const tid = threadId(payload);
    writeSessionIndex({ sessionId: sessionId(payload), threadId: tid });
    if (event === "SessionStart" || event === "UserPromptSubmit") {
        injectIfDue(tid, event);
        return;
    }
    if (event === "Stop") {
        const store = threadStore(tid);
        const sources = extractSources(payload, tid);
        appendSources(store, sources);
        maybeSpawnConsolidation(tid);
        return;
    }
    if (event === "PreCompact")
        return;
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
