# Engine boundary completion

*2026-08-02. Follows `2026-07-28-mastra-engine-boundary.md`, which created `src/engine/` and moved
the meal and text flows into it.*

## What was wrong

The July extraction did the diary half of the product and stopped. Three things were left, and they
were only visible if you asked what `src/api/` could actually do.

**The barrel was not enforced.** `engine/index.ts` says a front end imports from there and from
nowhere deeper. `api/` obeyed. `bot.ts` named six engine modules directly plus one re-export.
`boundary.test.ts` only checked the outward direction (engine must not import grammy/i18next/tg_bot),
so the inward half was documentation. Nothing breaks the day a surface reaches past the barrel — what
breaks is the answer to "what may a front end depend on", and the next extraction then has nothing to
extract against.

**The user lifecycle never moved.** `onboarding.ts` and `settings.ts` were pure state machines, but
everything with I/O around them — the read, the persistence, the LLM restriction fallback, the
`pending_input` arming — lived in `bot.ts`. The measurable consequence: the API had eight endpoints,
all of them about meals. It could log a meal for a user it had **no way to create and no way to
configure**. "Both front ends are peers" was true for exactly the half of the product that comes
after signup.

**Policy was left in the transport.** Cap *enforcement* was in `engine/caps.ts`; cap
*administration* was in `bot.ts`. The allowlist rules that matter — closing an open bot must
auto-include the admin, the admin can never be denied — were transport code, and both are the kind
of rule whose second implementation locks somebody out of their own instance. `/delete` and `/stats`
still held logic in their handler bodies and were, as `tg_bot/AGENTS.md` admitted, untested.

## What changed

| Area | Before | After |
|---|---|---|
| Barrel | one-directional check | `boundary.test.ts` checks both directions, `export … from` included |
| Onboarding | `processOnboarding` + `applyOnboarding` + `applyRestrictionFallback` in `bot.ts` | `engine/onboarding.ts` — `advanceOnboarding` |
| Settings | 5 functions in `bot.ts` | `engine/settings.ts` — open / action / input / language |
| `replyFormatFor` | `bot.ts` | `engine/profile.ts` |
| Cap + allowlist admin | `bot.ts` | `engine/admin.ts`, typed result unions |
| Erasure | `deleteUser` inline in a callback | `engine/admin.ts` — `deleteAccount` |
| `/delete`, `/stats` | handler bodies, untested | `process*` functions, 7 tests |
| API | 8 meal endpoints | + `/v1/onboarding`, `/v1/settings` (GET+POST), `/v1/language` |

## The one deliberate compromise

`advanceOnboarding` and the settings functions return a VIEW — `text` plus `buttons` — already
rendered in the user's language. Every other engine result is a code (`hint: "lowConfidence"`) with
the wording left to the surface.

The alternative was to return `{replyKey, replyParams, actions:[{labelKey, id}]}` and let each front
end render. It was rejected: the two state machines own a large body of copy **and a keyboard layout
per step**, and moving that into every front end guarantees they drift — the bot and a mobile client
would disagree about which options a step even offers.

The split actually taken:

- The engine picks the **language**. It is profile data, read from the row, and `i18n/registry.ts`
  (pure vocabulary) is already allowed in the engine.
- The caller supplies a **`TranslatorFactory`** that constructs the translator. Construction is
  `i18n/index.ts` and an i18next runtime, which the engine must never touch.

A factory rather than a ready-made translator, because on first contact the row does not exist until
`upsertUser` runs inside the engine call — resolving a translator before it would render every user's
first screen in the default language regardless of what they sent. There is a test for that.

The engine names the type through `Translator`, aliased in `src/onboarding.ts`, so no engine file has
`i18next` in an import specifier. The rule `boundary.test.ts` protects — never construct an instance,
never pick a language — still holds; `i18n/index.ts` stays banned.

`InlineButton.data` is an app-level action id (`goal_lose`, `st:weight`), not a Telegram type.
Telegram carries it in `callback_data`; an HTTP client posts it back as `action`.

## Two hardenings the move surfaced

**`submitSettingsInput` verifies the armed field.** The caller names the field it believes is open
and the engine checks it against `pending_input` instead of trusting it. On Telegram the runner
serializes per user so the two can never differ; over HTTP a client racing a button tap would have
its text written into whichever field is armed *now* — `"88.5"` landing in `country`. A mismatch is
`no-prompt` and writes nothing.

**Onboarding input is narrowed, not cast.** `step()` re-prompts on unrecognised callback data, so a
malformed request body would have looked to the client exactly like a stale tap, and it would never
have learned the request was wrong. It is a 400.

## Not done, on purpose

- **No `DELETE /v1/account`.** `resolveUserId` still resolves to `null` — the API is unauthenticated
  by design until a real scheme is chosen. Adding a destructive endpoint to that is strictly worse
  than not having one. It goes in when auth does.
- **The allowlist stays out of `EngineDeps`** and is passed as an argument. Its rules are engine
  rules, but the list itself gates *Telegram* access and `api/` authenticates its own way.
- **Copy is still rendered server-side** for onboarding and settings, per the compromise above.

## Verification

`bun test`: 1098 → 1151 passing, 0 failing. `bun run typecheck` clean, `bun run security` clean.
The engine lifecycle modules have direct tests (`engine/onboarding.test.ts`, `engine/settings.test.ts`)
driven with no Telegram in the call, and `api/routes.test.ts` runs a full signup-to-active flow over
HTTP alone.
