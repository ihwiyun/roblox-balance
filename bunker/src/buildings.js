'use strict';
// The bunker and the fence: levels, hp, price, and how the look grows (drawn in yard.js). Other files only use the
// functions and tables defined here. Gold buys levels; every 50 levels the next purchase is a breakthrough
// (materials and three times the gold), the only moment the look changes (the turret mounts aside, which open at
// fixed levels). Levels have no real cap: the look is worked out on demand and kept per breakthrough.
const MAX_BUNKER = 30000, MAX_FENCE = 30000;
const LOOK_BREAK = 50, LOOK_ERA = 25;
// the purchase from level L is a breakthrough (L = 50, 100, 150, ...)
const bunkerBreak = L => L > 0 && L % LOOK_BREAK === 0, fenceBreak = bunkerBreak;
// breakthroughs bought by level L: the one bought at level 50 shows from level 51
const lookTier = L => L > 0 ? Math.floor((L - 1) / LOOK_BREAK) : 0;
// the turret mounts on the bunker open at these levels
const MOUNT_AT = [25, 50, 100, 200, 400, 700];
// the curves keep their old shape, stretched over the longer ladder: LEVEL_STRETCH old levels per new level
const LEVEL_STRETCH = 39 / 99;
const bunkerHp = L => Math.round(150 * 1.16 ** ((L - 1) * LEVEL_STRETCH));
const fenceHp = L => L ? Math.round(120 * 1.17 ** ((L - 1) * LEVEL_STRETCH)) : 0;
// a breakthrough costs three times the gold, plus food and ore (about 30·k² each for the k-th)
function breakPrice(L, c) {
  if (!bunkerBreak(L)) return c;
  const m = Math.ceil(30 * (L / LOOK_BREAK) ** 2);
  c.money *= 3; c.food = (c.food || 0) + m; c.mineral = (c.mineral || 0) + m;
  return c;
}
// the price of the next level, L -> L + 1: money and a growing share of food (the builders eat) and, later, minerals
const bunkerCost = L => {
  const c = { money: Math.ceil(34 * 1.24 ** (L * LEVEL_STRETCH)) };
  if (L >= 6) c.food = Math.ceil(c.money * Math.min(.6, .2 + (L - 6) * .006));
  if (L >= 16) c.mineral = Math.ceil(c.money * Math.min(.2, .05 + (L - 16) * .003));
  return breakPrice(L, c);
};
const fenceCost = L => { const c = { money: Math.ceil(26 * 1.24 ** (L * LEVEL_STRETCH)) }; if (L >= 8) c.mineral = Math.ceil(c.money * Math.min(.25, .08 + (L - 8) * .004)); return breakPrice(L, c); };
// coarse progress of the base for the crew's kit: helmets from 2, vests from 4 (0..5), by level as before
const gearTier = () => Math.min(5, Math.floor(Math.min(9, Math.floor((G.bunker - 1) / 10)) * 6 / 10));

