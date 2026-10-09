// The super-admin's push composer (eait#531): chosen accounts, a shipped campaign template sent in
// each account's own language, and the screen a tap opens. Every send claims the account's push slot
// like any sender (R1 — only the staff TEST send bypasses it), skips EVERY account without push_offers_at
// (every composer send is promotional; there is no request field to say otherwise), and is logged under `admin:<adminId>`.

import { ADMIN_PUSH_MAX_RECIPIENTS, CAMPAIGN_VARIANTS, isCampaignTemplateKey, isPushRoute, localDate, type CampaignTemplateKey, type Lang, type PushKind, type PushRoute } from "@eait/shared";
import { apiHostOf } from "../push/choose.ts";
import { ownImage } from "../push/expo.ts";
import type { EngineDeps } from "./deps.ts";
import { sendLogged, zoneOf } from "./notify.ts";
import { pushDevices, pushOffersAllowed } from "./push-consent.ts";
import { campaignWords } from "./push-templates.ts";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export type AdminPushSkip = "no-account" | "no-device" | "no-offers" | "template-incomplete" | "slot-taken";
export type AdminPushResult =
  | { ok: false; errors: string[] }
  | { ok: true; results: ({ userId: string } & ({ sent: number } | { skipped: AdminPushSkip; heldBy?: PushKind }))[] };

export async function sendAdminPush(deps: EngineDeps, adminId: string, body: unknown, now: number = Date.now()): Promise<AdminPushResult> {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const ids = Array.isArray(b.userIds) ? [...new Set(b.userIds)] : [];
  if (ids.length === 0 || ids.length > ADMIN_PUSH_MAX_RECIPIENTS || !ids.every((i): i is string => typeof i === "string" && UUID.test(i))) {
    errors.push(`userIds: 1 to ${ADMIN_PUSH_MAX_RECIPIENTS} account ids`);
  }
  if (b.confirmCount !== ids.length) errors.push("confirmCount: must equal the number of accounts shown");
  if (!isCampaignTemplateKey(b.templateKey)) errors.push("templateKey: a campaign template");
  if (!isPushRoute(b.route)) errors.push("route: a known screen");
  let image: string | undefined;
  if (b.imageUrl !== undefined) {
    image = typeof b.imageUrl === "string" ? ownImage(b.imageUrl, apiHostOf(deps.config.publicApiUrl)) : undefined;
    if (image === undefined) errors.push("imageUrl: must be on this server's own host");
  }
  if (errors.length > 0) return { ok: false, errors };

  const key = b.templateKey as CampaignTemplateKey;
  const route = b.route as PushRoute;
  const results: Extract<AdminPushResult, { ok: true }>["results"] = [];
  for (const userId of ids as string[]) {
    const skip = (skipped: AdminPushSkip, heldBy?: PushKind) => results.push({ userId, skipped, ...(heldBy ? { heldBy } : {}) });
    const profile = await deps.store.getProfile(userId);
    if (!profile) { skip("no-account"); continue; }
    if (!await pushOffersAllowed(deps, userId)) { skip("no-offers"); continue; }
    const devices = await pushDevices(deps, userId);
    if (devices.length === 0) { skip("no-device"); continue; }
    // Before the slot: a refused template must not spend the day's one message.
    const words = await campaignWords(deps, key, profile.lang as Lang, CAMPAIGN_VARIANTS[0]!, 1);
    if (!words) { skip("template-incomplete"); continue; }
    const zone = zoneOf(deps, await deps.store.timezoneOf(userId));
    const claim = await deps.store.claimPushSlot(userId, localDate(zone, new Date(now)), "campaign", `admin:${adminId}`);
    if (!claim.claimed) { skip("slot-taken", claim.heldBy); continue; }
    const out = await sendLogged(
      deps, userId, devices,
      { kind: "campaign", ref: `admin:${adminId}`, templateKey: key, lang: profile.lang, variant: "admin-send" },
      { title: words.title, body: words.body, ...(image ? { imageUrl: image } : {}) },
      { route },
    );
    results.push({ userId, sent: out.sent });
  }
  const count = (f: (r: (typeof results)[number]) => boolean) => results.filter(f).length;
  console.log(`[eait] admin push: ${adminId} template=${key} route=${route} recipients=${ids.length} sent=${count((r) => "sent" in r)} skipped=${count((r) => "skipped" in r)}`);
  return { ok: true, results };
}
