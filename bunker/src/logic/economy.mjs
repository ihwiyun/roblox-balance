// The economy: game state, time passing (stage attempts, production, stores, research, gem sources), offline
// credit, evacuation, and one price/buy pair for every upgrade track. No DOM; the game, node tests and the server
// all step this same code.
import { T } from './tuning.mjs';
import { resolveStage, stageRewards, autoSkip, killsOf } from './stages.mjs';
import { workshopCost, bunkerGold, fenceGold, needsBreakthrough, breakthroughCost, capToStores, SECTIONS, SECTION_KEYS,
  sectionLevelGold, sectionTierCost, sectionCapCost, shooterSlots, turretSlots, beds, overflow } from './curves.mjs';
import { newCommander, addXp } from './player.mjs';
import { medalGain, medalUpCost, medalUpMaxed, automation, researchCost, researchSeconds, RESEARCH_UNLOCK } from './medals.mjs';
import { makeRng, newInventory, newSummon, addCopy, summonWeapon, summonTurret, mergeAll, enhCap, enhCost, enhNeedsBt, enhBtCost,
  bestOwned, turretMul, WEAPONS, TURRETS } from './gear.mjs';
import { newRelics, rollRelic, relicSlots, RELICS } from './relics.mjs';
import { newCrew, addCard, recruit, STORY_RECRUITS, levelGold, needsBt, btCost, canLevel, autoAssign } from './crew.mjs';
import { newShop, PRICES, PASSES, SEASON_FREE, grant } from './shop.mjs';
import { computeStats } from './power.mjs';

export function newGame(seed = 1) {
  const st = {
    rng: makeRng(seed), t: 0, active: 0, stage: 1, record: 0, runBest: 0, mode: 'progress',
    gold: 0, food: 0, ore: 0, parts: 0, gems: T.economy.startGems, diamonds: 0, medals: 0, medalsLife: 0, fame: 0,
    ws: { atk: 0, rate: 0, mag: 0, reload: 0 }, bunker: 1, bunkerBt: 0, fence: 0, fenceBt: 0,
    sec: Object.fromEntries(SECTION_KEYS.map(k => [k, { lv: 0, bt: 0, tier: 0, cap: 0 }])),
    cmd: newCommander(), medalUp: {}, evacs: 0, evacAt: [], research: { lv: {}, active: [] },
    weapons: newInventory(WEAPONS.length), wSum: newSummon(), equipW: [],
    turrets: newInventory(TURRETS.length), tSum: newSummon(), equipT: [],
    relics: newRelics(), rSum: newSummon(), crew: newCrew(), cSum: newSummon(), shop: newShop(),
    pool: { fence: 0, bunker: 0 }, counts: { kills: 0, bossKills: 0, titanKills: 0, killsForRelic: 0 },
    boostUntil: 0, activityT: 0, goldRate: 0, cur: null, S: null, early: {}, ev: null,
  };
  addCopy(st.weapons, 0);                     // the hero's rusty revolver
  recruitStory(st, 1);
  assignCrew(st); equipBest(st); refill(st);
  return st;
}
export const stats = st => st.S || (st.S = computeStats(st));
const dirty = st => { st.S = null; };
const emit = (st, type, data) => st.ev && st.ev(type, data);
const refill = st => { const S = stats(st); st.pool = { fence: S.fenceMax, bunker: S.bunkerMax }; };
export const auto = st => automation(st.evacs, st.early);
const sectionOpen = (st, key) => (SECTIONS[key].unlockRecord ? st.record >= SECTIONS[key].unlockRecord : st.record + 1 >= SECTIONS[key].unlock);

