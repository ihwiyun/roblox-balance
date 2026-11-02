// Crew: 24 cards (8 grades x 3), levels (gold, a food+parts breakthrough every 10), stars from duplicates,
// upkeep, the growth lock (no level-up unless food output covers 1.15x the new upkeep) and assignment.
// An ability works when the card sits in its own section; stars raise it 20% each.
import { T } from './tuning.mjs';
import { breakthroughCost } from './curves.mjs';
import { rollGrade } from './gear.mjs';

// role -> section: gunner roof, farmer food, miner mine, repair/mechanic shop, researcher lab
export const ROLE_SECTION = { gunner: 'roof', farmer: 'food', miner: 'mine', repair: 'shop', mechanic: 'shop', research: 'lab' };
const C = (id, name, grade, role, desc, ab) => ({ id, name, grade, role, desc, ab });
export const CARDS = [
  C('me', '나', 0, 'gunner', '주인공. 늘 지붕에서 쏨', {}),
  C('minjun', '민준', 0, 'gunner', '피해 +10%', { dmgPct: 0.10 }),
  C('seoyeon', '서연', 0, 'farmer', '식량 +25%', { food: 0.25 }),
  C('doyun', '도윤', 1, 'gunner', '치명 +8%', { critChance: 0.08 }),
  C('haeun', '하은', 1, 'farmer', '유지비 −10%', { upkeepAll: 0.10 }),
  C('jiho', '지호', 1, 'miner', '광물 +30%', { ore: 0.30 }),
  C('sua', '수아', 2, 'repair', '수리 1.5배, 터렛 부활', { repair: 0.5, turretResist: 0.15 }),
  C('taeo', '태오', 2, 'gunner', '관통 +1, 저격 +30%', { pierceShare: 0.25, sniperPct: 0.30 }),
  C('junhyuk', '준혁', 2, 'miner', '유물 발견 +15%', { relicFind: 0.15, ore: 0.10 }),
  C('yerin', '예린', 3, 'gunner', '8발째 6배', { dmgPct: 0.625 }),
  C('kang', '강 상사', 3, 'mechanic', '터렛 +40%, 합성 비용 −20%', { turretPct: 0.40, mergeCut: 0.20 }),
  C('oh', '오 반장', 3, 'repair', '수리 1.8배, 수리에 부품이 들지 않음', { repair: 0.8, freeRepair: 1 }),
  C('han', '한 소령', 4, 'gunner', '연사 +15%, 보스 피해 +30%', { ratePct: 0.15, bossPct: 0.30 }),
  C('choi', '최 하사', 4, 'gunner', '처치 10마리마다 유탄(군집 피해 +25%)', { crowdPct: 0.25, aoeCover: 0.2 }),
  C('yoon', '윤 연구원', 4, 'research', '연구 시간 −20%, 연구 비용 −20%', { researchSpeed: 0.25, researchCut: 0.20 }),
  C('rhea', '레아', 5, 'gunner', '치명 +10%, 치명타가 장갑을 뚫음', { critChance: 0.10, pierceShare: 0.3 }),
  C('baek', '백 노인', 5, 'farmer', '식량 +40%, 모든 동료 유지비 −15%', { food: 0.40, upkeepAll: 0.15 }),
  C('bawi', '바위', 5, 'miner', '광물 +40%, 캐낸 광물의 2%가 부품', { ore: 0.40, oreToParts: 0.02 }),
  C('mari', '마리 박사', 6, 'research', '연구 시간 −25%, 식량·광물 +30%', { researchSpeed: 0.33, foodAll: 0.30, oreAll: 0.30 }),
  C('sera', '세라', 6, 'repair', '수리 2.5배, 터렛 즉시 부활', { repair: 1.5, turretResist: 0.4 }),
  C('wolf', '강철 늑대', 6, 'gunner', '보스 피해 +50%, 보스 장갑 50% 무시', { bossPct: 0.50, pierceShare: 0.5 }),
  C('zero', '제로', 7, 'research', '연구 시간 −35%, 대기 중인 연구 자동 시작', { researchSpeed: 0.54, autoResearch: 1 }),
  C('atlas', '아틀라스', 7, 'gunner', '모든 사수 +25%, 대표 보너스가 지붕 전체에', { roofPct: 0.25, dmgPct: 0.25 }),
  C('gaia', '가이아', 7, 'farmer', '모든 생산 +50%, 유지비 −20%', { prodAll: 0.50, upkeepAll: 0.20 }),
];
export const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]));
export const CARDS_BY_GRADE = Array.from({ length: 8 }, (_, g) => CARDS.filter(c => c.grade === g && c.id !== 'me').map(c => c.id));
// free recruits as the story goes: each floor gets a hand when it opens (the farm at 1, the mine at 8 -> 10, the
// workshop at 15). Without the stage-15 repairman the workshop stayed empty and made no parts until a summon
// happened to bring a repair or mechanic card (33 h in the first simulation)
export const STORY_RECRUITS = [[1, 'me'], [1, 'seoyeon'], [5, 'minjun'], [10, 'jiho'], [15, 'sua'], [20, 'doyun'], [35, 'haeun']];
export const RECRUIT_COST = 100;   // gems

