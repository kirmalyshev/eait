// The "tips and offers" push toggle (Apple 4.5.4): an explicit in-app opt-in, default OFF, stored on
// the server with the moment it was turned on. It has its OWN column (`users.push_offers_at`) and is
// not the sign-up marketing box (`marketing_consent_at`): that is another consent, and ticking or
// clearing either never moves the other. Anything promotional must read it (`pushOffersAllowed`).
//
// The account-wide Notifications switch is a second, separate column (`users.push_off_at`, null =
// allowed, the default). Off, the account is sent NO push of any kind: every sender reads its
// devices through `pushDevices`, so an opted-out account is skipped before any slot is claimed.

import type { PushConsentRequest, PushConsentResponse } from "@eait/shared";
import type { PushToken } from "../store.ts";
import type { EngineDeps } from "./deps.ts";

export async function pushConsent(deps: EngineDeps, userId: string): Promise<PushConsentResponse> {
  const at = await deps.store.pushOffersOf(userId);
  return { offers: at !== null, at, notifications: (await deps.store.pushOffOf(userId)) === null };
}

/** Applies whichever fields are present; an old build sends `offers` alone. */
export async function setPushConsent(deps: EngineDeps, userId: string, change: PushConsentRequest): Promise<PushConsentResponse> {
  if (change.offers !== undefined) await deps.store.setPushOffers(userId, change.offers);
  if (change.notifications !== undefined) await deps.store.setPushOff(userId, !change.notifications);
  return pushConsent(deps, userId);
}

/** The devices a push may go to: none while the account turned Notifications off. */
export async function pushDevices(deps: EngineDeps, userId: string): Promise<PushToken[]> {
  return (await deps.store.pushOffOf(userId)) === null ? deps.store.pushTokensFor(userId) : [];
}

/** The gate for any promotional push: false until the person said yes in the app. */
export const pushOffersAllowed = async (deps: EngineDeps, userId: string): Promise<boolean> =>
  (await pushConsent(deps, userId)).offers;
