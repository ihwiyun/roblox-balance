'use strict';
// The bunker and the fence: levels, hp, price, and how the look grows (drawn in yard.js). Other files only use the
// functions and tables defined here. Gold buys levels; every 50 levels the next purchase is a breakthrough (materials
// and three times the gold), the only moment the look changes (the turret mounts aside, which open at fixed levels).
// Levels have no real cap: the look is worked out on demand and kept per breakthrough.
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

/* ================= the look: eras, components × stages ================= */
// The ten buildings (and ten fences) of the old game are the first ten eras, at these breakthroughs; after the tenth a
// new era comes every 25 (industrial, futuristic, beyond: drawn later, the last building stands in for them till then).
// An era opens with its building as the old game showed it late in its ten levels, so it is never smaller or plainer
// than the old game at the same building; each breakthrough inside the era adds one of that building's remaining
// features or one thing in the compound, in the old order, and the era ends where the old building ended. Every
// feature and thing belongs to a component (the tags below); once an era's stages run out, each breakthrough bumps a
// component's material grade instead, so the look never stops changing. Per era: [first breakthrough, footprint]
const ERA_AT = [0, 2, 4, 7, 10, 14, 18, 23, 29, 36];
const lookEra = b => b >= ERA_AT[9] ? 9 + Math.floor((b - ERA_AT[9]) / LOOK_ERA) : ERA_AT.filter(at => b >= at).length - 1;
const lookEraStart = e => e <= 9 ? ERA_AT[e] : ERA_AT[9] + (e - 9) * LOOK_ERA;

