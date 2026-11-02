'use strict';
// Under the bunker: three floors (beds, food, mine) joined by one ladder shaft.
/* ================= under the bunker: three floors, one shown at a time ================= */
// B1 living quarters, B2 food, B3 the mine, joined by one ladder shaft in the back corner. The view shows one floor
// at a time, zoomed in: each floor is a square room from -R to R, as wide as the view allows, with the back walls
// on its two far sides and the near sides cut away. People climb in and out through the shaft's openings in the
// ceiling and the floor. A floor's look changes only at a breakthrough (every 50 levels): one part moves up a stage
// (facLook in facilities.js); the front corner of each floor is its store, where what you hold piles up.
const UG = { x0: -6, x1: 6, y0: -6, y1: 6, h: 2.5, slab: .8, gap: 0, R: 6 };
// FLOOR_Z: where a floor is drawn (every floor at the same spot, since one is shown at a time);
// LEVEL_Z: how deep it really is, which is what people climb (and what their z means)
const FLOOR_Z = [0, 0, 0], LEVEL_Z = [0, -4.4, -8.8];
const toFloorZ = (z, k) => z - LEVEL_Z[k] + FLOOR_Z[k];
// the shaft fills the back corner: 1.8 wide, its ladder (rails at SHAFT.x ± 0.8) on the face that looks into the
// room; people step off at (SHAFT.x, LADDER_Y), the foot of the ladder
const SHAFT = { x: UG.x0 + .95, y: UG.y0 + .5 };
let LADDER_Y = UG.y0 + 1.08;
// the mine's pit: the windlass, then each drill, stand over it (loop.js animates the rope and the drill bit here)
const PIT = { x: 0, y: 0, r: .62 };
// places in a room: a from the left wall (x = -R), b from the back wall (y = -R); RL is the room's side
const XA = a => UG.x0 + a, yb = b => UG.y0 + b, RL = () => UG.x1 - UG.x0;
// the store: a square in the front corner, u back from the right-hand edge, v forward from its inner edge
const STORE = 3.2;
const SX = u => UG.x1 - u, SY = v => UG.y1 - STORE + v;
function layoutFloors() {
  // the room is as wide as the zoomed view allows (its diamond, walls, slab and the hatch on top, with a margin)
  const V = PP_SCENE.underView || { w: W, h: H };
  const byW = ((V.w - 22) / (S / R2) - .7) / 4;
  const byH = ((V.h - 20 - (UG.h + 1.45 + UG.slab) * COS * S) / (SIN * S / R2) - .7) / 4;
  const R = clamp(Math.min(byW, byH), 5.5, 7.5);
  UG.R = R; UG.x0 = UG.y0 = -R; UG.x1 = UG.y1 = R;
  SHAFT.x = UG.x0 + .95; SHAFT.y = UG.y0 + .5; LADDER_Y = UG.y0 + 1.08;
  PIT.x = XA(RL() * .42); PIT.y = yb(RL() * .47);
  // centred in the picture (every floor drawn at the same height, with room for B1's hatch)
  const top = project(UG.x0 - .4, UG.y0 - .4, UG.h + 1.45).sy, bot = project(UG.x1, UG.y1, -UG.slab).sy;
  const z = ((top + bot) / 2 - H / 2) / (COS * S);
  for (let k = 0; k < 3; k++) FLOOR_Z[k] = z;
}
// where people stand, work and sleep below ground (the crew code asks here, so the floor plan stays in one file)
// beds: five single beds lying along x (head at the -x end, mattress top 0.4 above the floor): beds 0-2 against the
// back wall, beds 3-4 in a second row in front of them. The sleepers walk in along the aisle between the rows:
// bedSpot is on the aisle side of each bed; sleepSpot is the floor point under the middle of the mattress, where
// the sleeping figure is drawn
const BED_L = 1.7, BEDS_A = [2, 4, 6, 2, 4];
const BED_X = i => XA(BEDS_A[i]);
const bedY = i => i < 3 ? [yb(.08), yb(.86)] : [yb(2.55), yb(3.33)];
const bedSpot = c => ({ where: 'ug', floor: 0, x: BED_X(c.i) + .85, y: yb(c.i < 3 ? 1.12 : 2.33), z: LEVEL_Z[0] });
const sleepSpot = i => { const [a, b] = bedY(i); return { x: BED_X(i) + BED_L / 2, y: (a + b) / 2, z: FLOOR_Z[0] }; }; // drawn on the B1 picture
// workers are spread over the room. Every spot also says which way to face (yaw) and, for a miner, where the
// pick strikes (hit, z above the floor). Farmer 0 tends the work row along the back wall from the aisle in front of
// it; the others stand in the aisles between the plots, each facing the plot behind them (-y), spread along their
// aisle. The aisles only open at their left end, so those spots carry via: walk into the corridor along the row
// ends, down it to the aisle, then along the aisle (route() walks from the foot of the ladder through via in order)
const FARM_AT = [.79, .2, .1, .78]; // how far along its aisle each farmer stands, from the row's left end to its right end
function farmSpot(n) {
  const at = { where: 'ug', floor: 1, z: LEVEL_Z[1], yaw: -Math.PI / 2 }, rows = farmRows(), k = n - 1;
  if (n <= 0 || rows.length < 2) return { ...at, x: XA(RL() * .5), y: yb(1.45) };
  const r = k % (rows.length - 1), [xa, xb, , b1] = rows[r], y = yb(Math.min(b1 + .3, (b1 + rows[r + 1][2]) / 2)), cx = XA(1.75);
  return { ...at, x: xa + .5 + (xb - xa - 1) * FARM_AT[k % 4], y, via: [{ x: cx, y: yb(1.9) }, { x: cx, y }] };
}
// miners take turns at the rock: the back wall, a bay in the left wall (the bays between its supports, MINE_BAYS,
// stay bare rock with ore in every era), the back wall, the other bay, the back wall again (MINE_FACE). The strips
// along those two walls stay clear in every layout, so every post is a straight walk from the foot of the ladder and
// nobody stands in a machine
const MINE_BAYS = [3.4, 5.4], MINE_FACE = [3.45, 5.9, 8.4];
function mineSpot(n) {
  const at = { where: 'ug', floor: 2, z: LEVEL_Z[2] }, k = n % 5;
  if (k & 1) { const y = yb(MINE_BAYS[k >> 1]); return { ...at, x: XA(.75), y, yaw: Math.PI, hit: { x: UG.x0 + .1, y: y + .05, z: .9 } }; }
  const x = XA(MINE_FACE[k >> 1]);
  return { ...at, x, y: yb(.8), yaw: -Math.PI / 2, hit: { x: x + .05, y: UG.y0 + .1, z: .9 } };
}
const levelOf = k => [G.live, G.farm, G.mine][k];
/* ---------- drawing straight into the pixel grid ---------- */
// Flat faces are filled pixel by pixel: each pixel centre is taken back to the face's own coordinates, so a face
// costs one step per pixel it covers. fbox() draws a box this way with the engine box()'s shading at a fraction of
// its cost, so a floor can hold hundreds of things and still bake fast. Faces are grown by a third of a pixel so
// thin posts never break into dots. EM marks what glows (screens, fire, LEDs): the lamp light leaves it alone.
const RT2 = Math.SQRT2, FE = .35 / S, emis = new Uint8Array(W * H);
let EM = 0;
const GLOWBIT = 0xfe000000;
const glowc = (r, g, b) => (GLOWBIT | Math.min(255, b) << 16 | Math.min(255, g) << 8 | Math.min(255, r)) >>> 0;
function put(i, d, c) {
  zb[i] = d;
  if ((c >>> 24) === 254) { pix[i] = (c | 0xff000000) >>> 0; emis[i] = 1; } else { pix[i] = c; emis[i] = EM; }
}
// the plane z = const seen from above; fn(x, y, ix, iy) gives a colour, or 0 for nothing
function rowsZ(z, x0, y0, x1, y1, fn) {
  const top = OY + ((x0 + y0) / RT2 * SIN - z * COS) * S, bot = OY + ((x1 + y1) / RT2 * SIN - z * COS) * S;
  const r0 = Math.max(0, Math.floor(top - 1)), r1 = Math.min(H - 1, Math.ceil(bot + 1)), zs = z * SIN;
  const ax = x0 * RT2, bx = x1 * RT2, ay = y0 * RT2, by = y1 * RT2;
  for (let iy = r0; iy <= r1; iy++) {
    const v = ((iy + .5 - OY) / S + z * COS) / SIN, lo = Math.max(ax - v, v - by) - FE, hi = Math.min(bx - v, v - ay) + FE;
    if (lo > hi) continue;
    const ia = Math.max(0, Math.ceil(OX + lo * S - .5)), ib = Math.min(W - 1, Math.floor(OX + hi * S - .5)), d = v * COS + zs, row = iy * W;
    for (let ix = ia; ix <= ib; ix++) {
      const i = row + ix;
      if (d <= zb[i]) continue;
      const u = (ix + .5 - OX) / S, c = fn((u + v) / RT2, (v - u) / RT2, ix, iy);
      if (c) put(i, d, c);
    }
  }
}
// the plane y = const seen from +y (a back wall, the front of a box); fn(x, z, ix, iy)
function rowsY(y, x0, x1, z0, z1, fn) {
  const k = y * RT2, top = OY + ((x0 + y) / RT2 * SIN - z1 * COS) * S, bot = OY + ((x1 + y) / RT2 * SIN - z0 * COS) * S;
  const r0 = Math.max(0, Math.floor(top - 1)), r1 = Math.min(H - 1, Math.ceil(bot + 1));
  const ua = (x0 - y) / RT2 - FE, ub = (x1 - y) / RT2 + FE;
  for (let iy = r0; iy <= r1; iy++) {
    const q = (iy + .5 - OY) / S, lo = Math.max(ua, (z0 * COS + q) / SIN - k - FE), hi = Math.min(ub, (z1 * COS + q) / SIN - k + FE);
    if (lo > hi) continue;
    const ia = Math.max(0, Math.ceil(OX + lo * S - .5)), ib = Math.min(W - 1, Math.floor(OX + hi * S - .5)), row = iy * W;
    for (let ix = ia; ix <= ib; ix++) {
      const u = (ix + .5 - OX) / S, v = u + k, z = (v * SIN - q) / COS, d = v * COS + z * SIN, i = row + ix;
      if (d <= zb[i]) continue;
      const c = fn(u * RT2 + y, z, ix, iy);
      if (c) put(i, d, c);
    }
  }
}
// the plane x = const seen from +x (a left wall, the right side of a box); fn(y, z, ix, iy)
function rowsX(x, y0, y1, z0, z1, fn) {
  const k = x * RT2, top = OY + ((x + y0) / RT2 * SIN - z1 * COS) * S, bot = OY + ((x + y1) / RT2 * SIN - z0 * COS) * S;
  const r0 = Math.max(0, Math.floor(top - 1)), r1 = Math.min(H - 1, Math.ceil(bot + 1));
  const ua = (x - y1) / RT2 - FE, ub = (x - y0) / RT2 + FE;
  for (let iy = r0; iy <= r1; iy++) {
    const q = (iy + .5 - OY) / S, lo = Math.max(ua, k - (z1 * COS + q) / SIN - FE), hi = Math.min(ub, k - (z0 * COS + q) / SIN + FE);
    if (lo > hi) continue;
    const ia = Math.max(0, Math.ceil(OX + lo * S - .5)), ib = Math.min(W - 1, Math.floor(OX + hi * S - .5)), row = iy * W;
    for (let ix = ia; ix <= ib; ix++) {
      const u = (ix + .5 - OX) / S, v = k - u, z = (v * SIN - q) / COS, d = v * COS + z * SIN, i = row + ix;
      if (d <= zb[i]) continue;
      const c = fn(x - u * RT2, z, ix, iy);
      if (c) put(i, d, c);
    }
  }
}
const bay = (ix, iy) => BAYER[(iy & 3) * 4 + (ix & 3)] - .5;
const shadeOf = (ramp, base, n, ix, iy, grain) => ramp[Math.max(0, Math.min(4, Math.floor(base + (n - .5) * grain + bay(ix, iy) * .5)))];
// a box, shaded like the engine's: the top lit, the front (+y) half lit, the right side (+x) in shade
function fbox(x0, y0, z0, x1, y1, z1, c, seed = 0, grain = 1.3) {
  const ramp = rampOf(c);
  if (x1 - x0 >= y1 - y0) rowsZ(z1, x0, y0, x1, y1, (x, y, ix, iy) => shadeOf(ramp, 3.4, noise(x * .8 + seed, y * 9), ix, iy, grain));
  else rowsZ(z1, x0, y0, x1, y1, (x, y, ix, iy) => shadeOf(ramp, 3.4, noise(x * 9, y * .8 + seed), ix, iy, grain));
  rowsY(y1, x0, x1, z0, z1, (x, z, ix, iy) => shadeOf(ramp, 2.3, noise(x * .8 + seed, z * 9), ix, iy, grain));
  rowsX(x1, y0, y1, z0, z1, (y, z, ix, iy) => shadeOf(ramp, 1.2, noise(y * .8 + seed, z * 9), ix, iy, grain));
}
// smooth plastic and metal: the same box with little grain
const sbox = (x0, y0, z0, x1, y1, z1, c, seed = 0) => fbox(x0, y0, z0, x1, y1, z1, c, seed, .45);
// one pixel at a world point
function pt(x, y, z, c) {
  const u = (x - y) / RT2, v = (x + y) / RT2, ix = (OX + u * S) | 0, iy = (OY + (v * SIN - z * COS) * S) | 0;
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
  const i = iy * W + ix, d = v * COS + z * SIN;
  if (d > zb[i]) put(i, d, c);
}
function ln(a, b, c) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * S * 1.6));
  for (let k = 0; k <= n; k++) { const t = k / n; pt(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), c); }
}
// flat pictures on faces (posters, screens, labels), a hair in front of the face they sit on
const onY = (y, x0, x1, z0, z1, fn) => rowsY(y + .004, x0, x1, z0, z1, typeof fn === 'function' ? fn : () => fn);
const onX = (x, y0, y1, z0, z1, fn) => rowsX(x + .004, y0, y1, z0, z1, typeof fn === 'function' ? fn : () => fn);
const onZ = (z, x0, y0, x1, y1, fn) => rowsZ(z + .004, x0, y0, x1, y1, typeof fn === 'function' ? fn : () => fn);
const C = (r, g, b) => rgb(r, g, b);
const shade = (c, k) => rgb((c & 255) * k, (c >> 8 & 255) * k, (c >> 16 & 255) * k);
const lit = c => (c | 0) && ((c & 0xffffff | GLOWBIT) >>> 0);
// a soft contact shadow under something standing on the floor
function footShadow(x0, y0, x1, y1, z1, r = .35) {
  for (let x = x0 + r / 2; x <= x1 + .01; x += r) for (let y = y0 + r / 2; y <= y1 + .01; y += r) for (let z = .15; z < z1; z += r * 1.4) castShadow(x, y, z, r * .9);
}

/* ---------- light ---------- */
// lamps light warm pools on the walls and the floor; the light only depends on the screen spot. Each floor keeps
// its own lamps (more come with its levels) and its own base brightness; what glows is left as it is
const LIGHTS = [[], [], []], AMB = [.62, .62, .62];
let lampPts = LIGHTS[0];
function lamp(k, x, y, z, rx = 4.2, ry = 2.8, tint = WARM_T) {
  const p = project(x, y, z);
  LIGHTS[k].push(p.sx, p.sy, 1 / (S * rx), 1 / (S * ry), tint[0], tint[1], tint[2]);
}
// a glow on the wall right round a lamp, laid after the light (only on the wall plane it sits on)
const HALOS = [];
// (halo: on a back wall, the plane y = const; haloX: on the left wall, the plane x = const)
const halo = (x, y, z, rx, rz) => HALOS.push(x, y, z, rx, rz, 0);
const haloX = (x, y, z, rx, rz) => HALOS.push(x, y, z, rx, rz, 1);
function applyHalos() {
  for (let n = 0; n < HALOS.length; n += 6) {
    const [x, y, z, rx, rz, onx] = HALOS.slice(n, n + 6), p = project(x, y, z), ax = rx * S * .72, az = rz * COS * S;
    for (let iy = Math.max(0, Math.floor(p.sy - az)); iy <= Math.min(H - 1, Math.ceil(p.sy + az)); iy++) for (let ix = Math.max(0, Math.floor(p.sx - ax)); ix <= Math.min(W - 1, Math.ceil(p.sx + ax)); ix++) {
      const dx = (ix + .5 - p.sx) / ax, dy = (iy + .5 - p.sy) / az, t = 1 - (dx * dx + dy * dy) - bay(ix, iy) * .3;
      if (t <= 0) continue;
      const i = iy * W + ix, u = (ix + .5 - OX) / S, v = onx ? x * RT2 - u : u + y * RT2, zz = (v * SIN - (iy + .5 - OY) / S) / COS;
      if (Math.abs(zb[i] - (v * COS + zz * SIN)) > .02 || emis[i]) continue;
      const c = pix[i], k = 1 + .5 * t;
      pix[i] = rgb((c & 255) * k + 30 * t, (c >> 8 & 255) * k + 22 * t, (c >> 16 & 255) * k + 6 * t);
    }
  }
  HALOS.length = 0;
}
const WARM_T = [12, 6, 0], PINK_T = [26, -6, 30], CYAN_T = [-6, 18, 30], FIRE_T = [34, 10, -8], WHITE_T = [10, 10, 8], GREEN_T = [-4, 22, 6];
function underLight(ix, iy, c, k) {
  const list = k == null ? lampPts : LIGHTS[k], amb = k == null ? .62 : AMB[k];
  let light = 0, tr = 12, tg = 6, tb = 0;
  for (let n = 0; n < list.length; n += 7) {
    const dx = (ix - list[n]) * list[n + 2], dy = (iy - list[n + 1]) * list[n + 3], q = 1 - (dx * dx + dy * dy);
    if (q > light) { light = q; tr = list[n + 4]; tg = list[n + 5]; tb = list[n + 6]; }
  }
  light *= light;
  const f2 = amb + light * .5;
  return rgb((c & 255) * f2 + light * tr, (c >> 8 & 255) * f2 + light * tg, (c >> 16 & 255) * f2 * .96 + light * tb);
}

/* ---------- baking the floors ---------- */
const PLASTER = [170, 164, 150], SOIL = [118, 88, 62], SOIL_D = [84, 62, 46], STONE_W = [118, 114, 110], TILE = [208, 212, 204], PLANKS = [150, 112, 74], ORE = [104, 140, 196];
const UNDER_GROUND = new Uint8Array(W * H), UNDER_GZ = new Float32Array(W * H), underPix = new Uint32Array(W * H), underZ = new Float32Array(W * H);
// storage: what you hold piles up in each floor's store, one step about every 0.6 of a power of ten (0..20)
const stockLevel = v => Math.max(0, Math.min(20, Math.floor(Math.log10(1 + Math.max(0, v)) * 5 / 3)));
// Each floor is baked on its own into its own picture (with its piece of the ladder shaft), and the three are
// merged; the stock piles (money, food, ore) are overlays laid on top (layers.js). Upgrading the farm re-bakes
// the food floor only, and a stock pile that grows only lays a cached overlay.
const FLOORS = [0, 1, 2].map(() => ({ pix: new Uint32Array(W * H), z: new Float32Array(W * H), gz: new Float32Array(W * H), ground: new Uint8Array(W * H), box: [0, 0, W, H], sig: '' }));
const STOCK_KINDS = ['money', 'food', 'mineral'];
// the screen rectangle a floor can draw into (its walls, slab and its piece of the shaft), with a margin
function floorBox(k) {
  const fz = FLOOR_Z[k], top = fz + UG.h + (k === 0 ? 1.4 : .3);
  const a = project(UG.x0 - .4, UG.y1, 0).sx, b = project(UG.x1, UG.y0 - .4, 0).sx;
  const t = Math.min(project(UG.x0 - .4, UG.y0 - .4, fz + UG.h).sy, project(SHAFT.x - 1.05, UG.y0 - .2, top).sy), bt = project(UG.x1, UG.y1, fz - UG.slab).sy;
  return [Math.max(0, Math.floor(a) - 6), Math.max(0, Math.floor(t) - 6), Math.min(W, Math.ceil(b) + 7), Math.min(H, Math.ceil(bt) + 7)];
}
function bakeFloor(k) {
  const fz = FLOOR_Z[k], F = FLOORS[k], L = levelOf(k), look = L ? facLook(['live', 'farm', 'mine'][k], L) : null, { x0, x1, y0, y1, h, slab } = UG;
  pix.fill(PAPER); zb.fill(-1e9); ground.fill(0); shadowMask.fill(0); emis.fill(0); EM = 0;
  LIGHTS[k] = []; AMB[k] = .62; HALOS.length = 0;
  const paint = [livingPaint, farmPaint, minePaint][k](L, fz, look);
  const b = floorBox(k);
  // the floor surface: everything drawn so far is ground
  rowsZ(fz, x0, y0, x1, y1, paint.floor);
  for (let iy = b[1]; iy < b[3]; iy++) for (let ix = b[0]; ix < b[2]; ix++) { const i = iy * W + ix; if (zb[i] > -1e8) ground[i] = 1; }
  groundZ.set(zb);
  // the earth under the floor, cut through on the front and the right; the walls seen from inside, their tops
  // and their cut ends
  const cut = (a, z, ix, iy) => noise(a * 2, z * 3 + k) > .74 ? rampOf(STONE_W)[1 + (bay(ix, iy) > .3 ? 1 : 0)] : rampOf(SOIL_D)[clamp(Math.floor(1.5 + noise(a, z * 4 + k) * 2 + bay(ix, iy) * .4), 0, 3)];
  rowsY(y1, x0, x1, fz - slab, fz - .005, cut);
  rowsX(x1, y0, y1, fz - slab, fz - .005, (y, z, ix, iy) => shade(cut(y + 9, z, ix, iy), .8));
  rowsY(y0, x0, x1, fz, fz + h, paint.back);
  rowsX(x0, y0, y1, fz, fz + h, paint.left);
  const capC = paint.cap || rampOf(SOIL_D)[2];
  rowsZ(fz + h, x0 - .35, y0 - .35, x1, y0, () => capC);
  rowsZ(fz + h, x0 - .35, y0, x0, y1, () => capC);
  rowsX(x1, y0 - .35, y0, fz - slab, fz + h, (y, z, ix, iy) => shade(cut(y + 5, z, ix, iy), .8));
  rowsY(y1, x0 - .35, x0, fz - slab, fz + h, cut);
  [buildLiving, buildFarmFloor, buildMineFloor][k](fz, L, look);
  EM = 0;
  buildShaft(k);
  // light, contact shadows and cast shadows, only around this floor
  for (let iy = b[1]; iy < b[3]; iy++) for (let ix = b[0]; ix < b[2]; ix++) { const i = iy * W + ix; if (zb[i] > -1e8 && !emis[i]) pix[i] = underLight(ix, iy, pix[i], k); }
  applyHalos();
  occlude(b);
  applyShadows(groundZ);
  F.pix.set(pix); F.z.set(zb); F.gz.set(groundZ); F.ground.set(ground); F.box = b;
  // the store piles are lit by this floor's lamps: if they changed, the cached piles are stale
  const sig = AMB[k].toFixed(3) + LIGHTS[k].map(v => Math.round(v)).join(',');
  if (sig !== F.sig) { F.sig = sig; for (const key of [...stockCache.keys()]) if (key.startsWith(STOCK_KINDS[k] + ':')) stockCache.delete(key); }
}
// the ladder shaft: each floor bakes the piece from its own slab up to the floor above (or the hatch on top)
const HATCH_TOP = () => LEVEL_Z[0] + UG.h + 1.2; // where people come in from the yard (real depth)
// a lamp post at the inner corner of each floor's store, lighting what is piled there
function storeLamp(k, fz) {
  const x = SX(STORE - .12), y = SY(.12);
  fbox(x - .05, y - .05, fz, x + .05, y + .05, fz + 2.1, [60, 58, 64], 345);
  fbox(x - .03, y, fz + 2.0, x + .03, y + .55, fz + 2.06, [60, 58, 64], 346);
  EM = 1; fbox(x - .09, y + .4, fz + 1.86, x + .09, y + .6, fz + 1.98, [255, 230, 160], 347); EM = 0;
  fbox(x - .11, y + .38, fz + 1.98, x + .11, y + .62, fz + 2.04, [190, 150, 70], 348);
  lamp(k, SX(STORE / 2), SY(STORE / 2), fz, 3.6, 2.4);
}
// the hood over the top of the ladder: a climber goes up behind it into the floor above (on B1 out through the
// hatch), and drawUnder wipes whatever of them shows above its lower edge, column by column (hoodEdge)
const HOOD = { front: .62, drop: .38 };
const shaftTop = k => FLOOR_Z[k] + UG.h + (k === 0 ? 1.2 : .05);
const HOOD_EDGE = { k: -1, R: 0, i0: 0, i1: -1, rows: new Int16Array(W) };
function hoodEdge(k) {
  const E = HOOD_EDGE;
  if (E.k === k && E.R === UG.R) return E;
  // each screen column is the line x - y = c on the ground; the hood's underside is lowest on screen where x + y is largest
  const x0 = SHAFT.x - .9, x1 = SHAFT.x + .9, ya = SHAFT.y + .48, yb = SHAFT.y + .5 + HOOD.front, zf = shaftTop(k) - HOOD.drop;
  E.i0 = W; E.i1 = -1;
  for (let ix = 0; ix < W; ix++) {
    const c = (ix + .5 - OX) / S * R2, x = Math.min(x1, c + yb);
    if (x < Math.max(x0, c + ya)) continue;
    E.rows[ix] = Math.round(OY + ((2 * x - c) / R2 * SIN - zf * COS) * S);
    if (ix < E.i0) E.i0 = ix;
    E.i1 = ix;
  }
  E.k = k; E.R = UG.R;
  return E;
}
function buildShaft(k) {
  // 1.8 wide; the ladder's rails stand at SHAFT.x ± 0.8 just in front of its face, where the climbers' hands are
  const sx0 = SHAFT.x - .9, sx1 = SHAFT.x + .9, sy0 = UG.y0, sy1 = SHAFT.y + .5, fz = FLOOR_Z[k];
  const z0 = fz - UG.slab, z1 = fz + UG.h + (k === 0 ? 1.2 : .05);
  fbox(sx0, sy0, z0, sx1, sy1, z1, CONCRETE, 40);
  // the doorway onto this floor, framed in hazard stripes, with a lamp over it
  const dark = rampOf(DARK);
  onY(sy1, SHAFT.x - .62, SHAFT.x + .62, fz, fz + 1.9, dark[0]);
  onY(sy1, SHAFT.x - .72, SHAFT.x + .72, fz + 1.9, fz + 2.02, (x, z) => (Math.floor((x - z) * 9) & 1) ? C(232, 186, 40) : C(40, 36, 40));
  for (const s of [-1, 1]) onY(sy1, SHAFT.x + s * .67 - .05, SHAFT.x + s * .67 + .05, fz, fz + 1.9, (x, z) => (Math.floor(z * 9) & 1) ? C(232, 186, 40) : C(40, 36, 40));
  EM = 1; fbox(SHAFT.x - .1, sy1, fz + 2.08, SHAFT.x + .1, sy1 + .06, fz + 2.16, [255, 226, 150], 3); EM = 0;
  for (const o of [-.8, .8]) fbox(SHAFT.x + o - .03, sy1 + .02, z0, SHAFT.x + o + .03, sy1 + .08, k === 0 ? z1 + .2 : z1, METAL, 41);
  for (let z = z0 + .2; z < z1; z += .26) fbox(SHAFT.x - .8, sy1 + .03, z, SHAFT.x + .8, sy1 + .07, z + .035, METAL, 42);
  if (k === 0) { fbox(sx0 - .1, sy0 - .1, z1, sx1 + .1, sy1 + .1, z1 + .12, STEEL, 43); fbox(sx0 + .1, sy0 + .1, z1 + .12, sx1 - .1, sy1 - .1, z1 + .18, DARK, 44); }
  fbox(sx0, SHAFT.y + .48, z1 - HOOD.drop, sx1, sy1 + HOOD.front, z1, CONCRETE, 45);
}
// contact shade on the floor next to anything standing on it: the engine's bakeOcclusion, with its sixteen
// neighbour offsets worked out once as index steps
const OCC = [];
for (const r of [2, 4].map(v => Math.round(v * S / 16))) for (let k = 0; k < 8; k++) OCC.push(Math.round(Math.sin(k * Math.PI / 4) * r * .7) * W + Math.round(Math.cos(k * Math.PI / 4) * r));
const OCC_D = Int32Array.from(OCC);
function occlude(b) {
  const xa = Math.max(4, b[0]), xb = Math.min(W - 4, b[2]), ya = Math.max(4, b[1]), yb = Math.min(H - 4, b[3]);
  for (let iy = ya; iy < yb; iy++) for (let ix = xa; ix < xb; ix++) {
    const i = iy * W + ix;
    if (!ground[i] || zb[i] !== groundZ[i]) continue;
    let hits = 0;
    for (let n = 0; n < 16; n++) { const j = i + OCC_D[n]; if (zb[j] !== groundZ[j]) hits++; }
    if (!hits) continue;
    if (hits >= 8) tint(i, .56, .54, .72);
    else if (hits / 8 > BAYER[(iy & 3) * 4 + (ix & 3)]) tint(i, .74, .72, .84);
  }
}
const underBase = { pix: new Uint32Array(W * H), z: new Float32Array(W * H) };
let mergedFloor = -1; // the floor whose picture underBase holds
function mergeFloors() {
  mergedFloor = G.floorView || 0;
  const F = FLOORS[mergedFloor];
  underBase.pix.set(F.pix); underBase.z.set(F.z); UNDER_GZ.set(F.gz); UNDER_GROUND.set(F.ground);
}
// stock piles: one cached overlay per kind and size (and per floor position and lamps)
const stockCache = new Map();
function stockOverlay(kind) {
  const k = STOCK_KINDS.indexOf(kind), n = stockLevel(G[kind]), key = kind + ':' + n + ':' + FLOOR_Z[k].toFixed(3) + ':' + UG.x1;
  let ov = stockCache.get(key);
  if (!ov) {
    const F = FLOORS[k];
    ov = captureOverlay(F.gz, F.ground, () => { emis.fill(0); EM = 0; buildStock(kind, n, FLOOR_Z[k]); EM = 0; }, (i, c) => emis[i] ? c : underLight(i % W, (i / W) | 0, c, k));
    stockCache.set(key, ov);
  }
  return ov;
}
function composeUnder() {
  underPix.set(underBase.pix); underZ.set(underBase.z);
  layOverlays([stockOverlay(STOCK_KINDS[G.floorView || 0])], underPix, underZ, UNDER_GZ, null);
  stockSeen = STOCK_KINDS.map(k => stockLevel(G[k])).join();
  if (G.view === 'under') showUnder(); else if (G.view === 'yard') showYard();
}
function bakeUnder(floors = [0, 1, 2], flash) {
  layoutFloors();
  for (const k of floors) {
    // after an upgrade, what changed on that floor flashes for a moment
    const before = flash && FLOORS[k].pix.slice();
    bakeFloor(k);
    if (before) flashDiff(before, FLOORS[k].pix, 'under', k);
  }
  mergeFloors();
  underDirty = false; dirtyFloors.clear();
  composeUnder();
}
let stockSeen = '', underDirty = true;
const dirtyFloors = new Set();
// the yard keeps its own baked picture: a change below only marks its floor stale (baked when it is seen)
function markUnder(k, flash) {
  if (k == null) underDirty = true; else dirtyFloors.add(k);
  if (flash) flashFloors.add(k);
  if (G.view === 'under') refreshUnder();
}
const flashFloors = new Set();
function refreshUnder() {
  if (underDirty) bakeUnder();
  else if (dirtyFloors.size) { const f = [...dirtyFloors]; bakeUnder(f, f.some(k => flashFloors.has(k))); flashFloors.clear(); }
  else if (mergedFloor !== (G.floorView || 0)) { mergeFloors(); composeUnder(); } // another floor was picked meanwhile
  else if (STOCK_KINDS.map(k => stockLevel(G[k])).join() !== stockSeen) composeUnder();
  else showUnder();
}
// switch the view to another floor: bake it if it is stale, then lay its picture and its store
function showFloor(k) {
  G.floorView = k;
  refreshUnder();
}
function showUnder() { bakedVersion++; bakedPix.set(underPix); bakedZ.set(underZ); groundZ.set(UNDER_GZ); ground.set(UNDER_GROUND); staticShadow.fill(0); }


