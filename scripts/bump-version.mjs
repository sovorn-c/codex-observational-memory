#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const VERSION_TS_PATH = "src/version.ts";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function nextVersion(current, mode) {
  if (SEMVER.test(mode)) return mode;
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Cannot bump non-simple semver version: ${current}`);
  const [, majorRaw, minorRaw, patchRaw] = match;
  let major = Number(majorRaw);
  let minor = Number(minorRaw);
  let patch = Number(patchRaw);
  if (mode === "patch") patch += 1;
  else if (mode === "minor") {
    minor += 1;
    patch = 0;
  } else if (mode === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else {
    throw new Error("Usage: npm run version:patch | version:minor | version:major | version:set -- <x.y.z>");
  }
  return `${major}.${minor}.${patch}`;
}

const mode = process.argv[2];
if (!mode) throw new Error("Missing version bump mode or explicit semver.");

const packageJson = readJson("package.json");
const pluginJson = readJson(".codex-plugin/plugin.json");
const packageLock = readJson("package-lock.json");
const version = nextVersion(packageJson.version, mode);

packageJson.version = version;
pluginJson.version = version;
packageLock.version = version;
if (packageLock.packages?.[""]) packageLock.packages[""].version = version;

writeJson("package.json", packageJson);
writeJson(".codex-plugin/plugin.json", pluginJson);
writeJson("package-lock.json", packageLock);
writeFileSync(VERSION_TS_PATH, `export const VERSION = "${version}";\n`);

console.log(`codex-observational-memory version set to ${version}`);
