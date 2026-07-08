import { spawn } from "node:child_process";
import type { LlmProvider, WorkerRequest, WorkerResponse } from "./index.js";
import { parseJsonText } from "./index.js";

export class CodexProvider implements LlmProvider {
  name = "codex";

  constructor(public model: string) {}

  async runJson(request: WorkerRequest): Promise<WorkerResponse> {
    const prompt = `${request.systemPrompt}

Return only JSON matching ${request.responseSchemaName}.

${request.userPrompt}`;
    const text = await execCodex(this.model, prompt);
    return {
      provider: this.name,
      model: this.model,
      text,
      parsedJson: parseJsonText(text)
    };
  }
}

export function execCodex(model: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", ["exec", "--ephemeral", "--ignore-rules", "-m", model, "-"], {
      env: { ...process.env, CODEX_OBSERVATIONAL_MEMORY_WORKER: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`codex worker exited ${code}: ${stderr || stdout}`));
    });
    child.stdin.end(prompt);
  });
}
