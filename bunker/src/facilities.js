'use strict';
// The floors below: the living quarters (beds), the farm and the mine: levels, how their look grows, output and
// price. (How they look is in under.js.) Levels have no real cap. Gold buys levels; every 50 levels the next
// purchase is a breakthrough (materials and three times the gold), the only moment a floor's look changes.
// Prices mix the resources: the living floor takes ore (and later food), the farm takes ore, the mine takes food,
// so each floor leans on another. Output grows about 10% a level on top of the level itself, enough to keep up
// with the money a later wave brings in (checked with the economy simulation: neither store sits full for long)
const FAC_BREAK = 50, FAC_ERA_EVERY = 25, FAC_MAX = 30000;
// the purchase from level L is a breakthrough (L = 50, 100, 150, ...)
const facBreak = (kind, L) => L > 0 && L % FAC_BREAK === 0;
// a breakthrough costs three times the gold, plus food and ore (about 30·k² each for the k-th)
function breakCost(kind, L, c) {
  if (!facBreak(kind, L)) return c;
  const k = L / FAC_BREAK, m = Math.ceil(30 * k * k);
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

/* ================= the look: the old game's forms first, then eras of parts × stages ================= */
// The first breakthroughs bring back the game as it looked up to level 40, FAC_TODAY of its levels at a time (one
// constant, for the economy to retune): breakthrough b shows at least everything the old level min(40, FAC_TODAY·b)
// showed (facTodayLevel), so no breakthrough looks plainer than the old game at the same point. The old game's five
// forms are the first five eras, each starting as soon as that rule reaches it (facEraAt); the military era follows at
// breakthrough FAC_MIL_AT and a new era every 25 after. Past level 40's look, and from the military era on, each
// breakthrough moves one part one stage up its era's ladder (turns); a new era's first stage keeps the furnishing
// of the one before (under.js). Past the end of a ladder, and in every era past the last, a part climbs material
// grades instead, so the look never stops changing. More stages: add names here and drawings in under.js.
const FAC_TODAY = 8, FAC_TODAY_MAX = 40, FAC_TODAY_AT = [1, 9, 17, 25, 33], FAC_MIL_AT = 14;
// the old game's form at its level L (it changed every eight levels), and the old level breakthrough b shows
const facOldTier = L => L < 9 ? 0 : L < 17 ? 1 : L < 25 ? 2 : L < 33 ? 3 : 4;
const facTodayLevel = b => b ? Math.min(FAC_TODAY_MAX, FAC_TODAY * b) : 1;
// the breakthrough where era e starts: the old forms 0-4, then military, industrial, future, beyond, beyond 2, ...
const facEraAt = e => e < 5 ? (e ? Math.ceil(FAC_TODAY_AT[e] / FAC_TODAY) : 0) : FAC_MIL_AT + (e - 5) * FAC_ERA_EVERY;
const facEraOf = b => { let e = 0; while (facEraAt(e + 1) <= b) e++; return e; };
const FAC_ERAS = ['군용', '산업', '미래', '그 이후'];
const FAC_GRADES = ['청동', '은', '금', '백금', '수정', '루비', '에메랄드', '사파이어', '자수정', '흑요석'];
const FAC_LOOK = {
  mine: {
    build: '도르래 구덩이',
    forms: ['손 곡괭이 갱', '갱목 갱도', '시추탑', '굴착기 갱도', '대형 채굴 플랜트'],
    today: ['도르래 구덩이', '곡괭이 걸이', '카바이드 등', '광석 양동이', '손수레', '나무 버팀목', '청광석 광맥', '선별 체',
      '갱목 갱도', '광차 레일', '광차', '갱도 전등', '분기 레일', '광석 슈트', '송풍기', '화약 상자',
      '시추탑', '발전기', '배전반', '시추관 더미', '공기 압축기', '경광등', '철골 버팀대', '광석 호퍼',
      '굴착기와 컨베이어', '안전 난간', '광석 분류 통', '조명 타워', '소형 기관차', '광차 열차', '집진기', '통제실',
      '분쇄기', '진동 체', '제련로', '이중 컨베이어', '천장 크레인', '버킷 엘리베이터', '채굴 로봇', '크리스탈 광맥'],
    turns: ['drill', 'rails', 'supports', 'light', 'rails', 'drill', 'conveyor', 'crusher', 'power', 'drill', 'conveyor', 'tools',
      'storage', 'vent', 'light', 'drill', 'crusher', 'power', 'supports', 'storage', 'tools', 'vent', 'rails', 'drill'],
    parts: {
      drill: ['드릴', [['군용 코어 드릴', '장갑 코어 드릴', '대형 굴착기', '쌍둥이 드릴', '중장 쌍둥이 드릴', '초대형 코어 드릴'],
        ['터널 굴착기', '대형 터널 굴착기', '정련 드릴 플랜트'], ['채굴 로봇', '레이저 드릴', '플라스마 드릴'], ['크리스탈 심층 추출기']]],
      rails: ['레일·광차', [['군용 광차 열차', '강철 레일과 광차', '디젤 기관차 2량', '이중 선로'], ['전기 기관차'], ['자기부상 광차'], ['중력 운반로']]],
      light: ['조명', [['철망 작업등', '투광등', '조명탑'], ['나트륨 조명탑'], ['LED 천장'], ['수정 발광등']]],
      supports: ['버팀목', [['강철 아치', '록볼트와 철망', '숏크리트 벽'], ['철골 보강'], ['역장 버팀'], ['수정 기둥']]],
      conveyor: ['컨베이어', [['군용 컨베이어', '벨트 컨베이어', '경사 컨베이어'], ['버킷 엘리베이터'], ['자동 컨베이어망'], ['부유 운반 고리']]],
      crusher: ['분쇄·처리', [['군용 분쇄기', '조 크러셔', '분쇄 라인'], ['분쇄 플랜트', '제련로'], ['정련기'], ['결정 합성기']]],
      storage: ['광석 저장', [['강철 광석 통', '광석 호퍼', '광석 사일로'], ['대형 사일로'], ['자동 저장고'], ['수정 저장고']]],
      power: ['발전·전력', [['군용 배전', '야전 발전기', '전력 케이블망'], ['발전소'], ['핵융합 전지'], ['에너지 결정로']]],
      vent: ['환기', [['군용 환기', '환기 덕트', '집진기'], ['환기탑'], ['공기 정화기'], ['대기 생성기']]],
      tools: ['일꾼 도구', [['군용 공구', '공구 사물함', '정비 작업대'], ['유압 공구대'], ['로봇 정비대'], ['수정 공구']]],
    },
  },
  farm: {
    build: '흙 이랑',
    forms: ['흙밭', '나무 화분대', '생장등 선반', '수경 재배', '자동 수직 농장'],
    today: ['흙 이랑', '물뿌리개', '상추 이랑', '씨앗 자루', '당근 이랑', '퇴비 상자', '감자 이랑', '물 저장통',
      '나무 화분대', '물 호스', '토마토 지지대', '모종 작업대', '딸기 걸이 화분', '환풍기', '물탱크', '수확 상자',
      '생장등 선반', '보라색 LED', '모종판 수레', '가습기', '버섯 재배대', '양액 통', '온도 제어반', '선별대',
      '수경 탱크', '순환 파이프', '양액 펌프', '기포 발생기', '여과 장치', '물고기 수조', '공조기', '제어 컴퓨터',
      '수직 재배탑', '로봇 팔', '컨베이어 벨트', '자동 포장기', '수확 로봇', 'LED 패널 벽', '저온 저장고', 'AI 관제 콘솔'],
    turns: ['planters', 'irrigation', 'lights', 'storage', 'planters', 'sorting', 'climate', 'irrigation', 'planters', 'robots', 'lights', 'storage',
      'planters', 'sorting', 'irrigation', 'climate', 'planters', 'lights', 'robots', 'storage', 'planters', 'sorting', 'climate', 'irrigation'],
    parts: {
      planters: ['재배대', [['군용 수직 재배탑', '철제 재배 트레이', '재배 텐트', '3단 트레이', '자동 급수 트레이', '군용 재배 라인', '대형 재배탑'],
        ['양액 순환 재배조'], ['자동 수직 농장'], ['공중 정원']]],
      irrigation: ['관개', [['군용 물탱크', '급수 펌프', '정수기', '스프링클러', '양액 탱크'], ['순환 파이프'], ['양액 자동 제어'], ['안개 관개']]],
      lights: ['조명', [['철망 작업등', '나트륨등', '생장등 줄', '생장등 천장'], ['LED 패널'], ['LED 패널 벽'], ['인공 태양']]],
      storage: ['저장', [['보급 상자', '식량 선반', '저장 창고', '냉장 상자'], ['저온 저장고'], ['자동 저장고'], ['시간 정지 저장고']]],
      sorting: ['선별', [['군용 선별대', '세척대', '포장대', '선별 라인'], ['선별 컨베이어'], ['자동 포장기'], ['분자 분류기']]],
      climate: ['온도 조절', [['야전 히터', '송풍기', '가습기', '온도 제어반'], ['공조기'], ['기후 제어실'], ['기상 생성기']]],
      robots: ['로봇', [['운반 카트', '자동 카트', '원격 카트'], ['로봇 팔'], ['수확 로봇'], ['정원 정령']]],
    },
  },
  live: {
    build: '야전 침대',
    forms: ['흙방', '판자방', '페인트방', '타일방', '마루방'],
    today: ['야전 침대', '판자 바닥', '철제 침대', '백열 전구', '나무 침대', '나무 식탁', '무전기', '접이식 침대', '판자 벽', '장작 난로',
      '책장', '원목 침대', '러그', '사물함', '조리대와 개수대', '소파', '텔레비전', '벽 페인트', '냉장고', '화분',
      '포스터', '전구 줄', '식탁보와 의자', '안락의자', '샌드백', '벽 선반', '구급함', '정수기', '샤워 부스', '타일 벽',
      '탁구대', '지도 벽', '커피 테이블', '빨래줄', '마루 바닥', '천장 조명', '어항', '오락기', '환기 덕트', '벙커 엠블럼'],
    turns: ['beds', 'kitchen', 'lighting', 'lounge', 'decor', 'lockers', 'beds', 'shower', 'kitchen', 'lounge', 'lighting', 'decor',
      'beds', 'lockers', 'kitchen', 'shower', 'lounge', 'decor', 'beds', 'lighting', 'kitchen', 'lockers', 'lounge', 'decor'],
    parts: {
      beds: ['침대', [['철제 2층 침대', '2층 침대 사물칸', '2층 침대 커튼', '침대 조명', '장교 침대'], ['캡슐 침대'], ['수면 캡슐'], ['부유 침대']]],
      kitchen: ['주방', [['군용 주방', '야전 주방', '대형 솥', '배식대', '식기 선반'], ['업소용 주방'], ['자동 조리기'], ['분자 요리기']]],
      lighting: ['조명', [['군용 조명', '철망 전등', '비상등', '천장 조명'], ['산업용 조명'], ['LED 천장'], ['빛의 정원']]],
      lounge: ['휴게', [['군용 휴게실', '식탁과 벤치', '무전기 탁자', '카드 탁자', '영사기'], ['휴게실'], ['홀로그램 라운지'], ['꿈의 방']]],
      decor: ['장식', [['부대 깃발', '페인트 벽', '훈장 액자', '작전 지도', '벙커 엠블럼'], ['패널 벽'], ['수정 벽'], ['빛의 벽']]],
      lockers: ['사물함', [['강철 사물함', '무기 거치대', '장비 선반', '개인 금고'], ['강철 보관함'], ['자동 보관함'], ['차원 보관함']]],
      shower: ['샤워', [['군용 샤워', '샤워 부스', '세면대 줄'], ['타일 욕실'], ['자동 세정실'], ['빛 샤워']]],
    },
  },
};
// breakthroughs bought by level L: the purchase from level 50 is the first, so its look shows from level 51
const facTier = L => L > 0 ? Math.floor((L - 1) / FAC_BREAK) : 0;
// a floor at level L: its era, the old level it shows, each part's stage on its era's ladder and its grade. Parts
// climb from the military era on, and in the last old form once level 40's look is reached (grades only there)
function facLook(kind, L) {
  const F = FAC_LOOK[kind], b = facTier(L), era = facEraOf(b), later = era >= 5, e = Math.min(era - 5, 3);
  const look = { b, era, today: facTodayLevel(b), step: {}, grade: {} }, n = {};
  const turns = later ? b - facEraAt(era) : Math.max(0, b - Math.ceil(FAC_TODAY_MAX / FAC_TODAY));
  for (const k in F.parts) n[k] = 0;
  F.turns.forEach((k, j) => { n[k] += (later ? era - 5 - e : 0) + (j < turns ? 1 : 0); });
  for (const k in F.parts) { const last = later ? F.parts[k][1][e].length - 1 : 0; look.step[k] = Math.min(n[k], last); look.grade[k] = n[k] - look.step[k]; }
  return look;
}
const facGradeName = g => g ? FAC_GRADES[(g - 1) % FAC_GRADES.length] + (g > FAC_GRADES.length ? ' ' + (Math.floor((g - 1) / FAC_GRADES.length) + 1) : '') : '';
// what breakthrough b brings: an era's name at its start; the old game's items it brings back; else its part's new
// stage (or grade)
function facStepName(kind, b) {
  const F = FAC_LOOK[kind], era = facEraOf(Math.max(0, b));
  if (b <= 0) return F.forms[0];
  if (b === facEraAt(era)) return era < 5 ? F.forms[era] : FAC_ERAS[Math.min(era - 5, 3)] + (era > 8 ? ' ' + (era - 7) : '') + ' 시대';
  const lo = facTodayLevel(b - 1), hi = facTodayLevel(b);
  if (hi > lo) { const names = F.today.slice(lo, hi); return names.slice(0, 2).join('·') + (names.length > 2 ? ' 외 ' + (names.length - 2) : ''); }
  const j = (era >= 5 ? b - facEraAt(era) : b - Math.ceil(FAC_TODAY_MAX / FAC_TODAY)) - 1, k = F.turns[j % F.turns.length], lk = facLook(kind, b * FAC_BREAK + 1), g = lk.grade[k];
  return F.parts[k][0] + (era >= 5 ? ' · ' + F.parts[k][1][Math.min(era - 5, 3)][lk.step[k]] : '') + (g ? ' · ' + facGradeName(g) : '');
}
// what the floor card says comes next: the floor itself, a bed while the hire slots open, then the next
// breakthrough and what it brings
function facNext(kind, L) {
  if (!L) return FAC_LOOK[kind].build;
  if (kind === 'live' && LIVE.beds.includes(L + 1)) return '침대';
  const at = Math.ceil(L / FAC_BREAK) * FAC_BREAK;
  return (at > L ? 'Lv ' + at + ' ' : '') + '돌파 · ' + facStepName(kind, at / FAC_BREAK);
}
// the lists the floor cards read (by breakthrough, and by level), worked out when read
const facList = f => new Proxy([], { get: (a, k) => typeof k === 'string' && /^\d+$/.test(k) ? f(+k) : a[k] });
const FARM_TIERS = facList(b => facStepName('farm', b)), MINE_TIERS = facList(b => facStepName('mine', b));
const LIVE_ITEMS = facList(L => facNext('live', L)), FARM_ITEMS = facList(L => facNext('farm', L)), MINE_ITEMS = facList(L => facNext('mine', L));
