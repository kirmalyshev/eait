import { beforeEach, describe, expect, it } from "bun:test";
import { LANGS, type PushTemplateRow } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush, type FakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { CampaignRow, Store } from "../store.ts";
import {
  createCampaign, dryRunCampaign, runCampaigns, setCampaignStatus, setCampaignsKilled, testSendCampaign,
  updateCampaign,
} from "./campaign.ts";
import { patchProfile, type EngineDeps } from "./index.ts";

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
async function copy(key = "campaign:win-back", draftLang?: string): Promise<void> {
  for (const lang of LANGS) {
    await store.putPushTemplate({
      key: key as PushTemplateRow["key"], lang, variant: "default", title: `Hi ${lang}`, body: `Body ${lang}`,
      status: lang === draftLang ? "draft" : "reviewed", reviewed_by: "t", reviewed_at: "2026-10-08T00:00:00.000Z",
      updated_at: "2026-10-08T00:00:00.000Z",
    });
  }
}

async function campaign(over: Record<string, unknown> = {}, status: "draft" | "scheduled" = "scheduled"): Promise<CampaignRow> {
  const key = (over.templateKey as string | undefined) ?? "campaign:win-back";
  if ((await store.listPushTemplates()).every((r) => r.key !== key)) await copy(key);
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
    expect(await store.campaignReport(c.id)).toEqual({ sent: 0, accepted: 0, dead: 0, dry: 0, opened: 0, test: 1 });
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
