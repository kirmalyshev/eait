// The forgiving streak through `days()` (#574): an under-floor day earns nothing, and bend/break
// are read in the ACCOUNT's zone — two zones a calendar day apart see the same shape.

import { describe, expect, test } from "bun:test";
import { KCAL_FLOOR, dateMinus, explainTargets, localDate } from "@eait/shared";
import type { MealRecord } from "@eait/shared";
import { memoryStore } from "../store.memory.ts";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { days } from "./index.ts";
import type { EngineDeps } from "./deps.ts";

const meal = (userId: string, date: string, kcal: number): MealRecord => ({
  id: crypto.randomUUID(), user_id: userId, ts: `${date}T12:00:00.000Z`, date,
  isFood: true, items: [], kcal, protein_g: 10, carbs_g: 40, fat_g: 15, satfat_g: 4,
  fiber_g: 1, sugar_g: 1, sodium_mg: 10,
  verdicts: {}, healthScore: null, confidence: "high", notes: "", corrected: false, model: "test",
});

/** One account in `timezone`; `kcalBack[n]` is the kcal logged n days before THAT zone's today. */
async function read(timezone: string, kcalBack: Record<number, number>) {
  const store = memoryStore();
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const profile = await store.patchProfile(userId, { sex: "female" });
  const floor = explainTargets(profile).basis.floorKcal;
  const deps: EngineDeps = {
    store, config: { ...configDefaults(), timezone } as Config, llm: demoPorts(), push: fakePush(), mail: logMail(),
  };
  const today = localDate(timezone);
  for (const [n, kcal] of Object.entries(kcalBack)) await store.insertMeal(meal(userId, dateMinus(today, Number(n)), kcal));
  const out = (await days(deps, userId, dateMinus(today, 6), today))!;
  return { out, floor, today };
}

// UTC+14 and UTC-11: their calendar dates always differ, so a read that leaked UTC would differ.
const ZONES = ["Pacific/Kiritimati", "Pacific/Pago_Pago"];

describe("days(): the forgiving streak", () => {
  for (const zone of ZONES) {
    test(`${zone}: an under-floor day earns no credit and bends the streak`, async () => {
      const { out, floor, today } = await read(zone, { 1: floor0(), 2: 900, 3: floor0() });
      expect(out.streak).toBe(2);
      const under = out.days.find((d) => d.date === dateMinus(today, 2))!;
      expect(under).toMatchObject({ underFloor: true, streak: "bent", logged: true });
      expect(out.days.find((d) => d.date === dateMinus(today, 1))).toMatchObject({ underFloor: false, streak: "counted" });
      expect(out.days.find((d) => d.date === today)).toMatchObject({ streak: "pending" });
      expect(out.streakState).toBe("bent");
      expect(floor).toBeGreaterThan(900);
    });

    test(`${zone}: two bent days in a row end it`, async () => {
      const { out } = await read(zone, { 2: 900, 3: floor0(), 4: floor0() });
      expect(out.streak).toBe(0);
      expect(out.streakLongest).toBe(2);
      expect(out.streakState).toBe("ended");
    });

    test(`${zone}: yesterday counted, today pending holds`, async () => {
      const { out } = await read(zone, { 1: floor0(), 2: floor0() });
      expect([out.streak, out.streakState]).toEqual([2, "holding"]);
    });
  }
});

/** The female floor, read from the shared table so the fixtures sit exactly on it. */
const floor0 = (): number => KCAL_FLOOR.female;
