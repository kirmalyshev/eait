// The HTTP surface as DATA: method, path, auth, request and response types per route.
//
// `ROUTES` names the paths and the doc comments beside them say the rest in prose. This table says
// the same in a shape a machine can read, and `src/scripts/openapi.ts` turns it and the types it names
// into `openapi.json`. Nothing here is a second source of truth: the paths come from `ROUTES` (the
// test checks each template against the function it names), and the schemas come from the types
// `shared/` already exports. What this adds is the METHOD and the wiring — which the server
// currently states only by the branch it takes in `backend/api/routes.ts`.
//
// Every `ROUTES` key appears here or in `UNDOCUMENTED` with a reason, and the test says so.

import { REFUSAL_STATUS, ROUTES } from "./contract.ts";

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** A JSON body: the name of an exported type. Multipart and form bodies list their fields. */
export type RequestBody =
  | { json: string }
  | { multipart: Record<string, "file[]" | "string"> }
  | { form: Record<string, string> };

/** A response body: the name of an exported type, or an inline schema for the few with no type. */
export type ResponseBody = string | Record<string, unknown>;

export interface Endpoint {
  route: keyof typeof ROUTES;
  method: Method;
  /** OpenAPI template; `{name}` per path parameter. Checked against `ROUTES[route]` by the test. */
  path: string;
  auth: "none" | "bearer" | "optional";
  summary: string;
  request?: RequestBody;
  /** Query parameters, name → description. */
  query?: Record<string, string>;
  /** Status → body. Refusals from `REFUSAL_STATUS` are added by `refuses`, not listed here. */
  responses: Record<number, ResponseBody>;
  /** Answers every kind in `REFUSAL_STATUS` as `ErrorResponse`, at its status. */
  refuses?: true;
  /** With `accept: application/x-ndjson` the answer streams; this names the type of ONE line. */
  stream?: string;
}

const ERROR = "ErrorResponse";
const SIGNED_OUT = { type: "object", properties: { signedOut: { const: true } }, required: ["signedOut"] };

