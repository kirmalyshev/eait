# AGENTS.md — docs/

Design docs, not code.

`superpowers/` (specs + plans) is **gitignored** — local working notes that do not ship. Never cite a file under it as authoritative in a tracked doc: a public cloner cannot read it. Anything that must survive belongs in a tracked file.

- `SELF_HOSTING.md` is the one file here aimed at *operators*, not developers. It documents observable behaviour — env vars, startup log lines, commands — so it goes stale when those change. If you rename a script, change a startup message, or add a required env var, update it in the same commit.
- `ACCURACY_EVAL.md` is a **procedure for a human with a kitchen scale**, not a script reference. It documents the one part of the accuracy loop no script can do. Keep the flag lists in it minimal and let `scripts/README.md` own those — duplicated flags rot.
- `NUTRITION_DB.md` is a research + design doc for #8. It separates what was **verified reachable** (endpoints actually probed) from what was only read about — preserve that distinction when updating, because access terms and licences are exactly the part that goes stale.
- Tracked and public: `SELF_HOSTING.md`, `PRIVACY.md`, `ACCURACY_EVAL.md`, `NUTRITION_DB.md`, `README.md`. These are what a cloner actually gets.
- Nothing here is imported by the runtime — safe to edit without affecting the bot.
