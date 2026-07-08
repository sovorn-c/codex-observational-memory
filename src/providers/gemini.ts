import type { LlmProvider, WorkerRequest, WorkerResponse } from "./index.js";
import { parseJsonText } from "./index.js";

export class GeminiProvider implements LlmProvider {
  name = "gemini";
  model: string;
  apiKey: string;
  baseUrl: string;

  constructor(options: { model: string; apiKey: string; baseUrl: string }) {
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`;
  }

  async runJson(request: WorkerRequest): Promise<WorkerResponse> {
    if (!this.apiKey) throw new Error("gemini requires OM_LLM_API_KEY or llm.apiKey.");
    const url = `${this.baseUrl}${this.baseUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${request.systemPrompt}\n\n${request.userPrompt}\n\nReturn only valid JSON matching ${request.responseSchemaName}.` }]
          }
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      })
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`gemini worker failed ${response.status}: ${body}`);
    const json = JSON.parse(body) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    return {
      provider: this.name,
      model: this.model,
      text,
      parsedJson: parseJsonText(text),
      inputTokens: json.usageMetadata?.promptTokenCount,
      outputTokens: json.usageMetadata?.candidatesTokenCount
    };
  }
}
