// Constant-time string comparison, for the two shared secrets this server checks.
//
// `a === b` returns as soon as two bytes differ, so how long it takes reveals how much of a guess
// was right. This always reads both strings to the end. Lengths are compared too, and unequal
// lengths still walk the loop rather than returning early.
//
// Not `node:crypto`'s `timingSafeEqual`, which THROWS on unequal lengths — the throw is itself the
// early return, and the caller then has to length-check first, which is the leak again.

export function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
