// The layers that never reset: medals (evacuation) with the formula, the doubling cap, medal upgrades and the
// automation the evacuation count opens; and the lab (4th floor, record 1,000): time-gated research.
import { T } from './tuning.mjs';
import { H } from './stages.mjs';
import { capToStores } from './curves.mjs';

// doc 18: floor(10 * 10^(0.55 (H(best) - H(50)))), best = the stage cleared in this run (50 needs its boss)
export function medalRaw(runBest) {
  if (runBest < T.medals.firstAt) return 0;
  return Math.floor(T.medals.base * 10 ** (T.medals.pow * (H(runBest) - H(T.medals.firstAt))));
}
// one evacuation never more than doubles the medals earned so far (doctrine research raises the factor)
export function medalCap(lifetime, doubling = T.medals.doubling) {
  return Math.max(T.medals.floor, Math.floor(lifetime * (doubling - 1)));
}
// forced: a breach while starving pays half; pin: the commander pin relic (+1% per evacuation in 24 h)
export function medalGain(runBest, lifetime, { doubling, forced = false, bonus = 0 } = {}) {
  const raw = medalRaw(runBest);
  if (!raw) return 0;
  const g = Math.min(raw, medalCap(lifetime, doubling)) * (1 + bonus);
  return Math.floor(forced ? g * T.medals.starveShare : g);
}
// the run's best stage at which an evacuation reaches the cap
export function stageForCap(lifetime, doubling = T.medals.doubling) {
  const want = medalCap(lifetime, doubling);
  let s = T.medals.firstAt;
  while (s < T.stage.cap && medalRaw(s) < want) s += Math.max(1, Math.floor(s / 50));
  return s;
}

export const MEDAL_UPS = {
  fire: { name: '화력', desc: '피해 ×1.15/레벨', cost0: 2, grow: 1.22, mul: 1.15 },
  funds: { name: '군자금', desc: '금화 ×1.15/레벨', cost0: 2, grow: 1.25, mul: 1.15 },
  command: { name: '지휘', desc: '동료·터렛 ×1.10/레벨', cost0: 4, grow: 1.28, mul: 1.10 },
  supply: { name: '보급', desc: '생산 +5%/레벨', cost0: 5, grow: 1.32, add: 0.05 },
  drill: { name: '전훈', desc: '경험치 +10%/레벨', cost0: 8, grow: 1.35, add: 0.10 },
  watch: { name: '야간 경계', desc: '오프라인 최대 +1시간/레벨', cost0: 25, grow: 2.5, max: 10 },
  sentry: { name: '자동 보초', desc: '오프라인 효율 +5%/레벨', cost0: 25, grow: 2.5, max: 10 },
};
export const MEDAL_KEYS = Object.keys(MEDAL_UPS);
export const medalUpCost = (key, L) => Math.ceil(MEDAL_UPS[key].cost0 * MEDAL_UPS[key].grow ** L);
export const medalUpMaxed = (key, L) => MEDAL_UPS[key].max != null && L >= MEDAL_UPS[key].max;
export function medalMuls(lv) {
  const L = k => lv[k] || 0;
  return { dmg: 1.15 ** L('fire'), gold: 1.15 ** L('funds'), crew: 1.10 ** L('command'), prod: 1 + 0.05 * L('supply'),
    xp: 1 + 0.10 * L('drill'), offlineH: L('watch'), offlineEff: 0.05 * L('sentry') };
}

// doc 5: what the evacuation count opens
export const AUTOMATION = [
  { evacs: 1, key: 'autoWorkshop', name: '공방 자동 강화' },
  { evacs: 3, key: 'autoBreakthrough', name: '자동 돌파' },
  { evacs: 5, key: 'startSkip', name: '시작 스테이지 건너뛰기' },
  { evacs: 8, key: 'autoMerge', name: '자동 합성' },
  { evacs: 12, key: 'skip5x', name: '자동 스킵 기준 10배 → 5배' },
  { evacs: 20, key: 'autoEvac', name: '목표 배수에 닿으면 자동 철수' },
];
// early: keys bought in the shop (auto-merge can be bought before 8 evacuations)
export function automation(evacs, early = {}) {
  const on = {};
  for (const a of AUTOMATION) on[a.key] = evacs >= a.evacs || !!early[a.key];
  return on;
}

/* ---------- research: level l of a line takes hours(l) at speed 1; diamonds can finish it ---------- */

export const RESEARCH = {
  ballistics: { name: '탄도학', desc: '피해 ×1.3/레벨', hours: l => 2 * l, mul: 1.3 },       // doc
  doctrine: { name: '교리', desc: '훈장 상한 배수 +0.25/레벨', hours: l => 3 * l, add: 0.25 }, // doc: raises the medal cap
  logistics: { name: '물류', desc: '생산 ×1.15/레벨', hours: l => 1.5 * l, mul: 1.15 },
  engineering: { name: '공학', desc: '터렛 ×1.25/레벨', hours: l => 2 * l, mul: 1.25 },
};
export const RESEARCH_KEYS = Object.keys(RESEARCH);
export const RESEARCH_UNLOCK = 1000;
export const DIAMONDS_PER_HOUR = 40;                   // finishing research with diamonds
// food and ore: the late-game sink for food (doc 18), capped like a breakthrough
export const researchCost = (key, l, caps, discount = 1) => capToStores({ food: 4000 * l * l * discount, ore: 2500 * l * l * discount }, caps);
export const researchSeconds = (key, l, speed) => RESEARCH[key].hours(l) * 3600 / Math.max(0.01, speed);
export function researchMuls(lv) {
  const L = k => lv[k] || 0;
  return { dmg: 1.3 ** L('ballistics'), doubling: T.medals.doubling + 0.25 * L('doctrine'), prod: 1.15 ** L('logistics'), turret: 1.25 ** L('engineering') };
}
