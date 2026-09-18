# AGENTS.md — iac

How eait runs in production: two images, a compose file, and the edge in front of them.

Root `AGENTS.md` covers the repo. This covers this directory, plus the two files that live at the
root because they are the pair of the development ones already there — `docker-compose.prod.yml`
beside `docker-compose.yml`, and `.env.prod.example` beside `.env.example`.

## What this is, and what it deliberately is not

```
docker-compose.prod.yml      the stack: caddy, backend, frontend, db            (repo root)
.env.prod.example            every variable a deploy needs                      (repo root)
.dockerignore                the build context, which is the whole repo         (repo root)
src/iac/Dockerfile.backend   the backend's production image
src/iac/Dockerfile.frontend  the web application's production image
src/iac/Caddyfile            the edge, parameterised
```

**IT SHIPS THE APPLICATION, NOT THE MACHINE.** There is no provisioning here — nothing installs a
package, hardens an SSH daemon, writes a firewall rule or touches a sysctl. The box is the
operator's and it stays theirs.

That is a decision rather than an omission, and it is the one that shapes everything else. A
provisioning layer has to make assumptions no project can make on somebody else's behalf: which
distribution, which init system, whether the host is dedicated or shared, whether a given firewall
rule belongs to us, when the machine may reboot. Each of those is right for one person and a broken
server for the next, and the failures land on a box nobody here can see. What a container image can
promise it can promise everywhere, so that is where the line is. `README.md` states out loud what
the operator is therefore still holding.

`src/iac/` keeps its name: a Dockerfile and a reverse-proxy config committed beside the code is
infrastructure as code. It is not machine provisioning, and it is not going to become it.

## The one rule everything here serves

**ONE ORIGIN.** Caddy serves a single hostname: `/` and `/app.js` come from the `frontend`
container, everything else — `/api/v1/*`, `/start`, `/admin`, `/health` — from the `backend`
container. `src/frontend/AGENTS.md` says why, and it is not routing preference: the browser client
calls its API with relative paths under `connect-src 'self'` and the backend has no CORS header
anywhere. A deployment that puts the two on two hostnames has broken the product's security model.
The fix that then suggests itself is `Access-Control-Allow-Origin`, which is a door this product
does not need open.

## Hard rules

- **Nothing but Caddy publishes a port.** Docker writes its own iptables rules into `DOCKER-USER`,
  and those are consulted BEFORE a host firewall — so a `ports:` entry on the database is a Postgres
  on the open internet while `ufw status` insists the port is denied. That is the commonest way a
  hobby database ends up ransomed, and it is the one containment property this repository can
  actually guarantee, because it belongs to the compose file rather than to the host. Reach the
  database with `docker compose exec db psql`.
- **The app never creates the database.** The Postgres image's initdb does, from `POSTGRES_DB`;
  `migrate()` creates tables inside a database that must already exist. Auto-create shipped once and
  it was silent data loss.
- **Every variable in `.env.prod` must be named in `docker-compose.prod.yml` or the Caddyfile.**
  `--env-file` feeds compose's INTERPOLATION, never a container's environment. A name nobody spells
  is deployed, correct and read by nobody, with no error and no log line.
  `src/scripts/prod-env.test.ts` is the guard, and it runs in `bun run check`.
- **A third-party image keeps its own variable names.** Postgres wants `POSTGRES_PASSWORD` and Caddy
  reads `{$EAIT_DOMAIN}`; ours are namespaced. The mapping happens in the compose file, once,
  because one machine holds several projects' keys and a plain `POSTGRES_PASSWORD` in an env file
  could be anybody's.
- **Two surfaces, and the distinction is load-bearing.** `EAIT__BACKEND__*` is read by
  `src/backend/config.ts`. `EAIT__DEPLOY__*` belongs to the box — the domain, the ACME address, the
  database password, the edge timeout — and `config.ts` reads none of it. Naming a Caddy setting
  `EAIT__BACKEND__` is exactly the confusion the test above exists to prevent.
- **The Caddyfile is parameterised with Caddy's own `{$VAR}`, never a templating language.** The
  compose file has to be runnable by hand: it is the only description of the stack there is, it is
  what somebody debugs at 2am, and it is what proves the routing locally. A config that needs a
  renderer first is a second artefact, and a second artefact can differ from the one deployed.
- **`EAIT__FRONTEND__BACKEND_ORIGIN` stays unset in production.** It is the LAPTOP's dev proxy —
  with no Caddy on a laptop, the web server forwards what is not its own to the backend. Setting it
  on a deployment puts a second, untested path in front of the API on the exact arrangement where
  the edge is what composes the one origin.

## Where to add things

- A new backend setting → `src/backend/config.ts` first, then `.env.prod.example`, then the
  `environment:` block in `docker-compose.prod.yml`. `src/scripts/prod-env.test.ts` fails until all
  three agree, which is the order it enforces rather than merely documents.
- A new path the edge must route → `src/iac/Caddyfile`. Two exact paths go to the frontend and
  everything else to the backend, so a new BACKEND path needs nothing; a new path the web
  application answers needs a branch in `src/frontend/server/index.ts` AND an entry in the `@app`
  matcher, in the same commit.
- A new runtime dependency in the backend → nothing here, as long as it is that workspace's:
  `bun install --filter=@eait/backend` picks it up. One in `src/shared`, though, means
  `Dockerfile.backend` has to start copying `src/shared/node_modules` — and it will fail at the COPY
  rather than at startup, which is why the Dockerfile says so.

## Deliberately not done

Named so they read as decisions rather than gaps. `README.md` carries the operator-facing half of
this list; this is the half that is about the repository.

- **No provisioning, no hardening, no firewall rules, no `daemon.json`.** See above. The per-service
  `no-new-privileges`, dropped capabilities, read-only root filesystems and log caps in
  `docker-compose.prod.yml` are the containment this repository owns, and they hold on any host.
- **No backups.** There is no dump, no schedule and no off-site copy. `restart: unless-stopped`
  covers a crashed process and a rebooted box; it does not cover a bad migration, a deleted volume
  or a dead disk. This is the largest thing a self-hoster still has to build, and `README.md` says
  so rather than letting the absence read as an oversight.
- **No monitoring.** Nothing watches `/health` between deploys, so an instance that dies at 02:00 is
  down until somebody opens it.
- **No registry, no published image, no tags.** The compose file BUILDS from the checkout, so what
  runs is what that checkout says. A published image is a second artefact with its own version
  question, and answering that badly is worse than building on the box.

## Verify

```sh
bun run check          # includes src/scripts/prod-env.test.ts
```

Then locally, against a throwaway database — that the stack answers on ONE origin is the property
worth proving:

```sh
C="docker compose -p smoke -f docker-compose.prod.yml --env-file .env.prod"
$C up -d --build
curl -s localhost/health      # {"ok":true,"demo":false}        → the backend
curl -s localhost/ | head -3  # the shell, under its CSP nonce   → the frontend
curl -s localhost/v1/profile  # {"error":"unauthenticated"}      → the backend, same origin
$C down -v
```

On a machine with neither port free nor a public name, set `EAIT__DEPLOY__DOMAIN` to `:8080` and
publish that instead of 80/443 — Caddy serves a hostless site address over plain HTTP. What that
leaves unproven is the certificate, and only the certificate: ACME needs a name that resolves to
the box.
