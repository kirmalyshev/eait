// The pages `/start` renders. No JavaScript, and no build step to produce one.
//
// Everything a browser needs is in the bytes of the response: the stylesheet is inline, the two
// themes are one `prefers-color-scheme` block over the palette the app and the landing page already
// share, and every interaction is a form. That is the same decision the landing page makes, plus
// one more reason — this surface handles POSTs, and a page that needs no script is a page with no
// third-party origin to allow in its own CSP.

import { dark, light, type ColorName } from "../landing/tokens.ts";
import { spudSvg } from "../landing/mascot.ts";

export function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Every sentence this surface writes for itself, gated by a test against `lintCopy`.
 *
 * IT IS THIS AND NOT THE RENDERED PAGE, and the difference is worth stating. The questions are the
 * admin's onboarding copy, which says things like "Lose weight" — a goal a user picks, not a
 * promise anybody made — and the claims linter cannot tell those apart: `weight-promise` matches
 * `lose\s*weight` wherever it appears. Gating the whole page would make the surface unbuildable
 * against copy that has always shipped, ungated, inside the app. So what is gated is what is NEW:
 * the words below, which are this page's own and are public marketing copy in a way an in-app
 * question is not.
 */
export const PAGE_COPY = {
  frontDoorLead:
    "Set up your account here, then open the app already signed in. It takes about a minute.",
  frontDoorPrivacy:
    "We ask for an identifier and nothing else — no email address, no name, no contacts.",
  planHeading: "Your plan",
  planLead: "This is what the app will hold you to. You can change any answer later, in the app.",
  planFloor:
    "This is the lowest daily intake this app will set, so the number is the floor rather than the " +
    "arithmetic. Eating under it is not something we will help you plan.",
  planAppHeading: "Now get the app",
  /**
   * The `{provider}` is filled in with the one they actually used. THIS SENTENCE IS THE FEATURE:
   * the app offers both buttons, and the other one lands in a different account with onboarding to
   * do again and this plan — and anything bought from it — left behind on an account nothing can
   * merge into. Naming the right button is the only thing standing in front of that.
   */
  planAppBody:
    "Install eait for iPhone and choose Sign in with {provider}. It is the same account — your " +
    "answers and your plan are already on it.",
  /** No identity at all, which the plan page can only reach through a state nothing produces. */
  planAppBodyGeneric:
    "Install eait for iPhone and sign in the same way you did here. It is the same account — your " +
    "answers and your plan are already on it.",
  planCheckout: "Set up your subscription",
  errorSignIn: "That sign-in didn't complete. Try again.",
} as const;

const VARS = (t: Record<ColorName, string>) => `
    --bg:${t.bg}; --surface:${t.surface}; --raised:${t.surfaceRaised};
    --border:${t.border}; --border-strong:${t.borderStrong};
    --text:${t.text}; --muted:${t.textMuted};
    --accent:${t.accent}; --accent-text:${t.accentText}; --warn:${t.warn}; --care:${t.care};`;

const STYLES = `
  :root {${VARS(light)} }
  @media (prefers-color-scheme: dark) { :root {${VARS(dark)} } }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 34rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 .75rem; letter-spacing: -.01em; }
  h2 { font-size: 1.05rem; margin: 2rem 0 .5rem; }
  p { margin: 0 0 1rem; }
  .muted { color: var(--muted); }
  .small { font-size: .875rem; }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.25rem; margin: 0 0 1rem;
  }
  .bubble {
    background: var(--raised); border: 1px solid var(--border); border-radius: 14px;
    padding: .75rem 1rem; margin: 0 0 .5rem;
  }
  .spud { width: 64px; height: 64px; display: block; margin: 0 0 1rem; }
  form { margin: 0; }
  button, .button {
    display: block; width: 100%; text-align: left; cursor: pointer;
    font: inherit; color: var(--text); background: var(--raised);
    border: 1px solid var(--border-strong); border-radius: 12px;
    padding: .8rem 1rem; margin: 0 0 .5rem; text-decoration: none;
  }
  button.primary, .button.primary {
    background: var(--accent); color: var(--accent-text); border-color: var(--accent);
    text-align: center; font-weight: 600;
  }
  button .hint { display: block; color: var(--muted); font-size: .85rem; }
  button.primary .hint { color: inherit; opacity: .8; }
  input[type=number], input[type=text] {
    width: 100%; font: inherit; color: var(--text); background: var(--raised);
    border: 1px solid var(--border-strong); border-radius: 12px;
    padding: .8rem 1rem; margin: 0 0 .75rem;
  }
  label.check {
    display: block; background: var(--raised); border: 1px solid var(--border-strong);
    border-radius: 12px; padding: .7rem 1rem; margin: 0 0 .5rem; cursor: pointer;
  }
  .notice { border-left: 3px solid var(--warn); padding-left: .9rem; margin: 0 0 1rem; }
  .care { border-left-color: var(--care); }
  .progress { color: var(--muted); font-size: .8rem; margin: 0 0 1rem; letter-spacing: .04em; }
  .figure { font-size: 2.2rem; font-weight: 650; letter-spacing: -.02em; }
`;

/**
 * The document.
 *
 * `noindex`, because this is somebody's sign-up in progress and not a page anybody should arrive at
 * from a search result. The CSP says what the page actually is — no script, no frame, no third
 * party — so an edit that reaches for a CDN fails here rather than shipping one quietly.
 */
