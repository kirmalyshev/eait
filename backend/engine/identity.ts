// Signing in with Apple or Google, and what that does to the account you already had.
//
// The interesting part is not verification (that is `auth/verify.ts`) — it is the five outcomes
// below. A nutrition app is used before it is signed into: someone photographs a meal, then logs
// in, and the meals they already logged must not evaporate. Equally, signing into an account that
// already exists must not quietly graft a stranger's data onto it.
//
// So: an ANONYMOUS session merges into the identity's account. A session that already carries a
// real identity does not — it just switches. That asymmetry is the whole design, and it is the
// reason `isAnonymous` exists rather than the code merging whenever two accounts meet.

import type { AuthProviderResponse, LinkOutcome, Provider } from "@ieat/shared";
import type { IdentityVerifier } from "../auth/verify.ts";
import type { EngineDeps } from "./deps.ts";

/** An account is anonymous while `device` is the only thing that identifies it. */
export async function isAnonymous(deps: EngineDeps, userId: string): Promise<boolean> {
  const identities = await deps.store.listIdentities(userId);
  return identities.every((i) => i.provider === "device");
}

export async function signInWithProvider(
  deps: EngineDeps,
  verifier: IdentityVerifier,
  provider: "apple" | "google",
  idToken: string,
  nonce: string | undefined,
  /** The account the caller is currently in, if they sent a bearer token. */
  currentUserId: string | null,
): Promise<AuthProviderResponse> {
  // Throws `AuthError` on anything wrong with the token. The route turns that into a 401 and logs
  // the reason; the reason never reaches the client, because it can echo the token.
  const verified = await verifier.verify(provider, idToken, nonce);
  const existing = await deps.store.userIdForIdentity(provider, verified.subject);

  let userId: string;
  let outcome: LinkOutcome;
  let mergedMeals: number | undefined;

  if (currentUserId === null) {
    if (existing) {
      // A returning user on a new device. This is the case that makes signing in worth doing at
      // all — the account outlives the phone.
      userId = existing;
      outcome = "switched";
    } else {
      userId = await deps.store.createUser("en");
      await deps.store.addIdentity(userId, provider, verified.subject);
      outcome = "created";
    }
  } else if (existing === null) {
    // Nothing claims this identity yet — attach it to whoever is asking. Works both for an
    // anonymous session (the common case) and for adding Google to an Apple account.
    await deps.store.addIdentity(currentUserId, provider, verified.subject);
    userId = currentUserId;
    outcome = "linked";
  } else if (existing === currentUserId) {
    userId = currentUserId;
    outcome = "already";
  } else if (await isAnonymous(deps, currentUserId)) {
    // The only merge we perform: anonymous data moves into the real account.
    mergedMeals = await deps.store.mergeUsers(currentUserId, existing);
    userId = existing;
    outcome = "merged";
  } else {
    // Two accounts that both have real identities. Merging them is a decision with no safe
    // default — whose profile wins? whose targets? — so we sign into the one being presented and
    // leave the other exactly as it was. Nothing is destroyed and nothing is guessed.
    userId = existing;
    outcome = "switched";
  }

  const token = await deps.store.issueToken(userId);
  const profile = await deps.store.getProfile(userId);

  return {
    token,
    userId,
    outcome,
    onboarded: profile?.onboarded_at !== null && profile !== null,
    ...(mergedMeals !== undefined ? { mergedMeals } : {}),
  };
}

/** What is linked to this account, for the settings screen. */
export async function identitiesFor(
  deps: EngineDeps,
  userId: string,
): Promise<{ provider: Provider; linkedAt: string }[]> {
  return deps.store.listIdentities(userId);
}
