// The web application — the entry point `bun build` bundles.
//
// Everything the surfaces share — the top bar, `render()`, the language binding, the profile
// cache, the turn/outbox plumbing — is `shell.ts`; each surface is one module under `screens/`
// (#87). This file is the route table and the boot: W-packages add their route as ONE LINE here —
// `#/meal/` (W6) binds the prefix, `#/progress` (W8) binds exactly — and never touch the shell.
import { screen, start } from "./shell.ts";
import { chatScreen } from "./screens/chat.ts";
import { logScreen } from "./screens/log.ts";
import { youScreen } from "./screens/you.ts";
import { homeScreen } from "./screens/today.ts";

// `#/` LAST: it is the fallthrough an unclaimed route lands on, as it always has.
screen("#/chat", () => chatScreen());
screen("#/log", (frame) => logScreen(frame));
screen("#/you", (frame) => youScreen(frame.me));
screen("#/", (frame) => homeScreen(frame.me));

start();
