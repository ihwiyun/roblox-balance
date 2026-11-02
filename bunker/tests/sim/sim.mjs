// The economy simulation: a bot plays the pure logic (src/logic) on a daily schedule of short sessions and
// offline gaps, and we record what the acceptance criteria (docs/기획서.md 12, 18) need.
// bots: 'greedy' (checks every 30 s, best value per gold, evacuates at the medal cap)
//       'human'  (a stand-in for a real player: checks in every 30-120 s, sometimes only watches, buys in bursts with
//                 the x1/x5/x10/MAX chips, misjudges values, sometimes picks off-best, evacuates when the climb stalls)
// profiles (doc 12): 'f2p' (ads only), 'light' (monthly 5,500 + season pass 9,900 KRW), 'heavy' (100,000 KRW a month:
//   passes, then the step packages as they open, then diamonds), 'whale' (300,000 a month, to show diminishing returns)
import * as L from '../../src/logic/index.mjs';
const { T } = L;

const DAY = 86400;
// ads (doc 12: income x2 for 30 min, offline x2, one pull a day). A monthly pass claims them without watching, so a
// payer takes every one; a free player watches some
export const PROFILES = {
  f2p: { ads: { boosts: 3, offline: 1, pull: 1 }, monthly: false, season: false, krwMonth: 0, steps: false },
  light: { ads: { boosts: 4, offline: 4, pull: 1 }, monthly: true, season: true, krwMonth: 0, steps: false },
  heavy: { ads: { boosts: 4, offline: 4, pull: 1 }, monthly: true, season: true, krwMonth: 100000, steps: true },
  whale: { ads: { boosts: 4, offline: 4, pull: 1 }, monthly: true, season: true, krwMonth: 300000, steps: true },
};
// a day: four sessions of active play, the rest offline (1.75 h a day by default)
const SESSION_AT = [8, 12.5, 18, 22].map(h => h * 3600);

/* ---------- valuation ---------- */
// the frontier: how many times over the gun beats the next normal stage's pace and the next boss
export function powerOf(st) {
  const S = L.stats(st), s = Math.min(st.record + 1, T.stage.cap);
  let sn = s; while (L.kindOf(sn) !== 'normal') sn++;
  const sb = Math.min(T.stage.cap, Math.ceil(s / 10) * 10);
  const pool = { fence: S.fenceMax, bunker: S.bunkerMax, fenceMax: S.fenceMax, bunkerMax: S.bunkerMax };
  const rb = L.resolveBoss(sb, S, pool);
  // the boss side counts its regeneration as extra need, so the ratio stays positive and every upgrade shows
  return Math.max(1e-300, Math.min(S.dpsCrowd / L.reqDps(sn), rb.gross / (rb.need + rb.regen)));
}
function trial(st, key) {
  const [a, b, c] = key.split(':');
  let undo;
  if (a === 'ws') { st.ws[b]++; undo = () => st.ws[b]--; }
  else if (a === 'crew') { const card = st.crew.cards[b]; card.level++; undo = () => card.level--; }
  else if (a === 'enh') { const inv = b === 'w' ? st.weapons : st.turrets; inv.enh[+c]++; undo = () => inv.enh[+c]--; }
  else if (a === 'sec') { const x = st.sec[b]; x[c]++; undo = () => x[c]--; }
  else return powerOf(st);
  st.S = null;
  const p = powerOf(st);
  undo(); st.S = null;
  return p;
}
const goldOf = c => (c && c.gold) || 0;
// combat purchases the bot weighs by power gained per second of income (gold-only steps; breakthroughs go to invest)
function combatKeys(st) {
  const keys = ['ws:atk', 'ws:rate', 'ws:mag', 'ws:reload', 'sec:roof:lv'];
  for (const id of st.crew.assign.roof) if (id !== 'me') keys.push('crew:' + id);
  for (const i of st.equipW) if (i >= 0) keys.push('enh:w:' + i);
  for (const i of st.equipT) if (i >= 0) keys.push('enh:t:' + i);
  return keys;
}
function bunkerSlotGain(st) {
  const a = L.shooterSlots(st.bunker), b = L.shooterSlots(st.bunker + 1), ta = L.turretSlots(st.bunker), tb = L.turretSlots(st.bunker + 1);
  if (b > a) return Math.log((a + 1) / a);
  if (tb > ta) return Math.log(1 + 0.25 / Math.max(1, a));
  return 0;
}

