// Growth curves: the workshop (reset on evacuation), the bunker and fence, the six shelter sections with their
// three tracks (level, tier, capacity), stores and their caps, breakthroughs and overflow.
import { T } from './tuning.mjs';

/* ---------- workshop: base damage, fire rate, magazine, reload (gold) ---------- */
export const WORKSHOP_LINES = ['atk', 'rate', 'mag', 'reload'];
export const WORKSHOP_NAMES = { atk: '공격력', rate: '연사', mag: '탄창', reload: '장전' };
export function workshopValue(line, L) {
  const w = T.workshop[line];
  if (line === 'atk') return w.base * w.grow ** L;
  if (line === 'rate') return w.base * (1 + w.step * L);
  if (line === 'mag') return w.base + w.step * L;
  return Math.max(w.min, w.base * w.grow ** L);
}
// the price of L -> L + 1
export const workshopCost = (line, L) => Math.ceil(T.workshop[line].cost0 * T.workshop[line].costGrow ** L);
// how much of the time a gun is firing: a magazine's worth of shots, then a reload
export function uptime(rate, mag, reload) { const fire = mag / rate; return fire / (fire + reload); }

/* ---------- bunker and fence: kept through evacuation, no level cap ---------- */
const B = () => T.base;
export const bunkerHp = L => B().bunkerHp * B().bunkerHpGrow ** (L - 1);
export const fenceHp = L => (L > 0 ? B().fenceHp * B().fenceHpGrow ** (L - 1) : 0);
export const bunkerGold = L => Math.ceil(B().bunkerCost0 * B().bunkerCostGrow ** (L - 1));
export const fenceGold = L => Math.ceil(B().fenceCost0 * B().fenceCostGrow ** L);
// shooters on the roof (the hero counts) and turret slots, from the bunker level (doc)
export const shooterSlots = bunker => B().roofSlotsBase + B().roofSlotsAt.filter(l => bunker >= l).length;
export const turretSlots = bunker => B().turretSlotsAt.filter(l => bunker >= l).length;
// the look changes at every breakthrough (50 levels); a new era every 25 breakthroughs
export const eraOf = L => Math.floor(Math.floor(L / B().btEvery) / B().eraEvery);
export const ERA_NAMES = ['임시', '군용', '산업', '미래'];

/* ---------- breakthroughs: every btEvery levels, never above 80% of the store ---------- */
// at level L (a multiple of btEvery, not 0) the next level needs a breakthrough first
export const needsBreakthrough = (L, done) => L > 0 && L % B().btEvery === 0 && done < L / B().btEvery;
export function capToStores(cost, caps) {
  const out = {};
  for (const [k, v] of Object.entries(cost)) out[k] = caps && caps[k] != null && k !== 'gold' ? Math.min(Math.ceil(v), Math.floor(caps[k] * B().breakthroughStoreShare)) : Math.ceil(v);
  return out;
}
const btK = k => k ** B().btPow;
// bunker, fence and sections: k = L/50; coefficients in tuning (B().bt). Their gold part is added by the economy,
// which knows the level's price (B().btGold x the next level's gold)
const btOf = (coef, k, aux) => {
  const o = {};
  for (const [r, v] of Object.entries(coef)) { const key = r === 'aux' ? aux : r; o[key] = (o[key] || 0) + v * btK(k); } // the lab's aux is parts too
  return o;
};
export const BREAKTHROUGHS = {
  bunker: k => btOf(B().bt.bunker, k),
  fence: k => btOf(B().bt.fence, k),
  section: (k, aux) => btOf(B().bt.section, k, aux),
  crew: k => ({ food: T.crew.btFood * k * k, parts: T.crew.btParts * k * k }),          // doc: 60k^2, 15k^2
  gear: (k, grade) => ({ ore: 40 * k * k * (grade + 1), parts: 20 * k * k * (grade + 1) }),
};
export const breakthroughCost = (kind, k, caps, extra) => capToStores(BREAKTHROUGHS[kind](k, extra), caps);

