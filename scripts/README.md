# scripts/

Dev/ops helpers — not part of the bot runtime. Run with `bun run scripts/<name>.ts`.

- `setup.sh` — **the entrypoint for self-hosters.** Prerequisites → dependencies → test → `.env` → optional smoke test → optional service install. Idempotent; never overwrites `.env` without asking; reads secrets with echo off and never prints them back. `--help` for usage; `EAIT_NONINTERACTIVE=1` with the vars in the environment for provisioning.
- `smoke-openrouter.ts` — manual smoke test: sends one real image to the configured model and prints the raw output. Verifies OpenRouter + whatever `LLM_MODEL` resolves to (default lives in `src/config.ts`) does vision + structured output. **Run this before relying on the model** (needs a real `OPENROUTER_API_KEY`; makes a real network + billed call). Also `bun run smoke`.
- `service.sh` — run eait as a persistent service, **macOS (launchd) or Linux (systemd user unit)**: `scripts/service.sh {install|start|stop|restart|status|logs|uninstall}`. Generates the unit locally (no machine paths committed); logs → `logs/`. On macOS `status` also reports the last exit code, because `launchctl list` shows a crash-looping service as loaded.
- `security-scan.ts` — repo safety gate (`bun run security`). Scans tracked files for secret patterns, personal-data leaks (operator id/name), and forbidden tracked files (`.env`). Exits non-zero on any finding. Runs in CI (`.github/workflows/security.yml`) and, once enabled, as a pre-commit hook: `git config core.hooksPath .githooks`.

## Security CI

- `.github/workflows/security.yml` — on push/PR/weekly: `repo-safety` (security-scan + tests + `bun audit`) and `secret-scan` (gitleaks over full history).
- `.github/dependabot.yml` — weekly bun (runtime deps) + GitHub-Actions updates.
- `.githooks/pre-commit` — local gate running **both** CI secret checks (`security-scan.ts` + `gitleaks git --staged`), so a leak is caught before it enters the history rather than after. The two are complementary: the custom scanner knows this repo's personal-data rules, gitleaks knows the vendor token formats. Enable with `git config core.hooksPath .githooks`. If gitleaks is not installed the hook says so and continues — CI still enforces it.
