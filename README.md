# eait

A small standalone Telegram bot ([@eait_bot](https://t.me/eait_bot)) for a tiny closed circle. Each user does a 2-step onboarding (consent → goal + restrictions), then sends meal photos; every photo is analyzed against **that user's own profile** and logged per-user. **Images are ephemeral** — downloaded, analyzed, then deleted; nothing raw is persisted.

**Commands:** `/start`, `/me` (today's totals), `/settings` (goal, restrictions, language — all button-driven), `/help`, `/delete`. They appear in Telegram's `/` menu in your own language.

**Multi-language.** English, Russian, and German. The language is detected from your Telegram client on first contact and changed any time with `/lang` — including the food names and notes the model writes, not just the bot's own copy. Adding a language is one JSON file plus one registry line (see `src/README.md`).

Personal tool, **not a product** — no billing, moderation, growth, or web dashboard.

> **Disclaimer:** photo-based nutrition estimates are approximate and **not medical advice**. Do not use them for medical decisions.

## Quickstart

```bash
bun install
cp .env.example .env          # fill TELEGRAM_BOT_TOKEN + OPENROUTER_API_KEY
bun test                      # run the suite
bun run typecheck             # tsc --noEmit
bun run start                 # start the bot (long-polling)
```

- **Stack:** TS/bun, [grammy](https://grammy.dev) + `@grammyjs/runner`, `bun:sqlite` (builtin), `zod`, [i18next](https://www.i18next.com).
- **LLM:** OpenRouter (default model `openai/gpt-5.2`) behind a swappable `LLMProvider`.
- **Layout:** all logic under `src/`; no source in the repo root. See `AGENTS.md`.

## Security

Repo safety is enforced in CI (`.github/workflows/security.yml`):

- `bun run security` — custom scanner blocking secret patterns, personal-data leaks, and a tracked `.env`.
- [gitleaks](https://github.com/gitleaks/gitleaks) — secret scan over full git history.
- `bun audit` — dependency vulnerability check.
- [Dependabot](.github/dependabot.yml) — weekly bun + GitHub-Actions updates.

Enable the local pre-commit gate: `git config core.hooksPath .githooks`.

## License

[MIT](LICENSE).
