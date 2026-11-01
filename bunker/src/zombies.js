'use strict';
// Zombies: spawning, walking in, hitting the fence and the bunker, dying, waves and falls.
/* ================= zombies ================= */
function pickType(w) {
  const pool = MUTANT_ORDER.filter(k => w >= ZTYPES[k].from), r = Math.random();
  // the newest kinds are rarer at first and grow more common; walkers stay the bulk
  const weights = pool.map(k => { const t = ZTYPES[k]; return k === 'walker' ? 6 : Math.max(.6, 3.2 - (t.from - 1) * .08 + (w - t.from) * .06); });
  let x = r * weights.reduce((a, b) => a + b, 0);
  for (let n = 0; n < pool.length; n++) { x -= weights[n]; if (x <= 0) return pool[n]; }
  return 'walker';
}
function spawn(type) {
  const side = Math.floor(Math.random() * 4), s = (Math.random() * 2 - 1) * (FIELD - .8), r = FIELD + .9 + Math.random() * .4;
  const [x, y] = [[r, s], [s, r], [-r, s], [s, -r]][side];
  const w = G.wave, T = ZTYPES[type = type || pickType(w)], hp = zombieHp(w) * T.hp;
  const z = { x, y, n: Math.max(Math.abs(x), Math.abs(y)), yaw: Math.atan2(-y, -x), hp, max: hp, type, speed: T.speed * PACE * (.9 + Math.random() * .2),
    hitPower: zombieHit(w) * T.hit, reward: zombieReward(w) * T.reward, state: 'walk', t: 0, atk: 0, swings: 0, hit: 0, walkDist: Math.random(), swerve: (Math.random() - .5) * .5,
    incoming: 0, visible: false, sx: 0, sy: 0, zh: 0, rage: 0, lastHit: -9, st: 0 };
  G.zombies.push(z);
  return z;
}
function spawnBoss() {
  const z = spawn('boss');
  z.swerve = 0;
  notify('보스 출현 · 웨이브 ' + G.wave, ZTYPES.boss.name + ' · ' + ZTYPES.boss.desc, 'danger');
  sound('crash');
}
const bossAlive = () => G.zombies.some(z => z.type === 'boss' && z.state !== 'dying');
const fenceUp = () => G.fence > 0 && !G.fenceDown;
// the big ones: more debris, no knockback, bigger health bars
const BIG = { brute: 1, giant: 1, boss: 1 };
const sideOf = (x, y) => Math.abs(x) >= Math.abs(y) ? (x > 0 ? 1 : 3) : (y > 0 ? 0 : 2);
const bunkerReach = () => bunkerInfo().half + .55;
// where a zombie stops: at the fence while it stands, else at the bunker wall; spitters and screamers keep
// their distance; a burrower comes up inside the fence
function stopRing(z, T) {
  if (z.under) return fenceUp() ? FENCE_R - .7 : bunkerReach() + .9;
  const base = fenceUp() && z.n >= FENCE_R ? FENCE_R + .45 : bunkerReach();
  // never beyond where the gunners can see (a small island has little room for a spitter's distance)
  return Math.min(base + (T.range || 0), FIELD - .6);
}
function updateZombies(dt) {
  for (const z of G.zombies) {
    z.hit = Math.max(0, z.hit - dt);
    z.t += dt;
    if (z.state === 'dying') { if (z.t > 4.4) z.gone = true; continue; }
    const T = ZTYPES[z.type];
    if (z.rage > 0) z.rage -= dt;
    z.visible = z.n < FIELD - .15 && !z.under && z.state !== 'dig';
    // a regenerator knits back together when it has not been hit for a moment
    z.healing = T.special === 'regen' && G.time - z.lastHit > 1.5 && z.hp < z.max;
    if (z.healing) z.hp = Math.min(z.max, z.hp + z.max * .06 * dt);
    // tricks that take over the body for a moment: a leap over the fence, diving in, coming up
    if (z.state === 'leap') {
      const L = z.leap, t = Math.min(1, (z.st += dt) / L.dur);
      z.x = lerp(L.x0, L.x1, t); z.y = lerp(L.y0, L.y1, t); z.n = Math.max(Math.abs(z.x), Math.abs(z.y)); // the arc is in the art
      if (t >= 1) { z.state = 'walk'; z.zh = 0; z.leapt = true; spray(z.x, z.y, .1, 8, 1.6, 1.2, .5, [rgb(120, 104, 80), rgb(150, 130, 100)]); sound('thud'); }
      continue;
    }
    if (z.state === 'dig' || z.state === 'emerge') {
      if ((z.st += dt) >= .8) { if (z.state === 'dig') z.under = true; else z.under = false; z.state = 'walk'; }
      if (Math.random() < dt * 20) spray(z.x, z.y, .05, 2, 1.4, 1.6, .5, [rgb(120, 96, 66), rgb(92, 72, 50)]);
      continue;
    }
    const stopAt = stopRing(z, T);
    if (z.n > stopAt) {
      const ang = Math.atan2(-z.y, -z.x) + z.swerve * clamp((z.n - FENCE_R) / 4, 0, 1);
      const pace = z.speed * (z.n > FIELD - .3 ? 1.6 : 1) * (z.rage > 0 ? 1.6 : 1) * (z.under ? 1.3 : 1) * dt;
      z.x += Math.cos(ang) * pace; z.y += Math.sin(ang) * pace;
      z.n = Math.max(Math.abs(z.x), Math.abs(z.y));
      if (z.state === 'attack') z.leftAttack = G.time;
      z.walkDist += pace; z.yaw = ang; z.state = 'walk';
      if (z.under && Math.random() < dt * 6) spray(z.x, z.y, .05, 1, .8, 1.2, .4, [rgb(120, 96, 66)]);
      // a burrower dives as soon as it is on the island; a leaper jumps the fence from just outside it
      if (T.special === 'burrow' && !z.dug && z.n < FIELD - .8) { z.dug = true; z.state = 'dig'; z.st = 0; }
      else if (T.special === 'leap' && !z.leapt && fenceUp() && z.n > FENCE_R && z.n <= FENCE_R + 1) {
        const k = (FENCE_R - .9) / z.n;
        z.state = 'leap'; z.st = 0; z.leap = { x0: z.x, y0: z.y, x1: z.x * k, y1: z.y * k, dur: .9 }; sound('leap');
      }
      continue;
    }
    if (z.under) { z.state = 'emerge'; z.st = 0; sound('thud'); continue; }
    const atFence = fenceUp() && z.n >= FENCE_R;
    // stepping back in after a knockback keeps the windup it had; only a fresh approach starts from zero
    if (z.state !== 'attack') { if (G.time - (z.leftAttack || -9) > .8) z.atk = 0; z.state = 'attack'; z.yaw = Math.atan2(-z.y, -z.x); }
    z.lastAttack = G.time;
    const inc = dt * (z.rage > 0 ? 1.4 : 1);
    z.atk += inc;
    if (T.special === 'burst') { if (z.atk >= T.every) burst(z, atFence); continue; }
    const at = T.special === 'spit' || T.special === 'scream' ? .7 : .55;
    if (z.atk - inc < T.every * at && z.atk >= T.every * at) {
      if (T.special === 'spit') spit(z, atFence);
      else if (T.special === 'scream') scream(z);
      else { strike(z, atFence); if (T.special === 'boss') stomp(z); }
    }
    if (z.atk >= T.every) { z.atk -= T.every; z.swings++; }
  }
  G.zombies = G.zombies.filter(z => !z.gone);
  // acid globs in the air
  for (const g of G.spits) {
    g.t += dt;
    if (g.t < g.dur) continue;
    g.done = true;
    spray(g.tx, g.ty, .2, 10, 1.6, 1.4, .6, [rgb(170, 220, 60), rgb(120, 180, 40), rgb(210, 240, 120)]);
    if (g.side >= 0 && fenceUp()) damageFence(g.side, g.power);
    else { G.hp -= g.power; G.hurt = .3; }
    sound('thud');
  }
  G.spits = G.spits.filter(g => !g.done);
}
// a spitter lobs a glob of acid at the fence in front of it (or the bunker wall)
function spit(z, atFence) {
  const fence = fenceUp(), side = sideOf(z.x, z.y), R = fence ? FENCE_R : bunkerReach() - .5;
  const tx = side === 1 ? R : side === 3 ? -R : z.x * R / z.n, ty = side === 0 ? R : side === 2 ? -R : z.y * R / z.n;
  G.spits.push({ x: z.x, y: z.y, tx, ty, t: 0, dur: .7, power: z.hitPower, side: fence ? side : -1 });
  sound('spit');
}
// a screamer drives every zombie near it wild for a few seconds: faster feet, faster blows
function scream(z) {
  for (const o of G.zombies) if (o !== z && o.state !== 'dying' && Math.hypot(o.x - z.x, o.y - z.y) < 3.5) o.rage = 4;
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; part(z.x, z.y, 1.2, Math.cos(a) * 3, Math.sin(a) * 3, .4, .45, rgb(240, 240, 232), rgb(200, 200, 196), 1, 1); }
  z.screamT = .8;
  sound('scream');
}
// the boss's blows shake the ground around it
function stomp(z) {
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; part(z.x, z.y, .1, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 1.4, .7, rgb(150, 130, 100), rgb(110, 92, 70), 2, 1); }
  sound('crash');
}
function damageFence(side, amount) {
  G.sideDmg[side] += amount;
  G.fenceHp -= amount;
  if (G.fenceHp <= 0) breakFence(); else fenceStages();
}
const fenceMat = () => rampOf(fenceInfo().material);
function strike(z, atFence) {
  const amount = z.hitPower;
  if (atFence) {
    const side = sideOf(z.x, z.y), R = FENCE_R, hx = side === 1 ? R : side === 3 ? -R : z.x, hy = side === 0 ? R : side === 2 ? -R : z.y;
    const mat = fenceMat(), ox = side === 1 ? -1 : side === 3 ? 1 : 0, oy = side === 0 ? -1 : side === 2 ? 1 : 0;
    for (let k = 0; k < (BIG[z.type] ? 10 : 5); k++) part(hx, hy, .3 + Math.random() * .3, ox * (1 + Math.random() * 2) + (Math.random() - .5) * 2, oy * (1 + Math.random() * 2) + (Math.random() - .5) * 2, 2 + Math.random() * 3, .9, mat[2 + (k % 2)], mat[0], k % 3 ? 1 : 2, 1);
    sound(fenceInfo().metal ? 'clang' : 'thud');
    // the electric fence bites back
    if (fenceInfo().electric) { hurt(z, zombieHp(G.wave) * .12, true, true); spray(hx, hy, .4, 6, 1.6, 2, .3, [rgb(140, 210, 255), rgb(255, 255, 255)]); }
    damageFence(side, amount);
  } else {
    const dust = rampOf(bunkerInfo().material);
    spray(z.x * .85, z.y * .85, .6, BIG[z.type] ? 10 : 5, 1.4, 2.5, .7, [dust[3], dust[4], dust[2]]);
    G.hp -= amount; G.hurt = BIG[z.type] ? .45 : .3;
    sound('thud');
  }
}
function splatter(z) {
  spray(z.x, z.y, .6, 36, 3.2, 4, 1.1, [rgb(176, 196, 90), rgb(120, 150, 60), rgb(210, 220, 130)], 2, 2);
  const pts = [];
  for (let k = 0; k < 120; k++) {
    const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 1.1, p = project(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 0);
    const ix = p.sx | 0, iy = p.sy | 0; if (ix >= 0 && iy >= 0 && ix < W && iy < H) pts.push(iy * W + ix);
  }
  G.decals.push({ pts, color: rgb(150, 170, 70), life: 14 });
  sound('crash');
}
function burst(z, atFence) {
  splatter(z); z.gone = true;
  const amount = zombieHit(G.wave) * 12;
  if (atFence) damageFence(sideOf(z.x, z.y), amount);
  else { G.hp -= amount; G.hurt = .5; }
  say('부푼 놈이 터졌다!', true);
}
function breakFence() {
  G.fenceHp = 0; G.fenceDown = true;
  const mat = fenceMat();
  for (let k = 0; k < 80; k++) { const [x, y] = SIDE_AT(k % 4, (Math.random() * 2 - 1) * FENCE_R); part(x, y, .3 + Math.random() * .5, (Math.random() - .5) * 3, (Math.random() - .5) * 3, 2 + Math.random() * 4, 1.6 + Math.random(), mat[1 + (k % 3)], mat[0], 2, 1); }
  G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0];
  composeYard(); notify('울타리 붕괴', '울타리를 고칠 때까지 좀비가 벙커를 직접 친다', 'danger'); sound('crash');
}
function fenceStages() {
  const max = fenceHp(G.fence) || 1;
  for (let k = 0; k < 4; k++) {
    const raw = G.sideDmg[k] / (max * .2), cur = G.sideStage[k];
    const st = raw >= cur + 1 ? clamp(Math.floor(raw), 0, 3) : raw < cur - .5 ? clamp(Math.floor(raw + .5), 0, 3) : cur;
    if (st !== cur) { G.sideStage[k] = st; fenceDirty = true; }
  }
}
function hurt(z, dmg, quiet, still) {
  if (z.state === 'dying' || z.under) return;
  dmg *= ZTYPES[z.type].armor || 1;
  z.hp -= dmg; z.hit = .07; z.lastHit = G.time;
  const d = Math.hypot(z.x, z.y) || 1;
  if (!still && !BIG[z.type] && z.state !== 'leap') { z.x += z.x / d * .04; z.y += z.y / d * .04; z.n = Math.max(Math.abs(z.x), Math.abs(z.y)); }
  if (!quiet) { const j = Math.random() - .5; float(z.x + j * .7, z.y - j * .7, 1.8 + Math.random() * .3, fmt(Math.round(dmg)), rgb(255, 255, 255)); } // spread so rapid hits stay readable
  spray(z.x, z.y, .9, 3, 1.2, 1.5, .4, [rgb(110, 40, 40), rgb(80, 120, 60)]);
  if (z.hp <= 0) kill(z);
}
function kill(z) {
  z.state = 'dying'; z.t = 0;
  if (z.type === 'bloater') { splatter(z); z.gone = true; }
  if (z.state === 'dying' && z.zh) z.zh = 0;
  G.money += z.reward; G.totalKills++;
  if (z.type === 'boss') notify('보스 처치', '+$' + fmt(z.reward), 'good');
  float(z.x, z.y, 2.85, '+$' + fmt(z.reward), SIGNAL); // high enough not to overlap the damage number
  sound('kill');
  for (let k = 0; k < (BIG[z.type] ? 8 : 3); k++) part(z.x, z.y, 1, (Math.random() - .5) * 2, (Math.random() - .5) * 2, 3 + Math.random() * 2, .8, rgb(255, 214, 10), rgb(186, 132, 20), 2, 1);
  const pts = [];
  for (let k = 0; k < (BIG[z.type] ? 50 : 26); k++) {
    const a = Math.random() * 6.28, dd = Math.sqrt(Math.random()) * .45, p = project(z.x - Math.cos(z.yaw) * .5 + Math.cos(a) * dd, z.y - Math.sin(z.yaw) * .5 + Math.sin(a) * dd, 0);
    const ix = p.sx | 0, iy = p.sy | 0; if (ix >= 0 && iy >= 0 && ix < W && iy < H) pts.push(iy * W + ix);
  }
  G.decals.push({ pts, color: Math.random() < .5 ? rgb(70, 92, 50) : rgb(100, 44, 42), life: 12 });
  if (G.decals.length > 40) G.decals.shift();
  // a boss wave only ends with the boss
  G.waveKills = Math.min(G.waveKills + 1, bossAlive() ? killsNeeded(G.wave) - 1 : Infinity);
  if (G.waveKills >= killsNeeded(G.wave)) {
    G.wave++; G.waveKills = 0;
    const fresh = MUTANT_ORDER.map(k => ZTYPES[k]).find(t => t.from === G.wave);
    const key = fresh && MUTANT_ORDER.find(k => ZTYPES[k] === fresh);
    if (fresh && !G.seen.includes(key)) { G.seen.push(key); notify('새 변이체 · ' + fresh.name, fresh.desc, 'new'); }
    else if (!isBossWave(G.wave)) notify('웨이브 ' + G.wave, '좀비 체력 ' + fmt(zombieHp(G.wave)) + (nextMutant() ? ' · 다음 변이체 웨이브 ' + nextMutant().from : ''));
  }
}
function fall() {
  const back = Math.max(1, G.wave - 2);
  notify('기지가 뚫렸다', '웨이브 ' + G.wave + ' → ' + back + ' · 다시 막아내자', 'danger');
  sound('crash');
  for (const z of G.zombies) z.gone = true;
  G.wave = back; G.waveKills = 0; G.zombies = []; G.spits = []; G.bossFor = 0;
  G.hp = bunkerHp(G.bunker);
  if (G.fence) { G.fenceHp = fenceHp(G.fence); G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0]; composeYard(); }
  G.spawnIn = 3;
}