/* ================= materials: floors and walls ================= */
const nz = noise;
function pick(ramp, v, ix, iy, spread = .5) { const t = Math.floor(v + bay(ix, iy) * spread); return ramp[t < 0 ? 0 : t > 4 ? 4 : t]; }
const WOOD_D = [104, 72, 48], CREAM = [228, 222, 206], RED_F = [168, 62, 54], TEAL = [70, 120, 112], GOLD = [226, 180, 60], OLIVE_L = [92, 112, 86];
const R_SOIL = rampOf(SOIL), R_SOILD = rampOf(SOIL_D), R_STONE = rampOf(STONE_W), R_WOOD = rampOf(WOOD), R_PLANKS = rampOf(PLANKS), R_WOODL = rampOf(PLANK), R_WOODD = rampOf(WOOD_D);
// packed earth, with pebbles
function dirtAt(a, b, ix, iy, ramp = R_SOIL) {
  const h = hash(ix, iy);
  if (h > .985) return R_STONE[3];
  return pick(ramp, 1.7 + nz(a * 1.5, b * 1.5) * 1.6 + (h > .94 ? -.8 : 0), ix, iy, .6);
}
// earth walls held up by timber posts, a beam along the top
function earthWall(a, z, ix, iy, posts = 2.3) {
  const p = ((a + .4) % posts + posts) % posts;
  if (p < .2) return pick(R_WOOD, p < .035 ? 1 : 2.5 + nz(a * 9, z * .7) * .8, ix, iy);
  if (z > UG.h - .18) return pick(R_WOOD, z > UG.h - .05 ? 3.3 : 2.1, ix, iy);
  const st = nz(a * 5 + 3, z * 6);
  if (st > .8) return pick(R_STONE, st > .84 ? 2.6 + (st - .84) * 12 : 1, ix, iy, .3);
  return pick(R_SOIL, 1.3 + nz(a * 1.6, z * 2.2) * 1.5, ix, iy, .45);
}
// boards along x, staggered joints
function planksAt(a, b, ix, iy, ramp = R_PLANKS, w = .36) {
  const r = b / w, row = Math.floor(r), f = r - row, s = (a + hash(row, 3) * 2.2) / 2.2, seg = Math.floor(s);
  if (f < .09 || s - seg < .018) return ramp[1];
  return pick(ramp, 2.55 + (hash(row, seg) > .55 ? .5 : 0) + (nz(a * 2, row * 7) - .5) * .5 + (f > .8 ? .35 : 0), ix, iy, .25);
}
// parquet: blocks of three slats, turned a quarter each block
const PARQ = [[176, 126, 78], [162, 112, 68], [188, 138, 86]].map(rampOf), PARQ_SEAM = rgb(124, 84, 52);
function parquetAt(a, b, ix, iy) {
  const s = .6, ba = Math.floor(a / s), bb = Math.floor(b / s), turn = (ba + bb) & 1, ra = a / s - ba, rb = b / s - bb;
  const t = turn ? ra : rb, slat = Math.floor(t * 3), f = t * 3 - slat;
  if (f < .09 || (turn ? rb : ra) < .03) return PARQ_SEAM;
  return PARQ[((slat + ba + bb * 2) % 3 + 3) % 3][f > .82 ? 4 : 3];
}
function tileAt(a, b, ix, iy, ramp, size = .4, grout = 0) {
  const ta = a / size, tb = b / size;
  if (ta - Math.floor(ta) < .08 || tb - Math.floor(tb) < .08) return grout || ramp[1];
  const h = hash(Math.floor(ta), Math.floor(tb));
  return ramp[h > .85 ? 4 : h < .12 ? 2 : 3];
}
// steel floor plate with raised diamonds
const R_PLATE = rampOf([118, 126, 134]);
function plateAt(a, b, ix, iy) {
  const ga = a / .2, gb = b / .2, fa = ga - Math.floor(ga) - .5, fb = gb - Math.floor(gb) - .5;
  const on = ((Math.floor(ga) + Math.floor(gb)) & 1) ? Math.abs(fa * 1.6 + fb) < .14 : Math.abs(fa * 1.6 - fb) < .14;
  return pick(R_PLATE, on ? 3.4 : 2.2 + nz(a * 3, b * 3) * .5, ix, iy, .3);
}
const HZ_Y = rgb(226, 180, 40), HZ_K = rgb(44, 40, 44);
const hazard = (a, b) => (Math.floor((a + b) * 5) & 1) ? HZ_Y : HZ_K;
// steel wall plates with rivets
const R_STEELW = rampOf([130, 138, 146]), STEEL_SEAM = rgb(70, 74, 82), RIVET = rgb(196, 204, 210);
function steelWall(a, z, ix, iy) {
  const pa = a / 1.05, pz = z / .62, fa = pa - Math.floor(pa), fz = pz - Math.floor(pz);
  if (fa < .03 || fz < .05) return STEEL_SEAM;
  if ((Math.abs(fa - .08) < .025 || Math.abs(fa - .92) < .025) && Math.abs(fz - .5) < .08) return RIVET;
  return pick(R_STEELW, 2.2 + nz(a * 2, z * 3) * .7 + (fz > .85 ? .6 : 0), ix, iy, .4);
}

/* ================= how the floors grow: parts × stages ================= */
// facLook (facilities.js) gives a floor's era and each part's stage and material grade; each floor lists its parts'
// drawings by era and stage (LIVE_ART, FARM_ART, MINE_ART) and drawPart draws one part. A stage not drawn yet, or
// any past the last drawn, shows the last drawing before it in the next material grade (bronze, silver, gold, ...):
// a drawing takes its main colour through mat(colour, grade)
const GRADE_C = [[176, 112, 64], [196, 204, 212], [236, 190, 64], [220, 228, 232], [150, 226, 250], [200, 52, 72], [56, 180, 110], [64, 104, 210], [150, 92, 206], [52, 46, 64]];
const mat = (c, g) => g ? GRADE_C[(g - 1) % GRADE_C.length] : c;
function drawPart(art, k, look, fz) {
  const eras = art[k];
  let e = look.era, s = look.step[k], g = look.grade[k];
  for (;;) {
    const f = eras[e] && eras[e][s];
    if (f) return f(fz, g, look);
    if (!e && !s) return;
    g++;
    if (s > 0) s--; else { e--; s = Math.max(0, (eras[e] || []).length - 1); }
  }
}