function recruitStory(st, upTo) { for (const [at, id] of STORY_RECRUITS) if (upTo >= at && !st.crew.cards[id]) { addCard(st.crew, id); emit(st, 'card', id); } }
export function assignCrew(st) {
  const sl = k => (sectionOpen(st, k) && SECTIONS[k].slots ? SECTIONS[k].slots(st.sec[k].tier) : 0);
  autoAssign(st.crew, { roof: shooterSlots(st.bunker), food: sl('food'), mine: sl('mine'), shop: sl('shop'), lab: sl('lab') }, beds(st.sec.bed.tier));
  dirty(st);
}
// the best weapons in the shooters' hands, the best turrets in the slots, the strongest relics in the relic slots
export function equipBest(st) {
  // the best guns go to the strongest shooters (equipW[j] is held by crew.assign.roof[j]). The hero has no crew-level
  // multiplier, so handing it the best weapon (the old order) left weapons and the packages that sell them nearly idle
  const roof = st.crew.assign.roof.slice(0, shooterSlots(st.bunker)), best = bestOwned(st.weapons, roof.length);
  const strength = id => (id === 'me' ? 1 : 1 + T.crew.gunnerPerLevel * st.crew.cards[id].level) * (id === st.crew.leader ? 1 + T.crew.leaderPct : 1);
  const order = roof.map((id, j) => j).sort((a, b) => strength(roof[b]) - strength(roof[a]));
  st.equipW = new Array(roof.length).fill(-1);
  order.forEach((j, k) => { st.equipW[j] = best[k] ?? -1; });
  st.equipT = bestOwned(st.turrets, turretSlots(st.bunker), turretMul);
  const n = relicSlots(st.record), score = id => (RELICS[id].grade + 1) * (4 + st.relics.level[id]);
  st.relics.equipped = RELICS.map(r => r.id).filter(id => st.relics.level[id] > 0).sort((a, b) => score(b) - score(a)).slice(0, n);
  dirty(st);
}

