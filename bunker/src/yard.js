'use strict';
// The yard: the ground, the bunker and the fence, each drawn from its components × stages table (buildings.js).
// Everything is built from boxes and pixel lines; nothing is round.
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
// small helpers for building out of boxes and pixel lines (under.js uses these too)
function line3(a, b, color, dense = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / STEP * dense));
  for (let k = 0; k <= n; k++) { const t = k / n; plot(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), color); }
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
  // while a bunker form draws, whatever stands on its roof deck is noted (with its top), so no gunner is put inside it
  let REC = null;
  function pbox(x0, y0, z0, x1, y1, z1, c, seed = 0, pat = null, grain = 1) {
    if (REC && z1 > REC.z + .12 && z0 < REC.z + 1.7 && x1 > REC.x0 && x0 < REC.x1 && y1 > REC.y0 && y0 < REC.y1) REC.list.push([x0, y0, x1, y1, z1]);
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
  // the roof deck the gunners stand on (call before drawing anything on it); block() notes a thing drawn with lines
  function deck(x0, y0, x1, y1, z, hatchColor = STEEL) { REC = { x0, y0, x1, y1, z, list: [], hatchColor }; }
  const block = (x0, y0, x1, y1, z1 = 1e9) => { if (REC) REC.list.push([x0, y0, x1, y1, z1]); };
  // Six gunner spots where every face stays in sight. A survivor is drawn 32 px tall with the head a 15 px square
  // 17..31 px above the feet (actors.js), so two of them keep their heads clear of each other when they stand a
  // head's width apart side by side or a head's height apart one above the other. The six are packed as far apart
  // as that allows on the open deck, each where the bunker hides none of the head and little of the body; the hero
  // gets a spot with nobody just behind it (its reload bar is drawn over that face). Then the hatch, away from all
  const HEAD_W = 16, HEAD_H = 15, LOW = .62;
  function placeCrew() {
    const D = REC; REC = null;
    if (!D) return;
    const { x0, y0, x1, y1, z, list } = D, perPx = SIN / (S * COS);
    // feet on open deck, e in from its edge: a step from low things (parapets, sandbags: they can only hide legs),
    // further from taller ones
    const open = (x, y, e, low, tall) => x > x0 + e && x < x1 - e && y > y0 + e && y < y1 - e &&
      !list.some(([a, b, c, d, t]) => { const m = t < z + LOW ? low : tall; return x > a - m && x < c + m && y > b - m && y < d + m; });
    // the head is drawn at one depth (drawSurvivor), the body row by row
    const seen = (x, y) => {
      const p = project(x, y, z), bx = Math.round(p.sx), by = Math.round(p.sy), dh = p.d + 17 * perPx + .05;
      for (let r = 17; r <= 32; r++) for (let c = -8; c <= 8; c++) {
        const ix = bx + c, iy = by - r;
        if (ix < 0 || iy < 0 || ix >= W || iy >= H || zb[iy * W + ix] >= dh) return false;
      }
      let hid = 0, n = 0;
      for (let r = 3; r <= 16; r++) for (let c = -6; c <= 6; c += 2) { n++; const ix = bx + c, iy = by - r; if (ix < 0 || iy < 0 || ix >= W || iy >= H || zb[iy * W + ix] >= p.d + r * perPx + .01) hid++; }
      return hid <= n * .2;
    };
    const floorSeen = (x, y) => [[0, 0, .03], [0, 0, .1], [.15, .15, .05], [-.15, -.15, .05]].every(([dx, dy, h]) => {
      const q = project(x + dx, y + dy, z + h), ix = Math.round(q.sx), iy = Math.round(q.sy);
      return ix >= 0 && iy >= 0 && ix < W && iy < H && zb[iy * W + ix] <= q.d + .02;
    });
    const cx = [], cy = [], hx = [], hy = [];
    for (let x = x0; x <= x1 + 1e-6; x += .1) for (let y = y0; y <= y1 + 1e-6; y += .1) {
      if (open(x, y, .1, .1, .2) && seen(x, y)) { cx.push(x); cy.push(y); }
      if (open(x, y, .32, .32, .32) && floorSeen(x, y)) { hx.push(x); hy.push(y); }
    }
    for (let i = cx.length; i < 6; i++) { cx.push((x0 + x1) / 2); cy.push((y0 + y1) / 2); }
    const N = cx.length, X = new Float64Array(N), Y = new Float64Array(N);
    for (let c = 0; c < N; c++) { const p = project(cx[c], cy[c], z); X[c] = p.sx; Y[c] = p.sy; }
    // how clear two figures are of each other on screen: 1 = the heads just miss
    const clr = (a, b) => Math.max(Math.abs(X[a] - X[b]) / HEAD_W, Math.abs(Y[a] - Y[b]) / HEAD_H);
    // can six stand at least c apart? greedy scans from each side of the deck, along rows and along columns;
    // the widest c that fits is found by halving
    const idx = Array.from({ length: N }, (_, i) => i);
    const orders = [[X, 1, Y, 1], [X, 1, Y, -1], [X, -1, Y, 1], [X, -1, Y, -1], [Y, 1, X, 1], [Y, -1, X, 1]].map(([P, s, Q, t]) => idx.slice().sort((a, b) => s * (P[a] - P[b]) || t * (Q[a] - Q[b])));
    const fit = c => {
      for (const ord of orders) {
        const pick = [];
        for (let k = 0; k < N && pick.length < 6; k++) { const q = ord[k]; if (pick.every(p => clr(p, q) >= c)) pick.push(q); }
        if (pick.length === 6) return pick;
      }
      return null;
    };
    let lo = 0, hi = 3, best = fit(0);
    for (let it = 0; it < 12; it++) { const mid = (lo + hi) / 2, pick = fit(mid); if (pick) { lo = mid; best = pick; } else hi = mid; }
    // then each spot moves to where it is clearest of the others: they spread out and no gap gets smaller
    const near = (c, skip) => { let m = 1e9; for (let i = 0; i < 6; i++) if (i !== skip) m = Math.min(m, clr(c, best[i])); return m; };
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i < 6; i++) {
      let b = best[i], bd = near(b, i);
      for (let c = 0; c < N; c++) { const d = near(c, i); if (d > bd + 1e-9) { bd = d; b = c; } }
      best[i] = b;
    }
    // front to back; the hero takes the first spot whose reload bar (39..41 px over the feet) crosses no head
    best.sort((a, b) => (cx[b] + cy[b]) - (cx[a] + cy[a]));
    const barOver = (h, c) => Math.abs(X[c] - X[h]) < 18 && Y[h] - Y[c] > 6 && Y[h] - Y[c] < 26;
    const hero = best.find(h => !best.some(c => c !== h && barOver(h, c))) ?? best[0];
    SITES.length = 0;
    for (const c of [hero, ...best.filter(c => c !== hero)]) SITES.push([+cx[c].toFixed(2), +cy[c].toFixed(2), z]);
    // the hatch: open deck you can see, as far from everyone as possible
    let hb = -1, hd = -1;
    for (let c = 0; c < hx.length; c++) { let d = 1e9; for (const s of SITES) d = Math.min(d, (s[0] - hx[c]) ** 2 + (s[1] - hy[c]) ** 2); if (d > hd) { hd = d; hb = c; } }
    hatch(hb < 0 ? (x0 + x1) / 2 : hx[hb], hb < 0 ? (y0 + y1) / 2 : hy[hb], z, D.hatchColor);
  }
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
  return { deck, block, placeCrew, tone, outline, PXA, PXZ, rep, col, pbox, shade, solid, post, bar, wire, lamp, bulb, ladder, railing, bagLine, crateAt, drum, hatch, flag, textAt, pats, FONT };
})();
/* ================= the bunker: components × stages (the names and the order are BUNKER_LOOK, buildings.js) ==========
   Each era has a frame (the body the components hang on) and, for every component, a row of drawings, one per stage
   of its ladder; a stage not drawn yet shows the last one that is. Whatever a stage adds goes right round the
   building, so the two walls the camera sees always show it */
