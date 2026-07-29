// LLM transport abstraction. Thin on purpose: the analyzer owns the prompt and the
// zod-validated parse; a provider only ships a chat request and returns the raw string.
// Swap providers via LLM_PROVIDER without touching analyzer/bot code.

export interface ChatRequest {
  system: string;
  userText: string;
  imagesB64?: string[]; // raw base64, no data: prefix; order preserved (albums send several)
  imageMime?: string; // default image/jpeg
  jsonSchema?: object; // when set, request structured output
  temperature?: number; // when set, forwarded verbatim; unset keeps the provider's default
  signal?: AbortSignal; // optional caller cancellation (in addition to the provider timeout)
}

export interface LLMProvider {
  chat(req: ChatRequest): Promise<string>;
}

// ---------------------------------------------------------------------------------------------
// DEV-ONLY AS OF THE MASTRA CUTOVER. Nothing in the bot runtime implements or calls this interface
// any more — `bot.ts` depends on the ports in `analyzePort.ts`, which are bound to the Mastra
// agent in `startBot`. What keeps `provider.ts` / `factory.ts` / `openrouter.ts` and the three
// `analyzer.ts` functions on disk is `scripts/`: the accuracy eval (`eval-meals.ts`) and the parity
// harness (`parity-llm-paths.ts`), which needs BOTH engines to compare them at all.
//
// They are deleted once the parity gate has actually run — deleting them first would remove the
// only baseline the cutover can be measured against, and "we deleted the thing that could have
// told us" is not a passing gate. See docs/design/2026-07-28-mastra-engine-boundary.md.
// ---------------------------------------------------------------------------------------------
