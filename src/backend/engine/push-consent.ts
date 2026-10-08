// The "tips and offers" toggle (Apple 4.5.4): default OFF, stored on the server with the moment it
// was turned on. It is `marketing_consent_at`, the stamp the sign-up box already writes, so there is
// one consent and one place that answers it. Reminders (onboarding, streak) do not read it; anything
// promotional must (`pushOffersAllowed`).

import type { PushConsentResponse } from "@eait/shared";
import type { EngineDeps } from "./deps.ts";

export async function pushConsent(deps: EngineDeps, userId: string): Promise<PushConsentResponse> {
  const at = (await deps.store.consentOf(userId))?.marketingConsentAt ?? null;
  return { offers: at !== null, at };
}

export async function setPushConsent(deps: EngineDeps, userId: string, offers: boolean): Promise<PushConsentResponse> {
  await deps.store.setMarketingConsent(userId, offers);
  return pushConsent(deps, userId);
}

/** The gate for any promotional push: false until the person said yes. */
export const pushOffersAllowed = async (deps: EngineDeps, userId: string): Promise<boolean> =>
  (await pushConsent(deps, userId)).offers;
