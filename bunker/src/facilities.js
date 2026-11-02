'use strict';
// The floors below: the living quarters (beds), the farm and the mine: levels, how their look grows, output and
// price. (How they look is in under.js.) Levels have no real cap. Gold buys levels; every 50 levels the next
// purchase is a breakthrough (materials and three times the gold), the only moment a floor's look changes.
// Prices mix the resources: the living floor takes ore (and later food), the farm takes ore, the mine takes food,
// so each floor leans on another. Output grows about 10% a level on top of the level itself, enough to keep up
// with the money a later wave brings in (checked with the economy simulation: neither store sits full for long)
const BREAK_EVERY = 50, ERA_EVERY = 25, FAC_MAX = 30000;
// the purchase from level L is a breakthrough (L = 50, 100, 150, ...)
const facBreak = (kind, L) => L > 0 && L % BREAK_EVERY === 0;
// a breakthrough costs three times the gold, plus food and ore (about 30·k² each for the k-th)
function breakCost(kind, L, c) {
  if (!facBreak(kind, L)) return c;
  const k = L / BREAK_EVERY, m = Math.ceil(30 * k * k);
  c.money *= 3; c.food = (c.food || 0) + m; c.mineral = (c.mineral || 0) + m;
  return c;
}
const LIVE = { max: FAC_MAX, beds: [1, 3, 5, 8, 12], cost: L => {
  const c = { money: Math.ceil(50 * 1.4 ** L) };
  if (L >= 3) c.mineral = Math.ceil(c.money * Math.min(.15, .05 + (L - 3) * .005));
  if (L >= 6) c.food = Math.ceil(c.money * Math.min(.3, .1 + (L - 6) * .01));
  return breakCost('live', L, c);
} };
const bedsOf = L => LIVE.beds.filter(b => L >= b).length;
const FARM = { max: FAC_MAX, rate: L => L ? .22 * L * 1.1 ** L : 0, cost: L => {
  const c = { money: Math.ceil(20 * 1.4 ** L) };
  if (L >= 5) c.mineral = Math.ceil(c.money * Math.min(.15, .04 + (L - 5) * .005));
  return breakCost('farm', L, c);
} };
const MINE = { max: FAC_MAX, rate: L => L ? .28 * L * 1.1 ** L : 0, cost: L => {
  const c = { money: Math.ceil(40 * 1.42 ** L) };
  if (L >= 3) c.food = Math.ceil(c.money * Math.min(.5, .15 + (L - 3) * .015));
  return breakCost('mine', L, c);
} };
// what a floor makes a second with n workers at it: each worker adds the floor's own output again, plus a little
// (live in crew.js rateOf, offline in state.js creditAway)
const outputOf = (res, n) => (res === 'food' ? FARM.rate(G.farm) : MINE.rate(G.mine)) * (1 + n) + n * .2;