/* ---------- time ---------- */
function startAttempt(st) {
  const S = stats(st), A = auto(st);
  let skipTime = 0;
  if (st.mode === 'progress' && st.stage <= st.record) {
    // doc 6: while the firepower is 10x what the next stage needs, jump (at most 50 stages a jump). Jumps chain: a
    // re-climb used to play one full stage between jumps, so climbing back to stage 1,000 took ~40 min every run
    const mult = S.skipMult || (A.skip5x ? T.stage.skipMultAuto : T.stage.skipMult);
    let to = st.stage - 1, first = true;
    for (let next; (next = Math.min(st.record, autoSkip(to, S.skipPower, mult))) > to; to = next, first = false)
      if (!(first && A.startSkip && st.runBest === 0)) skipTime += (next - to) * T.stage.skipStepTime;  // 5 evacuations: the first jump is free
    if (to >= st.stage) { st.runBest = Math.max(st.runBest, to); st.stage = to + 1; }
  }
  const s = Math.min(st.stage, T.stage.cap);
  const res = resolveStage(s, S, { ...st.pool, fenceMax: S.fenceMax, bunkerMax: S.bunkerMax });
  st.cur = { s, el: 0, dur: res.time + skipTime + 2, skipTime, res, rw: stageRewards(s) };
}
function earnGold(st, g) { st.gold += g; st.goldEarned = (st.goldEarned || 0) + g; }
function finishAttempt(st) {
  const c = st.cur, S = stats(st), boost = st.t < st.boostUntil ? 2 : 1;
  st.cur = null; st.last = c;
  const parts = c.res.repaired / (0.01 * (S.fenceMax + S.bunkerMax)) * S.repairPartsMul;
  st.parts = Math.max(0, st.parts - parts); st.ore += parts * S.repairOre;
  emit(st, 'spend', { parts });
  if (!c.res.ok) {
    st.mode = 'repeat'; st.stage = Math.max(1, c.s - 1); st.failStage = c.s; st.failDps = S.dps;
    refill(st);
    emit(st, 'fail', c.s);
    if (st.food <= 0 && S.prod.food < S.upkeep) evacuate(st, true);   // a breach while starving
    return;
  }
  const rw = c.rw;
  if (rw.kind !== 'normal') {
    earnGold(st, rw.gold * S.goldMul * boost + st.goldRate * (S.bossIncomeSec + S.bossClock * Math.max(0, T.stage.bossTime - c.res.time)));
    st.counts.bossKills++; if (rw.kind === 'titan') st.counts.titanKills++;
  }
  st.counts.kills += rw.kills; st.counts.killsForRelic += rw.kills;
  addXp(st.cmd, rw.xp * S.xpMul, st.record >= T.player.unlockStage);
  st.parts += rw.parts + (S.partsPerKill - T.stage.killParts) * rw.kills;
  let drops = Math.floor(st.counts.killsForRelic / T.relics.killsPerDrop);
  st.counts.killsForRelic -= drops * T.relics.killsPerDrop;
  if (rw.relic && st.rng.chance(rw.relic * (1 + S.relicFind))) drops++;
  for (let k = 0; k < drops; k++) openChest(st);
  st.pool = { fence: c.res.fence, bunker: c.res.bunker };
  if (c.s > st.record) newRecord(st, c.s, rw.kind);
  st.runBest = Math.max(st.runBest, c.s);
  if (st.mode === 'progress') st.stage = Math.min(T.stage.cap, c.s + 1);
  emit(st, 'clear', c.s);
}
function newRecord(st, s, kind) {
  const was = st.record;
  st.record = s;
  if (kind === 'boss') st.gems += T.economy.bossFirstGems;
  if (kind === 'titan') st.gems += T.economy.titanFirstGems;
  const tiers = every => Math.floor(s / every) - Math.floor(was / every);
  st.gems += tiers(SEASON_FREE.everyStages) * SEASON_FREE.gems;
  if (st.t < st.shop.seasonUntil) {
    st.gems += tiers(PASSES.season.everyStages) * PASSES.season.gems;
    for (let k = tiers(PASSES.season.chestEvery); k > 0; k--) openChest(st);
  }
  recruitStory(st, s);
  emit(st, 'record', s);
}
// stores: what does not fit becomes commander XP at 10:1 (gold with the alchemy furnace)
function store(st, S, res, add) {
  if (add <= 0) { st[res] = Math.max(0, st[res] + add); return; }
  const o = overflow(st[res], add, S.caps[res]);
  st[res] += o.kept;
  if (o.spill > 0) {
    if (S.alchemy) earnGold(st, o.spill / T.sections.overflowToXp * S.alchemy * st.goldRate);
    else addXp(st.cmd, o.xp, st.record >= T.player.unlockStage);
    emit(st, 'spill', { res, amount: o.spill });
  }
}
function produce(st, S, dt, eff = 1, upkeep = true) {
  const lowFood = st.food < 0.1 * S.caps.food ? 1 - S.lowFoodUpkeepCut : 1;
  store(st, S, 'food', (S.prod.food - (upkeep ? S.upkeep * lowFood : 0)) * dt * eff);
  store(st, S, 'ore', S.prod.ore * dt * eff);
  store(st, S, 'parts', S.prod.parts * dt * eff);
  if (S.gemsPerOre) {               // 광맥 지도: 1 gem per 2,000 ore, at most oreGemsPerDay a day
    const day = Math.floor(st.t / 86400);
    if (st.oreGemDay !== day) { st.oreGemDay = day; st.oreGems = 0; }
    const g = Math.min(S.gemsPerOre * S.prod.ore * dt * eff, T.relics.oreGemsPerDay - st.oreGems);
    if (g > 0) { st.gems += g; st.oreGems += g; }
  }
}
function research(st, S, dt, active) {
  const slots = st.shop.owned.researchSlot ? 2 : 1, speed = S.researchSpeed * (active ? 1 + S.activeResearch : 1);
  for (const r of st.research.active.slice(0, slots)) r.left -= dt * speed;
  for (const r of st.research.active.filter(x => x.left <= 0)) {
    st.research.lv[r.key] = (st.research.lv[r.key] || 0) + 1;
    st.research.active.splice(st.research.active.indexOf(r), 1);
    if (st.research.active[0]) st.research.active[0].left -= S.researchCarry * r.total;
    dirty(st); emit(st, 'research', r.key);
  }
}
// play time: dt seconds with the game open
export function advance(st, dt) {
  let left = dt;
  while (left > 1e-9) {
    if (!st.cur) startAttempt(st);
    const c = st.cur, S = stats(st), step = Math.min(left, c.dur - c.el);
    if (c.rw.kind === 'normal') {   // kill gold comes as the zombies fall
      const g = c.rw.gold * (c.res.kills / killsOf(c.s)) * S.goldMul * (st.t < st.boostUntil ? 2 : 1) * step / c.dur;
      earnGold(st, g);
    }
    produce(st, S, step);
    research(st, S, step, true);
    st.goldRate += (((st.goldEarned || 0) - (st.goldMark || 0)) / step - st.goldRate) * Math.min(1, step / 120);
    st.goldMark = st.goldEarned || 0;
    st.t += step; st.active += step; c.el += step; left -= step;
    st.activityT += step;
    while (st.activityT >= 600) { st.activityT -= 600; st.gems += T.economy.activityGemsPer10Min; }
    if (c.el >= c.dur - 1e-9) finishAttempt(st);
  }
}
// time away: gold at the recent pace and production, at the offline efficiency, up to the offline cap; the
// stores hold what they hold (a bigger store keeps more of a long night). Research runs on real time.
export function offline(st, seconds, adDouble = false) {
  const S = stats(st), extra = (st.t < st.shop.monthlyUntil ? PASSES.monthly.offlineH : 0) + (st.shop.owned.offline12 ? 12 : 0);
  const h = Math.min(seconds, (S.offlineH + extra) * 3600), eff = S.offlineEff * (adDouble ? 2 : 1);
  const before = { gold: st.gold, food: st.food, ore: st.ore, parts: st.parts };
  earnGold(st, st.goldRate * h * eff * T.economy.offlineGold);
  st.goldMark = st.goldEarned;
  produce(st, S, h, eff, !S.offlineNoUpkeep);
  research(st, S, seconds, false);
  st.t += seconds;
  return Object.fromEntries(Object.keys(before).map(k => [k, st[k] - before[k]]));
}
// raids (server battles; here only their economy): 5 tickets a day, each eats 12 minutes of food output and
// brings fame and parts; 500 fame buys a relic chest in the raid shop
export function raid(st) {
  const S = stats(st), cost = Math.min(S.prod.food * 60 * T.economy.raidFoodMinutes, 0.8 * S.caps.food);
  if (st.food < cost || cost <= 0) return false;
  st.food -= cost; st.fame += 100; st.parts += S.prod.parts * 300;
  emit(st, 'spend', { food: cost });
  if (st.fame >= 500) { st.fame -= 500; openChest(st); }
  return true;
}
export const watchAdBoost = st => { st.boostUntil = Math.max(st.t, st.boostUntil) + T.economy.adBoostMin * 60; };

