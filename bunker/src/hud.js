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
  up: { title: '강화', tabs: [['fire', '화력'], ['cmd', '지휘관']] },
  gear: { title: '장비', tabs: [['gun', '무기'], ['turret', '터렛'], ['relic', '유물']] },
  crew: { title: '캐릭터', tabs: [['crew', '동료'], ['cmd', '지휘관']] },
  base: { title: '기지', tabs: [['def', '방어'], ['under', '지하'], ['zones', '배치']] },
  shop: { title: '상점', tabs: [['pull', '뽑기'], ['pack', '패키지'], ['gem', '다이아'], ['pass', '편의·패스']] },
  rebirth: { title: '환생' },
  rank: { title: '랭킹', tabs: [['best', '최고 기록'], ['raid', '기지 털기']] },
  codex: { title: '도감' },
};
// what is open, the page of each menu, levels bought per tap (0: MAX), the grade shown, the person picked
const ui = { open: null, sub: { up: 'fire', gear: 'gun', crew: 'crew', base: 'def', shop: 'pull', rank: 'best' }, bulk: 1, grade: -1, sel: -1, jobs: false };
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
  if (ui.open !== m) { ui.open = m; ui.jobs = false; ui.pick = false; nodes.panel.scrollTop = 0; }
  if (ui.sel >= 0 && !G.crew[ui.sel]) ui.sel = -1;
  layout();
  renderPanel(true);
}
function closeMenu() {
  if (!ui.open) return;
  ui.open = null; ui.jobs = false;
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
  ui.sub[ui.open] = b.dataset.sub; ui.jobs = false; nodes.panel.scrollTop = 0;
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
  if (kind === 'hire') return capCost({ ...HIRE[+key] });
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
// people: a face with a name; a place to hire into (its price); a place not open yet
const faceCell = (p, size, attrs = '') => `<${attrs ? 'button type="button" ' + attrs : 'div'} class="cell">${ph('100%', size + 'px', face(p, size))}<span>${p.name}</span></${attrs ? 'button' : 'div'}>`;
// a bed with nobody in it: someone to hire (a faint figure, the price under it)
const hireCell = (i, size, w = '100%') => { const c = priceOf('hire:' + i); return `<button class="cell" type="button" data-hire="${i}"${canPay(c) ? '' : ' disabled'}>${ph(w, size + 'px', '<i class="ic ic-person hire" style="--s:2"></i>')}<span>${costHtml(c)}</span></button>`; };
const shutCell = (size, label, lock, w = '100%') => `<div class="cell off">${ph(w, size + 'px', lock ? ic('lock', 2) : '')}<span>${label}</span></div>`;
// a place to work: who is on that job, then empty places (a tap brings over the first hand on another job)
function zoneHtml(title, job) {
  const who = G.crew.filter(c => c && c.job === job), can = G.crew.some(c => c && c.job !== job);
  return sec(title, who.length + '/5') + grid(5, Array.from({ length: 5 }, (_, i) => who[i] ? faceCell(who[i], 40)
    : `<button class="cell off" type="button" data-assign="${job}"${can ? '' : ' disabled'}>${ph('100%', '40px', '+')}<span>배치</span></button>`));
}
function defHtml() {
  const B = G.bunker, F = G.fence;
  return bulkHtml()
    + cardHtml({ id: 'bunker', pic: 'lg', ico: 'bunker', name: '벙커', lv: bunkerInfo(B).name + ' · Lv ' + B, prog: B / MAX_BUNKER, max: B >= MAX_BUNKER })
    + cardHtml({ id: 'fence', pic: 'lg', ico: 'fence', name: '울타리', lv: (F ? fenceInfo(F).name + ' · ' : '') + 'Lv ' + F, prog: F / MAX_FENCE, max: F >= MAX_FENCE })
    + sec('터렛 칸', '0/6') + grid(6, TURRET_AT.map(L => B >= L ? slot('') : slot('off', '잠김')))
    + sec('지하') + FLOORS_UI.map(([name, ico], k) => `<button class="go" type="button" data-floor="${k}">${ph('72px', '44px', ic(ico, 2))}<span>${name} · Lv ${floorLevel(k)}</span>›</button>`).join('');
}
function underHtml() {
  const k = G.floorView || 0, L = floorLevel(k), max = [LIVE, FARM, MINE][k].max;
  const chips = `<div class="chips c4">${FLOORS_UI.map(([n], j) => `<button class="chip" type="button" data-floor="${j}" aria-pressed="${j === k}">${n}</button>`).join('')}<button class="chip" type="button" disabled>4층 연구소</button></div>`;
  const card = cardHtml({ id: ['live', 'farm', 'mine'][k], pic: 'sm', ico: FLOORS_UI[k][1], name: ['침대', '씨앗', '곡괭이'][k], lv: '레벨 · Lv ' + L, inline: true, prog: L / max, max: L >= max });
  // the living floor: its beds, and who sleeps in them
  const beds = bedsOf(G.live);
  const workers = k ? zoneHtml('일꾼', k === 1 ? '농부' : '광부')
    : sec('일꾼', hired().length + '/5') + grid(5, G.crew.map((c, i) => c ? faceCell(c, 40) : i < beds ? hireCell(i, 40) : shutCell(40, '잠김', true)));
  return chips + bulkHtml() + card + workers;
}
const zonesHtml = () => zoneHtml('지붕 초소', '사수') + zoneHtml('2층 식량', '농부') + zoneHtml('3층 채굴', '광부') + sec('작업장', '잠김') + grid(5, Array.from({ length: 5 }, () => shutCell(40, '')));
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
// the crew grid: a portrait in a 48 frame (the new busts go in the same frame), the name; the one picked outlined
const crewCell = (i, c, picked) => `<button type="button" class="cell" data-sel="${i}" aria-pressed="${picked}">${ph('50px', '50px', face(c, 40))}<span>${c.name}</span></button>`;
function crewHtml() {
  const p = ui.sel >= 0 && G.crew[ui.sel] || G.hero, shoots = p.hero || p.job === '사수', fam = weaponFamily(G.lv.atk);
  // the weapon slot beside the one standing: only those who shoot carry one. The game has one rifle for all for now
  const slotHtml = extra => `<span class="slot ${extra}">${gunImg(fam)}<em>Lv ${G.lv.atk}</em></span>`;
  const weapon = shoots ? `<button class="wslot tap" type="button" data-pick aria-label="무기 고르기">${slotHtml('')}<span class="aux">${weaponLookName(G.lv.atk)}</span></button>` : '';
  const top = `<div class="hero">${standHtml(p)}${weapon}</div><div class="info"><b class="t16">${p.name}</b><div class="role">${p.hero ? '사수' : p.job}</div>`
    + (p.hero ? '' : `<div class="tired"><span data-tired="${p.i}"></span></div>`)
    // a stat shows once the game has a value for it (체력, 능력 come with the crew stats)
    + [['사격', shoots ? fmt(damageOf()) : null], ['체력', null], ['능력', null]].filter(([, v]) => v != null).map(([k, v]) => line(k, `<b class="num">${v}</b>`)).join('') + '</div>';
  // the weapons to pick from (a tap on the weapon slot): those owned, the one carried outlined
  if (ui.pick && shoots) return top + `<div class="wpick"><div class="sh"><b class="t16">무기</b><button class="ib tap" type="button" data-unpick aria-label="닫기">${ic('close', 1.5)}</button></div>`
    + sec('보유', '1') + grid(5, [slotHtml('ring')]) + '<div class="tool">' + B('sub', '장비로', 'data-gogear') + '</div></div>';
  const btns = `<div class="acts">${B('pri grow', '레벨업', 'disabled')}${B('sub', '배치', p.hero ? 'disabled' : 'data-jobs')}${B('sub', '대표', 'disabled')}</div>`;
  const jobs = ui.jobs && !p.hero ? `<div class="tool"><div class="chipset">${JOBS.map(j => `<button class="fchip tap" type="button" data-job="${j}" aria-pressed="${p.job === j}">${j}</button>`).join('')}</div></div>` : '';
  const beds = bedsOf(G.live);
  const cells = [crewCell(-1, G.hero, p === G.hero), ...G.crew.map((c, i) => c ? crewCell(i, c, p === c) : i < beds ? hireCell(i, 50, '50px') : shutCell(50, '???', true, '50px')), ...Array.from({ length: 6 }, () => shutCell(50, '???', false, '50px'))];
  return top + btns + jobs + sec('보유 동료', 1 + hired().length + '/24') + strip('동료 모집 Lv 1', 200, 'mid') + grid(4, cells);
}
// buttons: the primary filled (one a screen), the secondary an outline; small icons and labels go inside
const B = (cls, inner, attrs = '') => `<button class="b ${cls} tap" type="button"${attrs ? ' ' + attrs : ''}>${inner}</button>`;
const gemCost = n => `${ic('ruby')}<span class="num">${n.toLocaleString('en')}</span>`;
// the summon strip at the top of each 장비 tab (and 동료 모집): its level, the odds, one pull and ten. Pulls are not in
// the game yet: the buttons are there, switched off
const strip = (label, price, cls = '') => `<div class="strip ${cls}"><div class="lv tap" aria-label="소환 확률"><b>${label}</b><span><span class="prog2"><i style="width:0"></i></span><span class="link">확률</span></span></div>`
  + B('sub sm', '1회 ' + gemCost(price), 'disabled') + B('sub sm', '10회 ' + gemCost(price * 10), 'disabled') + '</div>';
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
const PULL_PRICE = { gun: 100, turret: 150, relic: 300 };
function gearHtml() {
  const tab = ui.sub.gear, top = strip('소환 Lv 1', PULL_PRICE[tab]);
  if (tab === 'relic') {
    const all = GRADES.flatMap((g, k) => Array.from({ length: 6 }, () => slot('g' + k + ' off'))).slice(0, 48);
    return top + sec('장착 칸', '0/' + RELIC_AT.length)
      + grid(4, RELIC_AT.map(r => G.best >= r ? slot('') : `<div class="slot lock">${ic('lock')}<span class="aux">스테이지<br>${r.toLocaleString('en')}</span></div>`))
      + sec('세트') + RELIC_SETS.map(n => line(n, '<b class="num">0/3</b>')).join('') + sec('보유', '0/48') + grid(6, all);
  }
  const per = tab === 'turret' ? 4 : 5;
  const chips = `<div class="chiprow">${[-1, 0, 1, 2, 3, 4, 5, 6, 7].map(n => `<button class="fchip tap${n < 0 ? '' : ' gq g' + n}" type="button" data-grade="${n}" aria-pressed="${ui.grade === n}">${n < 0 ? '전체' : GRADES[n]}</button>`).join('')}</div>`;
  return top + chips + GRADES.map((g, n) => ui.grade >= 0 && ui.grade !== n ? '' : sec(`<span class="gr g${n}">${g}</span>`, '0/' + per)
    + grid(5, Array.from({ length: per }, (_, k) => `<div class="slot g${n} off">${tab === 'gun' ? gunImg(k) : ''}</div>`))).join('');
}
const PULLS = [['무기', 100], ['터렛', 150], ['동료', 200], ['유물', 300]];
const PACKS = [['희귀 5번 무기 + 보석 300', '1,200원'], ['영웅 3번 무기 + 희귀 동료', '3,300원'], ['전설 1번 무기 + 유물 상자 5', '5,900원'], ['전설 5번 무기 + 영웅 터렛', '12,000원'], ['불멸 1번 무기 + 전설 동료', '33,000원'], ['신화 1번 무기 + 유물 상자 30', '69,000원']];
const GEMS = ['1,200', '5,900', '12,000', '33,000', '69,000', '119,000'];
// purchases and pulls come later: their buttons are there, switched off
function shopHtml() {
  const p = ui.sub.shop;
  if (p === 'pack') return sec('성장 패키지', '1/6') + PACKS.map(([what, price], n) => `<div class="ucard${n ? ' off' : ''}">${ph('90px', '60px')}<div class="body">`
    + (n ? `<div>${n + 1}단계 · ${what}</div>` : `<div class="name">1단계</div><div>${what}</div>`) + `<button class="btn${n ? '' : ' dark'}" type="button" disabled style="width:100%;margin-top:4px">${n ? '잠김' : price}</button></div></div>`).join('');
  if (p === 'gem') return sec('다이아') + grid(3, GEMS.map(pr => `<div class="cell">${ph('100%', '40px')}<b style="font-size:13px">${pr}원</b><span>첫 구매 2배</span></div>`));
  if (p === 'pass') return sec('편의') + ['광고 제거', '자동 합성', '오프라인 +12시간', '장비 프리셋', '연구 칸 +1', '배속 상시'].map(n => line(n, off('구매'))).join('')
    + sec('패스') + line('월정액', off('5,500원')) + line('시즌 패스', off('9,900원'));
  return PULLS.map(([n, price]) => `<div class="ucard" style="display:grid;gap:4px">${ph('100%', '70px')}<div class="sec" style="margin:0"><span>${n} · 소환 Lv 1</span><span class="muted">확률</span></div>`
    + `<div class="prog" style="width:100%"><i style="width:0"></i></div><div class="row"><button class="btn" type="button" disabled>1회 ${ic('mineral')}${price}</button><button class="btn dark" type="button" disabled>10회 ${ic('mineral')}${price * 10}</button></div></div>`).join('');
}
const rebirthHtml = () => `<div class="ucard" style="display:grid;justify-items:center;gap:4px">${ph('80px', '80px')}<b style="font-size:16px">받을 훈장 +0</b><span class="muted">보유 0</span><button class="btn dark" type="button" disabled style="width:100%">환생</button></div>`
  + sec('훈장 강화') + grid(4, ['화력', '군자금', '오프라인', '보스', '치명', '발견', '유지비', '설계도'].map(n => `<div class="cell">${ph('100%', '36px')}<span>${n}</span><span class="muted">Lv 0</span></div>`))
  + sec('자동화', '환생 0회') + grid(6, [1, 3, 5, 8, 12, 20].map(n => `<div class="cell off">${ph('30px', '30px')}<span>${n}회</span></div>`));
// rankings come with the server: the places are there, still empty
const rankRow = (place, who, pic, wave) => `<div class="rowline"><span><b style="width:30px">${place}</b>${pic}<span>${who}</span></span><b>${wave}</b></div>`;
const rankHtml = () => ui.sub.rank === 'raid' ? line('습격권', '0/5') + line('리그', '—') : Array.from({ length: 7 }, (_, k) => rankRow(k + 1, '—', ph('32px', '32px'), '—')).join('');
const codexHtml = () => sec('보유', '0/40') + GRADES.map((g, n) => sec(`<span class="gr g${n}">${g}</span>`, '0/5') + grid(5, WEAPON_LADDER[n].map(w => `<div class="cell">${slot('g' + n, '<i class="sil"></i>')}<span>${w}</span></div>`))).join('');
function pageHtml() {
  const m = ui.open, p = ui.sub[m];
  if (m === 'up') return p === 'cmd' ? cmdHtml() : fireHtml();
  if (m === 'crew') return p === 'cmd' ? cmdHtml() : crewHtml();
  if (m === 'gear') return gearHtml();
  if (m === 'base') return p === 'under' ? underHtml() : p === 'zones' ? zonesHtml() : defHtml();
  if (m === 'shop') return shopHtml();
  if (m === 'rebirth') return rebirthHtml();
  if (m === 'rank') return rankHtml();
  if (m === 'codex') return codexHtml();
  return '';
}
function footHtml() {
  if (ui.open === 'gear' && ui.sub.gear !== 'relic') return B('sub', '도감', 'data-codex') + B('sub', '일괄 강화', 'disabled') + B('pri grow', '일괄 합성', 'disabled');
  if (ui.open === 'rank' && ui.sub.rank === 'best') return `<div class="rowline" style="flex:1;border:0;padding:0"><span><b style="width:30px">—</b>${face(G.hero, 32)}<span>나</span></span><b>웨이브 ${G.best}</b></div>`;
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
function setJob(i, job) {
  const p = G.crew[i];
  if (!p || p.job === job) return;
  p.job = job;
  if (p.state !== 'sleep' && p.state !== 'toBed') sendTo(p, workSpot(p), 'toWork');
  resyncPosts(); sound('buy'); renderPanel(true);
}
nodes.panel.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.buy) act(d.buy);
  else if (d.hire) act('hire:' + d.hire);
  else if ('bulk' in d) { ui.bulk = +d.bulk; renderPanel(true); }
  else if (d.floor) { ensureAudio(); viewFloor(+d.floor); }
  else if (d.grade) { ui.grade = +d.grade; renderPanel(true); }
  else if (d.sel) { ui.sel = +d.sel; ui.jobs = false; ui.pick = false; renderPanel(true); }
  else if ('jobs' in d) { ui.jobs = !ui.jobs; renderPanel(true); }
  else if ('pick' in d) { ui.pick = true; renderPanel(true); }
  else if ('unpick' in d) { ui.pick = false; renderPanel(true); }
  else if ('gogear' in d) { ui.pick = false; ui.sub.gear = 'gun'; openMenu('gear'); }
  else if (d.job) setJob(ui.sel, d.job);
  else if (d.assign) { const i = G.crew.findIndex(c => c && c.job !== d.assign); if (i >= 0) setJob(i, d.assign); }
});
// whether any of the levels from + 1 to to begins something new
const crossed = (isNew, from, to) => { for (let L = from + 1; L <= to; L++) if (isNew(L)) return true; return false; };
// a tap on a buy button: the levels of the plan are paid at once and applied; the picture is rebuilt, flashed and
// announced once
function act(id, want = ui.bulk) {
  ensureAudio();
  const [kind, key] = id.split(':');
  const plan = planOf(id, kind === 'hire' ? 1 : want);
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
  } else if (kind === 'hire') {
    const i = +key;
    if (G.crew[i] || i >= bedsOf(G.live)) return;
    pay(plan.cost); G.crew[i] = makePerson(i);
    G.crew[i].state = 'toWork'; G.crew[i].path = route(G.crew[i], workSpot(G.crew[i]));
    resyncPosts(); // gunner posts follow slot order, so a new hire can move the others
    markUnder(0); // a bed gets its blanket
  } else return;
  sound('buy');
  renderPanel(true);
  refreshTop();
}

