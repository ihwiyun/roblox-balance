'use strict';
// The floors below: the living quarters (beds), the farm and the mine: levels, what each adds, output and price.
// (How they look is in under.js.)
const LIVE = { max: 15, beds: [1, 3, 5, 8, 12], cost: L => { const c = { money: Math.ceil(50 * 1.42 ** L) }; if (L >= 3) c.mineral = Math.ceil(6 * 1.4 ** (L - 3)); return c; } };
const LIVE_ITEMS = ['침대', '러그', '침대', '천장 전등', '침대', '식탁과 의자', '무전기', '침대', '난로', '냉장고', '책장', '침대', '화분', '텔레비전', '소파'];
const bedsOf = L => LIVE.beds.filter(b => L >= b).length;
const FARM = { max: 25, rate: L => L ? .35 * L * 1.05 ** L : 0, cost: L => ({ money: Math.ceil(20 * 1.45 ** L) }) };
const MINE = { max: 25, rate: L => L ? .25 * L * 1.07 ** L : 0, cost: L => ({ money: Math.ceil(50 * 1.5 ** L) }) };
const FARM_TIERS = ['흙 화단', '재배 선반', '수경 탱크', '자동 재배실'], MINE_TIERS = ['손 도르래', '시추탑', '굴착기', '대형 채굴 플랜트'];
const facTier = L => L < 4 ? 0 : L < 8 ? 1 : L < 15 ? 2 : 3;
const FARM_ITEMS = ['흙 화단', '물통', '화단 추가', '화단 추가', '재배 선반', '환풍기', '씨앗 자루', '선반 추가', '수경 탱크', '탱크 연장', '탱크 연장', '탱크 연장', '탱크 연장', '탱크 연장', '탱크 연장', '자동 재배실', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동'];
const MINE_ITEMS = ['손 도르래', '버팀목', '레일', '광차', '시추탑', '작업등', '두 번째 광차', '광차 적재', '굴착기', '컨베이어', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '대형 채굴 플랜트', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재'];
