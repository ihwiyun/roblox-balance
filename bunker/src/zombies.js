'use strict';
// Zombies: spawning, walking in, hitting the fence and the bunker, dying, waves and falls.
/* ================= zombies ================= */
// Who comes at stage w: its band's two or three kinds (the logic's bands, doc 6; their keys are the sprites' keys).
// Each zombie is scaled so that a stage stays as tough, hits as hard and pays as much on average as the old mix of
// every kind met so far did at that stage: the bands change who comes, not how hard a stage is. Without the logic
// the old mix itself comes (early on nearly all walkers, each mutant starting rare and growing more common; the big
// ones stay rare)
const oldWeight = (k, w) => k === 'walker' ? Math.max(1.2, 6 - w * .13) : Math.min(BIG[k] ? 1.3 : 4, .4 + (w - ZTYPES[k].from) * .16);
const toughOf = k => ZTYPES[k].hp / (ZTYPES[k].armor || 1), pressOf = k => ZTYPES[k].hit / ZTYPES[k].every, payOf = k => ZTYPES[k].reward;
const mixes = new Map();
function mixOf(w) {
  let m = mixes.get(w);
  if (m) return m;
  const avg = (keys, wts, f) => { let a = 0, b = 0; keys.forEach((k, i) => { a += wts[i] * f(k); b += wts[i]; }); return b ? a / b : 1; };
  const hitters = (keys, wts) => [keys.filter(k => ZTYPES[k].special !== 'burst'), wts.filter((_, i) => ZTYPES[keys[i]].special !== 'burst')];
  const oldKeys = MUTANT_ORDER.filter(k => w >= ZTYPES[k].from), oldW = oldKeys.map(k => oldWeight(k, w)), reward = avg(oldKeys, oldW, payOf);
  const band = (SYS.hook.band(w) || []).filter(k => ZTYPES[k] && k !== 'boss');
  if (!band.length) m = { keys: oldKeys, weights: oldW, hp: 1, hit: 1, reward: 1, avgReward: reward, tough: avg(oldKeys, oldW, toughOf) };
  else {
    const bw = band.map(k => BIG[k] ? .35 : 1), [ok, ow] = hitters(oldKeys, oldW), [bk, bwh] = hitters(band, bw);
    m = { keys: band, weights: bw, hp: avg(oldKeys, oldW, toughOf) / avg(band, bw, toughOf), hit: bk.length ? avg(ok, ow, pressOf) / avg(bk, bwh, pressOf) : 1,
      reward: reward / avg(band, bw, payOf), avgReward: reward, tough: avg(oldKeys, oldW, toughOf) };
  }
  mixes.set(w, m);
  return m;
}
function pickType(w) {
  const m = mixOf(w);
  let x = Math.random() * m.weights.reduce((a, b) => a + b, 0);
  for (let n = 0; n < m.keys.length; n++) { x -= m.weights[n]; if (x <= 0) return m.keys[n]; }
  return m.keys[0] || 'walker';
}
// the gold a stage pays before the multipliers (stage info): its zombies on average, and its boss
const stageGold = s => (killsNeeded(s) - (isBossWave(s) ? 1 : 0)) * zombieReward(s) * mixOf(s).avgReward + (isBossWave(s) ? zombieReward(s) * ZTYPES.boss.reward * (s % 100 ? 1 : titanMul()) : 0);
// the firepower stage w asks for (auto-skip: the logic's reqDps on the game's own numbers): its zombies' toughness over
// the pace a stage is measured at, or its boss over the boss's clock
function stageNeed(w) {
  if (isBossWave(w)) return zombieHp(w) * ZTYPES.boss.hp * (w % 100 ? 1 : titanMul()) / Math.max(1, SYS.hook.bossLimit(w) || 45);
  return killsNeeded(w) * zombieHp(w) * mixOf(w).tough / SYS.hook.tRef();
}
// the name a player sees: the logic's (the stage window's) when it is there
const zombieName = k => SYS.hook.zombieName(k) || ZTYPES[k].name;
function spawn(type) {
  const side = Math.floor(Math.random() * 4), s = (Math.random() * 2 - 1) * (FIELD - .8), r = FIELD + .9 + Math.random() * .4;
  const [x, y] = [[r, s], [s, r], [-r, s], [s, -r]][side];
  const w = G.wave, T = ZTYPES[type = type || pickType(w)], m = type === 'boss' ? { hp: w % 100 ? 1 : titanMul(), hit: 1, reward: w % 100 ? 1 : titanMul() } : mixOf(w), hp = zombieHp(w) * T.hp * m.hp;
  const z = { x, y, n: Math.max(Math.abs(x), Math.abs(y)), yaw: Math.atan2(-y, -x), hp, max: hp, type, speed: T.speed * PACE * (.9 + Math.random() * .2),
    hitPower: zombieHit(w) * T.hit * m.hit, reward: zombieReward(w) * T.reward * m.reward, state: 'walk', t: 0, atk: 0, swings: 0, hit: 0, walkDist: Math.random(), swerve: (Math.random() - .5) * .5,
    incoming: 0, visible: false, sx: 0, sy: 0, zh: 0, rage: 0, lastHit: -9, st: 0, variant: Math.floor(Math.random() * ZVARIANTS) };
  G.zombies.push(z);
  return z;
}
// every tenth stage its band's boss (a titan every hundredth), on a clock (the logic's limit; none without it)
function spawnBoss() {
  const z = spawn('boss'), w = G.wave;
  z.swerve = 0; z.titan = w % 100 === 0; z.name = SYS.hook.bossName(w) || ZTYPES.boss.name;
  dressBoss(z, w);
  bossSetup(z, w);
  G.quake = .6;
  G.bossLeft = SYS.hook.bossLimit(w);
  notify(z.titan ? '타이탄 출현' : '보스 출현', z.name, 'danger');
  sound('crash');
}
// How a boss is drawn: its own art (art/bosses.js, ART_BOSSES) at its own size when there is one for it, else today's
// boss sprite blown up by a whole number, nearest neighbour: 2x (96 px, doc 6: 2.5-3 times a zombie), a titan 3x.
// scale: its size against today's boss (where it stops at the fence or the wall, where taps and shots find it)
const BOSS_SCALE = 2, TITAN_SCALE = 3;
function dressBoss(z, w, minion) {
  z.look = null;
  const A = window.ART_BOSSES, pack = A && (A.types || A);
  if (pack) for (const key of SYS.hook.bossArtKeys(w, z.titan)) {
    const src = pack[key];
    if (!src || !src.anims) continue;
    try {
      const type = 'boss:' + key;
      if (!SPR[type]) { SPR[type] = decodeSet(src); ZPALS[type] = paletteOf(src.pal || A.pal || {}); }
      z.look = { type, pal: ZPALS[type], k: 1 };
      z.scale = SPR[type].h / SPR.boss.h;
      break;
    } catch { z.look = null; }
  }
  if (!z.look) { z.look = { type: 'boss', pal: ZPALS.boss, k: z.titan && !minion ? TITAN_SCALE : BOSS_SCALE }; z.scale = z.look.k; }
  // shots and tracers land on its body, a little under half its height
  z.hitZ = SPR[z.look.type].ay * z.look.k * .45 / (COS * S);
}
// the boss outlasted its clock: the stage is lost and the one before it plays on repeat (doc 6)
function bossTimeout() {
  const back = Math.max(1, G.wave - 1);
  notify('보스 시간 초과', '스테이지 ' + back + ' 반복', 'danger');
  for (const z of G.zombies) z.gone = true;
  G.zombies = []; G.spits = []; G.wave = back; G.waveKills = 0; G.bossFor = 0; G.bossLeft = 0; G.repeat = true; G.spawnIn = 2;
  sound('crash');
}
// fire (burns for 3 s, stops a regenerator healing) and cold (slows) from weapons, turrets and relics
function ignite(z, dps) { if (z.state === 'dying') return; z.burnDps = z.burnT > 0 ? Math.max(z.burnDps, dps) : dps; z.burnT = 3; }
function chill(z, k) { if (z.state === 'dying') return; k = Math.min(.6, k); z.chill = z.chillT > 0 ? Math.max(z.chill, k) : k; z.chillT = 1.5; }
const bossAlive = () => G.zombies.some(z => z.type === 'boss' && z.state !== 'dying');
const fenceUp = () => G.fence > 0 && !G.fenceDown;
// the big ones: more debris, no knockback, bigger health bars
const BIG = { brute: 1, giant: 1, boss: 1 };
const sideOf = (x, y) => Math.abs(x) >= Math.abs(y) ? (x > 0 ? 1 : 3) : (y > 0 ? 0 : 2);
const bunkerReach = () => bunkerInfo().half + .55;
// where a zombie stops: at the fence while it stands, else at the bunker wall; spitters and screamers keep
// their distance; a burrower comes up inside the fence
function stopRing(z, T) {
  const big = ((z.scale || 1) - 1) * .45; // a big boss keeps its body clear of what it hits
  if (z.under) return fenceUp() ? FENCE_R - .7 : bunkerReach() + .9 + big;
  const base = fenceUp() && z.n >= FENCE_R ? FENCE_R + .45 + big : bunkerReach() + big;
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
    if (z.chillT > 0) z.chillT -= dt;
    if (z.burnT > 0) {
      z.burnT -= dt;
      if (Math.random() < dt * 10) part(z.x + (Math.random() - .5) * .3, z.y + (Math.random() - .5) * .3, .5 + Math.random() * .8, 0, 0, .9, .35, rgb(255, 170, 60), rgb(200, 70, 40), 1, 1);
      if (!(z.shield > 0) && !z.under && wound(z, z.burnDps * dt)) continue;
    }
    // a regenerator knits back together when it has not been hit for a moment; a regrowing boss all the time (its
    // pattern); neither while it burns
    z.healing = ((T.special === 'regen' && G.time - z.lastHit > 1.5) || z.regen > 0) && z.hp < z.max && !(z.burnT > 0);
    if (z.healing) z.hp = Math.min(z.max, z.hp + z.max * (z.regen || .06) * dt);
    // tricks that take over the body for a moment: a leap over the fence, diving in, coming up
    if (z.state === 'leap') {
      const L = z.leap, t = Math.min(1, (z.st += dt) / L.dur);
      z.x = lerp(L.x0, L.x1, t); z.y = lerp(L.y0, L.y1, t); z.n = Math.max(Math.abs(z.x), Math.abs(z.y)); // the arc is in the art
      if (z.type === 'boss') z.zh = Math.sin(t * Math.PI) * 1.6; // a boss's art has none: it is lifted
      if (t >= 1) {
        z.state = 'walk'; z.zh = 0; z.leapt = true; spray(z.x, z.y, .1, 8, 1.6, 1.2, .5, [rgb(120, 104, 80), rgb(150, 130, 100)]); sound('thud');
        if (z.landStun) { z.landStun = false; spray(z.x, z.y, .1, 18, 2.6, 1, .6, DUST); stunGunner(3); }
      }
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
      // a charging boss first plants itself and paws the ground (dust), then dashes in a trail of dust
      if (z.wind > 0) { z.wind -= dt; if (Math.random() < dt * 12) spray(z.x, z.y, .05, 4, 1.8, 1, .5, DUST); continue; }
      if (z.charge > 0 && Math.random() < dt * 20) spray(z.x, z.y, .05, 2, .8, .8, .4, DUST);
      const pace = (z.charge > 0 ? 3 : z.speed * (z.n > FIELD - .3 ? 1.6 : 1) * (z.rage > 0 ? 1.6 : 1) * (z.under ? (z.type === 'boss' ? 4 : 1.3) : 1)) * (z.chillT > 0 ? 1 - z.chill : 1) * dt;
      z.x += Math.cos(ang) * pace; z.y += Math.sin(ang) * pace;
      z.n = Math.max(Math.abs(z.x), Math.abs(z.y));
      if (z.state === 'attack') z.leftAttack = G.time;
      z.walkDist += pace; z.yaw = ang; z.state = 'walk';
      if (z.under && Math.random() < dt * 6) spray(z.x, z.y, .05, 1, .8, 1.2, .4, [rgb(120, 96, 66)]);
      // a burrower dives as soon as it is on the island; a leaper jumps the fence from just outside it
      if ((T.special === 'burrow' || z.burrows) && !z.dug && z.n < FIELD - .8) { z.dug = true; z.state = 'dig'; z.st = 0; }
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
    // a charge ends in three quick blows, twice as hard
    if (z.charge > 0) { if (z.wind > 0) { z.wind -= dt; continue; } if ((z.chargeT -= dt) <= 0) { z.chargeT = .3; z.charge--; strike(z, atFence, 2); stomp(z); } continue; }
    const inc = dt * (z.rage > 0 ? 1.4 : 1) * (z.chillT > 0 ? 1 - z.chill : 1);
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
  keep(G.zombies, z => !z.gone);
  // acid globs in the air
  for (const g of G.spits) {
    g.t += dt;
    if (g.t < g.dur) continue;
    g.done = true;
    spray(g.tx, g.ty, g.tz ?? .2, 10, 1.6, 1.4, .6, ACID);
    if (g.tower != null) { SYS.hook.downTower(g.tower, g.down); sound('spit'); continue; }
    if (g.side >= 0 && fenceUp()) damageFence(g.side, g.power);
    else { G.hp -= g.power; G.hurt = .3; }
    sound('thud');
  }
  keep(G.spits, g => !g.done);
}
// a spitter lobs a glob of acid at the fence in front of it (or the bunker wall)
function spit(z, atFence) {
  const fence = fenceUp(), side = sideOf(z.x, z.y), R = fence ? FENCE_R : bunkerReach() - .5;
  const tx = side === 1 ? R : side === 3 ? -R : z.x * R / z.n, ty = side === 0 ? R : side === 2 ? -R : z.y * R / z.n;
  G.spits.push({ x: z.x, y: z.y, tx, ty, t: 0, dur: .7, power: z.hitPower * SYS.hook.taken(), side: fence ? side : -1 });
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
function strike(z, atFence, k = 1) {
  const amount = z.hitPower * SYS.hook.taken() * k;
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
  addDecal({ pts, color: rgb(150, 170, 70), life: 14 });
  sound('crash');
}
function burst(z, atFence) {
  splatter(z); z.gone = true;
  const amount = zombieHit(G.wave) * 12 * SYS.hook.taken();
  if (atFence) damageFence(sideOf(z.x, z.y), amount);
  else { G.hp -= amount; G.hurt = .5; }
}
function breakFence() {
  G.fenceHp = 0; G.fenceDown = true;
  const mat = fenceMat();
  for (let k = 0; k < 80; k++) { const [x, y] = SIDE_AT(k % 4, (Math.random() * 2 - 1) * FENCE_R); part(x, y, .3 + Math.random() * .5, (Math.random() - .5) * 3, (Math.random() - .5) * 3, 2 + Math.random() * 4, 1.6 + Math.random(), mat[1 + (k % 3)], mat[0], 2, 1); }
  G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0];
  composeYard(); notify('울타리 붕괴', '', 'danger'); sound('crash');
}
function fenceStages() {
  const max = fenceHp(G.fence) || 1;
  for (let k = 0; k < 4; k++) {
    const raw = G.sideDmg[k] / (max * .2), cur = G.sideStage[k];
    const st = raw >= cur + 1 ? clamp(Math.floor(raw), 0, 3) : raw < cur - .5 ? clamp(Math.floor(raw + .5), 0, 3) : cur;
    if (st !== cur) { G.sideStage[k] = st; fenceDirty = true; }
  }
}
function hurt(z, dmg, quiet, still, crit) {
  if (z.state === 'dying' || z.under) return;
  // a titan gathering itself between phases: nothing gets through (grey sparks)
  if (z.shield > 0) { spray(z.x, z.y, 1.3, 2, 1.4, .8, .25, SPARK); return; }
  dmg *= ZTYPES[z.type].armor || 1;
  z.lastHit = G.time;
  // a hit flashes white for a frame or two, at most every 0.4 s (never a white silhouette under steady fire)
  if (G.time - (z.flashAt ?? -9) >= .4) { z.hit = .033; z.flashAt = G.time; }
  const d = Math.hypot(z.x, z.y) || 1;
  if (!still && !BIG[z.type] && z.state !== 'leap') { z.x += z.x / d * .04; z.y += z.y / d * .04; z.n = Math.max(Math.abs(z.x), Math.abs(z.y)); }
  // only a critical hit shows its number, small and orange (none over a boss: the screen shows its health)
  if (crit && !quiet && z.type !== 'boss') { const j = Math.random() - .5; float(z.x + j * .7, z.y - j * .7, 1.8 + Math.random() * .3, fmt(Math.round(dmg)), rgb(255, 150, 50)); }
  spray(z.x, z.y, .9, 3, 1.2, 1.5, .4, [rgb(110, 40, 40), rgb(80, 120, 60)]);
  wound(z, dmg);
}
// health lost: a titan's phase ends at its share of the health (the rest of the blow is lost and it gathers itself),
// the split comes at half; true if it died
function wound(z, dmg) {
  const floor = phaseFloor(z);
  z.hp -= dmg;
  if (z.hp <= floor) { z.hp = floor; nextPhase(z); }
  if (z.splitAt && z.hp <= z.max * z.splitAt) splitBoss(z);
  if (z.hp > 0) return false;
  kill(z);
  return true;
}
function kill(z) {
  z.state = 'dying'; z.t = 0;
  if (z.type === 'bloater') { splatter(z); z.gone = true; }
  if (z.zh) z.zh = 0;
  // the gold with the systems' multipliers (commander, medals); a boss also pays the bounty relic's share (a titan's
  // split halves are plain kills); the clock stops with the last of them
  const s = G.wave, boss = z.type === 'boss' && !z.minion;
  let gold = z.reward * SYS.hook.goldMul();
  if (boss) gold += SYS.hook.bossKilled(s) || 0;
  if (!bossAlive()) G.bossLeft = 0;
  G.money += gold; G.totalKills++; G.earned += gold;
  SYS.hook.killed(z, s);
  if (boss) notify(z.titan ? '타이탄 처치' : '보스 처치', '+' + fmt(gold), 'good');
  if (z.type !== 'boss') float(z.x, z.y, 2.85, '+$' + fmt(gold), SIGNAL); // high enough not to overlap the damage number
  sound('kill');
  for (let k = 0; k < (BIG[z.type] ? 8 : 3); k++) part(z.x, z.y, 1, (Math.random() - .5) * 2, (Math.random() - .5) * 2, 3 + Math.random() * 2, .8, rgb(255, 214, 10), rgb(186, 132, 20), 2, 1);
  const pts = [];
  for (let k = 0; k < (BIG[z.type] ? 50 : 26); k++) {
    const a = Math.random() * 6.28, dd = Math.sqrt(Math.random()) * .45, p = project(z.x - Math.cos(z.yaw) * .5 + Math.cos(a) * dd, z.y - Math.sin(z.yaw) * .5 + Math.sin(a) * dd, 0);
    const ix = p.sx | 0, iy = p.sy | 0; if (ix >= 0 && iy >= 0 && ix < W && iy < H) pts.push(iy * W + ix);
  }
  addDecal({ pts, color: Math.random() < .5 ? rgb(70, 92, 50) : rgb(100, 44, 42), life: 12 });
  // a boss wave only ends with the boss
  G.waveKills = Math.min(G.waveKills + 1, bossAlive() ? killsNeeded(G.wave) - 1 : Infinity);
  if (G.waveKills >= killsNeeded(G.wave)) {
    G.waveKills = 0;
    SYS.hook.cleared(s);
    // repeat: the same stage again (a boss stage brings its boss back)
    if (G.repeat) { G.bossFor = 0; return; }
    G.wave++; G.best = Math.max(G.best, G.wave);
    if (!trySkip()) announce(G.wave);
  }
}
// a new stage: the kinds met for the first time, or just its number
function announce(w) {
  const fresh = mixOf(w).keys.filter(k => !G.seen.includes(k));
  if (fresh.length) { G.seen.push(...fresh); notify('새 변이체', fresh.map(zombieName).join(' · '), 'new'); }
  else if (!isBossWave(w)) notify('스테이지 ' + w);
}
// the base fell: two stages back. Starving, it is a forced evacuation instead (half the medals); before stage 50, or
// without the systems, one stage back. Nothing is ever deleted (the old game over wiped the save)
function fall() {
  if (G.hungry) {
    const r = SYS.hook.starved();
    if (r && !r.back) { notify('강제 환생', '훈장 +' + fmt(r.gain), 'danger'); sound('crash'); return; }
  }
  const back = Math.max(1, G.wave - (G.hungry ? 1 : 2));
  notify('기지 뚫림', '스테이지 ' + G.wave + ' → ' + back, 'danger');
  sound('crash');
  for (const z of G.zombies) z.gone = true;
  G.wave = back; G.waveKills = 0; G.zombies = []; G.spits = []; G.bossFor = 0; G.bossLeft = 0;
  G.hp = bunkerHp(G.bunker);
  if (G.fence) { G.fenceHp = fenceHp(G.fence); G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0]; composeYard(); }
  G.spawnIn = 3;
}