/* ================= over the picture ================= */
const resNodes = ['money', 'food', 'mineral'].map(r => [r, document.getElementById('r-' + r), document.getElementById('rr-' + r)]);
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
  setText(nodes.waveBtn, '스테이지 ' + G.wave);
  setWidth(nodes.waveBar, G.waveKills / killsNeeded(G.wave));
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
const stageDlg = document.getElementById('stageDlg');
const sd = { title: document.getElementById('sdTitle'), gold: document.getElementById('sdGold'), kills: document.getElementById('sdKills'), rep: document.getElementById('modeRepeat'), adv: document.getElementById('modeAdvance') };
function paintStage(pm = perMinute()) {
  setText(sd.title, '스테이지 ' + G.wave);
  sd.rep.setAttribute('aria-pressed', String(G.repeat)); sd.adv.setAttribute('aria-pressed', String(!G.repeat));
  setText(sd.gold, fmt(pm.gold) + '/분'); setText(sd.kills, fmt(pm.kills) + '/분');
}
nodes.waveBtn.addEventListener('click', () => { ensureAudio(); sampleEarn(); paintStage(); stageDlg.showModal(); });
stageDlg.addEventListener('click', e => { if (e.target === stageDlg) stageDlg.close(); });
sd.rep.addEventListener('click', () => { G.repeat = true; paintStage(); });
sd.adv.addEventListener('click', () => { G.repeat = false; paintStage(); });
nodes.wavePrev.addEventListener('click', () => { goWave(G.wave - 1); refreshTop(); });
nodes.waveNext.addEventListener('click', () => { goWave(G.wave + 1); refreshTop(); });

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
nodes.menuFoot.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled && 'codex' in b.dataset) openMenu('codex'); });
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
