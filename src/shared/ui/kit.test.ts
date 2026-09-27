// The W1 web component kit (#88): the markup every Register-P web surface draws, as ESCAPED
// strings so `/start` interpolates the same components server-side, plus `kitCss()` — the rules
// those class names mean. Every number asserted here is a `product/design/pro/` measurement the
// overseer checks the rendered DOM against: ring 104/96/52 px with strokes 8/8/5, week ring 32 px
// stroke 2.4, the 56 px meal photo, the 14 px CTA radius.

import { describe, expect, test } from "bun:test";
import {
  cta, esc, estimateChartSvg, gabieAvatar, gabieName, gramMacs, kitCss, mac, macs, mcard,
  mealRow, optionRow, photoHero, planCard, ring, spudAvatar, tagx, twoWayChartSvg, verdictDot,
  verdictList, weekBarsSvg, weekStrip, weightChartSvg,
} from "./kit.ts";
import { dayRing, estimateChart, ringDash, TWO_WAYS_CHART } from "./charts.ts";

test("esc closes every way out of an attribute or a text node", () => {
  expect(esc(`<img onerror="x">&'`)).toBe("&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;");
});

describe("ring — the day and macro instrument", () => {
  test("104 px: r 44, stroke 8, dash from ringDash", () => {
    const m = ring({ share: 0.744, size: 104, tone: "ink", icon: "kcal" });
    expect(m).toContain('class="mring w104"');
    expect(m).toContain('viewBox="0 0 104 104"');
    expect(m).toContain('cx="52" cy="52" r="44"');
    expect(m).toContain('stroke-width="8"');
    const d = ringDash(0.744, 44);
    expect(m).toContain(`stroke-dasharray="${d.dasharray}"`);
    expect(m).toContain(`stroke-dashoffset="${d.dashoffset}"`);
    expect(m).toContain('stroke-linecap="round"');
    expect(m).toContain('<i class="ico i-kcal"></i>');
  });

  test("96 px: r 40, stroke 8 — the boards' web day ring", () => {
    const m = ring({ share: 0, size: 96, tone: "accent", icon: "kcal" });
    expect(m).toContain('class="mring w96"');
    expect(m).toContain('viewBox="0 0 96 96"');
    expect(m).toContain('cx="48" cy="48" r="40"');
    expect(m).toContain('stroke-width="8"');
  });

  test("52 px is the default: r 21, stroke 5, macro tone", () => {
    const m = ring({ share: 0.5, tone: "macro-protein", icon: "protein" });
    expect(m).toContain('class="mring"');
    expect(m).toContain('viewBox="0 0 52 52"');
    expect(m).toContain('cx="26" cy="26" r="21"');
    expect(m).toContain('stroke-width="5"');
    expect(m).toContain('stroke="var(--macro-protein)"');
  });

  test("no icon is no .ico node; the share is clamped shut past 1", () => {
    const m = ring({ share: 1.4, size: 96 });
    expect(m).not.toContain("i-");
    expect(m).toContain('stroke-dashoffset="0"');
  });
});

