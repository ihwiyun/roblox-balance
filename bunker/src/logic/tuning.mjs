// Every number that shapes the economy, in one place. The modules read T at call time, so a test or the
// simulation can try a value with setTuning({ gear: { mergeN: 5 } }) and put it back with resetTuning().
// Values marked "doc" come from docs/기획서.md; the rest were set by tests/sim (see tests/sim/report.md).
const DEFAULTS = {
  stage: {
    e: 0.035,                // early term of H(s); doc draft 0.012, raised so stage 60 takes 2-3 h of real play
    cap: 30000,              // doc: stages stop near 30,000
    spawnEvery: 0.9,         // s between zombies: 30-60 kills (doc) clear in 27-54 s at full pace, 30-60 s with the gap (was 1.0: 62 s)
    walk: 8,                 // s from the island edge to the fence
    hitEvery: 1.2,           // s between blows of a zombie at the fence
    tRef: 45,                // s: the pace "requirement" (auto-skip, payer checks) is measured at
    normalLimit: 180,        // s: a normal stage that drags past this is overrun
    bossHp: 400, bossTime: 45,                       // doc
    titanHp: 1000, titanTime: 75, titanPhases: [0.35, 0.35, 0.30], phaseGap: 2, // doc: 1,000x, 3 phases
    bossGold: 30, titanGold: 100,                     // kill-gold multiples
    bossParts: 20, killParts: 0.1,                    // doc
    skipMult: 10, skipMultAuto: 5, skipMax: 50, skipStepTime: 0.06, // doc: 10x (5x after 12 evacuations), 50 stages; a 50-stage jump plays in 3 s
    eliteHp: 0.5, eliteGold: 0.5,                     // 101+: elites carry +50% hp and gold
    extraPatternStrength: 0.5, maxExtraPatterns: 3,
  },
  workshop: {                // reset on evacuation; value(L) and the price of L -> L+1
    // atk: x1.10 a level for x1.175 the price (was x1.118: the workshop alone kept pace with H(s) and reached 3e24 by
    // stage 1,000 against the doc's 5e16, so no run ever stalled and the first evacuation came at stage 699)
    atk: { base: 10, grow: 1.10, cost0: 6, costGrow: 1.175 },
    rate: { base: 2, step: 0.04, cost0: 12, costGrow: 1.2 },      // shots/s = base(1 + step L)
    mag: { base: 8, step: 1, cost0: 10, costGrow: 1.19 },
    reload: { base: 1.6, grow: 0.965, min: 0.2, cost0: 10, costGrow: 1.19 },
    maxShots: 12,            // doc: real fire stops at 12 shots/s, the rest becomes damage
  },
  base: {                    // bunker, fence and sections: no level cap, a breakthrough every 50 levels (client)
    bunkerHp: 300, bunkerHpGrow: 1.12, bunkerCost0: 40, bunkerCostGrow: 1.135,
    fenceHp: 240, fenceHpGrow: 1.12, fenceCost0: 30, fenceCostGrow: 1.135,
    roofSlotsAt: [1, 11, 31, 61, 91], roofSlotsBase: 1,     // doc: hero + 1 -> hero + 5 (2 -> 6 shooters)
    turretSlotsAt: [25, 50, 100, 200, 400, 700],            // doc
    turretPerLevel: 0.04,                                   // turret damage x(1 + 0.04 x bunker level), like a gunner's crew level
    btEvery: 50, btPow: 1.6, eraEvery: 25,
    breakthroughStoreShare: 0.8,                            // doc: never above 80% of the store
    // materials of the breakthrough at level L (k = L/50) are coef * k^btPow. The coefficients carry the five
    // 10-level breakthroughs the 50-level cadence merged (5 * 5^1.6 ~ 65x the old per-step numbers); doc 8 also
    // asks for gold ("재료와 금화"): btGold times the price of the next level
    bt: { bunker: { food: 5000, ore: 3000 }, fence: { ore: 5000, parts: 2000 }, section: { aux: 4000, parts: 1000 } },
    btGold: 3,
  },
  sections: {
    // tier t costs tierCost * t^2 * tierGrow^(t-1) aux (doc: 200 T^2). The doc's square alone fell behind production,
    // which itself grows with every tier, so tiers ran into the hundreds; the growth factor keeps them a real sink
    // levelGrow: a floor level's gold price grows x1.25 (was 1.13: levels ran past 450 and multiplied output ~20x)
    levelGrow: 1.25, levelPct: 0.04, tierPct: 0.10, roofTierPct: 0.20, tierCost: 200, tierGrow: 1.25, // doc: +4%/level
    // capacity is the idle-efficiency track (doc 4): its gold price grows x1.12 so the store can keep up with the offline
    // credit (at x1.22 the ~150 levels a 12-h night needs cost 1e15+ gold mid-game and the boxes sat full)
    capPct: 0.15, capCostGold0: 150, capCostGoldGrow: 1.12, capCostAux: 90, capCostPow: 1.5, // doc: 1 h x (1 + 0.15 C)
    minStore: 600,
    // doc: 2 / 1.5 / 1 a second. Parts lowered to 0.5: their sinks are bounded by doc caps (enhancement 20..160 by
    // grade, crew breakthroughs 15 k^2) and doc 18 wants them fully used, offline credit included
    perWorker: { food: 2, ore: 1.5, parts: 0.5 },
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
    // medal upgrades: level L costs cost0 * grow^L medals. The effects are the doc's (x1.15 fire and funds ...);
    // the price growth sets how much one doubling of the medals buys
    ups: {
      // was 1.22-1.35: one doubling bought ~3.5 levels of each line (x3 power), so quick re-climbs doubled the medals
      // every few minutes (3.6e16 by day 20). At x2.2-2.5 a doubling is worth ~x1.3 and a run has to push the record
      fire: { cost0: 2, grow: 2.2 }, funds: { cost0: 2, grow: 2.2 }, command: { cost0: 4, grow: 2.5 },
      supply: { cost0: 5, grow: 2.5 }, drill: { cost0: 8, grow: 2.5 }, watch: { cost0: 25, grow: 2.5 }, sentry: { cost0: 25, grow: 2.5 },
    },
  },
  gear: {
    mergeN: 4,                                              // doc: 4 copies -> next (4 vs 5 tested in the sim)
    stepMul: 1.10,                                          // equip multiplier per ladder step (was 1.16: weapon axis 5,580 at stage 1,000 vs doc 14)
    ownedBase: 0.01, ownedGrow: 1.10,                       // owned effect of weapon i: ownedBase * ownedGrow^i (was 0.012, 1.16)
    enhEquip: 0.02, enhOwned: 0.02,                         // per enhance level (was 0.05: x7 on a capped immortal)
    // the enhance breakthrough every 10 levels (doc 7: ore and parts) is the parts sink of the late game: production
    // runs ~20 h a day once offline credit is counted, and 20 k^2 parts left the box full 70-90% of the time
    btOre: 40, btParts: 2000,                               // late gear breakthroughs hit the 80% store cap: they scale with the box
    // a level costs enhGold0 * enhGoldGrow^L * (grade + 1) gold: at 1.24 every owned piece sat at its grade cap
    // (doc: 20 .. 160) by stage ~500, which emptied the gear sink for the rest of the game
    enhGold0: 40, enhGoldGrow: 1.45,
    enhCapByGrade: [20, 40, 60, 80, 100, 120, 140, 160],    // doc
    codexPer: 0.01, codexGradeSet: 0.10,                    // doc: +1% each, a grade set adds more
    pullCost: 50, pity: [[3, 50], [4, 150], [5, 500]],     // doc: hero+ in 50, legend+ in 150, immortal+ in 500
    summonXpPerPull: 1, summonLevelPulls: 22,               // level L needs 22 (L-1)^2 pulls in total
    turretStepMul: 1.18, turretPullCost: 50,
  },
  // 광맥 지도 pays 1 gem per 2,000 ore (doc) up to oreGemsPerDay a day: uncapped it grew with production (36k gems/h)
  relics: { chestCost: 300, killsPerDrop: 2000, bossDrop: 0.05, titanDrop: 1, maxLevel: 10, oreGemsPerDay: 150,
    slotsAt: [20, 50, 100, 200, 400, 700, 1000, 2000] },   // doc
  economy: {
    offlineBaseH: 2, offlineBaseEff: 0.8, offlineMaxH: 12, offlineMaxEff: 1, offlineGold: 0, // doc: as the current game (production at 80%, no gold, 2 h)
    startGems: 500,          // a new player's first summons
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
