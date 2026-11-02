// Relics: 48 across 8 groups x 6 and 8 grades x 6. Level l needs l duplicates to reach l + 1 (max 10); later
// duplicates become shards. Slots open with the record. Sets of three and element reactions add on top.
// fx(l, ctx) adds into a mods object that power.mjs reads; ctx carries counts (bosses, titans, shooters...).
import { T } from './tuning.mjs';
import { rollGrade } from './gear.mjs';

export const GROUPS = ['탄도', '원소', '공성', '요새', '지휘', '이상', '생존', '연구'];
const R = (id, name, group, grade, desc, fx, el) => ({ id, name, group, grade, desc, fx, el: el || null });
const add = (m, k, v) => { m[k] = (m[k] || 0) + v; };
const mul = (m, k, v) => { m[k] = (m[k] ?? 1) * v; };
export const RELICS = [
  // 탄도
  R(0, '관통탄', 0, 2, '관통 +1, 5·10레벨에 추가', (m, l) => { const p = 1 + (l >= 5) + (l >= 10); add(m, 'pierceCount', p); add(m, 'pierceShare', 0.3 * p); add(m, 'crowdPct', 0.08 * p); }),
  R(1, '할로포인트', 0, 1, '치명 +1%/레벨, 치명이 장갑을 깎음', (m, l) => { add(m, 'critChance', 0.01 * l); add(m, 'pierceShare', 0.2); }),
  R(2, '조준경', 0, 0, '새 표적 첫 발 치명', (m, l) => { add(m, 'critChance', 0.03 + 0.003 * l); }),
  R(3, '도탄', 0, 3, '15% 튕김', (m, l) => { add(m, 'crowdPct', 0.15 + 0.015 * l); }),
  R(4, '이중 급탄', 0, 4, '4발째 두 발', (m, l) => { add(m, 'dmgPct', 0.25 * (1 + 0.05 * l)); }),
  R(5, '전리품 탄띠', 0, 6, '누적 보스 100마리당 피해 +0.5%, 상한 없음', (m, l, c) => { add(m, 'dmgPct', 0.005 * Math.floor((c.bossKills || 0) / 100) * (1 + 0.1 * l)); }),
  // 원소
  R(6, '인', 1, 0, '화상 3초 30%, 3중첩', (m, l) => { add(m, 'burnUptime', 0.3 + 0.03 * l); add(m, 'dmgPct', 0.1 + 0.01 * l); }, 'fire'),
  R(7, '네이팜', 1, 3, '불탄 채 죽으면 불길', (m, l) => { add(m, 'burnUptime', 0.1); add(m, 'crowdPct', 0.2 + 0.02 * l); }, 'fire'),
  R(8, '냉각 탄창', 1, 1, '5회 냉각 시 1초 빙결', (m, l) => { add(m, 'slow', 0.1 + 0.01 * l); }, 'ice'),
  R(9, '서리 종', 1, 5, '보스 단계가 바뀔 때 전장 2초 빙결', (m, l) => { add(m, 'bossTimeBonus', 2 + 0.2 * l); add(m, 'slow', 0.05); }, 'ice'),
  R(10, '아크 코일', 1, 2, '10% 연쇄 2', (m, l) => { add(m, 'crowdPct', 0.2 + 0.02 * l); add(m, 'aoeCover', 0.15); }, 'shock'),
  R(11, '피뢰침', 1, 4, '3초마다 체력 최고 좀비에 5배 낙뢰', (m, l) => { add(m, 'bossDmgPct', 0.08 + 0.01 * l); }, 'shock'),
  // 공성
  R(12, '철갑 코어', 2, 1, '장갑 30% 무시', (m, l) => { add(m, 'pierceShare', 0.3 + 0.02 * l); }),
  R(13, '처형자', 2, 0, '일반 5% 이하 즉사', (m, l) => { add(m, 'crowdPct', 0.05 + 0.005 * l); }),
  R(14, '거인 사냥꾼', 2, 3, '보스·거인 +15%/레벨', (m, l) => { add(m, 'bossDmgPct', 0.15 * l); }),
  R(15, '약점 표식', 2, 2, '보스를 쏘는 사수 1명당 +5%', (m, l, c) => { add(m, 'bossDmgPct', 0.05 * (c.shooters || 1) * (1 + 0.1 * l)); }),
  R(16, '현상금 시계', 2, 5, '보스를 빨리 잡으면 남은 초×수입', (m, l) => { add(m, 'bossClock', 0.5 + 0.05 * l); }),
  R(17, '타이탄 심장', 2, 7, '누적 타이탄당 보스 피해 +2%, 상한 없음', (m, l, c) => { add(m, 'bossDmgPct', 0.02 * (c.titanKills || 0) * (1 + 0.1 * l)); }),
  // 요새
  R(18, '면도날 철조망', 3, 0, '울타리가 20% 반사', (m, l) => { mul(m, 'dmgTakenMul', 1 - 0.1 * (1 + 0.05 * l)); add(m, 'crowdPct', 0.03); }),
  R(19, '장갑판', 3, 1, '받는 피해 −2%/레벨', (m, l) => { mul(m, 'dmgTakenMul', 1 - 0.02 * l); }),
  R(20, '모래주머니 부적', 3, 2, '스테이지 첫 뚫림 무효', (m, l) => { add(m, 'breachShield', 0.1 + 0.01 * l); }),
  R(21, '수리 상자', 3, 3, '수리공 +50%, 부품 절반', (m, l) => { add(m, 'repairPct', 0.5 + 0.05 * l); mul(m, 'repairPartsMul', 0.5); }),
  R(22, '과부하', 3, 4, '보스 등장 시 5초간 터렛 2배', (m, l) => { add(m, 'turretBossPct', (5 / 45) * (1 + 0.1 * l)); }),
  R(23, '최후의 저항', 3, 6, '벙커 30% 이하에서 피해 2배', (m, l) => { add(m, 'bossDmgPct', 0.1 + 0.02 * l); }),
  // 지휘
  R(24, '현상금 장부', 4, 2, '보스가 60초 수입 지급', (m, l) => { add(m, 'bossIncomeSec', 60 * (1 + 0.1 * l)); }),
  R(25, '고물 자루', 4, 0, '처치 1%가 부품 상자', (m, l) => { add(m, 'partsPerKill', 0.05 * (1 + 0.1 * l)); }),
  R(26, '야전 취사장', 4, 1, '농부 1명이 동료 1명 유지비 부담', (m, l) => { add(m, 'upkeepCover', 0.5 + 0.05 * l); }),
  R(27, '광맥 지도', 4, 4, '광물 2,000당 보석 1', (m, l) => { add(m, 'gemsPerOre', (1 + 0.1 * l) / 2000); }),
  R(28, '무전 중계', 4, 5, '대표 능력이 모든 구역에 30%', (m, l) => { add(m, 'leaderAura', 0.3 + 0.03 * l); }),
  R(29, '지휘관 핀', 4, 6, '최근 24시간 환생당 훈장 +1%', (m, l) => { add(m, 'medalPerEvac', 0.01 * (1 + 0.1 * l)); }),
  // 이상
  R(30, '피의 계약', 5, 7, '피해 2배, 유지비 +50%', (m, l) => { mul(m, 'dmgMul', 2 + 0.05 * l); mul(m, 'upkeepMul', 1.5); }),
  R(31, '태엽', 5, 5, '보스 제한시간 60초, 스킵 기준 7배', (m, l) => { m.bossTimeSet = 60 + 0.5 * l; m.skipMult = 7; }),
  R(32, '거울 파편', 5, 3, '맞은 피해 10% 반사', (m, l) => { mul(m, 'dmgTakenMul', 0.9 - 0.005 * l); add(m, 'crowdPct', 0.02); }),
  R(33, '감염된 심장', 5, 4, '처치 5%가 5초간 아군 좀비', (m, l) => { add(m, 'crowdPct', 0.08 + 0.01 * l); }),
  R(34, '연금술 화로', 5, 6, '넘친 재화를 금화로', (m, l) => { add(m, 'alchemy', 0.2 + 0.02 * l); }),
  R(35, '끝없는 탄띠', 5, 7, '장전 없음, 연사 −20%', (m, l) => { m.noReload = true; mul(m, 'rateMul', 0.8 + 0.01 * l); }),
  // 생존 (new): they change the rules of food, offline and the base, not just a number
  R(36, '비상 배급', 6, 0, '동료 레벨 잠금 기준 1.15배 → 1.05배, 식량이 10% 아래면 유지비 −30%', (m, l) => { add(m, 'lockCut', 0.01 * l); add(m, 'lowFoodUpkeepCut', 0.3); }),
  R(37, '동면 캡슐', 6, 1, '오프라인 동안 유지비 없음, 오프라인 효율 +1%/레벨', (m, l) => { m.offlineNoUpkeep = true; add(m, 'offlineEff', 0.01 * l); }),
  R(38, '방폭문', 6, 2, '벙커가 30% 아래로 처음 떨어지면 3초 버티고 그동안 수리 3배', (m, l) => { add(m, 'breachShield', 0.15 + 0.015 * l); add(m, 'repairPct', 0.1); }),
  R(39, '방독면', 6, 3, '산성·정지로 멈추는 시간 절반, 사수 기절 −20%', (m, l) => { add(m, 'turretResist', 0.5 + 0.03 * l); add(m, 'stunResist', 0.2); }),
  R(40, '정찰 드론', 6, 4, '보스 패턴을 미리 보고 제한시간 +0.5초/레벨', (m, l) => { add(m, 'bossTimeBonus', 0.5 * l); }),
  R(41, '재활용기', 6, 5, '1% 수리마다 광물 환급, 중복 분해 부품 +10%/레벨', (m, l) => { add(m, 'repairOre', 0.2 + 0.02 * l); add(m, 'dismantlePct', 0.1 * l); }),
  // 연구 (new): they bend time and the medal rules
  R(42, '연구 일지', 7, 6, '연구가 끝나면 그 시간의 5%·레벨을 다음 연구로 넘김', (m, l) => { add(m, 'researchCarry', 0.05 * l); }),
  R(43, '표본 냉동고', 7, 7, '보스를 잡을 때마다 진행 중인 연구 2분+0.2분/레벨', (m, l) => { add(m, 'bossResearchMin', 2 + 0.2 * l); }),
  R(44, '양자 계산기', 7, 5, '게임을 켜 둔 동안 연구 속도 1.5배', (m, l) => { add(m, 'activeResearch', 0.5 + 0.05 * l); }),
  R(45, '교리 서판', 7, 6, '환생 한 번의 훈장 상한 배수 +0.05/레벨', (m, l) => { add(m, 'doublingAdd', 0.05 * l); }),
  R(46, '기록 보관소', 7, 7, '훈장 계산에 난이도 +0.03/레벨', (m, l) => { add(m, 'medalH', 0.03 * l); }),
  R(47, '자동 실험대', 7, 7, '연구가 비면 가장 싼 연구를 30%+3%/레벨 속도로 진행', (m, l) => { add(m, 'autoResearch', 0.3 + 0.03 * l); }),
];
export const RELICS_BY_GRADE = Array.from({ length: 8 }, (_, g) => RELICS.filter(r => r.grade === g).map(r => r.id));

