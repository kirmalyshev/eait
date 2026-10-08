// Manual push campaigns (ieat-app#1761): the status machine, the runner, the dry run and the test send.
//
// A campaign is one template, one allowlisted segment, a local send time and a rollout percentage.
// The runner is called by the per-minute push tick AFTER the evening sweep, and every guard it needs
// lives in a store statement or an allowlist, never in a read it did first:
//
//   - THE SLOT. A campaign claims the same `push_slot` as every other sender (kind `campaign`, the
//     lowest rank). It claims BEFORE it records the account as handed the campaign, so an account
//     whose day was taken is not marked done: it is tried again the next local day, inside the window.
//   - ONCE PER ACCOUNT. `campaign_send` is a primary key, claimed after the slot, before the send.
//   - THE KILL SWITCHES are re-read before EVERY account, not once per batch, so a flip stops a run
//     between two sends. The global one is a row; the per-campaign one is the campaign's own status.
//   - THE TEMPLATE is re-checked each batch: a language edited back to draft after activation stops
//     the sends rather than putting half a translated set on lock screens.
//   - PROMOTIONAL campaigns reach only accounts with "tips and offers" ON, whatever the segment says.
//
// ponytail: visits every account with a device, per campaign, per minute, and the cheap filters
// (window, rollout, already-handed) run before any read. Past thousands of accounts, select the due
// set in the store instead.

import {
  CAMPAIGN_STATUSES, entitlementLive, habitOf, inRollout, localDate, matchesSegment, pushKeyGaps,
  validateCampaignInput, fillNotification,
  type CampaignInput, type CampaignStatus, type Lang, type NotificationId, type PushKind, type SegmentFacts,
} from "@eait/shared";
import type { CampaignReport, CampaignRow } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { CATCH_UP_MS, instantOf, sendLogged, zoneOf } from "./notify.ts";
import { ensurePushTemplates, sendableCopy } from "./push-templates.ts";

type Result<T> = ({ ok: true } & T) | { ok: false; errors: string[] };

const TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ["scheduled", "killed"],
  scheduled: ["paused", "done", "killed"],
  running: ["paused", "done", "killed"],
  paused: ["scheduled", "done", "killed"],
  done: [],
  killed: [],
};
void CAMPAIGN_STATUSES;

/** What stops `key` from being sent: one `lang/variant` per row that is absent or still a draft. */
async function templateGaps(deps: EngineDeps, key: NotificationId): Promise<string[]> {
  await ensurePushTemplates(deps);
  return pushKeyGaps(await deps.store.listPushTemplates(), key);
}

export async function createCampaign(
  deps: EngineDeps, raw: unknown, createdBy: string | null,
): Promise<Result<{ row: CampaignRow }>> {
  const v = validateCampaignInput(raw);
  if (!v.ok) return v;
  const now = new Date().toISOString();
  const row: CampaignRow = { id: crypto.randomUUID(), ...v.input, status: "draft", createdBy, createdAt: now, updatedAt: now };
  await deps.store.createCampaign(row);
  return { ok: true, row };
}

/** Edit a campaign that has not finished. Activation's template check applies again when the key changes. */
export async function updateCampaign(
  deps: EngineDeps, id: string, raw: Record<string, unknown>,
): Promise<Result<{ row: CampaignRow }>> {
  const current = await deps.store.getCampaign(id);
  if (!current) return { ok: false, errors: ["no such campaign"] };
  if (current.status === "done" || current.status === "killed") return { ok: false, errors: [`a ${current.status} campaign cannot be edited`] };
  const merged: CampaignInput = {
    name: current.name, templateKey: current.templateKey, segment: current.segment,
    localSendTime: current.localSendTime, rolloutPct: current.rolloutPct, promotional: current.promotional,
  };
  const v = validateCampaignInput({ ...merged, ...raw });
  if (!v.ok) return v;
  if (current.status !== "draft" && v.input.templateKey !== current.templateKey) {
    const gaps = await templateGaps(deps, v.input.templateKey);
    if (gaps.length > 0) return { ok: false, errors: [`template ${v.input.templateKey} is not complete: ${gaps.join(", ")}`] };
  }
  const row = await deps.store.updateCampaign(id, v.input);
  return row ? { ok: true, row } : { ok: false, errors: ["no such campaign"] };
}

