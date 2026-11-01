'use strict';
/* =====================================================================
   벙커 – 좀비 방치형
   The yard is a diamond of land floating on white (pixel-plays style); the bunker grows through six
   different buildings; three floors below it hold the beds, the farm and the mine. Characters are
   pre-baked pixel sprites (see art.js), drawn by frame, never built from shapes at run time.
   ===================================================================== */

/* ================= tuning ================= */
const FIELD = PP_SCENE.field, FENCE_R = 3.9, MAX_ZOMBIES = 40, OFFLINE_CAP = 2 * 3600, SAVE_KEY = 'bunker-idle:v3';
// the bunker and the fence each have 40 levels: the building changes form six times, and every level
// in between adds something you can see
const MAX_BUNKER = 40, MAX_FENCE = 40;
const FORM_AT = [1, 6, 12, 18, 25, 32];
const formOf = L => { let f = 0; for (let k = 0; k < FORM_AT.length; k++) if (L >= FORM_AT[k]) f = k; return f; };
const BUNKER_FORMS = [
  { name: '간이 참호', half: 1.2, roof: .32 },
  { name: '나무 망루', half: 1.25, roof: 1.8 },
  { name: '컨테이너 초소', half: 1.4, roof: 2.0 },
  { name: '콘크리트 벙커', half: 1.6, roof: 2.2 },
  { name: '강화 벙커', half: 1.7, roof: 2.4 },
  { name: '요새', half: 1.9, roof: 2.6 },
];
const bunkerHp = L => Math.round(150 * 1.16 ** (L - 1));
// the price of the next level, L -> L + 1
const bunkerCost = L => { const c = { money: Math.ceil(40 * 1.24 ** L) }; if (L >= 4) c.food = Math.ceil(8 * 1.2 ** (L - 4)); if (L >= 8) c.mineral = Math.ceil(5 * 1.24 ** (L - 8)); return c; };
const FENCE_FORMS = ['나무 말뚝', '판자 울타리', '철조망', '강철 바리케이드', '콘크리트 방벽', '전기 철책'];
const fenceHp = L => L ? Math.round(120 * 1.17 ** (L - 1)) : 0;
const fenceCost = L => { const c = { money: Math.ceil(30 * 1.24 ** L) }; if (L >= 10) c.mineral = Math.ceil(4 * 1.24 ** (L - 10)); return c; };
// the living floor: beds come at some levels (each bed is a place to hire someone), furniture at the rest
const LIVE = { max: 15, beds: [1, 3, 5, 8, 12], cost: L => { const c = { money: Math.ceil(50 * 1.42 ** L) }; if (L >= 3) c.mineral = Math.ceil(6 * 1.4 ** (L - 3)); return c; } };
const LIVE_ITEMS = ['침대', '러그', '침대', '천장 전등', '침대', '식탁과 의자', '무전기', '침대', '난로', '냉장고', '책장', '침대', '화분', '텔레비전', '소파'];
const bedsOf = L => LIVE.beds.filter(b => L >= b).length;
const HIRE = [{ money: 50, food: 20 }, { money: 300, food: 60 }, { money: 1500, food: 150 }, { money: 7000, food: 400 }, { money: 25000, food: 1000 }];
const FARM = { max: 25, rate: L => L ? .35 * L * 1.05 ** L : 0, cost: L => ({ money: Math.ceil(20 * 1.45 ** L) }) };
const MINE = { max: 25, rate: L => L ? .25 * L * 1.07 ** L : 0, cost: L => ({ money: Math.ceil(50 * 1.5 ** L) }) };
const FARM_TIERS = ['흙 화단', '재배 선반', '수경 탱크', '자동 재배실'], MINE_TIERS = ['손 도르래', '시추탑', '굴착기', '대형 채굴 플랜트'];
const facTier = L => L < 4 ? 0 : L < 8 ? 1 : L < 15 ? 2 : 3;
const GUN = {
  atk: { name: '공격력', max: 100, cost: L => Math.ceil(10 * 1.2 ** L), val: L => 10 * 1.12 ** L * (1 + .04 * L) },
  spd: { name: '연사', max: 30, cost: L => Math.ceil(15 * 1.32 ** L), val: L => 1 + .06 * L },
  mag: { name: '탄창', max: 30, cost: L => Math.ceil(12 * 1.28 ** L), val: L => 5 + L },
};
// the rifle changes every 4 attack levels: six families, then attachments, then paint
const WEAPONS = ['볼트액션 소총', '반자동 소총', '돌격소총', '경기관총', '대물 저격총', '레일건'];
const weaponFamily = L => Math.min(5, Math.floor(L / 8));
const weaponLookName = L => {
  const fam = WEAPONS[weaponFamily(L)], step = Math.floor(L / 4) % 2, paint = L >= 80 ? '발광 ' : L >= 60 ? '금장 ' : L >= 48 ? '위장 ' : '';
  return paint + fam + (step ? '+' : '');
};
function gunCost(k, L) {
  // better guns need minerals from the mine
  const c = { money: GUN[k].cost(L) };
  if (k === 'atk' && L >= 8) c.mineral = Math.ceil(3 * 1.2 ** (L - 8));
  if (k !== 'atk' && L >= 3) c.mineral = Math.ceil(2 * 1.27 ** (L - 3));
  return c;
}
const reloadTime = () => 1.6 * .97 ** G.lv.mag;
const JOBS = ['사수', '농부', '광부'];
const UPKEEP = .4, REPAIR_FOOD = .1, REPAIR_MONEY = .02;
const FATIGUE_WORK = 100 / 110, FATIGUE_REST = 100 / 28; // about two minutes on, half a minute in bed
// zombies grow about 11% a wave; rewards about 8.5%; more kinds join as the waves go on
const zombieHp = w => 20 * 1.11 ** (w - 1) * (1 + .03 * (w - 1));
const zombieHit = w => 4 * 1.08 ** (w - 1);
const zombieReward = w => 4 * 1.09 ** (w - 1);
const killsNeeded = w => Math.min(60, 8 + 2 * w);
const spawnEvery = w => Math.max(.55, 2.6 * .96 ** (w - 1));
const ZTYPES = {
  walker:  { name: '좀비', from: 1, hp: 1, hit: 1, speed: .55, reward: 1, every: 1.2, step: .22 },
  crawler: { name: '기는 놈', from: 3, hp: .8, hit: .8, speed: .42, reward: 1.2, every: 1, step: .15 },
  runner:  { name: '러너', from: 5, hp: .6, hit: .7, speed: 1.15, reward: 1.3, every: .65, step: .3 },
  brute:   { name: '덩치', from: 8, hp: 6, hit: 4, speed: .32, reward: 5, every: 1.8, step: .2 },
  bloater: { name: '부푼 놈', from: 11, hp: 2.2, hit: 0, speed: .34, reward: 2, every: 1, step: .18 },
  armored: { name: '방호복', from: 15, hp: 3.2, hit: 1.3, speed: .45, reward: 2.6, every: 1.2, step: .22 },
};
const NAMES = ['민준', '서연', '도윤', '하은', '지호'];
// each survivor looks different: hair, skin, shirt
const LOOKS = [
  { head: 'short', hair: [92, 64, 44], skin: [222, 172, 134], shirt: [96, 116, 76] },
  { head: 'long', hair: [40, 32, 30], skin: [236, 196, 160], shirt: [176, 84, 76] },
  { head: 'beard', hair: [120, 84, 52], skin: [198, 146, 108], shirt: [84, 112, 156] },
  { head: 'buzz', hair: [170, 160, 150], skin: [150, 104, 76], shirt: [196, 166, 104] },
  { head: 'short', hair: [196, 140, 70], skin: [230, 184, 150], shirt: [120, 96, 150] },
  { head: 'long', hair: [150, 60, 40], skin: [214, 160, 124], shirt: [90, 140, 120] },
];

/* ================= state ================= */
const G = {
  money: 0, food: 0, mineral: 0,
  lv: { atk: 0, spd: 0, mag: 0 }, bunker: 1, fence: 0, live: 0, farm: 0, mine: 0,
  crew: [null, null, null, null, null],
  wave: 1, waveKills: 0, totalKills: 0,
  hp: 150, fenceHp: 0, fenceDown: false, sideDmg: [0, 0, 0, 0], sideStage: [0, 0, 0, 0],
  zombies: [], tracers: [], parts: [], uparts: [], decals: [], floats: [],
  hero: null, time: 0, spawnIn: 2, speed: 1, hurt: 0, hungry: false, saveIn: 5, statusT: 0, view: 'yard',
};
const form = () => BUNKER_FORMS[formOf(G.bunker)];
const gunStat = k => GUN[k].val(G.lv[k]);
const hired = () => G.crew.filter(Boolean);
const canPay = c => Object.entries(c).every(([k, v]) => G[k] >= v);
function pay(c) { for (const [k, v] of Object.entries(c)) G[k] -= v; }
function fmt(n) {
  n = Math.max(0, n);
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n) + '';
  const units = ['K', 'M', 'B', 'T', 'aa', 'ab', 'ac'];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[i];
}
const RES_NAME = { money: '$', food: '식량', mineral: '광물' };
const px = n => Math.max(1, Math.round(n * S / 12));

/* ================= sprites ================= */
// frames come baked from art.js as rows of palette letters; decode once into flat cell lists
const SPR = {};
const colorCache = new Map();
const rgbOf = c => { const k = c.join(','); let v = colorCache.get(k); if (v === undefined) { v = rgb(...c); colorCache.set(k, v); } return v; };
function decodeSprites() {
  for (const [type, s] of Object.entries(ART.sprites)) {
    const set = { w: s.w, h: s.h, ax: s.ax, ay: s.ay, anims: {} };
    for (const [anim, views] of Object.entries(s.anims)) {
      set.anims[anim] = {};
      for (const [view, frames] of Object.entries(views)) {
        set.anims[anim][view] = frames.map(f => {
          const cells = [];
          f.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') cells.push(x, y, ch.charCodeAt(0)); }));
          return { cells, head: f.head, gun: f.gun, mag: f.mag, pick: f.pick };
        });
      }
    }
    SPR[type] = set;
  }
}
function paletteOf(colors) {
  const p = new Uint32Array(128);
  for (const [k, c] of Object.entries(colors)) p[k.charCodeAt(0)] = rgbOf(c);
  return p;
}
const WHITE = rgb(255, 255, 248);
// one person's colours over the shared survivor palette
function personPalette(look, gear) {
  const base = { ...ART.humanPal };
  const sh = look.shirt;
  base.C = sh; base.c = sh.map(v => v * .8); base.x = sh.map(v => v * .64);
  base.S = look.skin; base.s = look.skin.map(v => v * .86); base.d = look.skin.map(v => v * .72);
  base.H = look.hair; base.h = look.hair.map(v => Math.min(255, v * 1.15)); base.K = [30, 24, 26];
  base.A = [196, 70, 52]; base.Y = [236, 190, 50]; base.y = [190, 146, 40];
  base.G = gear.helmet || [96, 110, 70]; base.g = (gear.helmet || [96, 110, 70]).map(v => v * .75);
  if (gear.vest) { base.V = gear.vest; base.v = gear.vest.map(v => v * .78); }
  return paletteOf(base);
}
// draw one frame; (x, y, z) is the spot under the feet. Writes depth so it sorts against the bunker and fences
const spriteShadow = [];
function drawSprite(type, anim, view, idx, mirror, x, y, z, pal, opt = {}) {
  const set = SPR[type], frames = set.anims[anim][view], fr = frames[((idx % frames.length) + frames.length) % frames.length];
  const p = project(x, y, z), bx = Math.round(p.sx), by = Math.round(p.sy), ax = set.ax, ay = set.ay;
  const fade = opt.fade == null ? 1 : opt.fade, hit = opt.hit, cells = fr.cells, perPx = SIN / (S * COS);
  const shadow = opt.shadow !== false;
  for (let n = 0; n < cells.length; n += 3) {
    const cx = cells[n], cy = cells[n + 1], key = cells[n + 2];
    const sx = bx + (mirror ? ax - cx : cx - ax), sy = by + cy - ay;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    if (fade < 1 && bayerAt(sx, sy) >= fade) continue;
    const hpx = ay - cy, i = sy * W + sx, d = p.d + hpx * perPx + .02;
    if (d <= zb[i]) continue;
    zb[i] = d;
    pix[i] = hit && key !== 111 ? WHITE : pal[key];
    if (shadow && fade >= 1) spriteShadow.push(sx, hpx, by, z);
  }
  return { fr, bx, by, mirror, ax, ay, p };
}
// spot of a frame's anchor point (e.g. the head or the gun) on screen
function frameSpot(info, pt) { return [info.bx + (info.mirror ? info.ax - pt[0] : pt[0] - info.ax), info.by + pt[1] - info.ay]; }
function stampAt(rows, cx, top, pal, mirror, d, fade = 1) {
  const w = rows[0].length, x0 = Math.round(cx - w / 2);
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[mirror ? row.length - 1 - x : x];
      if (ch === '.') continue;
      const sx = x0 + x, sy = top + y;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      if (fade < 1 && bayerAt(sx, sy) >= fade) continue;
      const i = sy * W + sx;
      if (d <= zb[i]) continue;
      zb[i] = d; pix[i] = pal[ch.charCodeAt(0)];
    }
  }
}
// head with a one-pixel outline, so it reads as part of the drawn sprite
const OUTLINE = rgb(30, 24, 26);
function drawHead(look, gearHead, view, cx, top, mirror, pal, d) {
  const rows = ART.heads[gearHead || look.head][view];
  const w = Math.max(...rows.map(r => r.length)), x0 = Math.round(cx - w / 2);
  for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= w; x++) {
    const filled = (yy, xx) => yy >= 0 && yy < rows.length && xx >= 0 && xx < rows[yy].length && rows[yy][mirror ? rows[yy].length - 1 - xx : xx] !== '.';
    if (filled(y, x)) continue;
    if (!(filled(y - 1, x) || filled(y + 1, x) || filled(y, x - 1) || filled(y, x + 1))) continue;
    const sx = x0 + x, sy = top + y;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    const i = sy * W + sx;
    if (d - .01 > zb[i]) { zb[i] = d - .01; pix[i] = OUTLINE; }
  }
  stampAt(rows, cx, top, pal, mirror, d);
}
// shadows of everything drawn this frame: each sprite pixel throws a pixel away from the sun onto
// whatever static surface lies at that figure's feet height
const shMark = new Uint8Array(W * H), shList = [];
const SHX = (SHADOW_X - SHADOW_Y) / R2 / COS, SHY = (SHADOW_X + SHADOW_Y) / R2 * SIN / COS;
function castSpriteShadows(kx, ky) {
  for (let n = 0; n < spriteShadow.length; n += 4) {
    const sx = spriteShadow[n], hpx = spriteShadow[n + 1], by = spriteShadow[n + 2], z = spriteShadow[n + 3];
    const tx = Math.round(sx + hpx * kx), ty = Math.round(by + hpx * ky);
    // two pixels wide: the shadow is stretched sideways and would otherwise break into dots
    for (let o = 0; o < 2; o++) {
      const qx = tx + o;
      if (qx < 0 || ty < 0 || qx >= W || ty >= H) continue;
      const i = ty * W + qx;
      if (shMark[i] || zb[i] !== bakedZ[i]) continue;
      // only on the plane the figure stands on
      const g = unproject(qx + .5, ty + .5 + z * COS * S), dPlane = (g.x + g.y) / R2 * COS + z * SIN;
      if (Math.abs(bakedZ[i] - dPlane) > .5) continue;
      shMark[i] = hpx < 2 ? 2 : 1; shList.push(i);
    }
  }
  for (const i of shList) { if (shMark[i] === 2) tint(i, .5, .48, .64); else tint(i, .66, .64, .8); shMark[i] = 0; }
  shList.length = 0; spriteShadow.length = 0;
}

