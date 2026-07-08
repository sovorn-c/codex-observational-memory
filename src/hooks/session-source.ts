import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { codexHome } from "../config.js";
import { makeSourceEntry } from "../storage.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function parseLine(line: string): JsonRecord | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function payload(record: JsonRecord): JsonRecord {
  return isRecord(record.payload) ? record.payload : {};
}

function turnId(record: JsonRecord): string | undefined {
  const body = payload(record);
  if (typeof body.turn_id === "string") return body.turn_id;
  const metadata = body.internal_chat_message_metadata_passthrough;
  return isRecord(metadata) && typeof metadata.turn_id === "string" ? metadata.turn_id : undefined;
}

function contentText(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const parts = content.flatMap((part) => {
    if (!isRecord(part)) return [];
    return stringValue(part.text) ?? [];
  });
  return parts.length ? parts.join("\n") : undefined;
}

function sourceFromSessionRecord(record: JsonRecord, threadId: string, sessionId: string) {
  const body = payload(record);
  const timestamp = stringValue(record.timestamp);
  if (record.type === "event_msg" && body.type === "user_message") {
    const content = stringValue(body.message);
    return content ? makeSourceEntry({ threadId, sessionId, turnId: turnId(record), timestamp, role: "user", kind: "user_message", content }) : undefined;
  }
  if (record.type === "event_msg" && body.type === "agent_message") {
    const content = stringValue(body.message);
    const phase = stringValue(body.phase);
    return content ? makeSourceEntry({ threadId, sessionId, turnId: turnId(record), timestamp, role: "assistant", kind: phase ? `agent_message:${phase}` : "agent_message", content }) : undefined;
  }
  if (record.type === "response_item" && body.type === "function_call") {
    const name = stringValue(body.name) ?? "tool";
    const args = stringValue(body.arguments) ?? "";
    const content = args ? `${name} ${args}` : name;
    return makeSourceEntry({ threadId, sessionId, turnId: turnId(record), timestamp, role: "assistant", kind: "tool_call", content });
  }
  if (record.type === "response_item" && body.type === "function_call_output") {
    const content = stringValue(body.output);
    return content ? makeSourceEntry({ threadId, sessionId, turnId: turnId(record), timestamp, role: "tool", kind: "tool_output", content }) : undefined;
  }
  if (record.type === "response_item" && body.type === "custom_tool_call") {
    const name = stringValue(body.name) ?? "custom_tool";
    const input = stringValue(body.input) ?? "";
    const content = input ? `${name} ${input}` : name;
    return makeSourceEntry({ threadId, sessionId, turnId: turnId(record), timestamp, role: "assistant", kind: "tool_call", content });
  }
  if (record.type === "response_item" && body.type === "custom_tool_call_output") {
    const content = stringValue(body.output);
    return content ? makeSourceEntry({ threadId, sessionId, turnId: turnId(record), timestamp, role: "tool", kind: "tool_output", content }) : undefined;
  }
  return undefined;
}

export function findCodexSessionFile(sessionId: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const root = join(codexHome(env), "sessions");
  if (!existsSync(root)) return undefined;
  const matches: { path: string; mtimeMs: number }[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".jsonl") && basename(entry.name).includes(sessionId)) {
        matches.push({ path, mtimeMs: statSync(path).mtimeMs });
      }
    }
  }
  matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0]?.path;
}

export function readSessionSources(args: { path: string; offset: number; threadId: string; sessionId: string }) {
  const raw = readFileSync(args.path, "utf8");
  const start = args.offset > 0 && args.offset < raw.length ? args.offset : 0;
  const chunk = raw.slice(start);
  const sources = chunk
    .split(/\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const record = parseLine(line);
      if (!record) return [];
      const source = sourceFromSessionRecord(record, args.threadId, args.sessionId);
      return source ? [source] : [];
    });
  return { sources, nextOffset: raw.length };
}
