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
bun install
bun run demo          # no database, no model key: canned analyses, seeded fixtures, on :8787
bun run web:build
EAIT__FRONTEND__BACKEND_ORIGIN=http://127.0.0.1:8787 bun run web   # the web application on :8788
```

Open http://127.0.0.1:8788 — the web application, talking to the demo backend through its dev proxy.

Against Postgres and a real model: copy the example env file to a local one — every setting the
server reads is listed there, with its default — then:

```sh
bun run start         # migrate() creates the tables; it never creates the database
```

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
TEST_DATABASE_URL=postgres://… bun test ./backend/store.contract.test.ts   # both stores, same suite
```

## Rules

`AGENTS.md` at the root, then the one in each workspace. They are current state: what holds, why,
and what would falsify it.

## Contributing

`CONTRIBUTING.md` — setup, the rules, what a PR owes. Vulnerabilities go to `SECURITY.md`, not
the issue tracker. `CODE_OF_CONDUCT.md` is the Contributor Covenant.

## License

AGPL-3.0 — see `LICENSE`.