/* ================= B1: the living floor ================= */
// a square room: the dorm along the back wall (three beds, two more in a second row, the aisle between them for
// walking in), the kitchen at the far end of the back wall, the lounge along the left wall, the mess table and the
// games in the middle, the shower in the left corner, the vault caged off in the front corner
// K: where the kitchen starts along the back wall; LB: where the lounge starts along the left wall
const kitA = () => Math.max(7.95, RL() - 4.2), loungeB = () => Math.min(RL() - 4.6, 5.3);
const R_RUGR = rampOf([168, 64, 54]), R_RUGC = rampOf([214, 196, 156]), R_RUGB = rampOf([60, 74, 120]), R_MAT = rampOf([118, 92, 60]);
const R_WAIN = rampOf([70, 120, 112]), R_PAINT = rampOf([218, 204, 172]), TRIM = rgb(236, 230, 214);
const R_TILE_T = rampOf([66, 118, 116]), R_TILE_G = rampOf([214, 176, 72]), R_TILE_W = rampOf([228, 226, 216]), R_TILE_S = rampOf([120, 170, 196]);
const GROUT_T = rgb(46, 70, 70), GROUT_G = rgb(120, 96, 50), GROUT_W = rgb(176, 172, 164), R_PLANKW = rampOf([160, 120, 80]);
function livingPaint(L, fz) {
  const { x0, y0 } = UG, RLx = RL(), st = RLx - STORE, floorMat = L >= 35 ? 2 : L >= 2 ? 1 : 0, wallMat = L >= 30 ? 3 : L >= 18 ? 2 : L >= 9 ? 1 : 0, lb = loungeB();
  const rug = L >= 13 ? [.75, lb, 3.65, lb + 2.6] : null, mat = L >= 2 ? [.45, 1.18, 1.45, 1.78] : null;
  const wall = (a, z, ix, iy, side) => {
    if (wallMat === 0) return earthWall(a, z, ix, iy);
    if (wallMat === 1) {
      const bd = a / .26, f = bd - Math.floor(bd), n = Math.floor(bd);
      if (f < .09) return R_WOOD[0];
      if (z < .14) return R_WOOD[1];
      return pick(hash(n, 5) > .5 ? R_PLANKS : R_PLANKW, 2.1 + nz(n * 3, z * 1.4) * 1.1 + (hash(n, Math.floor(z * 3)) > .97 ? -1.4 : 0), ix, iy, .4);
    }
    if (wallMat === 2) {
      if (z < .9) { const p = a / .55 - Math.floor(a / .55); return pick(R_WAIN, z < .1 ? 1 : p < .06 ? 1.6 : 2.6 + (z > .8 ? .6 : 0), ix, iy, .3); }
      if (z < .98) return TRIM;
      return pick(R_PAINT, 2.5 + nz(a * 1.2, z * 1.5) * .6, ix, iy, .4);
    }
    if (side && z < 2.1 && a > RLx - 1.15 && L >= 29) return tileAt(a, z, ix, iy, R_TILE_S, .22);
    if (z < .85) return tileAt(a, z, ix, iy, R_TILE_T, .34, GROUT_T);
    if (z < 1.0) return tileAt(a + .1, z, ix, iy, R_TILE_G, .15, GROUT_G);
    return tileAt(a, z, ix, iy, R_TILE_W, .25, GROUT_W);
  };
  return {
    floor(x, y, ix, iy) {
      const a = x - x0, b = y - y0;
      if (a > st && b > st) return a < st + .14 || b < st + .14 ? hazard(a, b) : plateAt(a, b, ix, iy);
      if (rug && a > rug[0] && a < rug[2] && b > rug[1] && b < rug[3]) {
        const e = Math.min(a - rug[0], rug[2] - a, b - rug[1], rug[3] - b);
        if (e < .07) return pick(R_RUGB, 2.4, ix, iy);
        if (e < .14) return pick(R_RUGC, 2.8, ix, iy);
        const dd = Math.abs((a - (rug[0] + rug[2]) / 2) * .55) + Math.abs(b - (rug[1] + rug[3]) / 2), ring = Math.floor(dd / .22) % 3;
        return pick(ring === 0 ? R_RUGC : ring === 1 ? R_RUGR : R_RUGB, 2.6 + nz(a * 6, b * 6) * .5, ix, iy);
      }
      if (mat && a > mat[0] && a < mat[2] && b > mat[1] && b < mat[3]) return pick(R_MAT, (Math.floor(a * 14) & 1) ? 2.2 : 2.8, ix, iy, .3);
      if (floorMat === 0) return dirtAt(a, b, ix, iy);
      if (floorMat === 1) return planksAt(a, b, ix, iy);
      return parquetAt(a, b, ix, iy);
    },
    back(x, z, ix, iy) { return wall(x - x0, z - fz, ix, iy, false); },
    left(y, z, ix, iy) { return wall(y - y0, z - fz, ix, iy, true); },
    cap: wallMat >= 2 ? rampOf([200, 196, 186])[2] : wallMat === 1 ? R_WOOD[2] : R_SOILD[2],
  };
}
// the beds: each a different find, all with the mattress top 0.4 above the floor and the pillow at the -x end;
// each blanket is its sleeper's colour
const BLANKET_EMPTY = [150, 142, 128], SHEET = [222, 214, 196], PILLOW = [244, 240, 230];
const BED_STYLE = [
  { frame: [104, 116, 78], legs: WOOD, head: 0, foot: 0 },
  { frame: [128, 136, 146], legs: [128, 136, 146], head: .82, foot: .62, bars: true },
  { frame: WOOD, legs: WOOD_D, head: .72, foot: .55 },
  { frame: [176, 182, 190], legs: [150, 156, 164], head: .6, foot: 0, stripes: true },
  { frame: [112, 76, 50], legs: [92, 60, 40], head: 1.05, foot: .62, carved: true },
];
function bed(i, fz) {
  const st = BED_STYLE[i], bx = BED_X(i), [y0, y1] = bedY(i), L = BED_L, x1 = bx + L;
  for (const [x, y] of [[bx + .03, y0 + .03], [x1 - .1, y0 + .03], [bx + .03, y1 - .1], [x1 - .1, y1 - .1]]) fbox(x, y, fz, x + .07, y + .07, fz + .22, st.legs, 50 + i);
  fbox(bx, y0, fz + .18, x1, y1, fz + .26, st.frame, 52 + i);
  if (i === 0) { fbox(bx, y0, fz + .26, x1, y1, fz + .34, [104, 116, 78], 53); fbox(bx + .06, y0 + .06, fz + .34, x1 - .06, y1 - .06, fz + .4, [138, 146, 110], 54); }
  else {
    fbox(bx + .04, y0 + .04, fz + .26, x1 - .04, y1 - .04, fz + .4, st.stripes ? [214, 226, 236] : SHEET, 55 + i);
    if (st.stripes) onY(y1 - .04, bx + .04, x1 - .04, fz + .26, fz + .4, x => (Math.floor((x - bx) * 9) & 1) ? rgb(80, 110, 170) : 0);
  }
  const c = G.crew[i] ? LOOKS[i + 1].shirt : BLANKET_EMPTY, band = shade(rgb(...c), .78);
  fbox(bx + .62, y0 + .02, fz + .38, x1 - .03, y1 - .02, fz + .44, c, 60 + i);
  onZ(fz + .44, bx + .62, y0 + .02, x1 - .03, y1 - .02, x => (Math.floor((x - bx) * 5) % 3 === 0) ? band : 0);
  fbox(bx + .1, y0 + .14, fz + .4, bx + .44, y1 - .14, fz + .5, PILLOW, 65 + i);
  if (st.head) {
    fbox(bx - .04, y0, fz, bx + .04, y1, fz + st.head, st.frame, 70 + i);
    if (st.bars) onX(bx + .04, y0 + .06, y1 - .06, fz + .3, fz + st.head - .08, y => ((y - y0) % .14) < .05 ? rgb(90, 96, 104) : 0);
    if (st.carved) { fbox(bx - .05, y0 - .02, fz + st.head, bx + .05, y1 + .02, fz + st.head + .06, [140, 98, 64], 75); onX(bx + .04, y0 + .1, y1 - .1, fz + .55, fz + .95, (y, z) => Math.abs((y - (y0 + y1) / 2) * 2) + Math.abs(z - fz - .75) * 2.6 < .32 ? rgb(150, 108, 70) : 0); }
  }
  if (st.foot) fbox(x1 - .06, y0, fz, x1 + .02, y1, fz + st.foot, st.frame, 80 + i);
  footShadow(bx, y0, x1, y1, .45);
}
function footlocker(fz) {
  const x = XA(2.05), y0 = yb(2.85), y1 = yb(3.25);
  fbox(x, y0, fz, x + .62, y1, fz + .34, [92, 104, 72], 93);
  onY(y1, x + .02, x + .6, fz + .02, fz + .32, (xx, z) => Math.abs(z - fz - .26) < .025 || Math.abs(xx - x - .31) < .03 && z - fz > .14 ? rgb(60, 64, 50) : Math.abs(xx - x - .31) < .05 && Math.abs(z - fz - .2) < .04 ? rgb(214, 196, 120) : 0);
  fbox(x + .7, y0 + .02, fz, x + .98, y0 + .3, fz + .32, [120, 104, 70], 94);
  fbox(x + .72, y0 + .26, fz + .02, x + .96, y0 + .31, fz + .22, [96, 84, 56], 95);
  footShadow(x, y0, x + .98, y1, .34);
}
// a lantern on a hook over the first bed, before there are wall lamps
function lantern(fz) {
  const x = XA(2.5), y = UG.y0;
  fbox(x - .02, y, fz + 1.36, x + .02, y + .16, fz + 1.4, DARK, 90);
  halo(x, y, fz + 1.2, .45, .4);
  EM = 1; fbox(x - .06, y + .08, fz + 1.1, x + .06, y + .2, fz + 1.28, [255, 214, 120], 91); EM = 0;
  fbox(x - .07, y + .07, fz + 1.28, x + .07, y + .21, fz + 1.32, DARK, 92); fbox(x - .07, y + .07, fz + 1.06, x + .07, y + .21, fz + 1.1, DARK, 93);
}
// lamps on the back wall: caged bulbs, later bright tube lights
function wallLamps(fz, tubes) {
  const y0 = UG.y0;
  if (tubes) {
    for (const a of [2.4, 6.3, RL() - 2.2]) {
      const x = XA(a);
      sbox(x - .5, y0, fz + 2.3, x + .5, y0 + .12, fz + 2.4, [190, 194, 198], 110);
      EM = 1; sbox(x - .45, y0 + .12, fz + 2.31, x + .45, y0 + .17, fz + 2.37, [246, 250, 255], 111); EM = 0;
    }
    for (const b of [3.6, RL() - 2.6]) {
      const y = yb(b), x0 = UG.x0;
      sbox(x0, y - .5, fz + 2.3, x0 + .12, y + .5, fz + 2.4, [190, 194, 198], 116);
      EM = 1; sbox(x0 + .12, y - .45, fz + 2.31, x0 + .17, y + .45, fz + 2.37, [246, 250, 255], 117); EM = 0;
    }
    return;
  }
  for (const a of [3.25, 7.2, RL() - 1.5]) wallLamp(XA(a), y0, fz + 2.12);
  for (const b of [4.3, RL() - 2.4]) wallLampX(yb(b), UG.x0, fz + 2.12);
}
// a brass wall lamp with a glowing bulb and a halo on the wall around it
function wallLamp(x, y0, z) {
  halo(x, y0, z + .06, .5, .42);
  fbox(x - .1, y0, z + .2, x + .1, y0 + .06, z + .26, [176, 140, 70], 112);
  fbox(x - .025, y0, z + .14, x + .025, y0 + .2, z + .2, [176, 140, 70], 113);
  EM = 1; fbox(x - .07, y0 + .12, z, x + .07, y0 + .26, z + .14, [255, 232, 160], 114); EM = 0;
  fbox(x - .09, y0 + .1, z + .14, x + .09, y0 + .28, z + .18, [176, 140, 70], 115);
}
// the same lamp on the left wall
function wallLampX(y, x0, z) {
  haloX(x0, y, z + .06, .5, .42);
  fbox(x0, y - .1, z + .2, x0 + .06, y + .1, z + .26, [176, 140, 70], 112);
  fbox(x0, y - .025, z + .14, x0 + .2, y + .025, z + .2, [176, 140, 70], 113);
  EM = 1; fbox(x0 + .12, y - .07, z, x0 + .26, y + .07, z + .14, [255, 232, 160], 114); EM = 0;
  fbox(x0 + .1, y - .09, z + .14, x0 + .28, y + .09, z + .18, [176, 140, 70], 115);
}
const BOOK_R = [[150, 50, 44], [52, 92, 140], [196, 160, 64], [70, 120, 70], [120, 70, 120], [210, 200, 180], [60, 60, 66]].map(rampOf);
const SHELF_BACK = rgb(46, 34, 30);
function bookshelf(fz) {
  // book shelves on the wall over the first two beds
  for (const a0 of [0, 1]) {
    const x0 = BED_X(a0) + .1, x1 = x0 + 1.5, y0 = UG.y0;
    for (const z of [.98, 1.26]) {
      fbox(x0, y0, fz + z - .04, x1, y0 + .26, fz + z, WOOD_D, 100 + z);
      for (const x of [x0 + .08, x1 - .14]) fbox(x, y0, fz + z - .16, x + .05, y0 + .22, fz + z - .04, DARK, 101);
      let x = x0 + .04, k = 0;
      while (x < x1 - .1) {
        const w = .06 + hash(k, a0 + z) * .05, h = .17 + hash(a0, k + z * 9) * .1, lean = hash(k + 3, z) > .9;
        if (hash(k, z * 7 + a0) > .86) { x += .1; k++; continue; }
        fbox(x, y0 + .04, fz + z, x + w, y0 + .22, fz + z + (lean ? h * .7 : h), [[150, 50, 44], [52, 92, 140], [196, 160, 64], [70, 120, 70], [120, 70, 120], [210, 200, 180], [60, 60, 66]][Math.floor(hash(a0 + k, z) * 7)], 102 + k, .5);
        x += w + .012; k++;
      }
    }
  }
}
// the radio, then the TV, on a low cabinet against the left wall, facing into the room
function tvCabinet(fz, tv) {
  const lb = loungeB(), x0 = UG.x0 + .06, x1 = x0 + .46, y0 = yb(lb + .8), y1 = y0 + 1.0;
  fbox(x0, y0, fz, x1, y1, fz + .5, [128, 88, 56], 120);
  onX(x1, y0 + .04, y1 - .04, fz + .06, fz + .44, (y, z) => { const f = (y - y0) / 1.0; return Math.abs(f - .5) < .012 || z - fz < .085 || z - fz > .42 ? rgb(84, 56, 38) : (Math.abs(f - .44) < .02 || Math.abs(f - .56) < .02) && Math.abs(z - fz - .27) < .03 ? rgb(220, 200, 140) : 0; });
  // the radio: grille, a lit dial, an aerial
  const ry = tv ? y0 + .3 : y1 - .44, rz = tv ? fz + 1.22 : fz + .5;
  fbox(x0 + .06, ry, rz, x0 + .32, ry + .38, rz + .28, [96, 104, 74], 121);
  onX(x0 + .32, ry + .03, ry + .2, rz + .04, rz + .24, (y, z) => (Math.floor((z - rz) * 30) & 1) ? rgb(52, 56, 42) : 0);
  onX(x0 + .32, ry + .23, ry + .35, rz + .1, rz + .2, lit(rgb(255, 196, 90)));
  pt(x0 + .33, ry + .32, rz + .06, lit(rgb(120, 255, 120)));
  ln([x0 + .2, ry + .3, rz + .28], [x0 + .14, ry + .42, rz + .7], rgb(60, 60, 66));
  if (tv) {
    const ty = y0 + .07;
    fbox(x0 + .12, ty + .3, fz + .5, x0 + .3, ty + .56, fz + .58, DARK, 122);
    fbox(x0 + .1, ty, fz + .58, x0 + .22, ty + .86, fz + 1.2, [36, 36, 44], 123);
    onX(x0 + .22, ty + .04, ty + .82, fz + .62, fz + 1.16, (y, z) => {
      const u = (y - ty - .04) / .78, v = (z - fz - .62) / .54;
      if (v < .35 + Math.sin(u * 6) * .06) return lit(rgb(90, 170, 90));
      if (Math.abs(u - .7) < .1 && Math.abs(v - .75) < .1) return lit(rgb(255, 230, 120));
      return lit(rgb(110, 170, 230 - v * 40));
    });
    lamp(0, x0 + 1.0, ty + .43, fz + .2, 1.5, 1.0, CYAN_T);
  }
  footShadow(x0, y0, x1, y1, .5);
}
function stove(fz) {
  const x0 = XA(kitA() + 2.3), x1 = x0 + .7, y0 = yb(.1), y1 = yb(.68), iron = [72, 66, 68];
  for (const [x, y] of [[x0 + .04, y0 + .04], [x1 - .1, y0 + .04], [x0 + .04, y1 - .1], [x1 - .1, y1 - .1]]) fbox(x, y, fz, x + .06, y + .06, fz + .1, iron, 130);
  fbox(x0, y0, fz + .1, x1, y1, fz + .72, iron, 131);
  EM = 1;
  onY(y1, x0 + .16, x1 - .16, fz + .2, fz + .48, (x, z) => { const f = hash(Math.floor(x * 40), Math.floor(z * 40)), zz = (z - fz - .2) / .28; return zz < .35 + f * .5 ? rgb(255, 150 + f * 90, 40) : rgb(120, 40, 20); });
  EM = 0;
  onY(y1, x0 + .12, x1 - .12, fz + .5, fz + .54, rgb(40, 36, 38));
  onZ(fz + .72, x0 + .08, y0 + .1, x0 + .3, y0 + .3, rgb(36, 32, 34)); onZ(fz + .72, x0 + .38, y0 + .3, x0 + .6, y0 + .5, rgb(36, 32, 34));
  fbox(x0 + .4, y0 + .32, fz + .72, x0 + .58, y0 + .48, fz + .86, [190, 70, 50], 132);
  fbox(x0 + .2, y0 + .02, fz + .72, x0 + .36, y0 + .18, fz + UG.h, [60, 58, 62], 133);
  fbox(x0 + .18, y0, fz + 1.6, x0 + .38, y0 + .2, fz + 1.66, [90, 88, 92], 134);
  lamp(0, x0 + .35, y1 + .5, fz, 1.6, 1.1, FIRE_T);
  footShadow(x0, y0, x1, y1, .7);
}
function lockers(fz) {
  const x0 = UG.x0 + .02, x1 = UG.x0 + .48, y0 = yb(1.62), y1 = yb(2.52), top = 1.85;
  fbox(x0, y0, fz, x1, y1, fz + top, OLIVE_L, 140);
  onX(x1, y0, y1, fz + .04, fz + top - .04, (y, z) => {
    const f = (y - y0) / .3, n = Math.floor(f), d = f - n, zz = z - fz;
    if (d < .06) return rgb(50, 62, 50);
    if (zz > 1.45 && zz < 1.62 && (Math.floor(zz * 40) & 1) && d > .25 && d < .75) return rgb(50, 62, 50);
    if (zz > 1.25 && zz < 1.35 && d > .3 && d < .7) return rgb(214, 210, 190);
    if (Math.abs(zz - .95) < .05 && d > .78 && d < .9) return rgb(200, 204, 196);
    return 0;
  });
  footShadow(x0, y0, x1, y1, top);
}
function counter(fz) {
  const x0 = XA(kitA()), x1 = x0 + 1.35, y0 = yb(.06), y1 = yb(.64);
  fbox(x0, y0, fz, x1, y1, fz + .84, [150, 110, 70], 150);
  onY(y1, x0 + .03, x1 - .03, fz + .08, fz + .8, (x, z) => { const f = (x - x0) / .35, d = f - Math.floor(f), zz = z - fz; return d < .05 || zz < .1 ? rgb(96, 68, 44) : d > .82 && d < .9 && Math.abs(zz - .62) < .06 ? rgb(220, 206, 160) : 0; });
  fbox(x0 - .02, y0, fz + .84, x1 + .02, y1 + .03, fz + .9, [196, 190, 178], 151, .6);
  onZ(fz + .9, x0 + .5, y0 + .12, x0 + .95, y1 - .1, (x, y) => x < x0 + .54 || x > x0 + .91 || y < y0 + .16 || y > y1 - .14 ? rgb(150, 156, 162) : rgb(70, 76, 84));
  fbox(x0 + .7, y0 + .04, fz + .9, x0 + .76, y0 + .1, fz + 1.12, METAL, 152); fbox(x0 + .7, y0 + .04, fz + 1.08, x0 + .76, y0 + .28, fz + 1.12, METAL, 153);
  fbox(x0 + .12, y0 + .14, fz + .9, x0 + .38, y0 + .4, fz + .94, [150, 110, 70], 154);
  fbox(x0 + .16, y0 + .18, fz + .94, x0 + .24, y0 + .3, fz + 1.02, [210, 80, 60], 155);
  footShadow(x0, y0, x1, y1, .9);
}
function fridge(fz) {
  const x0 = XA(kitA() + 1.45), x1 = x0 + .72, y0 = yb(.06), y1 = yb(.7), top = 1.78;
  sbox(x0, y0, fz, x1, y1, fz + top, [226, 224, 214], 160);
  onY(y1, x0 + .02, x1 - .02, fz + .04, fz + top - .04, (x, z) => {
    const zz = z - fz, f = (x - x0) / .72;
    if (Math.abs(zz - 1.16) < .02) return rgb(150, 150, 146);
    if (f > .82 && f < .88 && ((zz > .7 && zz < 1.05) || (zz > 1.25 && zz < 1.5))) return rgb(120, 122, 126);
    if (Math.abs(f - .3) < .05 && Math.abs(zz - 1.35) < .05) return rgb(210, 60, 50);
    if (Math.abs(f - .5) < .05 && Math.abs(zz - 1.45) < .05) return rgb(60, 140, 210);
    if (f > .2 && f < .48 && zz > .8 && zz < 1.0) return rgb(250, 246, 200);
    return 0;
  });
  footShadow(x0, y0, x1, y1, top);
}
function diningTable(fz, dressed) {
  const x0 = XA(RL() * .43), x1 = x0 + 1.7, y0 = yb(RL() * .39), y1 = y0 + .7, tz = .72, wood = [158, 116, 72];
  const chair = (x, y, back) => {
    fbox(x - .17, y - .17, fz + .38, x + .17, y + .17, fz + .44, wood, 170);
    for (const [dx, dy] of [[-.15, -.15], [.11, -.15], [-.15, .11], [.11, .11]]) fbox(x + dx, y + dy, fz, x + dx + .04, y + dy + .04, fz + .38, WOOD_D, 171);
    if (back === 'y') fbox(x - .17, y + .13, fz + .44, x + .17, y + .17, fz + .88, wood, 172);
    if (back === 'y-') fbox(x - .17, y - .17, fz + .44, x + .17, y - .13, fz + .88, wood, 172);
    if (back === 'x-') fbox(x - .17, y - .17, fz + .44, x - .13, y + .17, fz + .88, wood, 173);
    if (back === 'x+') fbox(x + .13, y - .17, fz + .44, x + .17, y + .17, fz + .88, wood, 174);
    footShadow(x - .17, y - .17, x + .17, y + .17, .44);
  };
  if (dressed) { chair(x0 - .25, (y0 + y1) / 2, 'x-'); chair(x1 + .25, (y0 + y1) / 2, 'x+'); for (const x of [x0 + .4, x1 - .4]) { chair(x, y1 + .3, 'y'); chair(x, y0 - .3, 'y-'); } }
  else { for (const [x, y] of [[x0 - .25, (y0 + y1) / 2], [x1 + .25, (y0 + y1) / 2], [x0 + .6, y1 + .28], [x1 - .6, y0 - .28]]) { fbox(x - .16, y - .16, fz, x + .16, y + .16, fz + .42, WOOD, 175); footShadow(x - .16, y - .16, x + .16, y + .16, .4); } }
  for (const [x, y] of [[x0 + .04, y0 + .04], [x1 - .1, y0 + .04], [x0 + .04, y1 - .1], [x1 - .1, y1 - .1]]) fbox(x, y, fz, x + .06, y + .06, fz + tz, WOOD_D, 176);
  fbox(x0, y0, fz + tz, x1, y1, fz + tz + .06, wood, 177);
  if (dressed) {
    const cl = (x, y) => ((Math.floor((x - x0) * 7) + Math.floor((y - y0) * 7)) & 1) ? rgb(200, 56, 50) : rgb(240, 232, 220);
    onZ(fz + tz + .06, x0 - .04, y0 - .04, x1 + .04, y1 + .04, cl);
    onY(y1 + .04, x0 - .04, x1 + .04, fz + tz - .12, fz + tz + .06, (x, z) => cl(x, y1 + (fz + tz + .06 - z)));
    for (const [x, y] of [[x0 + .4, y0 + .18], [x1 - .4, y0 + .18], [x0 + .4, y1 - .18], [x1 - .4, y1 - .18]]) fbox(x - .1, y - .1, fz + tz + .06, x + .1, y + .1, fz + tz + .08, [236, 236, 232], 178);
    fbox(x0 + .82, y0 + .3, fz + tz + .06, x0 + .9, y0 + .38, fz + tz + .22, [236, 230, 200], 179);
    pt(x0 + .86, y0 + .34, fz + tz + .26, lit(rgb(255, 200, 80)));
  } else { fbox(x0 + .45, y0 + .25, fz + tz + .06, x0 + .65, y0 + .4, fz + tz + .16, [200, 190, 170], 180); fbox(x1 - .6, y0 + .3, fz + tz + .06, x1 - .45, y0 + .42, fz + tz + .14, [150, 110, 70], 181); }
  footShadow(x0, y0, x1, y1, tz);
}
// the sofa faces the TV on the left wall: its back to the room
function sofa(fz) {
  const lb = loungeB(), x0 = XA(2.6), x1 = x0 + .65, y0 = yb(lb + .5), y1 = y0 + 1.6, c = [150, 66, 58];
  fbox(x0, y0, fz, x1, y1, fz + .38, c, 190);
  fbox(x0 + .04, y0 + .16, fz + .38, x1 - .2, y1 - .16, fz + .46, [172, 80, 68], 191);
  onZ(fz + .46, x0 + .04, y0 + .16, x1 - .2, y1 - .16, (x, y) => Math.abs(y - (y0 + y1) / 2) < .02 ? rgb(120, 50, 44) : 0);
  fbox(x1 - .2, y0, fz + .38, x1, y1, fz + .84, c, 192);
  fbox(x0, y0, fz + .38, x1 - .2, y0 + .16, fz + .6, c, 193); fbox(x0, y1 - .16, fz + .38, x1 - .2, y1, fz + .6, c, 194);
  fbox(x1 - .3, y0 + .24, fz + .46, x1 - .2, y0 + .5, fz + .7, [226, 196, 110], 195);
  footShadow(x0, y0, x1, y1, .84);
}
function plants(fz) {
  const lb = loungeB();
  for (const [a, b, s] of [[3.85, lb + 2.5, 1.1], [.72, 3.35, 1], [RL() * .43 + 2.2, RL() * .39 + .35, .9]]) potPlant(XA(a), yb(b), fz, s, a * 7);
  potPlant(XA(kitA() + 1.45) + .36, yb(.38), fz + 1.78, .55, 33);
}
function potPlant(x, y, fz, s, seed) {
  const r = .16 * s;
  fbox(x - r, y - r, fz, x + r, y + r, fz + .3 * s, [176, 92, 62], seed);
  fbox(x - r - .02, y - r - .02, fz + .3 * s, x + r + .02, y + r + .02, fz + .34 * s, [196, 108, 72], seed + 1);
  onZ(fz + .34 * s, x - r, y - r, x + r, y + r, rgb(70, 50, 36));
  const G1 = [[60, 120, 60], [84, 150, 70], [110, 176, 84]];
  for (let k = 0; k < 9; k++) {
    const a = hash(k, seed) * 6.28, d = hash(seed, k) * .18 * s, h = (.4 + hash(k + 3, seed) * .45) * s;
    const lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * .8, w = .06 * s;
    fbox(lx - w, ly - w, fz + .3 * s + h * .5, lx + w, ly + w, fz + .3 * s + h, G1[k % 3], seed + k);
  }
  footShadow(x - r, y - r, x + r, y + r, .5 * s);
}
const POSTER = [
  (u, v) => v < .15 || v > .85 || u < .1 || u > .9 ? rgb(40, 36, 40) : (Math.abs(u - .5) < .12 && v > .3 && v < .8) || (Math.abs(v - .45) < .07 && u > .28 && u < .72) ? rgb(120, 190, 90) : rgb(140, 40, 44),
  (u, v) => v > .62 ? (Math.abs(u - .7) < .1 && Math.abs(v - .78) < .1 ? rgb(255, 210, 90) : rgb(120, 180, 226)) : v > .32 + Math.abs(u - .4) * .6 ? rgb(70, 130, 80) : v > .3 ? rgb(240, 240, 240) : rgb(90, 110, 120),
  (u, v) => (Math.floor((u + v) * 6) & 1) ? rgb(232, 186, 50) : rgb(36, 34, 38),
];
function posters(fz) {
  [[BED_X(0) + .05, .78, 0], [BED_X(0) + 1.05, .7, 2], [BED_X(1) + .75, .8, 1]].forEach(([x, w, k]) => {
    const y = UG.y0;
    onY(y + .01, x, x + w, fz + 1.58, fz + 2.08, (xx, z) => { const u = (xx - x) / w, v = (z - fz - 1.58) / .5; return u < .04 || u > .96 || v < .05 || v > .95 ? rgb(236, 232, 220) : POSTER[k](u, v); });
  });
}
function stringLights(fz) {
  const y = UG.y0 + .03, cols = [rgb(255, 90, 80), rgb(255, 210, 90), rgb(110, 220, 120), rgb(110, 170, 255)];
  const a0 = XA(1.1), a1 = UG.x1 - .3, seg = 1.25, xw = UG.x0 + .03, b0 = yb(1.1), b1 = UG.y1 - .3;
  let n = 0;
  // along the back wall, then along the left wall
  for (let x = a0; x < a1; x += STEP * 2) pt(x, y, fz + UG.h - .1 - Math.sin(((x - a0) % seg) / seg * Math.PI) * .16, rgb(40, 36, 40));
  for (let v = b0; v < b1; v += STEP * 2) pt(xw, v, fz + UG.h - .1 - Math.sin(((v - b0) % seg) / seg * Math.PI) * .16, rgb(40, 36, 40));
  for (let x = a0 + .18; x < a1; x += .32) {
    const z = UG.h - .14 - Math.sin(((x - a0) % seg) / seg * Math.PI) * .16, c = lit(cols[n++ % 4]);
    pt(x, y, fz + z, c); pt(x + .05, y, fz + z, c); pt(x, y, fz + z - .06, c);
  }
  for (let v = b0 + .18; v < b1; v += .32) {
    const z = UG.h - .14 - Math.sin(((v - b0) % seg) / seg * Math.PI) * .16, c = lit(cols[n++ % 4]);
    pt(xw, v, fz + z, c); pt(xw, v + .05, fz + z, c); pt(xw, v, fz + z - .06, c);
  }
}
function armchair(fz) {
  const x0 = UG.x0 + .12, x1 = x0 + .7, y0 = yb(loungeB() + 2.45), y1 = y0 + .7, c = [190, 146, 64];
  fbox(x0, y0, fz, x1, y1, fz + .36, c, 200);
  fbox(x0, y0, fz + .36, x0 + .18, y1, fz + .86, c, 201);
  fbox(x0 + .18, y0, fz + .36, x1, y0 + .14, fz + .56, c, 202); fbox(x0 + .18, y1 - .14, fz + .36, x1, y1, fz + .56, c, 203);
  fbox(x0 + .2, y0 + .16, fz + .36, x1 - .04, y1 - .16, fz + .44, [206, 164, 84], 204);
  footShadow(x0, y0, x1, y1, .86);
}
// a punching bag hung from the ceiling on a chain
function punchingBag(fz) {
  const x = XA(RL() - .9), y = yb(3.3);
  ln([x, y, fz + UG.h], [x, y, fz + 1.42], rgb(150, 156, 164));
  fbox(x - .1, y - .1, fz + 1.36, x + .1, y + .1, fz + 1.42, DARK, 210);
  fbox(x - .22, y - .22, fz + .36, x + .22, y + .22, fz + 1.36, [200, 46, 40], 211);
  onY(y + .22, x - .22, x + .22, fz + .36, fz + 1.36, (xx, z) => Math.abs(z - fz - 1.24) < .04 || Math.abs(z - fz - .48) < .04 ? rgb(40, 36, 40) : Math.abs(xx - x) < .1 && Math.abs(z - fz - .9) < .14 ? rgb(244, 238, 222) : 0);
  onX(x + .22, y - .22, y + .22, fz + .36, fz + 1.36, (yy, z) => Math.abs(z - fz - 1.24) < .04 || Math.abs(z - fz - .48) < .04 ? rgb(30, 26, 30) : 0);
  for (let k = 0; k < 4; k++) castShadow(x + .05, y, .6 + k * .2, .18);
}
function wallShelves(fz) {
  const x0 = BED_X(2) + .15, x1 = x0 + 1.35, y0 = UG.y0;
  for (const z of [1.3, 1.82]) {
    fbox(x0, y0, fz + z - .04, x1, y0 + .24, fz + z, WOOD, 220 + z);
    for (const x of [x0 + .1, x1 - .16]) fbox(x, y0, fz + z - .16, x + .04, y0 + .2, fz + z - .04, DARK, 222);
  }
  const jar = (x, z, c, h = .2) => { sbox(x, y0 + .05, fz + z, x + .14, y0 + .19, fz + z + h, c, 223); fbox(x, y0 + .05, fz + z + h, x + .14, y0 + .19, fz + z + h + .04, [200, 60, 50], 224); };
  jar(x0 + .1, 1.3, [200, 150, 60]); jar(x0 + .3, 1.3, [120, 170, 90], .16); jar(x0 + .5, 1.3, [210, 120, 60], .24);
  for (let k = 0; k < 5; k++) fbox(x0 + .8 + k * .07, y0 + .03, fz + 1.3, x0 + .86 + k * .07, y0 + .2, fz + 1.5 + hash(k, 2) * .08, BOOK_R ? [[150, 50, 44], [52, 92, 140], [196, 160, 64], [70, 120, 70], [120, 70, 120]][k] : WOOD, 225 + k);
  fbox(x0 + .15, y0 + .04, fz + 1.82, x0 + .5, y0 + .2, fz + 2.02, [176, 132, 84], 230);
  fbox(x0 + .6, y0 + .02, fz + 1.82, x0 + .9, y0 + .06, fz + 2.12, [60, 50, 40], 231);
  onY(y0 + .06, x0 + .63, x0 + .87, fz + 1.86, fz + 2.08, (x, z) => z - fz > 1.98 ? rgb(130, 180, 230) : rgb(90, 140, 80));
  potPlant(x1 - .2, y0 + .12, fz + 1.82, .55, 41);
}
function medCabinet(fz) {
  const x0 = XA(kitA()) + .02, x1 = x0 + .88, y0 = UG.y0;
  sbox(x0, y0, fz + 1.12, x1, y0 + .22, fz + 1.98, [240, 240, 236], 240);
  onY(y0 + .22, x0 + .03, x1 - .03, fz + 1.15, fz + 1.95, (x, z) => { const u = (x - x0) / .88 - .5, v = (z - fz - 1.55) / .8; if (Math.abs(u) > .44 || Math.abs(v) > .44) return rgb(200, 40, 40); return (Math.abs(u) < .1 && Math.abs(v) < .3) || (Math.abs(v) < .1 && Math.abs(u) < .3) ? rgb(220, 36, 36) : 0; });
}
function shower(fz) {
  const x0 = UG.x0, x1 = x0 + .92, y0 = UG.y1 - .97, y1 = UG.y1 - .02;
  sbox(x0 + .02, y0, fz, x1, y1, fz + .1, [236, 236, 232], 250);
  onZ(fz + .1, x0 + .1, y0 + .08, x1 - .08, y1 - .08, (x, y) => Math.abs(x - (x0 + x1) / 2) < .05 && Math.abs(y - (y0 + y1) / 2) < .05 ? rgb(90, 96, 104) : rgb(200, 220, 230));
  fbox(x1 - .02, y0, fz + 2.0, x1 + .02, y1, fz + 2.04, METAL, 251);
  fbox(x1 - .03, y0, fz + .2, x1, y0 + .55, fz + 2.0, [214, 226, 236], 252);
  onX(x1, y0, y0 + .55, fz + .2, fz + 2.0, y => (Math.floor((y - y0) * 22) & 1) ? rgb(150, 190, 220) : 0);
  fbox(x0, y0 + .4, fz + 1.86, x0 + .3, y0 + .46, fz + 1.9, METAL, 253);
  fbox(x0 + .24, y0 + .34, fz + 1.76, x0 + .34, y0 + .52, fz + 1.86, METAL, 254);
  fbox(x0 + .04, y1 - .3, fz + 1.1, x0 + .1, y1 - .06, fz + 1.5, [220, 120, 90], 255);
}
function pingPong(fz) {
  const x0 = XA(RL() - 3.45), x1 = x0 + 1.7, y0 = yb(RL() * .39 + .1), y1 = y0 + .95, tz = .74;
  for (const [x, y] of [[x0 + .1, y0 + .1], [x1 - .18, y0 + .1], [x0 + .1, y1 - .18], [x1 - .18, y1 - .18]]) fbox(x, y, fz, x + .08, y + .08, fz + tz, DARK, 260);
  fbox(x0, y0, fz + tz, x1, y1, fz + tz + .05, [40, 112, 74], 261, .6);
  onZ(fz + tz + .05, x0, y0, x1, y1, (x, y) => x < x0 + .03 || x > x1 - .03 || y < y0 + .03 || y > y1 - .03 || Math.abs(y - (y0 + y1) / 2) < .012 ? rgb(240, 240, 236) : 0);
  const mx = (x0 + x1) / 2;
  fbox(mx - .015, y0 - .04, fz + tz + .05, mx + .015, y1 + .04, fz + tz + .2, [230, 230, 226], 262, .4);
  for (const [x, y, c] of [[x0 + .35, y0 + .3, [200, 50, 44]], [x1 - .5, y1 - .4, [40, 40, 46]]]) { fbox(x, y, fz + tz + .05, x + .14, y + .14, fz + tz + .08, c, 263); fbox(x + .14, y + .05, fz + tz + .05, x + .26, y + .09, fz + tz + .08, WOOD, 264); }
  pt(mx + .4, y0 + .5, fz + tz + .12, rgb(255, 255, 250));
  footShadow(x0, y0, x1, y1, tz);
}
// a map of the area, pinned up on the left wall over the TV
function mapWall(fz) {
  const lb = loungeB(), y0 = yb(lb + .6), y1 = y0 + 1.4, x = UG.x0, z0 = fz + 1.42, z1 = fz + 2.2;
  fbox(x, y0 - .06, z0 - .06, x + .04, y1 + .06, z1 + .06, [86, 56, 36], 270);
  onX(x + .04, y0, y1, z0, z1, (y, z, ix, iy) => {
    const u = (y - y0) / 1.4, v = (z - z0) / .78, land = nz(u * 4 + 7, v * 4) + (u - .5) * .3 > .55;
    if (Math.abs((u * 6) % 1) < .06 || Math.abs((v * 5) % 1) < .06) return rgb(120, 140, 150);
    return land ? pick(rampOf([120, 170, 80]), 2.6 + nz(u * 12, v * 12), ix, iy) : pick(rampOf([70, 140, 210]), 2.8, ix, iy);
  });
  const pins = [[.2, .7], [.45, .4], [.7, .62], [.82, .25], [.3, .2]], P = pins.map(([u, v]) => [y0 + u * 1.4, z0 + v * .78]);
  for (let k = 0; k < P.length - 1; k++) ln([x + .05, P[k][0], P[k][1]], [x + .05, P[k + 1][0], P[k + 1][1]], rgb(200, 40, 40));
  P.forEach(([y, z], k) => { const c = k % 2 ? [255, 220, 60] : [230, 50, 40]; fbox(x + .04, y - .04, z - .04, x + .1, y + .04, z + .04, c, 271 + k); });
}
function coffeeTable(fz) {
  const lb = loungeB(), x0 = XA(1.3), x1 = x0 + .8, y0 = yb(lb + .75), y1 = y0 + 1.1;
  for (const [x, y] of [[x0 + .04, y0 + .04], [x1 - .1, y0 + .04], [x0 + .04, y1 - .1], [x1 - .1, y1 - .1]]) fbox(x, y, fz, x + .06, y + .06, fz + .36, WOOD_D, 280);
  fbox(x0, y0, fz + .36, x1, y1, fz + .44, [214, 200, 170], 281, .5);
  onZ(fz + .44, x0 + .08, y0 + .05, x0 + .44, y1 - .05, (x, y) => ((Math.floor((x - x0) * 18) + Math.floor((y - y0) * 18)) & 1) ? rgb(250, 246, 230) : rgb(30, 28, 34));
  for (const [x, y, c] of [[x0 + .4, y0 + .1, [200, 50, 44]], [x0 + .25, y0 + .22, [40, 40, 46]]]) fbox(x, y, fz + .44, x + .05, y + .05, fz + .52, c, 283);
  for (const [x, c] of [[x0 + .6, [236, 236, 232]], [x0 + .8, [220, 60, 50]]]) fbox(x, y0 + .12, fz + .44, x + .12, y0 + .26, fz + .58, c, 282);
  fbox(x1 - .2, y0 + .06, fz + .44, x1 - .06, y1 - .06, fz + .5, [60, 90, 150], 284);
  footShadow(x0, y0, x1, y1, .42);
}
// a clothesline over the front beds, with the wash hung out
function clothesline(fz) {
  const xa = XA(1.8), xb = XA(5.85), y = yb(2.94), z = fz + 2.28;
  for (const x of [xa, xb]) fbox(x - .03, y - .03, fz + 1.6, x + .03, y + .03, fz + UG.h, WOOD, 290);
  ln([xa, y, z], [xb, y, z], rgb(230, 226, 214));
  const cols = [[200, 60, 50], [70, 110, 170], [236, 232, 220], [90, 140, 80], [226, 186, 60], [150, 90, 150]];
  for (let k = 0, x = xa + .25; x < xb - .3; x += .42 + hash(k, 5) * .12, k++) {
    const c = cols[k % 6], w = .12 + hash(k, 6) * .1, h = .22 + hash(k, 7) * .2;
    fbox(x - w, y - .015, z - h, x + w, y + .015, z, c, 291 + k, .5);
    if (k % 3 === 0) { fbox(x - w, y - .015, z - h - .14, x - w + .07, y + .015, z - h, c, 300 + k, .5); fbox(x + w - .07, y - .015, z - h - .14, x + w, y + .015, z - h, c, 310 + k, .5); }
    pt(x - w + .02, y + .02, z + .01, rgb(200, 170, 110)); pt(x + w - .02, y + .02, z + .01, rgb(200, 170, 110));
  }
}
// a water cooler with a big blue bottle
function waterCooler(fz) {
  const fits = kitA() + 3.55 < RL(), x = fits ? XA(kitA() + 3.12) : XA(.12), y0 = fits ? yb(.12) : yb(3.3), y1 = y0 + .38;
  sbox(x, y0, fz, x + .36, y1, fz + .95, [232, 234, 236], 156);
  onY(y1, x + .08, x + .28, fz + .55, fz + .75, (xx, z) => Math.abs(xx - x - .12) < .03 && Math.abs(z - fz - .65) < .05 ? rgb(60, 120, 220) : Math.abs(xx - x - .24) < .03 && Math.abs(z - fz - .65) < .05 ? rgb(220, 60, 50) : 0);
  sbox(x + .06, y0 + .06, fz + .95, x + .3, y1 - .06, fz + 1.4, [110, 170, 226], 157);
  sbox(x + .12, y0 + .12, fz + 1.4, x + .24, y1 - .12, fz + 1.46, [80, 130, 200], 158);
  footShadow(x, y0, x + .36, y1, 1.4);
}
function aquarium(fz0) {
  const x0 = XA(kitA()) + .9, x1 = x0 + .42, y0 = yb(.1), y1 = yb(.46), fz = fz0 + .48;
  fbox(x0, y0, fz + .42, x1, y1, fz + .45, DARK, 311);
  EM = 1;
  fbox(x0 + .03, y0 + .03, fz + .45, x1 - .03, y1 - .03, fz + .88, [90, 160, 210], 312, .5);
  onY(y1 - .03, x0 + .05, x1 - .05, fz + .46, fz + .86, (x, z) => {
    const u = (x - x0) / .42, v = (z - fz - .46) / .4, h = hash(Math.floor(u * 12), Math.floor(v * 10));
    if (v < .12) return rgb(214, 196, 150);
    if (v < .55 && (Math.abs(u - .2) < .03 || Math.abs(u - .78) < .03)) return rgb(60, 170, 90);
    if ((Math.abs(u - .4) < .05 && Math.abs(v - .6) < .06) || (Math.abs(u - .64) < .04 && Math.abs(v - .35) < .05)) return rgb(255, 150, 50);
    if (h > .95) return rgb(220, 240, 255);
    return 0;
  });
  EM = 0;
  fbox(x0, y0, fz + .88, x1, y1, fz + .92, DARK, 313);
  lamp(0, (x0 + x1) / 2, y1 + .3, fz + .6, 1.4, 1.0, CYAN_T);
}
function arcade(fz) {
  const x0 = XA(RL() * .36), x1 = x0 + .6, y0 = yb(RL() - 2.65), y1 = y0 + .6, body = [70, 46, 110];
  fbox(x0, y0, fz, x1, y1, fz + 1.62, body, 320);
  fbox(x0 + .02, y1, fz + .82, x1 - .02, y1 + .14, fz + .92, [40, 34, 56], 321);
  onZ(fz + .92, x0 + .1, y1 + .02, x1 - .1, y1 + .12, (x, y) => { const u = (x - x0) / .62; return Math.abs(u - .3) < .05 ? rgb(230, 40, 40) : Math.abs(u - .55) < .04 ? rgb(60, 200, 255) : Math.abs(u - .7) < .04 ? rgb(255, 220, 60) : 0; });
  EM = 1;
  onY(y1, x0 + .08, x1 - .08, fz + 1.0, fz + 1.36, (x, z) => { const u = (x - x0 - .08) / .46, v = (z - fz - 1.0) / .36, h = hash(Math.floor(u * 9), Math.floor(v * 7)); return v < .2 ? rgb(60, 220, 120) : h > .8 ? rgb(255, 80, 200) : h > .7 ? rgb(255, 240, 120) : rgb(20, 24, 60); });
  onY(y1, x0 + .02, x1 - .02, fz + 1.44, fz + 1.58, (x, z) => (Math.floor((x - x0) * 20) & 1) ? rgb(255, 120, 220) : rgb(120, 230, 255));
  EM = 0;
  onX(x1, y0 + .04, y1 - .04, fz + .1, fz + 1.5, (y, z) => Math.abs((y - y0) * 2.2 - (z - fz) * .6 - .2) < .06 ? rgb(255, 120, 220) : 0);
  lamp(0, (x0 + x1) / 2, y1 + .4, fz + .5, 1.1, .8, PINK_T);
  footShadow(x0, y0, x1, y1, 1.62);
}
function ducts(fz) {
  const x0 = UG.x0, y0 = yb(1.05), y1 = UG.y1 - .05, c = [168, 174, 178];
  sbox(x0, y0, fz + 2.12, x0 + .36, y1, fz + 2.46, c, 330);
  onX(x0 + .36, y0, y1, fz + 2.12, fz + 2.46, y => ((y - y0) % .7) < .04 ? rgb(120, 126, 130) : 0);
  sbox(x0, yb(1.2), fz + 1.5, x0 + .1, yb(1.6), fz + 2.12, c, 331);
  onX(x0 + .1, yb(1.24), yb(1.56), fz + 1.56, fz + 2.06, (y, z) => (Math.floor((z - fz) * 28) & 1) ? rgb(70, 74, 80) : 0);
  // and a drop to a grille on the back wall beside the shaft
  sbox(UG.x0 + 1.92, UG.y0, fz + 1.55, UG.x0 + 2.0, UG.y0 + .12, fz + 2.46, c, 332);
}
// the bunker's emblem, painted big on the left wall
function emblem(fz) {
  const cy = yb(loungeB() + 4.2), x = UG.x0 + .01, z0 = fz + .9, z1 = fz + 2.08;
  onX(x, cy - .72, cy + .72, z0, z1, (y, z) => {
    const u = (y - cy) / .72, v = (z - z0) / 1.18, half = v > .35 ? 1 : .25 + v * 2.1;
    if (Math.abs(u) > half) return 0;
    if (Math.abs(u) > half - .14 || v > .9) return rgb(230, 186, 60);
    const sx = Math.abs(u), sv = v - .55;
    if (sx < .36 && sv > -.12 && sv < .2) { if (sv > .0 && Math.abs(sx - .17) < .08 && sv < .12) return rgb(30, 26, 30); return rgb(236, 232, 220); }
    if (sx < .26 && sv > -.24 && sv <= -.12) return (Math.floor((u + 1) * 12) & 1) ? rgb(236, 232, 220) : rgb(30, 26, 30);
    return rgb(150, 34, 36);
  });
}
// the vault in the front corner: a low railing on its two inner sides with a gap to walk in
function vaultCage(fz) {
  const a0 = RL() - STORE, x0 = XA(a0), y0 = yb(a0), x1 = UG.x1, y1 = UG.y1, post = [226, 186, 50];
  for (let x = x0; x <= x1 - .1; x += .5) if (Math.abs(x - (x0 + x1) / 2) > .45) fbox(x, y0 - .03, fz, x + .06, y0 + .03, fz + .55, post, 340);
  for (let y = y0 + .5; y <= y1 - .1; y += .5) fbox(x0 - .03, y, fz, x0 + .03, y + .06, fz + .55, post, 341);
  for (const [xa, xb] of [[x0, (x0 + x1) / 2 - .45], [(x0 + x1) / 2 + .45, x1 - .05]]) fbox(xa, y0 - .03, fz + .5, xb, y0 + .03, fz + .56, [60, 56, 60], 342);
  fbox(x0 - .03, y0, fz + .5, x0 + .03, y1 - .05, fz + .56, [60, 56, 60], 343);
}
// before a corner of the room is furnished it holds the stores the survivors moved in with: crates, sacks, water
// barrels, lumber, a washtub. Each pile is cleared when that corner gets its furniture
function supplyCrate(x, y, fz, w, h, c, seed, label) {
  fbox(x, y, fz, x + w, y + w * .8, fz + h, c, seed);
  onY(y + w * .8, x, x + w, fz, fz + h, (xx, z) => Math.abs(z - fz - h / 2) < .02 || Math.abs(xx - x - w / 2) < .015 ? rampOf(c)[1] : label && Math.abs(xx - x - w * .3) < w * .14 && Math.abs(z - fz - h * .72) < h * .1 ? label : 0);
  onX(x + w, y, y + w * .8, fz, fz + h, (yy, z) => Math.abs(z - fz - h / 2) < .02 ? rampOf(c)[0] : 0);
  footShadow(x, y, x + w, y + w * .8, h);
}
function grainSack(x, y, fz, s, seed, c = [206, 186, 140]) {
  fbox(x - .17 * s, y - .13 * s, fz, x + .17 * s, y + .13 * s, fz + .34 * s, c, seed, .7);
  fbox(x - .08 * s, y - .06 * s, fz + .34 * s, x + .08 * s, y + .06 * s, fz + .42 * s, c, seed + 1, .7);
  onY(y + .13 * s, x - .17 * s, x + .17 * s, fz + .12 * s, fz + .2 * s, rgb(170, 70, 50));
}
function waterBarrel(x, y, fz, seed) {
  sbox(x - .2, y - .2, fz, x + .2, y + .2, fz + .7, [66, 104, 150], seed);
  for (const z of [.12, .56]) sbox(x - .21, y - .21, fz + z, x + .21, y + .21, fz + z + .04, [44, 70, 104], seed + 1);
  footShadow(x - .2, y - .2, x + .2, y + .2, .7);
}
function moveInStores(fz, L) {
  const RLx = RL(), lb = loungeB(), K = kitA(), OLV = [96, 108, 76], PLK = [176, 136, 88], RED = rgb(190, 50, 40);
  if (L < 13) { // the lounge corner: crates under a tarp, sacks
    supplyCrate(XA(.3), yb(lb + .1), fz, .55, .5, OLV, 360, RED); supplyCrate(XA(.33), yb(lb + .14), fz + .5, .5, .42, PLK, 361);
    supplyCrate(XA(1.0), yb(lb + .15), fz, .6, .45, PLK, 362);
    fbox(XA(1.7), yb(lb + .25), fz, XA(2.6), yb(lb + 1.15), fz + .55, [88, 110, 96], 363, .6);
    onZ(fz + .55, XA(1.7), yb(lb + .25), XA(2.6), yb(lb + 1.15), (x, y) => ((x - y) * 4 % 1 + 1) % 1 < .1 ? rgb(70, 88, 76) : 0);
    for (const [a, b, k] of [[1.3, 1.95, 0], [1.68, 2.05, 1], [1.5, 2.4, 2]]) grainSack(XA(a), yb(lb + b), fz, 1, 364 + k * 3);
  }
  if (L < 6) { // where the mess table will stand: a pallet of supplies
    const x0 = XA(RLx * .43), y0 = yb(RLx * .39);
    fbox(x0, y0, fz, x0 + 1.2, y0 + .9, fz + .12, PLK, 370);
    for (let k = 0; k < 4; k++) grainSack(x0 + .3 + (k & 1) * .55, y0 + .25 + (k >> 1) * .42, fz + .12, 1, 371 + k * 3, k & 1 ? [214, 196, 150] : [196, 176, 128]);
    supplyCrate(x0 + 1.35, y0 + .1, fz, .45, .4, OLV, 385);
  }
  if (L < 10) { waterBarrel(XA(K + 2.5), yb(.45), fz, 390); waterBarrel(XA(K + 3.0), yb(.5), fz, 392); supplyCrate(XA(K + 1.6), yb(.2), fz, .55, .5, PLK, 394); }
  if (L < 31) { // lumber for the games corner
    const x0 = XA(RLx - 3.4), y0 = yb(RLx * .39 + .3);
    for (let k = 0; k < 4; k++) fbox(x0, y0 + k * .14, fz + (k > 1 ? .1 : 0), x0 + 1.6, y0 + k * .14 + .12, fz + .1 + (k > 1 ? .1 : 0), PLK, 396 + k, 1.6);
    for (const x of [x0 + .2, x0 + 1.25]) { fbox(x, y0 + .7, fz, x + .06, y0 + 1.1, fz + .45, WOOD_D, 400); fbox(x - .1, y0 + .7, fz + .45, x + .16, y0 + 1.1, fz + .5, WOOD, 401); }
    footShadow(x0, y0, x0 + 1.6, y0 + .6, .25);
  }
  if (L < 38) { // a rack of supplies in the front
    const x0 = XA(RLx * .36 - .2), y0 = yb(RLx - 2.7), steel = [140, 146, 152];
    for (const [x, y] of [[x0, y0], [x0 + 1.3, y0], [x0, y0 + .45], [x0 + 1.3, y0 + .45]]) sbox(x, y, fz, x + .05, y + .05, fz + 1.5, steel, 402);
    for (const z of [.05, .55, 1.05, 1.5]) { sbox(x0, y0, fz + z, x0 + 1.35, y0 + .5, fz + z + .04, steel, 403); if (z < 1.4) for (let k = 0; k < 3; k++) if (hash(k, z * 9) > .2) supplyCrate(x0 + .08 + k * .43, y0 + .06, fz + z + .04, .36, .3 + hash(z, k) * .1, [[176, 136, 88], [96, 108, 76], [150, 60, 50]][(k + Math.floor(z * 3)) % 3], 404 + k); }
  }
  if (L < 29) { // the washtub before the shower
    const x = XA(.6), y = yb(RLx - .6);
    fbox(x - .4, y - .3, fz, x + .4, y + .3, fz + .32, [150, 156, 164], 410, .5);
    onZ(fz + .32, x - .34, y - .24, x + .34, y + .24, rgb(120, 170, 200));
    fbox(x + .5, y - .1, fz, x + .7, y + .1, fz + .26, [120, 90, 60], 411);
    footShadow(x - .4, y - .3, x + .4, y + .3, .32);
  }
}
function buildLiving(fz, L) {
  const has = n => L >= n, RLx = RL();
  // light: a lantern at first, brass wall lamps on both walls, string lights, then bright tube lights
  if (L >= 36) { AMB[0] = .76; for (const [a, b] of [[2.4, 1.3], [6.3, 1.3], [RLx - 2.2, 1.3], [1.3, 3.6], [1.3, RLx - 2.6], [RLx * .55, RLx * .55]]) lamp(0, XA(a), yb(b), fz, 5, 3.2, WHITE_T); }
  else if (L >= 4) { AMB[0] = L >= 22 ? .68 : .65; for (const [a, b] of [[3.25, 1.4], [7.2, 1.4], [RLx - 1.5, 1.4], [1.4, 4.3], [1.4, RLx - 2.4]]) lamp(0, XA(a), yb(b), fz, 4.2, 2.8); }
  else { AMB[0] = .64; lamp(0, XA(2.6), yb(1.2), fz, 4.4, 2.8, FIRE_T); }
  vaultCage(fz); storeLamp(0, fz);
  moveInStores(fz, L);
  // beds (levels 1, 3, 5, 8, 12): three along the back wall, two along the front
  for (let i = 0; i < bedsOf(L); i++) bed(i, fz);
  if (!has(4)) lantern(fz);
  if (has(1) && !has(8)) footlocker(fz);
  if (has(4)) wallLamps(fz, has(36));
  if (has(6)) diningTable(fz, has(23));
  if (has(7)) tvCabinet(fz, has(17));
  if (has(10)) stove(fz);
  if (has(11)) bookshelf(fz);
  if (has(14)) lockers(fz);
  if (has(15)) counter(fz);
  if (has(16)) sofa(fz);
  if (has(19)) fridge(fz);
  if (has(20)) plants(fz);
  if (has(21)) posters(fz);
  if (has(22)) stringLights(fz);
  if (has(24)) armchair(fz);
  if (has(25)) punchingBag(fz);
  if (has(26)) wallShelves(fz);
  if (has(27)) medCabinet(fz);
  if (has(29)) shower(fz);
  if (has(31)) pingPong(fz);
  if (has(32)) mapWall(fz);
  if (has(33)) coffeeTable(fz);
  if (has(34)) clothesline(fz);
  if (has(28)) waterCooler(fz);
  if (has(37)) aquarium(fz);
  if (has(38)) arcade(fz);
  if (has(39)) ducts(fz);
  if (has(40)) emblem(fz);
}