// a wave picked with the arrows (1 to the best reached): the field is cleared and that wave starts from its
// first zombie (a boss wave with its boss)
function goWave(w) {
  w = clamp(Math.round(w), 1, G.best);
  if (w === G.wave || G.over) return;
  for (const z of G.zombies) z.gone = true;
  G.wave = w; G.waveKills = 0; G.zombies = []; G.spits = []; G.bossFor = 0; G.bossLeft = 0; G.spawnIn = 1; G.skip = null;
}

/* ================= auto-skip (doc 6) ================= */
// In progress mode, a stage the firepower beats ten times over (five after 12 evacuations, seven with the clockwork
// relic) is skipped, up to 50 a jump, within the record (it re-climbs ground already won): the stage number runs up,
// the field is swept clean, speed lines cross it; nothing is paid for the stages jumped
function trySkip() {
  if (G.skip || G.repeat || G.over) return false;
  const to = SYS.hook.skipTo(G.wave);
  if (!(to > G.wave)) return false;
  for (const z of G.zombies) { if (z.state !== 'dying') spray(z.x, z.y, .3, 6, 1.6, 1.2, .5, DUST); z.gone = true; }
  G.zombies = []; G.spits = []; G.bossFor = 0; G.bossLeft = 0;
  G.skip = { from: G.wave, to, t: 0, dur: Math.max(.5, (to - G.wave) * SYS.hook.skipStep()) };
  notify('스킵', '스테이지 ' + G.wave + ' → ' + to);
  sound('leap');
  return true;
}
function updateSkip(dt) {
  const k = G.skip;
  k.t += dt;
  G.wave = Math.min(k.to, k.from + Math.floor((k.to - k.from) * k.t / k.dur));
  for (let n = Math.floor(dt * 90 + Math.random()); n > 0; n--) part((Math.random() * 2 - 1) * FIELD, (Math.random() * 2 - 1) * FIELD, .3 + Math.random() * .9, -7, 7, 1.6, .22, rgb(248, 246, 236), null, 7, 1);
  if (k.t < k.dur) return;
  G.skip = null; G.wave = k.to; G.best = Math.max(G.best, G.wave); G.waveKills = 0; G.bossFor = 0; G.spawnIn = 1;
  SYS.hook.skipped(k.to - 1);
  if (!trySkip()) announce(G.wave);
}