describe("weekStrip — seven days, the date centred in its ring", () => {
  const days = [
    { date: "2026-09-21", kcal: 1410, logged: true, when: "past", targetKcal: 1434 },
    { date: "2026-09-22", kcal: 1500, logged: true, when: "past", targetKcal: 1434 },
    { date: "2026-09-23", kcal: 0, logged: false, when: "past", targetKcal: 1434 },
    { date: "2026-09-24", kcal: 900, logged: true, when: "today", targetKcal: 1434 },
    { date: "2026-09-25", kcal: null, logged: false, when: "future", targetKcal: 1434 },
    { date: "2026-09-26", kcal: null, logged: false, when: "future", targetKcal: 1434 },
    { date: "2026-09-27", kcal: null, logged: false, when: "future", targetKcal: 1434 },
  ] as const;

  test("the row the server sent goes straight into dayRing — no client date comparison", () => {
    const m = weekStrip(days, "en");
    expect(m.startsWith('<div class="week">')).toBe(true);
    // One cell per row, named by the server's own date.
    expect(m.match(/class="dy/g)).toHaveLength(7);
    expect(m).toContain('data-date="2026-09-24"');
    // `when` drives the classes: today is .now, future is .fut, an empty past day is neither.
    expect(m).toContain('class="dy now"');
    expect(m.match(/class="dy fut"/g)).toHaveLength(3);
    // A logged day carries the tone dayRing computed — the 1500-kcal day is over the 1434 plan.
    const over = dayRing(days[1]!, 1434);
    expect(over.tone).toBe("bad");
    expect(m).toContain('stroke="var(--bad)"');
    // The empty past day is the dotted placeholder; the future ones are the same, at .fut.
    expect(m).toContain('stroke-dasharray="2 3"');
    // The date number sits centred in the ring, the weekday letter above it.
    expect(m).toContain("<b>24</b>");
    expect(m).toContain(">M<svg");
  });

  test("every day is a real button with a spoken name", () => {
    const m = weekStrip(days, "en");
    expect(m.match(/<button type="button" class="dy/g)).toHaveLength(7);
    expect(m).toContain('aria-label="Thursday, 24 September 2026"');
    expect(m).toContain('viewBox="0 0 30 30"');
    expect(m).toContain('stroke-width="2.4"');
  });
});

describe("mac — the chip and its row", () => {
  test("a chip is icon, number, unit", () => {
    expect(mac("protein", "34 g")).toBe('<span class="mac"><i class="ico i-protein"></i>34 g</span>');
    // Saturated fat aliases fat's look — one chip rule, never retyped.
    expect(mac("satfat", "9 g")).toContain("i-satfat");
  });

  test("macs is the row of them", () => {
    const m = macs([{ name: "protein", text: "34 g" }, { name: "carbs", text: "52 g" }]);
    expect(m.startsWith('<span class="macs">')).toBe(true);
    expect(m.match(/class="mac"/g)).toHaveLength(2);
  });

  test("gramMacs writes {n} g in the surface's language", () => {
    const m = gramMacs({ protein: 34.4, carbs: 52, fat: 12 }, "en");
    expect(m).toContain("34 g");
    expect(m).toContain("i-fat");
  });
});

describe("mcard — the macro card", () => {
  test("with a target it carries the ring", () => {
    const m = mcard({ macro: "protein", value: "55 g", label: "Protein left", share: 0.4 });
    expect(m).toContain('class="mcard"');
    expect(m).toContain("<b>55 g</b>");
    expect(m).toContain("<small>Protein left</small>");
    expect(m).toContain('class="mring"');
    expect(m).toContain('stroke="var(--macro-protein)"');
  });

  test("with none it centres the icon — no invented ring for carbs or fat", () => {
    const m = mcard({ macro: "carbs", value: "132 g", label: "Carbs" });
    expect(m).toContain('class="mring flat"');
    expect(m).not.toContain("stroke-dasharray");
  });

  test("the plan card is chip, figure, label — no ring at all", () => {
    const m = planCard({ macro: "fat", value: "48 g", label: "Fat" });
    expect(m).toContain('class="mcard"');
    expect(m.indexOf("i-fat")).toBeLessThan(m.indexOf("48 g"));
    expect(m).not.toContain("mring");
  });
});

describe("mealRow — photo, name, verdict words, chips, kcal", () => {
  const base = {
    name: "Grilled salmon, rice, broccoli",
    time: "13:05",
    kcal: 540,
    grams: { protein: 34.4, carbs: 52, fat: 12 },
  };

  test("a photographed meal shows its 56 px photo", () => {
    const m = mealRow({ ...base, photo: { src: "/x.png", alt: "" } }, "en");
    expect(m).toContain('<img class="ph" src="/x.png" alt="">');
    expect(m).toContain("<b>Grilled salmon, rice, broccoli</b>");
    expect(m).toContain("540");
    expect(m).toContain("<small>kcal</small>");
    expect(m).toContain('class="macs sm"');
  });

  test("a typed meal gets the chat tile", () => {
    const m = mealRow({ ...base, photo: null }, "en");
    expect(m).toContain('class="ph chat"');
    expect(m).toContain("i-chat");
  });

  test("the verdict words appear only when the meal is not on plan", () => {
    const quiet = mealRow({ ...base, photo: null, verdicts: [{ tone: "good", words: "Calories on plan" }] }, "en");
    expect(quiet).not.toContain('class="v');
    const loud = mealRow({
      ...base, photo: null,
      verdicts: [
        { tone: "warn", words: "Calories high" },
        { tone: "bad", words: "Saturated fat high" },
      ],
    }, "en");
    expect(loud).toContain('class="v bad"');
    expect(loud).toContain("Calories high · Saturated fat high");
  });

  test("a name from the model is escaped, and a note follows the time", () => {
    const m = mealRow({ ...base, name: '<b onmouseover="x">', note: "rough estimate", photo: null }, "en");
    expect(m).not.toContain("<b onmouseover");
    expect(m).toContain("13:05 · rough estimate");
  });
});

describe("verdict — a dot and a line, never a pill", () => {
  test("one dot, one line", () => {
    expect(verdictDot("warn", "Calories high")).toBe('<span class="v warn">Calories high</span>');
  });
  test("the row stacks them", () => {
    const m = verdictList([{ tone: "warn", words: "Calories high" }, { tone: "good", words: "On plan" }]);
    expect(m.startsWith('<div class="vs">')).toBe(true);
    expect(m).toContain('class="v warn"');
    expect(m).toContain('class="v good"');
  });
});

describe("photoHero — the photo and its callouts", () => {
  test("callouts sit at their corners, the stamp bottom-right", () => {
    const m = photoHero({
      src: "/salmon.webp", alt: "Salmon, rice and broccoli", stamp: "13:04",
      callouts: [
        { text: "Salmon 140 g", value: "290", corner: "tl" },
        { text: "Broccoli 90 g", value: "55", corner: "br", lift: true },
      ],
    });
    expect(m).toContain('class="hero"');
    expect(m).toContain('alt="Salmon, rice and broccoli"');
    expect(m).toContain('class="co tl"');
    expect(m).toContain('class="co br lift"');
    expect(m).toContain("Salmon 140 g <span>290</span>");
    expect(m).toContain('class="stamp">13:04<');
  });
  test("no callouts, no callout nodes — the analyzer's list is the list", () => {
    const m = photoHero({ src: "/x.webp" });
    expect(m).not.toContain('class="co"');
  });
});

describe("the charts", () => {
  test("estimateChartSvg renders its header row — a chart cannot ship labelless", () => {
    const g = estimateChart("lose");
    const m = estimateChartSvg("lose", {
      aria: "Weight trend to target", start: "74 kg", target: "Target 68 kg",
      now: "Now", month: "January 2027 · estimate",
      label: "Estimated progress", byEait: "eait analysis",
    });
    expect(m).toContain('<div class="row between"><span class="lab">Estimated progress</span>');
    expect(m).toContain('<span class="tagx"><span class="wm happy"');
    expect(m).toContain("eait analysis");
    expect(m).toContain('class="pgraph"');
    expect(m).toContain('role="img"');
    expect(m).toContain('aria-label="Weight trend to target"');
    expect(m).toContain(`d="${g.linePath}"`);
    expect(m).toContain(`cx="${g.startDot.cx}"`);
    expect(m).toContain(">Target 68 kg</text>");
    expect(m).toContain(">January 2027 · estimate</text>");
  });

  test("each chart gets its own gradient id", () => {
    const l = { aria: "a", start: "s", target: "t", now: "n", month: "m", label: "l", byEait: "b" };
    const a = estimateChartSvg("lose", l), b = estimateChartSvg("gain", l);
    const idA = /linearGradient id="([^"]+)"/.exec(a)![1]!;
    const idB = /linearGradient id="([^"]+)"/.exec(b)![1]!;
    expect(idA).not.toBe(idB);
    expect(a).toContain(`fill="url(#${idA})"`);
  });

  test("twoWayChartSvg draws both paths", () => {
    const m = twoWayChartSvg({ aria: "Two ways", without: "Without", now: "Now", later: "Later" });
    expect(m).toContain(TWO_WAYS_CHART.withPath);
    expect(m).toContain(TWO_WAYS_CHART.withoutPath);
    expect(m).toContain(">Without</text>");
  });

  test("weightChartSvg draws the log and its endpoints", () => {
    const m = weightChartSvg(
      [{ t: 0, kg: 74.6 }, { t: 1, kg: 74 }, { t: 2, kg: 73.4 }],
      { first: "74.6", last: "73.4", from: "24 Aug", to: "24 Sep" },
    );
    expect(m).toContain('viewBox="0 0 320 112"');
    expect(m).toContain("<path");
    expect(m).toContain(">74.6</text>");
    expect(m).toContain(">73.4</text>");
    expect(m).toContain(">24 Aug</text>");
    expect(m.match(/<circle/g)!.length).toBe(3);
  });

  test("weightChartSvg draws the target lane you.html marks under the points", () => {
    const m = weightChartSvg(
      [{ t: 0, kg: 74.6 }, { t: 1, kg: 74 }, { t: 2, kg: 73.4 }],
      { first: "74.6", last: "73.4", from: "24 Aug", to: "24 Sep" },
      { label: "68 kg · target" },
    );
    expect(m).toContain('viewBox="0 0 320 120"');
    expect(m).toContain('stroke-dasharray="4 4"');
    expect(m).toContain(">68 kg · target</text>");
  });

  test("weekBarsSvg: empty days have no bar, today is the tinted one", () => {
    const m = weekBarsSvg([1200, 1400, null, 800, null, null, null], 1434, {
      todayIndex: 3, letters: ["M", "T", "W", "T", "F", "S", "S"], planLabel: "1,434",
    });
    expect(m).toContain('viewBox="0 0 320 142"');
    expect(m.match(/<rect/g)).toHaveLength(3);
    expect(m).toContain('fill="var(--accent-tint)" stroke="var(--accent)"');
    expect(m).toContain('stroke-dasharray="3 3"');
    expect(m).toContain(">M</text>");
    expect(m).toContain(">1,434</text>");
  });
});

