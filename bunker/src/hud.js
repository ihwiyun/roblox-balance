'use strict';
// The page around the picture: the resources, the wave and the buttons over it, the bottom bar with its sheets
// and full-screen menus, the wave window, settings, and power saving.
/* ================= icons and faces ================= */
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
document.querySelectorAll('[data-ico]').forEach(el => el.prepend(iconCanvas(el.dataset.ico, +el.dataset.s || (el.classList.contains('tab') ? 1.5 : 1.25))));
// the same icons as small CSS pictures, for the menus (built as HTML text) and the prices on the buy buttons
{
  const url = n => iconCanvas(n, 1).toDataURL();
  const css = Object.keys(ART.icons).map(n => `.ic-${n}{background-image:url(${url(n)})}`).join('') + ['coin', 'food', 'mineral'].map(n => `.ci-${n}{background-image:url(${url(n)})}`).join('');
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
}
const ic = (name, s = 1) => `<i class="ic ic-${name}" style="--s:${s}"></i>`;
// faces as images, drawn once for each look and kit
const faces = new Map();
function face(person, size) {
  const gear = gearOf(person), key = person.look.key + JSON.stringify(gear);
  let url = faces.get(key);
  if (!url) { url = portrait(person, 1).toDataURL(); faces.set(key, url); }
  return `<img class="por" src="${url}" alt="" style="width:${size}px;height:${size}px">`;
}
const nodes = {};
for (const id of ['app', 'stage', 'tabs', 'menu', 'menuTitle', 'menuTabs', 'panel', 'menuFoot', 'bunkerFill', 'bunkerText', 'bunkerTrack', 'fenceFill', 'fenceText', 'speed', 'notes', 'ammo', 'ammoNum', 'ammoBar', 'waveBtn', 'wavePrev', 'waveNext', 'waveBar', 'saver', 'svWave', 'svGold', 'svTime']) nodes[id] = document.getElementById(id);
/* ================= the systems (src/systems.js: inventories, summons, the shop, prestige, records) ================= */
// The screens read SYS once it says it is ready; until then they show what the game itself has
const sys = () => (typeof SYS !== 'undefined' && SYS.ok && SYS.ready ? SYS : null);
const sysCall = (fn, ...a) => { const S = sys(); return S && typeof S[fn] === 'function' ? S[fn](...a) : null; };
addEventListener('sys-ready', () => { refreshTop(); renderPanel(true); });
// a change rebuilds only what it changed (a rebuilt button under a finger loses the tap)
addEventListener('sys-change', () => { refreshTop(); renderPanel(false); if (sheet.render && !sheet.el.hidden) { const h = sheet.render(); if (h !== sheet.key) { sheet.key = h; sheet.body.innerHTML = h; } } });
// prices from the systems: a number is gold, or an object of currencies; red when short
const CUR_ICON = { gold: 'coin', money: 'coin', food: 'food', ore: 'mineral', mineral: 'mineral', gems: 'ruby', diamonds: 'diamond', parts: 'drill', medals: 'medal' };
const curOf = () => sysCall('currencies') || { gold: G.money, food: G.food, ore: G.mineral };
const priceObj = p => (typeof p === 'number' ? { gold: p } : p || {});
const canAfford = p => { const c = curOf(); return Object.entries(priceObj(p)).every(([k, v]) => (c[k] ?? 0) >= v); };
const priceHtml = p => { const c = curOf(); return Object.entries(priceObj(p)).filter(([, v]) => v > 0).map(([k, v]) => `<span class="cost${(c[k] ?? 0) < v ? ' short' : ''}">${ic(CUR_ICON[k] || 'coin')}<span class="num">${fmt(v)}</span></span>`).join(''); };
// the HUD is looked at often and written only where something changed
function setText(el, text) { if (el._t !== text) { el._t = text; el.textContent = text; } }
function setWidth(el, frac) { const w = Math.round(clamp(frac, 0, 1) * 1000) / 10 + '%'; if (el._w !== w) { el._w = w; el.style.width = w; } }
function setOff(el, off) { if (el.disabled !== off) el.disabled = off; }
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

/* ================= what the last two minutes earned ================= */
// gold made and zombies killed, noted once a second by the clock (at double speed a minute earns double). A longer
// gap than the frame loop plays out (time away, credited without gold) starts the count again
const EARN = [];
function sampleEarn() {
  const now = performance.now() / 1000, last = EARN[EARN.length - 1];
  if (last && now - last[0] < 1) return;
  if (last && now - last[0] > CATCH_UP + 1) EARN.length = 0;
  EARN.push([now, G.earned, G.totalKills]);
  while (EARN.length > 2 && now - EARN[1][0] >= 120) EARN.shift();
}
function perMinute() {
  const a = EARN[0], b = EARN[EARN.length - 1], t = a ? (b[0] - a[0]) / 60 : 0;
  return t > 0 ? { gold: (b[1] - a[1]) / t, kills: (b[2] - a[2]) / t } : { gold: 0, kills: 0 };
}

/* ================= the bottom bar and its menus ================= */
// 강화 opens a sheet over the bottom of the picture; 기지 opens over the whole screen, and its 지하 page is a sheet
// too (the floor shows in the picture above it). 환생 and 랭킹 (beside the picture) and 도감 (in settings) open
// over the whole screen
const MENUS = {
  up: { title: '강화' },
  gear: { title: '장비', tabs: [['gun', '무기'], ['turret', '터렛'], ['relic', '유물']] },
  crew: { title: '캐릭터' },
  base: { title: '기지', tabs: [['def', '방어'], ['under', '지하']] },
  shop: { title: '상점', tabs: [['pack', '패키지'], ['gem', '다이아'], ['pass', '편의·패스']] },
  rebirth: { title: '환생' },
  rank: { title: '랭킹', tabs: [['best', '최고 기록'], ['raid', '기지 털기']] },
  codex: { title: '도감' },
};
// what is open, the page of each menu, levels bought per tap (0: MAX), the grade shown, the person picked
const ui = { open: null, sub: { up: 'fire', gear: 'gun', crew: 'crew', base: 'def', shop: 'pack', rank: 'best' }, bulk: 1, grade: -1 };
const sheetOf = m => m === 'up' ? 'up' : m === 'base' && ui.sub.base === 'under' ? 'ug' : null;
const menuCovers = () => !!ui.open && !sheetOf(ui.open);
function layout() {
  const sh = ui.open && sheetOf(ui.open), root = document.documentElement;
  root.classList.toggle('ui-up', sh === 'up'); root.classList.toggle('ui-ug', sh === 'ug');
  root.classList.toggle('ui-sheet', !!sh); root.classList.toggle('ui-full', !!ui.open && !sh);
  nodes.menu.hidden = !ui.open;
  for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t.dataset.tab === ui.open));
  // the floors below are on show only with 기지's 지하 page up
  const v = sh === 'ug' ? 'under' : 'yard';
  if (G.view !== v) setView(v); else fitStage();
}
function openMenu(m) {
  ensureAudio();
  if (ui.open !== m) { ui.open = m; ui.pick = false; nodes.panel.scrollTop = 0; }
  layout();
  renderPanel(true);
}
function closeMenu() {
  if (!ui.open) return;
  ui.open = null;
  layout();
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  // a sheet's own button folds it away again
  if (ui.open === b.dataset.tab && sheetOf(ui.open)) closeMenu(); else openMenu(b.dataset.tab);
}));
document.querySelectorAll('#side [data-open]').forEach(b => b.addEventListener('click', () => openMenu(b.dataset.open)));
document.getElementById('menuClose').addEventListener('click', closeMenu);
addEventListener('keydown', e => { if (e.key === 'Escape' && ui.open && !document.querySelector('dialog[open]')) closeMenu(); });
nodes.menuTabs.addEventListener('click', e => {
  const b = e.target.closest('[data-sub]');
  if (!b || ui.sub[ui.open] === b.dataset.sub) return;
  ui.sub[ui.open] = b.dataset.sub; nodes.panel.scrollTop = 0;
  layout(); renderPanel(true);
});
let tabsKey = '';
function renderTabs() {
  const M = MENUS[ui.open], key = ui.open + ':' + (ui.sub[ui.open] || '');
  if (key === tabsKey) return;
  tabsKey = key;
  nodes.menuTitle.textContent = M.title;
  nodes.menuTabs.innerHTML = (M.tabs || []).map(([k, name]) => `<button type="button" role="tab" data-sub="${k}" aria-selected="${ui.sub[ui.open] === k}">${name}</button>`).join('');
}
function setView(v) {
  G.view = v;
  if (v === 'under') refreshUnder(); else showYard();
  document.documentElement.classList.toggle('under', v === 'under');
  fitStage();
}
// below ground one floor is shown at a time: the floor buttons of 기지's 지하 page pick it (and a purchase there
// shows its floor)
function viewFloor(k) {
  G.floorView = k;
  if (ui.open !== 'base' || ui.sub.base !== 'under') { ui.sub.base = 'under'; openMenu('base'); return; }
  if (G.view !== 'under') setView('under'); else showFloor(k);
  renderPanel(true);
}

