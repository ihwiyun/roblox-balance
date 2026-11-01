'use strict';
// The bunker and the fence: how many levels, where each new form begins, what every level adds, hp and price.
// (How they look is in yard.js.) Other files only use the functions and tables defined here.
const MAX_BUNKER = 40, MAX_FENCE = 40;
// the level at which each form (a different building, a different kind of fence) begins
const BUNKER_FORM_AT = [1, 6, 12, 18, 25, 32], FENCE_FORM_AT = [1, 6, 12, 18, 25, 32];
const formIndex = (at, L) => { let f = 0; for (let k = 0; k < at.length; k++) if (L >= at[k]) f = k; return f; };
const bunkerForm = (L = G.bunker) => formIndex(BUNKER_FORM_AT, L);
const fenceForm = (L = G.fence) => formIndex(FENCE_FORM_AT, L);
const bunkerSub = (L = G.bunker) => L - BUNKER_FORM_AT[bunkerForm(L)];   // levels into the current form
const fenceSub = (L = G.fence) => L - FENCE_FORM_AT[fenceForm(L)];
// half: half the footprint (zombies stop at half + .55 to hit it); roof: the height the gunners stand at;
// deck: half the roof area where debris lands; material: the colour of the dust when it is hit
const BUNKER_FORMS = [
  { name: '간이 참호', half: 1.2, roof: .32, deck: .55, material: [190, 166, 116] },
  { name: '나무 망루', half: 1.25, roof: 1.8, deck: 1.25, material: [146, 104, 66] },
  { name: '컨테이너 초소', half: 1.4, roof: 2.0, deck: 1.4, material: [170, 72, 54] },
  { name: '콘크리트 벙커', half: 1.6, roof: 2.2, deck: 1.6, material: [176, 172, 160] },
  { name: '강화 벙커', half: 1.7, roof: 2.4, deck: 1.7, material: [176, 172, 160] },
  { name: '요새', half: 1.9, roof: 2.6, deck: 1.9, material: [176, 172, 160] },
];
const bunkerInfo = (L = G.bunker) => BUNKER_FORMS[bunkerForm(L)];
// coarse progress of the base for the crew's kit: helmets from 2, vests from 4 (0..5)
const gearTier = () => Math.min(5, Math.floor(bunkerForm() * 6 / BUNKER_FORMS.length));
const bunkerHp = L => Math.round(150 * 1.16 ** (L - 1));
// the price of the next level, L -> L + 1
const bunkerCost = L => { const c = { money: Math.ceil(40 * 1.24 ** L) }; if (L >= 4) c.food = Math.ceil(8 * 1.2 ** (L - 4)); if (L >= 8) c.mineral = Math.ceil(5 * 1.24 ** (L - 8)); return c; };
// material: the colour of the splinters when it is hit; metal: it clangs; electric: it shocks whoever hits it
const FENCE_FORMS = [
  { name: '나무 말뚝', material: [146, 104, 66] },
  { name: '판자 울타리', material: [176, 132, 84] },
  { name: '철조망', material: [44, 40, 50], metal: true },
  { name: '강철 바리케이드', material: [112, 122, 132], metal: true },
  { name: '콘크리트 방벽', material: [176, 172, 160], metal: true },
  { name: '전기 철책', material: [112, 122, 132], metal: true, electric: true },
];
const fenceInfo = (L = G.fence) => FENCE_FORMS[fenceForm(L)];
const fenceHp = L => L ? Math.round(120 * 1.17 ** (L - 1)) : 0;
const fenceCost = L => { const c = { money: Math.ceil(30 * 1.24 ** L) }; if (L >= 10) c.mineral = Math.ceil(4 * 1.24 ** (L - 10)); return c; };
const BUNKER_EXTRAS = [
  ['모래주머니 참호', '탄약 상자', '모래주머니 2층', '랜턴', '표지판과 물통'],
  ['나무 망루', '버팀목', '망루 난간', '보급 상자', '등불', '깃발'],
  ['컨테이너 초소', '문 잠금쇠', '강판 난간', '번호판', '탐조등', '안테나'],
  ['콘크리트 벙커', '철문', '풍화 자국', '무전 안테나와 깃발', '환풍구', '벽등', '난간 철조망'],
  ['강화 벙커', '위장 도색', '기관총 거치대', '탐조등', '장갑 해치', '안테나 배열', '경고 줄무늬 문'],
  ['요새', '망루', '레이더', '투광등', '현수막', '두 번째 망루', '회전 경광등', '레일 포탑', '금색 문장'],
];
const FENCE_EXTRAS = [
  ['나무 말뚝', '밧줄 연결', '말뚝 추가', '붉은 끝 도색', '모서리 등불'],
  ['판자 울타리', '흰 칠', '검은 못 윗단', '검은 기둥', '모서리 등', '경고판'],
  ['철조망', '세 가닥', '윗단 코일', '깡통 경보기', '경고판', '모서리 등'],
  ['강철 바리케이드', '연결 빔', '경고 도색', '두 번째 줄', '가시', '모서리 등', '검은 도장'],
  ['콘크리트 방벽', '경고 줄무늬', '반사등', '윗단 철망', '모서리 등', '가시', '번호'],
  ['전기 철책', '절연체', '고압 경고판', '점멸등', '안쪽 전선', '불꽃', '배선 덮개', '변압기', '푸른 전류'],
];
// what level L adds (or the new form's name, on the first level of a form)
const bunkerAddName = L => BUNKER_EXTRAS[bunkerForm(L)][bunkerSub(L)] || '';
const fenceAddName = L => FENCE_EXTRAS[fenceForm(L)][fenceSub(L)] || '';
const isNewBunkerForm = L => BUNKER_FORM_AT.includes(L), isNewFenceForm = L => FENCE_FORM_AT.includes(L);
