import { beforeEach, describe, expect, it } from "bun:test";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "./index.ts";
import { PUSH_STATS_MAX_DAYS, pushOpenView, recordPushOpen } from "./push-open.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  timezone: "Europe/Berlin",
};

let store: Store;
let deps: EngineDeps;

beforeEach(() => {
  store = memoryStore();
  deps = { store, config: CONFIG, llm: demoPorts(), push: fakePush() };
});

async function userWithSend(): Promise<{ userId: string; sendId: string }> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const sendId = crypto.randomUUID();
  await store.createSend(userId, {
    id: sendId, kind: "campaign", ref: null, templateKey: "t1", lang: "en", variant: null,
    token: "ExponentPushToken[x]", state: "accepted",
  });
  return { userId, sendId };
}

describe("recordPushOpen", () => {
  it("answers ok however many times the phone reports, and counts the send opened once", async () => {
    const { userId, sendId } = await userWithSend();
    expect(await recordPushOpen(deps, userId, { sendId })).toEqual({ ok: true });
    expect(await recordPushOpen(deps, userId, { sendId, action: "reply" })).toEqual({ ok: true });
    const view = await pushOpenView(deps, 7);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({ templateKey: "t1", sent: 1, accepted: 1, opened: 1 });
  });

  it("answers the same for another account's send, and records nothing", async () => {
    const { sendId } = await userWithSend();
    const { userId: stranger } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    expect(await recordPushOpen(deps, stranger, { sendId })).toEqual({ ok: true });
    expect((await pushOpenView(deps, 7)).rows[0]!.opened).toBe(0);
  });
});

describe("pushOpenView", () => {
  it("dates the days in the instance zone and says so", async () => {
    await userWithSend();
    const view = await pushOpenView(deps, 7);
    expect(view.timezone).toBe("Europe/Berlin");
    expect(view.days).toBe(7);
  });

  it("bounds the window", async () => {
    expect((await pushOpenView(deps, 100_000)).days).toBe(PUSH_STATS_MAX_DAYS);
    expect((await pushOpenView(deps, 0)).days).toBe(1);
    expect((await pushOpenView(deps, Number.NaN)).days).toBe(7);
  });
});
