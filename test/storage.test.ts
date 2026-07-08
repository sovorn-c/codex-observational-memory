import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { appendDropped, appendObservations, appendReflections, readMemoryFiles, readSessionIndex, safeId, threadStore, writeSessionIndex } from "../src/storage.js";

function tempHome(): string {
  return join(tmpdir(), `om-storage-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

describe("storage", () => {
  it("round trips session index records", () => {
    const home = tempHome();
    mkdirSync(home, { recursive: true });
    const env = { CODEX_HOME: home } as NodeJS.ProcessEnv;
    writeSessionIndex({ sessionId: "session/1", threadId: "thread-1" }, env);

    expect(readSessionIndex("session/1", env)).toMatchObject({
      sessionId: "session/1",
      threadId: "thread-1"
    });
  });

  it("sanitizes unsafe ids", () => {
    expect(safeId("session/1")).toBe("session_1");
  });

  it("stores memory in Claude-style split files", () => {
    const home = tempHome();
    const env = { CODEX_HOME: home } as NodeJS.ProcessEnv;
    const store = threadStore("thread-1", env);

    appendObservations(store, [{
      id: "aaaaaaaaaaaa",
      content: "User prefers thread-local memory.",
      timestamp: "2026-07-08 12:00",
      relevance: "high",
      sourceEntryIds: ["src1"],
      tokenCount: 5
    }]);
    appendReflections(store, [{
      id: "bbbbbbbbbbbb",
      content: "Memory should be inspectable.",
      supportingObservationIds: ["aaaaaaaaaaaa"],
      tokenCount: 4
    }]);
    appendDropped(store, [{ observationId: "aaaaaaaaaaaa", timestamp: "2026-07-08 12:01", coversUpToId: "src1" }]);

    expect(readMemoryFiles(store)).toMatchObject({
      observations: [{ id: "aaaaaaaaaaaa" }],
      reflections: [{ id: "bbbbbbbbbbbb" }],
      dropped: [{ observationId: "aaaaaaaaaaaa" }]
    });
  });

});
