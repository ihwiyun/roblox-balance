// The lab (4th floor, opens at record 1,000): time-gated research that never resets. Level l of a line takes
// hours(l) hours at speed 1; lab level/tier, researchers and relics raise the speed; diamonds can finish it.
import { T } from './tuning.mjs';
import { capToStores } from './curves.mjs';

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
