// Milestones (ieat-app#1395): Cal AI's 36 badges, computed on the server.
//
// The ids are the medal image keys of the boards (`img/medals/{id}.webp`), in Cal AI's order; names
// and criteria are theirs word for word. `evaluate` is pure: the engine gathers the rows, this
// decides. A day under the calorie floor never counts toward a meal-derived criterion, so a badge
// cannot be earned by eating below the floor `targets.ts` refuses to go under.

import { dateMinus, weekStart } from "./dates.ts";

export interface Badge {
  id: string;
  name: string;
  rule: string;
}

const b = (id: string, name: string, rule: string): Badge => ({ id, name, rule });

export const BADGES: readonly Badge[] = [
  b("01-rookie", "Rookie", "3 day streak"),
  b("02-getting-serious", "Getting Serious", "10 day streak"),
  b("03-locked-in", "Locked In", "50 day streak"),
  b("04-triple-threat", "Triple Threat", "100 day streak"),
  b("05-no-days-off", "No Days Off", "365 day streak"),
  b("06-immortal", "Immortal", "1000 day streak"),
  b("07-forking-around", "Forking Around", "Logged 5 meals"),
  b("08-mission-nutrition", "Mission: Nutrition", "Logged 50 meals"),
  b("09-the-logfather", "The Logfather", "Logged 500 meals"),
  b("10-one-hit-wonder", "One Hit Wonder", "Hit daily calorie goal once"),
  b("11-loyalty-iii", "Loyalty III", "Hit calorie goal 7 days straight"),
  b("12-bullseye", "Bullseye", "Hit calorie goal 30 days straight"),
  b("13-helping-hand", "Helping Hand", "Invited 1 friend"),
  b("14-peer-pressurer", "Peer Pressurer", "Invited 3 friends"),
  b("15-cult-leader", "Cult Leader", "Invited 10 friends"),
  b("16-hydrated", "Hydrated", "Log water intake once"),
  b("17-sippin", "Sippin'", "Log water 3 days in a row"),
  b("18-aquaholic", "Aquaholic", "Log water 10 days in a row"),
  b("19-clean-sweep", "Clean Sweep", "Log 3 meals in a day"),
  b("20-sweat-equity", "Sweat Equity", "Log 5 workouts"),
  b("21-speed-logger", "Speed logger", "Save 10 meals"),
  b("22-green-machine", "Green Machine", "Eat leafy greens 5 days in a week"),
  b("23-nut-case", "Nut Case", "Eat nuts 4 days in a week"),
  b("24-berry-suspicious", "Berry Suspicious", "Eat berries 3 days in a week"),
  b("25-first-drop", "First Drop", "Lose 1 kilogram"),
  b("26-bye-bye-burrito", "Bye Bye Burrito", "Lose 5 kilograms"),
  b("27-scale-tipper", "Scale Tipper", "Lose 10 kilograms"),
  b("28-heavy-exit", "Heavy Exit", "Lose 25 kilograms"),
  b("29-who-dis", "Who Dis?", "Lose 50 kilograms"),
  b("30-final-form", "Final Form", "Lose 100 kilograms"),
  b("31-time-traveler", "Time Traveler", "Log something on an old day"),
  b("32-gremlin", "Gremlin", "Log something after midnight"),
  b("33-health-nut", "Health Nut", "Getting a 10 health score in a day"),
  b("34-dumpster-diver", "Dumpster Diver", "Get a 1 health score in a day"),
  b("35-doppelganger", "Doppelgänger", "Log an identical day of food from the day prior"),
  b("36-the-omega-log", "The Omega Log", "Log every possible feature (meals, workouts, water, weight) in one day"),
];

export const BADGE_IDS: ReadonlySet<string> = new Set(BADGES.map((x) => x.id));

/** One logged meal, reduced to what a criterion reads. `createdDate`/`createdHour` are the instant it was LOGGED, in the account's zone. */
export interface MilestoneMeal {
  date: string;
  createdDate: string;
  createdHour: number;
  kcal: number;
  nameEn: string[];
  healthScore: number | null;
}

export interface MilestoneInputs {
  today: string;
  floorKcal: number;
  targetKcal: number;
  /** The longest forgiving streak (#574) — computed by the caller, never re-derived here. */
  streakLongest: number;
  meals: readonly MilestoneMeal[];
  /** The merged weigh-in log, any order. */
  weights: readonly { date: string; kg: number }[];
  /** Imported workout counts per date. */
  workouts: readonly { date: string; count: number }[];
  /** `dayHealthScore` per date, computed by the caller from the day's scored meals. */
  dayScores: ReadonlyMap<string, number | null>;
}