/* ---------- sections: level (gold, +4%), tier (aux 200 T^2, +10%), capacity (store) ---------- */
// product: what its workers make; aux: what its tier costs; slots: workers by tier
export const SECTIONS = {
  roof: { name: '지붕 초소', product: null, aux: 'ore', cost0: 50, unlock: 1, tierName: '총좌', capName: '탄약고', levelName: '거리 측정기' },
  shop: { name: '작업장', product: 'parts', aux: 'ore', cost0: 60, unlock: 15, tierName: '작업대', capName: '부품함', levelName: '공구', slots: t => Math.min(4, 1 + Math.floor(t / 3)) },
  bed: { name: '1층 침실', product: null, aux: 'food', cost0: 40, unlock: 1, tierName: '침대', capName: '방', levelName: '주방' },
  food: { name: '2층 식량', product: 'food', aux: 'ore', cost0: 30, unlock: 1, tierName: '씨앗', capName: '재배대', levelName: '생장등', slots: t => Math.min(5, 1 + Math.floor(t / 2)) },
  mine: { name: '3층 채굴', product: 'ore', aux: 'food', cost0: 45, unlock: 8, tierName: '곡괭이', capName: '광차', levelName: '드릴', slots: t => Math.min(5, 1 + Math.floor(t / 2)) },
  lab: { name: '4층 연구소', product: null, aux: 'parts', cost0: 1e9, unlockRecord: 1000, tierName: '실험대', capName: '자료실', levelName: '장비', slots: t => Math.min(3, 1 + Math.floor(t / 4)) },
};
export const SECTION_KEYS = Object.keys(SECTIONS);
export const STORE_OF = { food: 'food', ore: 'mine', parts: 'shop' };   // which section's capacity holds what
export const sectionLevelGold = (key, L) => Math.ceil(SECTIONS[key].cost0 * T.sections.levelGrow ** L);
export const sectionTierCost = (key, t) => ({ [SECTIONS[key].aux]: T.sections.tierCost * t * t * T.sections.tierGrow ** (t - 1) }); // to reach tier t
export const sectionCapCost = (key, C) => ({ gold: Math.ceil(T.sections.capCostGold0 * T.sections.capCostGoldGrow ** C),
  [SECTIONS[key].aux]: Math.ceil(T.sections.capCostAux * (C + 1) ** T.sections.capCostPow) });
export const sectionMul = (L, t) => (1 + T.sections.tierPct * t) * (1 + T.sections.levelPct * L);
export const roofMul = (L, t) => (1 + T.sections.roofTierPct * t) * (1 + T.sections.levelPct * L);
export const roofCrit = L => Math.min(0.2, 0.0005 * L);
export const roofMagPct = C => 0.03 * C;                       // the ammo depot: +3% magazine a level
export const beds = t => Math.min(12, 5 + t);                  // doc: 5 -> 12
export const kitchenUpkeep = L => 1 - Math.min(0.6, 0.003 * L); // doc: -0.3% a level
export const roomsOfflineH = C => Math.min(3, 0.25 * C);        // rooms: the crew keeps working longer while away
export const labSpeed = (L, t) => (1 + 0.1 * t) * (1 + 0.04 * L);
export const archiveCost = C => 1 - Math.min(0.45, 0.03 * C);   // research costs

/* ---------- stores ---------- */
// doc: an hour of the section's production x (1 + 0.15 capacity level); never below a small floor
export const storeCap = (prodPerSec, capLevel, mul = 1) => Math.max(T.sections.minStore, 3600 * prodPerSec * (1 + T.sections.capPct * capLevel)) * mul;
// what does not fit: kept up to the cap, the rest becomes commander XP at 10:1 (or gold with the furnace)
export function overflow(have, add, cap) {
  const room = Math.max(0, cap - have), kept = Math.min(add, room), spill = Math.max(0, add - kept);
  return { kept, spill, xp: spill / T.sections.overflowToXp };
}
