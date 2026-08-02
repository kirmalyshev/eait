# Chat-targeted meal editing

**Status:** accepted, 2026-08-02
**Supersedes:** the "reply-only focus meal" rule in `src/AGENTS.md`

## The problem

Correcting or re-dating a meal requires *replying* to its Telegram card. The focus meal is resolved
in exactly one place — `bot.ts` maps `reply_to_message_id → mealByReply → focusMealId` — and
`engine/text.ts` gates the `correction` and `redate` intents on that id being present. The prompt
even says so out loud: *"There is no focus meal — the correction and redate intents are NOT
available."*

So "the pasta was 200g, not 150" is unanswerable unless the user scrolls back and long-presses the
right card. On mobile, with an album of photos and a day's worth of messages between, that is the
whole friction. The user wants to talk to the diary the way they would talk to a person: name the
meal, or just refer to it, and have the assistant work out which one.

`src/AGENTS.md` currently encodes the opposite as an invariant:

> A meal's date changes ONLY via reply-based re-date. […] There is no free-text "move my beer" (no
> meal search) […]

That invariant is what this design overturns, deliberately and with the guards below.

## Decisions

Three product choices were made before design (2026-08-02):

1. **Targeting** — the agent searches the diary itself and picks the meal. Ambiguity is resolved by
   asking the user with buttons, not by guessing.
2. **Confirmation** — a reply-targeted edit still applies immediately (a reply is unambiguous). A
   *chat-inferred* target is confirmed with `[Apply] [Cancel]` first.
3. **Window** — seven days back, matching the week context the router prompt already carries and
   the existing `MAX_DAY_OFFSET` cap on re-dating.

## Architecture

The shape is retrieve-then-select, the same split `search_food_db` already uses: a cheap tool
narrows the candidates, and the model — holding the conversation the user actually wrote — picks.

### `find_meals` — a new non-terminal tool

`src/llm/tools/mealLookup.ts`, a factory over a `Db` handle, registered on the agent exactly as
`makeSearchFoodDbTool` is and omitted when no handle is supplied.

- **Input:** `{ queries?: string[], daysBack?, limit? }`. **No user identifier**, per the standing
  rule that a model must never be able to name whose rows it wants.
- **User scope:** read from the `RequestContext` via `requireUserId`. This is the **first** tool to
  do so — `llm/context.ts` was written for this and nothing had exercised it. Mastra passes the
  context as the second `execute` argument and always provides one
  (`@mastra/core/dist/tools/types.d.ts`, `ToolExecuteContext`).
- **Bounded:** a 7-day window and at most 20 rows, `WHERE user_id = ?`. It runs inside a turn the
  user is waiting on, and an unbounded diary read is paid for in tokens on every edit.
- **Output:** `[{ mealId, date, time, items, kcal, protein_g, carbs_g, fat_g }]`.

It is registered in the router's `activeTools` as a mid-turn lookup, never a terminal tool. A
side effect worth naming: the Q&A intent gets it too, so "when did I last eat sushi" and "how much
protein was lunch on Tuesday" are answered from rows instead of from today's summary plus week
totals.

### Terminal tools gain a target

`submit_correction` and `submit_redate` take an optional `mealId`.

Typed `z.unknown().optional()`, not `z.string().uuid()`, for the reason `dayOffset` is loose
(`tools/mealActions.ts`): under Mastra a schema violation is not a throw but an error-shaped result
fed back for a retry, so a strict type lets a malformed id discard an otherwise perfect analysis.
The id is validated where it is used — `mealById(db, userId, id)` is user-scoped, so an id
belonging to someone else resolves to nothing and surfaces as `target-gone`.

**Reply focus wins.** A model-supplied `mealId` is consulted only when there is no reply focus.
Otherwise a user who replied to meal A could have meal B edited, which is worse than the friction
this design removes.

### `ask_which_meal` — a new terminal tool

`{ mealIds: string[], question: string }`. The agent calls it when more than one meal plausibly
matches. It ends the turn like any other terminal tool.

### `RouteResult` grows

```ts
| { intent: "correction"; analysis: MealAnalysis; mealId?: string }
| { intent: "redate"; dayOffset: number; mealId?: string }
| { intent: "choose"; mealIds: string[]; question: string }
```

Both dispatch sites end in `assertNever`, so the new variant is a compile error until it is
handled — the guard the codebase already relies on for intents.

### Engine

`engine/text.ts` resolves focus in two stages:

1. **Before** the routing call, from `input.focusMealId` — unchanged, because its presence is what
   tells the model whether it needs to search at all.
2. **After**, from `route.mealId`, when stage 1 found nothing.

What happens next depends on where the target came from:

| Target came from | Behaviour |
|---|---|
| a reply | applies immediately — today's behaviour, untouched |
| chat inference | a `pending_edits` row; the surface shows `[Apply] [Cancel]` |
| `ask_which_meal` | a `pending_edits` row; the surface shows candidate buttons |

### `pending_edits`

```
id UUID PK, user_id BIGINT, kind TEXT CHECK IN ('correction','redate','choose'),
meal_id TEXT NULL, analysis JSONB NULL, day_offset INT NULL,
source_text TEXT NULL, candidates JSONB NULL, ts TIMESTAMPTZ
```

Swept with the existing 48-hour `PENDING_TTL_MS`, imported rather than re-declared — two constants
is how "expired" and the actual lifetime drift apart.

The nullable columns are a deliberate trade against three narrow tables: one row shape, one sweep,
one callback handler. The discriminator is `kind`, and reads parse through zod rather than trusting
the column set.

### Surface

A new callback namespace `ce:` — disjoint from `st:`, `tm:`, `delete_*`, `lang_` and the bare
onboarding names, per the standing rule.

- `ce:ok:<id>` / `ce:no:<id>` — apply or cancel a pending edit.
- `ce:pick:<id>:<n>` — choose candidate *n*. An **index**, not a UUID: Telegram caps callback data
  at 64 bytes and two UUIDs do not fit.

`processEditDecision` mirrors `processTextMealDecision` exactly: the prompt is deleted only after a
successful card send, and a re-tap converges rather than double-applying.

`ce:pick` **re-runs the router** with `focusMealId` set to the tapped meal and the stored
`source_text`. That costs one additional `router` cap draw, and it is the point: the tap makes the
target explicit, so the second pass lands on the existing unambiguous path instead of needing a
second correction state machine that would have to keep its own analysis in step.

### Prompt

`SYSTEM_ROUTE` and `buildRouteText` change in `analyzer.ts` only — both engines keep sending
byte-identical text, which is what lets an eval tell a transport regression from an accuracy one.

The no-focus line flips from *"the correction and redate intents are NOT available"* to an
instruction to locate the meal with `find_meals` and pass its `mealId`.

## Metering

`find_meals` is a tool call inside an existing router turn — no extra `llm_calls` row. The `ce:pick`
re-run does log one, and that is honest: it is a second model call.

## What this does not change

- Images stay ephemeral; nothing here touches the photo path.
- Every meal read and write stays `WHERE id = ? AND user_id = ?`.
- No tool input schema carries a user identifier.
- Reply-based correction and re-date keep applying immediately.
- `/delete` remains the only deletion; this adds no per-meal delete.

## Risk

Adding a fifth terminal tool and a second search tool can degrade intent selection on the router —
the model has more ways to be wrong about what the user meant. `scripts/parity-llm-paths.ts` and the
fixture eval run before and after as the gate.
