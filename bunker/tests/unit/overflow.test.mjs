// Nothing overflows below the stage cap (~30,000): build the state a player near stage s could have (every level
// bought with a generous multiple of that stage's gold), then check every stat, price, reward and step stays finite.
import assert from 'node:assert/strict';
import * as L from '../../src/logic/index.mjs';

const T = L.T;
const finite = (x, path) => {
  if (typeof x === 'number') { assert.ok(Number.isFinite(x), `${path} = ${x}`); return; }
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) finite(v, `${path}.${k}`);
};
// levels a gold pile of `gold` buys on a track priced cost0 * grow^L (times `margin` more levels)
const lvl = (gold, cost0, grow, margin) => Math.max(0, Math.floor(margin * Math.log(Math.max(1, gold / cost0)) / Math.log(grow)));

export function lateState(s, margin = 1.5) {
  const st = L.newGame(9);
  const gold = 3 * 10 ** (0.8 * L.H(s)) * 1e12;          // a stage's kill gold with a huge gold multiplier on top
  const w = T.workshop;
  st.ws = { atk: lvl(gold, w.atk.cost0, w.atk.costGrow, margin), rate: lvl(gold, w.rate.cost0, w.rate.costGrow, margin),
    mag: lvl(gold, w.mag.cost0, w.mag.costGrow, margin), reload: lvl(gold, w.reload.cost0, w.reload.costGrow, margin) };
  st.bunker = lvl(gold, T.base.bunkerCost0, T.base.bunkerCostGrow, margin); st.bunkerBt = Math.floor(st.bunker / 50);
  st.fence = lvl(gold, T.base.fenceCost0, T.base.fenceCostGrow, margin); st.fenceBt = Math.floor(st.fence / 50);
  for (const k of L.SECTION_KEYS) { const lv = lvl(gold, L.SECTIONS[k].cost0 === 1e9 ? 50 : L.SECTIONS[k].cost0, T.sections.levelGrow, margin); st.sec[k] = { lv, bt: Math.floor(lv / 50), tier: 120, cap: 400 }; }
  for (const c of L.CARDS) { const lv = lvl(gold, T.crew.levelCost0, T.crew.levelGrow, margin); st.crew.cards[c.id] = { level: lv, stars: 5, dupes: 0, bt: Math.floor(lv / 10) }; }
  for (let i = 0; i < 40; i++) { L.addCopy(st.weapons, i, 3); st.weapons.enh[i] = L.enhCap(L.WEAPONS[i].grade); }
  for (let i = 0; i < 32; i++) { L.addCopy(st.turrets, i, 3); st.turrets.enh[i] = L.enhCap(L.TURRETS[i].grade); }
  for (let id = 0; id < L.RELICS.length; id++) st.relics.level[id] = T.relics.maxLevel;
  const medals = L.medalRaw(s) * 1e3;
  for (const k of L.MEDAL_KEYS) st.medalUp[k] = L.MEDAL_UPS[k].max ?? lvl(medals, T.medals.ups[k].cost0, T.medals.ups[k].grow, margin);
  st.medalsLife = medals; st.medals = medals; st.evacs = 200;
  st.cmd.level = 5000; st.cmd.points = { power: 5000, rapid: 2000, luck: 4000, precision: 2000, command: 1000, supply: 1000 };
  st.research.lv = { ballistics: 300, doctrine: 100, logistics: 200, engineering: 200 };
  st.counts = { kills: 1e9, bossKills: 3e6, titanKills: 3e5, killsForRelic: 0 };
  st.record = s; st.runBest = s; st.stage = s;
  st.gold = gold; st.food = 1e30; st.ore = 1e30; st.parts = 1e30; st.gems = 1e6;
  L.assignCrew(st); L.equipBest(st); st.S = null;
  const S = L.stats(st);
  st.pool = { fence: S.fenceMax, bunker: S.bunkerMax };
  return st;
}

export const tests = [
  ['stats, stage results and rewards stay finite up to the cap', () => {
    for (const s of [1000, 5000, 10000, 20000, T.stage.cap]) for (const margin of [1, 2]) {
      const st = lateState(s, margin), S = L.stats(st);
      finite(S, `stats@${s}x${margin}`);
      assert.ok(S.dps > 0);
      for (const t of [s, s - (s % 10), s - (s % 100)]) {
        finite(L.resolveStage(t, S, { ...st.pool, fenceMax: S.fenceMax, bunkerMax: S.bunkerMax }), `resolve@${t}`);
        finite(L.stageRewards(t), `rewards@${t}`);
      }
      finite({ hp: L.zombieHp(s), atk: L.zombieAtk(s), gold: L.killGold(s), req: L.reqDps(s), medals: L.medalRaw(s) }, `curve@${s}`);
    }
  }],
  ['every price is finite (or closed) at those levels', () => {
    const st = lateState(T.stage.cap, 2);
    const keys = ['ws:atk', 'ws:rate', 'ws:mag', 'ws:reload', 'bunker', 'fence', ...L.MEDAL_KEYS.map(k => 'medal:' + k), ...L.RESEARCH_KEYS.map(k => 'research:' + k)];
    for (const k of L.SECTION_KEYS) for (const t of ['lv', 'tier', 'cap']) keys.push(`sec:${k}:${t}`);
    for (const id of Object.keys(st.crew.cards)) keys.push('crew:' + id);
    for (let i = 0; i < 40; i++) keys.push('enh:w:' + i);
    for (const k of keys) { const c = L.price(st, k); if (c) finite(c, k); }
  }],
  ['an hour of play, a night offline and an evacuation at the cap stay finite', () => {
    const st = lateState(T.stage.cap - 1, 2);
    st.mode = 'progress';
    L.advance(st, 3600);
    L.offline(st, 10 * 3600, true);
    finite({ gold: st.gold, food: st.food, ore: st.ore, parts: st.parts, gems: st.gems, xp: st.cmd.xp, lv: st.cmd.level }, 'after play');
    assert.ok(st.stage <= T.stage.cap);
    const g = L.evacuate(st);
    assert.ok(Number.isFinite(g) && g > 0);
    finite({ medals: st.medals, life: st.medalsLife }, 'medals');
  }],
];
