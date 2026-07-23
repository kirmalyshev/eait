# Settings redesign + Food specifics (3 free-text fields) — design

Date: 2026-07-23 · Branch: `settings-food-specifics`

Approved decisions (brainstorm):
- `/settings` becomes a **2-level menu**: 4 groups → sub-menus. Tree: **Goal** (goal · weight ·
  target) / **Country** (picker) / **Food specifics** (restrictions tags + 3 free-text fields) /
  **Preferences** (language · style).
- **Food specifics free text splits into THREE labelled fields**: Medical limitations · Food
  allergies · Product limitations. Replaces the single `limitations` field shipped earlier today.
- The shipped `limitations` column is **dropped**; its one existing value migrates to
  `product_limitations`.

## Problem

The flat 8-button `/settings` is incoherent: current + target weight sit apart from Goal, and the
two "ограничения" rows (tag toggles + free text) read as duplicates. And a single free-text
`limitations` box under-serves the distinct things users need to state: medical conditions,
allergies (safety-critical), and specific products they avoid.

## Menu (2 levels)

```
⚙️ Settings (root)         text = full profile summary; buttons = 4 groups
├── 🎯 Goal      st:g:goal   → goal · weight · target      (item Back → st:g:goal)
├── 🛒 Country   st:country  → country picker              (Back → st:root; one screen, no group)
├── 🥗 Food      st:g:food   → restrictions · medical · allergies · products  (item Back → st:g:food)
└── 🎨 Prefs     st:g:prefs  → language · style            (item Back → st:g:prefs)
```

- **Callback namespace** gains `st:g:<group>` for the group menus. Existing item callbacks
  (`st:goal`, `st:weight`, `st:targetw`, `st:restr`, `st:lang`, `st:format`, `st:country*`) are
  unchanged; new item callbacks `st:medical`, `st:allergies`, `st:products` (+ `:clear`).
- **Back navigation is the crux.** `backRow` becomes parameterized by its target. An item screen's
  Back returns to its GROUP (`st:g:goal`/`st:g:food`/`st:g:prefs`); a group menu's Back returns to
  root; Country's Back returns to root (it is a top-level one-screen entry).
- **After an edit, return to the GROUP menu**, not root — the user stays in context. Group menus
  render a short summary of just that group's fields above the item buttons.
- Country stays top-level per the approved tree: tapping 🛒 Country opens the picker directly.

## Data model — migration v7

```sql
ALTER TABLE users ADD COLUMN medical_limitations  TEXT;
ALTER TABLE users ADD COLUMN food_allergies       TEXT;
ALTER TABLE users ADD COLUMN product_limitations  TEXT;
-- The one existing free-text value is a product avoidance ("низя есть гречку").
UPDATE users SET product_limitations = limitations WHERE limitations IS NOT NULL AND limitations <> '';
ALTER TABLE users DROP COLUMN limitations;
```

- **No `''` backfill.** Like `limitations` before it, none of these three is a step-gating field —
  `resume()`/`*Open` never read them, and every existing user is already `state='active'`, so
  onboarding never re-opens. The `''` vs `NULL` distinction stays inert (documented, not relied on).
- Sentinels per field mirror `country`: `NULL` = never asked, `''` = skipped/cleared, else text.
  `''` → `null` at the `profileOf` boundary.
- `UserRow`, `getUser`'s mapper, and `setProfile`'s whitelist gain all three (`?? null`, and each
  persisted on `!== undefined`).

## Types

`Profile` drops `limitations`, gains `medical_limitations`, `food_allergies`,
`product_limitations` — all `string | null`, required-with-null (build fails if a boundary forgets
one, the property that already caught a missed mapping once).

## Free-text machinery — reused, not rebuilt

`src/limitations.ts` is already field-agnostic: `parseLimitations` (containment via
`prompt_text.ts`), `limitationsDisplay`, `limitationsTruncated`, `LIMITATIONS_MAX_LEN`. All three
fields reuse it verbatim — same normalization (control/invisible/bidi/quote strip, lone-surrogate
strip, code-point truncation), same 300-cap + truncation notice, same Clear button. No new
containment code.

