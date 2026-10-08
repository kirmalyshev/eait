// The "tips and offers" push toggle (Apple 4.5.4): an explicit in-app opt-in, default OFF, stored on
// the server with the moment it was turned on. It has its OWN column (`users.push_offers_at`) and is
// not the sign-up marketing box (`marketing_consent_at`): that is another consent, and ticking or
// clearing either never moves the other. Reminders (onboarding, streak) do not read this;
// anything promotional must (`pushOffersAllowed`).

import type { PushConsentResponse } from "@eait/shared";
import type { EngineDeps } from "./deps.ts";

export async function pushConsent(deps: EngineDeps, userId: string): Promise<PushConsentResponse> {
  const at = await deps.store.pushOffersOf(userId);
  return { offers: at !== null, at };
}

export async function setPushConsent(deps: EngineDeps, userId: string, offers: boolean): Promise<PushConsentResponse> {
  await deps.store.setPushOffers(userId, offers);
  return pushConsent(deps, userId);
}

/** The gate for any promotional push: false until the person said yes in the app. */
export const pushOffersAllowed = async (deps: EngineDeps, userId: string): Promise<boolean> =>
  (await pushConsent(deps, userId)).offers;
