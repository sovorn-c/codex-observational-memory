import { OpenAiCompatibleProvider } from "./openai-compatible.js";
export class OpenAiProvider extends OpenAiCompatibleProvider {
    constructor(options) {
        super({
            name: "openai",
            model: options.model,
            apiKey: options.apiKey,
            baseUrl: options.baseUrl || "https://api.openai.com/v1/chat/completions"
        });
    }
}
