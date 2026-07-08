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
        sourcesPath: join(dir, "sources.jsonl"),
        observationsPath: join(dir, "observations.jsonl"),
        reflectionsPath: join(dir, "reflections.jsonl"),
        droppedPath: join(dir, "dropped.jsonl"),
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
export function readSources(store) {
    return readJsonl(store.sourcesPath);
}
export function appendSources(store, sources) {
    if (sources.length === 0)
        return;
    ensureStore(store);
    for (const source of sources)
        appendFileSync(store.sourcesPath, `${JSON.stringify(source)}\n`, "utf8");
}
export function readObservations(store) {
    return readJsonl(store.observationsPath);
}
export function appendObservations(store, observations) {
    if (observations.length === 0)
        return;
    ensureStore(store);
    for (const observation of observations)
        appendFileSync(store.observationsPath, `${JSON.stringify(observation)}\n`, "utf8");
}
export function readReflections(store) {
    return readJsonl(store.reflectionsPath);
}
export function appendReflections(store, reflections) {
    if (reflections.length === 0)
        return;
    ensureStore(store);
    for (const reflection of reflections)
        appendFileSync(store.reflectionsPath, `${JSON.stringify(reflection)}\n`, "utf8");
}
export function readDropped(store) {
    return readJsonl(store.droppedPath);
}
export function appendDropped(store, drops) {
    if (drops.length === 0)
        return;
    ensureStore(store);
    for (const drop of drops)
        appendFileSync(store.droppedPath, `${JSON.stringify(drop)}\n`, "utf8");
}
export function readMemoryFiles(store) {
    return {
        observations: readObservations(store),
        reflections: readReflections(store),
        dropped: readDropped(store)
    };
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
export function readSessionIndex(sessionId, env = process.env) {
    const path = join(omRoot(env), "sessions", safeId(sessionId), "index.json");
    if (!existsSync(path))
        return undefined;
    try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        if (parsed.sessionId === sessionId && typeof parsed.threadId === "string" && parsed.threadId.trim()) {
            return {
                sessionId,
                threadId: parsed.threadId,
                updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
            };
        }
    }
    catch {
        return undefined;
    }
    return undefined;
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
