# eait

The backend of [eait.fit](https://eait.fit) — a photo-first nutrition coach — the contract its
clients implement, and the web application at [app.eait.fit](https://app.eait.fit).

Three workspaces:

| Workspace | What it is |
|---|---|
| `src/shared/` | The contract: HTTP routes and types (`contract.ts`), the health arithmetic, the calorie floor (`targets.ts`), onboarding, chat orchestration. No renderer, no server — both clients and the backend import it. |
| `openapi.json` | The HTTP surface as OpenAPI 3.1, generated from `src/shared/openapi.ts` and the types it names by `bun run openapi`. Committed, and `bun run check` fails when it is stale. |
| `src/frontend/` | The web application: a dependency-free browser client and the small bun server that serves it under a per-response CSP nonce. It calls the backend on one origin with relative paths only. |
| `src/backend/` | The server. One handler per route, all product logic in `engine/`, a store port with a Postgres implementation and an in-memory one the tests run against, an LLM port with an OpenRouter implementation and a canned one. |

The iOS app and the landing page are separate products that consume this repository; they are not
in it. Comments and rulebooks here occasionally name files from that
side (`src/mobile/…`, `docs/…`, `scripts/…`, `deploy/…`) or an issue number — those refer to the
private repository this backend is developed alongside.

## Run it

```sh
./dev install         # every tool this needs, on macOS or Linux (--check reports, changes nothing)
./dev up --demo --web
```

Open the web application on the port it prints — no database, no model key: canned analyses,
seeded fixtures, and the app talking to the demo backend through its dev proxy.

Against Postgres and a real model, put `EAIT__BACKEND__LLM_API_KEY` in `.env` (`.env.example` is
the full inventory of what the server reads, with every default), then:

```sh
./dev up --all        # Postgres, the backend, the web app — detached, on this worktree's ports
./dev seed            # the development accounts, including the one that holds the admin role
```

`./dev` runs the stack detached and per worktree, so several checkouts coexist: each gets its own
ports and its own database inside one shared Postgres, derived from a slot number.

| | |
|---|---|
| `./dev up [--backend\|--demo] [--web] [--all]` | start, detached |
| `./dev down` / `./dev restart` | stop this worktree's stack; restart what was last up |
| `./dev status` / `./dev ls` | this worktree; every worktree on the machine |
| `./dev logs [service]` | follow |
| `./dev seed` / `./dev db …` | fixtures; the shared Postgres and this worktree's database |
| `./dev env` / `./dev url` | what this worktree derives; its API URL, for substitution |

Without it, the plain commands still work — `bun run demo` on :8787, `bun run web:build` then
`EAIT__FRONTEND__BACKEND_ORIGIN=http://127.0.0.1:8787 bun run web` on :8788, and `bun run start`
against a real database. `migrate()` creates the tables; it never creates the database.

## Telegram

The backend also runs a Telegram bot, in the same process, when `EAIT__BACKEND__TELEGRAM_BOT_TOKEN`
is set. Get a token from [@BotFather](https://t.me/BotFather), and use a separate bot for
development. The bot never runs under `--demo`, so it needs the Postgres-backed server:

```sh
EAIT__BACKEND__TELEGRAM_BOT_TOKEN=… bun run start    # logs "telegram connector on as @<bot>"
```

A person connects their account with **Connect Telegram** on their plan (`/start/plan`) or in the
web application. It opens the bot with a one-time code. The rules are in `src/backend/telegram/AGENTS.md`.

## Check it

```sh
bun run check         # typecheck, the web build, the unit suites, and that openapi.json is current
bun run web:e2e       # the browser suite in the Chrome already installed, against the demo model
./dev test            # the same unit suites PLUS the store contract suite, against real Postgres
```

`bun run check` never needs Docker: the store contract suite skips its Postgres half, loudly, when
`TEST_DATABASE_URL` is unset. `./dev test` is the opt-in that sets it — to this worktree's own test
database, `eait_test` in a single checkout and `eait_<branch>_test` in a linked worktree, created
by `./dev db up` alongside the dev one. Do not set that variable by hand and do not create a
database called `eait_test` yourself: that suite MIGRATES and WRITES, so a fixed name shared by
several checkouts is several test runs writing each other's rows. It is also a database of its
own rather than the one you develop against, because `./dev seed` writes an admin and two of its
assertions are about a database with none.

## Rules

`AGENTS.md` at the root, then the one in each workspace. They are current state: what holds, why,
and what would falsify it.

## Contributing

`CONTRIBUTING.md` — setup, the rules, what a PR owes. Vulnerabilities go to `SECURITY.md`, not
the issue tracker. `CODE_OF_CONDUCT.md` is the Contributor Covenant.

## License

AGPL-3.0 — see `LICENSE`.
