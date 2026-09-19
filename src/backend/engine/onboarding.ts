// Onboarding content and the funnel behind it.
//
// Two jobs, and they belong together because they are two halves of one loop: the admin edits the
// words, the app reports what happened to them, and the funnel says whether the edit helped. A
// version number rides on every event so those two facts can actually be joined.
//
// What is NOT here is the sequence — that lives in `@eait/shared/onboarding.ts`, because the app
// derives the same "what comes next" without asking. This module owns storage and aggregation only.

import {
  DEFAULT_ONBOARDING_CONTENT, MAX_ONBOARDING_EVENTS_PER_BATCH, ONBOARDING_ACTIONS,
  ONBOARDING_PLACES, isReportableField, localDate, onboardingContentFor, storedContentSet,
  usableContentFor, validateOnboardingContent,
  type ContentValidation, type FunnelRow, type Lang, type OnboardingContent, type OnboardingEvent,
  type OnboardingFunnel, type OnboardingPlace,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import type { AdminMetrics } from "../store.ts";

/** Every place an event may name — the questions, and the three places that are not questions. */
const PLACES: readonly string[] = ONBOARDING_PLACES;

/**
 * The copy this server serves, in ONE language.
 *
 * Falls back to that language's compiled-in copy when nothing has been saved for it, so a fresh
 * database serves a complete flow rather than an empty one, and a host whose admin has only ever
 * written German serves German to Germans and the shipped Italian to Italians. The app has the same
 * defaults compiled in — this is what makes the fetch an enhancement rather than a dependency.
 *
 * NOT ENGLISH ON A MISS. Falling back across languages would put English screens in the middle of
 * an Italian onboarding, which is the failure `LANGS_READY` exists to keep out of the picker.
 *
 * THROUGH `usableContentFor`, WHICH WRAPS THE SAME GUARD THE APP RUNS, and it earns its place here
 * for a case the app's copy cannot cover: a row saved by an OLDER BUILD of this server. The app
 * would discard such a revision on arrival and fall back — but the admin editor would load it, an
 * admin would edit two words in it, and the save would be refused for a question that has been
 * missing since before they opened the page. Serving the default instead means the editor opens on
 * something that can be saved.
 */
export async function onboardingContent(deps: EngineDeps, lang: Lang): Promise<OnboardingContent> {
  return usableContentFor(lang, await deps.store.getOnboardingContent());
}

/**
 * Save admin-edited copy for ONE language, leaving the other seven exactly as they were.
 *
 * THE MERGE IS THE STORE'S. This used to read the whole set, spread its own language over it and
 * write the lot back — safe while nobody else is saving, and a lost update the moment two admins
 * save two languages at once. `putOnboardingContent` does it with `jsonb_set` on the locked row.
 *
 * The version is assigned by the STORE, not accepted from the admin and no longer computed here:
 * it is the join key between a funnel row and the words that produced it, and an admin who saves
 * twice with the same number silently merges two experiments into one meaningless average. Two
 * concurrent saves computing it from the same read did exactly that.
 *
 * ONE COUNTER ACROSS ALL EIGHT LANGUAGES. Counting per language would let a German save and an
 * English save both land on 7 — two revisions, different words, one number, which is the same
 * meaningless average wearing a translation. The compiled-in revisions share a number because they
 * ARE one editorial revision; every save after that takes the next number nobody has used, in
 * whichever language it was made. What is passed from here is only the FLOOR, which is a compiled-in
 * constant rather than a read.
 */
export async function saveOnboardingContent(
  deps: EngineDeps,
  input: unknown,
  lang: Lang,
): Promise<ContentValidation> {
  // The validator wants a version, so it gets the FLOOR — the compiled-in revision plus one, which
  // is the lowest number a save may land on. The store decides the real one against the row it is
  // writing, under its lock, and hands it back; that number is what goes to the admin, because a
  // concurrent save in another language may legitimately have taken the one asked for.
  const floor = onboardingContentFor(lang).version + 1;
  const withVersion =
    typeof input === "object" && input !== null
      ? { ...(input as Record<string, unknown>), version: floor }
      : input;

  const result = validateOnboardingContent(withVersion);
  if (!result.ok) return result;
  const version = await deps.store.putOnboardingContent(lang, result.content, floor);
  return { ...result, content: { ...result.content, version } };
}

/** Restore the shipped copy for one language. The undo button for an edit that went wrong. */
export async function resetOnboardingContent(deps: EngineDeps, lang: Lang): Promise<OnboardingContent> {
  const floor = onboardingContentFor(lang).version + 1;
  const restored = { ...onboardingContentFor(lang), version: floor };
  return { ...restored, version: await deps.store.putOnboardingContent(lang, restored, floor) };
}


/**
 * Accept a batch of funnel events.
 *
 * SANITISED, NOT TRUSTED. The app is the only intended caller, but the route is authenticated with
 * a user's own token, so anything here reaches the table if it is let through:
 *
 *   - an unknown `place` or `action` becomes a row nobody's query counts, and a funnel with an
 *     unbounded vocabulary cannot be indexed or read;
 *   - `value` is dropped for any field not on the reportable list, which is the mechanism that
 *     keeps body weight and free text out of analytics even if a client sends them. The rule is
 *     enforced on the WRITE — a client-side promise about what it sends is not a control;
 *   - strings are truncated, because an event id is a primary key and a megabyte of it is a
 *     denial-of-service with extra steps.
 *
 * Returns how many rows were new. A duplicate is not an error: the app retries batches.
 */
export async function recordOnboardingEvents(
  deps: EngineDeps,
  userId: string,
  events: unknown,
): Promise<number> {
  if (!Array.isArray(events)) return 0;

  const clean: OnboardingEvent[] = [];
  for (const raw of events.slice(0, MAX_ONBOARDING_EVENTS_PER_BATCH)) {
    if (typeof raw !== "object" || raw === null) continue;
    const e = raw as Record<string, unknown>;

    const id = str(e.id, 100);
    const sessionId = str(e.sessionId, 100);
    const place = str(e.place, 40);
    const action = str(e.action, 20);
    if (!id || !sessionId) continue;
    if (!PLACES.includes(place)) continue;
    if (!(ONBOARDING_ACTIONS as readonly string[]).includes(action)) continue;

    const field = str(e.field, 40);
    const contentVersion = Number.isInteger(e.contentVersion) ? (e.contentVersion as number) : 0;
    const ms = Number.isFinite(e.ms) ? Math.max(0, Math.round(e.ms as number)) : undefined;
    // The privacy rule, enforced server-side. A value for a field that is not enumerated is
    // discarded rather than the event being rejected — losing one column beats losing the funnel.
    const value = field && isReportableField(field) ? str(e.value, 120) : "";

    clean.push({
      id,
      sessionId,
      place: place as OnboardingPlace,
      action: action as OnboardingEvent["action"],
      contentVersion,
      at: isoOrNow(e.at),
      ...(ms !== undefined ? { ms } : {}),
      ...(field ? { field } : {}),
      ...(value ? { value } : {}),
    });
  }

  if (clean.length === 0) return 0;
  return deps.store.recordOnboardingEvents(userId, clean);
}

/**
 * The numbers past the funnel (#377).
 *
 * ONE PAIR THAT MATTERS, not a wall. The funnel answers how far into onboarding people get and
 * nothing else; these answer the two questions an operator acts on — **what is being spent** (the
 * bill, and how close the instance is to its own budget) and **whether anybody came back**.
 *
 * THE CAP HEADROOM IS COMPUTED HERE because the cap is configuration and the store has none:
 * `globalDailyAnalysisCap` is the instance's budget, zero means unbounded, and the panel must not
 * hold a second copy of that rule.
 *
 * SPEND IS WHAT THE PROVIDER REPORTED (#484), per day beside the count: `costUsd` is a floor
 * whenever `unpriced` is not zero, and nothing here prices a call itself. The cap stays in COUNTS,
 * because that is the unit `globalDailyAnalysisCap` is set in.
 */
export async function adminMetrics(
  deps: EngineDeps,
  days: number,
): Promise<AdminMetricsView> {
  const cap = deps.config.globalDailyAnalysisCap;
  const metrics = await deps.store.adminMetrics({
    days,
    today: localDate(deps.config.timezone),
    timezone: deps.config.timezone,
  });
  return {
    ...metrics,
    dailyAnalysisCap: cap,
    // Zero is "no instance budget at all", which is not the same as a budget with nothing left —
    // and reporting it as 0 headroom would read as the instance being full.
    headroom: cap === 0 ? null : Math.max(0, cap - (metrics.days[metrics.days.length - 1]?.analyses ?? 0)),
  };
}

export interface AdminMetricsView extends AdminMetrics {
  /** The instance's daily budget in analyses. Zero means there is none. */
  dailyAnalysisCap: number;
  /** What is left of today's budget, or null when there is no budget. */
  headroom: number | null;
}

/** The funnel, in the order the screens are actually shown. */
export async function onboardingFunnel(deps: EngineDeps, days: number): Promise<OnboardingFunnel> {
  const agg = await deps.store.onboardingFunnel(days);
  // THE NEWEST REVISION IN ANY LANGUAGE, because the counter is one counter (`store.putOnboardingContent`) and
  // this row names which words the numbers below were collected against. Reading English's alone
  // would report a stale number on a host whose last edit was German.
  const set = storedContentSet(await deps.store.getOnboardingContent());
  const contentVersion = Math.max(
    DEFAULT_ONBOARDING_CONTENT.version,
    ...Object.values(set).map((c) => c?.version).filter((v): v is number => typeof v === "number"),
  );
  // The order a person meets them in, which is what makes a drop between two rows readable as a
  // drop. It is fixed in code now: the chat asks in an order its own replies depend on, so there is
  // no admin ordering left to follow.
  const order = ONBOARDING_PLACES as readonly OnboardingPlace[];
  const byPlace = new Map(agg.rows.map((r) => [r.place, r]));

  const rows: FunnelRow[] = order.map((place) => {
    const r = byPlace.get(place);
    return {
      place,
      views: r?.views ?? 0,
      answers: r?.answers ?? 0,
      backs: r?.backs ?? 0,
      rejects: r?.rejects ?? 0,
      medianMs: r?.medianMs ?? null,
    };
  });

  return {
    sessions: agg.sessions,
    completed: agg.completed,
    days,
    contentVersion,
    rows,
  };
}

/** A bounded string, or "" for anything that is not one. */
function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** A client clock we can store, or ours. A phone with a wrong date must not break the insert. */
function isoOrNow(v: unknown): string {
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return new Date().toISOString();
}