/* ================= the yard: a diamond of land floating on white ================= */
const CONCRETE = [176, 172, 160], BAG = [190, 166, 116], WOOD = [146, 104, 66], PLANK = [176, 132, 84], METAL = [148, 158, 166];
const DARK = [44, 40, 50], DIRT = [152, 120, 84], CONT = [170, 72, 54], OLIVE = [104, 116, 78], STEEL = [112, 122, 132];
const DISH = [206, 210, 214], ROPE = [196, 176, 130];
const STEP = .45 / S, KIND_DIRT = 1;
function groundColor(x, y, ix, iy) {
  const n = Math.max(Math.abs(x), Math.abs(y));
  // the island's edge dissolves into the page, as in the first version
  if (n > FIELD - noise(x * .45 + 9, y * .45) * 1.5 - hash(ix, iy) * .35) return null;
  const clearing = n + noise(x * .7, y * .7) * 1.1;
  if (clearing < FENCE_R + .35) {
    const ramp = rampOf(DIRT), fine = hash(ix, iy);
    if (fine > .985) return [ramp[4], KIND_DIRT];
    return [ramp[clamp(Math.floor(2.1 + noise(x * 1.4, y * 1.4) * 1.3 + (bayerAt(ix, iy) - .5) * .5), 1, 4)], KIND_DIRT];
  }
  const tone = noise(x * .3, y * .3) * 1.5 + noise(x * 1.2 + 4, y * 1.2) * .7;
  return [tuftLit[clamp(Math.floor(1 + tone + (bayerAt(ix, iy) - .5) * .5), 0, 4)], KIND_GRASS];
}
const groundPix = new Uint32Array(W * H), groundKinds = new Uint8Array(W * H), groundDepth = new Float32Array(W * H), groundMask = new Uint8Array(W * H);
function bakeGround() {
  for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) {
    const g = unproject(ix + .5, iy + .5), r = groundColor(g.x, g.y, ix, iy), i = iy * W + ix;
    if (!r) { groundPix[i] = PAPER; groundKinds[i] = 0; groundMask[i] = 0; groundDepth[i] = -1e9; continue; }
    groundPix[i] = r[0]; groundKinds[i] = r[1]; groundMask[i] = 1; groundDepth[i] = (g.x + g.y) / R2 * COS;
  }
}
// small helpers for building out of boxes and pixel lines (no round shapes)
function line3(a, b, color, dense = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / STEP * dense));
  for (let k = 0; k <= n; k++) { const t = k / n; plot(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), color); }
}
function faceY(x0, x1, y, z0, z1, colorAt) { for (let x = x0; x <= x1; x += STEP) for (let z = z0; z <= z1; z += STEP) { const c = colorAt(x, z); if (c) plot(x, y, z, c); } }
function faceX(y0, y1, x, z0, z1, colorAt) { for (let y = y0; y <= y1; y += STEP) for (let z = z0; z <= z1; z += STEP) { const c = colorAt(y, z); if (c) plot(x, y, z, c); } }
function shadowBox(x0, y0, x1, y1, z1, r = .4) {
  for (let x = x0 + r / 2; x <= x1; x += r) for (let y = y0 + r / 2; y <= y1; y += r) for (let z = .2; z < z1; z += r) castShadow(x, y, z, r * .9);
}
function crate(x, y, z, s, c = PLANK, seed = 1) {
  box(x - s, y - s, z, x + s, y + s, z + 2 * s, c, seed);
  const d = rampOf(c)[1];
  faceY(x - s, x + s, y + s + .005, z, z + 2 * s, (a, b) => Math.abs(a - x) < .03 || Math.abs(b - z - s) < .03 ? d : 0);
  faceX(y - s, y + s, x + s + .005, z, z + 2 * s, (a, b) => Math.abs(a - y) < .03 || Math.abs(b - z - s) < .03 ? d : 0);
  castShadow(x, y, z + s, s * 1.2);
}
function ladderY(x, y, z0, z1) {
  // on a +y wall
  for (const o of [-.2, .2]) box(x + o - .03, y, z0, x + o + .03, y + .08, z1, METAL, 6);
  for (let z = z0 + .25; z < z1; z += .26) box(x - .2, y + .02, z, x + .2, y + .08, z + .04, METAL, 7);
}
function bagRing(h, rows) {
  // sandbags laid like bricks: boxes, each with a lighter top
  const n = Math.round(h * 8 / .38);
  for (let r = 0; r < rows; r++) for (let k = 0; k < n; k++) {
    const t = ((k + r * .5) / n) * 4, side = Math.floor(t) % 4, q = (t % 1) * 2 - 1;
    const [x, y] = [[h, q * h], [-q * h, h], [-h, -q * h], [q * h, -h]][side];
    const ax = side % 2 ? .1 : .17, ay = side % 2 ? .17 : .1;
    box(x - ax, y - ay, r * .19, x + ax, y + ay, r * .19 + .17, BAG, k + r * 7);
    if (r === 0) castShadow(x, y, .2, .2);
  }
}
const SITES = []; // where the gunners stand, and the hatch down, for the current bunker
// lit lamps glow every frame (a small warm cross that flickers); the fortress beacon also sweeps a beam
const GLOWS = []; let BEACON = null;
const glow = (x, y, z, c = [255, 236, 170]) => GLOWS.push({ x, y, z, c: rgb(...c), soft: rgb(c[0] * .9, c[1] * .8, c[2] * .6) });
const sub = (L, f) => L - FORM_AT[f];
function buildBunker() {
  const L = G.bunker, f = formOf(L), k = sub(L, f), F = BUNKER_FORMS[f], h = F.half, top = F.roof, dark = rampOf(DARK), steel = rampOf(METAL);
  const has = n => k >= n;
  SITES.length = 0;
  const spots = (r, z) => [[0, 0], [r, -r], [-r, r], [r, r], [-r, -r], [0, -r]].map(([x, y]) => [x, y, z]);
  const flag = (x, y, z0, len, c) => {
    line3([x, y, z0], [x, y, z0 + len], dark[2]);
    for (let a = 0; a <= .45; a += STEP) for (let z = z0 + len - .32; z <= z0 + len; z += STEP) plot(x + a, y - a * .2, z - Math.sin(a * 6) * .05, rampOf(c)[a > .3 ? 2 : 3]);
    for (let z = z0 + .3; z < z0 + len; z += .3) castShadow(x, y, z, .05, 1, 0);
  };
  const lamp = (x, y, z, c = [255, 236, 170]) => { box(x - .07, y - .07, z, x + .07, y + .07, z + .14, DARK, 99); plot(x + .08, y + .08, z + .07, rgb(...c)); glow(x + .08, y + .08, z + .07, c); };
  if (f === 0) {
    // foxhole: sandbags, a plank platform to see over them
    bagRing(h, has(2) ? 2 : 1);
    box(-.55, -.55, 0, .55, .55, top, PLANK, 3);
    faceY(-.55, .55, .555, 0, top, (a) => Math.floor((a + 5) * 6) % 3 === 0 ? rampOf(PLANK)[1] : 0);
    if (has(1)) { crate(-.75, .72, 0, .16, OLIVE, 4); crate(.75, -.75, 0, .16, OLIVE, 5); }
    if (has(3)) { box(.8, .8, 0, .86, .86, 1.0, WOOD, 6); lamp(.83, .83, 1.0, [255, 214, 120]); }
    if (has(4)) {
      for (const y of [-.5, -.05]) box(-1.0, y - .03, 0, -.94, y + .03, .75, WOOD, 8);
      box(-1.04, -.56, .42, -.92, .01, .78, PLANK, 9);
      faceX(-.52, -.03, -.915, .48, .72, (a, z) => Math.abs(a + .27) < .05 || Math.abs(z - .6) < .04 ? rgb(196, 56, 44) : 0);
      for (const x of [.3, .55]) { box(x - .1, .74, 0, x + .1, .92, .32, [196, 56, 44], 10); box(x - .03, .8, .32, x + .03, .86, .38, DARK, 11); }
    }
    shadowBox(-.55, -.55, .55, .55, top, .3);
    SITES.push([0, 0, top], [.3, -.3, top], [-.3, .3, top], [.85, 0, 0], [0, .85, 0], [-.85, 0, 0]);
    SITES.hatch = [-.85, -.85, 0];
    return;
  }
  if (f === 1) {
    // a wooden watchtower
    for (const [x, y] of [[-1.05, -1.05], [1.05, -1.05], [-1.05, 1.05], [1.05, 1.05]]) {
      box(x - .08, y - .08, 0, x + .08, y + .08, top, WOOD, 1);
      for (let z = .3; z < top; z += .35) castShadow(x, y, z, .1, 1, 0);
    }
    if (has(1)) {
      const brace = rampOf(WOOD)[1];
      line3([-1.05, 1.13, .2], [1.05, 1.13, top - .2], brace); line3([1.05, 1.13, .2], [-1.05, 1.13, top - .2], brace);
      line3([1.13, -1.05, .2], [1.13, 1.05, top - .2], brace); line3([1.13, 1.05, .2], [1.13, -1.05, top - .2], brace);
    }
    box(-h, -h, top - .12, h, h, top, PLANK, 2);
    faceY(-h, h, h + .005, top - .12, top, (a) => Math.floor((a + 5) * 5) % 2 ? rampOf(PLANK)[1] : 0);
    if (has(2)) {
      for (const [x, y] of [[-h, -h], [h, -h], [-h, h], [h, h]]) box(x - .05, y - .05, top, x + .05, y + .05, top + .45, WOOD, 3);
      box(-h, h - .04, top + .36, h, h + .04, top + .43, WOOD, 4); box(h - .04, -h, top + .36, h + .04, h, top + .43, WOOD, 5);
      box(-h, -h - .04, top + .36, h, -h + .04, top + .43, WOOD, 4); box(-h - .04, -h, top + .36, -h + .04, h, top + .43, WOOD, 5);
    }
    ladderY(.55, h + .02, 0, top + .3);
    if (has(3)) { crate(-.4, .3, 0, .22, PLANK, 8); crate(.2, -.5, 0, .18, OLIVE, 9); crate(-.4, .3, .44, .16, OLIVE, 10); }
    if (has(4)) lamp(h - .05, h - .05, top + .45);
    if (has(5)) flag(-h + .05, -h + .05, top, 1.3, [70, 110, 170]);
    for (let x = -h; x <= h; x += .45) for (let y = -h; y <= h; y += .45) castShadow(x, y, top, .45);
    SITES.push(...spots(h * .55, top)); SITES.hatch = [-h * .6, -h * .6, top];
    return;
  }
  if (f === 2) {
    // a shipping container
    box(-h, -h, 0, h, h, top, CONT, 1);
    const cr = rampOf(CONT);
    faceY(-h, h, h + .005, 0, top, (a) => Math.floor((a + 9) * 7) % 2 ? cr[1] : 0);
    faceX(-h, h, h + .005, 0, top, (a, b) => {
      if (Math.abs(a) < .03) return rampOf(DARK)[1];
      if (has(1) && (Math.abs(a - .35) < .025 || Math.abs(a + .35) < .025 || Math.abs(a - .9) < .025 || Math.abs(a + .9) < .025)) return b > .1 && b < top - .1 ? steel[3] : 0;
      return Math.floor((b + 9) * 7) % 2 ? cr[1] : 0;
    });
    if (has(3)) faceY(-.95, -.35, h + .01, 1.2, 1.42, (a, z) => (Math.floor(a * 14) % 3 && Math.abs(z - 1.31) < .08) ? rgb(236, 230, 214) : rgb(150, 60, 46));
    const P = h + .05;
    if (has(2)) {
      box(-P, P - .1, top, P, P, top + .25, STEEL, 2); box(P - .1, -P, top, P, P, top + .25, STEEL, 3);
      box(-P, -P, top, P, -P + .1, top + .25, STEEL, 2); box(-P, -P, top, -P + .1, P, top + .25, STEEL, 3);
    }
    ladderY(-.6, h + .02, 0, top + .25);
    if (has(4)) { box(h - .45, -h + .15, top, h - .2, -h + .4, top + .4, METAL, 11); faceX(-h + .18, -h + .37, h - .19, top + .26, top + .38, () => rgb(255, 246, 200)); }
    if (has(5)) { line3([-h + .2, -h + .2, top], [-h + .2, -h + .2, top + 1.6], dark[2]); plot(-h + .2, -h + .2, top + 1.65, rgb(255, 80, 60)); }
    shadowBox(-h, -h, h, h, top + .2);
    SITES.push(...spots(h * .55, top)); SITES.hatch = [-h * .6, -h * .6, top];
    return;
  }
  // concrete from here on
  box(-h, -h, 0, h, h, top, CONCRETE, 1);
  const P = h + .08, T = .18, rim = top + .28, conc = rampOf(CONCRETE);
  if (f === 5) {
    for (let a = -P; a < P; a += .5) {
      box(a, P - T, top, a + .28, P, rim + .1, CONCRETE, 2); box(P - T, a, top, P, a + .28, rim + .1, CONCRETE, 3);
      box(a, -P, top, a + .28, -P + T, rim + .1, CONCRETE, 2); box(-P, a, top, -P + T, a + .28, rim + .1, CONCRETE, 3);
    }
    box(-P, P - T, top, P, P, top + .14, CONCRETE, 2); box(P - T, -P, top, P, P, top + .14, CONCRETE, 3);
  } else {
    box(-P, P - T, top, P, P, rim, CONCRETE, 2); box(P - T, -P, top, P, P, rim, CONCRETE, 3);
    box(-P, -P, top, P, -P + T, rim, CONCRETE, 2); box(-P, -P, top, -P + T, P, rim, CONCRETE, 3);
  }
  for (const c of [-.85, .9]) faceX(c - .3, c + .3, h + .03, 1.2, 1.4, () => dark[0]);
  faceY(-1.05, -.45, h + .03, 1.2, 1.4, () => dark[0]);
  ladderY(.75, h + .02, 0, rim);
  const door = f >= 4 || has(1);
  if (door) faceX(-.25, .55, h + .04, 0, 1.25, (a, z) => Math.abs(a - .15) > .34 || z > 1.19 ? steel[1] : (f === 4 && has(6) && Math.floor((a + z) * 5) % 2 ? rgb(232, 190, 40) : steel[Math.floor(z * 6) % 3 ? 2 : 3]));
  if (f >= 4 || has(2)) {
    faceY(-h, h, h + .005, .05, top, (a, z) => noise(a * 2.2, 1) * 1.6 > (top - z) && hash(a * 90 | 0, z * 90 | 0) > .55 ? conc[1] : 0);
    faceX(-h, h, h + .005, .05, top, (a, z) => noise(a * 2.2, 5) * 1.6 > (top - z) && hash(a * 90 | 0, z * 90 | 0) > .55 ? conc[1] : 0);
  }
  if (f >= 4 || has(3)) flag(-h + .25, -h + .25, rim, 1.9, [186, 60, 50]);
  if (f === 3) {
    if (has(4)) for (const [x, y] of [[.3, -.6], [-.5, .4]]) { box(x - .22, y - .22, top, x + .22, y + .22, top + .34, METAL, 12); faceY(x - .2, x + .2, y + .225, top + .05, top + .3, (a, z) => Math.floor(z * 22) % 2 ? dark[1] : 0); faceX(y - .2, y + .2, x + .225, top + .05, top + .3, (a, z) => Math.floor(z * 22) % 2 ? dark[1] : 0); }
    if (has(5)) lamp(.2, h + .05, 1.6);
    if (has(6)) for (let a = -P; a <= P; a += .006) { const ang = a * 40; plot(a, P - .05 + Math.cos(ang) * .06, rim + .08 + Math.sin(ang) * .06, rampOf(DARK)[2]); plot(P - .05 + Math.cos(ang) * .06, a, rim + .08 + Math.sin(ang) * .06, rampOf(DARK)[2]); }
  }
  if (f >= 4) {
    const plate = (a, z) => {
      const m = (a + 9) % .6, seam = m < .03 || z > .82, bolt = Math.abs(m - .3) < .03 && Math.abs(z - .68) < .03;
      return bolt ? steel[4] : seam ? steel[1] : steel[2 + (hash(a * 50 | 0, 3) > .7 ? 1 : 0)];
    };
    faceY(-h, h, h + .02, 0, .86, plate); faceX(-h, h, h + .02, 0, .86, plate);
  }
  if (f === 4) {
    if (has(1)) { const camo = (a, z) => { const n = noise(a * 1.4 + 3, z * 1.6); return n > .62 ? rgb(108, 116, 82) : n < .3 ? rgb(130, 110, 86) : 0; }; faceY(-h, h, h + .006, .9, top, camo); faceX(-h, h, h + .006, .9, top, camo); }
    if (has(2)) { box(h - .75, h - .75, top, h - .15, h - .15, top + .45, STEEL, 8); line3([h - .45, h - .45, top + .52], [h + .25, h + .25, top + .62], dark[1]); }
    if (has(3)) { box(h - .62, -h + .1, top, h - .14, -h + .58, top + .3, DARK, 9); box(h - .56, -h + .14, top + .3, h - .2, -h + .54, top + .72, METAL, 9); faceX(-h + .18, -h + .5, h - .195, top + .4, top + .66, () => rgb(255, 246, 200)); glow(h - .18, -h + .34, top + .53, [255, 246, 200]); }
    if (has(4)) { box(-.75, .15, top, -.05, .85, top + .2, STEEL, 13); faceY(-.75, -.05, .855, top + .02, top + .18, (a, z) => Math.floor((a + z) * 9) % 2 ? rgb(232, 190, 40) : rgb(40, 38, 44)); box(-.5, .45, top + .2, -.3, .55, top + .28, METAL, 14); }
    if (has(5)) for (const x of [-.9, -.6]) { line3([x, -h + .3, rim], [x, -h + .3, rim + 1.1], dark[2]); for (let z = rim + .5; z <= rim + 1; z += .25) line3([x - .12, -h + .3, z], [x + .12, -h + .3, z], dark[2]); }
  }
  if (f === 5) {
    if (has(1)) {
      box(-h - .05, -h - .05, top, -h + 1.0, -h + 1.0, top + 1.25, CONCRETE, 10);
      box(-h - .15, -h - .15, top + 1.25, -h + 1.1, -h + 1.1, top + 1.37, STEEL, 11);
      faceX(-h + .2, -h + .8, -h + 1.01, top + .65, top + .85, () => dark[0]); faceY(-h + .2, -h + .8, -h + 1.01, top + .65, top + .85, () => dark[0]);
      shadowBox(-h, -h, -h + 1, -h + 1, top + 1.3);
    }
    if (has(2)) {
      const rx = h - .5, ry = -h + .5;
      line3([rx, ry, rim], [rx, ry, rim + .8], dark[2]);
      for (let a = -.45; a <= .45; a += STEP) { const dz = a * a * 1.1; plot(rx + a * .7, ry - a * .7, rim + .8 + dz, rampOf(DISH)[3]); plot(rx + a * .7, ry - a * .7, rim + .82 + dz, rampOf(DISH)[2]); }
    }
    if (has(3)) for (const [x, y] of [[h, h], [-h, h], [h, -h]]) lamp(x, y, rim + .1);
    if (has(4)) faceY(-.6, .2, h + .03, 1.5, 2.1, (a, z) => Math.abs(a + .2) < .06 && z > 1.6 ? rgb(236, 200, 70) : rgb(150, 40, 40));
    if (has(5)) { box(h - .9, h - .9, top, h - .1, h - .1, top + .8, CONCRETE, 14); box(h - 1, h - 1, top + .8, h, h, top + .9, STEEL, 15); }
    if (has(6)) { box(-.2, .2, rim, .2, .6, rim + .14, DARK, 17); box(-.13, .27, rim + .14, .13, .53, rim + .38, [210, 60, 44], 18); BEACON = [0, .4, rim + .3]; }
    if (has(7)) {
      box(.05, -.75, top, .85, .05, top + .45, STEEL, 16); box(.2, -.6, top + .45, .7, -.1, top + .7, METAL, 19);
      for (const w of [0, .05]) line3([.45 + w, -.35, top + .6], [1.5 + w, .7, top + .78], w ? rgb(70, 74, 80) : rgb(150, 210, 255));
      glow(1.5, .7, top + .78, [150, 220, 255]);
    }
    if (has(8)) faceX(-.3, .3, h + .05, 1.55, 2.0, (a, z) => Math.hypot(a, z - 1.78) < .2 ? rgb(236, 200, 70) : 0);
  }
  shadowBox(-h, -h, h, h, rim);
  SITES.push(...spots(h * .55, top)); SITES.hatch = [-h * .55, h * .15, top];
}
// things that collect inside the fence as the bunker levels up
function buildProps() {
  const L = G.bunker;
  if (L >= 3) crate(2.85, 2.5, 0, .22, PLANK, 21);
  if (L >= 7) { crate(2.85, 2.5, .44, .18, OLIVE, 22); crate(2.4, 2.9, 0, .2, PLANK, 23); }
  if (L >= 10) {
    box(-3.2, 2.3, 0, -2.5, 2.9, .5, [96, 120, 92], 24);
    faceY(-3.15, -2.55, 2.905, .1, .42, (a, z) => Math.floor(z * 18) % 2 ? rgb(52, 56, 52) : 0);
    box(-2.65, 2.35, .5, -2.58, 2.42, .85, DARK, 25);
  }
  if (L >= 14) for (const [x, y] of [[-2.2, 2.9], [-2.0, 2.9]]) box(x - .07, y - .05, 0, x + .07, y + .05, .26, [196, 56, 44], 26);
  if (L >= 16) {
    for (const [x, y] of [[2.4, -3.1], [3.1, -3.1], [2.4, -2.4], [3.1, -2.4]]) box(x - .04, y - .04, 0, x + .04, y + .04, .9, METAL, 27);
    box(2.3, -3.2, .9, 3.2, -2.3, 1.6, [120, 140, 160], 28);
    faceY(2.3, 3.2, -2.295, .9, 1.6, (a, z) => Math.floor(z * 10) % 3 === 0 ? rgb(96, 112, 130) : 0);
  }
  if (L >= 20) for (const [x, y] of [[-3.55, -3.55], [3.55, 3.55]]) {
    box(x - .04, y - .04, 0, x + .04, y + .04, 1.5, DARK, 29); box(x - .14, y - .14, 1.5, x + .14, y + .14, 1.66, METAL, 30);
    plot(x + .15, y + .15, 1.58, rgb(255, 246, 200)); glow(x + .15, y + .15, 1.58, [255, 246, 200]);
    for (let z = .3; z < 1.5; z += .3) castShadow(x, y, z, .05, 1, 0);
  }
  if (L >= 23) for (const [x, y] of [[-2.9, -2.6], [-2.5, -2.9]]) box(x - .18, y - .18, 0, x + .18, y + .18, .36, CONCRETE, 31);
  if (L >= 27) for (const [x, y] of [[-3.0, -1.6], [-3.0, -1.2]]) { line3([x, y, 0], [x, y, 1.7], rampOf(DARK)[2]); for (let z = .9; z <= 1.6; z += .35) line3([x - .15, y + .15, z], [x + .15, y - .15, z], rampOf(DARK)[2]); }
  if (L >= 34) for (let k = 0; k < 3; k++) {
    const y = 1.1 + k * .5;
    box(-3.4, y, .18, -2.7, y + .4, .24, [52, 70, 120], 32 + k); faceY(-3.4, -2.7, y + .405, .18, .24, () => rgb(150, 180, 230));
    box(-3.1, y + .15, 0, -3.0, y + .25, .18, METAL, 35);
  }
  if (L >= 37) for (let x = -.4; x <= .4; x += STEP) for (let y = 2.65; y <= 3.45; y += STEP) {
    const ring = Math.abs(Math.hypot(x, y - 3.05) - .38) < .04;
    if (ring || (Math.abs(Math.abs(x) - .17) < .04 && Math.abs(y - 3.05) < .22) || (Math.abs(x) < .17 && Math.abs(y - 3.05) < .035)) plot(x, y, .01, rgb(236, 232, 214));
  }
}
/* fences: six forms over 40 levels, all low; every level adds something. Each side shows its own wear */
const SIDE_AT = (side, s, R = FENCE_R) => [[s, R], [R, s], [s, -R], [-R, s]][side];
function buildFence() {
  const L = G.fence;
  if (!L) return;
  const f = formOf(L), k = sub(L, f), R = FENCE_R, down = G.fenceDown, seg = R / 5, has = n => k >= n;
  for (let side = 0; side < 4; side++) {
    const wear = down ? 5 : G.sideStage[side];
    for (let j = 0; j < 10; j++) {
      const a = -R + j * seg, b = a + seg, key = side * 31 + j, broken = down || hash(key, 5) < wear * .22;
      const at = t => SIDE_AT(side, lerp(a, b, t));
      const post = (t, w, hgt, c, seed = key) => { const [x, y] = at(t); box(x - w, y - w, 0, x + w, y + w, hgt, c, seed); for (let z = .15; z < hgt; z += .2) castShadow(x, y, z, w * 1.2, 1, 0); };
      const rail = (z, th, c) => { const [x0, y0] = at(0), [x1, y1] = at(1); box(Math.min(x0, x1) - th, Math.min(y0, y1) - th, z, Math.max(x0, x1) + th, Math.max(y0, y1) + th, z + th * 1.6, c, side); };
      const debris = c => {
        if (hash(key, 9) > .7) return;
        const o = .3 + hash(key, 11) * .35, [x0, y0] = at(.15), [x1, y1] = at(.75);
        const ox = side === 1 ? o : side === 3 ? -o : 0, oy = side === 0 ? o : side === 2 ? -o : 0;
        box(Math.min(x0, x1) + ox, Math.min(y0, y1) + oy, 0, Math.max(x0, x1) + ox + .06, Math.max(y0, y1) + oy + .06, .06, c, key);
      };
      const corner = j === 0;
      const sign = (t, c) => { const [x, y] = at(t); box(x - .1, y - .1, .2, x + .1, y + .1, .4, c, key + 3); plot(x + .11, y + .11, .3, rgb(40, 38, 44)); };
      const cornerLamp = () => { if (!corner) return; const [x, y] = at(0); box(x - .03, y - .03, 0, x + .03, y + .03, .9, DARK, key); box(x - .08, y - .08, .9, x + .08, y + .08, 1, METAL, key); plot(x + .09, y + .09, .95, rgb(255, 236, 170)); glow(x + .09, y + .09, .95); };
      if (f === 0) {
        // stakes, more of them every level, tied with rope, a lantern on the corners at the end
        const per = 2 + Math.min(2, Math.floor(k / 2));
        for (let n = 0; n < per; n++) {
          const t = n / per, hgt = broken && n ? .12 : .38 + hash(key, n * 9) * .12;
          post(t, .05, hgt, WOOD);
          const [x, y] = at(t);
          if (!(broken && n)) plot(x, y, hgt + .05, has(3) ? rgb(220, 70, 50) : rampOf(PLANK)[4]);
        }
        if (broken) { debris(WOOD); continue; }
        if (has(1)) { const rope = rampOf(ROPE)[3]; for (let t = 0; t <= 1; t += STEP / seg) { const [x, y] = at(t); plot(x, y, .28 - Math.sin(t * Math.PI * per) * .03, rope); } }
        if (has(4)) cornerLamp();
      } else if (f === 1) {
        // a picket fence: whitewashed, then spiked, lamps and signs
        const wood = has(1) ? [214, 206, 188] : PLANK;
        post(0, .06, broken ? .2 : .52, has(3) ? DARK : WOOD);
        if (broken) { debris(wood); continue; }
        rail(.15, .025, wood); rail(.38, .025, wood);
        const pk = rampOf(wood);
        for (let t = .16, n = 0; t < .95; t += .23, n++) {
          const [x, y] = at(t);
          line3([x, y, 0], [x, y, .46], pk[n % 2 ? 2 : 3]);
          plot(x, y, .5, has(2) ? rgb(60, 60, 70) : pk[4]);
        }
        if (has(4)) cornerLamp();
        if (has(5) && j % 4 === 2) sign(.5, [232, 190, 40]);
      } else if (f === 2) {
        // barbed wire: more strands, then a coil on top, tin cans that rattle, signs
        post(0, .035, broken ? .18 : .5, STEEL);
        if (broken) { debris(STEEL); continue; }
        const wire = rampOf(METAL)[2], barb = rampOf(DARK)[1], levels = has(1) ? [.08, .28, .46] : [.12, .36];
        levels.forEach((z, n) => { for (let t = 0; t <= 1; t += STEP / seg) { const [x, y] = at(t); plot(x, y, z, hash(t * 300 | 0, n) > .8 ? barb : wire); } });
        if (has(2)) {
          // the coil: separate loops along the top, each a ring of dots
          const nn = side % 2 ? [1, 0] : [0, 1];
          for (let c = .1; c < 1; c += .2) { const [x, y] = at(c); for (let q = 0; q < 8; q++) { const ang = q * Math.PI / 4; plot(x + nn[0] * Math.cos(ang) * .1, y + nn[1] * Math.cos(ang) * .1, .58 + Math.sin(ang) * .1, q % 2 ? wire : rampOf(METAL)[4]); } }
        }
        if (has(3)) for (const t of [.3, .7]) { const [x, y] = at(t); box(x - .03, y - .03, .3, x + .03, y + .03, .36, [200, 200, 196], key + t); }
        if (has(4) && j % 4 === 2) sign(.5, [214, 70, 50]);
        if (has(5)) cornerLamp();
      } else if (f === 3) {
        // steel hedgehogs; beams join them, hazard paint, a second row, spikes, lights
        const [cx, cy] = at(.5), n = side % 2 ? [0, 1] : [1, 0], o = side % 2 ? [1, 0] : [0, 1];
        if (broken) { box(cx - .2, cy - .2, 0, cx + .2, cy + .2, .08, STEEL, key); continue; }
        const beam = rampOf(has(2) ? [190, 150, 50] : STEEL)[2], beamL = rampOf(has(6) ? [70, 74, 80] : STEEL)[3];
        for (const sgn of [-1, 1]) for (const w of [0, .03]) {
          line3([cx - n[0] * .28 * sgn + w, cy - n[1] * .28 * sgn, 0], [cx + n[0] * .28 * sgn + w, cy + n[1] * .28 * sgn, .52], sgn > 0 ? beamL : beam);
          line3([cx - o[0] * .25 + w, cy - o[1] * .25, 0], [cx + o[0] * .25 + w, cy + o[1] * .25, .45], beam);
        }
        if (has(1)) rail(.12, .03, STEEL);
        if (has(3)) { const ox = side === 1 ? -.35 : side === 3 ? .35 : 0, oy = side === 0 ? -.35 : side === 2 ? .35 : 0; line3([cx + ox - n[0] * .2, cy + oy - n[1] * .2, 0], [cx + ox + n[0] * .2, cy + oy + n[1] * .2, .35], beam); }
        if (has(4)) for (const t of [.1, .9]) { const [x, y] = at(t); line3([x, y, 0], [x, y, .3], rampOf(METAL)[4]); }
        if (has(5)) cornerLamp();
        castShadow(cx, cy, .25, .25);
      } else if (f === 4) {
        // jersey barriers: stripes, reflectors, a low mesh on top, lamps, spikes, numbers
        const [x0, y0] = at(.04), [x1, y1] = at(.96);
        const lx = Math.min(x0, x1), hx = Math.max(x0, x1), ly = Math.min(y0, y1), hy = Math.max(y0, y1);
        if (broken) { box(lx, ly, 0, lx + .25, ly + .25, .2, CONCRETE, key); debris(CONCRETE); continue; }
        box(lx - .14, ly - .14, 0, hx + .14, hy + .14, .2, CONCRETE, key);
        box(lx - .08, ly - .08, .2, hx + .08, hy + .08, .48, CONCRETE, key + 1);
        const stripe = [rgb(232, 190, 40), rgb(40, 38, 44)];
        if (has(1)) {
          if (side === 0) faceY(lx, hx, hy + .085, .3, .4, (a2, z) => stripe[Math.floor(a2 * 6 + z * 6) & 1]);
          if (side === 1) faceX(ly, hy, hx + .085, .3, .4, (a2, z) => stripe[Math.floor(a2 * 6 + z * 6) & 1]);
        }
        if (has(2)) { const [x, y] = at(.5); plot(x, y, .44, rgb(240, 80, 60)); }
        if (has(3)) for (let t = 0; t <= 1; t += STEP / seg) { const [x, y] = at(t); for (let z = .5; z <= .6; z += STEP) if (Math.floor(t * 30 + z * 30) % 2) plot(x, y, z, rampOf(STEEL)[3]); }
        if (has(4)) cornerLamp();
        if (has(5)) for (const t of [.25, .75]) { const [x, y] = at(t); line3([x, y, .48], [x, y, .62], rampOf(METAL)[4]); }
        for (let t = 0; t <= 1; t += .25) { const [x, y] = at(t); castShadow(x, y, .25, .2); }
      } else {
        // electric fence: mesh, insulators, warning signs, inner wire, cable ducts, a transformer, a blue glow
        post(0, .035, broken ? .2 : .6, DARK);
        if (broken) { debris(STEEL); continue; }
        const mesh = rampOf(has(8) ? [130, 190, 240] : STEEL)[3];
        for (let t = 0; t <= 1; t += .07) { const [x, y] = at(t); for (let z = .04; z <= .56; z += STEP) plot(x, y, z, mesh); }
        for (const z of [.06, .2, .34, .48, .58]) for (let t = 0; t <= 1; t += STEP / seg) { const [x, y] = at(t); plot(x, y, z, mesh); }
        if (has(1)) { const [px0, py0] = at(0); plot(px0, py0, .62, rgb(240, 240, 232)); }
        if (has(2) && j % 3 === 1) sign(.5, [232, 190, 40]);
        if (has(4)) { const ox = side === 1 ? -.25 : side === 3 ? .25 : 0, oy = side === 0 ? -.25 : side === 2 ? .25 : 0; for (let t = 0; t <= 1; t += STEP / seg) { const [x, y] = at(t); plot(x + ox, y + oy, .3, rgb(120, 200, 255)); } }
        if (has(6)) { const [x, y] = at(.5); box(x - .05, y - .05, 0, x + .05, y + .05, .05, DARK, key); }
        if (has(7) && corner && side === 1) { const [x, y] = at(0); box(x - .25, y - .25, 0, x + .05, y + .05, .5, [96, 104, 112], key); faceX(y - .25, y + .05, x + .055, .3, .42, () => rgb(232, 190, 40)); }
      }
    }
  }
}
function bakeYard() {
  GLOWS.length = 0; BEACON = null;
  pix.set(groundPix); kinds.set(groundKinds); ground.set(groundMask); zb.set(groundDepth);
  shadowMask.fill(0);
  groundZ.set(zb);
  buildProps();
  buildBunker();
  buildFence();
  bakeOcclusion();
  staticShadow.set(shadowMask);
  applyShadows(groundZ);
  yardPix.set(pix); yardZ.set(zb); yardGZ.set(groundZ); yardGround.set(ground); yardShadow.set(staticShadow);
  yardDirty = false; yardBakedAt = G.time;
  if (G.view === 'yard') showYard(); else showUnder();
}
const yardPix = new Uint32Array(W * H), yardZ = new Float32Array(W * H), yardGZ = new Float32Array(W * H), yardGround = new Uint8Array(W * H), yardShadow = new Uint8Array(W * H);
function showYard() { bakedPix.set(yardPix); bakedZ.set(yardZ); groundZ.set(yardGZ); ground.set(yardGround); staticShadow.set(yardShadow); }