/* ================= the look: components × stages ================= */
// Each floor is made of components, and each component has a ladder of stages, era by era. A breakthrough moves
// one component one stage up its era's ladder, in the order of the floor's turn list (24 turns); the 25th
// breakthrough jumps the whole room to the next era, where every component starts on that era's first stage.
// Past the end of a ladder (and in every era past the last) a component climbs material grades instead, so the
// look never stops changing. More stages: add names to a ladder here and drawings to the same row in under.js.
const FAC_ERAS = ['임시', '군용', '산업', '미래', '그 이후'];
const FAC_GRADES = ['청동', '은', '금', '백금', '수정', '루비', '에메랄드', '사파이어', '자수정', '흑요석'];
const FAC_LOOK = {
  mine: {
    first: '손 곡괭이 갱', build: '도르래 구덩이',
    // in the order of the client's ladder: jackhammer, wheelbarrow and timbering, rails and carts, electric drill, ore
    // chute and sorter, generator and drilling rig, conveyor, ...
    turns: ['drill', 'rails', 'supports', 'light', 'rails', 'drill', 'conveyor', 'crusher', 'power', 'drill', 'conveyor', 'tools',
      'storage', 'vent', 'light', 'drill', 'crusher', 'power', 'supports', 'storage', 'tools', 'vent', 'rails', 'drill'],
    parts: {
      drill: ['드릴', [
        ['도르래 구덩이', '착암기 틀', '전동 드릴탑', '시추 리그', '디젤 시추 리그', '대형 코어 드릴'],
        ['군용 코어 드릴', '장갑 코어 드릴', '굴착기', '대형 굴착기', '쌍둥이 드릴', '중장 쌍둥이 드릴'],
        ['터널 굴착기', '대형 터널 굴착기', '정련 드릴 플랜트'],
        ['채굴 로봇', '레이저 드릴', '플라스마 드릴'],
        ['크리스탈 심층 추출기']]],
      rails: ['레일·광차', [['맨손 운반', '외바퀴 손수레', '나무 레일과 광차', '광차 행렬'], ['강철 레일과 광차', '디젤 기관차', '광차 열차', '이중 선로'], ['전기 기관차'], ['자기부상 광차'], ['중력 운반로']]],
      light: ['조명', [['랜턴', '카바이드 등', '갱도 전구 줄'], ['철망 작업등', '투광등', '조명탑'], ['나트륨 조명탑'], ['LED 천장'], ['수정 발광등']]],
      supports: ['버팀목', [['맨 바위 기둥', '나무 버팀목', '갱목 틀'], ['강철 아치', '록볼트와 철망', '숏크리트 벽'], ['철골 보강'], ['역장 버팀'], ['수정 기둥']]],
      conveyor: ['컨베이어', [['양동이 운반', '나무 광석 슈트', '손 크랭크 벨트'], ['벨트 컨베이어', '경사 컨베이어', '이중 컨베이어'], ['버킷 엘리베이터'], ['자동 컨베이어망'], ['부유 운반 고리']]],
      crusher: ['분쇄·처리', [['손 선별', '선별 체', '손 파쇄기'], ['조 크러셔', '진동 체', '분쇄 라인'], ['분쇄 플랜트', '제련로'], ['정련기'], ['결정 합성기']]],
      storage: ['광석 저장', [['광석 더미', '광석 바구니', '광석 상자'], ['강철 광석 통', '광석 호퍼', '광석 사일로'], ['대형 사일로'], ['자동 저장고'], ['수정 저장고']]],
      power: ['발전·전력', [['전기 없음', '디젤 발전기', '배전반'], ['야전 발전기', '변압기', '전력 케이블망'], ['발전소'], ['핵융합 전지'], ['에너지 결정로']]],
      vent: ['환기', [['자연 환기', '손 풀무', '송풍기'], ['환기 덕트', '대형 환기팬', '집진기'], ['환기탑'], ['공기 정화기'], ['대기 생성기']]],
      tools: ['일꾼 도구', [['맨손 도구', '곡괭이 걸이', '화약 상자'], ['공구 사물함', '착암기 거치대', '정비 작업대'], ['유압 공구대'], ['로봇 정비대'], ['수정 공구']]],
    },
  },
  farm: {
    first: '흙밭', build: '흙 이랑',
    turns: ['planters', 'irrigation', 'lights', 'storage', 'planters', 'sorting', 'climate', 'irrigation', 'planters', 'robots', 'lights', 'storage',
      'planters', 'sorting', 'irrigation', 'climate', 'planters', 'lights', 'robots', 'storage', 'planters', 'sorting', 'climate', 'irrigation'],
    parts: {
      planters: ['재배대', [
        ['흙 이랑', '심은 이랑', '판자 두둑', '나무 화분대', '2단 화분대', '지지대 화분대', '덩굴 시렁'],
        ['철제 재배 트레이', '2단 철제 트레이', '재배 텐트', '생장등 트레이', '3단 트레이', '자동 급수 트레이', '군용 재배 라인'],
        ['생장등 선반', '수경 재배조', '양액 순환 재배조'],
        ['수직 재배탑', '자동 수직 농장'],
        ['공중 정원']]],
      irrigation: ['관개', [['물 없음', '물뿌리개와 빗물통', '물탱크와 호스', '물길 수로', '점적 호스'], ['군용 물탱크', '급수 펌프', '정수기', '스프링클러', '양액 탱크'], ['순환 파이프'], ['양액 자동 제어'], ['안개 관개']]],
      lights: ['조명', [['벽 램프', '이랑 위 전구 줄', '반사갓 등', '생장 전구'], ['철망 작업등', '나트륨등', '생장등 줄', '생장등 천장'], ['LED 패널'], ['LED 패널 벽'], ['인공 태양']]],
      storage: ['저장', [['저장 없음', '씨앗 자루', '퇴비 상자', '뿌리 저장고'], ['보급 상자', '식량 선반', '저장 창고', '냉장 상자'], ['저온 저장고'], ['자동 저장고'], ['시간 정지 저장고']]],
      sorting: ['선별', [['선별 없음', '수확 바구니', '선별대', '세척 통'], ['군용 선별대', '세척대', '포장대', '선별 라인'], ['선별 컨베이어'], ['자동 포장기'], ['분자 분류기']]],
      climate: ['온도 조절', [['자연 그대로', '장작 난로', '환풍기', '가습 항아리'], ['야전 히터', '송풍기', '가습기', '온도 제어반'], ['공조기'], ['기후 제어실'], ['기상 생성기']]],
      robots: ['로봇', [['일손뿐', '손수레', '모종판 수레'], ['운반 카트', '자동 카트', '원격 카트'], ['로봇 팔'], ['수확 로봇'], ['정원 정령']]],
    },
  },
  live: {
    first: '생활층', build: '야전 침대',
    turns: ['beds', 'kitchen', 'lighting', 'lounge', 'decor', 'lockers', 'beds', 'shower', 'kitchen', 'lounge', 'lighting', 'decor',
      'beds', 'lockers', 'kitchen', 'shower', 'lounge', 'decor', 'beds', 'lighting', 'kitchen', 'lockers', 'lounge', 'decor'],
    parts: {
      beds: ['침대', [['야전 침대', '나무 침대', '짚 매트리스', '원목 침대', '침대 커튼'], ['철제 2층 침대', '2층 침대 사물칸', '2층 침대 커튼', '침대 조명', '장교 침대'], ['캡슐 침대'], ['수면 캡슐'], ['부유 침대']]],
      kitchen: ['주방', [['물통과 상자', '장작 난로', '판자 조리대', '찬장', '물 항아리'], ['야전 주방', '철제 조리대', '대형 솥', '배식대', '식기 선반'], ['업소용 주방'], ['자동 조리기'], ['분자 요리기']]],
      lighting: ['조명', [['랜턴', '벽 램프', '전구 줄', '전구 장식'], ['철망 전등', '형광등', '비상등', '천장 조명'], ['산업용 조명'], ['LED 천장'], ['빛의 정원']]],
      lounge: ['휴게', [['짐 더미', '상자 탁자와 라디오', '나무 벤치', '낡은 소파', '러그'], ['식탁과 의자', '무전기 탁자', '카드 탁자', '탁구대', '영사기'], ['휴게실'], ['홀로그램 라운지'], ['꿈의 방']]],
      decor: ['장식', [['흙벽', '판자 바닥', '판자 벽', '포스터', '작전 지도'], ['페인트 벽', '부대 깃발', '훈장 액자', '지도 벽', '벙커 엠블럼'], ['타일 벽'], ['패널 벽'], ['수정 벽']]],
      lockers: ['사물함', [['사물 궤짝', '나무 선반', '옷걸이', '철제 사물함'], ['군용 사물함', '무기 거치대', '장비 선반', '개인 금고'], ['강철 보관함'], ['자동 보관함'], ['차원 보관함']]],
      shower: ['샤워', [['빨래 대야', '양동이 샤워', '나무 칸막이 샤워'], ['군용 샤워 부스', '온수 샤워', '세면대 줄'], ['타일 욕실'], ['자동 세정실'], ['빛 샤워']]],
    },
  },
};
// breakthroughs bought by level L: the purchase from level 50 is the first, so its look shows from level 51
const facTier = L => L > 0 ? Math.floor((L - 1) / BREAK_EVERY) : 0;
// a floor at level L: its era, each component's stage within the era's ladder and its material grade
function facLook(kind, L) {
  const F = FAC_LOOK[kind], b = facTier(L), era = Math.floor(b / ERA_EVERY), top = FAC_ERAS.length - 1, e = Math.min(era, top);
  const look = { b, era: e, eraGrade: era - e, step: {}, grade: {} }, n = {};
  // each component's turns so far this era; past the last era it keeps climbing from where it stood
  for (const k in F.parts) n[k] = 0;
  F.turns.forEach((k, i) => { n[k] += era - e + (i < b % ERA_EVERY ? 1 : 0); });
  for (const k in F.parts) { const last = F.parts[k][1][e].length - 1; look.step[k] = Math.min(n[k], last); look.grade[k] = n[k] - look.step[k]; }
  return look;
}
const facGradeName = g => g ? FAC_GRADES[(g - 1) % FAC_GRADES.length] + (g > FAC_GRADES.length ? ' ' + (Math.floor((g - 1) / FAC_GRADES.length) + 1) : '') : '';
// what breakthrough b brings: the next era at every 25th, else its component's new stage (or grade)
function facStepName(kind, b) {
  const F = FAC_LOOK[kind];
  if (b <= 0) return F.first;
  if (b % ERA_EVERY === 0) { const e = b / ERA_EVERY, top = FAC_ERAS.length - 1; return FAC_ERAS[Math.min(e, top)] + (e > top ? ' ' + (e - top + 1) : '') + ' 시대'; }
  const k = F.turns[b % ERA_EVERY - 1], lk = facLook(kind, b * BREAK_EVERY + 1), g = lk.grade[k];
  return F.parts[k][1][lk.era][lk.step[k]] + (g ? ' · ' + facGradeName(g) : '');
}
// what the floor card says comes next: the floor itself, a bed while the hire slots open, then the next
// breakthrough and what it brings
function facNext(kind, L) {
  if (!L) return FAC_LOOK[kind].build;
  if (kind === 'live' && LIVE.beds.includes(L + 1)) return '침대';
  const at = Math.ceil(L / BREAK_EVERY) * BREAK_EVERY;
  return (at > L ? 'Lv ' + at + ' ' : '') + '돌파 · ' + facStepName(kind, at / BREAK_EVERY);
}
// the lists the floor cards read (by breakthrough, and by level), worked out when read
const facList = f => new Proxy([], { get: (a, k) => typeof k === 'string' && /^\d+$/.test(k) ? f(+k) : a[k] });
const FARM_TIERS = facList(b => facStepName('farm', b)), MINE_TIERS = facList(b => facStepName('mine', b));
const LIVE_ITEMS = facList(L => facNext('live', L)), FARM_ITEMS = facList(L => facNext('farm', L)), MINE_ITEMS = facList(L => facNext('mine', L));
