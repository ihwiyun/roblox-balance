'use strict';
// The page around the picture: resources, the bottom panel and its cards, tabs, settings.
/* ================= HUD ================= */
const iconPal = paletteOf(ART.iconPal);
function iconCanvas(name, scale = 2) {
  const rows = ART.icons[name], c = document.createElement('canvas');
  c.width = 16; c.height = 16; c.className = 'ico'; c.style.width = 16 * scale + 'px'; c.style.height = 16 * scale + 'px';
  const g = c.getContext('2d'), img = g.createImageData(16, 16), d = new Uint32Array(img.data.buffer);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') d[y * 16 + x] = iconPal[ch.charCodeAt(0)]; }));
  g.putImageData(img, 0, 0);
  return c;
}
// a survivor's face for the crew list, from the same head bitmap the game draws
function portrait(person, scale = 2) {
  // head and shoulders from the person's own sprite: the standing front frame, their face and headgear,
  // cropped to 20x20 around the head so the whole face always shows
  const gear = gearOf(person), pal = palFor(person, gear), set = SPR[gear.body], a = set.anims.idle || set.anims.walk, fr = a.F[0];
  const size = 20, c = document.createElement('canvas');
  c.width = size; c.height = size; c.className = 'ico'; c.style.width = size * scale + 'px'; c.style.height = size * scale + 'px';
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = new Uint32Array(img.data.buffer);
  const [hx, hy] = fr.head, ox = hx - size / 2, oy = hy - 16; // head (15 rows above the chin) + shoulders
  const put = (x, y, ch) => { x -= ox; y -= oy; if (x >= 0 && y >= 0 && x < size && y < size) d[y * size + x] = pal[ch.charCodeAt(0)]; };
  for (let n = 0; n < fr.cells.length; n += 3) put(fr.cells[n], fr.cells[n + 1], String.fromCharCode(fr.cells[n + 2]));
  for (const st of [ART_HUMANS.heads[person.look.key] || ART_HUMANS.heads.hero, gear.head && ART_HUMANS.gear[gear.head]]) {
    if (!st) continue;
    st.F.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') put(hx - st.ax + x, hy - st.ay + y, ch); }));
  }
  g.putImageData(img, 0, 0);
  return c;
}
document.querySelectorAll('[data-ico]').forEach(el => el.prepend(iconCanvas(el.dataset.ico, el.classList.contains('tab') ? 1.5 : 1.25)));
const nodes = {};
for (const id of ['panel', 'subtabs', 'bunkerFill', 'bunkerText', 'bunkerTrack', 'fenceFill', 'fenceText', 'waveLine', 'stage', 'speed', 'notes', 'ammo', 'ammoNum', 'ammoBar']) nodes[id] = document.getElementById(id);
// notifications: one band at a time, queued; kind is '' | 'good' | 'new' | 'danger'
const noteQueue = [];
let noteBusy = false;
const noteShown = {};
function notify(title, sub = '', kind = '', gap = 25) {
  const now = performance.now();
  if (noteQueue.some(n => n.title === title && n.sub === sub) || now - (noteShown[title] || -1e9) < gap * 1000) return;
  noteShown[title] = now;
  noteQueue.push({ title, sub, kind });
  if (noteQueue.length > 4) noteQueue.shift();
  if (!noteBusy) nextNote();
}
function nextNote() {
  const n = noteQueue.shift();
  if (!n) { noteBusy = false; nodes.notes.replaceChildren(); return; }
  noteBusy = true;
  const el = document.createElement('div');
  el.className = 'note ' + n.kind + (n.kind === 'danger' || n.kind === 'new' ? ' long' : '');
  el.innerHTML = `<b>${n.title}</b>${n.sub ? `<span>${n.sub}</span>` : ''}`;
  nodes.notes.replaceChildren(el);
  setTimeout(nextNote, n.kind === 'danger' || n.kind === 'new' ? 3400 : 2700);
}
// the hero's magazine, bottom right: checked every frame, written only when it changes
let ammoShown = '';
function refreshAmmo() {
  const h = G.hero;
  if (!h) return;
  const mag = gunStat('mag'), reloading = h.reload > 0, t = reloading ? 1 - h.reload / h.reloadLen : 0;
  const key = reloading ? 'r' + Math.round(t * 20) : h.ammo + '/' + mag;
  if (key === ammoShown) return;
  ammoShown = key;
  nodes.ammoNum.innerHTML = reloading ? `<small>장전 ${Math.round(t * 100)}%</small>` : `${h.ammo}<small>/${mag}</small>`;
  nodes.ammoBar.style.width = (reloading ? t : h.ammo / mag) * 100 + '%';
  nodes.ammo.classList.toggle('empty', !reloading && h.ammo === 0);
}
let tab = 'gun';
// every bottom tab is split into its own pages (지하: one page per floor)
const SUBS = {
  gun: [['up', '강화'], ['own', '보유 무기'], ['merge', '합성'], ['codex', '도감']],
  def: [['bunker', '벙커'], ['fence', '울타리'], ['turret', '터렛']],
  under: [[0, '1층 침실'], [1, '2층 식량'], [2, '3층 채굴']],
  crew: [['crew', '동료'], ['zones', '구역 배치'], ['cmd', '지휘관']],
  relic: [['equip', '장착'], ['own', '보유'], ['set', '세트']],
};
const sub = { gun: 'up', def: 'bunker', crew: 'crew', relic: 'equip' };
const subOf = t => t === 'under' ? (G.floorView || 0) : sub[t];
let subKey = '';
function renderSubtabs() {
  const key = tab + ':' + subOf(tab);
  if (key === subKey) return;
  subKey = key;
  nodes.subtabs.innerHTML = '';
  for (const [k, name] of SUBS[tab]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mini'; b.textContent = name; b.setAttribute('aria-pressed', String(subOf(tab) === k));
    b.addEventListener('click', () => {
      if (tab === 'under') { viewFloor(k); return; }
      sub[tab] = k; nodes.panel.scrollTop = 0; renderPanel(true);
    });
    nodes.subtabs.append(b);
  }
}
function setView(v) {
  G.view = v;
  if (v === 'under') refreshUnder(); else showYard();
  document.documentElement.classList.toggle('under', v === 'under');
  fitStage();
}
// below ground one floor is shown at a time: the floor cards in the 지하 tab pick it (and a purchase there
// shows its floor)
function viewFloor(k) {
  G.floorView = k;
  if (tab !== 'under') { tab = 'under'; document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === 'under'))); }
  if (G.view !== 'under') setView('under'); else showFloor(k);
  renderPanel(true);
  // the card of the floor on screen stays in sight (a purchase or an alert can switch floors from anywhere)
  const on = nodes.panel.querySelector('.card.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t === b)));
  setView(tab === 'under' ? 'under' : 'yard');
  nodes.panel.scrollTop = 0; // a new tab starts at its top
  renderPanel(true);
  // below ground, the card of the floor on show is the one in view
  const on = nodes.panel.querySelector('.card.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}));
// the price of the next level of anything: what the cards show is exactly what a purchase takes
function priceOf(id) {
  const [kind, key] = id.split(':');
  if (kind === 'gun') return G.lv[key] >= GUN[key].max ? null : capCost(gunCost(key, G.lv[key]));
  if (kind === 'bunker') return G.bunker >= MAX_BUNKER ? null : capCost(bunkerCost(G.bunker));
  if (kind === 'fence') return G.fence >= MAX_FENCE ? null : capCost(fenceCost(G.fence));
  if (kind === 'live') return G.live >= LIVE.max ? null : capCost(LIVE.cost(G.live));
  if (kind === 'farm') return G.farm >= FARM.max ? null : capCost(FARM.cost(G.farm));
  if (kind === 'mine') return G.mine >= MINE.max ? null : capCost(MINE.cost(G.mine));
  if (kind === 'hire') return capCost({ ...HIRE[+key] });
  return null;
}
// a price as small resource chips: icon and amount, red when you are short
const COST_ICON = { money: 'coin', food: 'food', mineral: 'mineral' };
const costHtml = c => Object.entries(c).map(([k, v]) => `<span class="cost${G[k] < v ? ' short' : ''}"><i class="ci ci-${COST_ICON[k]}"></i>${fmt(v)}</span>`).join('');
const shotsToKill = dmg => Math.ceil(zombieHp(G.wave) / dmg - 1e-9);
// the planned collections, laid out as their real slots (they fill in as the systems arrive)
const GRADES = ['일반', '고급', '희귀', '영웅', '전설', '불멸', '신화', '영원'];
const WEAPON_LADDER = [
  ['녹슨 리볼버', '사제 기관단총', '쇠파이프 산탄총', '사냥용 볼트액션', '고물 못총'],
  ['경찰 권총', '민간 기관단총', '펌프 산탄총', '사냥 소총', '소방 화염기'],
  ['군용 권총', '돌격소총', '전투 산탄총', '저격소총', '경기관총'],
  ['기관권총', '특수부대 소총', '자동 산탄총', '대물 저격총', '유탄발사기'],
  ['플라즈마 권총', '레이저 소총', '충격파 산탄총', '레일 저격총', '미니건'],
  ['중력 권총', '입자 소총', '분열 산탄총', '시간 저격총', '테슬라 포'],
  ['천둥의 권총', '용의 숨결 소총', '지옥불 산탄총', '신의 창', '종말의 개틀링'],
  ['별의 권총', '은하 소총', '초신성 산탄총', '블랙홀 저격총', '영원의 포'],
];
const RELIC_SETS = ['검은 연기', '동상', '폭풍', '사냥꾼', '성채', '보급관'];
const slot = (cls, text) => `<div class="slot ${cls}">${text}</div>`;
const block = (id, title, right, body) => ({ id, html: `<h3><span>${title}</span><span>${right}</span></h3>${body}` });
function pageHtml() {
  const p = subOf(tab);
  if (tab === 'gun' && p === 'own') return GRADES.map((g, n) => block('own' + n, `<span class="gr g${n}">${g}</span>`, '0/5', `<div class="slots">${WEAPON_LADDER[n].map(w => slot('g' + n + ' off', w)).join('')}</div>`));
  if (tab === 'gun' && p === 'merge') return [block('merge', '합성', '4 → 1', `<div class="slots">${slot('', '')}${slot('', '')}${slot('', '')}${slot('', '')}${slot('', '→')}</div><div class="rowline"><span></span><button class="buy" type="button" disabled>합성</button></div>`)];
  if (tab === 'gun' && p === 'codex') return [block('codex', '도감', '0/40', `<div class="slots eight">${GRADES.flatMap((g, n) => WEAPON_LADDER[n].map(() => slot('g' + n + ' off', ''))).join('')}</div>`)];
  if (tab === 'def' && p === 'turret') return [block('turret', '터렛', '0/6', `<div class="slots six">${[25, 50, 100, 200, 400, 700].map(L => slot('off', '벙커 Lv ' + L)).join('')}</div>`)];
  if (tab === 'crew' && p === 'zones') {
    const zone = (name, job, n) => { const who = G.crew.filter(c => c && c.job === job); return block('zone' + job, name, who.length + '/' + n, `<div class="slots">${Array.from({ length: n }, (_, i) => slot(who[i] ? '' : 'off', who[i] ? who[i].name : '')).join('')}</div>`); };
    return [zone('지붕 초소', '사수', 5), zone('2층 식량', '농부', 5), zone('3층 채굴', '광부', 5), block('zoneWork', '작업장', '잠김', `<div class="slots">${Array.from({ length: 5 }, () => slot('off', '')).join('')}</div>`)];
  }
  if (tab === 'crew' && p === 'cmd') return [block('cmd', '지휘관 Lv 1', '포인트 0', ['위력', '속사', '행운', '정밀', '지휘', '보급'].map(n => `<div class="rowline"><span>${n}</span><span>0 <button class="mini" type="button" disabled>+</button></span></div>`).join(''))];
  if (tab === 'relic' && p === 'equip') return [block('requip', '장착', '0/8', `<div class="slots eight">${[20, 50, 100, 200, 400, 700, 1000, 2000].map(r => slot('off', '기록 ' + fmt(r))).join('')}</div>`)];
  if (tab === 'relic' && p === 'own') return GRADES.map((g, n) => block('rown' + n, `<span class="gr g${n}">${g}</span>`, '0/6', `<div class="slots six">${Array.from({ length: 6 }, () => slot('g' + n + ' off', '')).join('')}</div>`));
  if (tab === 'relic' && p === 'set') return RELIC_SETS.map((name, n) => block('rset' + n, name, '0/3', `<div class="slots">${slot('off', '')}${slot('off', '')}${slot('off', '')}</div>`));
  return null;
}
function cards() {
  const page = pageHtml();
  if (page) return page;
  if (tab === 'gun') {
    return Object.entries(GUN).map(([k, g]) => {
      const L = G.lv[k], max = L >= g.max, now = g.val(L), next = g.val(L + 1);
      let desc;
      if (k === 'atk') {
        desc = `한 발 ${fmt(now)} → ${fmt(next)} · 지금 좀비 ${shotsToKill(now)}발 → ${shotsToKill(next)}발`;
      } else if (k === 'spd') desc = `초당 ${now.toFixed(2)}발 → ${next.toFixed(2)}발 · 총구 화염 ${1 + Math.min(2, Math.floor(L / 10))}단계`;
      else desc = `${now}발 → ${next}발 · 장전 ${reloadTime().toFixed(1)}초${L + 1 === 20 ? '<br>다음: 드럼 탄창' : ''}`;
      return { id: 'gun:' + k, ico: { atk: 'bullet', spd: 'rate', mag: 'mag' }[k], name: g.name, lv: 'Lv ' + L + '/' + g.max, desc: max ? '최대 레벨' : desc, cost: priceOf('gun:' + k), max, prog: L / g.max };
    });
  }
  if (tab === 'def') {
    const B = G.bunker, F = G.fence, bmax = B >= MAX_BUNKER, fmax = F >= MAX_FENCE;
    const list = [
      { id: 'bunker', ico: 'bunker', name: '벙커 · ' + bunkerInfo(B).name, lv: 'Lv ' + B + '/' + MAX_BUNKER, desc: bmax ? '최대 레벨' : `체력 ${fmt(bunkerHp(B))} → ${fmt(bunkerHp(B + 1))}<br>다음: ${bunkerAddName(B + 1)}`, cost: priceOf('bunker'), max: bmax, prog: B / MAX_BUNKER },
      { id: 'fence', ico: 'fence', name: '울타리' + (F ? ' · ' + fenceInfo(F).name : ''), lv: 'Lv ' + F + '/' + MAX_FENCE, desc: fmax ? '최대 레벨' : `체력 ${fmt(fenceHp(F))} → ${fmt(fenceHp(F + 1))}<br>다음: ${fenceAddName(F + 1)}${fenceInfo(F + 1).electric && !(F && fenceInfo(F).electric) ? ' (공격한 좀비 감전)' : ''}`, cost: priceOf('fence'), max: fmax, prog: F / MAX_FENCE },
    ];
    return list.filter(c => c.id === sub.def);
  }
  if (tab === 'under') {
    const Lv = G.live, Fm = G.farm, Mn = G.mine;
    const floors = [
      { id: 'live', floor: 0, ico: 'bed', name: '지하 1층 · 생활층', lv: 'Lv ' + Lv + '/' + LIVE.max, desc: Lv >= LIVE.max ? '최대 레벨' : `침대 ${bedsOf(Lv)}/5 · 휴식 속도 +${Lv * 5}%<br>다음: ${LIVE_ITEMS[Lv]}${LIVE.beds.includes(Lv + 1) ? ' (고용 자리 +1)' : ''}`, cost: priceOf('live'), max: Lv >= LIVE.max, prog: Lv / LIVE.max },
      { id: 'farm', floor: 1, ico: 'farm', name: '지하 2층 · 식량층' + (Fm ? ' · ' + FARM_TIERS[facTier(Fm)] : ''), lv: Fm ? 'Lv ' + Fm + '/' + FARM.max : '미개척', desc: Fm >= FARM.max ? '최대 레벨' : `식량 초당 ${fmt(FARM.rate(Fm))} → ${fmt(FARM.rate(Fm + 1))} (농부 1명당 +100%)<br>다음: ${FARM_ITEMS[Fm]}`, cost: priceOf('farm'), max: Fm >= FARM.max, prog: Fm / FARM.max },
      { id: 'mine', floor: 2, ico: 'pick', name: '지하 3층 · 채굴층' + (Mn ? ' · ' + MINE_TIERS[facTier(Mn)] : ''), lv: Mn ? 'Lv ' + Mn + '/' + MINE.max : '미개척', desc: Mn >= MINE.max ? '최대 레벨' : `광물 초당 ${fmt(MINE.rate(Mn))} → ${fmt(MINE.rate(Mn + 1))} (광부 1명당 +100%)<br>다음: ${MINE_ITEMS[Mn]}`, cost: priceOf('mine'), max: Mn >= MINE.max, prog: Mn / MINE.max },
    ];
    return [floors[G.floorView || 0]];
  }
  const beds = bedsOf(G.live);
  return G.crew.map((c, i) => {
    if (i >= beds) return { id: 'slot:' + i, ico: 'lock', name: '자리 ' + (i + 1), lv: '침대 없음', desc: `생활층 Lv ${LIVE.beds[i]}에서 침대가 생긴다<br>고용 ${costHtml(priceOf('hire:' + i))}`, locked: true };
    if (!c) return { id: 'hire:' + i, ico: 'person', name: NAMES[i], lv: '빈 침대', desc: `생존자 고용 · 식량을 초당 ${UPKEEP}씩 먹는다`, cost: priceOf('hire:' + i) };
    const where = c.state === 'sleep' ? '침대에서 자는 중' : c.state === 'toBed' ? '자러 가는 중' : c.state === 'toWork' ? '일하러 가는 중' : c.job === '사수' ? '지붕에서 사격 중' : c.job === '농부' ? '농장에서 일하는 중' : '광산에서 일하는 중';
    return { id: 'job:' + i, person: c, name: c.name, lv: c.job, desc: `${where}${G.hungry ? ' · 배고픔' : ''}`, fatigue: c.fatigue, jobs: true, slot: i };
  });
}
let panelKey = '', pressing = false;
// a card rebuilt under a finger loses the tap, so nothing is rebuilt while the panel is being pressed
nodes.panel.addEventListener('pointerdown', () => { pressing = true; });
addEventListener('pointerup', () => { pressing = false; }); addEventListener('pointercancel', () => { pressing = false; });
function renderPanel(force) {
  renderSubtabs();
  const list = cards();
  // fatigue is not part of the key: its bars are updated in place below, so cards are not rebuilt for it
  const key = tab + G.view + (G.floorView || 0) + JSON.stringify(list.map(c => [c.id, c.html, c.name, c.lv, c.desc, c.cost && Object.entries(c.cost).map(([k, v]) => [v, G[k] >= v])]));
  if (!force && (key === panelKey || pressing)) {
    list.forEach((c, n) => { if (c.fatigue != null) { const bar = nodes.panel.children[n] && nodes.panel.children[n].querySelector('.tired span'); if (bar) bar.style.width = clamp(c.fatigue, 0, 100) + '%'; } });
    return;
  }
  panelKey = key;
  nodes.panel.innerHTML = '';
  for (const c of list) {
    const el = document.createElement('div');
    if (c.html) { el.className = 'block'; el.innerHTML = c.html; nodes.panel.append(el); continue; }
    el.className = 'card' + (c.floor != null ? ' pick' + (c.floor === (G.floorView || 0) && G.view === 'under' ? ' on' : '') : '');
    if (c.floor != null) el.addEventListener('click', e => { if (!e.target.closest('button')) { ensureAudio(); viewFloor(c.floor); } });
    const ic = document.createElement('div');
    ic.className = 'icon'; ic.append(c.person ? portrait(c.person) : iconCanvas(c.ico, 2));
    el.append(ic);
    el.insertAdjacentHTML('beforeend', `<div class="body"><div class="head"><span class="name">${c.name}</span><span class="lv">${c.lv}</span></div>${c.prog != null ? `<div class="prog" title="${Math.round(c.prog * 100)}%"><i style="width:${c.prog * 100}%"></i></div>` : ''}<div class="desc">${c.desc}</div>${c.fatigue != null ? `<div class="tired"><span style="width:${clamp(c.fatigue, 0, 100)}%"></span></div>` : ''}</div>`);
    if (c.jobs) {
      const row = document.createElement('div');
      row.className = 'row';
      for (const j of JOBS) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'mini'; b.textContent = j;
        b.setAttribute('aria-pressed', String(G.crew[c.slot].job === j));
        b.addEventListener('click', () => { const p = G.crew[c.slot]; if (p.job === j) return; p.job = j; if (p.state !== 'sleep' && p.state !== 'toBed') sendTo(p, workSpot(p), 'toWork'); resyncPosts(); sound('buy'); renderPanel(true); });
        row.append(b);
      }
      el.append(row);
    } else if (!c.locked) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'buy';
      if (c.max) { b.textContent = '완료'; b.disabled = true; }
      else { b.innerHTML = costHtml(c.cost); b.disabled = !canPay(c.cost); b.addEventListener('click', () => act(c.id)); }
      el.append(b);
    } else el.append(document.createElement('span'));
    nodes.panel.append(el);
  }
}
function act(id) {
  ensureAudio();
  const [kind, key] = id.split(':');
  const c = priceOf(id);
  if (!c || !canPay(c)) return;
  if (kind === 'gun') {
    pay(c); G.lv[key]++;
    if (key === 'mag') for (const s of shooters()) if (!s.reload) s.ammo = gunStat('mag');
  } else if (kind === 'bunker') {
    pay(c); G.bunker++; G.hp = bunkerHp(G.bunker);
    if (isNewBunkerForm(G.bunker)) notify('새 건물 · ' + bunkerInfo().name, '벙커 Lv ' + G.bunker + ' · 체력 ' + fmt(bunkerHp(G.bunker)), 'good');
    { const before = yardPix.slice(); bakeYard(); flashDiff(before, yardPix, 'yard'); }
    resyncPosts(); palCache.clear(); if (G.view !== 'yard') setView('yard');
  } else if (kind === 'fence') {
    pay(c); G.fence++; G.fenceHp = fenceHp(G.fence); G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0];
    if (isNewFenceForm(G.fence)) notify('새 울타리 · ' + fenceInfo().name, '울타리 Lv ' + G.fence + ' · 체력 ' + fmt(fenceHp(G.fence)) + (fenceInfo().electric ? ' · 공격한 좀비 감전' : ''), 'good');
    { const before = yardPix.slice(); composeYard(); flashDiff(before, yardPix, 'yard'); } // only the fence overlays change
    if (G.view !== 'yard') setView('yard');
  } else if (kind === 'live') {
    pay(c); G.live++;
    markUnder(0, true); viewFloor(0);
  } else if (kind === 'farm' || kind === 'mine') {
    pay(c); G[kind]++;
    const tiers = kind === 'farm' ? FARM_TIERS : MINE_TIERS, floorName = kind === 'farm' ? '식량층' : '채굴층';
    if (G[kind] === 1 || facTier(G[kind]) !== facTier(G[kind] - 1)) notify(floorName + ' · ' + tiers[facTier(G[kind])], (kind === 'farm' ? '식량' : '광물') + ' 초당 ' + (kind === 'farm' ? FARM : MINE).rate(G[kind]).toFixed(1), 'good');
    markUnder(kind === 'farm' ? 1 : 2, true); viewFloor(kind === 'farm' ? 1 : 2);
  } else if (kind === 'hire') {
    const i = +key;
    if (G.crew[i] || i >= bedsOf(G.live)) return;
    pay(c); G.crew[i] = makePerson(i);
    G.crew[i].state = 'toWork'; G.crew[i].path = route(G.crew[i], workSpot(G.crew[i]));
    resyncPosts(); // gunner posts follow slot order, so a new hire can move the others
    markUnder(0); // a bed gets its blanket
  } else return;
  sound('buy');
  renderPanel(true);
  refreshTop();
}
function refreshTop() {
  for (const r of ['money', 'food', 'mineral']) document.getElementById('r-' + r).textContent = fmt(G[r]);
  for (const r of ['food', 'mineral']) {
    const net = rateOf(r) - (r === 'food' ? hired().length * UPKEEP : 0), el = document.getElementById('rr-' + r);
    const cap = r === 'food' ? foodCap() : mineralCap(), full = G[r] >= cap - .5;
    el.textContent = full && net > 0 ? '가득' : Math.abs(net) > .005 ? (net > 0 ? '+' : '−') + Math.abs(net).toFixed(1) + '/초' : '';
    el.classList.toggle('neg', net < 0 && !full);
    const bar = document.getElementById('cap-' + r);
    bar.style.width = clamp(G[r] / cap, 0, 1) * 100 + '%'; bar.classList.toggle('full', full);
    bar.parentNode.title = (r === 'food' ? '식량 창고 ' : '광물 창고 ') + fmt(G[r]) + '/' + fmt(cap);
  }
  // the next mutant is announced with each new wave, so the top line stays short
  nodes.waveLine.innerHTML = `<b>웨이브 ${G.wave}</b> · ${G.waveKills}/${killsNeeded(G.wave)}` + (isBossWave(G.wave) ? ' · <b>보스</b>' : '');
  const maxHp = bunkerHp(G.bunker);
  nodes.bunkerFill.style.width = clamp(G.hp / maxHp, 0, 1) * 100 + '%';
  nodes.bunkerText.textContent = '벙커 ' + fmt(Math.max(0, G.hp)) + '/' + fmt(maxHp);
  nodes.bunkerTrack.classList.toggle('hurt', G.hurt > 0);
  if (G.fence) {
    const max = fenceHp(G.fence);
    nodes.fenceFill.style.width = clamp(G.fenceHp / max, 0, 1) * 100 + '%';
    nodes.fenceText.textContent = (G.fenceDown ? '울타리 복구 ' : '울타리 ') + fmt(G.fenceHp) + '/' + fmt(max);
  } else { nodes.fenceFill.style.width = '0%'; nodes.fenceText.textContent = '울타리 없음'; }
}
function fitStage() {
  const r = nodes.stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const f = Math.min(r.width / W, r.height / H);
  // whole device pixels per game pixel; below ground one step closer (the picture's middle fills the stage)
  let k = f * dpr >= 1 ? Math.floor(f * dpr) : 0;
  if (k && G.view === 'under') k += 1;
  const scale = k ? k / dpr : f;
  canvas.style.width = W * scale + 'px'; canvas.style.height = H * scale + 'px';
}

