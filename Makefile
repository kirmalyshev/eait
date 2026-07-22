# Dev-loop ergonomics for THIS worktree. Self-hosters never need make — they get
# docker-compose.selfhost.yml; this file drives the branch-development flow documented in
# AGENTS.md (shared Postgres via scripts/db.sh, per-branch identity via scripts/compose-env.sh).

.DEFAULT_GOAL := help
.PHONY: help env infra infra-down up down restart deploy logs ps psql test typecheck security check

help:
	@echo "eait dev targets:"
	@echo "  make up          shared Postgres + build + start THIS worktree's bot container"
	@echo "  make down        stop this worktree's bot (the shared Postgres keeps running)"
	@echo "  make restart     restart the bot container on its CURRENT image (no rebuild)"
	@echo "  make deploy      ship: git pull + rebuild + restart the bot (run in the main checkout)"
	@echo "  make logs        follow the bot container logs"
	@echo "  make ps          container status for this worktree"
	@echo "  make env         write this worktree's identity into .env (compose project + branch database)"
	@echo "  make psql        psql into this branch's database"
	@echo "  make infra       start the shared dev Postgres only"
	@echo "  make infra-down  stop the shared Postgres — affects EVERY worktree (data survives)"
	@echo "  make test | typecheck | security | check (= all three)"
	@echo ""
	@echo "One long-polling consumer per bot token: don't 'make up' beside a native/launchd bot"
	@echo "running the same TELEGRAM_BOT_TOKEN — Telegram answers 409 and both degrade."

env:
	sh scripts/compose-env.sh

infra:
	sh scripts/db.sh up

infra-down:
	sh scripts/db.sh down

# .env must already exist (setup.sh, or cp .env.example .env — it holds the secrets); the
# per-worktree identity is applied automatically so `up` can never hijack another worktree's
# compose project by running under a default name.
up: infra
	@test -f .env || { echo "no .env — run ./scripts/setup.sh, or: cp .env.example .env"; exit 1; }
	@grep -q '^COMPOSE_PROJECT_NAME=' .env || sh scripts/compose-env.sh
	docker compose up -d --build
	docker compose ps

down:
	docker compose down

restart:
	docker compose restart bot

# Ship the merged code to the running instance: pull, rebuild the image, swap the container.
# Migrations run at boot. Meant for the main checkout; in a worktree it deploys THAT branch.
deploy:
	git pull
	docker compose up -d --build bot
	docker compose ps

logs:
	docker compose logs -f bot

ps:
	docker compose ps

psql:
	sh scripts/db.sh psql

test:
	bun test

typecheck:
	bun run typecheck

security:
	bun run security

check: test typecheck security