/* ================= prices ================= */
// the price of the next level of anything: what the cards show is exactly what a purchase takes
function priceOf(id) {
  const [kind, key] = id.split(':');
  if (kind === 'gun') return G.lv[key] >= GUN[key].max ? null : capCost(gunCost(key, G.lv[key]));
  if (kind === 'bunker') return G.bunker >= MAX_BUNKER ? null : capCost(bunkerCost(G.bunker));
  if (kind === 'fence') return G.fence >= MAX_FENCE ? null : capCost(fenceCost(G.fence));
  if (kind === 'live') return G.live >= LIVE.max ? null : capCost(LIVE.cost(G.live));
  if (kind === 'farm') return G.farm >= FARM.max ? null : capCost(FARM.cost(G.farm));
  if (kind === 'mine') return G.mine >= MINE.max ? null : capCost(MINE.cost(G.mine));
  return null;
}
// a price as small resource chips: icon and amount, red when you are short
const COST_ICON = { money: 'coin', food: 'food', mineral: 'mineral' };
const costHtml = c => Object.entries(c).map(([k, v]) => `<span class="cost${G[k] < v ? ' short' : ''}"><i class="ci ci-${COST_ICON[k]}"></i>${fmt(v)}</span>`).join('');
// every 10th level the next purchase is a breakthrough (materials + gold) that changes the look
const BREAKS = { bunker: () => typeof bunkerBreak === 'function' && bunkerBreak(G.bunker), fence: () => typeof fenceBreak === 'function' && fenceBreak(G.fence),
  live: () => typeof facBreak === 'function' && facBreak('live', G.live), farm: () => typeof facBreak === 'function' && facBreak('farm', G.farm), mine: () => typeof facBreak === 'function' && facBreak('mine', G.mine) };
const isBreak = id => !!(BREAKS[id] && BREAKS[id]());
// levels bought with one tap: x1, x5, x10, or MAX (0: as many as can be paid)
const BULK = [1, 5, 10, 0];
// where an upgrade's level lives, so a plan can step it ahead and put it back
function levelRef(id) {
  const [kind, key] = id.split(':');
  if (kind === 'gun') return { get: () => G.lv[key], set: v => { G.lv[key] = v; } };
  if (BREAKS[kind]) return { get: () => G[kind], set: v => { G[kind] = v; } };
  return null;
}
const addCost = (a, b) => { const s = { ...a }; for (const [k, v] of Object.entries(b)) s[k] = (s[k] || 0) + v; return s; };
// what the next tap buys: the levels and their total, priced level by level as single purchases would be.
// It never runs past a breakthrough (that one is bought on its own), and MAX takes as many as can be paid
// (one at least, so the card shows the price it waits for)
function planOf(id, want = ui.bulk) {
  const first = priceOf(id);
  if (!first) return null;
  const ref = levelRef(id);
  if (want === 1 || !ref) return { n: 1, cost: first };
  const L0 = ref.get();
  let n = 0, cost = {};
  try {
    for (;;) {
      const c = n ? priceOf(id) : first;
      if (!c) break;
      const brk = isBreak(id);
      if (brk && n) break;
      const sum = addCost(cost, c);
      if (!want && n && !canPay(sum)) break;
      cost = sum; n++;
      if (brk || n === want) break;
      ref.set(ref.get() + 1);
    }
  } finally { ref.set(L0); }
  return { n, cost };
}

