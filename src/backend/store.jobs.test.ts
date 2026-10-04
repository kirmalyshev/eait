// The durable job queue (#414) through the `Store` port, against BOTH stores: the memory one the
// engine tests run on, and Postgres, where pg-boss holds the job. Postgres is SKIPPED, loudly, when
// `TEST_DATABASE_URL` is unset; `./dev test` sets it.
//
// claimJob, releaseJobs and expireJobs are global by definition, so every job here is of a kind
// this run owns (`RUN`) and the registry names only that kind: another run's leftovers in the same
// database are never claimed.

import { afterAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { memoryStore } from "./store.memory.ts";
import { postgresStore } from "./store.pg.ts";
import type { NewJob, Store } from "./store.ts";

const PG_URL = process.env.TEST_DATABASE_URL;
const RUN = crypto.randomUUID().slice(0, 8);
const KIND = `test${RUN}`;
const REGISTRY = [{ kind: KIND, version: 1 }];
const LEASE_MS = 30_000;
const UNKNOWN = { kind: "unknown" };

const device = () => crypto.randomUUID() + crypto.randomUUID();
const job = (over: Partial<NewJob> = {}): NewJob => ({
  clientId: crypto.randomUUID(), kind: KIND, requestVersion: 1, request: { n: 1 }, step: 2,
  photos: [{ mime: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 1]) }], ...over,
});

/** Claims until this run's queue is empty, so one test's job never leaks into the next one's claim. */
async function drain(s: Store, owner: string): Promise<void> {
  while (await s.claimJob(owner, REGISTRY, LEASE_MS)) { /* claimed */ }
  await s.expireJobs(Date.now() + 60_000, UNKNOWN);
}

