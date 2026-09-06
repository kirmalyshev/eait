import { describe, expect, it } from "bun:test";
import type { ChatEntry } from "./contract.ts";
import type { ChatSpeaker } from "./results.ts";
import type { MealRecord } from "./types.ts";
import { fromHistory, landedLine, lastMealId, mergeThread, reconcilePage, unansweredFor, withUnanswered, type ThreadEntry } from "./thread.ts";

// The Chat screen's reconciliation of three sources of truth — the fetched page, what is on screen,
// and the turns still in flight. Pure, so every rule the design notes record as hard-won is pinned
// here instead of living only in a screen no runner executes.

const meal = (id: string, kcal: number, date = "2026-08-25"): MealRecord => ({
  id, user_id: "u", ts: "2026-08-25T12:00:00.000Z", date, isFood: true, items: [], kcal, protein_g: 0, carbs_g: 0, fat_g: 0,
  satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, verdicts: {}, confidence: "high", notes: "", corrected: false, model: null,
});
let seq = 0;
const base = () => ({ id: `s${++seq}`, seq, ts: "2026-08-25T12:00:00.000Z" });
const userLine = (text: string, o: { clientId?: string; pendingId?: string } = {}): ChatEntry =>
  ({ ...base(), role: "user", kind: "text", text, clientId: o.clientId ?? null, pendingId: o.pendingId ?? null });
const said = (text: string, speaker: ChatSpeaker | null = null): ChatEntry => ({ ...base(), role: "assistant", kind: "text", text, speaker });
const card = (m: MealRecord | null, mealId = m?.id ?? null): ChatEntry => ({ ...base(), role: "assistant", kind: "meal", event: "logged", mealId, meal: m });

