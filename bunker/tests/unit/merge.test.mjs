// The merge ladder (doc 7): n copies of a step make one of the next, all the way up the 40 weapons / 32 turrets.
import assert from 'node:assert/strict';
import * as L from '../../src/logic/index.mjs';

export const tests = [
  ['4 copies of a step make one of the next; leftovers stay', () => {
    const inv = L.newInventory(40);
    L.addCopy(inv, 7, 6);
    assert.equal(L.mergeAll(inv, 4), 1);
    assert.equal(inv.copies[7], 2);
    assert.equal(inv.copies[8], 1);
    assert.ok(inv.owned[8]);
    assert.equal(L.toNextMerge(inv, 7, 4), 2);
  }],
  ['the ladder cascades: 4^k copies of step 0 climb k steps in one pass', () => {
    for (const k of [1, 3, 5]) {
      const inv = L.newInventory(40);
      L.addCopy(inv, 0, 4 ** k);
      L.mergeAll(inv, 4);
      assert.equal(inv.copies[k], 1, `k=${k}`);
      for (let i = 0; i < k; i++) assert.equal(inv.copies[i], 0);
      assert.ok(inv.owned.slice(0, k + 1).every(Boolean));   // every step on the way enters the collection
    }
  }],
  ['grade boundaries: five 일반 5 ... 4 copies of 일반 5 make 고급 1, and 영원 5 is the top', () => {
    const inv = L.newInventory(40);
    L.addCopy(inv, L.weaponId('일반', 5), 4);
    L.mergeAll(inv, 4);
    assert.equal(inv.copies[L.weaponId('고급', 1)], 1);
    L.addCopy(inv, 39, 8);
    L.mergeAll(inv, 4);
    assert.equal(inv.copies[39], 8);                        // nothing above the last step
  }],
  ['merge size comes from tuning (4 or 5)', () => {
    L.setTuning({ gear: { mergeN: 5 } });
    try {
      const inv = L.newInventory(40);
      L.addCopy(inv, 2, 9);
      assert.equal(L.mergeAll(inv), 1);
      assert.equal(inv.copies[2], 4);
    } finally { L.resetTuning(); }
  }],
  ['a refused payment stops merging and keeps the copies', () => {
    const inv = L.newInventory(40);
    L.addCopy(inv, 3, 12);
    let budget = 2;
    assert.equal(L.mergeAll(inv, 4, () => budget-- > 0), 2);
    assert.equal(inv.copies[3], 4);
    assert.equal(inv.copies[4], 2);
  }],
  ['the economy charges parts per merge and turrets merge on their own 32-step ladder', () => {
    const st = L.newGame(3);
    L.addCopy(st.turrets, 31, 4); L.addCopy(st.weapons, 10, 4);
    st.parts = 0;
    assert.equal(L.merge(st), 0);                           // no parts: nothing merges
    st.parts = 1e6;
    assert.equal(L.merge(st), 1);                           // the weapon merges; turret 31 is the top
    assert.equal(st.weapons.copies[11], 1);
    assert.equal(st.turrets.copies[31], 4);
    assert.equal(1e6 - st.parts, L.mergeParts(L.WEAPONS[10].grade));
  }],
];
