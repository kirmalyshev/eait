// The paywall's configuration shape and its arithmetic (#77).
//
// The web app can be self-hosted, so nothing about the offer may be compiled into a bundle: the
// checkout links, the prices and the trial length are the OPERATOR's, read off
// `EAIT__BACKEND__WEB_*` and sent to the client already computed in `ProfileResponse.paywall` —
// the browser calculates nothing. The phone prices the same screens from StoreKit and calls
// `offerMath` itself, which is why the math takes numbers rather than display strings.

import { LANG_TAG } from "./lang.ts";
import type { Lang } from "./types.ts";

/**
 * One purchasable plan on the web paywall, ready to render: the checkout link with the account's
 * own id already filled into `{userId}` — navigate to it, never template it — and the prices
 * formatted in the account's language and the operator's currency.
 */
export interface PaywallPlan {
  checkoutUrl: string;
  /** The period's price as the card says it: "a year" for yearly, "a month" for monthly. */
  price: string;
}

/** The yearly plan's second figure: what a year of it costs per month. */
export interface YearlyPlan extends PaywallPlan {
  pricePerMonth: string;
}

/**
 * The one offer a decline leads to: the cheaper yearly plan, its regular price struck through.
 */
export interface ExitOffer extends PaywallPlan {
  /** The regular yearly price, for the strike-through. */
  regularPrice: string;
  /** Whole percent cheaper than the regular yearly price — floored, never overstated. */
  percentOff: number;
  /** The offer spread over a month, formatted like every other price. */
  perMonth: string;
}

/**
 * The web paywall, as this server is configured — computed in `ProfileResponse.paywall` (#77).
 *
 * A null plan is a plan the operator did not configure and the client does not draw. `yearly`,
 * `monthly` AND `exitOffer` all null means the host sells nothing and no paywall surface exists
 * at all — whatever `entitlement` and `limits` say about the account.
 */
export interface WebPaywall {
  /** Free days the plan's CTA may promise. 0 = no trial line is drawn. */
  trialDays: number;
  /** Yearly, the preselected plan — null when no yearly checkout is configured. */
  yearly: YearlyPlan | null;
  /** Monthly — null when no monthly checkout is configured. */
  monthly: PaywallPlan | null;
  /** The offer shown once after the plans are declined — null = a decline goes to the app. */
  exitOffer: ExitOffer | null;
}

/**
 * A configured amount written as a price in the operator's currency and the reader's language —
 * the ONLY way a `WEB_PRICE_*` number reaches a page. `Intl` owns the symbol, its side and the
 * decimal mark, because a table of our own got three languages wrong at once before it existed.
 */
export function paywallPrice(amount: number, currency: string, lang: Lang): string {
  // narrowSymbol, so a USD paywall reads "$39.99" to an English reader rather than "US$39.99".
  return new Intl.NumberFormat(LANG_TAG[lang], { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(amount);
}

/**
 * What the exit-offer card needs derived from its two prices: the percent cheaper — FLOORED, so a
 * fractional discount can only ever read smaller, never bigger — and the offer spread over a
 * month, to the cent. The struck-through price is the caller's own first argument; it needs no
 * second copy.
 *
 * Null rather than wrong figures when either price cannot stand: a regular price of nothing makes
 * the percent a division by zero, and a negative offer is a configuration error no card should
 * quietly reframe.
 */
export interface OfferMath {
  percentOff: number;
  perMonth: number;
}

export function offerMath(regularYearly: number, offer: number): OfferMath | null {
  if (!Number.isFinite(regularYearly) || !Number.isFinite(offer) || regularYearly <= 0 || offer < 0) {
    return null;
  }
  return {
    percentOff: Math.floor(((regularYearly - offer) / regularYearly) * 100),
    perMonth: Math.round((offer / 12) * 100) / 100,
  };
}
