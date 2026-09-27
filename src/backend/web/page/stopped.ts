import type { Lang } from "@eait/shared";
import { bubbles, spud } from "./parts.ts";
import { escape, shell } from "./shell.ts";

/**
 * The end of the road, and the only page here with nothing to press.
 *
 * Its one caller is the under-sixteen stop, whose words promise that nothing was kept — so the
 * account is deleted before this renders. A page that said it while a row survived would be the
 * worst sentence on this surface.
 */
export function stopped(
  title: string, body: string, lines: readonly string[], lang: Lang,
): string {
  return shell(title, `
${spud(lang)}
<h1>${escape(title)}</h1>
<p class="muted">${escape(body)}</p>
${bubbles(lines)}
`, lang);
}
