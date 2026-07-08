import { createHash } from "node:crypto";

export function estimateStringTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function hashId(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function localTimestamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}
