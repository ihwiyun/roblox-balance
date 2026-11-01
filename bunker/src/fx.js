'use strict';
// Particles, ground decals, floating numbers and the pixel font.
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
const floorAt = (x, y) => { const F = bunkerInfo(); return Math.abs(x) < F.deck && Math.abs(y) < F.deck ? F.roof : 0; };
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
  let n = 0;
  for (const ch of text) if (GLYPHS[ch]) n++;
  const x0 = Math.round(cx - (n * 4 - 1) / 2), y0 = Math.round(top);
  // two passes over the glyph bits: a dark outline around every lit cell, then the cells themselves
  for (let pass = 0; pass < 2; pass++) {
    let k = 0;
    for (const ch of text) {
      const g = GLYPHS[ch];
      if (!g) continue;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
        if (g[y][x] !== '1') continue;
        const px = x0 + k * 4 + x, py = y0 + y;
        if (pass === 0) {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const ix = px + dx, iy = py + dy; if (ix >= 0 && iy >= 0 && ix < W && iy < H) pix[iy * W + ix] = INK; }
        } else if (px >= 0 && py >= 0 && px < W && py < H) pix[py * W + px] = color;
      }
      k++;
    }
  }
}
