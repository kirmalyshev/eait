import { beforeEach, describe, expect, it } from "bun:test";
import { CAMPAIGN_VARIANTS, LANGS, inHoldout, variantOf, type PushTemplateRow } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush, type FakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { CampaignRow, Store } from "../store.ts";
import {
  campaignOverview, createCampaign, dryRunCampaign, runCampaigns, setCampaignStatus, setCampaignsKilled, testSendCampaign,
  updateCampaign,
} from "./campaign.ts";
import { patchProfile, type EngineDeps } from "./index.ts";
import { setPushConsent } from "./push-consent.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  timezone: "Europe/Berlin",
};
/** 18:30 Berlin (CEST) on 2026-08-20. */
const BERLIN_1830 = Date.parse("2026-08-20T16:30:00Z");
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

let store: Store;
let push: FakePush;
let deps: EngineDeps;
let staff: string[];
beforeEach(() => {
  store = memoryStore();
  push = fakePush();
  staff = [];
  deps = { store, config: { ...CONFIG, get campaignStaffIds() { return staff; } } as Config, llm: demoPorts(), push };
});

let seq = 0;
async function account(opts: { tz?: string; lang?: "en" | "de" | "fr"; consent?: boolean; free?: boolean; noToken?: boolean } = {}): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), opts.lang ?? "en");
  await store.addIdentity(userId, "google", "g-" + userId.slice(0, 8));
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "some", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true,
  });
  if (!out || !out.ok) throw new Error("onboarding failed");
  if (opts.consent !== false) await store.recordConsent(userId, { terms: true, marketing: true });
  if (!opts.free) await store.putEntitlement(userId, {
    expiresAt: "2027-01-01T00:00:00.000Z", productId: "com.eait.fit.ios.yearly", trial: false,
    eventAt: new Date(Date.now() + ++seq * 1000).toISOString(),
  });
  if (!opts.noToken) await store.putPushToken(userId, `ExponentPushToken[c-${++seq}]`, "ios");
  if (opts.tz) await store.setTimezone(userId, opts.tz);
  return userId;
}

/** A campaign's own copy in all eight languages, reviewed unless `draftLang` names one left as a draft. */
async function copy(key = "campaign:win-back", draftLang?: string, variants = 1): Promise<void> {
  for (const lang of LANGS) {
    for (const variant of CAMPAIGN_VARIANTS.slice(0, variants)) {
      await store.putPushTemplate({
        key: key as PushTemplateRow["key"], lang, variant, title: `Hi ${lang} ${variant}`, body: `Body ${lang} ${variant}`,
        status: lang === draftLang ? "draft" : "reviewed", reviewed_by: "t", reviewed_at: "2026-10-08T00:00:00.000Z",
        updated_at: "2026-10-08T00:00:00.000Z",
      });
    }
  }
}

async function campaign(over: Record<string, unknown> = {}, status: "draft" | "scheduled" = "scheduled"): Promise<CampaignRow> {
  const key = (over.templateKey as string | undefined) ?? "campaign:win-back";
  if ((await store.listPushTemplates()).every((r) => r.key !== key)) await copy(key, undefined, (over.variants as number | undefined) ?? 1);
  const made = await createCampaign(deps, {
    name: "Win-back", templateKey: key, segment: {}, localSendTime: "18:30", rolloutPct: 100,
    promotional: false, ...over,
  }, "admin-1");
  if (!made.ok) throw new Error(made.errors.join("; "));
  if (status === "scheduled") {
    const r = await setCampaignStatus(deps, made.row.id, "scheduled");
    if (!r.ok) throw new Error(r.errors.join("; "));
  }
  return (await store.getCampaign(made.row.id))!;
}