/* ================= settings ================= */
const settings = { sound: true, volume: .7, wind: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('bunker-idle:settings')) || {}); } catch { /* defaults */ }
const saveSettings = () => { try { localStorage.setItem('bunker-idle:settings', JSON.stringify(settings)); } catch { /* fine */ } };
const dlg = document.getElementById('settings');
const soundBtn = document.getElementById('soundToggle'), windBtn = document.getElementById('windToggle'), vol = document.getElementById('volume'), resetBtn = document.getElementById('resetBtn');
function paintSettings() { soundBtn.textContent = settings.sound ? '켜짐' : '꺼짐'; windBtn.textContent = settings.wind ? '켜짐' : '꺼짐'; vol.value = Math.round(settings.volume * 100); }
document.getElementById('settingsBtn').addEventListener('click', () => { paintSettings(); resetBtn.textContent = '초기화'; dlg.showModal(); });
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
soundBtn.addEventListener('click', () => { settings.sound = !settings.sound; ensureAudio(); paintSettings(); saveSettings(); });
windBtn.addEventListener('click', () => { settings.wind = !settings.wind; paintSettings(); saveSettings(); });
vol.addEventListener('input', () => { settings.volume = vol.value / 100; saveSettings(); });
let skipSave = false;
resetBtn.addEventListener('click', () => {
  if (resetBtn.textContent !== '한 번 더 누르면 삭제') { resetBtn.textContent = '한 번 더 누르면 삭제'; return; }
  try { localStorage.removeItem(SAVE_KEY); } catch { /* fine */ }
  skipSave = true; location.reload();
});


