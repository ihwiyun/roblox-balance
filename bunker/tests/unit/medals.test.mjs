// Medals (doc 18): floor(10 * 10^(0.55 (H(best) - H(50)))), and one evacuation never more than doubles them.
import assert from 'node:assert/strict';
import * as L from '../../src/logic/index.mjs';

export const tests = [
  ['the raw formula: 0 before 50, 10 at 50, rising with the stage', () => {
    assert.equal(L.medalRaw(49), 0);
    assert.equal(L.medalRaw(50), 10);
    let prev = 0;
    for (const s of [50, 60, 100, 300, 1000, 5000, 30000]) { const m = L.medalRaw(s); assert.ok(m >= prev && Number.isFinite(m), `${s}`); prev = m; }
  }],
  ['the doubling cap: a gain never exceeds what was earned so far (the first one is the floor)', () => {
    assert.equal(L.medalGain(1000, 0), L.T.medals.floor);                 // first evacuation: 25 at most
    for (const life of [25, 100, 12345, 1e9, 1e20]) {
      const g = L.medalGain(30000, life);
      assert.ok(g <= life * (L.T.medals.doubling - 1), `life ${life}: ${g}`);
      assert.ok(g >= Math.min(L.medalRaw(30000), life) * 0.999);
    }
  }],
  ['under the cap the raw value is paid in full', () => {
    const raw = L.medalRaw(100);
    assert.equal(L.medalGain(100, 1e12), raw);
  }],
  ['repeated capped evacuations at most double the lifetime each time', () => {
    let life = 0;
    for (let i = 0; i < 40; i++) { const g = L.medalGain(5000, life); assert.ok(life === 0 || g <= life); life += g; }
    assert.ok(life <= L.T.medals.floor * 2 ** 39 + 1);
  }],
  ['a breach while starving pays half; doctrine raises the factor', () => {
    assert.equal(L.medalGain(300, 1e12, { forced: true }), Math.floor(L.medalRaw(300) * L.T.medals.starveShare));
    assert.equal(L.medalGain(30000, 1000, { doubling: 2.5 }), 1500);
  }],
  ['the economy applies the cap on a real evacuation', () => {
    const st = L.newGame(1);
    st.runBest = 400; st.record = 400; st.medalsLife = 1000;
    const g = L.evacuate(st);
    assert.equal(g, 1000);
    assert.equal(st.medalsLife, 2000);
    assert.equal(st.stage, 1);
    assert.deepEqual(st.ws, { atk: 0, rate: 0, mag: 0, reload: 0 });
  }],
];