describe("creating and activating", () => {
  it("refuses a segment predicate that is not on the allowlist", async () => {
    const r = await createCampaign(deps, {
      name: "x", templateKey: "campaign:win-back", segment: { sql: "1=1" }, localSendTime: "18:30", rolloutPct: 10, promotional: false,
    }, "a");
    expect(r).toEqual({ ok: false, errors: ["unknown predicate: sql"] });
  });

  it("will not activate while the template has a draft or missing language", async () => {
    await copy("campaign:win-back", "de");
    const c = await campaign({}, "draft");
    const r = await setCampaignStatus(deps, c.id, "scheduled");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("de/");
    expect((await store.getCampaign(c.id))?.status).toBe("draft");
    await copy("campaign:win-back");
    expect((await setCampaignStatus(deps, c.id, "scheduled")).ok).toBe(true);
  });

  it("will not activate a campaign that has no copy at all", async () => {
    const made = await createCampaign(deps, {
      name: "x", templateKey: "campaign:nothing-yet", segment: {}, localSendTime: "18:30", rolloutPct: 10, promotional: false,
    }, "a");
    if (!made.ok) throw new Error("create");
    const r = await setCampaignStatus(deps, made.row.id, "scheduled");
    expect(r.ok).toBe(false);
  });

  it("refuses a system key as a campaign's template", async () => {
    for (const templateKey of ["nudge", "evening", "trial-end", "campaign:evening"]) {
      const r = await createCampaign(deps, { name: "x", templateKey, segment: {}, localSendTime: "18:30", rolloutPct: 10, promotional: false }, "a");
      expect(r.ok).toBe(false);
    }
  });

  it("refuses to activate a promotional campaign until the tips-and-offers consent exists", async () => {
    const c = await campaign({ promotional: true }, "draft");
    const r = await setCampaignStatus(deps, c.id, "scheduled");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("tips-and-offers consent");
    expect((await store.getCampaign(c.id))?.status).toBe("draft");
  });

  it("applies activation's rules to an edit of a live campaign: no promotional, no incomplete copy", async () => {
    const c = await campaign({}, "scheduled");
    const promo = await updateCampaign(deps, c.id, { promotional: true });
    expect(promo.ok).toBe(false);
    if (!promo.ok) expect(promo.errors.join(" ")).toContain("tips-and-offers consent");
    const noCopy = await updateCampaign(deps, c.id, { templateKey: "campaign:no-copy-yet" });
    expect(noCopy.ok).toBe(false);
    expect((await store.getCampaign(c.id))).toMatchObject({ promotional: false, templateKey: "campaign:win-back" });
    await setCampaignStatus(deps, c.id, "paused");
    expect((await updateCampaign(deps, c.id, { promotional: true })).ok).toBe(false);
    // A harmless edit of a live campaign still goes through.
    expect((await updateCampaign(deps, c.id, { rolloutPct: 30 })).ok).toBe(true);
    // A draft may hold promotional: it is refused at activation.
    const d = await campaign({}, "draft");
    expect((await updateCampaign(deps, d.id, { promotional: true })).ok).toBe(true);
  });

  it("walks the status machine and stops at killed", async () => {
    const c = await campaign({}, "draft");
    expect((await setCampaignStatus(deps, c.id, "paused")).ok).toBe(false); // draft cannot pause
    expect((await setCampaignStatus(deps, c.id, "scheduled")).ok).toBe(true);
    expect((await setCampaignStatus(deps, c.id, "paused")).ok).toBe(true);
    expect((await setCampaignStatus(deps, c.id, "scheduled")).ok).toBe(true);
    expect((await setCampaignStatus(deps, c.id, "killed")).ok).toBe(true);
    expect((await setCampaignStatus(deps, c.id, "scheduled")).ok).toBe(false);
  });

  it("edits a draft but not a finished campaign", async () => {
    const c = await campaign({}, "draft");
    const up = await updateCampaign(deps, c.id, { rolloutPct: 40 });
    expect(up.ok && up.row.rolloutPct).toBe(40);
    await setCampaignStatus(deps, c.id, "scheduled");
    await setCampaignStatus(deps, c.id, "killed");
    expect((await updateCampaign(deps, c.id, { rolloutPct: 50 })).ok).toBe(false);
  });
});

