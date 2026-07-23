# Dynamic limitations — design

Date: 2026-07-23 · Branch: `dynamic-limitations`

Approved decisions (brainstorm): limitations are **prompt-only** (no numeric caps, no new verdict
dimensions); onboarding **widens the existing restrictions step** rather than adding a new one;
`/settings` gets a typed field with an explicit **Clear** button.

## Problem

`restrictions` is a closed vocabulary of four tags (`kidneys`, `ldl`, `vegan`, `lowsugar`). Each
tag is load-bearing: it drives a numeric cap in `targetsFor` (`satfat_g`, `sodium_mg`) and a
structured verdict dimension the analyzer's JSON schema knows about (`verdicts.kidneys`,
`verdicts.ldl`).

Anything outside those four is **lost**. At onboarding the user answers a free-text question
("Any health or dietary restrictions?"), `parseRestrictions` keyword-matches it (with
`classifyRestrictions` as the LLM fallback), the matches collapse to tags — and the words the user
actually typed are discarded. A user who writes "allergic to peanuts, gastritis so nothing spicy"
gets zero tags and zero effect on any future analysis.

## Solution

A second, complementary field: **`limitations`** — free text, stored verbatim, injected into the
LLM prompt so it colours every verdict and note. No numeric caps, no new verdict dimensions.

The two fields divide cleanly:

| | `restrictions` | `limitations` |
|---|---|---|
| Shape | closed tag vocabulary | free text |
| Drives | numeric caps in `targetsFor` + structured `verdicts.*` | prompt only |
| Set by | onboarding keyword/LLM classification; `/settings` toggles | onboarding free text; `/settings` typed input |
| Unchanged by this work | — | new |

`restrictions` is untouched by this change.

## Naming

`limitations` sits close enough to `restrictions` that a future reader will conflate them. The
boundary is documented explicitly in `src/AGENTS.md` (see Documentation below) rather than carried
by the name. Decided 2026-07-23: keep `limitations` (the principal's word); the AGENTS.md line is
the mitigation.

## Architecture

### 1. Domain — `src/limitations.ts` (new)

Per `src/AGENTS.md` ("new domain rule → its own file"). Pure, no I/O.

```
export const LIMITATIONS_MAX_LEN = 300;   // matches CAPTION_INPUT_CAP
export const LIMITATIONS_DISPLAY_LEN = 60; // truncation for the /settings + /me summary lines

export function parseLimitations(text: string): string | null
export function limitationsDisplay(value: string): string
```

`parseLimitations` normalizes user text into a form safe to interpolate into a prompt:

1. strip C0/C1 control characters
2. collapse every whitespace run (including newlines) to a single space
3. trim
4. cap at `LIMITATIONS_MAX_LEN` characters
5. return `null` when the result is empty

Single-line output is the containment property that matters: it is the same discipline
`parseCountry` already applies, and it is why the injected value cannot break out of its quoted
sentence in the prompt.

`limitationsDisplay` truncates to `LIMITATIONS_DISPLAY_LEN` with an ellipsis for the `/settings`
and `/me` summary lines, and returns shorter values unchanged.

### 2. Storage — `src/db.ts`

Migration **v6**:

```sql
ALTER TABLE users ADD COLUMN limitations TEXT
```

**No backfill.** This is the direct consequence of choosing to widen the existing onboarding step
rather than add a new one: the flow order does not change, so no mid-flow user can have their next
message consumed by a question that did not exist when they started. (Migrations v2 and v5 both
needed backfill `UPDATE`s for exactly that hazard; v6 does not.)

Sentinels mirror `country` exactly:

- `NULL` — never asked
- `''` — explicitly skipped or cleared
- otherwise — the raw normalized text

`UserRow.limitations: string | null` gains a doc comment stating those sentinels.
`setProfile`'s field whitelist gains `limitations` (one `!== undefined` branch, values travel as
`$n` parameters like every other field).

### 3. Read boundary — `profileOf` (`src/tg_bot/bot.ts`)

`Profile.limitations?: string | null`. Mapped the same way as `country`:

```ts
limitations: u.limitations ? u.limitations : null,   // '' = skipped → unknown outside the boundary
```

No validation warning: unlike `lang` and `reply_format` there is no vocabulary to be off, so any
stored string is legitimate.

### 4. Prompt injection — `src/analyzer.ts`

**One chokepoint**: `buildUserText`. It is shared by `analyzeMeal` (photos, albums) and
`routeText` (Q&A, text meals, corrections), so a single append covers every LLM path that judges
food.