describe("reconcilePage", () => {
  it("supersedes a 'not sent' bubble by exactly the landed line carrying its id, never by its words", () => {
    const failed: ThreadEntry = { id: "c1", role: "user", text: "hi", failed: true };
    const twin: ThreadEntry = { id: "c2", role: "user", text: "hi", failed: true };
    const inflight = new Set(["c1", "c2"]);
    const page = [userLine("hi", { clientId: "c1" }), said("hello")];
    const { next, superseded } = reconcilePage(page, [failed, twin], inflight, false);
    expect(next.map((e) => e.id)).toEqual([page[0]!.id, page[1]!.id, "c2"]);
    // Pure: the caller drains the set; the settled ids are named, the argument untouched.
    expect(superseded).toEqual(["c1"]);
    expect(inflight.has("c1")).toBe(true);
  });

  it("supersedes a bubble still in flight whose line landed on the page, without calling it unanswered", () => {
    // The server writes the words before it answers, so a page fetched mid-send carries the line
    // under its own id while the bubble is still waiting: one copy, the page's, and no notice —
    // the reply is still on its way.
    const waiting: ThreadEntry = { id: "c1", role: "user", text: "two eggs" };
    const page = [userLine("two eggs", { clientId: "c1", pendingId: "p1" })];
    const { next, superseded } = reconcilePage(page, [waiting], new Set(["c1"]), false);
    expect(next.map((e) => e.id)).toEqual([page[0]!.id]);
    expect(superseded).toEqual(["c1"]);
  });

  it("calls a landed proposal unanswered exactly when no card carries its id", () => {
    const failed: ThreadEntry = { id: "c1", role: "user", text: "two eggs", failed: true };
    const none = reconcilePage([userLine("two eggs", { clientId: "c1", pendingId: "p1" })], [failed], new Set(["c1"]), false);
    expect(none.next.at(-1)).toMatchObject({ id: "unanswered:c1", role: "error", refusal: "unanswered" });
    // Beside the line it answers — not after a later turn's proposal, where it would read as that turn's.
    const later: ThreadEntry = { id: "a2", role: "assistant", result: { kind: "proposed", pendingId: "p2", analysis: meal("p2", 1), date: "2026-08-25" } };
    const page = [userLine("two eggs", { clientId: "c1", pendingId: "p1" }), said("unrelated")];
    const placed = reconcilePage(page, [failed, later], new Set(["c1"]), false);
    expect(placed.next.map((e) => e.id)).toEqual([page[0]!.id, "unanswered:c1", page[1]!.id, "a2"]);
    // Two landed proposals with no card: each notice under its own line, whatever order they landed.
    const other: ThreadEntry = { id: "c2", role: "user", text: "a banana", failed: true };
    const two = [userLine("two eggs", { clientId: "c1", pendingId: "p1" }), said("ok"), userLine("a banana", { clientId: "c2", pendingId: "p2" })];
    const both = reconcilePage(two, [other, failed], new Set(["c1", "c2"]), false);
    expect(both.next.map((e) => e.id)).toEqual([two[0]!.id, "unanswered:c1", two[1]!.id, two[2]!.id, "unanswered:c2"]);
    const logged = reconcilePage([userLine("two eggs", { clientId: "c1", pendingId: "p1" }), card(meal("p1", 300))], [failed], new Set(["c1"]), false);
    expect(logged.next.some((e) => e.role === "error")).toBe(false);
    // The id is what is read, so a card whose meal is gone still answers it.
    const gone = reconcilePage([userLine("two eggs", { clientId: "c1", pendingId: "p1" }), card(null, "p1")], [failed], new Set(["c1"]), false);
    expect(gone.next.some((e) => e.role === "error")).toBe(false);
  });

  it("keeps the pages the user scrolled back to above the newest one, and drops them when the thread restarts", () => {
    const older: ThreadEntry = { id: "old", role: "user", text: "yesterday", stored: true };
    const page = [userLine("today")];
    expect(reconcilePage(page, [older], new Set(), true).next.map((e) => e.id)).toEqual(["old", page[0]!.id]);
    expect(reconcilePage(page, [older], new Set(), false).next.map((e) => e.id)).toEqual([page[0]!.id]);
  });

  it("re-points an older page's card at the newest record of the same meal", () => {
    const stale: ThreadEntry = { id: "old", role: "card", event: "logged", mealId: "m1", meal: meal("m1", 100), stored: true };
    const { next } = reconcilePage([card(meal("m1", 200))], [stale], new Set(), true);
    const first = next[0];
    expect(first && first.role === "card" && first.meal?.kcal).toBe(200);
    // A disappearance propagates too: one meal must not read as gone on one card and as 100 kcal on another.
    const gone = reconcilePage([card(null, "m1")], [stale], new Set(), true).next[0];
    expect(gone && gone.role === "card" && gone.meal).toBeNull();
  });

  it("tells the lines changing (a scroll) from a record changing (a repaint) from nothing changing (a bail-out)", () => {
    const page = [userLine("hi"), card(meal("m1", 100))];
    const first = reconcilePage(page, [], new Set(), false);
    expect(first.linesChanged).toBe(true);
    expect(first.changed).toBe(true);
    // The same page again, as a fresh fetch would carry it: new objects, same content.
    const same = reconcilePage(page.map((e) => structuredClone(e)), first.next, new Set(), false);
    expect(same.changed).toBe(false);
    const edited = page.map((e) => (e.role === "assistant" && e.kind === "meal" ? { ...e, meal: meal("m1", 250) } : e));
    const again = reconcilePage(edited, first.next, new Set(), false);
    expect(again.linesChanged).toBe(false);
    expect(again.changed).toBe(true);
    const c = again.next[1];
    expect(c && c.role === "card" && c.meal?.kcal).toBe(250);
  });
});

describe("mergeThread", () => {
  it("drops a live proposal once the page carries the card its confirm wrote", () => {
    // A page fetched while the confirm is in flight already has the card (the meal takes the
    // proposal's id); the bubble with its buttons must not stay beside it.
    const proposal: ThreadEntry = { id: "a1", role: "assistant", result: { kind: "proposed", pendingId: "p1", analysis: meal("p1", 1), date: "2026-08-25" } };
    const other: ThreadEntry = { id: "a2", role: "assistant", result: { kind: "proposed", pendingId: "p2", analysis: meal("p2", 1), date: "2026-08-25" } };
    const logged = card(meal("p1", 300));
    const next = mergeThread(fromHistory([logged]), [proposal, other], new Set());
    expect(next.map((e) => e.id)).toEqual([logged.id, "a2"]);
  });

  it("keeps a live proposal and a bubble still in flight, and lets an error bubble go with the page", () => {
    const proposal: ThreadEntry = { id: "a1", role: "assistant", result: { kind: "proposed", pendingId: "p1", analysis: meal("p1", 1), date: "2026-08-25" } };
    const asked: ThreadEntry = { id: "c9", role: "user", text: "and a coffee" };
    const error: ThreadEntry = { id: "e1", role: "error", refusal: "analysis-failed" };
    const page = [userLine("hi")];
    const next = mergeThread(fromHistory(page), [proposal, asked, error], new Set(["c9"]));
    expect(next.map((e) => e.id)).toEqual([page[0]!.id, "a1", "c9"]);
  });
});

