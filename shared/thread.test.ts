import { describe, expect, it } from "bun:test";
import type { ChatEntry } from "./contract.ts";
import type { ChatSpeaker } from "./results.ts";
import type { MealRecord } from "./types.ts";
import { scriptedLine } from "./chat.ts";
import { fromHistory, hasLiveSuggestions, keepsItsWords, landedLine, lastMealId, mergeThread, moodFor, oneCardPerMeal, oneLiveProposal, pendingIdOf, proposalLive, reconcilePage, speakerOf, supersededPendings, threadReducer, unansweredFor, visibleEntries, withUnanswered, type ChatResult, type ThreadEntry } from "./thread.ts";

// The Chat screen's reconciliation of three sources of truth — the fetched page, what is on screen,
// and the turns still in flight. Pure, so every rule the design notes record as hard-won is pinned
// here instead of living only in a screen no runner executes.

const meal = (id: string, kcal: number, date = "2026-08-25"): MealRecord => ({
  id, user_id: "u", ts: "2026-08-25T12:00:00.000Z", date, isFood: true, items: [], kcal, protein_g: 0, carbs_g: 0, fat_g: 0,
  satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, verdicts: {}, confidence: "high", notes: "", corrected: false, model: null,
});
/** Far enough out that these fixtures are about what they are about, never about the clock (#367). */
const LIVE = "2099-01-01T00:00:00.000Z";
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
    expect(none.next.at(-1)).toMatchObject({ id: "unanswered:c1", role: "error", kind: "unanswered" });
    // Beside the line it answers — not after a later turn's proposal, where it would read as that turn's.
    const later: ThreadEntry = { id: "a2", role: "assistant", result: { kind: "proposed", pendingId: "p2", analysis: meal("p2", 1), date: "2026-08-25", expiresAt: LIVE } };
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
    const proposal: ThreadEntry = { id: "a1", role: "assistant", result: { kind: "proposed", pendingId: "p1", analysis: meal("p1", 1), date: "2026-08-25", expiresAt: LIVE } };
    const other: ThreadEntry = { id: "a2", role: "assistant", result: { kind: "proposed", pendingId: "p2", analysis: meal("p2", 1), date: "2026-08-25", expiresAt: LIVE } };
    const logged = card(meal("p1", 300));
    const next = mergeThread(fromHistory([logged]), [proposal, other], new Set());
    expect(next.map((e) => e.id)).toEqual([logged.id, "a2"]);
  });

  it("keeps a live proposal and a bubble still in flight, and lets an error bubble go with the page", () => {
    const proposal: ThreadEntry = { id: "a1", role: "assistant", result: { kind: "proposed", pendingId: "p1", analysis: meal("p1", 1), date: "2026-08-25", expiresAt: LIVE } };
    const asked: ThreadEntry = { id: "c9", role: "user", text: "and a coffee" };
    const error: ThreadEntry = { id: "e1", role: "error", kind: "analysis-failed" };
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
    expect(unansweredFor(entries, "c1")).toMatchObject({ id: "unanswered:c1", role: "error", kind: "unanswered" });
    expect(unansweredFor(entries, "c2")).toBeNull();
    const logged = fromHistory([userLine("two eggs", { clientId: "c1", pendingId: "p1" }), card(null, "p1")]);
    expect(unansweredFor(logged, "c1")).toBeNull();
  });

  it("places the notice right under the line it answers, and changes nothing when there is none to give", () => {
    const later: ThreadEntry = { id: "a2", role: "assistant", result: { kind: "proposed", pendingId: "p2", analysis: meal("p2", 1), date: "2026-08-25", expiresAt: LIVE } };
    const entries = [...fromHistory([userLine("two eggs", { clientId: "c1", pendingId: "p1" }), said("unrelated")]), later];
    expect(withUnanswered(entries, "c1").map((e) => e.id)).toEqual([entries[0]!.id, "unanswered:c1", entries[1]!.id, "a2"]);
    expect(withUnanswered(entries, "c9")).toBe(entries);
    // The fact that the turn spent the sample rides on the notice, like it does on "analysis-failed".
    expect(withUnanswered(entries, "c1", "sample")[1]).toMatchObject({ kind: "unanswered", scope: "sample" });
    expect(reconcilePage([userLine("two eggs", { clientId: "c1", pendingId: "p1" })], [{ id: "c1", role: "user", text: "two eggs", failed: true }], new Set(["c1"]), false, "sample").next[1]).toMatchObject({ kind: "unanswered", scope: "sample" });
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

describe("keepsItsWords — #261", () => {
  it("keeps the words of the one refusal a purchase can answer, and of no other", () => {
    expect(keepsItsWords("subscription-required")).toBe(true);
    // Final for this turn: a retry under either cannot work, so a kept bubble would invite one.
    expect(keepsItsWords("cap-exceeded")).toBe(false);
    expect(keepsItsWords("no-food")).toBe(false);
    // Never reaches the question — it takes the `failed` path, where "not sent" is true.
    expect(keepsItsWords("analysis-failed")).toBe(false);
  });

  it("a refused bubble survives the page that drops every other live line, and earns no notice", () => {
    // What the screen holds after a 402: the words, marked, with the id still in flight — and the
    // refusal notice beside them, which IS a moment and goes with the page.
    const refused: ThreadEntry = { id: "c1", role: "user", text: "a bowl of porridge with blueberries", refused: true };
    const notice: ThreadEntry = { id: "e1", role: "error", kind: "subscription-required" };
    // The server kept no line for a refused turn, so the page that lands seconds later carries the
    // meal BEFORE it and nothing of this one. That page is what used to take the words away.
    const page = [userLine("two boiled eggs"), said("Logged.")];
    const { next, superseded } = reconcilePage(page, [refused, notice], new Set(["c1"]), false);
    expect(next.map((e) => e.id)).toEqual([page[0]!.id, page[1]!.id, "c1"]);
    // Nothing settled it: only a stored line carrying its id can, and a refusal leaves none.
    expect(superseded).toEqual([]);
    // And no "unanswered" notice — that belongs to a turn that LANDED and proposed nothing.
    expect(next.some((e) => e.role === "error" && e.kind === "unanswered")).toBe(false);
  });

  it("keeps the ask with the words it answers, and drops a notice belonging to nothing", () => {
    const refused: ThreadEntry = { id: "c1", role: "user", text: "porridge", refused: true };
    // The ask under those words: it carries the buy button, and after the purchase it is the only
    // confirmation the screen gives. Taking it while keeping the words left exactly that hole.
    const ask: ThreadEntry = { id: "e1", role: "error", kind: "subscription-required", for: "c1" };
    // A moment, belonging to no kept bubble: it goes with the page, the way every notice used to.
    const moment: ThreadEntry = { id: "e2", role: "error", kind: "cap-exceeded" };
    const page = [userLine("two boiled eggs"), said("Logged.")];
    const { next } = reconcilePage(page, [refused, ask, moment], new Set(["c1"]), false);
    expect(next.map((e) => e.id)).toEqual([page[0]!.id, page[1]!.id, "c1", "e1"]);
  });

  it("drops the ask once its bubble is retried — one tap takes both", () => {
    // `retry` drains the id and removes the bubble; the ask has nothing left to belong to.
    const ask: ThreadEntry = { id: "e1", role: "error", kind: "subscription-required", for: "c1" };
    const page = [userLine("two boiled eggs")];
    const { next } = reconcilePage(page, [ask], new Set(), false);
    expect(next.map((e) => e.id)).toEqual([page[0]!.id]);
  });
});

describe("oneCardPerMeal — #301", () => {
  // One meal, one place in the thread. The stored thread keeps a card per EVENT — logging writes
  // one, each correction another — and `chatHistory` resolves every one of them to the meal as it
  // is NOW, so two cards for one meal are the same numbers printed twice.
  const upd = (m: MealRecord | null, mealId = m?.id ?? null): ChatEntry =>
    ({ ...base(), role: "assistant", kind: "meal", event: "updated", mealId, meal: m });

  it("keeps only the newest card for a meal, in the newest one's place", () => {
    const first = card(meal("m1", 300));
    const between = said("Anything else?");
    const second = upd(meal("m1", 870));
    const kept = oneCardPerMeal(fromHistory([first, between, second]));
    expect(kept.map((e) => e.id)).toEqual([between.id, second.id]);
  });

  it("drops the stored card under a live result for the same meal, and keeps the live one", () => {
    // The window the screen is actually in between a correction landing and its page arriving.
    const stored = fromHistory([card(meal("m1", 300))]);
    const live: ThreadEntry = {
      id: "a1", role: "assistant",
      result: { kind: "updated", mealId: "m1", analysis: meal("m1", 870), totals: { kcal: 870, protein_g: 40, carbs_g: 0, fat_g: 0, satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 }, date: "2026-08-25", via: "nl" },
    };
    expect(oneCardPerMeal([...stored, live]).map((e) => e.id)).toEqual(["a1"]);
  });

  it("leaves two different meals, and every line that is not a meal, alone", () => {
    const a = card(meal("m1", 300));
    const b = card(meal("m2", 500));
    const line = userLine("and a coffee");
    const entries = fromHistory([a, line, b]);
    expect(oneCardPerMeal(entries)).toEqual(entries);
  });

  it("keeps every card whose meal is unknown — nothing says they are the same one", () => {
    const gone = fromHistory([card(null), card(null)]);
    expect(oneCardPerMeal(gone)).toHaveLength(2);
  });

  it("treats a re-date as the meal's newest mention, gone meal included", () => {
    const logged = card(meal("m1", 300));
    const moved: ChatEntry = { ...base(), role: "assistant", kind: "meal", event: "redated", mealId: "m1", meal: null };
    expect(oneCardPerMeal(fromHistory([logged, moved])).map((e) => e.id)).toEqual([moved.id]);
  });
});

describe("oneLiveProposal / pendingIdOf — #360", () => {
  const proposal = (id: string, pendingId: string): ThreadEntry =>
    ({ id, role: "assistant", result: { kind: "proposed", pendingId, analysis: meal(pendingId, 1106), date: "2026-08-25", expiresAt: LIVE } });
  const totals = { kcal: 1106, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 };
  /** The screen's `replace` on a confirm: the entry becomes the logged card, in its own place. */
  const confirm = (entries: ThreadEntry[], id: string, pendingId: string): ThreadEntry[] => {
    // Annotated, never cast: a field this result grows must break here rather than typecheck green.
    const logged: ThreadEntry = {
      id, role: "assistant",
      result: { kind: "logged", mealId: pendingId, analysis: meal(pendingId, 1106), totals, date: "2026-08-25", hint: "correction" },
    };
    return entries.map((e) => (e.id === id ? logged : e));
  };

  it("leaves one card and no UNMARKED second 'Log it' when a second estimate is confirmed", () => {
    // The prod turn in #360, verbatim: one plate estimated twice, then "Log it" on the second. The
    // first bubble kept its buttons for a `pendingId` the server had already forgotten about — two
    // offers that looked identical, and nothing said which one the thread was waiting on.
    const first = [...fromHistory([userLine("4 chicken nuggets, 3 breads with humus")]), proposal("a1", "p1")];
    const again = oneLiveProposal([...first, ...fromHistory([userLine("the same plate")]), proposal("a2", "p2")]);
    const after = confirm(again, "a2", "p2");
    expect(after.filter((e) => e.role === "assistant" && e.result.kind === "logged")).toHaveLength(1);
    // ONE meal in the diary. The leftover is still a proposal (#385: its analysis was billed, and
    // the client cannot know these two were one plate) — but it is MARKED, so the renderer draws a
    // leftover that names the collision rather than a twin of the offer just taken.
    const live = after.filter((e) => e.role === "assistant" && e.result.kind === "proposed");
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ id: "a1", superseded: true });
    // Never an unmarked one: an unmarked proposal beside a landed card is the #360 defect exactly.
    expect(live.filter((e) => !("superseded" in e && e.superseded))).toEqual([]);
  });

  it("retires in place, saying so — never a silent vanish, at either step", () => {
    // #360's rule, now reached one estimate later (#385): the bubble keeps its id and its place
    // whichever way it is retired. Filtering it out instead would take a card out from under the
    // reader's eye at the moment the new one lands, which is its own defect.
    const retired = oneLiveProposal([proposal("a1", "p1"), proposal("a2", "p2")]);
    expect(retired.map((e) => e.id)).toEqual(["a1", "a2"]);
    expect(retired[0]).toMatchObject({ id: "a1", superseded: true });
    expect(retired[1]).toEqual(proposal("a2", "p2"));
    const dropped = oneLiveProposal([...retired, proposal("a3", "p3")]);
    expect(dropped.map((e) => e.id)).toEqual(["a1", "a2", "a3"]);
    expect(dropped[0]).toEqual({ id: "a1", role: "assistant", result: { kind: "answered", text: scriptedLine("dropped") } });
  });

  it("names the pending to cancel, so the words are the server's rather than the app's", () => {
    // Nothing expires a proposal early, so a bubble the app merely stops offering is a row
    // `POST /confirm` would still honour. `send` reads this to make the cancel the "No" button makes.
    const entries = [...fromHistory([userLine("two eggs"), card(meal("m1", 300))]), proposal("a1", "p1")];
    expect(entries.map(pendingIdOf).find((id) => id !== null)).toBe("p1");
    expect(fromHistory([card(meal("m1", 300))]).map(pendingIdOf)).toEqual([null]);
  });

  it("keeps the superseded estimate confirmable, because its analysis was already billed (#385)", () => {
    // #360 retired every older estimate to "Dropped it." and cancelled it for real. It supersedes on
    // ORDER ALONE — nothing tells the client two estimates are one plate — so describing a SECOND
    // meal before confirming the first threw the first away, and its analysis was already charged
    // and already counted against the day's cap.
    const [first, second] = oneLiveProposal([proposal("a1", "p1"), proposal("a2", "p2")]);
    expect(pendingIdOf(second!)).toBe("p2");
    expect(second).toEqual(proposal("a2", "p2"));
    // The card and its pending SURVIVE: retired from being the live offer, not thrown away.
    expect(pendingIdOf(first!)).toBe("p1");
    expect(first).toMatchObject({ id: "a1", superseded: true });
    // Named as the one a THIRD estimate would drop — nothing cancels it while it is still on screen
    // offering itself, and `send` reads this only when it is about to push it past the bound.
    expect(supersededPendings([first!, second!])).toEqual(["p1"]);
  });

  it("drops the estimate that a THIRD one pushes past, and names it for the caller to cancel", () => {
    // Two live cards is the bound. A third estimate means the oldest has been passed over twice,
    // and it goes the way #360 sent it — the words the "No" button writes, and a real cancel, so
    // "Dropped it." is true rather than a row the server would still honour.
    const two = oneLiveProposal([proposal("a1", "p1"), proposal("a2", "p2")]);
    // What `send` cancels, read BEFORE the new estimate is appended: exactly the one about to be
    // pushed past the bound, and never the one still offering itself on screen.
    expect(supersededPendings(two)).toEqual(["p1"]);
    const three = oneLiveProposal([...two, proposal("a3", "p3")]);
    expect(three.map((e) => e.id)).toEqual(["a1", "a2", "a3"]);
    expect(three[0]).toEqual({ id: "a1", role: "assistant", result: { kind: "answered", text: scriptedLine("dropped") } });
    expect(three[1]).toMatchObject({ id: "a2", superseded: true });
    expect(three[2]).toEqual(proposal("a3", "p3"));
    // The dropped one is no longer a proposal, so it is not offered again for cancelling.
    expect(supersededPendings(three)).toEqual(["p2"]);
  });

  it("leaves a thread with one live estimate exactly as it is", () => {
    const entries = [...fromHistory([userLine("two eggs"), said("Anything else?")]), proposal("a1", "p1")];
    expect(oneLiveProposal(entries)).toBe(entries);
  });
});