/* ================= B2: the farm ================= */
// plan: the work row along the back wall, plots in rows in front of it with an aisle between each (the farmers
// stand in the aisles, see farmSpot), a clear corridor along the rows' left ends, kit on the left wall and along the
// front, the pantry in the front corner. Five forms of eight levels:
// soil beds, wooden planters, grow-light racks, hydroponic tanks, an automated vertical farm. Each level adds a row,
// growth or a machine.
// the plots that fill the room in front of the work row: rows along x with an aisle between each (shorter where
// they would run into the pantry)
function farmRows() {
  const L = RL(), rows = [];
  for (let b0 = 2.3; b0 + .85 <= L - .45 && rows.length < 6; b0 += 1.75) rows.push([XA(2.3), XA(b0 + .85 > L - STORE - .25 ? L - STORE - .35 : L - .45), b0, b0 + .85]);
  return rows;
}
const LEAF_D = [52, 104, 52], LEAF = [78, 140, 62], LEAF_L = [118, 178, 82], LETTUCE = [150, 204, 100];
const R_FSOIL = rampOf([96, 70, 50]), R_BRICK = rampOf([156, 98, 74]), R_WASH = rampOf([212, 206, 190]), R_CONC = rampOf([150, 150, 142]);
const R_GTILE = rampOf([84, 146, 104]), R_WTILE = rampOf([222, 226, 220]), R_EPOXY = rampOf([86, 122, 106]), R_PANEL = rampOf([226, 230, 228]), R_PALLET = rampOf([176, 140, 96]);
const tierStart = L => [1, 9, 17, 25, 33][facTier(L)];
function farmPaint(L, fz) {
  const { x0, y0 } = UG, t = L ? facTier(L) : -1, st = RL() - STORE;
  const wall = (a, z, ix, iy) => {
    if (t <= 0) return earthWall(a, z, ix, iy, 2.6);
    if (t === 1) { const p = ((a + .2) % 2.0 + 2.0) % 2.0; if (p < .16 || z > UG.h - .16 || Math.abs(z - 1.1) < .07) return pick(R_WOOD, 2.4, ix, iy); return pick(R_WASH, 2.4 + nz(a * 2, z * 2) * .9, ix, iy, .5); }
    if (t === 2) return z < 1.05 ? tileAt(a, z, ix, iy, R_GTILE, .3, rgb(60, 100, 72)) : z < 1.12 ? R_GTILE[1] : tileAt(a, z, ix, iy, R_WTILE, .3, rgb(186, 190, 184));
    if (t === 3) return z > .9 && z < 1.05 ? tileAt(a, z, ix, iy, R_GTILE, .15, rgb(60, 100, 72)) : tileAt(a, z, ix, iy, R_WTILE, .25, rgb(176, 182, 176));
    if (Math.abs(z - 2.32) < .03) return glowc(150, 255, 170);
    const pa2 = a / 1.0 - Math.floor(a / 1.0), pz = z / 1.15 - Math.floor(z / 1.15);
    return pa2 < .02 || pz < .03 ? rgb(170, 176, 174) : pick(R_PANEL, 2.7, ix, iy, .3);
  };
  return {
    floor(x, y, ix, iy) {
      const a = x - x0, b = y - y0;
      if (a > st && b > st) return a < st + .12 || b < st + .12 ? hazard(a, b) : (((b / .3) % 1) < .1 ? R_WOOD[1] : pick(R_PALLET, 2.6, ix, iy, .3));
      if (t <= 0) return dirtAt(a, b, ix, iy, t < 0 ? R_SOIL : R_FSOIL);
      if (t === 1) { const r = Math.floor(b / .2), off = (r & 1) * .2, f = ((a + off) / .4) % 1; return f < .08 || (b / .2) % 1 < .12 ? rgb(110, 92, 80) : pick(R_BRICK, 2.3 + hash(Math.floor((a + off) / .4), r) * .9, ix, iy, .4); }
      if (t === 2) { if (Math.abs(b - 1.32) < .07 && (Math.floor(a * 10) & 1)) return rgb(70, 72, 70); return (a % 1.6) < .03 || (b % 1.8) < .03 ? rgb(118, 118, 112) : pick(R_CONC, 2.2 + nz(a * 1.5, b * 1.5) * .9, ix, iy, .5); }
      if (t === 3) return tileAt(a, b, ix, iy, R_WTILE, .4, rgb(170, 176, 170));
      if (Math.abs(b - .98) < .03 || Math.abs(b - 1.78) < .03) return rgb(226, 190, 50);
      return pick(R_EPOXY, 2.6 + nz(a * .8, b * .8) * .5, ix, iy, .3);
    },
    back(x, z, ix, iy) { return wall(x - x0, z - fz, ix, iy); },
    left(y, z, ix, iy) { return wall(y - y0 + 3, z - fz, ix, iy); },
    cap: t >= 2 ? rampOf([200, 204, 200])[2] : t === 1 ? R_WOOD[2] : R_SOILD[2],
  };
}
// little plants made of boxes and pixels: s is the size (about 0.1 to 1)
function crop(kind, x, y, z, s, seed) {
  const h = (n, k = 0) => hash(seed + n, k + 3.3);
  if (s < .25) { const c = rgb(...LEAF_L); pt(x, y, z + .03, c); pt(x + .03, y, z + .06, c); if (s > .15) pt(x - .03, y, z + .07, rgb(...LEAF)); return; }
  if (kind === 'lettuce' || kind === 'cabbage') {
    const w = .06 + s * .07, c = kind === 'lettuce' ? LETTUCE : [120, 170, 140];
    fbox(x - w, y - w, z, x + w, y + w, z + w * 1.1, c, seed);
    fbox(x - w * .55, y - w * .55, z + w * 1.1, x + w * .55, y + w * .55, z + w * 1.5, kind === 'lettuce' ? LEAF_L : [160, 200, 170], seed + 1);
    return;
  }
  if (kind === 'carrot') {
    fbox(x - .05, y - .05, z, x + .05, y + .05, z + .05, [232, 120, 40], seed);
    for (let k = 0; k < 3; k++) fbox(x - .03 + (k - 1) * .04, y - .02, z + .05, x + .01 + (k - 1) * .04, y + .02, z + .1 + s * .25 + h(k) * .05, LEAF, seed + k);
    return;
  }
  if (kind === 'potato') {
    const w = .12 + s * .1;
    fbox(x - w, y - w * .8, z, x + w, y + w * .8, z + .08 + s * .2, LEAF_D, seed);
    fbox(x - w * .6, y - w * .5, z + .08 + s * .2, x + w * .5, y + w * .5, z + .14 + s * .28, LEAF, seed + 1);
    if (s > .5) fbox(x + w, y - .04, z, x + w + .07, y + .04, z + .05, [176, 140, 90], seed + 2);
    return;
  }
  if (kind === 'tomato') {
    const top = .45 + s * .55;
    fbox(x - .015, y - .015, z, x + .015, y + .015, z + top + .1, [150, 120, 80], seed);
    for (let k = 0; k < 4; k++) { const zz = z + .15 + k * top / 4.2, o = (k & 1 ? 1 : -1) * .06; fbox(x + o - .07, y - .06, zz, x + o + .07, y + .06, zz + .1, k & 1 ? LEAF : LEAF_D, seed + k); }
    if (s > .3) for (let k = 0; k < 1 + Math.floor(s * 3); k++) { const zz = z + .2 + h(k, 1) * top * .8, o = (h(k, 2) - .5) * .18; fbox(x + o - .035, y + .05, zz, x + o + .035, y + .11, zz + .07, [214, 50, 40], seed + 9 + k); }
    return;
  }
  if (kind === 'straw') {
    fbox(x - .08, y - .06, z, x + .08, y + .06, z + .07 + s * .06, LEAF, seed);
    if (s > .3) { pt(x + .06, y + .07, z + .04, rgb(226, 40, 50)); pt(x - .05, y + .07, z + .02, rgb(226, 40, 50)); }
    return;
  }
  if (kind === 'herb') { for (let k = 0; k < 3; k++) fbox(x - .04 + k * .04 - .02, y - .02, z, x - .04 + k * .04 + .02, y + .02, z + .1 + s * .2 * (1 - k % 2 * .3), k % 2 ? LEAF_L : LEAF, seed + k); return; }
  // a leafy green on a raft or tray
  const w = .06 + s * .08;
  fbox(x - w, y - w, z, x + w, y + w, z + w * 1.2, LEAF, seed);
  fbox(x - w * .5, y - w * .5, z + w * 1.2, x + w * .5, y + w * .5, z + w * 1.7, LEAF_L, seed + 1);
}
// a raised soil bed: plank edges, tilled soil with furrows, crops in lines
function soilBed(x0, x1, b0, b1, fz, kind, s, seed) {
  const y0 = yb(b0), y1 = yb(b1), h = .2;
  fbox(x0, y0, fz, x1, y1, fz + h, PLANKS, seed);
  onZ(fz + h, x0 + .05, y0 + .05, x1 - .05, y1 - .05, (x, y, ix, iy) => pick(R_FSOIL, ((y - y0) / .24 % 1) < .35 ? 1.4 : 2.4, ix, iy, .4));
  if (!kind) { footShadow(x0, y0, x1, y1, h); return; }
  const rows = Math.max(1, Math.floor((b1 - b0 - .1) / .26));
  for (let r = 0; r < rows; r++) for (let x = x0 + .16; x < x1 - .08; x += .28) crop(kind, x + (r & 1) * .1, y0 + .14 + r * .26, fz + h, s, seed + Math.floor(x * 9) + r * 31);
  footShadow(x0, y0, x1, y1, h);
}
// a wooden planter trough on legs
function planter(x0, x1, b0, b1, fz, kind, s, seed, legH = .42) {
  const y0 = yb(b0), y1 = yb(b1);
  for (let x = x0; x < x1 - .05; x += Math.max(.5, (x1 - x0 - .1) / Math.ceil((x1 - x0) / 1.4))) { fbox(x, y0 + .04, fz, x + .08, y0 + .12, fz + legH, WOOD_D, seed); fbox(x, y1 - .12, fz, x + .08, y1 - .04, fz + legH, WOOD_D, seed); }
  fbox(x1 - .08, y0 + .04, fz, x1, y0 + .12, fz + legH, WOOD_D, seed); fbox(x1 - .08, y1 - .12, fz, x1, y1 - .04, fz + legH, WOOD_D, seed);
  fbox(x0, y0, fz + legH, x1, y1, fz + legH + .32, PLANK, seed + 1);
  onY(y1, x0, x1, fz + legH, fz + legH + .32, (x, z) => Math.abs(z - fz - legH - .16) < .015 || ((x - x0) % 1.2) < .03 ? R_WOOD[1] : 0);
  onZ(fz + legH + .32, x0 + .05, y0 + .05, x1 - .05, y1 - .05, (x, y, ix, iy) => pick(R_FSOIL, 2, ix, iy));
  const rows = Math.max(1, Math.floor((b1 - b0 - .06) / .3));
  for (let r = 0; r < rows; r++) for (let x = x0 + .18; x < x1 - .1; x += .3) crop(kind, x + (r & 1) * .1, y0 + .15 + r * .3, fz + legH + .32, s, seed + Math.floor(x * 9) + r * 31);
  footShadow(x0, y0, x1, y1, legH + .3);
}
// a steel rack with trays of greens and pink grow lights under each shelf
function growRack(x0, x1, b0, b1, fz, shelves, s, seed) {
  const y0 = yb(b0), y1 = yb(b1), top = .2 + shelves * .62, steel = [176, 182, 188];
  for (let x = x0; x <= x1 - .05; x += (x1 - x0 - .05) / Math.max(1, Math.round((x1 - x0) / 1.6))) for (const y of [y0, y1 - .05]) fbox(x, y, fz, x + .05, y + .05, fz + top, steel, seed);
  for (let k = 0; k < shelves; k++) {
    const z = fz + .2 + k * .62;
    fbox(x0, y0, z - .04, x1, y1, z, steel, seed + k);
    fbox(x0 + .06, y0 + .06, z, x1 - .06, y1 - .06, z + .06, [70, 74, 80], seed + k);
    for (let x = x0 + .15; x < x1 - .08; x += .22) crop('green', x, (y0 + y1) / 2, z + .06, s * (.7 + hash(x * 7 | 0, k) * .3), seed + Math.floor(x * 13) + k);
    EM = 1; fbox(x0 + .08, (y0 + y1) / 2 - .04, z + .5, x1 - .08, (y0 + y1) / 2 + .04, z + .54, [255, 120, 230], seed); EM = 0;
  }
  fbox(x0, y0, fz + top - .04, x1, y1, fz + top, steel, seed + 9);
  footShadow(x0, y0, x1, y1, top);
}
// a hydroponic tank: white tub, blue water, white floating rafts holding greens in a grid
function hydroTank(x0, x1, b0, b1, fz, s, seed, bubbles) {
  const y0 = yb(b0), y1 = yb(b1), h = .62;
  sbox(x0, y0, fz, x1, y1, fz + h, [226, 230, 228], seed);
  onY(y1, x0, x1, fz, fz + h, (x, z) => Math.abs(z - fz - h + .1) < .02 ? rgb(90, 160, 120) : 0);
  EM = 1; onZ(fz + h - .04, x0 + .05, y0 + .05, x1 - .05, y1 - .05, (x, y) => bubbles && hash(Math.floor(x * 30), Math.floor(y * 30)) > .9 ? glowc(220, 245, 255) : glowc(70, 150, 200)); EM = 0;
  for (let x = x0 + .12; x < x1 - .2; x += .5) {
    fbox(x, y0 + .08, fz + h - .04, x + .42, y1 - .08, fz + h, [236, 236, 230], seed + 1, .3);
    for (let px = x + .1; px < x + .42; px += .21) for (let py = y0 + .2; py < y1 - .1; py += .22) crop('green', px, py, fz + h, s, seed + Math.floor(px * 17 + py * 5));
  }
  footShadow(x0, y0, x1, y1, h);
}
// a vertical grow tower: a white frame to the ceiling, stacked trays, LED strips between
function tower(x0, x1, b0, b1, fz, s, seed, top = 2.3) {
  const y0 = yb(b0), y1 = yb(b1);
  for (const [x, y] of [[x0, y0], [x1 - .05, y0], [x0, y1 - .05], [x1 - .05, y1 - .05]]) sbox(x, y, fz, x + .05, y + .05, fz + top, [232, 234, 236], seed);
  for (let z = .15; z < top - .2; z += .38) {
    sbox(x0 + .03, y0 + .03, fz + z, x1 - .03, y1 - .03, fz + z + .06, [210, 214, 216], seed + 1);
    for (let x = x0 + .1; x < x1 - .05; x += .17) crop('green', x, (y0 + y1) / 2 + .05, fz + z + .06, s * (.8 + hash(x * 9 | 0, z * 9 | 0) * .2), seed + Math.floor(x * 13 + z * 7));
    EM = 1; fbox(x0 + .06, y1 - .06, fz + z + .3, x1 - .06, y1 - .03, fz + z + .33, [200, 255, 220], seed + 2); EM = 0;
  }
  sbox(x0, y0, fz + top, x1, y1, fz + top + .06, [196, 200, 204], seed + 3);
  footShadow(x0, y0, x1, y1, top);
}
// a hose from a, down to the floor, along it, and up to b, so the corridor it crosses stays walkable
function floorHose(a, b, c) {
  const f = FLOOR_Z[1] + .02, p = [a[0] + .06, a[1], f], q = [b[0] - .1, b[1], f];
  ln(a, p, c); ln(p, q, c); ln(q, b, c);
}
function wateringCan(x, y, fz, c = [70, 140, 90]) {
  sbox(x - .12, y - .08, fz, x + .12, y + .08, fz + .2, c, 400);
  sbox(x + .12, y - .02, fz + .08, x + .26, y + .02, fz + .12, c, 401); sbox(x + .22, y - .03, fz + .12, x + .27, y + .03, fz + .2, c, 402);
  sbox(x - .1, y - .02, fz + .2, x + .06, y + .02, fz + .26, c, 403);
  footShadow(x - .12, y - .08, x + .12, y + .08, .2);
}
function sack(x, y, fz, c = [196, 170, 120], h = .38, seed = 410, mark) {
  fbox(x - .16, y - .13, fz, x + .16, y + .13, fz + h, c, seed);
  fbox(x - .1, y - .08, fz + h, x + .1, y + .08, fz + h + .06, c, seed + 1);
  fbox(x - .04, y - .03, fz + h + .06, x + .04, y + .03, fz + h + .1, [150, 120, 80], seed + 2);
  if (mark) onY(y + .13, x - .08, x + .08, fz + .1, fz + .26, mark);
  footShadow(x - .16, y - .13, x + .16, y + .13, h);
}
function barrel(x, y, fz, c, h = .8, seed = 420) {
  sbox(x - .2, y - .2, fz, x + .2, y + .2, fz + h, c, seed);
  for (const z of [.12, h - .16]) sbox(x - .21, y - .21, fz + z, x + .21, y + .21, fz + z + .05, [70, 74, 80], seed + 1);
  footShadow(x - .2, y - .2, x + .2, y + .2, h);
}
function crateOf(x, y, z, w, fill, seed, wood = PLANK) {
  fbox(x - w, y - w, z, x + w, y + w, z + w * 1.4, wood, seed);
  onY(y + w, x - w, x + w, z, z + w * 1.4, (xx, zz) => Math.abs(zz - z - w * .7) < .02 || Math.abs(xx - x) < .015 ? R_WOOD[1] : 0);
  onX(x + w, y - w, y + w, z, z + w * 1.4, (yy, zz) => Math.abs(zz - z - w * .7) < .02 ? R_WOOD[0] : 0);
  if (fill) for (let k = 0; k < 4; k++) { const fx = x - w * .5 + (k & 1) * w, fy = y - w * .5 + (k >> 1) * w * .9; fbox(fx - w * .38, fy - w * .38, z + w * 1.4, fx + w * .38, fy + w * .38, z + w * 1.4 + w * .5, fill, seed + k); }
  footShadow(x - w, y - w, x + w, y + w, w * 1.4);
}
function screenPanel(x0, x1, y, z0, z1, seed, kind = 0) {
  // a dark panel with a glowing screen on its front
  sbox(x0, y, z0, x1, y + .12, z1, [60, 64, 72], seed);
  EM = 1;
  onY(y + .12, x0 + .05, x1 - .05, z0 + .06, z1 - .06, (x, z) => {
    const u = (x - x0) / (x1 - x0), v = (z - z0) / (z1 - z0), r = Math.floor(v * 6), c = Math.floor(u * 10);
    if (kind === 1) return v < .3 + Math.sin(u * 9 + seed) * .12 ? glowc(90, 230, 140) : glowc(16, 40, 30);
    return hash(c + seed, r) > .45 ? glowc(110, 255, 160) : glowc(18, 42, 34);
  });
  EM = 0;
}
function buildFarmFloor(fz, L) {
  const t = L ? facTier(L) : 0, s0 = tierStart(L || 1), g = L ? Math.min(1, (L - s0 + 1) / 8) : 0, has = n => L >= n, inT = n => L >= n && facTier(n) === t;
  const RLx = RL(), lampsAt = [[3.4, 1.4], [7.2, 1.4], [RLx - 1.4, 1.4], [1.4, 4.2], [1.4, RLx - 2.4]], rows = farmRows(), fy = b => yb(RLx - b);
  if (!L) { for (const [a, b] of lampsAt) lamp(1, XA(a), yb(b), fz); rubbleAt(fz, 1); return; }
  // light: warm bulbs on soil and planters, pink grow light on the racks, clean white later
  AMB[1] = [.63, .65, .64, .7, .74][t];
  storeLamp(1, fz);
  if (t === 2) { for (const [a, b] of lampsAt) lamp(1, XA(a), yb(b), fz, 3.6, 2.4, PINK_T); for (const r of rows) lamp(1, (r[0] + r[1]) / 2, yb(r[2] + .4), fz, 4, 1.4, PINK_T); }
  else for (const [a, b] of lampsAt) lamp(1, XA(a), yb(b), fz, t >= 3 ? 5 : 4.2, t >= 3 ? 3.2 : 2.8, t >= 3 ? WHITE_T : WARM_T);
  if (t <= 1) { for (const [a] of lampsAt.slice(0, 3)) wallLamp(XA(a), UG.y0, fz + 2.12); for (const [, b] of lampsAt.slice(3)) wallLampX(yb(b), UG.x0, fz + 2.12); }
  const a0 = XA(2.0), a1 = XA(RLx - .4);
  if (t === 0) {
    // the work row, then a row in front every other level: lettuce, carrots, potatoes
    soilBed(a0, a1, .1, .92, fz, L >= 2 ? 'lettuce' : 'green', g, 500);
    // every plot is dug from the start; a row is planted every other level: lettuce, carrots, potatoes
    const kinds = [['lettuce', 3], ['carrot', 5], ['potato', 7]];
    rows.forEach(([xa, xb, b0, b1], r) => soilBed(xa, xb, b0, b1, fz, kinds[r] && has(kinds[r][1]) ? kinds[r][0] : null, g * .8 + .2, 520 + r * 20));
    if (inT(2)) { wateringCan(XA(.55), yb(2.15), fz); fbox(XA(.1), yb(1.95), fz, XA(.1) + .22, yb(1.95) + .22, fz + .22, [120, 124, 130], 404); }
    if (inT(4)) { const seed = (x, z) => Math.abs(x) < .05 && Math.abs(z - .06) < .05 ? rgb(90, 140, 60) : 0; sack(UG.x0 + .3, yb(2.85), fz, [196, 170, 120], .38, 411, (x, z) => seed(x - UG.x0 - .3, z - fz - .12)); sack(UG.x0 + .3, yb(3.25), fz, [180, 156, 104], .32, 413); sack(UG.x0 + .68, yb(3.1), fz, [204, 184, 136], .3, 415, (x, z) => seed(x - UG.x0 - .68, z - fz - .1)); }
    if (inT(6)) { const x = XA(.15), y = yb(4.3); fbox(x, y, fz, x + .8, y + .7, fz + .55, WOOD, 430); onY(y + .7, x, x + .8, fz, fz + .55, (xx, z) => ((z - fz) % .14) < .04 ? R_WOOD[0] : 0); onZ(fz + .55, x + .05, y + .05, x + .75, y + .65, (xx, yy, ix, iy) => pick(R_SOILD, 1.5 + hash(ix, iy) * 1.5, ix, iy)); footShadow(x, y, x + .8, y + .7, .55); }
    if (inT(8)) { barrel(XA(.45), yb(5.9), fz, [80, 110, 140], .8, 431); barrel(XA(.45), yb(6.45), fz, [90, 120, 150], .7, 432); }
  } else if (t === 1) {
    planter(a0, a1, .1, .86, fz, 'herb', g, 600, .3);
    const kinds = ['lettuce', has(11) ? 'tomato' : 'carrot', 'cabbage', 'straw', 'herb', 'lettuce'];
    rows.forEach(([xa, xb, b0, b1], r) => planter(xa, xb, b0, b1, fz, kinds[r], g * .7 + .3, 620 + r * 20));
    if (inT(10)) { const x = a1 + .05; sbox(x, UG.y0, fz + .5, x + .3, UG.y0 + .16, fz + .95, [60, 120, 70], 440); onY(UG.y0 + .16, x + .04, x + .26, fz + .55, fz + .9, (xx, z) => ((z - fz) % .08) < .03 ? rgb(40, 90, 50) : 0); ln([x + .1, UG.y0 + .17, fz + .55], [a1 - .1, yb(.87), fz + .62], rgb(60, 140, 70)); ln([a0, yb(.87), fz + .62], [a1, yb(.87), fz + .62], rgb(60, 140, 70)); for (let x2 = a0 + .3; x2 < a1; x2 += .6) pt(x2, yb(.88), fz + .58, glowc(120, 190, 255)); }
    if (inT(12)) { const x = XA(.2), y = yb(7.3); for (const [lx, ly] of [[x, y], [x + 1.0, y], [x, y + .5], [x + 1.0, y + .5]]) fbox(lx, ly, fz, lx + .06, ly + .06, fz + .72, WOOD_D, 450); fbox(x, y, fz + .72, x + 1.06, y + .56, fz + .78, PLANK, 451); for (let k = 0; k < 4; k++) { fbox(x + .1 + k * .24, y + .15, fz + .78, x + .26 + k * .24, y + .31, fz + .92, [190, 100, 66], 452 + k); crop('herb', x + .18 + k * .24, y + .23, fz + .92, .5, 455 + k); } sack(x + .2, y + .7, fz, [140, 110, 80], .3, 459); }
    if (inT(13)) { const z = fz + 1.55; sbox(a0 + .3, UG.y0, z + .3, a1 - .3, UG.y0 + .1, z + .34, METAL, 460); for (let x = a0 + .6; x < a1 - .4; x += .9) { ln([x + .1, UG.y0 + .2, z + .1], [x + .1, UG.y0 + .06, z + .32], rgb(90, 90, 96)); fbox(x, UG.y0 + .12, z - .06, x + .2, UG.y0 + .3, z + .1, [196, 104, 70], 461); crop('straw', x + .1, UG.y0 + .22, z + .1, .9, 462 + x * 3); fbox(x + .02, UG.y0 + .25, z - .2, x + .1, UG.y0 + .3, z - .06, LEAF, 463); pt(x + .06, UG.y0 + .31, z - .16, rgb(226, 40, 50)); } }
    if (inT(14)) { const y = yb(3.0), z = fz + 1.45, x = UG.x0; sbox(x, y, z, x + .2, y + .6, z + .6, [190, 194, 198], 470); onX(x + .2, y + .04, y + .56, z + .04, z + .56, (yy, zz) => { const u = (yy - y - .3) / .26, v = (zz - z - .3) / .26; return Math.abs(u) > .9 || Math.abs(v) > .9 ? 0 : Math.abs(u) < .14 || Math.abs(v) < .14 || Math.abs(u - v) < .1 ? rgb(70, 74, 80) : (Math.floor((yy + zz) * 40) & 1) ? rgb(120, 126, 132) : 0; }); }
    if (inT(15)) { const x = XA(.15), y = yb(5.4); sbox(x, y, fz, x + .72, y + .7, fz + 1.35, [70, 120, 170], 480); sbox(x + .26, y + .25, fz + 1.35, x + .46, y + .45, fz + 1.42, [50, 90, 130], 481); onY(y + .7, x + .04, x + .68, fz + .1, fz + 1.3, (xx, z) => ((z - fz) % .3) < .03 ? rgb(50, 90, 130) : 0); sbox(x + .3, y + .7, fz + .2, x + .38, y + .82, fz + .28, METAL, 482); footShadow(x, y, x + .72, y + .7, 1.35); }
    if (inT(16)) { crateOf(XA(3.0), fy(.6), fz, .2, [214, 50, 40], 490); crateOf(XA(3.45), fy(.55), fz, .2, LETTUCE, 491); crateOf(XA(3.22), fy(.58), fz + .56, .19, [232, 120, 40], 492); crateOf(XA(3.9), fy(.6), fz, .2, [176, 140, 90], 493); }
  } else if (t === 2) {
    growRack(a0, a1, .06, .74, fz, 3, g * .6 + .4, 700);
    rows.forEach(([xa, xb, b0, b1], r) => growRack(xa, xb, b0 + .05, b1 - .1, fz, 1, g * .6 + .4, 720 + r * 9));
    if (inT(18)) for (const [xa, xb, b0] of rows) { const yy = yb(b0 + .35); for (const x of [xa + .2, xb - .2]) ln([x, yy, fz + UG.h], [x, yy, fz + 1.6], rgb(60, 60, 66)); EM = 1; fbox(xa + .1, yy - .04, fz + 1.5, xb - .1, yy + .04, fz + 1.56, [190, 120, 255], 730); EM = 0; sbox(xa + .1, yy - .06, fz + 1.56, xb - .1, yy + .06, fz + 1.6, [60, 60, 70], 731); }
    if (inT(19)) { const x = UG.x0 + .3, y = yb(2.6); for (const [lx, ly] of [[x, y], [x + .62, y], [x, y + .5], [x + .62, y + .5]]) sbox(lx, ly, fz + .05, lx + .05, ly + .05, fz + .9, METAL, 740); for (const z of [.3, .62, .9]) { sbox(x, y, fz + z, x + .67, y + .55, fz + z + .04, METAL, 741); fbox(x + .05, y + .06, fz + z + .04, x + .62, y + .49, fz + z + .08, [60, 50, 44], 742); for (let k = 0; k < 6; k++) crop('green', x + .12 + (k % 3) * .2, y + .16 + (k > 2) * .22, fz + z + .08, .3, 743 + k + z * 9); } for (const [lx, ly] of [[x, y], [x + .62, y + .5]]) sbox(lx - .02, ly - .02, fz, lx + .07, ly + .07, fz + .05, DARK, 744); }
    if (inT(20)) { const x = XA(.3), y = yb(7.5); sbox(x, y, fz, x + .44, y + .44, fz + .62, [236, 238, 240], 750); sbox(x + .14, y + .14, fz + .62, x + .3, y + .3, fz + .7, [150, 200, 230], 751); EM = 1; onY(y + .44, x + .1, x + .2, fz + .4, fz + .46, glowc(80, 220, 255)); EM = 0; for (let k = 0; k < 7; k++) pt(x + .22 + (hash(k, 1) - .5) * .3, y + .22 + (hash(k, 2) - .5) * .2, fz + .78 + k * .07, rgb(226, 240, 250)); footShadow(x, y, x + .44, y + .44, .62); }
    if (inT(21)) { const x = UG.x0 + .02, y = yb(4.1); sbox(x, y, fz, x + .4, y + .9, fz + 1.7, [70, 60, 54], 760); for (const z of [.3, .7, 1.1, 1.5]) { sbox(x, y, fz + z - .03, x + .4, y + .9, fz + z, [96, 84, 72], 761); for (let k = 0; k < 4; k++) { const my = y + .12 + k * .2; fbox(x + .15, my - .03, fz + z, x + .22, my + .03, fz + z + .07, [226, 220, 200], 762); fbox(x + .1, my - .08, fz + z + .07, x + .27, my + .08, fz + z + .11, [196, 150, 100], 763 + k); } } footShadow(x, y, x + .4, y + .9, 1.7); }
    if (inT(22)) { const x = XA(.15), yy = yb(5.6); [[0, [70, 120, 200]], [.42, [90, 170, 90]], [.84, [220, 190, 60]]].forEach(([o, c], k) => { sbox(x, yy + o, fz, x + .34, yy + o + .34, fz + .62, c, 770 + k); sbox(x + .12, yy + o + .12, fz + .62, x + .22, yy + o + .22, fz + .7, [236, 236, 236], 773 + k); floorHose([x + .34, yy + o + .17, fz + .3], [XA(2.3), yb(2.6 + k * 1.75), fz + .9], rgb(200, 200, 204)); footShadow(x, yy + o, x + .34, yy + o + .34, .62); }); }
    if (inT(23)) { const x = UG.x0, q = 6.6; sbox(x, yb(q), fz + 1.15, x + .12, yb(q + .7), fz + 1.8, [60, 64, 72], 780); EM = 1; onX(x + .12, yb(q + .06), yb(q + .4), fz + 1.4, fz + 1.72, (y, z) => hash(Math.floor((y - yb(q + .06)) * 30), Math.floor((z - fz) * 30)) > .45 ? glowc(110, 255, 160) : glowc(18, 42, 34)); for (let k = 0; k < 3; k++) pt(x + .13, yb(q + .5) + k * .06, fz + 1.3, glowc(...[[255, 80, 60], [255, 210, 80], [100, 255, 120]][k])); EM = 0; }
    if (inT(24)) { const x = XA(2.8), y = fy(1.0); for (const [lx, ly] of [[x, y], [x + 1.1, y], [x, y + .5], [x + 1.1, y + .5]]) sbox(lx, ly, fz, lx + .05, ly + .05, fz + .7, METAL, 790); sbox(x, y, fz + .7, x + 1.15, y + .55, fz + .75, [200, 204, 208], 791); for (let k = 0; k < 3; k++) { sbox(x + .08 + k * .36, y + .08, fz + .75, x + .38 + k * .36, y + .46, fz + .86, [[70, 120, 200], [200, 80, 60], [90, 170, 90]][k], 792 + k); for (let j = 0; j < 3; j++) fbox(x + .12 + k * .36 + j * .08, y + .16 + (j & 1) * .1, fz + .86, x + .19 + k * .36 + j * .08, y + .23 + (j & 1) * .1, fz + .92, [[150, 204, 100], [214, 50, 40], [232, 120, 40]][k], 795 + k * 3 + j); } }
  } else if (t === 3) {
    hydroTank(a0, a1, .1, .88, fz, g * .6 + .4, 800, has(28));
    rows.forEach(([xa, xb, b0, b1], r) => hydroTank(xa, xb, b0, b1 - .05, fz, g * .6 + .4, 820 + r * 20, has(28)));
    if (inT(26)) { for (const z of [1.25, 1.45]) { sbox(a0, UG.y0, fz + z, a1, UG.y0 + .1, fz + z + .08, z > 1.3 ? [226, 230, 232] : [80, 140, 200], 830); } for (let x = a0 + .5; x < a1; x += 2.2) sbox(x, UG.y0, fz + .55, x + .08, UG.y0 + .1, fz + 1.25, [226, 230, 232], 831); for (const [xa, , b0, b1] of rows) sbox(xa - .12, yb(b0 + .1), fz + .3, xa, yb(b1 - .1), fz + .4, [80, 140, 200], 832); sbox(XA(2.05), yb(1.95), fz + .02, XA(2.15), yb(rows[rows.length - 1][3]), fz + .1, [80, 140, 200], 833); }
    if (inT(27)) { const x = UG.x0 + .1, y = yb(3.0); sbox(x, y, fz, x + .6, y + .5, fz + .1, DARK, 840); sbox(x + .05, y + .05, fz + .1, x + .45, y + .45, fz + .45, [60, 110, 170], 841); sbox(x + .45, y + .15, fz + .15, x + .6, y + .35, fz + .35, [180, 186, 192], 842); for (let z = .14; z < .44; z += .06) onX(x + .45, y + .05, y + .45, fz + z, fz + z + .02, rgb(40, 70, 110)); EM = 1; pt(x + .25, y + .46, fz + .35, glowc(120, 255, 140)); EM = 0; footShadow(x, y, x + .6, y + .5, .45); }
    if (inT(28)) { const x = XA(.25), y = yb(4.4); sbox(x, y, fz, x + .4, y + .3, fz + .3, [90, 96, 104], 850); for (let k = 0; k < 3; k++) floorHose([x + .1 + k * .1, y + .3, fz + .2], [XA(2.3), yb(2.6 + k * 1.75), fz + .6], rgb(220, 226, 230)); }
    if (inT(29)) { const x = UG.x0 + .12; for (let k = 0; k < 3; k++) { const y = yb(5.5) + k * .28; sbox(x, y, fz, x + .24, y + .24, fz + .9, [196, 206, 214], 860 + k); sbox(x + .02, y + .02, fz + .9, x + .22, y + .22, fz + .96, [60, 110, 170], 863); onY(y + .24, x + .04, x + .2, fz + .2, fz + .7, (xx, z) => ((z - fz) % .1) < .02 ? rgb(150, 160, 170) : 0); } footShadow(x, yb(5.5), x + .24, yb(6.34), .9); }
    if (inT(30)) { const x = XA(2.6), y = fy(.95); sbox(x, y, fz, x + 1.5, y + .62, fz + .3, DARK, 870); EM = 1; fbox(x + .04, y + .04, fz + .3, x + 1.46, y + .58, fz + .74, [80, 160, 210], 871, .4); onY(y + .58, x + .06, x + 1.44, fz + .32, fz + .72, (xx, z) => { const u = (xx - x) / 1.5, v = (z - fz - .32) / .4, h = hash(Math.floor(u * 22), Math.floor(v * 8)); return v < .1 ? glowc(214, 196, 150) : h > .9 ? glowc(255, 150, 40) : h > .86 ? glowc(255, 220, 120) : 0; }); EM = 0; sbox(x, y, fz + .74, x + 1.5, y + .62, fz + .78, DARK, 872); lamp(1, x + .75, y + .9, fz + .3, 1.6, 1.1, CYAN_T); footShadow(x, y, x + 1.5, y + .62, .78); }
    if (inT(31)) { const x = UG.x0, y = yb(7.2); sbox(x, y, fz + 1.4, x + .45, y + 1.0, fz + 2.2, [190, 194, 198], 880); onX(x + .45, y + .08, y + .92, fz + 1.5, fz + 2.1, (yy, z) => (Math.floor((z - fz) * 24) & 1) ? rgb(110, 116, 122) : 0); for (const yy of [y + .1, y + .9]) sbox(x + .3, yy - .03, fz + 1.2, x + .36, yy + .03, fz + 1.4, METAL, 881); }
    if (inT(32)) { const x = XA(.2), y = yb(8.7); sbox(x, y, fz, x + .9, y + .5, fz + .72, [200, 204, 208], 890); sbox(x + .04, y + .05, fz + .72, x + .86, y + .45, fz + .76, [70, 74, 80], 891); screenPanel(x + .08, x + .44, y + .1, fz + .76, fz + 1.12, 892, 1); screenPanel(x + .48, x + .84, y + .1, fz + .76, fz + 1.12, 893); fbox(x + .2, y + .3, fz + .76, x + .6, y + .42, fz + .79, DARK, 894); footShadow(x, y, x + .9, y + .5, .72); }
  } else {
    for (let k = 0, n = 9; k < n; k++) { const p = a0 + k * (a1 - a0) / n; tower(p + .04, p + (a1 - a0) / n - .06, .08, .7, fz, g * .5 + .5, 900 + k); }
    rows.forEach(([xa, xb, b0, b1], r) => { const n = Math.max(1, Math.round((xb - xa) / .95)); for (let k = 0; k < n; k++) { const p = xa + k * (xb - xa) / n; tower(p + .04, p + (xb - xa) / n - .08, b0 + .1, b1 - .1, fz, g * .5 + .5, 920 + k + r * 13, .92); } });
    lamp(1, XA(RLx / 2), yb(RLx / 2), fz, 6, 4, GREEN_T);
    if (inT(34)) { const z = fz + 2.36; sbox(a0, yb(.95), z, a1, yb(1.05), z + .08, [226, 190, 50], 940); const x = XA(4.4); sbox(x - .15, yb(.88), z - .2, x + .15, yb(1.12), z, [60, 64, 72], 941); sbox(x - .05, yb(.95), z - .75, x + .05, yb(1.05), z - .2, [236, 190, 60], 942); sbox(x - .05, yb(.6), z - .82, x + .05, yb(1.0), z - .72, [236, 190, 60], 943); sbox(x - .08, yb(.52), z - .95, x + .08, yb(.64), z - .78, [70, 74, 80], 944); EM = 1; pt(x, yb(1.06), z - .3, glowc(255, 80, 60)); EM = 0; }
    if (inT(35)) { const y0 = fy(.75), y1 = fy(.3), xa = XA(2.3), xb = XA(RLx - STORE) - .1; for (let x = xa; x < xb; x += .6) sbox(x, y0 + .05, fz, x + .06, y1 - .05, fz + .4, METAL, 950); sbox(xa, y0, fz + .4, xb, y1, fz + .48, [70, 74, 80], 951); onZ(fz + .48, xa, y0 + .04, xb, y1 - .04, (x, y) => ((x - xa) % .2) < .03 ? rgb(40, 42, 48) : rgb(90, 94, 100)); for (let x = xa + .4; x < xb - .4; x += 1.1) crateOf(x, (y0 + y1) / 2, fz + .48, .16, LETTUCE, 952 + x * 3, [200, 160, 100]); }
    if (inT(36)) { const x = XA(1.2), y = fy(1.05); sbox(x, y, fz, x + .95, y + .75, fz + 1.05, [200, 206, 210], 960); EM = 1; onY(y + .75, x + .1, x + .4, fz + .6, fz + .9, (xx, z) => glowc(...((Math.floor((xx - x) * 30) + Math.floor((z - fz) * 30)) & 1 ? [110, 230, 255] : [30, 60, 90]))); pt(x + .7, y + .75, fz + .8, glowc(120, 255, 120)); pt(x + .8, y + .75, fz + .8, glowc(255, 90, 80)); EM = 0; onY(y + .75, x + .2, x + .8, fz + .25, fz + .45, rgb(40, 42, 48)); footShadow(x, y, x + .95, y + .75, 1.05); }
    if (inT(37)) { const x = XA(5.5), y = fy(1.4); sbox(x, y, fz + .1, x + .5, y + .38, fz + .42, [236, 238, 240], 970); for (const [wx, wy] of [[x + .04, y - .02], [x + .38, y - .02], [x + .04, y + .32], [x + .38, y + .32]]) fbox(wx, wy, fz, wx + .08, wy + .08, fz + .12, DARK, 971); fbox(x + .08, y + .06, fz + .42, x + .42, y + .32, fz + .58, [200, 160, 100], 972); for (let k = 0; k < 3; k++) crop('lettuce', x + .16 + k * .1, y + .19, fz + .58, .4, 973 + k); EM = 1; onY(y + .38, x + .08, x + .2, fz + .26, fz + .32, glowc(110, 230, 255)); EM = 0; footShadow(x, y, x + .5, y + .38, .58); }
    if (inT(38)) { EM = 1; onX(UG.x0 + .01, yb(1.8), yb(4.6), fz + .35, fz + 2.2, (y, z) => { const c = Math.floor((y - yb(1.8)) / .16), r = Math.floor((z - fz) / .16); return ((y - yb(1.8)) % .16) < .03 || ((z - fz) % .16) < .03 ? glowc(40, 50, 60) : hash(c, r) > .5 ? glowc(255, 110, 220) : glowc(160, 90, 255); }); EM = 0; lamp(1, UG.x0 + .6, yb(2.2), fz + .5, 2, 2, PINK_T); }
    if (inT(39)) { const x = XA(.15), y = yb(5.2); sbox(x, y, fz, x + .7, y + .66, fz + 1.85, [210, 216, 220], 990); EM = 1; onY(y + .66, x + .06, x + .64, fz + .1, fz + 1.75, (xx, z) => { const zz = (z - fz) % .42, u = (xx - x) / .7; if (Math.abs(u - .5) < .02 || zz < .04) return glowc(150, 180, 190); return zz < .16 ? glowc(...[[150, 204, 100], [214, 50, 40], [232, 120, 40]][Math.floor((z - fz) / .42) % 3]) : glowc(180, 230, 255); }); EM = 0; lamp(1, x + .35, y + 1.0, fz + .5, 1.5, 1.1, CYAN_T); footShadow(x, y, x + .7, y + .66, 1.85); }
    if (inT(40)) { const x = XA(.25), y = yb(6.8); sbox(x, y, fz, x + .58, y + .5, fz + .8, [60, 64, 72], 995); sbox(x - .1, y + .1, fz + .8, x + .68, y + .4, fz + .84, [44, 46, 52], 996); screenPanel(x - .1, x + .68, y + .02, fz + .84, fz + 1.62, 997, 1); EM = 1; for (let k = 0; k < 3; k++) fbox(x - .05 + k * .26, y + .14, fz + 1.66, x + .15 + k * .26, y + .18, fz + 1.72, [[110, 255, 160], [255, 200, 80], [120, 200, 255]][k], 998 + k); EM = 0; EM = 1; for (let k = 0; k < 5; k++) pt(x + .05 + k * .1, y + .51, fz + .7, glowc(...[[255, 80, 80], [255, 220, 80], [100, 255, 120], [100, 200, 255], [255, 120, 220]][k])); EM = 0; footShadow(x, y, x + .55, y + .5, .8); }
  }
}

