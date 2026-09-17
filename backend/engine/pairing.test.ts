import { beforeEach, describe, expect, it } from "bun:test";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import type { EngineDeps } from "./deps.ts";
import { identitiesFor, isAnonymous, linkTelegram } from "./identity.ts";
import { PAIR_TTL_MS, mintPairingCode, redeemPairingCode } from "./pairing.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
};

let store: Store;
let deps: EngineDeps;

/** A device-anonymous account, which is the one this whole flow exists for. */
const anonymous = async () =>
  (await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;

beforeEach(() => {
  store = memoryStore();
  deps = { store, config: CONFIG, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
});

describe("minting", () => {
  it("hands back a code in the alphabet a person can read out, and when it dies", async () => {
    const userId = await anonymous();
    const before = Date.now();
    const { code, expiresAt } = await mintPairingCode(deps, userId);

    // The literal, not the constant it is testing: eight is a decision somebody made, and an
    // assertion against the same constant the code reads would follow it wherever it moved.
    expect(code).toHaveLength(8);
    // Crockford base32: no I, L, O or U. The first three are what somebody reading a code off a
    // phone screen confuses with 1 and 0; the fourth is excluded so no code spells a word.
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
    const ttl = Date.parse(expiresAt) - before;
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(PAIR_TTL_MS + 1_000);
  });

  it("does not mint the same code twice", async () => {
    const userId = await anonymous();
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add((await mintPairingCode(deps, userId)).code);
    expect(seen.size).toBe(50);
  });

  it("keeps ONE live code per account — the previous one is dead the moment a new one is shown", async () => {
    const userId = await anonymous();
    const first = await mintPairingCode(deps, userId);
    const second = await mintPairingCode(deps, userId);
    expect(await redeemPairingCode(deps, first.code)).toBeNull();
    expect(await redeemPairingCode(deps, second.code)).not.toBeNull();
  });
});

describe("redeeming", () => {
  it("mints an ordinary session token on the account that minted the code", async () => {
    const userId = await anonymous();
    const { code } = await mintPairingCode(deps, userId);

    const token = await redeemPairingCode(deps, code);
    expect(token).not.toBeNull();
    // The SAME thing `userIdForToken` resolves — no second auth path was invented.
    expect(await store.userIdForToken(token!)).toBe(userId);
  });

  it("works once", async () => {
    const userId = await anonymous();
    const { code } = await mintPairingCode(deps, userId);
    expect(await redeemPairingCode(deps, code)).not.toBeNull();
    expect(await redeemPairingCode(deps, code)).toBeNull();
  });

  it("refuses a code past its TTL", async () => {
    // The deadline is stamped from the wall clock, exactly as a proposed meal's is, and the STORE
    // is what decides whether it has passed. So time moves here by moving the store's clock.
    let ahead = 0;
    const s = memoryStore({ now: () => Date.now() + ahead });
    const d: EngineDeps = { ...deps, store: s };
    const userId = (await s.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;
    const { code } = await mintPairingCode(d, userId);

    ahead = PAIR_TTL_MS + 1_000;
    expect(await redeemPairingCode(d, code)).toBeNull();
  });

  it("takes a code the way a person types one — lower case, spaces, dashes", async () => {
    const userId = await anonymous();
    const { code } = await mintPairingCode(deps, userId);
    const typed = ` ${code.slice(0, 4).toLowerCase()}-${code.slice(4).toLowerCase()} `;
    expect(await store.userIdForToken((await redeemPairingCode(deps, typed))!)).toBe(userId);
  });

  it("refuses a malformed code WITHOUT touching the store", async () => {
    // No oracle, and no hash of garbage: anything that is not eight symbols of the alphabet cannot
    // be a code this server minted, so the store is never asked about it. `I`, `L`, `O` and `U`
    // are not in the alphabet and are refused here rather than silently mapped.
    let asked = 0;
    const watched: Store = {
      ...store,
      claimPairingCode: async (h) => { asked++; return store.claimPairingCode(h); },
    };
    const d: EngineDeps = { ...deps, store: watched };
    for (const bad of ["", "SHORT", "TOOLONGCODE", "ABCD234!", "ABCDILOU", "ABCD 2345 6"]) {
      expect(await redeemPairingCode(d, bad)).toBeNull();
    }
    expect(asked).toBe(0);
  });

  it("refuses a well-formed code nobody minted", async () => {
    expect(await redeemPairingCode(deps, "ABCD2345")).toBeNull();
  });
});

describe("what pairing must never do", () => {
  /**
   * The ticket's third acceptance line, as an assertion.
   *
   * Redemption hands a browser a session on an account that already exists. It is not a sign-in, so
   * it creates no user; it is not an identity, so it links no provider and merges nothing. A
   * paired account is still anonymous, and `engine/identity.ts` is not in this diff at all.
   */
  it("creates no user, links no identity, and leaves the account anonymous", async () => {
    const userId = await anonymous();
    const before = await identitiesFor(deps, userId);
    expect(await isAnonymous(deps, userId)).toBe(true);

    const { code } = await mintPairingCode(deps, userId);
    const token = await redeemPairingCode(deps, code);

    expect(await store.userIdForToken(token!)).toBe(userId);
    // Same identities, still only the device one, still anonymous. A merge or a link would show up
    // in every one of these.
    expect(await identitiesFor(deps, userId)).toEqual(before);
    expect((await identitiesFor(deps, userId)).map((i) => i.provider)).toEqual(["device"]);
    expect(await isAnonymous(deps, userId)).toBe(true);
  });

  it("grants nothing: the paired session carries the account's own entitlement and sample", async () => {
    const userId = await anonymous();
    const { code } = await mintPairingCode(deps, userId);
    await redeemPairingCode(deps, code);
    // Nothing about pairing writes an entitlement — only the RevenueCat webhook can.
    expect(await store.getEntitlement(userId)).toBeNull();
    expect(await store.countUserAnalyses(userId)).toBe(0);
  });
});

describe("linking Telegram with a code", () => {
  // A made-up id in Telegram's range. Never a real one: this repository is public.
  const TG = "7000000001";

  it("attaches the Telegram id to the account that minted the code, and spends the code", async () => {
    const userId = await anonymous();
    const { code } = await mintPairingCode(deps, userId);

    expect(await linkTelegram(deps, code, TG)).toBe("linked");
    expect(await store.userIdForIdentity("telegram", TG)).toBe(userId);
    expect(await linkTelegram(deps, code, TG)).toBe("invalid");
  });

  it("takes the code the way the pairing form does, and refuses one nobody minted", async () => {
    const userId = await anonymous();
    const { code } = await mintPairingCode(deps, userId);
    expect(await linkTelegram(deps, "ABCD2345", TG)).toBe("invalid");
    expect(await linkTelegram(deps, "", TG)).toBe("invalid");
    expect(await linkTelegram(deps, ` ${code.toLowerCase()} `, TG)).toBe("linked");
  });

  it("is a no-op success when this Telegram is already on this account", async () => {
    const userId = await anonymous();
    await linkTelegram(deps, (await mintPairingCode(deps, userId)).code, TG);
    expect(await linkTelegram(deps, (await mintPairingCode(deps, userId)).code, TG)).toBe("linked");
    expect((await identitiesFor(deps, userId)).filter((i) => i.provider === "telegram")).toHaveLength(1);
  });

  it("MOVES a Telegram id another account holds, which is how a link made by mistake is undone", async () => {
    // A code can be sent to somebody and pressed — so a Telegram can end up on a stranger's
    // account. Moving needs both halves at once: this Telegram, and a code minted inside a session
    // of the account it moves to. Refusing instead left the stranger receiving the photos forever.
    const first = await anonymous();
    const second = await anonymous();
    await linkTelegram(deps, (await mintPairingCode(deps, first)).code, TG);

    expect(await linkTelegram(deps, (await mintPairingCode(deps, second)).code, TG)).toBe("moved");
    expect(await store.userIdForIdentity("telegram", TG)).toBe(second);
    // The account it came off keeps everything else, and is not erased even if it has nothing left.
    expect((await identitiesFor(deps, first)).map((i) => i.provider)).toEqual(["device"]);
    expect(await store.getProfile(first)).not.toBeNull();

    // And back again, because the person who owns the Telegram always can.
    expect(await linkTelegram(deps, (await mintPairingCode(deps, first)).code, TG)).toBe("moved");
    expect(await store.userIdForIdentity("telegram", TG)).toBe(first);
  });
});
