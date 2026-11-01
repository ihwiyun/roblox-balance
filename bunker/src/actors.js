'use strict';
// Drawing people and zombies from their sprites, with the gun, the ammo and health bars.
/* ================= drawing people and zombies ================= */
// which way a figure faces: front frames look down-right; back frames look up-left; mirrored for the rest
function facingOf(yaw) { const fx = Math.cos(yaw), fy = Math.sin(yaw), u = fx - fy, v = fx + fy; return v >= 0 ? { view: 'F', mirror: u < 0 } : { view: 'B', mirror: u > 0 }; }
const palCache = new Map();
function gearOf(c) {
  const f = gearTier(), gunner = c.hero || c.job === '사수';
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
// 32x32 survivors: what the body is doing, as an animation name and a frame
function personFrame(c, set, gunner) {
  const loop = (name, t) => { const a = set.anims[animOf(set, name)]; return [animOf(set, name), Math.floor(t * a.fps) % a.F.length]; };
  const once = (name, f) => { const a = set.anims[animOf(set, name)]; return [animOf(set, name), Math.min(a.F.length - 1, Math.floor(clamp(f, 0, .999) * a.F.length))]; };
  if (c.anim === 'climb' && c.path.length && c.path[0].mode === 'climb') return loop('climb', c.walk / .9);
  if (c.path.length) return loop('walk', c.walk / 1.05);
  if (gunner) {
    if (c.reload > 0) return once('reload', 1 - c.reload / c.reloadLen);
    if (c.recoil > .02 && set.anims.shoot) return once('shoot', 1 - c.recoil / .12);
    return loop('aim', G.time + (c.i || 0) * .37);
  }
  if (c.job === '농부') return loop('farm', c.act);
  if (c.job === '광부') return loop('mine', c.act);
  return loop('idle', G.time);
}
function drawPerson(c) {
  if (window.ART_HUMANS) return drawSurvivor(c);
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
function drawSurvivor(c) {
  const { view, mirror } = facingOf(c.yaw), gear = gearOf(c), pal = palFor(c, gear), gunner = c.hero || c.job === '사수';
  const set = SPR[gear.body], [anim, idx] = personFrame(c, set, gunner);
  const info = drawSprite(gear.body, anim, view, idx, mirror, c.x, c.y, c.z, pal);
  const fr = info.fr, front = view === 'F';
  if (fr.head) {
    // the person's own face, then the headgear over the hair
    const [hx, hy] = frameSpot(info, fr.head), d = info.p.d + (set.ay - fr.head[1]) * perPx + .06;
    const head = ART_HUMANS.heads[c.look.key] || ART_HUMANS.heads.hero;
    stampAnchored(head, head[view], hx, hy, mirror, pal, d);
    const hat = gear.head && ART_HUMANS.gear[gear.head];
    if (hat) stampAnchored(hat, hat[view], hx, hy, mirror, pal, d + .01);
  }
  if (fr.gun && gunner) {
    // the rifle sits at the hands' depth: in front of the body when facing us, behind it when facing away
    const a = frameSpot(info, [fr.gun[0], fr.gun[1]]), b = frameSpot(info, [fr.gun[2], fr.gun[3]]);
    c.muzzle = drawGun(a, b, info.p.d + (set.ay - fr.gun[1]) * perPx + .02 + (front ? .12 : -.12), c);
  }
  if (fr.mag) { const [mx, my] = frameSpot(info, fr.mag), x0 = info.mirror ? mx - 1 : mx; for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) putPx(x0 + x, my + y, y ? rgb(52, 50, 58) : rgb(200, 160, 70), info.p.d + 1); }
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
  const k = SPR.human.h / 20, g = gunLook(G.lv.atk), dx = b[0] - a[0], dy = b[1] - a[1], L0 = Math.hypot(dx, dy) || 1, ux = dx / L0, uy = dy / L0, nx = -uy, ny = ux, len = Math.round(g.len * k);
  const end = [Math.round(a[0] + ux * len), Math.round(a[1] + uy * len)];
  const body = g.paint === 'gold' ? rgb(226, 182, 66) : g.paint === 'camo' ? rgb(104, 112, 74) : rgb(46, 44, 50);
  const accent = g.paint === 'glow' ? rgb(120, 230, 255) : g.paint === 'gold' ? rgb(255, 230, 140) : g.paint === 'wood' ? rgb(124, 86, 54) : rgb(70, 70, 78);
  const at = t => [Math.round(a[0] + ux * len * t), Math.round(a[1] + uy * len * t)];
  // stock, receiver, barrel
  const st = [Math.round(a[0] - ux * 2 * k), Math.round(a[1] - uy * 2 * k)];
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
// which animation and frame a zombie shows: tricks (leap, dig, come up, spit, scream, stomp) take over,
// a regenerator glows while it heals, a hit makes it flinch; walking frames follow the distance walked
function zombieFrame(z, T, set) {
  const pick = (name, progress) => { const a = set.anims[animOf(set, name)], n = a.F.length; return [animOf(set, name), Math.min(n - 1, Math.floor(clamp(progress, 0, .999) * n))]; };
  const loopAt = (name, t) => { const a = set.anims[animOf(set, name)]; return [animOf(set, name), Math.floor(t * a.fps) % a.F.length]; };
  if (z.state === 'dying') { const a = set.anims[animOf(set, 'die')]; return [animOf(set, 'die'), Math.min(a.F.length - 1, Math.floor(z.t * Math.max(a.fps, 7)))]; }
  if (z.state === 'leap') return pick('leap', z.st / z.leap.dur);
  if (z.state === 'dig' || z.state === 'emerge') return pick(z.state, z.st / .8);
  if (z.state === 'attack') {
    const name = T.special === 'spit' ? 'spit' : T.special === 'scream' ? 'scream' : T.special === 'boss' ? 'stomp' : 'attack';
    return pick(name, z.atk / T.every);
  }
  if (z.hit > .03 && set.anims.hit) return ['hit', 0];
  if (z.healing && set.anims.regen) return loopAt('regen', z.t);
  // one walk cycle per stride: the frame follows the distance walked, so the feet stay planted
  const a = set.anims.walk;
  return ['walk', Math.floor(z.walkDist / Math.max(.05, z.speed) * a.fps) % a.F.length];
}
function drawZombie(z) {
  const T = ZTYPES[z.type], set = SPR[z.type];
  // underground: only a mound of earth moves, and nobody can shoot it
  if (z.under) {
    const m = SPR.mound;
    if (m) { const name = Object.keys(m.anims)[0], a = m.anims[name]; drawSprite('mound', name, 'F', Math.floor(z.t * a.fps), false, z.x, z.y, 0, ZPALS.mound, { shadow: false }); }
    else { const p = project(z.x, z.y, 0); for (let k = 0; k < 9; k++) putPx(Math.round(p.sx) + (k % 3) - 1, Math.round(p.sy) - Math.floor(k / 3), k % 2 ? rgb(120, 96, 66) : rgb(92, 72, 50), p.d + .1); }
    z.sx = -99; z.sy = -99;
    return;
  }
  const { view, mirror } = facingOf(z.yaw);
  const [anim, idx] = zombieFrame(z, T, set);
  const fade = z.state === 'dying' ? clamp(4.4 - z.t, 0, 1) : clamp((FIELD + .7 - z.n) / 1.0, 0, 1);
  if (fade <= 0) return;
  const v = set.anims[anim][view] ? view : 'F';
  const info = drawSprite(z.type, anim, v, idx, mirror, z.x, z.y, z.zh || 0, ZPALS[z.type], { hit: z.hit > 0, fade });
  z.sx = info.bx; z.sy = info.by - Math.round(set.ay * .5); z.top = info.by - set.ay + 1;
  // the rage of a scream shows as red eyes; a healing regenerator sparkles
  if (z.rage > 0 && Math.floor(z.t * 6) % 2) putPx(info.bx + (mirror ? -1 : 1), z.top + 3, rgb(255, 60, 40), info.p.d + 1);
  if (z.healing && Math.random() < .3) part(z.x + (Math.random() - .5) * .4, z.y + (Math.random() - .5) * .4, .6 + Math.random(), 0, 0, .8, .4, rgb(255, 120, 110), rgb(200, 60, 60), 1, 1);
}
function drawBars() {
  for (const z of G.zombies) {
    if (z.state === 'dying' || z.hp >= z.max || !z.visible) continue;
    const boss = z.type === 'boss', big = BIG[z.type], w = boss ? 26 : big ? 14 : 9, left = Math.round(z.sx - w / 2), top = z.top - 4, fill = Math.ceil(w * clamp(z.hp / z.max, 0, 1));
    const color = boss ? rgb(230, 60, 50) : big || z.type === 'armored' ? rgb(220, 110, 60) : z.healing ? rgb(240, 120, 120) : rgb(120, 196, 88);
    for (let k = -1; k <= w; k++) for (let r = -1; r <= (boss ? 2 : 1); r++) {
      const ix = left + k, iy = top + r;
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
      pix[iy * W + ix] = r >= 0 && r <= (boss ? 1 : 0) && k >= 0 && k < w ? (k < fill ? color : rgb(70, 66, 64)) : INK;
    }
  }
}
function drawAmmo(s) {
  // only the reload bar over the head: the bullet count is the number at the bottom right
  if (!(s.reload > 0)) return;
  const p = project(s.x, s.y, s.z), cx = Math.round(p.sx), top = Math.round(p.sy) - 40;
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) pix[y * W + x] = c; };
  const w = 16, left = cx - 8, fill = Math.round(w * (1 - s.reload / s.reloadLen));
  for (let x = -1; x <= w; x++) for (let y = -1; y <= 1; y++) put(left + x, top + y, x < 0 || x >= w || y !== 0 ? INK : x < fill ? SIGNAL : rgb(70, 66, 64));
}
function drawSleeper(c) {
  const { x, y, z: fz } = sleepSpot(c.i), p = project(x, y, fz + .5), gear = gearOf({ ...c, job: '' }), pal = palFor(c, gear);
  if (window.ART_HUMANS && SPR.human.anims.sleep) {
    const info = drawSprite('human', 'sleep', 'F', Math.floor(G.time * SPR.human.anims.sleep.fps), false, x, y, fz, pal, { shadow: false });
    const head = ART_HUMANS.heads[c.look.key] || ART_HUMANS.heads.hero;
    if (info.fr.head && head.sleep) { const [hx, hy] = frameSpot(info, info.fr.head); stampAnchored(head, head.sleep, hx, hy, false, pal, info.p.d + .5); }
  } else drawHead(c.look, 'sleep', 'F', Math.round(p.sx), Math.round(p.sy) - 3, false, pal, p.d + .2);
  const zt = (G.time * .8 + c.i * .37) % 1;
  if (G.view === 'under') pixelText(zt < .5 ? 'z' : 'Z', p.sx + 6 + zt * 4, p.sy - 10 - zt * 6, rgb(236, 236, 255));
}