describe("segments", () => {
  it("reaches only the accounts the predicates select", async () => {
    const de = await account({ lang: "de" });
    await account({ lang: "en" });
    await account({ lang: "fr" });
    await campaign({ segment: { langs: ["de"] } });
    const out = await runCampaigns(deps, { now: BERLIN_1830 });
    expect(out.sent).toBe(1);
    expect(push.sent).toHaveLength(1);
    expect((await store.sendLogFor(de, 5))[0]).toMatchObject({ kind: "campaign", templateKey: "campaign:win-back", lang: "de", state: "accepted" });
  });

  it("selects by entitlement and onboarding", async () => {
    const paid = await account();
    await account({ free: true });
    await campaign({ segment: { entitlement: ["active"], onboarded: true } });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(1);
    expect((await store.sendLogFor(paid, 5))).toHaveLength(1);
  });

  it("selects by streak and days since the last log", async () => {
    const logger = await account();
    const lapsed = await account();
    const meal = (userId: string, date: string) => ({
      id: crypto.randomUUID(), user_id: userId, ts: `${date}T10:00:00.000Z`, date,
      isFood: true, items: [{ name: "x", grams: 1 }], kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0,
      fiber_g: 0, sugar_g: 0, sodium_mg: 0, verdicts: {}, healthScore: null, confidence: "high" as const,
      notes: "", corrected: false, model: "t",
    });
    for (const d of ["2026-08-20", "2026-08-19", "2026-08-18"]) await store.insertMeal(meal(logger, d));
    await store.insertMeal(meal(lapsed, "2026-08-01"));
    await campaign({ segment: { sinceLog: ["lapsed"] } });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect((await store.sendLogFor(lapsed, 5))).toHaveLength(1);
    expect((await store.sendLogFor(logger, 5))).toHaveLength(0);
  });

  it("a tips-and-offers predicate matches nobody until that consent exists, and the signup box is not it", async () => {
    await account({ consent: true });
    await campaign({ segment: { tipsConsent: true } });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(0);
  });

  it("a promotional campaign skips an account with the toggle off and reaches one with it on", async () => {
    const off = await account({ consent: true }); // ticked the sign-up box: not an opt-in
    const on = await account({ consent: false });
    await setPushConsent(deps, on, { offers: true });
    const c = await campaign({ promotional: true }, "draft");
    await store.updateCampaign(c.id, { status: "scheduled" });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(await store.sendLogFor(off, 5)).toHaveLength(0);
    expect(await store.sendLogFor(on, 5)).toHaveLength(1);
  });

  it("a promotional campaign forced live in the store still reaches nobody", async () => {
    await account({ consent: true });
    const c = await campaign({ promotional: true }, "draft");
    await store.updateCampaign(c.id, { status: "scheduled" });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(0);
  });

  it("sinceLog reads the whole history: a last log 61, 200 or 400 days ago is lapsed, not never", async () => {
    const meal = (userId: string, date: string) => ({
      id: crypto.randomUUID(), user_id: userId, ts: `${date}T10:00:00.000Z`, date,
      isFood: true, items: [{ name: "x", grams: 1 }], kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0,
      fiber_g: 0, sugar_g: 0, sodium_mg: 0, verdicts: {}, healthScore: null, confidence: "high" as const,
      notes: "", corrected: false, model: "t",
    });
    const ago = (n: number) => new Date(Date.parse("2026-08-20T00:00:00Z") - n * 86_400_000).toISOString().slice(0, 10);
    const old: string[] = [];
    for (const n of [59, 60, 61, 200, 400]) { const u = await account(); await store.insertMeal(meal(u, ago(n))); old.push(u); }
    const never = await account();
    await campaign({ name: "lapsed", segment: { sinceLog: ["lapsed"] } });
    await campaign({ name: "never", segment: { sinceLog: ["never"] } });
    await runCampaigns(deps, { now: BERLIN_1830 });
    const reached = async (u: string) => (await store.sendLogFor(u, 10)).map((r) => r.ref);
    const lapsedC = (await store.listCampaigns()).find((c) => c.name === "lapsed")!.id;
    const neverC = (await store.listCampaigns()).find((c) => c.name === "never")!.id;
    // The slot gives one message a day, so each account is reached by ONE of the two, never both.
    for (const u of old) expect(await reached(u)).toEqual([lapsedC]);
    expect(await reached(never)).toEqual([neverC]);
  });

  it("never reaches an account with a streak of 3 or more, whatever the segment says; 2 is reached", async () => {
    const meal = (userId: string, date: string) => ({
      id: crypto.randomUUID(), user_id: userId, ts: `${date}T10:00:00.000Z`, date,
      isFood: true, items: [{ name: "x", grams: 1 }], kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0,
      fiber_g: 0, sugar_g: 0, sodium_mg: 0, verdicts: {}, healthScore: null, confidence: "high" as const,
      notes: "", corrected: false, model: "t",
    });
    const three = await account();
    const two = await account();
    for (const d of ["2026-08-20", "2026-08-19", "2026-08-18"]) await store.insertMeal(meal(three, d));
    for (const d of ["2026-08-20", "2026-08-19"]) await store.insertMeal(meal(two, d));
    await campaign({ segment: {} });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(await store.sendLogFor(three, 5)).toHaveLength(0);
    expect(await store.sendLogFor(two, 5)).toHaveLength(1);
    // A streak that ended yesterday is still a streak today.
    const yesterday = await account();
    for (const d of ["2026-08-19", "2026-08-18", "2026-08-17"]) await store.insertMeal(meal(yesterday, d));
    await runCampaigns(deps, { now: BERLIN_1830 + 60_000 });
    expect(await store.sendLogFor(yesterday, 5)).toHaveLength(0);
  });

  it("staffOnly reaches the allowlist and nobody else", async () => {
    const mine = await account();
    await account();
    staff = [mine];
    await campaign({ segment: { staffOnly: true } });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(1);
    expect(await store.sendLogFor(mine, 5)).toHaveLength(1);
  });

  it("staffOnly with an empty allowlist reaches nobody", async () => {
    await account();
    await campaign({ segment: { staffOnly: true } });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(0);
  });
});

