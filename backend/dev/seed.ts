// The accounts a freshly-created development database opens with.
//
// WHY THIS EXISTS. Every worktree gets its own database (see `scripts/dev-env.ts`), and a database
// with no rows in it is a database you cannot look at: the diary is empty, the week view has
// nothing to draw, and every screen that renders a meal renders the empty state instead. So each
// database is seeded, and the app is TOLD which account to be — `EXPO_PUBLIC_EAIT__FRONTEND__DEV_DEVICE_ID` on the
// phone side carries the pinned device id of one of these personas, so a build launches straight
// into an account with a week of meals in it rather than into onboarding.
//
// TWO PROPERTIES THIS FILE KEEPS:
//
//  1. IT REPLACES ITS OWN ACCOUNTS AND TOUCHES NOTHING ELSE. Seeding deletes each persona's account
//     and rebuilds it, so running it twice leaves one week of meals and not two. It reaches rows by
//     device id and by nothing else, so an account you created by hand while testing survives.
//  2. VERDICTS ARE COMPUTED, exactly as `engine/meals.ts` computes them — `explainTargets` →
//     `verdictsFromTargets` → `visibleVerdicts`. A fixture that hand-wrote plausible verdicts would
//     be a fixture that disagrees with the product, and the disagreement would show up as a test
//     that passes against data the app can never produce.
//
// It is written against the `Store` INTERFACE, not against Postgres, so the tests exercise it
// against `store.memory.ts` with no database running.

import {
  explainTargets, verdictsFromTargets, visibleVerdicts,
  type Lang, type MealItem, type MealRecord,
} from "@eait/shared";
import { localDate, dateMinus, emptyHealthDay, firstVerdictLines, FIXTURE_THREAD, type HealthDay } from "@eait/shared";
import type { ChatAppend, ProfilePatch, Store } from "../store.ts";

/**
 * A device id that is stable across runs, unguessable, and recognisable in a `psql` session.
 *
 * The `5eed` prefix is there so a row in `users.device_id` can be identified as a fixture at a
 * glance. The rest is a hash rather than the persona name because this string IS the account
 * credential — `POST /v1/auth/device` asks for nothing else — and a guessable one would be an
 * account anybody who reads this file can log into on any host that ever ran the seeder.
 */
export function seedDeviceId(key: string): string {
  const digest = new Bun.CryptoHasher("sha256").update(`eait-dev-seed:${key}`).digest("hex");
  return `5eed${digest.slice(4)}`;
}

export interface SeedPersona {
  /** Stable name. What `--persona` takes and what the generated env files refer to. */
  key: string;
  /** One line, printed by the seeder — this is how you pick which one to be. */
  summary: string;
  /**
   * The profile to write, or null for an account that has never onboarded.
   *
   * A null one is not padding: onboarding is the flow most often iterated on, and re-running it
   * otherwise means deleting your account by hand between every attempt.
   */
  profile: ProfilePatch | null;
  /** How many calendar days of meals to write, counting back from today. */
  days: number;
  /**
   * Whether this persona holds the admin role (#391b).
   *
   * EXACTLY ONE PERSONA DOES, and a development database needs it: the role is the only way into
   * `/admin` now, so a seeded database with nobody holding it has an admin surface that answers
   * 404 — correct, and unusable. It is re-applied on every seed because each run deletes the
   * account and mints a NEW user id; a grant left on the old one would be an admin nobody can sign
   * in as, while `hasAdmin()` still said the surface exists.
   */
  admin?: true;
  /**
   * A fixed thread to write as the user's own lines, instead of one derived from meals.
   *
   * For the persona that has to look identical on every run — see `FIXTURE_THREAD`. A persona with
   * `days > 0` gets its thread from its meals and wants none of this.
   */
  thread?: readonly string[];
}

/**
 * The personas, in the order the seeder prints them. `onboarded` is first because it is the one
 * `dev-env` pins by default.
 *
 * The profile on `onboarded` declares `ldl` deliberately. That is the tag that unlocks the `ldl`
 * verdict dimension, so seeded meals carry a second verdict pill and the row that renders it is
 * exercised by looking at the app rather than only by a unit test.
 */
