# AGENTS.md — src/

Domain logic — transport-agnostic. Focused files, co-located tests. The Telegram layer lives in
`src/tg_bot/` (its own `AGENTS.md`). Nothing here imports from it **except `index.ts`**, which is
the composition root and is allowed to know about the front end it starts. See the root
`AGENTS.md` for project-wide invariants.

## Invariants that bite here

- **Meal queries** are always `WHERE id = ? AND user_id = ?`; meal `id` = `crypto.randomUUID()`. Never a timestamp, never cross-user.
- **The analyzer owns the prompt and the zod parse.** `llm/` is transport only — no prompt strings, no meal-schema knowledge in the provider.
- **Images are ephemeral.** Bytes reach `analyzeMeal` in memory and are dropped; no image is ever written to disk and no photo path is stored.
- **Dates** use `Europe/Berlin` (`berlinDate` in `db.ts`), not UTC. To shift a stored `YYYY-MM-DD` by whole days, use `berlinDateMinus(date, n)` — calendar subtraction, DST-safe. **Never** `berlinDate(new Date(Date.now() - n*86_400_000))`: subtracting fixed 24h spans then re-deriving a Berlin date is off by one across a DST transition near midnight.
- **`RouteResult` is constructed only in `routeText`.** Its `meal` AND `redate` variants' `dayOffset` MUST each pass through `clampDayOffset` (→ integer `[0,7]`; out-of-contract values are clamped **and** warned) — two construction sites now, both clamp-and-warn. Any new `dayOffset`-bearing variant stays on the same rule; the "normalized" invariant is carried by convention, not the type. `routeText` ends in an `assertNever`, so a new intent added to the enum without a branch is a compile error rather than a silent fallthrough (the same guard sits at the end of `processText`).
- **A meal's date changes ONLY via reply-based re-date.** A text meal's `dayOffset` fixes its day at log time; `applyCorrection` never touches `date`. The one sanctioned way to move a logged meal is `setMealDate`, reached by replying to the meal's card with "move to yesterday" / "this was 2 days ago" (router `redate` intent — focus-meal-gated, applies immediately, macros unchanged). There is no free-text "move my beer" (no meal search) and no per-meal delete; `/delete` still wipes the whole account. The text-meal confirm prompt naming the resolved date remains the misparse guard — do not remove it.
- **No user-facing copy** outside `i18n/locales/*.json`. `reply.ts`, `onboarding.ts`, and `settings.ts` render only via a translator passed in from the caller. Layout separators (`"
"`, `", "`) are the exception and stay in code — a locale cannot currently reorder them.
- **`translatorFor(lang)`, never `i18n.changeLanguage()`.** Users are served concurrently, so a global language switch can render one user's locale into another's in-flight reply.
- **`onboarding.step()`, `settingsStep()`, and `settingsInput()` stay pure.** `t` is a value passed in, not I/O. The LLM restriction fallback lives in `tg_bot/bot.ts` for exactly this reason.
- **Onboarding is field-derived, not a step counter.** The flow is `goal → current weight → target weight → country → restrictions → active`; `resume()` and the `*Open` predicates pick the current step from which fields are still null. Skips store sentinels (`0` for weights, `''` for country) so "answered" is distinguishable from "never asked" — persist them with `!== undefined`, never a truthiness check, or the question re-opens on every resume.
- **Settings edits weight/target/country by TEXT, not buttons.** `settingsStep` returns a view with `awaitInput` for those fields (and country "Other"); the caller arms `users.pending_input`, and the next text message runs the pure `settingsInput` (see `tg_bot/AGENTS.md`). Country codes are still buttons.
- **Callback data is namespaced.** Settings owns `st:` (incl. `st:weight`/`st:targetw`/`st:country`/`st:country:*`), onboarding owns the bare `consent_*`/`goal_*`/`weight_skip`/`target_weight_skip`/`country_*`/`restrictions_*` names, `/delete` owns `delete_*`. Never reuse a prefix across machines — the receiving machine's state guards would reject the taps silently.
- **Copy is plain text; rich layout lives in `render.ts` only.** Plain mode sets no `parse_mode` anywhere, so markdown in a catalog value renders as literal characters at the user (a test enforces this). Rich mode (the user's effective format — `replyFormatFor`: `/settings` choice, else `REPLY_FORMAT`) renders exclusively via `render.ts` → `sendRichMessage` HTML, with `escapeHtml` on **every** interpolated value — LLM item names and notes must never be able to inject markup. Copy strings stay in locale JSON in both modes.

## Where to add things

- New domain rule → its own file (like `targets.ts`), re-exported types from `types.ts` (defined once, consumed unchanged).
- New LLM backend → a new file under `llm/` implementing `LLMProvider`, plus one entry in `llm/factory.ts`; select it with `LLM_PROVIDER`.
- New command, callback, or handler → `src/tg_bot/` (see `src/tg_bot/AGENTS.md`).
- New user-facing copy → a key in **every** `i18n/locales/*.json`; the parity test fails until they all have it.
- New language → see "Adding a language" in `src/README.md`. One JSON file + one `registry.ts` line.

## Verify

`bun test` (or a single file, e.g. `bun test src/db.test.ts`).
