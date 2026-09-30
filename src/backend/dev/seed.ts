// The accounts a freshly-created development database opens with.
//
// WHY THIS EXISTS. Every worktree gets its own database (see `src/scripts/dev-env.ts`), and a database
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
  explainTargets, healthScore, verdictsFromTargets, visibleVerdicts,
  type Lang, type MealItem, type MealRecord,
} from "@eait/shared";
import {
  localDate, dateMinus, emptyHealthDay, firstVerdictLines, zonedMidnight, FIXTURE_THREAD,
  type HealthDay,
} from "@eait/shared";
import type { ChatAppend, ProfilePatch, Store } from "../store.ts";
import { join } from "node:path";
import { readFileSync } from "node:fs";

/**
 * A device id that is stable across runs, unguessable, and recognisable in a `psql` session.
 *
 * The `5eed` prefix is there so a row in `users.device_id` can be identified as a fixture at a
 * glance. The rest is a hash rather than the persona name because this string IS the account
 * credential — `POST /v1/auth/device` asks for nothing else — and a guessable one would be an
 * account anybody who reads this file can log into on any host that ever ran the seeder.
 */
/**
 * The persona's meal photographs — real, licensed images (#84, #1060), because the boards these
 * fixtures reproduce show real ones, and because a fixture that does not look like food is one
 * the real analyzer answers "not food" for.
 *
 * Files on disk rather than inline base64: 20 KB of webp is a picture, not a constant, and the
 * licences ride beside them in `img/LICENSES.md` — the same rows `product/design/pro/img`
 * carries, which is where the squares were cropped from. One key per file in `img/`: the set is
 * the landing's licensed pool, so the screenshot capture picks from it too. Loaded lazily so the
 * module stays cheap to import (the test and the seeder are its only callers).
 */
const BOARD_PHOTO_FILES = {
  grainbowl: "grainbowl-sq.webp",
  pesto: "pesto-sq.webp",
  porridge: "porridge-sq.webp",
  salmon: "salmon-sq.webp",
  flatwhite: "flatwhite-sq.webp",
  waffle: "waffle-sq.webp",
  shortcake: "shortcake-sq.webp",
  cake: "cake-sq.webp",
} as const;
type BoardPhoto = keyof typeof BOARD_PHOTO_FILES;

const boardPhoto = (key: BoardPhoto): Uint8Array =>
  new Uint8Array(readFileSync(join(import.meta.dir, "img", BOARD_PHOTO_FILES[key])));

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
  /**
   * The authored board (#84) — the persona whose every number IS the Register P design.
   *
   * When set, `days` is ignored for meals: the days below are written exactly as authored, so a
   * seeded screenshot equals its board number for number. All `back` values are days before the
   * seeded today, so the fixture reproduces the boards at whatever date it runs.
   */
  board?: SeedBoard;
}

