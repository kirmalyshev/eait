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
  /**
   * Fired after an account is erased, so a surface can drop whatever it holds in MEMORY about that
   * user. Registered once at the composition root (`startBot`), never per call.
   *
   * It exists because the two front ends share one process and the erasure promise is total. The
   * bot's `RejectionLog` is the live case: `createBot` builds it onto its own copy of the deps, so
   * an account deleted through `api/` would leave those entries behind and a reply to a pre-delete
   * "not food" message would still resolve — leaking that the earlier life existed. The engine
   * cannot reach that state and must not know what it is; it can only announce the erasure.
   *
   * Optional, synchronous, and never awaited: a surface's bookkeeping must not be able to fail or
   * delay a deletion that has already happened in the database.
   */
  onAccountDeleted?: (userId: UserId) => void;
}

/**
 * Every engine call is scoped to one authenticated user, and the id arrives as an ARGUMENT — never
 * read from a request body, a model output, or a tool call. Telegram binds it from the update;
 * `src/api/` binds it from the authenticated session. Same discipline as `RequestContext` one layer
 * down, for the same reason.
 */
export type UserId = number;