// doc: sets of three
export const SETS = [
  { key: 'smoke', name: '검은 연기', desc: '불탄 처치가 폭발', ids: [6, 7, 13], fx: m => add(m, 'crowdPct', 0.3) },
  { key: 'frostbite', name: '동상', desc: '빙결 대상에게 치명 2배', ids: [8, 9, 1], fx: m => add(m, 'critDmg', 0.5) },
  { key: 'storm', name: '폭풍', desc: '연쇄 +2', ids: [10, 11, 3], fx: m => { add(m, 'crowdPct', 0.4); add(m, 'aoeCover', 0.2); } },
  { key: 'hunter', name: '사냥꾼', desc: '처치 시 장전 −20%', ids: [2, 14, 5], fx: m => mul(m, 'reloadMul', 0.8) },
  { key: 'citadel', name: '성채', desc: '울타리 재생 2배', ids: [18, 19, 20], fx: m => add(m, 'repairPct', 1) },
  { key: 'quarter', name: '보급관', desc: '돌파 비용 −15%', ids: [25, 26, 27], fx: m => mul(m, 'btMul', 0.85) },
];
// doc: reactions between elements present in the loadout (relics, weapons, turrets)
export const REACTIONS = [
  { a: 'fire', b: 'ice', name: '불+얼음', desc: '냉각된 불타는 대상에게 +100%', fx: m => add(m, 'dmgPct', 0.3) },
  { a: 'ice', b: 'shock', name: '얼음+전기', desc: '빙결 대상에게 연쇄 2배', fx: m => add(m, 'crowdPct', 0.3) },
  { a: 'fire', b: 'shock', name: '불+전기', desc: '연쇄를 따라 화상이 퍼짐', fx: m => { add(m, 'burnUptime', 0.2); add(m, 'crowdPct', 0.15); } },
  { a: 'pierce', b: 'crit', name: '관통+치명', desc: '관통 1명당 치명 +1%', fx: (m, c) => add(m, 'critChance', 0.01 * (c.pierceCount || 0)) },
];