/* ================= under the bunker: three floors, one above the other ================= */
// a cutaway of three floors pulled apart so each is seen whole: B1 living quarters, B2 food, B3 the mine,
// joined by one ladder shaft in the back-left corner
const UG = { x0: -9, x1: 9, y0: -2, y1: 2, h: 2.6, slab: 1, gap: 3.9 };
const FLOOR_NAME = ['지하 1층 · 생활층', '지하 2층 · 식량층', '지하 3층 · 채굴층'];
const FLOOR_Z = [0, 0, 0];
const SHAFT = { x: -8.45, y: -1.45 }, LADDER_Y = -.92;
const PLASTER = [170, 164, 150], SOIL = [118, 88, 62], SOIL_D = [84, 62, 46], STONE_W = [118, 114, 110], TILE = [208, 212, 204], PLANKS = [150, 112, 74], ORE = [104, 140, 196];
function layoutFloors() {
  const step = UG.h + UG.slab + UG.gap;
  const top = project(UG.x0, UG.y0, UG.h + 1.4).sy, bot = project(UG.x1, UG.y1, -2 * step - UG.slab).sy;
  const z0 = ((top + bot) / 2 - OY) / (COS * S);
  for (let k = 0; k < 3; k++) FLOOR_Z[k] = z0 - k * step;
}
const BED_X = i => -7.0 + i * 2.2;
function floorColor(k, x, y, ix, iy) {
  if (k === 0) { const plank = Math.floor((y + 9) * 2.6), seam = ((y + 9) * 2.6) % 1 < .1; return rampOf(PLANKS)[seam ? 0 : 2 + (hash(plank, Math.floor(x * .8 + plank * .3)) > .6 ? 1 : 0)]; }
  if (k === 1 && G.farm >= 8) { const gx = x * 2.2, gy = y * 2.2, grout = gx - Math.floor(gx) < .08 || gy - Math.floor(gy) < .08; return rampOf(TILE)[grout ? 1 : 3]; }
  if (k === 2) {
    const d = Math.hypot(x - PIT.x, (y - PIT.y) * 1.1);
    if (G.mine && d < PIT.r) return rgb(18, 14, 18);
    if (G.mine && d < PIT.r + .12) return rampOf(STONE_W)[0];
    return rampOf(STONE_W)[clamp(Math.floor(2 + noise(x * 2, y * 2) * 1.6 + (bayerAt(ix, iy) - .5) * .5), 1, 4)];
  }
  return rampOf(SOIL)[clamp(Math.floor(1.8 + noise(x * 1.5, y * 1.5) * 1.6 + (bayerAt(ix, iy) - .5) * .6), 0, 4)];
}
function wallColor(k, x, z) {
  if (k === 0) return z < .9 ? rampOf(PLANKS)[Math.floor((x + 9) * 4) % 4 === 0 ? 1 : 2] : rampOf(PLASTER)[2 + (hash(x * 20 | 0, z * 20 | 0) > .8 ? 1 : 0)];
  if (k === 1) { const gx = x * 2.2, gz = z * 2.2, grout = gx - Math.floor(gx) < .07 || gz - Math.floor(gz) < .07; return rampOf(TILE)[grout ? 1 : z > 1.6 ? 3 : 2]; }
  const vein = x > 1 && noise(x * 1.1 + 4, z * 1.6) > .55 && z > .3 && z < 1.8;
  if (vein) return rampOf(ORE)[clamp(Math.floor(2 + noise(x * 6, z * 6) * 2.4), 1, 4)];
  return rampOf(STONE_W)[clamp(Math.floor(1 + noise(x * 1.8, z * 2.2) * 2.6), 0, 3)];
}
const PIT = { x: -4.6, y: .1, r: .75 };
const UNDER_GROUND = new Uint8Array(W * H), UNDER_GZ = new Float32Array(W * H), underPix = new Uint32Array(W * H), underZ = new Float32Array(W * H);
const LAMPS = [-4.5, .5, 5.5];
// storage: a stack that grows with what you hold (one more piece per power of ten-ish)
const stockLevel = v => Math.max(0, Math.min(10, Math.floor(Math.log10(1 + v) * 2.2)));
function bakeUnder() {
  layoutFloors();
  pix.fill(PAPER); zb.fill(-1e9); ground.fill(0); shadowMask.fill(0);
  // floor surfaces, rasterized per pixel at each floor's height
  for (let k = 0; k < 3; k++) {
    const fz = FLOOR_Z[k];
    for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) {
      const g = unproject(ix + .5, iy + .5 + fz * COS * S);
      if (g.x < UG.x0 || g.x > UG.x1 || g.y < UG.y0 || g.y > UG.y1) continue;
      const i = iy * W + ix, d = (g.x + g.y) / R2 * COS + fz * SIN;
      if (d <= zb[i]) continue;
      pix[i] = floorColor(k, g.x, g.y, ix, iy); zb[i] = d; ground[i] = 1;
    }
  }
  groundZ.set(zb);
  for (let k = 0; k < 3; k++) {
    const fz = FLOOR_Z[k];
    // the earth under the floor, cut through on the front and the right
    box(UG.x0, UG.y0, fz - UG.slab, UG.x1, UG.y1, fz - .02, SOIL_D, 11 + k);
    faceY(UG.x0, UG.x1, UG.y1 + .005, fz - UG.slab, fz - .03, (a, z) => noise(a * 2, z * 3 + k) > .74 ? rampOf(STONE_W)[1] : rampOf(SOIL_D)[clamp(Math.floor(1.5 + noise(a, z * 4) * 2), 0, 3)]);
    // back and left walls, seen from inside
    box(UG.x0, UG.y0 - .35, fz, UG.x1, UG.y0, fz + UG.h, SOIL, 12);
    box(UG.x0 - .35, UG.y0 - .35, fz, UG.x0, UG.y1, fz + UG.h, SOIL, 13);
    faceY(UG.x0, UG.x1, UG.y0 + .005, fz + .02, fz + UG.h, (x, z) => wallColor(k, x, z - fz));
    faceX(UG.y0, UG.y1, UG.x0 + .005, fz + .02, fz + UG.h, (y, z) => wallColor(k, y - 3, z - fz));
    for (const x of LAMPS) { box(x - .05, UG.y0, fz + UG.h - .2, x + .05, UG.y0 + .25, fz + UG.h - .14, DARK, 1); box(x - .07, UG.y0 + .2, fz + UG.h - .32, x + .07, UG.y0 + .34, fz + UG.h - .2, [255, 236, 170], 2); }
    [buildLiving, buildFarmFloor, buildMineFloor][k](fz);
  }
  // the ladder shaft through every floor, up to the hatch
  const sx0 = SHAFT.x - .45, sx1 = SHAFT.x + .45, sy0 = UG.y0, sy1 = SHAFT.y + .45, ztop = FLOOR_Z[0] + UG.h + 1.2;
  box(sx0, sy0, FLOOR_Z[2], sx1, sy1, ztop, CONCRETE, 40);
  const dark = rampOf(DARK), steel = rampOf(METAL);
  faceY(sx0, sx1, sy1 + .005, FLOOR_Z[2], ztop, (x, z) => {
    for (const fz of FLOOR_Z) if (z > fz && z < fz + 1.75 && Math.abs(x - SHAFT.x) < .32) return dark[0];
    return 0;
  });
  for (const o of [-.2, .2]) box(SHAFT.x + o - .025, sy1 + .02, FLOOR_Z[2], SHAFT.x + o + .025, sy1 + .07, ztop + .2, METAL, 41);
  for (let z = FLOOR_Z[2] + .2; z < ztop; z += .26) box(SHAFT.x - .2, sy1 + .03, z, SHAFT.x + .2, sy1 + .07, z + .035, METAL, 42);
  box(sx0 - .1, sy0 - .1, ztop, sx1 + .1, sy1 + .1, ztop + .12, STEEL, 43);
  // light: warm pools under the lamps, darker towards the corners
  const lampPts = [], lampRX = 1 / (S * 4.2), lampRY = 1 / (S * 2.8);
  for (let k = 0; k < 3; k++) for (const x of LAMPS) { const p = project(x, UG.y0 + 1.3, FLOOR_Z[k]); lampPts.push(p.sx, p.sy); }
  for (let i = 0; i < pix.length; i++) {
    if (zb[i] < -1e8) continue;
    const ix = i % W, iy = (i / W) | 0;
    let light = 0;
    for (let n = 0; n < lampPts.length; n += 2) {
      const dx = (ix - lampPts[n]) * lampRX, dy = (iy - lampPts[n + 1]) * lampRY, q = 1 - (dx * dx + dy * dy);
      if (q > light) light = q;
    }
    light = light * light;
    const f2 = .62 + light * .5 + (G.live >= 4 ? .06 : 0), c = pix[i];
    pix[i] = rgb((c & 255) * f2 + light * 12, (c >> 8 & 255) * f2 + light * 6, (c >> 16 & 255) * f2 * .96);
  }
  bakeOcclusion();
  staticShadow.fill(0);
  applyShadows(groundZ);
  underPix.set(pix); underZ.set(zb); UNDER_GROUND.set(ground); UNDER_GZ.set(groundZ);
  stockSeen = [stockLevel(G.money), stockLevel(G.food), stockLevel(G.mineral)].join();
  underDirty = false; underBakedAt = G.time;
  if (G.view === 'under') showUnder(); else if (G.view === 'yard') showYard();
}
let stockSeen = '', underDirty = true, underBakedAt = -9;
// the yard keeps its own baked picture: anything that changes below only marks the floors as stale
function markUnder() { underDirty = true; if (G.view === 'under') bakeUnder(); }
function showUnder() { bakedPix.set(underPix); bakedZ.set(underZ); groundZ.set(UNDER_GZ); ground.set(UNDER_GROUND); staticShadow.fill(0); }
function buildLiving(fz) {
  const L = G.live, beds = bedsOf(L), y0 = UG.y0;
  if (L >= 2) for (let x = -7.4; x <= 2.6; x += STEP) for (let y = -.6; y <= .9; y += STEP) {
    const edge = x < -7.3 || x > 2.5 || y < -.5 || y > .8;
    plot(x, y, fz + .005, edge ? rgb(150, 60, 50) : (Math.floor((x + y) * 4) % 2 ? rgb(176, 84, 64) : rgb(196, 110, 76)));
  }
  for (let i = 0; i < beds; i++) {
    const x0 = BED_X(i), x1 = x0 + 1.5, by0 = y0 + .1, by1 = y0 + .85;
    box(x0, by0, fz, x1, by1, fz + .3, WOOD, 50 + i);
    box(x0 + .04, by0 + .04, fz + .3, x1 - .04, by1 - .04, fz + .4, [218, 210, 192], 55 + i);
    const c = G.crew[i] ? LOOKS[i + 1].shirt : [140, 132, 120];
    box(x0 + .45, by0 + .02, fz + .4, x1 - .02, by1 - .02, fz + .46, c, 60 + i);
    box(x0 + .08, by0 + .14, fz + .4, x0 + .38, by1 - .14, fz + .5, [240, 236, 226], 65 + i);
    box(x0 - .06, by0, fz, x0, by1, fz + .65, WOOD, 70 + i);
    shadowBox(x0, by0, x1, by1, .35, .3);
  }
  if (L >= 6) { box(4.2, -.2, fz + .6, 5.4, .6, fz + .68, PLANK, 80); for (const [x, y] of [[4.25, -.15], [5.35, -.15], [4.25, .55], [5.35, .55]]) box(x - .03, y - .03, fz, x + .03, y + .03, fz + .6, WOOD, 81); for (const x of [4.4, 5.2]) box(x - .14, .75, fz, x + .14, 1.0, fz + .35, WOOD, 82); }
  if (L >= 7) { box(4.4, 0, fz + .68, 4.75, .2, fz + .86, [80, 84, 70], 83); plot(4.76, .1, fz + .8, rgb(120, 230, 120)); }
  if (L >= 9) { box(6.0, y0 + .1, fz, 6.6, y0 + .7, fz + .75, [70, 74, 80], 84); box(6.1, y0 + .25, fz + .75, 6.4, y0 + .5, fz + .9, METAL, 85); }
  if (L >= 10) { box(6.8, y0 + .1, fz, 7.5, y0 + .7, fz + 1.65, [226, 228, 230], 86); faceY(6.8, 7.5, y0 + .705, fz + 1.0, fz + 1.02, () => rgb(150, 150, 156)); }
  if (L >= 11) { box(7.8, y0 + .05, fz, 8.7, y0 + .4, fz + 1.5, WOOD, 87); faceY(7.85, 8.65, y0 + .405, fz + .1, fz + 1.45, (a, z) => Math.floor((z - fz) * 4) % 2 ? 0 : rgb(...[[180, 60, 50], [60, 100, 160], [200, 170, 70]][Math.floor(a * 7) % 3])); }
  if (L >= 13) for (const x of [3.7, 8.9 - .3]) { box(x - .12, .9, fz, x + .12, 1.14, fz + .25, [176, 92, 62], 88); box(x - .16, .86, fz + .25, x + .16, 1.18, fz + .55, [90, 150, 70], 89); }
  if (L >= 14) { box(4.3, y0 + .02, fz + .9, 5.2, y0 + .1, fz + 1.45, [40, 40, 46], 90); faceY(4.35, 5.15, y0 + .105, fz + .95, fz + 1.4, () => rgb(90, 140, 210)); }
  if (L >= 15) { box(4.1, 1.2, fz, 5.5, 1.7, fz + .3, [120, 70, 60], 91); box(4.1, 1.55, fz + .3, 5.5, 1.7, fz + .6, [120, 70, 60], 92); }
  // the safe: coin crates stack up as the money grows
  const n = stockLevel(G.money);
  for (let k = 0; k < n; k++) { const x = 8.4 - (k % 3) * .38, y = 1.5 - Math.floor(k / 6) * .38, z = fz + (Math.floor(k / 3) % 2) * .3; box(x - .16, y - .16, z, x + .16, y + .16, z + .3, [214, 170, 60], 93 + k); plot(x, y, z + .31, rgb(255, 236, 120)); }
}
function buildFarmFloor(fz) {
  const L = G.farm, y0 = UG.y0, t = facTier(L);
  if (!L) { rubbleAt(fz); return; }
  if (t === 0) {
    const beds = Math.min(5, L + 1);
    for (let r = 0; r < beds; r++) {
      const x0 = -7.2 + r * 2.1, x1 = x0 + 1.5, by0 = y0 + .3, by1 = UG.y1 - .9;
      box(x0, by0, fz, x1, by1, fz + .2, PLANKS, 30 + r);
      for (let x = x0 + .05; x <= x1 - .05; x += STEP) for (let y = by0 + .05; y <= by1 - .05; y += STEP) plot(x, y, fz + .21, rampOf(SOIL_D)[2]);
      for (let x = x0 + .2; x < x1; x += .3) for (let y = by0 + .25; y < by1; y += .45) { line3([x, y, fz + .21], [x, y, fz + .42], rgb(96, 150, 70)); plot(x + .05, y, fz + .44, rgb(130, 190, 90)); }
    }
  } else if (t === 1) {
    const racks = Math.min(8, 2 * (L - 3) + 1);
    for (let r = 0; r < racks; r++) {
      const x0 = -7.6 + r * 1.65, x1 = x0 + 1.2, ry0 = y0 + .1, ry1 = y0 + .65;
      for (const [x, y] of [[x0, ry0], [x1, ry0], [x0, ry1], [x1, ry1]]) box(x - .03, y - .03, fz, x + .03, y + .03, fz + 2, METAL, 30);
      for (const z of [.35, .95, 1.55]) {
        box(x0, ry0, fz + z, x1, ry1, fz + z + .05, METAL, 31);
        for (let x = x0 + .1; x < x1; x += .2) { box(x - .06, (ry0 + ry1) / 2 - .06, fz + z + .05, x + .06, (ry0 + ry1) / 2 + .06, fz + z + .22, [96, 150, 70], 32); }
        for (let x = x0; x <= x1; x += STEP) plot(x, ry1 - .05, fz + z + .55, rgb(236, 120, 220));
      }
    }
  } else {
    // hydroponic tanks; from level 15 on, the automated room adds lights, pipes and a robot arm rail
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const ty0 = y0 + .2 + r * 1.0, ty1 = ty0 + .62, tx1 = Math.min(7.6, -7.6 + (L - 7) * 1.6 + 4.5);
      box(-7.6, ty0, fz, tx1, ty1, fz + .55, [184, 190, 194], 40 + r);
      for (let x = -7.55; x <= tx1 - .05; x += STEP) for (let y = ty0 + .05; y <= ty1 - .05; y += STEP) plot(x, y, fz + .56, rgb(86, 150, 200));
      for (let x = -7.4; x < tx1; x += .28) { box(x - .07, (ty0 + ty1) / 2 - .07, fz + .56, x + .07, (ty0 + ty1) / 2 + .07, fz + .78, [96, 150, 70], 44); if (hash(x * 9 | 0, r) > .6) plot(x, (ty0 + ty1) / 2, fz + .82, rgb(226, 96, 70)); }
    }
    for (const z of [1.7, 1.9]) box(-7.9, y0 + .02, fz + z, 8.6, y0 + .1, fz + z + .07, [120, 150, 180], 45);
    if (t === 3) {
      for (let x = -7.8; x < 8; x += STEP) plot(x, y0 + .45, fz + 2.4, rgb(130, 255, 160));
      box(-7.8, 1.4, fz + 2.2, 8, 1.5, fz + 2.28, METAL, 46);
      const ax = -2 + (L % 5);
      box(ax - .1, 1.35, fz + 1.6, ax + .1, 1.55, fz + 2.2, DARK, 47); box(ax - .25, 1.3, fz + 1.5, ax + .25, 1.6, fz + 1.6, [236, 190, 60], 48);
    }
  }
  if (L >= 2) box(7.6, UG.y1 - 1.0, fz, 8.3, UG.y1 - .3, fz + .65, [92, 112, 150], 49);
  if (L >= 5) for (const x of [-7.6, 1, 6]) { box(x - .2, y0 + .05, fz + 1.6, x + .2, y0 + .15, fz + 2.0, METAL, 50); plot(x, y0 + .16, fz + 1.8, rgb(60, 60, 64)); }
  if (L >= 6) for (let k = 0; k < 3; k++) box(6.2 + k * .38, UG.y1 - .55, fz, 6.52 + k * .38, UG.y1 - .2, fz + .34, [214, 198, 156], 51 + k);
  // the pantry: food crates by the stair
  const n = stockLevel(G.food);
  for (let k = 0; k < n; k++) { const x = 8.5 - (k % 2) * .4, y = -1.5 + Math.floor(k / 2) % 3 * .4, z = fz + Math.floor(k / 6) * .32; box(x - .17, y - .17, z, x + .17, y + .17, z + .32, k % 2 ? PLANK : [180, 90, 60], 60 + k); }
}
function buildMineFloor(fz) {
  const L = G.mine, y0 = UG.y0, t = facTier(L), { x, y } = PIT, dark = rampOf(DARK);
  if (!L) { rubbleAt(fz); return; }
  if (t === 0) {
    for (const [dx, dy] of [[-.5, -.45], [.5, -.45], [0, .55]]) line3([x + dx, y + dy, fz], [x, y, fz + 1.4], rampOf(WOOD)[2]);
    box(x - .3, y - .03, fz + 1.28, x + .3, y + .03, fz + 1.34, WOOD, 60);
  } else {
    const top = fz + (t === 1 ? 2.1 : 2.2), legs = [[-.7, -.6], [.7, -.6], [-.7, .6], [.7, .6]];
    for (const [dx, dy] of legs) line3([x + dx, y + dy, fz], [x + dx * .2, y + dy * .2, top], steelLine);
    for (const z of [.6, 1.2, 1.7]) { const w = .7 - (z / 2.1) * .55; line3([x - w, y + w * .85, fz + z], [x + w, y + w * .85, fz + z], steelLine); line3([x + w, y - w * .85, fz + z], [x + w, y + w * .85, fz + z], steelLine); }
    box(x - .2, y - .2, top - .05, x + .2, y + .2, top + .1, METAL, 60);
    box(x + .9, y - 1.2, fz, x + 1.6, y - .5, fz + .7, [176, 128, 56], 61);
    for (let a = x + .95; a < x + 1.55; a += STEP) for (let z = .2; z < .5; z += STEP) if (Math.floor(a * 20) % 2) plot(a, y - .49, fz + z, dark[1]);
    if (t >= 2) { box(x - 1.5, y + .7, fz, x - .8, y + 1.2, fz + .8, [176, 128, 56], 62); for (let a = x + 1.7; a < 6.2; a += STEP) { plot(a, y - .2, fz + .55, rampOf(DARK)[1]); plot(a, y - .3, fz + .55, rampOf(DARK)[2]); } box(6.2, y - .5, fz, 6.9, y + .2, fz + .7, [120, 116, 110], 63); }
    if (t === 3) { box(-1.6, y0 + .1, fz, -.6, y0 + .8, fz + 1.4, [96, 104, 112], 64); faceY(-1.55, -.65, y0 + .805, fz + .6, fz + 1.2, (a, z) => Math.floor(a * 12 + z * 8) % 3 ? rgb(70, 200, 120) : rgb(40, 44, 50)); }
  }
  if (L >= 2) for (const bx of [-1.2, 2.2, 5.6, 8.2]) { box(bx - .07, y0 + .02, fz, bx + .07, y0 + .16, fz + UG.h, WOOD, 65); box(bx - .07, y0 + .02, fz + UG.h - .14, bx + .07, UG.y1 - .2, fz + UG.h, WOOD, 66); }
  if (L >= 3) { for (let a = UG.x0 + 1.2; a <= UG.x1; a += STEP) for (const ry of [1.3, 1.7]) plot(a, ry, fz + .02, rampOf(METAL)[3]); for (let a = UG.x0 + 1.3; a <= UG.x1; a += .3) box(a - .04, 1.2, fz, a + .04, 1.8, fz + .03, WOOD, 67); }
  if (L >= 4) cart(7.2, fz, Math.min(10, L));
  if (L >= 7) cart(3.6, fz, Math.min(8, L - 3));
  if (L >= 6) for (const lx of [1.5, 4.8, 7.6]) { box(lx - .04, y0, fz + 1.4, lx + .04, y0 + .25, fz + 1.48, DARK, 68); plot(lx, y0 + .27, fz + 1.4, rgb(255, 236, 170)); }
  // the ore store: crates of blue ore by the stair
  const n = stockLevel(G.mineral);
  for (let k = 0; k < n; k++) { const bx = -7.2 + (k % 3) * .38, by = 1.4 - Math.floor(k / 3) % 2 * .38, bz = fz + Math.floor(k / 6) * .3; box(bx - .16, by - .16, bz, bx + .16, by + .16, bz + .3, [96, 90, 84], 70 + k); plot(bx, by, bz + .31, rgb(130, 190, 250)); }
}
const steelLine = rgb(150, 158, 166);
function cart(cx, fz, ore) {
  box(cx - .45, 1.25, fz + .1, cx + .45, 1.75, fz + .5, [108, 96, 86], 80);
  for (let k = 0; k < ore; k++) box(cx - .35 + (k % 4) * .2, 1.3 + Math.floor(k / 4) % 2 * .18, fz + .5, cx - .25 + (k % 4) * .2, 1.42 + Math.floor(k / 4) % 2 * .18, fz + .62, hash(k, 4) > .4 ? ORE : STONE_W, 81 + k);
}
function rubbleAt(fz) {
  // a floor not dug out yet: heaps of earth and a shovel
  for (let k = 0; k < 18; k++) {
    const x = lerp(-7, 7.5, hash(k, fz)), y = lerp(UG.y0 + .3, UG.y1 - .5, hash(fz + 5, k)), r = .25 + hash(k, 7) * .3;
    box(x - r, y - r * .8, fz, x + r, y + r * .8, fz + r * .8, k % 4 ? SOIL : SOIL_D, k);
  }
  box(.3, -.3, fz + .2, .36, -.24, fz + 1.3, WOOD, 5); box(.2, -.32, fz + .05, .44, -.22, fz + .3, METAL, 6);
}