function jobs(name: string, make: () => Promise<Store>) {
  describe(`job queue — ${name}`, () => {
    let store: Store | null = null;
    const open = async () => (store ??= await make());
    afterAll(async () => { await store?.close(); });

    const fresh = async () => {
      const s = await open();
      await drain(s, `drain-${RUN}`);
      const { userId } = await s.upsertDeviceUser(device(), "en");
      return { s, userId };
    };

    it("enqueues once per turn and shows the job queued with its photos", async () => {
      const { s, userId } = await fresh();
      const j = job();
      expect(await s.enqueueJob(userId, j)).toBe(true);
      expect(await s.enqueueJob(userId, j)).toBe(false);
      const got = await s.getJob(userId, j.clientId);
      expect(got).toMatchObject({ userId, clientId: j.clientId, kind: KIND, requestVersion: 1, request: { n: 1 },
        state: "queued", attempts: 0, step: 2, items: [], mealId: null, outcome: null });
      expect((await s.jobPhotos(userId, j.clientId)).map((p) => [...p.bytes])).toEqual([[0xff, 0xd8, 0xff, 1]]);
    });

    it("never shows one user's job to another", async () => {
      const { s, userId } = await fresh();
      const other = (await s.upsertDeviceUser(device(), "en")).userId;
      const j = job();
      await s.enqueueJob(userId, j);
      expect(await s.getJob(other, j.clientId)).toBeNull();
      expect((await s.listJobs(other, { state: "all", since: null, cursor: null, limit: 10 })).jobs).toEqual([]);
      expect(await s.removeJob(other, j.clientId)).toBe(false);
    });

    it("claims a job once, as running under the claimer", async () => {
      const { s, userId } = await fresh();
      const j = job();
      await s.enqueueJob(userId, j);
      const claimed = await s.claimJob("a", REGISTRY, LEASE_MS);
      expect(claimed).toMatchObject({ clientId: j.clientId, state: "running", attempts: 1, leaseOwner: "a" });
      expect(claimed!.leaseUntil).toBeGreaterThan(Date.now());
      expect(await s.claimJob("b", REGISTRY, LEASE_MS)).toBeNull();
    });

    it("claims only the request versions this build registers", async () => {
      const { s, userId } = await fresh();
      const j = job({ requestVersion: 2 });
      await s.enqueueJob(userId, j);
      expect(await s.claimJob("a", REGISTRY, LEASE_MS)).toBeNull();
      expect(await s.claimJob("a", [{ kind: KIND, version: 2 }], LEASE_MS)).toMatchObject({ clientId: j.clientId, requestVersion: 2 });
    });

    it("fences every write to the claimer that still holds the job", async () => {
      const { s, userId } = await fresh();
      const j = job();
      await s.enqueueJob(userId, j);
      await s.claimJob("a", REGISTRY, LEASE_MS);
      expect(await s.jobProgress(userId, j.clientId, "b", 3, [{ name: "x" }])).toBe(false);
      expect(await s.chargeJob(userId, j.clientId, "b", crypto.randomUUID())).toBe(false);
      expect(await s.settleJob(userId, j.clientId, "b", { kind: "done" })).toBe(false);
      expect(await s.jobProgress(userId, j.clientId, "a", 3, [{ name: "x" }])).toBe(true);
      const analysisId = "1"; // analyses.id is a bigserial: a numeric id, never a uuid
      expect(await s.chargeJob(userId, j.clientId, "a", analysisId)).toBe(true);
      expect(await s.getJob(userId, j.clientId)).toMatchObject({ step: 3, items: [{ name: "x" }], analysisId, state: "running" });
    });

    it("settles once: the turn keeps the outcome and the unadopted photos go", async () => {
      const { s, userId } = await fresh();
      const j = job();
      await s.enqueueJob(userId, j);
      await s.claimJob("a", REGISTRY, LEASE_MS);
      expect(await s.settleJob(userId, j.clientId, "a", { kind: "done" })).toBe(true);
      expect(await s.settleJob(userId, j.clientId, "a", { kind: "again" })).toBe(false);
      expect(await s.getJob(userId, j.clientId)).toMatchObject({ state: "settled", outcome: { kind: "done" } });
      expect(await s.getTurn(userId, j.clientId)).toMatchObject({ outcome: { kind: "done" } });
      expect(await s.jobPhotos(userId, j.clientId)).toEqual([]);
      expect(await s.removeJob(userId, j.clientId)).toBe(false);
    });

    it("hands a released job to the next claimer as a second attempt, and fences the first one out", async () => {
      const { s, userId } = await fresh();
      const j = job();
      const [a, b] = [`a-${crypto.randomUUID()}`, `b-${crypto.randomUUID()}`];
      await s.enqueueJob(userId, j);
      await s.claimJob(a, REGISTRY, LEASE_MS);
      expect(await s.heartbeatJobs(a, LEASE_MS)).toBe(1);
      expect(await s.releaseJobs(a)).toBe(1);
      expect(await s.getJob(userId, j.clientId)).toMatchObject({ state: "queued", leaseOwner: null });
      expect(await s.heartbeatJobs(a, LEASE_MS)).toBe(0);
      expect(await s.claimJob(b, REGISTRY, LEASE_MS)).toMatchObject({ clientId: j.clientId, attempts: 2, leaseOwner: b });
      expect(await s.jobProgress(userId, j.clientId, a, 3, [])).toBe(false);
      expect(await s.settleJob(userId, j.clientId, b, { kind: "done" })).toBe(true);
    });

    it("expires a job nobody ran: settled with the outcome given, its photos gone", async () => {
      const { s, userId } = await fresh();
      const j = job();
      await s.enqueueJob(userId, j);
      expect(await s.expireJobs(Date.now() - 60_000, UNKNOWN)).toEqual([]);
      const gone = await s.expireJobs(Date.now() + 60_000, UNKNOWN);
      expect(gone).toContainEqual({ userId, clientId: j.clientId });
      expect(await s.getJob(userId, j.clientId)).toMatchObject({ state: "settled", outcome: UNKNOWN });
      expect(await s.jobPhotos(userId, j.clientId)).toEqual([]);
      expect(await s.claimJob("a", REGISTRY, LEASE_MS)).toBeNull();
    });

    it("lists the caller's jobs by state, newest change first", async () => {
      const { s, userId } = await fresh();
      const a = job(), b = job();
      await s.enqueueJob(userId, a);
      await s.enqueueJob(userId, b);
      await s.claimJob("w", REGISTRY, LEASE_MS);
      const claimed = (await s.listJobs(userId, { state: "active", since: null, cursor: null, limit: 10 })).jobs.find((x) => x.state === "running")!;
      await s.settleJob(userId, claimed.clientId, "w", { kind: "done" });
      const active = await s.listJobs(userId, { state: "active", since: null, cursor: null, limit: 10 });
      const settled = await s.listJobs(userId, { state: "settled", since: null, cursor: null, limit: 10 });
      expect(active.jobs.map((x) => x.clientId)).toEqual([claimed.clientId === a.clientId ? b.clientId : a.clientId]);
      expect(settled.jobs.map((x) => x.clientId)).toEqual([claimed.clientId]);
      const all = await s.listJobs(userId, { state: "all", since: null, cursor: null, limit: 1 });
      expect(all.jobs).toHaveLength(1);
      expect(all.cursor).not.toBeNull();
      const next = await s.listJobs(userId, { state: "all", since: null, cursor: all.cursor, limit: 1 });
      expect(next.jobs.map((x) => x.clientId)).not.toContain(all.jobs[0]!.clientId);
    });

    it("pushes once, and never for a removed or followed job", async () => {
      const { s, userId } = await fresh();
      const pushed = job(), removed = job(), followed = job();
      for (const j of [pushed, removed, followed]) await s.enqueueJob(userId, j);
      expect(await s.removeJob(userId, removed.clientId)).toBe(true);
      expect((await s.getJob(userId, removed.clientId))!.removedAt).not.toBeNull();
      await s.followJob(userId, followed.clientId, Date.now() + 60_000);
      expect(await s.claimPush(userId, pushed.clientId)).toBe(true);
      expect(await s.claimPush(userId, pushed.clientId)).toBe(false);
      expect(await s.claimPush(userId, removed.clientId)).toBe(false);
      expect(await s.claimPush(userId, followed.clientId)).toBe(false);
    });
  });
}