// ponytail: substring heuristic over name_en; a real food taxonomy replaces these when the catalog grows categories.
const LEAFY = ["spinach", "kale", "lettuce", "arugula", "rocket", "chard", "collard", "romaine", "watercress", "salad", "cabbage", "bok choy"];
const NUTS = ["almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "peanut", "macadamia", "pine nut", "nuts"];
const BERRIES = ["strawberr", "blueberr", "raspberr", "blackberr", "cranberr", "gooseberr", "berry", "berries"];

const STREAKS: readonly [string, number][] = [
  ["01-rookie", 3], ["02-getting-serious", 10], ["03-locked-in", 50],
  ["04-triple-threat", 100], ["05-no-days-off", 365], ["06-immortal", 1000],
];
const MEAL_COUNTS: readonly [string, number][] = [["07-forking-around", 5], ["08-mission-nutrition", 50], ["09-the-logfather", 500]];
const LOSSES: readonly [string, number][] = [
  ["25-first-drop", 1], ["26-bye-bye-burrito", 5], ["27-scale-tipper", 10],
  ["28-heavy-exit", 25], ["29-who-dis", 50], ["30-final-form", 100],
];

/** The longest run of consecutive calendar dates in `days`. */
function longestRun(days: ReadonlySet<string>): number {
  let best = 0;
  for (const d of days) {
    if (days.has(dateMinus(d, 1))) continue;
    let n = 0;
    for (let x = d; days.has(x); x = dateMinus(x, -1)) n++;
    best = Math.max(best, n);
  }
  return best;
}

/** Badge ids the inputs earn, in wall order. Pure: no clock, no zone, no store. */
export function evaluate(i: MilestoneInputs): string[] {
  const kcalByDate = new Map<string, number>();
  const mealsByDate = new Map<string, MilestoneMeal[]>();
  for (const m of i.meals) {
    kcalByDate.set(m.date, (kcalByDate.get(m.date) ?? 0) + m.kcal);
    const day = mealsByDate.get(m.date) ?? [];
    day.push(m);
    mealsByDate.set(m.date, day);
  }
  // A day under the floor is not a day: its meals count toward nothing.
  const days = new Set([...kcalByDate].filter(([, kcal]) => kcal >= i.floorKcal).map(([d]) => d));
  const counted = i.meals.filter((m) => days.has(m.date));
  const earned = new Set<string>();

  for (const [id, n] of STREAKS) if (i.streakLongest >= n) earned.add(id);
  for (const [id, n] of MEAL_COUNTS) if (counted.length >= n) earned.add(id);

  const onGoal = new Set([...days].filter((d) => (kcalByDate.get(d) ?? 0) <= i.targetKcal));
  if (onGoal.size >= 1) earned.add("10-one-hit-wonder");
  const goalRun = longestRun(onGoal);
  if (goalRun >= 7) earned.add("11-loyalty-iii");
  if (goalRun >= 30) earned.add("12-bullseye");

  if ([...days].some((d) => (mealsByDate.get(d)?.length ?? 0) >= 3)) earned.add("19-clean-sweep");
  if (i.workouts.reduce((s, w) => s + w.count, 0) >= 5) earned.add("20-sweat-equity");

  for (const [id, words, need] of [["22-green-machine", LEAFY, 5], ["23-nut-case", NUTS, 4], ["24-berry-suspicious", BERRIES, 3]] as const) {
    const perWeek = new Map<string, Set<string>>();
    for (const m of counted) {
      if (!m.nameEn.some((n) => words.some((w) => n.toLowerCase().includes(w)))) continue;
      const wk = weekStart(m.date);
      perWeek.set(wk, (perWeek.get(wk) ?? new Set()).add(m.date));
    }
    if ([...perWeek.values()].some((s) => s.size >= need)) earned.add(id);
  }

  const kg = [...i.weights].sort((a, c) => a.date.localeCompare(c.date));
  if (kg.length > 1) {
    const lost = kg[0]!.kg - Math.min(...kg.slice(1).map((w) => w.kg));
    for (const [id, n] of LOSSES) if (lost >= n) earned.add(id);
  }

  if (counted.some((m) => m.date < m.createdDate)) earned.add("31-time-traveler");
  if (counted.some((m) => m.createdHour < 4)) earned.add("32-gremlin");

  for (const d of days) {
    if (d >= i.today) continue; // a closed day only: an open one can still move
    const s = i.dayScores.get(d);
    if (s === 10) earned.add("33-health-nut");
    if (s === 1) earned.add("34-dumpster-diver");
  }

  const names = (d: string) => new Set((mealsByDate.get(d) ?? []).flatMap((m) => m.nameEn.map((n) => n.toLowerCase())));
  for (const d of days) {
    if (!days.has(dateMinus(d, 1))) continue;
    const a = names(d);
    const p = names(dateMinus(d, 1));
    if (a.size >= 2 && a.size === p.size && [...a].every((n) => p.has(n))) earned.add("35-doppelganger");
  }

  const weighed = new Set(kg.map((w) => w.date));
  const trained = new Set(i.workouts.filter((w) => w.count > 0).map((w) => w.date));
  if ([...days].some((d) => weighed.has(d) && trained.has(d))) earned.add("36-the-omega-log");

  return BADGES.map((x) => x.id).filter((id) => earned.has(id));
}
