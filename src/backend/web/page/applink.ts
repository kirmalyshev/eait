import type { Lang } from "@eait/shared";
import { spudSvg } from "@eait/shared/mascot";
import { appLinkCopyFor } from "../copy.ts";
import { wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/**
 * The Android App Link's landing (ieat-app#2434), reached only when the verified https return did
 * NOT deliver into the app — the link unverified, or nothing installed. It exists because the
 * route may not redirect into a custom scheme: that is exactly the case where a foreign app
 * claiming `eait` is the only receiver of what the URL carries.
 *
 * What it says is true rather than reassuring — the token is in THIS browser, not the app's, so
 * "signed in" is nobody's word to use yet. The way across is the person's own tap on the link to
 * the same verified URL, the user gesture Android honours for an App Link even when it would not
 * hand one to an automatic redirect; the install line covers the device that simply has no eait.
 */
export function appLinkLanding(href: string, lang: Lang): string {
  const copy = appLinkCopyFor(lang);
  return shell(copy.title, `
${wtop()}
<div class="wmain one"><div class="wcol mid">
<div class="card"><div class="say"><span class="spud">${spudSvg("wave", "spud-applink")}</span>
<div><p class="d d22">${escape(copy.title)}</p>
<p class="muted-sub mt6">${escape(copy.lead)}</p>
<p class="mt6"><a class="cta p" href="${escape(href)}">${escape(copy.link)}</a></p>
<p class="muted-sub mt6">${escape(copy.install)}</p></div></div></div>
</div></div>
`, lang, "ob");
}
