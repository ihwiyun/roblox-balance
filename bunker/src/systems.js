'use strict';
// The planned systems, run on the pure logic (src/logic/*.mjs): summons (weapons, turrets, relics, crew cards) with
// their levels, rates and pity; the collections with merging, enhancing and the codex; the weapon each gunner holds,
// the turrets on the bunker's mounts and the relics in their slots; workers bought per floor; the commander;
// evacuation (환생) with medals and automation; what each stage holds; the shop with a test payment adapter; local
// records. The loader at the end of index.html imports the logic into window.LOGIC; without it (file:// without
// --allow-file-access-from-files) SYS.ok stays false and the game runs as before, without the systems.
// The screens read and act through SYS only: 'sys-ready' fires on window once, 'sys-change' after every change.
// The state lives in G (saved by state.js); the game's own files call SYS.hook.* (kills, clears, shots, the clock).
var SYS = window.SYS || (() => {
  let Lg = null, on = false, rng = null, stc = null, ver = 0, queued = false;
  const tun = () => Lg.T;
  const now = () => Date.now();
  const DAY_MS = 864e5, SLOTS_T = 6, SLOTS_R = 8, PRESETS = 3;
  const won = n => n.toLocaleString('en') + '원';
  // a price or a reward is only currencies with an amount (the screens show and check every key); extra facts ride
  // along as properties that do not enumerate
  const purse = (o, extra = {}) => { const out = {}; for (const [k, v] of Object.entries(o)) if (v > 0) out[k] = v; for (const [k, v] of Object.entries(extra)) Object.defineProperty(out, k, { value: v }); return out; };
  const num = n => Math.floor(n).toLocaleString('en');

  /* ================= change events ================= */
  // every change to the systems' state: the cached numbers are dropped and one 'sys-change' fires (per task)
  function changed() {
    stc = null; ver++;
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; dispatchEvent(new Event('sys-change')); });
  }

  /* ================= the state in G: filled in and repaired after a load ================= */
  const KIND = { weapon: 'weapon', weapons: 'weapon', gun: 'weapon', turret: 'turret', turrets: 'turret', relic: 'relic', relics: 'relic',
    crew: 'crew', recruit: 'crew', card: 'crew', cards: 'crew' };
  const kindOf = k => KIND[k] || null;
  const fixArr = (a, n, v) => { const out = Array.isArray(a) ? a.slice(0, n) : []; while (out.length < n) out.push(v); return out; };
  const nat = x => Math.max(0, Math.floor(+x || 0));
  const fixInv = (inv, n) => ({ copies: fixArr(inv && inv.copies, n, 0).map(nat), owned: fixArr(inv && inv.owned, n, false).map(Boolean),
    enh: fixArr(inv && inv.enh, n, 0).map(nat), bt: fixArr(inv && inv.bt, n, 0).map(nat) });
  const fixSum = s => { const pulls = nat(s && s.pulls); return { pulls, level: Lg.summonLevelFor(pulls), pity: fixArr(s && s.pity, tun().gear.pity.length, 0).map(nat) }; };
  // the XP, gems, cards and drops the climb to stage rec would have brought (a save from before the systems, or new)
  function credit(rec) {
    const t = tun(), cmd = Lg.newCommander();
    let xp = 0;
    for (let s = 1; s <= rec; s++) xp += killsNeeded(s) * Lg.killXp(s) + Lg.clearXp(s) + (s % 10 ? 0 : Lg.bossXp(s));
    Lg.addXp(cmd, xp, rec >= t.player.unlockStage);
    G.cmd = cmd;
    G.gems += (t.economy.startGems ?? 500) + t.economy.bossFirstGems * Math.floor(rec / 10) + (t.economy.titanFirstGems - t.economy.bossFirstGems) * Math.floor(rec / 100)
      + Lg.SEASON_FREE.gems * Math.floor(rec / Lg.SEASON_FREE.everyStages);
    G.counts.bossKills = Math.floor(rec / 10); G.counts.titanKills = Math.floor(rec / 100);
    G.runBest = Math.max(G.runBest, rec);
    storyCards(rec + 1);
    for (let k = Math.floor((G.totalKills || 0) / t.relics.killsPerDrop); k > 0; k--) chest();
  }
  function ensure() {
    if (!on) return;
    for (const k of ['gems', 'diamonds', 'medals', 'medalsLife', 'comps', 'record', 'runBest', 'evacs', 'runKills', 'activity']) G[k] = Math.max(0, +G[k] || 0);
    G.wInv = fixInv(G.wInv, Lg.WEAPONS.length); G.tInv = fixInv(G.tInv, Lg.TURRETS.length);
    const n = Lg.RELICS.length, r = G.rel || {};
    G.rel = { level: fixArr(r.level, n, 0).map(x => Math.min(tun().relics.maxLevel, nat(x))), dupes: fixArr(r.dupes, n, 0).map(nat), shards: nat(r.shards),
      slots: fixArr(r.slots, SLOTS_R, -1).map(x => (Number.isInteger(x) && x >= 0 && x < n ? x : -1)), equipped: [] };
    const cards = {};
    for (const [id, c] of Object.entries(G.cards || {})) if (Lg.CARD[id] && c) cards[id] = { level: Math.max(1, nat(c.level)), stars: clamp(nat(c.stars) || 1, 1, 5), dupes: nat(c.dupes), bt: nat(c.bt) };
    G.cards = cards;
    const sums = G.sums || {};
    G.sums = {};
    for (const k of ['weapon', 'turret', 'relic', 'crew']) G.sums[k] = fixSum(sums[k]);
    const ew = G.equipW && typeof G.equipW === 'object' ? G.equipW : {};
    G.equipW = {};
    for (const [k, i] of Object.entries(ew)) if (Number.isInteger(i) && i >= 0 && i < Lg.WEAPONS.length) G.equipW[k] = i;
    G.equipT = fixArr(G.equipT, SLOTS_T, -1).map(x => (Number.isInteger(x) && x >= 0 && x < Lg.TURRETS.length ? x : -1));
    const mn = G.manual || {};
    G.manual = { w: mn.w && typeof mn.w === 'object' ? mn.w : {}, t: fixArr(mn.t, SLOTS_T, false).map(Boolean), r: fixArr(mn.r, SLOTS_R, false).map(Boolean) };
    const c = G.cmd || {};
    G.cmd = { level: Math.max(1, nat(c.level)), xp: Math.max(0, +c.xp || 0), unspent: nat(c.unspent), points: Object.fromEntries(Lg.STATS.map(k => [k, nat(c.points && c.points[k])])) };
    const up = {};
    for (const k of Lg.MEDAL_KEYS) if (G.medalUp && G.medalUp[k]) up[k] = nat(G.medalUp[k]);
    G.medalUp = up;
    G.evacAt = Array.isArray(G.evacAt) ? G.evacAt.filter(Number.isFinite).slice(-50) : [];
    G.runs = Array.isArray(G.runs) ? G.runs.filter(x => x && Number.isFinite(x.best)).slice(-100) : [];
    const sh = G.shop || {}, d = Lg.newShop();
    G.shop = { steps: { ...d.steps, ...(sh.steps || {}) }, packsBought: { ...(sh.packsBought || {}) }, owned: { ...(sh.owned || {}) },
      monthlyUntil: +sh.monthlyUntil || 0, seasonUntil: +sh.seasonUntil || 0, spent: nat(sh.spent), receipts: Array.isArray(sh.receipts) ? sh.receipts.slice(-200) : [] };
    const ct = G.counts || {};
    G.counts = { bossKills: nat(ct.bossKills), titanKills: nat(ct.titanKills), killsForRelic: nat(ct.killsForRelic) };
    G.autoSet = G.autoSet && typeof G.autoSet === 'object' ? G.autoSet : {};
    G.autoShare = clamp(+G.autoShare || .5, .05, 1);
    G.early = G.early && typeof G.early === 'object' ? G.early : {};
    if (G.shop.owned.autoMerge) G.early.autoMerge = true;
    G.oreGems = G.oreGems && typeof G.oreGems === 'object' ? G.oreGems : { day: '', n: 0 };
    G.daily = typeof G.daily === 'string' ? G.daily : '';
    G.presets = fixArr(G.presets, PRESETS, null).map(p => (p && p.w && typeof p.w === 'object' && Array.isArray(p.r) ? { w: p.w, r: fixArr(p.r, SLOTS_R, -1), at: +p.at || 0 } : null));
    rng = Lg.makeRng(1);
    rng.setState((G.rng >>> 0) || (Math.random() * 4294967295) >>> 0);
    if (!G.sysInit) { G.sysInit = true; credit(G.record); }
    if (!G.wInv.owned.some(Boolean)) Lg.addCopy(G.wInv, 0);   // the hero's rusty revolver
    if (G.equipW.me == null && G.wInv.owned[0] && !Object.values(G.equipW).includes(0)) G.equipW.me = 0;
    keepRng();
  }
  const keepRng = () => { G.rng = rng.state(); };

  /* ================= the numbers everything multiplies by ================= */
  let ROLES = {}, FAMS = {};
  const turretOpen = () => MOUNT_AT.filter(at => G.bunker >= at).length;
  const relicOpen = () => Lg.relicSlots(G.record);
  const jobCount = job => G.crew.reduce((n, c) => n + (c && c.job === job ? 1 : 0), 0);
  // a card's ability works in its own section: each section's places (its people) take the best cards of that role
  function cardAbilities() {
    const ab = {}, staffed = { roof: jobCount('사수'), food: jobCount('농부'), mine: jobCount('광부'), shop: jobCount('정비공'), lab: 0 }, active = new Set();
    for (const sec of Object.keys(staffed)) {
      const ids = Object.keys(G.cards).filter(id => id !== 'me' && Lg.ROLE_SECTION[Lg.CARD[id].role] === sec)
        .sort((a, b) => Lg.CARD[b].grade - Lg.CARD[a].grade || G.cards[b].stars - G.cards[a].stars).slice(0, staffed[sec]);
      for (const id of ids) { active.add(id); for (const [k, v] of Object.entries(Lg.ability(id, { cards: G.cards }))) ab[k] = (ab[k] || 0) + (+v || 0); }
    }
    return { ab, active };
  }
  // the commander levels on their own: each level's points go half to power, half to luck (no allocation screen)
  function cmdMuls(level = G.cmd.level) {
    const p = tun().player.pointsPerLevel * (level - 1) / 2;
    return Lg.statMuls(G.record >= tun().player.unlockStage ? { power: p, luck: p } : {});
  }
  function relicMods() {
    const open = relicOpen();
    G.rel.equipped = G.rel.slots.slice(0, open).filter(id => id >= 0 && G.rel.level[id] > 0);
    const EL = { burn: 'fire', slow: 'ice', chain: 'shock' }, els = [];
    for (const k of shooterKeys()) { const w = G.equipW[k]; if (w != null) for (const t of Object.keys(Lg.WEAPONS[w].tags)) if (EL[t]) els.push(EL[t]); }
    for (const i of G.equipT.slice(0, turretOpen())) if (i >= 0 && Lg.TURRETS[i].element) els.push(Lg.TURRETS[i].element === 'frost' ? 'ice' : Lg.TURRETS[i].element);
    const snipers = shooterKeys().filter(k => G.equipW[k] != null && G.equipW[k] % 5 === 3).length;
    return Lg.relicMods(G.rel, { bossKills: G.counts.bossKills, titanKills: G.counts.titanKills, shooters: shooterKeys().length, pierce: snipers, crit: 1 }, els);
  }
  function stats() {
    if (stc) return stc;
    const t = tun(), md = Lg.medalMuls(G.medalUp), cm = cmdMuls(), rm = relicMods(), { ab, active } = cardAbilities();
    const r = k => rm[k] || 0, g = k => ab[k] || 0;
    const ownedW = Lg.ownedBonus(G.wInv), codexW = Lg.codexBonus(G.wInv, 5);
    const ownedT = Lg.ownedBonus(G.tInv, t.gear.ownedGrow, t.gear.ownedBase * .5), codexT = Lg.codexBonus(G.tInv, 4);
    const team = 1 + r('dmgPct') + g('dmgPct') + g('roofPct'), dmgMul = rm.dmgMul ?? 1;
    stc = {
      cm, md, rm, ab, active, ownedW, codexW, ownedT, codexT,
      dmg: cm.dmg * md.dmg * (1 + ownedW) * (1 + codexW) * team * dmgMul,
      crew: md.crew,
      turret: cm.dmg * md.dmg * md.crew * (1 + g('turretPct')) * (1 + ownedT) * (1 + codexT) * dmgMul,
      gold: cm.gold * md.gold, xp: md.xp,
      prod: md.prod * (1 + g('prodAll')), food: 1 + g('food') + g('foodAll'), ore: 1 + g('ore') + g('oreAll'),
      crit: .05 + r('critChance') + g('critChance'), critDmg: 1.5 + r('critDmg'),
      rate: (rm.rateMul ?? 1) * (1 + g('ratePct')), reload: rm.reloadMul ?? 1, noReload: !!rm.noReload,
      crowd: r('crowdPct') + g('crowdPct'), pierce: Math.round(r('pierceCount')), burn: Math.min(1, r('burnUptime')), slow: Math.min(.6, r('slow')),
      boss: 1 + r('bossDmgPct') + g('bossPct'), turretBoss: 1 + r('turretBossPct'), sniper: g('sniperPct'),
      bossTime: r('bossTimeBonus'), bossTimeSet: rm.bossTimeSet || 0,
      taken: (rm.dmgTakenMul ?? 1) / (1 + r('breachShield')),
      repair: (1 + r('repairPct')) * (1 + g('repair')),
      upkeep: (rm.upkeepMul ?? 1) * (1 - Math.min(.6, g('upkeepAll'))), upkeepCover: r('upkeepCover'),
      partsPerKill: t.stage.killParts + r('partsPerKill'), gemsPerOre: r('gemsPerOre'), bossIncomeSec: r('bossIncomeSec'), alchemy: r('alchemy'),
      offlineH: md.offlineH, offlineEff: md.offlineEff + r('offlineEff'), offlineNoUpkeep: !!rm.offlineNoUpkeep,
      doubling: t.medals.doubling + r('doublingAdd'), medalH: r('medalH'), medalPerEvac: r('medalPerEvac'),
      relicFind: g('relicFind'), mergeCut: Math.min(.5, g('mergeCut')), reactions: rm.reactions || [],
      turretResist: Math.min(1, r('turretResist') + g('turretResist')), stunResist: Math.min(1, r('stunResist')), skipMult: rm.skipMult || 0,
    };
    return stc;
  }

  /* ================= people: who shoots, and with what ================= */
  const keyOf = p => (p.hero ? 'me' : p.look.key);
  const shooterKeys = () => ['me', ...G.crew.filter(c => c && c.job === '사수').map(c => c.look.key)];
  // a person from an id the screens may hold: 'me' / -1 for the hero, a bed number, a look key ('minjun') or a name
  function personOf(id) {
    if (id == null || id === 'me' || id === 'hero' || id === -1 || id === '-1' || id === '나') return G.hero ? { key: 'me', p: G.hero } : { key: 'me', p: { hero: true } };
    if (typeof id === 'object' && id.look) return { key: keyOf(id), p: id };
    if (typeof id === 'number' || /^\d+$/.test(id)) { const p = G.crew[+id]; return p ? { key: keyOf(p), p } : null; }
    const p = G.crew.find(c => c && (c.look.key === id || c.name === id));
    return p ? { key: keyOf(p), p } : null;
  }
  const nameOfKey = k => (k === 'me' ? '나' : (G.crew.find(c => c && c.look.key === k) || { name: k }).name);
  const holderOf = i => { for (const [k, v] of Object.entries(G.equipW)) if (v === i) return k; return null; };
  // A choice made on screen stays (G.manual); every other hand, turret slot and relic slot takes the best of what is
  // free, hero first, so a better summon goes straight into use until the player picks something themselves
  function autoEquip() {
    const man = G.manual, keys = shooterKeys();
    for (const k of Object.keys(G.equipW)) if (!keys.includes(k)) { delete G.equipW[k]; delete man.w[k]; } // no longer shoots
    const heldW = new Set(keys.filter(k => man.w[k] && G.equipW[k] != null).map(k => G.equipW[k])), freeW = [];
    for (let i = Lg.WEAPONS.length - 1; i >= 0; i--) if (G.wInv.owned[i] && !heldW.has(i)) freeW.push(i);
    for (const k of keys) if (!man.w[k]) { const i = freeW.shift(); if (i == null) delete G.equipW[k]; else G.equipW[k] = i; }
    const openT = turretOpen(), heldT = new Set(G.equipT.filter((i, s) => s < openT && man.t[s] && i >= 0)), freeT = [];
    for (let i = Lg.TURRETS.length - 1; i >= 0; i--) if (G.tInv.owned[i] && !heldT.has(i)) freeT.push(i);
    for (let s = 0; s < SLOTS_T; s++) if (s >= openT) G.equipT[s] = -1; else if (!man.t[s]) G.equipT[s] = freeT.length ? freeT.shift() : -1;
    const openR = relicOpen(), heldR = new Set(G.rel.slots.filter((id, s) => s < openR && man.r[s] && id >= 0)), score = id => (Lg.RELICS[id].grade + 1) * (4 + G.rel.level[id]);
    const freeR = Lg.RELICS.map(x => x.id).filter(id => G.rel.level[id] > 0 && !heldR.has(id)).sort((a, b) => score(b) - score(a));
    for (let s = 0; s < SLOTS_R; s++) if (s >= openR) G.rel.slots[s] = -1; else if (!man.r[s]) G.rel.slots[s] = freeR.length ? freeR.shift() : -1;
  }
  // the best of everything, everywhere (a button on the screens): every hand choice is let go
  function equipBest() { G.manual = { w: {}, t: [], r: [] }; autoEquip(); changed(); return true; }

  /* ================= collections ================= */
  const invOf = kind => (kind === 'weapon' ? G.wInv : G.tInv);
  const listOf = kind => (kind === 'weapon' ? Lg.WEAPONS : Lg.TURRETS);
  const gradeName = g => Lg.GRADES[g].name;
  const famName = Object.fromEntries([['pistol', '권총'], ['rifle', '기관단총·소총'], ['shotgun', '산탄'], ['sniper', '저격'], ['heavy', '중화기·특수']]);
  const roleName = k => (Lg.TURRET_ROLES.find(r => r.key === k) || {}).name;
  function gear(kind) {
    const inv = invOf(kind), list = listOf(kind), N = tun().gear.mergeN;
    return list.map(it => {
      const i = it.i, slot = kind === 'turret' ? G.equipT.slice(0, turretOpen()).indexOf(i) : -1, by = kind === 'weapon' ? holderOf(i) : null;
      return { i, kind, name: it.name, grade: it.grade, gradeName: gradeName(it.grade), step: it.slot != null ? it.slot : it.i % 4,
        family: kind === 'weapon' ? it.family : it.role, familyName: kind === 'weapon' ? famName[it.family] : roleName(it.role),
        role: kind === 'turret' ? it.role : undefined, roleName: kind === 'turret' ? roleName(it.role) : undefined, element: it.element || null, tags: it.tags,
        owned: inv.owned[i], copies: inv.copies[i], level: inv.enh[i], enh: inv.enh[i], maxLevel: Lg.enhCap(it.grade), breakthrough: Lg.enhNeedsBt(inv, i),
        mergeN: N, toNextMerge: i < list.length - 1 ? Lg.toNextMerge(inv, i, N) : null,
        mul: kind === 'weapon' ? Lg.weaponEquipMul(i, inv.enh[i]) : Lg.turretMul(i, inv.enh[i]),
        equippedBy: by, equippedName: by && nameOfKey(by), slot, equipped: kind === 'weapon' ? by != null : slot >= 0 };
    });
  }
  function relics() {
    const open = relicOpen();
    return Lg.RELICS.map(r => {
      const lv = G.rel.level[r.id], slot = G.rel.slots.slice(0, open).indexOf(r.id);
      return { id: r.id, i: r.id, name: r.name, grade: r.grade, gradeName: gradeName(r.grade), group: Lg.GROUPS[r.group], desc: r.desc, element: r.el,
        owned: lv > 0, level: lv, maxLevel: tun().relics.maxLevel, dupes: G.rel.dupes[r.id], toNextLevel: lv && lv < tun().relics.maxLevel ? lv - G.rel.dupes[r.id] : null,
        slot, equipped: slot >= 0 };
    });
  }
  function relicSets() {
    const on = new Set(G.rel.slots.slice(0, relicOpen()).filter(id => id >= 0 && G.rel.level[id] > 0));
    return Lg.SETS.map(s => { const have = s.ids.filter(id => on.has(id)).length; return { key: s.key, name: s.name, desc: s.desc, have, need: s.ids.length, ids: s.ids.slice(), names: s.ids.map(id => Lg.RELICS[id].name), active: have >= s.ids.length }; });
  }
  function cards() {
    const active = stats().active;
    return Lg.CARDS.map(c => {
      const own = G.cards[c.id], need = own ? tun().crew.starDupes[own.stars - 1] : null;
      return { id: c.id, name: c.name, grade: c.grade, gradeName: gradeName(c.grade), role: c.role, desc: c.desc, owned: !!own || c.id === 'me',
        stars: own ? own.stars : c.id === 'me' ? 1 : 0, dupes: own ? own.dupes : 0, toNextStar: need != null && own.stars < 5 ? need - own.dupes : null, active: active.has(c.id) };
    });
  }
  function codex() {
    const t = inv => inv.owned.filter(Boolean).length;
    return { weapons: { owned: t(G.wInv), total: Lg.WEAPONS.length, bonus: Lg.codexBonus(G.wInv, 5) }, turrets: { owned: t(G.tInv), total: Lg.TURRETS.length, bonus: Lg.codexBonus(G.tInv, 4) },
      relics: { owned: G.rel.level.filter(x => x > 0).length, total: Lg.RELICS.length }, cards: { owned: Object.keys(G.cards).length, total: Lg.CARDS.length } };
  }

  /* ================= summons: gems first, then diamonds (1:1) ================= */
  const PRICE_KEY = { weapon: 'weaponPull', turret: 'turretPull', relic: 'relicChest', crew: 'recruit' };
  function payGems(n) {
    if (G.gems + G.diamonds < n) return false;
    const g = Math.min(G.gems, n);
    G.gems -= g; G.diamonds -= n - g;
    return true;
  }
  function summonInfo(kind) {
    kind = kindOf(kind);
    if (!on || !kind) return null;
    const s = G.sums[kind], L = s.level, M = Lg.MAX_SUMMON_LEVEL, step = tun().gear.summonLevelPulls, price = Lg.PRICES[PRICE_KEY[kind]];
    return { kind, level: L, maxLevel: M, pulls: s.pulls, prevAt: L > 1 ? step * (L - 1) ** 2 : 0, nextAt: L < M ? step * L * L : null,
      rates: Lg.gradeRates(L), nextRates: L < M ? Lg.gradeRates(L + 1) : null,
      pity: tun().gear.pity.map(([minGrade, n], k) => ({ minGrade, gradeName: gradeName(minGrade), every: n, left: n - s.pity[k] })),
      price, price10: price * 10, currency: 'gems', diamondsToo: true, canPay: G.gems + G.diamonds >= price, canPay10: G.gems + G.diamonds >= price * 10 };
  }
  function chest() { const r = Lg.rollRelic(rng, G.rel, G.sums.relic); keepRng(); return r; }
  function storyCards(upTo) {
    for (const [at, id] of Lg.STORY_RECRUITS) if (upTo >= at && !G.cards[id]) Lg.addCard({ cards: G.cards }, id);
  }
  function summon(kind, n = 1) {
    kind = kindOf(kind); n = Math.max(1, Math.floor(+n || 1));
    if (!on || !kind || !payGems(Lg.PRICES[PRICE_KEY[kind]] * n)) return null;
    const out = [], N = tun().gear.mergeN;
    for (let k = 0; k < n; k++) {
      if (kind === 'weapon' || kind === 'turret') {
        const inv = invOf(kind), before = inv.owned.slice();
        const i = kind === 'weapon' ? Lg.summonWeapon(rng, inv, G.sums.weapon) : Lg.summonTurret(rng, inv, G.sums.turret), it = listOf(kind)[i];
        out.push({ kind, i, id: i, name: it.name, grade: it.grade, isNew: !before[i], copies: inv.copies[i], toNextMerge: i < listOf(kind).length - 1 ? Lg.toNextMerge(inv, i, N) : null });
      } else if (kind === 'relic') {
        const was = G.rel.level.slice(), r = Lg.rollRelic(rng, G.rel, G.sums.relic), it = Lg.RELICS[r.id];
        out.push({ kind, i: r.id, id: r.id, name: it.name, grade: it.grade, isNew: !was[r.id], result: r.result, level: G.rel.level[r.id],
          toNextMerge: G.rel.level[r.id] < tun().relics.maxLevel ? G.rel.level[r.id] - G.rel.dupes[r.id] : null });
      } else {
        const r = Lg.recruit(rng, { cards: G.cards }, G.sums.crew), c = Lg.CARD[r.id], own = G.cards[r.id];
        out.push({ kind, i: c.grade, id: r.id, name: c.name, grade: c.grade, isNew: r.result === 'new', result: r.result, stars: own.stars,
          toNextMerge: own.stars < 5 ? tun().crew.starDupes[own.stars - 1] - own.dupes : null });
      }
    }
    keepRng(); autoEquip(); changed();
    return out;
  }

  /* ================= merging and enhancing ================= */
  function mergeAll() {
    if (!on) return 0;
    const st = stats(), N = tun().gear.mergeN;
    const pay = list => i => { const c = Lg.mergeParts(list[i].grade, st.mergeCut); if (G.comps < c) return false; G.comps -= c; return true; };
    const made = Lg.mergeAll(G.wInv, N, pay(Lg.WEAPONS)) + Lg.mergeAll(G.tInv, N, pay(Lg.TURRETS));
    if (made) { autoEquip(); changed(); }
    return made;
  }
  // how many merges wait, and the parts they take
  function mergeable() {
    if (!on) return { count: 0, parts: 0 };
    const N = tun().gear.mergeN, cut = stats().mergeCut;
    let count = 0, parts = 0;
    for (const [inv, list] of [[G.wInv, Lg.WEAPONS], [G.tInv, Lg.TURRETS]]) {
      let carry = 0;
      for (let i = 0; i < list.length - 1; i++) { const m = Math.floor((inv.copies[i] + carry) / N); count += m; parts += m * Lg.mergeParts(list[i].grade, cut); carry = m; }
    }
    return { count, parts };
  }
  const storeCaps = () => ({ food: foodCap(), ore: mineralCap(), parts: partsCap() });
  function enhancePrice(kind, i) {
    kind = kindOf(kind);
    if (!on || (kind !== 'weapon' && kind !== 'turret')) return null;
    const inv = invOf(kind), it = listOf(kind)[i];
    if (!it || !inv.owned[i] || inv.enh[i] >= Lg.enhCap(it.grade)) return null;
    if (Lg.enhNeedsBt(inv, i)) { const c = Lg.enhBtCost(it.grade, inv.enh[i] / 10, storeCaps()); return purse({ ore: c.ore, parts: c.parts }, { bt: true }); }
    const c = Lg.enhCost(it.grade, inv.enh[i]);
    return purse({ gold: c.gold, parts: c.parts });
  }
  const afford = c => G.money >= (c.gold || 0) && G.mineral >= (c.ore || 0) && G.comps >= (c.parts || 0) && G.food >= (c.food || 0);
  const spend = c => { G.money -= c.gold || 0; G.mineral -= c.ore || 0; G.comps -= c.parts || 0; G.food -= c.food || 0; };
  function enhance(kind, i, n = 1) {
    kind = kindOf(kind);
    let done = 0;
    for (; done < Math.max(1, n | 0); done++) {
      const c = enhancePrice(kind, i);
      if (!c || !afford(c)) break;
      spend(c);
      if (c.bt) invOf(kind).bt[i]++; else invOf(kind).enh[i]++;
    }
    if (done) changed();
    return done;
  }

  /* ================= equipping ================= */
  function equipWeapon(personId, i) {
    const pr = on && personOf(personId);
    if (!pr || !(pr.p.hero || pr.p.job === '사수')) return false;
    if (i != null && i >= 0 && !G.wInv.owned[i]) return false;
    G.manual.w[pr.key] = true;
    if (i == null || i < 0) { delete G.equipW[pr.key]; autoEquip(); changed(); return true; }
    const other = holderOf(i), mine = G.equipW[pr.key];
    if (other && other !== pr.key) { if (mine != null) G.equipW[other] = mine; else delete G.equipW[other]; }
    G.equipW[pr.key] = i;
    autoEquip(); changed(); return true;
  }
  function equipSlot(list, man, open, slot, id, owned) {
    if (!on || !(slot >= 0 && slot < open)) return false;
    if (id != null && id >= 0 && !owned(id)) return false;
    man[slot] = true;
    if (id == null || id < 0) list[slot] = -1;
    else {
      const at = list.indexOf(id);
      if (at >= 0 && at !== slot) list[at] = at < open ? list[slot] : -1;
      list[slot] = id;
    }
    autoEquip(); changed(); return true;
  }
  const equipTurret = (slot, i) => equipSlot(G.equipT, G.manual.t, turretOpen(), slot, i, x => G.tInv.owned[x]);
  const equipRelic = (slot, id) => equipSlot(G.rel.slots, G.manual.r, relicOpen(), slot, id, x => G.rel.level[x] > 0);

  /* ================= workers, bought per floor ================= */
  // farm, mine and workshop take nameless hands bought for that floor; the roof's gunners are hired as before (a bed
  // each, named); everyone sleeps in a bed and eats (state.js, loop.js). The price is the next hand's, as before
  const SECTIONS = { farm: { job: '농부', max: 5 }, mine: { job: '광부', max: 5 }, workshop: { job: '정비공', max: 4, unlock: 15 }, roof: { job: '사수', max: 5 } };
  const SEC = { farm: 'farm', food: 'farm', '2층 식량': 'farm', mine: 'mine', ore: 'mine', mineral: 'mine', '3층 채굴': 'mine', workshop: 'workshop', shop: 'workshop', parts: 'workshop', '작업장': 'workshop', roof: 'roof', gunner: 'roof', '지붕 초소': 'roof' };
  function workers(section) {
    const key = SEC[section], s = SECTIONS[key];
    if (!s) return null;
    const used = hired().length, beds = bedsOf(G.live), c = used < HIRE.length ? capCost({ ...HIRE[used] }) : null, count = jobCount(s.job);
    const locked = !!s.unlock && Math.max(G.record + 1, G.best) < s.unlock;
    const reason = locked ? '스테이지 ' + s.unlock : count >= s.max ? '최대' : used >= beds || !c ? '침대 부족' : null;
    return { section: key, job: s.job, count, max: s.max, price: c && purse({ gold: c.money, food: c.food, ore: c.mineral }),
      beds: { used, total: beds }, locked, lockReason: reason, reason, canBuy: !reason && !!c && canPay(c) };
  }
  function buyWorker(section) {
    const w = workers(section);
    if (!w || w.reason) return false;
    const c = capCost({ ...HIRE[hired().length] });
    if (!canPay(c)) return false;
    pay(c);
    const p = hireWorker(w.job);
    if (!p) { for (const [k, v] of Object.entries(c)) G[k] += v; return false; }
    if (on) autoEquip();
    changed();
    if (typeof sound === 'function') sound('buy');
    return true;
  }

  /* ================= the commander ================= */
  function addXp(xp) {
    if (!(xp > 0)) return;
    const gained = Lg.addXp(G.cmd, xp * stats().xp, G.record >= tun().player.unlockStage);
    if (gained) { notify('지휘관 레벨 ' + G.cmd.level, '', 'good'); changed(); }
  }
  function commander() {
    if (!on) return null;
    const m = cmdMuls(), n = cmdMuls(G.cmd.level + 1), unlocked = G.record >= tun().player.unlockStage;
    return { level: G.cmd.level, xp: G.cmd.xp, need: Lg.xpToNext(G.cmd.level), unlocked, unlockStage: tun().player.unlockStage,
      bonus: { dmg: m.dmg, gold: m.gold }, next: { dmg: n.dmg, gold: n.gold } };
  }

  /* ================= evacuation (환생) ================= */
  function medalsNow(forced = false) {
    const st = stats(), recent = G.evacAt.filter(t => now() - t < DAY_MS).length;
    return Lg.medalGain(G.runBest, G.medalsLife, { doubling: st.doubling, forced, bonus: st.medalPerEvac * recent, hAdd: st.medalH });
  }
  const autoUnlocked = a => G.evacs >= a.evacs || !!G.early[a.key];
  const autoEnabled = a => G.autoSet[a.key] ?? a.key !== 'autoEvac';   // every switch starts on but the auto evacuation
  const autoOn = a => autoUnlocked(a) && autoEnabled(a);
  const autoKey = key => Lg.AUTOMATION.find(a => a.key === key);
  function prestigeInfo() {
    if (!on) return null;
    const st = stats(), gain = medalsNow();
    const ups = Lg.MEDAL_KEYS.map(key => {
      const level = G.medalUp[key] || 0, maxed = Lg.medalUpMaxed(key, level), price = maxed ? null : Lg.medalUpCost(key, level);
      return { key, name: Lg.MEDAL_UPS[key].name, desc: Lg.MEDAL_UPS[key].desc, level, price, maxed, canBuy: !maxed && G.evacs > 0 && G.medals >= price };
    });
    const auto = Lg.AUTOMATION.map(a => ({ at: a.evacs, count: a.evacs, key: a.key, name: a.name, unlocked: autoUnlocked(a), enabled: autoEnabled(a), on: autoOn(a) }));
    return { gainNow: gain, can: gain > 0, medals: G.medals, medalsLife: G.medalsLife, evacs: G.evacs, count: G.evacs, runBest: G.runBest, firstAt: tun().medals.firstAt,
      cap: Lg.medalCap(G.medalsLife, st.doubling), capStage: Lg.stageForCap(G.medalsLife, st.doubling),
      gems: Math.floor(tun().economy.evacGems0 + tun().economy.evacGemsPerStage * G.runBest), ups, upgrades: ups, auto, automation: auto, share: G.autoShare };
  }
  // the reset (doc 5): the stage, gold, food, ore and the workshop go; the base, gear, relics, crew, commander and
  // medals stay. forced: a breach while starving pays half the medals; before stage 50 it only steps one stage back
  function evacuate(forced = false) {
    if (!on) return null;
    const t = tun(), gain = medalsNow(forced);
    if (forced && G.runBest < t.medals.firstAt) return { gain: 0, back: true };
    if (!gain) return null;
    const gems = Math.floor(t.economy.evacGems0 + t.economy.evacGemsPerStage * G.runBest);
    G.medals += gain; G.medalsLife += gain; G.evacs++; G.evacAt.push(now()); G.evacAt = G.evacAt.slice(-50); G.gems += gems;
    G.runs.push({ n: G.evacs, best: G.runBest, kills: G.runKills, medals: gain, at: now(), forced });
    G.runs = G.runs.slice(-100);
    for (const z of G.zombies) z.gone = true;
    Object.assign(G, { wave: 1, waveKills: 0, best: 1, repeat: false, bossFor: 0, bossLeft: 0, zombies: [], spits: [], money: 0, food: 0, mineral: 0,
      runBest: 0, runKills: 0, spawnIn: 2, hungry: false, starve: 0, skip: null });
    G.lv = { atk: 0, spd: 0, mag: 0 };
    if (autoOn(autoKey('startSkip'))) {
      let w = 1;
      for (let to; (to = skipTo(w)) > w;) w = to;
      if (w > 1) { G.wave = G.best = w; G.runBest = w - 1; notify('스킵', '스테이지 1 → ' + w); }
    }
    G.hp = bunkerHp(G.bunker);
    if (G.fence) { G.fenceHp = fenceHp(G.fence); G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0]; if (typeof composeYard === 'function') composeYard(); }
    for (const s of shooters()) { s.ammo = gunStat('mag'); s.reload = 0; s.target = null; }
    changed();
    if (typeof save === 'function') save();
    return { gain, gems };
  }
  function prestige() {
    const r = evacuate(false);
    if (r) { notify('환생', '훈장 +' + num(r.gain), 'good'); if (typeof sound === 'function') sound('buy'); }
    return r;
  }
  function buyMedalUp(key) {
    if (!on || !Lg.MEDAL_UPS[key] || !G.evacs) return false;
    const L = G.medalUp[key] || 0;
    if (Lg.medalUpMaxed(key, L)) return false;
    const c = Lg.medalUpCost(key, L);
    if (G.medals < c) return false;
    G.medals -= c; G.medalUp[key] = L + 1;
    changed(); return true;
  }
  function setAutomation(key, value) {
    if (!on || !autoKey(key)) return false;
    G.autoSet[key] = !!value; changed(); return true;
  }
  /* ================= auto-skip (doc 6; zombies.js runs it) ================= */
  // the stage to play from stage w on: past every stage, up to 50, that the firepower beats mult times over and that
  // lies within the record (mult 10; 5 with 12 evacuations; the clockwork relic's 7). In repeat mode nothing is skipped
  function skipTo(w) {
    if (!on || G.repeat || w > G.record) return w;
    const t = tun(), mult = stats().skipMult || (autoOn(autoKey('skip5x')) ? t.stage.skipMultAuto : t.stage.skipMult), p = power();
    let last = w - 1;
    while (last - (w - 1) < t.stage.skipMax && last + 1 <= G.record && p >= mult * stageNeed(last + 1)) last++;
    return last + 1;
  }
  function setAutoShare(x) { if (!on) return false; G.autoShare = clamp(+x || 0, .05, 1); changed(); return true; }

  /* ================= stages ================= */
  const bossLimit = s => { const b = Lg.bossInfo(s), st = stats(); return b ? (st.bossTimeSet && b.kind === 'boss' ? st.bossTimeSet : b.time) + st.bossTime : 0; };
  function firstGems(s) {
    if (s <= G.record) return 0;
    const t = tun(), k = Lg.kindOf(s), season = G.shop.seasonUntil > now();
    return (k === 'titan' ? t.economy.titanFirstGems : k === 'boss' ? t.economy.bossFirstGems : 0)
      + (s % Lg.SEASON_FREE.everyStages ? 0 : Lg.SEASON_FREE.gems + (season ? Lg.PASSES.season.gems : 0));
  }
  function stageInfo(s) {
    if (!on) return null;
    s = clamp(Math.round(+s || 1), 1, tun().stage.cap);
    const band = Lg.bandOf(s), b = Lg.bossInfo(s), st = stats();
    const xp = (killsNeeded(s) * Lg.killXp(s) + Lg.clearXp(s) + (b ? Lg.bossXp(s) : 0)) * st.xp;
    return { stage: s, theme: band.theme, band: Lg.band(s), zone: Lg.zone(s) + 1, eliteShare: Lg.eliteShare(s),
      zombies: band.zombies.map(k => ({ key: k, name: Lg.ZOMBIES[k].name, sprite: ZTYPES[k] ? k : null })),
      boss: b && { kind: b.kind, name: b.name, desc: b.patterns.map(p => Lg.PATTERNS[p.key].desc).join(' · '), time: bossLimit(s), patterns: b.patterns.map(p => p.key) },
      kills: killsNeeded(s), rewards: Object.defineProperty({ gold: Math.round(stageGold(s) * st.gold), gems: firstGems(s) }, 'xp', { value: Math.round(xp) }), xp: Math.round(xp),
      cleared: s <= G.record, current: s === G.wave };
  }
  // what is on now: the stage, its kills, the boss and its clock
  function stageNow() {
    const z = on && G.zombies.find(o => o.type === 'boss' && !o.minion && o.state !== 'dying'), b = z && Lg.bossInfo(G.wave);
    return { stage: G.wave, kills: G.waveKills, need: killsNeeded(G.wave), repeat: G.repeat, best: G.best, record: G.record,
      skip: G.skip ? { from: G.skip.from, to: G.skip.to, progress: Math.min(1, G.skip.t / G.skip.dur) } : null,
      boss: b ? { name: b.name, kind: b.kind, left: Math.max(0, G.bossLeft || 0), limit: bossLimit(G.wave), hp: Math.max(0, z.hp / z.max),
        phase: (z.phase || 0) + 1, phases: z.phases ? z.phases.length : 1, gathering: z.shield > 0,
        patterns: b.patterns.map(p => ({ key: p.key, desc: Lg.PATTERNS[p.key].desc, half: p.w < 1 })), split: G.zombies.filter(o => o.minion && o.state !== 'dying').length } : null };
  }

  /* ================= equipment presets (the shop's 장비 프리셋): the weapons in the gunners' hands and the relics ================= */
  function presets() {
    const list = !on ? [] : G.presets.map((p, n) => ({ n, saved: !!p, at: p ? p.at : 0,
      weapons: p ? Object.entries(p.w).map(([key, i]) => ({ key, who: nameOfKey(key), i, name: Lg.WEAPONS[i].name })) : [],
      relics: p ? p.r.map((id, slot) => (id >= 0 ? { slot, id, name: Lg.RELICS[id].name } : null)).filter(Boolean) : [] }));
    return Object.assign(list, { owned: on && !!G.shop.owned.presets, max: PRESETS });
  }
  function savePreset(n) {
    if (!on || !G.shop.owned.presets || !(n >= 0 && n < PRESETS)) return false;
    const w = {};
    for (const k of shooterKeys()) if (G.equipW[k] != null) w[k] = G.equipW[k];
    G.presets[n] = { w, r: G.rel.slots.slice(), at: now() };
    changed(); return true;
  }
  // what a preset holds goes back in place as choices made by hand (gunners and slots it does not name stay automatic);
  // a weapon or relic it gives to one is taken from any other
  function loadPreset(n) {
    const p = on && G.shop.owned.presets && G.presets[n];
    if (!p) return false;
    const keys = shooterKeys(), usedW = new Set();
    for (const k of keys) { const i = p.w[k]; if (i != null && G.wInv.owned[i] && !usedW.has(i)) { G.equipW[k] = i; G.manual.w[k] = true; usedW.add(i); } }
    for (const k of keys) if (!(k in p.w) && usedW.has(G.equipW[k])) { delete G.equipW[k]; G.manual.w[k] = false; }
    const open = relicOpen(), usedR = new Set();
    for (let s = 0; s < open; s++) { const id = p.r[s]; if (id >= 0 && G.rel.level[id] > 0 && !usedR.has(id)) { G.rel.slots[s] = id; G.manual.r[s] = true; usedR.add(id); } }
    for (let s = 0; s < open; s++) if (!(p.r[s] >= 0) && usedR.has(G.rel.slots[s])) { G.rel.slots[s] = -1; G.manual.r[s] = false; }
    autoEquip(); changed(); return true;
  }

  /* ================= the shop, with a test payment adapter ================= */
  // test mode: every purchase is approved at once and kept as a receipt; no money moves. Google Play Billing takes
  // this place at launch (purchase() becomes asynchronous then, and the server books the diamonds)
  const payment = { mode: 'test', purchase(id, krw) { const receipt = { id, krw, at: now(), test: true }; G.shop.receipts.push(receipt); G.shop.receipts = G.shop.receipts.slice(-200); return { ok: true, receipt }; } };
  const CONV = [['noads', 'adRemoval', '광고 제거'], ['automerge', 'autoMerge', '자동 합성'], ['offline', 'offline12', '오프라인 +12시간'],
    ['presets', 'presets', '장비 프리셋'], ['research', 'researchSlot', '연구 칸 +1'], ['speed', 'x2Default', '배속 상시']];
  function itemsText(items) {
    const out = [];
    if (items.weapon != null) { const w = Lg.WEAPONS[items.weapon]; out.push(`${gradeName(w.grade)} ${w.slot + 1}번 무기 ${w.name}`); }
    if (items.turret != null) { const t = Lg.TURRETS[items.turret]; out.push(`${gradeName(t.grade)} 터렛 ${t.name}`); }
    if (items.card != null) out.push(`${gradeName(items.card)} 동료 카드`);
    if (items.relicChests) out.push(`유물 상자 ${items.relicChests}`);
    if (items.gems) out.push(`보석 ${num(items.gems)}`);
    if (items.food) out.push(`식량 ${num(items.food)}`);
    return out;
  }
  function catalog() {
    if (!on) return [];
    const sh = G.shop, out = [], t = now();
    Lg.STEP_LINES.weapon.forEach((st, k) => {
      const bought = sh.steps.weapon > k, reason = bought ? '구매 완료' : sh.steps.weapon < k ? `${k}단계 구매 후` : G.record < st.gate ? `스테이지 ${st.gate}` : null;
      out.push({ id: 'step-' + (k + 1), tab: 'pack', step: k + 1, name: `${k + 1}단계`, price: st.krw, priceText: won(st.krw), contents: itemsText(st.items),
        text: itemsText(st.items).join(' + '), gate: st.gate, bought, locked: !!reason, lockReason: reason });
    });
    Lg.DIAMOND_PACKS.forEach((p, k) => {
      const first = !sh.packsBought[k], dia = Lg.diamondsFor(sh, k);
      out.push({ id: 'dia-' + (k + 1), tab: 'dia', name: `다이아 ${num(p.dia)}`, price: p.krw, priceText: won(p.krw), dia, base: p.dia, first,
        contents: [`다이아 ${num(dia)}`], text: `다이아 ${num(dia)}` + (first ? ' (첫 구매 2배)' : ''), locked: false, lockReason: null });
    });
    for (const [id, P, name] of [['monthly', Lg.PASSES.monthly, '월정액'], ['season', Lg.PASSES.season, '시즌 패스']]) {
      const until = id === 'monthly' ? sh.monthlyUntil : sh.seasonUntil;
      out.push({ id, tab: 'pass', name, price: P.krw, priceText: won(P.krw), contents: P.desc.split(' + '), text: P.desc, days: P.days, active: until > t, until: until > t ? until : 0, locked: false, lockReason: null });
    }
    for (const [id, key, name] of CONV) {
      const own = !!sh.owned[key];
      out.push({ id, tab: 'conv', key, name, price: Lg.CONVENIENCE[key].krw, priceText: won(Lg.CONVENIENCE[key].krw), contents: [Lg.CONVENIENCE[key].desc], text: Lg.CONVENIENCE[key].desc, owned: own, locked: own, lockReason: own ? '구매 완료' : null });
    }
    return Object.assign(out, { packages: out.filter(x => x.tab === 'pack'), diamonds: out.filter(x => x.tab === 'dia'), passes: out.filter(x => x.tab === 'pass'), convenience: out.filter(x => x.tab === 'conv') });
  }
  function grantItems(items, got) {
    if (items.weapon != null) { Lg.addCopy(G.wInv, items.weapon); got.push(Lg.WEAPONS[items.weapon].name); }
    if (items.turret != null) { Lg.addCopy(G.tInv, items.turret); got.push(Lg.TURRETS[items.turret].name); }
    if (items.card != null) { const id = rng.pick(Lg.CARDS_BY_GRADE[items.card]); Lg.addCard({ cards: G.cards }, id); got.push(Lg.CARD[id].name + ' 카드'); }
    for (let k = 0; k < (items.relicChests || 0); k++) got.push(Lg.RELICS[chest().id].name);
    if (items.gems) { G.gems += items.gems; got.push('보석 ' + num(items.gems)); }
    if (items.food) { G.food += items.food; got.push('식량 ' + num(items.food)); }
    keepRng();
  }
  function buy(id) {
    const item = catalog().find(x => x.id === id);
    if (!item || item.locked || !payment.purchase(id, item.price).ok) return null;
    const sh = G.shop, got = [];
    sh.spent += item.price;
    if (item.tab === 'pack') { const st = Lg.STEP_LINES.weapon[item.step - 1]; sh.steps.weapon = item.step; grantItems(st.items, got); }
    else if (item.tab === 'dia') { const k = +id.slice(4) - 1, d = Lg.diamondsFor(sh, k); sh.packsBought[k] = true; G.diamonds += d; got.push('다이아 ' + num(d)); }
    else if (id === 'monthly') {
      const P = Lg.PASSES.monthly;
      sh.monthlyUntil = Math.max(now(), sh.monthlyUntil) + P.days * DAY_MS; G.gems += P.now;
      got.push(`월정액 ${P.days}일`, '보석 ' + num(P.now));
    } else if (id === 'season') { sh.seasonUntil = Math.max(now(), sh.seasonUntil) + Lg.PASSES.season.days * DAY_MS; got.push(`시즌 패스 ${Lg.PASSES.season.days}일`); }
    else {
      sh.owned[item.key] = true; got.push(item.name);
      if (item.key === 'autoMerge') G.early.autoMerge = true;
      if (item.key === 'x2Default') setSpeed(2);
    }
    autoEquip(); changed();
    if (typeof save === 'function') save();
    return got;
  }
  function setSpeed(v) {
    G.speed = v;
    const b = document.getElementById('speed');
    if (b) b.setAttribute('aria-pressed', String(v === 2));
  }

  /* ================= records: this player's own runs (the raids and real ranking need the server) ================= */
  // the base's firepower (damage a second): each gun on its fire rate and magazine uptime with its crits (the crew
  // gunners on duty about four fifths of the time, none while starving), and the turrets
  function power() {
    if (!on) return 0;
    const spd = gunStat('spd'), mag = gunStat('mag');
    let dps = 0;
    for (const s of [G.hero, ...(G.hungry ? [] : G.crew.filter(c => c && c.job === '사수'))].filter(Boolean)) {
      const w = shooter(s), rate = spd * w.rate, up = w.noReload ? 1 : (mag / rate) / (mag / rate + reloadTime() * w.reload);
      dps += damageOf() * w.mul * rate * up * (1 + w.crit * (w.critMul - 1)) * (s.hero ? 1 : .8);
    }
    for (let k = 0; k < turretOpen(); k++) if (G.equipT[k] >= 0 && G.tInv.owned[G.equipT[k]]) dps += turretDps(G.equipT[k]);
    return Math.round(dps);
  }
  function records() {
    const rows = !on ? [] : G.runs.map(r => ({ name: `나 · ${r.n}회차`, stage: r.best, me: true, run: r.n, kills: r.kills || 0, at: r.at }));
    if (on) rows.push({ name: `나 · ${G.evacs + 1}회차`, stage: G.runBest, me: true, current: true, run: G.evacs + 1, kills: G.runKills });
    rows.sort((a, b) => b.stage - a.stage || b.run - a.run);
    rows.forEach((r, k) => { r.rank = k + 1; });
    return Object.assign(rows, { bestStage: on ? G.record : Math.max(0, G.best - 1), kills: G.totalKills, prestiges: on ? G.evacs : 0, power: power(), raidsAvailable: false });
  }
  const currencies = () => ({ gold: G.money, food: G.food, ore: G.mineral, gems: on ? G.gems : 0, diamonds: on ? G.diamonds : 0, parts: on ? G.comps : 0, medals: on ? G.medals : 0 });

  /* ================= combat: what a shooter's shot does ================= */
  const NEUTRAL = { mul: 1, crit: 0, critMul: 1, rate: 1, crowd: 0, pierce: 0, burn: 0, slow: 0, chain: 0, boss: 1, noReload: false, reload: 1 };
  const shotCache = new Map();
  let shotVer = -1;
  function shooter(s) {
    if (!on) return NEUTRAL;
    if (shotVer !== ver) { shotCache.clear(); shotVer = ver; }
    const key = keyOf(s);
    let w = shotCache.get(key);
    if (w) return w;
    const st = stats(), i = G.equipW[key], has = i != null && G.wInv.owned[i], fam = has ? FAMS[Lg.WEAPONS[i].family] : {}, tags = has ? Lg.WEAPONS[i].tags : {};
    const eq = has ? Lg.weaponEquipMul(i, G.wInv.enh[i]) : .5, crew = s.hero ? 1 : st.crew;
    // the real fire stops at 12 shots a second; any rate beyond it becomes damage
    const raw = (1 + (fam.rate || 0)) * st.rate, cap = tun().workshop.maxShots / Math.max(.01, gunStat('spd')), rate = Math.min(raw, cap);
    w = { mul: eq * crew * st.dmg * (fam.key === 'sniper' ? 1 + st.sniper : 1) * (raw / rate), crit: Math.min(.8, st.crit + (fam.crit || 0)), critMul: st.critDmg + (fam.critDmg || 0),
      rate, crowd: (fam.crowd || 0) + (tags.crowd || 0) + st.crowd, pierce: (fam.pierce || 0) + st.pierce, burn: Math.max(tags.burn || 0, st.burn), slow: Math.min(.6, (tags.slow || 0) + st.slow),
      chain: tags.chain || 0, boss: st.boss, noReload: st.noReload, reload: st.reload, weapon: has ? i : -1 };
    shotCache.set(key, w);
    return w;
  }

  /* ================= turrets on the bunker's mounts ================= */
  // per role: shots a second and barrel length (px). Damage a second follows the logic: the base gun's fire times the
  // role's share, the step and enhancement, the bunker's level and the turret multipliers
  const TFIRE = { mg: { rate: 4, len: 7 }, status: { rate: 2, len: 5 }, tesla: { rate: 1, len: 4 }, blast: { rate: .6, len: 5 } };
  const towers = [];
  let towerSig = '';
  function turretDps(i) {
    const role = ROLES[Lg.TURRETS[i].role], rate = gunStat('spd'), mag = gunStat('mag'), fire = (mag / rate) / (mag / rate + reloadTime());
    return gunStat('atk') * rate * fire * role.coef * Lg.turretMul(i, G.tInv.enh[i]) * stats().turret * (1 + tun().base.turretPerLevel * G.bunker);
  }
  function syncTowers() {
    const mounts = (typeof SITES !== 'undefined' && SITES.mounts) || [], open = Math.min(turretOpen(), mounts.length);
    const sig = open + ':' + G.equipT.slice(0, open).join() + ':' + mounts.slice(0, open).map(m => m.join()).join(';');
    if (sig === towerSig) return;
    towerSig = sig;
    const old = new Map(towers.map(t => [t.k, t]));
    towers.length = 0;
    for (let k = 0; k < open; k++) {
      const i = G.equipT[k];
      if (i < 0 || !G.tInv.owned[i]) continue;
      const m = mounts[k], t = old.get(k) || { yaw: Math.atan2(m[1], m[0]), cool: Math.random() * .5, flash: 0, recoil: 0, target: null, retarget: 0, shots: 0 };
      Object.assign(t, { k, i, x: m[0], y: m[1], z: m[2], role: Lg.TURRETS[i].role, el: Lg.TURRETS[i].element, grade: Lg.TURRETS[i].grade });
      towers.push(t);
    }
  }
  const alive = z => z && z.state !== 'dying' && !z.gone && z.visible;
  function towerTarget(t) {
    let best = null, bs = Infinity;
    for (const z of G.zombies) {
      if (!alive(z)) continue;
      const sc = threat(z) + Math.hypot(z.x - t.x, z.y - t.y) * .15 + angleGap(Math.atan2(z.y - t.y, z.x - t.x), t.yaw) * .2;
      if (sc < bs) { bs = sc; best = z; }
    }
    return best;
  }
  function near(z, r, skip) { return G.zombies.filter(o => o !== skip && alive(o) && Math.hypot(o.x - z.x, o.y - z.y) < r); }
  function towerFire(t, z) {
    const role = ROLES[t.role], st = stats(), boss = z.type === 'boss';
    const dmg = turretDps(t.i) / TFIRE[t.role].rate * (boss ? role.boss * st.turretBoss * st.boss : 1) * (z.armor ? 1 - z.armor * .3 : 1);
    t.flash = 1; t.recoil = 1; t.shots++;
    const mz = t.muzzle || [project(t.x, t.y, t.z + .3).sx, project(t.x, t.y, t.z + .3).sy], hit = project(z.x, z.y, .8);
    G.tracers.push({ ax: mz[0], ay: mz[1], bx: hit.sx, by: hit.sy, life: .06 });
    sound('shot');
    if (t.role === 'blast') {
      for (const o of near(z, .95, z)) hurt(o, dmg * .7, true, true);
      spray(z.x, z.y, .4, 14, 2.4, 2.2, .6, [rgb(255, 214, 120), rgb(255, 150, 60), rgb(120, 110, 100)]);
    } else if (t.role === 'tesla') {
      let from = z;
      for (const o of near(z, 1.7, z).slice(0, 2)) { const a = project(from.x, from.y, .8), b = project(o.x, o.y, .8); G.tracers.push({ ax: a.sx, ay: a.sy, bx: b.sx, by: b.sy, life: .06 }); hurt(o, dmg * .6, true, true); from = o; }
    } else if (t.role === 'status') {
      if (t.el === 'fire') ignite(z, dmg * .5); else chill(z, .35);
    }
    hurt(z, dmg);
  }
  function updateTowers(dt) {
    syncTowers();
    for (const t of towers) {
      t.recoil = Math.max(0, t.recoil - dt * 6);
      // stopped by acid: it bubbles green until it clears
      if (t.down > 0) { t.down -= dt; if (Math.random() < dt * 8) spray(t.x, t.y, t.z + .35, 2, .6, 1.2, .5, [rgb(170, 220, 60), rgb(120, 180, 40)]); continue; }
      if (!alive(t.target) || (t.retarget -= dt) <= 0) { t.target = towerTarget(t); t.retarget = .6; }
      const z = t.target;
      t.cool -= dt;
      if (!z) { t.yaw += Math.sin(G.time * .5 + t.k) * dt * .4; t.cool = Math.max(t.cool, 0); continue; }
      const want = Math.atan2(z.y - t.y, z.x - t.x), d = Math.atan2(Math.sin(want - t.yaw), Math.cos(want - t.yaw));
      t.yaw += clamp(d, -6 * dt, 6 * dt);
      if (t.cool <= 0 && Math.abs(d) < .2) { towerFire(t, z); t.cool += 1 / TFIRE[t.role].rate; }
      if (t.cool < 0) t.cool = 0;
    }
  }
  // the turret art (art/turrets.js, ART_TURRETS): types['turret' + i], one anim per facing (se, sw, nw, ne) with two
  // frames, idle and fire (the fire frame for the one drawn frame of a shot); the muzzle is the end of frame.gun.
  // A turret not drawn yet gets the stand-in below
  const turretSets = new Map();
  function turretArt(i) {
    const A = window.ART_TURRETS, src = A && A.types && A.types['turret' + i];
    if (!src) return null;
    let set = turretSets.get(i);
    if (!set) { const key = 'turret' + i; SPR[key] = decodeSet(src); set = { key, pal: paletteOf(src.pal) }; turretSets.set(i, set); }
    return set;
  }
  const GRADE_RGB = [[150, 150, 150], [92, 170, 84], [72, 128, 214], [150, 92, 200], [236, 140, 48], [214, 60, 56], [232, 192, 60], [120, 220, 230]];
  function drawTower(t) {
    const art = turretArt(t.i);
    if (art) {
      const f = facingOf(t.yaw), dir = f.view === 'F' ? (f.mirror ? 'sw' : 'se') : (f.mirror ? 'ne' : 'nw');
      const info = drawSprite(art.key, dir, 'F', t.flash ? 1 : 0, false, t.x, t.y, t.z, art.pal), g = info.fr.gun;
      if (g) t.muzzle = frameSpot(info, [g[2], g[3]]);
      t.flash = 0;
      return;
    }
    // stand-in: a squat steel body (dark edges like the bunker's) with a band of its grade's colour, on the turntable,
    // and a barrel by role aimed at the target: twin for the machine gun, a thick tube for the mortar or rockets, a
    // coil tip for the tesla, a nozzle with a tank for flame or frost
    const p = project(t.x, t.y, t.z), bx = Math.round(p.sx), by = Math.round(p.sy), d0 = p.d + .3;
    const dark = rgb(40, 40, 46), mid = rgb(96, 100, 108), lite = rgb(150, 154, 160), band = rgb(...GRADE_RGB[t.grade]);
    for (let y = 0; y < 7; y++) for (let x = -5; x < 5; x++) {
      const edge = x === -5 || x === 4 || y === 0 || y === 6, c = edge ? dark : y === 2 ? band : y >= 4 ? lite : mid;
      putPx(bx + x, by - 1 - y, c, d0 + y * .02);
    }
    const a = project(t.x, t.y, t.z + .3), e = project(t.x + Math.cos(t.yaw) * .5, t.y + Math.sin(t.yaw) * .5, t.z + .3);
    let ux = e.sx - a.sx, uy = e.sy - a.sy;
    const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
    const len = TFIRE[t.role].len + 2 - t.recoil * 1.5, sx = bx, sy = by - 5, ex = Math.round(sx + ux * len), ey = Math.round(sy + uy * len), db = d0 + (uy > 0 ? .3 : -.05);
    pxLine(sx, sy, ex, ey, dark, db, t.role === 'blast' || t.role === 'mg' ? 2 : 1);
    if (t.role === 'mg') pxLine(sx, sy, ex, ey, mid, db + .01);
    if (t.role === 'tesla') { putPx(ex, ey - 1, rgb(140, 210, 255), db + .01); putPx(ex + 1, ey - 1, rgb(220, 240, 255), db + .01); putPx(ex, ey, rgb(140, 210, 255), db + .01); }
    if (t.role === 'status') for (let y = 0; y < 4; y++) putPx(bx - 4, by - 7 - y, t.el === 'fire' ? rgb(200, 70, 50) : rgb(110, 190, 230), d0 + .2);
    t.muzzle = [Math.round(ex + ux), Math.round(ey + uy)];
    if (t.flash) flashAt(t.muzzle[0], t.muzzle[1], db + .05);
    t.flash = 0;
  }
  // a muzzle flash: one drawn frame, at the muzzle only
  function flashAt(x, y, d) {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (Math.abs(ox) + Math.abs(oy) <= 1) putPx(x + ox, y + oy, ox || oy ? rgb(255, 196, 80) : rgb(255, 250, 220), d);
  }

  /* ================= the clock: gems for play, the daily gift, automation, the turrets ================= */
  let secT = 0, goldMark = 0, goldRate = 0, mergeT = 0, sig = '';
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function daily() {
    if (G.daily === today()) return;
    G.daily = today();
    const t = tun(), monthly = G.shop.monthlyUntil > now(), add = t.economy.dailyGems + (monthly ? Lg.PASSES.monthly.daily : 0);
    G.gems += add;
    notify('일일 보석', '+' + num(add), 'good');
    changed();
  }
  function automate() {
    const A = Object.fromEntries(Lg.AUTOMATION.map(a => [a.key, autoOn(a)]));
    if (A.autoWorkshop) {
      // the workshop line that costs least, while it takes no more than the set share of the gold
      let best = null, bc = null;
      for (const k of Object.keys(GUN)) { if (G.lv[k] >= GUN[k].max) continue; const c = capCost(gunCost(k, G.lv[k])); if (!bc || c.money < bc.money) { best = k; bc = c; } }
      if (best && canPay(bc) && bc.money <= G.money * G.autoShare) { pay(bc); G.lv[best]++; if (best === 'mag') for (const s of shooters()) if (!s.reload) s.ammo = gunStat('mag'); }
    }
    if (A.autoBreakthrough) autoBreak();
    if (A.autoMerge && (mergeT += 1) >= 5) { mergeT = 0; mergeAll(); }
    if (A.autoEvac && G.runBest >= tun().medals.firstAt) {
      const gain = medalsNow();
      if (gain > 0 && gain >= Lg.medalCap(G.medalsLife, stats().doubling)) prestige();
    }
  }
  // 자동 돌파: when the next purchase of the bunker, the fence or a floor is its breakthrough and it can be paid, it is
  // bought and applied as the screen's purchase would (the new look baked), without moving the view or a menu
  const BREAKS = [['bunker', () => bunkerBreak(G.bunker) && bunkerCost(G.bunker)], ['fence', () => fenceBreak(G.fence) && fenceCost(G.fence)],
    ['live', () => facBreak('live', G.live) && LIVE.cost(G.live)], ['farm', () => facBreak('farm', G.farm) && FARM.cost(G.farm)], ['mine', () => facBreak('mine', G.mine) && MINE.cost(G.mine)]];
  function autoBreak() {
    for (const [id, cost] of BREAKS) {
      const c0 = cost(), c = c0 && capCost(c0);
      if (!c || !canPay(c)) continue;
      pay(c); G[id]++;
      if (id === 'bunker') { G.hp = bunkerHp(G.bunker); bakeYard(); resyncPosts(); palCache.clear(); fitStage(); }
      else if (id === 'fence') { G.fenceHp = fenceHp(G.fence); G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0]; composeYard(); }
      else markUnder(['live', 'farm', 'mine'].indexOf(id), true);
      notify('자동 돌파', { bunker: '벙커', fence: '울타리', live: '1층 침실', farm: '2층 식량', mine: '3층 채굴' }[id], 'good');
      sound('buy'); changed();
      return true;
    }
    return false;
  }
  function tick(dt) {
    if (!on) return;
    const real = dt / (G.speed || 1), t = tun();
    G.activity += real;
    if (G.activity >= 600) { const n = Math.floor(G.activity / 600); G.activity -= n * 600; G.gems += n * t.economy.activityGemsPer10Min; changed(); }
    secT += dt;
    if (secT >= 1) {
      goldRate += ((G.earned - goldMark) / secT - goldRate) * Math.min(1, secT / 60); goldMark = G.earned; secT = 0;
      daily(); automate();
      // the game changed what the numbers rest on (a hire, the bunker, a new record): count again
      const s = [G.bunker, G.record, G.live, jobCount('사수'), jobCount('농부'), jobCount('광부'), jobCount('정비공')].join();
      if (s !== sig) { sig = s; autoEquip(); changed(); }
    }
    updateTowers(dt);
  }

  /* ================= hooks for the game's own files ================= */
  const hook = {
    tick,
    drawYard() { if (on) for (const t of towers) drawTower(t); },
    shooter,
    goldMul: () => (on ? stats().gold : 1),
    taken: () => (on ? stats().taken : 1),
    repair: () => (on ? stats().repair : 1),
    upkeep: () => (on ? stats().upkeep * (1 - Math.min(.5, stats().upkeepCover * jobCount('농부') / Math.max(1, hired().length))) : 1),
    prod: res => (!on ? 1 : stats().prod * (res === 'food' ? stats().food : res === 'mineral' ? stats().ore : 1)),
    // a workshop worker makes parts (logic: 0.5 a second) and repairs 0.4% of the fence and bunker a second
    partsRate: n => (on ? n * tun().sections.perWorker.parts * stats().prod : 0),
    repairShare: n => (on ? n * tun().crew.repairPct * stats().repair : 0),
    bossLimit: s => (on ? bossLimit(s) : 0),
    bossName: s => (on ? (Lg.bossInfo(s) || {}).name : null),
    titan: s => s % 100 === 0,
    band: s => (on ? Lg.bandOf(s).zombies : null),
    bossPatterns: s => (on ? Lg.bossPatterns(s) : []),
    bossPhases: s => (on ? { phases: (Lg.bossInfo(s) || { phases: [1] }).phases, gap: tun().stage.phaseGap } : null),
    tRef: () => (on ? tun().stage.tRef : 45),
    skipTo, skipStep: () => (on ? tun().stage.skipStepTime : .06),
    skipped(last) { if (on && last > G.runBest) { G.runBest = last; changed(); } },
    // acid on a turret's mount: it stops for sec seconds (less with the gas mask relic or a repair card)
    downTower(slot, sec) { const t = towers.find(x => x.k === slot); if (t) t.down = Math.max(t.down || 0, sec * (1 - stats().turretResist)); },
    stunResist: () => (on ? stats().stunResist : 0),
    zombieName: k => (on && Lg.ZOMBIES[k] ? Lg.ZOMBIES[k].name : null),
    // every kill: XP, parts, and a relic every 2,000 kills
    killed(z, s) {
      if (!on) return;
      G.runKills++;
      addXp(Lg.killXp(s));
      G.comps = Math.min(partsCap(), G.comps + stats().partsPerKill);
      if (++G.counts.killsForRelic >= tun().relics.killsPerDrop) { G.counts.killsForRelic -= tun().relics.killsPerDrop; found(chest()); }
    },
    // a boss (or titan) down: XP, parts, the chance of a relic (a titan always), the bounty relic's gold
    bossKilled(s) {
      if (!on) return 0;
      const t = tun(), titan = s % 100 === 0;
      G.counts.bossKills++; if (titan) G.counts.titanKills++;
      addXp(Lg.bossXp(s) * (titan ? 3 : 1));
      G.comps = Math.min(partsCap(), G.comps + t.stage.bossParts * (titan ? 3 : 1));
      if (rng.chance((titan ? t.relics.titanDrop : t.relics.bossDrop) * (1 + stats().relicFind))) found(chest());
      keepRng(); changed();
      return goldRate * stats().bossIncomeSec;
    },
    // a stage cleared: XP; a new record pays its first-clear gems (and the season tracks) and opens what it opens
    cleared(s) {
      if (!on) return;
      addXp(Lg.clearXp(s));
      if (s > G.record) {
        const was = G.record, gems = firstGems(s), season = G.shop.seasonUntil > now();
        G.record = s; G.gems += gems;
        if (season) for (let k = Math.floor(s / Lg.PASSES.season.chestEvery) - Math.floor(was / Lg.PASSES.season.chestEvery); k > 0; k--) found(chest());
        storyCards(s);
        if (gems) notify('첫 클리어', '보석 +' + num(gems), 'good');
      }
      // a stage played again changes nothing the screens show
      if (s > G.runBest || s === G.record) { G.runBest = Math.max(G.runBest, s); autoEquip(); changed(); }
    },
    // a breach while starving: the forced evacuation (half the medals; before stage 50 only one stage back)
    starved() { return on ? evacuate(true) : null; },
    // ore turned into gems by the vein map relic (a daily cap)
    ore(amount) {
      if (!on || !stats().gemsPerOre || !(amount > 0)) return;
      const d = today();
      if (G.oreGems.day !== d) G.oreGems = { day: d, n: 0 };
      const g = Math.min(stats().gemsPerOre * amount, tun().relics.oreGemsPerDay - G.oreGems.n);
      if (g > 0) { G.gems += g; G.oreGems.n += g; }
    },
    // what does not fit in a store: commander XP at 10:1, or gold with the alchemy furnace
    spill(amount) {
      if (!on || !(amount > 0)) return;
      if (stats().alchemy) { const gold = amount / tun().sections.overflowToXp * stats().alchemy * Math.max(1, goldRate); G.money += gold; G.earned += gold; }
      else addXp(amount / tun().sections.overflowToXp);
    },
    offlineH: () => (on ? stats().offlineH + (G.shop.monthlyUntil > now() ? Lg.PASSES.monthly.offlineH : 0) + (G.shop.owned.offline12 ? 12 : 0) : 0),
    offlineEff: () => (on ? 1 + stats().offlineEff : 1),
    offlineUpkeep: () => !(on && stats().offlineNoUpkeep),
  };
  // a relic found in play
  function found(r) { if (r && r.result !== 'shard') notify(r.result === 'new' ? '새 유물' : '유물', Lg.RELICS[r.id].name, 'new'); autoEquip(); changed(); }

  /* ================= start ================= */
  function attach() {
    Lg = window.LOGIC || null; on = !!Lg; api.ok = on;
    if (on) { ROLES = Object.fromEntries(Lg.TURRET_ROLES.map(r => [r.key, r])); FAMS = Object.fromEntries(Lg.FAMILIES.map(f => [f.key, f])); }
    return on;
  }
  function start() {
    if (on) {
      autoEquip();
      if (G.shop.owned.x2Default) setSpeed(2);
      goldMark = G.earned;
      sig = '';
      daily();
    }
    api.ready = true;
    changed();
    dispatchEvent(new Event('sys-ready'));
  }
  const guard = (f, empty) => (...a) => (on ? f(...a) : typeof empty === 'function' ? empty() : empty);
  const api = {
    ok: false, ready: false, raidsAvailable: false, payment,
    attach, ensure, start, hook,
    weapons: guard(() => gear('weapon'), () => []), turrets: guard(() => gear('turret'), () => []), relics: guard(relics, () => []), relicSets: guard(relicSets, () => []),
    cards: guard(cards, () => []), codex: guard(codex, null), summonInfo, summon, mergeAll, mergeable, enhance, enhancePrice,
    equipWeapon, equipTurret, equipRelic, equipBest: guard(equipBest, false),
    slots: guard(() => ({ turrets: turretOpen(), turretsMax: SLOTS_T, relics: relicOpen(), relicsMax: SLOTS_R, turretAt: MOUNT_AT.slice(), relicAt: tun().relics.slotsAt.slice() }), null),
    weaponOf: guard(id => { const pr = personOf(id); return pr && G.equipW[pr.key] != null ? G.equipW[pr.key] : -1; }, -1),
    workers, buyWorker, commander, prestigeInfo, prestige, buyMedalUp, setAutomation, setAuto: setAutomation, setAutoShare, presets, savePreset, loadPreset,
    stageInfo, stageNow, shopCatalog: catalog, buy, records, currencies, power, stats: guard(() => stats(), null),
    // the turrets standing on the mounts right now (the bunker's picture must have the mounts: bunker level 25+)
    towers: () => towers.map(t => ({ slot: t.k, i: t.i, name: Lg.TURRETS[t.i].name, role: t.role, x: t.x, y: t.y, z: t.z, yaw: t.yaw, shots: t.shots, dps: turretDps(t.i), down: Math.max(0, t.down || 0) })),
    changed,
  };
  return api;
})();
