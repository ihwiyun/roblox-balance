'use strict';
// Tuning: every number that shapes the game (costs, growth curves, zombie types, names).
/* ================= tuning ================= */
const FIELD = PP_SCENE.field, FENCE_R = 3.6, MAX_ZOMBIES = 60, OFFLINE_CAP = 2 * 3600, SAVE_KEY = 'bunker-idle:v3';
// the bunker and the fence each have 40 levels: the building changes form six times, and every level
// in between adds something you can see
// zombies walk the same time from the island edge to the fence whatever the island size (speeds are tuned for 8.3 units)
const PACE = (FIELD + .7 - FENCE_R) / 8.3;
// the living floor: beds come at some levels (each bed is a place to hire someone), furniture at the rest
const GUN = {
  atk: { name: '공격력', max: 100, cost: L => Math.ceil(10 * 1.2 ** L), val: L => 10 * 1.12 ** L * (1 + .04 * L) },
  spd: { name: '연사', max: 30, cost: L => Math.ceil(15 * 1.32 ** L), val: L => 1 + .06 * L },
  mag: { name: '탄창', max: 30, cost: L => Math.ceil(12 * 1.28 ** L), val: L => 5 + L },
};
// the rifle changes every 4 attack levels: six families, then attachments, then paint
const WEAPONS = ['볼트액션 소총', '반자동 소총', '돌격소총', '경기관총', '대물 저격총', '레일건'];
const weaponFamily = L => Math.min(5, Math.floor(L / 8));
const weaponLookName = L => {
  const fam = WEAPONS[weaponFamily(L)], step = Math.floor(L / 4) % 2, paint = L >= 80 ? '발광 ' : L >= 60 ? '금장 ' : L >= 48 ? '위장 ' : '';
  return paint + fam + (step ? '+' : '');
};
function gunCost(k, L) {
  // better guns need minerals from the mine: a share of the price that grows with the level, so the mine's
  // output is what keeps the guns coming (money alone runs out first otherwise)
  const c = { money: GUN[k].cost(L) };
  if (k === 'atk' && L >= 6) c.mineral = Math.ceil(c.money * Math.min(.2, .05 + (L - 6) * .004));
  if (k !== 'atk' && L >= 3) c.mineral = Math.ceil(c.money * Math.min(.2, .06 + (L - 3) * .005));
  return c;
}
const reloadTime = () => 1.6 * .97 ** G.lv.mag;
const JOBS = ['사수', '농부', '광부'];
// hiring: a new hand costs a little money and a lot of food (they come for the food), so a good farm
// grows the crew
const HIRE = [{ money: 50, food: 30 }, { money: 200, food: 150 }, { money: 600, food: 600 }, { money: 2000, food: 2000 }, { money: 6000, food: 6000 }];
// stores: the pantry grows with the farm (and a little with the living quarters), the ore store with the mine.
// What is made beyond a full store is lost, so nothing piles up forever; and no price ever asks for more than
// the store can hold (it waits for the store to fill instead)
const foodCap = () => Math.round(500 * 1.24 ** G.farm + 150 * G.live);
const mineralCap = () => Math.round(300 * 1.26 ** G.mine);
function capCost(c) {
  if (c.food) c.food = Math.min(c.food, Math.floor(foodCap() * .8));
  if (c.mineral) c.mineral = Math.min(c.mineral, Math.floor(mineralCap() * .8));
  return c;
}
// hunger: after this long without food the newest hand leaves; a fall while starving ends the game
const STARVE_LEAVE = 60;
const UPKEEP = .4, REPAIR_FOOD = .1, REPAIR_MONEY = .02;
const FATIGUE_WORK = 100 / 110, FATIGUE_REST = 100 / 28; // about two minutes on, half a minute in bed
// zombies grow about 11% a wave; rewards about 8.5%; more kinds join as the waves go on
const zombieHp = w => 20 * 1.11 ** (w - 1) * (1 + .03 * (w - 1));
const zombieHit = w => 4 * 1.08 ** (w - 1);
const zombieReward = w => 4 * 1.09 ** (w - 1);
const killsNeeded = w => Math.min(60, 8 + 2 * w);
const spawnEvery = w => Math.max(.55, 2.6 * .96 ** (w - 1));
// zombie kinds, in the order they first appear (one new mutant every few waves, a boss every 10 waves).
// hp/hit/reward multiply the wave's base; every: seconds between blows; armor: share of each bullet that gets
// through; range: they stop this far short of their target and work from there; special: their trick
const ZTYPES = {
  walker:      { name: '좀비', desc: '느리게 걸어와 울타리를 두드린다', from: 1, hp: 1, hit: 1, speed: .55, reward: 1, every: 1.2 },
  crawler:     { name: '기는 놈', desc: '바닥을 기어 온다', from: 3, hp: .8, hit: .8, speed: .42, reward: 1.2, every: 1 },
  runner:      { name: '러너', desc: '빠르게 달려든다', from: 5, hp: .6, hit: .7, speed: 1.15, reward: 1.3, every: .65 },
  brute:       { name: '덩치', desc: '체력이 많고 한 방이 세다', from: 8, hp: 6, hit: 4, speed: .32, reward: 5, every: 1.8 },
  bloater:     { name: '부푼 놈', desc: '울타리나 벙커에 붙으면 터진다', from: 11, hp: 2.2, hit: 0, speed: .34, reward: 2, every: 1.1, special: 'burst' },
  armored:     { name: '방호복', desc: '진압 장비가 총알을 절반 막는다', from: 14, hp: 3.2, hit: 1.3, speed: .45, reward: 2.6, every: 1.2, armor: .5 },
  spitter:     { name: '산성 침', desc: '멀리 서서 산성 침을 뱉는다', from: 17, hp: 1.6, hit: 1.1, speed: .5, reward: 2.4, every: 2.4, range: 2.4, special: 'spit' },
  screamer:    { name: '비명 좀비', desc: '비명으로 주변 좀비를 미쳐 날뛰게 한다', from: 20, hp: 2, hit: .5, speed: .45, reward: 3, every: 5, range: 3.2, special: 'scream' },
  leaper:      { name: '도약 좀비', desc: '울타리를 뛰어넘어 벙커로 온다', from: 23, hp: 1.4, hit: 1.4, speed: .8, reward: 2.8, every: .9, special: 'leap' },
  burrower:    { name: '땅굴 좀비', desc: '땅속으로 와서 울타리 안에서 튀어나온다', from: 26, hp: 2.4, hit: 1.6, speed: .6, reward: 3.2, every: 1.1, special: 'burrow' },
  regenerator: { name: '재생 좀비', desc: '맞지 않으면 상처가 아문다', from: 29, hp: 3, hit: 1.2, speed: .5, reward: 3.4, every: 1.2, special: 'regen' },
  giant:       { name: '거인', desc: '거대하고 느리다. 울타리를 크게 부순다', from: 33, hp: 16, hit: 9, speed: .25, reward: 12, every: 2.4 },
  boss:        { name: '변이체 보스', desc: '쓰러뜨려야 다음 웨이브로 넘어간다', from: 10, hp: 45, hit: 14, speed: .22, reward: 40, every: 2.6, special: 'boss' },
};
const isBossWave = w => w % 10 === 0;
const MUTANT_ORDER = Object.keys(ZTYPES).filter(k => k !== 'boss').sort((a, b) => ZTYPES[a].from - ZTYPES[b].from);
const nextMutant = () => MUTANT_ORDER.map(k => ZTYPES[k]).find(t => t.from > G.wave) || null;
const NAMES = ['민준', '서연', '도윤', '하은', '지호'];
// each survivor looks different: hair, skin, shirt
const LOOKS = [
  { key: 'hero', head: 'short', hair: [92, 64, 44], skin: [222, 172, 134], shirt: [96, 116, 76], pants: [58, 56, 70] },
  { key: 'minjun', head: 'long', hair: [40, 32, 30], skin: [236, 196, 160], shirt: [176, 84, 76], pants: [52, 58, 76] },
  { key: 'seoyeon', head: 'beard', hair: [120, 84, 52], skin: [198, 146, 108], shirt: [84, 112, 156], pants: [60, 54, 50] },
  { key: 'doyun', head: 'buzz', hair: [170, 160, 150], skin: [150, 104, 76], shirt: [196, 166, 104], pants: [56, 62, 56] },
  { key: 'haeun', head: 'short', hair: [196, 140, 70], skin: [230, 184, 150], shirt: [120, 96, 150], pants: [64, 58, 72] },
  { key: 'jiho', head: 'long', hair: [150, 60, 40], skin: [214, 160, 124], shirt: [90, 140, 120], pants: [50, 50, 58] },
];
