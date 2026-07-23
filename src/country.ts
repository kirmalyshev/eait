// Curated purchase-country vocabulary. The buttons are a shortcut; "Other" lets a user type any
// country, stored raw. A known code resolves to an English name for the analyzer prompt and to a
// localized label (country.<code>) for display; a raw string is shown and prompted as-is.
//
// Kept as a literal union (like RESTRICTION_TAGS) so `country.${code}` is a checkable catalog key
// and an i18n test can couple the locale files to this exact list.

import type { TFunction } from "i18next";
import { normalizePromptText } from "./prompt_text.ts";

/** The offered countries. Trim or extend this one line to change the buttons. */
export const COUNTRIES = ["de", "ru", "us", "gb", "fr", "es", "it", "nl", "pl", "tr"] as const;
export type CountryCode = (typeof COUNTRIES)[number];

export function isCountryCode(v: unknown): v is CountryCode {
  return typeof v === "string" && (COUNTRIES as readonly string[]).includes(v);
}

// Two per row: several labels are long ("🇬🇧 United Kingdom", "🇺🇸 United States") and three
// long buttons across are unreadable on a phone — the same reason the restriction toggles wrap at 2.
export const COUNTRIES_PER_ROW = 2;

/**
 * The curated-country buttons as chunked rows, shared by onboarding and /settings — they differ
 * only in the callback data, supplied by `data(code)`. Structurally an InlineButton[][].
 */
export function countryCodeRows(
  t: TFunction,
  data: (code: CountryCode) => string,
): { text: string; data: string }[][] {
  const buttons = COUNTRIES.map((c) => ({ text: t(`country.${c}`), data: data(c) }));
  const rows: { text: string; data: string }[][] = [];
  for (let i = 0; i < buttons.length; i += COUNTRIES_PER_ROW) {
    rows.push(buttons.slice(i, i + COUNTRIES_PER_ROW));
  }
  return rows;
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

// Free-typed country ("Other"): stored roughly as typed for display and the prompt. Normalization
// is shared with parseLimitations via prompt_text.ts — the value is interpolated INSIDE a quoted
// span in the analyzer prompt, so it has to arrive single-line, unquoted, and free of control and
// invisible characters. It used to do only the whitespace/quote half inline, which let
// `parseCountry("Germany")` ship a control byte straight into that span.
//
// Cap policy differs from limitations on purpose: a country name past 60 characters is a typo or
// junk, so it is REJECTED rather than truncated.
const COUNTRY_INPUT_CAP = 60;
export function parseCountry(text: string): string | null {
  const c = normalizePromptText(text);
  return c.length >= 1 && c.length <= COUNTRY_INPUT_CAP ? c : null;
}
