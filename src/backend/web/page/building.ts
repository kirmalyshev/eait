import { PLAN_REVEAL, type Lang, type PlanRow } from "@eait/shared";
import { ctaLink, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/**
 * The reveal (board `phone/ob-building.html`, lifted onto the web frame for W3): the count to
 * 100 while the plan's own rows tick in, then the one button — and a `<meta refresh>` to the
 * plan a second past the count, so the page opens itself for the person who only watches.
 *
 * EVERY NUMBER IS THE PLAN'S. The rows arrive already computed — `planRows` over the profile's
 * own targets, done by the route — so this page is honest about the wait it is drawing: the
 * seconds are `durationMs + autoOpenDelayMs`, never a hand-typed number.
 */
export interface BuildingView {
  /** `content.building.lines` — "Building your personal plan", under the counting loader. */
  lines: readonly string[];
  /** `content.building.title` — the checklist card's label ("Your daily plan"). */
  cardLabel: string;
  /** `content.building.cta` — "Show me the plan". */
  cta: string;
  /** `planRows(profile, targets, content, lang)` — the computed checklist. */
  rows: readonly PlanRow[];
  /** Where the button leads — `/start/plan`. */
  next: string;
  lang: Lang;
}

/** A row's icon by its `planRows` id — the macro chips, the diet's, the declared limit's. */
const ROW_ICON: Record<PlanRow["id"], string> = {
  calories: "kcal",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  diet: "balanced",
  limit: "satfat",
};

export function building(v: BuildingView): string {
  const ticks = PLAN_REVEAL.rowTicksMs;
  // The button and the auto-open arrive when the count does; a run that draws more rows than
  // tick slots reuses the last mark rather than inventing one.
  const openS = (PLAN_REVEAL.durationMs + PLAN_REVEAL.autoOpenDelayMs) / 1000;
  // The percent is a MEASUREMENT, so its accessible name and its sign come from `Intl` — "100 %"
  // in French and German is written with the space, and Arabic's sign is not ASCII's. `data-sign`
  // feeds the CSS `::after`, so no stylesheet holds the glyph either.
  const percent = new Intl.NumberFormat(v.lang, { style: "percent" });
  const pctSign = percent.formatToParts(1).find((p) => p.type === "percentSign")!.value;
  return shell(v.lines.join(" "), `${wtop()}
<div class="wmain one"><div class="wcol">
<div class="bld">
<div class="pct count num" style="--to:100" data-sign="${escape(pctSign)}" role="img" aria-label="${escape(percent.format(1))}"></div>
<p class="bld-line">${escape(v.lines.join(" "))}</p>
<div class="lbar"><i></i></div>
<div class="card"><span class="lab">${escape(v.cardLabel)}</span>
${v.rows.map((row, i) => `  <div class="chk" style="--d:${ticks[Math.min(i, ticks.length - 1)]! / 1000}s"><i></i><span class="mac"><i class="ico i-${ROW_ICON[row.id]}"></i>${escape(row.label)}</span><b class="num">${escape(row.value)}</b></div>`).join("\n")}
</div>
${ctaLink(v.next, v.cta, "p go pop", ` style="--d:${PLAN_REVEAL.durationMs / 1000}s"`)}
</div>
</div></div>
`, v.lang, "ob",
  `<meta http-equiv="refresh" content="${openS};url=${escape(v.next)}">`);
}
