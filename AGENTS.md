# AGENTS.md — root

Orientation for any coding agent (or human) working in this repo.

## What this is

`eait-be` — the backend of `eait.fit` and the contract its clients implement. Two workspaces,
`shared/` and `backend/`. Each carries its own `AGENTS.md` with the rules that bind that workspace
alone; this file holds what crosses both.

This repository is also mounted, unchanged, inside a private monorepo that holds the iOS app, the
web client, the landing page and the deploy tree. A path such as `src/mobile/…`, `docs/…`,
`scripts/…` or `deploy/…`, or a `#NNN` issue reference, points there. The rules those references
support hold here regardless.

**Every `AGENTS.md` here is current state.** A rule says what holds NOW, why it holds, and what
would falsify it; the reasoning that reached it belongs in the PR.

## Stack & commands

- **Runtime:** TS/bun (`bun` 1.4+ — the lockfile is v2, which bun 1.3 cannot read).
- **Install:** `bun install` at the root. Workspaces: `shared`, `backend`.
- **Typecheck:** `bun run typecheck`. **It is a gate, not a suggestion.** bun executes TypeScript
  *without* checking it, so a type error is invisible to `bun test` and to the running server until
  it crashes on live input.
- **Everything:** `bun run check`.
- **Every configuration variable is namespaced, end to end:** `EAIT__BACKEND__<KEY>`, the same name
  in the shell, in every env file and in `config.ts`. There is no mapping layer, because one machine
  holds several projects' keys and a plain `RESEND_API_KEY` could be anybody's. The example env
  file is the inventory.
- **Anything that can differ between dev and prod is an environment variable, not a constant.**
  Settings go through `config.ts` (`configDefaults()` is the single source of defaults;
  `loadConfig()` layers env over it) and reach the engine as `deps.config` — never as a module
  constant.
- **A limit the server enforces is SENT to the client, never compiled into both.**
  `EAIT__BACKEND__MAX_UPLOAD_MB` and `EAIT__BACKEND__MAX_PHOTOS_PER_MEAL` travel in
  `ProfileResponse.limits`. Two numbers that must agree are two numbers that eventually will not.

## Hard conventions (do not break)

- **`shared` may not import from `backend`.** It is the contract both sides implement, and a
  dependency in either direction makes it a third implementation instead. It holds no renderer:
  the backend imports it, so React there would be React the server loads.
- **The HTTP contract is code, not a document.** `shared/contract.ts` carries the routes, the
  request/response types and the refusal→status map. Every client and this server import it. If
  you change an endpoint and only one side breaks, you changed it in the wrong place.
- **A photo arrives as JPEG, and the server refuses anything else BEFORE charging.** `logPhotoMeal`
  sniffs the magic bytes (`imageMime`, `llm/port.ts` — the one copy) and answers `unsupported-image`
  (415) on anything but JPEG/PNG/WebP, before `recordAnalysis`. The provider's own answer to HEIC is
  a 400, which is a status that stays charged.
- **Per-user scoping.** Every store read and write is scoped by `userId`, and `userId` arrives as an
  ARGUMENT resolved from credentials — never from a request body, a model output, or a tool call.
  `focusMealId` and `mealId` MAY come from the client; that is safe only because the scoping holds,
  and there are tests that say so. Never widen a meal query beyond `id = ? AND user_id = ?`.
- **Verdicts are computed, never accepted.** Not from the model (it is not asked for them) and not
  from the client (`EditMealRequest` has no such field). `verdictsFromTargets` → `visibleVerdicts`
  runs after every write, including every manual edit. A verdict must never describe numbers that
  have since changed.
- **An analyzer returns `AnalyzedMeal`, not `MealAnalysis`** — the same thing minus `verdicts`,
  because the model is never asked for them and `MealAnalysisSchema` strips one if it volunteers
  it. Never close that gap with a cast: three `as MealAnalysis` casts once kept `typecheck` green
  while `proposed` shipped `verdicts: undefined` to a client that indexed into it. The demo analyzer
  must stay as poor as the real one — a fake may be poorer than the real thing, never different in a
  way a test can see.
- **The calorie floor is not negotiable.** `shared/targets.ts` — share cap first, floor second,
  floor unconditional. Read the header of that file before touching any of it. If you add a code
  path that produces a kcal target, it goes through `explainTargets`.
- **TDD.** Write the failing test, watch it fail, implement, watch it pass. One logical change per
  commit.

## The store port

`backend/store.ts` is an interface with two implementations: `store.pg.ts` (Postgres via
`Bun.sql`, what runs) and `store.memory.ts` (what the tests and `--demo` run against). The memory
one enforces the same user-scoping rules, so a test proving "another user's meal id resolves to
null" proves something about the engine rather than about a mock's mood.

**The app never creates the database.** `migrate()` creates tables inside a database that must
already exist. Auto-create shipped once and it was silent data loss.

## Where to add things

- New domain rule or type both sides need → `shared/`, and export it from `index.ts`.
- New endpoint → the route in `shared/contract.ts` first, then one handler in
  `backend/api/routes.ts` that calls ONE engine function, then the client method on each client.
- New product logic → `backend/engine/`. If a route needs logic the engine does not expose, the
  logic goes in the engine.
- New onboarding question → a field on `Profile`, a step in `ONBOARDING_STEPS` (the order is
  load-bearing — the replies read what came before), an entry in `SCREEN_FIELDS` (respecting the
  two-field cap), an `asks` entry in `DEFAULT_ONBOARDING_CONTENT`, and a prompt in `CHAT_PROMPTS`
  with its `kind`. A question that collects NO profile field needs a READER first, named before it
  is written.
- New LLM capability → a port type in `backend/llm/port.ts`, a prompt in `prompt.ts`, an
  implementation in `openrouter.ts`, and a canned version in `demo.ts` so the tests still run.
- New paid-tier behaviour → `backend/engine/entitlement.ts`. A new thing the tier unlocks is a
  config value plus a branch in ONE function there, sent to the client through `ProfileResponse`.
  Never a second `entitlementActive` call, and never a check on a client's own SDK state.
- New health metric → a field on `HealthDay` and an entry in `HEALTH_FIELDS` (`shared/health.ts`).
  The Postgres column and its migration are GENERATED from `HEALTH_FIELDS`, so there is nothing to
  add in `store.pg.ts`; the memory store stores whole days and needs nothing either.
- New development fixture → `backend/dev/seed.ts`, against the `Store` INTERFACE so the tests
  cover it with no database. Verdicts go through `verdictsFromTargets` → `visibleVerdicts` like
  everything else.

## Verify

`bun run check`. The store contract suite runs against Postgres too when `TEST_DATABASE_URL` is
set, and says loudly that it skipped when it is not.
