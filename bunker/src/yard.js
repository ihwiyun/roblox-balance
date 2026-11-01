'use strict';
// The yard: the island, the bunker in all its levels, the props around it and the fence.
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
/* ================= the drawing kit (private to this file) ================= */
const YARD_ART = (() => {
  // one screen pixel measured along a wall (PXA) and up a wall (PXZ), in world units
  const PXA = R2 / S, PXZ = 1 / (S * COS), GROW = .03;
  const rep = (a, p, o = 0) => { const m = (a - o) % p; return m < 0 ? m + p : m; };
  const col = (r, g, b) => rgb(r, g, b);
  // a box drawn face by face with one sample per screen pixel (box() samples each pixel about eight times).
  // pat(face, a, b) changes the shade (a small number) or paints the spot (an rgb colour);
  // face 0 is the top (a = x, b = y), 1 the +y wall (a = x, b = z), 2 the +x wall (a = y, b = z)
  function pbox(x0, y0, z0, x1, y1, z1, c, seed = 0, pat = null, grain = 1) {
    const ramp = rampOf(c), gk = 1.3 * grain, longX = x1 - x0 >= y1 - y0;
    const ex0 = x0 - GROW, ex1 = x1 + GROW, ey0 = y0 - GROW, ey1 = y1 + GROW, ez0 = z0 - GROW, ez1 = z1 + GROW;
    const put = (i, ix, iy, d, base, gx, gy, face, a, b) => {
      let s = base + (bayerAt(ix, iy) - .5) * .5;
      if (gk) s += (noise(gx, gy) - .5) * gk;
      if (pat) { const r = pat(face, a, b); if (r > 255) { zb[i] = d; pix[i] = r; return; } s += r || 0; }
      zb[i] = d; pix[i] = ramp[s < 0 ? 0 : s >= 4 ? 4 : s | 0];
    };
    // the top
    const r0 = Math.max(0, Math.floor(OY + ((ex0 + ey0) / R2 * SIN - z1 * COS) * S)), r1 = Math.min(H - 1, Math.floor(OY + ((ex1 + ey1) / R2 * SIN - z1 * COS) * S));
    for (let iy = r0; iy <= r1; iy++) {
      const v = ((iy + .5 - OY) / S + z1 * COS) / SIN, uLo = Math.max(ex0 * R2 - v, v - ey1 * R2), uHi = Math.min(ex1 * R2 - v, v - ey0 * R2);
      if (uLo > uHi) continue;
      const a = Math.max(0, Math.ceil(OX + uLo * S - .5)), b = Math.min(W - 1, Math.floor(OX + uHi * S - .5)), d = v * COS + z1 * SIN;
      for (let ix = a; ix <= b; ix++) {
        const i = iy * W + ix;
        if (d <= zb[i]) continue;
        const u = (ix + .5 - OX) / S, x = (u + v) / R2, y = (v - u) / R2;
        put(i, ix, iy, d, 3.4, longX ? x * .8 + seed : x * 9, longX ? y * 9 : y * .8 + seed, 0, x, y);
      }
    }
    // the +y wall, column by column
    let ca = Math.max(0, Math.ceil(OX + (ex0 - y1) / R2 * S - .5)), cb = Math.min(W - 1, Math.floor(OX + (ex1 - y1) / R2 * S - .5));
    for (let ix = ca; ix <= cb; ix++) {
      const u = (ix + .5 - OX) / S, x = u * R2 + y1, v = (x + y1) / R2;
      const ra = Math.max(0, Math.ceil(OY + (v * SIN - ez1 * COS) * S - .5)), rb = Math.min(H - 1, Math.floor(OY + (v * SIN - ez0 * COS) * S - .5));
      for (let iy = ra; iy <= rb; iy++) {
        const z = (v * SIN - (iy + .5 - OY) / S) / COS, d = v * COS + z * SIN, i = iy * W + ix;
        if (d > zb[i]) put(i, ix, iy, d, 2.3, x * .8 + seed, z * 9, 1, x, z);
      }
    }
    // the +x wall
    ca = Math.max(0, Math.ceil(OX + (x1 - ey1) / R2 * S - .5)); cb = Math.min(W - 1, Math.floor(OX + (x1 - ey0) / R2 * S - .5));
    for (let ix = ca; ix <= cb; ix++) {
      const u = (ix + .5 - OX) / S, y = x1 - u * R2, v = (x1 + y) / R2;
      const ra = Math.max(0, Math.ceil(OY + (v * SIN - ez1 * COS) * S - .5)), rb = Math.min(H - 1, Math.floor(OY + (v * SIN - ez0 * COS) * S - .5));
      for (let iy = ra; iy <= rb; iy++) {
        const z = (v * SIN - (iy + .5 - OY) / S) / COS, d = v * COS + z * SIN, i = iy * W + ix;
        if (d > zb[i]) put(i, ix, iy, d, 1.2, y * .8 + seed, z * 9, 2, y, z);
      }
    }
  }
  // the shadow of a box (from z0 up to z1) on the ground: its footprint swept along the light, dithered at the rim
  function shade(x0, y0, x1, y1, z0, z1, strength = 1) {
    if (z1 <= .01) return;
    const sx = SHADOW_X, sy = SHADOW_Y;
    let a = 1e9, b = 1e9, c = -1e9, e = -1e9;
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const t of [z0, z1]) {
      const p = project(x + sx * t, y + sy * t, 0);
      a = Math.min(a, p.sx); c = Math.max(c, p.sx); b = Math.min(b, p.sy); e = Math.max(e, p.sy);
    }
    const inside = (gx, gy, g) => {
      let lo = z0, hi = z1;
      lo = Math.max(lo, (gx - x1 - g) / sx); hi = Math.min(hi, (gx - x0 + g) / sx);
      if (sy < 0) { lo = Math.max(lo, (gy - y0 + g) / sy); hi = Math.min(hi, (gy - y1 - g) / sy); }
      else if (sy > 0) { lo = Math.max(lo, (gy - y1 - g) / sy); hi = Math.min(hi, (gy - y0 + g) / sy); }
      else if (gy < y0 - g || gy > y1 + g) return false;
      return lo <= hi;
    };
    const ia = Math.max(0, Math.floor(a) - 1), ib = Math.min(W - 1, Math.ceil(c) + 1), ja = Math.max(0, Math.floor(b) - 1), jb = Math.min(H - 1, Math.ceil(e) + 1);
    for (let iy = ja; iy <= jb; iy++) for (let ix = ia; ix <= ib; ix++) {
      const u = (ix + .5 - OX) / S, v = (iy + .5 - OY) / (S * SIN), gx = (u + v) / R2, gy = (v - u) / R2;
      if (!inside(gx, gy, .05)) continue;
      if (!inside(gx, gy, -.03) && bayerAt(ix, iy) < .5) continue;
      const i = iy * W + ix;
      if (shadowMask[i] < strength) shadowMask[i] = strength;
    }
  }
  // a box and its shadow
  function solid(x0, y0, z0, x1, y1, z1, c, seed, pat, grain) { pbox(x0, y0, z0, x1, y1, z1, c, seed, pat, grain); shade(x0, y0, x1, y1, z0, z1); }
  // a square post
  function post(x, y, z0, z1, w, c, seed = 7, pat = null) { solid(x - w, y - w, z0, x + w, y + w, z1, c, seed, pat); }
  // a bar along x or along y between two points, t thick and h tall
  function bar(ax, ay, bx, by, z, t, h, c, seed = 5, pat = null) { solid(Math.min(ax, bx) - t, Math.min(ay, by) - t, z, Math.max(ax, bx) + t, Math.max(ay, by) + t, z + h, c, seed, pat); }
  // a pixel line with a shadow under it
  function wire(a, b, color, dense = 1, shadow = true) { line3(a, b, color, dense); if (shadow) for (let t = 0; t <= 1; t += .1) castShadow(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), .03, 1, 0); }
  // a lamp: a dark housing and a lit pixel that glows every frame
  function lamp(x, y, z, c = [255, 236, 170], s = .07) {
    pbox(x - s, y - s, z, x + s, y + s, z + 2 * s, DARK, 99);
    pbox(x + s - .01, y - s * .6, z + s * .4, x + s + .02, y + s * .6, z + s * 1.6, c, 1, null, 0);
    pbox(x - s * .6, y + s - .01, z + s * .4, x + s * .6, y + s + .02, z + s * 1.6, c, 1, null, 0);
    glow(x + s, y + s, z + s, c);
  }
  // a light that is only a glowing point on something
  function bulb(x, y, z, c = [255, 236, 170]) { plot(x, y, z, rgb(...c)); glow(x, y, z, c); }
  // a ladder up a +y wall ('y': s is x along the wall, w the wall's y) or a +x wall ('x': s is y, w is x)
  function ladder(axis, s, w, z0, z1, c = METAL) {
    const side = (a0, a1, b0, b1, z, zz, seed) => axis === 'y' ? pbox(a0, w + b0, z, a1, w + b1, zz, c, seed) : pbox(w + b0, a0, z, w + b1, a1, zz, c, seed);
    for (const o of [-.17, .17]) side(s + o - .03, s + o + .03, 0, .06, z0, z1, 6);
    for (let z = z0 + .22; z < z1 - .05; z += .24) side(s - .17, s + .17, .01, .06, z, z + .035, 7);
  }
  // a railing round a rectangle; sides: 0 the +y edge, 1 the +x edge, 2 the -y edge, 3 the -x edge
  function railing(x0, y0, x1, y1, z, h, c, sides = [0, 1, 2, 3], gap = .55, t = .025) {
    const edges = [[x0, y1, x1, y1], [x1, y0, x1, y1], [x0, y0, x1, y0], [x0, y0, x0, y1]];
    for (const sd of sides) {
      const [ax, ay, bx, by] = edges[sd], n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / gap));
      for (let k = 0; k <= n; k++) post(lerp(ax, bx, k / n), lerp(ay, by, k / n), z, z + h, t, c, 8);
      bar(ax, ay, bx, by, z + h - t * 2, t, t * 2, c, 9); bar(ax, ay, bx, by, z + h * .5, t * .8, t * 1.6, c, 9);
    }
  }
  // sandbags laid along a straight line like bricks, `courses` high
  const BAGS = [[190, 166, 116], [178, 156, 106], [198, 178, 128], [170, 152, 108]];
  function bagLine(ax, ay, bx, by, z, courses, w = .15, len = .42) {
    const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / len)), alongX = Math.abs(bx - ax) >= Math.abs(by - ay), hl = L / n / 2 - .03;
    for (let r = 0; r < courses; r++) for (let k = 0; k < n - (r & 1); k++) {
      const t = (k + .5 + (r & 1) * .5) / n, cx = lerp(ax, bx, t), cy = lerp(ay, by, t), zz = z + r * .155, c = BAGS[(hash(cx * 7 + r, cy * 5) * 4) | 0];
      const pat = (f, a, b) => {
        // tied ends and a crease at the bottom are darker, the rounded top catches the light
        const e = f === 0 ? (alongX ? a - cx : b - cy) : f === 1 ? (alongX ? a - cx : 0) : (alongX ? 0 : a - cy), rz = f ? b - zz : .08;
        return Math.abs(e) > hl - .05 ? -1.2 : rz < .035 ? -1.3 : rz > .11 ? .8 : 0;
      };
      if (alongX) pbox(cx - hl, cy - w, zz, cx + hl, cy + w, zz + .15, c, k + r * 7, pat);
      else pbox(cx - w, cy - hl, zz, cx + w, cy + hl, zz + .15, c, k + r * 7, pat);
    }
    shade(Math.min(ax, bx) - w, Math.min(ay, by) - w, Math.max(ax, bx) + w, Math.max(ay, by) + w, z, z + courses * .155);
  }
  // a wooden or steel crate with a frame round each face; mark paints the middle of the walls
  function crateAt(x, y, z, sx, sy, sz, c, seed, mark = 0) {
    solid(x - sx, y - sy, z, x + sx, y + sy, z + sz, c, seed, (f, a, b) => {
      if (f === 0) return Math.abs(a - x) > sx - .05 || Math.abs(b - y) > sy - .05 ? -1 : 0;
      const rel = (a - (f === 1 ? x : y)) / (f === 1 ? sx : sy), rz = (b - z) / sz * 2 - 1;
      if (Math.abs(rel) > .8 || Math.abs(rz) > .7) return -1.3;
      if (mark && Math.abs(rel) < .45 && Math.abs(rz) < .3) return mark;
      return 0;
    });
  }
  // a steel drum (square, with two bands)
  function drum(x, y, z, r, c, seed) {
    const h = r * 2.7;
    solid(x - r, y - r, z, x + r, y + r, z + h, c, seed, (f, a, b) => f ? (Math.abs(b - z - h * .33) < .025 || Math.abs(b - z - h * .7) < .025 ? -1.3 : 0) : (Math.abs(a - x - r * .4) < .04 && Math.abs(b - y - r * .4) < .04 ? -2 : 0), .5);
  }
  // the hatch the crew climb down through
  function hatch(x, y, z, c = STEEL) {
    pbox(x - .27, y - .27, z, x + .27, y + .27, z + .03, DARK, 3);
    pbox(x - .21, y - .21, z + .03, x + .21, y + .21, z + .07, c, 4, (f, a, b) => f === 0 && (Math.abs(a - x) < .04 || Math.abs(b - y) < .04) ? -1.2 : 0);
    SITES.hatch = [x, y, z];
  }
  // six gunner spots over open roof round (cx, cy): the hero in front, then left, right and a back row
  const SPOT_UV = [[0, .62], [-.8, .18], [.8, .18], [-.42, -.4], [.42, -.4], [0, -.92]];
  function spots(cx, cy, ax, ay, z) { SITES.length = 0; for (const [u, v] of SPOT_UV) SITES.push([cx + (u + v) * ax, cy + (v - u) * ay, z]); }
  // a pole with a flag
  function flag(x, y, z0, len, c, w = .5) {
    post(x, y, z0, z0 + len, .025, DARK, 11);
    const r = rampOf(c);
    for (let a = .03; a <= w; a += PXA * .7) for (let z = z0 + len - .34; z <= z0 + len - .02; z += PXZ * .7) plot(x + a * .72, y - a * .72, z - Math.sin(a * 7) * .04, r[z < z0 + len - .28 ? 1 : a > w * .55 ? 2 : 3]);
    shade(x, y, x + w * .7, y + .02, z0 + len - .34, z0 + len);
  }
  // tiny stencil letters (3 x 5 pixels), painted on a wall through a pattern
  const FONT = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001', 5: '111100111001111',
    6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', A: '010101111101101', B: '110101110101110',
    C: '011100100100011', D: '110101101101110', E: '111100110100111', H: '101101111101101', K: '101101110101101', N: '101111111111101',
    O: '111101101101111', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', X: '101101010101101',
    '-': '000000111000000', '+': '000010111010000', ' ': '000000000000000',
  };
  // dir 1 for a +y wall (letters run along +x), -1 for a +x wall (they run along -y); size: pixels per letter pixel
  function textAt(str, a0, b0, color, dir = 1, size = 1) {
    const pa = PXA * size, pz = PXZ * size;
    return (a, b) => {
      const cx = Math.floor((a - a0) * dir / pa), row = Math.floor((b0 - b) / pz);
      if (cx < 0 || row < 0 || row > 4) return 0;
      const ch = str[Math.floor(cx / 4)], g = FONT[ch], x = cx % 4;
      return g && x < 3 && g[row * 3 + x] === '1' ? color : 0;
    };
  }
  // crisp pixel-art edges over everything drawn so far (the engine's shadeEdges, kept to the drawn area):
  // a dark rim where an object meets the ground, a warm rim on a near edge, a dark line behind one
  function outline() {
    const b = objectBounds(groundZ, 1);
    if (!b) return;
    for (let iy = Math.max(1, b[1]); iy < Math.min(H - 1, b[3]); iy++) for (let ix = Math.max(1, b[0]); ix < Math.min(W - 1, b[2]); ix++) {
      const i = iy * W + ix, d = zb[i];
      if (d < -1e8 || d === groundZ[i]) continue;
      const a = i - W, c = i - 1, e = i + 1, f = i + W;
      if (zb[a] === groundZ[a] || zb[f] === groundZ[f] || zb[c] === groundZ[c] || zb[e] === groundZ[e]) tint(i, .62, .6, .72);
      else if (d - zb[a] - GRADIENT_Y > EDGE || d - zb[c] > EDGE) { const p = pix[i]; pix[i] = rgb(lerp(p & 255, WARM[0], .28), lerp(p >> 8 & 255, WARM[1], .28), lerp(p >> 16 & 255, WARM[2], .2)); }
      else if (zb[e] - d > EDGE || zb[f] - GRADIENT_Y - d > EDGE) tint(i, .72, .7, .8);
    }
  }
  // paint in another colour that still takes the face's light: the top bright, the +y wall mid, the +x wall dark
  const tone = (c, f, d = 0) => { const r = rampOf(c), i = (f === 0 ? 3 : f === 1 ? 2 : 1) + d; return r[i < 0 ? 0 : i > 4 ? 4 : i]; };
  // several patterns over one face: the first that paints something wins
  const pats = (...list) => (f, a, b) => { let shade = 0; for (const p of list) { if (!p) continue; const r = p(f, a, b); if (r > 255) return r; shade += r || 0; } return shade; };
  return { tone, outline, PXA, PXZ, rep, col, pbox, shade, solid, post, bar, wire, lamp, bulb, ladder, railing, bagLine, crateAt, drum, hatch, spots, flag, textAt, pats, FONT };
})();
/* ================= the bunker: ten forms of ten levels; every level adds something you can see ================= */
const BUNKER_ART = (() => {
  const { tone, outline, PXA, PXZ, rep, col, pbox, shade, solid, post, bar, wire, lamp, bulb, ladder, railing, bagLine, crateAt, drum, hatch, spots, flag, textAt, pats } = YARD_ART;
  const RED = [190, 58, 46], YEL = [226, 184, 52], WHITE = [226, 224, 214], BLACK = [40, 38, 44], RUST = [150, 86, 54];
  // planks running along y, seams every .3 along x, a few dark knots
  const plankTop = (w = .3) => (f, a, b) => f === 0 ? (rep(a, w) < PXA * 1.1 ? -1.3 : hash(Math.floor(a / w), Math.floor(b * 2)) > .9 ? -.5 : 0) : 0;
  // log posts: vertical bark lines
  const logPat = (f, a) => f && rep(a, .1) < .035 ? -.9 : 0;
  // horizontal boards on walls
  const boards = (h = .2, o = 0) => (f, a, b) => f && rep(b, h, o) < PXZ * 1.1 ? -1.2 : 0;

  /* ---- 1. a foxhole: a plank floor ringed with sandbags ---- */
  function foxhole(k, I) {
    const h = I.half, d = I.deck, top = I.roof, has = n => k >= n, r = h - .15;
    solid(-d, -d, 0, d, d, top, PLANK, 3, plankTop(.32));
    // the dug-out soil heaped behind
    for (const [x0, y0, x1, y1, z] of [[-h - .5, -h - .5, h - .3, -h - .05, .22], [-h - .5, -h - .05, -h - .05, h - .3, .22], [-h - .35, -h - .35, -.2, -h - .1, .38], [-h - .35, -h - .1, -h - .1, -.2, .38]]) solid(x0, y0, 0, x1, y1, z, DIRT, 8, null, 1.4);
    // two courses of sandbags all round
    bagLine(-r, r, r, r, 0, 2); bagLine(r, -r, r, r, 0, 2); bagLine(-r, -r, r, -r, 0, 2); bagLine(-r, -r, -r, r, 0, 2);
    // a shovel stuck in the heap and a loose plank
    wire([-h - .25, -.9, .25], [-h - .3, -.95, 1.05], rampOf(WOOD)[2]);
    pbox(-h - .37, -1.0, .1, -h - .23, -.9, .32, METAL, 2);
    pbox(.2, h + .2, 0, 1.0, h + .36, .05, PLANK, 4);
    if (has(1)) { // ammo crates, olive with a yellow stencil band
      crateAt(-.75, h + .42, 0, .22, .16, .3, OLIVE, 4, col(214, 178, 60));
      crateAt(-.25, h + .42, 0, .2, .16, .28, OLIVE, 5, col(214, 178, 60));
      crateAt(-.55, h + .42, .3, .2, .15, .26, [92, 104, 70], 6, col(214, 178, 60));
    }
    if (has(2)) { // a plank shield wall on the back bags, with a gun slit
      const z0 = .31, z1 = .95, slit = (f, a, b) => f && b > .6 && b < .7 && rep(a, 1.1, .3) < .35 ? col(30, 28, 34) : 0;
      solid(-r - .08, -r - .08, z0, -r + .02, r - .25, z1, WOOD, 3, pats(slit, boards(.16, z0)));
      solid(-r - .08, -r - .08, z0, r - .25, -r + .02, z1, WOOD, 4, pats(slit, boards(.16, z0)));
      for (const [x, y] of [[-r - .03, -r - .03], [-r - .03, r - .3], [r - .3, -r - .03], [-r - .03, -.2], [-.2, -r - .03]]) post(x, y, 0, z1 + .08, .05, [118, 84, 54], 3, logPat);
    }
    if (has(3)) { // a machine gun on a tripod at the front corner
      const x = r - .05, y = r - .05, z = .31;
      for (const [dx, dy] of [[-.22, .05], [.05, -.22], [.12, .12]]) wire([x + dx, y + dy, z], [x, y, z + .3], rampOf(DARK)[1], 1, false);
      pbox(x - .12, y - .12, z + .3, x + .1, y + .1, z + .42, DARK, 5);
      pbox(x - .05, y - .05, z + .27, x + .08, y + .08, z + .35, OLIVE, 6);
      for (const w of [0, .02]) line3([x + .05 + w, y + .05, z + .38], [x + .55 + w, y + .55, z + .43], rampOf(DARK)[w ? 0 : 2]);
      pbox(x - .26, y - .02, z + .26, x - .1, y + .14, z + .38, OLIVE, 7);
    }
    if (has(4)) { // the pit was dug wider: a firing step of planks along the front
      pbox(-d + .1, d - .25, top, d - .2, d - .05, top + .08, [150, 112, 72], 9);
      pbox(d - .25, -d + .1, top, d - .05, d - .2, top + .08, [150, 112, 72], 9);
    }
    if (has(5)) { // a lantern on a pole at the right corner
      const x = r + .2, y = -r - .2;
      post(x, y, 0, 1.45, .045, WOOD, 3, logPat);
      bar(x - .02, y, x + .3, y, 1.38, .02, .04, WOOD);
      lamp(x + .3, y, 1.12, [255, 206, 110], .06);
      wire([x + .3, y, 1.24], [x + .3, y, 1.38], rampOf(DARK)[1], 1, false);
    }
    if (has(6)) { // a camouflage net on two poles over the ammo corner
      const x0 = -1.15, x1 = .05, y0 = h + .05, y1 = h + .8;
      for (const [x, y] of [[x0, y1], [x1, y1]]) post(x, y, 0, .95, .03, WOOD, 5);
      for (let x = x0; x <= x1; x += PXA * .8) for (let y = y0; y <= y1; y += PXA * .8) {
        const n = noise(x * 3.1, y * 3.1), z = .95 - (y1 - y) * .55 + Math.sin(x * 9) * .02;
        if (hash(x * 40 | 0, y * 40 | 0) < .3) continue;
        plot(x, y, z, n > .6 ? col(92, 104, 62) : n > .42 ? col(122, 128, 78) : n > .3 ? col(134, 110, 74) : col(70, 84, 56));
      }
      shade(x0, y0, x1, y1, .6, .95);
    }
    if (has(7)) { // a field radio with a whip antenna, on a crate
      const x = h + .38, y = -.55;
      crateAt(x, y, 0, .18, .2, .24, [120, 110, 80], 8);
      pbox(x - .14, y - .15, .24, x + .12, y + .13, .46, [84, 96, 70], 9, (f, a, b) => f === 2 && b > .3 && b < .4 && rep(a, .08) < .04 ? col(220, 200, 120) : 0);
      wire([x - .08, y - .1, .46], [x - .12, y - .14, 1.75], rampOf(DARK)[1]);
      bulb(x + .125, y - .05, .4, [120, 255, 140]);
    }
    if (has(8)) { // barbed wire on crossed stakes round the front
      const o = h + .55, barb = rampOf(DARK)[1], wireC = rampOf(METAL)[2];
      for (const side of [0, 1]) {
        const at = t => side ? [o, t] : [t, o];
        for (let t = -h; t <= h + .01; t += (2 * h) / 4) { const [x, y] = at(t); wire([x - .1, y - .1, 0], [x + .08, y + .08, .42], rampOf(WOOD)[1]); wire([x + .1, y - .1, 0], [x - .08, y + .08, .42], rampOf(WOOD)[1]); }
        for (const z of [.18, .34]) for (let t = -h; t <= h; t += PXA * .5) { const [x, y] = at(t); plot(x, y, z + Math.sin(t * 13) * .015, hash(t * 90 | 0, z * 9 | 0) > .82 ? barb : wireC); }
      }
    }
    if (has(9)) flag(-r - .05, -r - .05, .95, 1.5, [196, 60, 48]);
    spots(.08, .08, d - .26, d - .26, top);
    hatch(.04, .04, top, [150, 112, 72]);
  }

  /* ---- 2. a wooden watchtower ---- */
  function watchtower(k, I) {
    const h = I.half, top = I.roof, p = 1.12, has = n => k >= n, logs = [118, 84, 54];
    for (const [x, y] of [[-p, -p], [p, -p], [-p, p], [p, p]]) post(x, y, 0, top - .14, .11, logs, 1, logPat);
    if (has(1)) { // X braces between the posts on every side
      const br = rampOf(WOOD);
      for (const w of [0, .03]) {
        line3([-p, p + .12 + w, .2], [p, p + .12 + w, top - .3], br[2]); line3([p, p + .12 + w, .2], [-p, p + .12 + w, top - .3], br[1]);
        line3([p + .12 + w, -p, .2], [p + .12 + w, p, top - .3], br[1]); line3([p + .12 + w, p, .2], [p + .12 + w, -p, top - .3], br[0]);
      }
      bar(-p, p + .1, p, p + .1, .55, .04, .07, WOOD); bar(p + .1, -p, p + .1, p, .55, .04, .07, WOOD);
    }
    if (has(3)) { // the lower floor is boarded in: a door and a small window
      const z1 = 1.25, door = (f, a, b) => f === 1 && Math.abs(a + .3) < .24 && b < 1.0 ? (Math.abs(a + .3) > .2 || b > .95 ? col(70, 50, 36) : rep(a, .13) < .03 ? col(84, 60, 40) : col(110, 78, 50)) : 0;
      const win = (f, a, b) => f === 2 && Math.abs(a - .2) < .22 && b > .6 && b < .95 ? (Math.abs(a - .2) > .18 || b < .64 || b > .91 ? col(70, 50, 36) : Math.abs(a - .2) < .02 ? col(70, 50, 36) : col(255, 214, 130)) : 0;
      solid(-p + .02, -p + .02, 0, p - .02, p - .02, z1, [160, 118, 76], 12, pats(door, win, boards(.17)));
      bulb(p - .02, .2, .78, [255, 214, 130]);
    }
    // the platform: planks, with the joist ends showing on the sides
    const ends = (f, a, b) => f && b < top - .05 && rep(a, .4, .1) < .1 ? -1.4 : 0;
    solid(-h, -h, top - .17, h, h, top, PLANK, 2, pats(plankTop(.26), ends));
    if (has(4)) for (const [x, y, dx, dy] of [[p, p, 1, 1], [-p, p, -1, 1], [p, -p, 1, -1]]) { // brackets under the wider platform
      for (const w of [0, .03]) { line3([x + dx * .02, y + w, top - .8], [x + dx * (h - p), y + w, top - .2], rampOf(WOOD)[1]); line3([x + w, y + dy * .02, top - .8], [x + w, y + dy * (h - p), top - .2], rampOf(WOOD)[2]); }
    }
    ladder('y', .45, h + .02, 0, top + .45, [150, 112, 72]);
    if (has(2)) railing(-h + .04, -h + .04, h - .04, h - .04, top, .46, WOOD, [0, 1, 2, 3], .6, .03);
    const hx = -h + .06, hut = .8;
    if (has(5)) { // a lookout hut on the back corner: plank walls, a window each way, a stepped roof
      const win = (f, a, b) => f && b > top + .45 && b < top + .78 && Math.abs(a - (hx + hut / 2)) < .22 ? (Math.abs(a - (hx + hut / 2)) > .18 || b < top + .49 ? col(70, 50, 36) : col(40, 34, 40)) : 0;
      solid(hx, hx, top, hx + hut, hx + hut, top + 1.05, [164, 120, 78], 14, pats(win, boards(.17, top)));
      for (let s = 0; s < 4; s++) pbox(hx - .12 + s * .07, hx - .12 + s * .07, top + 1.05 + s * .07, hx + hut + .12 - s * .07, hx + hut + .12 - s * .07, top + 1.12 + s * .07, s & 1 ? [120, 86, 58] : [134, 96, 62], 15 + s, (f, a, b) => f === 0 ? 0 : -.4);
    }
    if (has(6)) for (const [x, y] of [[h - .04, h - .04], [-h + .04, h - .04], [h - .04, -h + .04]]) { // lanterns hung from the railing
      wire([x, y, top + .46], [x + .04, y + .04, top + .3], rampOf(DARK)[1], 1, false);
      lamp(x + .04, y + .04, top + .14, [255, 206, 110], .06);
    }
    if (has(7)) for (let t = -h; t <= h; t += .32) for (const [x, y, dx, dy] of [[t, h + .35, 0, 1], [h + .35, t, 1, 0]]) { // sharpened stakes round the base
      const tip = [x + dx * .32, y + dy * .32, .62], c = rampOf(WOOD)[2];
      for (const w of [0, .025]) line3([x + w, y + w, 0], tip, c);
      plot(...tip, rampOf([226, 200, 160])[3]);
      castShadow(x + dx * .15, y + dy * .15, .3, .05, 1, 0);
    }
    if (has(8)) { // loudspeaker horns on a pole over the hut
      const x = hx + hut / 2, y = hx + hut / 2, z = top + 1.35;
      post(x, y, z - .1, z + .7, .03, DARK, 11);
      for (const [dx, dy] of [[1, 0], [0, 1]]) for (let s = 0; s < 4; s++) { const o = .08 + s * .05, w = .05 + s * .025; pbox(x + dx * o - (dx ? .03 : w), y + dy * o - (dy ? .03 : w), z + .55 - w, x + dx * o + (dx ? .03 : w), y + dy * o + (dy ? .03 : w), z + .55 + w, s === 3 ? [70, 74, 80] : [196, 200, 190], 12); }
    }
    if (has(9)) { // a pulley hoist: a jib over the +x side, a rope and a crate on the way up
      const y = -.98, x0 = h - .22, x1 = h + .55, z = top + 1.05;
      post(x0, y, top, z + .05, .05, logs, 3, logPat);
      bar(x0, y, x1, y, z, .045, .09, logs);
      wire([x1 - .05, y, z], [x1 - .05, y, .82], rampOf(ROPE)[2]);
      crateAt(x1 - .05, y, .42, .19, .19, .38, PLANK, 16, -1.2);
      wire([x1 - .05, y, .8], [x1 - .2, y - .15, .8], rampOf(ROPE)[2], 1, false); wire([x1 - .05, y, .8], [x1 + .1, y + .15, .8], rampOf(ROPE)[2], 1, false);
    }
    // gunners stay in front of the hut
    spots(.3, .3, h - .62, h - .62, top);
    hatch(.27, .27, top, [150, 112, 72]);
  }

  /* ---- 3. a container post: two shipping containers side by side, later a third stacked on top ---- */
  const ribs = (a, b, lo, hi, z0, z1) => {
    if (b < z0 + .1 || b > z1 - .1) return -.7;
    if (a < lo + .08 || a > hi - .08) return -1.3;
    const m = rep(a, .15);
    return m < PXA ? -1.1 : m < PXA * 2 ? .7 : 0;
  };
  // the door end of a container: two leaves, four lock rods, pressed panels
  const doorEnd = (a, b, lo, hi, z0, z1) => {
    if (b < z0 + .1 || b > z1 - .12) return -.7;
    if (a < lo + .08 || a > hi - .08) return -1.3;
    if (Math.abs(a - (lo + hi) / 2) < PXA * .6) return -1.8;
    for (const t of [.22, .4, .6, .78]) if (Math.abs(a - lerp(lo, hi, t)) < PXA * .55) return b > z0 + .15 && b < z1 - .15 ? (Math.abs(b - (z0 + z1) * .5) < .06 ? col(50, 50, 56) : col(204, 206, 200)) : 0;
    return rep(b - z0, .3) < PXZ ? -.6 : 0;
  };
  const dents = (a) => rep(a, .3) < PXA ? -.6 : 0;
  function containers(k, I) {
    const hx = I.half, hy = I.half - .2, top = I.roof, has = n => k >= n, white = col(232, 230, 220);
    const ORANGE = [178, 86, 52], BLUE = [62, 104, 138], GREEN = [88, 116, 74];
    const marks = has(1) ? (f, a, b) => f === 1 ? (b > 1.6 && b < 1.68 ? white : textAt('27', -.2, 1.48, white, 1, 2)(a, b)) : 0 : null;
    const win = has(3) ? (f, a, b) => f === 1 && a > -.95 && a < -.42 && b > .82 && b < 1.3 ? (a < -.9 || a > -.47 || b < .87 || b > 1.25 ? col(64, 60, 62) : col(34, 30, 38)) : 0 : null;
    solid(-hx, .02, 0, hx, hy, top, ORANGE, 1, pats(marks, win, (f, a, b) => f === 0 ? dents(a) : f === 1 ? ribs(a, b, -hx, hx, 0, top) : doorEnd(a, b, .02, hy, 0, top)));
    const winB = has(3) ? (f, a, b) => f === 2 && a > -1.05 && a < -.55 && b > .82 && b < 1.3 ? (a < -1.0 || a > -.6 || b < .87 || b > 1.25 ? col(60, 64, 70) : col(30, 30, 38)) : 0 : null;
    const markB = has(1) ? (f, a, b) => f === 2 ? textAt('B2', -.15, 1.62, white, -1, 1)(a, b) : 0 : null;
    solid(-hx, -hy, 0, hx, -.02, top, BLUE, 2, pats(markB, winB, (f, a, b) => f === 0 ? dents(a) : f === 1 ? ribs(a, b, -hx, hx, 0, top) : doorEnd(a, b, -hy, -.02, 0, top)));
    if (has(3)) { // the gun ports' shutters, propped open like awnings
      for (const [x0, x1] of [[-.97, -.4]]) { pbox(x0, hy, 1.3, x1, hy + .3, 1.34, ORANGE, 3); for (const x of [x0 + .04, x1 - .04]) line3([x, hy + .01, 1.0], [x, hy + .28, 1.3], rampOf(DARK)[1]); }
      pbox(hx, -1.07, 1.3, hx + .3, -.53, 1.34, BLUE, 3); for (const y of [-1.03, -.57]) line3([hx + .01, y, 1.0], [hx + .28, y, 1.3], rampOf(DARK)[1]);
    }
    if (!has(4)) ladder('y', -1.2, hy + .02, 0, top + .32, [196, 200, 196]);
    else { // a steel stair up the door end, from the right corner to the roof
      const n = 9, y0 = -hy + .2, y1 = hy - .45, dy = (y1 - y0) / n, dz = top / n, x0 = hx + .04, x1 = hx + .44, gal = [176, 180, 176];
      for (let i = 0; i < n; i++) { const yc = y0 + (i + .5) * dy, z = (i + 1) * dz; pbox(x0, yc - dy / 2, z - .05, x1, yc + dy / 2, z, gal, 20 + i, (f, a, b) => f === 0 && rep(a, .08) < .03 ? -1 : 0); }
      pbox(x0, y1, top - .06, x1, hy, top, gal, 30);
      for (const w of [0, .03]) { line3([x1 + w, y0 - .1, 0], [x1 + w, y1 + .05, top], rampOf(STEEL)[1]); line3([x1 + w, y0 - .05, .55], [x1 + w, hy, top + .5], rampOf(YEL)[2]); }
      for (let i = 0; i <= n; i += 3) { const y = y0 + i * dy; line3([x1, y, i * dz], [x1, y, i * dz + .5], rampOf(STEEL)[2]); }
      shade(x0, y0, x1, hy, 0, top);
    }
    if (has(2)) railing(-hx + .05, -hy + .05, hx - .05, hy - .05, top, .42, YEL, [0, 1, 2, 3], .55, .022);
    // the third container, stacked across the back
    const sx1 = -hx + 1.15, zt = top + 1.6;
    if (has(5)) {
      const markC = (f, a, b) => f === 2 && Math.abs(b - (top + .95)) < .05 && rep(a, .6) < .4 ? col(230, 214, 120) : 0;
      solid(-hx, -hy, top, sx1, hy, zt, GREEN, 6, pats(markC, (f, a, b) => f === 0 ? dents(b) : f === 2 ? ribs(a, b, -hy, hy, top, zt) : doorEnd(a, b, -hx, sx1, top, zt)));
    }
    if (has(6)) { pbox(sx1 - .3, hy - .3, zt, sx1 - .14, hy - .14, zt + .06, DARK, 7); pbox(sx1 - .28, hy - .28, zt + .06, sx1 - .16, hy - .16, zt + .2, [255, 170, 40], 8, null, 0); glow(sx1 - .14, hy - .14, zt + .14, [255, 180, 60]); }
    if (has(7)) for (const y of [-.95, .15]) { // air conditioners on the stacked container
      pbox(sx1, y - .25, top + .25, sx1 + .26, y + .25, top + .72, [196, 198, 192], 9, (f, a, b) => f === 2 ? (Math.abs(a - y) < .17 && Math.abs(b - top - .48) < .17 ? (rep(a, .07) < PXA || rep(b, .07) < PXZ ? col(60, 62, 66) : col(110, 114, 118)) : 0) : 0);
      line3([sx1 + .27, y - .14, top + .48], [sx1 + .27, y + .14, top + .48], rampOf(DARK)[1]); line3([sx1 + .27, y, top + .34], [sx1 + .27, y, top + .62], rampOf(DARK)[1]);
    }
    if (has(8)) { // a camouflage net over the stacked container
      const netC = (x, y) => { const n = noise(x * 3, y * 3); return n > .62 ? col(96, 108, 64) : n > .45 ? col(126, 130, 80) : n > .32 ? col(132, 108, 72) : col(70, 84, 58); };
      for (let x = -hx - .05; x <= sx1 + .05; x += PXA * .8) for (let y = -hy - .05; y <= hy + .05; y += PXA * .8) if (hash(x * 50 | 0, y * 50 | 0) > .25) plot(x, y, zt + .04 + noise(x * 2, y * 2) * .06, netC(x, y));
      for (let y = -hy; y <= hy; y += PXA * .8) { const drop = .45 + noise(y * 2.2, 3) * .5; for (let z = zt; z > zt - drop; z -= PXZ * .8) if (hash(y * 60 | 0, z * 60 | 0) > .3) plot(sx1 + .05, y, z, netC(sx1, y + z)); }
    }
    if (has(9)) { // a big searchlight on a yoke, aimed out past the front corner
      const x = -hx + .5, y = -hy + .55;
      post(x, y, zt, zt + .3, .06, DARK, 10); bar(x - .22, y + .22, x + .22, y - .22, zt + .3, .03, .05, DARK);
      pbox(x - .2, y - .2, zt + .32, x + .2, y + .2, zt + .66, [70, 74, 82], 11);
      pbox(x + .2, y - .15, zt + .36, x + .23, y + .15, zt + .62, [255, 250, 220], 12, null, 0); pbox(x - .15, y + .2, zt + .36, x + .15, y + .23, zt + .62, [255, 250, 220], 12, null, 0);
      glow(x + .23, y, zt + .49, [255, 250, 220]); glow(x, y + .23, zt + .49, [255, 250, 220]);
    }
    const ox = -hx + 1.25;
    if (has(5)) spots((ox + hx) / 2, 0, (hx - ox) / 2 - .28, hy - .3, top); else spots(.15, .15, hx - .35, hy - .35, top);
    hatch(has(5) ? (ox + hx) / 2 - .05 : .1, has(5) ? -.05 : .1, top);
  }

  /* ---- 4. a fort of corrugated iron on a timber frame ---- */
  const SHEETS = [[200, 204, 206], [206, 138, 92], [156, 184, 166], [218, 210, 186], [186, 120, 84], [150, 172, 196]];
  // corrugated iron: ribs every .12, bolts along the top and bottom with rust running down from them
  const tin = (lo, z0, z1) => (f, a, b) => {
    if (!f) return 0;
    const m = rep(a, .14), boltRow = Math.abs(b - z0 - .14) < .03 || Math.abs(b - z1 + .14) < .03;
    if (boltRow && rep(a, .24, .06) < PXA) return -1.6;
    if (b < z1 - .17 && b > z1 - .7 && rep(a, .24, .06) < PXA * 1.2 && noise(a * 9, 1) > .45) return col(150, 92, 58);
    return m < PXA ? -.9 : m < PXA * 2 ? .7 : 0;
  };
  function shack(k, I) {
    const m = 1.5, top = I.roof, has = n => k >= n, timber = [96, 72, 52];
    solid(-m, -m, 0, m, m, top, [150, 116, 80], 3, plankTop(.28));
    // the sheets on the two walls you can see: each its own colour, a little uneven
    for (let i = 0; i < 6; i++) {
      const c = SHEETS[(hash(i, 3) * SHEETS.length) | 0], c2 = SHEETS[(hash(i, 7) * SHEETS.length) | 0], a0 = -m + i * .5 - .02, zb0 = .02 + hash(i, 1) * .08, zt0 = top - .04 - hash(i, 2) * .12;
      pbox(a0, m, zb0, a0 + .54, m + .03 + (i & 1) * .015, zt0, c, 30 + i, tin(a0, zb0, zt0));
      pbox(m, a0, zb0, m + .03 + (i & 1) * .015, a0 + .54, zt0, c2, 40 + i, tin(a0, zb0, zt0));
    }
    for (const [x, y] of [[m + .02, m + .02], [m + .02, -m], [-m, m + .02]]) post(x, y, 0, top + .12, .07, timber, 4, logPat);
    // a sheet parapet along the back edges of the roof, posts at the front
    pbox(-m, -m, top, -m + .05, m, top + .32, SHEETS[0], 5, tin(-m, top, top + .32)); pbox(-m, -m, top, m, -m + .05, top + .32, SHEETS[2], 6, tin(-m, top, top + .32));
    // a plank door
    pbox(-.5, m + .04, 0, .1, m + .08, 1.28, [150, 108, 70], 7, (f, a, b) => f === 1 ? (rep(a, .15) < PXA ? -1.2 : Math.abs(b - .3) < .04 || Math.abs(b - 1.0) < .04 ? -.8 : 0) : 0);
    if (has(1)) for (const [f, a0, z0] of [[1, -1.35, 1.15], [1, .35, .25], [2, .95, .3], [2, -1.3, 1.42]]) { // rusty plates bolted over holes
      const a1 = a0 + .5, z1 = z0 + .48, pat = (ff, a, b) => ff && (Math.abs(a - a0 - .05) < .03 || Math.abs(a - a1 + .05) < .03) && (Math.abs(b - z0 - .06) < .03 || Math.abs(b - z1 + .06) < .03) ? col(214, 170, 120) : ff && noise(a * 7, b * 7) > .66 ? -1 : 0;
      if (f === 1) pbox(a0, m + .05, z0, a1, m + .08, z1, RUST, 50, pat); else pbox(m + .05, a0, z0, m + .08, a1, z1, RUST, 51, pat);
    }
    if (has(2)) { // windows behind wire mesh, lit inside
      const mesh = (lo, hi, z0, z1) => (f, a, b) => a < lo + .04 || a > hi - .04 || b < z0 + .04 || b > z1 - .04 ? col(84, 66, 52) : (rep(a + b, .1) < PXA * .8 || rep(a - b, .1) < PXA * .8) ? col(70, 70, 76) : col(255, 206, 120);
      pbox(.45, m + .05, .85, 1.05, m + .07, 1.35, DARK, 52, (f, a, b) => f === 1 ? mesh(.45, 1.05, .85, 1.35)(f, a, b) : 0);
      pbox(m + .05, .2, .85, m + .07, .8, 1.35, DARK, 53, (f, a, b) => f === 2 ? mesh(.2, .8, .85, 1.35)(f, a, b) : 0);
      glow(.75, m + .08, 1.1, [255, 206, 120]); glow(m + .08, .5, 1.1, [255, 206, 120]);
    }
    if (has(3)) { // a square stovepipe with a cap
      const x = -1.25, y = .55;
      post(x, y, top, top + 1.35, .07, [70, 72, 76], 8, (f, a, b) => f && rep(b, .45) < PXZ ? -1.2 : 0);
      pbox(x - .13, y - .13, top + 1.35, x + .13, y + .13, top + 1.42, [70, 72, 76], 9); pbox(x - .09, y - .09, top + 1.42, x + .09, y + .09, top + 1.52, [70, 72, 76], 9);
      line3([x, y, top + .9], [-m + .03, y, top + .32], rampOf(DARK)[1]);
    }
    if (has(4)) { // a lean-to wing on the right, faded blue sheets, a sloping roof
      const x0 = m + .03, x1 = I.half, y0 = -1.5, y1 = -.32, z1 = 1.3;
      // a skull painted on its side, red paint running down under it (level 8 of the form)
      const SK = ['..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', 'XX..X..XX', 'XX..X..XX', 'XXXX.XXXX', '.XXXXXXX.', '..X.X.X..'], ca = -.5, cz0 = 1.05;
      const skull = has(7) ? (f, a, b) => {
        if (f !== 2) return 0;
        const cx = Math.floor((ca - a) / PXA), cz = Math.floor((cz0 - b) / PXZ);
        if (cx >= 0 && cx < 9 && cz >= 0 && cz < 8 && SK[cz][cx] === 'X') return col(238, 234, 222);
        if (cz >= 8 && b > .15 && cx >= 0 && cx < 9 && (cx & 1) && hash(cx, 3) * .7 > (cz0 - b - .6)) return col(196, 46, 38);
        return 0;
      } : null;
      solid(x0, y0, 0, x1, y1, z1 - .15, [140, 160, 184], 60, pats(skull, (f, a, b) => f ? tin(0, 0, z1 - .15)(f, a, b) : 0));
      pbox(x0 + .06, y1, 0, x1 - .06, y1 + .03, .95, [150, 108, 70], 64, (f, a) => f === 1 && rep(a, .12) < PXA ? -1.2 : 0);
      for (let s = 0; s < 4; s++) pbox(x0 - .05 + s * .1, y0 - .06, z1 - .15 + (3 - s) * .06, x0 + .07 + s * .1 + (s === 3 ? .07 : 0), y1 + .06, z1 - .09 + (3 - s) * .06, [150, 156, 160], 61 + s, (f, a, b) => f === 0 && rep(b, .12) < PXA ? -1 : 0);
    }
    if (has(5)) for (const [x, c] of [[-1.28, [168, 64, 48]], [-.96, [64, 96, 140]], [.4, [106, 118, 72]], [.72, [214, 170, 56]]]) drum(x, m + .32, 0, .14, c, 80 + x * 9);
    const nx = -.62; // the crow's nest on the back corner reaches out to here
    if (has(6)) {
      const z = top + 1.2;
      for (const [x, y] of [[-m + .08, -m + .08], [nx, -m + .08], [-m + .08, nx], [nx, nx]]) post(x, y, top, z, .05, timber, 9, logPat);
      line3([nx, nx + .02, top + .1], [-m + .1, nx + .02, z - .1], rampOf(timber)[2]); line3([nx + .02, nx, top + .1], [nx + .02, -m + .1, z - .1], rampOf(timber)[1]);
      solid(-m - .02, -m - .02, z, nx + .06, nx + .06, z + .1, PLANK, 10, plankTop(.22));
      railing(-m, -m, nx + .04, nx + .04, z + .1, .38, timber, [0, 1, 2, 3], .45, .025);
      ladder('y', -1.0, nx + .06, top, z + .4, [150, 112, 72]);
    }
    if (has(8)) { // barbed wire along the roof edges
      const barb = rampOf(DARK)[1], wc = rampOf(METAL)[3];
      const run = (ax, ay, bx, by, z) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (PXA * .5)); for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(ax, bx, t), y = lerp(ay, by, t), w = Math.sin(t * n * .55) * .05; plot(x + w * (ay === by ? 0 : 1), y + w * (ax === bx ? 0 : 1), z + Math.abs(Math.cos(t * n * .55)) * .1, i % 9 === 0 ? barb : wc); } };
      run(-m, -m + .03, m, -m + .03, top + .38); run(-m + .03, -m, -m + .03, m, top + .38);
      run(-m, m - .02, m, m - .02, top + .04); run(m - .02, -m, m - .02, m, top + .04);
      for (const [x, y] of [[m - .02, m - .02], [m - .02, -m + .1], [-m + .1, m - .02], [0, m - .02], [m - .02, 0]]) post(x, y, top, top + .22, .025, DARK, 12);
    }
    if (has(9)) { // strings of coloured bulbs from the nest down to the corners
      const BUL = [[255, 90, 70], [255, 214, 90], [120, 220, 120], [110, 180, 255]], src = [nx + .05, nx + .05, top + 1.55];
      for (const [src2, dst] of [[src, [-m + .1, m - .05, top + .22]], [src, [m - .05, -m + .1, top + .22]], [[-m + .1, m - .05, top + .4], [m - .05, m - .05, top + .4]], [[m - .05, -m + .1, top + .4], [m - .05, m - .05, top + .4]]]) {
        const n = 7;
        for (let i = 0; i <= n * 6; i++) { const t = i / (n * 6), z = lerp(src2[2], dst[2], t) - Math.sin(t * Math.PI) * .2; plot(lerp(src2[0], dst[0], t), lerp(src2[1], dst[1], t), z, rampOf(DARK)[1]); }
        for (let i = 1; i < n; i++) { const t = i / n, z = lerp(src2[2], dst[2], t) - Math.sin(t * Math.PI) * .2 - .04, c = BUL[(i + (dst[0] + src2[1]) * 3 | 0) & 3]; bulb(lerp(src2[0], dst[0], t), lerp(src2[1], dst[1], t), z, c); }
      }
      if (!has(6)) post(nx, nx, top, top + 1.55, .03, DARK);
      for (const [x, y] of [[-m + .1, m - .05], [m - .05, -m + .1], [m - .05, m - .05]]) post(x, y, top, top + .42, .025, DARK, 13);
    }
    spots(.3, .3, .8, .8, top);
    hatch(.26, .26, top);
  }

  /* ---- shared parts for the heavier forms ---- */
  // cast concrete: formwork lines, joints and pits
  const concrete = (lift = .33) => (f, a, b) => {
    if (!f) return hash(Math.floor(a * 6), Math.floor(b * 6)) > .965 ? -.7 : 0;
    if (rep(b, lift) < PXZ * .9) return -.45;
    if (rep(a, 1.05, .2) < PXA * .9) return -.35;
    return hash(Math.floor(a * 11), Math.floor(b * 13)) > .975 ? -.9 : 0;
  };
  // dark slits with a pale sill: [lo, hi] spans along the wall at height z0..z1 (f1: the +y wall, f2: the +x wall)
  const slits = (f1, f2, z0, z1) => (f, a, b) => {
    for (const [lo, hi] of (f === 1 ? f1 : f === 2 ? f2 : [])) if (a > lo && a < hi) { if (b > z0 && b < z1) return col(26, 24, 30); if (b > z0 - .07 && b <= z0) return 1.2; if (b >= z1 && b < z1 + .04) return -1; }
    return 0;
  };
  // armour plates: seams every w, rivets along them
  const platePat = (w, z0, z1) => (f, a, b) => {
    if (!f) return 0;
    const m = rep(a, w);
    if (m < PXA * .9 || b < z0 + PXZ || b > z1 - PXZ) return -1.4;
    if ((m < .09 || m > w - .07) && rep(b - z0, .18) < PXZ * 1.1) return 1.4;
    return 0;
  };
  const hazard = (a, b, f = 1) => rep(a + b, .24) < .12 ? tone([236, 190, 48], f, 1) : tone([52, 50, 58], f, 1);
  const camoPat = (k = 1.3) => (f, a, b) => { if (!f) return 0; const n = noise(a * k + 7, b * k * 1.4 + 3), n2 = noise(a * k * 2 + 1, b * k * 2.6); return n > .64 ? tone([112, 126, 80], f) : n < .3 ? tone([142, 120, 88], f) : n2 > .72 ? tone([70, 80, 62], f) : 0; };
  // a radar: a lattice panel facing the camera, on a mast
  function radar(x, y, z, w, h, c = [210, 214, 218]) {
    post(x, y, z, z + .45, .05, DARK, 21);
    pbox(x - .12, y - .12, z + .4, x + .12, y + .12, z + .52, STEEL, 22);
    const e = [1 / R2, -1 / R2], r = rampOf(c);
    for (let s = -w; s <= w; s += PXA * .7) for (const zz of [0, h * .5, h]) plot(x + e[0] * s, y + e[1] * s, z + .55 + zz, r[zz ? 3 : 2]);
    for (let s = -w; s <= w + .01; s += .12) line3([x + e[0] * s, y + e[1] * s, z + .55], [x + e[0] * s, y + e[1] * s, z + .55 + h], r[s > 0 ? 2 : 3]);
    shade(x - .3, y - .3, x + .3, y + .3, z + .55, z + .55 + h);
  }
  // a lattice mast tapering up, with cross bracing and a red light on top
  function lattice(x, y, z0, h, w, c = [170, 60, 50]) {
    const r = rampOf(c);
    for (const [dx, dy] of [[-w, -w], [w, -w], [-w, w], [w, w]]) line3([x + dx, y + dy, z0], [x + dx * .35, y + dy * .35, z0 + h], r[2]);
    for (let z = z0 + .25, i = 0; z < z0 + h - .15; z += .3, i++) {
      const k = 1 - (z - z0) / h * .65, k2 = 1 - (z + .3 - z0) / h * .65;
      line3([x - w * k, y + w * k, z], [x + w * k2, y + w * k2, z + .3], r[i & 1 ? 1 : 3]);
      line3([x + w * k, y - w * k, z], [x + w * k2, y + w * k2, z + .3], r[i & 1 ? 3 : 1]);
      line3([x - w * k, y + w * k, z], [x + w * k, y + w * k, z], r[3]); line3([x + w * k, y - w * k, z], [x + w * k, y + w * k, z], r[1]);
    }
    bulb(x, y, z0 + h + .05, [255, 70, 50]);
    for (let z = z0 + .3; z < z0 + h; z += .4) castShadow(x, y, z, w * .6, 1, 0);
  }
  // a square dish tilted up and out toward the camera, with its feed arm
  function dish(x, y, z, s, c = [214, 218, 222]) {
    const e1 = [1 / R2, -1 / R2, 0], e2 = [.42, .42, .8], r = rampOf(c);
    post(x, y, z, z + .35, .05, DARK, 23);
    for (let a = -s; a <= s; a += PXA * .55) for (let b = -s; b <= s; b += PXA * .55) {
      const dd = (a * a + b * b) / (s * s) * .12;
      plot(x + e1[0] * a + e2[0] * b - dd, y + e1[1] * a + e2[1] * b - dd, z + .45 + e2[2] * b, r[Math.abs(a) > s * .85 || Math.abs(b) > s * .85 ? 2 : b > 0 ? 4 : 3]);
    }
    line3([x, y, z + .45], [x + .35, y + .35, z + .6], rampOf(DARK)[2]); pbox(x + .32, y + .32, z + .56, x + .4, y + .4, z + .64, DARK, 24);
    shade(x - s * .7, y - s * .7, x + s * .7, y + s * .7, z + .2, z + .45 + s);
  }
  // a floodlight: a box with a lit face toward +x or +y
  function flood(x, y, z, dir, s = .13) {
    pbox(x - s, y - s, z, x + s, y + s, z + s * 1.5, [70, 74, 82], 25);
    if (dir === 'x') { pbox(x + s, y - s * .75, z + s * .2, x + s + .02, y + s * .75, z + s * 1.3, [255, 250, 220], 26, null, 0); glow(x + s + .02, y, z + s * .75, [255, 250, 220]); }
    else { pbox(x - s * .75, y + s, z + s * .2, x + s * .75, y + s + .02, z + s * 1.3, [255, 250, 220], 26, null, 0); glow(x, y + s + .02, z + s * .75, [255, 250, 220]); }
  }

  /* ---- 5. a concrete pillbox ---- */
  function pillbox(k, I) {
    const m = k >= 4 ? 1.62 : 1.5, top = I.roof, has = n => k >= n, pl = m + .12;
    const camo = has(9) ? camoPat(1.2) : null;
    const pil = has(4) ? (f, a, b) => f && b > .25 && b < top - .1 && Math.abs(rep(a, 1.08, .32) - .54) > .47 ? -.9 : 0 : null;
    const door = has(1) ? (f, a, b) => f === 1 && Math.abs(a + .05) < .38 && b > .22 && b < 1.3 ? (Math.abs(a + .05) > .33 || b > 1.25 ? col(52, 54, 60) : Math.abs(b - .55) < .04 || Math.abs(b - .95) < .04 ? col(84, 88, 96) : Math.abs(a - .2) < .03 && Math.abs(b - .78) < .1 ? col(220, 200, 120) : col(118, 124, 132)) : 0 : null;
    solid(-pl, -pl, 0, pl, pl, .22, [150, 146, 136], 1, concrete());
    solid(-m, -m, 0, m, m, top - .1, CONCRETE, 2, pats(door, slits([[-1.15, -.55], [.45, 1.05]], [[-1.15, -.55], [.35, .95]], 1.2, 1.32), camo, pil, concrete()), .5);
    pbox(-m + .06, -m + .06, top - .1, m - .06, m - .06, top, [168, 164, 152], 3, concrete(), .5);
    // the parapet
    const t = .17, pz = top + .26, pzF = top + .2;
    for (const [x0, y0, x1, y1, z1] of [[-m + .06, -m + .06, m - .06, -m + .06 + t, pz], [-m + .06, -m + .06, -m + .06 + t, m - .06, pz], [-m + .06, m - .06 - t, m - .06, m - .06, pzF], [m - .06 - t, -m + .06, m - .06, m - .06, pzF]]) pbox(x0, y0, top, x1, y1, z1, [180, 176, 164], 4, pats(camo, concrete()), .5);
    if (has(2)) { // earth heaped against the walls, grass on top, a cut for the door
      const steps = [[.72, .2], [.48, .4], [.24, .6]];
      for (const [h, o] of steps) {
        pbox(m, -m, 0, m + o, m, h, DIRT, 70, null, 1.6); pbox(-m, m, 0, -.5, m + o, h, DIRT, 71, null, 1.6); pbox(.42, m, 0, m, m + o, h, DIRT, 72, null, 1.6);
      }
      for (let i = 0; i < 160; i++) { const t2 = hash(i, 5), o = hash(i, 6) * .6, side = i & 1, a = -m + t2 * 2 * m; if (!side && Math.abs(a + .05) < .5) continue; const h = o < .2 ? .72 : o < .4 ? .48 : .24; const [x, y] = side ? [m + o, a] : [a, m + o]; line3([x, y, h], [x, y, h + .05 + hash(i, 7) * .08], rampOf([110, 140, 70])[2 + (i % 3 === 0)]); }
      shade(m, -m, m + .6, m, 0, .7); shade(-m, m, m, m + .6, 0, .7);
    }
    if (has(3)) { // a machine gun nest on the right corner: a steel shield and the gun aimed out
      const x = m - .5, y = -m + .5;
      pbox(x - .3, y - .38, top, x + .36, y - .3, top + .55, OLIVE, 30, platePat(.3, top, top + .55)); pbox(x + .28, y - .38, top, x + .36, y + .28, top + .55, OLIVE, 31, platePat(.3, top, top + .55));
      post(x, y, top, top + .32, .04, DARK, 32);
      pbox(x - .12, y - .06, top + .3, x + .2, y + .06, top + .42, DARK, 33);
      for (const w of [0, .02]) line3([x + .2, y + w, top + .37], [x + .75, y - .25 + w, top + .4], rampOf(DARK)[w ? 0 : 2]);
      crateAt(x - .1, y + .25, top, .12, .1, .16, OLIVE, 34, col(214, 178, 60));
    }
    if (has(5)) for (const [x, y] of [[-m + .42, -.35], [-.35, -m + .42], [-m + .42, .6]]) { // periscopes
      post(x, y, top, top + .62, .07, [96, 104, 88], 35);
      pbox(x - .13, y - .13, top + .62, x + .13, y + .13, top + .82, [96, 104, 88], 36);
      pbox(x + .13, y - .08, top + .66, x + .15, y + .08, top + .76, [150, 220, 240], 37, null, 0); pbox(x - .08, y + .13, top + .66, x + .08, y + .15, top + .76, [150, 220, 240], 37, null, 0);
    }
    if (has(6)) for (const [f, a] of [[1, -1.25], [1, 1.2], [2, -1.25], [2, 1.15]]) { // caged lamps on the walls
      const [x, y] = f === 1 ? [a, m + .02] : [m + .02, a], z = 1.62;
      if (f === 1) { pbox(x - .1, y, z, x + .1, y + .12, z + .18, DARK, 38); for (const o of [-.07, 0, .07]) line3([x + o, y + .13, z + .02], [x + o, y + .13, z + .16], rampOf(METAL)[3]); }
      else { pbox(x, y - .1, z, x + .12, y + .1, z + .18, DARK, 38); for (const o of [-.07, 0, .07]) line3([x + .13, y + o, z + .02], [x + .13, y + o, z + .16], rampOf(METAL)[3]); }
      glow(x + (f === 2 ? .13 : 0), y + (f === 1 ? .13 : 0), z + .09, [255, 236, 170]);
    }
    if (has(7)) for (const [x, y] of [[-.95, -.2], [-.2, -.95]]) { // mushroom vents
      post(x, y, top, top + .45, .09, [160, 160, 154], 39, (f, a, b) => f && rep(b, .1) < PXZ ? -1.2 : 0);
      pbox(x - .24, y - .24, top + .42, x + .24, y + .24, top + .5, [110, 114, 112], 40); pbox(x - .16, y - .16, top + .5, x + .16, y + .16, top + .57, [110, 114, 112], 40);
    }
    if (has(8)) { // a long-range radio mast with guy wires
      const x = -m + .35, y = -m + .35;
      lattice(x, y, top, 2.5, .14);
      for (const [gx, gy] of [[m - .2, -m + .2], [-m + .2, m - .2]]) line3([x, y, top + 1.7], [gx, gy, top + .02], rampOf(METAL)[2], .6);
      for (const z of [top + .9, top + 1.6]) { pbox(x - .03, y + .1, z, x + .03, y + .45, z + .05, DARK, 41); }
    }
    spots(.22, .22, m - .55, m - .55, top);
    hatch(.17, .17, top);
  }

  /* ---- 6. a reinforced bunker: concrete in bolted steel plate ---- */
  function reinforced(k, I) {
    const m = k >= 4 ? 1.66 : 1.55, top = I.roof, has = n => k >= n, OD = [112, 118, 92], PL = [120, 128, 136];
    const camo = camoPat(1.1), star = has(9) ? (f, a, b) => {
      if (f !== 1) return 0;
      const cx = .55, cz = 1.6, dx = (a - cx) / .36, dz = (b - cz) / .36;
      if (Math.abs(dx) > 1.25 || Math.abs(dz) > 1.25) return 0;
      const ang = Math.atan2(dz, dx), r = Math.hypot(dx, dz), lim = .45 + .55 * Math.pow(Math.abs(Math.cos(2.5 * (ang - Math.PI / 2))), 6);
      if (r < lim) return col(236, 232, 220);
      return Math.abs(dx) < 1.18 && Math.abs(dz) < 1.18 ? col(48, 58, 84) : col(214, 176, 60);
    } : null;
    const num = has(9) ? (f, a, b) => f === 1 ? textAt('51', -1.2, 1.78, col(236, 232, 220), 1, 2)(a, b) : 0 : null;
    solid(-m - .1, -m - .1, 0, m + .1, m + .1, .2, [120, 122, 112], 1, has(3) ? (f, a, b) => f ? hazard(a, b, f) : 0 : concrete());
    solid(-m, -m, 0, m, m, top - .08, OD, 2, pats(star, num, slits([], [], 0, 0), camo, concrete(.4)), .5);
    // steel plates over the lower walls
    pbox(-m, m, .2, m, m + .05, 1.3, PL, 3, platePat(.62, .2, 1.3)); pbox(m, -m, .2, m + .05, m, 1.3, PL, 4, platePat(.62, .2, 1.3));
    pbox(-m + .05, -m + .05, top - .08, m - .05, m - .05, top, [104, 110, 88], 5, concrete());
    // a steel parapet, lower at the front
    const t = .12;
    for (const [x0, y0, x1, y1, z1] of [[-m, -m, m, -m + t, top + .36], [-m, -m, -m + t, m, top + .36], [-m, m - t, m, m, top + .24], [m - t, -m, m, m, top + .24]]) pbox(x0, y0, top, x1, y1, z1, PL, 6, has(3) && z1 < top + .3 ? (f, a, b) => f && b > top + .1 ? hazard(a, b, f) : 0 : platePat(.5, top, z1));
    if (has(1)) for (const [f, a] of [[1, -.9], [1, .75], [2, -.85], [2, .7]]) { // armoured gun ports
      const z = 1.45;
      const port = (ff, aa, bb) => ff && Math.abs(aa - a) < .22 && Math.abs(bb - z - .2) < .06 ? col(24, 22, 28) : ff && (Math.abs(aa - a) > .27 || bb < z + .05 || bb > z + .35) ? 1.2 : 0;
      if (f === 1) pbox(a - .32, m, z, a + .32, m + .2, z + .4, [150, 158, 166], 7, port); else pbox(m, a - .32, z, m + .2, a + .32, z + .4, [150, 158, 166], 7, port);
    }
    if (has(2)) { // a louvred ventilation tower on the left corner
      const x0 = -m + .1, y0 = m - .62, x1 = -m + .55, y1 = m - .12, z1 = top + 1.0;
      solid(x0, y0, top, x1, y1, z1, [128, 132, 120], 8, (f, a, b) => f && b > top + .2 && b < z1 - .15 ? (rep(b, .1) < PXZ * 1.3 ? col(40, 40, 46) : .6) : 0);
      pbox(x0 - .06, y0 - .06, z1, x1 + .06, y1 + .06, z1 + .07, [100, 104, 96], 9);
    }
    const s0 = -m + 1.12;
    if (has(4)) { // a second storey on the back corner: a command room with slit windows
      solid(-m, -m, top, s0, s0, top + 1.05, OD, 10, pats((f, a, b) => f && b > top + .55 && b < top + .7 && rep(a, .5, .12) < .3 ? col(40, 44, 50) : 0, camo, concrete(.4)), .5);
      pbox(-m - .04, -m - .04, top + 1.05, s0 + .06, s0 + .06, top + 1.13, PL, 11, platePat(.4, 0, 9));
    }
    if (has(5)) { flood(s0 - .15, -m + .25, top + 1.13, 'x'); flood(-m + .25, s0 - .15, top + 1.13, 'y'); flood(s0 - .2, s0 - .2, top + 1.13, 'x'); }
    if (has(6)) for (const [x, y] of [[m + .45, .9], [m + .45, -.75], [.9, m + .45], [-.75, m + .45]]) { // anti-tank hedgehogs
      const c = rampOf([92, 96, 102]);
      for (const [a, b] of [[[-.28, 0, 0], [.28, 0, .5]], [[.28, 0, 0], [-.28, 0, .5]], [[0, -.28, 0], [0, .28, .5]], [[0, .28, 0], [0, -.28, .5]]]) for (const w of [0, .03]) line3([x + a[0] + w, y + a[1], a[2]], [x + b[0] + w, y + b[1], b[2]], c[w ? 1 : 3]);
      castShadow(x, y, .25, .25);
    }
    if (has(7)) dish(-m + .5, -m + .5, top + 1.13, .38);
    if (has(8)) { // razor wire coils on the parapet
      const r = rampOf([190, 196, 204]);
      const coil = (ax, ay, bx, by, z) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / .09); for (let i = 0; i <= n; i++) { const t2 = i / n, x = lerp(ax, bx, t2), y = lerp(ay, by, t2); for (let q = 0; q < 8; q++) { const an = q / 8 * 6.283 + i * .9, ox = Math.cos(an) * .08; plot(x + (ax === bx ? ox : 0), y + (ay === by ? ox : 0), z + .08 + Math.sin(an) * .08, r[q & 1 ? 2 : 4]); } } };
      coil(-m + .05, m - .06, m - .05, m - .06, top + .24); coil(m - .06, -m + .05, m - .06, m - .05, top + .24);
      coil(-m + .05, -m + .06, m - .05, -m + .06, top + .36); coil(-m + .06, -m + .05, -m + .06, m - .05, top + .36);
    }
    spots(.45, .45, .92, .92, top);
    hatch(.4, .4, top);
  }

  /* ---- 7. a command bunker: a control cabin, radar, antennas ---- */
  function command(k, I) {
    const m = k >= 4 ? 1.72 : 1.62, top = I.roof, has = n => k >= n, GR = [198, 198, 190], BAND = [82, 88, 98], c1 = -m + 1.12, ct = top + 1.15;
    const ops = has(3) ? (f, a, b) => f && b > 1.32 && b < 1.72 && Math.abs(a) < m - .3 && rep(a, .55, .1) < .45 ? (b < 1.36 || b > 1.68 || rep(a, .55, .1) < .03 ? col(60, 66, 78) : hash(Math.floor(a * 14), Math.floor(b * 12)) > .7 ? col(170, 240, 255) : col(60, 150, 190)) : 0 : null;
    const banner = has(8) ? (f, a, b) => {
      if (f !== 1) return 0;
      for (const cx of [-.95, .95]) if (Math.abs(a - cx) < .2 && b > .55 && b < top - .3) { const e = Math.abs(a - cx); if (b < .55 + (.2 - e) * .8) return 0; return e > .16 ? col(214, 176, 60) : Math.abs(b - 1.95) < .14 && e < .1 ? col(236, 232, 220) : col(48, 62, 120); }
      return 0;
    } : null;
    const walls = (f, a, b) => {
      if (!f) return rep(a, .6) < PXA || rep(b, .6) < PXA ? -.5 : 0;
      if (b < .32) return tone(BAND, f);
      if (b > top - .3) return b > top - .2 && b < top - .14 ? col(214, 110, 60) : -1.6;
      return rep(b, .55, .32) < PXZ ? -.6 : rep(a, 1.1, .3) < PXA ? -.5 : 0;
    };
    solid(-m, -m, 0, m, m, top, GR, 1, pats(banner, ops, walls), .4);
    if (has(4)) { // an annex on the right with a door and a vent
      const x0 = m, x1 = I.half, y0 = -m + .1, y1 = .15, z1 = 1.15;
      solid(x0, y0, 0, x1, y1, z1, GR, 2, (f, a, b) => f === 2 && Math.abs(a - (y0 + y1) / 2) < .22 && b < .9 ? (Math.abs(a - (y0 + y1) / 2) > .19 || b > .86 ? col(60, 64, 72) : col(110, 118, 130)) : f && b < .3 ? -1.4 : 0, .4);
      pbox(x0 + .1, y0 + .2, z1, x0 + .32, y0 + .5, z1 + .2, [150, 152, 150], 3, (f, a, b) => f && rep(b, .06) < PXZ ? -1.2 : 0);
    }
    railing(-m + .05, -m + .05, m - .05, m - .05, top, .4, [120, 126, 134], [0, 1, 2, 3], .6, .02);
    // the control cabin on the back corner: a band of windows lit by screens
    solid(-m, -m, top, c1, c1, ct, GR, 4, (f, a, b) => f && b > top + .45 && b < top + .85 ? (b < top + .48 || b > top + .82 || rep(a, .3) < PXA ? col(56, 60, 70) : hash(Math.floor(a * 12), Math.floor(b * 9)) > .72 ? col(160, 236, 255) : col(46, 96, 130)) : f && b < top + .1 ? -1.2 : 0, .4);
    pbox(-m - .08, -m - .08, ct, c1 + .1, c1 + .1, ct + .08, BAND, 5);
    glow(c1 + .01, -m + .5, top + .65, [140, 230, 255]); glow(-m + .5, c1 + .01, top + .65, [140, 230, 255]);
    if (has(1)) radar(-m + .55, -m + .55, ct + .08, .62, .36);
    if (has(2)) for (const [x, y, h] of [[c1 - .08, -m + .1, 1.3], [-m + .1, c1 - .08, 1.1], [c1 - .08, c1 - .08, .9]]) { post(x, y, ct + .08, ct + .08 + h, .018, DARK, 26); bar(x - .15, y, x + .15, y, ct + h * .8, .012, .025, DARK); }
    if (has(5)) for (const [x, y, d] of [[c1 + .02, -m + .2, 'x'], [-m + .2, c1 + .02, 'y']]) { // sirens and red lights
      if (d === 'x') { pbox(x, y - .1, ct - .3, x + .22, y + .1, ct - .1, [200, 60, 50], 27); pbox(x + .18, y - .14, ct - .34, x + .24, y + .14, ct - .06, [60, 60, 66], 28); }
      else { pbox(x - .1, y, ct - .3, x + .1, y + .22, ct - .1, [200, 60, 50], 27); pbox(x - .14, y + .18, ct - .34, x + .14, y + .24, ct - .06, [60, 60, 66], 28); }
      glow(d === 'x' ? x + .1 : x, d === 'x' ? y : y + .1, ct - .05, [255, 70, 50]);
    }
    if (has(6)) { // cable trays along the walls, conduits dropping to junction boxes
      pbox(-m + .1, m, 1.95, m - .1, m + .1, 2.02, [150, 154, 158], 29, (f, a) => rep(a, .3) < PXA ? -1 : 0); pbox(m, -m + .1, 1.95, m + .1, m - .1, 2.02, [150, 154, 158], 29, (f, a) => rep(a, .3) < PXA ? -1 : 0);
      for (const x of [-1.25, .2, 1.3]) { pbox(x - .025, m + .03, .7, x + .025, m + .08, 1.95, [70, 74, 80], 30); pbox(x - .1, m, .5, x + .1, m + .1, .75, [96, 100, 108], 31); }
      for (const y of [-1.2, .5]) { pbox(m + .03, y - .025, .7, m + .08, y + .025, 1.95, [70, 74, 80], 30); pbox(m, y - .1, .5, m + .1, y + .1, .75, [96, 100, 108], 31); }
    }
    if (has(7)) { // a microwave relay: square horns on a frame
      const x = c1 - .3, y = c1 - .3;
      post(x, y, ct + .08, ct + 1.25, .05, STEEL, 32);
      for (const z of [ct + .35, ct + .75, ct + 1.1]) bar(x - .2, y, x + .2, y, z, .015, .03, STEEL);
      pbox(x + .05, y - .27, ct + .7, x + .2, y + .27, ct + 1.22, [232, 234, 236], 33, (f, a, b) => f === 2 && Math.abs(a - y) < .2 && Math.abs(b - ct - .96) < .2 ? -1.2 : 0);
      pbox(x - .27, y + .05, ct + .2, x + .27, y + .2, ct + .72, [232, 234, 236], 33, (f, a, b) => f === 1 && Math.abs(a - x) < .2 && Math.abs(b - ct - .46) < .2 ? -1.2 : 0);
    }
    if (has(9)) { // helicopter approach lights along the front edges
      for (let t = -m + .2; t <= m - .1; t += .42) { bulb(t, m + .01, top - .1, [120, 255, 140]); bulb(m + .01, t, top - .1, [120, 255, 140]); }
      for (const [x, y] of [[m, m], [-m, m], [m, -m]]) lamp(x - .05, y - .05, top + .4, [255, 255, 255], .06);
    }
    spots(.5, .5, .9, .9, top);
    hatch(.45, .45, top);
  }

  // dressed stone: courses .36 high, blocks .7 long, each a little different
  const stone = (f, a, b) => {
    if (!f) return 0;
    const row = Math.floor(b / .36), off = row & 1 ? .35 : 0;
    if (rep(b, .36) < PXZ * 1.1) return -1.2;
    if (rep(a + off, .7) < PXA) return -1.1;
    return (hash(Math.floor((a + off) / .7), row) - .5) * .9;
  };
  // battlements along the edges of a roof: a low wall, then merlons; the front edges stay low so the gunners show
  function battlement(x0, y0, x1, y1, z, t, hb, hf, c, pat, front = true) {
    const edges = [[x0, y0, x1, y0 + t, hb, 1], [x0, y0, x0 + t, y1, hb, 0]];
    if (front) edges.push([x0, y1 - t, x1, y1, hf, 1], [x1 - t, y0, x1, y1, hf, 0]);
    for (const [ax, ay, bx, by, h, alongX] of edges) {
      pbox(ax, ay, z, bx, by, z + h * .45, c, 61, pat);
      const L = alongX ? bx - ax : by - ay, n = Math.max(1, Math.round(L / .55));
      for (let i = 0; i < n; i++) { const s0 = (alongX ? ax : ay) + (i + .5) * L / n - .15; alongX ? pbox(s0, ay, z + h * .45, s0 + .3, by, z + h, c, 62 + i, pat) : pbox(ax, s0, z + h * .45, bx, s0 + .3, z + h, c, 62 + i, pat); }
    }
  }
  // a box turret: a ring, a head, barrels pointing along +x ('x') or +y ('y')
  function turret(x, y, z, s, c, dir, barrels = 2, len = .9, bw = .045, trim = null) {
    const ringZ = z + s * .5, hs = s * .8, hz = ringZ + s * .48;
    solid(x - s, y - s, z, x + s, y + s, ringZ, c, 31, (f, a, b) => trim && f && Math.abs(b - ringZ + .06) < .035 ? tone(trim, f, 1) : f && rep(a, .25) < PXA ? -1 : 0);
    solid(x - hs, y - hs, ringZ, x + hs, y + hs, hz, c, 32, (f, a, b) => f && Math.abs(b - ringZ - s * .24) < .03 ? (trim ? tone(trim, f, 1) : -1.2) : f === 0 && Math.abs(a - x) < .06 && Math.abs(b - y) < .06 ? -1.5 : 0);
    const bz = ringZ + s * .14;
    for (let i = 0; i < barrels; i++) {
      const o = (i - (barrels - 1) / 2) * Math.max(.14, bw * 3.2);
      if (dir === 'x') { pbox(x + hs, y + o - bw, bz, x + hs + len, y + o + bw, bz + bw * 2, DARK, 33); pbox(x + hs + len - .1, y + o - bw * 1.4, bz - bw * .4, x + hs + len, y + o + bw * 1.4, bz + bw * 2.4, [70, 70, 78], 34); }
      else { pbox(x + o - bw, y + hs, bz, x + o + bw, y + hs + len, bz + bw * 2, DARK, 33); pbox(x + o - bw * 1.4, y + hs + len - .1, bz - bw * .4, x + o + bw * 1.4, y + hs + len, bz + bw * 2.4, [70, 70, 78], 34); }
    }
    shade(x - s, y - s, x + s, y + s, z, hz);
  }
  // a launcher box with missile noses on its +x face
  function missiles(x, y, z, c, rows = 2, cols = 3) {
    post(x, y, z, z + .22, .1, DARK, 41);
    const x0 = x - .32, x1 = x + .26, y0 = y - .1 - cols * .1, y1 = y + .1 + cols * .1 - .2, z0 = z + .22, z1 = z0 + rows * .2 + .12;
    solid(x0, y0, z0, x1, y1, z1, c, 42, (f, a, b) => f === 0 ? (rep(a, .2) < PXA ? -1 : 0) : f === 1 && rep(a, .2) < PXA ? -1 : 0);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const yy = y0 + .13 + q * .2, zz = z0 + .1 + r * .2;
      pbox(x1, yy - .055, zz - .055, x1 + .12, yy + .055, zz + .055, [232, 232, 226], 43);
      pbox(x1 + .12, yy - .04, zz - .04, x1 + .19, yy + .04, zz + .04, [200, 52, 44], 44);
    }
  }

  /* ---- 8. a fortress of dressed stone: battlements, turrets, missiles ---- */
  function turretFort(k, I) {
    const m = k >= 4 ? 1.75 : 1.7, top = I.roof, has = n => k >= n, ST_ = [164, 154, 138], ARM = [92, 100, 104];
    solid(-m - .12, -m - .12, 0, m + .12, m + .12, .3, [128, 120, 108], 1, stone);
    solid(-m, -m, 0, m, m, top, ST_, 2, pats(slits([[-1.1, -.7], [.6, 1.0]], [[-1.1, -.7], [.5, .9]], 1.6, 1.85), stone), .4);
    if (has(3)) { // armour skirts round the foot of the walls
      pbox(-m - .02, m + .02, 0, m + .02, m + .1, .9, ARM, 3, platePat(.5, 0, .9)); pbox(m + .02, -m - .02, 0, m + .1, m + .02, .9, ARM, 4, platePat(.5, 0, .9));
    }
    if (has(4)) for (const [cx, cy] of [[m, m], [-m, m], [m, -m]]) { // bastions on the corners
      const x0 = cx - .55, x1 = cx + .25, y0 = cy - .55, y1 = cy + .25;
      solid(Math.min(x0, cx - .25), Math.min(y0, cy - .25), 0, Math.max(x1, cx + .25), Math.max(y1, cy + .25), top + .15, [156, 146, 130], 5, stone, .4);
    }
    battlement(-m + .02, -m + .02, m - .02, m - .02, top, .18, .58, .32, [170, 160, 144], stone);
    // the main turret on the back corner, barrels to the right
    const tx = -m + .58, ty = -m + .58, tz = top + .62;
    solid(-m + .04, -m + .04, top, -m + 1.12, -m + 1.12, tz, [158, 148, 132], 30, stone, .4);
    turret(tx, ty, tz, .46, [118, 112, 104], 'x', has(7) ? 1 : 2, has(7) ? 1.7 : 1.0, has(7) ? .075 : .045);
    if (has(7)) { const bz = tz + .23 + .46 * .14; pbox(tx + .37, ty - .1, bz - .03, tx + .75, ty + .1, bz + .18, [96, 92, 88], 35); }
    if (has(1)) { solid(-m + .06, m - .86, top, -m + .86, m - .06, top + .42, [158, 148, 132], 30, stone, .4); turret(-m + .46, m - .46, top + .42, .36, [118, 112, 104], 'y', 2, .75); }
    if (has(2)) { solid(m - .86, -m + .06, top, m - .1, -m + .82, top + .3, [158, 148, 132], 30, stone, .4); missiles(m - .5, -m + .45, top + .3, [96, 108, 84]); }
    if (has(5)) { // an ammunition hoist up the right wall
      const y0 = .25, y1 = .7, x = m + .12;
      for (const y of [y0, y1]) post(x, y, 0, top + .75, .04, DARK, 36);
      bar(x, y0, x, y1, top + .7, .04, .06, DARK); bar(x, y1 - .05, x + .4, y1 - .05, top + .7, .035, .05, DARK);
      wire([x + .37, y1 - .05, top + .7], [x + .37, y1 - .05, 1.5], rampOf(DARK)[1], 1, false);
      pbox(x - .02, y0 + .02, 1.2, x + .3, y1 - .02, 1.26, STEEL, 37);
      crateAt(x + .14, (y0 + y1) / 2, 1.26, .12, .17, .22, OLIVE, 38, col(214, 178, 60));
    }
    if (has(6)) { const bx = tx - .1, by = ty - .1, bz = tz + .23 + .46 * .48 + .02; pbox(bx - .08, by - .08, bz, bx + .08, by + .08, bz + .12, DARK, 39); BEACON = [bx, by, bz + .18]; }
    if (has(8)) for (let i = 0; i < 6; i++) { // pennants on the front merlons
      const t = -m + .35 + i * (2 * m - .7) / 5, c = i & 1 ? [230, 186, 50] : [196, 52, 44];
      for (const [x, y, dx, dy] of [[t, m - .1, 1, 0], [m - .1, t, 0, -1]]) {
        if (Math.abs(x) > m - .3 && Math.abs(y) > m - .3) continue;
        const z = top + .32;
        line3([x, y, z], [x, y, z + .55], rampOf(DARK)[2]);
        for (let a = 0; a < .3; a += PXA * .6) for (let zz = 0; zz < .2 - a * .6; zz += PXZ * .6) plot(x + dx * a, y + dy * a, z + .55 - .02 - zz - a * .1, rampOf(c)[a > .15 ? 2 : 3]);
      }
    }
    if (has(9)) { // an anti-aircraft gun with four barrels on the front bastion
      const x = m - .25, y = m - .25, z = top + .15;
      post(x, y, z, z + .2, .1, DARK, 40);
      pbox(x - .16, y - .16, z + .2, x + .16, y + .16, z + .38, [96, 108, 84], 41);
      for (const [o1, o2] of [[-.07, -.07], [.07, -.07], [-.07, .07], [.07, .07]]) for (const w of [0, .02]) line3([x + o1 + w, y + o2, z + .32], [x + o1 + .42 + w, y + o2 + .42, z + .95], rampOf(DARK)[w ? 0 : 2]);
    }
    spots(.45, .45, .92, .92, top);
    hatch(.4, .4, top);
  }

  /* ---- 9. a high-tech armoured citadel: gunmetal hull, white plates, cyan light ---- */
  const CY = [120, 230, 255];
  function citadel(k, I) {
    const m = k >= 4 ? 1.84 : 1.78, top = I.roof, has = n => k >= n, HULL = [74, 82, 98], PLT = [212, 218, 224];
    const core = has(3) ? (f, a, b) => f === 1 && Math.abs(a - .1) < .3 && b > .5 && b < top - .7 ? (Math.abs(a - .1) > .25 || b < .55 || b > top - .75 ? col(40, 46, 56) : rgb(...[[150, 240, 255], [190, 250, 255], [120, 220, 255]][Math.floor((b * 9 + Math.abs(a - .1) * 20)) % 3])) : 0 : null;
    const hull = (f, a, b) => {
      if (!f) return rep(a, .5) < PXA || rep(b, .5) < PXA ? -.6 : 0;
      if (Math.abs(b - .4) < .035 || Math.abs(b - (top - .42)) < .035) return col(...CY);
      const u = rep(a, 1.2, .25);
      if (b > 1.05 && b < top - .6 && u > .12 && u < 1.05 && (u - .12) + (b - 1.05) * .5 > .18) return tone(PLT, f, (u < .16 || b > top - .64) ? -1 : 0);
      return rep(a, .6, .1) < PXA ? -1 : rep(b, .7) < PXZ ? -.8 : 0;
    };
    solid(-m - .1, -m - .1, 0, m + .1, m + .1, .25, [56, 62, 74], 1, (f, a, b) => f && rep(a, .3) < PXA ? -1 : 0);
    solid(-m, -m, 0, m, m, top - .16, HULL, 2, pats(core, hull), .35);
    pbox(-m + .08, -m + .08, top - .16, m - .08, m - .08, top, [84, 92, 108], 3, (f, a, b) => f === 0 && (rep(a, .55) < PXA || rep(b, .55) < PXA) ? -.7 : 0, .35);
    if (has(3)) { glow(.1, m + .01, 1.2, CY); glow(.1, m + .01, 1.9, CY); }
    // a low white parapet with a light line
    for (const [x0, y0, x1, y1, h] of [[-m + .08, -m + .08, m - .08, -m + .22, .4], [-m + .08, -m + .08, -m + .22, m - .08, .4], [-m + .08, m - .22, m - .08, m - .08, .26], [m - .22, -m + .08, m - .08, m - .08, .26]]) pbox(x0, y0, top, x1, y1, top + h, PLT, 4, (f, a, b) => f && Math.abs(b - top - h + .08) < .03 ? col(...CY) : 0, .3);
    if (has(4)) for (const [f, a] of [[1, -1.25], [1, 1.25], [2, -1.25], [2, 1.25]]) { // angled armour fins
      for (let s = 0; s < 3; s++) {
        const o0 = 0, o1 = .34 - s * .1, z0 = .3 + s * .1, z1 = top - .35 - s * .45;
        if (f === 1) pbox(a - .05, m + o0, z0, a + .05, m + o1, z1, PLT, 50 + s, (ff, aa, bb) => ff && rep(bb, .5) < PXZ * 1.5 ? -1.5 : 0);
        else pbox(m + o0, a - .05, z0, m + o1, a + .05, z1, PLT, 50 + s, (ff, aa, bb) => ff && rep(bb, .5) < PXZ * 1.5 ? -1.5 : 0);
      }
    }
    if (has(1)) for (const [x, y] of [[-m + .3, m - .3], [m - .3, -m + .3]]) { // sensor pylons
      post(x, y, top, top + 1.25, .045, [90, 98, 112], 5);
      pbox(x - .12, y - .12, top + 1.25, x + .12, y + .12, top + 1.45, PLT, 6, (f, a, b) => f && Math.abs(b - top - 1.35) < .03 ? col(255, 80, 60) : 0);
      glow(x + .12, y + .12, top + 1.35, [255, 90, 70]);
    }
    // the laser turret on the back corner (and the uplink mast behind it)
    const lx = -m + .55, ly = -m + .55;
    if (has(2)) {
      for (let s = 0; s < 3; s++) pbox(lx - .5 + s * .08, ly - .5 + s * .08, top + s * .16, lx + .5 - s * .08, ly + .5 - s * .08, top + (s + 1) * .16, s & 1 ? PLT : HULL, 7 + s);
      pbox(lx - .26, ly - .26, top + .48, lx + .26, ly + .26, top + .82, PLT, 10, (f, a, b) => f && Math.abs(b - top - .65) < .03 ? col(...CY) : 0);
      pbox(lx + .26, ly - .035, top + .62, lx + 1.55, ly + .035, top + .69, [60, 66, 78], 11);
      pbox(lx + 1.55, ly - .05, top + .6, lx + 1.62, ly + .05, top + .71, CY, 12, null, 0); glow(lx + 1.63, ly, top + .655, CY);
      shade(lx - .5, ly - .5, lx + .5, ly + .5, top, top + .82);
    }
    if (has(9)) { // an uplink mast with a square dish
      const x = -m + .18, y = -m + .18;
      post(x, y, top, top + 2.6, .04, [180, 186, 196], 13);
      for (let z = top + .4; z < top + 2.4; z += .4) bar(x - .12, y, x + .12, y, z, .015, .03, [180, 186, 196]);
      dish(x, y, top + 2.3, .32); bulb(x, y, top + 2.68, [255, 70, 50]);
    }
    if (has(5)) { // a drone on its pad at the right corner
      const x = m - .55, y = -m + .55;
      pbox(x - .36, y - .36, top, x + .36, y + .36, top + .04, [52, 56, 66], 14, (f, a, b) => f === 0 && (Math.abs(Math.abs(a - x) - .28) < .04 && Math.abs(Math.abs(b - y) - .28) < .1 || Math.abs(Math.abs(b - y) - .28) < .04 && Math.abs(Math.abs(a - x) - .28) < .1) ? col(236, 190, 50) : 0);
      const z = top + .2;
      pbox(x - .1, y - .1, z, x + .1, y + .1, z + .1, PLT, 15);
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { line3([x, y, z + .06], [x + dx * .24, y + dy * .24, z + .08], rampOf(DARK)[2]); pbox(x + dx * .24 - .09, y + dy * .24 - .09, z + .1, x + dx * .24 + .09, y + dy * .24 + .09, z + .115, [150, 156, 166], 16); }
      glow(x + .1, y + .1, z + .05, [120, 255, 140]);
    }
    if (has(6)) { // a hologram floating over the right wall: a turning diamond with a cross
      const y0 = .2, z0 = 1.8, c = rgb(150, 240, 255);
      for (let t = 0; t < 1; t += .012) { const ang = t * 6.283, r = .38 / (Math.abs(Math.cos(ang)) + Math.abs(Math.sin(ang))); plot(m + .25, y0 + Math.cos(ang) * r, z0 + Math.sin(ang) * r, c); }
      for (let s = -.2; s <= .2; s += PXA * .7) { plot(m + .25, y0 + s, z0, c); plot(m + .25, y0, z0 + s, c); }
      pbox(m, y0 - .1, 1.15, m + .14, y0 + .1, 1.27, [60, 66, 78], 17); glow(m + .25, y0, z0, CY);
    }
    if (has(7)) { // a railgun: two long rails over the left corner, a charge glowing between them
      const x = -m + .45, y = m - .45, z = top + .45;
      pbox(x - .22, y - .22, top, x + .22, y + .22, z, HULL, 18);
      for (const o of [-.07, .07]) pbox(x + o - .025, y - .1, z, x + o + .025, y + 1.35, z + .1, PLT, 19);
      for (let yy = y; yy < y + 1.3; yy += PXA * .7) plot(x, yy, z + .05, rgb(170, 240, 255));
      glow(x, y + 1.3, z + .05, CY);
    }
    if (has(8)) for (const [x, y] of [[-m - .2, m + .2], [m + .2, -m - .2]]) { // shield emitters on the ground
      post(x, y, 0, 2.3, .07, PLT, 20, (f, a, b) => f && rep(b, .4) < PXZ * 1.5 ? col(...CY) : 0);
      pbox(x - .14, y - .14, 0, x + .14, y + .14, .25, HULL, 21);
      pbox(x - .1, y - .1, 2.3, x + .1, y + .1, 2.55, CY, 22, null, .3); glow(x + .1, y + .1, 2.42, CY);
    }
    spots(.45, .45, .92, .92, top);
    hatch(.4, .4, top, [90, 98, 112]);
  }

  /* ---- 10. the final fortress: black armour, gold, a keep with a spire ---- */
  const GOLD = [226, 182, 66];
  function finalFort(k, I) {
    const m = 1.85, top = I.roof, has = n => k >= n, BLK = [62, 58, 70], RED = [176, 40, 40], kx = -m + 1.15, kt = top + 1.5;
    const emblem = has(1) ? (f, a, b) => {
      if (f !== 1 && f !== 2) return 0;
      // a shield with spread wings
      const cx = f === 1 ? .1 : -.1, cz = 1.05, dx = Math.abs(a - cx), dz = b - cz;
      if (dz > -.45 && dz < .38 && dx < .27 - Math.max(0, -dz - .15) * .7) return Math.abs(dz) < .05 && dx < .2 ? tone(RED, f) : tone(GOLD, f, dx < .07 ? 1 : 0);
      if (dz > -.08 && dz < .34 && dx < .95 && dx > .27 && (dz + .08) > (dx - .27) * .5 && rep(dx, .12) > PXA * 1.2) return tone(GOLD, f, dz > .2 ? 1 : 0);
      return 0;
    } : null;
    const trim = (f, a, b) => {
      if (!f) return 0;
      if (Math.abs(b - .38) < .05 || Math.abs(b - 1.72) < .035 || b > top - .14) return tone(GOLD, f, b > top - .07 ? 1 : 0);
      if (Math.abs(b - 2.3) < .07 && rep(a, .7, .2) < .3) return rgb(255, 120, 60);
      return rep(a, .7, .2) < PXA ? -1.1 : rep(b, .48) < PXZ ? -.7 : 0;
    };
    solid(-m - .15, -m - .15, 0, m + .15, m + .15, .3, [48, 44, 54], 1, (f, a, b) => f && b > .24 ? tone(GOLD, f) : 0);
    solid(-m, -m, 0, m, m, top, BLK, 2, pats(emblem, trim), .35);
    for (const [x, y] of [[m, m], [-m, m], [m, -m]]) pbox(x - .1, y - .1, .3, x + .1, y + .1, top + .05, GOLD, 3, (f, a, b) => f && rep(b, .5) < PXZ ? -1.2 : 0, .3);
    if (has(3)) for (const [f, a] of [[1, -1.05], [1, 1.2], [2, -1.15], [2, 1.0]]) { // red banners hanging from the parapet
      const z0 = .7, z1 = top - .05, emb = (ff, aa, bb) => {
        const e = Math.abs(aa - a);
        if (bb < z0 + .22 - e * 1.1) return 0;
        if (e > .17) return tone(GOLD, ff);
        return Math.abs(bb - 2.05) < .14 && e < .09 && Math.abs(bb - 2.05) + e < .15 ? tone(GOLD, ff, 1) : tone(RED, ff);
      };
      if (f === 1) pbox(a - .2, m + .02, z0, a + .2, m + .05, z1, RED, 4, emb, .4); else pbox(m + .02, a - .2, z0, m + .05, a + .2, z1, RED, 4, emb, .4);
    }
    // the parapet: black with a gold cap, low at the front
    for (const [x0, y0, x1, y1, h] of [[-m, -m, m, -m + .16, .42], [-m, -m, -m + .16, m, .42], [-m, m - .16, m, m, .3], [m - .16, -m, m, m, .3]]) {
      pbox(x0, y0, top, x1, y1, top + h, BLK, 5, (f, a, b) => f && b > top + h - .06 ? tone(GOLD, f, 1) : 0, .3);
    }
    // the keep on the back corner
    solid(-m, -m, top, kx, kx, kt, BLK, 6, (f, a, b) => f && (Math.abs(b - top - .9) < .035 || b > kt - .06) ? tone(GOLD, f) : f && Math.abs(b - top - .55) < .12 && rep(a, .35, .1) < .1 ? rgb(255, 120, 60) : f && rep(b, .5) < PXZ ? -.8 : 0, .35);
    glow(kx + .01, -m + .45, top + .55, [255, 140, 70]); glow(-m + .45, kx + .01, top + .55, [255, 140, 70]);
    const mer = has(9) ? GOLD : [80, 76, 88];
    for (let i = 0; i < 3; i++) { const s = -m + .08 + i * .4; pbox(s, kx - .14, kt, s + .24, kx, kt + .26, mer, 7 + i); pbox(kx - .14, s, kt, kx, s + .24, kt + .26, mer, 7 + i); }
    const sx = -m + .58, sy = -m + .58;
    if (has(4)) { // a stepped spire on the keep
      for (let s = 0; s < 3; s++) { const w = .42 - s * .12; pbox(sx - w, sy - w, kt + s * .32, sx + w, sy + w, kt + (s + 1) * .32, s === 1 ? [92, 86, 100] : BLK, 11 + s, (f, a, b) => f && b > kt + (s + 1) * .32 - .05 ? tone(GOLD, f) : 0); }
      post(sx, sy, kt + .96, kt + 1.7, .035, GOLD, 14);
      if (has(9)) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pbox(sx + dx * .14 - .04, sy + dy * .14 - .04, kt + 1.25, sx + dx * .14 + .04, sy + dy * .14 + .04, kt + 1.38, GOLD, 15);
    }
    if (has(5)) { pbox(sx - .07, sy - .07, kt + 1.7, sx + .07, sy + .07, kt + 1.82, [200, 50, 40], 16); BEACON = [sx, sy, kt + 1.86]; }
    if (has(2)) for (const [x, y, d] of [[-m + .5, m - .5, 'y'], [m - .5, -m + .5, 'x']]) {
      solid(x - .44, y - .44, top, x + .44, y + .44, top + .36, BLK, 27, (f, a, b) => f && b > top + .3 ? tone(GOLD, f) : 0, .3);
      turret(x, y, top + .36, .4, [118, 114, 130], d, 2, .95, .055, GOLD);
    }
    if (has(6)) for (const x of [.3, .95]) { // missile silos: open doors, noses showing
      const y = -m + .45;
      pbox(x - .24, y - .24, top, x + .24, y + .24, top + .06, [40, 38, 46], 17);
      pbox(x - .26, y - .28, top + .06, x + .26, y - .22, top + .5, [92, 86, 100], 18, (f, a, b) => f && Math.abs(b - top - .3) < .1 && rep(a, .16) < .08 ? tone([236, 190, 50], f) : 0);
      pbox(x - .1, y - .1, top + .06, x + .1, y + .1, top + .45, [236, 236, 230], 19); pbox(x - .06, y - .06, top + .45, x + .06, y + .06, top + .58, [200, 50, 40], 20);
    }
    if (has(7)) { // a plasma cannon out of the keep, coils glowing along it
      const y = -m + .5, z = top + .95;
      pbox(kx, y - .16, z - .12, kx + .35, y + .16, z + .2, [92, 86, 100], 21);
      pbox(kx + .35, y - .07, z - .02, kx + 1.85, y + .07, z + .1, [70, 66, 78], 22, (f, a) => f && rep(a, .3) < .1 ? rgb(230, 120, 255) : 0);
      pbox(kx + 1.85, y - .1, z - .05, kx + 1.95, y + .1, z + .13, [240, 170, 255], 23, null, 0); glow(kx + 1.96, y, z + .04, [240, 160, 255]); glow(kx + 1.0, y + .08, z + .1, [230, 120, 255]);
    }
    if (has(8)) for (const x of [-1.0, 1.05]) { // braziers by the gate, burning
      const y = m + .4;
      pbox(x - .12, y - .12, 0, x + .12, y + .12, .55, BLK, 24, (f, a, b) => f && b > .48 ? tone(GOLD, f) : 0);
      pbox(x - .2, y - .2, .55, x + .2, y + .2, .7, GOLD, 25);
      for (let i = 0; i < 26; i++) { const fx = x + (hash(i, 1) - .5) * .3, fy = y + (hash(i, 2) - .5) * .3, h = .1 + hash(i, 3) * .3; line3([fx, fy, .7], [fx, fy, .7 + h], rgb(...(h > .3 ? [255, 230, 120] : h > .2 ? [255, 160, 60] : [230, 80, 40]))); }
      glow(x, y, .95, [255, 190, 90]);
    }
    if (has(9)) for (const [x, y] of [[m - .08, m - .08], [-m + .08, m - .08], [m - .08, -m + .08]]) pbox(x - .1, y - .1, top + .3, x + .1, y + .1, top + .55, GOLD, 26, (f, a, b) => f && b > top + .48 ? 1 : 0);
    spots(.45, .45, .95, .95, top);
    hatch(.4, .4, top, [92, 86, 100]);
  }

  // forms not drawn yet: a plain block
  function placeholder(k, I) {
    const h = I.half, top = I.roof;
    solid(-h, -h, 0, h, h, top, CONCRETE, 1);
    spots(0, 0, I.deck - .35, I.deck - .35, top);
    hatch(-.1, -.1, top);
  }
  YARD_ART.radar = radar; YARD_ART.lattice = lattice; YARD_ART.dish = dish;
  const FORMS = [foxhole, watchtower, containers, shack, pillbox, reinforced, command, turretFort, citadel, finalFort];
  return { build() { const I = bunkerInfo(); SITES.length = 0; FORMS[I.form](I.sub, I); outline(); } };
})();
function buildBunker() { BUNKER_ART.build(); }
/* ================= the compound: things that collect inside the fence as the bunker levels up =================
   Every corner and strip of the yard holds one thing that is later replaced by a bigger one (the levels are in
   YARD_PROPS, buildings.js). Tall things stand at the back and the sides; the front stays low so nothing hides the roof */
