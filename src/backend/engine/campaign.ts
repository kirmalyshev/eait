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
//   - THE TEMPLATE is the campaign's OWN copy (`campaign:<slug>`, eight languages, reviewed, no
//     placeholders) and is re-checked each batch: a language edited back to draft after activation
//     stops the sends rather than putting half a translated set on lock screens.
//   - A STREAK IS NEVER INTERRUPTED. An account with a streak of CAMPAIGN_STREAK_GUARD_DAYS or more
//     is never reached, a hard rule and not a segment predicate. A campaign may take the day from
//     the plain evening line or nudge (that day the campaign IS the message), never from the habit line.
//   - PROMOTIONAL campaigns reach only accounts that turned "tips and offers" on in the app
//     (`push_offers_at`, read in `factsFor`; the sign-up box is a different consent). The in-app
//     toggle has not shipped, so activation of a promotional campaign stays refused until it does.
//
// ponytail: visits every account with a device, per campaign, per minute, and the cheap filters
// (window, rollout, already-handed) run before any read. Past thousands of accounts, select the due
// set in the store instead.

import {
  CAMPAIGN_STATUSES, CAMPAIGN_STREAK_GUARD_DAYS, CAMPAIGN_VARIANTS, effectOf, entitlementLive, habitOf, inHoldout, inRollout, isCampaignTemplateKey, localDate, matchesSegment, variantOf,
  pushKeyGaps, validateCampaignInput,
  type CampaignInput, type CampaignStatus, type CampaignTemplateKey, type Lang, type PushKind, type PushTemplateRow, type SegmentFacts,
} from "@eait/shared";
import type { CampaignReport, CampaignRow } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { CATCH_UP_MS, instantOf, isStaffAccount, sendLogged, zoneOf } from "./notify.ts";
import { campaignWords } from "./push-templates.ts";
import { pushDevices, pushOffersAllowed } from "./push-consent.ts";

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
async function templateGaps(deps: EngineDeps, key: CampaignTemplateKey, variants: number): Promise<string[]> {
  return pushKeyGaps((await deps.store.listPushTemplates()).filter((r) => r.key === key), key, variants);
}

/** What stops a campaign from being live: the one rule set, read by activation AND by every later edit. */
async function activationProblems(
  deps: EngineDeps, c: { promotional: boolean; templateKey: CampaignTemplateKey; variants: number },
): Promise<string[]> {
  const problems: string[] = [];
  if (c.promotional) {
    problems.push("a promotional campaign cannot be live yet: the in-app tips-and-offers consent toggle has not shipped");
  }
  const gaps = await templateGaps(deps, c.templateKey, c.variants);
  if (gaps.length > 0) problems.push(`template ${c.templateKey} is not complete: ${gaps.join(", ")}`);
  return problems;
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
    variants: current.variants, holdoutPct: current.holdoutPct,
  };
  const v = validateCampaignInput({ ...merged, ...raw });
  if (!v.ok) return v;
  // A campaign past draft is held to what activation required, whatever the edit: promotional is
  // refused while consent is not collected, and the copy must be complete.
  if (current.status !== "draft") {
    // Which arm an account is in, and whether it is held out, are functions of these two numbers:
    // changing either mid-run would move accounts between arms and in or out of the control group.
    if (v.input.variants !== current.variants || v.input.holdoutPct !== current.holdoutPct) {
      return { ok: false, errors: ["variants and holdoutPct are fixed once the campaign has left draft"] };
    }
    const problems = await activationProblems(deps, v.input);
    if (problems.length > 0) return { ok: false, errors: problems };
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
    const problems = await activationProblems(deps, current);
    if (problems.length > 0) return { ok: false, errors: problems };
  }
  const row = await deps.store.updateCampaign(id, { status: to });
  return row ? { ok: true, row } : { ok: false, errors: ["no such campaign"] };
}

export async function setCampaignsKilled(deps: EngineDeps, killed: boolean): Promise<void> {
  await deps.store.setCampaignsKilled(killed);
}

/** One campaign key's copy: every row it has, and what stops it being sent. */
export interface CampaignCopy {
  key: CampaignTemplateKey;
  rows: PushTemplateRow[];
  gaps: string[];
}

