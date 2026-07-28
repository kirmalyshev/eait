# src/api/

HTTP over the engine, for the mobile client. Off unless `API_PORT` is set.

| Route | Does |
|---|---|
| `GET /health` | liveness; the one unauthenticated route |
| `POST /v1/meals/photo` | multipart `photo` (repeatable = one meal, several angles) + optional `caption` |
| `POST /v1/messages` | `{text, focusMealId?}` → answer, proposed meal, correction, or re-date |
| `GET /v1/diary/day` | `?date=YYYY-MM-DD` (default: today, Europe/Berlin) |
| `GET /v1/diary/week` | `?days=N` (1–90, default 7) |

**No authentication scheme is wired yet** — `resolveUserId` returns `null`, so every route except
`/health` answers 401. See `AGENTS.md`.
