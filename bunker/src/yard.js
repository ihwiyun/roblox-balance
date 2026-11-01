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
function buildBunker() {
  const L = G.bunker, f = bunkerForm(L), k = bunkerSub(L), F = BUNKER_FORMS[f], h = F.half, top = F.roof, dark = rampOf(DARK), steel = rampOf(METAL);
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
// one side of the fence at a wear stage (0 whole .. 3 badly broken, 5 knocked down); each side is baked on
// its own into an overlay (layers.js), so damage during a fight never re-bakes the yard
function buildFenceSide(side, wear) {
  const L = G.fence;
  if (!L) return;
  const f = fenceForm(L), k = fenceSub(L), R = FENCE_R, down = wear >= 5, seg = R / 5, has = n => k >= n;
  {
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
