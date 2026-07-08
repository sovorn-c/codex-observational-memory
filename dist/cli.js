#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { foldMemoryFiles, rawTokensSinceSourceId, tokenSum } from "./memory/fold.js";
import { recall } from "./memory/recall.js";
import { renderMemory } from "./memory/render.js";
import { readMemoryFiles, readSources, readState, threadStore } from "./storage.js";
import { consolidateThread } from "./workers/consolidate.js";
function argValue(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}
function threadArg() {
    return argValue("--thread") || process.env.CODEX_THREAD_ID || "default";
}
function usage() {
    process.stderr.write(`Usage:
  codex-observational-memory status --thread <id>
  codex-observational-memory view [--full] --thread <id>
  codex-observational-memory recall <id> --thread <id>
  codex-observational-memory consolidate [--mode observe|reflect|drop|all] --thread <id>
  codex-observational-memory hook --event <event>
`);
    process.exit(2);
}
async function main() {
    const command = process.argv[2];
    if (!command)
        usage();
    if (command === "hook") {
        await import("./hooks/entry.js");
        return;
    }
    const store = threadStore(threadArg());
    if (command === "status") {
        const config = loadConfig();
        const sources = readSources(store);
        const state = readState(store);
        const folded = foldMemoryFiles(readMemoryFiles(store));
        process.stdout.write([
            `Thread: ${store.threadId}`,
            `Sources: ${sources.length}`,
            `Observations: ${folded.observations.length} recorded / ${folded.droppedObservationIds.size} dropped / ${folded.activeObservations.length} active`,
            `Reflections: ${folded.reflections.length}`,
            `Next observation: ${rawTokensSinceSourceId(state.observedSourceUpToId, sources)} / ${config.memory.observeAfterTokens} tokens`,
            `Next reflection: ${rawTokensSinceSourceId(state.reflectedSourceUpToId, sources)} / ${config.memory.reflectAfterTokens} tokens`,
            `Active observation pool: ${tokenSum(folded.activeObservations)} / ${config.memory.observationsPoolTargetTokens} target tokens`
        ].join("\n") + "\n");
        return;
    }
    if (command === "view") {
        const folded = foldMemoryFiles(readMemoryFiles(store));
        const observations = process.argv.includes("--full") ? folded.observations : folded.activeObservations;
        process.stdout.write(`${renderMemory(folded.reflections, observations) || "No observational memory recorded."}\n`);
        return;
    }
    if (command === "recall") {
        const id = process.argv[3];
        if (!id)
            usage();
        const result = recall(id, foldMemoryFiles(readMemoryFiles(store)), readSources(store));
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
    }
    if (command === "consolidate") {
        const mode = (argValue("--mode") ?? "all");
        const notes = await consolidateThread(store.threadId, mode);
        process.stdout.write(`${notes.join("\n")}\n`);
        return;
    }
    usage();
}
main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
