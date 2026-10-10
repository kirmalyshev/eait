import { describe, expect, it } from "bun:test";
import { ADMIN_PUSH_MAX_RECIPIENTS, CAMPAIGN_VARIANTS, LANGS, PUSH_ROUTES, localDate, type PushTemplateRow } from "@eait/shared";
import { configDefaults } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { memoryStore } from "../store.memory.ts";
import { sendAdminPush } from "./admin-push.ts";
import { patchProfile, type EngineDeps } from "./index.ts";
import { zoneOf } from "./notify.ts";
import { setPushConsent } from "./push-consent.ts";

describe("admin push composer", () => {
  it("skips an account without push_offers_at even when the body says promotional:false", async () => {
    const store = memoryStore();
    const deps: EngineDeps = { store, config: { ...configDefaults(), port: 0, databaseUrl: "memory://t" }, llm: demoPorts(), push: fakePush(), mail: logMail() };
    for (const lang of LANGS) {
      await store.putPushTemplate({
        key: "campaign:promo" as PushTemplateRow["key"], lang, variant: CAMPAIGN_VARIANTS[0]!, title: `Hi ${lang}`, body: `Body ${lang}`,
        status: "reviewed", reviewed_by: "t", reviewed_at: "2026-10-08T00:00:00.000Z", updated_at: "2026-10-08T00:00:00.000Z",
      });
    }
    const make = async (offers: boolean) => {
      const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
      await patchProfile(deps, userId, {
        goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
        target_weight_kg: 65, activity: "some", pace: "steady", country: "de", restrictions: [], complete_onboarding: true,
      });
      await store.putPushToken(userId, `ExponentPushToken[${userId.slice(0, 8)}]`, "ios");
      if (offers) await setPushConsent(deps, userId, { offers: true });
      return userId;
    };
    const without = await make(false);
    const withOffers = await make(true);
    const out = await sendAdminPush(deps, crypto.randomUUID(), {
      userIds: [without, withOffers], templateKey: "campaign:promo", route: "chat", promotional: false, confirmCount: 2,
    });
    expect(out).toMatchObject({ ok: true });
    if (!out.ok) return;
    expect(out.results.find((r) => r.userId === without)).toMatchObject({ skipped: "no-offers" });
    expect(out.results.find((r) => r.userId === withOffers)).toMatchObject({ sent: 1 });
  });

});