export interface CampaignOverview {
  killed: boolean;
  copy: CampaignCopy[];
  campaigns: (CampaignRow & { report: CampaignReport; effect: ReturnType<typeof effectOf> })[];
}

export async function campaignOverview(deps: EngineDeps): Promise<CampaignOverview> {
  const rows = await deps.store.listCampaigns();
  const templates = (await deps.store.listPushTemplates()).filter((r) => isCampaignTemplateKey(r.key));
  // Keys a campaign names but nobody has written yet are listed too, with every language missing.
  const keys = [...new Set([...templates.map((r) => r.key), ...rows.map((c) => c.templateKey)])] as CampaignTemplateKey[];
  return {
    killed: await deps.store.campaignsKilled(),
    copy: keys.sort().map((key) => {
      const own = templates.filter((r) => r.key === key);
      // The variants a key must carry are the most any campaign using it runs.
      const needed = Math.max(1, ...rows.filter((c) => c.templateKey === key).map((c) => c.variants));
      return { key, rows: own, gaps: pushKeyGaps(own, key, needed) };
    }),
    campaigns: await Promise.all(rows.map(async (c) => {
      const report = await deps.store.campaignReport(c.id);
      return { ...c, report, effect: effectOf(report.groups) };
    })),
  };
}


/** Everything a segment can ask about one account, or null when it has no profile. */
async function factsFor(deps: EngineDeps, userId: string, date: string, now: number): Promise<SegmentFacts | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const [stored, bonusUntil] = await Promise.all([deps.store.getEntitlement(userId), deps.store.bonusUntil(userId)]);
  // The WHOLE history: a "lapsed" account is one whose last log is old, and a window would read a
  // 61-day-old last log as "never". ponytail: one read per account that passed the cheap filters;
  // store a last-logged date on the account if this ever shows up in a profile.
  const logged = (await deps.store.totalsSince(userId, "1970-01-01")).map((d) => d.date);
  return {
    lang: profile.lang,
    entitlement: !entitlementLive(stored, now, bonusUntil) ? "none" : stored?.trial === true ? "trial" : "active",
    onboarded: Boolean(profile.onboarded_at),
    ...habitOf(logged, date),
    // The in-app Tips-and-offers toggle (`users.push_offers_at`), default off. Not the sign-up box.
    tipsConsent: await pushOffersAllowed(deps, userId),
    staff: await isStaffAccount(deps, userId),
  };
}

