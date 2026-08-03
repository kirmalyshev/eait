// Per-address request limits, in memory.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT THIS IS FOR, AND WHAT IT IS NOT FOR
//
// `engine/caps.ts` bounds SPEND: a per-user photo allowance and a per-instance daily budget. Both
// are counted in the database and both are correct. Neither is a limit on requests, and the gap
// between those two things was exploitable in one line of curl:
//
//   `POST /v1/auth/device` mints an account and a token for anybody with a 32-character string, so
//   the per-user allowance costs an attacker one HTTP call to reset. The only real bound was the
//   GLOBAL budget — and exhausting THAT is the attack, not the defence: it spends the instance's
//   money and then refuses every legitimate user for the rest of the day.
//
// So the cap that closes it is per ADDRESS, applied to the routes that cost money and to the route
// that mints the accounts. An attacker behind one address can no longer buy more allowance by
// creating more accounts.
//
// IN MEMORY, DELIBERATELY. This is a single-process backend behind one reverse proxy on one box —
// `deploy/docker-compose.prod.yml` — so a shared store would be a second moving part for no gain.
// Two honest consequences, both of which are the right trade here and neither of which is a secret:
// a restart forgives everyone, and a second replica would double every limit. If this ever runs
// more than one container, this file is the thing that has to change.
//
// CARRIER-GRADE NAT IS THE REAL COST. A mobile network can put thousands of subscribers behind one
// address, so a limit low enough to matter is a limit that can refuse a stranger who did nothing.
// Every number here is therefore an environment variable with a generous default, and the analysis
// limit is set well above one person's own daily allowance on purpose.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** How many requests, over how long. */
export interface RateRule {
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  /** Null when the request may proceed; the seconds to wait when it may not. */
  check(key: string, rule: RateRule): number | null;
  /** How many addresses are being tracked. For the test that proves this is not a memory leak. */
  size(): number;
}

export interface RateLimiterOptions {
  now?: () => number;
  /**
   * Upper bound on tracked addresses.
   *
   * A scanner walking an IPv6 allocation presents a new key on every request, so without a ceiling
   * this map is a memory leak with a network interface attached. 20k entries is a few megabytes and
   * far more addresses than this instance will see legitimately.
   */
  maxKeys?: number;
  /**
   * How many new windows to open between sweeps.
   *
   * A sweep is O(tracked addresses), so doing one per insert is quadratic under exactly the
   * condition where it has to stay cheap — an address-flood, where every request is a new key.
   * Amortising it means a quiet server still forgets, and a loud one pays for it once every
   * `sweepEvery` inserts instead of every time.
   */
  sweepEvery?: number;
}

/**
 * The address a request is attributed to.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * READ THE LAST `X-Forwarded-For` VALUE, NEVER THE FIRST.
 *
 * The header is a list, and a proxy APPENDS what it saw to whatever arrived. Everything to the left
 * of the final entry was written by somebody upstream — including, on a request that came straight
 * off the internet, by the client itself. Caddy adds the peer address it observed on the right, so
 * the rightmost value is the only one this server has grounds to believe.
 *
 * Taking the leftmost is the usual advice, and it is right in a chain of proxies you own. Here it
 * would mean an attacker sends `X-Forwarded-For: <anything>` and gets a fresh bucket per request,
 * which is a limiter that is present, configured, and does nothing.
 *
 * Trusting the header AT ALL is only sound because nothing but Caddy can reach this process: the
 * backend publishes no port (`deploy/docker-compose.prod.yml`) and `roles/firewall` asserts that
 * against Docker's own view rather than against ufw's. If that ever stops being true, this becomes
 * a limiter an attacker can address themselves out of.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export function clientAddress(req: Request, socketPeer?: string | undefined): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    const observed = parts[parts.length - 1];
    if (observed) return normaliseAddress(observed);
  }
  if (socketPeer) return normaliseAddress(socketPeer);
  // Nothing to key on. ONE shared bucket rather than a unique key per request: the alternative is
  // an unlimited limiter that looks configured, which is the worst of both.
  return "unknown";
}

/**
 * IPv6 down to its /64, IPv4 as it stands.
 *
 * A residential IPv6 allocation is a /64 at the very least and often a /56, all of it addressable
 * by one person. Keying on 128 bits gives that person 18 quintillion buckets, which is the same as
 * giving them none. IPv4 has no equivalent problem — an address is scarce and usually shared, so
 * narrowing it further would punish the household rather than the attacker.
 */