describe("admin push composer: hard rules", () => {
  const ADMIN = crypto.randomUUID();
  const setup = async (templateLangs: readonly (typeof LANGS)[number][] = LANGS) => {
    const store = memoryStore();
    const push = fakePush();
    const deps: EngineDeps = { store, config: { ...configDefaults(), port: 0, databaseUrl: "memory://t" }, llm: demoPorts(), push, mail: logMail() };
    for (const lang of templateLangs) {
      await store.putPushTemplate({
        key: "campaign:promo" as PushTemplateRow["key"], lang, variant: CAMPAIGN_VARIANTS[0]!, title: `Hi ${lang}`, body: `Body ${lang}`,
        status: "reviewed", reviewed_by: "t", reviewed_at: "2026-10-08T00:00:00.000Z", updated_at: "2026-10-08T00:00:00.000Z",
      });
    }
    const make = async (locale: (typeof LANGS)[number] = "en") => {
      const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), locale);
      await patchProfile(deps, userId, {
        goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
        target_weight_kg: 65, activity: "some", pace: "steady", country: "de", restrictions: [], complete_onboarding: true,
      });
      await store.putPushToken(userId, `ExponentPushToken[${userId.slice(0, 8)}]`, "ios");
      await setPushConsent(deps, userId, { offers: true });
      return userId;
    };
    return { store, push, deps, make };
  };
  const body = (userIds: string[], over: Record<string, unknown> = {}) =>
    ({ userIds, templateKey: "campaign:promo", route: "chat", confirmCount: userIds.length, ...over });

  it("another sender going first does not stop it, and the account's own bound does", async () => {
    const { store, push, deps, make } = await setup();
    const went = await make();
    const capped = await make();
    const now = Date.now();
    const zone = zoneOf(deps, await store.timezoneOf(went));
    const day = localDate(zone, new Date(now));
    expect(await store.claimPushSlot(went, day, "evening", null)).toMatchObject({ claimed: true });
    await store.setPushDailyMax(capped, 1);
    expect(await store.claimPushSlot(capped, day, "evening", null)).toMatchObject({ claimed: true });
    const out = await sendAdminPush(deps, ADMIN, body([went, capped]), now);
    if (!out.ok) throw new Error("expected ok");
    expect(out.results.find((r) => r.userId === went)).toMatchObject({ sent: 1 });
    expect(out.results.find((r) => r.userId === capped)).toEqual({ userId: capped, skipped: "account-cap" });
    expect(push.sent).toHaveLength(1);
    expect(await store.sendLogFor(capped, 10)).toHaveLength(0);
  });

  it("two composer sends to one account the same day both go", async () => {
    const { push, deps, make } = await setup();
    const u = await make();
    for (let i = 0; i < 2; i++) {
      const out = await sendAdminPush(deps, ADMIN, body([u]));
      if (!out.ok) throw new Error("expected ok");
      expect(out.results[0]).toMatchObject({ sent: 1 });
    }
    expect(push.sent).toHaveLength(2);
  });

  it("refuses free text and non-campaign keys", async () => {
    const { push, deps, make } = await setup();
    const u = await make();
    for (const templateKey of ["Buy now!", "evening", "nudge", "campaign:evening", "campaign:", undefined, 5]) {
      const out = await sendAdminPush(deps, ADMIN, body([u], { templateKey }));
      expect(out).toMatchObject({ ok: false });
    }
    expect(await sendAdminPush(deps, ADMIN, body([u], { templateKey: undefined, title: "Free", body: "text" }))).toMatchObject({ ok: false });
    expect(push.sent).toHaveLength(0);
  });

  it("sends in each account's own language", async () => {
    const { push, deps, make } = await setup();
    const en = await make("en");
    const de = await make("de");
    const out = await sendAdminPush(deps, ADMIN, body([en, de]));
    expect(out).toMatchObject({ ok: true });
    const titleOf = (tokenOwner: string) => push.sent.find((m) => m.to === `ExponentPushToken[${tokenOwner.slice(0, 8)}]`)?.title;
    expect(titleOf(en)).toBe("Hi en");
    expect(titleOf(de)).toBe("Hi de");
  });

  it("skips an incomplete template before the slot is claimed", async () => {
    const { store, push, deps, make } = await setup(LANGS.filter((l) => l !== "de"));
    const u = await make("en");
    const now = Date.now();
    const out = await sendAdminPush(deps, ADMIN, body([u]), now);
    if (!out.ok) throw new Error("expected ok");
    expect(out.results).toEqual([{ userId: u, skipped: "template-incomplete" }]);
    expect(push.sent).toHaveLength(0);
    const zone = zoneOf(deps, await store.timezoneOf(u));
    expect(await store.claimPushSlot(u, localDate(zone, new Date(now)), "evening", null)).toMatchObject({ claimed: true });
  });

  it("route must be a PUSH_ROUTES member: a raw path or URL is refused", async () => {
    const { push, deps, make } = await setup();
    const u = await make();
    for (const route of ["/chat", "https://evil.example/x", "eait://chat", "nowhere", undefined, 1]) {
      expect(await sendAdminPush(deps, ADMIN, body([u], { route }))).toMatchObject({ ok: false });
    }
    expect(push.sent).toHaveLength(0);
    for (const route of PUSH_ROUTES) {
      expect(await sendAdminPush(deps, ADMIN, body([u], { route }), Date.now() + PUSH_ROUTES.indexOf(route) * 86_400_000 * 2)).toMatchObject({ ok: true });
    }
  });

  it("refuses more than ADMIN_PUSH_MAX_RECIPIENTS, none, or a non-uuid id", async () => {
    const { push, deps, make } = await setup();
    const u = await make();
    const many = Array.from({ length: ADMIN_PUSH_MAX_RECIPIENTS + 1 }, () => crypto.randomUUID());
    expect(await sendAdminPush(deps, ADMIN, body(many))).toMatchObject({ ok: false });
    expect(await sendAdminPush(deps, ADMIN, body([]))).toMatchObject({ ok: false });
    expect(await sendAdminPush(deps, ADMIN, body([u, "not-a-uuid"]))).toMatchObject({ ok: false });
    expect(push.sent).toHaveLength(0);
  });

  it("refuses a confirmCount that is not the number of accounts", async () => {
    const { push, deps, make } = await setup();
    const a = await make();
    const b = await make();
    for (const confirmCount of [1, 3, 0, "2", undefined]) {
      expect(await sendAdminPush(deps, ADMIN, body([a, b], { confirmCount }))).toMatchObject({ ok: false });
    }
    expect(push.sent).toHaveLength(0);
  });

  it("logs every send under ref admin:<adminId>", async () => {
    const { store, deps, make } = await setup();
    const u = await make();
    await sendAdminPush(deps, ADMIN, body([u]));
    const rows = await store.sendLogFor(u, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "campaign", ref: `admin:${ADMIN}` });
  });
});
