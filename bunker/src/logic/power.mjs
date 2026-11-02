// ONE function from game state to final stats. Everything that multiplies damage, gold, production, upkeep,
// defense and the stores is gathered here, so the game only recomputes when something changed (doc 17).
import { T } from './tuning.mjs';
import { workshopValue, uptime, shooterSlots, turretSlots, bunkerHp, fenceHp, sectionMul, roofMul, roofCrit, roofMagPct,
  kitchenUpkeep, roomsOfflineH, labSpeed, storeCap } from './curves.mjs';
import { statMuls } from './player.mjs';
import { medalMuls, researchMuls } from './medals.mjs';
import { FAMILIES, WEAPONS, TURRETS, TURRET_ROLES, weaponEquipMul, turretMul, ownedBonus, codexBonus } from './gear.mjs';
import { relicMods } from './relics.mjs';
import { CARD, ROLE_SECTION, ability, levelMul, upkeepTotal } from './crew.mjs';

const ROLE = Object.fromEntries(TURRET_ROLES.map(r => [r.key, r]));
const EL = { burn: 'fire', slow: 'ice', chain: 'shock' };

export function computeStats(st) {
  const cm = statMuls(st.record >= T.player.unlockStage ? st.cmd.points : {});
  const md = medalMuls(st.medalUp), rs = researchMuls(st.research.lv), crew = st.crew, A = crew.assign;
  // crew abilities: a card in its own section, the leader +10%
  const ab = {};
  for (const [sec, ids] of Object.entries(A)) for (const id of ids) {
    if (ROLE_SECTION[CARD[id].role] !== sec) continue;
    const f = id === crew.leader ? 1 + T.crew.leaderPct : 1;
    for (const [k, v] of Object.entries(ability(id, crew))) ab[k] = (ab[k] || 0) + v * f;
  }
  const g = k => ab[k] || 0;
  const roof = A.roof.slice(0, shooterSlots(st.bunker)), wIdx = st.equipW.slice(0, roof.length);
  const tIdx = st.equipT.slice(0, turretSlots(st.bunker)).filter(i => i >= 0);
  const elements = [];
  for (const w of wIdx) if (w >= 0) for (const k of Object.keys(WEAPONS[w].tags)) if (EL[k]) elements.push(EL[k]);
  for (const i of tIdx) if (TURRETS[i].element) elements.push(TURRETS[i].element === 'frost' ? 'ice' : TURRETS[i].element);
  const snipers = wIdx.filter(w => w >= 0 && w % 5 === 3).length;
  const rm = relicMods(st.relics, { bossKills: st.counts.bossKills, titanKills: st.counts.titanKills, shooters: roof.length, pierce: snipers, crit: 1 }, elements);
  const r = k => rm[k] || 0;

  /* ---- the gun: workshop lines, the 12 shots/s limit, magazine and reload ---- */
  const atk = workshopValue('atk', st.ws.atk);
  const mag = workshopValue('mag', st.ws.mag) * (1 + roofMagPct(st.sec.roof.cap));
  const reload = workshopValue('reload', st.ws.reload) * (rm.reloadMul ?? 1);
  const fire = rateRaw => { const shots = Math.min(rateRaw, T.workshop.maxShots); return shots * (rateRaw / shots) * (rm.noReload ? 1 : uptime(shots, mag, reload)); };
  const rate0 = workshopValue('rate', st.ws.rate) * cm.rate * (1 + g('ratePct')) * (rm.rateMul ?? 1);
  const baseFire = fire(rate0);
  const critC = 0.05 + roofCrit(st.sec.roof.lv) + r('critChance') + g('critChance'), critD = 1.5 + cm.critDmg + r('critDmg');

  /* ---- shooters: hero first, then crew gunners; each holds its own weapon ---- */
  let gun = 0, crowdW = 0, pierceW = 0, eqSum = 0, lvlSum = 0, aoeW = 0;
  roof.forEach((id, j) => {
    const w = wIdx[j] ?? -1, fam = w >= 0 ? FAMILIES[w % 5] : {};
    const eq = w >= 0 ? weaponEquipMul(w, st.weapons.enh[w]) : 0.5;
    const lvl = id === 'me' ? 1 : levelMul(crew.cards[id].level) * cm.crew * md.crew * (id === crew.leader ? 1 + T.crew.leaderPct : 1);
    const cc = Math.min(0.8, critC + (fam.crit || 0)), cd = critD + (fam.critDmg || 0);
    const d = atk * eq * lvl * (fam.key === 'sniper' ? 1 + g('sniperPct') : 1) * fire(rate0 * (1 + (fam.rate || 0))) * (1 + cc * (cd - 1));
    const tags = w >= 0 ? WEAPONS[w].tags : {};
    gun += d; eqSum += eq; lvlSum += lvl;
    crowdW += d * (1 + (fam.crowd || 0) + (tags.crowd || 0) + (tags.chain ? 0.3 : 0));
    pierceW += fam.pierce ? d : 0;
    aoeW += fam.crowd || tags.chain ? d : 0;
  });
  const ownedW = ownedBonus(st.weapons), codexW = codexBonus(st.weapons, 5), ownedT = ownedBonus(st.turrets, T.gear.ownedGrow, T.gear.ownedBase * 0.5), codexT = codexBonus(st.turrets, 4);
  const team = 1 + r('dmgPct') + g('dmgPct') + g('roofPct');
  const glob = cm.dmg * md.dmg * rs.dmg * (1 + ownedW) * (1 + codexW) * team * (rm.dmgMul ?? 1);
  const roofM = roofMul(st.sec.roof.lv, st.sec.roof.tier);
  const dpsGunners = gun * glob * roofM;
  const crowdG = gun > 0 ? crowdW / gun : 1;

  /* ---- turrets: fire like the base gun, scaled by role, step and enhancement ---- */
  const tGlob = cm.dmg * md.dmg * rs.dmg * cm.crew * md.crew * rs.turret * (1 + g('turretPct')) * (1 + ownedT) * (1 + codexT) * (rm.dmgMul ?? 1);
  let tBoss = 0, tCrowd = 0, tAoe = 0, burnT = 0, slowT = 0;
  for (const i of tIdx) {
    const role = ROLE[TURRETS[i].role], d = baseFire * atk * role.coef * turretMul(i, st.turrets.enh[i]) * tGlob;
    tBoss += d * role.boss; tCrowd += d * role.crowd;
    if (role.key === 'blast' || role.key === 'tesla') tAoe += d;
    if (TURRETS[i].element === 'fire') burnT = 0.5;
    if (TURRETS[i].element === 'frost') slowT = 0.15;
  }
  const dpsTurrets = tBoss * (1 + r('turretBossPct'));
  const total = dpsGunners + dpsTurrets;
  const burnW = wIdx.some(w => w >= 0 && WEAPONS[w].tags.burn) ? 0.4 : 0, slowW = Math.max(0, ...wIdx.map(w => (w >= 0 && WEAPONS[w].tags.slow) || 0));
  const bossMul = 1 + r('bossDmgPct') + g('bossPct');
  const dpsCrowd = dpsGunners * crowdG * (1 + r('crowdPct') + g('crowdPct')) + tCrowd;

  /* ---- defense and repair ---- */
  const fenceMax = fenceHp(st.fence), bunkerMax = bunkerHp(st.bunker) * (1 + r('breachShield'));
  const repairmen = A.shop.filter(id => CARD[id].role === 'repair').length;
  const repairShare = 0.001 + repairmen * T.crew.repairPct * (1 + g('repair')) * (1 + r('repairPct'));
  const repairPerSec = repairShare * (fenceMax + bunkerMax);

  /* ---- production, upkeep, stores ---- */
  const prodAll = cm.prod * md.prod * rs.prod * (1 + g('prodAll'));
  const out = (sec, res, own) => A[sec].reduce((a, id) => a + T.sections.perWorker[res] * levelMul(crew.cards[id].level) * (CARD[id].role === own ? 1 + g(res) : 1), 0)
    * sectionMul(st.sec[sec].lv, st.sec[sec].tier) * prodAll;
  const food = out('food', 'food', 'farmer') * (1 + g('foodAll')), ore = out('mine', 'ore', 'miner') * (1 + g('oreAll'));
  const parts = out('shop', 'parts', 'mechanic') + ore * g('oreToParts');
  const farmers = A.food.length, crewN = A.roof.length - 1 + farmers + A.mine.length + A.shop.length + A.lab.length;
  let upkeep = upkeepTotal(crew) * kitchenUpkeep(st.sec.bed.lv) * (1 - Math.min(0.6, g('upkeepAll'))) * (rm.upkeepMul ?? 1);
  if (r('upkeepCover') && crewN) upkeep *= 1 - Math.min(0.5, r('upkeepCover') * farmers / crewN);
  const caps = { food: storeCap(food, st.sec.food.cap), ore: storeCap(ore, st.sec.mine.cap), parts: storeCap(parts, st.sec.shop.cap) };
  const researchers = A.lab.length, labOpen = st.record >= 1000;
  const researchSpeed = labOpen ? labSpeed(st.sec.lab.lv, st.sec.lab.tier) * (researchers ? 1 + 0.5 * (researchers - 1) : 0.5) * (1 + g('researchSpeed')) : 0;

  return {
    dpsGunners, dpsTurrets, dpsCrowd, bossMul, dps: total * bossMul, skipPower: Math.min(dpsCrowd, total * bossMul),
    pierceShare: Math.min(1, (gun ? pierceW / gun : 0) + r('pierceShare') + g('pierceShare')),
    burnUptime: Math.min(1, r('burnUptime') + burnW + burnT), slow: Math.min(0.6, r('slow') + slowW + slowT),
    aoeCover: Math.min(1, (total ? (aoeW * glob * roofM + tAoe) / (total + 1e-300) * 0.6 : 0) + r('aoeCover') + g('aoeCover')),
    turretResist: Math.min(1, r('turretResist') + g('turretResist')), stunResist: Math.min(1, r('stunResist')),
    bossTimeBonus: r('bossTimeBonus') + (rm.bossTimeSet ? rm.bossTimeSet - T.stage.bossTime : 0),
    skipMult: rm.skipMult || null, dmgTakenMul: rm.dmgTakenMul ?? 1,
    fenceMax, bunkerMax, repairPerSec, repairShare, repairPartsMul: g('freeRepair') ? 0 : rm.repairPartsMul ?? 1, repairOre: r('repairOre'),
    goldMul: cm.gold * md.gold, xpMul: md.xp, bossIncomeSec: r('bossIncomeSec'), bossClock: r('bossClock'),
    partsPerKill: T.stage.killParts + r('partsPerKill'), gemsPerOre: r('gemsPerOre'), alchemy: r('alchemy'), relicFind: g('relicFind'),
    prod: { food, ore, parts }, upkeep, caps, lock: T.crew.lock - Math.min(0.1, r('lockCut')), lowFoodUpkeepCut: r('lowFoodUpkeepCut'),
    offlineH: T.economy.offlineBaseH + md.offlineH + roomsOfflineH(st.sec.bed.cap), offlineEff: Math.min(T.economy.offlineMaxEff, T.economy.offlineBaseEff + md.offlineEff + r('offlineEff')),
    offlineNoUpkeep: !!rm.offlineNoUpkeep, researchSpeed, activeResearch: r('activeResearch'), researchCarry: r('researchCarry'),
    bossResearchMin: r('bossResearchMin'), autoResearch: r('autoResearch') || (g('autoResearch') ? 0.3 : 0),
    doubling: rs.doubling + r('doublingAdd'), medalH: r('medalH'), medalPerEvac: r('medalPerEvac'), btMul: rm.btMul ?? 1,
    mergeCut: Math.min(0.5, g('mergeCut')), reactions: rm.reactions,
    // the stack table: what each axis multiplies (approximate, multiplicative)
    axes: {
      workshop: atk / T.workshop.atk.base,
      rateUptime: baseFire / fire0(),
      weapon: (roof.length ? eqSum / roof.length : 1) * (1 + ownedW) * (1 + codexW),
      shooters: roof.length + tIdx.length,
      crew: roof.length ? lvlSum / roof.length / (cm.crew * md.crew) * (1 + g('dmgPct') + g('roofPct')) : 1,
      roof: roofM, commander: cm.dmg * cm.crew, medals: md.dmg * md.crew, relics: (1 + r('dmgPct')) * (rm.dmgMul ?? 1), research: rs.dmg,
      turretShare: total ? dpsTurrets / total : 0,
    },
  };
}
// the base gun at workshop level 0 (for the rate x uptime axis)
function fire0() { const w = T.workshop; return w.rate.base * uptime(w.rate.base, w.mag.base, w.reload.base); }