Inserted immediately **after** the `Do NOT set verdicts for dimensions the user did not declare`
line, so the verdict contract stays contiguous and unpolluted:

```
The user also declared these personal limitations: "<text>" — respect them when judging
this meal, and call out any conflict in notes.
```

Emitted only when `profile.limitations` is non-empty. The value is quoted, already single-line
(`parseLimitations`), and re-sliced to `LIMITATIONS_MAX_LEN` at the injection site — the same
belt-and-braces the caption and country priors use, so a hand-edited database row cannot smuggle a
multi-line payload into the prompt.

Deliberately phrased to route the effect into `notes` and the **existing** verdict dimensions. The
JSON schema's `verdicts` object is fixed at `weight`/`ldl`/`kidneys`; the copy must never invite
the model to invent a fourth key, which zod would strip anyway.

### 5. Onboarding — `src/onboarding.ts`

**No new step, no new predicate, no flow reordering.** The existing restrictions step stops
throwing the user's words away:

- text answer → `patch: { restrictions: parseRestrictions(text), limitations: parseLimitations(text) ?? "" }`
- `restrictions_skip` → `patch: { restrictions: [], limitations: "" }`

`OnboardingResult.patch` gains `limitations?: string`. `OnboardingUser` is **not** extended —
the machine never reads the field, because no step is derived from it.

`applyOnboarding` persists it with `!== undefined`, never a truthiness check — `''` is the
explicit-skip sentinel and must reach the database, same rule weight/target/country already
follow.

**Non-interaction with the LLM fallback:** `maybeClassify` in `bot.ts` fires only when
`parseRestrictions` returned `[]`, and it overwrites `r.patch.restrictions` only. The
`limitations` patch set by `step()` from the same raw text passes through untouched. This is worth
a test.

Copy change: `onboarding.askRestrictions` widens to invite anything, not just the four tag
concepts — e.g. "Any health or dietary restrictions? Allergies, conditions, foods you avoid —
write freely, or tap Skip."

**Accepted edge:** a user who types "none" instead of tapping Skip stores `limitations = "none"`,
which renders as `The user also declared these personal limitations: "none"` — a harmless no-op
for the model, and clearable in `/settings`. A cross-locale negation vocabulary would be a
half-working heuristic that rots; not built.

**Existing active users** keep `limitations = NULL` (never asked) — `resume()` never re-opens
onboarding for them. They set it in `/settings`.

### 6. Settings — `src/settings.ts`

`PENDING_INPUTS` gains `"limitations"`; `SettingsView.patch` gains `limitations?: string`. Both
are literal-union-checked, so the db marker keeps validating at the read boundary.

**Root view** gains a summary line and a button:

```
Limitations: no peanuts, gastritis — nothing spicy
[ ✏️ Limitations ]            → st:limits
```

Value truncated to `LIMITATIONS_DISPLAY_LEN`, or `me.noLimitations` when unset.

**Limitations view** (`st:limits`) — a text prompt carrying `awaitInput: "limitations"`:

```
Type your limitations — allergies, conditions, foods you avoid.
Current: no peanuts, gastritis — nothing spicy

[ 🗑 Clear ]
[ ← Back ]
```

The `Current:` line and the `Clear` button appear **only when a value is set** — a Clear button
over an empty field is a dead control that patches `''` to no visible effect.

`st:limits:clear` → `patch: { limitations: "" }`, returns the root view.

`settingsInput` gains a `"limitations"` case: `parseLimitations` → on `null` re-prompt with
`awaitInput` still armed (the established "re-prompt, never break" rule); otherwise patch and
return the refreshed root.

### 7. Bot wiring — `src/tg_bot/bot.ts`

Almost nothing. The `pending_input` text-capture machine already handles arm / clear / re-prompt
generically, so the only edits are:

- `applySettingsView` — pass `limitations: v.patch.limitations` through to `setProfile`
- `applyOnboarding` — `if (r.patch?.limitations !== undefined) await setProfile(…)`
- `profileOf` — the mapping above

No change to text-routing precedence, caps, or the album/photo paths.

### 8. `/me`

A `me.limitationsLine` appended **only when set**. Not folded into `me.profileLine` — that line
already carries five fields and a sixth free-text one would make it unreadable on a phone.

### 9. i18n — `src/i18n/locales/{en,ru,de}.json`

New keys (all three locales; the parity test fails until they match):