describe("the schedule", () => {
  it("fires at each account's own local time", async () => {
    const berlin = await account({ tz: "Europe/Berlin" });
    const tokyo = await account({ tz: "Asia/Tokyo" });
    await campaign();
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(await store.sendLogFor(berlin, 5)).toHaveLength(1);
    expect(await store.sendLogFor(tokyo, 5)).toHaveLength(0);
    // 18:30 in Tokyo is 09:30 UTC.
    await runCampaigns(deps, { now: Date.parse("2026-08-21T09:30:00Z") });
    expect(await store.sendLogFor(tokyo, 5)).toHaveLength(1);
  });

  it("sends nothing before the hour, and nothing once the catch-up window has passed", async () => {
    await account();
    await campaign();
    await runCampaigns(deps, { now: BERLIN_1830 - MIN });
    await runCampaigns(deps, { now: BERLIN_1830 + 2 * 60 * MIN });
    expect(push.sent).toHaveLength(0);
  });

  it("hands an account a campaign once, however many ticks run", async () => {
    await account();
    await campaign();
    await runCampaigns(deps, { now: BERLIN_1830 });
    await runCampaigns(deps, { now: BERLIN_1830 + MIN });
    await runCampaigns(deps, { now: BERLIN_1830 + DAY });
    expect(push.sent).toHaveLength(1);
  });

  it("does not run a draft, a paused or a killed campaign, and marks the first batch running", async () => {
    await account();
    const draft = await campaign({}, "draft");
    const paused = await campaign();
    await setCampaignStatus(deps, paused.id, "paused");
    const killed = await campaign();
    await setCampaignStatus(deps, killed.id, "killed");
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(0);
    expect((await store.getCampaign(draft.id))?.status).toBe("draft");
    const live = await campaign();
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect((await store.getCampaign(live.id))?.status).toBe("running");
  });
});

describe("rollout", () => {
  it("raising the percentage only adds accounts, and nobody is sent twice", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 40; i++) ids.push(await account());
    const c = await campaign({ rolloutPct: 25 });
    await runCampaigns(deps, { now: BERLIN_1830 });
    const first = new Set(push.sent.map((m) => m.to));
    expect(first.size).toBeGreaterThan(0);
    expect(first.size).toBeLessThan(40);
    await updateCampaign(deps, c.id, { rolloutPct: 70 });
    await runCampaigns(deps, { now: BERLIN_1830 + MIN });
    const second = push.sent.map((m) => m.to);
    expect(new Set(second).size).toBe(second.length); // no repeat
    for (const t of first) expect(second).toContain(t);
    expect(second.length).toBeGreaterThan(first.size);
    // A 0% campaign sends nobody.
    const none = await campaign({ rolloutPct: 0, name: "zero" });
    const before = push.sent.length;
    await runCampaigns(deps, { now: BERLIN_1830 + 2 * MIN });
    const zeroRows = (await Promise.all(ids.map((u) => store.sendLogFor(u, 50)))).flat().filter((r) => r.ref === none.id);
    expect(zeroRows).toHaveLength(0);
    expect(push.sent.length).toBeGreaterThanOrEqual(before);
  });
});

