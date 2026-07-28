// What the engine needs to do its job — and deliberately nothing more.
//
// No `send`, no translator, no message ids, no grammy. Compare `BotDeps`, which carries a
// `RejectionLog` and an `Allowlist` because the Telegram surface needs them: those are transport
// concerns and stay there.

import type { Config } from "../config.ts";
import type { Db } from "../db.ts";
import type { AnalyzePhoto, ClassifyRestrictions, RouteText } from "../llm/analyzePort.ts";

export interface EngineDeps {
  db: Db;
  config: Config;
  analyzePhoto: AnalyzePhoto;
  routeText: RouteText;
  classifyRestrictions: ClassifyRestrictions;
}

/**
 * Every engine call is scoped to one authenticated user, and the id arrives as an ARGUMENT — never
 * read from a request body, a model output, or a tool call. Telegram binds it from the update;
 * `src/api/` binds it from the authenticated session. Same discipline as `RequestContext` one layer
 * down, for the same reason.
 */
export type UserId = number;
