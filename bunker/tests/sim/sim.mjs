// The economy simulation: a bot plays the pure logic (src/logic) on a daily schedule of short sessions and
// offline gaps, and we record what the acceptance criteria (docs/기획서.md 12, 18) need.
// bots: 'greedy' (checks every 30 s, best value per gold), 'human' (every 30-120 s, bursts, sometimes off-best)
// profiles: 'f2p', 'light' (monthly + season + weapon steps 1-3), 'heavy' (everything, ~100k KRW a month)
import * as L from '../../src/logic/index.mjs';
const { T } = L;

const DAY = 86400;
export const PROFILES = {
  f2p: { ads: 3, monthly: false, season: false, steps: { weapon: 0, crew: 0, turret: 0 }, krwMonth: 0 },
  light: { ads: 6, monthly: true, season: true, steps: { weapon: 3, crew: 0, turret: 0 }, krwMonth: 0 },
  heavy: { ads: 6, monthly: true, season: true, steps: { weapon: 6, crew: 3, turret: 3 }, krwMonth: 100000 },
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
  return Math.max(1e-300, Math.min(S.dpsCrowd / L.reqDps(sn), rb.have / rb.need));
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
// combat purchases the bot weighs by power gained per second of income
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
  const M = {
    bot, profile, seed, samples: [], firsts: {}, ws: [], stepUps: [], clears: [], fails: 0, evacs: [], spent: 0,
    full: { food: 0, ore: 0, parts: 0 }, fullT: 0, stalls: [], lastProgress: 0, maxStall: 0, maxStallAt: 0,
    gemsIn: 0, spend: { gold: 0, food: 0, ore: 0, parts: 0 }, made: { food: 0, ore: 0, parts: 0 }, buys: {}, step1BestUntil: null,
  };
  const ctx = { checks: 0, failT: -1, lastRecordT: 0, lastRecord: 0, gemPlan: { weapon: 0, turret: 0, relic: 0, recruit: 0 }, krwMonthStart: 0, krwThisMonth: 0 };
  let bestW = 0;
  const progress = () => {
    const stall = st.active - M.lastProgress;
    if (stall > M.maxStall) { M.maxStall = stall; M.maxStallAt = st.record; }
    M.lastProgress = st.active;
  };
  st.ev = (type, data) => {
    if (type === 'clear') { if (st.last && st.last.rw.kind === 'normal') M.clears.push(st.last.res.time + 2); }
    else if (type === 'fail') { M.fails++; ctx.failT = st.t; }
    else if (type === 'record') {
      ctx.lastRecordT = st.active; progress();
      for (const m of [10, 30, 60, 100, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000]) if (data >= m && M.firsts[m] == null) M.firsts[m] = { active: st.active / 3600, days: st.t / DAY, evacs: st.evacs };
    } else if (type === 'spend') for (const [k, v] of Object.entries(data)) if (M.spend[k] != null) M.spend[k] += v;
  };
  const buy = key => {
    const c = L.price(st, key);
    if (!L.canPay(st, c) || !L.buy(st, key)) return false;
    M.buys[key.split(':').slice(0, 2).join(':')] = (M.buys[key.split(':').slice(0, 2).join(':')] || 0) + 1;
    if (key.startsWith('ws:')) M.ws.push(st.active);
    progress();
    return true;
  };

  /* ---- shop (payers) ---- */
  function payerShop() {
    if (profile === 'f2p') return;
    if (prof.monthly && st.t >= st.shop.monthlyUntil) { st.shop.monthlyUntil = st.t + 30 * DAY; st.gems += L.PASSES.monthly.now; st.shop.spent += L.PASSES.monthly.krw; ctx.krwThisMonth += L.PASSES.monthly.krw; }
    if (prof.season && st.t >= st.shop.seasonUntil) { st.shop.seasonUntil = st.t + 60 * DAY; st.shop.spent += L.PASSES.season.krw; ctx.krwThisMonth += L.PASSES.season.krw; }
    for (const line of ['weapon', 'crew', 'turret']) {
      while (st.shop.steps[line] < prof.steps[line]) {
        const s = L.nextStep(st.shop, line, st.record);
        if (!s) break;
        L.buyStep(st, line, s, s.krw); ctx.krwThisMonth += s.krw;
        if (line === 'weapon' && st.shop.steps.weapon === 1) M.step1At = st.active;
        L.assignCrew(st); L.equipBest(st);
      }
    }
    // diamonds up to the monthly budget, the best-value pack first
    if (prof.krwMonth) {
      if (st.t - ctx.krwMonthStart >= 30 * DAY) { ctx.krwMonthStart = st.t; ctx.krwThisMonth = 0; }
      for (let i = L.DIAMOND_PACKS.length - 1; i >= 0; i--) {
        const p = L.DIAMOND_PACKS[i];
        while (ctx.krwThisMonth + p.krw <= prof.krwMonth) { st.diamonds += L.diamondsFor(st.shop, i); st.shop.packsBought[i] = true; st.shop.spent += p.krw; ctx.krwThisMonth += p.krw; }
      }
    }
  }

  /* ---- gems: weapons first, turrets once there are slots, a share to relic chests and recruits ---- */
  function spendGems() {
    const plan = { weapon: 0.6, turret: L.turretSlots(st.bunker) ? 0.2 : 0, relic: 0.12, recruit: 0.08 };
    const each = { weapon: 50, turret: 50, relic: 300, recruit: 100 };
    const pay = profile !== 'f2p';
    const batch = human ? 10 : 1;
    for (let guard = 0; guard < 400; guard++) {
      const have = st.gems + (pay ? st.diamonds : 0);
      const total = Object.values(ctx.gemPlan).reduce((a, b) => a + b, 0) + 1;
      let kind = null, gap = -Infinity;
      for (const k of Object.keys(plan)) { if (!plan[k]) continue; const g = plan[k] - ctx.gemPlan[k] / total; if (g > gap) { gap = g; kind = k; } }
      const n = kind === 'relic' || kind === 'recruit' ? 1 : batch;
      if (!kind || have < each[kind] * n) break;
      const out = L.summon(st, kind, n, pay);
      if (!out.length) break;
      ctx.gemPlan[kind] += each[kind] * out.length;
      if (kind === 'recruit') L.assignCrew(st);
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

  /* ---- production: invest where pending costs outrun the stock ---- */
  function pendingNeeds() {
    const need = { food: 0, ore: 0, parts: 0 };
    const addC = c => { if (c) for (const k of Object.keys(need)) need[k] += c[k] || 0; };
    addC(L.price(st, 'bunker')); addC(L.price(st, 'fence'));
    for (const k of ['roof', 'food', 'mine', 'shop', 'bed']) { addC(L.price(st, `sec:${k}:lv`)); addC(L.price(st, `sec:${k}:tier`)); }
    for (const id of Object.keys(st.crew.cards)) { const c = L.price(st, 'crew:' + id); if (c && !c.gold) addC(c); }
    for (const i of st.equipW) if (i >= 0) addC(L.price(st, 'enh:w:' + i));
    const S = L.stats(st);
    need.food += S.upkeep * 600;
    return need;
  }
  function invest() {
    const S = L.stats(st), need = pendingNeeds();
    for (const [res, sec] of [['food', 'food'], ['ore', 'mine'], ['parts', 'shop']]) {
      if (st[res] >= 0.9 * S.caps[res]) buy(`sec:${sec}:cap`);
      const short = need[res] - st[res];
      const fillMin = short > 0 ? short / Math.max(1e-9, S.prod[res]) / 60 : 0;
      if (fillMin > 8 || S.prod[res] <= 0) {
        // the cheapest production step for this resource: the floor's level, or a worker's level
        const keys = [`sec:${sec}:lv`];
        for (const id of st.crew.assign[sec] || []) keys.push('crew:' + id);
        keys.sort((a, b) => goldOf(L.price(st, a)) - goldOf(L.price(st, b)));
        for (const k of keys) { const c = L.price(st, k); if (c && goldOf(c) < 0.4 * st.gold && buy(k)) break; }
      }
    }
    if (S.prod.food < S.upkeep * 1.3) { const c = L.price(st, 'sec:food:lv'); if (c && goldOf(c) < 0.6 * st.gold) buy('sec:food:lv'); }
    for (const sec of ['roof', 'food', 'mine', 'shop', 'bed']) buy(`sec:${sec}:tier`);
    // the kitchen trims upkeep: a small steady share
    const kc = L.price(st, 'sec:bed:lv'); if (kc && goldOf(kc) < 0.05 * st.gold) buy('sec:bed:lv');
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
        const share = goldOf(p) / Math.max(1e-9, st.gold);
        if (!(share < 0.03 || ((hurt > 0.35 || breached) && share < 0.5))) break;
        if (!buy(key)) break;
      }
    }
  }

  /* ---- gold on combat: power per second of income ---- */
  function spendGold() {
    const auto = L.auto(st);
    const picks = human ? 3 + rng.int(0, 12) : 400;
    for (let n = 0; n < picks; n++) {
      const base = powerOf(st), rate = Math.max(1e-9, st.goldRate, 0.02 * st.gold);
      const scored = [];
      for (const key of combatKeys(st)) {
        const c = L.price(st, key);
        if (!c) continue;
        const gain = Math.log(trial(st, key) / base);
        if (!(gain > 0)) continue;
        scored.push({ key, c, v: gain / (goldOf(c) / rate + 5), ok: L.canPay(st, c) });
      }
      const bc = L.price(st, 'bunker'), slot = bunkerSlotGain(st);
      if (bc && slot > 0) scored.push({ key: 'bunker', c: bc, v: slot / (goldOf(bc) / rate + 5), ok: L.canPay(st, bc) });
      if (!scored.length) return;
      scored.sort((a, b) => b.v - a.v);
      let pick = scored[0].ok ? scored[0] : scored.find(x => x.ok && x.v >= 0.6 * scored[0].v);
      if (human && !auto.autoWorkshop && rng.chance(0.25)) { const ok = scored.filter(x => x.ok); if (ok.length) pick = rng.pick(ok); }
      if (!pick) return;
      // bulk buy: the same line up to x10 for a person (x1 for the bot: it re-weighs every step)
      const times = human ? 1 + rng.int(0, 9) : 1;
      let bought = 0;
      for (let t = 0; t < times && buy(pick.key); t++) bought++;
      if (!bought) return;
    }
  }

  /* ---- evacuation ---- */
  function maybeEvacuate() {
    const gain = L.medalsIfEvacuated(st);
    if (!gain) return;
    const stall = st.active - ctx.lastRecordT, cap = L.medalCap(st.medalsLife, L.stats(st).doubling);
    const a = L.auto(st);
    const go = human && !a.autoEvac
      ? (stall > 15 * 60 && gain >= Math.max(5, 0.25 * st.medalsLife)) || (gain >= cap && stall > 5 * 60)
      : gain >= cap || (stall > 6 * 60 && gain >= 0.3 * st.medalsLife);
    if (!go) return;
    const g = L.evacuate(st);
    if (g) { M.evacs.push({ active: st.active / 3600, stage: ctx.lastRecord, runBest: ctx.runBestBefore, gain: g }); spendMedals(); ctx.lastRecordT = st.active; progress(); }
  }

  function act() {
    ctx.checks++;
    ctx.lastRecord = st.record; ctx.runBestBefore = st.runBest;
    if (st.mode === 'repeat') { const S = L.stats(st); if (S.dps > (st.failDps || 0) * 1.08 || st.t - ctx.failT > (human ? 150 : 60)) st.mode = 'progress'; }
    payerShop();
    spendGems();
    if (!human || ctx.checks % 3 === 0 || L.auto(st).autoMerge) { if (L.merge(st)) progress(); }
    L.equipBest(st);
    const w = st.equipW[0] ?? 0;
    if (w > bestW) { bestW = w; M.stepUps.push({ active: st.active / 3600, w }); progress(); }
    if (M.step1At != null && M.step1BestUntil == null && w > L.weaponId('희귀', 5)) M.step1BestUntil = st.active;
    if (st.cmd.unspent) L.spendPoints(st.cmd, { power: 0.35, luck: 0.25, rapid: 0.1, precision: 0.1, command: 0.1, supply: 0.1 });
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
      ws: { ...st.ws }, bunker: st.bunker, fence: st.fence, bestW: st.equipW[0] ?? 0, axes: { ...S.axes }, dps: S.dps });
  };
  const trackFull = dt => {
    const S = L.stats(st);
    for (const k of ['food', 'ore', 'parts']) if (st[k] >= 0.98 * S.caps[k]) M.full[k] += dt;
    M.fullT += dt;
  };
  outer: for (day = 0; day < days; day++) {
    st.gems += T.economy.dailyGems; M.gemsIn += T.economy.dailyGems;
    if (st.t < st.shop.monthlyUntil) st.gems += L.PASSES.monthly.daily;
    let raids = T.economy.raidsPerDay, ads = prof.ads;
    for (let si = 0; si < SESSION_AT.length; si++) {
      const start = day * DAY + SESSION_AT[si];
      if (st.t < start) {
        const away = start - st.t, before = { ...st };
        const S = L.stats(st);
        L.offline(st, away);
        // stores full while away: from the moment each would fill
        for (const k of ['food', 'ore', 'parts']) {
          const rate = S.prod[k] * S.offlineEff - (k === 'food' ? S.upkeep : 0);
          if (rate > 0 && st[k] >= 0.98 * S.caps[k]) M.full[k] += Math.max(0, Math.min(away, S.offlineH * 3600) - (S.caps[k] - before[k]) / rate);
        }
        M.fullT += Math.min(away, S.offlineH * 3600);
      }
      if (ads > 0) { L.watchAdBoost(st); ads--; }
      const len = (sessionMin + (human ? rng.range(-6, 6) : 0)) * 60;
      const end = st.t + len;
      while (st.t < end) {
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
export function summarize(M) {
  const gaps = [];
  for (let i = 1; i < M.ws.length; i++) gaps.push(M.ws[i] - M.ws[i - 1]);
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const median = a => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  return {
    run: `${M.bot}/${M.profile}`,
    firsts: M.firsts,
    wsGapMeanS: mean(gaps), wsGapMedianS: median(gaps),
    clearMeanS: mean(M.clears), clearMedianS: median(M.clears),
    fails: M.fails, evacs: M.evacs.length,
    fullPct: Object.fromEntries(Object.entries(M.full).map(([k, v]) => [k, (100 * v) / Math.max(1, M.fullT)])),
    maxStallMin: M.maxStall / 60, maxStallAt: M.maxStallAt,
    stepUps: M.stepUps.length, spentKrw: M.st.shop.spent, step1BestH: M.step1BestUntil != null && M.step1At != null ? (M.step1BestUntil - M.step1At) / 3600 : null,
    end: { activeH: M.endActive, days: M.endDays, record: M.st.record },
  };
}
