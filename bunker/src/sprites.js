'use strict';
// Sprite frames: decoding, palettes and drawing them into the depth buffer, with their shadows.
/* ================= sprites ================= */
// frames come baked from art.js as rows of palette letters; decode once into flat cell lists
const SPR = {};
const colorCache = new Map();
const rgbOf = c => { const k = c.join(','); let v = colorCache.get(k); if (v === undefined) { v = rgb(...c); colorCache.set(k, v); } return v; };
// one sprite set (either the old 18x20 sheets in art.js or the 32x32 sets in art/*.js) into flat cell lists:
// set.anims[name] = { F: [frames], B: [frames], fps, loop }, each frame { cells: [x, y, letter, ...], and anchors }
function decodeSet(s) {
  const set = { w: s.w, h: s.h, ax: s.ax, ay: s.ay, anims: {} };
  for (const [anim, a] of Object.entries(s.anims)) {
    const out = set.anims[anim] = { fps: a.fps || 6, loop: a.loop !== false };
    for (const view of ['F', 'B']) {
      const frames = a[view] || a.F;
      if (!frames) continue;
      out[view] = frames.map(f => {
        const cells = [];
        f.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') cells.push(x, y, ch.charCodeAt(0)); }));
        return { cells, head: f.head, gun: f.gun, mag: f.mag, pick: f.pick, mouth: f.mouth };
      });
    }
  }
  return set;
}
// zombie kinds without art of their own yet borrow a body and get their own colouring
const ZBORROW = { spitter: ['walker', [1.15, 1.3, .7]], screamer: ['walker', [1.35, 1.3, 1.25]], leaper: ['runner', [1.05, .85, 1.3]],
  burrower: ['walker', [1.15, .92, .7]], regenerator: ['walker', [1.5, .8, .8]], giant: ['brute', [.95, .95, 1.1]], boss: ['brute', [1.3, .7, .75]] };
