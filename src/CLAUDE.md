# CLAUDE.md — src/

Thin pointer. Read `src/AGENTS.md` (this folder's invariants) and the root `AGENTS.md`/`CLAUDE.md` (project-wide rules + guardrails).

Reminders that matter most here: meal queries are `WHERE id = ? AND user_id = ?`; images are temp-file → analyze → delete (always); the analyzer owns the prompt + zod parse; dates are Europe/Berlin. TDD, one file at a time, `bun test`.
