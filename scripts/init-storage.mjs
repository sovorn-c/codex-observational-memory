#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
const root = join(codexHome, "observational-memory");

const defaultConfig = {
  llm: {
    provider: "codex",
    model: "gpt-5.4-mini",
    apiKey: ""
  },
  memory: {
    observeAfterTokens: 10000,
    reflectAfterTokens: 20000,
    observationsPoolMaxTokens: 20000,
    observationsPoolTargetTokens: 10000
  },
  debug: false
};

function writeJsonIfMissing(path, value) {
  if (existsSync(path)) return;
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

mkdirSync(join(root, "threads"), { recursive: true });
mkdirSync(join(root, "sessions"), { recursive: true });
mkdirSync(join(root, "debug"), { recursive: true });

writeJsonIfMissing(join(root, "config.json"), defaultConfig);
writeJsonIfMissing(join(root, "install.json"), {
  name: "codex-observational-memory",
  packageVersion: packageJson.version,
  storageVersion: 1,
  initializedAt: new Date().toISOString(),
  note: "Thread sources and ledgers are created by Codex hooks after turns."
});

process.stdout.write(`codex-observational-memory initialized storage at ${root}\n`);