export const newCrew = () => ({ cards: {}, assign: { roof: [], food: [], mine: [], shop: [], lab: [] }, leader: 'me' });
export function addCard(crew, id) {
  const c = crew.cards[id];
  if (!c) { crew.cards[id] = { level: 1, stars: 1, dupes: 0, bt: 0 }; return 'new'; }
  if (c.stars >= 5) return 'max';
  c.dupes++;
  if (c.dupes >= T.crew.starDupes[c.stars - 1]) { c.dupes = 0; c.stars++; return 'star'; }
  return 'dupe';
}
export function recruit(rng, crew, sum) { const g = rollGrade(rng, sum), id = rng.pick(CARDS_BY_GRADE[g]); return { id, result: addCard(crew, id) }; }

export const levelGold = l => Math.ceil(T.crew.levelCost0 * T.crew.levelGrow ** l);            // doc: 100 * 1.12^l
export const needsBt = c => c.level % 10 === 0 && c.bt < c.level / 10;
export const btCost = (c, caps, mul = 1) => { const k = c.level / 10, b = breakthroughCost('crew', k, caps); for (const r in b) b[r] = Math.ceil(b[r] * mul); return b; };
export const starMul = stars => 1 + T.crew.starPct * (stars - 1);
// ability values of a card, stars included
export function ability(id, crew) {
  const c = crew.cards[id], out = {};
  for (const [k, v] of Object.entries(CARD[id].ab)) out[k] = typeof v === 'number' && k !== 'freeRepair' && k !== 'autoResearch' ? v * starMul(c.stars) : v;
  return out;
}
export const levelMul = l => 1 + T.crew.gunnerPerLevel * l;    // doc: x(1 + 0.04 l) on the roof; same for workers here
// food a second for one crew member (the hero eats from the commander's ration)
export const upkeepOf = l => T.crew.upkeep0 * (1 + T.crew.upkeepPerLevel * l);
export const members = crew => Object.values(crew.assign).flat();
export function upkeepTotal(crew, mul = 1, levels = null) {
  let u = 0;
  for (const id of members(crew)) if (id !== 'me') u += upkeepOf(levels && levels[id] != null ? levels[id] : crew.cards[id].level);
  return u * mul;
}
// doc: growth lock: a level-up only when food output is at least 1.15x the upkeep after it
export function canLevel(crew, id, foodPerSec, upMul = 1, lock = T.crew.lock) {
  if (id === 'me') return true;
  const assigned = members(crew).includes(id), next = crew.cards[id].level + 1;
  const after = upkeepTotal(crew, upMul) + (assigned ? (upkeepOf(next) - upkeepOf(next - 1)) * upMul : 0);
  return foodPerSec >= lock * after;
}

// a default assignment: the hero and the best gunners on the roof, farmers and miners below, repairmen in
// the workshop, researchers in the lab; anyone left fills the production floors. slots: { roof, food, ... }
export function autoAssign(crew, slots, totalBeds) {
  const owned = Object.keys(crew.cards), score = id => CARD[id].grade * 100 + crew.cards[id].level + crew.cards[id].stars * 10;
  const pool = owned.filter(id => id !== 'me').sort((a, b) => score(b) - score(a));
  const a = { roof: ['me'], food: [], mine: [], shop: [], lab: [] };
  let room = Math.max(0, totalBeds - 1);
  const take = (sec, want) => {
    for (const id of pool.slice()) {
      if (!room || a[sec].length >= (slots[sec] || 0)) return;
      if (want(id)) { a[sec].push(id); pool.splice(pool.indexOf(id), 1); room--; }
    }
  };
  take('food', id => CARD[id].role === 'farmer');
  take('roof', id => CARD[id].role === 'gunner');
  take('mine', id => CARD[id].role === 'miner');
  take('shop', id => CARD[id].role === 'repair' || CARD[id].role === 'mechanic');
  take('lab', id => CARD[id].role === 'research');
  for (const sec of ['food', 'roof', 'mine', 'shop']) take(sec, () => true);
  crew.assign = a;
  return a;
}
