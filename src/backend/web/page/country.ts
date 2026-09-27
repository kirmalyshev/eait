import {
  countryFlag, countryLabel, type CountryCode, type Lang,
} from "@eait/shared";
import { iconSvg } from "@eait/shared/ui/icons";
import { spudSvg } from "@eait/shared/mascot";
import { pageCopyFor } from "../copy.ts";
import { topBar } from "./parts.ts";
import { escape, shell } from "./shell.ts";

/**
 * The country screen (board `onboarding/web/16-country.html`), drawn for W3: the ask as a
 * say-line, the search field on top, the curated grid — flags, names, the resolved pick
 * preselected — and "Somewhere else" last, because it is a sentinel and not a region.
 *
 * The choice is a RADIO GRID plus Continue rather than one tap per option: the board draws the
 * selected state and the button that commits it, and the POST is the same `answer` the walk
 * took — one code, validated against the offered list on the server, never trusted.
 *
 * The search filters TWO ways because it must work without the one script: the GET form's `q`
 * narrows the rendered list, and the script's `input` handler hides rows live — the same page
 * with and without it (the register's rule for /start).
 */
export interface CountryView {
  /** The ask's first line — `asks.country.lines` of the content, in the account's language. */
  ask: string;
  /** The search box's placeholder, from the same content block. */
  placeholder: string;
  /** `countryOptions(lang)` — CLDR-sorted for this reader, `other` last. */
  options: readonly CountryCode[];
  /** The resolved pick, preselected — a hint confirmed is still a hint confirmed aloud. */
  selected: CountryCode | null;
  /** The content's own label for the sentinel ("Somewhere else"). */
  otherLabel: string;
  /** The live `?q=` filter — what a no-script search typed. */
  query: string;
  error: string | null;
  /** The form's target — `/start/country`. */
  action: string;
  lang: Lang;
}

export function country(v: CountryView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const q = fold(v.query.trim());
  // The GET filter narrows on the localized label — "deutsch" finds Deutschland under German,
  // and a query matching nothing leaves only the sentinel, which always matches nothing too.
  const shown = q === "" ? v.options
    : v.options.filter((c) => c === "other" || fold(countryLabel(c, v.lang)).includes(q));
  return shell(PAGE_COPY.titleStart, `${topBar(PAGE_COPY)}
<div class="cty">
<div class="say"><span class="av">${spudSvg("happy", "spud-country")}</span><p class="q">${escape(v.ask)}</p></div>
<form method="get" action="${escape(v.action)}">
  <div class="srch">${iconSvg("search")}<input type="search" name="q" value="${escape(v.query)}" placeholder="${escape(v.placeholder)}" autocomplete="off" data-filter></div>
</form>
<form method="post" action="${escape(v.action)}">
  ${v.error ? `<p class="notice">${escape(v.error)}</p>` : ""}
  <div class="opts">
${shown.map((code) => {
  const flag = countryFlag(code);
  const label = code === "other" ? v.otherLabel : countryLabel(code, v.lang);
  return `    <label class="opt"><input type="radio" name="answer" value="${escape(code)}"${code === v.selected ? " checked" : ""}><span class="flag${flag === null ? " any" : ""}">${flag === null ? "…" : escape(flag)}</span>${escape(label)}<span class="ck"></span></label>`;
}).join("\n")}
  </div>
  <button class="cta p" type="submit">${escape(PAGE_COPY.continueLabel)}</button>
</form>
</div>
`, v.lang);
}
