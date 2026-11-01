'use strict';
// The floors below: the living quarters (beds), the farm and the mine: levels, what each adds, output and price.
// (How they look is in under.js.) Each floor has 40 levels and every level adds one thing you can see.
const LIVE = { max: 40, beds: [1, 3, 5, 8, 12], cost: L => { const c = { money: Math.ceil(50 * 1.42 ** L) }; if (L >= 3) c.mineral = Math.ceil(6 * 1.4 ** (L - 3)); return c; } };
// the living floor: beds at the bed levels (each bed is a place to hire someone), then it fills up, and its walls
// and floor change material: earth, planks, paint, tiles
const LIVE_ITEMS = [
  '야전 침대', '판자 바닥', '철제 침대', '백열 전구', '나무 침대', '나무 식탁', '무전기', '접이식 침대', '판자 벽', '장작 난로',
  '책장', '원목 침대', '러그', '사물함', '조리대와 개수대', '소파', '텔레비전', '벽 페인트', '냉장고', '화분',
  '포스터', '전구 줄', '식탁보와 의자', '안락의자', '샌드백', '벽 선반', '구급함', '정수기', '샤워 부스', '타일 벽',
  '탁구대', '지도 벽', '커피 테이블', '빨래줄', '마루 바닥', '천장 조명', '어항', '오락기', '환기 덕트', '벙커 엠블럼',
];
const bedsOf = L => LIVE.beds.filter(b => L >= b).length;
const FARM = { max: 40, rate: L => L ? .35 * L * 1.05 ** L : 0, cost: L => ({ money: Math.ceil(20 * 1.45 ** L) }) };
const MINE = { max: 40, rate: L => L ? .25 * L * 1.07 ** L : 0, cost: L => ({ money: Math.ceil(50 * 1.5 ** L) }) };
// the farm and the mine change form every eight levels (levels 1, 9, 17, 25, 33); the levels in between add
// rows, growth and equipment
const FARM_TIERS = ['흙밭', '나무 화분대', '생장등 선반', '수경 재배', '자동 수직 농장'];
const MINE_TIERS = ['손 곡괭이 갱', '갱목 갱도', '시추탑', '굴착기 갱도', '대형 채굴 플랜트'];
const facTier = L => L < 9 ? 0 : L < 17 ? 1 : L < 25 ? 2 : L < 33 ? 3 : 4;
const FARM_ITEMS = [
  '흙 이랑', '물뿌리개', '상추 이랑', '씨앗 자루', '당근 이랑', '퇴비 상자', '감자 이랑', '물 저장통',
  '나무 화분대', '물 호스', '토마토 지지대', '모종 작업대', '딸기 걸이 화분', '환풍기', '물탱크', '수확 상자',
  '생장등 선반', '보라색 LED', '모종판 수레', '가습기', '버섯 재배대', '양액 통', '온도 제어반', '선별대',
  '수경 탱크', '순환 파이프', '양액 펌프', '기포 발생기', '여과 장치', '물고기 수조', '공조기', '제어 컴퓨터',
  '수직 재배탑', '로봇 팔', '컨베이어 벨트', '자동 포장기', '수확 로봇', 'LED 패널 벽', '저온 저장고', 'AI 관제 콘솔',
];
const MINE_ITEMS = [
  '도르래 구덩이', '곡괭이 걸이', '카바이드 등', '광석 양동이', '손수레', '나무 버팀목', '청광석 광맥', '선별 체',
  '갱목 갱도', '광차 레일', '광차', '갱도 전등', '분기 레일', '광석 슈트', '송풍기', '화약 상자',
  '시추탑', '발전기', '배전반', '시추관 더미', '공기 압축기', '경광등', '철골 버팀대', '광석 호퍼',
  '굴착기와 컨베이어', '안전 난간', '광석 분류 통', '조명 타워', '소형 기관차', '광차 열차', '집진기', '통제실',
  '분쇄기', '진동 체', '제련로', '이중 컨베이어', '천장 크레인', '버킷 엘리베이터', '채굴 로봇', '크리스탈 광맥',
];