/* ================= the menus' pages ================= */
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
// turret places open at these bunker levels, relic places at these best waves
const TURRET_AT = [25, 50, 100, 200, 400, 700], RELIC_AT = [20, 50, 100, 200, 400, 700, 1000, 2000];
const FLOORS_UI = [['1층 침실', 'bed'], ['2층 식량', 'farm'], ['3층 채굴', 'pick']];
const floorLevel = k => [G.live, G.farm, G.mine][k];
const sec = (left, right = '') => `<div class="sec"><span>${left}</span><span>${right}</span></div>`;
const line = (left, right) => `<div class="rowline"><span>${left}</span><span>${right}</span></div>`;
const off = text => `<button class="mini" type="button" disabled>${text}</button>`;
const slot = (cls, inner = '') => `<div class="slot ${cls}">${inner}</div>`;
const grid = (cols, cells) => `<div class="grid c${cols}">${cells.join('')}</div>`;
const ph = (w, h, inner = '') => `<span class="ph" style="width:${w};height:${h}">${inner}</span>`;
// levels bought per tap: a small chip group at the top right of the list
const bulkHtml = () => `<div class="tool"><div class="chipset">${BULK.map(n => `<button class="fchip tap" type="button" data-bulk="${n}" aria-pressed="${ui.bulk === n}">${n ? 'x' + n : 'MAX'}</button>`).join('')}</div></div>`;
// an upgrade: a picture, the name and level, progress to the top level, and the price of what one tap buys
function cardHtml(c) {
  const plan = c.max ? null : planOf(c.id), lv = c.lv + (plan && isBreak(c.id) ? ' · 돌파' : '');
  const pic = c.pic ? `<span class="ph pic ${c.pic}">${ic(c.ico, 2)}</span>` : ic(c.ico, 2);
  const btn = plan ? `<button class="buy" type="button" data-buy="${c.id}"${canPay(plan.cost) ? '' : ' disabled'}>${costHtml(plan.cost)}</button>` : '<button class="buy" type="button" disabled>완료</button>';
  const head = c.inline ? `<div><span class="name">${c.name}</span> <span class="sub">${lv}</span></div>` : `<div class="name">${c.name}</div><div class="sub">${lv}</div>`;
  return `<div class="ucard">${pic}<div class="body">${head}<div class="prog"><i style="width:${c.prog * 100}%"></i></div></div>${btn}</div>`;
}
const fireHtml = () => bulkHtml() + Object.entries(GUN).map(([k, g]) => cardHtml({ id: 'gun:' + k, ico: { atk: 'bullet', spd: 'rate', mag: 'mag' }[k], name: g.name, lv: 'Lv ' + G.lv[k], inline: true, prog: G.lv[k] / g.max, max: G.lv[k] >= g.max })).join('');
const cmdHtml = () => sec('지휘관 Lv 1', '포인트 0') + ['위력', '속사', '행운', '정밀', '지휘', '보급'].map(n => line(n, `0 ${off('+')}`)).join('');
// a bed's sleeper: the face and the job (the hands are nameless, bought for their section); a bed empty or not open
const faceCell = (p, size) => `<div class="cell">${ph('100%', size + 'px', face(p, size))}<span>${p.job}</span></div>`;
const shutCell = (size, label, lock, w = '100%') => `<div class="cell off">${ph(w, size + 'px', lock ? ic('lock', 2) : '')}<span>${label}</span></div>`;
// 기지's turret places: opened by the bunker level; a tap picks the turret that stands there
function turretPlaces(B) {
  const list = sysCall('turrets'), sl = sysCall('slots'), at = sl ? sl.turretAt : TURRET_AT, open = sl ? sl.turrets : TURRET_AT.filter(L => B >= L).length, box = artBox('turret');
  const cells = at.map((L, k) => {
    if (k >= open) return `<div class="slot lock" style="height:${box.h + 32}px">${ic('lock')}<span class="aux">Lv ${L}</span></div>`;
    const on = list && list.find(t => t.slot === k);
    return on ? itemCard('turret', on, `data-turretslot="${k}"`) : `<button class="icard slot" type="button" data-turretslot="${k}" style="height:${box.h + 32}px"${list ? '' : ' disabled'}></button>`;
  });
  return sec('터렛 칸', (list ? list.filter(t => t.slot >= 0).length : 0) + '/' + open) + gridOf(box.w + 16, cells, 6);
}
// 기지 > 방어: the bunker and the fence, the turret places; above ground the roof's gunners (bought a slot at a time,
// each with the weapon in its hands) and the workshop's hands; below, the floors and their hands
function defHtml() {
  const BL = G.bunker, F = G.fence;
  return bulkHtml()
    + cardHtml({ id: 'bunker', pic: 'lg', ico: 'bunker', name: '벙커', lv: bunkerInfo(BL).name + ' · Lv ' + BL, prog: BL / MAX_BUNKER, max: BL >= MAX_BUNKER })
    + cardHtml({ id: 'fence', pic: 'lg', ico: 'fence', name: '울타리', lv: (F ? fenceInfo(F).name + ' · ' : '') + 'Lv ' + F, prog: F / MAX_FENCE, max: F >= MAX_FENCE })
    + turretPlaces(BL)
    + (sys() ? sec('지상') + placeRow('지붕 사수', 'person', 'roof') + roofGunners().map(gunnerRow).join('') + placeRow('작업장', 'drill', 'workshop') : '')
    + sec('지하') + FLOORS_UI.map(([name, ico], k) => `<div class="floorrow"><button class="go" type="button" data-floor="${k}">${ph(FLOOR_SECTION[k] && sys() ? '48px' : '72px', '44px', ic(ico, 2))}<span>${name}<br>Lv ${floorLevel(k)}</span>${ic('next')}</button>${FLOOR_SECTION[k] ? workerBuy(FLOOR_SECTION[k]) : ''}</div>`).join('');
}
function underHtml() {
  const k = G.floorView || 0, L = floorLevel(k), max = [LIVE, FARM, MINE][k].max;
  const chips = `<div class="chips c4">${FLOORS_UI.map(([n], j) => `<button class="chip" type="button" data-floor="${j}" aria-pressed="${j === k}">${n}</button>`).join('')}<button class="chip" type="button" disabled>4층 연구소</button></div>`;
  const card = cardHtml({ id: ['live', 'farm', 'mine'][k], pic: 'sm', ico: FLOORS_UI[k][1], name: ['침대', '씨앗', '곡괭이'][k], lv: '레벨 · Lv ' + L, inline: true, prog: L / max, max: L >= max });
  // the living floor: its beds and who sleeps in them (nobody is hired into a bed: hands are bought for a section)
  const beds = bedsOf(G.live);
  const workers = k ? (sys() ? `<div class="sec"><span>일꾼</span>${workerBuy(FLOOR_SECTION[k], '')}</div>` : '')
    : sec('침대', hired().length + '/' + beds) + grid(5, G.crew.map((c, i) => c ? faceCell(c, 40) : i < beds ? shutCell(40, '빈 침대', false) : shutCell(40, 'Lv ' + LIVE.beds[i], true)));
  return chips + bulkHtml() + card + workers;
}
// a section above ground where hands are bought: its picture and name, how many of how many, +1 with its price
const placeRow = (name, ico, section) => `<div class="floorrow"><div class="go place">${ph('48px', '44px', ic(ico, 2))}<span>${name}</span></div>${workerBuy(section)}</div>`;
// the roof's gunners, a slot each: the systems' list (SYS.gunners) when there is one, else the crew on the roof; each
// with the weapon in its hands and the key the weapon picker equips by (나 is not one: its weapon is in 캐릭터)
function roofGunners() {
  const ws = sysCall('weapons') || [], roof = G.crew.filter(c => c && c.job === '사수'), L = sysCall('gunners');
  const held = key => ws.find(w => w.equippedBy === key) || null;
  if (Array.isArray(L)) return L.filter(g => g && (g.key ?? g.id) !== 'me').map((g, n) => {
    const key = g.key ?? g.id ?? 'roof:' + n, wi = typeof g.weapon === 'number' ? g.weapon : g.weapon && typeof g.weapon === 'object' ? g.weapon.i : null;
    return { key, person: g.person || (Number.isInteger(g.bed) ? G.crew[g.bed] : null) || roof[n] || G.hero, weapon: wi != null && wi >= 0 ? ws[wi] || null : held(key) };
  });
  return roof.map(c => ({ key: c.i, person: c, weapon: held(c.look.key) }));
}
// a weapon in a slot as large as the art (2x), its level; an empty slot the same size
const weaponSlot = (w, extra = '') => { const box = artBox('weapon'); return `<span class="slot${w ? ' g' + w.grade : ''} ${extra}" style="width:${box.w + 16}px;height:${box.h + 32}px">${w ? itemArt('weapon', w.i, true) + `<em>Lv ${w.level}</em>` : ''}</span>`; };
// a gunner on the roof: standing, small, and the weapon in its hands as a slot (a tap picks another)
const gunnerRow = g => `<div class="gunrow">${standHtml(g.person, 2)}<button class="wslot tap" type="button" data-gunner="${g.key}" aria-label="무기 고르기">${weaponSlot(g.weapon)}</button><span class="aux">${g.weapon ? g.weapon.name : ''}</span></div>`;
// a floor's workers: how many of how many, and +1 with its price
const FLOOR_SECTION = [null, 'food', 'mine'];
function workerBuy(section, cls = 'sm') {
  const w = sysCall('workers', section);
  if (!w) return '';
  const why = w.reason || (w.count >= w.max ? '최대' : null), ok = w.canBuy ?? (!why && canAfford(w.price));
  return `<span class="wbuy"><span class="num">${w.count}/${w.max}</span>${B('sub ' + cls, why || '+1 ' + priceHtml(w.price), ok ? `data-worker="${section}"` : 'disabled')}</span>`;
}
// the one picked, standing as the game draws them: the idle frames side by side (body, then face and headgear by
// the depth rule of drawPerson), shown four times as large as a CSS strip that steps through them
const stands = new Map();
function stand(p) {
  const gear = gearOf(p), key = p.look.key + JSON.stringify(gear);
  let st = stands.get(key);
  if (!st) {
    const pal = palFor(p, gear), set = SPR[gear.body], a = set.anims.idle || set.anims.walk, n = a.F.length, w0 = 40, h0 = 44, ox = 4, oy = 8, frames = [];
    for (const fr of a.F) {
      const buf = new Uint32Array(w0 * h0), z = new Float32Array(w0 * h0).fill(-1e9);
      const put = (x, y, c, d) => { x += ox; y += oy; if (x < 0 || y < 0 || x >= w0 || y >= h0) return; const i = y * w0 + x; if (d <= z[i]) return; z[i] = d; buf[i] = c; };
      for (let k = 0; k < fr.cells.length; k += 3) put(fr.cells[k], fr.cells[k + 1], pal[fr.cells[k + 2]], (set.ay - fr.cells[k + 1]) * perPx + .02);
      if (fr.head) {
        const [hx, hy] = fr.head, d = (set.ay - hy) * perPx + .06;
        for (const [stp, dd] of [[ART_HUMANS.heads[p.look.key] || ART_HUMANS.heads.hero, d], [gear.head && ART_HUMANS.gear[gear.head], d + .01]]) {
          if (stp) stp.F.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') put(hx - stp.ax + x, hy - stp.ay + y, pal[ch.charCodeAt(0)], dd); }));
        }
      }
      frames.push(buf);
    }
    let x0 = w0, y0 = h0, x1 = -1, y1 = -1;
    for (const f of frames) for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) if (f[y * w0 + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, strip = new Uint32Array(w * n * h), c = document.createElement('canvas');
    frames.forEach((f, i) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) strip[y * w * n + i * w + x] = f[(y + y0) * w0 + x + x0]; });
    c.width = w * n; c.height = h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(strip.buffer), w * n, h), 0, 0);
    stands.set(key, st = { url: c.toDataURL(), w, h, n, t: n / (a.fps || 3) });
  }
  return st;
}
const standHtml = (p, k = 4) => { const st = stand(p); return `<span class="stand" role="img" aria-label="${p.name}" style="width:${st.w * k}px;height:${st.h * k}px;background-image:url(${st.url});background-size:${st.w * k * st.n}px ${st.h * k}px;--w:${st.w * k}px;--n:${st.n};--t:${st.t}s"></span>`; };
// 캐릭터: 나 standing with the weapon in its hands (a tap picks another); the crew cards, a collection whose passive
// abilities work by themselves (owned in colour with their stars, the rest as silhouettes), and 동료 모집
function cardCell(c) {
  const box = artBox('crew'), stars = c.owned && c.stars ? `<em>${ic('star')}${c.stars}</em>` : '', dupes = c.owned && c.toNextStar != null ? `<u>${c.dupes}/${c.dupes + c.toNextStar}</u>` : '';
  const inner = `<span class="slot g${c.grade}" style="height:${box.h + 16}px">${itemArt('crew', c.id === 'me' ? 'hero' : String(c.id), c.owned)}${stars}${dupes}</span><b>${c.owned ? c.name : '???'}</b>`;
  return c.owned ? `<button class="rc card" type="button" data-card="${c.id}">${inner}</button>` : `<div class="rc card off">${inner}</div>`;
}
function crewHtml() {
  const p = G.hero, fam = weaponFamily(G.lv.atk), ws = sysCall('weapons'), w = ws && ws.find(x => x.equippedBy === 'me');
  // the weapon in 나's hands (systems), else the rifle the game draws for all
  const slotHtml = extra => w ? weaponSlot(w, extra) : `<span class="slot ${extra}">${gunImg(fam)}<em>Lv ${G.lv.atk}</em></span>`;
  const weapon = `<button class="wslot tap" type="button" data-pick aria-label="무기 고르기">${slotHtml('')}<span class="aux">${w ? w.name : weaponLookName(G.lv.atk)}</span></button>`;
  const top = `<div class="hero">${standHtml(p)}${weapon}</div><div class="info"><b class="t16">${p.name}</b><div class="role">사수</div>` + line('사격', `<b class="num">${fmt(damageOf())}</b>`) + '</div>';
  // the weapons to pick from (a tap on the weapon slot): those owned, the one carried outlined
  if (ui.pick && ws) { pickSheet('무기', 'weapon', w ? w.i : -1, i => sysCall('equipWeapon', 'me', i)); ui.pick = false; }
  if (ui.pick) return top + `<div class="wpick"><div class="sh"><b class="t16">무기</b><button class="ib tap" type="button" data-unpick aria-label="닫기">${ic('close', 1.5)}</button></div>`
    + sec('보유', '1') + grid(5, [slotHtml('ring')]) + '<div class="tool">' + B('sub', '장비로', 'data-gogear') + '</div></div>';
  const btns = `<div class="acts">${B('pri grow', '레벨업', 'disabled')}${B('sub', '대표', 'disabled')}</div>`;
  const cards = sysCall('cards') || [{ id: 'me', name: p.name, grade: 0, owned: true, stars: 1, toNextStar: null }];
  return top + btns + sec('보유 동료', cards.filter(c => c.owned).length + '/' + cards.length) + strip('crew', '동료 모집', 200, 'mid') + gridOf(artBox('crew').w + 16, cards.map(cardCell), 4);
}
// a crew card up close: its portrait, grade and stars, its ability, the copies to its next star
function cardSheet(id) {
  const find = () => (sysCall('cards') || []).find(c => c.id === id);
  const c = find();
  if (!c) return;
  openSheet(c.name, () => {
    const x = find();
    return `<div class="ihero slot g${x.grade}">${itemArt('crew', x.id === 'me' ? 'hero' : String(x.id), true)}</div><div class="sec"><span class="gr g${x.grade}">${GRADES[x.grade]}</span><span class="num">${ic('star')}${x.stars}</span></div>`
      + (x.desc ? `<p class="aux">${x.desc}</p>` : '') + (x.toNextStar != null ? line('다음 별까지', `<b class="num">${x.toNextStar}</b>`) : '');
  });
}
// buttons: the primary filled (one a screen), the secondary an outline; small icons and labels go inside
const B = (cls, inner, attrs = '') => `<button class="b ${cls} tap" type="button"${attrs ? ' ' + attrs : ''}>${inner}</button>`;
const gemCost = n => `${ic('ruby')}<span class="num">${n.toLocaleString('en')}</span>`;
// the summon strip at the top of each 장비 tab (and 동료 모집): its level, the odds, one pull and ten. Pulls are not in
// the game yet: the buttons are there, switched off
// the summon strip at the top of each 장비 tab and in 캐릭터 (동료 모집): its level and the way to the rates, one pull
// and ten. Until the systems are ready the buttons are there, switched off
function strip(kind, label, price, cls = '') {
  const I = sysCall('summonInfo', kind), cur = I && I.currency === 'diamonds' ? 'diamond' : 'ruby';
  const lv = I ? I.level : 1, fill = I && I.nextAt ? Math.min(1, (I.pulls - (I.prevAt || 0)) / Math.max(1, I.nextAt - (I.prevAt || 0))) : 0;
  const one = I ? I.price : price, ten = I ? I.price10 : price * 10, c = curOf(), gems = c.gems || 0, all = gems + (I && I.diamondsToo ? c.diamonds || 0 : 0);
  // which it spends: gems while they last, then diamonds (a price that cannot be paid shows its own currency)
  const cost = n => `${gems >= n || all < n ? ic(cur) : gems > 0 ? ic(cur) + ic('diamond') : ic('diamond')}<span class="num">${n.toLocaleString('en')}</span>`;
  const can = (n, flag) => !!I && (flag ?? all >= n);
  return `<div class="strip ${cls}"><button class="lv tap" type="button" data-rates="${kind}"${I ? '' : ' disabled'}><b>${label} Lv ${lv}</b><span><span class="prog2"><i style="width:${fill * 100}%"></i></span><span class="link">확률</span></span></button>`
    + B('sub sm', '1회 ' + cost(one), can(one, I && I.canPay) ? `data-summon="${kind}:1"` : 'disabled') + B('sub sm', '10회 ' + cost(ten), can(ten, I && I.canPay10) ? `data-summon="${kind}:10"` : 'disabled') + '</div>';
}
// the rifles as the game draws them in the hands (actors.js drawGun), one a family, as small pictures for the weapon
// slots until the 40 weapons are drawn: drawGun paints through putPx, pointed at a small buffer for a moment
const gunPics = [];
function gunPic(fam) {
  if (gunPics[fam]) return gunPics[fam];
  const w = 40, h = 16, buf = new Uint32Array(w * h), z = new Float32Array(w * h).fill(-1e9), keep = putPx, lv = { ...G.lv };
  putPx = (x, y, c, d) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = y * w + x; if (d <= z[i]) return; z[i] = d; buf[i] = c; };
  try { G.lv.atk = fam * 8; G.lv.mag = 0; G.lv.spd = 0; drawGun([6, 6], [16, 6], 0, { flash: 0, target: null }); } finally { putPx = keep; Object.assign(G.lv, lv); }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (buf[y * w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, c = document.createElement('canvas'), crop = new Uint32Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) crop[y * cw + x] = buf[(y + y0) * w + x + x0];
  c.width = cw; c.height = ch; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(crop.buffer), cw, ch), 0, 0);
  return (gunPics[fam] = { url: c.toDataURL(), w: cw, h: ch });
}
const gunImg = (fam, s = 2) => { const g = gunPic(fam); return `<img class="gun" src="${g.url}" alt="" style="width:${g.w * s}px;height:${g.h * s}px">`; };
const PULL_PRICE = { gun: 100, turret: 150, relic: 300 }, PULL_KIND = { gun: 'weapon', turret: 'turret', relic: 'relic' };
/* ================= the collections' pictures: the art agents' files when they are there ================= */
// ART_WEAPONS, ART_TURRETS, ART_RELICS: per item, rows of letters and each letter's colour (as art/portraits.js), any
// size: the size is read from the rows and drawn at 2x. Until a picture exists: the game's rifle drawings for the
// weapons, a pixel icon for the rest; not owned yet: the same picture as a dark silhouette
const artPics = new Map();
const artSet = kind => kind === 'weapon' ? (typeof ART_WEAPONS !== 'undefined' ? ART_WEAPONS : null)
  : kind === 'turret' ? (typeof ART_TURRETS !== 'undefined' ? ART_TURRETS : null) : kind === 'relic' ? (typeof ART_RELICS !== 'undefined' ? ART_RELICS : null)
  : kind === 'crew' ? (typeof ART_PORTRAITS !== 'undefined' ? ART_PORTRAITS : null) : null;
