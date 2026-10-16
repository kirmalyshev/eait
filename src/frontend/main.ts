// The web application — the entry point `bun build` bundles.
//
// Everything the surfaces share — the top bar, `render()`, the language binding, the profile
// cache, the turn/outbox plumbing — is `shell.ts`; each surface is one module under `screens/`
// (#87). This file is the route table and the boot: W-packages add their route as ONE LINE here —
// `#/meal/` (W6) binds the prefix, `#/progress` (W8) binds exactly — and never touch the shell.
import { screen, start } from "./shell.ts";
import { chatScreen } from "./screens/chat.ts";
import { logScreen } from "./screens/log.ts";
import { progressScreen } from "./screens/progress.ts";
import { weighInsScreen } from "./screens/weigh-ins.ts";
import { youScreen } from "./screens/you.ts";
import { mealScreen } from "./screens/meal.ts";
import { homeScreen } from "./screens/today.ts";
import { payScreen } from "./screens/pay.ts";
import { checkAwardsSoon, milestoneSettingsScreen, milestonesScreen } from "./screens/milestones.ts";
import { onWrite } from "./api.ts";
import { acceptDrops, restoreJobs } from "./queue.ts";
import { startPush } from "./push.ts";

// The new-award popup (#2148) follows any write: the server decides what was earned.
onWrite(checkAwardsSoon);
// `#/` LAST: it is the fallthrough an unclaimed route lands on, as it always has.
screen("#/meal/", (frame) => mealScreen(frame));
screen("#/chat", (frame) => chatScreen(frame));
screen("#/pay", (frame) => payScreen(frame));
screen("#/log", (frame) => logScreen(frame));
screen("#/progress", (frame) => progressScreen(frame));
screen("#/progress/weigh-ins", (frame) => weighInsScreen(frame));
screen("#/you", (frame) => youScreen(frame));
screen("#/you/settings", (frame) => youScreen(frame, "settings"));
screen("#/you/milestones", (frame) => milestoneSettingsScreen(frame));
screen("#/milestones", (frame) => milestonesScreen(frame));
screen("#/", (frame) => homeScreen(frame));

void start().then(restoreJobs).then(() => startPush().catch(() => {}));
acceptDrops();
