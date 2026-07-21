# AGENTS.md — docs/

Design docs, not code. The spec (`superpowers/specs/2026-07-21-eait-design.md`) is the source of truth for schema, flows, and the §18 hardening list — consult it before changing behavior in `src/`.

- Keep the spec authoritative: if an implementation choice diverges, record the reason (in the spec or a decisions log), don't let code and spec silently drift.
- `superpowers/plans/` is gitignored (local working notes); don't rely on it being present.
- Nothing here is imported by the runtime — safe to edit without affecting the bot.