function artPic(kind, i) {
  const key = kind + ':' + i;
  if (artPics.has(key)) return artPics.get(key);
  const set = artSet(kind), e = set && ((set.cards && set.cards[kind + i]) || (Array.isArray(set) ? set[i] : set[i] ?? (set.items && set.items[i])));
  let pic = null;
  if (e && e.rows && e.rows.length) {
    const pal = e.pal || set.pal || ART.iconPal, h = e.rows.length, w = e.rows[0].length, c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = w; c.height = h;
    e.rows.forEach((row, y) => [...row].forEach((ch, x) => { const col = ch !== '.' && pal[ch]; if (col) { g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; g.fillRect(x, y, 1, 1); } }));
    pic = { url: c.toDataURL(), w, h };
  }
  artPics.set(key, pic);
  return pic;
}
// the size a kind's pictures take at 2x (slots and cards are sized from it): the art agents' size, or the stand-ins'
function artBox(kind) {
  const set = artSet(kind), keys = !set ? [] : set.cards ? Object.keys(set.cards).map(k => k.slice(kind.length)) : Object.keys(set);
  for (const i of keys) { const p = artPic(kind, i); if (p) return { w: p.w * 2, h: p.h * 2 }; }
  return kind === 'weapon' ? { w: 96, h: 48 } : { w: 64, h: 64 };
}
// i: the item's index (a crew card: its id, the portrait's key)
function itemArt(kind, i, owned) {
  const p = typeof i === 'string' || i >= 0 ? artPic(kind, i) : null, sil = owned ? '' : ' sil';
  if (p) return `<img class="art${sil}" src="${p.url}" alt="" style="width:${p.w * 2}px;height:${p.h * 2}px">`;
  if (kind === 'weapon') { const g = gunPic(i >= 0 ? i % 5 : 0); return `<img class="gun${sil}" src="${g.url}" alt="" style="width:${g.w * 3}px;height:${g.h * 3}px">`; }
  return `<i class="ic ic-${kind === 'turret' ? 'bunker' : kind === 'relic' ? 'relic' : 'person'}${sil}" style="--s:2"></i>`;
}
// slots are sized from the pictures (2x the art), as many in a row as fit the page: fewer and larger, never cramped
const panelW = () => Math.max(240, (nodes.panel.clientWidth || nodes.app.clientWidth) - 24);
const colsFor = (cardW, max = 5) => Math.max(2, Math.min(max, Math.floor((panelW() + 8) / (cardW + 8))));
const gridOf = (cardW, cells, max) => `<div class="grid" style="grid-template-columns:repeat(${colsFor(cardW, max)},minmax(0,1fr))">${cells.join('')}</div>`;
const MERGE_N = 4; // copies one merge takes (doc); an item may say its own (mergeN)
const idOf = it => it.i ?? it.id;
// one item: its picture in its grade colour; owned, its level and its copies toward the next merge
function itemCard(kind, it, attrs) {
  const own = it.owned, n = it.mergeN || MERGE_N, box = artBox(kind);
  return `<button class="icard slot g${it.grade}" type="button" ${attrs || `data-item="${kind}:${idOf(it)}"`} style="height:${box.h + 32}px">${itemArt(kind, idOf(it), own)}`
    + (own ? `<em>Lv ${it.level}</em>${kind === 'relic' ? '' : `<u class="${it.copies >= n ? 'full' : ''}">${Math.min(it.copies, n)}/${n}</u>`}` : '') + '</button>';
}
const listOf = kind => (kind === 'weapon' ? sysCall('weapons') : kind === 'turret' ? sysCall('turrets') : kind === 'relic' ? sysCall('relics') : null);
function gearHtml() {
  const tab = ui.sub.gear, kind = PULL_KIND[tab], top = strip(kind, '소환', PULL_PRICE[tab]), list = listOf(kind);
  if (tab === 'relic') return top + relicPage(list);
  const per = tab === 'turret' ? 4 : 5, box = artBox(kind);
  const chips = `<div class="chiprow">${[-1, 0, 1, 2, 3, 4, 5, 6, 7].map(n => `<button class="fchip tap${n < 0 ? '' : ' gq g' + n}" type="button" data-grade="${n}" aria-pressed="${ui.grade === n}">${n < 0 ? '전체' : GRADES[n]}</button>`).join('')}</div>`;
  return top + chips + GRADES.map((g, n) => {
    if (ui.grade >= 0 && ui.grade !== n) return '';
    const items = list ? list.filter(it => it.grade === n) : Array.from({ length: per }, (_, k) => ({ i: n * per + k, grade: n, owned: false }));
    return sec(`<span class="gr g${n}">${g}</span>`, items.filter(it => it.owned).length + '/' + items.length) + gridOf(box.w + 16, items.map(it => itemCard(kind, it)), per);
  }).join('');
}
// 유물: the places that carry relics (opened by the best stage; a tap picks one), the sets, and the collection
function relicPage(list) {
  const box = artBox('relic'), worn = list ? list.filter(r => r.slot >= 0) : [], sl = sysCall('slots'), at = sl ? sl.relicAt : RELIC_AT, open = sl ? sl.relics : RELIC_AT.filter(r => (G.record || 0) >= r).length;
  const places = at.slice(0, sl ? sl.relicsMax : at.length).map((r, k) => {
    if (k >= open) return `<div class="slot lock" style="height:${box.h + 32}px">${ic('lock')}<span class="aux">스테이지<br>${r.toLocaleString('en')}</span></div>`;
    const on = worn.find(x => x.slot === k);
    return on ? itemCard('relic', on, `data-relicslot="${k}"`) : `<button class="icard slot" type="button" data-relicslot="${k}" style="height:${box.h + 32}px"${list ? '' : ' disabled'}></button>`;
  });
  const owned = list ? list.filter(r => r.owned).length : 0;
  const sets = sysCall('relicSets');
  return sec('장착 칸', worn.length + '/' + open) + gridOf(box.w + 16, places, 4)
    + sec('세트') + (sets && sets.length ? sets.map(t => line(t.name, `<b class="num${t.active ? '' : ' muted'}">${t.have}/${t.need}</b>`)) : RELIC_SETS.map(n => line(n, '<b class="num">0/3</b>'))).join('')
    + sec('보유', owned + '/' + (list ? list.length : 48)) + gridOf(box.w + 16, (list || Array.from({ length: 48 }, (_, i) => ({ id: i, grade: Math.floor(i / 6), owned: false }))).map(r => itemCard('relic', r)), 5);
}
// an item up close: its picture, grade, what it does, its level and the next merge; owned weapons and turrets enhance
function itemSheet(kind, i) {
  const find = () => (listOf(kind) || []).find(x => idOf(x) === i);
  const it = find();
  if (!it) return;
  openSheet(it.name, () => {
    const x = find(), price = x.owned && kind !== 'relic' ? sysCall('enhancePrice', kind, i) : null, n = x.mergeN || MERGE_N;
    return `<div class="ihero slot g${x.grade}">${itemArt(kind, i, x.owned)}</div><div class="sec"><span class="gr g${x.grade}">${GRADES[x.grade]}</span><span>${x.owned ? 'Lv ' + x.level : ''}</span></div>`
      + (x.desc ? `<p class="aux">${x.desc}</p>` : '') + (x.owned && kind !== 'relic' ? line('합성까지', `<b class="num">${x.toNextMerge ?? Math.max(0, n - x.copies)}</b>`) : '')
      + (price ? `<div class="tool">${B('pri grow', (price.bt ? '돌파 ' : '강화 ') + priceHtml(price), canAfford(price) ? 'data-enh' : 'disabled')}</div>` : '');
  }, d => { if ('enh' in d && sysCall('enhance', kind, i, 1)) sound('buy'); });
}
// a place to fill (a relic place, a turret place, a weapon slot): the owned ones to pick from, the one in it outlined
function pickSheet(title, kind, on, choose) {
  openSheet(title, () => {
    const own = (listOf(kind) || []).filter(x => x.owned);
    return own.length ? gridOf(artBox(kind).w + 16, own.map(x => itemCard(kind, x, `data-choose="${idOf(x)}"`).replace('class="icard', `class="icard${idOf(x) === on ? ' ring' : ''}`)), 4)
      : `<div class="tool">${B('sub', '장비로', 'data-gogear')}</div>`;
  }, d => {
    if (d.choose != null) { choose(+d.choose); sound('buy'); closeSheet(); }
    else if ('gogear' in d) { closeSheet(); ui.sub.gear = kind === 'turret' ? 'turret' : kind === 'relic' ? 'relic' : 'gun'; openMenu('gear'); }
  });
}
// all at once: merge what can be merged; enhance every owned item one level while it can be paid
function mergeAllNow() { const n = sysCall('mergeAll'); if (n) sound('buy'); openSheet('일괄 합성', () => `<div class="sec"><span>합성</span><span class="num">${n || 0}</span></div><div class="tool">${B('pri', '확인', 'data-close')}</div>`); }
function enhanceAllNow() {
  const kind = PULL_KIND[ui.sub.gear];
  let n = 0;
  for (const it of (listOf(kind) || []).filter(x => x.owned)) { const p = sysCall('enhancePrice', kind, idOf(it)); if (p && canAfford(p) && sysCall('enhance', kind, idOf(it), 1)) n++; }
  if (n) sound('buy');
  openSheet('일괄 강화', () => `<div class="sec"><span>강화</span><span class="num">${n}</span></div><div class="tool">${B('pri', '확인', 'data-close')}</div>`);
}
// the shop: what is paid for (packages, diamonds, passes and conveniences), each with its picture (art/products.js)
const prodPics = new Map();
function prodImg(id, k = 2) {
  let p = prodPics.get(id);
  if (p === undefined) {
    const e = typeof ART_PRODUCTS !== 'undefined' && ART_PRODUCTS[id];
    p = null;
    if (e) {
      const h = e.rows.length, w = e.rows[0].length, c = document.createElement('canvas'), g = c.getContext('2d');
      c.width = w; c.height = h;
      e.rows.forEach((row, y) => [...row].forEach((ch, x) => { const col = ch !== '.' && e.pal[ch]; if (col) { g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; g.fillRect(x, y, 1, 1); } }));
      p = { url: c.toDataURL(), w, h };
    }
    prodPics.set(id, p);
  }
  return p ? `<img class="prod" src="${p.url}" alt="" style="width:${p.w * k}px;height:${p.h * k}px">` : '';
}
const krw = n => n.toLocaleString('en') + '원';
// a price that looks like a button inside a product card (the card itself is the button)
const priceTag = (it, primary) => `<span class="b ${primary ? 'pri' : 'sub'}${it.locked ? ' off' : ''}">${it.locked ? ic('lock') : ''}<span class="num">${krw(it.price)}</span></span>`;
function shopHtml() {
  const tab = ui.sub.shop, cat = sysCall('shopCatalog');
  if (!cat) return '';
  const of = t => cat.filter(x => x.tab === t);
  if (tab === 'pack') {
    const steps = of('pack'), next = steps.find(x => !x.locked);
    return sec('성장 패키지', steps.filter(x => x.bought).length + '/' + steps.length) + steps.map(it => `<button class="pk2" type="button" data-product="${it.id}">${prodImg(it.id)}<span class="bd"><b>${it.name}</b><span>${it.contents.join(' + ')}</span>`
      + (it.bought ? '' : it.locked && it.lockReason ? `<span class="aux">${it.lockReason}에 열림</span>` : '') + (it.bought ? '<span class="b sub off">구매 완료</span>' : priceTag(it, it === next)) + '</span></button>').join('');
  }
  if (tab === 'gem') return `<div class="grid c2 top">${of('dia').map(it => `<button class="cv2" type="button" data-product="${it.id}">${prodImg(it.id)}<span class="amt">${ic('diamond')}<b class="num">${(it.dia || 0).toLocaleString('en')}</b></span><span>${krw(it.price)}</span>${it.first ? '<span class="aux">첫 구매 2배</span>' : ''}</button>`).join('')}</div>`;
  const passes = of('pass');
  return sec('패스') + passes.map((it, k) => `<button class="pk2" type="button" data-product="${it.id}">${prodImg(it.id)}<span class="bd"><b>${it.name}</b><span class="aux">${it.contents.join(' + ')}</span>${it.active ? '<span class="aux">사용 중</span>' : ''}${priceTag(it, k === 0)}</span></button>`).join('')
    + sec('편의') + `<div class="grid c2">${of('conv').map(it => `<button class="cv2" type="button" data-product="${it.id}">${prodImg(it.id)}<b>${it.name}</b><span class="aux">${it.contents.join(' + ')}</span>${it.owned ? '<span class="b sub off">구매 완료</span>' : priceTag(it, false)}</button>`).join('')}</div>`;
}
// a product up close: its picture, what is in it, the price and 구매 (a test payment for now); then what came
function productSheet(id) {
  const find = () => (sysCall('shopCatalog') || []).find(x => x.id === id), it = find();
  if (!it) return;
  openSheet(it.name, () => {
    const x = find();
    return `<div class="phero">${prodImg(id, 3)}</div><ul class="contents">${x.contents.map(c => `<li>${c}</li>`).join('')}</ul>`
      + (x.bought || x.owned ? `<div class="tool">${B('sub grow', '구매 완료', 'disabled')}</div>` : x.locked ? (x.lockReason ? `<p class="aux">${x.lockReason}에 열림</p>` : '') + `<div class="tool">${B('pri grow', ic('lock') + `<span class="num">${krw(x.price)}</span>`, 'disabled')}</div>`
        : `<div class="tool">${B('pri grow', `구매 · <span class="num">${krw(x.price)}</span>`, 'data-buy')}</div>`);
  }, d => {
    if (!('buy' in d)) return;
    const got = sysCall('buy', id);
    if (!got) return;
    sound('buy');
    openSheet('받은 것', () => gotHtml(id, got));
  });
}
// what a purchase brought: an item as its slot (as a summon shows it), a currency with its icon, the rest as a line;
// with no item in it, the product's picture on top
function gotHtml(id, got) {
  const CUR = [['보석 ', 'ruby'], ['다이아 ', 'diamond'], ['식량 ', 'food']], lists = ['weapon', 'turret', 'relic'].map(k => [k, listOf(k) || []]);
  const cells = [], rows = [];
  let box = null;
  for (const s of got) {
    const hit = lists.map(([k, l]) => [k, l.find(x => x.name === s)]).find(([, it]) => it), cur = CUR.find(([p]) => s.startsWith(p));
    if (hit) { const [kind, it] = hit, b = artBox(kind); box = box || b; cells.push(`<div class="rc"><span class="slot g${it.grade}" style="height:${b.h + 16}px">${itemArt(kind, idOf(it), true)}</span><b>${it.name}</b></div>`); }
    else rows.push(cur ? line(cur[0].trim(), `${ic(cur[1])}<b class="num">${s.slice(cur[0].length)}</b>`) : line(s, ''));
  }
  return (cells.length ? gridOf(box.w + 16, cells, 4) : `<div class="phero">${prodImg(id, 2)}</div>`) + rows.join('') + `<div class="tool">${B('pri', '확인', 'data-close')}</div>`;
}
// 환생: what it gives now (medals, and a few gems) and the medals kept, the medal upgrades and their prices, what the
// count of rebirths opens
const evacGain = P => `<span><span class="aux">받을 훈장</span><b class="num">+${fmt(P.gainNow)}</b></span>`
  + (P.gems ? `<span><span class="aux">보석</span><b class="num">${ic('ruby')}+${fmt(P.gems)}</b></span>` : '');
