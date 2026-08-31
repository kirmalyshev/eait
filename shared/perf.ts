// How fast every screen has to open, and how a run of measurements is judged.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THE BUDGETS LIVE IN `shared` AND NOT IN THE APP
//
// Two things need them: the phone, which records the samples, and `scripts/perf-report.ts`, which
// decides whether a run passed. A budget compiled into both is two numbers that must agree and
// eventually will not — the same reasoning that puts `EAIT__BACKEND__MAX_UPLOAD_MB` on the wire rather than in two
// constants. Here the file itself is the wire.
//
// WHAT THE TWO NUMBERS MEAN, AND WHY THERE ARE TWO
//
//   paintMs   first render → the frame that commits it. OUR OWN cost: component work, layout,
//             whatever the render path does synchronously. No network is in this number, so it is
//             never anyone else's fault. A screen that blows this dropped frames.
//   readyMs   first render → real content on screen, i.e. the spinner is gone and the thing the
//             user came for is there. Includes whatever the screen must fetch first.
//
// Reporting only `readyMs` hides a screen that blocks the JS thread for 300ms and then happens to
// have its data instantly. Reporting only `paintMs` calls a screen fast while the user looks at a
// spinner. Both, always.
//
// THE THRESHOLDS THESE ARE DERIVED FROM
//
//   ~16ms    one frame at 60Hz (8ms on the 120Hz devices in the supported range).
//   100ms    the limit under which a response reads as instantaneous and needs no feedback at all.
//   1000ms   the limit under which the user's train of thought survives. Past it they need a
//            progress indicator, and past it the screen is no longer "opening", it is "loading".
//
// So: 100ms of our own render for EVERY screen, no exceptions — that part is entirely in our hands.
// `readyMs` is set per screen against what that screen genuinely has to do first, and every value
// below states what it is paying for.
//
// THESE ARE DEV-ENVIRONMENT BUDGETS. They are calibrated for a simulator against a backend on
// localhost, which is what `scripts/perf.sh` runs. They are a regression gate on OUR code, not a
// prediction of a cold production instance over a mobile network — that is a different measurement
// with different numbers, and quoting these for it would be dishonest.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Every screen a user can be looking at, as they experience it.
 *
 * ONBOARDING IS ONE ENTRY NOW, and that is a statement about the app rather than a loosening of the
 * gate. It used to be eleven, because it used to be eleven routes' worth of screens in one route,
 * and each of them mounted, laid out and could be slow on its own. It is a conversation now: one
 * mount, one list that grows, and every later question is a row appended to a list that is already
 * on screen. Timing "the moment the pace question appears" would measure a `setState`, not a screen
 * opening — and a budget that cannot fail is worse than no budget, because it reads as coverage.
 *
 * This list is the definition of "every screen" that `scripts/perf.sh` validates against. Adding a
 * screen to the app without adding it here means the harness reports a complete run that never
 * looked at it, so the list and `SCREEN_BUDGETS` are checked against each other by a test.
 */
export const PERF_SCREENS = [
  // Cold launch: process start → the first screen a user can act on.
  "boot",
  "signin",
  "onboarding",
  "today",
  "chat",
  "settings",
  "camera",
  "meal",
  "health",
] as const;

export type PerfScreen = (typeof PERF_SCREENS)[number];

const SCREEN_SET: ReadonlySet<string> = new Set(PERF_SCREENS);

export function isPerfScreen(s: string): s is PerfScreen {
  return SCREEN_SET.has(s);
}

export interface ScreenBudget {
  /** First render → committed paint. Our own render cost, with no network in it. */
  paintMs: number;
  /** First render → the content the user came for. Includes what the screen must fetch. */
  readyMs: number;
}

/**
 * The budget per screen, and what each one is paying for.
 *
 * `readyMs === paintMs` is the strongest statement available here: it says the screen has NOTHING
 * to wait for and must be complete on its first frame. Most screens are in that category and the
 * ones that are not have a reason written next to them.
 */
