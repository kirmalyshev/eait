# scripts/

Dev/ops helpers — not part of the bot runtime. Run with `bun run scripts/<name>.ts`.

- `smoke-openrouter.ts` — manual smoke test: sends one real image to the configured model and prints the raw output. Verifies OpenRouter + `openai/gpt-5.2` vision + structured output actually work. **Run this before relying on the model** (needs a real `OPENROUTER_API_KEY`; makes a real network + billed call). Also `bun run smoke`.
- `security-scan.ts` — repo safety gate (`bun run security`). Scans tracked files for secret patterns, personal-data leaks (operator id/name), and forbidden tracked files (`.env`). Exits non-zero on any finding. Runs in CI (`.github/workflows/security.yml`) and, once enabled, as a pre-commit hook: `git config core.hooksPath .githooks`.

## Security CI

- `.github/workflows/security.yml` — on push/PR/weekly: `repo-safety` (security-scan + tests + `bun audit`) and `secret-scan` (gitleaks over full history).
- `.github/dependabot.yml` — weekly GitHub-Actions version bumps.
- `.githooks/pre-commit` — local gate; enable with `git config core.hooksPath .githooks`.
