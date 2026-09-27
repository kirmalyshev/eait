// The W1 component kit (#88), measured in a real browser.
//
// ONE SPEC IS THE SHEET, ONE IS THE SHIPPED CONSUMER. The sheet composes the generated styles a
// surface interpolates (`lightVars` + `iconCss` + `kitCss` + `motionCss`) around markup the kit's
// own builders wrote, and asserts the computed values the issue's acceptance measures: ring
// 104/96/52 px with strokes 8/8/5, the week ring 32 px at stroke 2.4, the 56 px meal photo, the
// CTA at 16/600 on accent with radius 14. The shipped consumer is the signed-out screen, whose
// "Sign in" is the first element on the boards' primary button.

import type { Page } from "@playwright/test";
import { lightVars } from "@eait/shared/palette";
import { motionCss } from "@eait/shared/design";
import { iconCss } from "@eait/shared/ui/icons";
import {
  cta, estimateChartSvg, gramMacs, kitCss, mac, mcard, mealRow, optionRow, photoHero, ring,
  twoWayChartSvg, verdictList, weekBarsSvg, weekStrip, weightChartSvg, type WeekDayRow,
} from "@eait/shared/ui/kit";
import { expect, test } from "./fixtures.ts";

const WEEK: WeekDayRow[] = [
  { date: "2026-09-21", kcal: 1410, logged: true, when: "past", targetKcal: 1434 },
  { date: "2026-09-22", kcal: 1500, logged: true, when: "past", targetKcal: 1434 },
  { date: "2026-09-23", kcal: 0, logged: false, when: "past", targetKcal: 1434 },
  { date: "2026-09-24", kcal: 900, logged: true, when: "today", targetKcal: 1434 },
  { date: "2026-09-25", kcal: null, logged: false, when: "future", targetKcal: 1434 },
  { date: "2026-09-26", kcal: null, logged: false, when: "future", targetKcal: 1434 },
  { date: "2026-09-27", kcal: null, logged: false, when: "future", targetKcal: 1434 },
];

// A 1×1 gif, so the hero draws something an image loader can hold.
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