const PROPS_ART = (() => {
  const { tone, PXA, PXZ, rep, col, pbox, shade, solid, post, bar, wire, lamp, bulb, ladder, railing, crateAt, drum, textAt, pats } = YARD_ART;
  const at = id => G.bunker >= yardPropAt(id);
  const OLV = [98, 110, 76], KHAKI = [176, 160, 116], WHITE_ = [226, 224, 216], REDC = [200, 50, 44], CY = [120, 230, 255];
  // a surface of plotted points over a parallelogram: origin o, edges e1 and e2 (for sloped canvas, panels and glass)
  function sheet(o, e1, e2, colorAt, step = .55) {
    const n1 = Math.ceil(Math.hypot(...e1) / (PXA * step)), n2 = Math.ceil(Math.hypot(...e2) / (PXA * step));
    for (let i = 0; i <= n1; i++) for (let j = 0; j <= n2; j++) {
      const s = i / n1, t = j / n2, c = colorAt(s, t);
      if (c) plot(o[0] + e1[0] * s + e2[0] * t, o[1] + e1[1] * s + e2[1] * t, o[2] + e1[2] * s + e2[2] * t, c);
    }
  }
  // a wheel seen side on: a dark square with a hub
  const wheel = (x, y, z, r, alongX) => alongX ? pbox(x - r, y - .06, z, x + r, y + .06, z + 2 * r, [40, 40, 44], 5, (f, a, b) => f && Math.abs(a - x) < r * .35 && Math.abs(b - z - r) < r * .35 ? col(120, 120, 124) : 0) : pbox(x - .06, y - r, z, x + .06, y + r, z + 2 * r, [40, 40, 44], 5, (f, a, b) => f && Math.abs(a - y) < r * .35 && Math.abs(b - z - r) < r * .35 ? col(120, 120, 124) : 0);
  // an A-frame tent along y: ridge at x = cx, from y0 to y1
  function tent(cx, y0, y1, w, h, c, cross) {
    const r = rampOf(c);
    sheet([cx, y0, h], [0, y1 - y0, 0], [w, 0, -h + .04], (s, t) => cross && Math.abs(s - .5) < .12 && Math.abs(t - .45) < .2 && (Math.abs(s - .5) < .045 || Math.abs(t - .45) < .07) ? col(...REDC) : r[t < .06 ? 3 : t > .92 ? 1 : 2]);
    sheet([cx, y1, h], [-w, 0, -h + .04], [w * 2, 0, 0], (s, t) => { const half = Math.abs(t - .5) * 2; if (half > s) return 0; if (cross && s > .3 && s < .75 && Math.abs(t - .5) < .14 && (Math.abs(t - .5) < .05 || Math.abs(s - .52) < .08)) return col(...REDC); return Math.abs(t - .5) < .07 && s > .45 ? col(50, 44, 40) : r[3]; });
    line3([cx, y0 - .05, h + .02], [cx, y1 + .05, h + .02], rampOf(WOOD)[1]);
    for (const y of [y0, y1]) { line3([cx, y, h], [cx + .1, y + (y === y1 ? .35 : -.35), 0], rampOf(ROPE)[2]); }
    shade(cx - w, y0, cx + w, y1, 0, h * .7);
  }
  function build() {
    const L = G.bunker;
    /* --- front-right strip: supply crates, later an ammunition magazine --- */
    if (at('ammo')) {
      solid(2.45, .6, 0, 3.2, 1.8, .42, [166, 162, 150], 1, (f, a, b) => f === 2 && Math.abs(a - 1.2) < .2 && b < .36 ? (Math.abs(a - 1.2) > .17 || b > .33 ? col(60, 62, 66) : col(110, 116, 120)) : f === 1 && b > .2 && b < .3 ? (rep(a, .2) < .1 ? tone([236, 190, 48], f) : tone([52, 50, 58], f)) : 0, .5);
      pbox(2.5, .65, .42, 3.15, 1.75, .52, DIRT, 2, null, 1.5);
      for (let i = 0; i < 40; i++) line3([2.55 + hash(i, 1) * .55, .7 + hash(i, 2) * 1.0, .52], [2.55 + hash(i, 1) * .55, .7 + hash(i, 2) * 1.0, .58 + hash(i, 3) * .06], rampOf([110, 140, 70])[2 + (i & 1)]);
      pbox(3.2, .75, .25, 3.22, 1.0, .4, [236, 190, 48], 3, (f, a, b) => Math.abs(a - .875) < .03 && b > .28 ? col(40, 38, 44) : 0, 0);
    } else if (at('crates')) {
      pbox(2.45, .7, 0, 3.15, 1.7, .07, [150, 112, 72], 4, (f, a) => f === 0 && rep(a, .14) < .05 ? -1.2 : 0);
      crateAt(2.66, .95, .07, .19, .2, .34, PLANK, 5); crateAt(2.98, .98, .07, .15, .17, .28, [150, 112, 72], 6);
      crateAt(2.72, 1.45, .07, .22, .2, .3, OLIVE, 7, col(214, 178, 60)); crateAt(2.66, .95, .41, .14, .14, .2, OLIVE, 8, col(214, 178, 60));
    }
    /* --- front-right strip, far end: fuel drums, later a missile launcher --- */
    if (at('missile')) {
      pbox(2.45, -1.45, .14, 3.2, -.55, .32, OLV, 9, (f, a) => f && rep(a, .3) < PXA ? -1 : 0);
      for (const y of [-1.38, -.62]) for (const x of [2.55, 3.1]) wheel(x, y, 0, .09, true);
      post(2.7, -1.0, .32, .62, .06, DARK, 10);
      for (const y of [-1.3, -1.1, -.9, -.7]) {
        for (const w of [0, .025, .05]) line3([2.5 + w * .3, y + w - .025, .5], [3.15 + w * .3, y + w - .025, 1.0], rampOf([200, 204, 196])[w === .025 ? 3 : 2]);
        pbox(3.12, y - .04, .96, 3.22, y + .04, 1.05, REDC, 11);
      }
    } else if (at('drums')) {
      for (const [x, y, c] of [[2.6, -.75, [168, 64, 48]], [2.92, -.73, [64, 96, 140]], [2.72, -1.08, [106, 118, 72]], [3.04, -1.06, [168, 64, 48]]]) drum(x, y, 0, .14, c, x * 9 + y);
      pbox(2.5, -1.45, 0, 2.95, -1.25, .22, [64, 96, 140], 12, (f, a) => f && Math.abs(rep(a, .45, 2.5) - .14) < .03 ? -1.3 : 0);
    }
    /* --- front-right strip, middle: an automatic gun turret --- */
    if (at('sentry')) {
      const x = 2.85, y = 0;
      solid(x - .2, y - .2, 0, x + .2, y + .2, .3, [80, 84, 92], 13);
      post(x, y, .3, .48, .06, DARK, 14);
      solid(x - .17, y - .15, .48, x + .15, y + .15, .7, [92, 100, 110], 15, (f, a, b) => f === 2 && Math.abs(a - y) < .05 && Math.abs(b - .62) < .04 ? col(255, 60, 50) : 0);
      for (const o of [-.07, .07]) pbox(x + .15, y + o - .025, .55, x + .55, y + o + .025, .6, DARK, 16);
      glow(x + .15, y, .62, [255, 70, 50]);
    }
    /* --- front-left strip: a campfire, later solar panels --- */
    const panel = (x0, x1, yLow, yHigh, zLow, zHigh) => {
      for (const x of [x0 + .05, x1 - .05]) post(x, yHigh, 0, zHigh, .025, STEEL, 17);
      sheet([x0, yLow, zLow], [x1 - x0, 0, 0], [0, yHigh - yLow, zHigh - zLow], (s, t) => (s < .03 || s > .97 || t < .05 || t > .95) ? col(170, 176, 184) : (rep(s * (x1 - x0), .15) < .02 || rep(t, .25) < .04) ? col(120, 150, 210) : col(40, 62, 120 + Math.round(t * 30)));
      shade(x0, Math.min(yLow, yHigh), x1, Math.max(yLow, yHigh), zLow, zHigh);
    };
    if (at('solar')) { panel(-1.88, -1.42, 3.18, 2.5, .14, .58); panel(-1.36, -.9, 3.18, 2.5, .14, .58); }
    else if (at('fire')) {
      const x = -1.4, y = 2.85;
      for (let q = 0; q < 8; q++) { const an = q / 8 * 6.283; pbox(x + Math.cos(an) * .24 - .05, y + Math.sin(an) * .24 - .05, 0, x + Math.cos(an) * .24 + .05, y + Math.sin(an) * .24 + .05, .07, [130, 126, 120], q); }
      for (const [a, b] of [[[-.15, -.1], [.15, .1]], [[-.15, .1], [.15, -.1]]]) for (const w of [0, .03]) line3([x + a[0], y + a[1] + w, .05], [x + b[0], y + b[1] + w, .1], rampOf(WOOD)[1]);
      for (let i = 0; i < 30; i++) { const fx = x + (hash(i, 4) - .5) * .22, fy = y + (hash(i, 5) - .5) * .22, h = .08 + hash(i, 6) * .26 * (1 - Math.hypot(fx - x, fy - y) * 3); if (h > .05) line3([fx, fy, .08], [fx, fy, .08 + h], rgb(...(h > .22 ? [255, 236, 140] : h > .14 ? [255, 168, 60] : [226, 84, 40]))); }
      glow(x, y, .3, [255, 190, 90]);
      pbox(x - .35, y - .5, 0, x + .35, y - .38, .14, WOOD, 20, logPatP); pbox(x + .4, y - .3, 0, x + .52, y + .3, .14, WOOD, 21, logPatP);
    }
    if (at('solar2')) {
      panel(-.68, -.22, 3.18, 2.5, .14, .58); panel(-.16, .3, 3.18, 2.5, .14, .58);
      solid(-.62, 2.42, 0, -.25, 2.55, .3, [80, 86, 94], 22, (f, a, b) => f === 1 && Math.abs(b - .22) < .03 && rep(a, .1) < .05 ? col(120, 255, 140) : 0);
    }
    /* --- front-left strip, near the front: a workbench, later a greenhouse --- */
    if (at('green')) {
      const x0 = .55, x1 = 1.85, y0 = 2.45, y1 = 3.15, h = .5;
      const glass = (f, a, b) => {
        const ca = f === 1 ? a : f === 2 ? a : 0;
        if (f && (rep(ca, .26) < PXA * 1.1 || b < .06 || b > h - .05)) return col(220, 224, 220);
        if (f && b < .32 && noise(ca * 6, b * 9) > .45) return tone([86, 150, 70], f, noise(ca * 9, b * 6) > .6 ? 1 : 0);
        return f ? tone([176, 214, 220], f, 1) : 0;
      };
      solid(x0, y0, 0, x1, y1, h, [176, 214, 220], 23, glass, .2);
      for (let s = 0; s < 3; s++) pbox(x0 - .02, y0 + s * .1, h + s * .07, x1 + .02, y1 - s * .1, h + (s + 1) * .07, [196, 222, 226], 24 + s, (f, a) => rep(a, .26) < PXA * 1.1 ? col(220, 224, 220) : 0, .2);
    } else if (at('bench')) {
      pbox(.6, 2.55, .42, 1.6, 2.95, .49, PLANK, 25, (f, a) => f === 0 && rep(a, .2) < PXA ? -1 : 0);
      for (const [x, y] of [[.65, 2.6], [1.55, 2.6], [.65, 2.9], [1.55, 2.9]]) post(x, y, 0, .42, .035, WOOD, 26);
      pbox(.66, 2.6, .49, .82, 2.76, .6, [70, 74, 80], 27); pbox(1.1, 2.65, .49, 1.45, 2.85, .66, [196, 56, 44], 28, (f, a, b) => f && Math.abs(b - .58) < .02 ? -1.5 : 0);
      line3([.9, 2.8, .5], [1.05, 2.9, .5], rampOf(METAL)[3]);
      for (const x of [1.72, 1.9]) post(x, 2.75, 0, .3, .03, WOOD, 29);
      pbox(1.65, 2.62, .3, 1.95, 2.9, .35, PLANK, 30);
    }
    /* --- the back corner: a wooden water tank, a steel one, then a water tower --- */
    if (at('tankB')) {
      const c = -2.82, z = 2.3;
      for (const [dx, dy] of [[-.32, -.32], [.32, -.32], [-.32, .32], [.32, .32]]) post(c + dx, c + dy, 0, z, .05, [120, 126, 134], 31);
      for (let zz = .5; zz < z - .2; zz += .6) { line3([c - .32, c + .34, zz], [c + .32, c + .34, zz + .55], rampOf(STEEL)[2]); line3([c + .34, c - .32, zz], [c + .34, c + .32, zz + .55], rampOf(STEEL)[1]); }
      solid(c - .48, c - .48, z, c + .48, c + .48, z + .95, [70, 120, 176], 32, (f, a, b) => f && Math.abs(b - z - .5) < .12 ? tone(WHITE_, f) : f && rep(a, .32) < PXA ? -1 : 0);
      for (let s = 0; s < 3; s++) pbox(c - .4 + s * .12, c - .4 + s * .12, z + .95 + s * .08, c + .4 - s * .12, c + .4 - s * .12, z + 1.03 + s * .08, [80, 128, 184], 33 + s);
      bulb(c, c, z + 1.28, [255, 70, 50]);
      ladder('y', c + .15, c + .48, 0, z + .95, [150, 156, 162]);
    } else if (at('tankS')) {
      const c = -2.82, z = 1.5;
      for (const [dx, dy] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) post(c + dx, c + dy, 0, z, .045, [120, 126, 134], 36);
      for (let zz = .25; zz < z - .2; zz += .6) { line3([c - .3, c + .32, zz], [c + .3, c + .32, zz + .55], rampOf(STEEL)[2]); line3([c + .32, c - .3, zz], [c + .32, c + .3, zz + .55], rampOf(STEEL)[1]); }
      solid(c - .42, c - .42, z, c + .42, c + .42, z + .9, [150, 158, 166], 37, pats((f, a, b) => f === 1 ? textAt('H2O', c - .3, z + .6, col(240, 240, 236), 1, 1)(a, b) : 0, (f, a, b) => f && rep(b, .3) < PXZ ? -1 : f && rep(a, .2) < .03 && rep(b, .3) < .06 ? 1.2 : 0));
      pbox(c - .3, c - .3, z + .9, c + .3, c + .3, z + .98, [130, 138, 146], 38);
      ladder('y', c + .15, c + .42, 0, z + .9, [150, 156, 162]);
    } else if (at('tank')) {
      const c = -2.82, z = 1.15;
      for (const [dx, dy] of [[-.28, -.28], [.28, -.28], [-.28, .28], [.28, .28]]) post(c + dx, c + dy, 0, z, .055, WOOD, 39, logPatP);
      for (const w of [0, .03]) { line3([c - .28, c + .31 + w, .1], [c + .28, c + .31 + w, z - .1], rampOf(WOOD)[2]); line3([c + .31 + w, c - .28, .1], [c + .31 + w, c + .28, z - .1], rampOf(WOOD)[1]); }
      pbox(c - .4, c - .4, z, c + .4, c + .4, z + .07, PLANK, 40);
      solid(c - .34, c - .34, z + .07, c + .34, c + .34, z + .8, [140, 100, 64], 41, (f, a, b) => f && (Math.abs(b - z - .22) < .025 || Math.abs(b - z - .62) < .025) ? col(60, 58, 64) : f && rep(a, .1) < PXA ? -1 : 0);
      ladder('y', c + .1, c + .4, 0, z + .5, [150, 112, 72]);
      line3([c + .2, c + .34, z + .1], [c + .5, c + .7, 0], rampOf(DARK)[2]);
    }
    /* --- the left corner: a wooden watchtower, a steel one, then a laser tower --- */
    if (at('towerX')) {
      const x = -2.82, y = 2.82;
      solid(x - .3, y - .3, 0, x + .3, y + .3, .3, [64, 72, 86], 42);
      solid(x - .18, y - .18, .3, x + .18, y + .18, 2.1, [212, 218, 224], 43, (f, a, b) => f && rep(b, .45) < PXZ * 1.4 ? col(...CY) : f && Math.abs(a - (f === 1 ? x : y)) < .04 ? -1 : 0, .3);
      solid(x - .3, y - .3, 2.1, x + .3, y + .3, 2.42, [70, 78, 94], 44, (f, a, b) => f && Math.abs(b - 2.26) < .03 ? col(...CY) : 0);
      pbox(x - .04, y + .3, 2.2, x + .04, y + .85, 2.28, [60, 66, 78], 45); pbox(x - .06, y + .85, 2.18, x + .06, y + .92, 2.3, CY, 46, null, 0);
      glow(x, y + .93, 2.24, CY); bulb(x, y, 2.5, [255, 70, 50]);
    } else if (at('towerS')) {
      const x = -2.82, y = 2.82, z = 1.9;
      for (const [dx, dy] of [[-.34, -.34], [.34, -.34], [-.34, .34], [.34, .34]]) post(x + dx, y + dy, 0, z, .04, [120, 126, 134], 47);
      for (let zz = .2; zz < z - .2; zz += .55) { line3([x - .34, y + .36, zz], [x + .34, y + .36, zz + .5], rampOf(STEEL)[2]); line3([x + .36, y - .34, zz], [x + .36, y + .34, zz + .5], rampOf(STEEL)[1]); }
      solid(x - .42, y - .42, z, x + .42, y + .42, z + .55, [120, 128, 136], 48, (f, a, b) => f && b > z + .22 && b < z + .44 && rep(a, .28) > .06 ? col(70, 110, 140) : 0);
      pbox(x - .5, y - .5, z + .55, x + .5, y + .5, z + .62, [90, 96, 104], 49);
      const fx = x + .2, fy = y + .2; pbox(fx - .12, fy - .12, z + .62, fx + .12, fy + .12, z + .82, [70, 74, 82], 50);
      pbox(fx + .12, fy - .09, z + .65, fx + .14, fy + .09, z + .79, [255, 250, 220], 51, null, 0); glow(fx + .14, fy, z + .72, [255, 250, 220]);
      ladder('x', y, x + .36, 0, z, [150, 156, 162]);
    } else if (at('towerL')) {
      const x = -2.82, y = 2.82, z = 1.6;
      for (const [dx, dy] of [[-.32, -.32], [.32, -.32], [-.32, .32], [.32, .32]]) post(x + dx, y + dy, 0, z + .95, .05, WOOD, 52, logPatP);
      for (const w of [0, .03]) { line3([x - .32, y + .35 + w, .15], [x + .32, y + .35 + w, z - .1], rampOf(WOOD)[2]); line3([x + .35 + w, y - .32, .15], [x + .35 + w, y + .32, z - .1], rampOf(WOOD)[1]); }
      pbox(x - .42, y - .42, z, x + .42, y + .42, z + .1, PLANK, 53);
      railing(x - .4, y - .4, x + .4, y + .4, z + .1, .35, WOOD, [0, 1, 2, 3], .4, .02);
      for (let s = 0; s < 3; s++) pbox(x - .5 + s * .14, y - .5 + s * .14, z + .95 + s * .08, x + .5 - s * .14, y + .5 - s * .14, z + 1.03 + s * .08, [120, 86, 58], 54 + s);
      ladder('x', y, x + .42, 0, z + .4, [150, 112, 72]);
      lamp(x + .3, y + .3, z + .55, [255, 206, 110], .05);
    }
    /* --- the back-left strip: a radio mast, a steel tower, then a satellite dish on top (tall: it shows over the bunker) --- */
    if (at('mast')) {
      const x = -2.82, y = -1.35, h = at('mastS') ? 3.6 : 2.9;
      YARD_ART.lattice(x, y, 0, h, at('mastS') ? .22 : .17, at('mastS') ? [200, 60, 50] : [170, 140, 110]);
      for (const [gx, gy] of [[-3.3, -.4], [-2.4, -.4], [-3.3, -2.0]]) line3([x, y, h * .7], [gx, gy, 0], rampOf(METAL)[2], .6);
      if (at('mastS')) for (const z of [h * .72, h * .55]) { pbox(x + .08, y - .12, z, x + .14, y + .12, z + .3, [226, 228, 230], 57); pbox(x - .12, y + .08, z, x + .12, y + .14, z + .3, [226, 228, 230], 57); }
      if (at('dish')) { pbox(x - .2, y - .2, h - .25, x + .2, y + .2, h - .15, STEEL, 59); YARD_ART.dish(x, y, h - .15, .55); }
      solid(-3.15, -.75, 0, -2.55, -.25, .55, at('mastS') ? [200, 204, 206] : PLANK, 58, (f, a, b) => f === 2 && Math.abs(a + .5) < .1 && b < .4 ? col(60, 50, 44) : f === 1 && Math.abs(a + 2.85) < .1 && Math.abs(b - .35) < .08 ? col(255, 214, 130) : 0);
    }
    /* --- the front corner: a helipad, then a helicopter on it --- */
    if (at('pad')) {
      const x0 = 2.42, x1 = 3.3, c = (x0 + x1) / 2;
      pbox(x0, x0, 0, x1, x1, .04, [150, 150, 146], 60, (f, a, b) => {
        if (f) return 0;
        const da = Math.abs(a - c), db = Math.abs(b - c);
        if (Math.max(da, db) > .36 && Math.max(da, db) < .41) return col(236, 190, 48);
        if ((Math.abs(da - .14) < .045 && db < .2) || (da < .14 && db < .035)) return col(240, 240, 236);
        return 0;
      }, .4);
      for (const [x, y] of [[x0 + .05, x0 + .05], [x1 - .05, x0 + .05], [x0 + .05, x1 - .05], [x1 - .05, x1 - .05]]) bulb(x, y, .06, [120, 255, 140]);
    }
    if (at('heli')) {
      const x = 2.86, y = 2.86, z = .18, B = [96, 108, 92];
      for (const o of [-.17, .17]) { pbox(x - .32, y + o - .02, .02, x + .28, y + o + .02, .05, DARK, 61); for (const xx of [x - .2, x + .14]) line3([xx, y + o, .05], [xx, y + o * .6, z + .02], rampOf(DARK)[2]); }
      solid(x - .28, y - .14, z, x + .2, y + .14, z + .32, B, 62);
      pbox(x + .2, y - .12, z + .03, x + .34, y + .12, z + .27, [120, 170, 200], 63, (f, a, b) => f && b > z + .22 ? -1 : 0);
      pbox(x - .85, y - .035, z + .16, x - .28, y + .035, z + .25, B, 64);
      pbox(x - .9, y - .01, z + .16, x - .8, y + .01, z + .4, B, 65);
      for (const w of [-.05, .05]) line3([x - .86, y + .02, z + .28 + w], [x - .86, y + .02, z + .28 - w], rampOf(DARK)[1]);
      post(x - .05, y, z + .32, z + .42, .03, DARK, 66);
      for (const [dx, dy] of [[.8, .2], [-.2, .8]]) line3([x - .05 - dx, y - dy, z + .43], [x - .05 + dx, y + dy, z + .43], rampOf(DARK)[1]);
      bulb(x - .9, y, z + .41, [255, 70, 50]);
    }
    /* --- the back-left strip: a tent that becomes a medical tent, then a field hospital --- */
    if (at('clinic')) {
      solid(-3.25, .35, 0, -2.42, 1.9, .95, WHITE_, 67, (f, a, b) => {
        if (!f) return rep(b, .3) < PXA ? -.6 : 0;
        if (Math.abs(b - .78) < .05) return tone(REDC, f);
        if (f === 2 && Math.abs(a - 1.35) < .17 && b < .7) return Math.abs(a - 1.35) > .14 || b > .66 ? col(90, 96, 104) : col(150, 170, 190);
        if (f === 2 && Math.abs(a - .75) < .2 && Math.abs(b - .45) < .17) return (Math.abs(a - .75) < .05 || Math.abs(b - .45) < .05) ? col(...REDC) : col(240, 240, 236);
        if (f === 1 && Math.abs(a + 2.83) < .2 && Math.abs(b - .45) < .15) return col(130, 176, 214);
        return rep(a, .4) < PXA ? -.8 : 0;
      }, .3);
      pbox(-3.3, .3, .95, -2.37, 1.95, 1.02, [190, 192, 190], 68);
      pbox(-3.0, .9, 1.02, -2.7, 1.3, 1.22, [170, 174, 176], 69, (f, a, b) => f && rep(b, .05) < PXZ ? -1.2 : 0);
      lamp(-2.42, .75, .72, [255, 246, 220], .05);
    } else if (at('medic')) tent(-2.83, .35, 1.9, .44, .95, WHITE_, true);
    else if (at('tent')) tent(-2.83, .45, 1.85, .42, .85, KHAKI, false);
    /* --- the right corner: a carport with a jeep, later an APC, then a tank --- */
    if (at('garage')) {
      const x0 = 2.35, x1 = 3.3, y0 = -3.32, y1 = -1.68, z = 1.1;
      pbox(x0, y0, 0, x1, y0 + .06, z, [150, 156, 160], 70, (f, a) => rep(a, .14) < PXA ? -1 : 0);
      for (const x of [x0 + .04, x1 - .04]) post(x, y1 - .04, 0, z, .04, [96, 72, 52], 71);
      pbox(x0 - .05, y0 - .04, z, x1 + .05, y1 + .05, z + .07, [150, 156, 160], 72, (f, a, b) => f === 0 && rep(a, .16) < PXA ? -1 : f === 1 && Math.abs(b - z - .035) < .02 ? tone([236, 190, 48], f) : 0);
      const cx = 2.82, cy = -2.5;
      if (at('tank2')) {
        for (const o of [-.34, .34]) pbox(cx + o - .1, cy - .72, 0, cx + o + .1, cy + .72, .26, [50, 50, 54], 73, (f, a, b) => f && rep(f === 2 ? a : b, .09) < .035 ? col(30, 30, 34) : 0);
        solid(cx - .3, cy - .7, .12, cx + .3, cy + .62, .4, [104, 112, 82], 74);
        pbox(cx - .3, cy + .62, .12, cx + .3, cy + .74, .3, [96, 104, 76], 75);
        solid(cx - .24, cy - .35, .4, cx + .22, cy + .15, .64, [110, 118, 88], 76, (f, a, b) => f && Math.abs(b - .52) < .02 ? -1.2 : 0);
        pbox(cx - .03, cy + .15, .48, cx + .04, cy + 1.05, .55, [70, 74, 66], 77);
        pbox(cx - .055, cy + .95, .46, cx + .065, cy + 1.07, .57, [60, 64, 58], 77);
      } else if (at('apc')) {
        for (const yy of [-.52, -.18, .16, .5]) for (const o of [-.3, .3]) wheel(cx + o, cy + yy, 0, .12, false);
        solid(cx - .27, cy - .68, .12, cx + .27, cy + .62, .56, [102, 112, 80], 78, (f, a, b) => f && Math.abs(b - .42) < .02 ? -1.2 : f === 2 && Math.abs(a - cy + .1) < .1 && b > .2 && b < .45 ? -1.6 : 0);
        pbox(cx - .22, cy + .62, .12, cx + .22, cy + .74, .42, [96, 106, 76], 79);
        solid(cx - .14, cy - .2, .56, cx + .12, cy + .12, .7, [96, 106, 76], 80);
        pbox(cx - .02, cy + .12, .6, cx + .02, cy + .55, .64, DARK, 81);
      } else {
        for (const yy of [-.33, .33]) for (const o of [-.26, .26]) wheel(cx + o, cy + yy, 0, .1, false);
        solid(cx - .23, cy - .46, .1, cx + .23, cy + .46, .34, [104, 116, 80], 82);
        pbox(cx - .21, cy + .12, .34, cx + .21, cy + .16, .6, [70, 74, 66], 83, (f, a, b) => f === 1 && b > .4 && b < .56 && Math.abs(a - cx) < .17 ? col(150, 190, 210) : 0);
        pbox(cx - .19, cy - .38, .34, cx + .19, cy - .04, .46, [70, 66, 60], 84);
        pbox(cx - .1, cy - .55, .12, cx + .1, cy - .46, .32, [40, 40, 44], 85);
      }
    }
    /* --- the back-right strip: a generator, a fuel depot, then a fusion reactor --- */
    if (at('fusion')) {
      const x0 = .45, x1 = 1.9, y0 = -3.2, y1 = -2.45;
      solid(x0, y0, 0, x1, y1, .55, [206, 212, 218], 86, (f, a, b) => f && Math.abs(b - .44) < .03 ? col(...CY) : f && rep(a, .26) < PXA ? -1 : 0, .3);
      const cx = 1.5, cy = -2.84;
      for (const [dx, dy] of [[-.26, -.26], [.26, -.26], [-.26, .26], [.26, .26]]) post(cx + dx, cy + dy, .55, 1.9, .04, [80, 88, 104], 87);
      pbox(cx - .15, cy - .15, .55, cx + .15, cy + .15, 1.8, CY, 88, (f, a, b) => f && rep(b, .2) < PXZ * 1.5 ? col(230, 255, 255) : 0, .4);
      for (const z of [.85, 1.25, 1.65]) pbox(cx - .3, cy - .3, z, cx + .3, cy + .3, z + .05, [90, 98, 114], 89);
      pbox(cx - .34, cy - .34, 1.9, cx + .34, cy + .34, 1.98, [90, 98, 114], 89);
      for (const x of [.65, .95]) solid(x - .12, -3.1, .55, x + .12, -2.6, 1.0, [170, 178, 190], 90, (f, a, b) => f && rep(b, .08) < PXZ ? -1.3 : 0);
      glow(cx + .15, cy + .15, .95, CY); glow(cx + .15, cy + .15, 1.45, CY);
    } else if (at('fuel')) {
      for (const [x, c] of [[1.15, [214, 216, 210]], [1.65, [206, 208, 200]]]) {
        solid(x - .22, -3.1, 0, x + .22, -2.66, 1.25, c, 91, (f, a, b) => f && Math.abs(b - .85) < .1 ? tone(REDC, f) : f && rep(b, .4) < PXZ ? -1 : 0, .3);
        pbox(x - .16, -3.04, 1.25, x + .16, -2.72, 1.32, [170, 172, 168], 92);
        ladder('y', x + .05, -2.66, 0, 1.25, [150, 156, 162]);
      }
      solid(.55, -2.95, 0, .85, -2.65, .5, [196, 56, 44], 92);
      line3([.85, -2.8, .4], [.93, -2.8, .4], rampOf(DARK)[1]);
      wire([.7, -2.65, .35], [.4, -2.3, .02], rampOf(DARK)[1], 1, false);
    } else if (at('gen')) {
      solid(.95, -3.05, .06, 1.77, -2.6, .55, [220, 176, 52], 93, (f, a, b) => f === 1 && a > 1.05 && a < 1.35 && b > .16 && b < .45 ? (rep(b, .06) < PXZ ? col(50, 50, 56) : col(90, 90, 96)) : f && b < .12 ? -1.3 : 0);
      for (const y of [-3.0, -2.65]) pbox(.9, y - .04, 0, 1.82, y + .04, .06, DARK, 94);
      post(1.65, -2.9, .55, .9, .03, DARK, 95); pbox(1.61, -2.94, .9, 1.69, -2.86, .94, DARK, 96);
      bulb(1.6, -2.59, .4, [120, 255, 140]);
      pbox(.6, -2.75, 0, .74, -2.6, .22, [196, 56, 44], 97);
      for (let t = 0; t <= 1; t += .01) plot(lerp(1.2, .7, t) + Math.sin(t * 9) * .08, lerp(-2.58, -2.1, t), .01, rgb(40, 38, 44));
    }
    /* --- the back-right strip, near the back corner: a workshop, a factory, then a radar on it --- */
    if (at('works')) {
      const x0 = -1.95, x1 = -.12, y0 = -3.28, y1 = -2.36, z = 1.15;
      solid(x0, y0, 0, x1, y1, z, [150, 156, 160], 98, (f, a, b) => f === 1 && Math.abs(a + 1.0) < .35 && b < .85 ? (Math.abs(a + 1.0) > .32 || b > .82 ? col(70, 74, 80) : rep(b, .1) < PXZ ? -1.2 : 0) : f && rep(a, .14) < PXA ? -.9 : 0);
      for (let i = 0; i < 3; i++) { const a0 = x0 + i * .61; for (let s = 0; s < 3; s++) pbox(a0 + s * .14, y0, z + s * .1, a0 + .61, y1, z + (s + 1) * .1, s === 2 ? [140, 190, 210] : [130, 136, 140], 99 + s); }
      bar(x1 - .1, y0 + .1, x1 - .1, y1 + .3, z + .5, .03, .06, [236, 190, 48]);
      for (const y of [y0 + .1, y1 + .3]) post(x1 - .1, y, 0, z + .5, .035, [236, 190, 48], 102);
      if (at('radar')) { post(-1.0, -2.85, z + .3, z + 1.0, .08, STEEL, 103); YARD_ART.radar(-1.0, -2.85, z + 1.0, .85, .5); }
    } else if (at('shop')) {
      const x0 = -1.9, x1 = -.2, y0 = -3.25, y1 = -2.45, z = .95;
      solid(x0, y0, 0, x1, y1, z, [176, 140, 100], 104, (f, a, b) => f === 1 && Math.abs(a + 1.2) < .32 && b < .75 ? (b < .45 ? col(36, 32, 40) : rep(b, .08) < PXZ ? -1.3 : .3) : f === 1 && Math.abs(a + .55) < .15 && Math.abs(b - .55) < .12 ? col(255, 206, 120) : f && rep(a, .14) < PXA ? -.9 : 0);
      for (let s = 0; s < 3; s++) pbox(x0 - .05, y0 - .05 + s * .1, z + s * .06, x1 + .05, y1 + .05 - s * .2, z + (s + 1) * .06, [130, 120, 110], 105 + s);
      post(-.5, -3.0, z, z + .7, .05, DARK, 108);
      glow(-.55, y1 + .01, .55, [255, 206, 120]);
    }
  }
  const logPatP = (f, a) => f && rep(a, .1) < .035 ? -.9 : 0;
  return { build };
})();
function buildProps() { PROPS_ART.build(); }
/* ================= the fence: ten forms of ten levels, all low; every level adds something along every side =================
   Each side is baked on its own at a wear stage (0 whole .. 3 badly broken, 5 knocked down) into an overlay (layers.js),
   so damage during a fight never re-bakes the yard */
