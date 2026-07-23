# Onboarding + editable profile fields — design

Date: 2026-07-23 · Branch: `onboarding-profile-fields`

## Goal

Extend onboarding and `/settings` with three profile fields, all editable after setup:

- **current weight** — already exists (`weight_kg`); make it editable in `/settings`.
- **target weight** — new.
- **purchase country** — new; the country the user buys most of their food in.

Approved decisions (brainstorm): both new fields **wire into behaviour** (not stored-only);
country entered via a **curated button list** (+ "Other → type it"); onboarding keeps its flow
shape (insert steps, no redesign). Target weight uses the **safe** wiring — no fabricated
bodyweight-delta calorie formula.

## Data model — migration v5

`ALTER TABLE users`:

- `target_weight_kg DOUBLE PRECISION` — same sentinel as `weight_kg`: `NULL`=never asked,
  `0`=skipped, `>0`=kg. `profileOf` maps `0`→`null`.
- `country TEXT` — `NULL`=never asked, `''`=skipped, else a curated code (`de`/`ru`/…) or a raw
  "other" string. `profileOf`: `country || null`.
- `pending_input TEXT` — settings-only: which field the user's **next text message** fills
  (`weight`/`target_weight`/`country`), else `NULL`.

Backfill (mirrors v2): users mid-onboarding (`state='profile'` with `goal` set) get
`target_weight_kg=0` and `country=''` so a newly-inserted step never consumes their next answer.

`UserRow`, `getUser`, `setProfile` whitelist, and `Profile` (`types.ts`) all gain the two profile
fields. A dedicated `setPendingInput(db, id, field|null)` handles the transient UI state.

## Onboarding — keep flow shape

`consent → [goal → current weight → target weight → country → restrictions] → active`.

Each new step has a **Skip** button (mirrors `weight_skip`). `resume()` routes to the first
unanswered field (goal → weight → target → country → restrictions). Restrictions stays terminal,
so `→ active` is unchanged. Target weight reuses `parseWeight` (30–300 kg, lbs conversion, echo).
Country: curated buttons set a code; "Other" nudges the user to type (leaves `country` null so the
next text is captured); free-typed text is stored raw. All copy via the injected translator; the
machine stays pure.

## Settings — new rows + first text-input path

Root gains **Current weight · Target weight · Country**, each showing its current value.

The settings machine has never taken text input. New mechanism, via `pending_input`:

1. Tap "Current weight" → `settingsStep` returns a view with `awaitInput: "weight"` + a prompt.
   `bot.ts` persists `pending_input = view.awaitInput ?? null` after **every** settings interaction
   (so tapping any other button clears a pending prompt).
2. The user's next **text** message: `processText` sees `pending_input` (before the router/caps),
   runs a pure `settingsInput(field, text, prof, t)` → parse + patch, re-render root, clear pending.
   Malformed → re-prompt, `awaitInput` persists.
3. Photos are never consumed (they stay meals). Country's curated buttons need no text; only
   "Other" arms `pending_input="country"`.

`settingsInput` is pure and unit-tested like `settingsStep`.

## Behavioural wiring (both fields)

- **`targets.ts`** — protein anchors to the **goal** weight when cutting (`goal==="lose"` &&
  target set), otherwise current bodyweight; flat baseline when neither is known. Kcal
  (`KCAL_BY_GOAL`) is unchanged — no invented deficit math. `weightRemainingKg(profile)` returns
  signed `current − target` (kg) for display.
- **`analyzer.ts` `buildUserText`** — a country prior ("shops for groceries in {country} — prefer
  local product names, packaging sizes, portion norms…"), additive to the existing lang-derived
  `cuisineHint`. When both weights are known, a line framing verdicts against progress to target.
- **`/me` card** — shows target + country; a progress line (`X kg to your target` / at-goal) when
  computable.

## Country vocabulary (`src/country.ts`)

`COUNTRIES = ["de","ru","us","gb","fr","es","it","nl","pl","tr"]` + `isCountryCode`. `COUNTRY_EN`
maps code → English name for the prompt. `countryForPrompt(country)` resolves code→English, passes
a raw string through, maps `''`/null→null. `parseCountry(text)` trims, caps length, null on empty.
Button labels are localized (`country.<code>` in every locale). An i18n test couples the catalog
to the exported `COUNTRIES` list.

## Tests (TDD)

`db.test` (v5 columns, setters, mapping, backfill) · `onboarding.test` (new steps, skip, resume) ·
`settings.test` (new pickers, pure `settingsInput`) · `targets.test` (protein anchor, remaining) ·
`analyzer.test` (country prior in prompt) · `bot.test` (pending_input capture, cancel,
photo-not-consumed) · `country.test` · i18n parity + country vocabulary.

## Callback namespaces (unchanged discipline)

Onboarding: bare `target_weight_skip`, `country_<code>`, `country_other`, `country_skip`.
Settings: `st:weight`, `st:targetw`, `st:country`, `st:country:<code>`, `st:country:other`.
