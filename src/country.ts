// Curated purchase-country vocabulary. The buttons are a shortcut; "Other" lets a user type any
// country, stored raw. A known code resolves to an English name for the analyzer prompt and to a
// localized label (country.<code>) for display; a raw string is shown and prompted as-is.
//
// Kept as a literal union (like RESTRICTION_TAGS) so `country.${code}` is a checkable catalog key
// and an i18n test can couple the locale files to this exact list.

import type { TFunction } from "i18next";

/** The offered countries. Trim or extend this one line to change the buttons. */
export const COUNTRIES = ["de", "ru", "us", "gb", "fr", "es", "it", "nl", "pl", "tr"] as const;
export type CountryCode = (typeof COUNTRIES)[number];

export function isCountryCode(v: unknown): v is CountryCode {
  return typeof v === "string" && (COUNTRIES as readonly string[]).includes(v);
}

// English names for the prompt: country steers identification toward local products and portion
// norms regardless of the user's interface language, so the model always sees English here.
const COUNTRY_EN: Record<CountryCode, string> = {
  de: "Germany",
  ru: "Russia",
  us: "the United States",
  gb: "the United Kingdom",
  fr: "France",
  es: "Spain",
  it: "Italy",
  nl: "the Netherlands",
  pl: "Poland",
  tr: "Turkey",
};

/**
 * For the analyzer prompt: a known code → English name; a raw "other" string → itself; the ''
 * skip sentinel and null/undefined → null (no country line is added at all).
 */
export function countryForPrompt(country: string | null | undefined): string | null {
  if (!country) return null;
  return isCountryCode(country) ? COUNTRY_EN[country] : country;
}

/** A stored country's display label: a known code → its localized name; a raw string → itself. */
export function countryLabel(country: string, t: TFunction): string {
  return isCountryCode(country) ? t(`country.${country}`) : country;
}

// Free-typed country ("Other"): stored raw so display and prompt both preserve what the user
// wrote. Length-capped like the caption/restriction inputs; empty → null (the caller re-prompts).
const COUNTRY_INPUT_CAP = 60;
export function parseCountry(text: string): string | null {
  const c = text.trim();
  return c.length >= 1 && c.length <= COUNTRY_INPUT_CAP ? c : null;
}
