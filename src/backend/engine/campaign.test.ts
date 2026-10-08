import { beforeEach, describe, expect, it } from "bun:test";
import type { PushTemplateRow } from "@eait/shared";
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
import { ensurePushTemplates } from "./push-templates.ts";

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

async function campaign(over: Record<string, unknown> = {}, status: "draft" | "scheduled" = "scheduled"): Promise<CampaignRow> {
  const made = await createCampaign(deps, {
    name: "Win-back", templateKey: "nudge", segment: {}, localSendTime: "18:30", rolloutPct: 100,
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
      name: "x", templateKey: "nudge", segment: { sql: "1=1" }, localSendTime: "18:30", rolloutPct: 10, promotional: false,
    }, "a");
    expect(r).toEqual({ ok: false, errors: ["unknown predicate: sql"] });
  });

  it("will not activate while the template has a draft or missing language", async () => {
    await ensurePushTemplates(deps);
    const rows = await store.listPushTemplates();
    const de = rows.find((r) => r.key === "nudge" && r.lang === "de")!;
    await store.putPushTemplate({ ...de, status: "draft" } as PushTemplateRow);
    const c = await campaign({}, "draft");
    const r = await setCampaignStatus(deps, c.id, "scheduled");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("de/");
    expect((await store.getCampaign(c.id))?.status).toBe("draft");
    await store.putPushTemplate(de);
    expect((await setCampaignStatus(deps, c.id, "scheduled")).ok).toBe(true);
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
    expect((await store.sendLogFor(de, 5))[0]).toMatchObject({ kind: "campaign", templateKey: "nudge", lang: "de" });
  });

  it("selects by entitlement, onboarding and tips consent", async () => {
    const paid = await account();
    await account({ free: true });
    await campaign({ segment: { entitlement: ["active"], onboarded: true, tipsConsent: true } });
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

  it("a promotional campaign reaches only accounts with tips and offers on, whatever the segment", async () => {
    const yes = await account({ consent: true });
    const no = await account({ consent: false });
    await campaign({ promotional: true, segment: {} });
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(await store.sendLogFor(yes, 5)).toHaveLength(1);
    expect(await store.sendLogFor(no, 5)).toHaveLength(0);
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
    await ensurePushTemplates(deps);
    const de = (await store.listPushTemplates()).find((r) => r.key === "nudge" && r.lang === "de")!;
    await store.putPushTemplate({ ...de, status: "draft" } as PushTemplateRow);
    const c = await campaign({ segment: { staffOnly: true } }, "draft");
    expect(await testSendCampaign(deps, c.id, me, BERLIN_1830)).toEqual({ ok: false, reason: "template-incomplete" });
    expect(await store.claimPushSlot(me, "2026-08-20", "evening", null)).toEqual({ claimed: true });
  });
});

describe("a campaign never goes out on a template that stopped being complete", () => {
  it("the runner re-checks the template each batch", async () => {
    await account({ lang: "de" });
    await campaign();
    await ensurePushTemplates(deps);
    const de = (await store.listPushTemplates()).find((r) => r.key === "nudge" && r.lang === "de")!;
    await store.putPushTemplate({ ...de, status: "draft" } as PushTemplateRow);
    await runCampaigns(deps, { now: BERLIN_1830 });
    expect(push.sent).toHaveLength(0);
  });
});