describe("the one-a-day slot", () => {
  it("is respected: an account that already had its message today is skipped and not marked sent", async () => {
    const u = await account();
    await store.claimPushSlot(u, "2026-08-20", "streak", "evening");
    const c = await campaign();
    const out = await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(0);
    expect(out.slotTaken).toBe(1);
    expect(await store.hasCampaignSend(u, c.id)).toBe(false);
    // The next day inside the window it is theirs again.
    await runCampaigns(deps, { now: BERLIN_1830 + DAY });
    expect(push.sent).toHaveLength(1);
  });

  it("claims the slot as a campaign, so the evening line cannot follow it", async () => {
    const u = await account();
    await campaign();
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(await store.claimPushSlot(u, "2026-08-20", "evening", null)).toEqual({ claimed: false, heldBy: "campaign" });
  });

  it("skips an account with no device without spending its slot", async () => {
    const u = await account({ noToken: true });
    const c = await campaign();
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(0);
    expect(await store.claimPushSlot(u, "2026-08-20", "evening", null)).toEqual({ claimed: true });
    expect(await store.hasCampaignSend(u, c.id)).toBe(false);
  });
});

describe("kill switches", () => {
  it("are not read for an account that is not due", async () => {
    await account();
    await campaign();
    let reads = 0;
    const inner = store.campaignsKilled.bind(store);
    store.campaignsKilled = async () => { reads++; return inner(); };
    await runCampaigns(deps, { now: BERLIN_1830 - 60 * MIN });
    expect(reads).toBe(1); // the one before the batch; none per account
  });

  it("the global switch stops a run in the middle of the batch", async () => {
    for (let i = 0; i < 6; i++) await account();
    await campaign();
    let calls = 0;
    const inner = push.send.bind(push);
    deps.push = { ...push, send: async (m) => { if (++calls === 2) await setCampaignsKilled(deps, true); return inner(m); } };
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(calls).toBe(2);
    expect(push.sent).toHaveLength(2);
    await runCampaigns(deps, { now: BERLIN_1830 + MIN });
    expect(push.sent).toHaveLength(2);
    await setCampaignsKilled(deps, false);
    await runCampaigns(deps, { now: BERLIN_1830 + 2 * MIN });
    expect(push.sent).toHaveLength(6); // resumed: only the unsent four, none twice
  });

  it("killing one campaign mid-run stops it and leaves the others going", async () => {
    for (let i = 0; i < 5; i++) await account();
    const a = await campaign({ name: "a" });
    const b = await campaign({ name: "b", rolloutPct: 0 });
    let calls = 0;
    const inner = push.send.bind(push);
    deps.push = { ...push, send: async (m) => { if (++calls === 2) await setCampaignStatus(deps, a.id, "killed"); return inner(m); } };
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(2);
    expect((await store.getCampaign(a.id))?.status).toBe("killed");
    expect((await store.getCampaign(b.id))?.status).not.toBe("killed");
  });
});

describe("dry run", () => {
  it("sends nothing, logs a dry row per account it would reach, and spends no slot", async () => {
    const u1 = await account();
    const u2 = await account();
    const c = await campaign({}, "draft");
    const out = await dryRunCampaign(deps, c.id, { now: BERLIN_1830 });
    expect(out).toMatchObject({ ok: true, wouldSend: 2 });
    expect(push.sent).toHaveLength(0);
    expect((await store.sendLogFor(u1, 5))[0]).toMatchObject({ state: "dry", kind: "campaign", ref: c.id });
    expect((await store.sendLogFor(u2, 5))).toHaveLength(1);
    expect(await store.claimPushSlot(u1, "2026-08-20", "evening", null)).toEqual({ claimed: true });
    expect(await store.hasCampaignSend(u1, c.id)).toBe(false);
    expect(await store.campaignReport(c.id)).toMatchObject({ dry: 2, sent: 0 });
  });

  it("reports an unknown campaign", async () => {
    expect(await dryRunCampaign(deps, "nope", { now: BERLIN_1830 })).toEqual({ ok: false, reason: "no-such-campaign" });
  });
});

