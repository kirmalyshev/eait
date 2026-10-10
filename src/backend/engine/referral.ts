// Refer a friend (#899): one link per account, a week for the friend at once, and a week for the
// referrer when that friend first pays — two if the friend goes yearly (Kirill, 10 Oct).
//
// THE FRIEND'S WEEK is granted HERE, by redemption, because joining is the thing it rewards. THE
// REFERRER'S is not, and no route grants it: it comes from `applyRevenueCatEvent`, at the friend's
// first paid period, because a sign-up is free to farm and a payment is not. Both weeks land in
// `users.bonus_until`, the third grant `entitlementLive` counts.

import { normalizeReferralCode, type ProfileResponse, type ReferralView } from "@eait/shared";
import type { Config } from "../config.ts";
import type { EngineDeps } from "./deps.ts";
import { profileView } from "./profile.ts";

/**
 * The referrer's reward for a friend paying for `productId`: the config's own entry, else a week,
 * two for a product whose id names a year.
 *
 * THE CONFIG MAP IS THE ANSWER; the name is the fallback for a host that never set it, by the rule
 * the web client already uses to tell the two plans apart (`frontend/screens/today.ts`). A guess
 * only ever pays LESS: an id that names a month anywhere is a week even if it also says "year"
 * ("eait_monthly_yearly_promo"). The ceiling: a yearly product whose id says neither "year" nor
 * "annual" pays a week until it is listed in `EAIT__BACKEND__REFERRAL_REWARD_DAYS`.
 */
export function referralRewardDays(config: Config, productId: string): number {
  const listed = config.referralRewardDays[productId];
  if (listed !== undefined) return listed;
  return /year|annual/i.test(productId) && !/month/i.test(productId) ? 14 : 7;
}

/** Where the link points: the landing page, else the web app, else this API. */
const linkBase = (c: Config): string => c.landingUrl || c.publicWebUrl || c.publicApiUrl;

export async function referralView(deps: EngineDeps, userId: string): Promise<ReferralView> {
  const row = await deps.store.referralOf(userId);
  return {
    link: row ? `${linkBase(deps.config)}/r/${row.code}` : "",
    applied: row?.applied ?? false,
    joined: row?.joined ?? 0,
    subscribed: row?.subscribed ?? 0,
    weeksEarned: Math.floor((row?.daysEarned ?? 0) / 7),
  };
}

export type RedeemRefusal = { kind: "referral-unknown" | "referral-own" | "referral-already" | "referral-paid" };

/**
 * Apply a friend's code to the caller's account and start the caller's week. `input` is whatever
 * the client sent — a pasted link, a typed code, or garbage, which is `referral-unknown`.
 */
export async function redeemReferral(
  deps: EngineDeps, userId: string, input: unknown,
): Promise<ProfileResponse | RedeemRefusal> {
  const code = typeof input === "string" ? normalizeReferralCode(input) : null;
  if (code === null) return { kind: "referral-unknown" };
  const out = await deps.store.redeemReferral(userId, code, deps.config.referralFriendDays);
  if (out !== "ok") return { kind: `referral-${out}` };
  // The caller's own account, which the redemption has just written to.
  return (await profileView(deps, userId))!;
}

/** A share's channel: a short label, never free text — what is not accepted cannot be stored. */
const VIA = /^[a-z0-9][a-z0-9_.-]{0,31}$/;

/** Count one share of the caller's link. False when `via` is not a label. */
export async function shareReferral(deps: EngineDeps, userId: string, via: unknown): Promise<boolean> {
  const label = typeof via === "string" ? via.trim().toLowerCase() : "";
  if (!VIA.test(label)) return false;
  await deps.store.recordReferralShare(userId, label);
  return true;
}
