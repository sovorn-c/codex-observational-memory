import { parseJsonText } from "./index.js";
export class OpenAiCompatibleProvider {
    name;
    model;
    apiKey;
    baseUrl;
    constructor(options) {
        this.name = options.name;
        this.model = options.model;
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl;
    }
    requestBody(request) {
        return {
            model: this.model,
            messages: [
                { role: "system", content: request.systemPrompt },
                { role: "user", content: `${request.userPrompt}\n\nReturn only JSON matching ${request.responseSchemaName}.` }
            ],
            temperature: 0,
            response_format: { type: "json_object" }
        };
    }
    async runJson(request) {
        if (!this.apiKey)
            throw new Error(`${this.name} requires OM_LLM_API_KEY or llm.apiKey.`);
        const response = await fetch(this.baseUrl, {
            method: "POST",
            headers: {
                "authorization": `Bearer ${this.apiKey}`,
                "content-type": "application/json"
            },
            body: JSON.stringify(this.requestBody(request))
        });
        const body = await response.text();
        if (!response.ok)
            throw new Error(`${this.name} worker failed ${response.status}: ${body}`);
        const json = JSON.parse(body);
        const text = json.choices?.[0]?.message?.content ?? "";
        return {
            provider: this.name,
            model: this.model,
            text,
            parsedJson: parseJsonText(text),
            inputTokens: json.usage?.prompt_tokens,
            outputTokens: json.usage?.completion_tokens
        };
    }
}
