// What happens in a run, for designing the unlock beats: an event log, weekly snapshots, weekly flows by source and
// sink, the weekly power breakdown and what the bot was waiting for. sim.mjs calls these hooks when run({ log: true }).
import * as L from '../../src/logic/index.mjs';
const { T } = L;
const DAY = 86400, WEEK = 7 * DAY;
const r2 = x => +(+x).toPrecision(3);

export function makeLogger(st, relicAxis) {
  const wk = () => Math.floor(st.t / WEEK);                 // 0 = week 1
  const events = [], flows = [], bts = [], states = [], blocks = [], weekly = [], peak = [], purchases = [], pulls = [], byStage = {};
  const evt = (event, extra = {}) => events.push({ day: +(st.t / DAY).toFixed(2), hour: +(st.active / 3600).toFixed(2), stage: st.record, event, ...extra });
  const bump = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };
  const fw = () => (flows[wk()] ||= { earned: {}, spent: {} });
  const seen = { grades: new Set(), sets: new Set(), full: new Set(), relicSlots: 0, shooters: 0, turretSlots: 0, firstTurret: false, firstRelic: false,
    cmd: false, mine: false, shop: false, lab: false, boss: false, titan: false, research: false, sum: { weapon: 1, turret: 1, relic: 1, recruit: 1 } };
  const SUMS = { weapon: 'wSum', turret: 'tSum', relic: 'rSum', recruit: 'cSum' };
  const AUTO = Object.fromEntries(L.AUTOMATION.map(a => [a.evacs, a.name]));

  // the power breakdown at a new record: the top of a run (the workshop resets at every prestige, so a fixed clock
  // time would catch runs at random points of their cycle)
  function powerNow() {
    const a = L.stats(st).axes;
    const power = { workshop: a.workshop, rateUptime: a.rateUptime, weaponEquip: a.weaponEquip, weaponOwned: a.weaponOwned, weaponCodex: a.weaponCodex,
      shooters: a.shooters - L.turretSlots(st.bunker) || 1, turrets: a.turrets, roof: a.roof, crew: a.crew, commander: a.commander, medals: a.medals, relics: relicAxis(), research: a.research };
    const logs = Object.fromEntries(Object.entries(power).map(([k, v]) => [k, Math.log10(Math.max(1, v))]));
    const tot = Object.values(logs).reduce((x, y) => x + y, 0) || 1;
    return { atStage: st.record, power: Object.fromEntries(Object.entries(power).map(([k, v]) => [k, { mul: r2(v), share: +(logs[k] / tot).toFixed(3) }])), logPower: +tot.toFixed(1) };
  }
  function onRecord(s) {
    peak[wk()] = powerNow();
    const b = Math.floor(s / 50) * 50;                      // the breakdown when the record first passes each 50
    if (b > 0 && !byStage[b]) byStage[b] = { ...peak[wk()], day: +(st.t / DAY).toFixed(1) };
    if (!seen.boss && s >= 10) { seen.boss = true; evt('첫 보스 처치 (스테이지 10)'); }
    if (!seen.titan && s >= 100) { seen.titan = true; evt('첫 타이탄 처치 (스테이지 100)'); }
    if (!seen.cmd && s >= T.player.unlockStage) { seen.cmd = true; evt('지휘관 레벨 열림'); }
    if (!seen.mine && s + 1 >= L.SECTIONS.mine.unlock) { seen.mine = true; evt('3층 채굴 열림'); }
    if (!seen.shop && s + 1 >= L.SECTIONS.shop.unlock) { seen.shop = true; evt('작업장 열림'); }
    if (!seen.lab && s >= L.SECTIONS.lab.unlockRecord) { seen.lab = true; evt('4층 연구소 열림'); }
    const n = L.relicSlots(s);
    while (seen.relicSlots < n) evt(`유물 칸 ${++seen.relicSlots}`);
  }
  function onRelic(r) {
    if (!seen.firstRelic) { seen.firstRelic = true; evt('첫 유물', { relic: L.RELICS[r.id].name }); }
    for (const set of L.SETS) if (!seen.sets.has(set.key) && set.ids.every(id => st.relics.level[id] > 0)) { seen.sets.add(set.key); evt(`유물 세트 완성: ${set.name}`); }
  }
  return {
    events, flows, bts, states, blocks, weekly, purchases, pulls, byStage, event: evt,
    buy(product, krw) { bump(purchases[wk()] ||= {}, product, krw); },
    // a batch of summons: how many, paid with what, and what came out (grades for gear, results for relics and crew)
    pull(kind, out, gems, diamonds) {
      const w = (pulls[wk()] ||= {}), k = (w[kind] ||= { n: 0, gems: 0, diamonds: 0, got: {} });
      k.n += out.length; k.gems += gems; k.diamonds += diamonds;
      for (const o of out) {
        const tag = kind.startsWith('weapon') ? L.GRADES[L.WEAPONS[o].grade].name : kind === 'turret' ? L.GRADES[L.TURRETS[o].grade].name
          : kind === 'relic' ? { new: '새 유물', level: '레벨 업', dupe: '중복', shard: '조각' }[o.result] : { new: '새 동료', star: '별 업', dupe: '중복', max: '최대' }[o.result];
        bump(k.got, tag);
      }
    },
    onEvent(type, data) {
      if (type === 'earn') { const f = fw(); bump(f.earned[data.res] ||= {}, data.src, data.amount); }
      else if (type === 'spend') { const f = fw(), sink = data.sink || 'other'; for (const [k, v] of Object.entries(data)) if (typeof v === 'number' && v > 0) bump(f.spent[k] ||= {}, sink, v); }
      else if (type === 'record') onRecord(data);
      else if (type === 'relic') onRelic(data);
      else if (type === 'evac') { evt(`환생 ${st.evacs}회`, { medals: data, lifetime: st.medalsLife }); if (AUTO[st.evacs]) evt(`자동화 열림: ${AUTO[st.evacs]}`); }
      else if (type === 'research') evt(`연구 완료: ${L.RESEARCH[data].name} ${st.research.lv[data]}`);
    },
    // things that change outside economy events: slots, gear grades, summon levels, research start, full stores
    onCheck(S) {
      const sh = L.shooterSlots(st.bunker), ts = L.turretSlots(st.bunker);
      while (seen.shooters < sh) evt(`지붕 사수 칸 ${++seen.shooters}`, { bunker: st.bunker });
      while (seen.turretSlots < ts) evt(`터렛 칸 ${++seen.turretSlots}`, { bunker: st.bunker });
      if (!seen.firstTurret && st.equipT.some(i => i >= 0)) { seen.firstTurret = true; evt('첫 터렛 장착', { turret: L.TURRETS[st.equipT.find(i => i >= 0)].name }); }
      for (let i = 0; i < st.weapons.owned.length; i++) if (st.weapons.owned[i]) {
        const g = L.WEAPONS[i].grade;
        if (!seen.grades.has(g)) { seen.grades.add(g); evt(`첫 ${L.GRADES[g].name} 무기`, { weapon: L.WEAPONS[i].name, step: i }); }
      }
      for (const [k, f] of Object.entries(SUMS)) while (seen.sum[k] < st[f].level) evt(`소환 레벨 ${k} ${++seen.sum[k]}`, { pulls: st[f].pulls });
      if (!seen.research && st.research.active.length) { seen.research = true; evt('첫 연구 시작', { key: st.research.active[0].key }); }
      for (const r of ['food', 'ore', 'parts']) if (!seen.full.has(r) && st[r] >= 0.98 * S.caps[r]) { seen.full.add(r); evt(`창고 처음 가득: ${r}`); }
    },
    onBreakthrough(key) { const [a, b] = key.split(':'); bump(bts[wk()] ||= {}, a === 'sec' ? `sec:${b}` : a); },
    // dt seconds of play: the progress state and what blocked purchases
    onTime(dt, state, blockers) { bump(states[wk()] ||= {}, state, dt); const b = blocks[wk()] ||= {}; for (const k of blockers) bump(b, k, dt); bump(b, '_total', dt); },
    snapshotWeek(week) {
      const S = L.stats(st);
      const owned = inv => inv.owned.reduce((n, o) => n + (o ? 1 : 0), 0);
      const best = (inv, mul) => { let bi = -1; for (let i = 0; i < inv.owned.length; i++) if (inv.owned[i] && (bi < 0 || mul(i, inv.enh[i]) > mul(bi, inv.enh[bi]))) bi = i; return bi; };
      const bw = best(st.weapons, L.weaponEquipMul), bt = best(st.turrets, L.turretMul);
      const pk = peak[week - 1] || powerNow();
      weekly.push({
        week, day: +(st.t / DAY).toFixed(1), activeH: +(st.active / 3600).toFixed(1), record: st.record, prestiges: st.evacs, medalsLifetime: r2(st.medalsLife), medalsHeld: r2(st.medals),
        commander: st.cmd.level, workshop: { ...st.ws }, bunker: st.bunker, fence: st.fence,
        sections: Object.fromEntries(L.SECTION_KEYS.map(k => [k, { level: st.sec[k].lv, tier: st.sec[k].tier, cap: st.sec[k].cap }])),
        workers: Object.fromEntries(Object.entries(st.crew.assign).map(([k, v]) => [k, v.length])), crewCards: Object.keys(st.crew.cards).length,
        summonLevel: Object.fromEntries(Object.entries(SUMS).map(([k, f]) => [k, { level: st[f].level, pulls: st[f].pulls }])),
        bestWeapon: bw >= 0 ? { step: bw, name: L.WEAPONS[bw].name, grade: L.GRADES[L.WEAPONS[bw].grade].name, enhance: st.weapons.enh[bw] } : null,
        weaponsOwned: owned(st.weapons),
        turrets: { owned: owned(st.turrets), equipped: st.equipT.filter(i => i >= 0).length, best: bt >= 0 ? { step: bt, name: L.TURRETS[bt].name, enhance: st.turrets.enh[bt] } : null },
        relics: { slots: L.relicSlots(st.record), owned: st.relics.level.filter(l => l > 0).length, equipped: st.relics.equipped.map(id => ({ name: L.RELICS[id].name, level: st.relics.level[id] })) },
        research: { ...st.research.lv },
        stock: { gold: r2(st.gold), food: r2(st.food), ore: r2(st.ore), parts: r2(st.parts), gems: Math.round(st.gems), medals: r2(st.medals) },
        caps: { food: r2(S.caps.food), ore: r2(S.caps.ore), parts: r2(S.caps.parts) },
        power: pk.power, logPower: pk.logPower, powerAtStage: pk.atStage,
      });
    },
  };
}