jobs("memory", async () => memoryStore());

if (PG_URL) {
  jobs("postgres", () => postgresStore(PG_URL, { maxConnections: 2 }));

  // What only Postgres has: pg-boss's own states, and a row no foreign key reaches.
  describe("job queue — pg-boss", () => {
    let store: Store | null = null;
    const raw = new SQL(PG_URL, { max: 1 });
    const open = async () => (store ??= await postgresStore(PG_URL, { maxConnections: 2 }));
    afterAll(async () => { await store?.close(); await raw.end(); });

    it("keeps the job in pgboss.job, on the queue of its kind and version", async () => {
      const s = await open();
      await drain(s, `drain-${RUN}`);
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const j = job();
      await s.enqueueJob(userId, j);
      const rows = await raw`select name, state from pgboss.job where data->>'userId' = ${userId} and data->>'clientId' = ${j.clientId}`;
      expect(rows).toEqual([{ name: `${KIND}-v1`, state: "created" }]);
    });

    it("settles UNKNOWN a job pg-boss failed after its last attempt", async () => {
      const s = await open();
      await drain(s, `drain-${RUN}`);
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const j = job();
      await s.enqueueJob(userId, j);
      await s.claimJob("a", REGISTRY, LEASE_MS);
      // What pg-boss's monitor does once a job's heartbeat lapsed on its last attempt.
      await raw`update pgboss.job set state = 'failed', completed_on = now() where data->>'userId' = ${userId}`;
      expect(await s.expireJobs(Date.now() - 60_000, UNKNOWN)).toContainEqual({ userId, clientId: j.clientId });
      expect(await s.getJob(userId, j.clientId)).toMatchObject({ state: "settled", outcome: UNKNOWN });
      expect(await s.expireJobs(Date.now() - 60_000, UNKNOWN)).not.toContainEqual({ userId, clientId: j.clientId });
    });

    it("deletes a user's jobs with the user", async () => {
      const s = await open();
      await drain(s, `drain-${RUN}`);
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.enqueueJob(userId, job());
      await s.deleteUser(userId);
      expect((await raw`select id from pgboss.job where data->>'userId' = ${userId}`).length).toBe(0);
    });
  });
} else {
  describe("job queue — postgres", () => {
    it.skip("SKIPPED: run `./dev test` to run against real Postgres", () => {});
  });
}
