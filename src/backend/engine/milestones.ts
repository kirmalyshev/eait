// Milestones (ieat-app#1395): which of Cal AI's 36 badges an account has earned.
//
// The rule is `shared/milestones.ts` (`evaluate`, pure); this gathers the rows and writes down what
// was earned. Badges are recomputed from the whole log after every meal and weight write — never
// incremented — so a badge is never decided from numbers that have since changed, and an earned
// one stays earned because `earnMilestones` only ever inserts.

import {
  BADGES, BADGE_IDS, dayHealthScore, evaluate, explainTargets, forgivingStreak, localDate, localTime,
  type MilestoneMeal, type MilestonesResponse,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { mergedWeights } from "./weights.ts";

/** Everything `evaluate` needs, read once. Null when the account has no profile to take a target from. */
async function gather(deps: EngineDeps, userId: string) {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const zone = deps.config.timezone;
  const today = localDate(zone);
  const outcome = explainTargets(profile);
  const [rows, weights, health] = await Promise.all([
    deps.store.milestoneMeals(userId),
    mergedWeights(deps, userId, "0001-01-01"),
    deps.store.healthDaysSince(userId, "0001-01-01"),
  ]);
  const food = rows.filter((r) => r.meal.isFood);
  const meals: MilestoneMeal[] = food.map(({ meal, createdAt }) => {
    const at = new Date(createdAt);
    return {
      date: meal.date,
      createdDate: localDate(zone, at),
      createdHour: Number(localTime(zone, at).slice(0, 2)) % 24,
      kcal: meal.kcal,
      nameEn: meal.items.flatMap((i) => (i.name_en ? [i.name_en] : [])),
      healthScore: null,
    };
  });
  const byDate = new Map<string, typeof food>();
  for (const r of food) byDate.set(r.meal.date, [...(byDate.get(r.meal.date) ?? []), r]);
  const dayScores = new Map<string, number | null>();
  for (const [d, list] of byDate) dayScores.set(d, dayHealthScore(list.map((r) => r.meal)));
  // The streak is `forgivingStreak` (#574), the same read `DaysResponse` makes, over the whole log.
  const kcalByDate = new Map<string, number>();
  for (const r of food) if (r.meal.date <= today) kcalByDate.set(r.meal.date, (kcalByDate.get(r.meal.date) ?? 0) + r.meal.kcal);
  const { streak, longest } = forgivingStreak(kcalByDate, today, outcome.basis.floorKcal);
  return {
    streak,
    inputs: {
      today,
      floorKcal: outcome.basis.floorKcal,
      targetKcal: outcome.targets.kcal,
      streakLongest: longest,
      meals,
      weights: weights.map((w) => ({ date: w.date, kg: w.kg })),
      workouts: health.flatMap((h) => (h.workouts ? [{ date: h.date, count: h.workouts }] : [])),
      dayScores,
    },
  };
}

/**
 * Recompute and record. Called after every meal write and every weight write; never a reason for
 * that write to fail — a badge missed here is earned by the next write, since it is recomputed
 * from the log, so a failure is a log line.
 */
export async function evaluateMilestones(deps: EngineDeps, userId: string): Promise<void> {
  if (!deps.config.milestonesEnabled) return;
  try {
    const g = await gather(deps, userId);
    if (!g) return;
    const have = new Set((await deps.store.getMilestones(userId)).map((r) => r.badge_id));
    const fresh = evaluate(g.inputs).filter((id) => !have.has(id));
    if (fresh.length > 0) await deps.store.earnMilestones(userId, fresh, new Date().toISOString());
  } catch (e) {
    console.error(`[eait] milestones not evaluated: ${(e as Error)?.message ?? e}`);
  }
}

/** Earned and not yet seen, oldest first. Empty while the flag is off. */
export async function unseenBadges(deps: EngineDeps, userId: string): Promise<string[]> {
  if (!deps.config.milestonesEnabled) return [];
  return (await deps.store.getMilestones(userId)).filter((r) => r.seen_at === null).map((r) => r.badge_id);
}

/** `GET /v1/milestones`. Null when the account has no profile — a 403 at the surface. */
export async function milestones(deps: EngineDeps, userId: string): Promise<MilestonesResponse | null> {
  const g = await gather(deps, userId);
  if (!g) return null;
  const earned = await deps.store.getMilestones(userId);
  const at = new Map(earned.map((r) => [r.badge_id, r.earned_at]));
  return {
    streak: g.streak,
    streakLongest: Math.max(g.inputs.streakLongest, g.streak),
    badges: BADGES.map((b) => ({ id: b.id, earnedAt: at.get(b.id) ?? null })),
    unseen: earned.filter((r) => r.seen_at === null).map((r) => r.badge_id),
  };
}

/** `POST /v1/milestones/seen`. Ids outside the wall are dropped; the store ignores the unearned. */
export async function markSeen(deps: EngineDeps, userId: string, ids: string[]): Promise<MilestonesResponse | null> {
  await deps.store.seeMilestones(userId, ids.filter((id) => BADGE_IDS.has(id)), new Date().toISOString());
  return milestones(deps, userId);
}