describe("test send", () => {
  it("goes to a staff account only, through the slot, and the real send the same day is then refused", async () => {
    const me = await account();
    const other = await account();
    staff = [me];
    const c = await campaign({ segment: { staffOnly: true } }, "draft");
    expect(await testSendCampaign(deps, c.id, other, BERLIN_1830)).toEqual({ ok: false, reason: "not-staff" });
    expect(push.sent).toHaveLength(0);
    expect(await testSendCampaign(deps, c.id, me, BERLIN_1830)).toEqual({ ok: true, sent: 1 });
    expect((await store.sendLogFor(me, 5))[0]).toMatchObject({ kind: "campaign", ref: c.id, variant: "test" });
    // A second test, and the scheduled send, the same local day: both refused by the slot.
    expect(await testSendCampaign(deps, c.id, me, BERLIN_1830 + MIN)).toMatchObject({ ok: false, reason: "slot-taken", heldBy: "campaign" });
    await setCampaignStatus(deps, c.id, "scheduled");
    await runCampaigns(deps, { now: BERLIN_1830 + 2 * MIN });
    expect(push.sent).toHaveLength(1);
  });

  it("is counted apart from real sends in the report, and an open on it is recorded", async () => {
    const me = await account();
    staff = [me];
    const c = await campaign({ segment: { staffOnly: true } }, "draft");
    await testSendCampaign(deps, c.id, me, BERLIN_1830);
    const row = (await store.sendLogFor(me, 1))[0]!;
    await store.recordPushOpen(me, row.id, "tap");
    expect(await store.campaignReport(c.id)).toEqual({ sent: 0, accepted: 0, dead: 0, dry: 0, opened: 0, test: 1, held: 0, groups: [] });
  });

  it("refuses when the template is incomplete, before taking the slot", async () => {
    const me = await account();
    staff = [me];
    const c = await campaign({ segment: { staffOnly: true } }, "draft");
    await copy("campaign:win-back", "de");
    expect(await testSendCampaign(deps, c.id, me, BERLIN_1830)).toEqual({ ok: false, reason: "template-incomplete" });
    expect(await store.claimPushSlot(me, "2026-08-20", "evening", null)).toEqual({ claimed: true });
  });
});

describe("a campaign never goes out on a template that stopped being complete", () => {
  it("the runner re-checks the template each batch", async () => {
    await account({ lang: "de" });
    await campaign();
    await copy("campaign:win-back", "de");
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(0);
  });
});

