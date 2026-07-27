import { RequestContext } from "@mastra/core/request-context";

/** The one key every tool reads its caller's user id from. A tool's `inputSchema` must NEVER
 * carry a user-identifying field — the model must never be able to ask for another user's rows
 * by supplying an id itself; only the caller (bot.ts, in later plans) may bind one. */
const USER_ID_KEY = "userId";

/** Builds the per-call RequestContext, binding the authenticated Telegram user id from the
 * caller — never from anything the model produces. This is the ONLY place a RequestContext is
 * constructed for an agent call in this codebase. */
export function buildRequestContext(userId: number): RequestContext {
  const ctx = new RequestContext();
  ctx.set(USER_ID_KEY, userId);
  return ctx;
}

/** Reads the bound user id back out inside a tool's `execute`. Throws rather than defaulting —
 * a tool call with no bound user id is a wiring bug, not a legitimate anonymous request, and must
 * fail loudly rather than silently reach the wrong (or no) user's rows. */
export function requireUserId(requestContext: RequestContext): number {
  const userId = requestContext.get(USER_ID_KEY);
  if (typeof userId !== "number" || !Number.isFinite(userId)) {
    throw new Error(
      "llm/context: no userId bound on this RequestContext — wiring bug, not a valid call",
    );
  }
  return userId;
}