const SIDE_AT = (side, s, R = FENCE_R) => [[s, R], [R, s], [s, -R], [-R, s]][side];
const FENCE_ART = (() => {
  const { tone, PXA, PXZ, rep, col, pbox, shade, solid, post, bar, wire, lamp, bulb, textAt, pats } = YARD_ART;
  const R = FENCE_R, SEG = 10, CY = [120, 230, 255];
  function side(sd, wear) {
    const L = G.fence;
    if (!L) return;
    const f = fenceForm(L), k = fenceSub(L), has = n => k >= n, down = wear >= 5, len = 2 * R / SEG;
    const alongX = sd === 0 || sd === 2, out = sd === 0 || sd === 1 ? 1 : -1; // outward is +y / +x for the front sides
    // a point on the side: t along it (0..1 over the segment j), o out from the line
    const P = (j, t, o = 0) => { const s = -R + (j + t) * len; return alongX ? [s, (sd === 0 ? R : -R) + o * out] : [(sd === 1 ? R : -R) + o * out, s]; };
    // a box along the side from t0 to t1 of segment j, o0..o1 out from the line, z0..z1 high
    const seg = (j, t0, t1, o0, o1, z0, z1, c, seed = 1, pat = null, grain = 1) => {
      const [ax, ay] = P(j, t0, o0), [bx, by] = P(j, t1, o1);
      solid(Math.min(ax, bx), Math.min(ay, by), z0, Math.max(ax, bx), Math.max(ay, by), z1, c, seed, pat, grain);
    };
    // a square post at t of segment j
    const pst = (j, t, w, z0, z1, c, seed = 2, pat = null, o = 0) => { const [x, y] = P(j, t, o); solid(x - w, y - w, z0, x + w, y + w, z1, c, seed, pat); };
    // a strand of wire along segment j at height z, sagging, with barbs
    const strand = (j, z, c, sag = .03, barb = 0, o = 0, t0 = 0, t1 = 1) => {
      const n = Math.ceil(len * (t1 - t0) / (PXA * .5));
      for (let i = 0; i <= n; i++) { const t = lerp(t0, t1, i / n), [x, y] = P(j, t, o); plot(x, y, z - Math.sin(t * Math.PI) * sag, barb && i % 7 === 3 ? barb : c); }
    };
    // which face of a box along this side the camera sees (1: the +y wall, 2: the +x wall); a sign hangs on it
    const vis = alongX ? 1 : 2;
    const sign = (j, t, z, w, h, c, mark, o = .04) => {
      const [x, y] = P(j, t, o);
      if (alongX) pbox(x - w, y - .015, z, x + w, y + .015, z + h, c, 3, (ff, a, b) => ff === 1 ? mark(a - x, b - z) : 0, .3);
      else pbox(x - .015, y - w, z, x + .015, y + w, z + h, c, 3, (ff, a, b) => ff === 2 ? mark(y - a, b - z) : 0, .3);
    };
    const debrisAt = (j, c, h = .06, seed = 0) => { // pieces lying on the ground by a broken segment
      const key = sd * 31 + j;
      for (let q = 0; q < 2; q++) {
        if (hash(key, 9 + q) > .75) continue;
        const t = .15 + hash(key, 11 + q) * .5, o = (hash(key, 13 + q) - .4) * .9, l = .2 + hash(key, 15 + q) * .25, [x, y] = P(j, t, o), across = hash(key, 17 + q) > .6;
        const hx = across !== alongX ? l / 2 : .05, hy = across !== alongX ? .05 : l / 2;
        solid(x - hx, y - hy, 0, x + hx, y + hy, h, c, seed + q);
      }
    };
    const corners = sd === 0 ? [0, SEG] : sd === 1 ? [0] : sd === 2 ? [0] : [];
    const cornerAt = j => j === SEG ? P(SEG - 1, 1) : P(j, 0);
    for (let j = 0; j < SEG; j++) {
      const key = sd * 31 + j, broken = down || hash(key, 5) < wear * .22;
      FORMS[f]({ j, key, broken, down, k, has, P, seg, pst, strand, sign, debrisAt, len, alongX, out, sd, vis });
    }
    // things on the corners (each corner belongs to one side)
    if (!down) for (const j of corners) {
      const [x, y] = cornerAt(j);
      CORNER[f]({ x, y, k, has, sd, wear });
    }
  }
  const WOODF = [140, 100, 64], PALE = [222, 204, 170];
  const FORMS = [
    // 1. wooden stakes: more of them, rope, sharpened tips, a rail, rags, crossed stakes, cans, placards
    c => {
      const { j, key, broken, has, P, pst, strand, sign, debrisAt, seg } = c;
      const per = has(2) ? 4 : 2;
      for (let n = 0; n < per; n++) {
        const t = (n + .5) / per, h = broken && n ? .1 : .42 + hash(key, n * 9) * .14;
        pst(j, t, .045, 0, h, WOODF, 4 + n, (f, a, b) => f && b > h - .06 ? (has(3) ? tone(PALE, f, 1) : .8) : 0);
        if (has(3) && !(broken && n)) { const [x, y] = P(j, t); pbox(x - .022, y - .022, h, x + .022, y + .022, h + .08, PALE, 5); }
      }
      if (broken) { debrisAt(j, WOODF); return; }
      if (has(4)) seg(j, 0, 1, -.035, .035, .15, .22, [176, 134, 88], 6);
      if (has(1)) { strand(j, .34, rampOf(ROPE)[4], .06); strand(j, .33, rampOf(ROPE)[2], .06); }
      if (has(5)) for (const t of [.3, .75]) { const [x, y] = P(j, t, .03); pbox(x - .04, y - .04, .1, x + .04, y + .04, .32, [210, 52, 40], 30, null, .3); }
      if (has(7)) for (const t of [.2, .7]) { const [x0, y0] = P(j, t - .12, .2), [x1, y1] = P(j, t + .12, -.05), [x2, y2] = P(j, t + .12, .2), [x3, y3] = P(j, t - .12, -.05); for (const w of [0, .02]) { line3([x0 + w, y0, 0], [x1 + w, y1, .38], rampOf(WOODF)[2]); line3([x2 + w, y2, 0], [x3 + w, y3, .38], rampOf(WOODF)[1]); } }
      if (has(8)) for (const t of [.15, .5, .85]) { const [x, y] = P(j, t, .02); line3([x, y, .33], [x, y, .27], rampOf(DARK)[2]); pbox(x - .045, y - .045, .15, x + .045, y + .045, .27, [214, 216, 220], 7, (f, a, b) => f && Math.abs(b - .21) < .03 ? col(200, 50, 40) : 0, .3); }
      if (has(9) && j % 2 === 1) sign(j, .5, .24, .17, .24, [236, 226, 200], (a, b) => Math.abs(Math.abs(a) - (b - .04) * .75) < .04 && b > .04 && b < .2 ? col(200, 40, 34) : 0, .05);
    },
    // 2. a picket fence: whitewash, more pickets, black posts, steel tips, a gate, vines, signs, wire on top
    c => {
      const { j, key, broken, has, P, pst, strand, sign, debrisAt, seg, sd } = c;
      const wood = has(1) ? [226, 222, 208] : [176, 132, 84];
      pst(j, 0, .055, 0, broken ? .2 : .58, has(3) ? [56, 54, 62] : WOODF, 8);
      if (has(3) && !broken) { const [x, y] = P(j, 0); pbox(x - .075, y - .075, .58, x + .075, y + .075, .63, [40, 40, 46], 9); }
      if (broken) { debrisAt(j, wood); return; }
      if (has(6) && sd === 0 && j === 5) { // the gate: two leaves with an X brace
        seg(j, .06, .94, -.015, .015, .08, .5, wood, 10, (f, a, b) => f ? (Math.abs(rep(a, .82, .24) - .41) < .02 ? -2 : Math.abs((rep(a, .41, .24) / .41) * .42 - (b - .08)) < .035 || Math.abs((1 - rep(a, .41, .24) / .41) * .42 - (b - .08)) < .035 ? -1.2 : 0) : 0);
        return;
      }
      seg(j, 0, 1, -.015, .015, .14, .19, wood, 11); seg(j, 0, 1, -.015, .015, .38, .43, wood, 12);
      const n = has(2) ? 6 : 4;
      for (let p = 0; p < n; p++) {
        const t = (p + .7) / (n + .4), [x, y] = P(j, t), h = .5;
        pbox(x - .03, y - .03, .02, x + .03, y + .03, h, wood, 13 + p);
        if (has(4)) pbox(x - .028, y - .028, h, x + .028, y + .028, h + .1, [206, 212, 220], 14);
        if (has(7) && hash(key, p) > .25) for (let z = .05; z < .25 + hash(key, p + 9) * .25; z += PXZ * .8) for (const o of [-.04, .04]) plot(x + .035 + o * (c.alongX ? 1 : 0), y + .035 + o * (c.alongX ? 0 : 1), z, rgb(...(hash(z * 50 | 0, p + o * 99) > .5 ? [100, 168, 74] : [62, 120, 58])));
      }
      if (has(9)) { strand(j, .62, rampOf(METAL)[4], .02, rampOf(DARK)[0]); strand(j, .66, rampOf(METAL)[3], .02, rampOf(DARK)[0]); }
      if (has(8) && j % 3 === 1) sign(j, .5, .2, .12, .16, [232, 190, 40], (a, b) => Math.abs(a) < .025 && b > .04 && b < .12 ? col(40, 38, 44) : 0, .05);
    },
    // 3. barbed wire on steel posts
    c => {
      const { j, key, broken, has, P, pst, strand, sign, debrisAt } = c;
      const wireC = rampOf([150, 156, 164])[3], barb = rampOf(DARK)[1];
      pst(j, 0, .03, 0, broken ? .16 : .55, [92, 98, 106], 15);
      if (has(9) && !broken) { const [x, y] = P(j, 0, .04); pbox(x - .05, y - .05, .38, x + .05, y + .05, .5, [255, 214, 70], 18, (f, a, b) => f && b > .44 ? col(250, 250, 240) : 0, 0); }
      if (has(6)) { const [x, y] = P(j, .5, .55); pbox(x - .025, y - .025, 0, x + .025, y + .025, .25, [92, 98, 106], 16); }
      if (broken) { debrisAt(j, [96, 100, 108], .04); for (let i = 0; i < 12; i++) { const [x, y] = P(j, hash(key, i), (hash(key, i + 20) - .5) * .5); plot(x, y, .02, wireC); } return; }
      for (const z of has(1) ? [.12, .3, .48] : [.16, .42]) { strand(j, z, wireC, .025, barb); if (has(1)) strand(j, z + .02, rampOf([150, 156, 164])[4], .025); }
      if (has(2)) for (let t = .05; t < 1; t += .17) { const [x, y] = P(j, t); for (let q = 0; q < 10; q++) { const an = q / 10 * 6.283; plot(x + (c.alongX ? Math.cos(an) * .05 : Math.cos(an) * .07), y + (c.alongX ? Math.cos(an) * .07 : Math.cos(an) * .05), .58 + Math.sin(an) * .07, q & 1 ? wireC : rampOf(METAL)[4]); } }
      if (has(3)) for (const t of [.2, .5, .8]) { const [x, y] = P(j, t, .02); pbox(x - .045, y - .045, .16, x + .045, y + .045, .29, [216, 216, 220], 17, (f, a, b) => f && Math.abs(b - .22) < .03 ? col(200, 50, 40) : 0, .3); }
      if (has(4)) { const [x0, y0] = P(j, 0), [x1, y1] = P(j, 1); for (const w of [0, .02]) { line3([x0, y0, .1 + w], [x1, y1, .48 + w], rampOf([150, 156, 164])[4]); line3([x0, y0, .48 + w], [x1, y1, .1 + w], rampOf([150, 156, 164])[4]); } }
      if (has(5) && j % 3 === 2) sign(j, .5, .2, .12, .14, [200, 50, 40], (a, b) => Math.abs(a) < .08 && Math.abs(b - .07) < .02 ? col(240, 236, 226) : 0);
      if (has(6)) { strand(j, .18, wireC, .03, barb, .55); }
      if (has(7)) for (let t = .08; t < 1; t += .14) { const [x, y] = P(j, t, .32); for (let q = 0; q < 10; q++) { const an = q / 10 * 6.283; plot(x + Math.cos(an) * .06 * (c.alongX ? 1 : .6), y + Math.cos(an) * .06 * (c.alongX ? .6 : 1), .08 + Math.sin(an) * .07, q & 1 ? wireC : barb); } }
    },
    // 4. chain-link panels
    c => {
      const { j, key, broken, has, P, pst, seg, strand, sign, debrisAt } = c;
      const meshC = rampOf(has(2) ? [80, 140, 90] : [176, 184, 190]), postC = has(2) ? [70, 120, 80] : [150, 158, 166];
      if (has(4)) seg(j, 0, 1, -.06, .06, 0, .1, [160, 156, 146], 18);
      pst(j, 0, .035, 0, broken ? .18 : .64, postC, 19);
      if (has(3) && !broken) { const [x, y] = P(j, 0); pbox(x - .065, y - .065, .64, x + .065, y + .065, .72, [236, 190, 48], 20); }
      if (broken) { debrisAt(j, postC, .03); return; }
      // the mesh: two sets of diagonals
      const z0 = has(4) ? .1 : .03, z1 = .6, n = 9;
      for (let i = -3; i <= n + 3; i++) {
        const t0 = i / n, t1 = (i + 3.2) / n, ta = Math.max(0, Math.min(1, t0)), tb = Math.max(0, Math.min(1, t1));
        if (tb <= ta) continue;
        const za = z0 + (ta - t0) / (t1 - t0) * (z1 - z0), zb2 = z0 + (tb - t0) / (t1 - t0) * (z1 - z0);
        const [ax, ay] = P(j, ta), [bx, by] = P(j, tb); line3([ax, ay, za], [bx, by, zb2], meshC[2], .7);
        const [cx2, cy2] = P(j, 1 - ta), [dx, dy] = P(j, 1 - tb); line3([cx2, cy2, za], [dx, dy, zb2], meshC[3], .7);
      }
      if (has(6)) for (let t = .04; t < 1; t += .08) { const [x, y] = P(j, t, .01); for (let z = z0 + .05; z < z1 - .02; z += PXZ * .7) if ((Math.floor(z * 14) + Math.floor(t * 12)) % 3) plot(x, y, z, rgb(...(Math.floor(t * 12) & 1 ? [214, 214, 206] : [70, 110, 160]))); }
      if (has(1)) seg(j, 0, 1, -.035, .035, .6, .66, has(2) ? [90, 150, 100] : [196, 204, 210], 21);
      if (has(5)) { const [x, y] = P(j, 0); const [x2, y2] = P(j, 0, .26); for (const w of [0, .02]) line3([x + w, y, .64], [x2 + w, y2, .74], rampOf(DARK)[2]); for (const [q, o] of [[.67, .1], [.7, .18], [.73, .26]]) strand(j, q, rampOf([176, 182, 190])[4], .02, rampOf(DARK)[0], o); }
      if (has(7) && j % 3 === 1) sign(j, .5, .25, .13, .17, [240, 238, 232], (a, b) => Math.abs(a) < .1 && Math.abs(b - .13) < .03 ? col(200, 40, 34) : Math.abs(a) < .1 && Math.abs(b - .06) < .015 ? col(40, 38, 44) : 0, .05);
      if (has(9)) { for (const t of [0, .5]) { const [x, y] = P(j, t, -.35); pbox(x - .02, y - .02, 0, x + .02, y + .02, .35, postC, 22); } strand(j, .3, meshC[3], .02, 0, -.35); strand(j, .15, meshC[3], .02, 0, -.35); }
    },
    // 5. steel hedgehogs
    c => {
      const { j, key, broken, has, P, seg, strand, sign, debrisAt, alongX } = c;
      const paint = has(2), beam = rampOf([110, 118, 128]), yel = rampOf([232, 186, 44]);
      const hog = (t, o, s) => {
        const [x, y] = P(j, t, o);
        if (has(6)) pbox(x - .24, y - .24, 0, x + .24, y + .24, .07, [160, 156, 146], 23);
        const z0 = has(6) ? .07 : 0;
        for (const [a, b] of [[[-s, 0], [s, 0]], [[0, -s], [0, s]]]) for (const w of [0, .025, .05]) {
          const cz = Math.abs(w - .025) < .01 ? 2 : w ? 1 : 3, col2 = (zz) => paint && zz > .25 && zz < .38 ? yel[cz] : beam[cz];
          line3([x + a[0] + w, y + a[1], z0], [x + b[0] + w, y + b[1], z0 + s * 1.6], col2(.3)); line3([x - a[0] + w, y - a[1], z0], [x - b[0] + w, y - b[1], z0 + s * 1.6], col2(.1));
        }
        if (has(4)) for (const [dx, dy] of [[s, 0], [-s, 0], [0, s], [0, -s]]) plot(x + dx * 1.1, y + dy * 1.1, z0 + s * 1.7, rgb(230, 230, 236));
        if (has(8)) for (let q = 0; q < 14; q++) plot(x + Math.cos(q) * .1, y + Math.sin(q) * .1, z0 + .1 + q * .025, rgb(60, 60, 66));
        castShadow(x, y, .2, s * .8);
      };
      if (broken) { const [x, y] = P(j, .5); pbox(x - .25, y - .05, 0, x + .25, y + .05, .07, [110, 118, 128], 24); debrisAt(j, [110, 118, 128], .05); return; }
      hog(.5, 0, .27);
      if (has(3)) hog(0, -.45, .2);
      if (has(1)) seg(j, 0, 1, -.04, .04, .1, .18, [96, 104, 114], 25, paint ? (f, a, b) => f ? (rep(a + b, .3) < .15 ? tone([232, 186, 44], f) : tone([40, 38, 44], f)) : 0 : null);
      if (has(5)) for (const o of [-.02, .02]) strand(j, .38, rgb(196, 198, 204), .08, rgb(90, 90, 96), o);
      if (has(9)) for (const t of [.2, .8]) { const [x, y] = P(j, t, .03); pbox(x - .05, y - .05, .06, x + .05, y + .05, .2, [250, 214, 70], 26, (f, a, b) => f && b > .15 ? col(250, 250, 240) : 0, 0); }
    },
    // 6. a sandbag wall
    c => {
      const { j, key, broken, has, P, seg, pst, strand, sign, debrisAt } = c;
      const lay = (r, n, gapAt = -1) => {
        for (let q = 0; q < n; q++) {
          if (q === gapAt) continue;
          const t0 = (q + (r & 1) * .5) / n, t1 = t0 + 1 / n - .03;
          if (t1 > 1.01) continue;
          const z = r * .155, cc = [[190, 166, 116], [178, 156, 106], [198, 178, 128]][(hash(key + q, r) * 3) | 0];
          seg(j, t0 + .01, Math.min(1, t1), -.13, .13, z, z + .15, cc, q + r * 5, (f, a, b) => f && (b - z < .035) ? -1.2 : f && b - z > .11 ? .8 : 0);
        }
      };
      if (broken) { lay(0, 3); debrisAt(j, [190, 166, 116], .12); return; }
      lay(0, 4); lay(1, 4);
      if (has(3)) lay(2, 4, (j % 2) ? 1 : 2);
      if (has(1)) for (const t of [0, .5]) pst(j, t, .055, 0, has(3) ? .6 : .48, [96, 70, 48], 27, (f, a, b) => f && b > (has(3) ? .54 : .42) ? 1.3 : 0, .14);
      if (has(2)) { for (let t = 0; t < 1; t += .02) for (let o = -.15; o <= .15; o += .05) { const [x, y] = P(j, t, o), n = noise(x * 3, y * 3); if (hash(t * 99 | 0, o * 99 | 0) < .35) continue; plot(x, y, (has(3) ? .47 : .31) + .02, n > .55 ? rgb(92, 108, 64) : n > .38 ? rgb(124, 128, 78) : rgb(130, 106, 72)); } }
      if (has(4) && j % 2 === 1) seg(j, .25, .7, .15, .19, 0, .38, [110, 118, 128], 28, (f, a, b) => f && rep(a, .2) < .03 ? 1 : 0);
      if (has(6)) strand(j, has(3) ? .56 : .42, rgb(176, 180, 188), .02, rgb(60, 60, 66));
      if (has(7)) seg(j, 0, 1, .2, .55, 0, .14, DIRT, 29, null, 1.5);
      if (has(8) && j % 2 === 0) sign(j, .5, .3, .18, .24, [52, 66, 48], (a, b) => (Math.abs(a) < .1 && Math.abs(b - .12) < .1 && (Math.abs(a) < .03 || Math.abs(b - .12) < .03)) || (Math.abs(a) > .14 || b < .03 || b > .21) ? col(236, 214, 120) : 0, .16);
    },
    // 7. jersey barriers of concrete
    c => {
      const { j, key, broken, has, P, seg, strand, sign, debrisAt, alongX } = c;
      const conc = [176, 172, 160];
      if (broken) { seg(j, .1, .4, -.16, .16, 0, .2, conc, 30); debrisAt(j, conc, .1); return; }
      const stripe = has(1) ? (f, a, b) => f && b > .24 && b < .36 ? (rep(a + b, .26) < .13 ? tone([236, 190, 48], f, 1) : tone([46, 44, 52], f, 1)) : 0 : null;
      const red = has(9) ? (f, a, b) => f && b > .4 && b < .46 ? tone([196, 52, 44], f, 1) : 0 : null;
      const num = has(5) ? (f, a, b) => f ? textAt(String((c.sd * 10 + j) % 100).padStart(2, '0'), alongX ? (P(j, .38)[0]) : (P(j, .38)[1]), .2, col(40, 38, 44), alongX ? 1 : -1)(a, b) : 0 : null;
      seg(j, .04, .96, -.16, .16, 0, .16, conc, 31, stripe);
      seg(j, .04, .96, -.1, .1, .16, .48, conc, 32, pats(red, stripe));
      if (has(5)) { const [x, y] = P(j, .5, .105); const dig = String((c.sd * 10 + j) % 100).padStart(2, '0'); if (alongX) pbox(x - .16, y, .18, x + .16, y + .015, .42, [240, 238, 230], 33, (f, a, b) => f === 1 ? textAt(dig, x - .12, .38, col(40, 38, 44), 1, 1)(a, b) : 0, 0); else pbox(x, y - .16, .18, x + .015, y + .16, .42, [240, 238, 230], 33, (f, a, b) => f === 2 ? textAt(dig, y + .12, .38, col(40, 38, 44), -1, 1)(a, b) : 0, 0); }
      if (has(2)) { const [x, y] = P(j, .5); bulb(x, y, .5, [255, 90, 60]); }
      if (has(3)) { seg(j, .9, 1.1, -.12, .12, .28, .4, [120, 126, 136], 34, (f, a, b) => f && rep(a, .08) < .03 ? 1.3 : 0); }
      if (has(4)) for (let t = .08; t < .93; t += .06) { const [x, y] = P(j, t); line3([x, y, .48], [x, y, .62], rgb(150, 156, 164)); } 
      if (has(4)) strand(j, .62, rgb(150, 156, 164), 0, 0, 0, .06, .94);
      if (has(7)) for (let t = .1; t < .95; t += .1) { const [x, y] = P(j, t); pbox(x - .02, y - .02, .48, x + .02, y + .02, .62, [226, 228, 234], 36); }
      if (has(8)) seg(j, .4, .6, -.4, -.1, 0, .3, conc, 35);
    },
    // 8. steel wall panels
    c => {
      const { j, key, broken, has, P, seg, pst, strand, sign, debrisAt } = c;
      const plate = has(9) ? [52, 52, 60] : [112, 122, 132];
      pst(j, 0, .05, 0, broken ? .2 : .62, has(9) ? [40, 40, 46] : [84, 92, 100], 36);
      if (broken) { seg(j, .1, .7, .2, .26, 0, .05, plate, 37); debrisAt(j, plate, .04); return; }
      const pat = (f, a, b) => {
        if (!f) return 0;
        if (has(9) && Math.abs(b - .5) < .025) return tone([226, 182, 66], f, 1);
        if (has(3) && b > .3 && b < .4 && Math.abs(rep(a, .72, -R + .36) - .36) < .18) return Math.abs(rep(a, .72, -R + .36) - .36) > .15 || b > .38 ? col(190, 196, 204) : col(20, 18, 24);
        if (has(2) && !has(9)) { const n = noise(a * 1.6 + 5, b * 3); if (n > .58) return tone([110, 128, 76], f, 1); if (n < .36) return tone([150, 124, 88], f, 1); }
        if (has(1) && (Math.abs(b - .1) < .03 || Math.abs(b - .48) < .03) && rep(a, .12) < .05) return col(220, 224, 230);
        return rep(a, .72, -R) < PXA ? -1 : 0;
      };
      seg(j, .02, .98, -.025, .025, .02, .56, plate, 38, pat);
      if (has(4)) for (let t = .04; t < .96; t += .12) seg(j, t, t + .06, -.02, .02, .56, .68, has(9) ? [226, 182, 66] : [176, 184, 194], 39);
      if (has(5) && j % 3 === 1) sign(j, .5, .18, .11, .15, [236, 232, 220], (a, b) => { const SK = ['.XXX.', 'X.X.X', 'XXXXX', '.X.X.']; const cx = Math.floor((a + .11) / PXA / 1.0 - 1), cz = Math.floor((.13 - b) / PXZ); return cz >= 0 && cz < 4 && cx >= 0 && cx < 5 && SK[cz][cx] === 'X' ? col(40, 38, 44) : 0; }, .045);
      if (has(7)) for (const t of [.25, .75]) { const [x0, y0] = P(j, t, -.03), [x1, y1] = P(j, t, -.42); for (const w of [0, .025, .05]) line3([x0 + w, y0, .5], [x1 + w, y1, 0], rampOf([150, 158, 168])[w ? 3 : 2]); }
      if (has(8)) seg(j, .15, .6, .025, .06, .08, .48, [140, 150, 160], 40, (f, a, b) => f && (b < .12 || b > .44) ? 1.3 : f && rep(a, .1) < .03 && (b < .16 || b > .4) ? col(230, 232, 236) : 0);
    },
    // 9. an electric fence
    c => {
      const { j, key, broken, has, P, seg, pst, strand, sign, debrisAt } = c;
      const live = has(7) ? rgb(140, 220, 255) : rgb(176, 186, 196), postC = [62, 66, 76];
      pst(j, 0, .035, 0, broken ? .2 : .66, postC, 41);
      if (has(6)) seg(j, 0, 1, -.06, .06, 0, .09, [232, 186, 44], 42, (f, a, b) => f && rep(a, .3) < .04 ? col(40, 38, 44) : 0);
      if (broken) { debrisAt(j, postC, .04); for (let i = 0; i < 10; i++) { const [x, y] = P(j, hash(key, i), (hash(key, i + 30) - .5) * .4); plot(x, y, .02, live); } return; }
      for (const z of [.12, .28, .44, .6]) strand(j, z, live, .015);
      if (has(3)) { const [x, y] = P(j, .5); pbox(x - .03, y - .03, .6, x + .03, y + .03, .66, [50, 50, 56], 49); plot(x + .04, y + .04, .64, rgb(255, 70, 50)); }
      if (has(1)) { const [x, y] = P(j, 0); for (const z of [.12, .28, .44, .6]) pbox(x - .045, y - .045, z - .03, x + .045, y + .045, z + .03, [240, 240, 232], 43); }
      if (has(2) && j % 3 === 2) sign(j, .5, .26, .12, .14, [240, 200, 50], (a, b) => Math.abs(a - (b - .07) * .9) < .02 && Math.abs(b - .07) < .05 ? col(40, 38, 44) : 0, .02);
      if (has(4)) { for (const t of [0, .5]) { const [x, y] = P(j, t, -.25); pbox(x - .02, y - .02, 0, x + .02, y + .02, .36, [62, 66, 76], 48); } for (const z of [.14, .3]) strand(j, z, rgb(120, 200, 255), .02, 0, -.25); }
      if (has(8) && j % 3 === 0) { const [x, y] = P(j, .5, -.12); pbox(x - .06, y - .06, 0, x + .06, y + .06, .55, [70, 76, 90], 44, (f, a, b) => f && rep(b, .12) < PXZ * 1.4 ? col(120, 220, 255) : 0); pbox(x - .045, y - .045, .55, x + .045, y + .045, .64, CY, 45, null, 0); glow(x + .05, y + .05, .6, CY); }
      if (has(9) && j % 2 === 1) { const [x, y] = P(j, 0); pbox(x - .08, y - .08, .66, x + .12, y + .08, .78, [232, 234, 236], 46); pbox(x + .12, y - .04, .69, x + .15, y + .04, .75, [40, 40, 46], 47, null, 0); glow(x + .15, y, .72, [255, 60, 50]); }
    },
    // 10. an energy barrier between emitter posts
    c => {
      const { j, key, broken, has, P, seg, pst, strand, sign, debrisAt } = c;
      const gold = has(9), pc = [58, 64, 80];
      pst(j, 0, .05, 0, broken ? .22 : .6, pc, 47, (f, a, b) => gold && f && b > .5 ? tone([226, 182, 66], f, 1) : f && Math.abs(b - .52) < .03 ? col(...CY) : 0);
      if (has(1) && j % 2 === 0) { const [x, y] = P(j, 0); pbox(x - .09, y - .09, 0, x + .09, y + .09, .2, gold ? [226, 182, 66] : [70, 78, 96], 48); }
      if (broken) { debrisAt(j, pc, .05); return; }
      if (has(3)) seg(j, 0, 1, -.04, .04, 0, .02, [100, 220, 255], 49, null, 0);
      // the field: thin bright lines along the top and bottom, faint streaks between (denser and brighter later)
      const field = (o, top, dense) => {
        for (let t = .04; t <= .96; t += PXA * .5 / len) for (let z = .06; z <= top; z += PXZ * .7) {
          const [x, y] = P(j, t, o), col_ = Math.floor(t * len / PXA), edge = Math.abs(z - top) < .035 || z < .1 || (has(5) && Math.abs(z - .3) < .02);
          if (edge) { plot(x, y, z, rgb(220, 250, 255)); continue; }
          if (col_ % (dense ? 2 : 4)) continue;
          if (((col_ >> 1) + Math.floor(z * 18)) % (dense ? 2 : 3) === 0) continue;
          plot(x, y, z, (col_ >> 2) & 1 ? rgb(120, 210, 250) : rgb(80, 176, 236));
        }
      };
      field(0, .55, has(2));
      if (has(7)) field(-.3, .3, false);
      if (has(4)) { const [x, y] = P(j, .5); pbox(x - .03, y - .03, 0, x + .03, y + .03, .3, pc, 50); pbox(x - .04, y - .04, .3, x + .04, y + .04, .36, CY, 51, null, 0); }
      if (has(6)) for (let t = .1; t < 1; t += .2) { const [x, y] = P(j, t); plot(x, y, .62, rgb(230, 250, 255)); plot(x, y, .65, rgb(150, 230, 255)); }
      if (has(8) && j % 2 === 0) { const [x, y] = P(j, 0); glow(x + .05, y + .05, .52, CY); }
      if (has(5) && j % 4 === 2) { const [x, y] = P(j, .5, .05); for (let q = 0; q < 24; q++) { const an = q / 24 * 6.283, r = .1 / (Math.abs(Math.cos(an)) + Math.abs(Math.sin(an))); plot(x + (c.alongX ? Math.cos(an) * r : 0), y + (c.alongX ? 0 : Math.cos(an) * r), .8 + Math.sin(an) * r, rgb(150, 240, 255)); } }
    },
  ];
  // what stands on the corners
  const CORNER = [
    c => { if (c.has(6)) { const { x, y } = c; post(x, y, 0, .75, .045, [110, 80, 54]); pbox(x - .07, y - .07, .75, x + .07, y + .07, .82, DARK, 1); for (let i = 0; i < 10; i++) line3([x + (hash(i, 1) - .5) * .1, y + (hash(i, 2) - .5) * .1, .82], [x + (hash(i, 1) - .5) * .1, y + (hash(i, 2) - .5) * .1, .86 + hash(i, 3) * .14], rgb(...(hash(i, 4) > .5 ? [255, 210, 90] : [240, 110, 40]))); glow(x, y, .92, [255, 190, 90]); } },
    c => { if (c.has(5)) { const { x, y } = c; post(x, y, 0, .8, .04, [56, 54, 62]); lamp(x, y, .8, [255, 230, 160], .06); } },
    c => { if (c.has(8)) { const { x, y } = c; post(x, y, 0, .78, .035, [92, 98, 106]); pbox(x - .1, y - .1, .78, x + .1, y + .1, .9, [70, 74, 82], 2); pbox(x + .1, y - .07, .8, x + .12, y + .07, .88, [255, 250, 220], 3, null, 0); pbox(x - .07, y + .1, .8, x + .07, y + .12, .88, [255, 250, 220], 3, null, 0); glow(x + .12, y + .12, .84, [255, 250, 220]); } },
    c => { if (c.has(8)) { const { x, y } = c; post(x, y, 0, .75, .035, [70, 120, 80]); lamp(x, y, .75, [255, 240, 200], .06); } },
    c => { if (c.has(7)) { const { x, y } = c; pbox(x - .1, y - .1, 0, x + .1, y + .1, .3, [70, 74, 82], 4); pbox(x - .06, y - .06, .3, x + .06, y + .06, .42, [255, 170, 40], 5, null, 0); glow(x + .06, y + .06, .36, [255, 180, 60]); } },
    c => { if (c.has(5)) { const { x, y } = c; post(x, y, 0, .6, .04, [110, 80, 54]); lamp(x, y, .6, [255, 206, 110], .06); } if (c.has(9)) { const { x, y } = c; for (const w of [0, .02]) line3([x + w, y, .35], [x + .35 + w, y + .35, .45], rampOf(DARK)[w ? 0 : 2]); pbox(x - .08, y - .08, .25, x + .08, y + .08, .38, [96, 108, 84], 6); } },
    c => { if (c.has(6)) { const { x, y } = c; pbox(x - .12, y - .12, 0, x + .12, y + .12, .5, [176, 172, 160], 7); pbox(x - .07, y - .07, .5, x + .07, y + .07, .62, [255, 170, 40], 8, null, 0); glow(x + .07, y + .07, .56, [255, 180, 60]); } },
    c => { if (c.has(6)) { const { x, y } = c; post(x, y, 0, .8, .045, [84, 92, 100]); pbox(x - .1, y - .1, .8, x + .1, y + .1, .94, [60, 64, 72], 9); pbox(x + .1, y - .07, .82, x + .12, y + .07, .92, [255, 250, 220], 10, null, 0); glow(x + .12, y, .87, [255, 250, 220]); } },
    c => { if (c.has(3)) { const { x, y } = c; pbox(x - .06, y - .06, .66, x + .06, y + .06, .76, [60, 60, 66], 11); } if (c.has(5)) { const { x, y } = c; pbox(x - .22, y - .22, 0, x + .05, y + .05, .42, [96, 104, 112], 12, (f, a, b) => f && Math.abs(b - .3) < .05 ? tone([232, 190, 40], f, 1) : f && rep(a, .07) < .025 && b < .22 ? -1.2 : 0); } },
    c => { if (c.has(8)) { const { x, y } = c; pbox(x - .1, y - .1, .6, x + .1, y + .1, .72, CY, 13, null, 0); glow(x + .1, y + .1, .66, CY); } },
  ];
  return { side };
})();
function buildFenceSide(side, wear) { FENCE_ART.side(side, wear); }
// the yard picture = the base (ground, props, bunker: baked when the bunker changes) + four fence sides
const basePix = new Uint32Array(W * H), baseZ = new Float32Array(W * H), baseShadow = new Uint8Array(W * H);
let baseGlows = [], fenceGlows = [];
function bakeYardBase() {
  GLOWS.length = 0; BEACON = null;
  pix.set(groundPix); kinds.set(groundKinds); ground.set(groundMask); zb.set(groundDepth); groundZ.set(groundDepth);
  shadowMask.fill(0);
  buildProps();
  buildBunker();
  const box = objectBounds(groundDepth, 8);
  if (box) bakeOcclusion(...box);
  staticShadow.set(shadowMask);
  applyShadows(groundZ);
  basePix.set(pix); baseZ.set(zb); baseShadow.set(staticShadow);
  baseGlows = GLOWS.slice();
  composeYard();
}
const fenceCache = new Map();
let fenceCacheLevel = -1;
function fenceOverlay(side, wear) {
  if (fenceCacheLevel !== G.fence) { fenceCache.clear(); fenceCacheLevel = G.fence; }
  const key = side * 8 + wear;
  let ov = fenceCache.get(key);
  if (!ov) { ov = captureOverlay(groundDepth, groundMask, () => buildFenceSide(side, wear)); fenceCache.set(key, ov); }
  return ov;
}
function composeYard() {
  const list = G.fence ? [0, 1, 2, 3].map(s => fenceOverlay(s, G.fenceDown ? 5 : G.sideStage[s])) : [];
  yardPix.set(basePix); yardZ.set(baseZ); yardShadow.set(baseShadow);
  layOverlays(list, yardPix, yardZ, groundDepth, yardShadow);
  fenceGlows = list.flatMap(o => o.glows);
  GLOWS.length = 0; GLOWS.push(...baseGlows, ...fenceGlows);
  fenceDirty = false;
  if (G.view === 'yard') showYard(); else showUnder();
}
function bakeYard() { bakeYardBase(); }
let fenceDirty = false;
const yardPix = new Uint32Array(W * H), yardZ = new Float32Array(W * H), yardShadow = new Uint8Array(W * H);
function showYard() { bakedPix.set(yardPix); bakedZ.set(yardZ); groundZ.set(groundDepth); ground.set(groundMask); staticShadow.set(yardShadow); }
