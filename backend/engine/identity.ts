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

import { PROVIDERS } from "@eait/shared";
import type { AuthProviderResponse, LinkOutcome, Provider } from "@eait/shared";
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

  // THE ADDRESS, ON WHICHEVER ACCOUNT THE BRANCHES ABOVE LANDED ON. After the branch and not
  // inside it, because four of the five outcomes can carry one and only two of them link anything
  // — a returning user (`switched`) adds no identity at all, and that is the ONLY path an account
  // linked before the scope was requested will ever take again.
  //
  // Absent means absent: Apple sends an address on the first authorization and never again, so a
  // token without one says nothing about the user and must not overwrite what is stored.
  //
  // IT NEVER FAILS THE SIGN-IN, the same rule the thread write follows and for a harder reason.
  // By the time this runs the account has been created, the identity linked, and — on the `merged`
  // path — the anonymous account's meals MOVED and its device identity dropped. All of that is
  // committed and none of it is repeatable. A throw here reaches `api/routes.ts` as something
  // other than an `AuthError`, so the client gets a 500 and "sign-in didn't complete", and the
  // retry lands on `switched` with the merge already done. For Apple that also spends the address
  // permanently: it arrives in the FIRST authorization and in no later one. An address is worth
  // less than the account it belongs to, so a store failure is logged and the turn continues.
  await recordEmail(deps, userId, provider, verified, outcome);

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

/**
 * Store the address, and say so in the log when there was not one.
 *
 * THE ABSENT PATH IS LOGGED because nothing reads this column back. A client upgrade that stops
 * requesting the scope, a Google client whose grant changes, or Apple altering the verified-email
 * shape all land here as a silent false branch on a successful sign-in — and every Apple user who
 * signs in during that window spends their one first authorization and can never be asked again.
 * Only `created` and `linked` are worth a line: `switched` and `already` are the ordinary returning
 * user, whose token carries no Apple address by design and would otherwise log on every sign-in.
 */
async function recordEmail(
  deps: EngineDeps,
  userId: string,
  provider: "apple" | "google",
  verified: { subject: string; email?: string },
  outcome: LinkOutcome,
): Promise<void> {
  if (verified.email === undefined) {
    if (outcome === "created" || outcome === "linked") {
      console.warn(`[eait] ${provider} sign-in (${outcome}) carried no verified address`);
    }
    return;
  }
  try {
    await deps.store.setIdentityEmail(userId, provider, verified.subject, verified.email);
  } catch (e) {
    // Never the address itself in the log — it is the personal datum this whole change is about.
    console.error(`[eait] ${provider} address not stored: ${(e as Error)?.message ?? e}`);
  }
}

/** What is linked to this account, for the settings screen. */
export async function identitiesFor(
  deps: EngineDeps,
  userId: string,
): Promise<{ provider: Provider; linkedAt: string }[]> {
  return deps.store.listIdentities(userId);
}

/**
 * Unlink one provider from the caller's own account (#246).
 *
 * THE SUBJECT COMES OUT OF THE STORE, never out of the request. The route knows a provider and the
 * caller's own `userId`; the subject is resolved from the account's own identities, so there is no
 * shape of body that could name somebody else's link. `removeIdentity` is scoped as well, which
 * makes it two independent reasons rather than one.
 *
 * `device` IS REFUSED. It is the anonymous credential the install was born with rather than
 * something a person linked, the settings list does not render it, and dropping it would leave a
 * signed-out session locked out of an account that still exists.
 *
 * REMOVING THE LAST WAY IN ERASES THE ACCOUNT — that is `removeIdentity`'s own rule and it is one
 * atomic step, so nothing can interleave between "is anything else linked" and the delete. It is
 * left alone deliberately: a paired browser session is NOT an identity and does not count as "this
 * account is reachable", which was decided when #209 was designed. What is added here is that the
 * caller is TOLD, so a phone holding a session for an account that no longer exists finds out from
 * the answer rather than from the next 401.
 */
export async function unlinkIdentity(
  deps: EngineDeps,
  userId: string,
  provider: string,
): Promise<{ ok: true; deleted: boolean; identities: { provider: Provider; linkedAt: string }[] }
  | { ok: false; reason: "unsupported-provider" | "not-linked" }> {
  if (provider === "device" || !(PROVIDERS as readonly string[]).includes(provider)) {
    return { ok: false, reason: "unsupported-provider" };
  }
  const subject = await deps.store.identitySubject(userId, provider as Provider);
  if (subject === null) return { ok: false, reason: "not-linked" };

  const outcome = await deps.store.removeIdentity(userId, provider as Provider, subject);
  // `not-found` is a concurrent delivery having got there first — Apple's revocation notification
  // reaches the same method. Nothing was removed and nothing was deleted, and the account is in the
  // state the caller asked for either way.
  if (outcome === "not-found") return { ok: false, reason: "not-linked" };
  return {
    ok: true,
    deleted: outcome === "account-deleted",
    identities: outcome === "account-deleted" ? [] : await deps.store.listIdentities(userId),
  };
}

