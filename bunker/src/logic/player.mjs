// The commander: XP from kills, clears and bosses (and overflowing stores), levels, and the six stats that
// all multiply the final numbers. Opens at stage 10 (doc 5).
import { T } from './tuning.mjs';

export const STATS = ['power', 'rapid', 'luck', 'precision', 'command', 'supply'];
export const STAT_INFO = {
  power: { name: '위력', desc: '피해 ×(1+0.03p)' },
  rapid: { name: '속사', desc: '연사 ×(1+0.01p)' },
  luck: { name: '행운', desc: '금화 ×(1+0.03p)' },
  precision: { name: '정밀', desc: '치명 피해 +2%·p' },
  command: { name: '지휘', desc: '동료·터렛 ×(1+0.03p)' },
  supply: { name: '보급', desc: '생산 ×(1+0.02p)' },
};
export const killXp = s => 1 + s / 20;
export const clearXp = s => 5 + s / 5;
export const bossXp = s => 50 + s;
export const xpToNext = l => Math.ceil(T.player.xpBase * l ** T.player.xpPow);   // level l -> l + 1

export const newCommander = () => ({ level: 1, xp: 0, unspent: 0, points: Object.fromEntries(STATS.map(k => [k, 0])) });
// returns the number of levels gained; levels wait until the commander opens
export function addXp(cmd, xp, unlocked = true) {
  cmd.xp += xp;
  if (!unlocked) return 0;
  let gained = 0;
  for (let need = xpToNext(cmd.level); cmd.xp >= need; need = xpToNext(cmd.level)) {
    cmd.xp -= need; cmd.level++; cmd.unspent += T.player.pointsPerLevel; gained++;
  }
  return gained;
}
// spend free points toward a plan of shares, e.g. { power: .4, luck: .2, ... }: each point goes to the stat
// furthest below its share
export function spendPoints(cmd, plan) {
  const keys = Object.keys(plan).filter(k => plan[k] > 0);
  while (cmd.unspent > 0 && keys.length) {
    let total = 0;
    for (const k of STATS) total += cmd.points[k];
    let best = keys[0], gap = -Infinity;
    for (const k of keys) { const g = plan[k] * (total + 1) - cmd.points[k]; if (g > gap) { gap = g; best = k; } }
    cmd.points[best]++; cmd.unspent--;
  }
}
// the six multipliers (precision is an addition to crit damage)
export function statMuls(points) {
  const p = k => points[k] || 0;
  return { dmg: 1 + 0.03 * p('power'), rate: 1 + 0.01 * p('rapid'), gold: 1 + 0.03 * p('luck'),
    critDmg: 0.02 * p('precision'), crew: 1 + 0.03 * p('command'), prod: 1 + 0.02 * p('supply') };
}
