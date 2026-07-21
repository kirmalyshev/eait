# AGENTS.md — src/

Domain logic — transport-agnostic. Focused files, co-located tests. The Telegram layer lives in
`src/tg_bot/` (its own `AGENTS.md`). Nothing here imports from it **except `index.ts`**, which is
the composition root and is allowed to know about the front end it starts. See the root
`AGENTS.md` for project-wide invariants.

## Invariants that bite here

- **Meal queries** are always `WHERE id = ? AND user_id = ?`; meal `id` = `crypto.randomUUID()`. Never a timestamp, never cross-user.
- **The analyzer owns the prompt and the zod parse.** `llm/` is transport only — no prompt strings, no meal-schema knowledge in the provider.
- **Images are ephemeral.** Bytes reach `analyzeMeal` in memory and are dropped; no image is ever written to disk and no photo path is stored.
- **Dates** use `Europe/Berlin` (`berlinDate` in `db.ts`), not UTC.
- **No user-facing copy** outside `i18n/locales/*.json`. `reply.ts`, `onboarding.ts`, and `settings.ts` render only via a translator passed in from the caller. Layout separators (`"
"`, `", "`) are the exception and stay in code — a locale cannot currently reorder them.
- **`translatorFor(lang)`, never `i18n.changeLanguage()`.** Users are served concurrently, so a global language switch can render one user's locale into another's in-flight reply.
- **`onboarding.step()` and `settingsStep()` stay pure.** `t` is a value passed in, not I/O. The LLM restriction fallback lives in `tg_bot/bot.ts` for exactly this reason.
- **Callback data is namespaced.** Settings owns `st:`, onboarding owns the bare `consent_*`/`goal_*`/`restrictions_*` names, `/delete` owns `delete_*`. Never reuse a prefix across machines — the receiving machine's state guards would reject the taps silently.
- **Copy is plain text.** Nothing sets `parse_mode`, so markdown in a catalog value renders as literal characters at the user (a test enforces this).

## Where to add things

- New domain rule → its own file (like `targets.ts`), re-exported types from `types.ts` (defined once, consumed unchanged).
- New LLM backend → a new file under `llm/` implementing `LLMProvider`, plus one entry in `llm/factory.ts`; select it with `LLM_PROVIDER`.
- New command, callback, or handler → `src/tg_bot/` (see `src/tg_bot/AGENTS.md`).
- New user-facing copy → a key in **every** `i18n/locales/*.json`; the parity test fails until they all have it.
- New language → see "Adding a language" in `src/README.md`. One JSON file + one `registry.ts` line.

## Verify

`bun test` (or a single file, e.g. `bun test src/db.test.ts`).
