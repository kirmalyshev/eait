# src/engine/

The product engine: what the app does, independent of how a request arrived.

| File | Holds |
|---|---|
| `meals.ts` | `logPhotoMeal`, `confirmPendingMeal`/`dropPendingMeal`/`cancelPendingMeal` |
| `text.ts` | `handleText` — routing to question / proposed meal / correction / re-date |
| `diary.ts` | `day`, `week` — reads a mobile client is mostly made of |
| `caps.ts` | the spend policy, shared by every surface |
| `profile.ts` | `profileFromRow`, `mealRecordToAnalysis` — the read boundaries |
| `results.ts` | the result unions: data, never rendered strings |
| `index.ts` | the public surface a front end imports from |

Both `src/tg_bot/` and `src/api/` are front ends over this. See `AGENTS.md` for the invariants.
