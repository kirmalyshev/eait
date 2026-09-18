# Security policy

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private vulnerability reporting on this repository
(*Security → Report a vulnerability*), or email [lets@eait.fit](mailto:lets@eait.fit) with
"security" in the subject.

Include what you found, where (file, route, or version), how to reproduce it, and what you think
the impact is. You will get an acknowledgement within 3 working days and a decision on severity
and a fix timeline within 10. Please keep the report private until a fix has shipped; you will be
credited in the fix unless you ask not to be.

## What is in scope

This repository: the server under `src/backend/`, the contract under `src/shared/` and the web application
under `src/frontend/`. The hosted service
at `api.eait.fit` runs this code; a finding against it is welcome here too, but **do not test
against other people's accounts or data** — use an account you created, and stop at proof.

Out of scope: the iOS app and the landing page (a separate, private repository —
report to the same address), and third-party services this backend calls (OpenRouter, RevenueCat,
Resend, Apple, Google), which have their own programmes.

## Supported versions

`main` only. There are no tagged releases; the hosted service deploys from `main`.

## What the code already promises

The rules under "Hard conventions" in `AGENTS.md` are the security model: `userId` is resolved
from credentials and never read from a request; every store access is scoped by it; uploads are
sniffed, bounded and never written to disk; model output is validated against a schema and never
trusted for verdicts; error strings are logged and never returned. A report that shows one of
those false is the most useful kind.
