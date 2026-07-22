# Self-hosting eait

Instructions for standing up your own instance. Written to be followed by a coding agent on
behalf of an operator, but a human can follow it directly.

`AGENTS.md` describes how to *develop* this repo. This file describes how to *run* it. They are
different jobs; if you are deploying rather than changing code, you only need this file.

## What you are signing up for

- **Every meal photo is a billed vision call** on your own OpenRouter key. There is no free
  tier here and no shared quota. Cost scales with photos, not with users.
- **The bot is only as closed as you make it.** Telegram bot handles are discoverable. Set
  `ALLOWED_USER_IDS` (step 4) or anyone who finds yours can spend your budget.
- **It is a personal tool, not a product.** No billing, no moderation queue, no web dashboard,
  no multi-tenant isolation beyond per-user row scoping.
- **Nutrition estimates are approximate and are not medical advice.** If you hand this to other
  people, make sure they know that — the onboarding consent screen says so, but you are the one
  choosing to run it for them.

## What the operator must supply

Ask for these up front; three of the four cannot be obtained without them.

| Value | Where it comes from |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Message [@BotFather](https://t.me/BotFather) → `/newbot` → choose a display name and a unique `@handle` → it replies with the token. |
| `OPENROUTER_API_KEY` | <https://openrouter.ai/keys>. The account needs credit; vision models are not free. |
| `ALLOWED_USER_IDS` | Each intended user messages [@userinfobot](https://t.me/userinfobot), which replies with their numeric id. Collect one per person. |
| `TZ` | The operator's timezone, e.g. `Europe/Berlin`, `America/New_York`. Decides when "today" rolls over for daily totals. |

`ADMIN_USER_ID` is optional — it is the one id allowed to run `/stats`, and it also gets `/stats`
added to their Telegram command menu.

## The fast path

```bash
git clone https://github.com/kirmalyshev/eait.git && cd eait
./scripts/setup.sh
```

`scripts/setup.sh` performs every step below: checks prerequisites (offering to install bun),
installs dependencies, runs the suite to verify the checkout, walks you through `.env` with the
secrets hidden, optionally smoke-tests the model, and optionally installs a background service.

It is idempotent — re-run it any time. It backs up an existing `.env` before replacing it and
never overwrites one without asking. `.env` is written mode 600.

For provisioning without prompts:

```bash
EAIT_NONINTERACTIVE=1 \
TELEGRAM_BOT_TOKEN=… OPENROUTER_API_KEY=… ALLOWED_USER_IDS=… \
./scripts/setup.sh
```

The rest of this document explains what the script does and how to operate the result. Follow
it manually if you would rather not run a script that touches your `.env`.

## Steps (what setup.sh does)

### 1. Prerequisites

Bun 1.3 or newer:

```bash
curl -fsSL https://bun.sh/install | bash
bun --version
```

### 2. Get the code and its dependencies

```bash
git clone https://github.com/kirmalyshev/eait.git
cd eait
bun install
```

### 3. Verify the checkout before configuring anything

```bash
bun test          # full suite, no credentials needed
bun run typecheck
```

Both must pass on a clean checkout. If they do not, stop and fix that first — do not debug a
deployment on top of a broken tree.

### 4. Configure

```bash
cp .env.example .env
```

Fill in `.env`. At minimum `TELEGRAM_BOT_TOKEN` and `OPENROUTER_API_KEY`; the process refuses to
start without them and names every missing variable at once.

**Set `ALLOWED_USER_IDS`.** It is a comma-separated list of numeric Telegram ids:

```
ALLOWED_USER_IDS=123456789,987654321
```

Leaving it empty leaves the bot open to anyone who finds its handle. Startup logs a warning
while it is unset. Parsing fails closed: if the value is present but no entry parses as a
number, nobody is admitted rather than everybody.

`.env` is gitignored. Never commit it, never paste the token into an issue or a chat log. If a
token does leak, revoke it via `@BotFather` → `/revoke` and issue a new one.

### 5. Confirm the model works before going live

```bash
bun run smoke
```

This sends one real image to the configured model and prints the raw output. It **makes a
billed call**. It is the only way to find out that a model is not vision-capable, or that the
key has no credit, before real users hit it. `LLM_MODEL` must name a vision-capable OpenRouter
model; the default is `x-ai/grok-4.5`.

### 6. Run it

```bash
bun run start
```

Expected on a healthy start, in this order:

```
[eait] allowlist active: N user(s)
eait started · model=… · db=./data/eait.sqlite
[eait] commands registered for en, ru, de
```

The last line arrives a moment after the others — command registration is a network call that
deliberately does not block polling. If it fails it logs and carries on: a stale `/` menu is
cosmetic.

If you see the `ALLOWED_USER_IDS is not set` warning in place of the allowlist line, go back to
step 4.

### 7. Check it end to end

From an allowlisted Telegram account: send `/start`, complete consent → goal → restrictions,
then send a photo of food. You should get an estimate plus a running daily total. Reply to that
message with a correction ("half that portion") and confirm the numbers change.

From a **non**-allowlisted account, send `/start` and confirm nothing comes back, and that the
host logs `blocked update from user=…`.

## Keeping it running

`bun run start` dies with its terminal. For an always-on instance:

**macOS** — launchd:

```bash
scripts/service.sh install    # then start | stop | restart | status | logs | uninstall
```

It generates the plist at install time with your local paths, so nothing machine-specific is
committed. Logs land in `logs/`.

**Linux** — the same command installs a **systemd user unit** (no root required):

```bash
scripts/service.sh install    # then start | stop | restart | status | logs | uninstall
```

It also runs `loginctl enable-linger` so the bot survives logout — without lingering, systemd
stops user services when your last session ends. If your system disallows it, the script says
so rather than failing silently, and you should use a system unit instead.

`status` and `logs` read from `journalctl --user`, falling back to `logs/` if journald is
unavailable.

**Docker** — an alternative to both, and the only option that needs no bun on the host:

```bash
cp .env.example .env          # fill in tokens (or reuse an .env made by setup.sh)
docker compose up -d --build  # build + start; SQLite lands in ./data on the host
docker compose logs -f        # watch startup; expect the same lines as step 6
docker compose down           # stop (data survives in ./data)
```

The container runs the same long-polling process — no ports are exposed. `DB_PATH` inside the
container is pinned to the mounted `./data`, so backups work the same as a native run.

*Parallel instances (worktree development):* each checkout must be its own compose project or
`up` in one worktree replaces the other's container. Once per worktree:

```bash
sh scripts/compose-env.sh     # writes COMPOSE_PROJECT_NAME=eait-<branch> into .env
```

Each parallel instance also needs its **own bot token** (next paragraph) — create a throwaway
dev bot per worktree via `@BotFather`.

**One instance per token.** Telegram allows a single long-polling consumer per bot token; a
second one gets `409 Conflict` and both degrade. Stop the old process before starting a new
one — `scripts/service.sh restart` and `systemctl restart` both do this correctly.

## Operating notes

- **Data lives in one SQLite file** at `DB_PATH`. Back that up and you have backed up
  everything. There is nothing else stateful.
- **Photos are never persisted.** They are downloaded to memory, analyzed, and dropped. No
  image and no image path is ever written to the database.
- **`/delete` erases a user's data**, cascading to all their logged meals. It is irreversible
  and has no export first.
- **Adding a user later** means adding their id to `ALLOWED_USER_IDS` and restarting.
- **Changing `TZ` mid-life** shifts the daily-total boundary; already-stored meals keep the
  date they were recorded under.
- **Languages:** English, Russian and German ship. The bot follows each user's Telegram client
  language and `/settings` can change it. Adding one is a JSON file plus a registry line — see
  `src/README.md`.

## Upgrading

```bash
git pull
bun install
bun test && bun run typecheck
scripts/service.sh restart      # or: systemctl restart eait
```

Run the tests before restarting, not after. The database migrates itself on open via
`user_version`; there is no separate migration command.