/* ---------- one run ---------- */
export function run(opts = {}) {
  const { bot = 'human', profile = 'f2p', seed = 1, days = 60, untilStage = 1000, sessionMin = 26, maxActiveH = 400, sample = 600 } = opts;
  const prof = PROFILES[profile], human = bot === 'human';
  const st = L.newGame(seed), rng = L.makeRng(seed * 7919 + 13);
  // is the next purchase on this track a breakthrough (materials) rather than a level?
  const btKey = key => {
    const [a, b, c] = key.split(':');
    if (a === 'bunker') return L.needsBreakthrough(st.bunker, st.bunkerBt);
    if (a === 'fence') return L.needsBreakthrough(st.fence, st.fenceBt);
    if (a === 'sec') return c === 'lv' && L.needsBreakthrough(st.sec[b].lv, st.sec[b].bt);
    if (a === 'crew') return !!st.crew.cards[b] && L.needsBt(st.crew.cards[b]);
    if (a === 'enh') return L.enhNeedsBt(b === 'w' ? st.weapons : st.turrets, +c);
    return false;
  };
  const M = {
    bot, profile, seed, samples: [], firsts: {}, ws: [], stepUps: [], teamUps: [], clears: [], fails: 0, evacs: [], packages: [],
    full: { food: 0, ore: 0, parts: 0 }, fullT: 0, fullOff: { food: 0, ore: 0, parts: 0 }, fullOffT: 0, fullAct: { food: 0, ore: 0, parts: 0 }, fullActT: 0,
    lastBuy: 0, maxNoBuy: 0, maxNoBuyAt: 0, lastClimb: 0, maxNoClimb: 0, maxNoClimbAt: 0, climbStalls: [],
    gemsIn: 0, spend: { gold: 0, food: 0, ore: 0, parts: 0, gems: 0, diamonds: 0, medals: 0 }, spill: { food: 0, ore: 0, parts: 0 },
    buys: {}, step1BestUntil: null, goldHeldMin: [],
  };
  const ctx = { checks: 0, failT: -1, lastRecordT: 0, lastRecord: 0, gemPlan: { weapon: 0, turret: 0, relic: 0, recruit: 0 }, monthStart: 0, krwThisMonth: 0,
    stallLimit: 10 * 60, runBestT: 0 };
  let bestW = 0, teamW = 0;
  const climb = () => {      // the run's best stage moved (a new record is one): the "can't climb" clock restarts
    const gap = st.active - M.lastClimb;
    if (gap > M.maxNoClimb) { M.maxNoClimb = gap; M.maxNoClimbAt = st.record; }
    if (gap > 15 * 60) M.climbStalls.push({ at: st.active / 3600, min: gap / 60, record: st.record });
    M.lastClimb = st.active;
  };
  const bought = () => {
    const gap = st.active - M.lastBuy;
    if (gap > M.maxNoBuy) { M.maxNoBuy = gap; M.maxNoBuyAt = st.record; }
    M.lastBuy = st.active;
  };
  // what the relics add, measured as the damage with and without them (most relic effects are crit, crowd and boss
  // numbers that the plain multiplier list does not see)
  const relicAxis = () => {
    const S = L.stats(st), keep = st.relics.equipped;
    st.relics.equipped = []; st.S = null;
    const bare = L.stats(st);
    st.relics.equipped = keep; st.S = null;
    const r = Math.sqrt((S.dpsCrowd / bare.dpsCrowd) * (S.dps / bare.dps));
    L.stats(st);
    return r;
  };
  const snapshot = () => {
    const S = L.stats(st), axes = { ...S.axes, relics: relicAxis() };
    return { active: st.active / 3600, days: st.t / DAY, evacs: st.evacs, medals: st.medalsLife, axes, dps: S.dps, cmd: st.cmd.level,
      ws: { ...st.ws }, bunker: st.bunker, fence: st.fence, bestW: st.equipW[0] ?? 0, sec: JSON.parse(JSON.stringify(st.sec)), gems: st.gems };
  };
  st.ev = (type, data) => {
    if (type === 'clear') {
      if (st.last && st.last.rw.kind === 'normal') M.clears.push(st.last.res.time + 2);
      if (data > ctx.runBest) { ctx.runBest = data; ctx.runBestT = st.active; climb(); }
    } else if (type === 'fail') { M.fails++; ctx.failT = st.t; }
    else if (type === 'record') {
      ctx.lastRecordT = st.active;
      for (const m of [10, 30, 50, 60, 100, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000]) if (data >= m && M.firsts[m] == null) M.firsts[m] = snapshot();
    } else if (type === 'spend') { for (const [k, v] of Object.entries(data)) if (M.spend[k] != null) M.spend[k] += v; }
    else if (type === 'spill') M.spill[data.res] += data.amount;
    else if (type === 'evac') { ctx.runBest = 0; }
  };
  ctx.runBest = 0;
  const tally = key => { const k = key.split(':').slice(0, 2).join(':'); M.buys[k] = (M.buys[k] || 0) + 1; };
  const buy = key => {
    const c = L.price(st, key);
    if (!L.canPay(st, c) || !L.buy(st, key)) return false;
    tally(key);
    if (key.startsWith('ws:')) M.ws.push(st.active);
    bought();
    return true;
  };

  /* ---- shop (payers): passes, then the step packages as they open, then diamonds, within the monthly budget ---- */
  const budget = krw => prof.krwMonth === 0 || ctx.krwThisMonth + krw <= prof.krwMonth;
  const pay = krw => { st.shop.spent += krw; ctx.krwThisMonth += krw; };
  function payerShop() {
    if (profile === 'f2p') return;
    if (st.t - ctx.monthStart >= 30 * DAY) { ctx.monthStart = st.t; ctx.krwThisMonth = 0; }
    if (prof.monthly && st.t >= st.shop.monthlyUntil) { st.shop.monthlyUntil = st.t + 30 * DAY; st.gems += L.PASSES.monthly.now; pay(L.PASSES.monthly.krw); }
    if (prof.season && st.t >= st.shop.seasonUntil) { st.shop.seasonUntil = st.t + 60 * DAY; pay(L.PASSES.season.krw); }
    if (!prof.krwMonth) return;
    if (prof.steps) for (const line of ['weapon', 'crew', 'turret']) {
      for (let s = L.nextStep(st.shop, line, st.record); s && budget(s.krw); s = L.nextStep(st.shop, line, st.record)) {
        const before = powerOf(st), rec = st.record;
        pay(s.krw); L.buyStep(st, line, s, s.krw);
        L.assignCrew(st); L.equipBest(st);
        M.packages.push({ line, step: st.shop.steps[line], krw: s.krw, at: st.active / 3600, record: rec, jump: powerOf(st) / before });
        if (line === 'weapon' && st.shop.steps.weapon === 1) M.step1At = st.active;
      }
    }
    // diamonds with the rest, the best-value pack first; while packages remain, half the month is kept for them
    const stepsLeft = prof.steps && ['weapon', 'crew', 'turret'].some(l => st.shop.steps[l] < L.STEP_LINES[l].length);
    const room = prof.krwMonth * (stepsLeft ? 0.5 : 1);
    for (let i = L.DIAMOND_PACKS.length - 1; i >= 0; i--) {
      const p = L.DIAMOND_PACKS[i];
      while (ctx.krwThisMonth + p.krw <= room) { st.diamonds += L.diamondsFor(st.shop, i); st.shop.packsBought[i] = true; pay(p.krw); }
    }
  }

  /* ---- gems: weapons first, turrets once there are slots, a share to relic chests and recruits ---- */
  function spendGems() {
    // a person recruits harder while the roof has empty gunner slots or beds stand empty
    const gunners = Object.keys(st.crew.cards).filter(id => id !== 'me' && L.CARD[id].role === 'gunner').length;
    const thin = gunners < L.shooterSlots(st.bunker) - 1 || Object.keys(st.crew.cards).length < L.beds(st.sec.bed.tier);
    const plan = { weapon: thin ? 0.45 : 0.6, turret: L.turretSlots(st.bunker) ? 0.15 : 0, relic: 0.12, recruit: thin ? 0.28 : 0.1 };
    const each = { weapon: 50, turret: 50, relic: 300, recruit: 100 };
    const useDia = profile !== 'f2p';
    const batch = human ? 10 : 1;          // a person pulls x10 when the button lights up
    for (let guard = 0; guard < 400; guard++) {
      const have = st.gems + (useDia ? st.diamonds : 0);
      const total = Object.values(ctx.gemPlan).reduce((a, b) => a + b, 0) + 1;
      let kind = null, gap = -Infinity;
      for (const k of Object.keys(plan)) { if (!plan[k]) continue; const g = plan[k] - ctx.gemPlan[k] / total; if (g > gap) { gap = g; kind = k; } }
      const n = kind === 'relic' || kind === 'recruit' ? 1 : batch;
      if (!kind || have < each[kind] * n) break;
      const out = L.summon(st, kind, n, useDia);
      if (!out.length) break;
      ctx.gemPlan[kind] += each[kind] * out.length;
      if (kind === 'recruit') L.assignCrew(st);
      bought();
    }
  }

  /* ---- medals and research ---- */
  function spendMedals() {
    for (let guard = 0; guard < 500; guard++) {
      let best = null, bc = Infinity;
      for (const k of ['fire', 'funds', 'command', 'supply', 'drill', 'watch', 'sentry']) {
        const c = L.price(st, 'medal:' + k);
        if (!c) continue;
        const w = { fire: 1, funds: 1, command: 1.6, supply: 2.5, drill: 2.5, watch: 3, sentry: 4 }[k];
        if (c.medals * w < bc) { bc = c.medals * w; best = k; }
      }
      if (!best || !buy('medal:' + best)) break;
    }
  }
  function doResearch() {
    if (st.record < 1000 || st.research.active.length) return;
    const order = ['ballistics', 'doctrine', 'engineering', 'logistics'];
    order.sort((a, b) => (st.research.lv[a] || 0) - (st.research.lv[b] || 0));
    for (const k of order) if (buy('research:' + k)) break;
  }

  /* ---- production: a person raises output when what they want to buy outruns it ---- */
  const PRODUCER = { food: 'food', ore: 'mine', parts: 'shop' };
  const SLOT_TIERS = { food: 8, mine: 8, shop: 9 };                // tiers that still add a worker slot
  // the tiers worth aiming at now: the roof (damage) when the ore is within reach, the floors while they add worker
  // slots or when their own output is short, beds when the crew has outgrown them
  function wantedTiers(S, short) {
    const out = [];
    const cost = k => L.price(st, `sec:${k}:tier`);
    const roof = cost('roof');
    if (roof && roof.ore <= st.ore + S.prod.ore * 5400) out.push('roof');
    for (const [res, sec] of Object.entries(PRODUCER)) {
      // a floor's tier is worth it for a worker slot someone can fill, or when its output is short
      const c = cost(sec), slots = L.SECTIONS[sec].slots, filled = (st.crew.assign[sec] || []).length;
      const waiting = Object.keys(st.crew.cards).length - 1 > L.members(st.crew).length - 1 || filled >= slots(st.sec[sec].tier);
      if (c && ((st.sec[sec].tier < SLOT_TIERS[sec] && waiting && filled >= slots(st.sec[sec].tier)) || short[res])) out.push(sec);
    }
    const crewN = Object.keys(st.crew.cards).length, bed = cost('bed');
    if (bed && (L.beds(st.sec.bed.tier) < crewN + 1 || Object.values(bed)[0] <= 0.25 * st.food)) out.push('bed');
    return out;
  }
  function invest() {
    const S = L.stats(st);
    const need = { food: S.upkeep * 600, ore: 0, parts: 0 };
    const addC = c => { if (c) for (const k of Object.keys(need)) need[k] += c[k] || 0; };
    // breakthroughs block levels: they come first
    for (const key of ['bunker', 'fence', ...['roof', 'food', 'mine', 'shop', 'bed'].map(k => `sec:${k}:lv`), ...Object.keys(st.crew.cards).map(id => 'crew:' + id),
      ...st.equipW.filter(i => i >= 0).map(i => 'enh:w:' + i), ...st.equipT.filter(i => i >= 0).map(i => 'enh:t:' + i)]) if (btKey(key)) addC(L.price(st, key));
    const short0 = Object.fromEntries(Object.keys(need).map(r => [r, need[r] - st[r] > S.prod[r] * 3600 && st[r] < 0.5 * S.caps[r]]));
    const tiers = wantedTiers(S, short0);
    for (const k of tiers) addC(L.price(st, `sec:${k}:tier`));
    for (const [res, sec] of Object.entries(PRODUCER)) {
      // capacity: hold a night's offline credit, and the largest single thing wanted
      const credit = S.offlineH * 3600 * S.prod[res] * S.offlineEff * 2;
      const biggest = Math.max(0, ...tiers.map(k => (L.price(st, `sec:${k}:tier`) || {})[res] || 0));
      if (credit > 0.9 * S.caps[res] || biggest > 0.9 * S.caps[res] || (st[res] >= 0.9 * S.caps[res] && need[res] > st[res])) buy(`sec:${sec}:cap`);
      // output: the floor's level (doc 8: base x tier x level) when the wants are more than an hour of output away
      // and the box is not already half full (nobody raises output while the store sits full)
      const lack = need[res] - st[res];
      if ((lack > S.prod[res] * 3600 && st[res] < 0.5 * S.caps[res]) || S.prod[res] <= 0) { const k = `sec:${sec}:lv`, c = L.price(st, k); if (c && !btKey(k) && goldOf(c) < 0.4 * st.gold) buy(k); }
    }
    // the growth lock (doc 8): food output must cover 1.15x the upkeep after a level-up
    if (S.prod.food < S.upkeep * 1.3) { const c = L.price(st, 'sec:food:lv'); if (c && !btKey('sec:food:lv') && goldOf(c) < 0.6 * st.gold) buy('sec:food:lv'); }
    for (const sec of ['food', 'mine', 'shop', 'bed', 'roof']) if (btKey(`sec:${sec}:lv`)) buy(`sec:${sec}:lv`);
    for (const id of Object.keys(st.crew.cards)) if (btKey('crew:' + id)) buy('crew:' + id);
    for (const sec of tiers) {
      const c = L.price(st, `sec:${sec}:tier`);
      if (c && Object.entries(c).every(([k, v]) => st[k] - v >= (k === 'food' ? S.upkeep * 300 : 0))) buy(`sec:${sec}:tier`);
    }
    // the kitchen trims upkeep: a small steady share
    const kc = L.price(st, 'sec:bed:lv'); if (kc && !btKey('sec:bed:lv') && goldOf(kc) < 0.05 * st.gold) buy('sec:bed:lv');
    for (const k of [...st.equipW.map(i => 'enh:w:' + i), ...st.equipT.map(i => 'enh:t:' + i)]) if (!k.endsWith(':-1') && btKey(k)) buy(k);
    // a full parts box: enhance the rest of the collection (the owned effect), best weapons first
    if (st.parts > 0.5 * S.caps.parts) for (const [w, inv] of [['w', st.weapons], ['t', st.turrets]])
      for (let i = inv.owned.length - 1; i >= 0 && st.parts > 0.35 * S.caps.parts; i--) {
        if (!inv.owned[i]) continue;
        for (let n = 0; n < 20; n++) { const c = L.price(st, `enh:${w}:${i}`); if (!c || goldOf(c) > 0.05 * st.gold || !buy(`enh:${w}:${i}`)) break; }
      }
  }

  /* ---- defense: the fence and the bunker, each on its own, when the last stage bit or they are cheap ---- */
  function defend() {
    const c = st.last, S = L.stats(st);
    const hurt = c ? 1 - (Math.max(0, c.res.fence) + Math.max(0, c.res.bunker)) / (S.fenceMax + S.bunkerMax) : 0;
    const breached = c && !c.res.ok && c.res.bunker <= 0;
    for (const key of ['fence', 'bunker']) {
      for (let k = 0; k < 60; k++) {
        const p = L.price(st, key);
        if (!p || !L.canPay(st, p)) break;
        if (btKey(key)) { if (!buy(key)) break; continue; }
        const share = goldOf(p) / Math.max(1e-9, st.gold);
        if (!(share < 0.03 || ((hurt > 0.35 || breached) && share < 0.5))) break;
        if (!buy(key)) break;
      }
    }
  }

  /* ---- gold on combat: power per second of income ---- */
  // the chips: x1, x5, x10, MAX (a person on the workshop mostly uses x10 and MAX)
  const chip = () => { const r = rng.next(); return r < 0.15 ? 1 : r < 0.4 ? 5 : r < 0.75 ? 10 : 100; };
  function spendGold() {
    const auto = L.auto(st);
    const picks = human ? 2 + rng.int(0, 6) : 80;
    for (let n = 0; n < picks; n++) {
      const base = powerOf(st), rate = Math.max(1e-9, st.goldRate, 0.02 * st.gold);
      const scored = [];
      for (const key of combatKeys(st)) {
        const c = L.price(st, key);
        if (!c || btKey(key)) continue;
        const gain = Math.log(trial(st, key) / base);
        if (!(gain > 0)) continue;
        // a person reads the numbers roughly: the value is seen through a factor of about 1.5 either way
        const noise = human ? Math.exp(0.4 * (rng.next() + rng.next() + rng.next() - 1.5) * 2) : 1;
        scored.push({ key, c, v: noise * gain / (goldOf(c) / rate + 5), ok: L.canPay(st, c) });
      }
      const bc = L.price(st, 'bunker'), slot = bunkerSlotGain(st);
      if (bc && !btKey('bunker') && slot > 0) scored.push({ key: 'bunker', c: bc, v: slot / (goldOf(bc) / rate + 5), ok: L.canPay(st, bc) });
      if (!scored.length) return;
      scored.sort((a, b) => b.v - a.v);
      let pick = scored[0].ok ? scored[0] : scored.find(x => x.ok && x.v >= 0.6 * scored[0].v);
      // off-best: now and then a person taps whatever looks nice (less once the workshop runs itself)
      if (human && rng.chance(auto.autoWorkshop ? 0.05 : 0.15)) { const ok = scored.filter(x => x.ok); if (ok.length) pick = rng.pick(ok); }
      if (!pick) return;
      // the greedy bot re-weighs after a few steps of the same line (cheap to run, still near the best order)
      const times = human ? chip() : 4;
      let got = 0;
      for (let t = 0; t < times && buy(pick.key); t++) got++;
      if (!got) return;
    }
  }

  /* ---- evacuation: when the climb stalls and the medals are worth it ---- */
  function maybeEvacuate() {
    const gain = L.medalsIfEvacuated(st);
    if (!gain) return;
    const stall = st.active - ctx.runBestT, cap = L.medalCap(st.medalsLife, L.stats(st).doubling);
    const a = L.auto(st);
    let go;
    if (human && !a.autoEvac) {
      // a person notices the run has stopped climbing (no new best for several minutes) and the medal number is
      // worth a restart; at the cap ("최대") going deeper pays nothing more, so a shorter stall is enough
      go = (stall > ctx.stallLimit && gain >= Math.max(T.medals.floor, 0.3 * st.medalsLife)) || (gain >= cap && stall > 0.4 * ctx.stallLimit);
    } else go = gain >= cap || (stall > 6 * 60 && gain >= 0.3 * st.medalsLife);
    if (!go) return;
    const runBest = st.runBest, g = L.evacuate(st);
    if (g) {
      M.evacs.push({ active: st.active / 3600, record: st.record, runBest, gain: g, life: st.medalsLife });
      spendMedals(); ctx.runBestT = st.active; climb(); bought();
      ctx.stallLimit = (human ? 7 + rng.range(0, 8) : 6) * 60;     // the next run's patience
    }
  }

  function act() {
    ctx.checks++;
    if (st.mode === 'repeat') { const S = L.stats(st); if (S.dps > (st.failDps || 0) * 1.08 || st.t - ctx.failT > (human ? 150 : 60)) st.mode = 'progress'; }
    payerShop();
    // a person sometimes only glances at the screen (the run goes on by itself)
    if (human && rng.chance(0.15)) return;
    spendGems();
    if (!human || rng.chance(0.4) || L.auto(st).autoMerge) { if (L.merge(st)) bought(); }
    L.equipBest(st);
    const w = st.equipW[0] ?? 0, team = st.equipW.reduce((a, b) => a + Math.max(0, b), 0);
    if (w > bestW) { bestW = w; M.stepUps.push({ active: st.active / 3600, w, record: st.record }); }
    if (team > teamW) { teamW = team; M.teamUps.push({ active: st.active / 3600, team }); }
    if (M.step1At != null && M.step1BestUntil == null && w > L.weaponId('희귀', 5)) M.step1BestUntil = st.active;
    if (st.cmd.unspent) { L.spendPoints(st.cmd, { power: 0.35, luck: 0.25, rapid: 0.1, precision: 0.1, command: 0.1, supply: 0.1 }); bought(); }
    spendMedals();
    doResearch();
    defend();
    spendGold();
    invest();
    maybeEvacuate();
  }

  /* ---- the schedule ---- */
  let day = 0, nextSample = 0;
  const sampleNow = () => {
    const S = L.stats(st);
    M.samples.push({ active: st.active / 3600, days: st.t / DAY, stage: st.stage, record: st.record, evacs: st.evacs, medals: st.medalsLife,
      gold: st.gold, food: st.food, ore: st.ore, parts: st.parts, caps: { ...S.caps }, prod: { ...S.prod }, upkeep: S.upkeep, gems: st.gems,
      ws: { ...st.ws }, bunker: st.bunker, fence: st.fence, bestW: st.equipW[0] ?? 0, axes: { ...S.axes }, dps: S.dps, cmd: st.cmd.level,
      tiers: Object.fromEntries(Object.entries(st.sec).map(([k, v]) => [k, v.tier])), goldRate: st.goldRate });
  };
  const trackFull = dt => {
    const S = L.stats(st);
    for (const k of ['food', 'ore', 'parts']) if (st[k] >= 0.98 * S.caps[k]) { M.full[k] += dt; M.fullAct[k] += dt; }
    M.fullT += dt; M.fullActT += dt;
    if (st.goldRate > 0) M.goldHeldMin.push(st.gold / (st.goldRate * 60));
  };
  outer: for (day = 0; day < days; day++) {
    st.gems += T.economy.dailyGems; M.gemsIn += T.economy.dailyGems;
    if (st.t < st.shop.monthlyUntil) st.gems += L.PASSES.monthly.daily;
    let boosts = prof.ads.boosts, offAds = prof.ads.offline, raids = T.economy.raidsPerDay;
    if (prof.ads.pull) { L.freeSummon(st); }
    for (let si = 0; si < SESSION_AT.length; si++) {
      const start = day * DAY + SESSION_AT[si];
      if (st.t < start) {
        const away = start - st.t, before = { food: st.food, ore: st.ore, parts: st.parts };
        const S = L.stats(st), dbl = offAds > 0 && away > 2 * 3600;
        if (dbl) offAds--;
        const credit = Math.min(away, (S.offlineH + (st.t < st.shop.monthlyUntil ? L.PASSES.monthly.offlineH : 0) + (st.shop.owned.offline12 ? 12 : 0)) * 3600);
        L.offline(st, away, dbl);
        // stores full while away: from the moment each would fill
        for (const k of ['food', 'ore', 'parts']) {
          const rate = (S.prod[k] - (k === 'food' && !S.offlineNoUpkeep ? S.upkeep : 0)) * S.offlineEff * (dbl ? 2 : 1);
          if (rate > 0 && st[k] >= 0.98 * S.caps[k]) {
            const f = Math.max(0, credit - Math.max(0, S.caps[k] - before[k]) / rate);
            M.full[k] += f; M.fullOff[k] += f;
          }
        }
        M.fullT += credit; M.fullOffT += credit;
      }
      if (boosts > 0) { L.watchAdBoost(st); boosts--; }
      const len = (sessionMin + (human ? rng.range(-6, 6) : 0)) * 60;
      const end = st.t + len;
      while (end - st.t > 1e-6) {          // advance() may stop a hair short of `end`; never loop on the crumb
        const dt = Math.min(end - st.t, human ? rng.range(30, 120) : 30);
        L.advance(st, dt);
        trackFull(dt);
        act();
        while (raids > 0 && L.raid(st)) raids--;
        if (st.active >= nextSample) { sampleNow(); nextSample += sample; }
        if (st.record >= untilStage || st.active >= maxActiveH * 3600) break outer;
      }
    }
  }
  sampleNow();
  M.st = st;
  M.endActive = st.active / 3600; M.endDays = st.t / DAY;
  return M;
}

