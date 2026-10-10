// What the engine needs, and deliberately nothing more.
//
// No `Response`, no router, no Express-shaped anything. The engine is transport-agnostic so that
// the HTTP API is one front end rather than the only conceivable one — the same discipline that
// made this app buildable on top of eait's engine in the first place.

import type { Config } from "../config.ts";
import type { Store } from "../store.ts";
import type { LlmPorts } from "../llm/port.ts";
import type { MailPort } from "../mail/port.ts";
import type { PushPort } from "../push/port.ts";

export interface EngineDeps {
  store: Store;
  config: Config;
  llm: LlmPorts;
  /**
   * How a notification reaches a phone.
   *
   * A port for the same reason `llm` is one: the nightly sweep composes a sentence about
   * somebody's day, and proving it says the right thing must not need Expo, a device, or a
   * network. A process with no Expo credential gets the logging implementation.
   */
  push: PushPort;
  /**
   * How a sign-in code reaches an inbox (#569). Same port argument as `push`: a dev run, a test
   * and `--demo` get the `log` implementation, which prints the code instead of delivering it.
   */
  mail: MailPort;
}
