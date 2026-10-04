import { spudSvg } from "@eait/shared/mascot";
import { payPlans, type PayPlanRow } from "@eait/shared/ui/kit";
import type { Lang } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { topBar } from "./parts.ts";
import { escape, shell } from "./shell.ts";

/**
 * The soft offer (#42): the plan's one ask, with the honest timeline and a close that keeps the
 * welcome's promise — nothing to pay until the plan and the first verdict, and the × is the meal.
 * `headline` is the shared `offerHeadline`'s (the computed target by the computed month) or the
 * page's own fallback when a goal carries no target to name.
 *
 * The plans are the shared `payPlans` rows — Monthly and Yearly, never a Lifetime (#263) — and
 * the CTA is the form's submit: the checked radio rides the GET as `?plan=`, so the plan the
 * page shows is the plan `/start/checkout` sends. No script: the radio's checked state IS the
 * selection.
 */
export interface OfferView {
  headline: string;
  /** `/start/checkout`, the form's action — it fills `{userId}` from the session, never a client. */
  checkoutUrl: string;
  /** The published privacy policy, or null where no landing is configured to publish one. */
  privacyHref: string | null;
  /** Where × goes — the web app's first meal, or this surface's own chat when there is none. */
  closeHref: string;
  /** The configured plans as `payPlans` rows — priced and named by the caller. */
  plans: PayPlanRow[];
  lang: Lang;
}

const TICK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.4 3.4L13 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function offer(v: OfferView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const row = (what: string, detail: string): string =>
    `<div class="rowline"><strong>${escape(what)}</strong><span class="muted">${escape(detail)}</span></div>`;
  const perk = (p: string): string =>
    `<p class="perk"><span class="tick">${TICK}</span>${escape(p)}</p>`;
  return shell(PAGE_COPY.titleOffer, `
${topBar(PAGE_COPY)}
<form class="offer" action="${escape(v.checkoutUrl)}" method="get">
<a class="x" href="${escape(v.closeHref)}" aria-label="${escape(PAGE_COPY.offerClose)}">×</a>
<div class="offer-hero">${spudSvg("joy", "spud-offer")}</div>
<p class="beat">${escape(PAGE_COPY.offerBeat)}</p>
<h1>${escape(v.headline)}</h1>
${[PAGE_COPY.offerPerkVerdict, PAGE_COPY.offerPerkPlan, PAGE_COPY.offerPerkSpud].map(perk).join("\n")}
<div class="card">
${row(PAGE_COPY.offerWhenToday, PAGE_COPY.offerFreeWeek)}
${row(PAGE_COPY.offerWhenEnding, PAGE_COPY.offerReminder)}
${row(PAGE_COPY.offerWhenDay8, PAGE_COPY.offerBilled)}
</div>
${payPlans(v.plans, PAGE_COPY.titlePlan)}
<button class="button primary" type="submit">${escape(PAGE_COPY.offerCta)}</button>
${v.privacyHref === null ? "" : `<p class="muted fine"><a href="${escape(v.privacyHref)}">${escape(PAGE_COPY.offerPrivacy)}</a></p>`}
</form>
`, v.lang);
}
