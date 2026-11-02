// Breakthroughs (doc 4, 8): every 50 levels for the bunker, fence and sections, every 10 for crew and gear;
// the materials never ask for more than 80% of the store (a deadlock guard), gold is never capped.
import assert from 'node:assert/strict';
import * as L from '../../src/logic/index.mjs';

const KINDS = [['bunker'], ['fence'], ['section', 'ore'], ['section', 'food'], ['section', 'parts'], ['crew'], ['gear', 4]];

export const tests = [
  ['the cadence: bunker, fence and section levels 50, 100 ... need one, crew and gear every 10', () => {
    assert.ok(!L.needsBreakthrough(49, 0));
    assert.ok(L.needsBreakthrough(50, 0));
    assert.ok(!L.needsBreakthrough(50, 1));
    assert.ok(L.needsBreakthrough(100, 1));
    assert.ok(!L.needsBreakthrough(0, 0));
    assert.ok(L.needsBt({ level: 10, bt: 0 }) && !L.needsBt({ level: 10, bt: 1 }) && !L.needsBt({ level: 11, bt: 1 }));
  }],
  ['no material ever exceeds 80% of its store, at any size, for every kind', () => {
    const share = L.T.base.breakthroughStoreShare;
    for (const caps of [{ food: 600, ore: 600, parts: 600 }, { food: 5e4, ore: 2e3, parts: 9e5 }, { food: 1e15, ore: 1e15, parts: 1e15 }])
      for (const [kind, extra] of KINDS)
        for (const k of [1, 2, 5, 10, 40, 200, 600]) {
          const c = L.breakthroughCost(kind, k, caps, extra);
          for (const [r, v] of Object.entries(c)) if (r !== 'gold') assert.ok(v <= Math.floor(caps[r] * share), `${kind} k=${k} ${r}: ${v} > ${share} x ${caps[r]}`);
        }
  }],
  ['uncapped costs grow with k (the 50-level cadence is not cheaper than the 10-level one was)', () => {
    const big = { food: Infinity, ore: Infinity, parts: Infinity };
    for (const [kind, extra] of KINDS) {
      const a = L.breakthroughCost(kind, 1, big, extra), b = L.breakthroughCost(kind, 4, big, extra);
      for (const r of Object.keys(a)) assert.ok(b[r] > a[r], `${kind} ${r}`);
    }
    // what five old 10-level breakthroughs charged by level 50: 80 * (1+2^1.6+3^1.6+4^1.6+5^1.6) food on the bunker
    const old = [1, 2, 3, 4, 5].reduce((a, k) => a + 80 * k ** 1.6, 0);
    assert.ok(L.breakthroughCost('bunker', 1, big).food >= 0.5 * old);
  }],
  ['the economy price of a bunker breakthrough is capped by the live stores and carries gold', () => {
    const st = L.newGame(2);
    st.bunker = 50; st.bunkerBt = 0;
    st.S = null;
    const S = L.stats(st), c = L.price(st, 'bunker');
    assert.ok(c.gold > 0);
    for (const r of ['food', 'ore']) assert.ok(c[r] <= Math.floor(S.caps[r] * 0.8) + 1, `${r} ${c[r]} vs cap ${S.caps[r]}`);
    st.food = c.food; st.ore = c.ore; st.gold = c.gold;
    assert.ok(L.buy(st, 'bunker'));
    assert.equal(st.bunkerBt, 1);
    assert.equal(st.bunker, 50);
    assert.deepEqual(Object.keys(L.price(st, 'bunker')), ['gold']);   // the next level is gold again
  }],
  ['crew and gear breakthroughs are capped the same way', () => {
    const caps = { food: 1000, ore: 1000, parts: 1000 };
    const crew = L.btCost({ level: 300, bt: 29 }, caps);
    assert.ok(crew.food <= 800 && crew.parts <= 800);
    const gear = L.enhBtCost(5, 12, caps);
    assert.ok(gear.ore <= 800 && gear.parts <= 800);
  }],
];