const BUNKER_ART = (() => {
  const { deck, placeCrew, tone, outline, PXA, PXZ, rep, col, pbox, shade, solid, post, bar, lamp, bulb, bagLine, crateAt, pats } = YARD_ART;
  // planks running along y, seams every w along x, a few dark knots
  const plankTop = (w = .3) => (f, a, b) => f === 0 ? (rep(a, w) < PXA * 1.1 ? -1.3 : hash(Math.floor(a / w), Math.floor(b * 2)) > .9 ? -.5 : 0) : 0;
  // log posts: vertical bark lines
  const logPat = (f, a) => f && rep(a, .1) < .035 ? -.9 : 0;
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
  const CORNERS = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  const corners = (m, fn) => { for (const [sx, sy] of CORNERS) fn(sx * m, sy * m, sx, sy); };
  // four boxes round a square: outer half m, t thick, z0..z1 (the two front sides may stop lower, at zf)
  function ring(m, t, z0, z1, c, seed = 1, pat = null, grain = 1, zf = z1) {
    pbox(-m, -m, z0, m, -m + t, z1, c, seed, pat, grain); pbox(-m, -m, z0, -m + t, m, z1, c, seed + 1, pat, grain);
    pbox(-m, m - t, z0, m, m, zf, c, seed + 2, pat, grain); pbox(m - t, -m, z0, m, m, zf, c, seed + 3, pat, grain);
    shade(-m, -m, m, m, z0, Math.max(z1, zf));
  }
  // points along all four sides of a square of half m, about `step` apart, without the corners: fn(x, y, nx, ny, s)
  function around(m, step, fn) {
    const n = Math.max(2, Math.round(2 * m / step));
    for (let i = 1; i < n; i++) { const s = -m + 2 * m * i / n; fn(s, m, 0, 1, s); fn(m, s, 1, 0, s); fn(s, -m, 0, -1, s); fn(-m, s, -1, 0, s); }
  }
  // a spot by every wall of a square of half m: s along the wall (x on the ±y walls, y on the ±x walls), o out from
  // it; fn(x, y, nx, ny) with the wall's outward normal. The two walls the camera sees mirror each other
  const byWalls = (m, s, o, fn) => { for (const [nx, ny] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) fn(nx ? nx * (m + o) : s, ny ? ny * (m + o) : s, nx, ny); };
  // a box against a wall: a along it, d out from it, centred on (x, y)
  const wallBox = (x, y, nx, a, d, z0, z1, c, seed, pat, grain) => nx ? pbox(x - d, y - a, z0, x + d, y + a, z1, c, seed, pat, grain) : pbox(x - a, y - d, z0, x + a, y + d, z1, c, seed, pat, grain);
  // sandbags all round a square of half m (bag centres), `courses` high
  const bagRing = (m, z, courses) => { for (const [ax, ay, bx, by] of [[-m, m, m, m], [m, -m, m, m], [-m, -m, m, -m], [-m, -m, -m, m]]) bagLine(ax, ay, bx, by, z, courses); };
  // past the end of a ladder a component climbs material grades: its trim takes the grade's colour
  // (bronze, silver, gold, platinum, crystal, ruby, emerald, sapphire, amethyst, obsidian: colours the yard already uses)
  const GRADE_C = [[186, 120, 84], [206, 210, 214], [226, 182, 66], [212, 218, 224], [120, 230, 255], [196, 52, 44], [100, 168, 74], [48, 62, 120], [230, 120, 255], [40, 38, 44]];
  const trimOf = (g, c) => g ? GRADE_C[(g - 1) % GRADE_C.length] : c;
  // the turret mounts in the order they open (MOUNT_AT): the left, right and back corners, the middles of the two
  // back walls, then the front corner (last: it stands in front of the gunners). SITES.mounts keeps where a turret sits
  const MOUNT_DIRS = [[-1, 1], [1, -1], [-1, -1], [-1, 0], [0, -1], [1, 1]];
  const mountsAt = (F, q, z, fn) => { for (let i = 0; i < F.mounts; i++) { const [dx, dy] = MOUNT_DIRS[i]; fn(dx * q, dy * q, z, dx, dy); } };
  const RED = [190, 58, 46], YEL = [226, 184, 52];
  // a box with a darker frame round every face and, if given, a stencil band across its walls
  const framed = (x, y, z, sx, sy, sz, c, seed, band = 0) => solid(x - sx, y - sy, z, x + sx, y + sy, z + sz, c, seed, (f, a, b) => {
    if (f === 0) return Math.abs(a - x) > sx - .05 || Math.abs(b - y) > sy - .05 ? -1 : .3;
    const rel = (a - (f === 1 ? x : y)) / (f === 1 ? sx : sy), rz = (b - z) / sz;
    if (Math.abs(rel) > .78 || rz < .14 || rz > .84) return -1.3;
    return band && Math.abs(rz - .5) < .13 && Math.abs(rel) < .6 ? band : 0;
  }, .4);
  // a turntable on a mount: a steel plate with a dark rim and a pivot in the middle
  const turntable = (x, y, z, s, c) => pbox(x - s, y - s, z, x + s, y + s, z + .04, c, 26, (f, a, b) => {
    if (f) return -.6;
    const r = Math.max(Math.abs(a - x), Math.abs(b - y));
    return r > s - .045 ? -1.6 : r < .04 ? -2 : .5;
  }, .2);

  /* ---- era 0 · 임시: the foxhole of level 1; its walls then raise it into a dugout of logs ---- */
  const R0 = 1.55, COURSE = 3 * PXZ, LOGS = [[134, 96, 62], [118, 84, 54]], CRIB = [WOOD, [176, 132, 84]];
  // round logs laid in courses three pixels tall: a lit upper edge, a dark seam under each, every log its own brown
  const logWall = (f, a, b) => {
    if (!f) return 0;
    const q = Math.floor(b / COURSE + .02), r = b - q * COURSE;
    if (r < PXZ * .9) return -1.4;
    if (r > COURSE - PXZ * 1.05) return .9;
    return (hash(q, f) - .5) * .5;
  };
  // a crib of logs laid crosswise, three layers, with an iron pivot plate on top: a turret mount
  const logCrib = (x, y, z, g) => {
    for (let i = 0; i < 3; i++) {
      const zz = z + i * .11, c = CRIB[i & 1], pat = (f, a, b) => f && rep(b - zz, .11) < PXZ ? -1.3 : 0;
      for (const o of [-.15, .15]) i & 1 ? pbox(x + o - .055, y - .25, zz, x + o + .055, y + .25, zz + .11, c, 20 + i, pat) : pbox(x - .25, y + o - .055, zz, x + .25, y + o + .055, zz + .11, c, 20 + i, pat);
    }
    const t = z + .33;
    turntable(x, y, t, .16, trimOf(g, METAL));
    shade(x - .25, y - .25, x + .25, y + .25, z, t + .04);
    SITES.mounts.push([x, y, t + .04]);
  };
  // the parapet: sandbags round the deck, `n` courses (on the floor of the pit, or on the roof once it stands)
  const parapet = n => F => { const z = F.up ? F.top : 0; F.ringTop = z + n * .155; bagRing(R0, z, n); };
  const ERA0 = {
    frame(I) {
      const top = I.roof, d = I.deck;
      deck(-d, -d, d, d, top, [150, 112, 72]);
      return { h: I.half, m: I.half, d, top, up: top > .3, wallPats: [] };
    },
    roof: [
      // planks: the floor of the pit, then the deck on the walls with the joist ends along its edge
      F => F.up ? solid(-F.m, -F.m, F.top - .08, F.m, F.m, F.top, PLANK, 3, pats(plankTop(.32), (f, a) => f && rep(a, .4, .1) < .1 ? -1.4 : 0)) : solid(-F.d, -F.d, 0, F.d, F.d, F.top, PLANK, 3, plankTop(.32)),
    ],
    walls: [
      // the dug-out soil heaped round the pit
      F => ring(F.h + .55, .42, 0, .12, DIRT, 8, null, 1.4),
      // log walls up to the deck, the log ends crossing at every corner course by course; the soil stays heaped round
      (F, g) => {
        ring(F.h + .55, .42, 0, .12, DIRT, 8, null, 1.4);
        const m = F.m, z1 = F.top - .08, e = .13, t = .2;
        solid(-m, -m, 0, m, m, z1, LOGS[0], 40, logWall, .3);
        corners(m, (x, y, sx, sy) => {
          for (let q = 0; (q + 1) * COURSE <= z1 + .02; q++) {
            const z = q * COURSE, c = trimOf(g, LOGS[q & 1]), end = (f, a, b) => f ? (b - z < PXZ * .9 ? -1.3 : 1.1) : .6;
            if (q & 1) pbox(Math.min(x, x - sx * t), Math.min(y, y + sy * e), z, Math.max(x, x - sx * t), Math.max(y, y + sy * e), z + COURSE, c, 41, end, .2);
            else pbox(Math.min(x, x + sx * e), Math.min(y, y - sy * t), z, Math.max(x, x + sx * e), Math.max(y, y - sy * t), z + COURSE, c, 41, end, .2);
          }
        });
      },
    ],
    post: [parapet(1), parapet(2)],
    armour: [
      null,
      // corrugated sheets propped against the walls all round
      (F, g) => around(F.m + .02, .62, (x, y, nx, ny) => {
        const w = .25, z1 = F.up ? F.top - .3 : .3, c = trimOf(g, [160, 166, 170]), pat = (f, a, b) => f ? (rep(a, .1) < PXA ? -1 : b > z1 - PXZ * 1.2 ? .8 : 0) : 0;
        if (nx) pbox(Math.min(x, x + nx * .04), y - w, 0, Math.max(x, x + nx * .04), y + w, z1, c, 12, pat); else pbox(x - w, Math.min(y, y + ny * .04), 0, x + w, Math.max(y, y + ny * .04), z1, c, 12, pat);
      }),
    ],
    // log cribs: on the sandbags of the pit, on the deck corners once it stands
    mounts: [(F, g) => mountsAt(F, F.up ? 1.05 : R0, F.up ? F.top : F.ringTop, (x, y, z) => logCrib(x, y, z, g))],
    lights: [
      null,
      // a lantern on a log post at every corner
      (F, g) => corners(F.m + .06, (x, y) => { const z = Math.max(1.25, F.top + .5); post(x, y, 0, z, .05, LOGS[1], 4, logPat); lamp(x, y, z, trimOf(g, [255, 206, 110]), .075); }),
    ],
    comms: [
      null,
      // a whip antenna with a dipole bar and a red light on the middle of every side of the parapet
      (F, g) => { for (const [x, y, alongX] of [[0, R0, 1], [R0, 0, 0], [0, -R0, 1], [-R0, 0, 0]]) {
        const z0 = F.ringTop, z1 = z0 + 1.05;
        post(x, y, z0 - .05, z1, .018, DARK, 32);
        if (alongX) bar(x - .17, y, x + .17, y, z1 - .25, .012, .024, trimOf(g, DARK)); else bar(x, y - .17, x, y + .17, z1 - .25, .012, .024, trimOf(g, DARK));
        bulb(x, y, z1 + .03, [255, 70, 50]);
      } },
    ],
    flags: [
      null,
      // red rags tied over the parapet, two on every side, hanging down the wall
      (F, g) => { for (const s of [-.75, .75]) byWalls(F.m, s, .015, (x, y, nx) => {
        const z1 = F.ringTop, c = trimOf(g, RED), fold = (f, a, b) => f ? (b > z1 - .06 ? 1 : rep(b, .14) < PXZ ? -1.1 : 0) : 0;
        wallBox(x, y, nx, .07, .015, z1 - .55, z1, c, 33, fold, .3);
        wallBox(nx ? x - Math.sign(x) * .16 : x, nx ? y : y - Math.sign(y) * .16, nx, .07, .16, z1 - .02, z1 + .02, c, 34, null, .3);
      }); },
    ],
    storage: [
      null,
      // supply crates stacked by every wall: a plank crate, a dark one and an olive one, a small olive one on top
      (F, g) => byWalls(F.m, .8, .3, (x, y, nx) => {
        const at = s => nx ? [x, y + s] : [x + s, y], band = col(...trimOf(g, [214, 178, 60]));
        framed(...at(-.22), 0, .19, .19, .38, PLANK, 5);
        framed(...at(.2), 0, .17, .17, .32, [150, 112, 72], 6);
        framed(...at(-.2), .38, .14, .14, .26, PLANK, 7);
        framed(...at(.52), 0, ...(nx ? [.1, .15] : [.15, .1]), .2, OLIVE, 8, band);
      }),
    ],
    workshop: [
      null,
      // a workbench by every wall: a plank top on four legs, a vice, a red toolbox and a saw-horse beside it
      (F, g) => byWalls(F.m, -.8, .22, (x, y, nx, ny) => {
        const L = .38, D = .15, at = (s, o) => nx ? [x + nx * o, y + s] : [x + s, y + ny * o];
        wallBox(x, y, nx, L, D, .4, .47, PLANK, 25, (f, a, b) => f === 0 ? (rep(nx ? b : a, .19) < PXA ? -1 : .3) : -.4, .3);
        for (const p of [-L + .04, L - .04]) for (const q of [-D + .04, D - .04]) post(...at(p, q), 0, .4, .03, WOOD, 26);
        const [vx, vy] = at(-L + .09, 0), [tx, ty] = at(.12, 0), [bx, by] = at(0, -.15);
        pbox(vx - .06, vy - .06, .47, vx + .06, vy + .06, .58, [112, 122, 132], 27, (f, a, b) => f && b > .53 ? 1 : 0);
        pbox(tx - .11, ty - .11, .47, tx + .11, ty + .11, .6, trimOf(g, [196, 56, 44]), 28, (f, a, b) => f && Math.abs(b - .55) < .02 ? -1.6 : f === 0 ? .4 : 0);
        // the tool board on the wall behind it: a hammer, a saw and a wrench drawn dark on pale boards
        wallBox(bx, by, nx, .3, .0125, .5, .84, [222, 204, 170], 29, (f, a, b) => {
          if (!f) return 0;
          const u = a - (nx ? by : bx), v = b - .5, ink = col(54, 50, 56);
          if (Math.abs(u) > .27 || v < .03 || v > .31) return -1.2;
          if (u < -.09) return Math.abs(u + .18) < .022 && v > .06 && v < .22 || v > .2 && v < .26 && Math.abs(u + .18) < .07 ? ink : 0;
          if (u < .09) return v > .08 && v < .26 && Math.abs(u) < .06 - (v - .08) * .15 ? ink : 0;
          return Math.abs(u - .18) < .022 && v > .06 && v < .22 || v > .2 && v < .27 && Math.abs(u - .18) < .06 && Math.abs(u - .18) > .02 ? ink : 0;
        }, .2);
        shade(x - .4, y - .4, x + .4, y + .4, 0, .6);
      }),
    ],
  };

  /* ---- era 1 · 군용: a concrete pillbox, bigger than anything before it ---- */
  const ARMY = [104, 116, 78];
  const ERA1 = {
    frame(I) {
      const m = I.half - .1, top = I.roof;
      deck(-m + .06, -m + .06, m - .06, m - .06, top);
      return { h: I.half, m, top, up: true, wallPats: [] };
    },
    // a concrete plinth and walls with a row of slits on every side, under the roof slab
    walls: [F => {
      const m = F.m, k = m / 1.58, sl = [[-1.05 * k, -.45 * k], [.45 * k, 1.05 * k]];
      solid(-m - .12, -m - .12, 0, m + .12, m + .12, .22, [150, 146, 136], 1, concrete());
      solid(-m, -m, 0, m, m, F.top - .1, CONCRETE, 2, pats(...F.wallPats, slits(sl, sl, F.top - .82, F.top - .7), concrete()), .5);
    }],
    roof: [F => pbox(-F.m + .06, -F.m + .06, F.top - .1, F.m - .06, F.m - .06, F.top, [168, 164, 152], 3, (f, a, b) => f === 0 ? (rep(a, 1.1, .15) < PXA * .9 || rep(b, 1.1, .15) < PXA * .9 ? -.9 : hash(Math.floor(a * 6), Math.floor(b * 6)) > .97 ? -.6 : 0) : concrete()(f, a, b), .25)],
    // the parapet all round, low at the front so the gunners show
    post: [F => { F.ringTop = F.top + .26; ring(F.m - .06, .17, F.top, F.top + .26, [180, 176, 164], 4, concrete(), .5, F.top + .2); }],
    // steel angles down every corner and a steel rim along the parapet
    armour: [(F, g) => {
      const c = trimOf(g, [92, 98, 106]);
      corners(F.m, (x, y) => pbox(x - .07, y - .07, .22, x + .07, y + .07, F.top + .02, c, 6, (f, a, b) => f && rep(b, .3) < PXZ * 1.4 ? col(196, 200, 206) : 0));
      ring(F.m - .04, .2, F.ringTop, F.ringTop + .03, c, 7, null, .3, F.top + .23);
    }],
    // concrete pads on the deck with a steel ring and a pivot
    mounts: [(F, g) => mountsAt(F, F.m - .55, F.top, (x, y, z) => {
      solid(x - .28, y - .28, z, x + .28, y + .28, z + .12, [182, 178, 166], 30, (f, a, b) => f ? (b > z + .08 ? .8 : 0) : Math.max(Math.abs(a - x), Math.abs(b - y)) > .24 ? .6 : 0, .2);
      turntable(x, y, z + .12, .2, trimOf(g, METAL));
      SITES.mounts.push([x, y, z + .16]);
    })],
    // caged lamps on every wall
    lights: [(F, g) => { for (const s of [-1.1, 1.1]) byWalls(F.m, s, 0, (x, y, nx, ny) => {
      const z = F.top - .5, [ox, oy] = [nx * .06, ny * .06];
      wallBox(x + ox, y + oy, nx, .1, .06, z, z + .18, trimOf(g, DARK), 38);
      for (const o of [-.07, 0, .07]) line3([x + nx * .13 + (nx ? 0 : o), y + ny * .13 + (nx ? o : 0), z + .02], [x + nx * .13 + (nx ? 0 : o), y + ny * .13 + (nx ? o : 0), z + .16], rampOf(METAL)[3]);
      glow(x + nx * .13, y + ny * .13, z + .09, [255, 236, 170]);
    }); }],
    // a radio antenna on every corner of the parapet: a mast, a cross bar and a red light
    comms: [(F, g) => corners(F.m - .14, (x, y) => {
      post(x, y, F.ringTop, F.ringTop + 1.1, .02, DARK, 32); bar(x - .13, y, x + .13, y, F.ringTop + .75, .012, .024, trimOf(g, DARK));
      bulb(x, y, F.ringTop + 1.14, [255, 70, 50]);
    })],
    // a steel tool locker by every wall, a red jerrycan beside it
    workshop: [(F, g) => byWalls(F.m + .12, -.95, .17, (x, y, nx) => {
      const c = trimOf(g, ARMY);
      wallBox(x, y, nx, .25, .15, 0, .76, c, 50, (f, a, b) => {
        if (!f) return .3;
        const u = a - (nx ? y : x);
        if (Math.abs(u) > .21 || b < .05 || b > .72) return -1.3;
        if (Math.abs(u) < PXA * .6) return -1.6;
        if (b > .58 && b < .66 && rep(b, .04) < PXZ * .8) return -1.2;
        if (Math.abs(Math.abs(u) - .05) < .02 && Math.abs(b - .4) < .03) return col(214, 210, 196);
        return b < .14 ? tone(YEL, f) : 0;
      }, .4);
      const [jx, jy] = nx ? [x, y + .4] : [x + .4, y];
      solid(jx - .09, jy - .09, 0, jx + .09, jy + .09, .3, [196, 56, 44], 51, (f, a, b) => f && Math.abs(b - .24) < .02 ? -1.4 : 0);
    })],
    // olive ammunition boxes stacked by every wall
    storage: [(F, g) => byWalls(F.m + .12, .95, .2, (x, y, nx) => {
      const mark = col(...trimOf(g, [214, 178, 60])), [ax, ay] = nx ? [0, .2] : [.2, 0];
      framed(x - ax, y - ay, 0, ...(nx ? [.15, .18] : [.18, .15]), .26, OLIVE, 52, mark);
      framed(x + ax, y + ay, 0, ...(nx ? [.15, .18] : [.18, .15]), .26, OLIVE, 53, mark);
      framed(x, y, .26, ...(nx ? [.13, .2] : [.2, .13]), .22, ARMY, 54, mark);
    })],
    flags: [() => {}],
    // a white star on a blue disc in a gold ring, painted in the middle of every wall
    paint: { flags: [(F, g) => { const z0 = F.top * .45; return (f, a, b) => {
      if (!f) return 0;
      const dx = a / .34, dz = (b - z0) / .34;
      if (Math.abs(dx) > 1.25 || Math.abs(dz) > 1.25) return 0;
      const ang = Math.atan2(dz, dx), r = Math.hypot(dx, dz), lim = .45 + .55 * Math.pow(Math.abs(Math.cos(2.5 * (ang - Math.PI / 2))), 6);
      return r < lim ? col(236, 232, 220) : Math.abs(dx) < 1.18 && Math.abs(dz) < 1.18 ? tone([48, 58, 84], f, 1) : tone(trimOf(g, [214, 176, 60]), f, 1);
    }; }] },
  };

  const ERAS = [ERA0, ERA1];
  // roof first (the pit's floor), then the walls that raise it, then whatever hangs on them
  const ORDER = ['roof', 'walls', 'post', 'armour', 'mounts', 'lights', 'comms', 'flags', 'storage', 'workshop'];
  function build() {
    const I = bunkerInfo(), lk = I.look, A = ERAS[Math.min(lk.era, ERAS.length - 1)], stage = k => Math.min(lk.step[k], A[k].length - 1);
    SITES.length = 0; SITES.mounts = [];
    const F = A.frame(I);
    F.mounts = MOUNT_AT.filter(at => G.bunker >= at).length;
    for (const k of ORDER) { const p = A.paint && A.paint[k] && A.paint[k][stage(k)]; if (p) F.wallPats.push(p(F, lk.grade[k])); }
    for (const k of ORDER) { const draw = A[k][stage(k)]; if (draw) draw(F, lk.grade[k]); }
    placeCrew(); outline();
  }
  return { build };
})();
function buildBunker() { BUNKER_ART.build(); }
/* ================= the fence: components × stages (FENCE_LOOK, buildings.js), all low; every stage runs along every side
   Each side is baked on its own at a wear stage (0 whole .. 3 badly broken, 5 knocked down) into an overlay (layers.js),
   so damage during a fight never re-bakes the yard */
