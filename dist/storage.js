import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { codexHome } from "./config.js";
import { hashId, localTimestamp, estimateStringTokens } from "./tokens.js";
export function omRoot(env = process.env) {
    return join(codexHome(env), "observational-memory");
}
export function threadStore(threadId, env = process.env) {
    const dir = join(omRoot(env), "threads", safeId(threadId));
    return {
        threadId,
        dir,
        ledgerPath: join(dir, "ledger.jsonl"),
        sourcesPath: join(dir, "sources.jsonl"),
        statePath: join(dir, "state.json")
    };
}
export function safeId(id) {
    const safe = id.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 128);
    return /[A-Za-z0-9]/.test(safe) ? safe : hashId(id);
}
function ensureStore(store) {
    mkdirSync(store.dir, { recursive: true });
}
function readJsonl(path) {
    if (!existsSync(path))
        return [];
    return readFileSync(path, "utf8")
        .split(/\n+/)
        .filter(Boolean)
        .flatMap((line) => {
        try {
            return [JSON.parse(line)];
        }
        catch {
            return [];
        }
    });
}
export function readLedger(store) {
    return readJsonl(store.ledgerPath);
}
export function appendLedger(store, record) {
    ensureStore(store);
    appendFileSync(store.ledgerPath, `${JSON.stringify(record)}\n`, "utf8");
}
export function readSources(store) {
    return readJsonl(store.sourcesPath);
}
export function appendSources(store, sources) {
    if (sources.length === 0)
        return;
    ensureStore(store);
    for (const source of sources)
        appendFileSync(store.sourcesPath, `${JSON.stringify(source)}\n`, "utf8");
    appendLedger(store, {
        type: "om.source.recorded",
        timestamp: localTimestamp(),
        sourceEntryIds: sources.map((source) => source.id),
        coversUpToId: sources.at(-1)?.id
    });
}
export function readState(store) {
    if (!existsSync(store.statePath))
        return { injectionDue: false, workerInFlight: false };
    try {
        return { injectionDue: false, workerInFlight: false, ...JSON.parse(readFileSync(store.statePath, "utf8")) };
    }
    catch {
        return { injectionDue: false, workerInFlight: false };
    }
}
export function writeState(store, state) {
    ensureStore(store);
    writeFileSync(store.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
export function writeSessionIndex(args, env = process.env) {
    if (!args.sessionId)
        return;
    const dir = join(omRoot(env), "sessions", safeId(args.sessionId));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.json"), `${JSON.stringify({
        sessionId: args.sessionId,
        threadId: args.threadId,
        updatedAt: localTimestamp()
    }, null, 2)}\n`, "utf8");
}
export function makeSourceEntry(args) {
    const timestamp = args.timestamp ?? localTimestamp();
    const basis = `${args.threadId}\n${args.sessionId ?? ""}\n${args.turnId ?? ""}\n${args.role ?? "unknown"}\n${args.kind ?? "message"}\n${timestamp}\n${args.content}`;
    return {
        id: hashId(basis),
        threadId: args.threadId,
        turnId: args.turnId,
        sessionId: args.sessionId,
        timestamp,
        role: args.role ?? "unknown",
        kind: args.kind ?? "message",
        content: args.content,
        tokenCount: estimateStringTokens(args.content)
    };
}
export function debugLogPath(env = process.env) {
    return join(omRoot(env), "debug", "hooks.ndjson");
}
export function appendDebug(event, data, env = process.env) {
    const path = debugLogPath(env);
    mkdirSync(join(omRoot(env), "debug"), { recursive: true });
    appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), event, data })}\n`, "utf8");
}
