// node bunker/tests/sim/timeline.mjs [days] [seed]  ->  tests/sim/timeline.json and timeline.md
// What happens in a 12-week run of the human bot (F2P, light, heavy; 1.75 h a day in four sessions): the event log,
// weekly snapshots, weekly flows by source and sink, the weekly power breakdown and what the bot waited for.
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROFILES = ['f2p', 'light', 'heavy'];

/* ---------- markdown ---------- */
function n(x) {
  if (x == null || Number.isNaN(x)) return '-';
  const a = Math.abs(x);
  if (a >= 1e6) return x.toExponential(1).replace('e+', 'e');
  if (a >= 1e4) return (x / 1e3).toFixed(0) + 'k';
  if (a >= 100) return x.toFixed(0);
  return (+x.toFixed(2)).toString();
}
const NAME = { f2p: '무과금', light: '소과금', heavy: '고과금' };
const RES = { gold: '금화', food: '식량', ore: '광물', parts: '부품', gems: '보석', medals: '훈장', diamonds: '다이아' };
const SRC = { kills: '처치', boss: '보스', titan: '타이탄', production: '생산(접속 중)', offline: '생산(오프라인)', raid: '습격', repair: '수리 환급', alchemy: '연금술',
  activity: '활동', daily: '일일', 'first boss': '보스 첫 처치', 'first titan': '타이탄 첫 처치', 'season (free)': '시즌(무료)', 'season pass': '시즌 패스',
  prestige: '환생', 'relic (ore)': '광맥 지도', package: '패키지', 'monthly pass': '월정액', purchase: '구매', upkeep: '유지비', merge: '합성', other: '기타' };
const SEC = { roof: '지붕', shop: '작업장', bed: '침실', food: '식량층', mine: '채굴층', lab: '연구소' };
const sinkName = k => SRC[k] || k.replace('summon:', '뽑기:').replace(':bt', ' 돌파').replace('ws:', '공방:').replace(/sec:(\w+):?(\w*)/, (m, a, b) => `${SEC[a] || a} ${{ lv: '레벨', tier: '등급', cap: '용량' }[b] || ''}`.trim())
  .replace('enh:w', '무기 강화').replace('enh:t', '터렛 강화').replace('medal:', '훈장:').replace('research:', '연구:').replace(/^crew$/, '동료 레벨').replace(/^crew /, '동료 ').replace('bunker', '벙커').replace('fence', '울타리');
const STATE = { 'new record': '새 기록 등반', 're-climbing': '환생 후 재등반', replaying: '깬 스테이지 반복(실패 뒤)', 'boss timer': '보스 제한시간', 'titan timer': '타이탄 제한시간', defense: '방어(뚫림)', 'normal stage too slow': '일반 스테이지 처치 속도' };
const AXIS = { workshop: '공방 공격력', rateUptime: '연사×가동률', weaponEquip: '무기 장착', weaponOwned: '무기 보유', weaponCodex: '도감', shooters: '사수 수', turrets: '터렛', roof: '지붕 구역', crew: '동료 레벨', commander: '지휘관', medals: '훈장', relics: '유물', research: '연구' };