// The rows a renderer draws, and who they belong to. Pure functions of an entry, so the rule about
// whose face a bubble carries is checked here rather than only on a simulator.

/** An assistant row of any result kind, for the exhaustive walks below. */
const spoke = (result: ChatResult, id = "a1"): ThreadEntry => ({ id, role: "assistant", result });
const proposal: ChatResult = { kind: "proposed", pendingId: "p1", analysis: meal("p1", 300), date: "2026-08-25", expiresAt: LIVE };
const landed: ChatResult = {
  kind: "logged", mealId: "m1", analysis: meal("m1", 300), date: "2026-08-25", hint: "correction",
  totals: { kcal: 300, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 },
};

describe("speakerOf", () => {
  it("names the user, Gabie on her answers, and Spud on everything else he says or shows", () => {
    expect(speakerOf({ id: "u1", role: "user", text: "hi" })).toBe("user");
    expect(speakerOf(spoke({ kind: "answered", text: "hi", speaker: "gabie" }))).toBe("gabie");
    // Absent or null is Spud, the host — the rule `ChatSpeaker` states.
    expect(speakerOf(spoke({ kind: "answered", text: "hi" }))).toBe("spud");
    expect(speakerOf(spoke({ kind: "answered", text: "hi", speaker: null }))).toBe("spud");
    // A card, a refusal and a proposal are Spud showing something, never Gabie answering.
    expect(speakerOf(fromHistory([card(meal("m1", 300))])[0]!)).toBe("spud");
    expect(speakerOf({ id: "e1", role: "error", kind: "offline" })).toBe("spud");
    expect(speakerOf(spoke(proposal))).toBe("spud");
  });
});

