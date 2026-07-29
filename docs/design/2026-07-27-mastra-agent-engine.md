# Mastra agent engine — design

Date: 2026-07-27 · Branch: `mastra`

> **Rollout superseded** by `2026-07-28-mastra-engine-boundary.md`, which answers this doc's "Rollout
> risk" and "Open items" sections with a staged plan, adds the transport-agnostic engine boundary the
> mobile client needs, and records two measured divergences in the code plans 1–2 landed. The
> architecture below (unified agent, terminal tools, `requestContext` user binding, Postgres-backed
> memory) stands unchanged.

## Goal

Replace `src/llm/` (raw-fetch `OpenRouterProvider` behind the `LLMProvider` transport interface) with
a Mastra-based engine. Mastra becomes the one LLM entry point for every call in the app —
`analyzeMeal` (photo → macros), `routeText` (free-text intent classification + diary Q&A), and
`classifyRestrictions` (onboarding tag parsing) — currently three call sites sharing one thin
`provider.chat()` transport.

Approved decisions (brainstorm): **one unified Mastra Agent** covers all three flows, rather than
per-task agents or leaving code-level routing in place. The agent gets **both** tool-calling (real
tools instead of a hand-built context dump) **and** managed Memory (Mastra threads instead of
reconstructing diary context every call). Memory persists into the **same Postgres** database
`db.ts` already uses, via `@mastra/pg`.

## Why (what this unlocks)

- `food_db.ts` (CoFID/USDA composition lookup) is built and tested but **unwired** — nothing
  imports it. A `search_food_db` tool wires it in for the first time.
- `routeText`'s diary context (`todayMeals`, `weekTotals`, `targets`) is pushed into every prompt
  whether the model needs it or not. Tools make it pull-based.
- Multi-turn conversation state is currently rebuilt by hand per call. Mastra Memory threads carry
  it instead.

## Architecture

`src/llm/` keeps its name (transport-agnostic domain folder) but its contents change shape:

- `src/llm/mastra.ts` — one `Mastra` instance, created once in `index.ts` (composition root, same
  role `createProvider()` plays today). `@mastra/pg` storage pointed at the branch's existing
  Postgres connection.
- `src/llm/agent.ts` — the single unified Agent: instructions, model config, tool registration.
- `src/llm/tools/diary.ts` — `get_diary_context` (today's meals, week totals, targets, local time),
  `get_focus_meal` (the meal a reply is anchored to).
- `src/llm/tools/foodDb.ts` — `search_food_db`, wrapping `food_db.ts`'s `FoodIndex` lookup.
- `src/llm/tools/mealActions.ts` — the terminal tools (below).
- `src/llm/memory.ts` — Mastra Memory config: thread id = Telegram user, `resourceId = user_id`.

`provider.ts` / `factory.ts` / `openrouter.ts` are retired. `ProviderConfig`'s job (map
`LLM_PROVIDER` → a concrete backend, unknown value throws at startup, never a silent fallback) is
preserved but re-homed onto Mastra's model config — same fail-loud contract, new mechanism.

## The parse boundary: terminal tools, not JSON-schema-on-raw-text

Today: one LLM call → raw JSON string → `zod.safeParse`. `MealAnalysisSchema` and `RouteSchema` are
the validation boundary; `analyzer.ts` owns both the prompt and the parse (root `AGENTS.md`
invariant).

Under Mastra: every turn ends with the model calling exactly one **terminal tool**, each carrying
today's schema as its zod `inputSchema`:

