import { describe, expect, test } from "bun:test";
import { fetchSnapshotExport } from "./snapshot-api.ts";

const KEY = "fdb_secret_value";
const fake = (routes: Record<string, () => Response>, seen: { url: string; auth: string | null }[] = []) =>
  async (url: string, init?: RequestInit) => {
    seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
    const r = routes[new URL(url).pathname];
    return r ? r() : new Response("{}", { status: 404 });
  };
const list = (items: unknown[]) => () => Response.json({ items });

describe("fetching a snapshot export", () => {
  test("takes the newest FINAL day, sends the key as a bearer, and returns the lines", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const r = await fetchSnapshotExport(KEY, { base: "https://f.test/", fetchFn: fake({
      "/v1/snapshots": list([{ day: "2026-10-08", final: false }, { day: "2026-10-07", final: true }]),
      "/v1/snapshots/2026-10-07/export": () => new Response('{"id":1}\n{"id":2}\n'),
    }, seen) });
    expect(r).toEqual({ day: "2026-10-07", ndjson: '{"id":1}\n{"id":2}\n' });
    expect(seen.every((s) => s.auth === `Bearer ${KEY}`)).toBe(true);
    expect(seen.every((s) => !s.url.includes(KEY))).toBe(true);
  });
  test("a named day skips the list", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    await fetchSnapshotExport(KEY, { day: "2026-09-30", fetchFn: fake({ "/v1/snapshots/2026-09-30/export": () => new Response("") }, seen) });
    expect(seen.map((s) => new URL(s.url).pathname)).toEqual(["/v1/snapshots/2026-09-30/export"]);
  });
  test("no final day is an error, not an empty load", async () => {
    await expect(fetchSnapshotExport(KEY, { fetchFn: fake({ "/v1/snapshots": list([{ day: "2026-10-08", final: false }]) }) }))
      .rejects.toThrow(/no final snapshot/);
  });
  test("a refusal names the cause and never the key", async () => {
    for (const status of [401, 402, 403]) {
      const err = await fetchSnapshotExport(KEY, { fetchFn: fake({ "/v1/snapshots": () => new Response(`bad ${KEY}`, { status }) }) }).catch((e: Error) => e);
      expect((err as Error).message).toContain(String(status));
      expect((err as Error).message).not.toContain(KEY);
    }
  });
  test("a missing key says which variable to set", async () => {
    await expect(fetchSnapshotExport("  ")).rejects.toThrow(/EAIT__BACKEND__FOODDB_READ_KEY/);
  });
});
