# src/api/

HTTP over the engine, for the mobile client. Off unless `API_PORT` is set.

| Route | Does |
|---|---|
| `GET /health` | liveness; the one unauthenticated route |
| `POST /v1/meals/photo` | multipart `photo` (repeatable = one meal, several angles) + optional `caption` |
| `POST /v1/messages` | `{text, focusMealId?}` → answer, proposed meal, correction, or re-date |
| `POST /v1/meals/pending/:id/confirm` | logs a proposed text meal; 410 if it expired or was already confirmed |
| `POST /v1/meals/pending/:id/cancel` | discards a proposal; nothing was ever written to `meals` |
| `GET /v1/diary/day` | `?date=YYYY-MM-DD` (default: today, Europe/Berlin) |
| `GET /v1/diary/week` | `?days=N` (1–90, default 7) |
| `POST /v1/onboarding` | `{input}` — `{type:"command",command:"start"}` / `{type:"callback",data}` / `{type:"text",text}` → `{state, text, buttons}`. `Accept-Language` seeds the locale on first contact |
| `GET /v1/settings` | the settings root: summary text + buttons |
| `POST /v1/settings` | `{action}` to tap a control, or `{field, text}` to answer the prompt one opened (409 if that field is not the armed one) |
| `POST /v1/language` | `{lang}` — a registry code, else 400 |
| `DELETE /v1/account` | erases the caller's account and every row of theirs; idempotent. DELETE only — `GET`/`POST` are 404 |

**No authentication scheme is wired yet** — `resolveUserId` returns `null`, so every route except
`/health` answers 401. See `AGENTS.md`.