## Prompt — `buildUserText`

The single limitations line becomes three conditional, labelled lines (each contained + bounded at
the injection site, emitted only when set):

- `medical_limitations` → *"Medical conditions/dietary needs: "<x>" — weigh these in your verdicts and notes."*
- `food_allergies` → *"Food allergies: "<x>" — flag prominently in notes if the meal may contain any of these; never downplay an allergen."*
- `product_limitations` → *"Products the user avoids: "<x>" — call it out in notes if the meal includes one."*

Restrictions tags unchanged (still drive `targetsFor` caps + structured `verdicts`). Verdict schema
stays `weight`/`ldl`/`kidneys` — none of the three free-text lines invites a new verdict key.

## Onboarding

The single free-text restrictions question stays (asks tags + free text). Its free-text answer now
feeds **`medical_limitations`** as the broad health catch-all (was `limitations`); tags feed
`restrictions` as today. Allergies and product limitations are **settings-only refinements** — a
one-shot onboarding question can't classify into three buckets, and adding two more onboarding
steps is friction the closed user base doesn't need. All the round-2 hardening carries over
unchanged: truncation notice, all-invisible re-ask, and the classify/meter guard that keeps the
deterministic parse when the model path throws.

## `/me`

The single limitations line becomes up to three lines, each shown only when set (medical /
allergies / products), each `limitationsDisplay`-truncated. Omitted entirely when unset.

## i18n (en/ru/de; parity test enforces all)

New:
- `settings.group.goal` / `settings.group.food` / `settings.group.prefs` (group buttons)
- `settings.groupTitle.goal` / `.food` / `.prefs` (group menu headers, optional if the summary suffices)
- Per field × {medical, allergies, products}: `settings.button.<f>`, `settings.button.clear<F>`,
  `settings.<f>Line` (summary), `settings.ask<F>`, `settings.<f>Current`, `settings.<f>Invalid`,
  `settings.<f>Truncated` (or reuse the shared `limitationsTruncated`), `me.<f>Line`, `me.no<F>`
- Retire the `limitations`/`limitationsLine` keys the single field used, or repurpose them for one
  of the three (parity test guards drift either way).

All copy plain text; distinct labels per locale (the ru/de "Ограничения"/"Einschränkungen"
collision lesson — the three new labels must each differ from the tag "Restrictions" label and from
each other).

## Testing (TDD throughout)

- **db**: v7 adds three columns, migrates `limitations`→`product_limitations`, drops `limitations`;
  round-trips incl. `''`; `setProfile({})` no-ops; older-migration rewind tests updated.
- **types/profileOf**: each `''`→null, real text passes, three fields independent.
- **analyzer**: each field's labelled line present when set / absent when unset; router path
  inherits all three; hostile hand-edited value still contained per field.
- **settings (the menu)**: root shows 4 group buttons + summary; each `st:g:*` opens its items with
  Back→root; item Back→group; an edit returns to the group menu; the 3 text fields arm/clear/
  re-prompt/truncate-notice like the old field did; every sub-view's last row is a single Back.
- **onboarding**: free-text answer feeds `medical_limitations`; skip → sentinel; truncation notice;
  all-invisible re-ask.
- **bot**: profileOf mapping; applyOnboarding single-UPDATE still holds with the new fields; a typed
  field reaches the next analyzer prompt; i18n parity.

## Docs

`src/AGENTS.md` (the restrictions/limitations boundary line generalizes to "the three free-text
food fields"), `src/tg_bot/AGENTS.md` (callback namespace gains `st:g:*` + the new item callbacks;
`pending_input` vocab gains the three fields), `docs/PRIVACY.md` (three fields instead of one; the
allergy field is health data), `README`, `SELF_HOSTING`.

## Out of scope

- Auto-classifying a single onboarding answer into the three buckets (needs an LLM pass; not worth it)
- More than three free-text fields, or per-field structured caps (prompt-only, like limitations was)
- Reworking the tag `restrictions` vocabulary
