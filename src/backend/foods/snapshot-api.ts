// A fooddb snapshot export, fetched from the API with a read key.
//
// The newest FINAL day (a day still in progress can be rebuilt), or the day the caller names. The
// key travels in the Authorization header and nowhere else: it is not put in a URL, and no message
// here includes a header, a URL's query or the key itself.

export const FOODDB_URL_DEFAULT = "https://food-api.eait.fit";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** What a refusal says, by status: the response body can carry a portal link but never our key. */
const REFUSED: Record<number, string> = {
  401: "the read key was refused (EAIT__BACKEND__FOODDB_READ_KEY)",
  402: "the account is out of credits - buy a pack in the fooddb portal",
  403: "the key has no read scope",
  404: "no such snapshot day",
};

async function get(fetchFn: Fetch, url: string, key: string, accept: string): Promise<Response> {
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${key}`, Accept: accept, "Accept-Encoding": "gzip" } });
  if (!res.ok) throw new Error(`fooddb ${res.status}: ${REFUSED[res.status] ?? "request failed"}`);
  return res;
}

/** The newest day fooddb calls final (a day in progress can still be rebuilt). */
export async function newestFinalDay(key: string, opts: { base?: string; fetchFn?: Fetch } = {}): Promise<string> {
  if (!key.trim()) throw new Error("no fooddb read key: set EAIT__BACKEND__FOODDB_READ_KEY");
  const base = (opts.base ?? FOODDB_URL_DEFAULT).replace(/\/+$/, "");
  const list = (await (await get(opts.fetchFn ?? fetch, `${base}/v1/snapshots`, key, "application/json")).json()) as
    { items?: { day: string; final: boolean }[] };
  const day = list.items?.find((d) => d.final)?.day;
  if (!day) throw new Error("fooddb has no final snapshot day yet");
  return day;
}

/** The export of `day` (default: the newest final day) as NDJSON text, and the day it was. */
export async function fetchSnapshotExport(
  key: string, opts: { base?: string; day?: string; fetchFn?: Fetch } = {},
): Promise<{ day: string; ndjson: string }> {
  if (!key.trim()) throw new Error("no fooddb read key: set EAIT__BACKEND__FOODDB_READ_KEY");
  const base = (opts.base ?? FOODDB_URL_DEFAULT).replace(/\/+$/, "");
  const fetchFn = opts.fetchFn ?? fetch;
  const day = opts.day ?? await newestFinalDay(key, { base, fetchFn });
  const res = await get(fetchFn, `${base}/v1/snapshots/${encodeURIComponent(day)}/export`, key, "application/x-ndjson");
  return { day, ndjson: await res.text() };
}
