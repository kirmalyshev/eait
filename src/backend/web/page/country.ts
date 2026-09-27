import { countryFlag, countryLabel, type CountryCode, type Lang } from "@eait/shared";
import { iconSvg } from "@eait/shared/ui/icons";
import { pageCopyFor } from "../copy.ts";
import { ctaSubmit, say, wtop } from "./board.ts";
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
 * The search narrows TWO ways because it must work without the one script: the GET form's `q`
 * filters the rendered list, and CONTROL_SCRIPT's `input` handler hides rows live — the same
 * page with and without it (the register's rule for /start).
 */
export interface CountryView {
  /** The ask's first line — `asks.country.lines` of the content, in the account's language. */
  ask: string;
  /** The search box's placeholder, from the same content block. */
  placeholder: string;
  /** `countryOptions(lang)` — CLDR-sorted for this reader, `other` last. */
  options: readonly (CountryCode | "other")[];
  /** The resolved pick, preselected — a hint confirmed is still a hint confirmed aloud. */
  selected: CountryCode | "other" | null;
  /** The content's own label for the sentinel ("Somewhere else"). */
  otherLabel: string;
  /**
   * The account-split guard's sentence, filled — `sameAccountHint` naming the provider the
   * sign-up used, or `sameAccountHintGeneric` when the route found no web identity to name.
   * It lives HERE — the post-sign-up handoff — because the provider buttons sat on the plan
   * once and the note followed them onto the last `/start` screen the account still reads.
   */
  accountHint: string;
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
  // The GET filter narrows the rendered list to the query plus `other`, which is the choice
  // that still answers when nothing matches — a filter that hid it would dead-end a real place.
  const options = q === "" ? v.options : v.options.filter((c) =>
    c === "other"
      ? fold(v.otherLabel).includes(q) || true   // the sentinel always survives a filter
      : fold(countryLabel(c, v.lang)).includes(q),
  );
  const rows = options.map((c) => {
    const label = c === "other" ? v.otherLabel : (countryLabel(c, v.lang) ?? c);
    // The sentinel draws an ellipsis where a flag would sit — it is a region of no kind.
    const flag = c === "other" ? "…" : (countryFlag(c) ?? "");
    return `    <label class="opt"><input type="radio" name="answer" value="${escape(c)}"` +
      `${c === v.selected ? " checked" : ""}>` +
      `<span class="flag${c === "other" ? " any" : ""}">${escape(flag)}</span>` +
      `<span>${escape(label)}</span><span class="ck"><i class="ico i-check"></i></span></label>`;
  }).join("\n");

  return shell(PAGE_COPY.titleStart, `${wtop()}
<div class="wmain one"><div class="wcol">
<div class="cty">
${say("happy", [v.ask], v.lang)}
${v.error ? `<p class="notice" role="alert">${escape(v.error)}</p>` : ""}
<form method="get" action="${escape(v.action)}">
  <label class="srch">${iconSvg("search", { size: 18, class: "ico" })}<input type="search" name="q" value="${escape(v.query)}" placeholder="${escape(v.placeholder)}" aria-label="${escape(v.placeholder)}"></label>
</form>
<form method="post" action="${escape(v.action)}">
  <div class="opts">
${rows}
  </div>
  ${ctaSubmit(PAGE_COPY.continueLabel)}
</form>
<p class="note">${escape(v.accountHint)}</p>
</div>
</div></div>
`, v.lang, "ob");
}