const LOOK_GRADES = ['청동', '은', '금', '백금', '수정', '루비', '에메랄드', '사파이어', '자수정', '흑요석'];
// half: half the footprint (zombies stop at half + .55 to hit it); roof: the height the gunners stand at;
// deck: half the roof area where debris lands; material: the colour of the dust when it is hit.
// These are the values without features; grow lists [feature, half, roof, deck] for the features that widen or raise it
const BUNKER_FORMS = [
  { name: '간이 참호', half: 1.7, roof: .2, deck: 1.4, material: [190, 166, 116], grow: [[4, 1.82, .2, 1.52]] },
  { name: '나무 망루', half: 1.45, roof: 1.8, deck: 1.45, material: [146, 104, 66], grow: [[4, 1.6, 1.8, 1.6], [8, 1.6, 2.2, 1.6]] },
  { name: '컨테이너 초소', half: 1.5, roof: 1.9, deck: 1.3, material: [170, 72, 54], grow: [[5, 1.64, 2.25, 1.3]] },
  { name: '함석 요새', half: 1.5, roof: 2.0, deck: 1.4, material: [150, 120, 96], grow: [[4, 1.9, 2.0, 1.4]] },
  { name: '콘크리트 토치카', half: 1.6, roof: 2.0, deck: 1.5, material: [176, 172, 160], grow: [[4, 1.8, 2.0, 1.6]] },
  { name: '강화 벙커', half: 1.7, roof: 2.2, deck: 1.5, material: [150, 156, 140], grow: [[4, 1.85, 2.6, 1.6]] },
  { name: '지휘 벙커', half: 1.8, roof: 2.4, deck: 1.6, material: [196, 196, 188], grow: [[4, 2.0, 2.4, 1.7]] },
  { name: '포탑 요새', half: 1.85, roof: 2.6, deck: 1.6, material: [160, 150, 136], grow: [[4, 2.0, 2.6, 1.7], [5, 2.0, 2.9, 1.7]] },
  { name: '첨단 장갑 성채', half: 1.95, roof: 2.8, deck: 1.7, material: [120, 132, 150], grow: [[4, 2.0, 2.8, 1.75]] },
  { name: '최종 요새', half: 2.0, roof: 3.0, deck: 1.75, material: [70, 66, 74], grow: [[7, 2.0, 3.35, 1.75]] },
];
// the components (one letter each in the tags) and the order material grades go round them
const BUNKER_PARTS = { W: '벽', R: '지붕', P: '사수 초소', M: '터렛 거치대', A: '장갑판', L: '조명', C: '안테나·통신', K: '수리 작업장', S: '보관함', F: '깃발·휘장' };
// each building's nine features in the old order (the first name is the building), and the component of each
const BUNKER_EXTRAS = [
  ['간이 참호', '말뚝 버팀벽', '모래주머니 2단', '판자 흉벽', '참호 확장', '네 귀 랜턴', '철판 덧대기', '철조망 둘레', '통나무 모서리 보강', '통나무 흉벽'],
  ['나무 망루', 'X자 버팀목', '통나무 난간', '아래층 판자벽', '망루 확장', '판자 방패벽', '네 귀 등불', '가시 말뚝 둘레', '망루 증축', '모서리 망대'],
  ['컨테이너 초소', '옥상 안전 난간', '화물 도색 띠', '총안 셔터', '모서리 강판', '콘크리트 받침대', '모래주머니 둘레', '네 귀 경광등', '위장 그물 커튼', '네 귀 탐조등'],
  ['함석 요새', '녹슨 덧판', '철망 창문', '함석 흉벽', '사방 처마', '드럼통 방벽', '네 귀 함석 망루', '해골 경고 낙서', '지붕 가시철선', '전구 줄'],
  ['콘크리트 토치카', '강철 모서리 보호대', '흙 둔덕', '2열 총안', '측면 보강벽', '모서리 관측탑', '보호망 벽등', '흉벽 증축', '네 귀 안테나', '위장 도색'],
  ['강화 벙커', '장갑 총안', '상단 장갑판', '황흑 경고 도장', '외벽 한 층 증축', '네 귀 투광등', '대전차 장애물 둘레', '모서리 장갑 기둥', '면도날 철조망', '부대 휘장'],
  ['지휘 벙커', '레이더 패널', '안테나 배열', '상황실 창', '기단 증축', '경보 사이렌', '케이블 트레이', '강화 난간 패널', '네 면 현수막', '헬기 유도등'],
  ['포탑 요새', '모서리 포탑 4기', '성벽 총안', '장갑 스커트', '모서리 보루', '성벽 증축', '포탑 경광등', '대구경 포신', '성벽 페넌트', '미사일 포드'],
  ['첨단 장갑 성채', '센서 기둥', '레이저 포탑', '에너지 코어', '장갑 날개', '방열판', '홀로그램 표지', '이중 장갑판', '방어막 발생기', '빛 왕관'],
  ['최종 요새', '황금 문장', '흑금 포탑', '붉은 휘장', '포탑 첨탑', '황금 기단', '플라스마 포', '성벽 장갑 증축', '승리의 화로', '왕관 장식'],
];
const BUNKER_TAGS = ['WPPRLAAWP', 'WPWRPLAWP', 'PFWAWALAL', 'AWPRSPFAL', 'AWWWPLPCF', 'WAFWLAAAF', 'CCWWLCPFL', 'MWAWWLMFM', 'CMWAWFAAL', 'FMFPWMALR'];
// the things that collect in the compound: the old level that orders them, their name and component (yard.js draws
// them where they stood; a later thing on the same spot replaces an earlier one)
const YARD_PROPS = {
  crates: [3, '보급 상자', 'S'], drums: [6, '연료 드럼통', 'S'], fire: [9, '모닥불', 'L'], tank: [12, '물탱크', 'S'], tent: [15, '천막', 'K'],
  gen: [18, '발전기', 'L'], bench: [21, '작업대', 'K'], towerL: [24, '나무 감시탑', 'P'], mast: [27, '무전 마스트', 'C'], garage: [30, '차고와 지프', 'K'],
  shop: [33, '작업장', 'K'], pad: [36, '헬기장', 'F'], medic: [39, '의무 텐트', 'K'], solar: [42, '태양광 패널', 'L'], tankS: [45, '강철 물탱크', 'S'],
  fuel: [48, '연료 저장소', 'S'], green: [51, '온실', 'S'], towerS: [54, '강철 감시탑', 'P'], ammo: [57, '탄약고', 'S'], mastS: [60, '통신탑', 'C'],
  apc: [63, '장갑차', 'K'], heli: [66, '헬리콥터', 'K'], works: [69, '정비 공장', 'K'], clinic: [72, '야전 병원', 'K'], solar2: [75, '태양광 확장', 'L'],
  tankB: [78, '대형 급수탑', 'S'], missile: [81, '미사일 발사대', 'M'], fusion: [84, '핵융합 발전기', 'L'], radar: [87, '방공 레이더', 'C'],
  towerX: [90, '레이저 감시탑', 'P'], dish: [93, '위성 통신탑', 'C'], tank2: [96, '전차', 'K'], sentry: [99, '자동 기관포탑', 'M'],
};
const yardPropAt = id => YARD_PROPS[id][0];
// material: the colour of the splinters when it is hit; metal: it clangs
const FENCE_FORMS = [
  { name: '나무 말뚝', material: [146, 104, 66] },
  { name: '판자 울타리', material: [176, 132, 84] },
  { name: '철조망', material: [96, 100, 108], metal: true },
  { name: '철망 펜스', material: [150, 160, 166], metal: true },
  { name: '강철 고슴도치', material: [112, 122, 132], metal: true },
  { name: '모래주머니 방벽', material: [190, 166, 116] },
  { name: '콘크리트 방호벽', material: [176, 172, 160] },
  { name: '강철 방벽', material: [112, 122, 132], metal: true },
  { name: '전기 철책', material: [112, 122, 132], metal: true },
  { name: '에너지 방벽', material: [120, 200, 255], metal: true },
];
// the fence shocks whoever hits it from this level on, whatever it looks like (a rule of play, kept from the old game)
const FENCE_SHOCK_AT = 81;
const FENCE_PARTS = { P: '기둥', N: '판·철조망', G: '문', L: '조명', S: '가시·전기' };
const FENCE_EXTRAS = [
  ['나무 말뚝', '밧줄 연결', '말뚝 보충', '뾰족한 끝', '가로 막대', '붉은 천 표식', '모서리 횃불', '엇갈린 말뚝', '깡통 경보줄', '경고 팻말'],
  ['판자 울타리', '흰 페인트', '판자 보충', '검은 기둥', '철판 끝', '모서리 등', '정문', '덩굴', '위험 표지판', '윗단 가시철사'],
  ['철조망', '세 가닥 철선', '윗단 코일', '깡통 딸랑이', '사선 보조선', '붉은 경고판', '바깥 말뚝열', '바닥 코일', '모서리 투광등', '반사 표지'],
  ['철망 펜스', '윗단 파이프', '녹색 코팅', '기둥 캡', '콘크리트 기초', '바깥 철조망 팔', '가림막 띠', '출입 금지판', '모서리 조명', '안쪽 보조 펜스'],
  ['강철 고슴도치', '연결 빔', '노란 경고 도색', '두 번째 줄', '끝 가시', '연결 쇠사슬', '콘크리트 받침', '모서리 경광등', '철선 감기', '반사판'],
  ['모래주머니 방벽', '나무 기둥 보강', '위장망 덮개', '사격 구멍', '덧댄 철판', '모서리 등불', '방벽 위 철조망', '앞쪽 흙 둔덕', '부대 표지판', '모서리 기관총'],
  ['콘크리트 방호벽', '경고 줄무늬', '반사등', '강철 연결쇠', '윗단 철망', '번호 도색', '모서리 경고등', '윗면 가시', '안쪽 보강 블록', '붉은 띠 도장'],
  ['강철 방벽', '리벳 줄', '위장 무늬 도장', '사격 슬롯', '톱니 윗단', '해골 경고판', '모서리 투광기', '안쪽 버팀대', '장갑 덧판', '검은 도장'],
  ['전기 철책', '애자', '고압 경고판', '점멸등', '안쪽 전선', '변압기', '배선 덮개', '푸른 전류', '방전탑', '감시 카메라'],
  ['에너지 방벽', '발생기 기둥', '청색 에너지막', '빛 띠', '보조 발생기', '홀로그램 경고', '에너지 가시', '이중 막', '코어 발광', '황금 발생기'],
];
const FENCE_TAGS = ['NPPNNLSSN', 'NNPPLGNNS', 'NSSNNSSLP', 'NPPPSNNLN', 'NPNSNPLSP', 'PNNNLSNNS', 'NLPSNLSPN', 'NNNSNLPNN', 'PNLSPNSSL', 'PNLPNSNLP'];
// what happens inside each era, in the old order: [old level, feature n or thing id, component]; a feature comes
// before a thing of the same level. Then the era's own stages: the last `steps` of them (all of them in the first era,
// whose opening must stay the level-1 picture), the rest already there when the era opens
function eraEvents(tags, props, k) {
  const ev = [];
  for (let n = 1; n <= 9; n++) ev.push([10 * k + 1 + n, n, tags[k][n - 1]]);
  if (props) for (const [id, [lv, , part]] of Object.entries(props)) if (lv > 10 * k + 1 && lv <= 10 * k + 10) ev.push([lv + .5, id, part]);
  ev.sort((a, b) => a[0] - b[0]);
  const steps = lookEraStart(k + 1) - lookEraStart(k) - 1, cut = k ? Math.max(0, ev.length - steps) : 0;
  return { base: ev.slice(0, cut), steps: ev.slice(cut) };
}
// the eras after the tenth (drawn later): industrial, futuristic, beyond
const BUNKER_LOOK = { forms: BUNKER_FORMS, extras: BUNKER_EXTRAS, parts: BUNKER_PARTS, props: YARD_PROPS, late: ['산업 요새', '미래 요새', '그 이후'], events: [] };
const FENCE_LOOK = { forms: FENCE_FORMS, extras: FENCE_EXTRAS, parts: FENCE_PARTS, props: null, late: ['산업 방벽', '미래 방벽', '그 이후'], events: [] };
for (let k = 0; k < 10; k++) { BUNKER_LOOK.events[k] = eraEvents(BUNKER_TAGS, YARD_PROPS, k); FENCE_LOOK.events[k] = eraEvents(FENCE_TAGS, null, k); }
// a building after b breakthroughs: its era and old form, the features it shows, the things in the compound (every
// thing up to that old level), the event the last breakthrough brought, and each component's material grade
function lookOf(T, b) {
  const era = lookEra(b), form = Math.min(era, 9), E = T.events[form], i = b - lookEraStart(form);
  const feats = new Set(), grade = {}, got = era > 9 ? [...E.base, ...E.steps] : [...E.base, ...E.steps.slice(0, i)];
  let props = 10 * form + 1;
  for (const [lv, what] of got) if (typeof what === 'number') feats.add(what); else props = Math.max(props, Math.floor(lv));
  // past the era's own stages a breakthrough bumps a grade, the components taking turns
  const keys = Object.keys(T.parts), extra = era > 9 ? b - lookEraStart(9) - E.steps.length : i - E.steps.length;
  for (let j = 0; j < extra; j++) grade[keys[j % keys.length]] = (grade[keys[j % keys.length]] || 0) + 1;
  const last = i > 0 && i <= E.steps.length && era <= 9 ? E.steps[i - 1] : null;
  return { b, era, form, feats, props, grade, last, extra: Math.max(0, extra) };
}
const lookGradeName = g => LOOK_GRADES[(g - 1) % LOOK_GRADES.length] + (g > LOOK_GRADES.length ? ' ' + (Math.floor((g - 1) / LOOK_GRADES.length) + 1) : '');
const eraName = (T, era) => era <= 9 ? T.forms[era].name : T.late[Math.min(era - 10, 2)] + (era > 12 ? ' ' + (era - 11) : '');
// what breakthrough b brings: a new era at its first, else one component's new stage (or its next grade)
function lookStepName(T, b) {
  const lk = lookOf(T, b);
  if (b === lookEraStart(lk.era)) return b ? '새 시대 · ' + eraName(T, lk.era) : eraName(T, 0);
  if (lk.last) { const [, what, part] = lk.last; return T.parts[part] + ' · ' + (typeof what === 'number' ? T.extras[lk.form][what] : T.props[what][1]); }
  const keys = Object.keys(T.parts), k = keys[(lk.extra - 1) % keys.length];
  return T.parts[k] + ' · ' + lookGradeName(lk.grade[k]);
}
const bunkerStepName = b => lookStepName(BUNKER_LOOK, b), fenceStepName = b => lookStepName(FENCE_LOOK, b);
// the first level of a new era (and the fence's first level); hud.js announces it
const isNewBunkerForm = L => L === 1 || (L - 1) % LOOK_BREAK === 0 && lookTier(L) === lookEraStart(lookEra(lookTier(L))), isNewFenceForm = isNewBunkerForm;
// what the cards and the drawing read, kept per breakthrough
const bunkerLooks = new Map(), fenceLooks = new Map();
function bunkerInfo(L = G.bunker) {
  const b = lookTier(Math.max(1, Math.min(MAX_BUNKER, L)));
  let I = bunkerLooks.get(b);
  if (!I) {
    const look = lookOf(BUNKER_LOOK, b), F = BUNKER_FORMS[look.form];
    let half = F.half, roof = F.roof, deck = F.deck;
    for (const [n, h, r, d] of F.grow) if (look.feats.has(n)) { half = h; roof = r; deck = d; }
    I = { name: eraName(BUNKER_LOOK, look.era), half, roof, deck, material: F.material, look };
    bunkerLooks.set(b, I);
  }
  return I;
}
function fenceInfo(L = G.fence) {
  const b = lookTier(Math.max(0, Math.min(MAX_FENCE, L))), electric = L >= FENCE_SHOCK_AT, key = b * 2 + electric;
  let I = fenceLooks.get(key);
  if (!I) {
    const look = lookOf(FENCE_LOOK, b), F = FENCE_FORMS[look.form];
    I = { name: eraName(FENCE_LOOK, look.era), material: F.material, metal: !!F.metal, electric, look };
    fenceLooks.set(key, I);
  }
  return I;
}
// how far the electric fence look has grown (its lights blink, then it sparks: loop.js); nothing before it looks electric
const fenceSub = (L = G.fence) => { const lk = fenceInfo(L).look; return lk.form >= 8 ? lk.feats.size : 0; };
