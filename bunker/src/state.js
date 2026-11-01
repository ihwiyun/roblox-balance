'use strict';
// Game state, small helpers on it, and save/load with offline gains.
/* ================= state ================= */
const G = {
  money: 0, food: 0, mineral: 0,
  lv: { atk: 0, spd: 0, mag: 0 }, bunker: 1, fence: 0, live: 0, farm: 0, mine: 0,
  crew: [null, null, null, null, null],
  wave: 1, waveKills: 0, totalKills: 0,
  hp: 150, fenceHp: 0, fenceDown: false, sideDmg: [0, 0, 0, 0], sideStage: [0, 0, 0, 0],
  zombies: [], spits: [], tracers: [], parts: [], uparts: [], decals: [], floats: [], bossFor: 0, seen: [],
  hero: null, time: 0, spawnIn: 2, speed: 1, hurt: 0, hungry: false, saveIn: 5, statusT: 0, view: 'yard',
};
const gunStat = k => GUN[k].val(G.lv[k]);
const hired = () => G.crew.filter(Boolean);
const canPay = c => Object.entries(c).every(([k, v]) => G[k] >= v);
function pay(c) { for (const [k, v] of Object.entries(c)) G[k] -= v; }
function fmt(n) {
  n = Math.max(0, n);
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n) + '';
  const units = ['K', 'M', 'B', 'T', 'aa', 'ab', 'ac'];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[i];
}
const RES_NAME = { money: '$', food: '식량', mineral: '광물' };
const px = n => Math.max(1, Math.round(n * S / 12));

/* ================= save ================= */
function save() {
  if (skipSave) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.money, food: G.food, mineral: G.mineral, lv: G.lv, bunker: G.bunker, fence: G.fence, live: G.live, farm: G.farm, mine: G.mine,
      crew: G.crew.map(c => c && { job: c.job, fatigue: c.fatigue }), wave: G.wave, waveKills: G.waveKills, totalKills: G.totalKills, at: Date.now(),
      hp: G.hp, fenceHp: G.fenceHp, fenceDown: G.fenceDown, seen: G.seen, ver: 4,
    }));
  } catch { /* saving is a convenience */ }
}
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { d = null; }
  if (d && d.lv) {
    for (const k of ['money', 'food', 'mineral', 'waveKills', 'totalKills']) G[k] = +d[k] || 0;
    G.wave = Math.max(1, +d.wave || 1);
    for (const k of Object.keys(G.lv)) G.lv[k] = clamp(+d.lv[k] || 0, 0, GUN[k].max);
    // saves from before the 100-level buildings (40 levels): the same strength sits at a higher level now
    const old = !(d.ver >= 4), up = L => L > 0 ? 1 + Math.round((L - 1) / LEVEL_STRETCH) : 0;
    G.bunker = clamp(old ? up(+d.bunker || 1) : +d.bunker || 1, 1, MAX_BUNKER); G.fence = clamp(old ? up(+d.fence || 0) : +d.fence || 0, 0, MAX_FENCE);
    G.live = clamp(+d.live || 0, 0, LIVE.max); G.farm = clamp(+d.farm || 0, 0, FARM.max); G.mine = clamp(+d.mine || 0, 0, MINE.max);
    if (Array.isArray(d.crew)) d.crew.forEach((c, i) => { if (c && i < bedsOf(G.live) && JOBS.includes(c.job)) { const p = makePerson(i); p.job = c.job; p.fatigue = clamp(+c.fatigue || 0, 0, 99); G.crew[i] = p; } });
    G.hp = Number.isFinite(+d.hp) && d.hp > 0 ? Math.min(+d.hp, bunkerHp(G.bunker)) : bunkerHp(G.bunker);
    G.fenceHp = Number.isFinite(+d.fenceHp) ? clamp(+d.fenceHp, 0, fenceHp(G.fence)) : fenceHp(G.fence);
    G.fenceDown = !!d.fenceDown && G.fence > 0;
    G.seen = Array.isArray(d.seen) ? d.seen.filter(k => ZTYPES[k]) : MUTANT_ORDER.filter(k => ZTYPES[k].from <= G.wave);
    creditAway(clamp((Date.now() - (+d.at || Date.now())) / 1000, 0, OFFLINE_CAP), 300);
    return;
  }
  G.hp = bunkerHp(G.bunker); G.fenceHp = fenceHp(G.fence);
}
// what the floors made while nobody was looking: the farm and the mine with the workers on their books
// (they sleep about a fifth of the time), less what everyone ate
function idleRate(res) {
  const n = hired().filter(c => c.job === (res === 'food' ? '농부' : '광부')).length * .8, base = (res === 'food' ? FARM : MINE).rate(res === 'food' ? G.farm : G.mine);
  return base * (1 + n) + n * .2;
}
function creditAway(away, delay = 0) {
  if (away <= 30) return;
  const food = (idleRate('food') - hired().length * UPKEEP) * away, ore = idleRate('mineral') * away;
  G.food = Math.max(0, G.food + food); G.mineral += ore;
  const parts = [];
  if (food > 1) parts.push('식량 +' + fmt(food));
  if (ore > 1) parts.push('광물 +' + fmt(ore));
  if (parts.length) setTimeout(() => notify('자리 비운 동안', parts.join(' · '), 'good'), delay);
}
addEventListener('beforeunload', save);
// a hidden tab gets no frames: on return the time away is credited like a reload, and the clock restarts
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); hiddenAt = Date.now(); return; }
  if (!hiddenAt) return;
  const away = Math.min(OFFLINE_CAP, (Date.now() - hiddenAt) / 1000);
  hiddenAt = 0;
  if (away > 5) { creditAway(away); resumeClock(); }
});
