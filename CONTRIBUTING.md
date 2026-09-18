# Contributing

Thanks for looking. This is the backend of [eait.fit](https://eait.fit), the contract its
clients implement, and the web application; the iOS app and the landing page live in a private
repository that mounts this one as a submodule. That shapes what a contribution here can be.

## Before you write code

- **Read `AGENTS.md`** — the root one, then the one in the workspace you are touching. They are the
  rulebook: what holds, why, and what would falsify it. A PR that breaks a rule stated there is
  refused however green it is.
- **Open an issue first for anything beyond a small fix.** One ticket, one branch, one PR. A defect
  you notice on the way is a new issue, not another commit.
- **The contract is code.** `src/shared/contract.ts` carries the routes, the types and the refusal→status
  map, and `openapi.json` is generated from it. A change to an endpoint changes the contract first,
  then the one handler in `src/backend/api/routes.ts`, then the clients — the web one is `src/frontend/`, the iOS one is
  not in this repo, so a contract change is coordinated with the maintainer before it lands.

## Setting up

```sh
bun install
bun run demo          # canned analyses, seeded fixtures, no database, no model key, on :8787
bun run check         # typecheck (shared, backend, web, scripts), the web build, the unit suites, openapi.json current
bun run web:e2e       # the browser suite, against the demo model
```

`bun` 1.4 or newer: the lockfile is v2. Against Postgres and a real model, copy the example env
file to a local one — every setting the server reads is listed there with its default — and
`bun run start`. The store contract suite runs against both stores under `./dev test`, which sets
`TEST_DATABASE_URL` to this worktree's own derived test database — do not set it by hand.

## Writing the change

- **TDD.** The failing test first, then the code. Every engine function has its test next to it.
- **One logical change per commit**, with a message that says what holds now and why. The
  reasoning that reached it belongs in the PR, not in `AGENTS.md`.
- **`userId` is an argument resolved from credentials, never from a request body.** Every store
  read and write is scoped by it. Verdicts are computed, never accepted. The calorie floor in
  `src/shared/targets.ts` is not negotiable. These are restated in `AGENTS.md` with their reasons.
- **A new endpoint** is a route in `src/shared/contract.ts`, a row in `src/shared/openapi.ts`, one handler
  that calls one engine function, and `bun run openapi` to regenerate the spec.
- **A new configuration value** is `EAIT__BACKEND__<KEY>` in `src/backend/config.ts` with a default,
  and a line in `.env.example`. Never a module constant for anything that differs between dev and
  prod.

## Opening the PR

- `bun run check` green, and the PR says so with the numbers — not "tests pass".
- The body is what it does and what proves it, in that order, and links the issue.
- CI runs the same check plus the store suite against Postgres. It is a backstop, not the gate.
- Merge is squash. Review fixes go on the same branch; an out-of-scope finding is a ticket.

## Security

Do not open an issue for a vulnerability. See `SECURITY.md`.

## License

By contributing you agree that your contribution is licensed under the AGPL-3.0, like the rest of
this repository.
