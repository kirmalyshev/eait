# eait-be

The backend of [eait.fit](https://eait.fit) — a photo-first nutrition coach — and the contract its
clients implement.

Two workspaces:

| Workspace | What it is |
|---|---|
| `shared/` | The contract: HTTP routes and types (`contract.ts`), the health arithmetic, the calorie floor (`targets.ts`), onboarding, chat orchestration. No renderer, no server — both clients and the backend import it. |
| `backend/` | The server. One handler per route, all product logic in `engine/`, a store port with a Postgres implementation and an in-memory one the tests run against, an LLM port with an OpenRouter implementation and a canned one. |

The iOS app, the web client and the landing page are separate products that consume this
repository; they are not in it. Comments and rulebooks here occasionally name files from that
side (`src/mobile/…`, `docs/…`, `scripts/…`, `deploy/…`) or an issue number — those refer to the
private repository this backend is developed alongside.

## Run it

```sh
bun install
bun run demo          # no database, no model key: canned analyses, seeded fixtures, on :8787
```

Against Postgres and a real model: copy the example env file to a local one — every setting the
server reads is listed there, with its default — then:

```sh
bun run start         # migrate() creates the tables; it never creates the database
```

## Check it

```sh
bun run check         # typecheck both workspaces, then the unit suites
TEST_DATABASE_URL=postgres://… bun test ./backend/store.contract.test.ts   # both stores, same suite
```

## Rules

`AGENTS.md` at the root, then the one in each workspace. They are current state: what holds, why,
and what would falsify it.

## License

AGPL-3.0 — see `LICENSE`.