export const relicSlots = record => T.relics.slotsAt.filter(r => record >= r).length;
export const newRelics = () => ({ level: new Array(RELICS.length).fill(0), dupes: new Array(RELICS.length).fill(0), shards: 0, equipped: [], sum: null, kills: 0 });
// a copy: the first owns it at level 1, then duplicates level it (l duplicates for l -> l + 1), then shards
export function addRelic(rel, id) {
  if (rel.level[id] === 0) { rel.level[id] = 1; return 'new'; }
  if (rel.level[id] >= T.relics.maxLevel) { rel.shards += RELICS[id].grade + 1; return 'shard'; }
  rel.dupes[id]++;
  if (rel.dupes[id] >= rel.level[id]) { rel.dupes[id] -= rel.level[id]; rel.level[id]++; return 'level'; }
  return 'dupe';
}
export function rollRelic(rng, rel, sum) { const g = rollGrade(rng, sum), id = rng.pick(RELICS_BY_GRADE[g]); return { id, result: addRelic(rel, id) }; }
// shards buy a chosen relic (doc: 유물 선택)
export const shardPrice = grade => 6 * (grade + 1) ** 2;

// the mods of the equipped relics, their sets and the reactions; elements: tags from weapons and turrets
export function relicMods(rel, ctx = {}, elements = []) {
  const m = {};
  const on = new Set(rel.equipped.filter(id => rel.level[id] > 0));
  const els = new Set(elements);
  for (const id of on) { const r = RELICS[id]; r.fx(m, rel.level[id], ctx); if (r.el) els.add(r.el); }
  for (const s of SETS) if (s.ids.every(id => on.has(id))) s.fx(m, ctx);
  if ((m.pierceCount || 0) > 0 || (ctx.pierce || 0) > 0) els.add('pierce');
  if ((m.critChance || 0) > 0 || (ctx.crit || 0) > 0) els.add('crit');
  m.reactions = [];
  for (const x of REACTIONS) if (els.has(x.a) && els.has(x.b)) { x.fx(m, { pierceCount: (m.pierceCount || 0) + (ctx.pierce || 0) }); m.reactions.push(x.name); }
  return m;
}
