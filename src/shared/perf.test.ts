import { describe, expect, test } from "bun:test";
import {
  PERF_SCREENS, walkableScreens, SCREEN_BUDGETS, isPerfScreen, summarize, type ScreenSample,
} from "./perf.ts";

const sample = (screen: string, paintMs: number, readyMs: number): ScreenSample => ({
  screen: screen as ScreenSample["screen"],
  paintMs,
  readyMs,
  at: "2026-08-02T00:00:00.000Z",
});

/** A run that visits every screen well inside budget. The baseline the other cases perturb. */
function allFast(): ScreenSample[] {
  return PERF_SCREENS.map((s) => sample(s, 1, 1));
}

describe("budgets", () => {
  test("every screen has one", () => {
    for (const s of PERF_SCREENS) {
      expect(SCREEN_BUDGETS[s]).toBeDefined();
      expect(SCREEN_BUDGETS[s].paintMs).toBeGreaterThan(0);
    }
  });

  test("ready is never tighter than paint — a screen cannot be usable before it is drawn", () => {
    for (const s of PERF_SCREENS) {
      expect(SCREEN_BUDGETS[s].readyMs).toBeGreaterThanOrEqual(SCREEN_BUDGETS[s].paintMs);
    }
  });

  test("no screen is allowed more than 100ms of our own render", () => {
    // The instantaneous-response threshold. A screen whose own render costs more than this is slow
    // because of code we wrote, which is the one cause always in our hands.
    for (const s of PERF_SCREENS) {
      expect(SCREEN_BUDGETS[s].paintMs).toBeLessThanOrEqual(100);
    }
  });

  test("onboarding is measured, once", () => {
    // Onboarding is one conversation on one route, so it is one entry. It used to be eleven, back
    // when it was eleven mounts. See the note on `PERF_SCREENS`: a per-question budget over a list
    // that is already on screen would be timing a `setState`, and a budget that cannot fail reads
    // as coverage without being any.
    expect(PERF_SCREENS).toContain("onboarding");
    expect(PERF_SCREENS.filter((s) => s.startsWith("onboarding"))).toEqual(["onboarding"]);
  });
});

describe("isPerfScreen", () => {
  test("accepts a known screen and rejects anything else", () => {
    expect(isPerfScreen("today")).toBe(true);
    expect(isPerfScreen("onboarding")).toBe(true);
    // The eleven `onboarding:*` ids a build from before the chat flow reported. Dropped rather than
    // thrown on — the report script and the binary that produced the file are versioned separately.
    expect(isPerfScreen("onboarding:summary")).toBe(false);
    expect(isPerfScreen("nope")).toBe(false);
    expect(isPerfScreen("")).toBe(false);
  });
});

describe("summarize", () => {
  test("a full, fast run passes", () => {
    const r = summarize(allFast());
    expect(r.verdict).toBe("ok");
    expect(r.missing).toEqual([]);
    expect(r.results).toHaveLength(walkableScreens().length);
  });

  test("a screen nobody opened is a hole in the run, not a pass", () => {
    // The whole point of the harness. A report that silently omits an unvisited screen reads as
    // green, and the screen it did not measure is exactly the one nobody is watching.
    const r = summarize(allFast().filter((s) => s.screen !== "camera"));
    expect(r.missing).toEqual(["camera"]);
    expect(r.verdict).toBe("incomplete");
    expect(r.results.find((x) => x.screen === "camera")).toBeUndefined();
  });

  test("an empty run is incomplete, not ok", () => {
    const r = summarize([]);
    expect(r.verdict).toBe("incomplete");
    expect(r.missing).toEqual([...walkableScreens()]);
  });

  test("a screen over its ready budget fails, and says which number broke", () => {
    const over = SCREEN_BUDGETS.today.readyMs + 1;
    const r = summarize(allFast().map((s) => (s.screen === "today" ? sample("today", 1, over) : s)));
    expect(r.verdict).toBe("slow");
    const today = r.results.find((x) => x.screen === "today");
    expect(today?.verdict).toBe("slow");
    expect(today?.breach).toContain("ready");
  });

  test("a screen over its paint budget fails even when it ends up ready in time", () => {
    // Paint and ready are different failures. A screen that blocks the JS thread for 300ms and then
    // has its data instantly is a screen that dropped 20 frames, and `readyMs` alone would call it
    // fast. Reported separately for that reason.
    const overPaint = SCREEN_BUDGETS.chat.paintMs + 50;
    const r = summarize(
      allFast().map((s) => (s.screen === "chat" ? sample("chat", overPaint, overPaint) : s)),
    );
    const chat = r.results.find((x) => x.screen === "chat");
    expect(chat?.verdict).toBe("slow");
    expect(chat?.breach).toContain("paint");
  });

  test("the median decides, the worst is still reported", () => {
    // One janky sample on a loaded machine must not fail a gate; a consistently slow screen must.
    // So the budget is applied to the median and the worst is printed next to it.
    const slow = SCREEN_BUDGETS.today.readyMs + 500;
    const r = summarize([
      ...allFast(),
      sample("today", 1, 1),
      sample("today", 1, slow),
    ]);
    const today = r.results.find((x) => x.screen === "today");
    expect(today?.verdict).toBe("ok");
    expect(today?.worstReadyMs).toBe(slow);
    expect(today?.medianReadyMs).toBe(1);
    expect(r.verdict).toBe("ok");
  });

  test("with exactly two samples the slower one decides", () => {
    // The upper median. Pinned because it is the case the perf flow actually produces for `today`,
    // which it visits twice, and because the alternative — discarding the worse of two — would make
    // a two-sample budget incapable of failing.
    const slow = SCREEN_BUDGETS.today.readyMs + 100;
    const r = summarize([...allFast(), sample("today", 1, slow)]);
    const today = r.results.find((x) => x.screen === "today");
    expect(today?.samples).toBe(2);
    expect(today?.medianReadyMs).toBe(slow);
    expect(today?.verdict).toBe("slow");
  });

  test("samples for a screen that is not in the list are ignored rather than crashing", () => {
    // A shipped binary outlives the report script that reads its output, exactly like onboarding
    // content. A screen name this build does not know is dropped, not thrown on.
    const r = summarize([...allFast(), sample("some-future-screen", 1, 1)]);
    expect(r.verdict).toBe("ok");
    expect(r.results.map((x) => x.screen)).not.toContain("some-future-screen");
  });

  test("counts the samples it used", () => {
    const r = summarize([...allFast(), sample("today", 2, 2)]);
    expect(r.results.find((x) => x.screen === "today")?.samples).toBe(2);
  });

  test("results come back in the declared screen order, not in arrival order", () => {
    const shuffled = [...allFast()].reverse();
    expect(summarize(shuffled).results.map((r) => r.screen)).toEqual([...walkableScreens()]);
  });
});

describe("what the walk is expected to reach", () => {
  test("is every screen, now that nothing can be switched off", () => {
    // It used to be every screen but one: `country` shipped disabled, so no walk could open it and
    // grading it would have reported `incomplete` on every run over a question nobody is asked.
    // With onboarding a single conversation there is no per-question entry left to disable, so a
    // missing sample is a real gap rather than a configuration.
    expect([...walkableScreens()]).toEqual([...PERF_SCREENS]);
  });
});
