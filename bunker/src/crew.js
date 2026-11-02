'use strict';
// People: the hero and the hired hands, their jobs, routes between floors, sleep, and shooting.
/* ================= people: the hero on the roof and up to five hired hands ================= */
// what everyone carries: a rifle with a full magazine, nobody to shoot yet, no route
const personBase = () => ({ job: '사수', path: [], walk: 0, act: 0, ammo: gunStat('mag'), reload: 0, reloadLen: 1, cool: 0, recoil: 0, flash: 0,
  target: null, retarget: 0, magOut: false, magIn: false, pal: null });
function makePerson(i) {
  return { ...personBase(), i, name: NAMES[i], look: LOOKS[i + 1], fatigue: 10 + Math.random() * 20, state: 'toWork', where: 'ug', floor: 0,
    x: BED_X(i) + .75, y: UG.y0 + 1.05, z: LEVEL_Z[0], yaw: -Math.PI / 2, act: Math.random() * 3 };
}
function makeHero() {
  return { ...personBase(), hero: true, i: -1, name: '나', look: LOOKS[0], fatigue: 0, state: 'work', where: 'yard', floor: -1, x: 0, y: 0, z: STAGE_Z(), yaw: Math.PI / 4 };
}
const STAGE_Z = () => bunkerInfo().roof;
const gunners = () => G.crew.filter(c => c && c.job === '사수');
function gunnerIndex(c) { if (c.hero) return 0; return 1 + gunners().indexOf(c); }
function jobIndex(c) { return G.crew.filter(p => p && p.job === c.job).indexOf(c); }
function workSpot(c) {
  if (c.job === '사수') { const s = SITES[Math.min(SITES.length - 1, gunnerIndex(c))] || [0, 0, STAGE_Z()]; return { where: 'yard', x: s[0], y: s[1], z: s[2] }; }
  const n = Math.max(0, jobIndex(c));
  return c.job === '정비공' ? shopSpot(n) : c.job === '농부' ? farmSpot(n) : mineSpot(n);
}
// the workshop is above ground (doc 8): its hands work on the open ground before the bunker's two front faces, far
// enough apart that no two overlap, each facing out to the strip in front of it (yard.js: the workbench at the first
// spot, the gun turret and the crates at the others), clear of the gunners on the roof
const SHOP_AT = [[.6, 2.3, Math.PI / 2], [2.3, .6, 0], [-1, 2.3, Math.PI / 2], [2.3, -1, 0]];
const shopSpot = n => { const [x, y, yaw] = SHOP_AT[n % SHOP_AT.length]; return { where: 'yard', x, y, z: 0, yaw }; };
// a hand bought for a floor (systems.js): a free bed, nameless (the job is its name), and off to work
function hireWorker(job) {
  const i = G.crew.findIndex((c, k) => !c && k < bedsOf(G.live));
  if (i < 0) return null;
  const p = makePerson(i);
  p.job = job; if (job !== '사수') p.name = job;
  G.crew[i] = p; p.state = 'toWork'; p.path = route(p, workSpot(p));
  resyncPosts(); markUnder(0);
  return p;
}
// a path is a list of steps: walk on a floor (or the roof), climb the shaft, or pass through the roof hatch.
// A post below ground can name points to walk through on the way in (via: down the corridor, then along an aisle
// between the plots); whoever leaves walks back out through the ones they have passed (c.post is the post they
// were sent to, c.viaDone how many of its points are behind them), so nobody cuts across the planters
const walkAt = (floor, p, extra) => ({ where: 'ug', floor, x: p.x, y: p.y, z: LEVEL_Z[floor], mode: 'walk', ...extra });
function route(c, dest) {
  const pts = [], shaftAt = k => walkAt(k, { x: SHAFT.x, y: LADDER_Y });
  const out = c.where === 'ug' && c.post && c.post.floor === c.floor ? c.post.via.slice(0, c.viaDone || 0).reverse().map(p => walkAt(c.floor, p)) : [];
  const into = dest.where === 'ug' && dest.via ? dest.via.map((p, i) => walkAt(dest.floor, p, { via: i + 1 })) : [];
  const end = dest.via ? { ...dest, mode: 'walk', via: dest.via.length } : { ...dest, mode: 'walk' };
  if (c.where === 'yard' && dest.where === 'yard') pts.push(end);
  else if (c.where === 'yard') {
    // someone on the ground (the workshop's hands) walks into the bunker at ground level and goes down from there
    const h = SITES.hatch, low = c.z < h[2] - .3;
    pts.push({ where: 'yard', x: h[0], y: h[1], z: low ? c.z : h[2], mode: 'walk' }, { mode: 'hatch', to: 'ug' }, { ...shaftAt(dest.floor), mode: 'climb' }, ...into, end);
  } else if (dest.where === 'yard') {
    pts.push(...out, shaftAt(c.floor), { where: 'ug', floor: 0, x: SHAFT.x, y: LADDER_Y, z: HATCH_TOP(), mode: 'climb' }, { mode: 'hatch', to: 'yard' }, end);
  } else if (c.floor !== dest.floor) {
    pts.push(...out, shaftAt(c.floor), { ...shaftAt(dest.floor), mode: 'climb' }, ...into, end);
  } else pts.push(...out, ...into, end);
  return pts;
}
function sendTo(c, dest, state) {
  // someone on the ladder (or at its top, about to go out through the hatch) goes on from where they hang
  const cur = c.path[0];
  if (cur && c.where === 'ug' && (cur.mode === 'climb' || cur.mode === 'hatch' && cur.to === 'yard')) {
    const k = LEVEL_Z.reduce((b, z, i) => Math.abs(z - c.z) < Math.abs(LEVEL_Z[b] - c.z) ? i : b, 0);
    const rest = route({ ...c, floor: k, viaDone: 0 }, dest).filter((p, i) => !(i === 0 && p.mode === 'walk' && p.x === SHAFT.x && p.y === LADDER_Y));
    // if the new route goes on climbing, the climb starts from here; if not, climb to the nearest floor and step off
    c.path = rest.length && rest[0].mode === 'climb' ? rest : [{ ...walkAt(k, { x: SHAFT.x, y: LADDER_Y }), mode: 'climb' }, ...rest];
  } else c.path = route(c, dest);
  c.state = state;
  // the post's way in, which way to face there and where a pick strikes
  c.post = dest.via ? dest : null; c.viaDone = 0; c.face = dest.yaw; c.hit = dest.hit;
}
function stepPerson(c, dt) {
  const wp = c.path[0];
  if (!wp) return true;
  if (wp.mode === 'hatch') {
    c.where = wp.to;
    if (wp.to === 'ug') { c.x = SHAFT.x; c.y = LADDER_Y; c.z = HATCH_TOP(); c.floor = 0; }
    else { const h = SITES.hatch, next = c.path[1]; c.x = h[0]; c.y = h[1]; c.z = next && next.z < h[2] - .3 ? next.z : h[2]; c.floor = -1; }
    c.path.shift();
    return false;
  }
  if (wp.mode === 'climb') {
    const dz = wp.z - c.z, step = .9 * dt;
    c.x = SHAFT.x; c.y = LADDER_Y; c.yaw = -Math.PI / 2; c.anim = 'climb';
    if (Math.abs(dz) <= step) { c.z = wp.z; c.floor = wp.floor; c.path.shift(); }
    else { c.z += Math.sign(dz) * step; c.walk += step; }
    return false;
  }
  const dx = wp.x - c.x, dy = wp.y - c.y, d = Math.hypot(dx, dy), step = 1.05 * dt;
  c.z = wp.z; c.anim = 'walk';
  if (d <= step) { c.x = wp.x; c.y = wp.y; c.path.shift(); if (wp.floor != null) c.floor = wp.floor; if (wp.via) c.viaDone = wp.via; }
  else { c.x += dx / d * step; c.y += dy / d * step; c.yaw = Math.atan2(dy, dx); c.walk += step; }
  return false;
}
function updatePeople(dt) {
  const rest = FATIGUE_REST * (1 + .05 * G.live);
  for (const c of G.crew) {
    if (!c) continue;
    const arrived = stepPerson(c, dt);
    if (!arrived) continue;
    if (c.state === 'toWork') { c.state = 'work'; if (c.job !== '사수') c.yaw = c.face ?? -Math.PI / 2; }
    else if (c.state === 'toBed') c.state = 'sleep';
    if (c.state === 'work') {
      c.fatigue += FATIGUE_WORK * (G.hungry ? 2 : 1) * dt;
      c.act += dt;
      if (c.fatigue >= 100) sendTo(c, bedSpot(c), 'toBed');
    } else if (c.state === 'sleep') {
      c.fatigue -= rest * dt;
      if (c.fatigue <= 0) { c.fatigue = 0; sendTo(c, workSpot(c), 'toWork'); }
    }
  }
}
// who is actually at their post right now
const atWork = c => c && c.state === 'work' && !c.path.length;
const activeOn = job => G.crew.filter(c => c && c.job === job && atWork(c)).length;
function rateOf(res) {
  if (res === 'parts') return G.hungry ? 0 : SYS.hook.partsRate(activeOn('정비공'));
  if (G.hungry && res !== 'food') return outputOf(res, 0) * SYS.hook.prod(res); // the farm keeps going, or hunger could never end
  return outputOf(res, activeOn(res === 'food' ? '농부' : '광부')) * SYS.hook.prod(res);
}
// the parts box: an hour of the workshop's output, never below 600 (the logic's store rule)
const partsCap = () => Math.round(Math.max(600, 3600 * SYS.hook.partsRate(G.crew.filter(c => c && c.job === '정비공').length)));
function resyncPosts() {
  // new bunker or a changed job: everyone working heads to the right post
  if (G.hero) { const s = SITES[0]; G.hero.x = s[0]; G.hero.y = s[1]; G.hero.z = s[2]; }
  for (const c of G.crew) if (c && (c.state === 'work' || c.state === 'toWork')) {
    // already at, or on the way to, the same post: carry on (re-sending would walk someone below out and back in);
    // a gunner on the roof whose spot moved walks over to it
    const w = workSpot(c), at = c.path.length ? c.path[c.path.length - 1] : { where: c.where, floor: c.floor, x: c.x, y: c.y };
    if (at.where === w.where && (w.where === 'yard' || at.floor === w.floor) && Math.abs(at.x - w.x) < .01 && Math.abs(at.y - w.y) < .01) { if (w.where === 'yard' && !c.path.length) c.z = w.z; continue; }
    sendTo(c, w, 'toWork');
  }
}