// resource icons for the price chips, drawn once from the same pixel art as the top bar
{
  const css = ['coin', 'food', 'mineral'].map(n => `.ci-${n}{background-image:url(${iconCanvas(n, 1).toDataURL()})}`).join('');
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
}
document.getElementById('restart').addEventListener('click', () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* fine */ } skipSave = true; location.reload(); });
/* ================= shop, rebirth and ranking (their own buttons beside the picture) ================= */
const line = (left, right) => `<div class="rowline"><span>${left}</span><span>${right}</span></div>`;
const off = text => `<button class="mini" type="button" disabled>${text}</button>`;
const SIDE = {
  shopDlg: () => {
    const pulls = [['무기', 100], ['터렛', 150], ['동료', 200], ['유물', 300]].map(([n, p]) => line(n, `${off('1회 ' + p)} ${off('10회 ' + fmt(p * 10))}`)).join('');
    const odds = GRADES.map((g, n) => `<span class="gr g${n}">${g}</span> ${[52, 30, 12, 4.5, 1.2, .25, .045, .005][n]}%`).join(' · ');
    const steps = [['희귀 5번 무기 + 보석 300', '1,200원'], ['영웅 3번 무기 + 희귀 동료', '3,300원'], ['전설 1번 무기 + 유물 상자 5', '5,900원'], ['전설 5번 무기 + 영웅 터렛', '12,000원'], ['불멸 1번 무기 + 전설 동료', '33,000원'], ['신화 1번 무기 + 유물 상자 30', '69,000원']]
      .map(([what, price], n) => line(`${n + 1}단계 · ${what}`, off(n ? '잠김' : price))).join('');
    const conv = ['광고 제거', '자동 합성', '오프라인 +12시간', '장비 프리셋', '연구 칸 +1', '배속 상시'].map(n => line(n, off('구매'))).join('');
    const passes = line('월정액', off('5,500원')) + line('시즌 패스', off('9,900원'));
    const gems = ['1,200', '5,900', '12,000', '33,000', '69,000', '119,000'].map(p => line('다이아 · 첫 구매 2배', off(p + '원'))).join('');
    return `<h3>뽑기 · 소환 Lv 1</h3>${pulls}<div class="desc" style="font-size:11px;margin-top:4px">${odds}</div><h3>성장 패키지</h3>${steps}<h3>편의</h3>${conv}<h3>패스</h3>${passes}<h3>다이아</h3>${gems}`;
  },
  rebirthDlg: () => {
    const auto = [[1, '공방 자동 강화'], [3, '자동 돌파'], [5, '시작 스테이지 건너뛰기'], [8, '자동 합성'], [12, '자동 건너뛰기 5배'], [20, '자동 환생']].map(([n, what]) => line(what, n + '회')).join('');
    const ups = ['화력', '군자금', '오프라인 효율', '오프라인 시간', '보스 피해', '치명 피해', '유물·보석 발견', '유지비 감소'].map(n => line(n, `Lv 0 ${off('+')}`)).join('');
    return `${line('받을 훈장', '0')}${line('보유 훈장', '0')}<div class="rowline"><span>스테이지 50</span>${off('환생')}</div><h3>훈장 강화</h3>${ups}<h3>자동화</h3>${auto}`;
  },
  rankDlg: () => `<h3>최고 기록</h3>${line('나', '웨이브 ' + G.wave)}${line('순위', '—')}<h3>기지 털기</h3>${line('습격권', '0/5')}${line('리그', '—')}`,
};
document.querySelectorAll('#side .sbtn').forEach(b => b.addEventListener('click', () => {
  ensureAudio();
  const d = document.getElementById(b.dataset.dlg);
  d.querySelector('.dbody').innerHTML = SIDE[b.dataset.dlg]();
  d.showModal();
  d.scrollTop = 0; // opens at its top (focus would scroll it to the close button)
}));