/* ================= particles and floating numbers ================= */
let partsInto = 'parts', partFloor = 0;
function part(x, y, z, vx, vy, vz, life, color, under, w = 1, h = 1) {
  const list = G[partsInto];
  list.push({ x, y, z, vx, vy, vz, life, color, under, w, h, fz: partsInto === 'uparts' ? partFloor : null });
  if (list.length > 300) list.shift();
}
function inDugout(fz, fn) { partsInto = 'uparts'; partFloor = fz; fn(); partsInto = 'parts'; }
function spray(x, y, z, n, speed, up, life, colors, w = 1, h = 1) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 6.28, v = speed * (.4 + Math.random() * .6);
    part(x, y, z, Math.cos(a) * v, Math.sin(a) * v, up * (.5 + Math.random() * .7), life * (.7 + Math.random() * .5), colors[k % colors.length], null, w, h);
  }
}
const floorAt = (x, y) => { const F = form(); const h = formOf(G.bunker) ? F.half : .55; return Math.abs(x) < h && Math.abs(y) < h ? F.roof : 0; };
function updateParts(dt) {
  for (const list of [G.parts, G.uparts]) for (const q of list) {
    q.vz -= 13 * dt;
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    const floor = q.fz != null ? q.fz : floorAt(q.x, q.y);
    if (q.z < floor && q.z > floor - .5) { q.z = floor; q.vz = Math.abs(q.vz) > 1 ? -q.vz * .35 : 0; q.vx *= .5; q.vy *= .5; }
    q.life -= dt;
  }
  G.parts = G.parts.filter(q => q.life > 0 && q.z > -1.5);
  G.uparts = G.uparts.filter(q => q.life > 0);
  for (const f of G.floats) { f.z += dt * .9; f.life -= dt; }
  G.floats = G.floats.filter(f => f.life > 0);
}
function drawParts(list) {
  for (const q of list) {
    const p = project(q.x, q.y, q.z), x0 = Math.round(p.sx), y0 = Math.round(p.sy), u = q.under ? 1 : 0;
    for (let dy = 0; dy < q.h + u; dy++) for (let dx = 0; dx < q.w; dx++) {
      const ix = x0 + dx, iy = y0 + dy;
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
      const i = iy * W + ix;
      if (p.d < zb[i] - .35) continue;
      pix[i] = dy >= q.h ? q.under : q.color;
    }
  }
}
function float(x, y, z, text, color) { G.floats.push({ x, y, z, text, color, life: .9 }); }
const GLYPHS = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
  '$': ['011', '110', '010', '011', '110'], '.': ['000', '000', '000', '000', '010'], K: ['101', '101', '110', '101', '101'],
  M: ['101', '111', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], T: ['111', '010', '010', '010', '010'],
  z: ['000', '111', '001', '010', '111'], Z: ['111', '001', '010', '100', '111'], a: ['000', '011', '101', '101', '011'], b: ['100', '110', '101', '101', '110'], c: ['000', '011', '100', '100', '011'],
};
function pixelText(text, cx, top, color) {
  const glyphs = [...text].map(ch => GLYPHS[ch]).filter(Boolean), width = glyphs.length * 4 - 1;
  const x0 = Math.round(cx - width / 2), y0 = Math.round(top), cells = [];
  glyphs.forEach((g, n) => g.forEach((row, y) => [...row].forEach((on, x) => { if (on === '1') cells.push([x0 + n * 4 + x, y0 + y]); })));
  for (const [x, y] of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ix = x + dx, iy = y + dy;
    if (ix >= 0 && iy >= 0 && ix < W && iy < H) pix[iy * W + ix] = INK;
  }
  for (const [x, y] of cells) if (x >= 0 && y >= 0 && x < W && y < H) pix[y * W + x] = color;
}

