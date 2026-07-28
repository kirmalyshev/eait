// `Bun.serve` over the router. Builtin, no dependency — the same builtin-first choice `Bun.sql`
// represents, and it keeps the bot owning the process: long-polling and graceful stop stay where
// they are, and the API is one more thing the composition root starts.

import { createRouter, MAX_UPLOAD_BYTES, type ResolveUserId } from "./routes.ts";
import type { EngineDeps } from "../engine/index.ts";

export interface ApiServer {
  port: number;
  stop: () => Promise<void>;
}

/**
 * Start the HTTP API. Returns null when `API_PORT` is unset — the API is OPT-IN, because a bot
 * that has always been long-polling-only should not start listening on a port because it was
 * upgraded. Opening a socket is not a silent default.
 *
 * `resolveUserId` has no default and cannot be omitted. An authentication scheme that defaults to
 * anything is an authentication scheme that is off, and this endpoint reaches every user's diary.
 */
export function startApi(
  deps: EngineDeps,
  resolveUserId: ResolveUserId,
  net: { apiPort: number | null; apiHost: string },
): ApiServer | null {
  if (net.apiPort === null) return null;
  const handle = createRouter(deps, resolveUserId);
  const server = Bun.serve({
    port: net.apiPort,
    // Loopback unless API_HOST says otherwise — see the note on Config.apiHost. Read from config
    // rather than process.env because config.ts is the one place env is loaded.
    hostname: net.apiHost,
    // The real bound. The router rejects an oversized upload from its Content-Length, but a client
    // can understate or omit that header — only the server can stop the body from being read.
    // Headroom over MAX_UPLOAD_BYTES for the multipart envelope around the photo itself.
    maxRequestBodySize: MAX_UPLOAD_BYTES + 1024 * 1024,
    fetch: handle,
  });
  console.log(`[eait] api listening on ${server.hostname}:${server.port}`);
  return { port: Number(server.port), stop: async () => void server.stop(true) };
}
