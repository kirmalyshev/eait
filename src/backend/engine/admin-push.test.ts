import { describe, expect, it } from "bun:test";
import { CAMPAIGN_VARIANTS, LANGS, type PushTemplateRow } from "@eait/shared";
import { configDefaults } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import { sendAdminPush } from "./admin-push.ts";
import { patchProfile, type EngineDeps } from "./index.ts";
import { setPushConsent } from "./push-consent.ts";

describe("admin push composer", () => {
  it("skips an account without push_offers_at even when the body says promotional:false", async () => {
    const store = memoryStore();
    const deps: EngineDeps = { store, config: { ...configDefaults(), port: 0, databaseUrl: "memory://t" }, llm: demoPorts(), push: fakePush() };
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
      if (offers) await setPushConsent(deps, userId, true);
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
