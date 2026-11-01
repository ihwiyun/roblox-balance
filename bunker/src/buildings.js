'use strict';
// The bunker and the fence: how many levels, where each new form begins, what every level adds, hp and price.
// (How they look is in yard.js.) Other files only use the functions and tables defined here.
const MAX_BUNKER = 100, MAX_FENCE = 100;
// the level at which each form (a different building, a different kind of fence) begins: ten forms of ten levels
const BUNKER_FORM_AT = [1, 11, 21, 31, 41, 51, 61, 71, 81, 91], FENCE_FORM_AT = [1, 11, 21, 31, 41, 51, 61, 71, 81, 91];
const formIndex = (at, L) => { let f = 0; for (let k = 0; k < at.length; k++) if (L >= at[k]) f = k; return f; };
const bunkerForm = (L = G.bunker) => formIndex(BUNKER_FORM_AT, L);
const fenceForm = (L = G.fence) => formIndex(FENCE_FORM_AT, L);
const bunkerSub = (L = G.bunker) => L - BUNKER_FORM_AT[bunkerForm(L)];   // levels into the current form
const fenceSub = (L = G.fence) => L - FENCE_FORM_AT[fenceForm(L)];
// half: half the footprint (zombies stop at half + .55 to hit it); roof: the height the gunners stand at;
// deck: half the roof area where debris lands; material: the colour of the dust when it is hit.
// These are the values on a form's first level; grow lists [levels into the form, half, roof, deck] where it grows
const BUNKER_FORMS = [
  { name: '간이 참호', half: 1.45, roof: .2, deck: 1.15, material: [190, 166, 116], grow: [[4, 1.62, .2, 1.32]] },
  { name: '나무 망루', half: 1.3, roof: 1.8, deck: 1.3, material: [146, 104, 66], grow: [[4, 1.45, 1.8, 1.45]] },
  { name: '컨테이너 초소', half: 1.5, roof: 1.9, deck: 1.3, material: [170, 72, 54], grow: [[5, 1.62, 1.9, 1.42]] },
  { name: '함석 요새', half: 1.5, roof: 2.0, deck: 1.4, material: [150, 120, 96], grow: [[4, 1.9, 2.0, 1.4]] },
  { name: '콘크리트 토치카', half: 1.6, roof: 2.0, deck: 1.4, material: [176, 172, 160], grow: [[4, 1.8, 2.0, 1.5]] },
  { name: '강화 벙커', half: 1.7, roof: 2.2, deck: 1.5, material: [150, 156, 140], grow: [[4, 1.85, 2.2, 1.6]] },
  { name: '지휘 벙커', half: 1.8, roof: 2.4, deck: 1.6, material: [196, 196, 188], grow: [[4, 1.95, 2.4, 1.7]] },
  { name: '포탑 요새', half: 1.85, roof: 2.6, deck: 1.6, material: [160, 150, 136], grow: [[4, 2.0, 2.6, 1.7]] },
  { name: '첨단 장갑 성채', half: 1.95, roof: 2.8, deck: 1.7, material: [120, 132, 150], grow: [[4, 2.0, 2.8, 1.75]] },
  { name: '최종 요새', half: 2.0, roof: 3.0, deck: 1.75, material: [70, 66, 74], grow: [] },
];
// the shape at every level (a form can widen or gain a storey part way through)
const BUNKER_LEVELS = [];
for (let L = 1; L <= MAX_BUNKER; L++) {
  const f = formIndex(BUNKER_FORM_AT, L), k = L - BUNKER_FORM_AT[f], F = BUNKER_FORMS[f];
  let half = F.half, roof = F.roof, deck = F.deck;
  for (const [at, h, r, d] of F.grow) if (k >= at) { half = h; roof = r; deck = d; }
  BUNKER_LEVELS[L] = { name: F.name, half, roof, deck, material: F.material, form: f, sub: k };
}
const bunkerInfo = (L = G.bunker) => BUNKER_LEVELS[Math.max(1, Math.min(MAX_BUNKER, L))];
// coarse progress of the base for the crew's kit: helmets from 2, vests from 4 (0..5)
const gearTier = () => Math.min(5, Math.floor(bunkerForm() * 6 / BUNKER_FORMS.length));
// the curves keep their old shape, stretched over the longer ladder: LEVEL_STRETCH old levels per new level
const LEVEL_STRETCH = 39 / 99;
const bunkerHp = L => Math.round(150 * 1.16 ** ((L - 1) * LEVEL_STRETCH));
// the price of the next level, L -> L + 1
const bunkerCost = L => {
  const c = { money: Math.ceil(40 * 1.24 ** (L * LEVEL_STRETCH)) };
  if (L >= 9) c.food = Math.ceil(8 * 1.2 ** ((L - 9) * LEVEL_STRETCH));
  if (L >= 19) c.mineral = Math.ceil(5 * 1.24 ** ((L - 19) * LEVEL_STRETCH));
  return c;
};
// material: the colour of the splinters when it is hit; metal: it clangs; electric: it shocks whoever hits it
const FENCE_FORMS = [
  { name: '나무 말뚝', material: [146, 104, 66] },
  { name: '판자 울타리', material: [176, 132, 84] },
  { name: '철조망', material: [96, 100, 108], metal: true },
  { name: '철망 펜스', material: [150, 160, 166], metal: true },
  { name: '강철 고슴도치', material: [112, 122, 132], metal: true },
  { name: '모래주머니 방벽', material: [190, 166, 116] },
  { name: '콘크리트 방호벽', material: [176, 172, 160] },
  { name: '강철 방벽', material: [112, 122, 132], metal: true },
  { name: '전기 철책', material: [112, 122, 132], metal: true, electric: true },
  { name: '에너지 방벽', material: [120, 200, 255], metal: true, electric: true },
];
const fenceInfo = (L = G.fence) => FENCE_FORMS[fenceForm(L)];
const fenceHp = L => L ? Math.round(120 * 1.17 ** ((L - 1) * LEVEL_STRETCH)) : 0;
const fenceCost = L => { const c = { money: Math.ceil(30 * 1.24 ** (L * LEVEL_STRETCH)) }; if (L >= 24) c.mineral = Math.ceil(4 * 1.24 ** ((L - 24) * LEVEL_STRETCH)); return c; };
// what each level adds; the first name of a form is the form itself
const BUNKER_EXTRAS = [
  ['간이 참호', '탄약 상자', '판자 방패벽', '기관총 거치대', '참호 확장', '랜턴 기둥', '위장망', '야전 무전기', '철조망 말뚝', '참호 깃발'],
  ['나무 망루', 'X자 버팀목', '통나무 난간', '아래층 판자벽', '망루 확장', '망보기 오두막', '매단 등불', '가시 말뚝', '나팔 확성기', '도르래 승강기'],
  ['컨테이너 초소', '화물 번호 도색', '옥상 안전 난간', '총안 셔터', '철제 계단', '2층 컨테이너', '호박색 경광등', '에어컨 실외기', '위장 그물', '대형 탐조등'],
  ['함석 요새', '녹슨 덧판', '철망 창문', '난로 연통', '옆채 증축', '드럼통 방벽', '지붕 망대', '해골 경고 낙서', '지붕 가시철선', '전구 줄'],
  ['콘크리트 토치카', '강철 방폭문', '흙 둔덕', '옥상 기관총좌', '측면 보강벽', '잠망경', '보호망 벽등', '버섯형 환기구', '장거리 무전탑', '위장 도색'],
  ['강화 벙커', '장갑 총안', '환기탑', '황흑 경고 도장', '2층 지휘실', '투광등', '대전차 장애물', '위성 안테나', '면도날 철조망', '부대 휘장'],
  ['지휘 벙커', '회전 레이더', '안테나 배열', '상황실 창', '별관 증축', '경보 사이렌', '케이블 트레이', '마이크로파 중계기', '세로 현수막', '헬기 유도등'],
  ['포탑 요새', '좌측 포탑', '미사일 포드', '장갑 스커트', '모서리 보루', '탄약 승강기', '회전 비콘', '대구경 주포', '성벽 페넌트', '대공 기관포'],
  ['첨단 장갑 성채', '센서 기둥', '레이저 포탑', '에너지 코어', '장갑 날개', '드론 거치대', '홀로그램 표지', '레일건', '방어막 발생기', '위성 업링크'],
  ['최종 요새', '황금 문장', '쌍둥이 포탑', '붉은 휘장', '성채 첨탑', '중앙 탐조 비콘', '미사일 사일로', '플라스마 포', '승리의 화로', '왕관 장식'],
];
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
// things that collect in the compound inside the fence, and the bunker level each one appears or changes at
const YARD_PROPS = {
  crates: [3, '보급 상자'], drums: [6, '연료 드럼통'], fire: [9, '모닥불'], tank: [12, '물탱크'], tent: [15, '천막'],
  gen: [18, '발전기'], bench: [21, '작업대'], towerL: [24, '나무 감시탑'], mast: [27, '무전 마스트'], garage: [30, '차고와 지프'],
  shop: [33, '작업장'], pad: [36, '헬기장'], medic: [39, '의무 텐트'], solar: [42, '태양광 패널'], tankS: [45, '강철 물탱크'],
  fuel: [48, '연료 저장소'], green: [51, '온실'], towerS: [54, '강철 감시탑'], ammo: [57, '탄약고'], mastS: [60, '통신탑'],
  apc: [63, '장갑차'], heli: [66, '헬리콥터'], works: [69, '정비 공장'], clinic: [72, '야전 병원'], solar2: [75, '태양광 확장'],
  tankB: [78, '대형 급수탑'], missile: [81, '미사일 발사대'], fusion: [84, '핵융합 발전기'], radar: [87, '방공 레이더'],
  towerX: [90, '레이저 감시탑'], dish: [93, '위성 통신탑'], tank2: [96, '전차'], sentry: [99, '자동 기관포탑'],
};
const yardPropAt = id => YARD_PROPS[id][0];
const PROP_NAME_AT = [];
for (const [L, name] of Object.values(YARD_PROPS)) PROP_NAME_AT[L] = name;
// what level L adds (or the new form's name, on the first level of a form), with what appears in the compound
const bunkerAddName = L => { const n = BUNKER_EXTRAS[bunkerForm(L)][bunkerSub(L)] || ''; return PROP_NAME_AT[L] ? n + ' · ' + PROP_NAME_AT[L] : n; };
const fenceAddName = L => FENCE_EXTRAS[fenceForm(L)][fenceSub(L)] || '';
const isNewBunkerForm = L => BUNKER_FORM_AT.includes(L), isNewFenceForm = L => FENCE_FORM_AT.includes(L);
