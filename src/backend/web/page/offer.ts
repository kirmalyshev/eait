import { spudSvg } from "@eait/shared/mascot";
import { payPlans, type PayPlanRow } from "@eait/shared/ui/kit";
import { fill, payCopyFor } from "@eait/shared";
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
  /** The terms document — the operator's `TERMS_URL`, or null where none is published. */
  termsHref: string | null;
  /** The note under the CTA while the YEARLY card is checked — the trial line, or the renewal
      line on a host that grants none. */
  noteYearly: string;
  /** The same note for the MONTHLY pick — the trial line while the host sells one (the trial is
      on both plans, ieat-app#1591), the renew-at-once words where it does not. */
  noteMonthly: string;
  /** Where × goes — the web app's first meal, or this surface's own chat when there is none. */
  closeHref: string;
  /** The host's trial length in days — 0 means no trial, and the timeline's trial rows stay off
      the card entirely rather than promising a length that does not exist (ieat-app#1591). */
  trialDays: number;
  /** The configured plans as `payPlans` rows — priced and named by the caller. */
  plans: PayPlanRow[];
  lang: Lang;
}

const TICK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.4 3.4L13 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function offer(v: OfferView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const pay = payCopyFor(v.lang);
  const row = (what: string, detail: string): string =>
    `<div class="rowline"><strong>${escape(what)}</strong><span class="muted">${escape(detail)}</span></div>`;
  const perk = (p: string): string =>
    `<p class="perk"><span class="tick">${TICK}</span>${escape(p)}</p>`;
  // The centred muted footer the plans board draws — each link only where the operator publishes
  // it, and a page that sells nothing never renders a lone legal line. No Restore: web has none.
  const legal: string[] = [];
  if (v.termsHref !== null) legal.push(`<a href="${escape(v.termsHref)}">${escape(pay.termsLink)}</a>`);
  if (v.privacyHref !== null) legal.push(`<a href="${escape(v.privacyHref)}">${escape(pay.privacyLink)}</a>`);
  return shell(PAGE_COPY.titleOffer, `
${topBar(PAGE_COPY)}
<form class="offer" action="${escape(v.checkoutUrl)}" method="get">
<a class="x" href="${escape(v.closeHref)}" aria-label="${escape(PAGE_COPY.offerClose)}">×</a>
<div class="offer-hero">${spudSvg("joy", "spud-offer")}</div>
<p class="beat">${escape(PAGE_COPY.offerBeat)}</p>
<h1>${escape(v.headline)}</h1>
${[PAGE_COPY.offerPerkVerdict, PAGE_COPY.offerPerkPlan, PAGE_COPY.offerPerkSpud].map(perk).join("\n")}
${v.trialDays > 0 ? `<div class="card">
${row(PAGE_COPY.offerWhenToday, fill(pay.trialBadge, { days: String(v.trialDays) }))}
${row(PAGE_COPY.offerWhenEnding, PAGE_COPY.offerReminder)}
${row(fill(PAGE_COPY.offerWhenAfter, { n: String(v.trialDays + 1) }), PAGE_COPY.offerBilled)}
</div>` : ""}
${payPlans(v.plans, PAGE_COPY.titlePlan)}
<button class="button primary" type="submit">${escape(v.trialDays > 0 ? fill(pay.startTrial, { days: String(v.trialDays) }) : pay.continueCta)}</button>
<p class="note note-y">${escape(v.noteYearly)}</p>
<p class="note note-m">${escape(v.noteMonthly)}</p>
${legal.length === 0 ? "" : `<p class="fine">${legal.join(" · ")}</p>`}
</form>
`, v.lang);
}