describe("A/B variants", () => {
  it("sends each account its hashed variant's own copy, and writes the variant to send_log", async () => {
    const users: string[] = [];
    for (let i = 0; i < 40; i++) users.push(await account());
    const c = await campaign({ variants: 2 });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(40);
    const seen = new Set<string>();
    for (const u of users) {
      const want = CAMPAIGN_VARIANTS[variantOf(u, c.id, 2)]!;
      const row = (await store.sendLogFor(u, 1))[0]!;
      expect(row.variant).toBe(want);
      const msg = push.sent.find((m) => (m.data as { sendId?: string }).sendId === row.id)!;
      expect(msg.title).toBe(`Hi en ${want}`);
      seen.add(want);
    }
    expect([...seen].sort()).toEqual(["b", "default"]);
  });

  it("will not activate until every variant it runs has reviewed copy in all eight languages", async () => {
    const c = await campaign({ variants: 2 }, "draft"); // the helper writes both variants
    await copy("campaign:win-back", undefined, 1); // default only: b is a draft-less gap? remove b
    for (const lang of LANGS) await store.putPushTemplate({ key: "campaign:win-back", lang, variant: "b", title: "x", body: "y", status: "draft", reviewed_by: null, reviewed_at: null, updated_at: "2026-10-08T00:00:00.000Z" } as PushTemplateRow);
    const r = await setCampaignStatus(deps, c.id, "scheduled");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("en/b");
    await copy("campaign:win-back", undefined, 2);
    expect((await setCampaignStatus(deps, c.id, "scheduled")).ok).toBe(true);
  });

  it("fixes variants and holdout once the campaign leaves draft, because changing them would reassign accounts", async () => {
    const d = await campaign({ variants: 2, holdoutPct: 5 }, "draft");
    const edit = await updateCampaign(deps, d.id, { variants: 3, holdoutPct: 8 });
    expect(edit.ok && edit.row).toMatchObject({ variants: 3, holdoutPct: 8 });
    await copy("campaign:win-back", undefined, 3);
    await setCampaignStatus(deps, d.id, "scheduled");
    for (const patch of [{ variants: 2 }, { holdoutPct: 0 }]) {
      const r = await updateCampaign(deps, d.id, patch);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join(" ")).toContain("fixed once");
    }
    expect((await updateCampaign(deps, d.id, { rolloutPct: 50 })).ok).toBe(true);
  });

  it("sends a test to a staff account in that account's hashed variant", async () => {
    const me = await account();
    staff = [me];
    const c = await campaign({ variants: 2, segment: { staffOnly: true } }, "draft");
    await testSendCampaign(deps, c.id, me, BERLIN_1830);
    const want = CAMPAIGN_VARIANTS[variantOf(me, c.id, 2)]!;
    expect(push.sent[0]!.title).toBe(`Hi en ${want}`);
    expect((await store.sendLogFor(me, 1))[0]!.variant).toBe("test");
  });
});

