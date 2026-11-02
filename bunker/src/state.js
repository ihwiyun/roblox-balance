'use strict';
// Game state, small helpers on it, and save/load with offline gains.
/* ================= state ================= */
const G = {
  money: 0, food: 0, mineral: 0,
  lv: { atk: 0, spd: 0, mag: 0 }, bunker: 1, fence: 0, live: 0, farm: 0, mine: 0,
  crew: [null, null, null, null, null],
  wave: 1, waveKills: 0, totalKills: 0, best: 1, repeat: false, earned: 0,
  hp: 150, fenceHp: 0, fenceDown: false, sideDmg: [0, 0, 0, 0], sideStage: [0, 0, 0, 0],
  zombies: [], spits: [], tracers: [], parts: [], uparts: [], decals: [], floats: [], bossFor: 0, seen: [], floorView: 0,
  hero: null, time: 0, spawnIn: 2, speed: 1, hurt: 0, hungry: false, saveIn: 5, view: 'yard',
  // the systems (systems.js): gems (free) and diamonds (paid), medals, parts (부품: comps, since G.parts holds the
  // particles), the best stage ever cleared (record) and this run's (runBest), the boss clock; the rest it adds itself
  gems: 0, diamonds: 0, medals: 0, medalsLife: 0, comps: 0, record: 0, runBest: 0, runKills: 0, evacs: 0, bossLeft: 0,
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
const px = n => Math.max(1, Math.round(n * S / 12));

/* ================= save ================= */
// version 5: the game as before plus the systems' state (systems.js keeps it in G under these keys)
const SYS_KEYS = ['gems', 'diamonds', 'medals', 'medalsLife', 'comps', 'record', 'runBest', 'runKills', 'evacs', 'evacAt', 'runs', 'medalUp', 'cmd',
  'wInv', 'tInv', 'rel', 'cards', 'sums', 'equipW', 'equipT', 'manual', 'shop', 'counts', 'autoSet', 'autoShare', 'early', 'oreGems', 'daily', 'activity', 'rng', 'sysInit'];
// the jobs a hand can have: the roof's gunners (hired by bed), and the hands bought for the farm, the mine and the workshop
const ALL_JOBS = [...JOBS, '정비공'];
function save() {
  if (skipSave) return;
  try {
    const d = {
      money: G.money, food: G.food, mineral: G.mineral, lv: G.lv, bunker: G.bunker, fence: G.fence, live: G.live, farm: G.farm, mine: G.mine,
      crew: G.crew.map(c => c && { job: c.job, fatigue: c.fatigue }), wave: G.wave, waveKills: G.waveKills, totalKills: G.totalKills, best: G.best, repeat: G.repeat, at: Date.now(),
      hp: G.hp, fenceHp: G.fenceHp, fenceDown: G.fenceDown, seen: G.seen, bossFor: bossAlive() ? 0 : G.bossFor, ver: 5,
    };
    for (const k of SYS_KEYS) if (G[k] !== undefined) d[k] = G[k];
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
  } catch { /* saving is a convenience */ }
}
function load() {
  let d = null, raw = null, old = false;
  try {
    raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { raw = localStorage.getItem(OLD_SAVE_KEY); old = !!raw; }
    d = raw ? JSON.parse(raw) : null;
  } catch { d = null; }
  // a save from before the systems: its text is kept as it was under BACKUP_KEY, then it is carried over (nothing is lost)
  if (old && d) try { if (!localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, raw); } catch { /* fine */ }
  if (d && d.lv) {
    for (const k of ['money', 'food', 'mineral', 'waveKills', 'totalKills']) G[k] = +d[k] || 0;
    G.wave = Math.max(1, +d.wave || 1);
    // the best wave reached (saves from before it was kept start from the wave they were on)
    G.best = Math.max(G.wave, +d.best || 0); G.repeat = d.repeat === true;
    for (const k of Object.keys(G.lv)) G.lv[k] = clamp(+d.lv[k] || 0, 0, GUN[k].max);
    // saves from before the 100-level buildings (40 levels): the same strength sits at a higher level now
    const older = !(d.ver >= 4), up = L => L > 0 ? 1 + Math.round((L - 1) / LEVEL_STRETCH) : 0;
    G.bunker = clamp(older ? up(+d.bunker || 1) : +d.bunker || 1, 1, MAX_BUNKER); G.fence = clamp(older ? up(+d.fence || 0) : +d.fence || 0, 0, MAX_FENCE);
    G.live = clamp(+d.live || 0, 0, LIVE.max); G.farm = clamp(+d.farm || 0, 0, FARM.max); G.mine = clamp(+d.mine || 0, 0, MINE.max);
    // the hands below are nameless now (bought for their floor); the roof's gunners keep their names
    if (Array.isArray(d.crew)) d.crew.forEach((c, i) => { if (c && i < bedsOf(G.live) && ALL_JOBS.includes(c.job)) { const p = makePerson(i); p.job = c.job; if (c.job !== '사수') p.name = c.job; p.fatigue = clamp(+c.fatigue || 0, 0, 99); G.crew[i] = p; } });
    G.hp = Number.isFinite(+d.hp) && d.hp > 0 ? Math.min(+d.hp, bunkerHp(G.bunker)) : bunkerHp(G.bunker);
    G.fenceHp = Number.isFinite(+d.fenceHp) ? clamp(+d.fenceHp, 0, fenceHp(G.fence)) : fenceHp(G.fence);
    G.fenceDown = !!d.fenceDown && G.fence > 0;
    G.seen = Array.isArray(d.seen) ? d.seen.filter(k => ZTYPES[k]) : MUTANT_ORDER.filter(k => ZTYPES[k].from <= G.wave);
    G.bossFor = +d.bossFor === G.wave ? G.wave : 0; // this wave's boss already fell
    // the systems' state; a version-4 save has none: its best stage cleared is the one before the best reached
    for (const k of SYS_KEYS) if (d[k] !== undefined) G[k] = d[k];
    if (!(d.ver >= 5)) { G.record = Math.max(0, G.best - 1); G.runBest = G.record; }
  } else { G.hp = bunkerHp(G.bunker); G.fenceHp = fenceHp(G.fence); }
  // the systems fill in what they need (a first start, or an old save, gets what its climb would have brought)
  SYS.ensure();
  if (d && d.lv) {
    // saves from before the stores had a size keep no more than the stores hold
    G.food = Math.min(G.food, foodCap()); G.mineral = Math.min(G.mineral, mineralCap());
    creditAway(clamp((Date.now() - (+d.at || Date.now())) / 1000, 0, offlineCap()), 300);
  }
  if (old && d) { save(); try { localStorage.removeItem(OLD_SAVE_KEY); } catch { /* fine */ } }
}
// the longest time away that counts: two hours, more with the medals, the monthly pass and the offline item
const offlineCap = () => OFFLINE_CAP + SYS.hook.offlineH() * 3600;
// what the floors made while nobody was looking: the farm, the mine and the workshop with the workers on their books
// (they sleep about a fifth of the time), less what everyone ate. The note says what actually reached the stores
function creditAway(away, delay = 0) {
  if (away <= 30) return;
  const workers = job => hired().filter(c => c.job === job).length * .8, eff = SYS.hook.offlineEff();
  const upkeep = SYS.hook.offlineUpkeep() ? hired().length * UPKEEP * SYS.hook.upkeep() : 0;
  const food = (outputOf('food', workers('농부')) * SYS.hook.prod('food') * eff - upkeep) * away, ore = outputOf('mineral', workers('광부')) * SYS.hook.prod('mineral') * eff * away;
  const parts = SYS.hook.partsRate(workers('정비공')) * eff * away;
  const f0 = G.food, m0 = G.mineral, p0 = G.comps;
  G.food = clamp(G.food + food, 0, Math.max(G.food, foodCap())); G.mineral = Math.min(Math.max(G.mineral, mineralCap()), G.mineral + ore);
  G.comps = Math.min(Math.max(G.comps, partsCap()), G.comps + parts);
  const df = G.food - f0, dm = G.mineral - m0, dp = G.comps - p0, notes = [];
  SYS.hook.ore(dm);
  if (Math.abs(df) >= 1) notes.push('식량 ' + (df > 0 ? '+' : '-') + fmt(Math.abs(df)));
  if (dm >= 1) notes.push('광물 +' + fmt(dm));
  if (dp >= 1) notes.push('부품 +' + fmt(dp));
  if (notes.length) setTimeout(() => notify('자리 비운 동안', notes.join(' · '), df < 0 ? 'danger' : 'good'), delay);
}
addEventListener('beforeunload', save);
// a hidden tab gets no frames: on return a short absence (up to 30 s) is played out by the frame loop, which
// catches up that far; a longer one is credited like a reload, and the clock restarts
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); hiddenAt = Date.now(); return; }
  if (!hiddenAt) return;
  const away = Math.min(offlineCap(), (Date.now() - hiddenAt) / 1000);
  hiddenAt = 0;
  if (away > CATCH_UP) { creditAway(away); resumeClock(); }
});