describe("avatars — Spud's mood disc and Gabie's letter", () => {
  test("spudAvatar is the 28 px disc with its mood class", () => {
    expect(spudAvatar("happy")).toBe('<span class="spud happy" aria-hidden="true"></span>');
    expect(spudAvatar("think", { large: true })).toContain('class="spud think lg"');
  });
  test("gabieAvatar is the lettered disc; gabieName is the name line", () => {
    expect(gabieAvatar()).toBe('<span class="gabie" aria-hidden="true"></span>');
    expect(gabieName("Gabie · nutritionist")).toBe('<div class="gname">Gabie · nutritionist</div>');
    expect(gabieName("Gabie <script>")).toContain("&lt;script&gt;");
  });
  test("every mood's --face is mascot.ts's own svg, data-urled once", () => {
    const css = kitCss();
    for (const mood of ["happy", "think", "care", "idle", "wave", "joy"]) {
      expect(css).toContain(`.spud.${mood},.wm.${mood}{--face:url("data:image/svg+xml,`);
    }
    expect(css).toContain('.spud{width:28px;height:28px');
    expect(css).toContain('.gabie::before{content:"G"}');
  });
});

describe("tagx — the attribution chip", () => {
  test("the eait mark plus words, on a surface pill", () => {
    const m = tagx({ text: "eait analysis" });
    expect(m).toContain('class="tagx"');
    expect(m).toContain('class="wm happy"');
    expect(m).toContain("eait analysis");
  });
  test("the streak chip is the same pill with an icon", () => {
    const m = tagx({ text: "4", icon: "streak", aria: "4-day streak" });
    expect(m).toContain('class="tagx ic"');
    expect(m).toContain('aria-label="4-day streak"');
    expect(m).toContain("i-streak");
  });
});