export function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)}</title>
<style>${STYLES}</style>
</head><body><main>${body}</main></body></html>`;
}

export function html(
  body: string,
  status = 200,
  opts: { cookies?: readonly string[] } = {},
): Response {
  const res = new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      // A sign-up in progress is per-person and per-session. Nothing here may sit in a shared cache.
      "cache-control": "no-store",
    },
  });
  for (const cookie of opts.cookies ?? []) res.headers.append("set-cookie", cookie);
  return res;
}

const spud = `<div class="spud" role="img" aria-label="Spud, the eait mascot">${spudSvg("wave", "spud-start")}</div>`;

const bubbles = (lines: readonly string[]): string =>
  lines.map((line) => `<p class="bubble">${escape(line)}</p>`).join("");

export interface SignInButton { href: string; label: string }

/**
 * The front door. ONE BUTTON PER CONFIGURED PROVIDER, in the order the caller gives them.
 *
 * The FIRST is the primary one, which is how the app's sign-in screen reads too: Apple, then
 * Google. That ordering is not house style — the one that asks for the least should not be the
 * button that looks like the afterthought.
 */
export function frontDoor(
  welcome: readonly string[], buttons: readonly SignInButton[], error: string | null,
): string {
  return shell("Start with eait", `
${spud}
<h1>eait</h1>
${error ? `<p class="notice">${escape(error)}</p>` : ""}
${bubbles(welcome)}
<p class="muted">${escape(PAGE_COPY.frontDoorLead)}</p>
${buttons.map((b, i) =>
  `<a class="button${i === 0 ? " primary" : ""}" href="${escape(b.href)}">${escape(b.label)}</a>`,
).join("\n")}
<p class="small muted">${escape(PAGE_COPY.frontDoorPrivacy)}</p>
`);
}

export interface QuestionOption { value: string; label: string; hint?: string }

export interface QuestionView {
  promptId: string;
  kind: "choice" | "number" | "chips";
  lines: readonly string[];
  options: readonly QuestionOption[];
  placeholder: string | null;
  /** The server's own refusal, rendered rather than re-implemented. */
  error: string | null;
  /**
   * Extra submit buttons above the normal control — the app's quick replies, which is what they
   * are: "Switch to losing" when the target runs the wrong way, "That's my real age" when the year
   * says under sixteen. A refusal whose words offer a way out has to carry the way out.
   */
  actions: readonly { name: string; value: string; label: string }[];
  step: number;
  total: number;
}

export function question(v: QuestionView): string {
  const hidden = `<input type="hidden" name="prompt" value="${escape(v.promptId)}">`;
  let controls: string;
  if (v.kind === "choice") {
    // One button per option: with no JavaScript, a radio group needs a second tap on a submit
    // button, and the app's version is one tap.
    controls = v.options.map((o) =>
      `<button type="submit" name="answer" value="${escape(o.value)}">${escape(o.label)}` +
      `${o.hint ? `<span class="hint">${escape(o.hint)}</span>` : ""}</button>`).join("");
  } else if (v.kind === "number") {
    controls =
      `<input type="number" name="answer" inputmode="decimal" step="any" required autofocus` +
      `${v.placeholder ? ` placeholder="${escape(v.placeholder)}"` : ""}>` +
      `<button class="primary" type="submit">Continue</button>`;
  } else {
    controls = v.options.map((o) =>
      `<label class="check"><input type="checkbox" name="answer" value="${escape(o.value)}"> ` +
      `${escape(o.label)}</label>`).join("") +
      `<button class="primary" type="submit">Continue</button>`;
  }
  const actions = v.actions.map((a) =>
    `<button type="submit" name="${escape(a.name)}" value="${escape(a.value)}">${escape(a.label)}</button>`,
  ).join("");
  return shell("eait", `
<p class="progress">QUESTION ${v.step} OF ${v.total}</p>
${v.error ? `<p class="notice">${escape(v.error)}</p>` : ""}
${bubbles(v.lines)}
<form method="post" action="/start/q">${hidden}${actions}${controls}</form>
`);
}

/**
 * The end of the road, and the only page here with nothing to press.
 *
 * Its one caller is the under-sixteen stop, whose words promise that nothing was kept — so the
 * account is deleted before this renders. A page that said it while a row survived would be the
 * worst sentence on this surface.
 */
export function stopped(title: string, body: string, lines: readonly string[]): string {
  return shell(title, `
${spud}
<h1>${escape(title)}</h1>
<p class="muted">${escape(body)}</p>
${bubbles(lines)}
`);
}

export interface PlanView {
  /** Which provider signed this account in, so the app instruction can name that button. */
  signedInWith: "apple" | "google" | null;
  kcal: number;
  proteinG: number;
  floorApplied: boolean;
  floorKcal: number;
  checkoutUrl: string | null;
}

export function plan(v: PlanView): string {
  return shell("Your plan", `
<h1>${escape(PAGE_COPY.planHeading)}</h1>
<p class="muted">${escape(PAGE_COPY.planLead)}</p>
<div class="card">
  <p class="figure">${v.kcal} kcal</p>
  <p class="muted">a day, with at least ${v.proteinG} g of protein</p>
</div>
${v.floorApplied
  ? `<p class="notice care">${escape(PAGE_COPY.planFloor)} The floor is ${v.floorKcal} kcal.</p>`
  : ""}
${v.checkoutUrl
  ? `<a class="button primary" href="${escape(v.checkoutUrl)}">${escape(PAGE_COPY.planCheckout)}</a>`
  : ""}
<h2>${escape(PAGE_COPY.planAppHeading)}</h2>
<p class="muted">${escape(v.signedInWith === null
  ? PAGE_COPY.planAppBodyGeneric
  : PAGE_COPY.planAppBody.replace("{provider}", v.signedInWith === "apple" ? "Apple" : "Google"))}</p>
`);
}
