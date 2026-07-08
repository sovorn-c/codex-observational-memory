import { OpenAiCompatibleProvider } from "./openai-compatible.js";

export class OpenAiProvider extends OpenAiCompatibleProvider {
  constructor(options: { model: string; apiKey: string }) {
    super({
      name: "openai",
      model: options.model,
      apiKey: options.apiKey,
      baseUrl: "https://api.openai.com/v1/chat/completions"
    });
  }
}