/* ================= B3: the mine ================= */
// plan: the miners work the rock at the walls (see mineSpot): two bays in the left wall and three places on the
// back wall, and the strips along those two walls stay clear, so every walk from the ladder is short and straight.
// The machines stand in the middle (the drill over the pit) and on the right, the rails run along the front edge
// into the ore store in the front corner. What stands where comes from each part's stage: MINE_ART at the end.
// the rails run along x near the front, from the left wall to the ore store; railB gives their two edges (b)
const railB = () => [RL() - 1.95, RL() - 1.65];
const MINE_POSTS = [2.3, 3.72, 5.17, 6.62, 8.07, 9.52, 10.97];
// the two rock pillars (centres, a and b): one against the left wall near the front, one on the right, out of the
// way of every walk from the ladder and of the workers seen behind them
const MINE_PILLARS = () => [[.45, RL() - 3.0], [RL() * .86, RL() * .28]];
const R_ROCK = rampOf([112, 106, 102]), R_ROCKD = rampOf([86, 80, 80]), R_ORE = rampOf([84, 136, 210]), R_CRYS = rampOf([120, 220, 255]), R_SHOT = rampOf([150, 150, 146]), R_GRATE = rampOf([110, 116, 122]);
const RUST = [128, 72, 50], YELLOW = [226, 178, 40], STEEL_B = [104, 112, 122], OD = [94, 106, 70], OD_D = [72, 82, 56];
const ORE_B = [70, 130, 220], ORE_L = [130, 190, 250];
function oreChunk(x, y, z, s, seed, blue = true) {
  fbox(x - s, y - s * .8, z, x + s, y + s * .8, z + s * 1.1, blue && hash(seed, 1) > .5 ? ORE_B : hash(seed, 1) > .4 ? [104, 100, 96] : [124, 118, 112], seed);
  if (blue) { fbox(x - s * .55, y - s * .45, z + s * 1.1, x + s * .35, y + s * .45, z + s * 1.45, hash(seed, 2) > .5 ? ORE_L : ORE_B, seed + 1); pt(x - s * .2, y + s * .46, z + s * 1.3, rgb(230, 245, 255)); }
}
function rockFace(a, z, ix, iy, L) {
  const crack = nz(a * 2.2 + 5, z * 2.6);
  if (Math.abs(crack - .5) < .012) return R_ROCKD[0];
  const rich = a > 4.2 && a < 11 ? 1 : .35, ridge = 1 - Math.abs(nz(a * .9 + 4, z * 1.5) - .5) * 2, blob = nz(a * 3 + 9, z * 3);
  const w = (.03 + Math.min(.07, L * .002) + (L >= 7 ? .035 : 0)) * rich * (.6 + blob * .8);
  if (L && ridge > 1 - w && z > .15 && z < 2.35) {
    if (hash(ix, iy) > .95) return rgb(220, 240, 255);
    const f = (ridge - (1 - w)) / w;
    return L >= 40 && blob > .45 ? pick(R_CRYS, 2.4 + f * 1.6, ix, iy, .4) : pick(R_ORE, 1.8 + f * 2, ix, iy, .4);
  }
  const s = nz(a * .7 + 11, z * 3.4) * .7 + nz(a * 3, z * 5) * .3;
  return pick(s > .55 ? R_ROCK : R_ROCKD, 1.6 + s * 2, ix, iy, .45);
}
// how rich the veins in the rock show: each era digs into richer ore (crystal from the third)
const veinOf = look => look ? [1, 16, 30, 40, 40][look.era] : 0;
// the floor and walls: bare rock with the pit at first; from the military era a concrete floor with a walkway
// line and a steel collar round the pit, the rock held by mesh and bolts
function minePaint(L, fz, look) {
  const { x0, y0 } = UG, st = RL() - STORE, pr = PIT.r, v = veinOf(look), e = look ? look.era : 0;
  return {
    floor(x, y, ix, iy) {
      const a = x - x0, b = y - y0;
      if (a > st && b > st) return a < st + .12 || b < st + .12 ? hazard(a, b) : pick(R_SHOT, 2.4 + nz(a * 2, b * 2) * .6, ix, iy, .4);
      if (look) {
        const dx = Math.abs(x - PIT.x), dy = Math.abs(y - PIT.y);
        if (dx < pr && dy < pr) return dx > pr - .1 || dy > pr - .1 ? R_ROCKD[1] : rgb(16, 12, 16);
        if (e && dx < pr + .45 && dy < pr + .45) return dx > pr + .3 || dy > pr + .3 ? hazard(a, b) : pick(R_SHOT, 2.6, ix, iy, .3);
      }
      if (e) {
        if (Math.abs(b - 1.5) < .035 || Math.abs(a - 1.5) < .035 && b > 1.5) return rgb(226, 186, 50);
        return (a % 1.8) < .025 || (b % 1.8) < .025 ? R_SHOT[1] : pick(R_SHOT, 2.2 + nz(a * 1.4, b * 1.4) * .8, ix, iy, .5);
      }
      const h = hash(ix, iy);
      return pick(h > .92 ? R_ROCKD : R_ROCK, 1.7 + nz(a * 2, b * 2) * 1.4 + (h > .985 ? 1.4 : 0), ix, iy, .5);
    },
    back(x, z, ix, iy) {
      const a = x - x0, zz = z - fz;
      if (!look) return earthWall(a, zz, ix, iy);
      if (e && (((a + zz) % .25) < .025 || ((a - zz + 9) % .25) < .025)) return rgb(150, 156, 160);
      return rockFace(a, zz, ix, iy, v);
    },
    left(y, z, ix, iy) {
      const b = y - y0, zz = z - fz;
      if (!look) return earthWall(b, zz, ix, iy);
      // the miners' bays: bare rock with ore, framed once the rest of the wall is meshed
      const bay = MINE_BAYS.reduce((m, c) => Math.min(m, Math.abs(b - c)), 9);
      if (bay < .75) return e && bay > .7 ? R_ROCKD[0] : rockFace(b + 3.5, zz, ix, iy, v);
      const r = rockFace(b + 20, zz, ix, iy, 0);
      if (e) { if (((b + zz) % .25) < .025 || ((b - zz + 9) % .25) < .025) return rgb(150, 156, 160); if ((b % .8) < .05 && (zz % .8) < .07) return rgb(200, 204, 208); }
      return r;
    },
    cap: R_ROCKD[2],
  };
}
// white stencil digits (3x5 cells of cu along a face by cz up), e.g. a machine's number: stencil('07', u0, z0)(u, z)
const DIGIT = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
const stencil = (n, u0, z0, cu = .09, cz = .075) => (u, z) => { const i = Math.floor((u - u0) / cu), r = 4 - Math.floor((z - z0) / cz), d = Math.floor(i / 4), c = i % 4; return r >= 0 && r <= 4 && i >= 0 && d < n.length && c < 3 && DIGIT[+n[d]][r * 3 + c] === '1'; };
// a brace: a line two pixels thick
function brace(a, b, c, d = [.07, 0, 0]) { ln(a, b, c); ln([a[0] + d[0], a[1] + d[1], a[2] + d[2]], [b[0] + d[0], b[1] + d[1], b[2] + d[2]], c); }
// a hose or cable from a to b, sagging to the floor between them when it is long
function hose(a, b, c, sag = .25) {
  const n = 8;
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n, s = t => Math.sin(t * Math.PI) * sag;
    ln([lerp(a[0], b[0], t0), lerp(a[1], b[1], t0), Math.max(FLOOR_Z[2] + .02, lerp(a[2], b[2], t0) - s(t0))], [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1), Math.max(FLOOR_Z[2] + .02, lerp(a[2], b[2], t1) - s(t1))], c);
  }
}

