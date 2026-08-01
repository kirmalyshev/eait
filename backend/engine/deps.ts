// What the engine needs, and deliberately nothing more.
//
// No `Response`, no router, no Express-shaped anything. The engine is transport-agnostic so that
// the HTTP API is one front end rather than the only conceivable one — the same discipline that
// made this app buildable on top of eait's engine in the first place.

import type { Config } from "../config.ts";
import type { Store } from "../store.ts";
import type { LlmPorts } from "../llm/port.ts";

export interface EngineDeps {
  store: Store;
  config: Config;
  llm: LlmPorts;
}