/* ================= people: the hero on the roof and up to five hired hands ================= */
const HATCH_TOP = () => FLOOR_Z[0] + UG.h + 1.2;
function makePerson(i) {
  return { i, name: NAMES[i], look: LOOKS[i + 1], job: '사수', fatigue: 10 + Math.random() * 20, state: 'toWork', where: 'ug', floor: 0,
    x: BED_X(i) + .75, y: UG.y0 + 1.05, z: FLOOR_Z[0], path: [], yaw: -Math.PI / 2, walk: 0, act: Math.random() * 3,
    ammo: gunStat('mag'), reload: 0, reloadLen: 1, cool: 0, recoil: 0, flash: 0, target: null, retarget: 0, magOut: false, magIn: false, pal: null };
}
function makeHero() {
  return { hero: true, i: -1, name: '나', look: LOOKS[0], job: '사수', fatigue: 0, state: 'work', where: 'yard', floor: -1, x: 0, y: 0, z: STAGE_Z(), path: [], yaw: Math.PI / 4,
    walk: 0, act: 0, ammo: gunStat('mag'), reload: 0, reloadLen: 1, cool: 0, recoil: 0, flash: 0, target: null, retarget: 0, magOut: false, magIn: false, pal: null };
}
const STAGE_Z = () => form().roof;
const gunners = () => G.crew.filter(c => c && c.job === '사수');
function gunnerIndex(c) { if (c.hero) return 0; return 1 + gunners().indexOf(c); }
function jobIndex(c) { return G.crew.filter(p => p && p.job === c.job).indexOf(c); }
function workSpot(c) {
  if (c.job === '사수') { const s = SITES[Math.min(SITES.length - 1, gunnerIndex(c))] || [0, 0, STAGE_Z()]; return { where: 'yard', x: s[0], y: s[1], z: s[2] }; }
  const n = Math.max(0, jobIndex(c));
  if (c.job === '농부') return { where: 'ug', floor: 1, x: -6.4 + n * 2.1, y: UG.y1 - .5, z: FLOOR_Z[1] };
  return { where: 'ug', floor: 2, x: 2.9 + n * .95, y: UG.y0 + .72, z: FLOOR_Z[2] };
}
const bedSpot = c => ({ where: 'ug', floor: 0, x: BED_X(c.i) + .75, y: UG.y0 + 1.05, z: FLOOR_Z[0] });
// a path is a list of steps: walk on a floor (or the roof), climb the shaft, or pass through the roof hatch
function route(c, dest) {
  const pts = [], shaftAt = k => ({ where: 'ug', floor: k, x: SHAFT.x, y: LADDER_Y, z: FLOOR_Z[k], mode: 'walk' });
  if (c.where === 'yard' && dest.where === 'yard') pts.push({ ...dest, mode: 'walk' });
  else if (c.where === 'yard') {
    const h = SITES.hatch;
    pts.push({ where: 'yard', x: h[0], y: h[1], z: h[2], mode: 'walk' }, { mode: 'hatch', to: 'ug' }, { where: 'ug', floor: dest.floor, x: SHAFT.x, y: LADDER_Y, z: FLOOR_Z[dest.floor], mode: 'climb' }, { ...dest, mode: 'walk' });
  } else if (dest.where === 'yard') {
    pts.push(shaftAt(c.floor), { where: 'ug', floor: 0, x: SHAFT.x, y: LADDER_Y, z: HATCH_TOP(), mode: 'climb' }, { mode: 'hatch', to: 'yard' }, { ...dest, mode: 'walk' });
  } else if (c.floor !== dest.floor) {
    pts.push(shaftAt(c.floor), { ...shaftAt(dest.floor), mode: 'climb' }, { ...dest, mode: 'walk' });
  } else pts.push({ ...dest, mode: 'walk' });
  return pts;
}
function sendTo(c, dest, state) { c.path = route(c, dest); c.state = state; }
function stepPerson(c, dt) {
  const wp = c.path[0];
  if (!wp) return true;
  if (wp.mode === 'hatch') {
    c.where = wp.to;
    if (wp.to === 'ug') { c.x = SHAFT.x; c.y = LADDER_Y; c.z = HATCH_TOP(); c.floor = 0; }
    else { const h = SITES.hatch; c.x = h[0]; c.y = h[1]; c.z = h[2]; c.floor = -1; }
    c.path.shift();
    return false;
  }
  if (wp.mode === 'climb') {
    const dz = wp.z - c.z, step = .9 * dt;
    c.x = SHAFT.x; c.y = LADDER_Y; c.yaw = -Math.PI / 2; c.anim = 'climb';
    if (Math.abs(dz) <= step) { c.z = wp.z; c.floor = wp.floor; c.path.shift(); }
    else { c.z += Math.sign(dz) * step; c.walk += step; }
    return false;
  }
  const dx = wp.x - c.x, dy = wp.y - c.y, d = Math.hypot(dx, dy), step = 1.05 * dt;
  c.z = wp.z; c.anim = 'walk';
  if (d <= step) { c.x = wp.x; c.y = wp.y; c.path.shift(); if (wp.floor != null) c.floor = wp.floor; }
  else { c.x += dx / d * step; c.y += dy / d * step; c.yaw = Math.atan2(dy, dx); c.walk += step; }
  return false;
}
function updatePeople(dt) {
  const rest = FATIGUE_REST * (1 + .05 * G.live);
  for (const c of G.crew) {
    if (!c) continue;
    const arrived = stepPerson(c, dt);
    if (!arrived) continue;
    if (c.state === 'toWork') { c.state = 'work'; if (c.job !== '사수') c.yaw = -Math.PI / 2; }
    else if (c.state === 'toBed') c.state = 'sleep';
    if (c.state === 'work') {
      c.fatigue += FATIGUE_WORK * (G.hungry ? 2 : 1) * dt;
      c.act += dt;
      if (c.fatigue >= 100) { sendTo(c, bedSpot(c), 'toBed'); if (G.view === 'under' || c.job === '사수') say(c.name + ' 피곤해서 자러 간다'); }
    } else if (c.state === 'sleep') {
      c.fatigue -= rest * dt;
      if (c.fatigue <= 0) { c.fatigue = 0; sendTo(c, workSpot(c), 'toWork'); }
    }
  }
}
// who is actually at their post right now
const atWork = c => c && c.state === 'work' && !c.path.length;
const activeOn = job => G.crew.filter(c => c && c.job === job && atWork(c)).length;
function rateOf(res) {
  const L = res === 'food' ? G.farm : G.mine, base = (res === 'food' ? FARM : MINE).rate(L), n = activeOn(res === 'food' ? '농부' : '광부');
  if (G.hungry) return base;
  return base * (1 + n) + n * .2;
}
function resyncPosts() {
  // new bunker or a changed job: everyone working heads to the right post
  if (G.hero) { const s = SITES[0]; G.hero.x = s[0]; G.hero.y = s[1]; G.hero.z = s[2]; }
  for (const c of G.crew) if (c && (c.state === 'work' || c.state === 'toWork')) {
    if (c.where === 'yard' && c.job === '사수') { const w = workSpot(c); c.x = w.x; c.y = w.y; c.z = w.z; c.path = []; c.state = 'work'; }
    else sendTo(c, workSpot(c), 'toWork');
  }
}