const SIDE_AT = (side, s, R = FENCE_R) => [[s, R], [R, s], [s, -R], [-R, s]][side];
const FENCE_ART = (() => {
  const { tone, PXA, PXZ, rep, col, pbox, solid, post, lamp } = YARD_ART;
  const R = FENCE_R, SEG = 10, WOODF = [140, 100, 64], PALE = [222, 204, 170], STEELP = [150, 158, 166], YEL_F = [236, 190, 48];
  const GRADE_C = [[186, 120, 84], [206, 210, 214], [226, 182, 66], [212, 218, 224], [120, 230, 255], [196, 52, 44], [100, 168, 74], [48, 62, 120], [230, 120, 255], [40, 38, 44]];
  const trimOf = (g, c) => g ? GRADE_C[(g - 1) % GRADE_C.length] : c;
  function side(sd, wear) {
    const L = G.fence;
    if (!L) return;
    const lk = fenceInfo(L).look, A = ERAS[Math.min(lk.era, ERAS.length - 1)], st = k => Math.min(lk.step[k], A[k].length - 1);
    const down = wear >= 5, len = 2 * R / SEG, alongX = sd === 0 || sd === 2, out = sd === 0 || sd === 1 ? 1 : -1; // outward is +y / +x for the front sides
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
    // the camera sees the outer face of the two front sides and the inner face of the two back ones; cam(o) is o out
    // from the line on that side, so what hangs on the fence hangs where it shows on all four sides
    const cam = o => o * out;
    const debrisAt = (j, c, h = .06, seed = 0) => { // pieces lying on the ground by a broken segment
      const key = sd * 31 + j;
      for (let q = 0; q < 2; q++) {
        if (hash(key, 9 + q) > .75) continue;
        const t = .15 + hash(key, 11 + q) * .5, o = (hash(key, 13 + q) - .4) * .9, l = .2 + hash(key, 15 + q) * .25, [x, y] = P(j, t, o), across = hash(key, 17 + q) > .6;
        const hx = across !== alongX ? l / 2 : .05, hy = across !== alongX ? .05 : l / 2;
        solid(x - hx, y - hy, 0, x + hx, y + hy, h, c, seed + q);
      }
    };
    // the gate takes the middle two segments of every side
    const gateOn = !!A.gate[st('gate')];
    for (let j = 0; j < SEG; j++) {
      const key = sd * 31 + j, broken = down || hash(key, 5) < wear * .22;
      const c = { j, key, broken, gate: gateOn && !broken && (j === 4 || j === 5), P, seg, pst, strand, debrisAt, len, alongX, cam };
      for (const k of ['posts', 'panels', 'spikes', 'gate']) { const draw = A[k][st(k)]; if (draw) draw(c, lk.grade[k]); }
    }
    // the lights stand on the corners (each side has one: 0 the front corner, 1 the right, 2 the back, 3 the left)
    const light = A.lights[st('lights')];
    if (!down && light) for (const j of sd === 0 || sd === 3 ? [SEG] : [0]) { const [x, y] = j === SEG ? P(SEG - 1, 1) : P(j, 0); light({ x, y }, lk.grade.lights); }
  }
  /* ---- era 0 · 임시: wooden stakes ---- */
  // stakes, `per` to a segment, sharpened pale tips later
  const stakes = (per, tips) => (c, g) => {
    const { j, key, broken, gate, P, pst, debrisAt } = c;
    if (gate) return;
    for (let n = 0; n < per; n++) {
      const t = (n + .5) / per, h = broken && n ? .1 : .42 + hash(key, n * 9) * .14;
      pst(j, t, .045, 0, h, WOODF, 4 + n, (f, a, b) => f && b > h - .06 ? (tips ? tone(PALE, f, 1) : .8) : 0);
      if (tips && !(broken && n)) { const [x, y] = P(j, t); pbox(x - .022, y - .022, h, x + .022, y + .022, h + .08, trimOf(g, PALE), 5); }
    }
    if (broken) debrisAt(j, WOODF);
  };
  const rope = c => { c.strand(c.j, .34, rampOf(ROPE)[4], .06); c.strand(c.j, .33, rampOf(ROPE)[2], .06); };
  const ERA0 = {
    posts: [stakes(2, false), stakes(4, false), stakes(4, true)],
    panels: [
      null,
      // a rope from stake to stake
      c => { if (!c.broken && !c.gate) rope(c); },
      // and a rail nailed across
      (c, g) => { if (c.broken || c.gate) return; c.seg(c.j, 0, 1, -.035, .035, .15, .22, trimOf(g, [176, 134, 88]), 6); rope(c); },
    ],
    // a gate in the middle of every side: two tall posts under a lintel, two braced leaves of bare wood
    gate: [null, (c, g) => {
      const { j, gate, seg, pst, len } = c;
      if (!gate) return;
      const left = j === 4, a0 = -R + (j + .04) * len, a1 = -R + (j + .96) * len, z0 = .06, z1 = .52;
      seg(j, .04, .96, -.02, .02, z0, z1, [150, 104, 64], 10, (f, a, b) => {
        if (!f) return 0;
        const w = left ? (a - a0) / (a1 - a0) : (a1 - a) / (a1 - a0); // 0 at the hinges, 1 where the leaves meet
        if (w < .04 || w > .96 || b < z0 + .025 || b > z1 - .025) return -1.3;
        if (Math.abs(b - .16) < .03 || Math.abs(b - .42) < .03) return w < .16 ? col(44, 40, 46) : -.6; // battens, iron hinges
        if (Math.abs(b - (.19 + w * .2)) < .022) return -.9; // the brace
        if (w > .86 && Math.abs(b - .3) < .025) return col(44, 40, 46); // the latch
        return rep(a, .12) < PXA ? -1 : 0;
      });
      if (left) seg(4, -.06, 2.06, -.04, .04, .8, .88, trimOf(g, [96, 70, 48]), 11, (f, a, b) => f && b > .85 ? 1 : 0);
      pst(j, left ? 0 : 1, .07, 0, .9, [118, 84, 54], 12, (f, a, b) => f && b > .84 ? 1.2 : f && rep(a, .1) < .035 ? -.9 : 0);
    }],
    // stakes crossed in pairs, leaning out
    spikes: [null, c => {
      const { j, broken, gate, P, cam } = c;
      if (broken || gate) return;
      for (const t of [.2, .7]) { const [x0, y0] = P(j, t - .12, cam(.2)), [x1, y1] = P(j, t + .12, cam(-.05)), [x2, y2] = P(j, t + .12, cam(.2)), [x3, y3] = P(j, t - .12, cam(-.05)); for (const w of [0, .02]) { line3([x0 + w, y0, 0], [x1 + w, y1, .38], rampOf(WOODF)[2]); line3([x2 + w, y2, 0], [x3 + w, y3, .38], rampOf(WOODF)[1]); } }
    }],
    lights: [
      null,
      // a torch on every corner
      ({ x, y }, g) => { post(x, y, 0, .75, .045, [110, 80, 54]); pbox(x - .07, y - .07, .75, x + .07, y + .07, .82, trimOf(g, DARK), 1); for (let i = 0; i < 10; i++) line3([x + (hash(i, 1) - .5) * .1, y + (hash(i, 2) - .5) * .1, .82], [x + (hash(i, 1) - .5) * .1, y + (hash(i, 2) - .5) * .1, .86 + hash(i, 3) * .14], rgb(...(hash(i, 4) > .5 ? [255, 210, 90] : [240, 110, 40]))); glow(x, y, .92, [255, 190, 90]); },
      // then a lamp on a dark post
      ({ x, y }, g) => { post(x, y, 0, .8, .04, [56, 54, 62]); lamp(x, y, .8, trimOf(g, [255, 230, 160]), .06); },
    ],
  };
  /* ---- era 1 · 군용: chain-link on steel posts ---- */
  const mesh = (j, z0, z1, c, P) => { // two sets of diagonals
    const n = 9, meshC = rampOf(c);
    for (let i = -3; i <= n + 3; i++) {
      const t0 = i / n, t1 = (i + 3.2) / n, ta = Math.max(0, Math.min(1, t0)), tb = Math.max(0, Math.min(1, t1));
      if (tb <= ta) continue;
      const za = z0 + (ta - t0) / (t1 - t0) * (z1 - z0), zb2 = z0 + (tb - t0) / (t1 - t0) * (z1 - z0);
      const [ax, ay] = P(j, ta), [bx, by] = P(j, tb); line3([ax, ay, za], [bx, by, zb2], meshC[2], .7);
      const [cx2, cy2] = P(j, 1 - ta), [dx, dy] = P(j, 1 - tb); line3([cx2, cy2, za], [dx, dy, zb2], meshC[3], .7);
    }
  };
  const ERA1 = {
    posts: [(c, g) => {
      const { j, broken, gate, pst, debrisAt } = c;
      if (gate) return;
      pst(j, 0, .035, 0, broken ? .18 : .64, STEELP, 19);
      if (!broken) { const [x, y] = c.P(j, 0); pbox(x - .05, y - .05, .64, x + .05, y + .05, .68, trimOf(g, [120, 126, 134]), 20); }
      if (broken) debrisAt(j, STEELP, .03);
    }],
    panels: [c => { if (c.broken || c.gate) return; mesh(c.j, .03, .6, [176, 184, 190], c.P); c.seg(c.j, 0, 1, -.03, .03, .6, .65, [196, 204, 210], 21); }],
    // a steel gate in the middle of every side: framed mesh leaves between two taller posts
    gate: [(c, g) => {
      const { j, gate, seg, pst, P } = c;
      if (!gate) return;
      const left = j === 4, fc = trimOf(g, [120, 126, 134]);
      mesh(j, .08, .58, [176, 184, 190], P);
      for (const [z0, z1] of [[.04, .09], [.56, .61]]) seg(j, .04, .96, -.025, .025, z0, z1, fc, 22);
      seg(j, left ? .9 : .04, left ? .96 : .1, -.025, .025, .04, .61, fc, 23);
      pst(j, left ? 0 : 1, .05, 0, .78, [92, 98, 106], 24, (f, a, b) => f && b > .72 ? tone(YEL_F, f, 1) : 0);
    }],
    // coils of barbed wire along the top
    spikes: [c => {
      const { j, broken, gate, P } = c;
      if (broken || gate) return;
      const wireC = rampOf([150, 156, 164])[3], hi = rampOf(METAL)[4];
      for (let t = .05; t < 1; t += .17) { const [x, y] = P(j, t); for (let q = 0; q < 10; q++) { const an = q / 10 * 6.283; plot(x + (c.alongX ? Math.cos(an) * .05 : Math.cos(an) * .07), y + (c.alongX ? Math.cos(an) * .07 : Math.cos(an) * .05), .73 + Math.sin(an) * .07, q & 1 ? wireC : hi); } }
    }],
    // a lamp on a steel post on every corner
    lights: [({ x, y }, g) => { post(x, y, 0, .85, .035, STEELP); lamp(x, y, .85, trimOf(g, [255, 240, 200]), .06); }],
  };
  const ERAS = [ERA0, ERA1];
  return { side };
})();
function buildFenceSide(side, wear) { FENCE_ART.side(side, wear); }
// the yard picture = the base (ground and bunker: baked when the bunker changes) + four fence sides
const basePix = new Uint32Array(W * H), baseZ = new Float32Array(W * H), baseShadow = new Uint8Array(W * H);
let baseGlows = [], fenceGlows = [];
function bakeYardBase() {
  GLOWS.length = 0; BEACON = null;
  pix.set(groundPix); kinds.set(groundKinds); ground.set(groundMask); zb.set(groundDepth); groundZ.set(groundDepth);
  shadowMask.fill(0);
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
function showYard() { bakedVersion++; bakedPix.set(yardPix); bakedZ.set(yardZ); groundZ.set(groundDepth); ground.set(groundMask); staticShadow.set(yardShadow); }