function markdown(out) {
  const L = [];
  L.push('# 시뮬 타임라인: 12주 동안 실제로 일어나는 일', '');
  L.push(`- 봇: 사람형(30~120초마다 확인, 묶음 구매, 가끔 최선이 아닌 선택, 진행이 멈추면 환생). ${out.schedule}. 시드 ${out.seed}.`);
  L.push('- 과금: 무과금(광고 하루 3회), 소과금(월정액 5,500 + 시즌 패스 9,900원), 고과금(월 10만 원: 패스 → 열린 단계 패키지 → 다이아).');
  L.push(`- 수치: \`bunker/src/logic/tuning.mjs\` 현재값. 다시 만들기: \`node bunker/tests/sim/timeline.mjs\`. 전체 자료: \`timeline.json\`.`, '');
  L.push('## 요약', '', '| 유형 | 끝(일) | 활동 시간 | 최고 스테이지 | 환생 | 결제(원) |', '|---|---|---|---|---|---|');
  for (const r of out.runs) L.push(`| ${NAME[r.profile]} | ${n(r.end.day)} | ${n(r.end.activeH)} | ${r.end.record} | ${r.end.prestiges} | ${n(r.end.spentKrw)} |`);
  L.push('', '| 주 | ' + out.runs.map(r => NAME[r.profile]).join(' | ') + ' |', '|---|' + out.runs.map(() => '---').join('|') + '|');
  for (let w = 1; w <= Math.max(...out.runs.map(r => r.weekly.length)); w++) L.push(`| ${w} | ` + out.runs.map(r => (r.weekly.find(s => s.week === w) || {}).record ?? '-').join(' | ') + ' |');
  for (const r of out.runs) {
    const nm = NAME[r.profile];
    L.push('', `## ${nm}`, '', `### 1. 사건 기록 (${nm})`, '', '| 일 | 활동 시간 | 스테이지 | 사건 | 내용 |', '|---|---|---|---|---|');
    const isPrestige = e => e.event.startsWith('환생 ') && e.event.endsWith('회');
    const isSummon = e => e.event.startsWith('소환 레벨');
    for (const e of r.events.filter(e => !isPrestige(e) && !isSummon(e))) {
      const { day, hour, stage, event, ...rest } = e;
      L.push(`| ${day} | ${hour} | ${stage} | ${event} | ${Object.entries(rest).map(([k, v]) => `${k} ${typeof v === 'number' ? n(v) : v}`).join(', ')} |`);
    }
    const sums = r.events.filter(isSummon);
    L.push('', '소환 레벨 상승 (종류: 레벨@일):', '');
    for (const k of ['weapon', 'turret', 'relic', 'recruit']) L.push(`- ${{ weapon: '무기', turret: '터렛', relic: '유물', recruit: '동료' }[k]}: ` + (sums.filter(e => e.event.includes(` ${k} `)).map(e => `${e.event.split(' ').pop()}@${e.day}일`).join(', ') || '-'));
    const pres = r.events.filter(isPrestige);
    L.push('', `<details><summary>환생 ${pres.length}회 (회차·일·활동 시간·스테이지·얻은 훈장·누적 훈장)</summary>`, '', '| 회 | 일 | 활동 시간 | 기록 | 얻은 훈장 | 누적 |', '|---|---|---|---|---|---|');
    for (const e of pres) L.push(`| ${e.event.replace('환생 ', '').replace('회', '')} | ${e.day} | ${e.hour} | ${e.stage} | ${n(e.medals)} | ${n(e.lifetime)} |`);
    L.push('', '</details>', '', '돌파 횟수 (주별):', '');
    const tracks = [...new Set(r.bts.flatMap(b => Object.keys(b || {})))].sort();
    L.push('| 주 | ' + tracks.map(sinkName).join(' | ') + ' |', '|---|' + tracks.map(() => '---').join('|') + '|');
    r.bts.forEach((b, i) => L.push(`| ${i + 1} | ` + tracks.map(t => (b && b[t]) || 0).join(' | ') + ' |'));

    L.push('', `### 2. 주간 스냅샷 (${nm})`, '', '| 주 | 일 | 활동 시간 | 스테이지 | 환생 | 훈장 누적 | 지휘관 | 공방 공/연/탄/장 | 벙커/울타리 | 동료 카드 | 일꾼 지붕/식량/채굴/작업장/연구 |', '|---|---|---|---|---|---|---|---|---|---|---|');
    for (const s of r.weekly) L.push(`| ${s.week} | ${s.day} | ${s.activeH} | ${s.record} | ${s.prestiges} | ${n(s.medalsLifetime)} | ${s.commander} | ${s.workshop.atk}/${s.workshop.rate}/${s.workshop.mag}/${s.workshop.reload} | ${s.bunker}/${s.fence} | ${s.crewCards} | ${s.workers.roof}/${s.workers.food}/${s.workers.mine}/${s.workers.shop}/${s.workers.lab} |`);
    L.push('', '| 주 | 구역 레벨/등급/용량: 지붕 · 작업장 · 침실 · 식량 · 채굴 · 연구소 | 소환 레벨 무기/터렛/유물/동료 | 최고 무기(단계, 강화) | 무기 보유 | 터렛 보유/장착/최고 | 유물 칸/보유, 장착(레벨) | 연구 |', '|---|---|---|---|---|---|---|---|');
    for (const s of r.weekly) {
      const sec = ['roof', 'shop', 'bed', 'food', 'mine', 'lab'].map(k => `${s.sections[k].level}/${s.sections[k].tier}/${s.sections[k].cap}`).join(' · ');
      const sl = ['weapon', 'turret', 'relic', 'recruit'].map(k => s.summonLevel[k].level).join('/');
      const bw = s.bestWeapon ? `${s.bestWeapon.name}(${s.bestWeapon.step}, +${s.bestWeapon.enhance})` : '-';
      const tu = `${s.turrets.owned}/${s.turrets.equipped}/${s.turrets.best ? s.turrets.best.name + ' +' + s.turrets.best.enhance : '-'}`;
      const re = `${s.relics.slots}/${s.relics.owned}, ${s.relics.equipped.map(x => `${x.name}${x.level}`).join(' ') || '-'}`;
      L.push(`| ${s.week} | ${sec} | ${sl} | ${bw} | ${s.weaponsOwned} | ${tu} | ${re} | ${Object.entries(s.research).map(([k, v]) => `${k} ${v}`).join(', ') || '-'} |`);
    }

    L.push('', `### 3. 주간 재화 흐름 (${nm}): 얻은 곳 / 쓴 곳 / 주말 보유`, '');
    for (const res of ['gold', 'food', 'ore', 'parts', 'gems', 'medals', ...(r.profile === 'f2p' ? [] : ['diamonds'])]) {
      L.push(`**${RES[res]}**`, '', '| 주 | 얻은 곳 | 쓴 곳 | 주말 보유 |', '|---|---|---|---|');
      r.flows.forEach((f, i) => {
        if (!f) return;
        const fmt = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${sinkName(k)} ${n(v)}`).join(', ') || '-';
        const snap = r.weekly.find(s => s.week === i + 1);
        L.push(`| ${i + 1} | ${fmt(f.earned[res])} | ${fmt(f.spent[res])} | ${snap ? n(snap.stock[res] ?? 0) : '-'} |`);
      });
      L.push('');
    }

    L.push(`### 4. 주간 힘 구성 (${nm}): 배수 (전체 로그 힘에서 차지하는 비율)`, '');
    const axes = Object.keys(AXIS);
    L.push('그 주 마지막 새 기록 순간의 값입니다(공방은 환생마다 0이 되므로 런의 정점에서 잽니다).', '');
    L.push('| 주 | 잰 스테이지 | 로그 합 | ' + axes.map(a => AXIS[a]).join(' | ') + ' |', '|---|---|---|' + axes.map(() => '---').join('|') + '|');
    for (const s of r.weekly) L.push(`| ${s.week} | ${s.powerAtStage} | ${s.logPower} | ` + axes.map(a => `${n(s.power[a].mul)} (${Math.round(100 * s.power[a].share)}%)`).join(' | ') + ' |');

    L.push('', `### 5. 주간 병목 (${nm}): 활동 시간 중 비율`, '', '| 주 | 진행 상태 | 구매를 막은 재화 | 주된 병목 |', '|---|---|---|---|');
    r.states.forEach((sObj, i) => {
      const tot = Object.values(sObj || {}).reduce((a, b) => a + b, 0) || 1, b = r.blocks[i] || {}, bt = b._total || 1;
      const st = Object.entries(sObj || {}).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${STATE[k] || k} ${Math.round(100 * v / tot)}%`).join(', ');
      const bl = Object.entries(b).filter(([k]) => k !== '_total').sort((x, y) => y[1] - x[1]).map(([k, v]) => `${RES[k] || k} ${Math.round(100 * v / bt)}%`).join(', ') || '-';
      const stall = Object.entries(sObj || {}).filter(([k]) => !['new record', 're-climbing', 'replaying'].includes(k)).sort((x, y) => y[1] - x[1])[0];
      const top = Object.entries(b).filter(([k]) => k !== '_total').sort((x, y) => y[1] - x[1])[0];
      L.push(`| ${i + 1} | ${st} | ${bl} | ${stall ? STATE[stall[0]] : '-'} · ${top ? RES[top[0]] || top[0] : '-'} |`);
    });
  }
  L.push('', '## 읽는 법', '',
    '- **진행 상태**: 확인할 때마다(30~120초) 직전 구간을 분류합니다. 기록이 올랐으면 새 기록 등반, 환생 뒤 이번 런 최고만 올랐으면 재등반, 마지막 도전이 실패했으면 실패 원인(보스·타이탄 제한시간, 방어 뚫림, 일반 스테이지 처치 속도), 그 밖은 실패 뒤 한 칸 아래 반복입니다.',
    '- **구매를 막은 재화**: 그 구간에 봇이 가장 사고 싶던 금화 강화가 비쌌거나(금화), 레벨을 막는 돌파의 재료가 모자랐던(식량·광물·부품) 시간 비율입니다. 선택 사항인 등급은 넣지 않습니다. 여러 재화가 동시에 모자랄 수 있어 합이 100%를 넘습니다.',
    '- **힘 구성**: 각 축이 곱하는 배수와 log10 기준 비율입니다. 유물은 장착 전후 피해를 비교한 값입니다. 공방은 환생마다 0으로 돌아가므로 그 주 마지막 순간의 값입니다.');
  return L.join('\n') + '\n';
}

if (!isMainThread) {
  const { run } = await import('./sim.mjs');
  const M = run({ bot: 'human', profile: workerData.profile, seed: workerData.seed, days: workerData.days, untilStage: 30000, maxActiveH: 1e9, log: true });
  const { events, flows, bts, states, blocks, weekly } = M.log;
  parentPort.postMessage({ profile: workerData.profile, end: { day: M.endDays, activeH: M.endActive, record: M.st.record, prestiges: M.st.evacs, spentKrw: M.st.shop.spent }, events, flows, bts, states, blocks, weekly });
} else {
  const days = +(process.argv[2] || 84), seed = +(process.argv[3] || 1);
  const runs = await Promise.all(PROFILES.map(profile => new Promise((res, rej) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { profile, seed, days } });
    w.on('message', res); w.on('error', rej);
  })));
  const out = { generated: new Date().toISOString(), schedule: '하루 4회 접속(약 26분, 하루 1.75시간), 그 사이는 오프라인', bot: 'human', seed, days, runs };
  fs.writeFileSync(path.join(HERE, 'timeline.json'), JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(HERE, 'timeline.md'), markdown(out));
  console.log('wrote timeline.json and timeline.md:', runs.map(r => `${r.profile} 기록 ${r.end.record} (${r.end.activeH.toFixed(0)}h)`).join(', '));
}
