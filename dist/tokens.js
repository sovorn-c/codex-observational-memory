import { createHash } from "node:crypto";
export function estimateStringTokens(text) {
    return Math.ceil(text.length / 4);
}
export function hashId(content) {
    return createHash("sha256").update(content).digest("hex").slice(0, 12);
}
function pad(n) {
    return String(n).padStart(2, "0");
}
export function localTimestamp(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function stableJson(value) {
    return JSON.stringify(value, Object.keys(value).sort());
}
