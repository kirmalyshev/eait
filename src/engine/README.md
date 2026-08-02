# src/engine/

The product engine: what the app does, independent of how a request arrived.

| File | Holds |
|---|---|
| `meals.ts` | `logPhotoMeal`, `confirmPendingMeal`/`dropPendingMeal`/`cancelPendingMeal` |
| `text.ts` | `handleText` — routing to question / proposed meal / correction / re-date |
| `diary.ts` | `day`, `week` — reads a mobile client is mostly made of |
| `edits.ts` | chat-targeted editing: propose, disambiguate, apply |
| `onboarding.ts` | `advanceOnboarding` — signup, so a front end can CREATE a user |
| `settings.ts` | `openSettings`/`applySettingsAction`/`submitSettingsInput`/`setUserLanguage` |
| `caps.ts` | the spend policy, shared by every surface |
| `admin.ts` | cap + allowlist administration, and `deleteAccount` (the one erasure) |
| `profile.ts` | `profileFromRow`, `mealRecordToAnalysis`, `replyFormatFor` — the read boundaries |
| `results.ts` | the result unions: data, never rendered strings |
| `index.ts` | the public surface a front end imports from |

Both `src/tg_bot/` and `src/api/` are front ends over this, and neither is privileged: the whole
user lifecycle — create, configure, use, erase — is reachable from either. `boundary.test.ts`
enforces both directions of that (the engine imports no transport; a surface imports only
`index.ts`). See `AGENTS.md` for the invariants.
