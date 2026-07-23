# eait

**Send a photo of your meal, describe it in text, or just ask nutrition questions — eait
tracks calories and macros against your goal.** A self-hostable Telegram bot in TypeScript.
Photos are never stored.

**Try it:** [@eait_bot](https://t.me/eait_bot) — a live demo running on the maintainer's API
budget, so it has a shared daily analysis cap. For unlimited use, run your own:
**[SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

> **Not medical advice.** Photo-based nutrition estimates are approximate. Don't make medical
> decisions with them.

## What it does

Send a photo, describe a meal in text, or ask a question. It estimates items and grams,
computes calories, protein, fat, carbs, saturated fat and sodium, judges the meal against
*your* profile, and adds it to your running daily total.

- **Photo logging.** One photo or several in one album message — both get analyzed as a single
  meal, one LLM call. Downloaded to memory, analyzed, dropped; no image or image path ever
  reaches the database.
- **Text meal logging.** Describe what you ate in plain text; the bot confirms before saving
  so you can tweak the description.
- **Nutrition Q&A.** Ask anything about today's intake, your goal, or general nutrition — the
  bot answers with today's meals and 7-day totals as context.
- **Profile-driven, not one-size-fits-all.** Your goal (lose / maintain / gain) sets your
  targets. Declare a kidney or cholesterol restriction and the bot judges sodium or saturated
  fat too — and only then. Undeclared dimensions are never scored. Anything the tag list doesn't
  cover — "no peanuts", "low FODMAP", "gastritis, nothing spicy" — you just type, in
  `/settings → Limitations`, and it goes into every analysis from then on.
- **Wrong estimate? Just say so.** Reply to any meal analysis with "half that" or "no oil" and
  it re-estimates. Works on the bot's reply or on your original photo message.
- **Three languages.** English, Russian, German, picked up from your Telegram client and
  changeable in `/settings`. The food names and notes the model writes are localized too, not
  just the bot's own copy.
- **Your reply style.** Rich cards (tables and headings) or plain text with emojis — pick per
  account in `/settings → Style`; the instance's `REPLY_FORMAT` is only the default.

**Commands:** `/start`, `/me`, `/cap`, `/settings`, `/help`, `/delete` — listed in Telegram's
`/` menu in your language.

## Self-hosting

**[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)** — credentials, access control, deployment on
macOS and Linux, and what it costs.

The short version — docker is the only prerequisite:

```bash
curl -fsSLO https://raw.githubusercontent.com/kirmalyshev/eait/main/docker-compose.selfhost.yml
TELEGRAM_BOT_TOKEN=… OPENROUTER_API_KEY=… ALLOWED_USER_IDS=… \
  docker compose -f docker-compose.selfhost.yml up -d
```

One file, prebuilt image (`ghcr.io/kirmalyshev/eait`), bundled Postgres. Or, from a clone:

```bash
git clone https://github.com/kirmalyshev/eait.git && cd eait
./scripts/setup.sh
```

`setup.sh` checks prerequisites, installs dependencies, verifies the checkout, walks you
through `.env` (secrets are never echoed), optionally smoke-tests the model, and optionally
installs a background service — launchd on macOS, a systemd user unit on Linux. Re-running it
is safe.

> **Set `ALLOWED_USER_IDS`** unless you intend an open bot, and `GLOBAL_DAILY_ANALYSIS_CAP` if
> you do. Every photo is a billed vision call on *your* key.

## How it's built

- **Stack:** TS/[bun](https://bun.sh), [grammy](https://grammy.dev) + `@grammyjs/runner`,
  Postgres via the builtin `Bun.sql` client, `zod`, [i18next](https://www.i18next.com). Four
  runtime dependencies.
- **LLM:** OpenRouter behind a swappable `LLMProvider` (default `x-ai/grok-4.5`; any
  vision-capable model works). The analyzer owns the prompt and the zod-validated parse — the
  provider is thin transport, so swapping it is one file.
- **Storage:** one Postgres database per branch (auto-created on boot; a shared dockerized
  dev server ships in the repo). Every meal query is scoped `WHERE id = ? AND user_id = ?`.
- **Layout:** domain logic under `src/`, the Telegram adapter under `src/tg_bot/`, tests
  co-located. See [AGENTS.md](AGENTS.md).

`bun test` · `bun run typecheck` · `bun run security`

## Privacy & security

- **[docs/PRIVACY.md](docs/PRIVACY.md)** — what the hosted bot collects, who else sees it, and
  how to erase it. Health-related restrictions are special-category data; the basis is explicit
  consent, withdrawable with `/delete`.
- **[SECURITY.md](SECURITY.md)** — how to report a vulnerability privately.

CI enforces `bun run security` (secret and personal-data scanning),
[gitleaks](https://github.com/gitleaks/gitleaks) over full history, `bun audit`, and
[Dependabot](.github/dependabot.yml). Local gate: `git config core.hooksPath .githooks` — it runs both of those secret checks
(`bun run security` plus gitleaks over the staged diff) before a commit is written.

## Status

A personal side project, run on one person's API budget. No SLA, no uptime guarantee, no
support commitment. The demo bot may be capped, paused or retired without notice — self-host if
you depend on it.

## License

[MIT](LICENSE).