/* ---------- the drill, over the pit (loop.js spins its bit at PIT from the first breakthrough on) ---------- */
// level 1: the windlass, two timber A-frames and the axle (loop.js lets the rope down from it)
function windlass(fz) {
  const { x, y } = PIT, wd = WOOD;
  for (const s of [-1, 1]) {
    const ax = x + s * .72;
    ln([ax, y - .4, fz], [ax, y, fz + 1.4], rgb(...wd)); ln([ax + .02, y - .4, fz], [ax + .02, y, fz + 1.4], rampOf(wd)[2]);
    ln([ax, y + .4, fz], [ax, y, fz + 1.4], rgb(...wd)); ln([ax + .02, y + .4, fz], [ax + .02, y, fz + 1.4], rampOf(wd)[2]);
    fbox(ax - .05, y - .42, fz, ax + .05, y + .42, fz + .06, WOOD_D, 600);
  }
  fbox(x - .78, y - .04, fz + 1.26, x + .78, y + .04, fz + 1.34, WOOD_D, 601);
  fbox(x - .2, y - .07, fz + 1.23, x + .2, y + .07, fz + 1.37, PLANKS, 602);
  fbox(x + .78, y - .04, fz + 1.12, x + .84, y + .04, fz + 1.34, METAL, 603); fbox(x + .78, y - .04, fz + 1.08, x + .84, y + .2, fz + 1.14, METAL, 604);
}
// the drill motor that turns the bit: a body round the top of the spinning rod (wide enough to hide its end)
function drillHead(x, y, z0, z1, c, seed, fins) {
  fbox(x - .08, y - .08, z0 - .08, x + .08, y + .08, z0, DARK, seed);
  sbox(x - .23, y - .23, z0, x + .23, y + .23, z1, c, seed + 1);
  if (fins) onY(y + .23, x - .2, x + .2, z0 + .04, z1 - .04, (xx, z) => ((z - z0) % .07) < .025 ? shade(rgb(...c), .6) : 0);
  onX(x + .23, y - .2, y + .2, z0 + .04, z1 - .04, (yy, z) => Math.abs(z - z1 + .08) < .02 ? shade(rgb(...c), .55) : 0);
}
// breakthrough: a timber frame over the pit with a jackhammer on a chain, fed by a little air compressor
function jackFrame(fz, g) {
  const { x, y } = PIT, wd = mat(WOOD, g), top = fz + 2.42;
  for (const [dx, dy] of [[-.62, -.55], [.62, -.55], [-.62, .55], [.62, .55]]) fbox(x + dx - .07, y + dy - .07, fz, x + dx + .07, y + dy + .07, top, wd, 1100);
  // beams on top, the middle one carrying the drill; ties at knee height on the two sides seen
  for (const yy of [y - .55, y, y + .55]) fbox(x - .7, yy - .06, top - .12, x + .7, yy + .06, top, wd, 1101);
  fbox(x + .56, y - .62, fz + .8, x + .68, y + .62, fz + .92, wd, 1102); fbox(x - .62, y + .49, fz + .8, x + .62, y + .61, fz + .92, wd, 1103);
  brace([x + .69, y + .48, fz + .12], [x + .69, y - .48, fz + .8], shade(rgb(...wd), .8), [0, 0, .05]);
  brace([x + .69, y - .48, fz + .93], [x + .69, y + .48, top - .14], shade(rgb(...wd), .8), [0, 0, .05]);
  for (const [dx, dy, z] of [[.62, .55, .86], [-.62, .55, .86], [.62, -.55, .86], [.62, .55, top - fz - .06]]) fbox(x + dx - .09, y + dy - .09, fz + z - .05, x + dx + .09, y + dy + .09, fz + z + .05, DARK, 1104);
  // the jackhammer: chain, body (red cap, handles), the chuck; its steel is the spinning rod
  for (let z = fz + 2.2; z < top - .12; z += .05) pt(x, y, z, rgb(150, 150, 156));
  drillHead(x, y, fz + 1.86, fz + 2.2, [150, 156, 164], 1105, true);
  sbox(x - .2, y - .2, fz + 2.2, x + .2, y + .2, fz + 2.26, [190, 60, 44], 1107);
  for (const s of [-1, 1]) fbox(x - .04, y + s * .23, fz + 2.06, x + .04, y + s * .36, fz + 2.1, DARK, 1108);
  // the compressor: a red tank on a skid with its little engine, the hose to the drill
  const cx = x + 1.05, cy = y + .18;
  fbox(cx, cy, fz, cx + .8, cy + .42, fz + .08, WOOD_D, 1110);
  sbox(cx + .04, cy + .04, fz + .08, cx + .76, cy + .38, fz + .4, [184, 62, 48], 1111);
  for (const xx of [cx + .1, cx + .66]) onY(cy + .38, xx - .015, xx + .015, fz + .1, fz + .38, rgb(120, 40, 32));
  sbox(cx + .44, cy + .08, fz + .4, cx + .72, cy + .34, fz + .62, [70, 72, 78], 1112);
  onY(cy + .34, cx + .47, cx + .69, fz + .44, fz + .58, (xx, z) => ((z - fz) % .05) < .02 ? rgb(40, 40, 44) : 0);
  sbox(cx + .12, cy + .12, fz + .4, cx + .26, cy + .26, fz + .46, [210, 214, 220], 1113);
  pt(cx + .19, cy + .27, fz + .44, rgb(30, 30, 34));
  hose([x + .23, y + .1, fz + 2.0], [cx + .1, cy + .2, fz + .3], rgb(36, 34, 38), .9);
  footShadow(x - .7, y - .62, x + .7, y + .62, 1.2); footShadow(cx, cy, cx + .8, cy + .42, .5);
}
// breakthrough: a welded steel tower with an electric motor on top, a switch box on a post wired to the wall
function steelTower(fz, g) {
  const { x, y } = PIT, st = mat([132, 140, 150], g), top = fz + 2.44, w = .6, d = .55;
  for (const [dx, dy] of [[-w, -d], [w, -d], [-w, d], [w, d]]) fbox(x + dx - .05, y + dy - .05, fz, x + dx + .05, y + dy + .05, top, st, 1120);
  for (const z of [.12, .92, 1.72]) { fbox(x - w, y + d - .03, fz + z, x + w, y + d + .03, fz + z + .05, st, 1121); fbox(x + w - .03, y - d, fz + z, x + w + .03, y + d, fz + z + .05, st, 1122); fbox(x - w, y - d - .03, fz + z, x + w, y - d + .03, fz + z + .05, st, 1123); }
  const dk = shade(rgb(...st), .62);
  for (const [z0, z1] of [[.17, .92], [.97, 1.72]]) {
    brace([x - w + .05, y + d + .04, fz + z0], [x + w - .05, y + d + .04, fz + z1], dk, [0, 0, .04]); brace([x - w + .05, y + d + .04, fz + z1], [x + w - .05, y + d + .04, fz + z0], dk, [0, 0, .04]);
    brace([x + w + .04, y - d + .05, fz + z0], [x + w + .04, y + d - .05, fz + z1], dk, [0, 0, .04]); brace([x + w + .04, y - d + .05, fz + z1], [x + w + .04, y + d - .05, fz + z0], dk, [0, 0, .04]);
  }
  // the deck, the motor hung under it (cooling fins, a yellow plate), a guard round the pit
  fbox(x - w - .06, y - d - .06, top - .08, x + w + .06, y + d + .06, top, [96, 102, 110], 1124, .5);
  drillHead(x, y, fz + 1.84, top - .08, [62, 112, 96], 1125, true);
  onX(x + .232, y - .08, y + .08, fz + 2.12, fz + 2.24, rgb(232, 190, 50));
  for (const [x0, y0, x1, y1] of [[x - .74, y - .74, x + .74, y - .66], [x - .74, y + .66, x + .74, y + .74], [x - .74, y - .66, x - .66, y + .66], [x + .66, y - .66, x + .74, y + .66]])
    fbox(x0, y0, fz, x1, y1, fz + .06, YELLOW, 1126, .4);
  onZ(fz + .06, x - .74, y + .66, x + .74, y + .74, (xx, yy) => hazard(xx, yy));
  // the switch box on its post, a cable up the tower and one along the floor to the back wall
  const bx = x + 1.0, by = y + .62;
  fbox(bx - .03, by - .03, fz, bx + .03, by + .03, fz + 1.0, DARK, 1127);
  sbox(bx - .16, by - .1, fz + .9, bx + .16, by + .1, fz + 1.28, [110, 118, 124], 1128);
  onY(by + .1, bx - .13, bx + .13, fz + .93, fz + 1.25, (xx, z) => Math.abs(z - fz - 1.15) < .04 && Math.abs(xx - bx + .06) < .04 ? lit(rgb(110, 255, 120)) : Math.abs(z - fz - 1.15) < .04 && Math.abs(xx - bx - .06) < .04 ? lit(rgb(255, 80, 60)) : Math.abs(z - fz - 1.0) < .02 ? rgb(60, 64, 70) : 0);
  ln([x + w, y + d, top - .3], [x + w, y + d, fz + .02], rgb(30, 30, 34)); ln([x + w, y + d, fz + .02], [bx, by, fz + .02], rgb(30, 30, 34));
  ln([bx, by - .1, fz + .02], [bx, yb(.25), fz + .02], rgb(30, 30, 34)); ln([bx, yb(.25), fz + .02], [bx, UG.y0 + .02, fz + 1.0], rgb(30, 30, 34));
  sbox(bx - .14, UG.y0, fz + 1.0, bx + .14, UG.y0 + .1, fz + 1.3, [110, 118, 124], 1129);
  footShadow(x - .74, y - .74, x + .74, y + .74, 1.4);
}
// military era: a core drill on tracks, its mast over the pit, the engine and the cab behind it
function coreRig(fz, g) {
  const { x, y } = PIT, body = mat(OD, g), top = fz + 2.44;
  // the tracks
  for (const [ya, yz] of [[y - .82, y - .5], [y + .5, y + .82]]) {
    sbox(x + .1, ya, fz, x + 2.7, yz, fz + .34, [58, 60, 64], 1200);
    onY(yz, x + .12, x + 2.68, fz + .02, fz + .32, (xx, z) => ((xx - x) % .12) < .03 ? rgb(34, 34, 38) : Math.abs(z - fz - .17) < .1 && (Math.abs(xx - x - .35) < .12 || Math.abs(xx - x - 2.45) < .12) ? rgb(96, 100, 106) : 0);
  }
  // the hull: louvres, a number, hazard stripes on the nose
  const num = stencil('07', .75, .58);
  sbox(x + .3, y - .62, fz + .34, x + 2.6, y + .62, fz + 1.02, body, 1201);
  onY(y + .62, x + .32, x + 2.58, fz + .36, fz + 1.0, (xx, z) => {
    const u = xx - x, zz = z - fz;
    if (u < .52) return (Math.floor((u + zz) * 6) & 1) ? HZ_Y : HZ_K;
    if (u > 1.7 && u < 2.45 && zz > .52 && zz < .9) return ((zz - .52) % .08) < .035 ? rgb(40, 44, 34) : 0;
    return num(u, zz) ? rgb(226, 222, 200) : 0;
  });
  onX(x + 2.6, y - .6, y + .6, fz + .36, fz + 1.0, (yy, z) => ((z - fz) % .1) < .03 && Math.abs(yy - y) < .4 ? rgb(46, 52, 36) : 0);
  // the engine deck and its stack; the cab with its windows
  sbox(x + 1.7, y - .5, fz + 1.02, x + 2.55, y + .45, fz + 1.3, OD_D, 1202);
  fbox(x + 2.3, y - .32, fz + 1.3, x + 2.4, y - .22, fz + 2.0, [50, 50, 54], 1203); fbox(x + 2.27, y - .35, fz + 2.0, x + 2.43, y - .19, fz + 2.04, [50, 50, 54], 1204);
  sbox(x + .95, y - .58, fz + 1.02, x + 1.6, y + .3, fz + 1.8, body, 1205);
  fbox(x + .92, y - .61, fz + 1.8, x + 1.63, y + .33, fz + 1.86, OD_D, 1206);
  onY(y + .3, x + 1.0, x + 1.55, fz + 1.3, fz + 1.72, (xx, z) => Math.abs(xx - x - 1.27) < .02 ? rgb(46, 50, 38) : lit(rgb(150, 186, 196)));
  onX(x + 1.6, y - .5, y + .22, fz + 1.3, fz + 1.72, (yy, z) => Math.abs(yy - y + .14) < .02 ? rgb(46, 50, 38) : rgb(118, 150, 164));
  // the mast: four corner posts laced together, struts back to the hull, the rotary head on top
  const mw = .24, md = .22, ms = mat([214, 170, 46], g);
  fbox(x - .34, y - .34, fz + .3, x + .36, y + .34, fz + .42, OD_D, 1207);
  for (const [dx, dy] of [[-mw, -md], [mw, -md], [-mw, md], [mw, md]]) fbox(x + dx - .04, y + dy - .04, fz + .42, x + dx + .04, y + dy + .04, top, ms, 1208);
  for (let z = .42; z < 2.3; z += .38) {
    fbox(x - mw, y + md - .02, fz + z, x + mw, y + md + .02, fz + z + .04, ms, 1209); fbox(x + mw - .02, y - md, fz + z, x + mw + .02, y + md, fz + z + .04, ms, 1210);
    if (z + .38 < 2.3) { ln([x - mw, y + md + .03, fz + z + .04], [x + mw, y + md + .03, fz + z + .38], rgb(150, 116, 30)); ln([x + mw + .03, y - md, fz + z + .04], [x + mw + .03, y + md, fz + z + .38], rgb(150, 116, 30)); }
  }
  for (const s of [-1, 1]) brace([x + 1.0, y + s * .4, fz + 1.02], [x + mw, y + s * md, fz + 1.9], rgb(...OD_D), [0, 0, .05]);
  drillHead(x, y, fz + 1.9, fz + 2.3, [70, 74, 80], 1211, false);
  sbox(x - .15, y - .15, fz + 2.3, x + .15, y + .15, top + .02, [190, 60, 44], 1212);
  hose([x + .95, y + .2, fz + 1.4], [x + .23, y + .23, fz + 2.1], rgb(30, 30, 34), .35); hose([x + .95, y + .05, fz + 1.5], [x + .23, y + .08, fz + 2.2], rgb(30, 30, 34), .3);
  // a work light on the mast
  EM = 1; fbox(x + mw + .02, y + md - .1, fz + 1.62, x + mw + .1, y + md + .02, fz + 1.74, [255, 240, 200], 1213); EM = 0;
  lamp(2, x + .8, y + 1.0, fz, 2.6, 1.8, WHITE_T);
  footShadow(x - .34, y - .82, x + 2.7, y + .82, 1.2);
}