async function kitSheet(page: Page): Promise<void> {
  const markup = [
    ring({ share: 0.744, size: 104, tone: "ink", icon: "kcal" }),
    ring({ share: 0.5, tone: "macro-protein", icon: "protein" }),
    weekStrip(WEEK, "en"),
    mac("kcal", "540"),
    gramMacs({ protein: 34.4, carbs: 52, fat: 12 }, "en"),
    mcard({ macro: "protein", value: "55 g", label: "Protein left", share: 0.4 }),
    mcard({ macro: "carbs", value: "132 g", label: "Carbs" }),
    mealRow({
      name: "Grilled salmon, rice, broccoli", time: "13:05", kcal: 540,
      grams: { protein: 34.4, carbs: 52, fat: 12 },
      verdicts: [{ tone: "warn", words: "Calories high" }, { tone: "warn", words: "Saturated fat high" }],
      photo: { src: PIXEL, alt: "" },
    }, "en"),
    mealRow({
      name: "Flat white", time: "16:10", kcal: 95, note: "rough estimate", photo: null,
      grams: { protein: 6, carbs: 9, fat: 4 },
    }, "en"),
    verdictList([
      { tone: "warn", words: "Calories high" },
      { tone: "good", words: "Sodium on plan" },
    ]),
    photoHero({
      src: PIXEL, alt: "Salmon, rice and broccoli", pad: 18, stamp: "13:04",
      callouts: [
        { text: "Salmon 140 g", value: "290", corner: "tl" },
        { text: "Rice 150 g", value: "195", corner: "bl" },
        { text: "Broccoli 90 g", value: "55", corner: "br", lift: true },
      ],
    }),
    estimateChartSvg("lose", {
      aria: "Weight trend to target", start: "74 kg", target: "Target 68 kg",
      now: "Now", month: "January 2027 · estimate",
    }),
    twoWayChartSvg({ aria: "Weight over time, drawn two ways", without: "Without", now: "Now", later: "Later" }),
    weightChartSvg(
      [{ t: 0, kg: 74.6 }, { t: 15, kg: 74 }, { t: 31, kg: 73.4 }],
      { first: "74.6", last: "73.4", from: "24 Aug", to: "24 Sep" },
    ),
    weekBarsSvg([1200, 1400, 1350, 800, null, null, null], 1434, {
      todayIndex: 3, letters: ["M", "T", "W", "T", "F", "S", "S"], planLabel: "1,434",
    }),
    cta({ text: "See my plan", kind: "p" }),
    cta({ text: "Edit", kind: "s", icon: "pencil" }),
    `<div class="opts">${optionRow({ text: "Lose weight", icon: "lose", tile: true, selected: true })}${optionRow({ text: "Keep weight", icon: "keep", tile: true })}</div>`,
    // A hairline list is the same row outside the card grid — the form .card.flat wraps it in.
    `<div class="card flat" style="padding:0 16px">${optionRow({ text: "Language", icon: "person", tag: "div" })}${optionRow({ text: "Sign out", tag: "div" })}</div>`,
  ].join("\n");
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
:root{${lightVars}}
</style><style>${iconCss()}</style><style>${kitCss()}</style><style>${motionCss()}</style>
</head><body style="background:var(--bg);font-family:var(--sans);max-width:420px;margin:24px auto">${markup}</body></html>`);
}

test("the kit's measurements are pro.css's", async ({ page }) => {
  await kitSheet(page);

  // The ring: 104 px hero, 96 px web, 52 px macro — strokes 8/8/5 carried as attributes.
  await expect(page.locator(".mring.w104")).toHaveCSS("width", "104px");
  await expect(page.locator(".mring.w104")).toHaveCSS("height", "104px");
  await expect(page.locator(".mring.w104 circle").first()).toHaveAttribute("stroke-width", "8");
  await expect(page.locator(".mring").nth(1)).toHaveCSS("width", "52px");
  await expect(page.locator(".mring").nth(1).locator("circle").first()).toHaveAttribute("stroke-width", "5");

  // The week strip: seven cells, the 32 px ring at stroke 2.4, the date centred over it.
  await expect(page.locator(".week .dy")).toHaveCount(7);
  await expect(page.locator(".week svg").first()).toHaveCSS("width", "32px");
  await expect(page.locator(".week svg circle").first()).toHaveAttribute("stroke-width", "2.4");
  const b = page.locator(".dy.now b");
  const bBox = await b.boundingBox(), svgBox = await page.locator(".dy.now svg").boundingBox();
  expect(Math.abs((bBox!.x + bBox!.width / 2) - (svgBox!.x + svgBox!.width / 2))).toBeLessThan(1);
  await expect(page.locator(".dy.fut")).toHaveCount(3);
  await expect(page.locator(".dy.fut").first()).toHaveCSS("opacity", "0.45");
  // The over-plan day takes `bad`, straight from dayRing's tone — never a client-side compare.
  await expect(page.locator(".dy").nth(1).locator(".fg")).toHaveAttribute("stroke", "var(--bad)");

  // The meal row: 56 px photo (r-thumb 8), the chips, kcal at the end, verdict words off-plan.
  await expect(page.locator(".meal .ph").first()).toHaveCSS("width", "56px");
  await expect(page.locator(".meal .ph").first()).toHaveCSS("border-radius", "8px");
  await expect(page.locator(".meal").first().locator(".macs .mac")).toHaveCount(3);
  await expect(page.locator(".meal").first().locator(".kc")).toContainText("540");
  // The typed row draws the chat tile, and a verdict-free row writes no dot.
  await expect(page.locator(".meal").nth(1).locator(".ph.chat .i-chat")).toBeVisible();
  await expect(page.locator(".meal").nth(1).locator(".v")).toHaveCount(0);

  // The verdict: an 8 px dot and words — never a pill. (The pseudo-element read is a string
  // evaluate — this file typechecks without the DOM; the browser is where it runs.)
  const dot = await page.evaluate(
    `(() => { const s = getComputedStyle(document.querySelector(".v.warn"), "::before");
      return { width: s.width, borderRadius: s.borderRadius, backgroundColor: s.backgroundColor }; })()`,
  ) as { width: string; borderRadius: string; backgroundColor: string };
  expect(dot.width).toBe("8px");
  expect(dot.borderRadius).toBe("50%");
  expect(dot.backgroundColor).toBe("rgb(163, 90, 0)"); // --warn

  // The CTA: 16/600 on accent, radius 14, and text-transform never enters it.
  const ctaP = page.locator(".cta.p");
  await expect(ctaP.first()).toHaveCSS("border-radius", "14px");
  await expect(ctaP.first()).toHaveCSS("font-size", "16px");
  await expect(ctaP.first()).toHaveCSS("font-weight", "600");
  await expect(ctaP.first()).toHaveCSS("background-color", "rgb(30, 107, 60)"); // --accent
  await expect(ctaP.first()).toHaveCSS("min-height", "52px");
  await expect(ctaP.first()).toHaveCSS("text-transform", "none");

  // Option rows: a hairline between rows (not on the first), the check disc filled on the
  // selected one — no chips.
  await expect(page.locator(".card.flat .opt").nth(1)).toHaveCSS("border-top-width", "1px");
  await expect(page.locator(".card.flat .opt").nth(1)).toHaveCSS("border-top-color", "rgb(231, 229, 224)");
  await expect(page.locator(".card.flat .opt").first()).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".opt.sel .ck")).toHaveCSS("background-color", "rgb(30, 107, 60)");
  await expect(page.locator(".opt").nth(1).locator(".ck")).toHaveCSS("box-shadow", /inset/);

  // The charts are the shared geometry: paths verbatim, the end dot accent.
  await expect(page.locator(".pgraph .ln")).toHaveAttribute("d", /M20 34/);
  await expect(page.locator(".pgraph .end")).toHaveAttribute("fill", "var(--accent)");
});

test("reduced motion: the kit draws its end state and animates nothing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await kitSheet(page);
  for (const sel of [".mring .fg", ".hero .co", ".pgraph .area", ".pgraph .end", ".pgraph.wb rect.rd-0"]) {
    await expect(page.locator(sel).first()).toHaveCSS("animation-name", "none");
  }
  // End state visible: the ring's arc still says its share (dashoffset attribute, not animation).
  await expect(page.locator(".mring.w104 .fg")).toHaveAttribute("stroke-dashoffset", "70.8");
});

test("the signed-out screen draws the kit's primary button", async ({ page }) => {
  await page.goto("/");
  const signIn = page.locator("a.cta.p");
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveCSS("border-radius", "14px");
  await expect(signIn).toHaveCSS("font-weight", "600");
  await expect(signIn).toHaveCSS("background-color", "rgb(30, 107, 60)");
  await expect(signIn).toHaveCSS("text-transform", "none");
  await expect(signIn).toHaveAttribute("href", "/start");
});