function rebirthHtml() {
  const P = sysCall('prestigeInfo');
  if (!P) return '';
  return `<div class="rb">${ic('medal', 2)}${evacGain(P)}<span><span class="aux">보유</span><b class="num">${fmt(P.medals)}</b></span></div>`
    + `<div class="tool">${B('pri grow', '환생', P.gainNow > 0 ? 'data-rebirth' : 'disabled')}</div>`
    + sec('훈장 강화') + grid(4, P.ups.map(u => `<button class="cell up" type="button" data-medal="${u.key}"${(u.canBuy ?? (!u.maxed && P.medals >= u.price)) ? '' : ' disabled'}><b>${u.name}</b><span class="aux">Lv ${u.level}</span>`
      + (u.maxed ? '<span class="aux">최대</span>' : `<span class="cost${P.medals < u.price ? ' short' : ''}">${ic('medal')}<span class="num">${fmt(u.price)}</span></span>`) + '</button>'))
    + sec('자동화', '환생 ' + P.evacs + '회') + P.auto.map(a => line(a.name, (a.unlocked ?? a.on) ? `<button class="fchip tap" type="button" data-auto="${a.key}" aria-pressed="${!!a.on}">${a.on ? '켜짐' : '꺼짐'}</button>` : `<span class="aux">${ic('lock')} 환생 ${a.at}회</span>`)).join('');
}
function rebirthConfirm() {
  const P = sysCall('prestigeInfo');
  if (!P) return;
  openSheet('환생', () => `<div class="rb">${ic('medal', 2)}${evacGain(P)}</div>`
    + line('초기화', '스테이지·강화·자원') + line('유지', '기지·장비·유물·동료·훈장')
    + `<div class="tool">${B('sub', '취소', 'data-close')}${B('pri grow', '환생', 'data-yes')}</div>`, d => { if ('yes' in d) { sysCall('prestige'); sound('buy'); closeSheet(); } });
}
// 랭킹: the player's own runs, best first (other players come with the server); raiding is shown, switched off
function rankHtml() {
  if (ui.sub.rank === 'raid') return `<div class="tool top">${B('pri grow', ic('lock') + ' 기지 털기', 'disabled')}</div>`;
  const R = sysCall('records');
  if (!R) return '';
  // every row is the player's own run: the one under way stands out
  return R.map(r => `<div class="rowline${r.current ? ' me' : ''}"><span><b class="num rank">${r.rank}</b><span>${r.name}</span>${r.current ? '<span class="aux">진행 중</span>' : ''}</span><b class="num">스테이지 ${r.stage.toLocaleString('en')}</b></div>`).join('');
}
function codexHtml() {
  const list = sysCall('weapons'), box = artBox('weapon'), has = (n, k) => list ? list[n * 5 + k].owned : false;
  return sec('보유', (list ? list.filter(w => w.owned).length : 0) + '/40') + GRADES.map((g, n) => sec(`<span class="gr g${n}">${g}</span>`, [0, 1, 2, 3, 4].filter(k => has(n, k)).length + '/5')
    + gridOf(box.w + 16, WEAPON_LADDER[n].map((w, k) => `<div class="cell"><span class="slot g${n}" style="height:${box.h + 16}px;aspect-ratio:auto;width:100%">${itemArt('weapon', n * 5 + k, has(n, k))}</span><span>${list ? list[n * 5 + k].name : w}</span></div>`), 5)).join('');
}
function pageHtml() {
  const m = ui.open, p = ui.sub[m];
  if (m === 'up') return p === 'cmd' ? cmdHtml() : fireHtml();
  if (m === 'crew') return p === 'cmd' ? cmdHtml() : crewHtml();
  if (m === 'gear') return gearHtml();
  if (m === 'base') return p === 'under' ? underHtml() : defHtml();
  if (m === 'shop') return shopHtml();
  if (m === 'rebirth') return rebirthHtml();
  if (m === 'rank') return rankHtml();
  if (m === 'codex') return codexHtml();
  return '';
}
function footHtml() {
  if (ui.open === 'gear' && ui.sub.gear !== 'relic') { const on = !!sys(), m = sysCall('mergeable'); return B('sub', '도감', 'data-codex') + B('sub', '일괄 강화', on ? 'data-enhall' : 'disabled') + B('pri grow', '일괄 합성', m && m.count ? 'data-mergeall' : 'disabled'); }
  return '';
}
// a menu is rebuilt only when what it shows changed (and not under a finger: a rebuilt button loses the tap)
let panelKey = '', footKey = '', pressing = false;
nodes.panel.addEventListener('pointerdown', () => { pressing = true; });
addEventListener('pointerup', () => { pressing = false; }); addEventListener('pointercancel', () => { pressing = false; });
// the grade chips slide in one row; its cut end fades until the row is slid to its end
let chipPage = '';
const chipEnd = row => row.classList.toggle('end', row.scrollLeft + row.clientWidth >= row.scrollWidth - 2);
nodes.panel.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('chiprow')) chipEnd(e.target); }, true);
function renderPanel(force) {
  if (!ui.open) return;
  renderTabs();
  if (force || !pressing) {
    const html = pageHtml(), foot = footHtml();
    if (force || html !== panelKey) {
      // the grade chips stay slid where they were, on the same page
      const top = nodes.panel.scrollTop, row = nodes.panel.querySelector('.chiprow'), page = ui.open + ':' + ui.sub[ui.open], left = row && page === chipPage ? row.scrollLeft : 0;
      nodes.panel.innerHTML = html; nodes.panel.scrollTop = top; panelKey = html; chipPage = page;
      const row2 = nodes.panel.querySelector('.chiprow');
      if (row2) { row2.scrollLeft = left; chipEnd(row2); }
    }
    if (foot !== footKey) { nodes.menuFoot.innerHTML = foot; footKey = foot; }
  }
  // tiredness moves all the time: its bar is set in place, the menu is not rebuilt for it
  for (const el of nodes.panel.querySelectorAll('[data-tired]')) { const c = G.crew[+el.dataset.tired]; if (c) setWidth(el, c.fatigue / 100); }
}
nodes.panel.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.buy) act(d.buy);
  else if ('bulk' in d) { ui.bulk = +d.bulk; renderPanel(true); }
  else if (d.floor) { ensureAudio(); viewFloor(+d.floor); }
  else if (d.grade) { ui.grade = +d.grade; renderPanel(true); }
  else if (d.card) cardSheet(d.card);
  else if (d.gunner != null) { const g = roofGunners().find(x => String(x.key) === d.gunner); if (g) pickSheet('무기', 'weapon', g.weapon ? g.weapon.i : -1, i => sysCall('equipWeapon', g.key, i)); }
  else if (d.rates) openSheet('확률', () => ratesHtml(d.rates));
  else if (d.item) { const [kind, i] = d.item.split(':'); itemSheet(kind, +i); }
  else if (d.relicslot != null) { const k = +d.relicslot, on = (listOf('relic') || []).find(r => r.slot === k); pickSheet('유물', 'relic', on ? on.id : -1, id => sysCall('equipRelic', k, id)); }
  else if (d.turretslot != null) { const k = +d.turretslot, on = (listOf('turret') || []).find(t => t.slot === k); pickSheet('터렛', 'turret', on ? on.i : -1, i => sysCall('equipTurret', k, i)); }
  else if (d.worker) { if (sysCall('buyWorker', d.worker)) sound('buy'); }
  else if (d.product) productSheet(d.product);
  else if ('rebirth' in d) rebirthConfirm();
  else if (d.medal) { if (sysCall('buyMedalUp', d.medal)) sound('buy'); }
  else if (d.auto) { const a = ((sysCall('prestigeInfo') || {}).auto || []).find(x => x.key === d.auto); if (a) sysCall('setAutomation', a.key, !a.on); }
  else if (d.summon) { const [kind, n] = d.summon.split(':'); summonNow(kind, +n); }
  else if ('pick' in d) { ui.pick = true; renderPanel(true); }
  else if ('unpick' in d) { ui.pick = false; renderPanel(true); }
  else if ('gogear' in d) { ui.pick = false; ui.sub.gear = 'gun'; openMenu('gear'); }
});
// whether any of the levels from + 1 to to begins something new
const crossed = (isNew, from, to) => { for (let L = from + 1; L <= to; L++) if (isNew(L)) return true; return false; };
// a tap on a buy button: the levels of the plan are paid at once and applied; the picture is rebuilt, flashed and
// announced once
function act(id, want = ui.bulk) {
  ensureAudio();
  const [kind, key] = id.split(':');
  const plan = planOf(id, want);
  if (!plan || !canPay(plan.cost)) return;
  const n = plan.n;
  if (kind === 'gun') {
    pay(plan.cost); G.lv[key] += n;
    if (key === 'mag') for (const s of shooters()) if (!s.reload) s.ammo = gunStat('mag');
  } else if (kind === 'bunker') {
    const from = G.bunker;
    pay(plan.cost); G.bunker += n; G.hp = bunkerHp(G.bunker);
    if (crossed(isNewBunkerForm, from, G.bunker)) notify('새 건물 · ' + bunkerInfo().name, '벙커 Lv ' + G.bunker + ' · 체력 ' + fmt(bunkerHp(G.bunker)), 'good');
    { const before = yardPix.slice(); bakeYard(); flashDiff(before, yardPix, 'yard'); }
    resyncPosts(); palCache.clear(); if (G.view !== 'yard') setView('yard'); else fitStage(); // a bigger building may pull the camera back
  } else if (kind === 'fence') {
    const from = G.fence;
    pay(plan.cost); G.fence += n; G.fenceHp = fenceHp(G.fence); G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0];
    if (crossed(isNewFenceForm, from, G.fence)) notify('새 울타리 · ' + fenceInfo().name, '울타리 Lv ' + G.fence + ' · 체력 ' + fmt(fenceHp(G.fence)) + (fenceInfo().electric ? ' · 공격한 좀비 감전' : ''), 'good');
    { const before = yardPix.slice(); composeYard(); flashDiff(before, yardPix, 'yard'); } // only the fence overlays change
    if (G.view !== 'yard') setView('yard');
  } else if (kind === 'live') {
    pay(plan.cost); G.live += n;
    markUnder(0, true); viewFloor(0);
  } else if (kind === 'farm' || kind === 'mine') {
    const from = G[kind];
    pay(plan.cost); G[kind] += n;
    const tiers = kind === 'farm' ? FARM_TIERS : MINE_TIERS, floorName = kind === 'farm' ? '식량층' : '채굴층';
    if (!from || facTier(G[kind]) !== facTier(from)) notify(floorName + ' · ' + tiers[facTier(G[kind])], (kind === 'farm' ? '식량' : '광물') + ' 초당 ' + (kind === 'farm' ? FARM : MINE).rate(G[kind]).toFixed(1), 'good');
    markUnder(kind === 'farm' ? 1 : 2, true); viewFloor(kind === 'farm' ? 1 : 2);
  } else return;
  sound('buy');
  renderPanel(true);
  refreshTop();
}