/* ---------- getting the ore out ---------- */
// level 1: the rubble of the digging lies where it fell; each step of the haulage clears some of it away
function mineRubble(fz, keep) {
  const RLx = RL();
  for (const [ra, rb, k] of [[RLx * .5, RLx * .8, 0], [RLx * .2, RLx * .5, 1], [RLx * .62, RLx * .63, 2], [RLx * .55, RLx * .18, 3], [RLx * .86, RLx * .55, 4], [RLx * .12, RLx * .84, 5]]) {
    if (!keep.includes(k)) continue;
    const cx = XA(ra), cy = yb(rb);
    fbox(cx - .5, cy - .4, fz, cx + .5, cy + .4, fz + .16, [128, 122, 116], 1049 + k);
    for (let j = 0; j < 9; j++) { const a = hash(j, k) * 6.28, d = hash(k, j) * .42, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .8, r = .12 + hash(j + k, 3) * .13; fbox(x - r, y - r * .8, fz + .1, x + r, y + r * .8, fz + .1 + r * (1.6 - d * 1.5), hash(j, k * 3) > .75 ? ORE_B : [136 - j * 3, 130 - j * 3, 122 - j * 2], 1050 + j + k * 9); }
  }
}
// a wheelbarrow about a person's size, pointing +x: a deep red pan with a sloped front, the wheel under its nose, two
// handles back to the grips with a leg under each, heaped with ore (or empty)
function barrow(x, y, fz, ore, seed, g) {
  const tray = mat([190, 84, 50], g), dk = shade(rgb(...tray), .55);
  for (const s of [-1, 1]) {
    const yy = y + s * .27;
    fbox(x - 1.35, yy - .05, fz + .55, x - .2, yy + .05, fz + .66, [178, 136, 88], seed, .6);
    fbox(x - 1.4, yy - .06, fz + .54, x - 1.12, yy + .06, fz + .67, [52, 46, 42], seed + 1);
    fbox(x - .56, yy - .05, fz, x - .46, yy + .05, fz + .55, [150, 112, 72], seed + 2);
    brace([x + .3, y + s * .12, fz + .45], [x + .68, y + s * .12, fz + .28], rgb(70, 70, 76), [0, 0, .03]);
  }
  // the pan: three courses stepping forward, so its front slopes out like a real one; dark inside under the lip
  sbox(x - .45, y - .36, fz + .38, x + .3, y + .36, fz + .52, tray, seed + 3);
  sbox(x - .47, y - .37, fz + .52, x + .42, y + .37, fz + .66, tray, seed + 4);
  sbox(x - .49, y - .38, fz + .66, x + .54, y + .38, fz + .78, tray, seed + 5);
  fbox(x - .51, y - .4, fz + .78, x + .56, y + .4, fz + .82, tray.map(v => Math.min(255, v * 1.2 + 12)), seed + 6, .3);
  onZ(fz + .82, x - .45, y - .34, x + .5, y + .34, dk);
  onY(y + .38, x - .49, x + .54, fz + .66, fz + .78, (xx) => Math.abs(xx - x - .02) < .03 ? dk : 0);
  // the wheel: tyre, rim, hub, seen from the side
  onY(y + .13, x + .38, x + .98, fz, fz + .58, (xx, z) => {
    const r = Math.hypot(xx - x - .68, (z - fz - .28) * 1.0);
    if (r > .28) return 0;
    if (r > .2) return rgb(38, 38, 42);
    if (r > .16) return rgb(150, 154, 160);
    if (r < .05) return rgb(210, 214, 220);
    return ((Math.atan2(z - fz - .28, xx - x - .68) * 4 / Math.PI + 9) % 1) < .3 ? rgb(150, 154, 160) : rgb(70, 70, 76);
  });
  if (ore) for (let k = 0; k < 13; k++) { const r = k < 7 ? 0 : k < 11 ? 1 : 2, a = (k + r * .5) * 2.4; oreChunk(x + .02 + Math.cos(a) * (.34 - r * .14), y + Math.sin(a) * (.24 - r * .1), fz + .8 + r * .11, .11 - r * .01, seed + 9 + k); }
  footShadow(x - .5, y - .38, x + .55, y + .38, .8);
}
// breakthrough: wheelbarrows; a short boardwalk into the ore store, one barrow on it heaped with ore, another by the
// rubble at the bays
function barrows(fz, g) {
  mineRubble(fz, [1, 2, 3]);
  const st = RL() - STORE, [b0, b1] = railB(), y0 = yb(b0) - .2, y1 = yb(b1) + .2;
  for (let k = 0, x = XA(st - 2.9); x < XA(st - .05); x += .27, k++) {
    fbox(x, y0 + hash(k, 7) * .06, fz, x + .22, y1 - hash(7, k) * .06, fz + .05, k & 1 ? PLANKS : [162, 124, 84], 1130 + k, 1.4);
    onZ(fz + .05, x, y0, x + .22, y1, (xx, yy) => Math.abs(yy - y0 - .12) < .02 || Math.abs(yy - y1 + .12) < .02 ? rgb(70, 60, 54) : 0);
  }
  barrow(XA(st - 1.25), (y0 + y1) / 2, fz + .05, true, 1140, g);
  barrow(XA(3.4), yb(RL() * .5) + 1.05, fz, false, 1160, g);
}
// the rails: sleepers and two steel rails along the front edge
function rails(fz, x0, x1, sleeper = WOOD_D) {
  const [b0, b1] = railB(), y0 = yb(b0), y1 = yb(b1);
  for (let x = x0 + .1; x < x1; x += .3) fbox(x, y0 - .06, fz, x + .14, y1 + .06, fz + .05, sleeper, 630);
  for (const y of [y0 + .02, y1 - .06]) fbox(x0, y, fz + .05, x1, y + .04, fz + .1, [150, 156, 164], 631, .4);
}
// a mine cart on the rails: a tub on four wheels, heaped with ore
function cart(x, fz, ore = 1, c = RUST, seed = 640) {
  const y0 = yb(railB()[0]) - .06, y1 = yb(railB()[1]) + .06, w = .46;
  for (const [dx, y] of [[-w + .08, y0], [w - .2, y0], [-w + .08, y1 - .08], [w - .2, y1 - .08]]) fbox(x + dx, y, fz + .06, x + dx + .12, y + .08, fz + .2, DARK, seed);
  fbox(x - w, y0, fz + .18, x + w, y1, fz + .56, c, seed + 1);
  fbox(x - w - .02, y0 - .02, fz + .52, x + w + .02, y1 + .02, fz + .58, [176, 182, 190], seed + 2);
  onY(y1, x - w, x + w, fz + .18, fz + .56, (xx, z) => Math.abs(z - fz - .5) < .03 || Math.abs(z - fz - .26) < .02 ? rgb(70, 40, 30) : Math.abs(xx - x) > w - .05 && ((z - fz) % .12) < .03 ? rgb(200, 190, 170) : 0);
  for (let k = 0; k < Math.round(ore * 9); k++) { const ox = x - w + .08 + (k % 4) * .2 + hash(k, seed) * .05, oy = y0 + .06 + (k >> 2) % 2 * .18, oz = fz + .58 + (k >= 8 ? .1 : 0); fbox(ox, oy, oz, ox + .15, oy + .15, oz + .08 + hash(seed, k) * .1, hash(k, 3) > .3 ? ORE_L : STONE_W, seed + 5 + k); }
  footShadow(x - w, y0, x + w, y1, .56);
}
// breakthrough: timber rails along the front into the store, and a cart; the last heap of rubble by the bays
function woodRails(fz, g) { mineRubble(fz, [1]); rails(fz, XA(.8), XA(RL() - STORE + .3)); cart(XA(RL() - STORE - 1.6), fz, .8, mat(RUST, g)); }
// military era: steel rails on steel sleepers, a buffer stop, two steel carts
function steelRails(fz, g) {
  const st = RL() - STORE, [b0, b1] = railB();
  rails(fz, XA(.8), XA(st + .3), [70, 74, 80]);
  const bx = XA(.8), y0 = yb(b0) - .1, y1 = yb(b1) + .1;
  sbox(bx, y0, fz, bx + .16, y1, fz + .42, [60, 62, 66], 1150);
  onY(y1, bx, bx + .16, fz + .2, fz + .4, (xx, z) => hazard(xx * 3, z * 3));
  onX(bx + .16, y0, y1, fz + .2, fz + .4, (yy, z) => hazard(yy * 2, z * 2));
  cart(XA(st - 1.4), fz, 1, mat([92, 100, 108], g), 1151);
  cart(XA(st - 2.5), fz, .7, mat(OD, g), 1171);
}

/* ---------- the roof held up ---------- */
// level 1: two pillars of rock left standing; then cased in timber, then banded in steel
function minePillars(fz, look, band) {
  for (const [pa, pb] of MINE_PILLARS()) {
    const x0 = XA(pa - .45), y0 = yb(pb - .45), x1 = x0 + .9, y1 = y0 + .9, v = veinOf(look);
    fbox(x0, y0, fz, x1, y1, fz + UG.h, [104, 98, 94], 1040 + pa);
    onY(y1, x0, x1, fz, fz + UG.h, (x, z, ix, iy) => rockFace(x - x0 + pa * 3, z - fz, ix, iy, v));
    onX(x1, y0, y1, fz, fz + UG.h, (y, z, ix, iy) => shade(rockFace(y - y0 + pb * 5, z - fz, ix, iy, v), .78));
    if (band) band(x0, y0, x1, y1);
    footShadow(x0, y0, x1, y1, 2.4);
  }
}
// posts along the back and the left wall with a cap beam over them
function supports(fz, steel, xs, g) {
  const c = mat(steel ? STEEL_B : WOOD, g), y0 = UG.y0;
  for (const a of xs) { if (a > RL() - .3) continue; const x = XA(a); fbox(x - .08, y0 + .02, fz, x + .08, y0 + .18, fz + UG.h - .14, c, 650); if (steel) onY(y0 + .18, x - .05, x + .05, fz, fz + UG.h - .14, (xx) => Math.abs(xx - x) < .015 ? rgb(70, 76, 84) : 0); }
  fbox(XA(1.95), y0 + .02, fz + UG.h - .14, UG.x1 - .1, y0 + .2, fz + UG.h - .02, c, 651);
  for (let b = 2.4; b < RL() - .4; b += 2) if (Math.abs(b - MINE_PILLARS()[0][1]) > .6) fbox(UG.x0 + .02, yb(b) - .08, fz, UG.x0 + .18, yb(b) + .08, fz + UG.h - .14, c, 652);
  fbox(UG.x0 + .02, yb(1.1), fz + UG.h - .14, UG.x0 + .2, UG.y1 - .1, fz + UG.h - .02, c, 653);
}
const timbering = (fz, g, look) => {
  supports(fz, false, MINE_POSTS, g);
  minePillars(fz, look, (x0, y0, x1, y1) => {
    for (const z of [.15, 2.2]) fbox(x0 - .04, y0 - .04, fz + z, x1 + .04, y1 + .04, fz + z + .2, mat(WOOD, g), 1045);
    for (const [x, y] of [[x0 - .06, y1 - .02], [x1 - .08, y1 - .02], [x1 - .02, y0 + .1]]) fbox(x, y, fz, x + .1, y + .08, fz + 2.4, mat(WOOD, g), 1046);
  });
};
const steelArches = (fz, g, look) => {
  supports(fz, true, MINE_POSTS, g);
  minePillars(fz, look, (x0, y0, x1, y1) => { for (const z of [.3, 1.1, 1.9]) fbox(x0 - .04, y0 - .04, fz + z, x1 + .04, y1 + .04, fz + z + .12, mat(STEEL_B, g), 1045); });
};

/* ---------- light ---------- */
// level 1: a lantern on a plank by the pit
function mineLantern(fz) {
  const { x, y } = PIT;
  AMB[2] = .6; lamp(2, x, y - .8, fz, 3, 2, FIRE_T);
  fbox(x - 1.2, y - .3, fz, x - .9, y, fz + .26, PLANK, 660); EM = 1; fbox(x - 1.12, y - .22, fz + .26, x - .98, y - .08, fz + .42, [255, 200, 110], 661); EM = 0;
}
// breakthrough: brass carbide lamps on the rock of both walls
function carbideLamps(fz, g) {
  const RLx = RL(), brass = mat([176, 140, 70], g);
  AMB[2] = .62;
  for (const [a, b] of [[3.0, 1.3], [6.0, 1.3], [9.2, 1.3], [1.3, 4.4], [1.3, 6.6]]) lamp(2, XA(a), yb(b), fz, 3.8, 2.5, FIRE_T);
  for (const a of [3.0, 6.0, 9.2]) { const lx = XA(a); fbox(lx - .06, UG.y0, fz + 1.7, lx + .06, UG.y0 + .16, fz + 1.86, brass, 680); EM = 1; fbox(lx - .03, UG.y0 + .1, fz + 1.86, lx + .03, UG.y0 + .16, fz + 1.96, [255, 220, 120], 681); EM = 0; halo(lx, UG.y0, fz + 1.88, .4, .35); }
  for (const b of [4.4, 6.6]) { const ly = yb(b), x0 = UG.x0; fbox(x0, ly - .06, fz + 1.7, x0 + .16, ly + .06, fz + 1.86, brass, 682); EM = 1; fbox(x0 + .1, ly - .03, fz + 1.86, x0 + .16, ly + .03, fz + 1.96, [255, 220, 120], 683); EM = 0; haloX(x0, ly, fz + 1.88, .4, .35); }
  if (RLx > 12.5) lamp(2, XA(RLx * .6), yb(RLx * .6), fz, 3.8, 2.5, FIRE_T);
}
// military era: caged work lights on both walls, on a cable along the top
function cagedLights(fz, g) {
  const RLx = RL(), base = mat([70, 74, 80], g);
  AMB[2] = .66;
  const at = [[2.8, 0], [5.0, 0], [7.3, 0], [9.6, 0], [0, 4.4], [0, 6.6]];
  ln([XA(2.0), UG.y0 + .03, fz + 2.32], [UG.x1 - .2, UG.y0 + .03, fz + 2.32], rgb(30, 30, 34)); ln([UG.x0 + .03, yb(1.2), fz + 2.32], [UG.x0 + .03, UG.y1 - .3, fz + 2.32], rgb(30, 30, 34));
  for (const [a, b] of at) {
    const onBack = !b, x = onBack ? XA(a) : UG.x0, y = onBack ? UG.y0 : yb(b), z = fz + (onBack ? 1.9 : 1.5);
    if (onBack) {
      fbox(x - .1, y, z + .14, x + .1, y + .1, z + .26, base, 1180);
      EM = 1; fbox(x - .07, y + .1, z, x + .07, y + .24, z + .14, [255, 236, 190], 1181); EM = 0;
      for (const o of [-.08, 0, .08]) ln([x + o, y + .25, z - .01], [x + o, y + .25, z + .15], rgb(40, 40, 44));
      halo(x, y, z + .06, .55, .45); lamp(2, x, yb(1.6), fz, 4.4, 2.9, WARM_T);
    } else {
      fbox(x, y - .1, z + .14, x + .1, y + .1, z + .26, base, 1182);
      EM = 1; fbox(x + .1, y - .07, z, x + .24, y + .07, z + .14, [255, 236, 190], 1183); EM = 0;
      for (const o of [-.08, 0, .08]) ln([x + .25, y + o, z - .01], [x + .25, y + o, z + .15], rgb(40, 40, 44));
      haloX(x, y, z + .06, .55, .45); lamp(2, XA(1.6), y, fz, 4.4, 2.9, WARM_T);
    }
  }
  lamp(2, XA(RLx * .55), yb(RLx * .55), fz, 5, 3.2, WARM_T);
}

/* ---------- from the drill to the store ---------- */
// breakthrough: a wooden ore bin with a chute stepping down towards the rails
function woodChute(fz, g) {
  const st = RL() - STORE, rb0 = railB()[0], cx = XA(st - 3.6), c0 = rb0 - 2.0, wd = mat(WOOD, g);
  fbox(cx - .5, yb(c0), fz, cx + .5, yb(c0 + .7), fz + 1.0, wd, 750); onY(yb(c0 + .7), cx - .5, cx + .5, fz, fz + 1.0, (xx, z) => ((z - fz) % .25) < .04 ? R_WOOD[0] : 0);
  for (let k = 0; k < 5; k++) { const z = fz + 1.0 - k * .12, yy = yb(c0 + .7) + k * .15; fbox(cx - .3, yy, z - .06, cx + .3, yy + .15, z, PLANK, 751 + k); }
  for (let k = 0; k < 6; k++) oreChunk(cx - .35 + (k % 3) * .3, yb(c0 + .15) + (k > 2) * .25, fz + 1.0, .07, 756 + k);
  footShadow(cx - .5, yb(c0), cx + .5, yb(c0 + .7), 1);
}
// military era: a belt conveyor from beside the drill to the crusher, ore riding on it
function beltLine(fz, g) {
  const cb = RL() - 3.6, y0 = yb(cb), y1 = yb(cb + .42), xa = XA(RL() * .3), xb = XA(RL() - STORE - 1.1), frame = mat([60, 64, 70], g), h = 1.06;
  for (let xx = xa + .1; xx < xb - .5; xx += .8) { fbox(xx, y0 + .05, fz, xx + .06, y0 + .11, fz + h - .1, STEEL_B, 850); fbox(xx, y1 - .11, fz, xx + .06, y1 - .05, fz + h - .1, STEEL_B, 850); }
  sbox(xa, y0, fz + h - .1, xb, y1, fz + h, frame, 851);
  onZ(fz + h, xa, y0 + .04, xb, y1 - .04, (xx) => ((xx - xa) % .25) < .04 ? rgb(36, 38, 42) : rgb(80, 84, 90));
  onY(y1, xa, xb, fz + h - .1, fz + h, (xx) => (Math.floor((xx - xa) * 5) & 1) ? HZ_Y : HZ_K);
  for (const xx of [xa, xb - .05]) sbox(xx - .05, y0 - .03, fz + h - .14, xx + .05, y1 + .03, fz + h + .04, [40, 42, 46], 852);
  for (let xx = xa + .2; xx < xb - .2; xx += .32) oreChunk(xx, (y0 + y1) / 2, fz + h, .06, 853 + Math.floor(xx * 7));
  footShadow(xa, y0, xb, y1, h);
}
// breakthrough: a sloping wooden screen on legs, ore sorted on it and the rejects heaped in front
function sortScreen(fz, g) {
  const sx = PIT.x + 1.4, sy = PIT.y - 1.6, wd = mat(WOOD, g);
  for (const [lx, ly] of [[sx, sy], [sx + .9, sy], [sx, sy + .5], [sx + .9, sy + .5]]) fbox(lx, ly, fz, lx + .06, ly + .06, fz + .5 + (lx > sx ? .2 : 0), WOOD_D, 710);
  fbox(sx, sy, fz + .55, sx + .96, sy + .56, fz + .63, wd, 711);
  onZ(fz + .63, sx + .05, sy + .05, sx + .91, sy + .51, (xx, yy) => ((Math.floor((xx - sx) * 30) + Math.floor((yy - sy) * 30)) & 1) ? rgb(70, 70, 76) : 0);
  for (let k = 0; k < 4; k++) oreChunk(sx + .2 + k * .2, sy + .25, fz + .63, .05, 712 + k);
  for (let k = 0; k < 6; k++) oreChunk(sx + .1 + k * .15, sy + .8, fz, .06, 716 + k, k & 1);
  footShadow(sx, sy, sx + .96, sy + .56, .6);
}
// military era: a jaw crusher at the end of the belt: hopper, the jaw housing, a flywheel and its motor
function jawCrusher(fz, g) {
  const st = RL() - STORE, x = XA(st - 1.75), y = yb(RL() - 3.98), body = mat(OD, g);
  sbox(x, y, fz, x + 1.2, y + 1.15, fz + .14, [56, 58, 62], 1190);
  sbox(x + .1, y + .1, fz + .14, x + 1.0, y + 1.05, fz + .78, body, 1191);
  onY(y + 1.05, x + .14, x + .96, fz + .2, fz + .74, (xx, z) => { const u = xx - x, zz = z - fz; if (Math.abs(u - .55) < .2 && zz < .36) return zz < .3 ? rgb(30, 28, 30) : rgb(46, 50, 36); if ((Math.abs(u - .2) < .03 || Math.abs(u - .9) < .03) && zz > .42) return rgb(60, 70, 46); return zz > .66 ? (Math.floor((u + zz) * 6) & 1 ? HZ_Y : HZ_K) : 0; });
  for (let k = 0; k < 3; k++) oreChunk(x + .45 + k * .12, y + 1.1 + (k & 1) * .12, fz, .07, 1192 + k);
  // the hopper on top, wider than the housing
  for (let k = 0; k < 2; k++) { const w = .4 + k * .1; sbox(x + .55 - w, y + .58 - w, fz + .78 + k * .12, x + .55 + w, y + .58 + w, fz + .9 + k * .12, [120, 126, 134], 1195 + k); }
  onZ(fz + 1.02, x + .07, y + .1, x + 1.03, y + 1.06, (xx, yy) => Math.abs(xx - x - .55) < .4 && Math.abs(yy - y - .58) < .4 ? rgb(40, 38, 40) : 0);
  for (let k = 0; k < 5; k++) oreChunk(x + .35 + (k % 3) * .2, y + .45 + (k > 2) * .22, fz + .98, .07, 1198 + k);
  // the crushed ore slides out down a chute into the store
  sbox(x + 1.0, y + .2, fz + .3, x + 1.55, y + .5, fz + .38, [120, 126, 134], 1202);
  for (let k = 0; k < 3; k++) oreChunk(x + 1.15 + k * .14, y + .35, fz + .38, .05, 1206 + k);
  // the flywheel on the right side, belted to a motor
  onX(x + 1.0, y + .22, y + .82, fz + .16, fz + .76, (yy, z) => { const r = Math.hypot(yy - y - .52, z - fz - .46) * 1.12; return r < .33 ? (r > .26 ? rgb(70, 74, 80) : r < .06 ? rgb(180, 184, 190) : ((Math.atan2(z - fz - .46, yy - y - .52) * 3 / Math.PI + 9) % 1) < .2 ? rgb(70, 74, 80) : rgb(110, 116, 122)) : 0; });
  sbox(x + 1.0, y + .82, fz + .14, x + 1.18, y + 1.12, fz + .44, [90, 96, 104], 1203);
  footShadow(x, y, x + 1.2, y + 1.15, .9);
}