/* ================= shooting: targets are shared out, nobody wastes a turn on a zombie already being killed ================= */
const damageOf = () => gunStat('atk');
const rateOfFire = () => gunStat('spd');
function startReload(s) { s.reloadLen = reloadTime(); s.reload = s.reloadLen; s.magOut = false; s.magIn = false; }
const shooters = () => [G.hero, ...G.crew.filter(c => c && c.job === '사수' && atWork(c) && c.where === 'yard')].filter(Boolean);
// the damage a shooter will land on its target in the next second or so
const commitOf = s => s.reload > 0 ? 0 : Math.min(s.ammo, Math.ceil(rateOfFire() * 1.1)) * damageOf();
function threat(z) { return z.n - (z.state === 'attack' ? 2.5 : 0) - (z.type === 'bloater' ? 1.5 : 0) - (z.type === 'brute' ? .8 : 0); }
function assignTargets(dt) {
  const list = shooters();
  for (const z of G.zombies) z.incoming = 0;
  for (const s of list) if (s.target && s.target.state !== 'dying' && !s.target.gone) s.target.incoming += commitOf(s);
  for (const s of list) {
    s.retarget -= dt;
    const t = s.target, alive = t && t.state !== 'dying' && !t.gone && t.visible;
    const overkill = alive && t.incoming - commitOf(s) >= t.hp;
    if (alive && !overkill && s.retarget > 0) continue;
    if (alive) t.incoming -= commitOf(s);
    let best = null, bestScore = Infinity, fallback = null, fallbackScore = Infinity;
    for (const z of G.zombies) {
      if (z.state === 'dying' || z.gone || !z.visible) continue;
      const ang = Math.atan2(z.y - s.y, z.x - s.x), turn = Math.abs(Math.atan2(Math.sin(ang - s.yaw), Math.cos(ang - s.yaw)));
      const score = threat(z) + turn * .6;
      if (score < fallbackScore) { fallback = z; fallbackScore = score; }
      if (z.incoming >= z.hp) continue;
      if (score < bestScore) { best = z; bestScore = score; }
    }
    s.target = best || fallback;
    s.retarget = .35;
    if (s.target) s.target.incoming += commitOf(s);
  }
}
function fire(s, z) {
  if (s.reload > 0 || s.ammo <= 0) return false;
  s.ammo--; s.recoil = .12; s.flash = .06;
  const fx = Math.cos(s.yaw), fy = Math.sin(s.yaw);
  part(s.x + fx * .3, s.y + fy * .3, s.z + 1.2, -fy * 1.4 + (Math.random() - .5) * .5, fx * 1.4 + (Math.random() - .5) * .5, 2.2 + Math.random(), 1.4, rgb(232, 184, 74), rgb(150, 104, 40));
  const c = project(z.x, z.y, .8);
  G.tracers.push({ ax: s.muzzle ? s.muzzle[0] : project(s.x, s.y, s.z + 1.3).sx, ay: s.muzzle ? s.muzzle[1] : project(s.x, s.y, s.z + 1.3).sy, bx: c.sx, by: c.sy, life: .06 });
  sound('shot');
  hurt(z, damageOf());
  if (s.ammo === 0) startReload(s);
  return true;
}
function updateShooter(s, dt) {
  s.recoil = Math.max(0, s.recoil - dt * .8); s.flash = Math.max(0, s.flash - dt);
  if (s.reload > 0) {
    s.reload -= dt;
    const t = 1 - s.reload / s.reloadLen;
    if (!s.magOut && t > .3) { s.magOut = true; part(s.x, s.y, s.z + 1, 0, 0, .4, 2, rgb(52, 50, 58), rgb(30, 28, 34), 2, 2); if (s.hero) sound('magout'); }
    if (!s.magIn && t > .7) { s.magIn = true; if (s.hero) sound('magin'); }
    if (s.reload <= 0) { s.reload = 0; s.ammo = gunStat('mag'); if (s.hero) sound('rack'); }
    return;
  }
  if (!s.hero && G.hungry) return;
  const z = s.target;
  s.cool -= dt;
  if (!z || z.state === 'dying' || z.gone) { if (s.ammo < gunStat('mag') * .5) startReload(s); s.cool = Math.max(0, s.cool); return; }
  const want = Math.atan2(z.y - s.y, z.x - s.x);
  let d = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
  s.yaw += clamp(d, -8 * dt, 8 * dt);
  d = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
  if (s.cool <= 0 && Math.abs(d) < .2 && fire(s, z)) s.cool = 1 / rateOfFire();
  if (s.cool < 0) s.cool = 0;
}

/* ================= zombies ================= */
function pickType(w) {
  const pool = Object.entries(ZTYPES).filter(([, t]) => w >= t.from), r = Math.random();
  // the newest kinds are rarer; walkers stay the bulk
  const weights = pool.map(([k, t]) => k === 'walker' ? 6 : Math.max(.6, 3.2 - (t.from - 1) * .12 + (w - t.from) * .06));
  let sum = weights.reduce((a, b) => a + b, 0), x = r * sum;
  for (let n = 0; n < pool.length; n++) { x -= weights[n]; if (x <= 0) return pool[n][0]; }
  return 'walker';
}
function spawn() {
  const side = Math.floor(Math.random() * 4), s = (Math.random() * 2 - 1) * (FIELD - .8), r = FIELD + .9 + Math.random() * .4;
  const [x, y] = [[r, s], [s, r], [-r, s], [s, -r]][side];
  const w = G.wave, type = pickType(w), T = ZTYPES[type], hp = zombieHp(w) * T.hp;
  G.zombies.push({ x, y, n: Math.max(Math.abs(x), Math.abs(y)), yaw: Math.atan2(-y, -x), hp, max: hp, type, speed: T.speed * (.9 + Math.random() * .2),
    hitPower: zombieHit(w) * T.hit, reward: zombieReward(w) * T.reward, state: 'walk', t: 0, atk: 0, swings: 0, hit: 0, walkDist: Math.random(), swerve: (Math.random() - .5) * .5,
    incoming: 0, visible: false, sx: 0, sy: 0 });
}
const fenceUp = () => G.fence > 0 && !G.fenceDown;
const sideOf = (x, y) => Math.abs(x) >= Math.abs(y) ? (x > 0 ? 1 : 3) : (y > 0 ? 0 : 2);
const bunkerReach = () => (formOf(G.bunker) ? form().half : 1.2) + .55;
function updateZombies(dt) {
  for (const z of G.zombies) {
    z.hit = Math.max(0, z.hit - dt);
    z.t += dt;
    if (z.state === 'dying') { if (z.t > 4.4) z.gone = true; continue; }
    z.visible = z.n < FIELD - .15;
    const atFence = fenceUp() && z.n >= FENCE_R - .2, stopAt = atFence ? FENCE_R + .45 : bunkerReach();
    if (z.n > stopAt) {
      const ang = Math.atan2(-z.y, -z.x) + z.swerve * clamp((z.n - FENCE_R) / 4, 0, 1), pace = z.speed * (z.n > FIELD - .3 ? 1.6 : 1) * dt;
      z.x += Math.cos(ang) * pace; z.y += Math.sin(ang) * pace;
      z.n = Math.max(Math.abs(z.x), Math.abs(z.y));
      z.walkDist += pace; z.yaw = ang; z.state = 'walk';
    } else {
      if (z.state !== 'attack') { z.state = 'attack'; z.atk = 0; z.yaw = Math.atan2(-z.y, -z.x); }
      z.atk += dt;
      if (z.type === 'bloater') { if (z.atk >= 1.1) burst(z, atFence); continue; }
      const every = ZTYPES[z.type].every;
      if (z.atk - dt < every * .55 && z.atk >= every * .55) strike(z, atFence);
      if (z.atk >= every) { z.atk -= every; z.swings++; }
    }
  }
  G.zombies = G.zombies.filter(z => !z.gone);
}
const fenceMat = () => rampOf([WOOD, PLANK, DARK, STEEL, CONCRETE, STEEL][formOf(G.fence)]);
function strike(z, atFence) {
  const amount = z.hitPower;
  if (atFence) {
    const side = sideOf(z.x, z.y), R = FENCE_R, hx = side === 1 ? R : side === 3 ? -R : z.x, hy = side === 0 ? R : side === 2 ? -R : z.y;
    const mat = fenceMat(), ox = side === 1 ? -1 : side === 3 ? 1 : 0, oy = side === 0 ? -1 : side === 2 ? 1 : 0;
    for (let k = 0; k < (z.type === 'brute' ? 10 : 5); k++) part(hx, hy, .3 + Math.random() * .3, ox * (1 + Math.random() * 2) + (Math.random() - .5) * 2, oy * (1 + Math.random() * 2) + (Math.random() - .5) * 2, 2 + Math.random() * 3, .9, mat[2 + (k % 2)], mat[0], k % 3 ? 1 : 2, 1);
    G.sideDmg[side] += amount;
    sound(formOf(G.fence) >= 2 ? 'clang' : 'thud');
    // the electric fence bites back
    if (formOf(G.fence) === 5) { hurt(z, zombieHp(G.wave) * .12, true); spray(hx, hy, .4, 6, 1.6, 2, .3, [rgb(140, 210, 255), rgb(255, 255, 255)]); }
    G.fenceHp -= amount;
    if (G.fenceHp <= 0) breakFence(); else fenceStages();
  } else {
    const dust = rampOf(formOf(G.bunker) >= 3 ? CONCRETE : formOf(G.bunker) === 2 ? CONT : formOf(G.bunker) === 1 ? WOOD : BAG);
    spray(z.x * .85, z.y * .85, .6, z.type === 'brute' ? 10 : 5, 1.4, 2.5, .7, [dust[3], dust[4], dust[2]]);
    G.hp -= amount; G.hurt = z.type === 'brute' ? .45 : .3;
    sound('thud');
  }
}
function splatter(z) {
  spray(z.x, z.y, .6, 36, 3.2, 4, 1.1, [rgb(176, 196, 90), rgb(120, 150, 60), rgb(210, 220, 130)], 2, 2);
  const pts = [];
  for (let k = 0; k < 120; k++) {
    const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 1.1, p = project(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 0);
    const ix = p.sx | 0, iy = p.sy | 0; if (ix >= 0 && iy >= 0 && ix < W && iy < H) pts.push(iy * W + ix);
  }
  G.decals.push({ pts, color: rgb(150, 170, 70), life: 14 });
  sound('crash');
}
function burst(z, atFence) {
  splatter(z); z.gone = true;
  const amount = zombieHit(G.wave) * 12;
  if (atFence) { G.sideDmg[sideOf(z.x, z.y)] += amount; G.fenceHp -= amount; if (G.fenceHp <= 0) breakFence(); else fenceStages(); }
  else { G.hp -= amount; G.hurt = .5; }
  say('부푼 놈이 터졌다!', true);
}
function breakFence() {
  G.fenceHp = 0; G.fenceDown = true;
  const mat = fenceMat();
  for (let k = 0; k < 80; k++) { const [x, y] = SIDE_AT(k % 4, (Math.random() * 2 - 1) * FENCE_R); part(x, y, .3 + Math.random() * .5, (Math.random() - .5) * 3, (Math.random() - .5) * 3, 2 + Math.random() * 4, 1.6 + Math.random(), mat[1 + (k % 3)], mat[0], 2, 1); }
  G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0];
  bakeYard(); say('울타리가 무너졌다!', true); sound('crash');
}
let yardDirty = false, yardBakedAt = -9;
function fenceStages() {
  const max = fenceHp(G.fence) || 1;
  for (let k = 0; k < 4; k++) {
    const raw = G.sideDmg[k] / (max * .2), cur = G.sideStage[k];
    const st = raw >= cur + 1 ? clamp(Math.floor(raw), 0, 3) : raw < cur - .5 ? clamp(Math.floor(raw + .5), 0, 3) : cur;
    if (st !== cur) { G.sideStage[k] = st; yardDirty = true; }
  }
}
function hurt(z, dmg, quiet) {
  if (z.state === 'dying') return;
  z.hp -= dmg; z.hit = .07;
  const d = Math.hypot(z.x, z.y) || 1;
  if (z.type !== 'brute') { z.x += z.x / d * .04; z.y += z.y / d * .04; }
  if (!quiet) { const j = Math.random() - .5; float(z.x + j * .7, z.y - j * .7, 1.8 + Math.random() * .3, fmt(Math.round(dmg)), rgb(255, 255, 255)); } // spread so rapid hits stay readable
  spray(z.x, z.y, .9, 3, 1.2, 1.5, .4, [rgb(110, 40, 40), rgb(80, 120, 60)]);
  if (z.hp <= 0) kill(z);
}
function kill(z) {
  z.state = 'dying'; z.t = 0;
  if (z.type === 'bloater') { splatter(z); z.gone = true; }
  G.money += z.reward; G.totalKills++;
  float(z.x, z.y, 2.85, '+$' + fmt(z.reward), SIGNAL); // high enough not to overlap the damage number
  sound('kill');
  for (let k = 0; k < (z.type === 'brute' ? 8 : 3); k++) part(z.x, z.y, 1, (Math.random() - .5) * 2, (Math.random() - .5) * 2, 3 + Math.random() * 2, .8, rgb(255, 214, 10), rgb(186, 132, 20), 2, 1);
  const pts = [];
  for (let k = 0; k < (z.type === 'brute' ? 50 : 26); k++) {
    const a = Math.random() * 6.28, dd = Math.sqrt(Math.random()) * .45, p = project(z.x - Math.cos(z.yaw) * .5 + Math.cos(a) * dd, z.y - Math.sin(z.yaw) * .5 + Math.sin(a) * dd, 0);
    const ix = p.sx | 0, iy = p.sy | 0; if (ix >= 0 && iy >= 0 && ix < W && iy < H) pts.push(iy * W + ix);
  }
  G.decals.push({ pts, color: Math.random() < .5 ? rgb(70, 92, 50) : rgb(100, 44, 42), life: 12 });
  if (G.decals.length > 40) G.decals.shift();
  if (++G.waveKills >= killsNeeded(G.wave)) {
    G.wave++; G.waveKills = 0;
    const banner = document.getElementById('banner');
    banner.textContent = '웨이브 ' + G.wave; banner.classList.remove('on'); void banner.offsetWidth; banner.classList.add('on');
    const fresh = Object.values(ZTYPES).find(t => t.from === G.wave);
    say(fresh ? '새 변종 등장: ' + fresh.name : '웨이브 ' + G.wave + ' · 좀비 체력 ' + fmt(zombieHp(G.wave)), !!fresh);
  }
}
function fall() {
  const back = Math.max(1, G.wave - 2);
  say('벙커가 뚫렸다… 웨이브 ' + G.wave + ' → ' + back, true);
  sound('crash');
  G.wave = back; G.waveKills = 0; G.zombies = [];
  G.hp = bunkerHp(G.bunker);
  if (G.fence) { G.fenceHp = fenceHp(G.fence); G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0]; bakeYard(); }
  G.spawnIn = 3;
}