describe("fromHistory", () => {
  it("keeps who said an assistant line, so Gabie's answers wear her face after a reload", () => {
    const [spud, gabie] = fromHistory([said("Logged."), said("About 40 g.", "gabie")]);
    expect(spud).toMatchObject({ role: "assistant", stored: true, result: { kind: "answered", text: "Logged.", speaker: null } });
    expect(gabie).toMatchObject({ role: "assistant", stored: true, result: { kind: "answered", text: "About 40 g.", speaker: "gabie" } });
  });
});

describe("landedLine / unansweredFor", () => {
  it("finds the stored line a bubble landed as, and earns a notice only for a proposal with no card", () => {
    const entries = fromHistory([userLine("two eggs", { clientId: "c1", pendingId: "p1" }), userLine("hi", { clientId: "c2" })]);
    expect(landedLine(entries, "c1")?.text).toBe("two eggs");
    expect(landedLine(entries, "c9")).toBeUndefined();
    expect(unansweredFor(entries, "c1")).toMatchObject({ id: "unanswered:c1", role: "error", refusal: "unanswered" });
    expect(unansweredFor(entries, "c2")).toBeNull();
    const logged = fromHistory([userLine("two eggs", { clientId: "c1", pendingId: "p1" }), card(null, "p1")]);
    expect(unansweredFor(logged, "c1")).toBeNull();
  });

  it("places the notice right under the line it answers, and changes nothing when there is none to give", () => {
    const later: ThreadEntry = { id: "a2", role: "assistant", result: { kind: "proposed", pendingId: "p2", analysis: meal("p2", 1), date: "2026-08-25" } };
    const entries = [...fromHistory([userLine("two eggs", { clientId: "c1", pendingId: "p1" }), said("unrelated")]), later];
    expect(withUnanswered(entries, "c1").map((e) => e.id)).toEqual([entries[0]!.id, "unanswered:c1", entries[1]!.id, "a2"]);
    expect(withUnanswered(entries, "c9")).toBe(entries);
    // The fact that the turn spent the sample rides on the notice, like it does on "analysis-failed".
    expect(withUnanswered(entries, "c1", "sample")[1]).toMatchObject({ refusal: "unanswered", scope: "sample" });
    expect(reconcilePage([userLine("two eggs", { clientId: "c1", pendingId: "p1" })], [{ id: "c1", role: "user", text: "two eggs", failed: true }], new Set(["c1"]), false, "sample").next[1]).toMatchObject({ refusal: "unanswered", scope: "sample" });
  });
});

describe("lastMealId", () => {
  it("is the newest card's meal when it is today's, null when it is not or is gone, undefined with no card", () => {
    expect(lastMealId([card(meal("m1", 1)), said("ok")], "2026-08-25")).toBe("m1");
    expect(lastMealId([card(meal("m1", 1, "2026-08-24"))], "2026-08-25")).toBeNull();
    // The newest card IS the one the user is looking at; a gone meal there focuses nothing, not the one above.
    expect(lastMealId([card(meal("m0", 1)), card(null, "m1")], "2026-08-25")).toBeNull();
    expect(lastMealId([userLine("hi")], "2026-08-25")).toBeUndefined();
  });
});

describe("fromHistory", () => {
  it("renders a stored photo as a glyph-only bubble, with its caption when it had one", () => {
    const shot = (text: string | null): ChatEntry => ({ ...base(), role: "user", kind: "photo", text, mealId: null });
    expect(fromHistory([shot(null), shot("lunch")])).toMatchObject([
      { role: "user", photo: true, text: null, stored: true },
      { role: "user", photo: true, text: "lunch", stored: true },
    ]);
    // A text line keeps the ids the screen reads back: which bubble it landed for, and what it proposed.
    expect(fromHistory([userLine("hi", { clientId: "c1", pendingId: "p1" })])[0]).toMatchObject({ role: "user", clientId: "c1", pendingId: "p1" });
  });
});

describe("fromHistory — photo bubbles", () => {
  it("carries the meal id on a stored photo bubble, so the screen can fetch the picture", () => {
    const [e] = fromHistory([
      { id: "l1", seq: 1, ts: "2026-09-05T10:00:00.000Z", role: "user", kind: "photo", text: null, mealId: "m1" },
    ]);
    expect(e).toEqual({ id: "l1", role: "user", text: null, photo: true, stored: true, mealId: "m1" });
  });
});
