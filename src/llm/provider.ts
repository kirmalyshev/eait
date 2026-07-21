// LLM transport abstraction. Thin on purpose: the analyzer owns the prompt and the
// zod-validated parse; a provider only ships a chat request and returns the raw string.
// Swap providers via LLM_PROVIDER without touching analyzer/bot code.

export interface ChatRequest {
  system: string;
  userText: string;
  imageB64?: string; // raw base64, no data: prefix
  imageMime?: string; // default image/jpeg
  jsonSchema?: object; // when set, request structured output
  signal?: AbortSignal; // optional caller cancellation (in addition to the provider timeout)
}

export interface LLMProvider {
  chat(req: ChatRequest): Promise<string>;
}
