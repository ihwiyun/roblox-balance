// Stages: the difficulty curve H(s), zombie stats, the bands and their bosses, the 101+ zone rule, how a stage
// plays out against a set of final stats (from power.mjs), auto-skip and stage rewards.
import { T } from './tuning.mjs';

export const STAGE_CAP = () => T.stage.cap;
// difficulty index: stays readable past 10,000 (H(30,000) ~ 227, so every number fits in a double)
export const H = s => 20 * (Math.sqrt(1 + s / 200) - 1) + T.stage.e * Math.min(s, 100);
export const zone = s => Math.floor((s - 1) / 100);            // 0 for 1..100, 1 for 101..200 ...
export const band = s => Math.floor(((s - 1) % 100) / 10);     // 0..9, the same themes every zone
// 101+: elites with a trait, 10% of a stage at 101 rising to 40% by 1,101
export const eliteShare = s => (s <= 100 ? 0 : Math.min(0.4, 0.1 + 0.3 * (s - 101) / 1000));
export const zombieHp = s => 20 * 10 ** H(s) * (1 + T.stage.eliteHp * eliteShare(s));
export const zombieAtk = s => 4 * 10 ** (0.7 * H(s));
export const killGold = s => 3 * 10 ** (0.8 * H(s)) * (1 + T.stage.eliteGold * eliteShare(s));
export const killsOf = s => 30 + Math.min(30, Math.floor(s / 10));
export const kindOf = s => (s % 100 === 0 ? 'titan' : s % 10 === 0 ? 'boss' : 'normal');

export const ZOMBIES = {
  walker: { name: '워커' }, crawler: { name: '크롤러' }, runner: { name: '러너' }, bloater: { name: '부푼 놈' },
  spitter: { name: '침 뱉는 놈' }, armored: { name: '장갑 좀비' }, brute: { name: '덩치' }, burrower: { name: '굴 파는 놈' },
  screamer: { name: '비명 지르는 놈' }, leaper: { name: '뛰는 놈' }, regenerator: { name: '재생하는 놈' }, giant: { name: '거인' },
};
export const ELITE_TRAITS = ['장갑', '질주', '재생', '분열', '흡수'];
// each band: 2-3 kinds and a boss with its own pattern (the titan closes every hundred)
export const BANDS = [
  { from: 1, theme: '외곽', zombies: ['walker', 'crawler'], boss: '도살자', pattern: 'charge' },
  { from: 11, theme: '고속도로', zombies: ['runner', 'walker'], boss: '폭주떼', pattern: 'swarm' },
  { from: 21, theme: '병원', zombies: ['bloater', 'spitter'], boss: '역병 의사', pattern: 'acidPool' },
  { from: 31, theme: '경찰서', zombies: ['armored', 'brute'], boss: '진압 거상', pattern: 'frontArmor' },
  { from: 41, theme: '지하철', zombies: ['burrower', 'crawler'], boss: '굴의 어미', pattern: 'burrow' },
  { from: 51, theme: '공장', zombies: ['brute', 'screamer'], boss: '울부짖는 자', pattern: 'howl' },
  { from: 61, theme: '숲', zombies: ['leaper', 'runner'], boss: '도약 왕', pattern: 'leapStun' },
  { from: 71, theme: '연구소', zombies: ['regenerator', 'bloater'], boss: '히드라 덩어리', pattern: 'regen' },
  { from: 81, theme: '부두', zombies: ['giant', 'spitter'], boss: '산성 여왕', pattern: 'turretStun' },
  { from: 91, theme: '폐허', zombies: ['giant', 'armored', 'screamer'], boss: '타이탄', pattern: 'split' },
];
// what a pattern does, and what answers it (the counters come from power.mjs: pierce, burn, aoe, resist)
export const PATTERNS = {
  charge: { desc: '12초마다 울타리 돌진 3회', pressure: 6 },
  swarm: { desc: '8초마다 러너 무리', divert: 0.25 },
  acidPool: { desc: '산성 웅덩이로 터렛 정지', turretDown: 0.5 },
  frontArmor: { desc: '정면 장갑 90%, 관통이나 측면 사격 필요', armor: 0.9 },
  burrow: { desc: '울타리 안쪽에서 솟아남', pressure: 4, bypassFence: true },
  howl: { desc: '15초마다 좀비 속도 +60%', pressure: 3, divert: 0.15 },
  leapStun: { desc: '지붕에 착지해 사수 기절', gunnerDown: 0.2 },
  regen: { desc: '불타지 않으면 초당 3% 재생', regen: 0.03 },
  turretStun: { desc: '5초간 터렛 정지', turretDown: 0.33 },
  split: { desc: '체력 50%에서 셋으로 분열', split: 0.25 },
};
export const bandOf = s => BANDS[band(s)];
// the boss of a stage: its band's pattern, plus one more per zone past the first hundred (at half strength)
export function bossPatterns(s) {
  const b = s % 100 === 0 ? 9 : band(s), z = zone(s), list = [{ key: BANDS[b].pattern, w: 1 }];
  for (let i = 1; i <= Math.min(z, T.stage.maxExtraPatterns); i++) list.push({ key: BANDS[(b + i) % 10].pattern, w: T.stage.extraPatternStrength });
  return list;
}
export function bossInfo(s) {
  const kind = kindOf(s);
  if (kind === 'normal') return null;
  const b = kind === 'titan' ? BANDS[9] : BANDS[band(s)];
  return { kind, name: b.boss, patterns: bossPatterns(s), hpMul: kind === 'titan' ? T.stage.titanHp : T.stage.bossHp,
    time: kind === 'titan' ? T.stage.titanTime : T.stage.bossTime, phases: kind === 'titan' ? T.stage.titanPhases.slice() : [1] };
}
const bossLimit = kind => (kind === 'titan' ? T.stage.titanTime - (T.stage.titanPhases.length - 1) * T.stage.phaseGap : T.stage.bossTime);
// the firepower a stage "needs": the pace a normal stage is measured at, or the boss timer
export function reqDps(s) {
  const kind = kindOf(s), hp = zombieHp(s);
  if (kind === 'normal') return killsOf(s) * hp / T.stage.tRef;
  return (kind === 'titan' ? T.stage.titanHp : T.stage.bossHp) * hp / bossLimit(kind);
}

