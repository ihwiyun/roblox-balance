// Seeded random numbers (mulberry32). Every roll in the logic layer goes through one of these, so the same seed
// gives the same summons, drops and fights in the browser, in node and on the server.
export function makeRng(seed = 1) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    // integer in [lo, hi]
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    range: (lo, hi) => lo + next() * (hi - lo),
    chance: p => next() < p,
    pick: list => list[Math.floor(next() * list.length)],
    // index chosen with the given weights (they need not sum to 1)
    weighted(weights) {
      let total = 0;
      for (const w of weights) total += w;
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
      return weights.length - 1;
    },
    state: () => a,
    setState: s => { a = s >>> 0; },
  };
}
