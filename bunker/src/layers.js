'use strict';
// Baked overlays. The big bakes (the ground, the buildings, the floors) are slow, so whatever changes during
// play (each side of the fence as it takes damage, the stock piles below) is baked once per state into a
// small overlay: the pixels it covers, with their depth, and how it darkens the ground around it (contact
// occlusion and shadow). Laying overlays on a baked picture is a few thousand writes instead of a new bake.
const NEUTRAL = rgb(128, 128, 128);
// draw() paints into the engine buffers over bare ground (baseGZ: ground depth, -1e9 where there is none);
// post(i, color) may adjust object colours (the lamp light below ground)
function captureOverlay(baseGZ, baseGround, draw, post) {
  zb.set(baseGZ); groundZ.set(baseGZ); ground.set(baseGround); pix.fill(NEUTRAL); shadowMask.fill(0);
  const g0 = GLOWS.length;
  draw();
  const glows = GLOWS.splice(g0);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < zb.length; i++) if (zb[i] !== baseGZ[i]) {
    const x = i % W, y = (i / W) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const empty = { oi: new Int32Array(0), od: new Float32Array(0), oc: new Uint32Array(0), ti: new Int32Array(0), tc: new Uint32Array(0), glows };
  if (x1 < 0) return empty;
  // shadows fall up to about two units away from what casts them
  const m = 2 * S;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m);
  bakeOcclusion(x0, y0, x1 + 1, y1 + 1);
  applyShadows(groundZ);
  const oi = [], od = [], oc = [], ti = [], tc = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x;
    if (zb[i] !== baseGZ[i]) { oi.push(i); od.push(zb[i]); oc.push(post ? post(i, pix[i]) : pix[i]); }
    else if (baseGround[i] && pix[i] !== NEUTRAL) { ti.push(i); tc.push(pix[i]); }
  }
  return { oi: Int32Array.from(oi), od: Float32Array.from(od), oc: Uint32Array.from(oc), ti: Int32Array.from(ti), tc: Uint32Array.from(tc), glows };
}
// lay overlays on a picture: every object pixel first (depth tested), then the darkening of whatever ground
// is still showing. SH (optional) marks shaded ground, so grass tufts there are drawn dark too
function layOverlays(list, P, Z, GZ, SH) {
  for (const ov of list) {
    const { oi, od, oc } = ov;
    for (let n = 0; n < oi.length; n++) { const i = oi[n]; if (od[n] > Z[i]) { Z[i] = od[n]; P[i] = oc[n]; } }
  }
  for (const ov of list) {
    const { ti, tc } = ov;
    for (let n = 0; n < ti.length; n++) {
      const i = ti[n];
      if (Z[i] !== GZ[i]) continue;
      const c = P[i], t = tc[n];
      P[i] = rgb((c & 255) * (t & 255) / 128, (c >> 8 & 255) * (t >> 8 & 255) / 128, (c >> 16 & 255) * (t >> 16 & 255) / 128);
      if (SH) SH[i] = 1;
    }
  }
}
// pixel bounds of everything drawn over the ground, for bakes that only re-shade around their objects
function objectBounds(refZ, pad) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < zb.length; i++) if (zb[i] !== refZ[i]) {
    const x = i % W, y = (i / W) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(W, x1 + pad + 1), Math.min(H, y1 + pad + 1)];
}

// After an upgrade, whatever it changed in the picture flashes warm white for a couple of seconds, so it is
// easy to see what grew. (Sprites are drawn over the flash, so only the buildings and rooms light up.)
// bumped whenever a new picture goes behind the actors (showYard / showUnder), so the kept ground frame in
// loop.js knows it is stale
let bakedVersion = 0;
let flash = null;
function flashDiff(before, after, view, floor = 0) {
  const idx = [];
  for (let i = 0; i < after.length; i++) if (before[i] !== after[i]) idx.push(i);
  if (!idx.length) return;
  // a few twinkles scattered over what changed, so the eye finds it at once
  const stars = [];
  for (let n = 0; n < Math.min(14, Math.ceil(idx.length / 40)); n++) { const i = idx[Math.floor(Math.random() * idx.length)]; stars.push(i % W, (i / W) | 0, Math.random()); }
  flash = { idx: Int32Array.from(idx), stars, until: G.time + 2.4, view, floor };
}
function applyFlash(view) {
  if (!flash || flash.view !== view || (view === 'under' && flash.floor !== (G.floorView || 0))) return;
  const left = flash.until - G.time;
  if (left <= 0) { flash = null; return; }
  const k = (Math.sin(G.time * 11) * .5 + .5) * Math.min(1, left / .8) * .6, idx = flash.idx;
  for (let n = 0; n < idx.length; n++) {
    const i = idx[n], c = pix[i], r = c & 255, g = c >> 8 & 255, b = c >> 16 & 255;
    pix[i] = rgb(r + (255 - r) * k, g + (248 - g) * k, b + (196 - b) * k);
  }
  // the twinkles: small four-point stars that blink on and off
  const st = flash.stars;
  for (let n = 0; n < st.length; n += 3) {
    const on = Math.sin(G.time * 9 + st[n + 2] * 6.28) > -.2;
    if (!on) continue;
    const x = st[n], y = st[n + 1], arm = left > 1.2 ? 2 : 1;
    for (let a = -arm; a <= arm; a++) for (const [dx, dy] of [[a, 0], [0, a]]) {
      const px = x + dx, py = y + dy;
      if (px >= 0 && py >= 0 && px < W && py < H) pix[py * W + px] = Math.abs(a) === arm ? rgb(255, 214, 90) : rgb(255, 255, 240);
    }
  }
}