/** Move a campaign along the status machine. Scheduling needs a complete template. */
export async function setCampaignStatus(
  deps: EngineDeps, id: string, to: CampaignStatus,
): Promise<Result<{ row: CampaignRow }>> {
  const current = await deps.store.getCampaign(id);
  if (!current) return { ok: false, errors: ["no such campaign"] };
  if (!TRANSITIONS[current.status].includes(to)) return { ok: false, errors: [`a ${current.status} campaign cannot become ${to}`] };
  if (to === "scheduled") {
    const gaps = await templateGaps(deps, current.templateKey);
    if (gaps.length > 0) return { ok: false, errors: [`template ${current.templateKey} is not complete: ${gaps.join(", ")}`] };
  }
  const row = await deps.store.updateCampaign(id, { status: to });
  return row ? { ok: true, row } : { ok: false, errors: ["no such campaign"] };
}

export async function setCampaignsKilled(deps: EngineDeps, killed: boolean): Promise<void> {
  await deps.store.setCampaignsKilled(killed);
}

export interface CampaignOverview {
  killed: boolean;
  campaigns: (CampaignRow & { report: CampaignReport })[];
}

export async function campaignOverview(deps: EngineDeps): Promise<CampaignOverview> {
  const rows = await deps.store.listCampaigns();
  return {
    killed: await deps.store.campaignsKilled(),
    campaigns: await Promise.all(rows.map(async (c) => ({ ...c, report: await deps.store.campaignReport(c.id) }))),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back the streak and last-log reads look; a streak past this is "strong" all the same. */
const HABIT_DAYS = 60;

/** Everything a segment can ask about one account, or null when it has no profile. */
async function factsFor(deps: EngineDeps, userId: string, date: string, now: number): Promise<SegmentFacts | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const stored = await deps.store.getEntitlement(userId);
  const since = localDate("UTC", new Date(Date.parse(`${date}T00:00:00Z`) - HABIT_DAYS * DAY_MS));
  const logged = (await deps.store.totalsSince(userId, since)).map((d) => d.date);
  return {
    lang: profile.lang,
    entitlement: !entitlementLive(stored, now) ? "none" : stored?.trial === true ? "trial" : "active",
    onboarded: Boolean(profile.onboarded_at),
    ...habitOf(logged, date),
    tipsConsent: (await deps.store.consentOf(userId))?.marketingConsentAt != null,
    staff: deps.config.campaignStaffIds.includes(userId),
  };
}

/** True when this campaign may reach this account at all, schedule aside. */
function reaches(c: CampaignRow, userId: string, f: SegmentFacts): boolean {
  if (!inRollout(userId, c.id, c.rolloutPct)) return false;
  if (c.promotional && !f.tipsConsent) return false;
  return matchesSegment(c.segment, f);
}

export interface CampaignRunResult {
  campaigns: number;
  sent: number;
  failed: number;
  /** Accounts that were due and in the segment but had their day taken by a higher sender. */
  slotTaken: number;
}

/**
 * One pass over every live campaign. Called each minute after the evening sweep, so on a minute where
 * both want an account the rank-ordered claims of the sweep have already been made.
 */
export async function runCampaigns(deps: EngineDeps, opts: { now?: number } = {}): Promise<CampaignRunResult> {
  const now = opts.now ?? Date.now();
  const out: CampaignRunResult = { campaigns: 0, sent: 0, failed: 0, slotTaken: 0 };
  if (await deps.store.campaignsKilled()) return out;
  const live = (await deps.store.listCampaigns()).filter((c) => c.status === "scheduled" || c.status === "running");
  if (live.length === 0) return out;
  const audience = await deps.store.pushAudience();

  for (const listed of live) {
    out.campaigns++;
    for (const { userId, timezone } of audience) {
      // Re-read BEFORE every account: a kill between two sends stops the run between them.
      if (await deps.store.campaignsKilled()) return out;
      const c = await deps.store.getCampaign(listed.id);
      if (!c || (c.status !== "scheduled" && c.status !== "running")) break;
      try {
        const zone = zoneOf(deps, timezone);
        const date = localDate(zone, new Date(now));
        const [hh, mm] = c.localSendTime.split(":").map(Number) as [number, number];
        const at = instantOf(zone, date, { hour: hh, minute: mm });
        if (now < at || now >= at + CATCH_UP_MS) continue;
        if (!inRollout(userId, c.id, c.rolloutPct)) continue;
        if (await deps.store.hasCampaignSend(userId, c.id)) continue;
        const facts = await factsFor(deps, userId, date, now);
        if (!facts || !reaches(c, userId, facts)) continue;
        const copy = await sendableCopy(deps, c.templateKey, facts.lang);
        if (!copy) continue; // an incomplete template is not sent, and does not spend the day
        const devices = await deps.store.pushTokensFor(userId);
        if (devices.length === 0) continue;

        const slot = await deps.store.claimPushSlot(userId, date, "campaign" satisfies PushKind, c.id);
        if (!slot.claimed) { out.slotTaken++; continue; }
        if (!(await deps.store.claimCampaignSend(userId, c.id))) continue;
        await deps.store.markCampaignRunning(c.id);
        const words = fillNotification(copy, c.templateKey, {});
        const sent = await sendLogged(
          deps, userId, devices,
          { kind: "campaign", ref: c.id, templateKey: c.templateKey, lang: facts.lang },
          { title: words.title, body: words.body },
        );
        out.sent += sent.sent;
        out.failed += sent.failed;
      } catch (e) {
        console.error(`[eait] campaign ${c.id}: one account failed: ${(e as Error)?.message ?? e}`);
        out.failed++;
      }
    }
  }
  if (out.sent + out.failed + out.slotTaken > 0) {
    console.log(`[eait] campaigns: ${out.campaigns} live, ${out.sent} sent, ${out.slotTaken} slot-taken, ${out.failed} failed`);
  }
  return out;
}

export type DryRunResult =
  | { ok: true; wouldSend: number }
  | { ok: false; reason: "no-such-campaign" | "template-incomplete" };

/**
 * Who a campaign would reach right now, written as `dry` rows in `send_log` and nothing else: no
 * Expo call, no slot, no `campaign_send`. The schedule is ignored (the question is "who", not "when"),
 * so a dry run can be read before the campaign is activated. Idempotent per account.
 */
export async function dryRunCampaign(deps: EngineDeps, id: string, opts: { now?: number } = {}): Promise<DryRunResult> {
  const now = opts.now ?? Date.now();
  const c = await deps.store.getCampaign(id);
  if (!c) return { ok: false, reason: "no-such-campaign" };
  if ((await templateGaps(deps, c.templateKey)).length > 0) return { ok: false, reason: "template-incomplete" };
  let wouldSend = 0;
  for (const { userId, timezone } of await deps.store.pushAudience()) {
    const date = localDate(zoneOf(deps, timezone), new Date(now));
    if (await deps.store.hasCampaignSend(userId, c.id)) continue;
    const facts = await factsFor(deps, userId, date, now);
    if (!facts || !reaches(c, userId, facts)) continue;
    wouldSend++;
    const already = (await deps.store.sendLogFor(userId, 100)).some((r) => r.kind === "campaign" && r.ref === c.id && r.state === "dry");
    if (already) continue;
    for (const device of await deps.store.pushTokensFor(userId)) {
      await deps.store.createSend(userId, {
        id: crypto.randomUUID(), kind: "campaign", ref: c.id, templateKey: c.templateKey, lang: facts.lang,
        variant: "dry", token: device.token, state: "dry",
      });
    }
  }
  return { ok: true, wouldSend };
}

export type CampaignTestResult =
  | { ok: true; sent: number }
  | { ok: false; reason: "no-such-campaign" | "not-staff" | "no-device" | "template-incomplete" }
  | { ok: false; reason: "slot-taken"; heldBy: PushKind };

/**
 * Send the campaign's words to ONE staff account. It goes through the slot like any sender, so the
 * real send the same local day is refused by it; it records no `campaign_send`, and its rows carry
 * `variant: "test"` so the report keeps them apart.
 */
export async function testSendCampaign(
  deps: EngineDeps, id: string, userId: string, now: number = Date.now(),
): Promise<CampaignTestResult> {
  const c = await deps.store.getCampaign(id);
  if (!c) return { ok: false, reason: "no-such-campaign" };
  if (!deps.config.campaignStaffIds.includes(userId)) return { ok: false, reason: "not-staff" };
  const devices = await deps.store.pushTokensFor(userId);
  const profile = await deps.store.getProfile(userId);
  if (devices.length === 0 || !profile) return { ok: false, reason: "no-device" };
  // Before the slot: a refused template must not spend the day's one message.
  const copy = await sendableCopy(deps, c.templateKey, profile.lang as Lang);
  if (!copy) return { ok: false, reason: "template-incomplete" };
  const zone = zoneOf(deps, await deps.store.timezoneOf(userId));
  const claim = await deps.store.claimPushSlot(userId, localDate(zone, new Date(now)), "campaign", c.id);
  if (!claim.claimed) return { ok: false, reason: "slot-taken", heldBy: claim.heldBy };
  const words = fillNotification(copy, c.templateKey, {});
  const out = await sendLogged(
    deps, userId, devices,
    { kind: "campaign", ref: c.id, templateKey: c.templateKey, lang: profile.lang, variant: "test" },
    { title: words.title, body: words.body },
  );
  return { ok: true, sent: out.sent };
}