export const SCREEN_BUDGETS: Record<PerfScreen, ScreenBudget> = {
  // The one unavoidably expensive moment: two Keychain reads, a token exchange on a fresh install,
  // and the profile fetch every screen is written to assume. Under a second, because past that the
  // launch stops reading as a launch and starts reading as a hang.
  boot: { paintMs: 100, readyMs: 900 },

  // Static copy and two buttons. Nothing is fetched, so there is nothing to be slow.
  signin: { paintMs: 100, readyMs: 100 },

  // The conversation. It opens on the COMPILED-IN copy and upgrades in place when the server's
  // arrives, so it is never waiting on a request — that is a design rule in `onboarding.tsx` and
  // `readyMs === paintMs` is what enforces it. A miss here means somebody made the first bubble
  // wait for `GET /v1/onboarding`, which turns the first impression of the app into a spinner.
  //
  // It is also the ONE budget that covers the plan. The calc card and the plan card are messages in
  // this same list, drawn from `profile.basis` and `profile.targets`, which the patch that finished
  // onboarding already returned — nothing is fetched to reveal them, and a reveal over content
  // that is already there is an animation, not a wait.
  onboarding: { paintMs: 100, readyMs: 100 },

  // Apple Health. Seeded from the trend cache, so a second visit is instant; the allowance above
  // paintMs is for the cold case — two reads, the stored health rows and the diary's per-day
  // totals, each up to five years of small rows — and for nothing else. The permission sheet and
  // the sample read both happen AFTER the first frame, deliberately: this screen must draw its
  // copy and its connect button without waiting on a native module. The paint number is the one
  // to watch here: the screen draws six SVG charts on its first frame once it has data, and
  // `bucketSeries` runs over every stored day for each of them.
  //
  // WHAT THIS NUMBER DOES NOT COVER: the harness runs with EXPO_PUBLIC_EAIT__FRONTEND__HEALTH_FAKE=1, because the
  // simulator has HealthKit and no Health app and a real read there is empty forever. The fake
  // source skips `loadHealthKit()`, so the one cost this budget never measures is importing the
  // native module on a real device. It is a bundled import rather than a network one, so it should
  // resolve in a microtask — but "should" is not "measured", and it is stated here rather than
  // quietly assumed.
  health: { paintMs: 100, readyMs: 250 },

  // The diary. Seeded from the day cache, which boot warms, so the common case is instant. The
  // allowance above `paintMs` is for the cold case — cache empty, one database read — and nothing
  // more. It is deliberately not generous: this screen opened on a spinner on every launch until
  // the cache existed, and the budget is what stops that coming back.
  today: { paintMs: 100, readyMs: 250 },

  // The thread, seeded from the cache's last page. The allowance is for the cold case: first open
  // of the session, nothing cached, one page fetched. Same shape and number as the diary.
  chat: { paintMs: 100, readyMs: 250 },

  // Renders the profile that is already in the session.
  settings: { paintMs: 100, readyMs: 100 },

  // A native capture session has to start. That is not JavaScript and not something a budget can
  // argue with, so the allowance is real and stated rather than hidden.
  camera: { paintMs: 100, readyMs: 700 },

  // One meal, seeded from the cache the diary already filled. The allowance is for the cold case:
  // opened from a chat bubble or a deep link, where there is nothing cached and it fetches.
  meal: { paintMs: 100, readyMs: 250 },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT THESE BUDGETS DO NOT CATCH, STATED SO NOBODY READS MORE INTO A GREEN RUN THAN IS THERE
//
// They are measured against a backend on LOCALHOST, where a round trip costs a few milliseconds.
// So they cannot tell "painted from the cache" apart from "made one request and got an answer
// immediately" — remove the day cache tomorrow and `today` would go from ~4ms to perhaps ~30ms and
// still pass. The cache's value is on a real network, and that is not what this harness measures.
//
// What they DO catch, reliably, is a screen that WAITS: a spinner in front of a model call, a
// synchronous filesystem write on the render path (which cost this app real taps once — see
// `onboarding/tracker.ts`), a blocked JS thread, an animation the screen sits behind. That is the
// regression class this exists for, and it is the one that ships.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** One screen opening, once. */
export interface ScreenSample {
  screen: PerfScreen;
  paintMs: number;
  readyMs: number;
  /** ISO timestamp, for reading a run back in order. */
  at: string;
}

export type ScreenVerdict = "ok" | "slow";

export interface ScreenResult {
  screen: PerfScreen;
  budget: ScreenBudget;
  /** How many times this screen was opened during the run. */
  samples: number;
  medianPaintMs: number;
  medianReadyMs: number;
  worstPaintMs: number;
  worstReadyMs: number;
  verdict: ScreenVerdict;
  /** Which number broke, and by how much. Absent when the verdict is `ok`. */
  breach?: string;
}

export interface PerfSummary {
  results: ScreenResult[];
  /** Screens that produced no sample at all. See `verdict`. */
  missing: PerfScreen[];
  /**
   * `incomplete` outranks `slow`, because it is the worse answer.
   *
   * A run that never opened a screen has not measured it, and a report that says "ok" about a
   * screen it never saw is worse than one that says "slow" about a screen it did. The screen the
   * harness quietly skipped is exactly the one nobody is watching.
   */
  verdict: "ok" | "slow" | "incomplete";
}

/**
 * The middle sample — always one that was actually measured, never an average of two.
 *
 * The UPPER median on an even count, and that choice has a consequence worth stating rather than
 * discovering: with two samples it returns the worse of the two. So a screen visited twice in a run
 * is judged on its slower visit. That is deliberate — with two measurements there is no basis for
 * calling either one an outlier, and a rule that discarded the bad one would make a two-sample
 * budget unable to fail. The tolerance below only exists from three samples up.
 */
function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Judge a run.
 *
 * The budget is applied to the MEDIAN and the worst is reported beside it. From three samples up
 * that means one janky reading on a loaded machine does not fail a gate — a simulator sharing a
 * laptop with a Metro bundler and a Postgres will produce one — while a screen that is slow every
 * time does. Printing the worst next to the median is what stops that tolerance from becoming a
 * place for a real spike to hide.
 */
/**
 * The screens a walk is expected to reach, which is now all of them.
 *
 * It used to filter: an onboarding question the admin had switched off was one no walk could open,
 * and reporting it `incomplete` would have failed every run over a question nobody is asked. With
 * onboarding a single conversation there is nothing left to switch off, so every entry is reachable
 * and a missing sample is a real gap in the run.
 */
export function walkableScreens(): readonly PerfScreen[] {
  return PERF_SCREENS;
}

export function summarize(samples: readonly ScreenSample[]): PerfSummary {
  const byScreen = new Map<PerfScreen, ScreenSample[]>();
  for (const s of samples) {
    // A sample naming a screen this build does not know is dropped rather than thrown on. The
    // report script and the binary that produced the file are versioned separately — the same
    // both-directions drift `usableContent` handles for onboarding copy.
    if (!isPerfScreen(s.screen)) continue;
    const list = byScreen.get(s.screen);
    if (list) list.push(s);
    else byScreen.set(s.screen, [s]);
  }

  const results: ScreenResult[] = [];
  const missing: PerfScreen[] = [];

  // Iterating the DECLARED order rather than the map's insertion order, so a report reads the same
  // way every run regardless of the path the flow happened to take through the app.
  for (const screen of walkableScreens()) {
    const list = byScreen.get(screen);
    if (!list || list.length === 0) {
      missing.push(screen);
      continue;
    }

    const budget = SCREEN_BUDGETS[screen];
    const paints = list.map((s) => s.paintMs).sort((a, b) => a - b);
    const readies = list.map((s) => s.readyMs).sort((a, b) => a - b);
    const medianPaintMs = median(paints);
    const medianReadyMs = median(readies);

    // Both are checked, and both are named when both broke. A screen reported only as "slow to be
    // ready" when its render is also over budget sends the next person to look at the network.
    const broke: string[] = [];
    if (medianPaintMs > budget.paintMs) {
      broke.push(`paint ${medianPaintMs}ms over ${budget.paintMs}ms`);
    }
    if (medianReadyMs > budget.readyMs) {
      broke.push(`ready ${medianReadyMs}ms over ${budget.readyMs}ms`);
    }

    results.push({
      screen,
      budget,
      samples: list.length,
      medianPaintMs,
      medianReadyMs,
      worstPaintMs: paints[paints.length - 1] ?? 0,
      worstReadyMs: readies[readies.length - 1] ?? 0,
      verdict: broke.length === 0 ? "ok" : "slow",
      ...(broke.length > 0 ? { breach: broke.join("; ") } : {}),
    });
  }

  return {
    results,
    missing,
    verdict: missing.length > 0
      ? "incomplete"
      : results.some((r) => r.verdict === "slow") ? "slow" : "ok",
  };
}
