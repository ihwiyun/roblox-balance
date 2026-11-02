// Every number that shapes the economy, in one place. The modules read T at call time, so a test or the
// simulation can try a value with setTuning({ gear: { mergeN: 5 } }) and put it back with resetTuning().
// Values marked "doc" come from docs/기획서.md; the rest were set by tests/sim (see tests/sim/report.md).
const DEFAULTS = {
  stage: {
    e: 0.035,                // early term of H(s); doc draft 0.012, raised so stage 60 takes 2-3 h of real play
    cap: 30000,              // doc: stages stop near 30,000
    spawnEvery: 1.0,         // s between zombies: a stage of 30-60 kills lasts 30-60 s at full pace
    walk: 8,                 // s from the island edge to the fence
    hitEvery: 1.2,           // s between blows of a zombie at the fence
    tRef: 45,                // s: the pace "requirement" (auto-skip, payer checks) is measured at
    normalLimit: 180,        // s: a normal stage that drags past this is overrun
    bossHp: 400, bossTime: 45,                       // doc
    titanHp: 1000, titanTime: 75, titanPhases: [0.35, 0.35, 0.30], phaseGap: 2, // doc: 1,000x, 3 phases
    bossGold: 30, titanGold: 100,                     // kill-gold multiples
    bossParts: 20, killParts: 0.1,                    // doc
    skipMult: 10, skipMultAuto: 5, skipMax: 50, skipStepTime: 1.5, // doc: 10x (5x after 12 evacuations), 50 stages
    eliteHp: 0.5, eliteGold: 0.5,                     // 101+: elites carry +50% hp and gold
    extraPatternStrength: 0.5, maxExtraPatterns: 3,
  },
  workshop: {                // reset on evacuation; value(L) and the price of L -> L+1
    atk: { base: 10, grow: 1.10, cost0: 6, costGrow: 1.118 },
    rate: { base: 2, step: 0.04, cost0: 12, costGrow: 1.17 },     // shots/s = base(1 + step L)
    mag: { base: 8, step: 1, cost0: 10, costGrow: 1.16 },
    reload: { base: 1.6, grow: 0.965, min: 0.2, cost0: 10, costGrow: 1.16 },
    maxShots: 12,            // doc: real fire stops at 12 shots/s, the rest becomes damage
  },
  base: {                    // bunker and fence: no level cap, a breakthrough every 10 levels
    bunkerHp: 300, bunkerHpGrow: 1.12, bunkerCost0: 40, bunkerCostGrow: 1.135,
    fenceHp: 240, fenceHpGrow: 1.12, fenceCost0: 30, fenceCostGrow: 1.135,
    roofSlotsAt: [1, 11, 31, 61, 91], roofSlotsBase: 1,     // doc: hero + 1 -> hero + 5 (2 -> 6 shooters)
    turretSlotsAt: [25, 50, 100, 200, 400, 700],            // doc
    btEvery: 10, btPow: 1.6,
    breakthroughStoreShare: 0.8,                            // doc: never above 80% of the store
  },
  sections: {
    levelGrow: 1.13, levelPct: 0.04, tierPct: 0.10, roofTierPct: 0.20, tierCost: 200, // doc: +4%/level, 200 T^2
    capPct: 0.15, capCostGold0: 150, capCostGoldGrow: 1.22, capCostAux: 90, capCostPow: 1.5, // doc: 1 h x (1 + 0.15 C)
    minStore: 600,
    perWorker: { food: 2, ore: 1.5, parts: 1 },             // doc, per second
    overflowToXp: 10,                                       // doc: 10:1
  },
  crew: {
    levelCost0: 100, levelGrow: 1.12,                       // doc
    btFood: 60, btParts: 15,                                // doc: 60 k^2 food, 15 k^2 parts
    gunnerPerLevel: 0.04, starPct: 0.20,                    // doc
    upkeep0: 0.3, upkeepPerLevel: 0.1, lock: 1.15,          // doc
    leaderPct: 0.10, starDupes: [1, 2, 3, 4],
    repairPct: 0.004,                                       // doc: 0.4% of max hp per second per repairman
  },
  player: { xpBase: 60, xpPow: 1.5, pointsPerLevel: 3, unlockStage: 10 }, // doc
  medals: {
    pow: 0.55, base: 10, firstAt: 50, floor: 25, doubling: 2, // doc
    starveShare: 0.5,
  },
  gear: {
    mergeN: 4,                                              // doc: 4 copies -> next (4 vs 5 tested in the sim)
    stepMul: 1.16,                                          // equip multiplier per ladder step
    ownedBase: 0.012, ownedGrow: 1.16,                      // owned effect of weapon i: ownedBase * ownedGrow^i
    enhEquip: 0.05, enhOwned: 0.05,                         // per enhance level
    enhCapByGrade: [20, 40, 60, 80, 100, 120, 140, 160],    // doc
    codexPer: 0.01, codexGradeSet: 0.10,                    // doc: +1% each, a grade set adds more
    pullCost: 50, pity: [[3, 50], [4, 150], [5, 500]],     // doc: hero+ in 50, legend+ in 150, immortal+ in 500
    summonXpPerPull: 1, summonLevelPulls: 22,               // level L needs 22 (L-1)^2 pulls in total
    turretStepMul: 1.18, turretPullCost: 50,
  },
  relics: { chestCost: 300, killsPerDrop: 2000, bossDrop: 0.05, titanDrop: 1, maxLevel: 10,
    slotsAt: [20, 50, 100, 200, 400, 700, 1000, 2000] },   // doc
  economy: {
    offlineBaseH: 2, offlineBaseEff: 0.25, offlineMaxH: 12, offlineMaxEff: 0.75, // doc
    activityGemsPer10Min: 110, dailyGems: 300, bossFirstGems: 50, titanFirstGems: 500, // doc + activity rate
    evacGems0: 40, evacGemsPerStage: 0.05,
    adBoostMin: 30, adBoostsPerDay: 6, adSeconds: 30,
    raidsPerDay: 5, raidFoodMinutes: 12,
  },
};

const clone = o => JSON.parse(JSON.stringify(o));
export const T = clone(DEFAULTS);

function merge(dst, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') merge(dst[k], v);
    else dst[k] = v;
  }
}
export function setTuning(patch) { merge(T, patch); return T; }
export function resetTuning() { for (const k of Object.keys(T)) delete T[k]; Object.assign(T, clone(DEFAULTS)); return T; }
export const defaultTuning = () => clone(DEFAULTS);
