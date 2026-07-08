import { describe, expect, it } from "vitest";
import { maxDropCount, selectDropIds } from "../src/workers/run-dropper.js";
import type { Observation } from "../src/ledger/types.js";

const observations: Observation[] = [
  { id: "highhighhigh", content: "high", timestamp: "2026-07-08 10:00", relevance: "high", sourceEntryIds: ["s"], tokenCount: 10 },
  { id: "lowlowlowlow", content: "low", timestamp: "2026-07-08 09:00", relevance: "low", sourceEntryIds: ["s"], tokenCount: 10 }
];

describe("dropper helpers", () => {
  it("sizes max drops from target pressure", () => {
    expect(maxDropCount(observations, 10)).toBe(1);
  });

  it("prefers lower relevance when selecting drops", () => {
    expect(selectDropIds(["highhighhigh", "lowlowlowlow"], observations, 1)).toEqual(["lowlowlowlow"]);
  });
});
