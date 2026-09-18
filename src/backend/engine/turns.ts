// A billed turn, answered once (#708).
//
// The phone and the browser keep a turn that lost its answer and send it again, under the same
// client id, when the connection is back. The request may have reached this server the first time
// and run to the end — logged the meal, charged the analysis — with only the answer lost on the way
// back (#540, #616). So the id is CLAIMED before anything runs, and a second request carrying it is
// answered with what the first one settled, or waits for it while it is still running. Nothing a
// replay does calls a model, charges an analysis or writes a meal.

import { OUTCOME_UNKNOWN } from "@eait/shared";
import type { EngineDeps } from "./deps.ts";

/** How often a replay looks for the answer of a first attempt still running. */
const REPLAY_POLL_MS = 250;
/** Past the turn's own model budget: the store writes, the thread, a busy pool. */
const SETTLE_MARGIN_MS = 30_000;
/**
 * How long a turn's answer is kept for a replay. A lost answer is asked for again the next time the
 * phone has a connection — minutes, at worst hours. The answer is a copy of a result (a meal's
 * numbers, a coach's sentence) that also outlives a deleted meal, so it is not kept longer than
 * that need. The claim itself is kept: a replay after this is an unknown, never a second run.
 */
export const TURN_OUTCOME_TTL_MS = 24 * 60 * 60 * 1000;
/** A capture this close to now IS now: a phone clock a minute slow must not move a live meal across midnight. */
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
/** Older than this, a capture time is a broken clock rather than a meal kept that long. */
const OLDEST_CAPTURE_MS = 365 * 24 * 60 * 60 * 1000;

/** A replay whose first attempt failed mid-turn, or never answered: nobody knows what it did. */
export class TurnUnsettled extends Error {}

/**
 * Run `run` at most once per `(userId, clientId)`. `calls` is how many model budgets the turn may
 * spend, which bounds how long a replay waits for a first attempt that is still running.
 *
 * THE FIRST ATTEMPT'S THROW IS SETTLED AS `OUTCOME_UNKNOWN`: the throw can come after the meal was
 * inserted (#514), so its replay throws too, and the route words it as the unknown it is.
 */
export async function once<R extends object>(
  deps: EngineDeps,
  userId: string,
  clientId: string | undefined,
  calls: number,
  run: () => Promise<R>,
): Promise<R> {
  if (clientId === undefined) return run();
  const settle = (outcome: object) => deps.store.settleTurn(userId, clientId, outcome).catch((e: unknown) => {
    // The turn is done and the user has their answer; only a replay of it is worse off, and it
    // reads an unanswered claim as the unknown it then is.
    console.error(`[eait] turn not settled: ${(e as Error)?.message ?? e}`);
  });

  if (await deps.store.claimTurn(userId, clientId)) {
    let result: R;
    try {
      result = await run();
    } catch (e) {
      await settle({ kind: OUTCOME_UNKNOWN });
      throw e;
    }
    await settle(result);
    return result;
  }

  for (;;) {
    const turn = await deps.store.getTurn(userId, clientId);
    if (turn?.outcome) {
      // Not served past its time, whenever the daily sweep gets to it.
      if (Date.now() - turn.claimedAt > TURN_OUTCOME_TTL_MS) throw new TurnUnsettled("replayed turn's answer is past keeping");
      if ((turn.outcome as { kind?: unknown }).kind === OUTCOME_UNKNOWN) throw new TurnUnsettled("replayed turn failed mid-turn");
      return turn.outcome as R;
    }
    if (!turn || Date.now() > turn.claimedAt + calls * deps.config.llmTimeoutMs + SETTLE_MARGIN_MS) {
      throw new TurnUnsettled("replayed turn never settled");
    }
    await new Promise((r) => setTimeout(r, REPLAY_POLL_MS));
  }
}

/**
 * When a turn happened, from the client's `capturedAt` — the moment the photo was taken or the
 * words sent, which for a queued turn is not when it arrives. Now, when it is unreadable, within a
 * few minutes of now either way (a live turn from a phone whose clock drifts), in the future, or a
 * year old.
 */
export function eatenAt(capturedAt: string | undefined, now: number = Date.now()): Date {
  const at = capturedAt === undefined ? NaN : Date.parse(capturedAt);
  const kept = Number.isFinite(at) && at < now - CLOCK_TOLERANCE_MS && at > now - OLDEST_CAPTURE_MS;
  return new Date(kept ? at : now);
}
