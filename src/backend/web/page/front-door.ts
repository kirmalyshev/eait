import type { Lang } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { bubbles, spud } from "./parts.ts";
import { escape, shell } from "./shell.ts";

export interface SignInButton { href: string; label: string }

/**
 * The front door. ONE BUTTON PER CONFIGURED PROVIDER, in the order the caller gives them.
 *
 * The FIRST is the primary one, which is how the app's sign-in screen reads too: Apple, then
 * Google. That ordering is not house style — the one that asks for the least should not be the
 * button that looks like the afterthought.
 */
export function frontDoor(
  welcome: readonly string[], buttons: readonly SignInButton[],
  lang: Lang,
): string {
  const PAGE_COPY = pageCopyFor(lang);
  return shell(PAGE_COPY.titleStart, `
${spud(lang)}
<h1>eait</h1>
${bubbles(welcome)}
<p class="muted">${escape(PAGE_COPY.frontDoorLead)}</p>
${buttons.map((b, i) =>
  `<a class="button${i === 0 ? " primary" : ""}" href="${escape(b.href)}">${escape(b.label)}</a>`,
).join("\n")}
`, lang);
}