/* ================= over the picture ================= */
const resNodes = ['money', 'food', 'mineral'].map(r => [r, document.getElementById('r-' + r), document.getElementById('rr-' + r)]);
const gemNode = document.getElementById('r-gem'), diaNode = document.getElementById('r-dia');
const cmdNode = document.getElementById('cmd'), cmdLv = document.getElementById('cmdLv'), cmdBar = document.getElementById('cmdBar');
const bossNode = document.getElementById('boss'), bossName = document.getElementById('bossName'), bossTime = document.getElementById('bossTime'), bossFill = document.getElementById('bossFill'), bossCuts = document.getElementById('bossCuts');
// the boss on the field (SYS.stageNow): one wide bar under the stage pill in place of the stage's own, with its name,
// its health and its clock (red in the last ten seconds); a titan's bar is cut where its phases change
// (without the systems, the game's own boss: its name, health and clock)
function bossNow() {
  const S = sysCall('stageNow');
  if (S) return S.boss;
  const z = G.zombies.find(o => o.type === 'boss' && !o.minion && o.state !== 'dying');
  return z ? { name: z.name, left: Math.max(0, G.bossLeft || 0), hp: z.max ? Math.max(0, z.hp / z.max) : 1, phases: z.phases ? z.phases.length : 1, gathering: z.shield > 0 } : null;
}
function refreshBoss() {
  const b = bossNow();
  nodes.app.classList.toggle('bossup', !!b);
  bossNode.hidden = !b;
  if (!b) return;
  setText(bossName, b.name);
  setText(bossTime, String(Math.ceil(b.left)));
  bossTime.classList.toggle('low', b.left < 10);
  setWidth(bossFill, b.hp);
  bossNode.classList.toggle('shield', !!b.gathering);
  // the phases' shares of its health (the logic's), the cuts where one ends: from the full end of the bar
  let cuts = '';
  if (b.phases > 1) {
    const ph = SYS.hook && SYS.hook.bossPhases ? SYS.hook.bossPhases(G.wave) : null, sh = ph && ph.phases.length === b.phases ? ph.phases : Array(b.phases).fill(1 / b.phases);
    let at = 1;
    for (let k = 0; k < sh.length - 1; k++) { at -= sh[k]; cuts += `<s style="left:${(at * 100).toFixed(2)}%"></s>`; }
  }
  if (bossCuts._h !== cuts) { bossCuts._h = cuts; bossCuts.innerHTML = cuts; }
}
function refreshTop() {
  sampleEarn();
  const pm = perMinute();
  for (const [r, el, rate] of resNodes) {
    setText(el, fmt(G[r]));
    if (r === 'money') { setText(rate, pm.gold > .3 ? '+' + fmt(pm.gold / 60) + '/초' : ''); continue; }
    const net = rateOf(r) - (r === 'food' ? hired().length * UPKEEP : 0);
    const cap = r === 'food' ? foodCap() : mineralCap(), full = G[r] >= cap - .5;
    setText(rate, full && net > 0 ? '가득' : Math.abs(net) > .005 ? (net > 0 ? '+' : '−') + Math.abs(net).toFixed(1) + '/초' : '');
    rate.classList.toggle('neg', net < 0 && !full);
  }
  { const c = sysCall('currencies'); setText(gemNode, fmt(c ? c.gems || 0 : 0)); setText(diaNode, fmt(c ? c.diamonds || 0 : 0)); }
  { const cm = sysCall('commander'); cmdNode.hidden = !cm || cm.unlocked === false; if (cm) { setText(cmdLv, 'Lv ' + cm.level); setWidth(cmdBar, cm.need ? cm.xp / cm.need : 0); } }
  setText(nodes.waveBtn, '스테이지 ' + G.wave);
  setWidth(nodes.waveBar, G.waveKills / killsNeeded(G.wave));
  refreshBoss();
  setOff(nodes.wavePrev, G.wave <= 1); setOff(nodes.waveNext, G.wave >= G.best);
  const maxHp = bunkerHp(G.bunker);
  setWidth(nodes.bunkerFill, G.hp / maxHp);
  setText(nodes.bunkerText, '벙커 ' + fmt(Math.max(0, G.hp)) + '/' + fmt(maxHp));
  nodes.bunkerTrack.classList.toggle('hurt', G.hurt > 0);
  if (G.fence) {
    const max = fenceHp(G.fence);
    setWidth(nodes.fenceFill, G.fenceHp / max);
    setText(nodes.fenceText, (G.fenceDown ? '울타리 복구 ' : '울타리 ') + fmt(G.fenceHp) + '/' + fmt(max));
  } else { setWidth(nodes.fenceFill, 0); setText(nodes.fenceText, '울타리 없음'); }
  if (stageDlg.open) paintStage(pm);
}
// the picture keeps the scale of the main screen's stage (a sheet only moves it up). The camera sits one whole step
// closer than the stage fits, so the ground fills the width and its tips crop; it steps back only while the base
// itself would not fit: the fence (or the building, if it ever reaches past it) with a margin for the zombies at it,
// from the ground up to the people on the roof. A base that grows (a wider building or map) pulls the camera back
// by itself. Below ground one step closer than the stage fits
function baseBox() {
  const B = bunkerInfo(), r = Math.max(FENCE_R, B.half) + 1, h = B.half, xs = [], ys = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const p of [project(a * r, b * r, 0), project(a * h, b * h, B.roof + 2.2)]) { xs.push(p.sx); ys.push(p.sy); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
function fitStage() {
  const dpr = window.devicePixelRatio || 1, sw = nodes.app.clientWidth, sh = nodes.app.clientHeight - nodes.tabs.offsetHeight, f = Math.min(sw / W, sh / H);
  // whole device pixels per game pixel
  let k = f * dpr >= 1 ? Math.floor(f * dpr) : 0;
  if (k && G.view === 'under') k += 1;
  else if (k) {
    // what the stage shows at k device pixels a game pixel, around the middle of the picture
    const b = baseBox(), fits = kc => { const vw = sw * dpr / kc / 2, vh = sh * dpr / kc / 2; return b.x0 >= W / 2 - vw && b.x1 <= W / 2 + vw && b.y0 >= H / 2 - vh && b.y1 <= H / 2 + vh; };
    k += 1;
    while (k > 1 && !fits(k)) k--;
  }
  const scale = k ? k / dpr : f;
  canvas.style.width = W * scale + 'px'; canvas.style.height = H * scale + 'px';
}

/* ================= the wave window: repeat or move on, and what the last two minutes earned ================= */
const stageDlg = document.getElementById('stageDlg'), sdBody = document.getElementById('sdBody');
// a zombie kind as the game draws it walking towards us (its first frame), for the stage window
const foePics = new Map();
function foeImg(type) {
  let f = foePics.get(type);
  if (f === undefined) {
    const set = SPR[type], pal = ZPALS[type];
    f = null;
    if (set && pal) {
      const fr = (set.anims.walk || Object.values(set.anims)[0]).F[0];
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let k = 0; k < fr.cells.length; k += 3) { x0 = Math.min(x0, fr.cells[k]); x1 = Math.max(x1, fr.cells[k]); y0 = Math.min(y0, fr.cells[k + 1]); y1 = Math.max(y1, fr.cells[k + 1]); }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, buf = new Uint32Array(w * h), c = document.createElement('canvas');
      for (let k = 0; k < fr.cells.length; k += 3) buf[(fr.cells[k + 1] - y0) * w + fr.cells[k] - x0] = pal[fr.cells[k + 2]];
      c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf.buffer), w, h), 0, 0);
      f = { url: c.toDataURL(), w, h };
    }
    foePics.set(type, f);
  }
  if (!f) return ic('zombie', 2);
  const k = f.h > 36 ? 1 : 2;
  return `<img class="gun" src="${f.url}" alt="" style="width:${f.w * k}px;height:${f.h * k}px">`;
}
function paintStage(pm = perMinute()) {
  const info = sysCall('stageInfo', G.wave), r = info && info.rewards || {};
  sdBody.innerHTML = `<div class="dh"><b class="t16">스테이지 ${G.wave}</b>${info ? `<span class="aux">${info.theme}</span>` : ''}<button class="ib tap" type="button" data-close aria-label="닫기">${ic('close', 1.5)}</button></div>`
    + (info ? `<div class="foes">${info.zombies.map(z => `<span class="foe">${foeImg(z.sprite || z.key)}<span>${z.name}</span></span>`).join('')}</div>` : '')
    + (info && info.boss ? `<div class="boss">${foeImg('boss')}<b>${info.boss.name}</b><span class="num">${info.boss.time}초</span><span class="aux">${info.boss.desc}</span></div>` : '')
    + (info ? line('처치', `<b class="num">${info.kills}</b>`) + line('보상', priceHtml(r)) : '')
    + `<div class="mode"><button class="fchip tap" type="button" data-mode="repeat" aria-pressed="${G.repeat}">반복</button><button class="fchip tap" type="button" data-mode="advance" aria-pressed="${!G.repeat}">진행</button></div>`
    + line('금화', `<b class="num">${fmt(pm.gold)}/분</b>`) + line('처치', `<b class="num">${fmt(pm.kills)}/분</b>`);
}
nodes.waveBtn.addEventListener('click', () => { ensureAudio(); sampleEarn(); paintStage(); stageDlg.showModal(); });
stageDlg.addEventListener('click', e => {
  if (e.target === stageDlg || e.target.closest('[data-close]')) { stageDlg.close(); return; }
  const m = e.target.closest('[data-mode]');
  if (m) { G.repeat = m.dataset.mode === 'repeat'; paintStage(); }
});
nodes.wavePrev.addEventListener('click', () => { goWave(G.wave - 1); refreshTop(); });
nodes.waveNext.addEventListener('click', () => { goWave(G.wave + 1); refreshTop(); });

