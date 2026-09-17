// Every fixed sentence the browser client writes for itself, gated by `server/copy.test.ts`
// against `lintCopy` — the same arrangement as `PAGE_COPY` in `backend/web/page.ts`.
//
// Sentences with a number in them are assembled in `main.ts` around these; the words that could
// carry a claim are the fixed ones, so those are what live here.

export const COPY = {
  floor: "Your target sits at the minimum this app will ever suggest.",
  connectHealth:
    "Connect Apple Health in the eait iPhone app and your weight keeps this target current.",
  connectTelegram: "Connect Telegram",
  telegramFailed: "No Telegram link this time. Try again.",
} as const;
