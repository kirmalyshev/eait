// Refer a friend (#899): one link per account, a week for the friend at once, and a week for the
// referrer when that friend first pays — two if the friend goes yearly (Kirill, 10 Oct).
//
// THE FRIEND'S WEEK is granted HERE, by redemption, because joining is the thing it rewards. THE
// REFERRER'S is not, and no route grants it: it comes from `applyRevenueCatEvent`, at the friend's
// first paid period, because a sign-up is free to farm and a payment is not. Both weeks land in
// `users.bonus_until`, the third grant `entitlementLive` counts.

import { normalizeReferralCode, type ProfileResponse, type ReferralView } from "@eait/shared";
import type { Config } from "../config.ts";
import type { ReferralStats } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { profileView } from "./profile.ts";
import { readReferralBonus } from "./entitlement.ts";

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

/** An account's invite link — `<origin>/r/<code>`. */
export const referralLink = (c: Config, code: string): string => `${linkBase(c)}/r/${code}`;

export async function referralView(deps: EngineDeps, userId: string): Promise<ReferralView> {
  const [row, bonus] = await Promise.all([deps.store.referralOf(userId), readReferralBonus(deps, userId)]);
  return {
    bankedDays: bonus.bankedShown,
    link: row ? referralLink(deps.config, row.code) : "",
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
  const out = code === null ? "unknown" : await deps.store.redeemReferral(userId, code, deps.config.referralFriendDays);
  if (out !== "ok") {
    // Counted for the admin's "refused at the step", by reason alone.
    await deps.store.recordReferralRefusal(out);
    return { kind: `referral-${out}` };
  }
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

/**
 * A link-preview fetcher rather than a person: the messaging apps fetch a shared link to draw its
 * card, and counting those would count every share as an open. No user agent at all is one too.
 */
export const isLinkPreview = (userAgent: string | null): boolean =>
  !userAgent || /bot\b|bot\/|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|embedly|skype|vkshare|curl|wget|python|headless/i.test(userAgent);

/**
 * Count one open of the invite page for `input`'s code — a request to `/r/<code>`. Nothing about
 * the visitor is kept: not the address, not the device, not the agent string read here.
 */
export async function openInvite(deps: EngineDeps, input: string, userAgent: string | null): Promise<void> {
  const code = normalizeReferralCode(input);
  if (code !== null && !isLinkPreview(userAgent)) await deps.store.recordReferralOpen(code);
}

/** The admin's window, in days: 7, 30 and 90 are what the header offers; anything else is clamped. */
const ADMIN_MAX_DAYS = 90;

export interface ReferralAdminView extends ReferralStats {
  window: number;
  timezone: string;
}

/** The admin's Referrals view (#899): counts over the last `days` days, in this server's zone. */
export async function referralAdminView(deps: EngineDeps, days: number): Promise<ReferralAdminView> {
  const window = Number.isFinite(days) ? Math.min(ADMIN_MAX_DAYS, Math.max(1, Math.floor(days))) : 7;
  const timezone = deps.config.timezone;
  return { window, timezone, ...await deps.store.referralStats(window, timezone) };
}
