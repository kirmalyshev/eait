# eait

A small standalone Telegram bot ([@eait_bot](https://t.me/eait_bot)) for a tiny closed circle. Each user does a 2-step onboarding (consent → goal + restrictions), then sends meal photos; every photo is analyzed against **that user's own profile** and logged per-user. **Images are ephemeral** — downloaded, analyzed, then deleted; nothing raw is persisted.

Personal tool, **not a product** — no billing, moderation, growth, or web dashboard.

> **Disclaimer:** photo-based nutrition estimates are approximate and **not medical advice**. Do not use them for medical decisions.

## Quickstart

```bash
bun install
cp .env.example .env          # fill TELEGRAM_BOT_TOKEN + OPENROUTER_API_KEY
bun test                      # run the suite
bun run start                 # start the bot (long-polling)
```

- **Stack:** TS/bun, [grammy](https://grammy.dev) + `@grammyjs/runner`, `bun:sqlite` (builtin), `zod`.
- **LLM:** OpenRouter (default model `openai/gpt-5.2`) behind a swappable `LLMProvider`.
- **Layout:** all logic under `src/`; no source in the repo root. See `AGENTS.md`.
