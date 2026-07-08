export function isMemoryId(id) {
    return typeof id === "string" && /^[a-f0-9]{12}$/.test(id);
}
