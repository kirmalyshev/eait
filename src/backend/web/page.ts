// The pages `/start` renders — one module per screen under `page/`, re-exported here so the
// route (`start.ts`) and the tests import one surface. `page/shell.ts` is the document itself:
// the stylesheet, the one hashed script, `shell()` and `html()`.

/**
 * Every sentence this surface writes for itself, gated by a test against `lintCopy`.
 *
 * IT IS THIS AND NOT THE RENDERED PAGE, and the difference is worth stating. The questions are the
 * admin's onboarding copy, which says things like "Lose weight" — a goal a user picks, not a
 * promise anybody made — and the claims linter cannot tell those apart: `weight-promise` matches
 * `lose\s*weight` wherever it appears. Gating the whole page would make the surface unbuildable
 * against copy that has always shipped, ungated, inside the app. So what is gated is what is NEW:
 * the words below, which are this page's own and are public marketing copy in a way an in-app
 * question is not.
 */
export { PAGE_COPY, PAGE_COPY_BY_LANG, pageCopyFor, type PageCopy } from "./copy.ts";

export * from "./page/shell.ts";
export * from "./page/board.ts";
export * from "./page/front-door.ts";
export * from "./page/sign-up.ts";
export * from "./page/question.ts";
export * from "./page/moment.ts";
export * from "./page/offer.ts";
export * from "./page/stopped.ts";
export * from "./page/chat.ts";
export * from "./page/plan.ts";
export * from "./page/building.ts";
export * from "./page/country.ts";