export const SEED_PERSONAS: readonly SeedPersona[] = [
  {
    key: "onboarded",
    summary: "onboarded, 7 days of meals, declares an LDL restriction",
    days: 7,
    profile: {
      goal: "lose",
      sex: "male",
      birth_year: 1990,
      height_cm: 180,
      weight_kg: 93,
      target_weight_kg: 85,
      activity: "moderate",
      pace: "steady",
      country: "de",
      restrictions: ["ldl"],
      medical_limitations: null,
      food_allergies: null,
      product_limitations: null,
      onboarded_at: new Date("2026-01-15T09:00:00.000Z").toISOString(),
    },
  },
  {
    key: "fresh",
    summary: "never onboarded — for driving the onboarding flow repeatedly",
    days: 0,
    profile: null,
  },
  {
    // AFTER `fresh`, and it matters: `seed.test.ts` finds the persona with no health rows by
    // taking the FIRST with `healthDays === 0`, which is `fresh`. A second such persona ahead of it
    // would silently change which account that assertion is about. (This said "last" until the
    // admin persona was appended below; that one has meals, so it has health rows and can never be
    // the one that assertion finds.)
    key: "chat",
    summary: "onboarded, no meals, a fixed thread — the Chat the visual checkpoints baseline (#257)",
    days: 0,
    thread: FIXTURE_THREAD,
    // The answers `app/e2e.tsx` writes, so this persona and the account the E2E button mints read
    // the same plan — the checkpoints are taken against one of them and looked at in the other.
    profile: {
      goal: "lose",
      sex: "male",
      birth_year: 1990,
      height_cm: 183,
      weight_kg: 93,
      target_weight_kg: 88,
      activity: "moderate",
      pace: "steady",
      country: "de",
      restrictions: ["ldl"],
      medical_limitations: null,
      food_allergies: null,
      product_limitations: null,
      onboarded_at: new Date("2026-01-15T09:00:00.000Z").toISOString(),
    },
  },
  {
    // THE ONE ACCOUNT THAT CAN OPEN /admin (#391b).
    //
    // It has meals and a plan like any other, deliberately: the admin is an ordinary account that
    // happens to hold a role, and a persona with nothing in it would hide every place the panel
    // renders against real numbers. It is also the account to sign in as when driving the web app,
    // because the Admin tab is only drawn for it.
    key: "admin",
    summary: "onboarded, 7 days of meals, HOLDS THE ADMIN ROLE — the account /admin opens for",
    days: 7,
    admin: true,
    profile: {
      goal: "maintain",
      sex: "female",
      birth_year: 1988,
      height_cm: 168,
      weight_kg: 62,
      target_weight_kg: 62,
      activity: "light",
      pace: "steady",
      country: "de",
      restrictions: [],
      medical_limitations: null,
      food_allergies: null,
      product_limitations: null,
      onboarded_at: new Date("2026-01-15T09:00:00.000Z").toISOString(),
    },
  },
];

/** The persona `dev-env` pins into `EXPO_PUBLIC_EAIT__FRONTEND__DEV_DEVICE_ID` unless told otherwise. */
export const DEFAULT_SEED_PERSONA = "onboarded";

export interface SeedOptions {
  /** IANA zone the dates are computed in. Must match the server's, or the diary looks a day off. */
  timezone: string;
  /** Today, injectable so a test can assert exact dates. */
  today?: string;
  /** Restrict the run to these persona keys. Empty/absent means all of them. */
  only?: readonly string[];
}

export interface SeededPersona {
  key: string;
  deviceId: string;
  userId: string;
  summary: string;
  meals: number;
  /** Health days written. Zero for a persona with no profile — see `seedDevData`. */
  healthDays: number;
  /** Whether this account holds the admin role. Exactly one seeded persona does. */
  admin: boolean;
}

/** One plate: a name, and the share of the meal's calories it accounts for. */
interface Plate {
  name: string;
  name_en: string;
  share: number;
}

/**
 * Three meals a day, at plausible hours, made of plausible plates.
 *
 * The shares add to 1.0 within a slot and the slot shares add to 1.0 across the day, so a seeded
 * day lands on the user's calorie target rather than somewhere arbitrary — which is what makes the
 * verdicts on the cards mean something when you look at them.
 */
const SLOTS: readonly { name: string; hour: number; share: number; plates: readonly Plate[] }[] = [
  {
    name: "breakfast", hour: 8, share: 0.25,
    plates: [
      { name: "Porridge with berries", name_en: "oat porridge", share: 0.6 },
      { name: "Greek yoghurt", name_en: "greek yoghurt", share: 0.4 },
    ],
  },
  {
    name: "lunch", hour: 13, share: 0.4,
    plates: [
      { name: "Grilled chicken breast", name_en: "chicken breast", share: 0.45 },
      { name: "Brown rice", name_en: "brown rice", share: 0.35 },
      { name: "Mixed salad", name_en: "mixed salad", share: 0.2 },
    ],
  },
  {
    name: "dinner", hour: 19, share: 0.35,
    plates: [
      { name: "Baked salmon", name_en: "salmon fillet", share: 0.5 },
      { name: "Roast potatoes", name_en: "roast potato", share: 0.3 },
      { name: "Steamed broccoli", name_en: "broccoli", share: 0.2 },
    ],
  },
];

