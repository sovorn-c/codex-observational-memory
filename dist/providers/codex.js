import { spawn } from "node:child_process";
import { parseJsonText } from "./index.js";
export class CodexProvider {
    model;
    name = "codex";
    constructor(model) {
        this.model = model;
    }
    async runJson(request) {
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
export function execCodex(model, prompt) {
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
            if (code === 0)
                resolve(stdout);
            else
                reject(new Error(`codex worker exited ${code}: ${stderr || stdout}`));
        });
        child.stdin.end(prompt);
    });
}
