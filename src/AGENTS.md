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
- **Onboarding is field-derived, not a step counter.** The flow is `goal → current weight → target weight → country → restrictions → active`; `resume()` and the `*Open` predicates pick the current step from which fields are still null. Skips store sentinels (`0` for weights, `''` for country and `medical_limitations`) so "answered" is distinguishable from "never asked" — persist them with `!== undefined`, never a truthiness check, or the question re-opens on every resume.
- **`restrictions` and the three food-specifics fields are different things — never merge them.** `restrictions` is a CLOSED four-tag vocabulary (`targets.ts`); each tag drives a numeric cap in `targetsFor` **and** a structured verdict dimension the analyzer schema knows about (`verdicts.kidneys`/`verdicts.ldl`). `medical_limitations` / `food_allergies` / `product_limitations` are FREE TEXT, prompt-only: no caps, no verdict keys, each injected on its own labelled line in `buildUserText`. The `verdicts` object is fixed at `weight`/`ldl`/`kidneys` — never word a food line to invite a fourth key, zod strips it anyway. Onboarding's single restrictions question feeds two sides: `parseRestrictions` for tags, `parseLimitations` for the raw words into the `medical_limitations` catch-all (a one-shot question can't sort into three buckets; allergies/products are settings refinements). **They are independent axes on purpose — do not add reconciliation.** Un-toggling a tag does NOT edit the prose, and clearing one field does NOT touch a tag or another field.
- **`parseLimitations` / `normalizePromptText` is a containment boundary, not just a parser.** Each food value is interpolated INSIDE a quoted span in the prompt AND rendered into the plain-text cards, so it must stay single-line, quote-free, control/invisible/bidi/lone-surrogate-free (ZWJ/ZWNJ deliberately preserved). `buildUserText` re-applies it at the prompt sink and `limitationsDisplay`/`countryLabel` at the display sinks, because a hand-edited row never passed through it. All three fields reuse `limitations.ts` verbatim.
- **`/settings` is a 2-level menu.** Root = full summary + four GROUP buttons (`st:g:goal` / `st:country` / `st:g:food` / `st:g:prefs`; Country is a top-level one-screen entry). An item screen's Back returns to its GROUP; a group's Back and Country's Back return to root. After an edit the machine returns to the relevant GROUP, not root. The three food fields are table-driven (`FOOD_FIELDS`), not triplicated.
- **Settings edits weight/target/country and the three food fields by TEXT, not buttons.** `settingsStep` returns a view with `awaitInput` for those fields (and country "Other"); the caller arms `users.pending_input`, and the next text message runs the pure `settingsInput` (see `tg_bot/AGENTS.md`). Country codes are still buttons. Each food field offers `st:<field>:clear`, which stores the `''` sentinel.
- **Callback data is namespaced.** Settings owns `st:` (incl. group menus `st:g:goal`/`st:g:food`/`st:g:prefs`, `st:weight`/`st:targetw`/`st:country`/`st:country:*`, and the food fields `st:medical`/`st:allergies`/`st:products` + `:clear`), onboarding owns the bare `consent_*`/`goal_*`/`weight_skip`/`target_weight_skip`/`country_*`/`restrictions_*` names, `/delete` owns `delete_*`. Never reuse a prefix across machines — the receiving machine's state guards would reject the taps silently.
- **Copy is plain text; rich layout lives in `render.ts` only.** Plain mode sets no `parse_mode` anywhere, so markdown in a catalog value renders as literal characters at the user (a test enforces this). Rich mode (the user's effective format — `replyFormatFor`: `/settings` choice, else `REPLY_FORMAT`) renders exclusively via `render.ts` → `sendRichMessage` HTML, with `escapeHtml` on **every** interpolated value — LLM item names and notes must never be able to inject markup. Copy strings stay in locale JSON in both modes.

## Where to add things

- New domain rule → its own file (like `targets.ts`), re-exported types from `types.ts` (defined once, consumed unchanged).
- New LLM backend → a new file under `llm/` implementing `LLMProvider`, plus one entry in `llm/factory.ts`; select it with `LLM_PROVIDER`.
- New command, callback, or handler → `src/tg_bot/` (see `src/tg_bot/AGENTS.md`).
- New user-facing copy → a key in **every** `i18n/locales/*.json`; the parity test fails until they all have it.
- New language → see "Adding a language" in `src/README.md`. One JSON file + one `registry.ts` line.

## Verify

`bun test` (or a single file, e.g. `bun test src/db.test.ts`).
