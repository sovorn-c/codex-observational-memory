#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { foldLedger, rawTokensSinceObservationCoverage, rawTokensSinceReflectionCoverage, tokenSum } from "./ledger/fold.js";
import { recall } from "./ledger/recall.js";
import { renderMemory } from "./ledger/render.js";
import { readLedger, readSources, threadStore } from "./storage.js";
import { consolidateThread, type ConsolidationMode } from "./workers/consolidate.js";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function threadArg(): string {
  return argValue("--thread") || process.env.CODEX_THREAD_ID || "default";
}

function usage(): never {
  process.stderr.write(`Usage:
  codex-observational-memory status --thread <id>
  codex-observational-memory view [--full] --thread <id>
  codex-observational-memory recall <id> --thread <id>
  codex-observational-memory consolidate [--mode observe|reflect|drop|all] --thread <id>
  codex-observational-memory hook --event <event>
`);
  process.exit(2);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command) usage();
  if (command === "hook") {
    await import("./hooks/entry.js");
    return;
  }
  const store = threadStore(threadArg());
  if (command === "status") {
    const config = loadConfig();
    const ledger = readLedger(store);
    const sources = readSources(store);
    const folded = foldLedger(ledger);
    process.stdout.write([
      `Thread: ${store.threadId}`,
      `Sources: ${sources.length}`,
      `Observations: ${folded.observations.length} recorded / ${folded.droppedObservationIds.size} dropped / ${folded.activeObservations.length} active`,
      `Reflections: ${folded.reflections.length}`,
      `Next observation: ${rawTokensSinceObservationCoverage(ledger, sources)} / ${config.memory.observeAfterTokens} tokens`,
      `Next reflection: ${rawTokensSinceReflectionCoverage(ledger, sources)} / ${config.memory.reflectAfterTokens} tokens`,
      `Active observation pool: ${tokenSum(folded.activeObservations)} / ${config.memory.observationsPoolTargetTokens} target tokens`
    ].join("\n") + "\n");
    return;
  }
  if (command === "view") {
    const folded = foldLedger(readLedger(store));
    const observations = process.argv.includes("--full") ? folded.observations : folded.activeObservations;
    process.stdout.write(`${renderMemory(folded.reflections, observations) || "No observational memory recorded."}\n`);
    return;
  }
  if (command === "recall") {
    const id = process.argv[3];
    if (!id) usage();
    const result = recall(id, foldLedger(readLedger(store)), readSources(store));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "consolidate") {
    const mode = (argValue("--mode") ?? "all") as ConsolidationMode;
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