/* ================= the sheet: rates, picks, a product, results and confirmations come up over a screen ================= */
function summonNow(kind, n) {
  const got = sysCall('summon', kind, n);
  if (!got || !got.length) return;
  sound('buy');
  // a crew card: i is its grade, id the card (its portrait)
  const box = artBox(kind), art = g => kind === 'crew' ? itemArt('crew', g.id === 'me' ? 'hero' : String(g.id), true) : itemArt(kind, g.i, true);
  const cells = got.map(g => `<div class="rc"><span class="slot g${g.grade}" style="height:${box.h + 16}px">${art(g)}${g.isNew ? ic('star') : ''}</span><b>${g.name || ''}</b>`
    + (g.toNextMerge != null ? `<span class="aux">${kind === 'crew' ? '다음 별까지' : kind === 'relic' ? '다음 레벨까지' : '합성까지'} ${g.toNextMerge}</span>` : '') + '</div>');
  openSheet(n > 1 ? n + '회 소환' : '소환', () => gridOf(box.w + 16, cells, 5) + `<div class="tool">${B('pri', '확인', 'data-close')}</div>`);
}
const sheet = { el: document.getElementById('sheet'), title: document.getElementById('shTitle'), body: document.getElementById('shBody'), render: null, act: null, key: '' };
function openSheet(title, render, act) {
  sheet.render = render; sheet.act = act || null;
  sheet.title.textContent = title; sheet.body.innerHTML = sheet.key = render(); sheet.el.hidden = false;
  sheet.el.querySelector('.shp').scrollTop = 0;
}
function closeSheet() { sheet.el.hidden = true; sheet.render = null; sheet.act = null; }
sheet.el.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) { closeSheet(); return; }
  const b = e.target.closest('button');
  if (b && !b.disabled && sheet.act) sheet.act(b.dataset, b);
});
addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.el.hidden) closeSheet(); });
// summon rates: every grade at this level and the next, how many pulls to the next level, and the pity left
const pct = r => (r * 100 >= 1 ? (r * 100).toFixed(1) : r * 100 >= .01 ? (r * 100).toFixed(2) : (r * 100).toFixed(3)) + '%';
function ratesHtml(kind) {
  const I = sysCall('summonInfo', kind);
  if (!I) return '';
  const next = I.nextRates;
  return `<div class="rates"><span></span><span class="aux">Lv ${I.level}</span>${next ? `<span class="aux">Lv ${I.level + 1}</span>` : ''}`
    + GRADES.map((g, n) => `<span class="gr g${n}">${g}</span><b class="num">${pct(I.rates[n])}</b>${next ? `<span class="num muted">${pct(next[n])}</span>` : ''}`).join('') + '</div>'
    + (I.nextAt != null ? line('다음 레벨까지', `<b class="num">${Math.max(0, I.nextAt - I.pulls)}회</b>`) : '')
    + sec('천장') + (I.pity || []).map(p => line(`<span class="gr g${p.minGrade}">${GRADES[p.minGrade]}</span> 이상`, `<b class="num">${p.left}회</b>`)).join('');
}

