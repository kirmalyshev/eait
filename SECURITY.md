# Security policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private reporting: **Security → Advisories → Report a vulnerability** on
<https://github.com/kirmalyshev/eait>. That channel is private to the maintainer.

Expect a first response within a week. This is a personal side project, not a funded product —
there is no bounty and no guaranteed remediation window. Fixes land as commits, and severe ones
are noted in the release description.

### Worth reporting

- Anything letting one user read or modify another user's meals or profile.
- Anything causing a secret (bot token, API key) to be logged, stored, or transmitted.
- Anything persisting a raw image, which the design forbids outright.
- Prompt injection through a photo or a correction that reaches beyond the analyzer's own JSON
  output — for example influencing another user's result.
- Anything letting an unauthenticated party drive spend on a hosted instance beyond its
  configured caps.

### Not vulnerabilities

- Inaccurate nutrition estimates. They are approximate by nature and documented as such.
- The hosted demo bot being open to anyone: that is deliberate. It is bounded by
  `GLOBAL_DAILY_ANALYSIS_CAP`; report a way to *exceed* that cap, not the openness itself.
- Missing rate limits on a self-hosted instance you configured without caps.

## Operator responsibilities

If you self-host, you are the operator and the security boundary is yours:

- Set `ALLOWED_USER_IDS` unless you intend an open bot, and `GLOBAL_DAILY_ANALYSIS_CAP` if you
  do. Every photo is a billed model call.
- Keep `.env` out of version control. It is gitignored; `bun run security` fails the build if it
  is ever tracked.
- If a token leaks, revoke it immediately — `@BotFather` → `/revoke` for the bot token, and the
  OpenRouter dashboard for the API key.
- You are the data controller for your users. See `docs/PRIVACY.md` for what is collected.

## What the repo does to protect itself

- `bun run security` — scans tracked files for secret patterns, operator-specific strings, and a
  tracked `.env`. Runs in CI and as an optional pre-commit hook
  (`git config core.hooksPath .githooks`).
- [gitleaks](https://github.com/gitleaks/gitleaks) over full git history, in CI.
- `bun audit` for dependency advisories, and Dependabot for weekly updates.
