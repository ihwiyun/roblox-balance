'use strict';
// The page around the picture: resources, the bottom panel and its cards, tabs, labels, settings.
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
  if (!window.ART_HUMANS) return portraitOld(person, 4);
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
function portraitOld(person, scale = 5) {
  const gear = gearOf(person), pal = palFor(person, gear), rows = ART.heads[gear.head || person.look.head].F;
  const w = Math.max(...rows.map(r => r.length)) + 2, h = rows.length + 3, c = document.createElement('canvas');
  c.width = w; c.height = h; c.className = 'ico'; c.style.width = w * scale + 'px'; c.style.height = h * scale + 'px';
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = new Uint32Array(img.data.buffer);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') d[(y + 1) * w + x + 1] = pal[ch.charCodeAt(0)]; }));
  const shirt = pal['C'.charCodeAt(0)];
  for (let x = 0; x < w; x++) { d[(h - 2) * w + x] = shirt; d[(h - 1) * w + x] = shirt; }
  g.putImageData(img, 0, 0);
  return c;
}
document.querySelectorAll('[data-ico]').forEach(el => el.prepend(iconCanvas(el.dataset.ico, el.classList.contains('tab') ? 1.5 : 1.25)));
const nodes = {};
for (const id of ['floors', 'status', 'panel', 'bunkerFill', 'bunkerText', 'bunkerTrack', 'fenceFill', 'fenceText', 'waveLine', 'stage', 'speed', 'viewBtn', 'labels', 'notes', 'ammo', 'ammoNum', 'ammoBar']) nodes[id] = document.getElementById(id);
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
function setView(v) {
  G.view = v;
  if (v === 'under') refreshUnder(); else showYard();
  nodes.viewBtn.textContent = v === 'under' ? '지상' : '지하';
  nodes.viewBtn.setAttribute('aria-pressed', String(v === 'under'));
  nodes.floors.hidden = v !== 'under';
  document.documentElement.classList.toggle('under', v === 'under');
  markFloorButtons();
  fitStage();
}
// below ground one floor is shown at a time: the buttons over the picture pick it
function viewFloor(k) {
  G.floorView = k;
  if (G.view !== 'under') setView('under'); else showFloor(k);
  markFloorButtons();
}
function markFloorButtons() {
  const lv = [G.live, G.farm, G.mine];
  [...nodes.floors.children].forEach((b, k) => {
    b.setAttribute('aria-pressed', String(k === (G.floorView || 0)));
    b.title = ['지하 1층 생활', '지하 2층 식량', '지하 3층 채굴'][k] + ' Lv ' + lv[k];
  });
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t === b)));
  setView(tab === 'under' ? 'under' : 'yard');
  renderPanel(true);
}));
nodes.viewBtn.addEventListener('click', () => setView(G.view === 'under' ? 'yard' : 'under'));
const costHtml = c => Object.entries(c).map(([k, v]) => `<span class="${G[k] < v ? 'short' : ''}">${k === 'money' ? '$' + fmt(v) : RES_NAME[k] + ' ' + fmt(v)}</span>`).join('');
const shotsToKill = dmg => Math.ceil(zombieHp(G.wave) / dmg - 1e-9);
function cards() {
  if (tab === 'gun') {
    return Object.entries(GUN).map(([k, g]) => {
      const L = G.lv[k], max = L >= g.max, now = g.val(L), next = g.val(L + 1);
      let desc;
      if (k === 'atk') {
        desc = `한 발 ${fmt(now)} → ${fmt(next)} · 지금 좀비 ${shotsToKill(now)}발 → ${shotsToKill(next)}발`;
        const nxt = Math.ceil((L + 1) / 4) * 4;
        desc += `<br>Lv ${nxt}: ${weaponLookName(nxt)} 외형`;
      } else if (k === 'spd') desc = `초당 ${now.toFixed(2)}발 → ${next.toFixed(2)}발 · 총구 화염 ${1 + Math.min(2, Math.floor(L / 10))}단계`;
      else desc = `${now}발 → ${next}발 · 장전 ${reloadTime().toFixed(1)}초${L + 1 === 20 ? '<br>다음: 드럼 탄창' : ''}`;
      return { id: 'gun:' + k, ico: { atk: 'bullet', spd: 'rate', mag: 'mag' }[k], name: k === 'atk' ? '공격력 · ' + weaponLookName(L) : g.name, lv: 'Lv ' + L, desc: max ? '최대 레벨' : desc, cost: max ? null : gunCost(k, L), max };
    });
  }
  if (tab === 'def') {
    const B = G.bunker, F = G.fence, bmax = B >= MAX_BUNKER, fmax = F >= MAX_FENCE;
    return [
      { id: 'bunker', ico: 'bunker', name: '벙커 · ' + bunkerInfo(B).name, lv: 'Lv ' + B, desc: bmax ? '최대 레벨' : `체력 ${fmt(bunkerHp(B))} → ${fmt(bunkerHp(B + 1))}<br>다음: ${bunkerAddName(B + 1)}`, cost: bmax ? null : bunkerCost(B), max: bmax },
      { id: 'fence', ico: 'fence', name: '울타리' + (F ? ' · ' + fenceInfo(F).name : ''), lv: 'Lv ' + F, desc: fmax ? '최대 레벨' : `체력 ${fmt(fenceHp(F))} → ${fmt(fenceHp(F + 1))}<br>다음: ${fenceAddName(F + 1)}${fenceInfo(F + 1).electric && !(F && fenceInfo(F).electric) ? ' (공격한 좀비 감전)' : ''}`, cost: fmax ? null : fenceCost(F), max: fmax },
    ];
  }
  if (tab === 'under') {
    const Lv = G.live, Fm = G.farm, Mn = G.mine;
    return [
      { id: 'live', ico: 'bed', name: '지하 1층 · 생활층', lv: 'Lv ' + Lv, desc: Lv >= LIVE.max ? '최대 레벨' : `침대 ${bedsOf(Lv)}/5 · 휴식 속도 +${Lv * 5}%<br>다음: ${LIVE_ITEMS[Lv]}${LIVE.beds.includes(Lv + 1) ? ' (고용 자리 +1)' : ''}`, cost: Lv >= LIVE.max ? null : LIVE.cost(Lv), max: Lv >= LIVE.max },
      { id: 'farm', ico: 'farm', name: '지하 2층 · 식량층' + (Fm ? ' · ' + FARM_TIERS[facTier(Fm)] : ''), lv: Fm ? 'Lv ' + Fm : '미개척', desc: Fm >= FARM.max ? '최대 레벨' : `식량 초당 ${fmt(FARM.rate(Fm))} → ${fmt(FARM.rate(Fm + 1))} (농부 1명당 +100%)<br>다음: ${FARM_ITEMS[Fm]}`, cost: Fm >= FARM.max ? null : FARM.cost(Fm), max: Fm >= FARM.max },
      { id: 'mine', ico: 'pick', name: '지하 3층 · 채굴층' + (Mn ? ' · ' + MINE_TIERS[facTier(Mn)] : ''), lv: Mn ? 'Lv ' + Mn : '미개척', desc: Mn >= MINE.max ? '최대 레벨' : `광물 초당 ${fmt(MINE.rate(Mn))} → ${fmt(MINE.rate(Mn + 1))} (광부 1명당 +100%)<br>다음: ${MINE_ITEMS[Mn]}`, cost: Mn >= MINE.max ? null : MINE.cost(Mn), max: Mn >= MINE.max },
    ];
  }
  const beds = bedsOf(G.live);
  return G.crew.map((c, i) => {
    if (i >= beds) return { id: 'slot:' + i, ico: 'lock', name: '자리 ' + (i + 1), lv: '침대 없음', desc: `생활층 Lv ${LIVE.beds[i]}에서 침대가 생긴다 · 고용 $${fmt(HIRE[i].money)}`, locked: true };
    if (!c) return { id: 'hire:' + i, ico: 'person', name: NAMES[i], lv: '빈 침대', desc: `생존자 고용 · 식량을 초당 ${UPKEEP}씩 먹는다`, cost: HIRE[i] };
    const where = c.state === 'sleep' ? '침대에서 자는 중' : c.state === 'toBed' ? '자러 가는 중' : c.state === 'toWork' ? '일하러 가는 중' : c.job === '사수' ? '지붕에서 사격 중' : c.job === '농부' ? '농장에서 일하는 중' : '광산에서 일하는 중';
    return { id: 'job:' + i, person: c, name: c.name, lv: c.job, desc: `${where}${G.hungry ? ' · 배고픔' : ''}`, fatigue: c.fatigue, jobs: true, slot: i };
  });
}
let panelKey = '', pressing = false;
// a card rebuilt under a finger loses the tap, so nothing is rebuilt while the panel is being pressed
nodes.panel.addEventListener('pointerdown', () => { pressing = true; });
addEventListener('pointerup', () => { pressing = false; }); addEventListener('pointercancel', () => { pressing = false; });
function renderPanel(force) {
  const list = cards();
  // fatigue is not part of the key: its bars are updated in place below, so cards are not rebuilt for it
  const key = tab + JSON.stringify(list.map(c => [c.id, c.name, c.lv, c.desc, c.cost && Object.entries(c.cost).map(([k, v]) => [v, G[k] >= v])]));
  if (!force && (key === panelKey || pressing)) {
    list.forEach((c, n) => { if (c.fatigue != null) { const bar = nodes.panel.children[n] && nodes.panel.children[n].querySelector('.tired span'); if (bar) bar.style.width = clamp(c.fatigue, 0, 100) + '%'; } });
    return;
  }
  panelKey = key;
  nodes.panel.innerHTML = '';
  for (const c of list) {
    const el = document.createElement('div');
    el.className = 'card';
    const ic = document.createElement('div');
    ic.className = 'icon'; ic.append(c.person ? portrait(c.person) : iconCanvas(c.ico, 2));
    el.append(ic);
    el.insertAdjacentHTML('beforeend', `<div class="body"><div class="head"><span class="name">${c.name}</span><span class="lv">${c.lv}</span></div><div class="desc">${c.desc}</div>${c.fatigue != null ? `<div class="tired"><span style="width:${clamp(c.fatigue, 0, 100)}%"></span></div>` : ''}</div>`);
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
  if (kind === 'gun') {
    const c = gunCost(key, G.lv[key]);
    if (G.lv[key] >= GUN[key].max || !canPay(c)) return;
    pay(c); G.lv[key]++;
    if (key === 'mag') for (const s of shooters()) if (!s.reload) s.ammo = gunStat('mag');
    if (key === 'atk' && G.lv.atk % 4 === 0) say('무기 외형이 바뀌었다: ' + weaponLookName(G.lv.atk));
  } else if (kind === 'bunker') {
    const c = bunkerCost(G.bunker);
    if (G.bunker >= MAX_BUNKER || !canPay(c)) return;
    pay(c); G.bunker++; G.hp = bunkerHp(G.bunker);
    if (isNewBunkerForm(G.bunker)) notify('새 건물 · ' + bunkerInfo().name, '벙커 Lv ' + G.bunker + ' · 체력 ' + fmt(bunkerHp(G.bunker)), 'good');
    else say('벙커 Lv ' + G.bunker + ' · ' + bunkerAddName(G.bunker));
    { const before = yardPix.slice(); bakeYard(); flashDiff(before, yardPix, 'yard'); }
    resyncPosts(); palCache.clear(); if (G.view !== 'yard') setView('yard');
  } else if (kind === 'fence') {
    const c = fenceCost(G.fence);
    if (G.fence >= MAX_FENCE || !canPay(c)) return;
    pay(c); G.fence++; G.fenceHp = fenceHp(G.fence); G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0];
    if (isNewFenceForm(G.fence)) notify('새 울타리 · ' + fenceInfo().name, '울타리 Lv ' + G.fence + ' · 체력 ' + fmt(fenceHp(G.fence)) + (fenceInfo().electric ? ' · 공격한 좀비 감전' : ''), 'good');
    else say('울타리 Lv ' + G.fence + ' · ' + fenceAddName(G.fence));
    { const before = yardPix.slice(); composeYard(); flashDiff(before, yardPix, 'yard'); } // only the fence overlays change
    if (G.view !== 'yard') setView('yard');
  } else if (kind === 'live') {
    const c = LIVE.cost(G.live);
    if (G.live >= LIVE.max || !canPay(c)) return;
    pay(c); G.live++;
    say('생활층: ' + LIVE_ITEMS[G.live - 1] + (LIVE.beds.includes(G.live) ? ' · 고용할 수 있는 자리가 생겼다' : ''));
    markUnder(0, true); viewFloor(0);
  } else if (kind === 'farm' || kind === 'mine') {
    const B = kind === 'farm' ? FARM : MINE, L = G[kind], c = B.cost(L);
    if (L >= B.max || !canPay(c)) return;
    pay(c); G[kind]++;
    const tiers = kind === 'farm' ? FARM_TIERS : MINE_TIERS, floorName = kind === 'farm' ? '식량층' : '채굴층';
    if (G[kind] === 1 || facTier(G[kind]) !== facTier(G[kind] - 1)) notify(floorName + ' · ' + tiers[facTier(G[kind])], (kind === 'farm' ? '식량' : '광물') + ' 초당 ' + (kind === 'farm' ? FARM : MINE).rate(G[kind]).toFixed(1), 'good');
    else say(floorName + ' Lv ' + G[kind] + ' · ' + (kind === 'farm' ? FARM_ITEMS : MINE_ITEMS)[G[kind] - 1]);
    markUnder(kind === 'farm' ? 1 : 2, true); viewFloor(kind === 'farm' ? 1 : 2);
  } else if (kind === 'hire') {
    const i = +key, c = HIRE[i];
    if (G.crew[i] || i >= bedsOf(G.live) || !canPay(c)) return;
    pay(c); G.crew[i] = makePerson(i);
    G.crew[i].state = 'toWork'; G.crew[i].path = route(G.crew[i], workSpot(G.crew[i]));
    resyncPosts(); // gunner posts follow slot order, so a new hire can move the others
    say(NAMES[i] + ' 합류 · 직업을 고를 수 있다');
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
    el.textContent = Math.abs(net) > .005 ? (net > 0 ? '+' : '−') + Math.abs(net).toFixed(1) + '/초' : '';
    el.classList.toggle('neg', net < 0);
  }
  const hero = G.hero;
  const next = nextMutant();
  nodes.waveLine.innerHTML = `<b>웨이브 ${G.wave}</b> · ${G.waveKills}/${killsNeeded(G.wave)}` + (isBossWave(G.wave) ? ' · <b>보스</b>' : next ? ` · 변이체 W${next.from}` : '');
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
// floor names over the cutaway are real page text, laid over the canvas
function placeLabels() {
  // one floor at a time below ground: the floor buttons name it, so no labels are laid over the picture
  nodes.labels.hidden = true;
  return;
  const r = canvas.getBoundingClientRect(), f = r.width / W;
  if (nodes.labels.children.length !== 4) nodes.labels.innerHTML = FLOOR_NAME.map(t => { const [a, b] = t.split(' · '); return `<span class="fl"><b>${a}</b>${b}</span>`; }).join('') + '<span>지상 해치</span>';
  // each name stands in the white margin left of its floor, level with it, so it never covers the floor
  FLOOR_NAME.forEach((t, k) => {
    const p = project(UG.x0, UG.y1, FLOOR_Z[k] + UG.h * .5), el = nodes.labels.children[k];
    el.style.left = Math.max(2, r.left + p.sx * f - 6 - el.offsetWidth) + 'px'; el.style.top = r.top + p.sy * f + 'px';
  });
  const p = project(SHAFT.x, SHAFT.y, HATCH_TOP() + .5), el = nodes.labels.children[3];
  el.style.left = r.left + p.sx * f + 'px'; el.style.top = r.top + p.sy * f + 'px';
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

document.querySelectorAll('#floors button').forEach(b => b.addEventListener('click', () => { ensureAudio(); viewFloor(+b.dataset.floor); sound('buy'); }));