/**
 * How far an event may predate the link it names before it is treated as a copy of an old message.
 *
 * A real revocation always happens after the sign-in it revokes, so this margin exists only for
 * clock skew between Apple and this server. Five minutes is far beyond any plausible drift, and
 * what it gives up is narrow: a user who revokes and then re-links within five minutes while a
 * delivery is still being retried gets the fresh link torn down. Erring the other way — refusing a
 * genuine revocation because our clock runs fast — leaves a session alive that somebody asked to
 * end, and that is the failure this whole endpoint exists to prevent.
 */
const STALE_MARGIN_MS = 5 * 60 * 1000;

/**
 * Sign in with Apple was revoked for this subject, or the Apple Account behind it was deleted.
 *
 * ONE function for both, because the consequence is identical: that identity can never
 * authenticate here again. Apple's guidance for receiving the notification is to sign the user
 * out, so this ends every session the account has anywhere — not the one that happens to be in
 * front of us, because there is no request in front of us at all.
 *
 * The account itself survives IF something else can still reach it (a Google identity, or the
 * device it started on). If nothing can, it is deleted: an account nobody will ever open again,
 * holding what somebody typed about their kidneys, is special-category data kept with no basis
 * and no way for its owner to ask for it back. That test and that deletion are ONE store call, for
 * the reason its port comment gives — asked as two, a second delivery lands between them and
 * erases an account a device could still reach.
 *
 * AN EVENT OLDER THAN THE LINK IT NAMES IS IGNORED. Apple's notifications carry no expiry, and its
 * deliveries are neither ordered nor once-only, so a redelivery of a revocation the user has since
 * undone arrives looking exactly like a fresh one. Applied, it tears down a link that was
 * re-granted after the revocation — and on an account whose only way in is Apple, it erases
 * everything logged since. This is the rule `putEntitlement` and `weight_measured_at` already
 * enforce elsewhere: apply an event only when it is newer than what is stored. An event with no
 * usable time is applied, because a revocation that cannot be ordered is still a revocation and
 * refusing it would leave the session alive.
 *
 * THE ORDER IS THE OTHER CORRECTNESS PROPERTY, because there is no transaction spanning these
 * calls and Apple's answer to a 500 is to send the message again. The `identities` row is the
 * lookup key this function resolves through, so whatever destroys it goes LAST: revoking tokens
 * first is idempotent, and a redelivery after any failure resolves the same account and repeats
 * the sequence. Dropping the identity first instead would leave the retry resolving nothing,
 * answering 200, and the session the user revoked alive — silently, since the log would read
 * exactly like an unknown subject. `identity.test.ts` fails each step in turn and asserts the
 * redelivery finishes the job.
 *
 * ONE WINDOW IS LEFT OPEN, deliberately, and it is worth describing accurately. BETWEEN the token
 * revocation and the removal the identity row is still there, so a sign-in landing in that gap
 * resolves the ORIGINAL account and mints a fresh session for it — reviving exactly the access the
 * revocation just ended. AFTER the removal, the same sign-in instead creates a new, empty account
 * for the same subject (`signInWithProvider` above), which holds nothing.
 *
 * Both need an Apple ID token minted before the revocation — they live minutes and Apple publishes
 * no revocation list — landing inside a window measured in milliseconds. Folding these two writes
 * into one transaction would NARROW the first case and not close it: the sign-in's own read and its
 * token insert are not serialized against this either, so a token issued from a read taken before
 * the commit survives regardless. Closing it means the sign-in path locking the identity row, which
 * is more machinery than this is worth.
 *
 * `subject` is the ONE user-identifying value in this engine that did not come from a session. It
 * is safe because it arrived inside a signature-verified message from Apple — see
 * `api/apple-notifications.ts` — and because an unknown one resolves to no account and does
 * nothing. Nothing here creates a user.
 */
export async function revokeAppleIdentity(
  deps: EngineDeps,
  subject: string,
  /** Apple's `event_time`, in epoch milliseconds, or null when it did not send a usable one. */
  eventTimeMs: number | null,
): Promise<"unknown" | "stale" | "unlinked" | "deleted"> {
  const identity = await deps.store.identityFor("apple", subject);
  if (identity === null) return "unknown";

  const linkedAt = Date.parse(identity.linkedAt);
  if (eventTimeMs !== null && Number.isFinite(linkedAt) && eventTimeMs + STALE_MARGIN_MS < linkedAt) {
    return "stale";
  }

  await deps.store.revokeTokensFor(identity.userId);

  // `not-found` is a concurrent delivery having removed the row first. Nothing left to do, and
  // nothing to report differently: the identity is gone either way.
  const removed = await deps.store.removeIdentity(identity.userId, "apple", subject);
  return removed === "account-deleted" ? "deleted" : "unlinked";
}