- `submit_meal(analysis, dayOffset)` — new meal (was `RouteResult.meal`)
- `submit_correction(analysis)` — corrects the focus meal (was `RouteResult.correction`)
- `submit_redate(dayOffset)` — moves the focus meal, macros unchanged (was `RouteResult.redate`)
- `answer_question(answer)` — Q&A / chat (was `RouteResult.question`)
- `submit_restrictions(...)` — onboarding tag parse (was `classifyRestrictions`'s return)

Mastra validates tool arguments against the zod schema before the handler runs — this **is** the
`safeParse` step, just moved from "parse the model's raw text" to "the framework validates the
model's tool call." `bot.ts` dispatches on whichever terminal tool fired, same downstream rendering
code (`renderMealCard`, `formatReply`, etc.) as today's `RouteResult` switch — this design changes
how a result is *produced*, not what happens after.

`gated()` (verdict-dimension filtering) and `clampDayOffset()` still run on whatever the terminal
tool call carried, in the same place they run today, before anything is persisted or displayed.

## Data access tools replace the hand-built context dump

`get_diary_context` and `get_focus_meal` let the agent pull diary state when it needs it, instead of
every prompt carrying `todayMeals`/`weekTotals`/`targets`/`localTime` whether relevant or not.
`search_food_db` is new capability — first caller of `food_db.ts`.

## Hard invariant carried forward: no cross-user reach

**`user_id` is bound into Mastra's `requestContext` from the Telegram update at call time — never a
tool argument the model supplies.** Every tool reads `user_id` from `requestContext`, not from its
own input schema. This is non-negotiable: the root convention is "every meal read/update is
`WHERE id = ? AND user_id = ?`," and a tool-calling model must never be in a position to request
(via prompt injection or otherwise) another user's rows. No tool's `inputSchema` includes a user
identifier field, full stop.

## `classifyRestrictions` under the unified agent

Same Agent definition (per "one unified agent"), but the onboarding call restricts the available
toolset to just `submit_restrictions` for that `generate()` call (Mastra supports per-call tool
subsets). Keeps a single Agent definition without letting the model reach for diary tools mid-
onboarding, before a profile exists.

## Coexistence with existing Postgres

`db.ts` has its own hand-rolled, `schema_version`-tracked migration list (`users`, `meals`,
`settings`, `llm_calls` for rate-limit bookkeeping, etc. — see `src/db.ts` migrations array).
`@mastra/pg` manages its own tables in the **same physical database** via its own internal setup —
a separate migration mechanism, same DB, not added to `db.ts`'s `migrations` array.

`llm_calls.kind` (`'photo' | 'router' | 'classify'`) still needs populating — that bookkeeping lives
in `bot.ts` today, tagged by which code path ran. Under the unified agent it gets tagged by which
terminal tool fired instead; the rate-limit accounting logic itself doesn't move.

## Testing

Today: `openrouter.test.ts` injects a fake `fetchImpl`; `analyzer.test.ts` injects a fake
`LLMProvider` object. Under Mastra: tests swap in a scripted fake AI SDK `LanguageModel` (mock
model) that returns canned tool-call sequences. Assertions move from "parse this JSON string" to
"which terminal tool fired, with what (zod-validated) args" — same shape as today's `RouteResult`
assertions, new seam.

## Rollout risk (flagged for the implementation plan, not resolved here)

`analyzer.ts` (599 lines) backs the accuracy eval (`eval.ts`, `fixture.ts`, the NutritionVerse-Real
baseline, the CoFID/USDA integration — several recent commits of measured tuning, e.g. PR #35's
16/21 dish resolution). Replacing it in one pass, with no fixture-based re-baseline, risks silently
regressing eval accuracy with nothing catching it. The implementation plan must stage this: land
Mastra plumbing + one terminal tool + parity tests first, re-run the eval harness against the new
path before the old `llm/`/`analyzer.ts` call sites are deleted, per the repo's TDD / one-logical-
change-per-commit convention — not a single big-bang PR.

## Open items for the implementation plan

- Confirm Mastra + AI SDK model provider for OpenRouter (`x-ai/grok-4.5` default) under Bun.
- Confirm tool-calling and the terminal-tool pattern compose cleanly with Mastra's `generate()` loop
  (maxSteps, no-terminal-tool-called error path — must throw, not silently fall back, mirroring
  today's `analyzer: route validation failed` / `analyzer: ... intent without analysis` errors).
- Confirm `@mastra/pg` Bun compatibility (this repo uses Bun's builtin `Bun.sql`, not `pg`/an ORM,
  elsewhere — Mastra's storage adapter brings its own driver, additive, not a replacement).
- Decide staging order: which flow (meal / route / restrictions) gets its first terminal tool and
  parity test before the others follow.