describe("holdout", () => {
  it("keeps its share out with a would_have_sent row, no push, and no slot; the rest are sent, none of both", async () => {
    const users: string[] = [];
    for (let i = 0; i < 120; i++) users.push(await account());
    const c = await campaign({ variants: 2, holdoutPct: 10 });
    await runCampaigns(deps, { now: BERLIN_1830 });
    const held = users.filter((u) => inHoldout(u, c.id, 10));
    expect(held.length).toBeGreaterThan(3);
    expect(held.length).toBeLessThan(30);
    const sentTo = new Set(push.sent.map((m) => m.to));
    expect(push.sent).toHaveLength(users.length - held.length);
    for (const u of users) {
      const rows = await store.sendLogFor(u, 5);
      const token = (await store.pushTokensFor(u))[0]!.token;
      if (held.includes(u)) {
        expect(sentTo.has(token)).toBe(false);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ state: "would_have_sent", kind: "campaign", ref: c.id, variant: CAMPAIGN_VARIANTS[variantOf(u, c.id, 2)] });
        // No slot was claimed: today's message is still free for another sender.
        expect(await store.claimPushSlot(u, "2026-08-20", "evening", null)).toEqual({ claimed: true });
      } else {
        expect(sentTo.has(token)).toBe(true);
        expect(rows[0]!.state).toBe("accepted");
      }
    }
  });

  it("logs a held-out account only on a day its slot is free, exactly like a treated one is retried", async () => {
    const users: string[] = [];
    for (let i = 0; i < 80; i++) users.push(await account());
    const c = await campaign({ holdoutPct: 10 });
    const held = users.filter((u) => inHoldout(u, c.id, 10));
    expect(held.length).toBeGreaterThan(2);
    // Another sender (a streak line, a trial reminder, ...) already holds today for every account.
    for (const u of users) await store.claimPushSlot(u, "2026-08-20", "streak", null);
    await runCampaigns(deps, { now: BERLIN_1830 });
    for (const u of users) expect(await store.sendLogFor(u, 5)).toHaveLength(0); // no row, treated or held
    for (const u of held) expect(await store.hasCampaignSend(u, c.id)).toBe(false); // retried, not spent
    expect(push.sent).toHaveLength(0);
    // Reading the slot claimed nothing: the day is still the other sender's.
    for (const u of held) expect(await store.pushSlotOf(u, "2026-08-20")).toBe("streak");
    // The next free day: one would_have_sent row for each held-out account, a push for the rest.
    await runCampaigns(deps, { now: BERLIN_1830 + DAY });
    for (const u of held) {
      const rows = await store.sendLogFor(u, 5);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.state).toBe("would_have_sent");
    }
    expect(push.sent).toHaveLength(users.length - held.length);
    // And it is the slot of the NEW day that stayed free: a held-out account claimed nothing.
    for (const u of held) expect(await store.pushSlotOf(u, "2026-08-21")).toBeNull();
  });

  it("logs a held-out account once, however many ticks run", async () => {
    const users: string[] = [];
    for (let i = 0; i < 60; i++) users.push(await account());
    const c = await campaign({ holdoutPct: 10 });
    for (const k of [0, 1, 2]) await runCampaigns(deps, { now: BERLIN_1830 + k * MIN });
    await runCampaigns(deps, { now: BERLIN_1830 + DAY });
    for (const u of users.filter((x) => inHoldout(x, c.id, 10))) expect(await store.sendLogFor(u, 5)).toHaveLength(1);
  });

  it("holds out nobody at 0%", async () => {
    const users: string[] = [];
    for (let i = 0; i < 40; i++) users.push(await account());
    await campaign({ holdoutPct: 0 });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(40);
    const rows = (await Promise.all(users.map((u) => store.sendLogFor(u, 5)))).flat();
    expect(rows.filter((r) => r.state === "would_have_sent")).toHaveLength(0);
  });

  it("logs no holdout row for an account outside the segment, or before the hour", async () => {
    const en: string[] = [];
    for (let i = 0; i < 60; i++) en.push(await account({ lang: "en" }));
    await campaign({ segment: { langs: ["de"] }, holdoutPct: 10 });
    await runCampaigns(deps, { now: BERLIN_1830 - 60 * MIN });
    await runCampaigns(deps, { now: BERLIN_1830 });
    for (const u of en) expect(await store.sendLogFor(u, 5)).toHaveLength(0);
    expect(push.sent).toHaveLength(0);
  });

  it("is reported as its own group, and the effect is treated minus holdout over accounts", async () => {
    const users: string[] = [];
    for (let i = 0; i < 80; i++) users.push(await account());
    const c = await campaign({ variants: 2, holdoutPct: 10 });
    await runCampaigns(deps, { now: BERLIN_1830 });
    const held = new Set(users.filter((u) => inHoldout(u, c.id, 10)));
    const meal = (userId: string) => ({
      id: crypto.randomUUID(), user_id: userId, ts: new Date(Date.now() + 60_000).toISOString(), date: "2026-08-20",
      isFood: true, items: [{ name: "x", grams: 1 }], kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0,
      fiber_g: 0, sugar_g: 0, sodium_mg: 0, verdicts: {}, healthScore: null, confidence: "high" as const,
      notes: "", corrected: false, model: "t",
    });
    // The store stamps a send with the wall clock, so the meals land just after it.
    const loggers = users.slice(0, 30);
    for (const u of loggers) await store.insertMeal(meal(u));
    const mine = (await campaignOverview(deps)).campaigns.find((x) => x.id === c.id)!;
    const groups = Object.fromEntries(mine.report.groups.map((g) => [g.group, g]));
    expect(groups.holdout).toMatchObject({ users: held.size, opened: 0, converted: loggers.filter((u) => held.has(u)).length });
    expect(groups.default!.users + groups.b!.users).toBe(users.length - held.size);
    const treatedConverted = loggers.filter((u) => !held.has(u)).length;
    expect(groups.default!.converted + groups.b!.converted).toBe(treatedConverted);
    expect(mine.effect).toMatchObject({
      treated: { n: users.length - held.size, x: treatedConverted }, holdout: { n: held.size, x: loggers.filter((u) => held.has(u)).length },
    });
  });

  it("a dry run does not count the held-out as reached, and says how many it would hold out", async () => {
    for (let i = 0; i < 80; i++) await account();
    const c = await campaign({ holdoutPct: 10 }, "draft");
    const out = await dryRunCampaign(deps, c.id, { now: BERLIN_1830 });
    expect(out.ok && out.wouldSend + out.heldOut).toBe(80);
    expect(out.ok && out.heldOut).toBeGreaterThan(0);
    expect(push.sent).toHaveLength(0);
  });
});