/**
 * FNV-1a over a string, as a float in [0, 1).
 *
 * Deterministic on purpose: the same worktree seeded twice produces the same numbers, so a
 * screenshot taken yesterday and one taken today differ only where the code differs. `Math.random`
 * here would make every re-seed a different data set and every visual comparison worthless.
 */
function unitHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x1_0000_0000;
}

/** ±15% around 1, from a seed. Enough variation that the week view is not a flat line. */
function jitter(seed: string): number {
  return 0.85 + unitHash(seed) * 0.3;
}

export async function seedDevData(store: Store, opts: SeedOptions): Promise<SeededPersona[]> {
  const today = opts.today ?? localDate(opts.timezone);
  const wanted = opts.only && opts.only.length > 0
    ? SEED_PERSONAS.filter((p) => opts.only!.includes(p.key))
    : SEED_PERSONAS;

  const out: SeededPersona[] = [];
  for (const persona of wanted) {
    const deviceId = seedDeviceId(persona.key);
    const lang: Lang = "en";

    // Replace, do not add to. The account is deleted and rebuilt so that seeding twice leaves one
    // week of meals rather than two — and `deleteUser` reaches only this device id, so anything you
    // created by hand while testing is untouched.
    const existing = await store.upsertDeviceUser(deviceId, lang);
    await store.deleteUser(existing.userId);
    const { userId } = await store.upsertDeviceUser(deviceId, lang);

    // The role, before anything else. `setRole` refuses an id that names no account, so it goes
    // after the account exists and before the `continue` below can skip past it.
    if (persona.admin) await store.setRole(userId, "admin");

    if (persona.profile === null) {
      out.push({
        key: persona.key, deviceId, userId, summary: persona.summary, meals: 0, healthDays: 0,
        admin: persona.admin === true,
      });
      continue;
    }

    const profile = await store.patchProfile(userId, persona.profile);
    const { targets } = explainTargets(profile);

    let meals = 0;
    const thread: { back: number; record: MealRecord; lines: ChatAppend[] }[] = [];
    for (let back = 0; back < persona.days; back++) {
      const date = dateMinus(today, back);
      for (const slot of SLOTS) {
        const seed = `${persona.key}:${date}:${slot.name}`;
        const kcal = Math.round(targets.kcal * slot.share * jitter(seed));

        // Macros from the calories, at a mix that is unremarkable rather than optimal: 25% protein,
        // 45% carbohydrate, 30% fat. The point is data that looks like a person's, not a fixture
        // that hits every target exactly.
        //
        // The SATURATED share is 15%, which is what these plates actually are — oats, chicken,
        // salmon. A third was tried first and it put every single meal at `warn` or `bad` on the
        // LDL dimension, which makes the seeded app look like an emergency and, worse, makes the
        // verdict row useless for judging whether the colours are right.
        const protein_g = Math.round((kcal * 0.25) / 4);
        const carbs_g = Math.round((kcal * 0.45) / 4);
        const fat_g = Math.round((kcal * 0.3) / 9);
        const satfat_g = Math.round(fat_g * 0.15 * 10) / 10;
        const fiber_g = Math.round(carbs_g * 0.12);
        const sugar_g = Math.round(carbs_g * 0.2);
        const sodium_mg = Math.round(400 + unitHash(`${seed}:na`) * 800);

        const items: MealItem[] = slot.plates.map((plate) => ({
          name: plate.name,
          name_en: plate.name_en,
          grams: Math.round(120 * plate.share * 2),
          kcal: Math.round(kcal * plate.share),
          protein_g: Math.round(protein_g * plate.share),
          carbs_g: Math.round(carbs_g * plate.share),
          fat_g: Math.round(fat_g * plate.share),
        }));

        const analysis = { kcal, satfat_g, sodium_mg };
        const record: MealRecord = {
          id: crypto.randomUUID(),
          user_id: userId,
          // The hour is written in UTC rather than in the configured zone. `date` is what every
          // query and every screen groups by; `ts` only orders meals within a day, and it is a few
          // hours out from the label in exchange for not hand-rolling a zone-aware constructor.
          ts: new Date(`${date}T${String(slot.hour).padStart(2, "0")}:00:00Z`).toISOString(),
          date,
          isFood: true,
          items,
          kcal, protein_g, carbs_g, fat_g, satfat_g, fiber_g, sugar_g, sodium_mg,
          // Computed, never authored — the same chain `engine/meals.ts` runs after every write.
          verdicts: visibleVerdicts(verdictsFromTargets(analysis, targets), profile.restrictions),
          confidence: "high",
          notes: `Seeded ${slot.name}`,
          corrected: false,
          model: "seed",
        };
        await store.insertMeal(record);
        // The thread is what the Chat tab opens on; a persona with a diary and no thread would open
        // Chat on its empty state, which is the one thing a fixture must not do. Collected here and
        // written after the loop, oldest day first — this loop runs newest-first, and seq is the
        // thread's order.
        thread.push({ back, record, lines: [
          { role: "user", kind: "photo", text: null },
          { role: "assistant", kind: "meal", mealId: record.id, event: "logged" },
        ] });
        meals++;
      }
    }

    thread.sort((a, b) => b.back - a.back);
    // The greeting is IN the thread, at the oldest meal — a flag with no transcript behind it would
    // be the one thing this thread exists to make impossible.
    const oldest = thread[0];
    if (oldest) {
      oldest.lines.push(...firstVerdictLines({
        goal: profile.goal ?? "maintain", targets, via: "photo", verdicts: oldest.record.verdicts,
        meal: { kcal: oldest.record.kcal, confidence: oldest.record.confidence },
        eatenToday: { kcal: oldest.record.kcal, protein_g: oldest.record.protein_g },
      }).map((text) => ({ role: "assistant", kind: "text", text } as const)));
    }
    for (const t of thread) await store.appendChat(userId, t.lines);

    // The fixed thread, for the persona whose whole job is to look the same on every run. Written
    // as the user's own lines through the same store interface as everything else in this file, so
    // `bun test` covers it with no database — and there is nothing to compute, which is the point.
    if (persona.thread) {
      await store.appendChat(userId, persona.thread.map(
        (text) => ({ role: "user", kind: "text", text } as const),
      ));
    }

    // A week-old account has heard its first verdict. Without this, its next meal would be greeted
    // as the first — a fixture disagreeing with the product.
    if (meals > 0) await store.claimFirstVerdict(userId);

    // ── the health trend ──
    //
    // Written through the SAME store interface as everything else, so `bun test` covers it with no
    // database. Deliberately incomplete: some days carry no weight and some carry no sleep, because
    // a fixture where every metric is present every day is a fixture that never exercises the
    // "unknown, not zero" rendering — and that is the branch a real trend spends most of its time in.
    //
    // A GAP IS SOME DAYS. A metric that appears on NO day is a different thing entirely: it is a
    // field nothing in `--demo` or any seeded development build ever renders, and the only symptom
    // is a row missing from a screen nobody thinks to question. Body fat, lean mass, VO2 max and
    // in-bed minutes were all in that state. A test now fails when any metric is absent from the
    // whole week, which is the same guard `scripts/health-fake.test.ts` puts on the phone's source.
    const healthDays: HealthDay[] = [];
    for (let back = 0; back < persona.days; back++) {
      const date = dateMinus(today, back);
      const seed = `${persona.key}:health:${date}`;
      const day = emptyHealthDay(date);

      // A scale is stepped on most mornings, not all of them.
      if (back % 3 !== 1) {
        day.weight_kg = round1((profile.weight_kg ?? 80) + (jitter(`${seed}:w`) - 1) * 4);
      }
      day.height_cm = profile.height_cm;
      // Body composition comes from a smart scale, so it lands on the days the scale did.
      if (back % 3 !== 1) {
        day.body_fat_pct = round1(21 + jitter(`${seed}:f`) * 8);
        day.lean_mass_kg = round1((profile.weight_kg ?? 80) * 0.72 + jitter(`${seed}:l`) * 2);
      }
      day.active_kcal = Math.round(220 + jitter(`${seed}:a`) * 420);
      day.resting_kcal = Math.round(1500 + jitter(`${seed}:r`) * 260);
      day.steps = Math.round(3_500 + jitter(`${seed}:s`) * 9_000);
      day.exercise_minutes = Math.round(jitter(`${seed}:e`) * 55);
      day.distance_km = round1(2 + jitter(`${seed}:d`) * 8);
      day.resting_hr_bpm = Math.round(52 + jitter(`${seed}:h`) * 10);
      day.hrv_ms = Math.round(32 + jitter(`${seed}:v`) * 45);
      // Re-estimated every week or so, not daily — which is exactly why the health screen must not
      // decide what to render from the newest day alone.
      if (back % 6 === 0) day.vo2max = round1(38 + jitter(`${seed}:o`) * 5);
      // A watch is not worn every night. In bed longer than asleep, which is what a night looks like.
      if (back % 4 !== 2) {
        const asleep = Math.round(330 + jitter(`${seed}:z`) * 150);
        day.asleep_minutes = asleep;
        day.in_bed_minutes = asleep + Math.round(10 + jitter(`${seed}:b`) * 30);
      }
      if (back % 5 === 0) day.workouts = 1;

      healthDays.push(day);
    }
    await store.putHealthDays(userId, healthDays);

    out.push({
      key: persona.key, deviceId, userId, summary: persona.summary, meals,
      healthDays: healthDays.length,
      admin: persona.admin === true,
    });
  }

  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