// damage to the base: the fence takes it first, then the bunker; repairmen work through the fight
function hurt(pool, dmg, repair, time, bypassFence) {
  let fence = pool.fence, bunker = pool.bunker, rep = repair * time;
  if (!bypassFence) { const f = Math.min(fence, dmg); fence -= f; dmg -= f; }
  bunker -= dmg;
  // repairs: fence, then bunker (doc: fence -> bunker -> turrets)
  const rf = Math.min(rep, pool.fenceMax - fence); fence += rf; rep -= rf;
  if (bunker > 0) { const rb = Math.min(rep, pool.bunkerMax - bunker); bunker += rb; rep -= rb; }
  const repaired = repair * time - rep;
  return { fence, bunker, repaired };
}

// a normal stage: zombies come every spawnEvery seconds and walk to the fence; whoever is still alive when it
// gets there hits it until shot. st: final stats; pool: { fence, bunker, fenceMax, bunkerMax }
export function resolveNormal(s, st, pool) {
  const k = killsOf(s), hp = zombieHp(s), r = 1 / T.stage.spawnEvery, dps = Math.max(1e-9, st.dpsCrowd);
  const mu = dps / hp;
  let time, fenceTime = 0;
  if (mu >= r) time = k / r + Math.min(T.stage.walk, hp / dps);
  else {
    time = k / mu;
    const d = 1 / mu - 1 / r, x = k * d - T.stage.walk;
    if (x > 0) fenceTime = x * x / (2 * d);
  }
  const dmg = zombieAtk(s) * fenceTime / T.stage.hitEvery * (1 - (st.slow || 0)) * (st.dmgTakenMul ?? 1);
  const after = hurt(pool, dmg, st.repairPerSec || 0, Math.min(time, T.stage.normalLimit), false);
  const ok = time <= T.stage.normalLimit && after.bunker > 0;
  return { ok, time: Math.min(time, T.stage.normalLimit), dmg, kills: ok ? k : Math.floor(Math.min(k, mu * T.stage.normalLimit)), ...after };
}