const ZPALS = {};
// one crowd, many people: each zombie of a kind wears its own shirt and trousers and has its own skin tone.
// Per kind: which palette letters are the shirt, the trousers and the skin (the big later kinds only vary in tone)
const ZVARY = {
  walker: { top: 'Ccx', bottom: 'UPpu', skin: 'kSsq' }, crawler: { top: 'WCcx', skin: 'kSsq' },
  runner: { top: 'YAax', bottom: 'UPpu', skin: 'kSsq' }, brute: { bottom: 'UPpu', skin: 'kSsq' },
  bloater: { top: 'WCcx', bottom: 'UPpu', skin: 'kSsq' }, armored: { top: 'VvxA', skin: 'kSsq' },
};
const SHIRTS = [[184, 174, 144], [156, 64, 54], [74, 96, 146], [104, 124, 80], [196, 164, 72], [118, 86, 128], [64, 128, 126], [128, 100, 74], [206, 204, 198]];
const PANTS = [[76, 94, 134], [62, 60, 68], [104, 84, 62], [72, 94, 72], [116, 72, 62], [54, 56, 86]];
const SKINS = [[1, 1, 1], [.92, 1.03, .9], [1.07, 1.04, .9], [.95, .95, 1.05], [1.1, 1, .98], [.86, .9, .86]];
const ZVARIANTS = 6, ZPAL_V = {};
function zombieVariants(type, pal) {
  const V = ZVARY[type], lum = c => c[0] * .3 + c[1] * .59 + c[2] * .11, out = [];
  for (let v = 0; v < ZVARIANTS; v++) {
    const p = {};
    for (const [k, c] of Object.entries(pal)) p[k] = c.slice();
    const recolor = (letters, list, pick) => {
      const keys = [...letters].filter(k => p[k]), top = Math.max(...keys.map(k => lum(pal[k])), 1), base = list[pick % list.length];
      for (const k of keys) { const f = lum(pal[k]) / top; p[k] = base.map(x => Math.min(255, x * (.35 + f * .75))); }
    };
    if (v && V) {
      if (V.top) recolor(V.top, SHIRTS, v * 2 + type.length);
      if (V.bottom) recolor(V.bottom, PANTS, v + type.length);
      for (const k of V.skin || '') if (p[k]) p[k] = p[k].map((x, n) => Math.min(255, x * SKINS[v][n]));
    } else if (v) for (const k of Object.keys(p)) if (k !== 'o') p[k] = p[k].map((x, n) => Math.min(255, x * (1 + (SKINS[v][n] - 1) * .7)));
    out.push(paletteOf(p));
  }
  return out;
}
function loadSprites() {
  // the old sheets first, then the new 32x32 sets on top
  // (art.js declares a global const, which is not a window property)
  if (typeof ART !== 'undefined' && ART.sprites) for (const [type, s] of Object.entries(ART.sprites)) { SPR[type] = decodeSet(s); if (ART.pal[type]) ZPALS[type] = paletteOf(ART.pal[type]); }
  for (const pack of [window.ART_ZOMBIES_A, window.ART_ZOMBIES_B]) if (pack) for (const [type, s] of Object.entries(pack.types)) { SPR[type] = decodeSet(s); ZPALS[type] = paletteOf(s.pal); ZPAL_V[type] = type === 'boss' ? [ZPALS[type]] : zombieVariants(type, s.pal); }
  for (const [type, [base, tint]] of Object.entries(ZBORROW)) {
    if (SPR[type] || !SPR[base]) continue;
    SPR[type] = SPR[base];
    ZPALS[type] = ZPALS[base].map((c, k) => k === 111 || !c ? c : rgb((c & 255) * tint[0], (c >> 8 & 255) * tint[1], (c >> 16 & 255) * tint[2]));
  }
  // survivors: the 32x32 bodies (heads and headgear are stamped separately, by anchor)
  if (window.ART_HUMANS) { SPR.human = decodeSet(ART_HUMANS.bodies.human); SPR.humanVest = decodeSet(ART_HUMANS.bodies.humanVest || ART_HUMANS.bodies.human); }
}
const animOf = (set, name) => set.anims[name] ? name : 'walk';
// stamp rows so that their anchor (ax, ay) lands on (px, py); mirrored stamps flip around the anchor
function stampAnchored(st, rows, px, py, mirror, pal, d) {
  const x0 = px - (mirror ? st.w - 1 - st.ax : st.ax), y0 = py - st.ay;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[mirror ? row.length - 1 - x : x];
      if (ch === '.') continue;
      const sx = x0 + x + (mirror ? st.w - row.length : 0), sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const i = sy * W + sx;
      if (d <= zb[i]) continue;
      zb[i] = d; pix[i] = pal[ch.charCodeAt(0)];
    }
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
  const base = window.ART_HUMANS ? { ...ART_HUMANS.pal } : { ...ART.humanPal };
  // stripes a shade lighter than the shirt; dark trousers and light shoes as in the first version
  base.T = look.shirt.map(v => Math.min(255, v * 1.3 + 12)); base.t = look.shirt.map(v => v * 1.06);
  if (look.pants) { base.P = look.pants; base.p = look.pants.map(v => v * .74); }
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
// every sprite pixel drawn this frame that throws a shadow: x, height above the feet, feet row, feet z
// (preallocated: a growing array here made several hundred KB of garbage per frame)
const SHADOW_CAP = 1 << 16, spriteShadow = new Float32Array(SHADOW_CAP * 4);
let shadowN = 0;
function drawSprite(type, anim, view, idx, mirror, x, y, z, pal, opt = {}) {
  const set = SPR[type], frames = set.anims[anim][view], fr = frames[((idx % frames.length) + frames.length) % frames.length];
  const p = project(x, y, z), bx = Math.round(p.sx), by = Math.round(p.sy), ax = set.ax, ay = set.ay;
  const fade = opt.fade == null ? 1 : opt.fade, hit = opt.hit, cells = fr.cells, perPx = SIN / (S * COS), dz = opt.dz || 0;
  const shadow = opt.shadow !== false;
  for (let n = 0; n < cells.length; n += 3) {
    const cx = cells[n], cy = cells[n + 1], key = cells[n + 2];
    const sx = bx + (mirror ? ax - cx : cx - ax), sy = by + cy - ay;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    if (fade < 1 && bayerAt(sx, sy) >= fade) continue;
    const hpx = ay - cy, i = sy * W + sx, d = p.d + hpx * perPx + .02 + dz;
    if (d <= zb[i]) continue;
    zb[i] = d;
    pix[i] = hit && key !== 111 ? WHITE : pal[key];
    if (shadow && fade >= 1 && shadowN < SHADOW_CAP * 4) { spriteShadow[shadowN] = sx; spriteShadow[shadowN + 1] = hpx; spriteShadow[shadowN + 2] = by; spriteShadow[shadowN + 3] = z; shadowN += 4; }
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
const shMark = new Uint8Array(W * H), shList = new Int32Array(W * H);
const SHX = (SHADOW_X - SHADOW_Y) / R2 / COS, SHY = (SHADOW_X + SHADOW_Y) / R2 * SIN / COS;
function castSpriteShadows(kx, ky) {
  let listN = 0;
  for (let n = 0; n < shadowN; n += 4) {
    const sx = spriteShadow[n], hpx = spriteShadow[n + 1], by = spriteShadow[n + 2], z = spriteShadow[n + 3];
    const tx = Math.round(sx + hpx * kx), ty = Math.round(by + hpx * ky);
    // two pixels wide: the shadow is stretched sideways and would otherwise break into dots
    for (let o = 0; o < 2; o++) {
      const qx = tx + o;
      if (qx < 0 || ty < 0 || qx >= W || ty >= H) continue;
      const i = ty * W + qx;
      if (shMark[i] || zb[i] !== bakedZ[i]) continue;
      // only on the plane the figure stands on (the depth of that plane under this pixel, worked out inline)
      const dPlane = (ty + .5 + z * COS * S - OY) / (S * SIN) * COS + z * SIN;
      if (Math.abs(bakedZ[i] - dPlane) > .5) continue;
      shMark[i] = hpx < 2 ? 2 : 1; shList[listN++] = i;
    }
  }
  for (let n = 0; n < listN; n++) { const i = shList[n]; if (shMark[i] === 2) tint(i, .5, .48, .64); else tint(i, .66, .64, .8); shMark[i] = 0; }
  shadowN = 0;
}
