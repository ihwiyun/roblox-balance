// Gear: the 40-weapon ladder (8 grades x 5), the 32-turret ladder (8 grades x 4 roles), summons with summon
// levels and pity, merging (4 copies -> the next step), enhancing with breakthroughs, the codex, and the
// equip and owned effects. A weapon once owned stays in the collection; copies are merge material.
import { T } from './tuning.mjs';
import { breakthroughCost } from './curves.mjs';

// seeded random numbers (mulberry32): the same seed gives the same summons and drops everywhere
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

export const GRADES = [
  { key: 'common', name: '일반', color: '회색' }, { key: 'uncommon', name: '고급', color: '초록' },
  { key: 'rare', name: '희귀', color: '파랑' }, { key: 'epic', name: '영웅', color: '보라' },
  { key: 'legend', name: '전설', color: '주황' }, { key: 'immortal', name: '불멸', color: '빨강' },
  { key: 'mythic', name: '신화', color: '금색' }, { key: 'eternal', name: '영원', color: '무지개' },
];
export const BASE_RATES = [0.52, 0.30, 0.12, 0.045, 0.012, 0.0025, 0.00045, 0.00005];   // doc, summon level 1
// summon level 20: each grade's rate times this (common takes the rest); straight line in between
export const LEVEL20_MUL = [null, 1.07, 1.5, 1.8, 2.2, 2.6, 3.1, 3.6];
export const MAX_SUMMON_LEVEL = 20;

const WEAPON_NAMES = [
  ['녹슨 리볼버', '사제 기관단총', '쇠파이프 산탄총', '사냥용 볼트액션', '고물 못총'],
  ['경찰 권총', '민간 기관단총', '펌프 산탄총', '사냥 소총', '소방 화염기'],
  ['군용 권총', '돌격소총', '전투 산탄총', '저격소총', '경기관총'],
  ['기관권총', '특수부대 소총', '자동 산탄총', '대물 저격총', '유탄발사기'],
  ['플라즈마 권총', '레이저 소총', '충격파 산탄총', '레일 저격총', '미니건'],
  ['중력 권총', '입자 소총', '분열 산탄총', '시간 저격총', '테슬라 포'],
  ['천둥의 권총', '용의 숨결 소총', '지옥불 산탄총', '신의 창', '종말의 개틀링'],
  ['별의 권총', '은하 소총', '초신성 산탄총', '블랙홀 저격총', '영원의 포'],
];
// the same slot plays the same role (doc 7)
export const FAMILIES = [
  { key: 'pistol', name: '권총', crit: 0.10 },
  { key: 'rifle', name: '기관단총·소총', rate: 0.10 },
  { key: 'shotgun', name: '산탄', crowd: 0.5 },
  { key: 'sniper', name: '저격', pierce: 1, critDmg: 0.3 },
  { key: 'heavy', name: '중화기·특수', crowd: 0.4 },
];
// element tags on single weapons (burn answers regeneration, chain and blast answer crowds and splits)
const TAGS = { 9: { burn: 0.5 }, 21: { chain: 1 }, 24: { crowd: 0.2 }, 25: { slow: 0.1 }, 28: { slow: 0.15 }, 29: { chain: 1 },
  30: { chain: 1 }, 31: { burn: 0.6 }, 32: { burn: 0.6 }, 34: { burn: 0.4 }, 38: { slow: 0.2 }, 39: { chain: 1, burn: 0.3 } };
export const WEAPONS = [];
for (let g = 0; g < 8; g++) for (let n = 0; n < 5; n++) {
  const i = g * 5 + n;
  WEAPONS.push({ i, grade: g, slot: n, name: WEAPON_NAMES[g][n], family: FAMILIES[n].key, tags: TAGS[i] || {} });
}
export const weaponId = (gradeKey, n) => GRADES.findIndex(g => g.key === gradeKey || g.name === gradeKey) * 5 + (n - 1); // ('희귀', 5) -> 14

export const TURRET_ROLES = [
  { key: 'mg', name: '기관포', coef: 0.6, crowd: 1.0, boss: 1.0 },
  { key: 'status', name: '화염·냉각', coef: 0.35, crowd: 1.3, boss: 1.0 },
  { key: 'tesla', name: '전기', coef: 0.4, crowd: 1.6, boss: 0.9 },
  { key: 'blast', name: '폭발', coef: 0.45, crowd: 2.0, boss: 0.6 },
];
const TURRET_PREFIX = ['고물', '민간', '군용', '특수', '실험', '미지', '신화', '영원'];
export const TURRETS = [];
for (let g = 0; g < 8; g++) for (let r = 0; r < 4; r++) {
  const fire = g % 2 === 0;
  const base = ['기관포', fire ? '화염 방사기' : '냉각 분사기', '전기 코일', g % 2 ? '로켓 포대' : '박격포'][r];
  TURRETS.push({ i: g * 4 + r, grade: g, role: TURRET_ROLES[r].key, element: r === 1 ? (fire ? 'fire' : 'frost') : r === 2 ? 'shock' : null, name: TURRET_PREFIX[g] + ' ' + base });
}