// a boss or titan: its patterns bend the stats; counters (pierce, burn, aoe, resist) undo them
export function bossMods(s, st) {
  const m = { gunner: 1, turret: 1, regen: 0, hpMul: 1, pressure: 0, bypassFence: false };
  for (const { key, w } of bossPatterns(s)) {
    const p = PATTERNS[key];
    if (p.pressure) m.pressure += p.pressure * w;
    if (p.divert) m.gunner *= 1 - p.divert * w * (1 - (st.aoeCover || 0));
    if (p.turretDown) m.turret *= 1 - p.turretDown * w * (1 - (st.turretResist || 0));
    if (p.armor) { m.gunner *= 1 - p.armor * w * (1 - (st.pierceShare || 0)); m.turret *= 1 - p.armor * w * 0.3; }
    if (p.bypassFence && w >= 1) m.bypassFence = true;
    if (p.gunnerDown) m.gunner *= 1 - p.gunnerDown * w * (1 - (st.stunResist || 0));
    if (p.regen) m.regen += p.regen * w;
    if (p.split) m.hpMul *= 1 + p.split * w * (1 - (st.aoeCover || 0));
  }
  return m;
}
export function resolveBoss(s, st, pool) {
  const kind = kindOf(s), m = bossMods(s, st), hp = zombieHp(s);
  const bossHp = (kind === 'titan' ? T.stage.titanHp : T.stage.bossHp) * hp * m.hpMul;
  const limit = bossLimit(kind) + (st.bossTimeBonus || 0);
  const regen = m.regen * bossHp * (1 - (st.burnUptime || 0));    // hp/s the boss heals back (fire stops it)
  const gross = (st.dpsGunners * m.gunner + st.dpsTurrets * m.turret) * (st.bossMul || 1), dps = gross - regen;
  const time = dps > 0 ? Math.max(6, bossHp / dps) : Infinity;
  const fight = Math.min(time, limit);
  const dmg = m.pressure * zombieAtk(s) * fight * (1 - (st.slow || 0)) * (st.dmgTakenMul ?? 1);
  const after = hurt(pool, dmg, st.repairPerSec || 0, fight, m.bypassFence);
  const ok = time <= limit && after.bunker > 0;
  return { ok, time: fight, dmg, kills: ok ? 1 : 0, need: bossHp / limit, have: dps, gross, regen, ...after };
}
export const resolveStage = (s, st, pool) => (kindOf(s) === 'normal' ? resolveNormal(s, st, pool) : resolveBoss(s, st, pool));

// auto-skip (progress mode): while the firepower is mult times what the next stage needs, jump (up to 50)
export function autoSkip(s, power, mult = T.stage.skipMult) {
  let t = s;
  while (t - s < T.stage.skipMax && t + 1 <= T.stage.cap && power >= mult * reqDps(t + 1)) t++;
  return t;
}

// what a cleared stage pays (first-clear gems are booked by the economy, which knows the record)
export function stageRewards(s) {
  const kind = kindOf(s), g = killGold(s), k = killsOf(s), clearXp = 5 + s / 5;
  if (kind === 'normal') return { kind, gold: g * k, xp: k * (1 + s / 20) + clearXp, parts: T.stage.killParts * k, kills: k, relic: 0 };
  if (kind === 'boss') return { kind, gold: g * T.stage.bossGold, xp: 50 + s + clearXp, parts: T.stage.bossParts, kills: 1, relic: T.relics.bossDrop };
  return { kind, gold: g * T.stage.titanGold, xp: 3 * (50 + s) + clearXp, parts: 3 * T.stage.bossParts, kills: 1, relic: T.relics.titanDrop };
}
