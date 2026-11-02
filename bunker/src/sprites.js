'use strict';
// Sprite frames: decoding, palettes and drawing them into the depth buffer, with their shadows.
/* ================= sprites ================= */
// frames come baked from art/*.js as rows of palette letters; decode once into flat cell lists
const SPR = {};
const colorCache = new Map();
const rgbOf = c => { const k = c.join(','); let v = colorCache.get(k); if (v === undefined) { v = rgb(...c); colorCache.set(k, v); } return v; };
// one sprite set into flat cell lists:
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
        return { cells, head: f.head, gun: f.gun, mag: f.mag, mouth: f.mouth };
      });
    }
  }
  return set;
}
const ZPALS = {};
// one crowd, many people: each zombie of a kind wears its own clothes and has its own skin tone.
// Per kind: which palette letters are the shirt or dress (top), the trousers (bottom) and the skin or bare flesh
// (skin); tone strengthens the skin tint for the mutants that wear little, whose skin has to tell them apart.
// Every other letter keeps its colour: eyes, mouths, teeth, bone, hair, the spitter's sac and acid, the
// regenerator's glow and veins, the burrower's mud, the giant's plates, rope and slab. The boss is one of a kind.
const ZVARY = {
  walker: { top: 'WCcx', bottom: 'UPpu', skin: 'kSsq' }, crawler: { top: 'WCcx', skin: 'kSsq' },
  runner: { top: 'YAax', bottom: 'UPpu', skin: 'kSsq' }, brute: { bottom: 'UPpu', skin: 'kSsq' },
  bloater: { top: 'WCcx', bottom: 'UPpu', skin: 'kSsq' }, armored: { top: 'VvxA', skin: 'kSsq' },
  spitter: { top: 'QRSTU', bottom: 'KLMNP', skin: 'abcde' }, screamer: { top: 'BCDEF', skin: 'RSTUV' },
  leaper: { bottom: 'GH', skin: 'IJKLM', tone: 2.5 }, burrower: { skin: 'QRSTU', tone: 4 },
  regenerator: { bottom: 'QRSTU', skin: 'FGHIJWXY', tone: 2.5 }, giant: { bottom: 'XYZab', skin: 'KLMNP', tone: 1.5 },
};
const SHIRTS = [[184, 174, 144], [156, 64, 54], [74, 96, 146], [104, 124, 80], [196, 164, 72], [118, 86, 128], [64, 128, 126], [128, 100, 74], [206, 204, 198]];
const PANTS = [[76, 94, 134], [62, 60, 68], [104, 84, 62], [72, 94, 72], [116, 72, 62], [54, 56, 86], [156, 138, 98], [128, 128, 132]];
const SKINS = [[1, 1, 1], [.92, 1.03, .9], [1.07, 1.04, .9], [.95, .95, 1.05], [1.1, 1, .98], [.86, .9, .86]];
const ZVARIANTS = 6, ZPAL_V = {};
// a kind's palettes: its own colours first, then the same kind in other clothes and other skin tones
function zombieVariants(type, pal) {
  const V = ZVARY[type], tone = V.tone || 1, lum = c => c[0] * .3 + c[1] * .59 + c[2] * .11;
  // a group of clothes: each letter keeps its shade against the group's lightest letter. The colours on offer
  // leave out any close to the kind's own clothes (worked back to the same terms), so no variant passes for the first
  const clothes = (letters, list) => {
    const keys = [...letters].filter(k => pal[k]), top = Math.max(...keys.map(k => lum(pal[k])), 1);
    const shade = keys.map(k => .35 + lum(pal[k]) / top * .75);
    const own = [0, 1, 2].map(n => keys.reduce((s, k, i) => s + pal[k][n] / shade[i], 0) / keys.length);
    return { keys, shade, list: list.filter(c => Math.hypot(c[0] - own[0], c[1] - own[1], c[2] - own[2]) > 40) };
  };
  const groups = [V.top && clothes(V.top, SHIRTS), V.bottom && clothes(V.bottom, PANTS)].filter(Boolean), out = [paletteOf(pal)];
  for (let v = 1; v < ZVARIANTS; v++) {
    const p = { ...pal };
    for (const g of groups) {
      const base = g.list[(v + type.length) % g.list.length];
      g.keys.forEach((k, i) => { p[k] = base.map(x => Math.min(255, x * g.shade[i])); });
    }
    for (const k of V.skin) if (pal[k]) p[k] = pal[k].map((x, n) => Math.min(255, x * (1 + (SKINS[v][n] - 1) * tone)));
    out.push(paletteOf(p));
  }
  return out;
}
function loadSprites() {
  for (const pack of [ART_ZOMBIES_A, ART_ZOMBIES_B]) for (const [type, s] of Object.entries(pack.types)) {
    SPR[type] = decodeSet(s); ZPALS[type] = paletteOf(s.pal);
    // kinds without a ZVARY entry (the boss, and the burrower's mound of earth) keep their one palette
    ZPAL_V[type] = ZVARY[type] ? zombieVariants(type, s.pal) : [ZPALS[type]];
  }
  // survivors: the 32x32 bodies (heads and headgear are stamped separately, by anchor)
  SPR.human = decodeSet(ART_HUMANS.bodies.human); SPR.humanVest = decodeSet(ART_HUMANS.bodies.humanVest);
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
  const base = { ...ART_HUMANS.pal };
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
// what drawSprite answers: the frame, the anchor's spot on screen (bx, by), the mirroring and the projected feet p.
// One object refilled by every call, so a crowd makes no garbage: callers read it at once and never keep it
const SPRITE_AT = { fr: null, bx: 0, by: 0, mirror: false, ax: 0, ay: 0, p: { sx: 0, sy: 0, d: 0 } };
const NO_OPT = {};
function drawSprite(type, anim, view, idx, mirror, x, y, z, pal, opt = NO_OPT) {
  const set = SPR[type], frames = set.anims[anim][view], fr = frames[((idx % frames.length) + frames.length) % frames.length];
  const p = projectTo(SPRITE_AT.p, x, y, z), bx = Math.round(p.sx), by = Math.round(p.sy), ax = set.ax, ay = set.ay;
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
  const at = SPRITE_AT;
  at.fr = fr; at.bx = bx; at.by = by; at.mirror = mirror; at.ax = ax; at.ay = ay;
  return at;
}
// spot of a frame's anchor point (e.g. the head or the gun) on screen
function frameSpot(info, pt) { return [info.bx + (info.mirror ? info.ax - pt[0] : pt[0] - info.ax), info.by + pt[1] - info.ay]; }
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