/* ================= the look: components × stages ================= */
// A building is made of components, and each component has a ladder of stages, era by era. A breakthrough moves one
// component one stage up its era's ladder, in the order of the turn list (24 turns); the 25th breakthrough jumps the
// whole building to the next era (bigger), where every component starts on that era's first stage. Past the end of
// a ladder (and in every era past the last) a component climbs material grades instead, so the look never stops
// changing. The first era's stages are the features of the forms the game had before. More stages: add names to a
// ladder here and drawings to the same row in yard.js.
const LOOK_ERAS = ['임시', '군용', '산업', '미래', '그 이후'];
const LOOK_GRADES = ['청동', '은', '금', '백금', '수정', '루비', '에메랄드', '사파이어', '자수정', '흑요석'];
const BUNKER_LOOK = {
  names: ['간이 참호', '콘크리트 토치카', '포탑 요새', '첨단 장갑 성채', '최종 요새'],
  // by era: the footprint (half), the dust of a hit, the roof height at each walls stage, the deck at each roof stage
  half: [1.7, 1.95, 2.1, 2.25, 2.4],
  material: [[190, 166, 116], [176, 172, 160], [164, 154, 138], [120, 132, 150], [70, 66, 74]],
  top: [[.2, 1.16, 1.6, 2.0], [2.1, 2.1, 2.1, 2.1, 2.6], [2.6], [2.8], [3.0]],
  deck: [[1.4, 1.6, 1.6], [1.62], [1.75], [1.85], [1.95]],
  turns: ['walls', 'lights', 'post', 'storage', 'armour', 'flags', 'workshop', 'comms', 'roof', 'mounts', 'walls', 'lights',
    'post', 'armour', 'storage', 'comms', 'flags', 'roof', 'workshop', 'mounts', 'walls', 'lights', 'post', 'armour'],
  parts: {
    walls: ['벽', [['흙 둔덕', '통나무 벽', '판자 벽', '함석 벽'], ['콘크리트 벽', '2열 총안', '측면 보강벽', '흙 둔덕', '외벽 증축'],
      ['석조 성벽', '성벽 총안', '성벽 증축'], ['장갑 선체', '방열판'], ['흑금 성벽']]],
    roof: ['지붕', [['판자 바닥', '망루 확장', '사방 처마'], ['콘크리트 지붕', '강철 지붕', '위장 도색'], ['석조 지붕'], ['장갑 지붕'], ['황금 지붕']]],
    post: ['사수 초소', [['모래주머니 1단', '모래주머니 2단', '판자 흉벽', '통나무 흉벽'], ['콘크리트 흉벽', '흉벽 증축', '강화 난간 패널', '장갑 총안'],
      ['성가퀴'], ['빛 난간'], ['왕관 성가퀴']]],
    mounts: ['터렛 거치대', [['통나무 받침', '모래주머니 총좌', '판자 망대'], ['콘크리트 총좌', '강철 총좌', '모서리 보루'], ['포탑 보루'], ['레이저 포대'], ['흑금 포대']]],
    armour: ['장갑판', [['덧판 없음', '철판 덧대기', '녹슨 덧판', '모서리 강판'], ['강철 모서리 보호대', '상단 장갑판', '장갑 기둥', '황흑 경고 도장'],
      ['장갑 스커트'], ['이중 장갑판'], ['황금 장갑']]],
    lights: ['조명', [['불빛 없음', '네 귀 랜턴', '네 귀 등불', '전구 줄'], ['철망 벽등', '네 귀 투광등', '경보 사이렌', '헬기 유도등'],
      ['포탑 경광등'], ['빛 왕관'], ['승리의 화로']]],
    comms: ['안테나·통신', [['통신 없음', '네 귀 안테나', '무전 마스트'], ['무전 안테나', '레이더 패널', '안테나 배열'], ['통신탑'], ['센서 기둥'], ['위성 통신탑']]],
    workshop: ['수리 작업장', [['작업장 없음', '작업대', '작업장'], ['공구 사물함', '정비 작업대', '정비 공장'], ['정비 크레인'], ['로봇 정비대'], ['황금 공방']]],
    storage: ['보관함', [['보관함 없음', '보급 상자', '연료 드럼통'], ['탄약 상자', '연료 저장소', '탄약고'], ['컨테이너'], ['자동 저장고'], ['황금 금고']]],
    flags: ['깃발·휘장', [['깃발 없음', '붉은 천 표식', '해골 경고 낙서'], ['부대 휘장', '네 면 현수막', '성벽 페넌트'], ['붉은 휘장'], ['홀로그램 표지'], ['황금 문장']]],
  },
};
const FENCE_LOOK = {
  names: ['나무 말뚝', '철망 펜스', '강철 방벽', '전기 철책', '에너지 방벽'],
  // by era: the colour of the splinters, whether it clangs, whether it shocks whoever hits it
  material: [[146, 104, 66], [150, 160, 166], [112, 122, 132], [112, 122, 132], [120, 200, 255]],
  metal: [false, true, true, true, true], electric: [false, false, false, true, true],
  turns: ['panels', 'lights', 'posts', 'gate', 'spikes', 'panels', 'posts', 'lights', 'spikes', 'gate', 'panels', 'posts',
    'lights', 'spikes', 'panels', 'gate', 'posts', 'lights', 'spikes', 'panels', 'gate', 'posts', 'lights', 'spikes'],
  parts: {
    posts: ['기둥', [['나무 말뚝', '말뚝 보충', '뾰족한 끝', '검은 기둥', '철판 끝', '기둥 캡'], ['강철 기둥', '녹색 코팅', '기둥 캡', '콘크리트 기초'],
      ['강철 방벽 기둥'], ['애자 기둥'], ['발생기 기둥']]],
    panels: ['판·철조망', [['없음', '밧줄 연결', '가로 막대', '판자 울타리', '흰 페인트', '덩굴'], ['철망', '윗단 파이프', '가림막 띠', '안쪽 보조 펜스'],
      ['강철 판', '리벳 줄', '위장 무늬 도장'], ['고압 전선'], ['에너지막']]],
    gate: ['문', [['없음', '판자 정문', '경고 팻말', '철판 덧댄 정문', '정문 망루'], ['철망 문', '출입 금지판', '차단기'], ['강철 문'], ['전기 문'], ['빛의 문']]],
    lights: ['조명', [['없음', '모서리 횃불', '모서리 등', '반사 표지', '모서리 투광등', '모서리 경광등'], ['모서리 조명', '모서리 투광등', '점멸등'],
      ['모서리 투광기'], ['감시 카메라'], ['코어 발광']]],
    spikes: ['가시·전기', [['없음', '엇갈린 말뚝', '윗단 가시철사', '바깥 말뚝열', '바닥 코일', '깡통 딸랑이'], ['윗단 철조망', '바깥 철조망 팔', '면도날 철조망'],
      ['톱니 윗단'], ['푸른 전류', '방전탑'], ['에너지 가시']]],
  },
};
// a building after b breakthroughs: its era, each component's stage within the era's ladder and its material grade
function lookOf(T, b) {
  const era = Math.floor(b / LOOK_ERA), top = LOOK_ERAS.length - 1, e = Math.min(era, top);
  const look = { b, era: e, eraGrade: era - e, step: {}, grade: {} }, n = {};
  // each component's turns so far this era; past the last era it keeps climbing from where it stood
  for (const k in T.parts) n[k] = 0;
  T.turns.forEach((k, i) => { n[k] += era - e + (i < b % LOOK_ERA ? 1 : 0); });
  for (const k in T.parts) { const last = T.parts[k][1][e].length - 1; look.step[k] = Math.min(n[k], last); look.grade[k] = n[k] - look.step[k]; }
  return look;
}
const lookGradeName = g => g ? LOOK_GRADES[(g - 1) % LOOK_GRADES.length] + (g > LOOK_GRADES.length ? ' ' + (Math.floor((g - 1) / LOOK_GRADES.length) + 1) : '') : '';
// what breakthrough b brings: a new building every 25th, else its component's new stage (or grade)
function lookStepName(T, b) {
  if (b <= 0) return T.names[0];
  const lk = lookOf(T, b);
  if (b % LOOK_ERA === 0) return LOOK_ERAS[lk.era] + ' 시대 · ' + T.names[lk.era] + (lk.eraGrade ? ' ' + (lk.eraGrade + 1) : '');
  const k = T.turns[b % LOOK_ERA - 1], g = lk.grade[k];
  return T.parts[k][0] + ' · ' + T.parts[k][1][lk.era][lk.step[k]] + (g ? ' · ' + lookGradeName(g) : '');
}
const bunkerStepName = b => lookStepName(BUNKER_LOOK, b), fenceStepName = b => lookStepName(FENCE_LOOK, b);
// the first level of a new building (a new era); hud.js announces it
const isNewBunkerForm = L => L % (LOOK_BREAK * LOOK_ERA) === 1, isNewFenceForm = isNewBunkerForm;
// what the cards and the drawing read, kept per breakthrough. half: half the footprint (zombies stop at half + .55);
// roof: the height the gunners stand at; deck: half the roof area where debris lands; material: the dust of a hit
const bunkerLooks = new Map(), fenceLooks = new Map();
function bunkerInfo(L = G.bunker) {
  const b = lookTier(Math.max(1, Math.min(MAX_BUNKER, L)));
  let I = bunkerLooks.get(b);
  if (!I) {
    const T = BUNKER_LOOK, look = lookOf(T, b), e = look.era, top = T.top[e], deck = T.deck[e];
    I = { name: T.names[e] + (look.eraGrade ? ' ' + (look.eraGrade + 1) : ''), half: T.half[e], roof: top[Math.min(look.step.walls, top.length - 1)],
      deck: deck[Math.min(look.step.roof, deck.length - 1)], material: T.material[e], look };
    bunkerLooks.set(b, I);
  }
  return I;
}
function fenceInfo(L = G.fence) {
  const b = lookTier(Math.max(0, Math.min(MAX_FENCE, L)));
  let I = fenceLooks.get(b);
  if (!I) {
    const T = FENCE_LOOK, look = lookOf(T, b), e = look.era;
    I = { name: T.names[e] + (look.eraGrade ? ' ' + (look.eraGrade + 1) : ''), material: T.material[e], metal: T.metal[e], electric: T.electric[e], look };
    fenceLooks.set(b, I);
  }
  return I;
}
// breakthroughs into the fence's era (the sparks of an electric fence grow with it, loop.js)
const fenceSub = (L = G.fence) => lookTier(L) % LOOK_ERA;