/* ---------- evacuation ---------- */
export function medalsIfEvacuated(st, forced = false) {
  const S = stats(st), recent = st.evacAt.filter(t => st.t - t < 86400).length;
  return medalGain(st.runBest, st.medalsLife, { doubling: S.doubling, forced, bonus: S.medalPerEvac * recent, hAdd: S.medalH });
}
export function evacuate(st, forced = false) {
  const gain = medalsIfEvacuated(st, forced);
  if (!gain && !forced) return 0;
  st.medals += gain; st.medalsLife += gain; st.evacs++; st.evacAt.push(st.t);
  st.gems += Math.floor(T.economy.evacGems0 + T.economy.evacGemsPerStage * st.runBest);
  if (forced && st.runBest < T.medals.firstAt) { st.stage = Math.max(1, st.stage - 1); return 0; } // before 50: one stage back
  Object.assign(st, { stage: 1, runBest: 0, mode: 'progress', gold: 0, food: 0, ore: 0, cur: null });
  st.ws = { atk: 0, rate: 0, mag: 0, reload: 0 };
  dirty(st); refill(st);
  emit(st, 'evac', gain);
  return gain;
}

/* ---------- prices: one key per track ---------- */
export const canPay = (st, c) => !!c && Object.entries(c).every(([k, v]) => st[k] >= v);
function payCost(st, c) { for (const [k, v] of Object.entries(c)) st[k] -= v; emit(st, 'spend', c); }
const bt = (st, c) => { const S = stats(st), o = {}; for (const [k, v] of Object.entries(c)) o[k] = Math.ceil(v * S.btMul); return o; };
// ws:atk  bunker  fence  sec:food:lv|tier|cap  crew:<id>  enh:w:<i>  enh:t:<i>  medal:<key>  research:<key>
export function price(st, key) {
  const S = stats(st), [a, b, c] = key.split(':');
  if (a === 'ws') return { gold: workshopCost(b, st.ws[b]) };
  // doc 8: a breakthrough takes materials and gold (btGold x the level's own price)
  const withGold = (c, g) => bt(st, { ...c, gold: T.base.btGold * g });
  if (a === 'bunker') return needsBreakthrough(st.bunker, st.bunkerBt) ? withGold(breakthroughCost('bunker', st.bunker / T.base.btEvery, S.caps), bunkerGold(st.bunker)) : { gold: bunkerGold(st.bunker) };
  if (a === 'fence') return needsBreakthrough(st.fence, st.fenceBt) ? withGold(breakthroughCost('fence', st.fence / T.base.btEvery, S.caps), fenceGold(st.fence)) : { gold: fenceGold(st.fence) };
  if (a === 'sec') {
    if (!sectionOpen(st, b)) return null;
    const x = st.sec[b];
    if (c === 'lv') return needsBreakthrough(x.lv, x.bt) ? withGold(breakthroughCost('section', x.lv / T.base.btEvery, S.caps, SECTIONS[b].aux), sectionLevelGold(b, x.lv)) : { gold: sectionLevelGold(b, x.lv) };
    // a tier is not capped to the store: it blocks nothing, and a bigger one is what the capacity track is for
    if (c === 'tier') return capToStores(sectionTierCost(b, x.tier + 1), null);
    return capToStores(sectionCapCost(b, x.cap), S.caps);
  }
  if (a === 'crew') {
    const card = st.crew.cards[b];
    if (!card) return null;
    if (needsBt(card)) return btCost(card, S.caps, S.btMul);
    return canLevel(st.crew, b, S.prod.food, S.upkeep / Math.max(1e-9, rawUpkeep(st)), S.lock) ? { gold: levelGold(card.level) } : null;
  }
  if (a === 'enh') {
    const inv = b === 'w' ? st.weapons : st.turrets, i = +c, grade = (b === 'w' ? WEAPONS : TURRETS)[i].grade;
    if (!inv.owned[i] || inv.enh[i] >= enhCap(grade)) return null;
    return enhNeedsBt(inv, i) ? bt(st, enhBtCost(grade, inv.enh[i] / 10, S.caps)) : enhCost(grade, inv.enh[i]);
  }
  if (a === 'medal') return st.evacs && !medalUpMaxed(b, st.medalUp[b] || 0) ? { medals: medalUpCost(b, st.medalUp[b] || 0) } : null;
  if (a === 'research') {
    if (st.record < RESEARCH_UNLOCK || st.research.active.length >= (st.shop.owned.researchSlot ? 2 : 1) + 1) return null;
    return researchCost(b, (st.research.lv[b] || 0) + 1, S.caps);
  }
  return null;
}
const rawUpkeep = st => { let u = 0; for (const id of Object.values(st.crew.assign).flat()) if (id !== 'me') u += T.crew.upkeep0 * (1 + T.crew.upkeepPerLevel * st.crew.cards[id].level); return u; };
export function buy(st, key) {
  const c = price(st, key);
  if (!canPay(st, c)) return false;
  payCost(st, c);
  const [a, b, d] = key.split(':'), S = stats(st);
  if (a === 'ws') st.ws[b]++;
  else if (a === 'bunker' || a === 'fence') {
    const btKey = a + 'Bt';
    if (needsBreakthrough(st[a], st[btKey])) st[btKey]++;
    else {
      st[a]++;
      dirty(st);
      const N = stats(st);
      st.pool.fence += N.fenceMax - S.fenceMax; st.pool.bunker += N.bunkerMax - S.bunkerMax;
      if (a === 'bunker' && (shooterSlots(st[a]) > shooterSlots(st[a] - 1) || turretSlots(st[a]) > turretSlots(st[a] - 1))) { assignCrew(st); equipBest(st); }
    }
  } else if (a === 'sec') {
    const x = st.sec[b];
    if (d === 'lv') { if (needsBreakthrough(x.lv, x.bt)) x.bt++; else x.lv++; }
    else if (d === 'tier') { x.tier++; assignCrew(st); }
    else x.cap++;
  } else if (a === 'crew') { const card = st.crew.cards[b]; if (needsBt(card)) card.bt++; else card.level++; }
  else if (a === 'enh') { const inv = d != null && b === 'w' ? st.weapons : st.turrets, i = +d; if (enhNeedsBt(inv, i)) inv.bt[i]++; else inv.enh[i]++; }
  else if (a === 'medal') st.medalUp[b] = (st.medalUp[b] || 0) + 1;
  else if (a === 'research') {
    const l = (st.research.lv[b] || 0) + 1 + st.research.active.filter(r => r.key === b).length, total = researchSeconds(b, l, 1);
    st.research.active.push({ key: b, left: total, total });
  }
  dirty(st);
  return true;
}

