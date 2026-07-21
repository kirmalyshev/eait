# eait

**Send a photo of your meal, get calories and macros judged against your own goal.** A
self-hostable Telegram bot in TypeScript. Photos are never stored.

**Try it:** [@eait_bot](https://t.me/eait_bot) — a live demo running on the maintainer's API
budget, so it has a shared daily analysis cap. For unlimited use, run your own:
**[SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

> **Not medical advice.** Photo-based nutrition estimates are approximate. Don't make medical
> decisions with them.

## What it does

Send a photo. It estimates the items and grams, computes calories, protein, fat, carbs,
saturated fat and sodium, judges the meal against *your* profile, and adds it to your running
daily total.

- **Profile-driven, not one-size-fits-all.** Your goal (lose / maintain / gain) sets your
  targets. Declare a kidney or cholesterol restriction and the bot judges sodium or saturated
  fat too — and only then. Undeclared dimensions are never scored.
- **Wrong estimate? Just say so.** Reply to any meal message with "half that" or "no oil" and
  it re-estimates.
- **Photos are ephemeral by construction.** Downloaded to memory, analyzed, dropped. No image
  and no image path ever touches the database — enforced in code and covered by tests.
- **Three languages.** English, Russian, German, picked up from your Telegram client and
  changeable in `/settings`. The food names and notes the model writes are localized too, not
  just the bot's own copy.

**Commands:** `/start`, `/me`, `/settings`, `/help`, `/delete` — listed in Telegram's `/` menu
in your language.

## Self-hosting

**[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)** — credentials, access control, deployment on
macOS and Linux, and what it costs.

The short version:

```bash
git clone https://github.com/kirmalyshev/eait.git && cd eait
bun install
bun test                      # 197 tests, no credentials needed
cp .env.example .env          # TELEGRAM_BOT_TOKEN + OPENROUTER_API_KEY
bun run start
```

> **Set `ALLOWED_USER_IDS`** unless you intend an open bot, and `GLOBAL_DAILY_ANALYSIS_CAP` if
> you do. Every photo is a billed vision call on *your* key.

## How it's built

- **Stack:** TS/[bun](https://bun.sh), [grammy](https://grammy.dev) + `@grammyjs/runner`,
  `bun:sqlite` (builtin), `zod`, [i18next](https://www.i18next.com). Four runtime dependencies.
- **LLM:** OpenRouter behind a swappable `LLMProvider` (default `x-ai/grok-4.5`; any
  vision-capable model works). The analyzer owns the prompt and the zod-validated parse — the
  provider is thin transport, so swapping it is one file.
- **Storage:** one SQLite file. Every meal query is scoped `WHERE id = ? AND user_id = ?`.
- **Layout:** all logic under `src/`, tests co-located. See [AGENTS.md](AGENTS.md).

`bun test` · `bun run typecheck` · `bun run security`

## Privacy & security

- **[docs/PRIVACY.md](docs/PRIVACY.md)** — what the hosted bot collects, who else sees it, and
  how to erase it. Health-related restrictions are special-category data; the basis is explicit
  consent, withdrawable with `/delete`.
- **[SECURITY.md](SECURITY.md)** — how to report a vulnerability privately.

CI enforces `bun run security` (secret and personal-data scanning),
[gitleaks](https://github.com/gitleaks/gitleaks) over full history, `bun audit`, and
[Dependabot](.github/dependabot.yml). Local gate: `git config core.hooksPath .githooks`.

## Status

A personal side project, run on one person's API budget. No SLA, no uptime guarantee, no
support commitment. The demo bot may be capped, paused or retired without notice — self-host if
you depend on it.

## License

[MIT](LICENSE).
