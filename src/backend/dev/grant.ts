// Every account a development store creates is granted `n` analyses, through the admin's own path
// (`Store.setFreeAnalyses`). There is no default sample (ieat-app#2364); a demo, the e2e runners and
// the tests get theirs this way, so no switch on the paywall exists to be left off in production.

import type { Store } from "../store.ts";

export function grantEveryAccount(store: Store, n: number): Store {
  return {
    ...store,
    async upsertDeviceUser(deviceId, lang) {
      const r = await store.upsertDeviceUser(deviceId, lang);
      if (r.created) await store.setFreeAnalyses(r.userId, n);
      return r;
    },
    async createUser(lang) {
      const id = await store.createUser(lang);
      await store.setFreeAnalyses(id, n);
      return id;
    },
  };
}
