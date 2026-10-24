import { signupCopyFor } from "@eait/shared";
import type { Lang } from "@eait/shared";
import { brandSvg } from "@eait/shared/ui/icons";
import { pageCopyFor } from "../copy.ts";
import { dash, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/**
 * The sign-up screen (S8, board `cz-19-signup.html`): attach Apple or Google to the session
 * account, or present one that already has an account, which is the same mechanism in the
 * other direction. The email code flow (#569) stays live at `/start/email` — the board draws
 * no button for it, and both OAuth flows are plain redirects any browser completes, so no
 * browser is stranded without it.
 *
 * The pieces (19, ieat-app#2050): the heading — "Save your progress" when the person comes from
 * their plan, the product's promise when they come to sign in — no picture, the provider
 * buttons — Apple in black with its own mark, Google on the surface with the four-colour G —
 * and the two consent boxes, tickable but never pre-ticked.
 *
 * THE PROVIDER BUTTONS ARE SUBMITS OF ONE FORM, not links: the kickoff is a POST now, because it
 * is the tick that makes the kickoff legal. `formaction` names the provider so the consent boxes
 * share the one form.
 *
 * No pairing card: two providers fill the page's one decision.
 */
export interface SignUpView {
  /** `id` picks the provider's mark; `action` is the kickoff POST's formaction. */
  providers: readonly { id: "apple" | "google"; action: string; label: string }[];
  error: string | null;
  /** The published terms, or null where the operator published none. */
  termsHref: string | null;
  /** The published privacy policy, or null where no landing is configured to publish one. */
  privacyHref: string | null;
  /** True when the person arrives from their own plan: the heading is "Save your progress" (19). */
  fromPlan: boolean;
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
  const mark = (id: "apple" | "google") => brandSvg(id === "apple" ? "apple" : "google-signin");
  return shell(v.fromPlan ? SIGNUP_COPY.saveHeading : SIGNUP_COPY.signUpHeading, `${wtop()}
<div class="wmain one"><div class="wcol">
<div class="sup">
${v.fromPlan ? dash("signup", v.lang, { href: "/start/plan", label: pageCopyFor(v.lang).back }) : ""}
<h1>${escape(v.fromPlan ? SIGNUP_COPY.saveHeading : SIGNUP_COPY.signUpHeading)}</h1>
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