/* ================= shooting: targets are shared out, nobody wastes a turn on a zombie already being killed ================= */
const damageOf = () => gunStat('atk');
const rateOfFire = () => gunStat('spd');
// what a shooter's shot does: the workshop's gun times the weapon this shooter holds and every multiplier of the
// systems (systems.js): damage, crits, fire rate, splash, piercing, fire and cold
const shotOf = s => SYS.hook.shooter(s);
function startReload(s) { s.reloadLen = reloadTime() * shotOf(s).reload; s.reload = s.reloadLen; s.magOut = false; s.magIn = false; }
const shooters = () => [G.hero, ...(G.hungry ? [] : G.crew.filter(c => c && c.job === '사수' && atWork(c) && c.where === 'yard'))].filter(Boolean);
// the damage a shooter will land on its target in the next second or so
const commitOf = s => { const w = shotOf(s); return s.reload > 0 ? 0 : Math.min(s.ammo, Math.ceil(rateOfFire() * w.rate * 1.1)) * damageOf() * w.mul; };
// lower is more urgent: whoever is hitting us, then the dangerous kinds (a screamer drives the others wild,
// a spitter works from a distance, a bloater must not reach the wall)
const THREAT = { bloater: 1.5, brute: .8, giant: 1, spitter: 2.2, screamer: 3, boss: 1.2, leaper: .6, burrower: .8, regenerator: .5 };
function threat(z) { return z.n - (z.state === 'attack' ? 2.5 : 0) - (THREAT[z.type] || 0) - (z.rage > 0 ? .4 : 0); }
// Each gunner watches its own sector of the island (the sectors split the full circle between the gunners
// on the roof), so two of them never stand side by side aiming at the same spot. A gunner takes the most urgent
// zombie it can see, preferring its own sector, skipping zombies others are already about to kill, and avoiding
// one that another gunner already holds unless that one needs the extra fire.
// The sectors are spread evenly and handed out around the circle in the order the gunners stand, turned so each
// one's sector lies on its own side of the roof (nobody covers the far side by firing across the others)
const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function giveSectors(list) {
  const n = list.length, step = Math.PI * 2 / n, at = s => Math.hypot(s.x, s.y) > .3 ? Math.atan2(s.y, s.x) : null;
  list.sort((a, b) => (at(a) ?? 9) - (at(b) ?? 9));
  let sx = 0, sy = 0;
  list.forEach((s, i) => { const a = at(s); if (a != null) { sx += Math.cos(a - i * step); sy += Math.sin(a - i * step); } });
  const base = sx || sy ? Math.atan2(sy, sx) : Math.PI / 4;
  list.forEach((s, i) => { s.sector = base + i * step; });
}
function assignTargets(dt) {
  const list = shooters();
  giveSectors(list);
  for (const z of G.zombies) { z.incoming = 0; z.held = 0; }
  for (const s of list) if (s.target && s.target.state !== 'dying' && !s.target.gone) { s.target.incoming += commitOf(s); s.target.held++; }
  for (const s of list) {
    s.retarget -= dt;
    const t = s.target, alive = t && t.state !== 'dying' && !t.gone && t.visible;
    const overkill = alive && t.incoming - commitOf(s) >= t.hp;
    if (alive && !overkill && s.retarget > 0) continue;
    if (alive) { t.incoming -= commitOf(s); t.held--; }
    let best = null, bestScore = Infinity, fallback = null, fallbackScore = Infinity;
    for (const z of G.zombies) {
      if (z.state === 'dying' || z.gone || !z.visible) continue;
      const turn = angleGap(Math.atan2(z.y - s.y, z.x - s.x), s.yaw), off = angleGap(Math.atan2(z.y, z.x), s.sector);
      const score = threat(z) + turn * .3 + off * .9 + z.held * 1.6;
      if (score < fallbackScore) { fallback = z; fallbackScore = score; }
      if (z.incoming >= z.hp) continue;
      if (score < bestScore) { best = z; bestScore = score; }
    }
    s.target = best || fallback;
    s.retarget = .35;
    if (s.target) { s.target.incoming += commitOf(s); s.target.held++; }
  }
}
function fire(s, z) {
  if (s.reload > 0 || s.ammo <= 0) return false;
  const w = shotOf(s);
  if (!w.noReload) s.ammo--;
  s.recoil = .12; s.flash = .06;
  const fx = Math.cos(s.yaw), fy = Math.sin(s.yaw);
  part(s.x + fx * .3, s.y + fy * .3, s.z + 1.2, -fy * 1.4 + (Math.random() - .5) * .5, fx * 1.4 + (Math.random() - .5) * .5, 2.2 + Math.random(), 1.4, rgb(232, 184, 74), rgb(150, 104, 40));
  const c = project(z.x, z.y, .8);
  G.tracers.push({ ax: s.muzzle ? s.muzzle[0] : project(s.x, s.y, s.z + 1.3).sx, ay: s.muzzle ? s.muzzle[1] : project(s.x, s.y, s.z + 1.3).sy, bx: c.sx, by: c.sy, life: .06 });
  sound('shot');
  let dmg = damageOf() * w.mul * (z.type === 'boss' ? w.boss : 1);
  const crit = Math.random() < w.crit;
  if (crit) dmg *= w.critMul;
  // a boss in front armour shrugs off most of a shot from the front unless it pierces (grey sparks)
  if (z.armor && !(w.pierce > 0) && angleGap(Math.atan2(s.y - z.y, s.x - z.x), z.yaw) < Math.PI / 3) { dmg *= 1 - z.armor; spray(z.x, z.y, 1.3, 3, 1.4, .8, .25, SPARK); }
  if (w.burn && Math.random() < w.burn) ignite(z, dmg * .3);
  if (w.slow) chill(z, w.slow);
  // shotguns and heavy guns splash the zombies around the target; a chain jumps to the next; a sniper's round goes on
  // through to the ones behind it along the line of fire
  const others = G.zombies.filter(o => o !== z && o.state !== 'dying' && !o.gone && o.visible);
  if (w.crowd > 0) for (const o of others) if (Math.hypot(o.x - z.x, o.y - z.y) < .9) hurt(o, dmg * Math.min(1, w.crowd * .5), true, true);
  if (w.chain) { const o = others.filter(o => Math.hypot(o.x - z.x, o.y - z.y) < 1.6).sort((a, b) => Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y))[0]; if (o) hurt(o, dmg * .6, true, true); }
  if (w.pierce > 0) {
    const dx = z.x - s.x, dy = z.y - s.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    others.filter(o => { const a = (o.x - s.x) * ux + (o.y - s.y) * uy; return a > L && Math.abs((o.x - s.x) * uy - (o.y - s.y) * ux) < .4; })
      .sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y)).slice(0, w.pierce).forEach(o => hurt(o, dmg * .7, true, true));
  }
  hurt(z, dmg, false, false, crit);
  if (s.ammo === 0) startReload(s);
  return true;
}
// a boss lands with a shock that stuns one gunner on the roof for a few seconds (less with the gas mask relic)
function stunGunner(sec) {
  const list = shooters();
  if (!list.length) return;
  const s = list[Math.floor(Math.random() * list.length)];
  s.stun = sec * (1 - SYS.hook.stunResist()); s.target = null;
}
function updateShooter(s, dt) {
  s.recoil = Math.max(0, s.recoil - dt * .8); s.flash = Math.max(0, s.flash - dt);
  // stunned: no aim and no fire, stars over the head
  if (s.stun > 0) { s.stun -= dt; if (Math.random() < dt * 8) part(s.x + (Math.random() - .5) * .5, s.y + (Math.random() - .5) * .5, s.z + 2.1, 0, 0, 1.2, .35, rgb(255, 232, 90), null); return; }
  if (s.reload > 0) {
    s.reload -= dt;
    const t = 1 - s.reload / s.reloadLen;
    if (!s.magOut && t > .3) { s.magOut = true; part(s.x, s.y, s.z + 1, 0, 0, .4, 2, rgb(52, 50, 58), rgb(30, 28, 34), 2, 2); if (s.hero) sound('magout'); }
    if (!s.magIn && t > .7) { s.magIn = true; if (s.hero) sound('magin'); }
    if (s.reload <= 0) { s.reload = 0; s.ammo = gunStat('mag'); if (s.hero) sound('rack'); }
    return;
  }
  if (!s.hero && G.hungry) return;
  const z = s.target;
  s.cool -= dt;
  if (!z || z.state === 'dying' || z.gone) {
    // nothing to shoot: watch its own sector, sweeping slowly, and top up the magazine
    if (s.sector != null) { const look = s.sector + Math.sin(G.time * .45 + s.sector * 3) * .5, d = Math.atan2(Math.sin(look - s.yaw), Math.cos(look - s.yaw)); s.yaw += clamp(d, -1.5 * dt, 1.5 * dt); }
    if (s.ammo < gunStat('mag') * .5) startReload(s); s.cool = Math.max(0, s.cool); return;
  }
  const want = Math.atan2(z.y - s.y, z.x - s.x);
  let d = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
  s.yaw += clamp(d, -8 * dt, 8 * dt);
  d = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
  if (s.cool <= 0 && Math.abs(d) < .2 && fire(s, z)) s.cool = 1 / (rateOfFire() * shotOf(s).rate);
  if (s.cool < 0) s.cool = 0;
}