/* ================= boss patterns (the logic's PATTERNS: its band's, and past stage 100 more at half strength) ================= */
// Each runs on its own clock once the boss is on the island (a half-strength one half as often) and shows itself one
// way: a charge kicks up dust before the dash, a swarm bursts out of the dust at the edge, acid arcs onto a turret,
// armour throws grey sparks, a burrow leaves a mound, a howl rings out, a leap lands in dust and a gunner sees stars,
// regrowth sparkles, a titan's next phase shakes the ground and its split bursts
const BOSS_EVERY = { charge: 12, swarm: 8, acidPool: 10, howl: 15, leapStun: 14, turretStun: 15 };
const DUST = [rgb(150, 130, 100), rgb(120, 104, 80), rgb(190, 176, 150)], ACID = [rgb(170, 220, 60), rgb(120, 180, 40), rgb(210, 240, 120)], SPARK = [rgb(222, 222, 230), rgb(150, 150, 160)];
function bossSetup(z, w) {
  const pats = SYS.hook.bossPatterns(w), str = k => pats.reduce((a, p) => a + (p.key === k ? p.w : 0), 0), ph = SYS.hook.bossPhases(w);
  z.pats = pats.filter(p => BOSS_EVERY[p.key]).map(p => ({ key: p.key, w: p.w, t: BOSS_EVERY[p.key] / p.w * .5 }));
  if (str('burrow') >= 1) z.burrows = true;            // the logic: only a full-strength burrow gets inside the fence
  if (str('regen')) z.regen = .03 * str('regen');
  if (str('frontArmor')) z.armor = Math.min(.9, .9 * str('frontArmor'));
  if (str('split')) { z.splitAt = .5; z.splitShare = .125 * str('split'); }
  if (ph && ph.phases.length > 1) { z.phases = ph.phases; z.phase = 0; z.phaseGap = ph.gap; }
}
function bossTick(dt) {
  for (const z of G.zombies) {
    if (z.type !== 'boss' || z.minion || z.state === 'dying' || !z.pats) continue;
    if (z.shield > 0) z.shield -= dt;
    if (z.n > FIELD - .3 || z.under || z.state !== 'walk' && z.state !== 'attack') continue;
    for (const p of z.pats) if ((p.t -= dt) <= 0) { p.t += BOSS_EVERY[p.key] / p.w; BOSS_DO[p.key](z, p.w); }
  }
}
// acid lobbed at a turret's mount: that turret stops for sec seconds (a base without turrets takes it on the wall)
function lobAcid(z, t, sec) { G.spits.push({ x: z.x, y: z.y, tx: t.x, ty: t.y, tz: t.z + .25, t: 0, dur: .9, power: 0, side: -1, tower: t.slot, down: sec }); }
const BOSS_DO = {
  charge(z) { z.charge = 3; z.chargeT = 0; z.wind = .7; spray(z.x, z.y, .1, 16, 2.2, 1.4, .6, DUST, 2, 1); sound('thud'); },
  swarm(z, w) {
    // the pack comes in beside the boss out of a burst of dust at the island's edge
    const a = Math.atan2(z.y, z.x), n = Math.round(2 + 3 * w);
    for (let k = 0; k < n; k++) {
      const b = a + (Math.random() - .5) * .8, c = Math.cos(b), d = Math.sin(b), r = (FIELD + .6) / Math.max(Math.abs(c), Math.abs(d)), o = spawn('runner');
      o.x = c * r; o.y = d * r; o.n = Math.max(Math.abs(o.x), Math.abs(o.y)); o.yaw = Math.atan2(-o.y, -o.x);
    }
    const c = Math.cos(a), d = Math.sin(a), r = (FIELD - .2) / Math.max(Math.abs(c), Math.abs(d));
    spray(c * r, d * r, .1, 22, 2.6, 1.2, .8, DUST); sound('scream');
  },
  acidPool(z) {
    const ts = SYS.towers();
    if (!ts.length) { spit(z, fenceUp() && z.n >= FENCE_R); return; }
    lobAcid(z, ts[Math.floor(Math.random() * ts.length)], 5); sound('spit');
  },
  howl(z) {
    for (const o of G.zombies) if (o.state !== 'dying') o.rage = Math.max(o.rage || 0, 5);
    for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; part(z.x, z.y, 1.4, Math.cos(a) * 4.5, Math.sin(a) * 4.5, 2.5, .6, rgb(255, 214, 200), rgb(200, 120, 110), 2, 2); }
    z.screamT = .8; sound('scream');
  },
  leapStun(z) {
    // over the fence (or a hop in place at the wall) onto the gunners
    const R = bunkerReach() + .3 + ((z.scale || 1) - 1) * .45, k = z.n > R ? R / z.n : 1;
    z.state = 'leap'; z.st = 0; z.leap = { x0: z.x, y0: z.y, x1: z.x * k, y1: z.y * k, dur: .9 }; z.landStun = true; sound('leap');
  },
  turretStun(z) {
    const ts = SYS.towers();
    if (!ts.length) return;
    for (const t of ts) lobAcid(z, t, 5);
    sound('spit');
  },
};
// a titan's phases: where the current one ends, and the next one beginning (it gathers itself for the phase gap)
function phaseFloor(z) {
  if (!z.phases || z.phase >= z.phases.length - 1) return -Infinity;
  let s = 0;
  for (let k = 0; k <= z.phase; k++) s += z.phases[k];
  return z.max * (1 - s);
}
function nextPhase(z) {
  z.phase++; z.shield = z.phaseGap || 2;
  notify('타이탄 ' + (z.phase + 1) + '단계', '', 'danger');
  stomp(z); G.hurt = .45;
  SYS.changed();
}
// a titan at half its health bursts into three: two halves of a quarter of its health walk on beside it
function splitBoss(z) {
  z.splitAt = 0;
  spray(z.x, z.y, 1, 30, 3.4, 3, 1, [rgb(176, 196, 90), rgb(120, 150, 60), rgb(210, 220, 130)], 2, 2); sound('crash'); G.hurt = .4;
  // the halves stand out to either side of it and a step nearer the base, clear of its own bulk
  const r = Math.atan2(z.y, z.x);
  for (const side of [-1, 1]) {
    const o = spawn('boss'), a = r + side * Math.PI / 2, off = 1.1 * (z.scale || 1);
    Object.assign(o, { minion: true, titan: z.titan, name: z.name, x: z.x + Math.cos(a) * off - Math.cos(r) * .8, y: z.y + Math.sin(a) * off - Math.sin(r) * .8, swerve: side * .3, state: 'walk', reward: z.reward * .1 });
    dressBoss(o, G.wave, true);
    spray(o.x, o.y, .4, 14, 2.4, 2, .7, [rgb(176, 196, 90), rgb(120, 150, 60)], 2, 2);
    o.n = Math.max(Math.abs(o.x), Math.abs(o.y)); o.max = o.hp = z.max * (z.splitShare || .125); o.yaw = z.yaw;
  }
}