/* ---------- summaries ---------- */
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const median = a => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const pct = (a, p) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
export function summarize(M) {
  const gaps = [];
  for (let i = 1; i < M.ws.length; i++) gaps.push(M.ws[i] - M.ws[i - 1]);
  const upGaps = [];
  for (let i = 1; i < M.stepUps.length; i++) upGaps.push(M.stepUps[i].active - M.stepUps[i - 1].active);
  const st = M.st;
  return {
    run: `${M.bot}/${M.profile}/${M.seed}`,
    firsts: Object.fromEntries(Object.entries(M.firsts).map(([k, v]) => [k, +v.active.toFixed(2)])),
    wsGapMeanS: mean(gaps), wsGapMedianS: median(gaps),
    clearMeanS: mean(M.clears), clearMedianS: median(M.clears), clearP90S: pct(M.clears, 0.9),
    fails: M.fails, evacs: M.evacs.length,
    fullPct: Object.fromEntries(Object.entries(M.full).map(([k, v]) => [k, (100 * v) / Math.max(1, M.fullT)])),
    fullPctActive: Object.fromEntries(Object.entries(M.fullAct).map(([k, v]) => [k, (100 * v) / Math.max(1, M.fullActT)])),
    fullPctOffline: Object.fromEntries(Object.entries(M.fullOff).map(([k, v]) => [k, (100 * v) / Math.max(1, M.fullOffT)])),
    maxNoBuyMin: M.maxNoBuy / 60, maxNoClimbMin: M.maxNoClimb / 60, maxNoClimbAt: M.maxNoClimbAt,
    stepUps: M.stepUps.length, stepUpGapMaxH: upGaps.length ? Math.max(...upGaps) : null, bestW: st.equipW[0],
    goldHeldMinMedian: median(M.goldHeldMin),
    spentKrw: st.shop.spent, step1BestH: M.step1BestUntil != null && M.step1At != null ? (M.step1BestUntil - M.step1At) / 3600 : null,
    end: { activeH: M.endActive, days: M.endDays, record: st.record },
  };
}