/** One authored meal on the board — the card, in numbers. */
export interface SeedMeal {
  name: string;
  name_en?: string;
  /** `HH:MM` in the seeded zone — the card's clock time. */
  at: string;
  /** "photo" puts a photo line in the thread and a picture on the card; "typed" puts the words. */
  via: "photo" | "typed";
  /** Which licensed image backs the card — every seeded meal carries a real photograph. */
  photo: BoardPhoto;
  items: readonly MealItem[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  satfat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  confidence: "high" | "medium" | "low";
}

export interface SeedBoard {
  /** `back` days before today → that day's meals, in card order. */
  days: readonly { back: number; meals: readonly SeedMeal[] }[];
  /** The typed weigh-ins — the manual half of the log, as the `weights` table holds them. */
  manualWeights: readonly { back: number; kg: number }[];
  /**
   * The scale's own readings — the imported half, written as `health_days.weight_kg`. On a day
   * with both, the typed row wins the merged read, the tie the goal bar's start needs.
   */
  healthWeights: readonly { back: number; kg: number }[];
  /** How far back the full health rows reach; older weigh-in days carry their weight alone. */
  healthSpan: number;
  /** How far back the account onboarded — the day the plan and its start weight were set. */
  onboardedBack: number;
}

/**
 * Anna's week, as the boards draw it (#84).
 *
 * Every number below is a number on a board: the four logged days are Mon–Thu of "the week of
 * Thu 24 Sep 2026" (the Progress bars and the 4-day streak), today's three cards are the Today
 * screen's own rows, and the weigh-ins draw the Progress line — 74.6 on the pre-onboarding
 * backfill through to Health's 73.4 today. Written relative to the seeded today, so the fixture
 * reproduces the boards whatever day it runs.
 */
const ANNA_BOARD: SeedBoard = {
  onboardedBack: 21, // 3 Sep on the boards — the day she typed 74 kg and the plan was set.
  healthSpan: 7,
  manualWeights: [
    { back: 21, kg: 74.0 }, // the onboarding answer — the goal bar's start, beating the scale's own
  ],
  healthWeights: [
    { back: 31, kg: 74.6 }, // the backfill — logged before the account existed; never the start
    { back: 21, kg: 74.2 }, // the scale's reading on the onboarding morning; her typed 74.0 wins
    { back: 14, kg: 73.9 },
    { back: 4, kg: 73.8 },
    { back: 0, kg: 73.4 },  // today 18:30 — the newest weigh-in, so the projection's current
  ],
  days: [
    {
      // Monday — 1,386 for the day.
      back: 3,
      meals: [
        {
          name: "Avocado toast with eggs", name_en: "avocado toast", at: "08:10", via: "photo",
          photo: "waffle",
          kcal: 430, protein_g: 16, carbs_g: 32, fat_g: 24, satfat_g: 5, fiber_g: 7, sugar_g: 3,
          sodium_mg: 540, confidence: "high",
          items: [
            { name: "Avocado toast", name_en: "avocado toast", grams: 150, kcal: 290, protein_g: 6, carbs_g: 30, fat_g: 16 },
            { name: "Boiled egg", name_en: "egg", grams: 50, kcal: 140, protein_g: 10, carbs_g: 2, fat_g: 8 },
          ],
        },
        {
          name: "Chicken quinoa bowl", name_en: "chicken quinoa bowl", at: "13:15", via: "photo",
          photo: "grainbowl",
          kcal: 620, protein_g: 40, carbs_g: 52, fat_g: 24, satfat_g: 4, fiber_g: 9, sugar_g: 6,
          sodium_mg: 720, confidence: "high",
          items: [
            { name: "Grilled chicken", name_en: "chicken breast", grams: 140, kcal: 260, protein_g: 34, carbs_g: 0, fat_g: 12 },
            { name: "Quinoa, roasted vegetables", name_en: "quinoa bowl", grams: 220, kcal: 360, protein_g: 6, carbs_g: 52, fat_g: 12 },
          ],
        },
        {
          name: "Tomato pasta, side salad", name_en: "pasta", at: "19:40", via: "photo",
          photo: "pesto",
          kcal: 336, protein_g: 11, carbs_g: 44, fat_g: 12, satfat_g: 2.5, fiber_g: 6, sugar_g: 8,
          sodium_mg: 480, confidence: "high",
          items: [
            { name: "Tomato pasta", name_en: "pasta", grams: 240, kcal: 260, protein_g: 9, carbs_g: 42, fat_g: 6 },
            { name: "Side salad", name_en: "mixed salad", grams: 80, kcal: 76, protein_g: 2, carbs_g: 2, fat_g: 6 },
          ],
        },
      ],
    },
    {
      // Tuesday — 1,429 for the day.
      back: 2,
      meals: [
        {
          name: "Skyr with granola", name_en: "skyr bowl", at: "07:50", via: "photo",
          photo: "porridge",
          kcal: 400, protein_g: 22, carbs_g: 46, fat_g: 13, satfat_g: 5, fiber_g: 5, sugar_g: 22,
          sodium_mg: 180, confidence: "high",
          items: [
            { name: "Skyr with granola", name_en: "skyr bowl", grams: 260, kcal: 400, protein_g: 22, carbs_g: 46, fat_g: 13 },
          ],
        },
        {
          name: "Sushi set", name_en: "sushi", at: "13:00", via: "photo",
          photo: "salmon",
          kcal: 610, protein_g: 28, carbs_g: 82, fat_g: 16, satfat_g: 3, fiber_g: 4, sugar_g: 9,
          sodium_mg: 1150, confidence: "high",
          items: [
            { name: "Sushi set", name_en: "sushi", grams: 320, kcal: 610, protein_g: 28, carbs_g: 82, fat_g: 16 },
          ],
        },
        {
          name: "Lentil soup and bread", name_en: "lentil soup", at: "19:20", via: "photo",
          photo: "porridge",
          kcal: 419, protein_g: 17, carbs_g: 56, fat_g: 14, satfat_g: 2, fiber_g: 11, sugar_g: 5,
          sodium_mg: 890, confidence: "high",
          items: [
            { name: "Lentil soup", name_en: "lentil soup", grams: 300, kcal: 300, protein_g: 15, carbs_g: 40, fat_g: 8 },
            { name: "Bread roll", name_en: "bread", grams: 60, kcal: 119, protein_g: 2, carbs_g: 16, fat_g: 6 },
          ],
        },
      ],
    },
    {
      // Wednesday — 1,308 for the day.
      back: 1,
      meals: [
        {
          name: "Scrambled eggs on rye", name_en: "scrambled eggs", at: "08:05", via: "photo",
          photo: "waffle",
          kcal: 360, protein_g: 21, carbs_g: 24, fat_g: 19, satfat_g: 6, fiber_g: 4, sugar_g: 2,
          sodium_mg: 430, confidence: "high",
          items: [
            { name: "Scrambled eggs", name_en: "eggs", grams: 110, kcal: 210, protein_g: 15, carbs_g: 1, fat_g: 15 },
            { name: "Rye toast", name_en: "rye bread", grams: 60, kcal: 150, protein_g: 6, carbs_g: 23, fat_g: 4 },
          ],
        },
        {
          name: "Burrito bowl", name_en: "burrito bowl", at: "13:10", via: "photo",
          photo: "grainbowl",
          kcal: 640, protein_g: 36, carbs_g: 68, fat_g: 22, satfat_g: 6, fiber_g: 12, sugar_g: 7,
          sodium_mg: 980, confidence: "high",
          items: [
            { name: "Burrito bowl", name_en: "burrito bowl", grams: 380, kcal: 640, protein_g: 36, carbs_g: 68, fat_g: 22 },
          ],
        },
        {
          name: "Greek salad with feta", name_en: "greek salad", at: "19:30", via: "photo",
          photo: "grainbowl",
          kcal: 308, protein_g: 13, carbs_g: 14, fat_g: 21, satfat_g: 8, fiber_g: 4, sugar_g: 9,
          sodium_mg: 640, confidence: "high",
          items: [
            { name: "Greek salad with feta", name_en: "greek salad", grams: 260, kcal: 308, protein_g: 13, carbs_g: 14, fat_g: 21 },
          ],
        },
      ],
    },
    {
      // Today — the Today board's own three cards: 1,066 of 1,434, 368 left.
      back: 0,
      meals: [
        {
          name: "Porridge with berries", name_en: "oat porridge", at: "07:40", via: "photo",
          photo: "porridge",
          kcal: 312, protein_g: 11, carbs_g: 52, fat_g: 7, satfat_g: 1.8, fiber_g: 7, sugar_g: 18,
          sodium_mg: 160, confidence: "high",
          items: [
            { name: "Porridge with berries", name_en: "oat porridge", grams: 300, kcal: 312, protein_g: 11, carbs_g: 52, fat_g: 7 },
          ],
        },
        {
          // "calories high · saturated fat high" on the board: 540 of a 1,434 plan is a `warn`
          // share, and 7.5 g of a 13 g LDL cap is a `bad` one — computed like every other meal.
          name: "Salmon, rice, greens", name_en: "salmon", at: "13:05", via: "photo",
          photo: "salmon",
          kcal: 540, protein_g: 34, carbs_g: 48, fat_g: 23, satfat_g: 7.5, fiber_g: 5, sugar_g: 3,
          sodium_mg: 620, confidence: "high",
          items: [
            { name: "Salmon fillet", name_en: "salmon", grams: 140, kcal: 290, protein_g: 26, carbs_g: 0, fat_g: 18 },
            { name: "White rice", name_en: "rice", grams: 150, kcal: 195, protein_g: 4, carbs_g: 42, fat_g: 1 },
            { name: "Broccoli", name_en: "broccoli", grams: 90, kcal: 55, protein_g: 4, carbs_g: 6, fat_g: 4 },
          ],
        },
        {
          // Typed, not photographed — the low-confidence read is `confidence: "low"` behind
          // `mealIsGuessed`, not a field the seed gets to invent.
          name: "Flat white and a banana", name_en: "flat white", at: "16:10", via: "typed",
          photo: "flatwhite",
          kcal: 214, protein_g: 9, carbs_g: 34, fat_g: 5, satfat_g: 3, fiber_g: 3, sugar_g: 26,
          sodium_mg: 120, confidence: "low",
          items: [
            { name: "Flat white", name_en: "flat white", grams: 240, kcal: 120, protein_g: 6, carbs_g: 10, fat_g: 4 },
            { name: "Banana", name_en: "banana", grams: 100, kcal: 94, protein_g: 3, carbs_g: 24, fat_g: 1 },
          ],
        },
      ],
    },
  ],
};

/**
 * The personas, in the order the seeder prints them. `anna` is first because she is the one
 * `dev-env` pins by default — the board persona, so the app opens on the screens the design
 * teams measure against. `onboarded` stays beside her, exactly as it has been: other tooling
 * seeds it by name (the monorepo's `scripts/eval-coach.ts` does `only: ["onboarded"]` and refuses
 * without it), and the generated week is still the fixture for an ordinary, unauthored account.
 */
export const SEED_PERSONAS: readonly SeedPersona[] = [
  {
    // THE BOARD PERSONA (#84). Anna is the account every Register P board was drawn against: the
    // week strip, the streak, the goal bar, the weigh-in log — the meals, weights and health rows
    // below are the boards' own numbers, so a screenshot of a seeded database can be compared with
    // `product/design/pro/phone/` literally, figure for figure.
    //
    // `weight_kg` stays 74 — the plan the boards show (1,434 kcal) is computed on the weight she
    // TYPED at onboarding. The 73.4 Health reports lives in the log, which is what the projection
    // and the chart read; a profile row that carried it would draw a different plan.
    key: "anna",
    summary: "Anna — the boards' persona: 74 → 68 kg, LDL declared, streak 4, Health's 73.4",
    days: 0,
    board: ANNA_BOARD,
    profile: {
      goal: "lose",
      sex: "female",
      birth_year: 1994,
      height_cm: 172,
      weight_kg: 74,
      target_weight_kg: 68,
      activity: "none",
      pace: "steady",
      country: "de",
      restrictions: ["ldl"],
      medical_limitations: null,
      food_allergies: null,
      product_limitations: null,
      // onboarded_at is computed per seed run — see `seedDevData`.
    },
  },
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
      activity: "some",
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
    // THE ONE ACCOUNT THAT IS NOT IN ENGLISH, and it exists because every localization defect in
    // #358 was found by reading a table rather than by looking at a screen. Without it, opening
    // the app in a translated language means editing a row by hand — so nobody does, and the
    // German that reads as machine output ships. Russian because it is the language whose script,
    // decimal comma, dative plural and gendered past tense break the most things at once.
    key: "russian",
    summary: "onboarded, 7 days of meals, renders in Russian — for looking at a translated app",
    days: 7,
    profile: {
      lang: "ru",
      goal: "lose",
      sex: "female",
      birth_year: 1992,
      height_cm: 168,
      weight_kg: 74,
      target_weight_kg: 68,
      activity: "some",
      pace: "steady",
      country: "de",
      restrictions: [],
    },
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
      activity: "some",
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
      activity: "none",
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
export const DEFAULT_SEED_PERSONA = "anna";

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
const SLOTS: readonly {
  name: string; hour: number; share: number; photo: BoardPhoto; plates: readonly Plate[];
}[] = [
  {
    name: "breakfast", hour: 8, share: 0.25, photo: "porridge",
    plates: [
      { name: "Porridge with berries", name_en: "oat porridge", share: 0.6 },
      { name: "Greek yoghurt", name_en: "greek yoghurt", share: 0.4 },
    ],
  },
  {
    name: "lunch", hour: 13, share: 0.4, photo: "grainbowl",
    plates: [
      { name: "Grilled chicken breast", name_en: "chicken breast", share: 0.45 },
      { name: "Brown rice", name_en: "brown rice", share: 0.35 },
      { name: "Mixed salad", name_en: "mixed salad", share: 0.2 },
    ],
  },
  {
    name: "dinner", hour: 19, share: 0.35, photo: "salmon",
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

/** The instant `HH:MM` shows on a wall clock in `zone` on `date` — the seeded card's own time. */
const atClock = (zone: string, date: string, hhmm: string): Date => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return new Date(zonedMidnight(zone, date).getTime() + (h * 60 + m) * 60_000);
};

export async function seedDevData(store: Store, opts: SeedOptions): Promise<SeededPersona[]> {
  const today = opts.today ?? localDate(opts.timezone);
  const wanted = opts.only && opts.only.length > 0
    ? SEED_PERSONAS.filter((p) => opts.only!.includes(p.key))
    : SEED_PERSONAS;

  const out: SeededPersona[] = [];
  for (const persona of wanted) {
    const deviceId = seedDeviceId(persona.key);
    // The persona's own, so the Russian one seeds a Russian account and its thread is written
    // in Russian by the same readers the app uses.
    const lang: Lang = persona.profile?.lang ?? "en";

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

    // The board persona's onboarding is dated relative to the seeded today — `onboarded_at` is
    // what the projection resolves "start" against, so a fixture seeded tomorrow must still put
    // her first weigh-in ON the onboarding day and her backfill before it.
    const onboardedAt = persona.board === undefined ? null
      : atClock(opts.timezone, dateMinus(today, persona.board.onboardedBack), "08:00").toISOString();
    const patch: ProfilePatch = persona.board
      ? { ...persona.profile, onboarded_at: onboardedAt, weight_measured_at: onboardedAt }
      : persona.profile;
    const profile = await store.patchProfile(userId, patch);
    const { targets } = explainTargets(profile);

    let meals = 0;
    const thread: { back: number; record: MealRecord; lines: ChatAppend[] }[] = [];

    if (persona.board) {
      for (const day of persona.board.days) {
        const date = dateMinus(today, day.back);
        for (const spec of day.meals) {
          const verdicts = visibleVerdicts(
            verdictsFromTargets(
              { kcal: spec.kcal, satfat_g: spec.satfat_g, sodium_mg: spec.sodium_mg },
              targets,
            ),
            profile.restrictions,
          );
          const record: MealRecord = {
            id: crypto.randomUUID(),
            user_id: userId,
            ts: atClock(opts.timezone, date, spec.at).toISOString(),
            date,
            isFood: true,
            items: spec.items.map((i) => ({ ...i })),
            kcal: spec.kcal, protein_g: spec.protein_g, carbs_g: spec.carbs_g, fat_g: spec.fat_g,
            satfat_g: spec.satfat_g, fiber_g: spec.fiber_g, sugar_g: spec.sugar_g,
            sodium_mg: spec.sodium_mg,
            verdicts,
            healthScore: healthScore({ ...spec, verdicts }, profile.restrictions),
            confidence: spec.confidence,
            notes: "Seeded",
            corrected: false,
            model: "seed",
          };
          await store.insertMeal(record);
          // A real, licensed photograph on every card — see `img/LICENSES.md`.
          await store.putPhotos(userId, record.id,
            [{ mime: "image/webp", bytes: boardPhoto(spec.photo) }]);
          // The thread line matches the door the meal came in by: the picture she sent, or the
          // words she typed.
          thread.push({ back: day.back, record, lines: [
            spec.via === "photo"
              ? { role: "user", kind: "photo", text: null, mealId: record.id }
              : { role: "user", kind: "text", text: spec.name },
            { role: "assistant", kind: "meal", mealId: record.id, event: "logged", speaker: "gabie" as const },
          ] });
          meals++;
        }
      }
      // The typed half of the weigh-in log — what a PATCH would have written, dated as authored.
      for (const w of persona.board.manualWeights) {
        await store.putWeight(userId, dateMinus(today, w.back), w.kg);
      }
    }

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
        const verdicts = visibleVerdicts(verdictsFromTargets(analysis, targets), profile.restrictions);
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
          verdicts,
          healthScore: healthScore(
            { kcal, protein_g, satfat_g, fiber_g, sugar_g, sodium_mg, verdicts }, profile.restrictions,
          ),
          confidence: "high",
          notes: `Seeded ${slot.name}`,
          corrected: false,
          model: "seed",
        };
        await store.insertMeal(record);
        // A PICTURE, because the fixture already claims there is one. The thread line written two
        // lines below is `kind: "photo"`, and every seeded meal has said so since the thread was
        // seeded at all — with no bytes behind it, so the Chat tab's photo bubble and (since #375)
        // the admin's diary both point at a 404. A fake may be poorer than the real thing and never
        // different in a way a test or a screen can see.
        await store.putPhotos(userId, record.id,
          [{ mime: "image/webp", bytes: boardPhoto(slot.photo) }]);
        // The thread is what the Chat tab opens on; a persona with a diary and no thread would open
        // Chat on its empty state, which is the one thing a fixture must not do. Collected here and
        // written after the loop, oldest day first — this loop runs newest-first, and seq is the
        // thread's order.
        thread.push({ back, record, lines: [
          { role: "user", kind: "photo", text: null, mealId: record.id },
          { role: "assistant", kind: "meal", mealId: record.id, event: "logged", speaker: "gabie" as const },
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
        meal: { kcal: oldest.record.kcal, satfat_g: oldest.record.satfat_g, sodium_mg: oldest.record.sodium_mg, confidence: oldest.record.confidence },
        eatenToday: { kcal: oldest.record.kcal, protein_g: oldest.record.protein_g, satfat_g: oldest.record.satfat_g, sodium_mg: oldest.record.sodium_mg },
      }, lang).map((text) => ({ role: "assistant", kind: "text", text, speaker: "gabie" } as const)));
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
    // The board persona's span is its own: the weigh-in line reaches further back than its week
    // of meals does, and her scale's readings are authored, not jittered — a random number on a
    // drawn chart is the board disagreeing with itself.
    const healthSpan = persona.board?.healthSpan ?? persona.days;
    const authoredWeight = new Map(
      (persona.board?.healthWeights ?? []).map((w) => [dateMinus(today, w.back), w.kg]),
    );
    for (let back = 0; back < healthSpan; back++) {
      const date = dateMinus(today, back);
      const seed = `${persona.key}:health:${date}`;
      const day = emptyHealthDay(date);

      // A scale is stepped on most mornings, not all of them — and on the board persona, only
      // on the days her weigh-in is authored for; every other day carries no weight at all.
      if (persona.board) {
        day.weight_kg = authoredWeight.get(date) ?? null;
      } else if (back % 3 !== 1) {
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
    // Weigh-ins older than the span: a sparse row carrying the weight and nothing else — a day
    // the scale synced and no watch was worn is exactly what a backfill looks like.
    if (persona.board) {
      for (const w of persona.board.healthWeights) {
        const date = dateMinus(today, w.back);
        if (w.back < healthSpan) continue;
        const day = emptyHealthDay(date);
        day.weight_kg = w.kg;
        healthDays.push(day);
      }
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
