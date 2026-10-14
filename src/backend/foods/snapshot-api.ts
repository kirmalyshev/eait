// A fooddb snapshot export, fetched from the API with a read key.
//
// fooddb keeps ONE current snapshot (eait-fit/fooddb#87): `/v1/snapshots` lists that single item
// as `{day, built_at, products}` and the export endpoint serves its day only — a stale day is a
// 404. `built_at` is the discriminator: a rebuild of the same day is new data. The key travels in
// the Authorization header and nowhere else: it is not put in a URL, and no message here includes
// a header, a URL's query or the key itself.

export const FOODDB_URL_DEFAULT = "https://food-api.eait.fit";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** What a refusal says, by status: the response body can carry a portal link but never our key. */
const REFUSED: Record<number, string> = {
  401: "the read key was refused (EAIT__BACKEND__FOODDB_READ_KEY)",
  402: "the account is out of credits - buy a pack in the fooddb portal",
  403: "the key has no read scope",
  404: "no such snapshot day (fooddb serves only the current one)",
};

async function get(fetchFn: Fetch, url: string, key: string, accept: string): Promise<Response> {
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${key}`, Accept: accept, "Accept-Encoding": "gzip" } });
  if (!res.ok) throw new Error(`fooddb ${res.status}: ${REFUSED[res.status] ?? "request failed"}`);
  return res;
}

/** The single snapshot fooddb currently serves: its day and when it was built. */
export async function currentSnapshot(key: string, opts: { base?: string; fetchFn?: Fetch } = {}): Promise<{ day: string; built_at: string }> {
  if (!key.trim()) throw new Error("no fooddb read key: set EAIT__BACKEND__FOODDB_READ_KEY");
  const base = (opts.base ?? FOODDB_URL_DEFAULT).replace(/\/+$/, "");
  const list = (await (await get(opts.fetchFn ?? fetch, `${base}/v1/snapshots`, key, "application/json")).json()) as
    { items?: { day: string; built_at: string }[] };
  const snap = list.items?.[0];
  if (!snap) throw new Error("fooddb has no snapshot yet");
  return { day: snap.day, built_at: snap.built_at };
}

/** The export of `day` (default: the current snapshot's day) as NDJSON text, and the day it was. */
export async function fetchSnapshotExport(
  key: string, opts: { base?: string; day?: string; fetchFn?: Fetch } = {},
): Promise<{ day: string; ndjson: string }> {
  if (!key.trim()) throw new Error("no fooddb read key: set EAIT__BACKEND__FOODDB_READ_KEY");
  const base = (opts.base ?? FOODDB_URL_DEFAULT).replace(/\/+$/, "");
  const fetchFn = opts.fetchFn ?? fetch;
  const day = opts.day ?? (await currentSnapshot(key, { base, fetchFn })).day;
  const res = await get(fetchFn, `${base}/v1/snapshots/${encodeURIComponent(day)}/export`, key, "application/x-ndjson");
  return { day, ndjson: await res.text() };
}