/* ---------- gems, diamonds, summons, merging ---------- */
// pays from gems, then (if allowed) diamonds
function payGems(st, n, useDiamonds) {
  if (st.gems >= n) { st.gems -= n; emit(st, 'spend', { gems: n }); return true; }
  if (useDiamonds && st.gems + st.diamonds >= n) { const d = n - st.gems; emit(st, 'spend', { gems: st.gems, diamonds: d }); st.gems = 0; st.diamonds -= d; return true; }
  return false;
}
export function openChest(st) { const r = rollRelic(st.rng, st.relics, st.rSum); emit(st, 'relic', r); return r; }
export function summon(st, kind, n = 1, useDiamonds = false) {
  const each = PRICES[{ weapon: 'weaponPull', turret: 'turretPull', relic: 'relicChest', recruit: 'recruit' }[kind]];
  const out = [];
  for (let k = 0; k < n && payGems(st, each, useDiamonds); k++) {
    if (kind === 'weapon') out.push(summonWeapon(st.rng, st.weapons, st.wSum));
    else if (kind === 'turret') out.push(summonTurret(st.rng, st.turrets, st.tSum));
    else if (kind === 'relic') out.push(openChest(st));
    else out.push(recruit(st.rng, st.crew, st.cSum));
  }
  if (out.length) { dirty(st); emit(st, 'summon', { kind, n: out.length }); }
  return out;
}
export const freeSummon = st => { const i = summonWeapon(st.rng, st.weapons, st.wSum); dirty(st); return i; };
// merging costs a few parts (강 상사 cuts it); duplicates always count
export const mergeParts = (grade, cut = 0) => Math.ceil(3 * (grade + 1) ** 2 * (1 - cut));
export function merge(st) {
  const S = stats(st);
  const pay = list => i => { const c = mergeParts(list[i].grade, S.mergeCut); if (st.parts < c) return false; st.parts -= c; emit(st, 'spend', { parts: c }); return true; };
  const made = mergeAll(st.weapons, T.gear.mergeN, pay(WEAPONS)) + mergeAll(st.turrets, T.gear.mergeN, pay(TURRETS));
  if (made) dirty(st);
  return made;
}
export function buyStep(st, line, step, krw) { st.shop.steps[line]++; st.shop.spent += krw; grant(st, step.items, st.rng, () => openChest(st)); dirty(st); }
