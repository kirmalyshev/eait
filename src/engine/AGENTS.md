# AGENTS.md — src/engine/

The transport-agnostic product engine. `tg_bot/` and `api/` are both **front ends over this**, and
neither is privileged. Design: `docs/design/2026-07-28-mastra-engine-boundary.md`.

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

## What deliberately did NOT move here

Album buffering, reactions, the rejection log, inline-button state machines, reply-to-message
mapping, and the Telegram text precedence chain (command > armed settings prompt >
reply-to-rejection > router). All are about how a *Telegram* message arrives. The surface resolves
precedence and a focus meal, then calls the engine with `text` + `focusMealId` — a UUID, not a
message id.

`edits.ts` is the same split applied to chat-targeted editing: the engine decides whether an edit
applies now or waits (`EditProposed`), which meals a disambiguation may offer (`MealChoiceNeeded`,
already filtered to rows the caller owns), and what a tap resolves to (`resolveMealChoice` returns
the text to replay and against which meal). The buttons, the callback data, and the replay itself
are the surface's. Note `resolveMealChoice` takes an INDEX into the stored candidates rather than a
meal id — that is not a Telegram detail leaking in, it is the guarantee that a tampered payload can
only ever pick something this row already offered.

## Verify

`bun test src/api/routes.test.ts src/tg_bot/bot.test.ts` — the engine is covered through both of its
front ends.