/* ---------- summons ---------- */
export function gradeRates(level = 1) {
  const f = (Math.min(MAX_SUMMON_LEVEL, Math.max(1, level)) - 1) / (MAX_SUMMON_LEVEL - 1);
  const r = BASE_RATES.map((p, g) => (g === 0 ? 0 : p * (1 + (LEVEL20_MUL[g] - 1) * f)));
  r[0] = 1 - r.reduce((a, b) => a + b, 0);
  return r;
}
export const summonLevelFor = pulls => { let L = 1; while (L < MAX_SUMMON_LEVEL && pulls >= T.gear.summonLevelPulls * L * L) L++; return L; };
export const newSummon = () => ({ pulls: 0, level: 1, pity: T.gear.pity.map(() => 0) });
// one roll with pity: hero+ within 50, legend+ within 150, immortal+ within 500 (counters reset on a hit)
export function rollGrade(rng, sum) {
  const rates = gradeRates(sum.level);
  let g = rng.weighted(rates);
  const pity = T.gear.pity;
  for (let k = pity.length - 1; k >= 0; k--) {
    const [minG, n] = pity[k];
    if (g < minG && sum.pity[k] + 1 >= n) { g = minG + rng.weighted(rates.slice(minG)); break; }
  }
  pity.forEach(([minG], k) => { sum.pity[k] = g >= minG ? 0 : sum.pity[k] + 1; });
  sum.pulls++;
  sum.level = summonLevelFor(sum.pulls);
  return g;
}
export const newInventory = n => ({ copies: new Array(n).fill(0), owned: new Array(n).fill(false), enh: new Array(n).fill(0), bt: new Array(n).fill(0) });
export function addCopy(inv, i, n = 1) { inv.copies[i] += n; inv.owned[i] = true; }
// a weapon: a grade, then one of its five; a turret: a grade, then one of its four roles
export function summonWeapon(rng, inv, sum) { const g = rollGrade(rng, sum), i = g * 5 + rng.int(0, 4); addCopy(inv, i); return i; }
export function summonTurret(rng, inv, sum) { const g = rollGrade(rng, sum), i = g * 4 + rng.int(0, 3); addCopy(inv, i); return i; }

/* ---------- merging: n copies of step i -> one of step i + 1 ---------- */
// pay(i) may refuse (the economy charges a few parts a merge)
export function mergeAll(inv, n = T.gear.mergeN, pay = () => true) {
  let made = 0;
  for (let i = 0; i < inv.copies.length - 1; i++) while (inv.copies[i] >= n && pay(i)) { inv.copies[i] -= n; addCopy(inv, i + 1); made++; }
  return made;
}
export const toNextMerge = (inv, i, n = T.gear.mergeN) => n - (inv.copies[i] % n);

/* ---------- enhancing: cap by grade, gold and parts a level, ore and parts every 10 ---------- */
export const enhCap = grade => T.gear.enhCapByGrade[grade];
export const enhCost = (grade, L) => ({ gold: Math.ceil(T.gear.enhGold0 * T.gear.enhGoldGrow ** L * (grade + 1)), parts: Math.ceil((1 + L / 4) * (grade + 1)) });
export const enhNeedsBt = (inv, i) => inv.enh[i] > 0 && inv.enh[i] % 10 === 0 && inv.bt[i] < inv.enh[i] / 10;
export const enhBtCost = (grade, k, caps) => breakthroughCost('gear', k, caps, grade);

/* ---------- effects ---------- */
export const weaponEquipMul = (i, enh = 0) => T.gear.stepMul ** i * (1 + T.gear.enhEquip * enh);
export const turretMul = (i, enh = 0) => T.gear.turretStepMul ** i * (1 + T.gear.enhEquip * enh);
// owned: every weapon in the collection adds a little global attack (more for later steps, more when enhanced)
export function ownedBonus(inv, grow = T.gear.ownedGrow, base = T.gear.ownedBase) {
  let b = 0;
  for (let i = 0; i < inv.owned.length; i++) if (inv.owned[i]) b += base * grow ** i * (1 + T.gear.enhOwned * inv.enh[i]);
  return b;
}
// codex: +1% for each step ever owned, +10% for each complete grade
export function codexBonus(inv, perGrade) {
  let n = 0, sets = 0;
  for (let g = 0; g * perGrade < inv.owned.length; g++) {
    let all = true;
    for (let j = 0; j < perGrade; j++) { if (inv.owned[g * perGrade + j]) n++; else all = false; }
    if (all) sets++;
  }
  return T.gear.codexPer * n + T.gear.codexGradeSet * sets;
}
// the best k distinct owned pieces, best first, by what they multiply (step and enhancement: a fresh step-up can be
// weaker than a fully enhanced piece one step below). mul(i, enh) defaults to the weapon multiplier
export function bestOwned(inv, k, mul = weaponEquipMul) {
  const out = [];
  for (let i = 0; i < inv.owned.length; i++) if (inv.owned[i]) out.push(i);
  return out.sort((a, b) => mul(b, inv.enh[b]) - mul(a, inv.enh[a]) || b - a).slice(0, k);
}
