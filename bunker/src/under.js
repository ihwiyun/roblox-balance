'use strict';
// Under the bunker: three floors (beds, food, mine) joined by one ladder shaft.
/* ================= under the bunker: three floors, one above the other ================= */
// a cutaway of three floors pulled apart so each is seen whole: B1 living quarters, B2 food, B3 the mine,
// joined by one ladder shaft in the back-left corner
const UG = { x0: -8, x1: 8, y0: -1.8, y1: 1.8, h: 2.5, slab: .8, gap: 0 };
const FLOOR_NAME = ['지하 1층 · 생활층', '지하 2층 · 식량층', '지하 3층 · 채굴층'];
const FLOOR_Z = [0, 0, 0];
const SHAFT = { x: UG.x0 + .55, y: UG.y0 + .55 }, LADDER_Y = UG.y0 + 1.08;
const PLASTER = [170, 164, 150], SOIL = [118, 88, 62], SOIL_D = [84, 62, 46], STONE_W = [118, 114, 110], TILE = [208, 212, 204], PLANKS = [150, 112, 74], ORE = [104, 140, 196];
function layoutFloors() {
  // the floors are as long as the picture allows (at most 16 units): three floor diamonds, their walls,
  // slabs, gaps and the hatch on top must fit the canvas height
  const yr = UG.y1 - UG.y0, fixed = 3 * UG.slab * COS * S + 2 * 10 + UG.h * COS * S + 1.4 * COS * S;
  const xr = Math.min(16, ((H - 24 - fixed) / 3) * R2 / (SIN * S) - yr);
  UG.x0 = -xr / 2; UG.x1 = xr / 2;
  SHAFT.x = UG.x0 + .55;
  // each floor sits just below the one above on screen: the step is the floor's own screen height
  // (its diamond plus the slab) so the floors never cover each other, plus a small white gap
  const diamond = (UG.x1 - UG.x0 + UG.y1 - UG.y0) / R2 * SIN * S, slab = UG.slab * COS * S;
  const step = (diamond + slab + 10) / (COS * S);
  UG.gap = step - UG.h - UG.slab;
  const top = project(UG.x0, UG.y0, UG.h + 1.4).sy, bot = project(UG.x1, UG.y1, -2 * step - UG.slab).sy;
  const z0 = ((top + bot) / 2 - OY) / (COS * S);
  for (let k = 0; k < 3; k++) FLOOR_Z[k] = z0 - k * step;
}
// where people stand, work and sleep below ground (the crew code asks here, so the floor plan stays in one file)
const BED_X = i => UG.x0 + 2 + i * 2.2;
const bedSpot = c => ({ where: 'ug', floor: 0, x: BED_X(c.i) + .75, y: UG.y0 + 1.05, z: FLOOR_Z[0] });
const sleepSpot = i => ({ x: BED_X(i) + .28, y: UG.y0 + .47, z: FLOOR_Z[0] });
const farmSpot = n => ({ where: 'ug', floor: 1, x: UG.x0 + 2.6 + n * 2.1, y: UG.y1 - .5, z: FLOOR_Z[1] });
const mineSpot = n => ({ where: 'ug', floor: 2, x: 2.9 + n * .95, y: UG.y0 + .72, z: FLOOR_Z[2] });
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
// Each floor is baked on its own into its own picture (with its piece of the ladder shaft), and the three are
// merged; the stock piles (money, food, ore) are overlays laid on top (layers.js). Upgrading the farm re-bakes
// the food floor only, and a stock pile that grows only lays a cached overlay.
const FLOORS = [0, 1, 2].map(() => ({ pix: new Uint32Array(W * H), z: new Float32Array(W * H), gz: new Float32Array(W * H), ground: new Uint8Array(W * H), box: [0, 0, W, H] }));
const STOCK_KINDS = ['money', 'food', 'mineral'];
// the lamps light warm pools on the back wall and the floor; the light only depends on the screen spot
let lampPts = [];
const lampRX = 1 / (S * 4.2), lampRY = 1 / (S * 2.8);
function underLight(ix, iy, c) {
  let light = 0;
  for (let n = 0; n < lampPts.length; n += 2) {
    const dx = (ix - lampPts[n]) * lampRX, dy = (iy - lampPts[n + 1]) * lampRY, q = 1 - (dx * dx + dy * dy);
    if (q > light) light = q;
  }
  light = light * light;
  const f2 = .62 + light * .5 + (G.live >= 4 ? .06 : 0);
  return rgb((c & 255) * f2 + light * 12, (c >> 8 & 255) * f2 + light * 6, (c >> 16 & 255) * f2 * .96);
}
function bakeFloor(k) {
  const fz = FLOOR_Z[k], F = FLOORS[k];
  pix.fill(PAPER); zb.fill(-1e9); ground.fill(0); shadowMask.fill(0);
  // the floor surface, rasterized per pixel over the rows it can cover
  const ys = [project(UG.x0, UG.y0, fz).sy, project(UG.x1, UG.y1, fz).sy];
  for (let iy = Math.max(0, Math.floor(ys[0]) - 1); iy < Math.min(H, Math.ceil(ys[1]) + 2); iy++) for (let ix = 0; ix < W; ix++) {
    const g = unproject(ix + .5, iy + .5 + fz * COS * S);
    if (g.x < UG.x0 || g.x > UG.x1 || g.y < UG.y0 || g.y > UG.y1) continue;
    const i = iy * W + ix;
    pix[i] = floorColor(k, g.x, g.y, ix, iy); zb[i] = (g.x + g.y) / R2 * COS + fz * SIN; ground[i] = 1;
  }
  groundZ.set(zb);
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
  buildShaft(k);
  // light, contact shadows and cast shadows, only around this floor
  let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
  for (let i = 0; i < zb.length; i++) if (zb[i] > -1e8) { const x = i % W, y = (i / W) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  const b = [Math.max(0, bx0 - 6), Math.max(0, by0 - 6), Math.min(W, bx1 + 7), Math.min(H, by1 + 7)];
  for (let iy = b[1]; iy < b[3]; iy++) for (let ix = b[0]; ix < b[2]; ix++) { const i = iy * W + ix; if (zb[i] > -1e8) pix[i] = underLight(ix, iy, pix[i]); }
  bakeOcclusion(...b);
  applyShadows(groundZ);
  F.pix.set(pix); F.z.set(zb); F.gz.set(groundZ); F.ground.set(ground); F.box = b;
}
// the ladder shaft: each floor bakes the piece from its own slab up to the floor above (or the hatch on top)
const HATCH_TOP = () => FLOOR_Z[0] + UG.h + 1.2;
function buildShaft(k) {
  const sx0 = SHAFT.x - .45, sx1 = SHAFT.x + .45, sy0 = UG.y0, sy1 = SHAFT.y + .45;
  const z0 = FLOOR_Z[k] - UG.slab, z1 = k === 0 ? HATCH_TOP() : FLOOR_Z[k - 1] - UG.slab - .01;
  box(sx0, sy0, z0, sx1, sy1, z1, CONCRETE, 40);
  const dark = rampOf(DARK);
  faceY(sx0, sx1, sy1 + .005, z0, z1, (x, z) => z > FLOOR_Z[k] && z < FLOOR_Z[k] + 1.75 && Math.abs(x - SHAFT.x) < .32 ? dark[0] : 0);
  for (const o of [-.2, .2]) box(SHAFT.x + o - .025, sy1 + .02, z0, SHAFT.x + o + .025, sy1 + .07, k === 0 ? z1 + .2 : z1, METAL, 41);
  for (let z = Math.ceil((z0 - FLOOR_Z[2]) / .26) * .26 + FLOOR_Z[2] + .2; z < z1; z += .26) box(SHAFT.x - .2, sy1 + .03, z, SHAFT.x + .2, sy1 + .07, z + .035, METAL, 42);
  if (k === 0) box(sx0 - .1, sy0 - .1, z1, sx1 + .1, sy1 + .1, z1 + .12, STEEL, 43);
}
const underBase = { pix: new Uint32Array(W * H), z: new Float32Array(W * H) };
function mergeFloors() {
  underBase.pix.fill(PAPER); underBase.z.fill(-1e9); UNDER_GZ.fill(-1e9); UNDER_GROUND.fill(0);
  for (const F of FLOORS) {
    const [x0, y0, x1, y1] = F.box;
    for (let iy = y0; iy < y1; iy++) for (let ix = x0; ix < x1; ix++) {
      const i = iy * W + ix;
      if (F.z[i] > underBase.z[i]) { underBase.z[i] = F.z[i]; underBase.pix[i] = F.pix[i]; UNDER_GZ[i] = F.gz[i]; UNDER_GROUND[i] = F.ground[i]; }
    }
  }
}
// stock piles: one cached overlay per kind and size
const stockCache = new Map();
function stockOverlay(kind) {
  const k = STOCK_KINDS.indexOf(kind), n = stockLevel(G[kind]), key = kind + n + ':' + FLOOR_Z[k].toFixed(3) + ':' + UG.x1;
  let ov = stockCache.get(key);
  if (!ov) {
    const F = FLOORS[k];
    ov = captureOverlay(F.gz, F.ground, () => buildStock(kind, n, FLOOR_Z[k]), (i, c) => underLight(i % W, (i / W) | 0, c));
    stockCache.set(key, ov);
  }
  return ov;
}
function composeUnder() {
  underPix.set(underBase.pix); underZ.set(underBase.z);
  layOverlays(STOCK_KINDS.map(stockOverlay), underPix, underZ, UNDER_GZ, null);
  stockSeen = STOCK_KINDS.map(k => stockLevel(G[k])).join();
  if (G.view === 'under') showUnder(); else if (G.view === 'yard') showYard();
}
function bakeUnder(floors = [0, 1, 2]) {
  layoutFloors();
  lampPts = [];
  for (let k = 0; k < 3; k++) for (const x of LAMPS) { const p = project(x, UG.y0 + 1.3, FLOOR_Z[k]); lampPts.push(p.sx, p.sy); }
  for (const k of floors) bakeFloor(k);
  mergeFloors();
  underDirty = false; dirtyFloors.clear(); underBakedAt = G.time;
  composeUnder();
}
let stockSeen = '', underDirty = true, underBakedAt = -9;
const dirtyFloors = new Set();
// the yard keeps its own baked picture: a change below only marks its floor stale (baked when it is seen)
function markUnder(k) {
  if (k == null) underDirty = true; else dirtyFloors.add(k);
  if (G.view === 'under') refreshUnder();
}
function refreshUnder() {
  if (underDirty) bakeUnder();
  else if (dirtyFloors.size) bakeUnder([...dirtyFloors]);
  else if (STOCK_KINDS.map(k => stockLevel(G[k])).join() !== stockSeen) composeUnder();
  else showUnder();
}
function showUnder() { bakedPix.set(underPix); bakedZ.set(underZ); groundZ.set(UNDER_GZ); ground.set(UNDER_GROUND); staticShadow.fill(0); }
// what you hold, piled in each floor's store room: n is the pile size (0..10), from stockLevel()
function buildStock(kind, n, fz) {
  if (kind === 'money') for (let k = 0; k < n; k++) { const x = UG.x1 - .6 - (k % 3) * .38, y = 1.4 - Math.floor(k / 6) * .38, z = fz + (Math.floor(k / 3) % 2) * .3; box(x - .16, y - .16, z, x + .16, y + .16, z + .3, [214, 170, 60], 93 + k); plot(x, y, z + .31, rgb(255, 236, 120)); }
  if (kind === 'food') for (let k = 0; k < n; k++) { const x = UG.x1 - .5 - (k % 2) * .4, y = -1.4 + Math.floor(k / 2) % 3 * .4, z = fz + Math.floor(k / 6) * .32; box(x - .17, y - .17, z, x + .17, y + .17, z + .32, k % 2 ? PLANK : [180, 90, 60], 60 + k); }
  if (kind === 'mineral') for (let k = 0; k < n; k++) { const bx = UG.x0 + 1.8 + (k % 3) * .38, by = 1.3 - Math.floor(k / 3) % 2 * .38, bz = fz + Math.floor(k / 6) * .3; box(bx - .16, by - .16, bz, bx + .16, by + .16, bz + .3, [96, 90, 84], 70 + k); plot(bx, by, bz + .31, rgb(130, 190, 250)); }
}
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