/** True when this campaign may reach this account at all, schedule aside. */
function reaches(c: CampaignRow, userId: string, f: SegmentFacts): boolean {
  if (!inRollout(userId, c.id, c.rolloutPct)) return false;
  if (f.streakDays >= CAMPAIGN_STREAK_GUARD_DAYS) return false;
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
      try {
        // The cheap filters first; the kill switches are re-read only for an account that is due, so
        // a kill between two SENDS still stops the run between them and an idle minute costs nothing.
        const zone = zoneOf(deps, timezone);
        const date = localDate(zone, new Date(now));
        const [hh, mm] = listed.localSendTime.split(":").map(Number) as [number, number];
        const at = instantOf(zone, date, { hour: hh, minute: mm });
        if (now < at || now >= at + CATCH_UP_MS) continue;
        if (!inRollout(userId, listed.id, listed.rolloutPct)) continue;
        if (await deps.store.hasCampaignSend(userId, listed.id)) continue;
        if (await deps.store.campaignsKilled()) return out;
        const c = await deps.store.getCampaign(listed.id);
        if (!c || (c.status !== "scheduled" && c.status !== "running")) break;
        if (!inRollout(userId, c.id, c.rolloutPct)) continue;
        const facts = await factsFor(deps, userId, date, now);
        if (!facts || !reaches(c, userId, facts)) continue;
        const variant = CAMPAIGN_VARIANTS[variantOf(userId, c.id, c.variants)]!;
        const words = await campaignWords(deps, c.templateKey, facts.lang, variant, c.variants);
        if (!words) continue; // an incomplete template is not sent, and does not spend the day
        const devices = await pushDevices(deps, userId);
        if (devices.length === 0) continue;

        // THE HOLDOUT: due, in the segment, and kept out on purpose. It claims no slot, so the day's
        // message stays free for another sender, and it is logged once (the same once-per-account
        // claim) so the report has a control group with a send time to measure from.
        if (inHoldout(userId, c.id, c.holdoutPct)) {
          // Only on a day a treated account COULD have been sent: its slot is read, never claimed. If
          // another sender holds the day, skip without recording anything, so it is retried exactly
          // like a treated account, and the control group never includes a day nobody would have sent.
          if (await deps.store.pushSlotOf(userId, date)) { out.slotTaken++; continue; }
          if (await deps.store.claimCampaignSend(userId, c.id)) {
            await deps.store.createSend(userId, {
              id: crypto.randomUUID(), kind: "campaign", ref: c.id, templateKey: c.templateKey, lang: facts.lang,
              variant, token: "holdout", state: "would_have_sent",
            });
            await deps.store.markCampaignRunning(c.id);
          }
          continue;
        }

        const slot = await deps.store.claimPushSlot(userId, date, "campaign" satisfies PushKind, c.id);
        if (!slot.claimed) { out.slotTaken++; continue; }
        if (!(await deps.store.claimCampaignSend(userId, c.id))) continue;
        await deps.store.markCampaignRunning(c.id);
        const sent = await sendLogged(
          deps, userId, devices,
          { kind: "campaign", ref: c.id, templateKey: c.templateKey, lang: facts.lang, variant },
          { title: words.title, body: words.body },
        );
        out.sent += sent.sent;
        out.failed += sent.failed;
      } catch (e) {
        console.error(`[eait] campaign ${listed.id}: one account failed: ${(e as Error)?.message ?? e}`);
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
  | { ok: true; wouldSend: number; heldOut: number }
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
  if ((await templateGaps(deps, c.templateKey, c.variants)).length > 0) return { ok: false, reason: "template-incomplete" };
  let wouldSend = 0;
  let heldOut = 0;
  for (const { userId, timezone } of await deps.store.pushAudience()) {
    const date = localDate(zoneOf(deps, timezone), new Date(now));
    if (await deps.store.hasCampaignSend(userId, c.id)) continue;
    const facts = await factsFor(deps, userId, date, now);
    if (!facts || !reaches(c, userId, facts)) continue;
    if (inHoldout(userId, c.id, c.holdoutPct)) { heldOut++; continue; }
    wouldSend++;
    const already = (await deps.store.sendLogFor(userId, 100)).some((r) => r.kind === "campaign" && r.ref === c.id && r.state === "dry");
    if (already) continue;
    for (const device of await pushDevices(deps, userId)) {
      await deps.store.createSend(userId, {
        id: crypto.randomUUID(), kind: "campaign", ref: c.id, templateKey: c.templateKey, lang: facts.lang,
        variant: CAMPAIGN_VARIANTS[variantOf(userId, c.id, c.variants)]!, token: device.token, state: "dry",
      });
    }
  }
  return { ok: true, wouldSend, heldOut };
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
  if (!await isStaffAccount(deps, userId)) return { ok: false, reason: "not-staff" };
  const devices = await pushDevices(deps, userId);
  const profile = await deps.store.getProfile(userId);
  if (devices.length === 0 || !profile) return { ok: false, reason: "no-device" };
  // Before the slot: a refused template must not spend the day's one message.
  const variant = CAMPAIGN_VARIANTS[variantOf(userId, c.id, c.variants)]!;
  const words = await campaignWords(deps, c.templateKey, profile.lang as Lang, variant, c.variants);
  if (!words) return { ok: false, reason: "template-incomplete" };
  const zone = zoneOf(deps, await deps.store.timezoneOf(userId));
  const claim = await deps.store.claimPushSlot(userId, localDate(zone, new Date(now)), "campaign", c.id);
  if (!claim.claimed) return { ok: false, reason: "slot-taken", heldBy: claim.heldBy };
  const out = await sendLogged(
    deps, userId, devices,
    { kind: "campaign", ref: c.id, templateKey: c.templateKey, lang: profile.lang, variant: "test" },
    { title: words.title, body: words.body },
  );
  return { ok: true, sent: out.sent };
}