/* ---------- the rest of the kit ---------- */
// military era: steel ore bins along the right wall
function oreBins(fz, g) {
  const x = UG.x1 - .75, c = mat([92, 100, 110], g);
  for (const b of [3.95, 4.95, 5.95]) {
    const y = yb(b);
    sbox(x, y, fz, x + .7, y + .88, fz + 1.05, c, 1210 + b);
    onY(y + .88, x + .04, x + .66, fz + .04, fz + 1.0, (xx, z) => Math.abs(z - fz - .96) < .03 || (z - fz) < .1 ? rgb(60, 66, 74) : Math.abs(xx - x - .35) < .1 && Math.abs(z - fz - .55) < .08 ? rgb(226, 186, 50) : 0);
    for (let j = 0; j < 6; j++) oreChunk(x + .14 + (j % 3) * .2, y + .2 + (j > 2) * .4, fz + 1.0, .08, 1220 + j + b * 9, true);
    footShadow(x, y, x + .7, y + .88, 1.05);
  }
}
// military era: a field generator on a skid in the right corner, cabled along the back wall
function fieldGen(fz, g) {
  const x = XA(RL() - 1.85), y = UG.y0 + .3, body = mat(OD, g);
  sbox(x, y, fz, x + 1.65, y + .95, fz + .12, [56, 58, 62], 1230);
  sbox(x + .08, y + .08, fz + .12, x + 1.57, y + .87, fz + .92, body, 1231);
  onY(y + .87, x + .12, x + 1.53, fz + .16, fz + .88, (xx, z) => { const u = xx - x, zz = z - fz; if (u > 1.0 && zz > .3 && zz < .8) return ((zz - .3) % .08) < .035 ? rgb(40, 46, 32) : 0; if (u < .5 && zz > .45 && zz < .75) return Math.abs(zz - .6) < .03 && Math.abs(u - .25) < .12 ? lit(rgb(110, 255, 120)) : rgb(54, 60, 44); return Math.abs(u - .92) < .02 ? rgb(60, 70, 46) : 0; });
  fbox(x + 1.25, y + .3, fz + .92, x + 1.37, y + .42, fz + 1.5, [50, 50, 54], 1232);
  ln([x + .2, UG.y0 + .03, fz + .5], [x + .2, UG.y0 + .03, fz + 2.2], rgb(30, 30, 34)); ln([x + .2, UG.y0 + .03, fz + 2.2], [XA(2.2), UG.y0 + .03, fz + 2.2], rgb(30, 30, 34));
  footShadow(x, y, x + 1.65, y + .95, .92);
}
// military era: a ventilation duct along the top of the left wall, its fan housing near the front
function ventDuct(fz, g) {
  const x0 = UG.x0 + .2, c = mat([150, 156, 160], g), ya = yb(1.3), yz = UG.y1 - .3;
  sbox(x0, ya, fz + 1.98, x0 + .34, yz, fz + 2.3, c, 1240);
  onX(x0 + .34, ya, yz, fz + 1.98, fz + 2.3, y => ((y - ya) % .8) < .04 ? rgb(100, 106, 110) : 0);
  const fy = UG.y1 - 1.55;
  sbox(x0 - .2, fy, fz + 1.1, x0 + .32, fy + 1.0, fz + 1.98, mat(OD, g), 1241);
  onX(x0 + .32, fy + .08, fy + .92, fz + 1.15, fz + 1.93, (y, z) => { const r = Math.hypot(y - fy - .5, z - fz - 1.54); return r < .36 ? (r > .32 || ((Math.atan2(z - fz - 1.54, y - fy - .5) * 3 / Math.PI + 9) % 1) < .35 ? rgb(40, 44, 34) : rgb(70, 76, 60)) : 0; });
}
// military era: tool lockers against the left wall, a jackhammer stood beside them
function toolLockers(fz, g) {
  const x0 = UG.x0 + .02, x1 = x0 + .45, y0 = yb(6.3), y1 = y0 + 1.0, c = mat([86, 98, 72], g);
  sbox(x0, y0, fz, x1, y1, fz + 1.75, c, 1250);
  onX(x1, y0, y1, fz + .04, fz + 1.71, (y, z) => { const f = (y - y0) / .333, d = f - Math.floor(f), zz = z - fz; if (d < .06) return rgb(50, 60, 44); if (zz > 1.4 && zz < 1.58 && (Math.floor(zz * 40) & 1) && d > .25 && d < .75) return rgb(50, 60, 44); if (Math.abs(zz - .95) < .05 && d > .76 && d < .88) return rgb(200, 204, 196); return 0; });
  const jx = x1 + .17, jy = y0 + .5;
  fbox(jx - .06, jy - .06, fz, jx + .06, jy + .06, fz + .7, [150, 156, 164], 1251); fbox(jx - .2, jy - .03, fz + .62, jx + .2, jy + .03, fz + .68, DARK, 1252); fbox(jx - .01, jy - .01, fz - .02, jx + .01, jy + .01, fz + .02, DARK, 1253);
  footShadow(x0, y0, x1, y1, 1.75);
}

/* ---------- the floor plan: each part's drawing by era and stage ---------- */
// MINE_ART[part][era][stage] draws that stage (fz, grade, look); stage 0 of the first era is the level-1 room.
// A stage not drawn yet shows the last one drawn before it, a material grade up (drawPart)
const MINE_ART = {
  light: [[mineLantern, carbideLamps], [cagedLights]],
  supports: [[(fz, g, look) => minePillars(fz, look), timbering], [steelArches]],
  rails: [[fz => mineRubble(fz, [0, 1, 2, 3, 4, 5]), barrows, woodRails], [steelRails]],
  drill: [[windlass, jackFrame, steelTower], [coreRig]],
  conveyor: [[null, woodChute], [beltLine]],
  crusher: [[null, sortScreen], [jawCrusher]],
  storage: [[], [oreBins]],
  power: [[], [fieldGen]],
  vent: [[], [ventDuct]],
  tools: [[], [toolLockers]],
};
function buildMineFloor(fz, L, look) {
  if (!L) { for (const [a, b] of [[3.4, 1.4], [7.6, 1.4], [1.4, 5]]) lamp(2, XA(a), yb(b), fz); rubbleAt(fz, 2); return; }
  drawPart(MINE_ART, 'light', look, fz);
  storeLamp(2, fz);
  for (const k in MINE_ART) if (k !== 'light') drawPart(MINE_ART, k, look, fz);
}

// the walks of floor k's workers, from the foot of the ladder through via to each spot
function workWalks(k) {
  const out = [];
  for (let n = 0; n < 5; n++) { const s = (k === 1 ? farmSpot : mineSpot)(n), p = [{ x: SHAFT.x, y: LADDER_Y }, ...(s.via || []), s]; for (let i = 1; i < p.length; i++) out.push([p[i - 1], p[i]]); }
  return out;
}
const distToSeg = (x, y, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(x - a.x - dx * t, y - a.y - dy * t); };
function rubbleAt(fz, k) {
  // a floor not dug out yet: heaps of earth and a shovel, with the workers' walks already trodden clear
  const walks = workWalks(k);
  for (let n = 0; n < 34; n++) {
    const x = lerp(XA(2.2), XA(RL() - 3.6), hash(n, 3.1)), y = lerp(yb(1.6), UG.y1 - .6, hash(5.7, n)), r = .25 + hash(n, 7) * .32;
    if (walks.some(([a, b]) => distToSeg(x, y, a, b) < r + .35)) continue;
    fbox(x - r, y - r * .8, fz, x + r, y + r * .8, fz + r * .8, n % 4 ? SOIL : SOIL_D, n);
  }
  const sx = XA(RL() * .5), sy = yb(RL() * .5);
  fbox(sx, sy, fz + .2, sx + .06, sy + .06, fz + 1.3, WOOD, 5); fbox(sx - .1, sy - .02, fz + .05, sx + .14, sy + .08, fz + .3, METAL, 6);
}
/* ================= the store piles ================= */
// what you hold, piled in each floor's store at the right end; n is the pile size (0..20) from stockLevel(), and
// every step adds pieces you can see. Money: coin stacks, coin bags, gold bars, a gold heap, the safe spilling
// gold. Food: sacks, crates of produce, shelves of cans filling up, a full pantry wall. Ore: chunks, crates of
// blue ore, a heap, steel bins, a big glowing heap. (u runs left from the floor's right end, v out from the back wall)

const GOLD_C = [232, 186, 58], GOLD_L = [250, 214, 96], COIN_EDGE = rgb(176, 128, 36);
function coinStack(u, v, fz, n, seed) {
  const x = SX(u), y = SY(v), h = n * .035;
  fbox(x - .1, y - .1, fz, x + .1, y + .1, fz + h, GOLD_C, seed, .5);
  onY(y + .1, x - .1, x + .1, fz, fz + h, (xx, z) => ((z - fz) % .035) < .012 ? COIN_EDGE : 0);
  onX(x + .1, y - .1, y + .1, fz, fz + h, (yy, z) => ((z - fz) % .035) < .012 ? rgb(120, 84, 24) : 0);
  onZ(fz + h, x - .06, y - .06, x + .06, y + .06, rgb(255, 230, 130));
}
function coinBag(u, v, fz, s, seed) {
  const x = SX(u), y = SY(v), w = .17 * s, h = .36 * s;
  fbox(x - w, y - w * .85, fz, x + w, y + w * .85, fz + h, [196, 168, 112], seed);
  fbox(x - w * .55, y - w * .45, fz + h, x + w * .55, y + w * .45, fz + h + .07 * s, [196, 168, 112], seed + 1);
  fbox(x - w * .3, y - w * .25, fz + h + .07 * s, x + w * .3, y + w * .25, fz + h + .13 * s, [140, 100, 50], seed + 2);
  const D = ['.XXX', 'X.X.', '.XX.', '.X.X', 'XXX.'];
  onY(y + w * .85, x - w * .5, x + w * .5, fz + h * .2, fz + h * .8, (xx, z) => { const c = Math.floor((xx - x + w * .5) / (w * 1.0) * 4), r = 4 - Math.floor((z - fz - h * .2) / (h * .6) * 5); return D[r] && D[r][c] === 'X' ? rgb(176, 120, 30) : 0; });
  pt(x + w * .5, y + w * .85, fz + h + .04, rgb(250, 220, 110));
}
function goldBar(x, y, z, alongY, seed) {
  const [a, b] = alongY ? [.08, .17] : [.17, .08];
  fbox(x - a, y - b, z, x + a, y + b, z + .08, GOLD_C, seed, .4);
  fbox(x - a + .03, y - b + .03, z + .08, x + a - .03, y + b - .03, z + .11, GOLD_L, seed + 1, .3);
  pt(x - a + .05, y + b - .02, z + .1, glowc(255, 250, 220));
}
function goldHeap(u, v, fz, layers, seed) {
  const x = SX(u), y = SY(v);
  for (let k = 0; k < layers; k++) {
    const r = .5 - k * .08, z = fz + k * .1;
    for (let j = 0; j < 10 + k * 2; j++) {
      const a = hash(j, k + seed) * 6.28, d = Math.sqrt(hash(seed, j + k * 9)) * r, cx = x + Math.cos(a) * d * 1.1, cy = y + Math.sin(a) * d * .9;
      fbox(cx - .07, cy - .07, z, cx + .07, cy + .07, z + .1, hash(j, k) > .5 ? GOLD_C : GOLD_L, seed + j + k * 20, .4);
    }
    fbox(x - r * .8, y - r * .62, z, x + r * .8, y + r * .62, z + .1, GOLD_C, seed + k, .5);
  }
  for (let j = 0; j < layers * 3; j++) { const a = hash(j, 77) * 6.28, d = hash(78, j) * .5; pt(x + Math.cos(a) * d, y + Math.sin(a) * d * .8, fz + .02 + hash(j, 79) * layers * .1, glowc(255, 252, 230)); }
  for (let j = 0; j < 8 + layers * 2; j++) { const a = hash(j, 81) * 6.28, d = .45 + hash(82, j) * .25; const cx = x + Math.cos(a) * d * 1.1, cy = y + Math.sin(a) * d * .9; fbox(cx - .05, cy - .05, fz, cx + .05, cy + .05, fz + .035, GOLD_C, 90 + j, .4); }
}
function safe(u, v, fz, open, spill) {
  const x = SX(u), y = SY(v), w = .48, d = .34, h = 1.15, body = [76, 90, 84];
  sbox(x - w, y - d, fz, x + w, y + d, fz + h, body, 300);
  onX(x + w, y - d, y + d, fz + .06, fz + h - .06, (yy, z) => Math.abs(yy - y) > d - .05 || Math.abs(z - fz - h / 2) > h / 2 - .1 ? rgb(56, 66, 62) : 0);
  if (!open) {
    onY(y + d, x - w + .06, x + w - .06, fz + .06, fz + h - .06, (xx, z) => { const u2 = xx - x, v2 = z - fz - .62; if (Math.abs(u2) < .12 && Math.abs(v2) < .12) return Math.abs(u2) < .03 || Math.abs(v2) < .03 ? rgb(220, 220, 214) : rgb(150, 156, 152); if (Math.abs(u2 - .3) < .03 && Math.abs(v2) < .2) return rgb(200, 200, 194); return Math.abs(u2) > w - .1 || Math.abs(z - fz - h / 2) > h / 2 - .1 ? rgb(60, 72, 66) : 0; });
    return;
  }
  onY(y + d, x - w + .06, x + w - .06, fz + .08, fz + h - .08, (xx, z) => ((z - fz) % .36) < .04 ? rgb(70, 64, 54) : rgb(40, 34, 30));
  for (const z of [.08, .44, .8]) for (let k = 0; k < 4; k++) goldBar(x - w + .22 + k * .22, y + d - .1, fz + z, true, 310 + k);
  sbox(x + w, y + d - .04, fz, x + w + .06, y + d + .7, fz + h, [86, 100, 94], 320);
  onX(x + w + .06, y + d, y + d + .7, fz + .1, fz + h - .1, (yy, z) => { const u2 = yy - y - d - .35, v2 = z - fz - .6; return Math.abs(u2) < .12 && Math.abs(v2) < .12 ? (Math.abs(u2) < .03 || Math.abs(v2) < .03 ? rgb(220, 220, 214) : rgb(150, 156, 152)) : 0; });
  if (spill) for (let j = 0; j < 14 + spill * 8; j++) { const a = hash(j, 91) * 2.4 - 1.2, dd = .1 + hash(92, j) * (.5 + spill * .3); const cx = x + Math.sin(a) * dd * .8, cy = y + d + .1 + Math.cos(a) * dd; fbox(cx - .05, cy - .05, fz, cx + .05, cy + .05, fz + .03 + hash(j, 93) * .05, j % 3 ? GOLD_C : GOLD_L, 400 + j, .4); }
}
function moneyPile(n, fz) {
  // front: coin stacks (1-4); back: bags (5-8); middle: bars (9-12), the heap (13-16); the safe (17-20)
  const stacks = [[.7, 2.7, 6], [1.1, 2.9, 9], [.45, 3.0, 4], [1.45, 2.65, 7], [.85, 3.15, 3], [1.75, 2.95, 5], [1.25, 3.2, 10]];
  const ns = n >= 4 ? 7 : [0, 1, 2, 4][n];
  for (let k = 0; k < ns; k++) { const [u, v, h] = stacks[k]; coinStack(u, v, fz, h + Math.min(10, Math.max(0, n - 4)) * (k & 1 ? .6 : .4), 200 + k); }
  if (n >= 5) { const bags = [[2.2, .35], [1.8, .3], [2.35, .78], [1.95, .72], [1.58, .66]]; for (let k = 0; k < Math.min(4, n - 4) + (n >= 16 ? 1 : 0); k++) coinBag(bags[k][0], bags[k][1], fz, 1 + Math.min(.3, Math.max(0, n - 12) * .05), 220 + k * 5); }
  if (n >= 9) { const rows = Math.min(3, n - 8); for (let r = 0; r < rows; r++) for (let k = 0; k < 3 - r; k++) goldBar(SX(1.25 - k * .36 - r * .18), SY(1.75), fz + r * .11, false, 250 + r * 8 + k); if (n >= 12) for (let k = 0; k < 3; k++) goldBar(SX(1.3 - k * .2), SY(2.1), fz, true, 270 + k); }
  if (n >= 13) goldHeap(1.95, 1.55, fz, Math.min(4, n - 12) + (n >= 19 ? 1 : 0) + (n >= 20 ? 1 : 0), 280);
  if (n >= 17) safe(.62, .45, fz, n >= 18, n >= 19 ? n - 18 : 0);
  if (n >= 20) { EM = 1; for (const [u, v] of [[1.6, .3], [2.0, 1.5], [.4, 1.2]]) { const x = SX(u), y = SY(v); fbox(x - .06, y - .06, fz, x + .06, y + .06, fz + .1, [220, 60, 80], 290, .3); } EM = 0; }
}
const CANS = [[200, 60, 50], [60, 120, 190], [220, 180, 60], [80, 150, 80], [210, 120, 50], [150, 80, 160]];
function cans(x0, x1, y, z, seed, full) {
  for (let x = x0 + .04, k = 0; x < x1 - .1; x += .13, k++) {
    if (hash(k, seed) > full) continue;
    const c = CANS[Math.floor(hash(seed, k) * 6)], h = .14 + (k % 3 === 0 ? .04 : 0);
    sbox(x, y - .06, z, x + .1, y + .06, z + h, [200, 200, 196], seed + k);
    onY(y + .06, x, x + .1, z + .03, z + h - .03, rgb(...c));
  }
}
function pantryShelf(u, fz, fill, seed) {
  const x0 = SX(u + 1.15), x1 = SX(u), y0 = SY(.02), y1 = SY(.38), top = 2.1;
  for (const x of [x0, x1 - .06]) fbox(x, y0, fz, x + .06, y1, fz + top, WOOD, seed);
  const shelves = [.08, .55, 1.02, 1.49, 1.96];
  shelves.forEach((z, k) => fbox(x0, y0, fz + z, x1, y1, fz + z + .04, PLANK, seed + 1 + k));
  for (let k = 0; k < 4; k++) {
    const f = clamp(fill - k, 0, 1);
    if (f <= 0) continue;
    const z = fz + shelves[k] + .04;
    if (k === 2 && fill > 3) { for (let j = 0; j < 5; j++) { const jx = x0 + .12 + j * .2; sbox(jx, y0 + .1, z, jx + .14, y0 + .24, z + .2, [200, 220, 200], seed + 20 + j); fbox(jx, y0 + .1, z + .2, jx + .14, y0 + .24, z + .24, [200, 60, 50], seed + 30 + j); onY(y0 + .24, jx + .02, jx + .12, z + .02, z + .14, rgb(...[[230, 120, 40], [200, 50, 60], [240, 200, 60]][j % 3])); } continue; }
    cans(x0 + .02, x1 - .02, (y0 + y1) / 2, z, seed + 40 + k * 13, f);
  }
}
function foodSack(u, v, z, s, seed, c = [226, 218, 196]) {
  const x = SX(u), y = SY(v), w = .21 * s, h = .46 * s;
  fbox(x - w, y - w * .8, z, x + w, y + w * .8, z + h, c, seed, .6);
  onY(y + w * .8, x - w, x + w, z + h * .3, z + h * .62, (xx, zz) => Math.abs(zz - z - h * .46) < h * .05 ? rgb(236, 230, 214) : seed % 3 ? rgb(190, 50, 44) : rgb(60, 100, 170));
  fbox(x - w * .5, y - w * .4, z + h, x + w * .5, y + w * .4, z + h + .06 * s, c, seed + 1);
  fbox(x - w * .2, y - w * .2, z + h + .06 * s, x + w * .2, y + w * .2, z + h + .12 * s, [150, 120, 80], seed + 2);
}
const PRODUCE = [[120, 180, 90], [214, 50, 40], [232, 120, 40], [190, 40, 50], [176, 140, 90], [240, 210, 70]];
function foodPile(n, fz) {
  const sacks = [[.7, 2.75, 1, 0], [1.2, 2.95, 1.05, 0], [.5, 3.1, .95, 0], [1.0, 3.2, 1, 0], [.85, 2.95, .9, .46], [1.65, 3.1, 1, 0], [1.4, 2.75, .9, 0]];
  const ns = n >= 4 ? (n >= 19 ? 7 : n >= 15 ? 6 : 4) : n;
  for (let k = 0; k < ns; k++) { const [u, v, s, z] = sacks[k]; foodSack(u, v, fz + z, s, 500 + k * 4, k % 2 ? [214, 204, 180] : [230, 222, 200]); }
  if (n >= 5) { const crates = [[1.55, 1.5], [2.05, 1.55], [1.8, 2.05], [2.3, 2.1]]; for (let k = 0; k < Math.min(4, n - 4); k++) crateOf(SX(crates[k][0]), SY(crates[k][1]), fz, .21, PRODUCE[k], 540 + k * 6); if (n >= 17) for (let k = 0; k < 3; k++) crateOf(SX(crates[k][0]), SY(crates[k][1]), fz + .59, .19, PRODUCE[k + 3], 570 + k * 6); }
  if (n >= 9) pantryShelf(.1, fz, Math.min(4, n - 8 + (n >= 13 ? 0 : 0)), 600);
  if (n >= 13) pantryShelf(1.3, fz, Math.min(4, n - 12), 650);
  if (n >= 18) { barrel(SX(2.45), SY(.6), fz, [150, 104, 64], .75, 700); for (let k = 0; k < 6; k++) sbox(SX(2.62) + (k % 3) * .12, SY(1.0) + (k > 2) * .12, fz, SX(2.62) + (k % 3) * .12 + .1, SY(1.0) + (k > 2) * .12 + .1, fz + .26, [150, 210, 240], 710 + k); }
  if (n >= 20) { const z = fz + 2.16; fbox(SX(2.45), SY(.5), z, SX(.1), SY(.56), z + .05, WOOD_D, 719); for (let k = 0; k < 7; k++) { const x = SX(.25 + k * .32); ln([x, SY(.53), z], [x, SY(.53), z - .22], rgb(120, 100, 70)); fbox(x - .04, SY(.49), z - .42, x + .04, SY(.57), z - .22, k % 2 ? [176, 70, 50] : [236, 226, 200], 720 + k); } }
}
function oreHeap(u, v, fz, layers, seed, glow) {
  const x = SX(u), y = SY(v);
  for (let k = 0; k < layers; k++) {
    const r = .75 - k * .12, z = fz + k * .14;
    fbox(x - r * .85, y - r * .7, z, x + r * .85, y + r * .7, z + .14, [88, 112, 150], seed + k);
    for (let j = 0; j < 9 + k; j++) { const a = hash(j, k + seed) * 6.28, d = Math.sqrt(hash(seed, j + k * 7)) * r, cx = x + Math.cos(a) * d * .95, cy = y + Math.sin(a) * d * .8; oreChunk(cx, cy, z + .1, .09, seed + j * 3 + k * 40, hash(j, k * 3) > .2); }
  }
  if (glow) {
    EM = 1;
    for (let j = 0; j < 4 + glow * 3; j++) { const a = hash(j, 61) * 6.28, d = hash(62, j) * .4, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * .8, h = .25 + hash(j, 63) * .3 + glow * .05, z = fz + Math.max(0, layers - 1 - d * 6) * .14 + .1; fbox(cx - .05, cy - .05, z, cx + .05, cy + .05, z + h, [150, 236, 255], seed + 90 + j, .4); fbox(cx + .05, cy - .03, z, cx + .1, cy + .03, z + h * .6, [110, 210, 250], seed + 120 + j, .4); }
    EM = 0;
    // a blue glow on the floor round the heap (a tint over the ground, laid with the pile)
    const p = project(x, y, fz), rx = (1.3 + glow * .15) * S, ry = rx * .55;
    for (let iy = Math.max(0, Math.floor(p.sy - ry)); iy <= Math.min(H - 1, Math.ceil(p.sy + ry)); iy++) for (let ix = Math.max(0, Math.floor(p.sx - rx)); ix <= Math.min(W - 1, Math.ceil(p.sx + rx)); ix++) {
      const dx = (ix + .5 - p.sx) / rx, dy = (iy + .5 - p.sy) / ry, q = 1 - (dx * dx + dy * dy) + bay(ix, iy) * .2;
      if (q <= 0) continue;
      const i = iy * W + ix;
      if (zb[i] !== groundZ[i] || !ground[i]) continue;
      pix[i] = rgb(128 + 30 * q, 128 + 70 * q, 128 + 110 * q);
    }
  }
}
function oreBin(u, v, fz, seed, glow) {
  const x = SX(u), y = SY(v), w = .3, h = .62;
  sbox(x - w, y - w * .9, fz, x + w, y + w * .9, fz + h, [92, 100, 110], seed);
  onY(y + w * .9, x - w, x + w, fz, fz + h, (xx, z) => Math.abs(z - fz - h + .08) < .03 || Math.abs(xx - x) > w - .04 ? rgb(70, 76, 84) : Math.abs(xx - x) < .1 && Math.abs(z - fz - .32) < .06 ? rgb(226, 186, 50) : 0);
  for (let j = 0; j < 6; j++) oreChunk(x - w + .12 + (j % 3) * .18, y - w * .5 + (j > 2) * .25, fz + h - .04, .07, seed + j * 3, true);
  if (glow) { EM = 1; fbox(x - .05, y - .05, fz + h + .05, x + .05, y + .05, fz + h + .3, [150, 236, 255], seed + 30, .4); EM = 0; }
}
function mineralPile(n, fz) {
  const chunks = [[.7, 2.4], [1.1, 2.6], [.5, 2.75], [1.4, 2.35], [.9, 2.9], [1.25, 2.95]];
  const nc = n >= 4 ? 6 : [0, 1, 2, 4][n];
  for (let k = 0; k < nc; k++) oreChunk(SX(chunks[k][0]), SY(chunks[k][1]), fz, .13 + (k % 3) * .03, 800 + k * 3, true);
  if (n >= 5) { const crates = [[2.2, 2.35], [1.85, 2.75], [2.3, 2.95], [2.0, 2.0]]; for (let k = 0; k < Math.min(4, n - 4); k++) crateOf(SX(crates[k][0]), SY(crates[k][1]), fz, .18, ORE, 820 + k * 6); }
  if (n >= 9) oreHeap(1.3, 1.25, fz, Math.min(4, n - 8) + (n >= 17 ? Math.min(3, n - 16) : 0), 840, n >= 17 ? n - 16 : 0);
  if (n >= 13) { const bins = [[.45, .45], [1.15, .42], [1.85, .45], [2.45, .5]]; for (let k = 0; k < Math.min(4, n - 12); k++) oreBin(bins[k][0], bins[k][1], fz, 900 + k * 40, n >= 18 && k < n - 17); }
}
function buildStock(kind, n, fz) {
  if (!n) return;
  if (kind === 'money') moneyPile(n, fz);
  else if (kind === 'food') foodPile(n, fz);
  else mineralPile(n, fz);
}
layoutFloors();
