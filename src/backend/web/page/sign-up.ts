import { fill, shellCopyFor, signupCopyFor } from "@eait/shared";
import type { Lang } from "@eait/shared";
import { brandSvg } from "@eait/shared/ui/icons";
import { IMG_URL_DIR } from "./board.ts";
import { ctaSubmit, wtop } from "./board.ts";
import { pageCopyFor } from "../copy.ts";
import { escape, shell } from "./shell.ts";

/**
 * The sign-up screen (S8, board `web/pay-signin.html`): attach Apple or Google to the session
 * account — or present one that already has an account, which is the same mechanism in the
 * other direction.
 *
 * The board's pieces: the app icon on top (`IMG_URL_DIR/icon.webp`, centred at a modest size —
 * served by the route, whitelisted like the fonts so `img-src 'self'` holds), the heading's promise, the two provider
 * buttons — Apple in black with its own mark, Google on the surface with the four-colour G —
 * the pairing card for the browser that already has a phone account, and the two consent boxes,
 * tickable but never pre-ticked.
 *
 * THE PROVIDER BUTTONS ARE SUBMITS OF ONE FORM, not links: the kickoff is a POST now, because it
 * is the tick that makes the kickoff legal. `formaction` names the provider so the consent boxes
 * share the one form.
 *
 * The pairing card stays under the providers rather than in front of the questions: a person
 * holding a code their phone minted does not want the welcome's questions.
 */
export interface SignUpView {
  /** `id` picks the provider's brand mark; `action` is the kickoff POST's formaction. */
  providers: readonly { id: "apple" | "google"; action: string; label: string }[];
  error: string | null;
  /** The published privacy policy, or null where no landing is configured to publish one. */
  privacyHref: string | null;
  lang: Lang;
}

export function signUp(v: SignUpView): string {
  const SIGNUP_COPY = signupCopyFor(v.lang);
  const PAGE_COPY = pageCopyFor(v.lang);
  // The consent line names the two documents, and {terms}/{privacy} sit inside the sentence so a
  // translation can put them wherever its grammar needs them. Terms has nothing published to
  // point at — underlined text, as the board draws it; the policy links when a landing exists.
  const termsLabel = escape(SIGNUP_COPY.termsLabel)
    .replace("{terms}", `<u>${escape(SIGNUP_COPY.termsLink)}</u>`)
    .replace("{privacy}", v.privacyHref === null
      ? `<u>${escape(SIGNUP_COPY.privacyLink)}</u>`
      : `<a href="${escape(v.privacyHref)}">${escape(SIGNUP_COPY.privacyLink)}</a>`);
  return shell(SIGNUP_COPY.signUpHeading, `${wtop()}
<div class="wmain one"><div class="wcol">
<div class="sup">
<div class="hero"><img src="${IMG_URL_DIR}/icon.webp" alt="" loading="lazy"></div>
<h1>${escape(SIGNUP_COPY.signUpHeading)}</h1>
${v.error ? `<p class="notice" role="alert">${escape(v.error)}</p>` : ""}
<form id="signup" method="post">
${v.providers.map((p) =>
  `  <button class="cta ${p.id === "apple" ? "apple" : "s"}" type="submit" formaction="${escape(p.action)}">${brandSvg(p.id === "apple" ? "apple" : "google-signin")}${escape(p.label)}</button>`,
).join("\n")}
</form>
<div class="paircard">
  <div class="row-between"><b>${escape(PAGE_COPY.pairHeading)}</b>
    <small>${escape(fill(PAGE_COPY.pairLead, { tab: shellCopyFor(v.lang).navProfile }))}</small></div>
  <form method="post" action="/start/pair">
    <input type="text" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
      maxlength="16" placeholder="______"
      aria-label="${escape(PAGE_COPY.pairLabel)}">
    ${ctaSubmit(PAGE_COPY.pairButton)}
  </form>
</div>
<div class="consent">
  <label><input type="checkbox" name="terms" value="yes" form="signup"><span>${termsLabel}</span></label>
  <label><input type="checkbox" name="marketing" value="yes" form="signup"><span>${escape(SIGNUP_COPY.consentMarketing)}</span></label>
</div>
</div>
</div></div>
`, v.lang, "ob");
}