describe("cta — the one button", () => {
  test("primary as a link, primary as a submit", () => {
    expect(cta({ text: "See my plan", kind: "p", href: "#/plan" }))
      .toBe('<a class="cta p" href="#/plan">See my plan</a>');
    const b = cta({ text: "Continue", kind: "p", type: "submit" });
    expect(b).toContain('<button class="cta p" type="submit"');
    expect(b).toContain(">Continue</button>");
  });
  test("an icon precedes the label; ghost and secondary exist", () => {
    expect(cta({ text: "Log", kind: "s", icon: "camera" })).toContain("i-camera");
    expect(cta({ text: "Skip", kind: "g" })).toContain('class="cta g"');
  });
});

describe("optionRow — hairline and a check, no chips", () => {
  test("a row is hairline-separated with the check last", () => {
    const m = optionRow({ text: "Lose weight", selected: true });
    expect(m).toContain('class="opt sel"');
    expect(m).toContain("Lose weight");
    expect(m).toContain('<span class="ck"></span>');
    expect(m).not.toContain("pill");
  });
  test("a tiled row and a link row", () => {
    expect(optionRow({ text: "Pescatarian", icon: "pescatarian", tile: true })).toContain('class="tile"');
    expect(optionRow({ text: "Privacy", href: "/privacy" })).toContain('<a class="opt" href="/privacy">');
  });
});

