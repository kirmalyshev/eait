import { signupCopyFor } from "@eait/shared";
import type { Lang } from "@eait/shared";
import { brandSvg } from "@eait/shared/ui/icons";
import { ico } from "@eait/shared/ui/kit";
import { IMG_URL_DIR } from "./board.ts";
import { wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/**
 * The sign-up screen (S8, boards `web/pay-signin.html` + `web/email-signin.html`): attach Apple
 * or Google to the session account, or start the email code flow — the third provider (#569) —
 * or present one that already has an account, which is the same mechanism in the other
 * direction.
 *
 * The board's pieces: the app icon on top (`IMG_URL_DIR/icon.webp`, centred at a modest size —
 * served by the route, whitelisted like the fonts so `img-src 'self'` holds), the heading's promise, the three provider
 * buttons — Apple in black with its own mark, Google on the surface with the four-colour G,
 * email on the surface with the mail glyph — and the two consent boxes, tickable but never
 * pre-ticked.
 *
 * THE PROVIDER BUTTONS ARE SUBMITS OF ONE FORM, not links: the kickoff is a POST now, because it
 * is the tick that makes the kickoff legal. `formaction` names the provider so the consent boxes
 * share the one form.
 *
 * No pairing card — `web/email-signin.html` removed it: three providers fill the page's one
 * decision, and a phone pairing code reaches `/start/pair` the long way round, from the same
 * form the card used to draw.
 */
export interface SignUpView {
  /** `id` picks the provider's mark; `action` is the kickoff POST's formaction. */
  providers: readonly { id: "apple" | "google" | "email"; action: string; label: string }[];
  error: string | null;
  /** The published terms, or null where the operator published none. */
  termsHref: string | null;
  /** The published privacy policy, or null where no landing is configured to publish one. */
  privacyHref: string | null;
  lang: Lang;
}

export function signUp(v: SignUpView): string {
  const SIGNUP_COPY = signupCopyFor(v.lang);
  // The consent line names the two documents, and {terms}/{privacy} sit inside the sentence so a
  // translation can put them wherever its grammar needs them. Each links where the operator
  // published it and stays underlined text, as the board draws it, where nothing was published.
  const docLink = (href: string | null, label: string) => href === null
    ? `<u>${escape(label)}</u>`
    : `<a href="${escape(href)}"><u>${escape(label)}</u></a>`;
  const termsLabel = escape(SIGNUP_COPY.termsLabel)
    .replace("{terms}", docLink(v.termsHref, SIGNUP_COPY.termsLink))
    .replace("{privacy}", docLink(v.privacyHref, SIGNUP_COPY.privacyLink));
  const mark = (id: "apple" | "google" | "email") =>
    id === "email" ? ico("mail") : brandSvg(id === "apple" ? "apple" : "google-signin");
  return shell(SIGNUP_COPY.signUpHeading, `${wtop()}
<div class="wmain one"><div class="wcol">
<div class="sup">
<div class="hero"><img src="${IMG_URL_DIR}/icon.webp" alt="" loading="lazy"></div>
<h1>${escape(SIGNUP_COPY.signUpHeading)}</h1>
${v.error ? `<p class="notice" role="alert">${escape(v.error)}</p>` : ""}
<form id="signup" method="post">
${v.providers.map((p) =>
  `  <button class="cta ${p.id === "apple" ? "apple" : "s"}" type="submit" formaction="${escape(p.action)}">${mark(p.id)}${escape(p.label)}</button>`,
).join("\n")}
</form>
<div class="consent">
  <label><input type="checkbox" name="terms" value="yes" form="signup"><span>${termsLabel}</span></label>
  <label><input type="checkbox" name="marketing" value="yes" form="signup"><span>${escape(SIGNUP_COPY.consentMarketing)}</span></label>
</div>
</div>
</div></div>
`, v.lang, "ob");
}
