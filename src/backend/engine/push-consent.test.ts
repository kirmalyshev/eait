import { beforeEach, describe, expect, it } from "bun:test";
import { configDefaults } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { EngineDeps } from "./index.ts";
import { pushConsent, setPushConsent } from "./push-consent.ts";

let deps: EngineDeps;
let userId: string;
beforeEach(async () => {
  const store = memoryStore();
  deps = { store, config: { ...configDefaults(), port: 0, databaseUrl: "memory://t" }, llm: demoPorts(), push: fakePush() };
  userId = (await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;
});

describe("tips-and-offers consent", () => {
  it("is OFF with no timestamp until the person turns it on", async () => {
    expect(await pushConsent(deps, userId)).toEqual({ offers: false, at: null });
  });

  it("turning it on stores the moment; turning it off clears it", async () => {
    const before = Date.now();
    const on = await setPushConsent(deps, userId, true);
    expect(on.offers).toBe(true);
    expect(Date.parse(on.at!)).toBeGreaterThanOrEqual(before - 1000);
    expect(await pushConsent(deps, userId)).toEqual(on);
    expect(await setPushConsent(deps, userId, false)).toEqual({ offers: false, at: null });
  });

  it("turning it on twice keeps the first moment", async () => {
    const first = await setPushConsent(deps, userId, true);
    await new Promise((r) => setTimeout(r, 5));
    expect(await setPushConsent(deps, userId, true)).toEqual(first);
  });

  it("is per account", async () => {
    const other = (await deps.store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;
    await setPushConsent(deps, userId, true);
    expect((await pushConsent(deps, other)).offers).toBe(false);
  });
});
