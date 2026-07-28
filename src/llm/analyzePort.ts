// The domain seam for meal analysis — "analyze these photos for this user", with the engine that
// answers it hidden behind the function type.
//
// WHY A PORT AND NOT AN `Agent` IN `BotDeps`. A Mastra `Agent` in the caller's dependencies makes
// every caller a Mastra caller: each unit test would have to build a scripted `MockLanguageModelV4`
// AND a Postgres-backed `Memory` (Mastra engages memory on every `generate`, so a storage-less one
// fails before the model is consulted) to assert something like "the repertoire reached the
// prompt". That is a transport integration test wearing a unit test's clothes, and there are ~50 of
// them. A function type is injectable in one line.
//
// It is also the shape the engine wants (`docs/design/2026-07-28-mastra-engine-boundary.md`): the
// product engine depends on the CAPABILITY "analyze a meal", not on the vendor that provides it.
// `LLMProvider` was the transport seam — `chat(request) → string`. This is the domain seam one level
// up, and the two are not redundant: the analyzer still owns the prompt and the parse, as the root
// convention requires, and this port is what hands the result to the engine.

import type { Agent } from "@mastra/core/agent";
import { analyzeMealViaAgent } from "./analyzeViaAgent.ts";
import { routeTextViaAgent } from "./routeViaAgent.ts";
import { classifyRestrictionsViaAgent } from "./classifyViaAgent.ts";
import { buildRequestContext } from "./context.ts";
import type { RouteContext, RouteResult } from "../analyzer.ts";
import type { MealAnalysis, MealContext, Profile } from "../types.ts";

/**
 * Analyze one meal's photos. Several images are angles of ONE meal, never several dishes.
 *
 * No user id parameter: the authenticated user is `profile.telegram_id`, and taking it separately
 * would create a second place for the two to disagree — on a call whose whole job is to be scoped
 * to one person.
 */
export type AnalyzePhoto = (
  images: readonly Uint8Array[],
  profile: Profile,
  context?: MealContext,
) => Promise<MealAnalysis>;

/**
 * Bind a Mastra agent as the meal analyzer.
 *
 * This is the ONE place a photo analysis gets its `RequestContext`, and it derives the bound user
 * from `profile.telegram_id` — the authenticated caller, never anything a model produced. Keeping
 * the binding here rather than at each call site is what makes "no tool can reach another user's
 * rows" a property of the wiring instead of a rule every caller has to remember.
 */
export function photoAnalyzerViaAgent(agent: Agent): AnalyzePhoto {
  return (images, profile, context) =>
    analyzeMealViaAgent(agent, images, profile, buildRequestContext(profile.telegram_id), context);
}

/**
 * Route one free-text message to an intent. Same union `routeText` returned, so the caller's
 * dispatch is unchanged.
 */
export type RouteText = (
  text: string,
  profile: Profile,
  ctx: RouteContext,
) => Promise<RouteResult>;

/** Bind a Mastra agent as the free-text router. Same RequestContext discipline as the analyzer. */
export function textRouterViaAgent(agent: Agent): RouteText {
  return (text, profile, ctx) =>
    routeTextViaAgent(agent, text, profile, ctx, buildRequestContext(profile.telegram_id));
}

/**
 * Map free-text restrictions onto the closed tag vocabulary. NEVER throws — `[]` means "keep the
 * keyword result", and the whole call is a refinement of an answer the user already gave.
 */
export type ClassifyRestrictions = (
  text: string,
  profile: Pick<Profile, "telegram_id" | "lang">,
) => Promise<string[]>;

/** Bind a Mastra agent as the onboarding restriction classifier. */
export function restrictionClassifierViaAgent(agent: Agent): ClassifyRestrictions {
  return (text, profile) =>
    classifyRestrictionsViaAgent(agent, text, profile.lang, buildRequestContext(profile.telegram_id));
}
