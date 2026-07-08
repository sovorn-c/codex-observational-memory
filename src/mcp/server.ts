#!/usr/bin/env node
import { foldLedger, tokenSum } from "../ledger/fold.js";
import { recall } from "../ledger/recall.js";
import { renderMemory } from "../ledger/render.js";
import { readLedger, readSessionIndex, readSources, readState, threadStore } from "../storage.js";
import { VERSION } from "../version.js";
import { consolidateThread, type ConsolidationMode } from "../workers/consolidate.js";

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown };

function threadId(params: unknown): string {
  if (params && typeof params === "object" && "threadId" in params && typeof (params as { threadId?: unknown }).threadId === "string") {
    return (params as { threadId: string }).threadId;
  }
  if (process.env.CODEX_THREAD_ID) return process.env.CODEX_THREAD_ID;
  if (process.env.CODEX_SESSION_ID) return readSessionIndex(process.env.CODEX_SESSION_ID)?.threadId || process.env.CODEX_SESSION_ID;
  return "default";
}

function toolList() {
  return {
    tools: [
      { name: "om_status", description: "Show observational memory status.", inputSchema: { type: "object", properties: { threadId: { type: "string" } } } },
      { name: "om_view", description: "Render current observational memory.", inputSchema: { type: "object", properties: { threadId: { type: "string" }, full: { type: "boolean" } } } },
      { name: "om_recall", description: "Recall source evidence for an observation or reflection id.", inputSchema: { type: "object", properties: { threadId: { type: "string" }, id: { type: "string" } }, required: ["id"] } },
      { name: "om_consolidate", description: "Run OM workers for a thread.", inputSchema: { type: "object", properties: { threadId: { type: "string" }, mode: { type: "string", enum: ["observe", "reflect", "drop", "all"] } } } }
    ]
  };
}

async function callTool(name: string, args: Record<string, unknown>) {
  const store = threadStore(threadId(args));
  if (name === "om_status") {
    const folded = foldLedger(readLedger(store));
    const sources = readSources(store);
    const state = readState(store);
    return { content: [{ type: "text", text: [
      `Thread: ${store.threadId}`,
      `Sources: ${sources.length} records / ${tokenSum(sources)} approx tokens`,
      `Observations: ${folded.observations.length} recorded / ${folded.activeObservations.length} active / ${folded.droppedObservationIds.size} dropped`,
      `Reflections: ${folded.reflections.length}`,
      `Injection due: ${state.injectionDue ? "yes" : "no"}`,
      `Worker in flight: ${state.workerInFlight ? "yes" : "no"}`,
      `Session offsets: ${Object.keys(state.sessionSourceOffsets ?? {}).length}`
    ].join("\n") }] };
  }
  if (name === "om_view") {
    const folded = foldLedger(readLedger(store));
    const observations = args.full === true ? folded.observations : folded.activeObservations;
    return { content: [{ type: "text", text: renderMemory(folded.reflections, observations) || "No observational memory recorded." }] };
  }
  if (name === "om_recall") {
    const id = typeof args.id === "string" ? args.id : "";
    return { content: [{ type: "text", text: JSON.stringify(recall(id, foldLedger(readLedger(store)), readSources(store)), null, 2) }] };
  }
  if (name === "om_consolidate") {
    const mode = typeof args.mode === "string" ? args.mode as ConsolidationMode : "all";
    const notes = await consolidateThread(store.threadId, mode);
    return { content: [{ type: "text", text: notes.join("\n") }] };
  }
  throw new Error(`Unknown tool: ${name}`);
}

function respond(id: JsonRpcRequest["id"], result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function respondError(id: JsonRpcRequest["id"], error: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message: error instanceof Error ? error.message : String(error) } })}\n`);
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    void handle(line);
  }
});

async function handle(line: string): Promise<void> {
  const request = JSON.parse(line) as JsonRpcRequest;
  try {
    if (request.method === "initialize") return respond(request.id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "codex-observational-memory", version: VERSION } });
    if (request.method === "tools/list") return respond(request.id, toolList());
    if (request.method === "tools/call") {
      const params = request.params as { name?: string; arguments?: Record<string, unknown> };
      return respond(request.id, await callTool(params.name ?? "", params.arguments ?? {}));
    }
    if (request.id !== undefined) respond(request.id, {});
  } catch (error) {
    respondError(request.id, error);
  }
}