export const API: readonly Endpoint[] = [
  { route: "health", method: "GET", path: "/health", auth: "none",
    summary: "Liveness. `demo` says whether the canned analyzer is serving.",
    responses: { 200: "LivenessResponse" } },

  // ── Sessions ──
  { route: "authDevice", method: "POST", path: "/v1/auth/device", auth: "none",
    summary: "Trade a client-generated device id for a bearer token. Creates the account on first sight.",
    request: { json: "AuthDeviceRequest" },
    responses: { 200: "AuthDeviceResponse", 400: ERROR, 429: ERROR } },
  { route: "authApple", method: "POST", path: "/v1/auth/apple", auth: "optional",
    summary: "Sign in with Apple. With a bearer, links the identity to the current account instead.",
    request: { json: "AuthProviderRequest" },
    responses: { 200: "AuthProviderResponse", 400: ERROR, 401: ERROR, 429: ERROR } },
  { route: "authGoogle", method: "POST", path: "/v1/auth/google", auth: "optional",
    summary: "Sign in with Google. With a bearer, links the identity to the current account instead.",
    request: { json: "AuthProviderRequest" },
    responses: { 200: "AuthProviderResponse", 400: ERROR, 401: ERROR, 429: ERROR } },
  { route: "authSignOut", method: "POST", path: "/v1/auth/signout", auth: "bearer",
    summary: "Drop the caller's own token.", responses: { 200: SIGNED_OUT } },
  { route: "authSignOutEverywhere", method: "POST", path: "/v1/auth/signout/all", auth: "bearer",
    summary: "Drop every token of the caller's account, this one included.", responses: { 200: SIGNED_OUT } },
  { route: "authPair", method: "POST", path: "/v1/auth/pair", auth: "bearer",
    summary: "Mint a short-lived code that hands a browser a session on the caller's account.",
    responses: { 200: "PairCodeResponse", 429: ERROR } },
  { route: "identities", method: "GET", path: "/v1/auth/identities", auth: "bearer",
    summary: "The identities linked to this account.", responses: { 200: "IdentitiesResponse" } },
  { route: "identity", method: "DELETE", path: "/v1/auth/identities/{provider}", auth: "bearer",
    summary: "Unlink one provider. Removing the last way in erases the account; the answer says which.",
    responses: { 200: "UnlinkResponse", 404: ERROR } },

  // ── Profile and onboarding ──
  { route: "profile", method: "GET", path: "/v1/profile", auth: "bearer",
    summary: "The caller's profile, targets and limits.", responses: { 200: "ProfileResponse", 403: ERROR } },
  { route: "profile", method: "PATCH", path: "/v1/profile", auth: "bearer",
    summary: "Edit the profile. Targets are recomputed; a rejected field comes back as 422.",
    request: { json: "PatchProfileRequest" },
    responses: { 200: "ProfileResponse", 403: ERROR, 422: "ProfileRejected" } },
  { route: "onboarding", method: "GET", path: "/v1/onboarding", auth: "bearer",
    // READ BY THE HANDLER (`api/routes.ts`), so it belongs here: the response carries `lang` for
    // the sole purpose of answering this, and a client generated from `openapi.json` could not
    // express the ask at all while only the response half was declared.
    query: { lang: "A Lang code. The account's language when absent, English when unknown." },
    summary: "The onboarding copy this server is serving.", responses: { 200: "OnboardingContentResponse" } },
  { route: "onboardingEvents", method: "POST", path: "/v1/onboarding/events", auth: "bearer",
    summary: "A batch of onboarding funnel events.",
    request: { json: "OnboardingEventsRequest" }, responses: { 200: "OnboardingEventsResponse" } },

  // ── Meals ──
  { route: "photo", method: "POST", path: "/v1/meals/photo", auth: "bearer",
    summary: "Log a meal from one to four photos. Charged. Streams progress with `accept: application/x-ndjson`.",
    request: { multipart: { photo: "file[]", caption: "string" } },
    responses: { 200: "PhotoResponse", 400: ERROR, 411: ERROR, 413: ERROR }, refuses: true, stream: "PhotoProgress" },
  { route: "meal", method: "PATCH", path: "/v1/meals/{id}", auth: "bearer",
    summary: "The manual edit. Verdicts are recomputed, never accepted.",
    request: { json: "EditMealRequest" }, responses: { 200: "EditMealResponse", 400: ERROR, 409: ERROR, 429: ERROR } },
  { route: "meal", method: "DELETE", path: "/v1/meals/{id}", auth: "bearer",
    summary: "Delete the meal, its photos and cards, and the user line that carried it.",
    responses: { 200: "DeleteLineResponse", 409: ERROR, 429: ERROR } },
  { route: "mealPhoto", method: "GET", path: "/v1/meals/{id}/photos/{n}", auth: "bearer",
    summary: "One stored photo of one of the caller's meals, by position. Bytes with their mime.",
    responses: { 200: { type: "string", format: "binary" }, 404: ERROR } },
  { route: "mealPhotos", method: "POST", path: "/v1/meals/{id}/photos", auth: "bearer",
    summary: "Another angle of a logged meal. Stored, not analyzed, not charged.",
    request: { multipart: { photo: "file[]" } },
    responses: { 200: "AttachPhotosResponse", 400: ERROR, 409: ERROR, 411: ERROR, 413: ERROR }, refuses: true },
  { route: "mealReanalyze", method: "POST", path: "/v1/meals/{id}/reanalyze", auth: "bearer",
    summary: "Run the analyzer again over the stored photos. Charged like a photo.",
    responses: { 200: "MealUpdated", 409: ERROR }, refuses: true },
  { route: "pending", method: "GET", path: "/v1/meals/pending", auth: "bearer",
    summary: "The caller's live proposals, oldest first.", responses: { 200: "PendingMealsResponse" } },
  { route: "pendingConfirm", method: "POST", path: "/v1/meals/pending/{id}/confirm", auth: "bearer",
    summary: "Log a proposed meal.", responses: { 200: "ConfirmMealResult", 410: ERROR }, refuses: true },
  { route: "pendingCancel", method: "POST", path: "/v1/meals/pending/{id}/cancel", auth: "bearer",
    summary: "Drop a proposed meal.",
    responses: { 200: { type: "object", properties: { kind: { const: "cancelled" } }, required: ["kind"] }, 410: ERROR } },

  // ── The thread ──
  { route: "messages", method: "GET", path: "/v1/messages", auth: "bearer",
    summary: "The thread, newest page first.",
    query: { before: "Page before this sequence number.", limit: "Page size." },
    responses: { 200: "ChatHistoryResponse" } },
  { route: "messages", method: "POST", path: "/v1/messages", auth: "bearer",
    summary: "One turn. Charged when it reaches the model. Streams with `accept: application/x-ndjson`.",
    request: { json: "MessageRequest" },
    responses: { 200: "MessageResponse", 400: ERROR, 409: ERROR }, refuses: true, stream: "MessageResponse" },
  { route: "messagesLines", method: "POST", path: "/v1/messages/lines", auth: "bearer",
    summary: "The user's own words and Spud's scripted lines, by id. Not charged.",
    request: { json: "AppendLinesRequest" }, responses: { 200: "AppendLinesResponse", 400: ERROR, 429: ERROR } },
  { route: "message", method: "DELETE", path: "/v1/messages/{id}", auth: "bearer",
    summary: "Delete the caller's own line. A photo line takes its meal with it.",
    responses: { 200: "DeleteLineResponse", 400: ERROR, 409: ERROR, 429: ERROR } },
  { route: "message", method: "PATCH", path: "/v1/messages/{id}", auth: "bearer",
    summary: "Re-caption a photo line and add angles; the analyzer re-reads every photo. Charged.",
    request: { multipart: { photo: "file[]", text: "string" } },
    responses: { 200: "EditLineLast", 400: ERROR, 409: ERROR, 411: ERROR, 413: ERROR }, refuses: true, stream: "PhotoProgress" },

  // ── Push, diary, health, account ──
  { route: "pushToken", method: "POST", path: "/v1/push/token", auth: "bearer",
    summary: "Register this device's Expo push token.",
    request: { json: "PushTokenRequest" }, responses: { 200: "PushTokenResponse", 400: ERROR, 429: ERROR } },
  { route: "pushToken", method: "DELETE", path: "/v1/push/token", auth: "bearer",
    summary: "Drop a push token.",
    request: { json: "PushTokenRequest" }, responses: { 200: "PushTokenResponse", 400: ERROR, 429: ERROR } },
  { route: "day", method: "GET", path: "/v1/diary/day", auth: "bearer",
    summary: "One day of the diary.", query: { date: "YYYY-MM-DD; today by default." },
    responses: { 200: "DayResponse", 400: ERROR, 403: ERROR } },
  { route: "week", method: "GET", path: "/v1/diary/week", auth: "bearer",
    summary: "Daily totals over a window.", query: { days: "Window length in days." },
    responses: { 200: "WeekResponse", 400: ERROR, 403: ERROR } },
  { route: "healthTrend", method: "GET", path: "/v1/health", auth: "bearer",
    summary: "The health trend this account has stored. Daily aggregates, never samples.",
    query: { days: "Window length in days." }, responses: { 200: "HealthResponse", 400: ERROR, 403: ERROR } },
  { route: "healthDays", method: "POST", path: "/v1/health/days", auth: "bearer",
    summary: "A batch of daily health aggregates. Upserted.",
    request: { json: "HealthDaysRequest" }, responses: { 200: "HealthDaysResponse", 400: ERROR, 403: ERROR } },
  { route: "account", method: "DELETE", path: "/v1/account", auth: "bearer",
    summary: "Erase the account and everything it holds.",
    responses: { 200: { type: "object", properties: { deleted: { const: true } }, required: ["deleted"] } } },

  // ── The mailing list: form-encoded, for a page with no JavaScript ──
  { route: "subscribe", method: "POST", path: "/v1/subscribe", auth: "none",
    summary: "Join the list. Double opt-in: the address is on no list until the emailed link is followed. Redirects to the landing.",
    request: { form: { email: "The address.", company: "Honeypot; leave empty.", source: "Where the form was." } },
    responses: { 303: {}, 429: ERROR, 502: ERROR } },
  { route: "subscribeConfirm", method: "GET", path: "/v1/subscribe/confirm", auth: "none",
    summary: "The link in the confirmation email. Redirects to the landing.",
    query: { t: "The token from the email." }, responses: { 303: {} } },
  { route: "unsubscribe", method: "GET", path: "/v1/unsubscribe", auth: "none",
    summary: "Leave the list. One click, no login. Redirects to the landing.",
    query: { t: "The token from the email." }, responses: { 303: {} } },
];

/** `ROUTES` keys that are not JSON endpoints, with the reason each is left out. */
export const UNDOCUMENTED: Partial<Record<keyof typeof ROUTES, string>> = {
  webStart: "A server-rendered page, not an endpoint; the app never fetches it.",
};

/** Every refusal kind at its status, for the endpoints that can refuse. */
export const REFUSAL_RESPONSES: ReadonlyArray<[number, string]> =
  [...new Set(Object.values(REFUSAL_STATUS))].sort().map((s) => [s, ERROR]);
