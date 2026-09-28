import type { Lang } from "@eait/shared";
import { spudSvg } from "@eait/shared/mascot";
import { wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/**
 * The end of the road, and the only page here with nothing to press — `states-under16`'s card:
 * Spud `care` beside the title, the reason under it, the account already deleted.
 *
 * Its one caller is the under-sixteen stop, whose words promise that nothing was kept — so the
 * account is deleted before this renders. A page that said it while a row survived would be the
 * worst sentence on this surface.
 */
export function stopped(
  title: string, body: string, lines: readonly string[], lang: Lang,
): string {
  return shell(title, `
${wtop()}
<div class="wmain one"><div class="wcol mid">
<div class="card stopcard"><div class="say"><span class="spud">${spudSvg("care", "spud-stop")}</span>
<div><p class="d d22">${escape(title)}</p>
<p class="muted-sub mt6">${escape(body)}</p>
${lines.map((l) => `<p class="muted-sub">${escape(l)}</p>`).join("")}</div></div></div>
</div></div>
`, lang, "ob");
}
