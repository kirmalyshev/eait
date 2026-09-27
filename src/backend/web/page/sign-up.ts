import { signupCopyFor } from "@eait/shared";
import type { Lang } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { spud } from "./parts.ts";
import { escape, shell } from "./shell.ts";

/**
 * The sign-up screen (S8): attach Apple or Google to the session account — or present one that
 * already has an account, which is the same mechanism in the other direction.
 *
 * THE PROVIDER BUTTONS ARE SUBMITS OF ONE FORM, not links: the kickoff is a POST now, because it
 * is the tick that makes the kickoff legal. `formaction` names the provider so the consent boxes
 * ride the same request — and they can sit below the buttons, as the board draws them, because
 * `form="signup"` binds a control to a form it is not inside.
 *
 * The pairing card lives HERE, where somebody who already has an account is standing — a person
 * holding a code their phone minted does not want the welcome's questions.
 */
export interface SignUpView {
  providers: readonly { action: string; label: string }[];
  error: string | null;
  /** The published privacy policy, or null where no landing is configured to publish one. */
  privacyHref: string | null;
  lang: Lang;
}

export function signUp(v: SignUpView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const SIGNUP_COPY = signupCopyFor(v.lang);
  // The two links inside the terms label are placeholders the sentence carries itself, so a
  // translation can put them wherever its grammar needs them. Terms has nothing published to
  // point at — underlined text, as the board draws it; the policy links when a landing exists.
  const termsLabel = escape(SIGNUP_COPY.termsLabel)
    .replace("{terms}", escape(SIGNUP_COPY.termsLink))
    .replace("{privacy}", v.privacyHref === null
      ? escape(SIGNUP_COPY.privacyLink)
      : `<a href="${escape(v.privacyHref)}">${escape(SIGNUP_COPY.privacyLink)}</a>`);
  return shell(PAGE_COPY.titleStart, `
${spud(v.lang)}
<h1>${escape(SIGNUP_COPY.signUpHeading)}</h1>
${v.error ? `<p class="notice">${escape(v.error)}</p>` : ""}
<form id="signup" method="post">
${v.providers.map((p, i) =>
  `  <button class="button${i === 0 ? " primary" : ""}" type="submit" formaction="${escape(p.action)}">${escape(p.label)}</button>`,
).join("\n")}
</form>
<h2>${escape(PAGE_COPY.pairHeading)}</h2>
<p class="muted">${escape(PAGE_COPY.pairLead)}</p>
<form method="post" action="/start/pair">
  <input type="text" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
    maxlength="16" placeholder="${escape(PAGE_COPY.pairLabel)}"
    aria-label="${escape(PAGE_COPY.pairLabel)}">
  <button type="submit">${escape(PAGE_COPY.pairButton)}</button>
</form>
<label class="check"><input type="checkbox" name="terms" value="yes" form="signup"> ${termsLabel}</label>
<label class="check"><input type="checkbox" name="marketing" value="yes" form="signup"> ${escape(SIGNUP_COPY.consentMarketing)}</label>
`, v.lang);
}