describe("moodFor", () => {
  it("reads the mood off what the bubble IS, not off the copy", () => {
    expect(moodFor({ id: "e1", role: "error", kind: "offline" })).toBe("care");
    expect(moodFor(fromHistory([card(meal("m1", 300))])[0]!)).toBe("cheer");
    expect(moodFor({ id: "u1", role: "user", text: "hi" })).toBe("idle");
    expect(moodFor(spoke(landed))).toBe("cheer");
    expect(moodFor(spoke(proposal))).toBe("think");
    expect(moodFor(spoke({ kind: "answered", text: "hi" }))).toBe("idle");
    expect(moodFor(spoke({ kind: "expired" }))).toBe("care");
    expect(moodFor(spoke({ kind: "not-food" }))).toBe("care");
    expect(moodFor(spoke({ kind: "cap-exceeded", scope: "user" }))).toBe("care");
    expect(moodFor(spoke({ kind: "subscription-required" }))).toBe("care");
    expect(moodFor(spoke({ kind: "analysis-failed" }))).toBe("care");
    expect(moodFor(spoke({ kind: "not-onboarded" }))).toBe("care");
  });
});

describe("visibleEntries", () => {
  it("drops an answered turn that changed nothing — the server keeps no line for it either", () => {
    const kept = spoke({ kind: "answered", text: "Updated." }, "a1");
    const silent = spoke({ kind: "answered", text: "" }, "a2");
    expect(visibleEntries([kept, silent]).map((e) => e.id)).toEqual(["a1"]);
  });

  it("keeps a photo bubble with no caption — an empty answer is the assistant's case, not the user's", () => {
    const photo: ThreadEntry = { id: "u1", role: "user", text: null, photo: true };
    expect(visibleEntries([photo])).toEqual([photo]);
  });

  it("shows one card per meal, so a corrected meal is not announced twice", () => {
    const entries = fromHistory([card(meal("m1", 300)), card(meal("m1", 150))]);
    expect(visibleEntries(entries)).toHaveLength(1);
  });
});