/* ================= drawing people and zombies ================= */
// which way a figure faces: front frames look down-right; back frames look up-left; mirrored for the rest
function facingOf(yaw) { const fx = Math.cos(yaw), fy = Math.sin(yaw), u = fx - fy, v = fx + fy; return v >= 0 ? { view: 'F', mirror: u < 0 } : { view: 'B', mirror: u > 0 }; }
const ZPALS = {};
const palCache = new Map();
function gearOf(c) {
  const f = formOf(G.bunker), gunner = c.hero || c.job === '사수';
  if (gunner) return { head: f >= 2 ? 'helmet' : null, helmet: [[96, 110, 70], [96, 110, 70], [96, 110, 70], [96, 110, 70], [70, 84, 64], [52, 56, 64]][f], vest: f >= 4 ? (f === 5 ? [60, 66, 76] : [98, 108, 74]) : null, body: f >= 4 ? 'humanVest' : 'human' };
  return { head: c.job === '광부' ? 'hardhat' : null, helmet: null, vest: null, body: 'human' };
}
function palFor(c, gear) {
  const key = (c.hero ? 'h' : c.i) + ':' + (gear.helmet || '') + (gear.vest || '');
  let p = palCache.get(key);
  if (!p) { p = personPalette(c.look, gear); palCache.set(key, p); }
  return p;
}
const perPx = SIN / (S * COS);
function drawPerson(c) {
  const { view, mirror } = facingOf(c.yaw), gear = gearOf(c), pal = palFor(c, gear), gunner = c.hero || c.job === '사수';
  let anim = 'walk', idx = Math.floor(c.walk / .22) % 4;
  if (c.anim === 'climb' && c.path.length && c.path[0].mode === 'climb') { anim = 'climb'; idx = Math.floor(c.walk / .3) % 2; }
  else if (!c.path.length) {
    if (gunner) { if (c.reload > 0) { anim = 'reload'; idx = Math.min(2, Math.floor((1 - c.reload / c.reloadLen) * 3)); } else { anim = 'aim'; idx = c.recoil > .06 ? 1 : 0; } }
    else if (c.job === '농부') { anim = 'farm'; idx = Math.floor(c.act * 2) % 2; }
    else { anim = 'mine'; idx = Math.floor(c.act * 2.6) % 3; }
  }
  const info = drawSprite(gear.body, anim, view, idx, mirror, c.x, c.y, c.z, pal);
  const fr = info.fr, front = view === 'F';
  if (fr.head) { const [hx, hy] = frameSpot(info, fr.head); drawHead(c.look, gear.head, view, hx, hy, mirror, pal, info.p.d + (SPR[gear.body].ay - fr.head[1]) * perPx + .06); }
  if (fr.gun && gunner) {
    const a = frameSpot(info, [fr.gun[0], fr.gun[1]]), b = frameSpot(info, [fr.gun[2], fr.gun[3]]);
    c.muzzle = drawGun(a, b, info.p.d + 1.2 * perPx * 10 + (front ? .15 : -.15), c);
  }
  if (fr.mag) { const [mx, my] = frameSpot(info, fr.mag); for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) putPx(mx + x, my + y, rgb(52, 50, 58), info.p.d + 1); }
  if (fr.pick) {
    const a = frameSpot(info, [fr.pick[0], fr.pick[1]]), b = frameSpot(info, [fr.pick[2], fr.pick[3]]), d = info.p.d + (front ? .2 : -.2);
    pxLine(a[0], a[1], b[0], b[1], rgb(124, 92, 60), d);
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    pxLine(Math.round(b[0] - nx * 2), Math.round(b[1] - ny * 2), Math.round(b[0] + nx * 2), Math.round(b[1] + ny * 2), rgb(150, 156, 168), d + .01);
  }
}
function putPx(x, y, color, d) { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (d <= zb[i]) return; zb[i] = d; pix[i] = color; }
function pxLine(x0, y0, x1, y1, color, d, w = 1) {
  const n = Math.max(1, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let k = 0; k <= n; k++) { const x = Math.round(lerp(x0, x1, k / n)), y = Math.round(lerp(y0, y1, k / n)); for (let o = 0; o < w; o++) putPx(x, y + o, color, d); }
}
// the rifle in the hands changes with the attack level: family, length, attachments, then paint
function gunLook(L) {
  const fam = weaponFamily(L);
  return { fam, len: [9, 10, 11, 12, 14, 12][fam], scope: L >= 10 || fam === 4, laser: L >= 14, grip: L >= 20, suppressor: L >= 26 && fam !== 3, bipod: L >= 30 || fam === 3,
    brake: L >= 44, paint: L >= 80 ? 'glow' : L >= 60 ? 'gold' : L >= 48 ? 'camo' : fam === 0 ? 'wood' : 'black' };
}
function drawGun(a, b, d, s) {
  const g = gunLook(G.lv.atk), dx = b[0] - a[0], dy = b[1] - a[1], L0 = Math.hypot(dx, dy) || 1, ux = dx / L0, uy = dy / L0, nx = -uy, ny = ux, len = g.len;
  const end = [Math.round(a[0] + ux * len), Math.round(a[1] + uy * len)];
  const body = g.paint === 'gold' ? rgb(226, 182, 66) : g.paint === 'camo' ? rgb(104, 112, 74) : rgb(46, 44, 50);
  const accent = g.paint === 'glow' ? rgb(120, 230, 255) : g.paint === 'gold' ? rgb(255, 230, 140) : g.paint === 'wood' ? rgb(124, 86, 54) : rgb(70, 70, 78);
  const at = t => [Math.round(a[0] + ux * len * t), Math.round(a[1] + uy * len * t)];
  // stock, receiver, barrel
  const st = [Math.round(a[0] - ux * 2), Math.round(a[1] - uy * 2)];
  pxLine(st[0], st[1], a[0], a[1], g.paint === 'wood' || g.fam === 0 ? rgb(124, 86, 54) : accent, d, 2);
  const r1 = at(.55); pxLine(a[0], a[1], r1[0], r1[1], body, d, 2);
  pxLine(r1[0], r1[1], end[0], end[1], rgb(36, 36, 42), d);
  if (g.fam === 5) { for (let t = .6; t < 1; t += .12) { const p = at(t); putPx(p[0], p[1] - 1, rgb(120, 230, 255), d + .01); } }
  // magazine: longer with the magazine level, a drum later on
  const m = at(.38), magLen = 2 + Math.min(4, Math.floor(G.lv.mag / 5));
  if (G.lv.mag >= 20) { for (let y = 1; y <= 3; y++) for (let x = -1; x <= 1; x++) putPx(m[0] + x, m[1] + y, rgb(60, 58, 66), d + .01); }
  else pxLine(m[0], m[1] + 1, m[0] + Math.round(nx * 0), m[1] + magLen, rgb(60, 58, 66), d + .01);
  if (g.scope) { const s0 = at(.25), s1 = at(.5); pxLine(s0[0], s0[1] - 1, s1[0], s1[1] - 1, rgb(28, 28, 34), d + .02); putPx(s1[0], s1[1] - 1, rgb(140, 200, 255), d + .03); }
  if (g.grip) { const gp = at(.7); putPx(gp[0], gp[1] + 1, rgb(60, 58, 66), d + .01); }
  if (g.suppressor) { const s0 = at(.85); pxLine(s0[0], s0[1], end[0], end[1], rgb(70, 70, 78), d + .02, 2); }
  if (g.brake) putPx(end[0], end[1] - 1, accent, d + .02);
  if (g.bipod) { const bp = at(.8); pxLine(bp[0], bp[1], bp[0] - 1, bp[1] + 3, rgb(40, 40, 46), d - .01); pxLine(bp[0], bp[1], bp[0] + 1, bp[1] + 3, rgb(40, 40, 46), d - .01); }
  if (g.laser && s.target) { for (let k = 2; k < 8; k += 2) putPx(end[0] + Math.round(ux * k), end[1] + Math.round(uy * k), rgb(255, 60, 50), d); }
  if (s.flash > 0) {
    const big = 1 + Math.min(2, Math.floor(G.lv.spd / 10)), fx0 = end[0] + Math.round(ux * 2), fy0 = end[1] + Math.round(uy * 2);
    for (let y = -big; y <= big; y++) for (let x = -big; x <= big; x++) if (Math.abs(x) + Math.abs(y) <= big) putPx(fx0 + x, fy0 + y, Math.abs(x) + Math.abs(y) < big ? rgb(255, 250, 220) : rgb(255, 196, 80), d + .05);
  }
  return end;
}
function drawZombie(z) {
  const T = ZTYPES[z.type], set = SPR[z.type], { view, mirror } = facingOf(z.yaw);
  let anim = 'walk', idx = Math.floor(z.walkDist / T.step) % 4, v = view;
  if (z.state === 'attack') { anim = 'attack'; idx = z.type === 'bloater' ? Math.min(2, Math.floor(z.atk / 1.1 * 3)) : Math.min(2, Math.floor(z.atk / T.every * 3)); }
  if (z.state === 'dying') { anim = 'die'; v = 'F'; idx = Math.min(set.anims.die.F.length - 1, Math.floor(z.t / .14)); }
  const fade = z.state === 'dying' ? clamp(4.4 - z.t, 0, 1) : clamp((FIELD + .7 - z.n) / 1.0, 0, 1);
  if (fade <= 0) return;
  const info = drawSprite(z.type, anim, v, idx, mirror, z.x, z.y, 0, ZPALS[z.type], { hit: z.hit > 0, fade });
  z.sx = info.bx; z.sy = info.by - Math.round(set.ay * .5); z.top = info.by - set.ay + 1;
}
function drawBars() {
  for (const z of G.zombies) {
    if (z.state === 'dying' || z.hp >= z.max || !z.visible) continue;
    const w = z.type === 'brute' ? 12 : 8, left = Math.round(z.sx - w / 2), top = z.top - 4, fill = Math.ceil(w * clamp(z.hp / z.max, 0, 1));
    for (let k = -1; k <= w; k++) for (let r = -1; r <= 1; r++) {
      const ix = left + k, iy = top + r;
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
      pix[iy * W + ix] = r === 0 && k >= 0 && k < w ? (k < fill ? (z.type === 'brute' || z.type === 'armored' ? rgb(220, 80, 60) : rgb(120, 196, 88)) : rgb(70, 66, 64)) : INK;
    }
  }
}
function drawAmmo(s) {
  const p = project(s.x, s.y, s.z), cx = Math.round(p.sx), top = Math.round(p.sy) - 24, mag = gunStat('mag');
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) pix[y * W + x] = c; };
  if (s.reload > 0) {
    const w = 14, left = cx - 7, fill = Math.round(w * (1 - s.reload / s.reloadLen));
    for (let x = -1; x <= w; x++) for (let y = -1; y <= 1; y++) put(left + x, top + y, x < 0 || x >= w || y !== 0 ? INK : x < fill ? SIGNAL : rgb(70, 66, 64));
    return;
  }
  const shown = Math.min(mag, 12), left = cx - shown;
  for (let k = 0; k < shown; k++) {
    const full = k < Math.ceil(s.ammo * shown / mag);
    for (let y = -1; y <= 3; y++) put(left + k * 2, top + y, y < 0 || y > 2 ? PAPER : full ? (y === 0 ? rgb(232, 184, 74) : SIGNAL) : rgb(150, 146, 140));
  }
}
function drawSleeper(c) {
  const fz = FLOOR_Z[0], x = BED_X(c.i) + .28, y = UG.y0 + .47, p = project(x, y, fz + .5), gear = gearOf({ ...c, job: '' }), pal = palFor(c, gear);
  drawHead(c.look, 'sleep', 'F', Math.round(p.sx), Math.round(p.sy) - 3, false, pal, p.d + .2);
  const zt = (G.time * .8 + c.i * .37) % 1;
  if (G.view === 'under') pixelText(zt < .5 ? 'z' : 'Z', p.sx + 6 + zt * 4, p.sy - 10 - zt * 6, rgb(236, 236, 255));
}

