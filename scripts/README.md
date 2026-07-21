# scripts/

Dev/ops helpers — not part of the bot runtime. Run with `bun run scripts/<name>.ts`.

- `smoke-openrouter.ts` — manual smoke test: sends one real image to the configured model and prints the raw output. Verifies OpenRouter + `openai/gpt-5.2` vision + structured output actually work. **Run this before relying on the model** (needs a real `OPENROUTER_API_KEY`; makes a real network + billed call).
