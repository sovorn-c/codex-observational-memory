import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { readSessionIndex, safeId, writeSessionIndex } from "../src/storage.js";

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
});