describe("kitCss — the numbers the boards measure", () => {
  const css = kitCss();
  const rule = (sel: string) => {
    const m = new RegExp(`${sel.replace(/[.*{}]/g, (c) => `\\${c}`)}\\{([^}]*)\\}`).exec(css);
    return m?.[1] ?? "";
  };

  test("rings: 104/96/52 px, strokes 8/8/5, rotated to twelve o'clock", () => {
    expect(css).toContain(".mring{position:relative;width:52px;height:52px");
    expect(css).toContain(".mring.w104{width:104px;height:104px");
    expect(css).toContain(".mring.w96{width:96px;height:96px");
    expect(rule(".mring svg")).toContain("rotate(-90deg)");
    // The strokes (8/8/5) are markup attributes — checked on ring() above.
  });

  test("the week ring is 32 px at stroke 2.4, its date centred", () => {
    expect(css).toContain(".week svg{width:32px;height:32px");
    // The 2.4 stroke itself is a markup attribute (checked on weekStrip above), not a rule.
    expect(rule(".week .dy b")).toContain("position:absolute");
    expect(rule(".week .dy.now")).toContain("background:var(--surface)");
    expect(rule(".week .dy.fut")).toContain("opacity:.45");
  });

  test("the meal photo is 56 px, the CTA is 16/600 on accent at radius 14", () => {
    expect(rule(".meal .ph")).toContain("width:56px");
    expect(rule(".meal .ph")).toContain("var(--r-thumb)");
    expect(rule(".cta")).toContain("font-size:16px");
    expect(rule(".cta")).toContain("font-weight:600");
    expect(rule(".cta")).toContain("var(--r-cta)");
    expect(rule(".cta.p")).toContain("background:var(--accent)");
  });

  test("verdicts are a dot and words — there is no pill to find", () => {
    expect(css).toContain(".v::before");
    expect(rule(".v::before")).toContain("border-radius:50%");
    expect(rule(".v")).not.toContain("border-radius"); // a verdict is never a pill; tagx's is its own
    expect(rule(".opt")).toContain("border-top:1px solid var(--hair)");
    expect(rule(".opt.sel .ck")).toContain("background:var(--accent)");
  });

  test("the chart frame and its motion classes", () => {
    expect(rule(".pgraph")).toContain("overflow:visible");
    expect(css).toContain("k-rise");
    expect(css).toContain("k-draw");
  });

  test("the Target chip's text stays white on ink — .pgraph text would mute it", () => {
    // A presentation attribute loses to a rule; the chip's label needs its own rule.
    expect(css).toContain(".pgraph .chip text{fill:#fff}");
  });

  test("the macro card's figures are the board's, and the hero carries no radius", () => {
    expect(rule(".mcard b")).toContain("font-size:20px");
    expect(rule(".mcard b")).toContain("font-weight:700");
    expect(rule(".mcard b")).toContain("letter-spacing:-.02em");
    expect(rule(".mcard small")).toContain("font-size:12px");
    expect(rule(".mcard small")).toContain("font-weight:600");
    expect(rule(".mcard small")).toContain("var(--muted)");
    // The hero is a raw image block — its containers (the chat bubble, the meal card) round it.
    expect(rule(".hero")).not.toContain("border-radius");
    expect(rule(".hero")).toContain("overflow:hidden");
  });

  test("the tagx pill and its face", () => {
    expect(css).toContain(".tagx{display:inline-flex;align-items:center;gap:5px");
    expect(css).toContain("border-radius:999px");
    expect(css).toContain(".tagx .wm{width:18px;height:18px");
  });
});