/* ================= the loop ================= */
function say(text, alert) { G.statusT = 4; nodes.status.textContent = text; nodes.status.classList.toggle('alert', !!alert); }
function update(dt) {
  G.time += dt;
  // food and minerals from the floors below, then mouths to feed
  G.food += rateOf('food') * dt; G.mineral += rateOf('mineral') * dt;
  G.food -= hired().length * UPKEEP * dt;
  const wasHungry = G.hungry;
  G.hungry = G.food <= 0 && hired().length > 0;
  if (G.food < 0) G.food = 0;
  if (G.hungry && !wasHungry) say('식량이 바닥났다 · 사람들이 지쳐 간다', true);
  // repairs: a slow free patch-up, and a fast one that eats food (bunker) or money (fence)
  const maxHp = bunkerHp(G.bunker);
  G.hp = Math.min(maxHp, G.hp + maxHp * .005 * dt);
  const paid = Math.min(maxHp - G.hp, maxHp * .015 * dt, G.food / REPAIR_FOOD);
  if (paid > 0) { G.hp += paid; G.food -= paid * REPAIR_FOOD; }
  if (G.fence) {
    const max = fenceHp(G.fence), free = Math.max(0, Math.min(max - G.fenceHp, max * .005 * dt));
    const fix = Math.max(0, Math.min(max - G.fenceHp - free, max * .02 * dt, G.money / REPAIR_MONEY));
    G.money -= fix * REPAIR_MONEY;
    const heal = free + fix;
    G.fenceHp += heal;
    for (let k = 0; k < 4; k++) G.sideDmg[k] = Math.max(0, G.sideDmg[k] - heal / 2);
    if (G.fenceDown && G.fenceHp >= max * .4) { G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0]; bakeYard(); say('울타리를 다시 세웠다'); sound('hammer'); }
    else if (!G.fenceDown) fenceStages();
  }
  if ((G.spawnIn -= dt) <= 0) { if (G.zombies.length < MAX_ZOMBIES) spawn(); G.spawnIn = spawnEvery(G.wave) * (.6 + Math.random() * .8); }
  updateZombies(dt);
  if (G.hp <= 0) fall();
  updatePeople(dt);
  assignTargets(dt);
  for (const s of shooters()) updateShooter(s, dt);
  // the floors below at work: sparks off the drill and the picks, leaves from the farm
  if (!G.hungry) {
    if (G.mine) inDugout(FLOOR_Z[2], () => { if (Math.random() < dt * 8) part(PIT.x, PIT.y, FLOOR_Z[2] + .05, (Math.random() - .5) * 2.4, (Math.random() - .5) * 2.4, 2.2, .45, rgb(255, 204, 96), null); });
    for (const c of G.crew) {
      if (!atWork(c) || c.where !== 'ug') continue;
      if (c.job === '광부') { const ph = (c.act * 2.6) % 3, prev = ((c.act - dt) * 2.6) % 3; if (prev < 2 && ph >= 2) inDugout(c.z, () => spray(c.x + .05, UG.y0 + .1, c.z + .9, 6, 1.5, 2.2, .7, [rgb(110, 150, 214), rgb(150, 146, 140), rgb(255, 214, 120)])); }
      if (c.job === '농부' && Math.random() < dt * 1.2) inDugout(c.z, () => part(c.x + (Math.random() - .5) * .6, c.y - .7, c.z + 1 + Math.random() * .4, 0, 0, -.2, .8, rgb(140, 210, 110), null));
    }
  }
  G.hurt = Math.max(0, G.hurt - dt);
  for (const t of G.tracers) t.life -= dt;
  G.tracers = G.tracers.filter(t => t.life > 0);
  updateParts(dt);
  for (const d of G.decals) d.life -= dt;
  G.decals = G.decals.filter(d => d.life > 0);
  if (G.statusT > 0 && (G.statusT -= dt) <= 0) nodes.status.textContent = '';
  if ((G.saveIn -= dt) <= 0) { save(); G.saveIn = 5; }
  // the store rooms below show what you hold: rebuild them when a stack grows or shrinks
  if (G.view === 'under' && G.time - underBakedAt > 2) {
    const st = [stockLevel(G.money), stockLevel(G.food), stockLevel(G.mineral)].join();
    if (st !== stockSeen || underDirty) bakeUnder();
  }
  if (yardDirty && G.time - yardBakedAt > .5) bakeYard();
}
function drawYard() {
  pix.set(bakedPix); zb.set(bakedZ);
  const windT = STILL || !settings.wind ? 0 : Math.floor(G.time * WIND_FPS) / WIND_FPS;
  for (const d of G.decals) for (const i of d.pts) { if (d.life < 2 && hash(i, 7) > d.life / 2) continue; if (zb[i] === groundZ[i]) pix[i] = d.color; }
  drawTufts(windT);
  for (const z of G.zombies) drawZombie(z);
  if (G.hero) drawPerson(G.hero);
  for (const c of G.crew) if (c && c.where === 'yard') drawPerson(c);
  castSpriteShadows(SHX, SHY);
  for (const t of G.tracers) pxLine(Math.round(t.ax), Math.round(t.ay), Math.round(t.bx), Math.round(t.by), SIGNAL, 99);
  drawParts(G.parts);
  // lamps glow with a small flicker; the fortress beacon turns and sweeps a dashed beam
  for (let n = 0; n < GLOWS.length; n++) {
    if (Math.sin(G.time * 7 + n * 2.3) > .94) continue;
    const g = GLOWS[n], p = project(g.x, g.y, g.z), x = Math.round(p.sx), y = Math.round(p.sy), d = p.d + .15;
    putPx(x, y, g.c, d); putPx(x + 1, y, g.soft, d); putPx(x - 1, y, g.soft, d); putPx(x, y - 1, g.soft, d); putPx(x, y + 1, g.soft, d);
  }
  if (BEACON) {
    const [bx, by, bz] = BEACON, a = G.time * 4, p = project(bx, by, bz), q = project(bx + Math.cos(a) * 1.6, by + Math.sin(a) * 1.6, bz + .15);
    const n = Math.max(1, Math.round(Math.hypot(q.sx - p.sx, q.sy - p.sy)));
    for (let k = 2; k <= n; k += 2) putPx(Math.round(lerp(p.sx, q.sx, k / n)), Math.round(lerp(p.sy, q.sy, k / n)), k < n / 2 ? rgb(255, 170, 120) : rgb(255, 214, 170), p.d + .6);
    const on = Math.floor(G.time * 4) % 2 ? rgb(255, 80, 56) : rgb(255, 196, 120);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]]) putPx(Math.round(p.sx) + dx, Math.round(p.sy) + dy, on, p.d + .7);
  }
  // the electric fence: blinking lights on the posts and the odd spark
  if (G.fence && formOf(G.fence) === 5 && !G.fenceDown) {
    const k = sub(G.fence, 5);
    if (k >= 3 && Math.floor(G.time * 2) % 2) for (let side = 0; side < 4; side++) { const [x, y] = SIDE_AT(side, -FENCE_R); const p = project(x, y, .66); putPx(Math.round(p.sx), Math.round(p.sy), rgb(255, 80, 60), 99); }
    if (k >= 5 && Math.random() < .3) { const side = Math.floor(Math.random() * 4), [x, y] = SIDE_AT(side, (Math.random() * 2 - 1) * FENCE_R); const p = project(x, y, .3 + Math.random() * .3); putPx(Math.round(p.sx), Math.round(p.sy), rgb(200, 240, 255), 99); putPx(Math.round(p.sx) + 1, Math.round(p.sy), rgb(140, 210, 255), 99); }
  }
  drawBars();
  if (G.hero) drawAmmo(G.hero);
  for (const f of G.floats) { const p = project(f.x, f.y, f.z); if (f.life > .25 || Math.floor(f.life * 20) % 2) pixelText(f.text, p.sx, p.sy - 6, f.color); }
}
function drawUnder() {
  pix.set(bakedPix); zb.set(bakedZ);
  // the mine's machinery moves
  if (G.mine) {
    const fz = FLOOR_Z[2], { x, y } = PIT, run = !G.hungry;
    if (facTier(G.mine) === 0) {
      const depth = run ? Math.sin(G.time * 1.3) * .5 + .5 : .5, p0 = project(x, y, fz + 1.3), p1 = project(x, y, fz + 1.2 - depth * 1.6);
      pxLine(Math.round(p0.sx), Math.round(p0.sy), Math.round(p1.sx), Math.round(p1.sy), rgb(200, 186, 150), p1.d + .5);
      for (let yy = 0; yy < 3; yy++) for (let xx = -1; xx <= 1; xx++) putPx(Math.round(p1.sx) + xx, Math.round(p1.sy) + yy, rgb(118, 96, 70), p1.d + .6);
    } else {
      const top = fz + (facTier(G.mine) === 1 ? 2.05 : 2.15), spin = run ? G.time * 14 : 0, dz = run ? Math.sin(G.time * 2) * .12 : 0;
      for (let z = fz - .2; z < top - .1; z += STEP) { const p = project(x, y, z + dz), band = Math.floor(z * 6 + spin) & 1; putPx(Math.round(p.sx), Math.round(p.sy), band ? rgb(210, 214, 220) : rgb(96, 100, 108), p.d + .3); putPx(Math.round(p.sx) + 1, Math.round(p.sy), rgb(70, 74, 80), p.d + .3); }
    }
  }
  for (const c of G.crew) {
    if (!c || c.where !== 'ug') continue;
    if (c.state === 'sleep' && !c.path.length) drawSleeper(c); else drawPerson(c);
  }
  castSpriteShadows(.25, .1);
  drawParts(G.uparts);
}
function draw() {
  if (G.view === 'under') drawUnder(); else drawYard();
  const shake = G.hurt > .2 && G.view === 'yard' ? (Math.floor(G.time * 40) % 2 ? 1 : -1) : 0;
  ctx.putImageData(image, shake, 0);
  placeLabels();
}

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
function portrait(person, scale = 5) {
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
for (const id of ['status', 'panel', 'bunkerFill', 'bunkerText', 'bunkerTrack', 'fenceFill', 'fenceText', 'waveLine', 'stage', 'speed', 'viewBtn', 'labels']) nodes[id] = document.getElementById(id);
let tab = 'gun';
function setView(v) {
  G.view = v;
  if (v === 'under') { if (underDirty || [stockLevel(G.money), stockLevel(G.food), stockLevel(G.mineral)].join() !== stockSeen) bakeUnder(); else showUnder(); } else showYard();
  nodes.viewBtn.textContent = v === 'under' ? '지상' : '지하';
  nodes.viewBtn.setAttribute('aria-pressed', String(v === 'under'));
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
const extraAt = (list, L) => { const f = formOf(L); return list[f][sub(L, f)]; };
const FARM_ITEMS = ['흙 화단', '물통', '화단 추가', '화단 추가', '재배 선반', '환풍기', '씨앗 자루', '선반 추가', '수경 탱크', '탱크 연장', '탱크 연장', '탱크 연장', '탱크 연장', '탱크 연장', '탱크 연장', '자동 재배실', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동', '로봇 팔 이동'];
const MINE_ITEMS = ['손 도르래', '버팀목', '레일', '광차', '시추탑', '작업등', '두 번째 광차', '광차 적재', '굴착기', '컨베이어', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '대형 채굴 플랜트', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재', '광차 적재'];
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
      { id: 'bunker', ico: 'bunker', name: '벙커 · ' + BUNKER_FORMS[formOf(B)].name, lv: 'Lv ' + B, desc: bmax ? '최대 레벨' : `체력 ${fmt(bunkerHp(B))} → ${fmt(bunkerHp(B + 1))}<br>다음: ${extraAt(BUNKER_EXTRAS, B + 1)}`, cost: bmax ? null : bunkerCost(B), max: bmax },
      { id: 'fence', ico: 'fence', name: '울타리' + (F ? ' · ' + FENCE_FORMS[formOf(F)] : ''), lv: 'Lv ' + F, desc: fmax ? '최대 레벨' : `체력 ${fmt(fenceHp(F))} → ${fmt(fenceHp(F + 1))}<br>다음: ${extraAt(FENCE_EXTRAS, F + 1)}${F + 1 === 32 ? ' (공격한 좀비 감전)' : ''}`, cost: fmax ? null : fenceCost(F), max: fmax },
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
let panelKey = '';
function renderPanel(force) {
  const list = cards();
  const key = tab + JSON.stringify(list.map(c => [c.id, c.name, c.lv, c.desc, c.fatigue == null ? 0 : Math.round(c.fatigue / 5), c.cost && Object.entries(c.cost).map(([k, v]) => [v, G[k] >= v])]));
  if (!force && key === panelKey) return;
  panelKey = key;
  nodes.panel.innerHTML = '';
  for (const c of list) {
    const el = document.createElement('div');
    el.className = 'card';
    const ic = document.createElement('div');
    ic.className = 'icon'; ic.append(c.person ? portrait(c.person, 4) : iconCanvas(c.ico, 2));
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
    say((FORM_AT.includes(G.bunker) ? '새 건물: ' : '추가: ') + extraAt(BUNKER_EXTRAS, G.bunker));
    bakeYard(); resyncPosts(); palCache.clear();
  } else if (kind === 'fence') {
    const c = fenceCost(G.fence);
    if (G.fence >= MAX_FENCE || !canPay(c)) return;
    pay(c); G.fence++; G.fenceHp = fenceHp(G.fence); G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0];
    say((FORM_AT.includes(G.fence) ? '새 울타리: ' : '추가: ') + extraAt(FENCE_EXTRAS, G.fence));
    bakeYard();
  } else if (kind === 'live') {
    const c = LIVE.cost(G.live);
    if (G.live >= LIVE.max || !canPay(c)) return;
    pay(c); G.live++;
    say('생활층: ' + LIVE_ITEMS[G.live - 1] + (LIVE.beds.includes(G.live) ? ' · 고용할 수 있는 자리가 생겼다' : ''));
    markUnder();
  } else if (kind === 'farm' || kind === 'mine') {
    const B = kind === 'farm' ? FARM : MINE, L = G[kind], c = B.cost(L);
    if (L >= B.max || !canPay(c)) return;
    pay(c); G[kind]++;
    say(kind === 'farm' ? '식량층: ' + FARM_ITEMS[G.farm - 1] : '채굴층: ' + MINE_ITEMS[G.mine - 1]);
    markUnder();
  } else if (kind === 'hire') {
    const i = +key, c = HIRE[i];
    if (G.crew[i] || i >= bedsOf(G.live) || !canPay(c)) return;
    pay(c); G.crew[i] = makePerson(i);
    G.crew[i].state = 'toWork'; G.crew[i].path = route(G.crew[i], workSpot(G.crew[i]));
    say(NAMES[i] + ' 합류 · 직업을 고를 수 있다');
    markUnder();
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
  nodes.waveLine.innerHTML = `<b>웨이브 ${G.wave}</b> · ${G.waveKills}/${killsNeeded(G.wave)} · ` + (hero && hero.reload > 0 ? '장전 중' : `탄창 ${hero ? hero.ammo : 0}/${gunStat('mag')}`);
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
  const scale = f * dpr >= 1 ? Math.floor(f * dpr) / dpr : f;
  canvas.style.width = W * scale + 'px'; canvas.style.height = H * scale + 'px';
}
// floor names over the cutaway are real page text, laid over the canvas
function placeLabels() {
  const show = G.view === 'under';
  nodes.labels.hidden = !show;
  if (!show) return;
  const r = canvas.getBoundingClientRect(), f = r.width / W;
  if (nodes.labels.children.length !== 4) nodes.labels.innerHTML = FLOOR_NAME.map(t => `<span>${t}</span>`).join('') + '<span>지상 해치</span>';
  // each name sits in the white margin to the left of its floor, level with it, so it never covers the floor
  FLOOR_NAME.forEach((t, k) => {
    const p = project(UG.x0, UG.y1, FLOOR_Z[k] + UG.h * .2), el = nodes.labels.children[k];
    el.style.transform = 'translate(0, -50%)';
    el.style.left = Math.max(4, r.left + p.sx * f - 8 - el.offsetWidth) + 'px'; el.style.top = r.top + p.sy * f + 'px';
  });
  const p = project(SHAFT.x, SHAFT.y, HATCH_TOP() + .5), el = nodes.labels.children[3];
  el.style.left = r.left + p.sx * f + 'px'; el.style.top = r.top + p.sy * f + 'px';
}

/* ================= input ================= */
canvas.addEventListener('pointerdown', e => {
  ensureAudio();
  if (G.view !== 'yard' || !G.hero) return;
  const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height, hero = G.hero;
  if (hero.reload > 0) { hero.reload = Math.max(.01, hero.reload - hero.reloadLen * .12); return; } // tapping hurries the reload
  let best = null, bestD = 14;
  for (const z of G.zombies) { if (z.state === 'dying' || !z.visible) continue; const d = Math.hypot(z.sx - x, z.sy - y); if (d < bestD) { bestD = d; best = z; } }
  if (best) { hero.target = best; hero.retarget = .8; hero.yaw = Math.atan2(best.y - hero.y, best.x - hero.x); fire(hero, best); }
});
nodes.speed.addEventListener('click', () => { G.speed = G.speed === 1 ? 2 : 1; nodes.speed.textContent = G.speed + '배속'; nodes.speed.setAttribute('aria-pressed', String(G.speed === 2)); });

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

/* ================= save ================= */
function save() {
  if (skipSave) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.money, food: G.food, mineral: G.mineral, lv: G.lv, bunker: G.bunker, fence: G.fence, live: G.live, farm: G.farm, mine: G.mine,
      crew: G.crew.map(c => c && { job: c.job, fatigue: c.fatigue }), wave: G.wave, waveKills: G.waveKills, totalKills: G.totalKills, at: Date.now(),
    }));
  } catch { /* saving is a convenience */ }
}
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { d = null; }
  if (d && d.lv) {
    for (const k of ['money', 'food', 'mineral', 'waveKills', 'totalKills']) G[k] = +d[k] || 0;
    G.wave = Math.max(1, +d.wave || 1);
    for (const k of Object.keys(G.lv)) G.lv[k] = clamp(+d.lv[k] || 0, 0, GUN[k].max);
    G.bunker = clamp(+d.bunker || 1, 1, MAX_BUNKER); G.fence = clamp(+d.fence || 0, 0, MAX_FENCE);
    G.live = clamp(+d.live || 0, 0, LIVE.max); G.farm = clamp(+d.farm || 0, 0, FARM.max); G.mine = clamp(+d.mine || 0, 0, MINE.max);
    if (Array.isArray(d.crew)) d.crew.forEach((c, i) => { if (c && i < bedsOf(G.live) && JOBS.includes(c.job)) { const p = makePerson(i); p.job = c.job; p.fatigue = clamp(+c.fatigue || 0, 0, 99); G.crew[i] = p; } });
    // what the floors made while nobody was looking
    const away = clamp((Date.now() - (+d.at || Date.now())) / 1000, 0, OFFLINE_CAP);
    if (away > 30) {
      const food = FARM.rate(G.farm) * away - hired().length * UPKEEP * away, ore = MINE.rate(G.mine) * away;
      G.food = Math.max(0, G.food + food); G.mineral += ore;
      const parts = [];
      if (food > 1) parts.push('식량 +' + fmt(food));
      if (ore > 1) parts.push('광물 +' + fmt(ore));
      if (parts.length) setTimeout(() => say('자리 비운 동안 ' + parts.join(', ')), 300);
    }
  }
  G.hp = bunkerHp(G.bunker); G.fenceHp = fenceHp(G.fence);
}
addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

/* ================= sound ================= */
let audio = null, noiseBuffer = null, master = null, lastShot = 0;
function ensureAudio() {
  if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio = new AC(); master = audio.createGain(); master.connect(audio.destination);
  noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}
function burstSound(type, freq, volume, length, delay = 0) {
  const now = audio.currentTime + delay, src = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
  src.buffer = noiseBuffer; filter.type = type; filter.frequency.value = freq; filter.Q.value = .8;
  gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0005, now + length);
  src.connect(filter).connect(gain).connect(master); src.start(now, Math.random() * .5, length + .02);
}
function sound(kind) {
  if (!audio || !settings.sound || document.hidden) return;
  master.gain.value = settings.volume;
  if (kind === 'shot') { if (audio.currentTime - lastShot < .07) return; lastShot = audio.currentTime; burstSound('bandpass', 1500, .06, .07); burstSound('lowpass', 300, .05, .08); }
  if (kind === 'kill') burstSound('lowpass', 320, .09, .14);
  if (kind === 'buy') burstSound('bandpass', 2400, .06, .08);
  if (kind === 'crash') { burstSound('lowpass', 160, .3, .6); burstSound('bandpass', 700, .12, .4, .05); }
  if (kind === 'thud') burstSound('lowpass', 240, .08, .1);
  if (kind === 'clang') burstSound('bandpass', 2600, .05, .12);
  if (kind === 'magout') burstSound('highpass', 3000, .04, .03);
  if (kind === 'magin') burstSound('bandpass', 1800, .07, .04);
  if (kind === 'rack') { burstSound('highpass', 2500, .06, .03); burstSound('highpass', 2200, .06, .03, .07); }
  if (kind === 'hammer') for (let k = 0; k < 3; k++) burstSound('bandpass', 900, .08, .05, k * .15);
}

/* ================= boot ================= */
decodeSprites();
for (const t of Object.keys(ZTYPES)) ZPALS[t] = paletteOf(ART.pal[t]);
load();
bakeGround();
bakeYard();
G.hero = makeHero(); { const s = SITES[0]; G.hero.x = s[0]; G.hero.y = s[1]; G.hero.z = s[2]; }
growGrass();
bakeUnder();
showYard();
for (const c of G.crew) if (c) sendTo(c, workSpot(c), 'toWork');
renderPanel(true);
refreshTop();
addEventListener('resize', fitStage);
fitStage();
if (!nodes.status.textContent) say('섬 가장자리 너머에서 좀비가 몰려온다 · 좀비를 누르면 직접 쏜다');
let last = performance.now(), hudIn = 0;
function frame(now) {
  // a background tab gets its time back in chunks, so the bunker keeps working while hidden
  let dt = Math.min(5, (now - last) / 1000) * G.speed;
  last = now;
  while (dt > 0) { const step = Math.min(.04, dt); update(step); dt -= step; }
  draw();
  if (--hudIn <= 0) { hudIn = 6; refreshTop(); renderPanel(false); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__bunker = { G, draw, step(dt, noDraw) { update(dt); if (!noDraw) draw(); }, act, refreshTop, renderPanel, bakeYard, bakeUnder, setView, resyncPosts };
