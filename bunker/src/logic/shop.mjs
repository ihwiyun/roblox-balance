// The shop: diamond packs, passes, convenience items (time savers, not power) and the step packages, the only
// place power is sold, opened one step at a time behind a stage gate. Prices in KRW.
import { addCopy } from './gear.mjs';
import { addCard, CARDS_BY_GRADE } from './crew.mjs';

// Assumption: 10 KRW a diamond at the smallest pack, a bonus up to +26% on the largest; first purchase of each x2.
// Diamonds buy summons 1:1 with gems.
export const DIAMOND_PACKS = [
  { krw: 1200, dia: 120 }, { krw: 5900, dia: 640 }, { krw: 12000, dia: 1350 },
  { krw: 33000, dia: 3900 }, { krw: 69000, dia: 8500 }, { krw: 119000, dia: 15000 },
];
export const PRICES = { weaponPull: 50, turretPull: 50, relicChest: 300, recruit: 100 };   // gems or diamonds
export const PASSES = {
  monthly: { krw: 5500, days: 30, now: 300, daily: 100, offlineH: 2, adFree: true, desc: '매일 보석 + 광고 없는 보상 + 오프라인 +2시간' },
  season: { krw: 9900, days: 60, everyStages: 20, gems: 120, chestEvery: 100, desc: '기록 20마다 보석 120, 100마다 유물 상자' },
};
// the free track of the season everyone gets (part of the F2P gem income)
export const SEASON_FREE = { everyStages: 20, gems: 40 };
// time savers: what each saves is modelled in the simulation (tests/sim/bots.mjs), none adds power
export const CONVENIENCE = {
  adRemoval: { krw: 6600, desc: '광고 보상을 광고 없이 바로 받기' },
  autoMerge: { krw: 4400, desc: '철수 8회에 열리는 자동 합성을 바로' },
  offline12: { krw: 5500, desc: '오프라인 최대 +12시간' },
  presets: { krw: 2200, desc: '무기·유물 조합 저장' },
  researchSlot: { krw: 9900, desc: '연구 두 개를 동시에' },
  x2Default: { krw: 3300, desc: 'x2 배속을 기본값으로' },
};
// step lines: buying a step opens the next once its gate (record) is reached. weapon i: ladder step 0..39
const W = (g, n) => g * 5 + n - 1, TU = (g, r) => g * 4 + r;
export const STEP_LINES = {
  weapon: [
    { krw: 1200, gate: 0, items: { weapon: W(2, 5), gems: 300 } },        // 희귀5 + 300
    { krw: 3300, gate: 20, items: { weapon: W(3, 3), card: 2 } },         // 영웅3 + rare crew
    { krw: 5900, gate: 50, items: { weapon: W(4, 1), relicChests: 5 } },  // 전설1 + 5 chests
    { krw: 12000, gate: 100, items: { weapon: W(4, 5), turret: TU(3, 0) } }, // 전설5 + 영웅 turret
    { krw: 33000, gate: 300, items: { weapon: W(5, 1), card: 4 } },       // 불멸1 + legendary crew
    { krw: 69000, gate: 700, items: { weapon: W(6, 1), relicChests: 30 } }, // 신화1 + 30 chests
  ],
  crew: [
    { krw: 2500, gate: 10, items: { card: 1, food: 2000 } },
    { krw: 9900, gate: 80, items: { card: 3, gems: 500 } },
    { krw: 29000, gate: 400, items: { card: 5, gems: 1000 } },
  ],
  turret: [
    { krw: 2500, gate: 25, items: { turret: TU(2, 0), gems: 200 } },
    { krw: 9900, gate: 150, items: { turret: TU(4, 3), gems: 500 } },
    { krw: 29000, gate: 500, items: { turret: TU(5, 0), gems: 1000 } },
  ],
};
export const newShop = () => ({ steps: { weapon: 0, crew: 0, turret: 0 }, packsBought: {}, owned: {}, monthlyUntil: -1, seasonUntil: -1, seasonClaimed: 0, freeClaimed: 0, spent: 0 });
// the next step of a line, if it is open
export function nextStep(shop, line, record) {
  const s = STEP_LINES[line][shop.steps[line]];
  return s && record >= s.gate ? s : null;
}
export function diamondsFor(shop, i) { const p = DIAMOND_PACKS[i]; return shop.packsBought[i] ? p.dia : p.dia * 2; }

// hand over what a product holds. st: the game state (gear, crew, relics, currencies); rng for chests and cards
export function grant(st, items, rng, onChest) {
  if (items.gems) st.gems += items.gems;
  if (items.diamonds) st.diamonds += items.diamonds;
  if (items.food) st.food += items.food;
  if (items.weapon != null) addCopy(st.weapons, items.weapon);
  if (items.turret != null) addCopy(st.turrets, items.turret);
  if (items.card != null) addCard(st.crew, rng.pick(CARDS_BY_GRADE[items.card]));
  if (items.relicChests) for (let k = 0; k < items.relicChests; k++) onChest();
}