function normaliseAddress(raw: string): string {
  // Strip a bracketed form and any port: "[2001:db8::1]:443", "203.0.113.9:53124".
  let addr = raw.trim();
  const bracketed = /^\[(.+)\](?::\d+)?$/.exec(addr);
  if (bracketed) addr = bracketed[1]!;
  else if (addr.split(":").length === 2) addr = addr.split(":")[0]!; // IPv4 with a port

  if (!addr.includes(":")) return addr;

  // Expand `::` far enough to name the first four groups, which is the /64.
  const [head = "", tail = ""] = addr.split("::", 2);
  const headGroups = head ? head.split(":") : [];
  if (!addr.includes("::")) return headGroups.slice(0, 4).join(":") + "::/64";
  const tailGroups = tail ? tail.split(":") : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  const groups = [...headGroups, ...Array(Math.max(0, missing)).fill("0"), ...tailGroups];
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

/** A fixed window per key. Coarse, and the coarseness is the point — see the header. */
export function rateLimiter(opts: RateLimiterOptions = {}): RateLimiter {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 20_000;
  const sweepEvery = Math.max(1, opts.sweepEvery ?? 128);
  // `windowMs` is stored PER ENTRY rather than taken from the sweeping caller's rule. Different
  // routes have different windows, and a sweep that judged an hour-long window by a one-minute rule
  // would hand that address a fresh allowance — a limiter any request against another route resets.
  const windows = new Map<string, { count: number; startedAt: number; windowMs: number }>();
  let sinceSweep = 0;

  /** Drop every window that has lapsed, each against its own length. */
  const sweep = (at: number): void => {
    for (const [key, w] of windows) {
      if (at - w.startedAt >= w.windowMs) windows.delete(key);
    }
  };

  return {
    check(key, rule) {
      const at = now();
      const existing = windows.get(key);

      if (!existing || at - existing.startedAt >= rule.windowMs) {
        // Amortised, and on the insert path only: reads never sweep, so an authenticated request
        // pays nothing for this. No timer is involved, which keeps this file free of the one thing
        // this process does not otherwise have.
        if (++sinceSweep >= sweepEvery || windows.size >= maxKeys) {
          sinceSweep = 0;
          sweep(at);
          // Still over the ceiling: evict the oldest until there is room. This happens only under
          // an address-flood, and refusing to track anything new would be a limiter that an
          // attacker switches off by being loud enough.
          if (windows.size >= maxKeys) {
            const oldest = [...windows.entries()]
              .sort((a, b) => a[1].startedAt - b[1].startedAt)
              .slice(0, Math.ceil(maxKeys / 4));
            for (const [k] of oldest) windows.delete(k);
          }
        }
        windows.set(key, { count: 1, startedAt: at, windowMs: rule.windowMs });
        return null;
      }

      if (existing.count < rule.limit) {
        existing.count++;
        return null;
      }

      // The window is NOT extended by a refused request. Punishing a retry loop would mean the
      // clients that suffer most are the ones on connections that make them retry.
      const remainingMs = existing.startedAt + rule.windowMs - at;
      // Never zero: `Retry-After: 0` reads as "go ahead now" and sends an obedient client straight
      // into another refusal.
      return Math.max(1, Math.ceil(remainingMs / 1000));
    },

    size() {
      return windows.size;
    },
  };
}
