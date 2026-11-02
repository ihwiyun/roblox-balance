// Summons: the grade table (doc 7), 100,000-pull samples, the summon level, and pity.
import assert from 'node:assert/strict';
import * as L from '../../src/logic/index.mjs';

const N = 100000;
// a binomial share is within z standard errors of p
const near = (got, p, n, z = 4.5) => Math.abs(got - p) <= z * Math.sqrt(p * (1 - p) / n) + 1e-12;

export const tests = [
  ['the grade table at summon level 1 is the doc table and sums to 1', () => {
    const r = L.gradeRates(1);
    assert.deepEqual(r.map(x => +x.toFixed(6)), [0.52, 0.30, 0.12, 0.045, 0.012, 0.0025, 0.00045, 0.00005]);
    assert.ok(Math.abs(r.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  }],
  ['100k draws from the table land on the doc rates (no pity involved)', () => {
    const rng = L.makeRng(12345), rates = L.gradeRates(1), n = new Array(8).fill(0);
    for (let i = 0; i < N; i++) n[rng.weighted(rates)]++;
    rates.forEach((p, g) => assert.ok(near(n[g] / N, p, N), `grade ${g}: ${n[g] / N} vs ${p}`));
  }],
  ['100k real summons: every grade appears at its rate or (pity) a little above, never below', () => {
    const rng = L.makeRng(777), sum = L.newSummon(), n = new Array(8).fill(0);
    sum.level = 1;
    for (let i = 0; i < N; i++) { const g = L.rollGrade(rng, sum); n[g]++; sum.level = 1; sum.pulls = 0; }  // hold level 1
    const base = L.gradeRates(1);
    // pity only lifts epic+ (3..7); commons and uncommons give way
    for (let g = 3; g < 8; g++) assert.ok(n[g] / N >= base[g] - 4.5 * Math.sqrt(base[g] * (1 - base[g]) / N), `grade ${g} below its rate`);
    const epicUp = n.slice(3).reduce((a, b) => a + b, 0) / N;
    assert.ok(epicUp > 0.06 && epicUp < 0.07, `epic+ share ${epicUp}`);   // 6.0% base, pity adds a little
  }],
  ['the summon level rises with pulls and lifts the higher grades (x1.07 .. x3.6 at level 20)', () => {
    assert.equal(L.summonLevelFor(0), 1);
    assert.equal(L.summonLevelFor(T().gear.summonLevelPulls), 2);
    assert.equal(L.summonLevelFor(1e9), L.MAX_SUMMON_LEVEL);
    const r1 = L.gradeRates(1), r20 = L.gradeRates(20);
    for (let g = 1; g < 8; g++) assert.ok(Math.abs(r20[g] / r1[g] - L.LEVEL20_MUL[g]) < 1e-9);
    assert.ok(Math.abs(r20.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    for (let l = 1; l < 20; l++) assert.ok(L.gradeRates(l + 1)[7] >= L.gradeRates(l)[7]);
  }],
  ['pity: in 100k pulls no gap without epic+ reaches 50, legend+ 150, immortal+ 500', () => {
    const rng = L.makeRng(4242), sum = L.newSummon();
    const last = { 3: 0, 4: 0, 5: 0 }, worst = { 3: 0, 4: 0, 5: 0 };
    for (let i = 1; i <= N; i++) {
      const g = L.rollGrade(rng, sum);
      for (const k of [3, 4, 5]) if (g >= k) { worst[k] = Math.max(worst[k], i - last[k]); last[k] = i; }
    }
    assert.ok(worst[3] <= 50, `epic gap ${worst[3]}`);
    assert.ok(worst[4] <= 150, `legend gap ${worst[4]}`);
    assert.ok(worst[5] <= 500, `immortal gap ${worst[5]}`);
  }],
  ['pity fires on the last pull of the window and resets its counter', () => {
    const rng = L.makeRng(1), sum = L.newSummon();
    sum.pity = [49, 0, 0];                       // 49 pulls without epic+: the 50th must be epic+
    const g = L.rollGrade(rng, sum);
    assert.ok(g >= 3);
    assert.equal(sum.pity[0], 0);
    sum.pity = [0, 0, 499];
    assert.ok(L.rollGrade(rng, sum) >= 5);
    assert.deepEqual(sum.pity, [0, 0, 0]);
  }],
];
const T = () => L.T;