- `settings.limitationsLine`
- `settings.button.limitations`
- `settings.button.clearLimitations`
- `settings.askLimitations`
- `settings.limitationsCurrent`
- `me.limitationsLine`
- `me.noLimitations`

Modified: `onboarding.askRestrictions` (widened, all three locales).

All copy stays plain text — no markup — per the plain-mode invariant. Rich-mode rendering escapes
every interpolated value in `render.ts` as it already does; the settings and `/me` surfaces are
plain-text sends.

## Testing

TDD throughout: failing test, watch it fail, implement, watch it pass, one logical change per
commit.

**`src/limitations.test.ts`** (new)
- trims and collapses whitespace runs, including newlines and tabs, to single spaces
- strips control characters
- caps at `LIMITATIONS_MAX_LEN`; a 500-char input yields exactly 300
- `""`, `"   "`, `"\n\n"` → `null`
- ordinary input round-trips unchanged
- display truncation adds an ellipsis past `LIMITATIONS_DISPLAY_LEN` and leaves shorter values alone

**`src/analyzer.test.ts`**
- prompt contains the limitations sentence when the profile has one
- prompt omits it entirely when `limitations` is `null` or `''`
- a multi-line/over-length stored value is still emitted as one bounded line (hand-edited-row guard)
- `routeText` prompts carry it too (shared `buildUserText` — asserted, not assumed)

**`src/settings.test.ts`**
- root renders the limitations line, truncated, and `me.noLimitations` when unset
- `st:limits` returns `awaitInput: "limitations"`, with Clear present when set and absent when not
- `st:limits:clear` patches `""` and returns root
- `settingsInput("limitations", …)` patches the parsed value and returns root with no `awaitInput`
- unparseable (whitespace-only) input re-prompts **with** `awaitInput` still armed
- tapping any other button clears a half-armed limitations prompt (existing rule, now covering the new field)

**`src/onboarding.test.ts`**
- the restrictions text answer patches BOTH `restrictions` tags and raw `limitations`
- `restrictions_skip` patches `restrictions: []` **and** `limitations: ""`
- a whitespace-only restrictions answer patches `limitations: ""`, not `null`

**`src/db.test.ts`**
- v6 migration adds the column; an existing database migrates without data loss
- `setProfile({ limitations })` round-trips, including `''`
- `setProfile({})` still no-ops

**`src/tg_bot/bot.test.ts`**
- `profileOf` maps `''` → `null` and passes real text through
- `applyOnboarding` persists `limitations: ""` (the `!== undefined` rule — a truthiness regression fails here)
- the `classifyRestrictions` fallback does not clobber a `limitations` patch
- a `/settings` limitations edit persists and appears in the next analyzer prompt

**i18n parity test** — fails until all three locales carry the new keys.

## Documentation

- `src/AGENTS.md` — a new invariant line drawing the `restrictions` vs `limitations` boundary, and
  extending the "Settings edits by TEXT" line to name `limitations`
- `src/tg_bot/AGENTS.md` — `pending_input` vocabulary now includes `limitations`; callback
  namespace line gains `st:limits`/`st:limits:clear`
- `docs/PRIVACY.md` — limitations are user-typed free text stored per user and sent to the LLM
  provider with every analysis; `/delete` removes them with the row
- `README.md` / `docs/SELF_HOSTING.md` — mention the field where the profile fields are listed

## Decided: restrictions and limitations are independent axes

The onboarding answer feeds both fields, so an answer with a known keyword ("kidneys, no sugar")
lands on both `/settings` rows and reads as redundant. Reviewed and **kept as-is** (2026-07-23):
never lose user input, and the two rows show genuinely different things — Restrictions is the
active cap + verdict dimension, Limitations is the raw note to the model. Non-reconciliation is
intentional: un-toggling a tag does not edit the prose, clearing the prose does not drop a tag.
Each knob is cleared where it is set. Pinned by a test so a future "dedupe" doesn't quietly couple
them.

## Out of scope

- Numeric enforcement (parsing "sugar under 50g" into a `FoodTargets` cap) — explicitly deferred;
  prompt-only was the chosen shape
- Replacing or retiring the four-tag `restrictions` vocabulary
- Per-limitation structured verdicts (the `verdicts` schema stays `weight`/`ldl`/`kidneys`)
- Multiple named limitations as separate rows — one free-text field is the whole feature
- Reconciling restrictions and limitations (deduping the rows, cascading a tag un-toggle into the
  prose) — decided against above; they are independent by design