/* ================= settings ================= */
const settings = { sound: true, volume: .7, music: .7, wind: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('bunker-idle:settings')) || {}); } catch { /* defaults */ }
const saveSettings = () => { try { localStorage.setItem('bunker-idle:settings', JSON.stringify(settings)); } catch { /* fine */ } };
const dlg = document.getElementById('settings');
const soundBtn = document.getElementById('soundToggle'), windBtn = document.getElementById('windToggle'), vol = document.getElementById('volume'), music = document.getElementById('music'), resetBtn = document.getElementById('resetBtn');
function paintSettings() { soundBtn.textContent = settings.sound ? '켜짐' : '꺼짐'; windBtn.textContent = settings.wind ? '켜짐' : '꺼짐'; vol.value = Math.round(settings.volume * 100); music.value = Math.round(settings.music * 100); }
document.getElementById('settingsBtn').addEventListener('click', () => { paintSettings(); resetBtn.textContent = '초기화'; dlg.showModal(); });
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
soundBtn.addEventListener('click', () => { settings.sound = !settings.sound; ensureAudio(); paintSettings(); saveSettings(); });
windBtn.addEventListener('click', () => { settings.wind = !settings.wind; paintSettings(); saveSettings(); });
vol.addEventListener('input', () => { settings.volume = vol.value / 100; saveSettings(); });
// background music: the level is kept for the music to come
music.addEventListener('input', () => { settings.music = music.value / 100; saveSettings(); });
document.getElementById('saverToggle').addEventListener('click', () => { dlg.close(); powerSave(true); });
document.getElementById('codexBtn').addEventListener('click', () => { dlg.close(); openMenu('codex'); });
nodes.menuFoot.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if ('codex' in b.dataset) openMenu('codex'); else if ('mergeall' in b.dataset) mergeAllNow(); else if ('enhall' in b.dataset) enhanceAllNow();
});
let skipSave = false;
resetBtn.addEventListener('click', () => {
  if (resetBtn.textContent !== '한 번 더 누르면 삭제') { resetBtn.textContent = '한 번 더 누르면 삭제'; return; }
  try { localStorage.removeItem(SAVE_KEY); } catch { /* fine */ }
  skipSave = true; location.reload();
});
document.getElementById('restart').addEventListener('click', () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* fine */ } skipSave = true; location.reload(); });

/* ================= power saving ================= */
// black, with only the wave, the gold a minute and the time since it began; the game runs on at full speed while
// the frame loop draws about five times a second (main.js). Five quick taps bring the screen back
const saver = { on: false, since: 0, taps: 0, tapAt: 0 };
function powerSave(on) {
  saver.on = on; saver.taps = 0; saver.since = performance.now();
  nodes.saver.hidden = !on;
  if (on) refreshSaver(); else { refreshTop(); renderPanel(true); }
}
function refreshSaver() {
  sampleEarn();
  setText(nodes.svWave, '스테이지 ' + G.wave);
  setText(nodes.svGold, fmt(perMinute().gold) + '/분');
  const s = Math.floor((performance.now() - saver.since) / 1000);
  setText(nodes.svTime, Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'));
}
nodes.saver.addEventListener('pointerdown', e => {
  e.preventDefault();
  const now = performance.now();
  saver.taps = now - saver.tapAt < 1000 ? saver.taps + 1 : 1;
  saver.tapAt = now;
  if (saver.taps >= 5) powerSave(false);
});
