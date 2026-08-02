# AGENTS.md — src/engine/

The transport-agnostic product engine. `tg_bot/` and `api/` are both **front ends over this**, and
neither is privileged. Design: `docs/design/2026-07-28-mastra-engine-boundary.md`, completed by
`docs/design/2026-08-02-engine-boundary-completion.md`.

## The rule that defines this folder

**An engine function takes a resolved `userId` plus typed input and returns a typed RESULT UNION.**
No rendering, no i18n, no transport types, no message ids. Nothing here may import `i18next`,
`grammy`, or anything under `tg_bot/` — if a change wants to, the change belongs in the surface.
**`boundary.test.ts` enforces this**, because nothing breaks at runtime the day it is violated: the
folder just quietly stops being transport-agnostic, and the next front end inherits Telegram's
assumptions. `i18n/registry.ts` (the locale vocabulary and its validator) IS allowed — a user's
language is profile data; `i18n/index.ts` is not, because it builds an i18next instance.

`hint` is a **code** (`"lowConfidence"`), never copy. The bot resolves it through `t()`; a mobile
client resolves it however it likes, and neither has to agree with the other about wording.

**One deliberate exception, and it is worth knowing why.** `onboarding.ts` and `settings.ts` return
a VIEW — `text` plus `buttons` — already rendered in the user's language. The state machines behind
them (`../onboarding.ts`, `../settings.ts`) own a large body of copy and a keyboard layout per step,
and turning every one into a key plus params would move that layout into each front end and
guarantee they drift. So the engine picks the LANGUAGE (it is profile data, read from the row) and
the caller supplies a `TranslatorFactory` that CONSTRUCTS the translator — which is the part the
engine must not do, because construction is `i18n/index.ts` and an i18next runtime.

`InlineButton.data` is an app-level action id (`goal_lose`, `st:weight`), not a Telegram type:
Telegram carries it in `callback_data`, HTTP posts it back as `action`. Those modules name the
translator through the `Translator` alias exported by `../onboarding.ts`, so no engine file has
`i18next` in an import specifier — that is not a trick played on `boundary.test.ts`, it is the rule
the test protects (never construct an instance, never pick a language) held while the exception
above is taken knowingly.

## Invariants that bite here

- **Caps live here, not in a surface.** Metering enforced by a transport is metering every other
  transport bypasses. `checkCaps` runs before any billed call, global bound included — a global cap
  enforced *after* the call costs exactly as much as no cap.
- **`userId` is an argument, never read from a body, a model output, or a tool call.** Telegram
  binds it from the update; `api/` binds it from the authenticated session. Same discipline as
  `RequestContext` one layer down, for the same reason.
- **Every meal read/write stays `WHERE id = ? AND user_id = ?`.** `mealById` is the by-id read; a
  client naming a stranger's meal id must resolve to nothing, not to their row (asserted in
  `api/routes.test.ts`).
- **Images are ephemeral.** `LogPhotoInput.images` are THUNKS, so nothing is downloaded or read
  until the caps have passed and a download failure costs no billed call. Bytes are held in memory,
  analyzed, and dropped — no disk, no object store, ever.
- **Dates in `Europe/Berlin`**; `berlinDateMinus` for day arithmetic, never `Date.now() - n*86_400_000`.
- **A refusal that carries a distinction must keep it.** `TargetGone.on` is `correction | redate`
  because the two give different guidance — a failed correction can be rephrased, a failed re-date
  cannot. Collapsing two refusals into one is how a surface starts lying.
- **Nothing here sends.** `onAccepted` is the one hook back to the caller; it is never awaited and a
  throw from it can never reach the pipeline.

- **The user LIFECYCLE lives here too, not only the diary.** `onboarding.ts` (`advanceOnboarding`)
  and `settings.ts` (`openSettings` / `applySettingsAction` / `submitSettingsInput` /
  `setUserLanguage`) mean a front end can CREATE and CONFIGURE a user, not just log meals for one
  that already exists. Before they moved, `api/` could do the second and not the first, which made
  "both front ends are peers" true only for the half of the product that comes after signup.
- **`submitSettingsInput` checks the caller's `field` against the armed `pending_input`.** On
  Telegram the runner serializes per user so the two can never differ; over HTTP a client racing a
  button tap would otherwise have its text written into whichever field is armed now — `"88.5"`
  landing in `country`. A mismatch is `no-prompt` and writes nothing.
- **Locale NEGOTIATION is the surface's, locale STORAGE is the engine's.** Telegram reads
  `language_code`, HTTP reads `Accept-Language`; both resolve to a `Lang` before the call. The
  engine takes `langHint` already resolved, because mapping a protocol's locale string needs
  `i18n/index.ts`. `upsertUser` writes `lang` on INSERT only, so a later hint never undoes a
  deliberate `/lang` choice.
- **Admin actions return two DISTINCT refusals.** `not-admin` and `no-admin-configured` are not
  interchangeable: an instance with no admin configured must stay silent, because answering
  advertises that the command exists. Collapsing them leaks the command to whoever guessed it.
- **`deleteAccount` is the one erasure.** Whichever front end asks, the same operation runs — a
  second implementation is how a table gets missed, and a missed table is a deletion that quietly
  did not happen. In-memory SURFACE state (the Telegram rejection log) is cleared by the surface,
  which is the only thing that knows what it holds.
- **The allowlist is an ARGUMENT, not part of `EngineDeps`.** Its rules are here (closing an open
  bot auto-includes the admin; the admin can never be denied) because they are the kind whose second
  implementation locks somebody out of their own instance. The list itself gates *Telegram* access,
  and `api/` authenticates its own way, so it does not belong in the shared deps.

## What deliberately did NOT move here

Album buffering, reactions, the rejection log, inline-button state machines, reply-to-message
mapping, and the Telegram text precedence chain (command > armed settings prompt >
reply-to-rejection > router). All are about how a *Telegram* message arrives. The surface resolves
precedence and a focus meal, then calls the engine with `text` + `focusMealId` — a UUID, not a
message id.

Editing a Telegram message in place instead of sending a new one, and mapping `language_code` to a
`Lang`, stay out for the same reason.

`edits.ts` is the same split applied to chat-targeted editing: the engine decides whether an edit
applies now or waits (`EditProposed`), which meals a disambiguation may offer (`MealChoiceNeeded`,
already filtered to rows the caller owns), and what a tap resolves to (`resolveMealChoice` returns
the text to replay and against which meal). The buttons, the callback data, and the replay itself
are the surface's. Note `resolveMealChoice` takes an INDEX into the stored candidates rather than a
meal id — that is not a Telegram detail leaking in, it is the guarantee that a tampered payload can
only ever pick something this row already offered.

## The barrel is the contract, in BOTH directions

`index.ts` is the engine's public surface: a front end imports from there and from nowhere deeper.
That was documentation until `boundary.test.ts` grew the reverse assertion — `api/` obeyed it while
`bot.ts` named six engine modules directly plus one re-export. Nothing breaks the day a surface
reaches past the barrel; what breaks is the answer to "what may a front end depend on", and the next
extraction then has nothing to extract against. Both directions are now checked, `export ... from`
included.

## Verify

`bun test src/engine/ src/api/routes.test.ts src/tg_bot/bot.test.ts` — the lifecycle modules have
direct tests (`onboarding.test.ts`, `settings.test.ts`, driven with no Telegram in the call); the
rest is covered through both front ends.