describe("hasLiveSuggestions", () => {
  const withChips = (suggestions: string[]): ThreadEntry => spoke({ kind: "answered", text: "hi", suggestions });

  it("is true only when the NEWEST row is a live answer carrying chips", () => {
    expect(hasLiveSuggestions([withChips(["what next?"])])).toBe(true);
    expect(hasLiveSuggestions([])).toBe(false);
    expect(hasLiveSuggestions([spoke({ kind: "answered", text: "hi" })])).toBe(false);
    expect(hasLiveSuggestions([withChips([])])).toBe(false);
    // A stored line never carried any, whatever its shape says.
    expect(hasLiveSuggestions([{ id: "a1", role: "assistant", result: { kind: "answered", text: "hi", suggestions: ["x"] }, stored: true }])).toBe(false);
    // Once the user has sent again the row is gone.
    expect(hasLiveSuggestions([withChips(["x"]), { id: "u1", role: "user", text: "more" }])).toBe(false);
  });
});

describe("threadReducer", () => {
  const one: ThreadEntry = { id: "a", role: "user", text: "one" };
  const two: ThreadEntry = { id: "b", role: "user", text: "two" };

  it("pushes, replaces in place and removes, without touching the list it was given", () => {
    const prev = [one];
    expect(threadReducer(prev, { kind: "push", entry: two })).toEqual([one, two]);
    const swap = spoke({ kind: "answered", text: "hi" }, "a");
    expect(threadReducer([one, two], { kind: "replace", id: "a", entry: swap })).toEqual([swap, two]);
    expect(threadReducer([one, two], { kind: "remove", id: "a" })).toEqual([two]);
    expect(prev).toEqual([one]);
  });

  it("marks one user bubble, and never an assistant line that happens to share the id", () => {
    // Two markers, two sentences: `failed` never reached the server, `refused` was read and answered.
    expect(threadReducer([one, two], { kind: "mark", id: "a", as: "failed" })).toEqual([{ ...one, failed: true }, two]);
    expect(threadReducer([one, two], { kind: "mark", id: "b", as: "refused" })).toEqual([one, { ...two, refused: true }]);
    const said = spoke({ kind: "answered", text: "hi" }, "a");
    expect(threadReducer([said], { kind: "mark", id: "a", as: "failed" })).toEqual([said]);
  });

  it("prepends an older page, dropping anything already on screen", () => {
    const older = [userLine("older"), userLine("overlap")];
    const onScreen = fromHistory([older[1]!]);
    const next = threadReducer(onScreen, { kind: "earlier", page: older });
    expect(next.map((e) => e.id)).toEqual([older[0]!.id, older[1]!.id]);
  });

  it("places the notice a landed turn earns under the line it answers, and gives the same list back when there is none", () => {
    const thread = fromHistory([userLine("two eggs", { clientId: "c1", pendingId: "p1" })]);
    expect(threadReducer(thread, { kind: "unanswered", clientId: "c1" }).at(-1))
      .toMatchObject({ id: "unanswered:c1", role: "error", kind: "unanswered" });
    const plain = fromHistory([userLine("hi", { clientId: "c2" })]);
    expect(threadReducer(plain, { kind: "unanswered", clientId: "c2" })).toBe(plain);
  });
});

describe("proposalLive — #367", () => {
  const at = Date.parse("2026-08-25T12:30:00.000Z");

  it("stops offering the button once the moment the server named has passed", () => {
    expect(proposalLive("2026-08-25T12:30:00.001Z", at)).toBe(true);
    // The boundary belongs to the server: at the instant it named, `getPending` already refuses.
    expect(proposalLive("2026-08-25T12:30:00.000Z", at)).toBe(false);
    expect(proposalLive("2026-08-25T12:00:00.000Z", at)).toBe(false);
  });

  it("keeps the button when the moment cannot be read, because the server is the authority", () => {
    // The opposite fallback to `entitlementLive`, deliberately. There, an unreadable date must not
    // unlock a paid feature; here it must not RETIRE a proposal the server would still honour —
    // the analysis behind it is already billed, and re-describing the plate spends another.
    expect(proposalLive("not a date", at)).toBe(true);
    expect(proposalLive("", at)).toBe(true);
  });
});
