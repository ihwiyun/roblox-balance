'use strict';
// The simulation step and the per-frame drawing of both views.
/* ================= the loop ================= */
// bake the fence overlays of the current level ahead of time: one side and wear stage per frame
function warmFence() {
  if (!G.fence || fenceCacheLevel === G.fence && fenceCache.size >= 20) return;
  for (let side = 0; side < 4; side++) for (const wear of [0, 1, 2, 3, 5]) {
    if (fenceCacheLevel === G.fence && fenceCache.has(side * 8 + wear)) continue;
    fenceOverlay(side, wear);
    if (G.view === 'under') showUnder(); else showYard(); // the capture used the shared buffers
    return;
  }
}
function update(dt) {
  if (G.over) return;
  G.time += dt;
  // food and minerals from the floors below and parts from the workshop, up to what their stores hold (what does not
  // fit becomes commander XP, systems.js); then mouths to feed
  const store = (k, cap, add) => { const kept = Math.min(Math.max(0, cap - G[k]), add); G[k] += kept; if (add > kept) SYS.hook.spill(add - kept); return kept; };
  store('food', foodCap(), rateOf('food') * dt);
  SYS.hook.ore(store('mineral', mineralCap(), rateOf('mineral') * dt));
  store('comps', partsCap(), rateOf('parts') * dt);
  const eat = hired().length * UPKEEP * SYS.hook.upkeep();
  G.food -= eat * dt;
  const wasHungry = G.hungry;
  G.hungry = G.food <= 0 && hired().length > 0;
  if (G.food < 0) G.food = 0;
  if (G.hungry && !wasHungry) notify('식량 바닥', '', 'danger');
  // running low: a warning while there is still time to act
  const net = rateOf('food') - eat;
  if (!G.hungry && net < 0 && G.food < -net * 45) notify('식량 부족', Math.ceil(G.food / -net) + '초 뒤 바닥', 'danger', 60);
  // a long hunger drives the newest hand away
  if (G.hungry) {
    G.starve = (G.starve || 0) + dt;
    if (G.starve >= STARVE_LEAVE) {
      G.starve = STARVE_LEAVE / 2;
      const i = G.crew.map((c, k) => c ? k : -1).filter(k => k >= 0).pop();
      if (i != null) { notify('굶주림', G.crew[i].name + ' 떠남', 'danger', 0); G.crew[i] = null; resyncPosts(); markUnder(0); renderPanel(true); }
    }
  } else G.starve = Math.max(0, (G.starve || 0) - dt * 2);
  // repairs: a slow free patch-up, and a fast one that eats food (bunker) or money (fence). The workshop's hands mend
  // 0.4% a second each, the fence first, then the bunker; relics and cards speed it all up (systems.js)
  const maxHp = bunkerHp(G.bunker), rep = SYS.hook.repair(), hands = SYS.hook.repairShare(activeOn('정비공')), fenceHurt = G.fence && G.fenceHp < fenceHp(G.fence);
  G.hp = Math.min(maxHp, G.hp + maxHp * (.005 * rep + (fenceHurt ? 0 : hands)) * dt);
  const paid = Math.min(maxHp - G.hp, maxHp * .015 * rep * dt, G.food / REPAIR_FOOD);
  if (paid > 0) { G.hp += paid; G.food -= paid * REPAIR_FOOD; }
  if (G.fence) {
    const max = fenceHp(G.fence), free = Math.max(0, Math.min(max - G.fenceHp, max * (.005 * rep + hands) * dt));
    const fix = Math.max(0, Math.min(max - G.fenceHp - free, max * .02 * rep * dt, G.money / REPAIR_MONEY));
    G.money -= fix * REPAIR_MONEY;
    const heal = free + fix;
    G.fenceHp += heal;
    for (let k = 0; k < 4; k++) G.sideDmg[k] = Math.max(0, G.sideDmg[k] - heal / 2);
    if (G.fenceDown && G.fenceHp >= max * .4) { G.fenceDown = false; G.sideDmg = [0, 0, 0, 0]; G.sideStage = [0, 0, 0, 0]; composeYard(); sound('hammer'); }
    else if (!G.fenceDown) fenceStages();
  }
  // a boss stage starts with its boss, on its clock
  if (isBossWave(G.wave) && G.bossFor !== G.wave) { G.bossFor = G.wave; spawnBoss(); }
  if (G.bossLeft > 0 && bossAlive() && (G.bossLeft -= dt) <= 0) bossTimeout();
  if ((G.spawnIn -= dt) <= 0) { if (G.zombies.reduce((n, z) => n + (z.state !== 'dying'), 0) < MAX_ZOMBIES) spawn(); G.spawnIn = spawnEvery(G.wave) * (.6 + Math.random() * .8); }
  updateZombies(dt);
  if (G.hp <= 0) fall();
  updatePeople(dt);
  assignTargets(dt);
  for (const s of shooters()) updateShooter(s, dt);
  // the systems' clock: the turrets fire, gems for play, the daily gift, automation (systems.js)
  SYS.hook.tick(dt);
  // the floors below at work: sparks off the drill and the picks, leaves from the farm
  if (!G.hungry) {
    if (G.mine && G.floorView === 2) inDugout(2, () => { if (Math.random() < dt * 8) part(PIT.x, PIT.y, FLOOR_Z[2] + .05, (Math.random() - .5) * 2.4, (Math.random() - .5) * 2.4, 2.2, .45, rgb(255, 204, 96), null); });
    for (const c of G.crew) {
      if (!atWork(c) || c.where !== 'ug') continue;
      if (c.job === '광부') { const ph = (c.act * 2.6) % 3, prev = ((c.act - dt) * 2.6) % 3; if (prev < 2 && ph >= 2 && G.floorView === 2) inDugout(2, () => { const h = c.hit || { x: c.x + .05, y: UG.y0 + .1, z: .9 }; spray(h.x, h.y, toFloorZ(c.z, 2) + h.z, 6, 1.5, 2.2, .7, [rgb(110, 150, 214), rgb(150, 146, 140), rgb(255, 214, 120)]); }); }
      if (c.job === '농부' && G.floorView === 1 && Math.random() < dt * 1.2) inDugout(1, () => part(c.x + (Math.random() - .5) * .6, c.y - .7, toFloorZ(c.z, 1) + 1 + Math.random() * .4, 0, 0, -.2, .8, rgb(140, 210, 110), null));
    }
    // the workshop's hands at the bench: sparks off the hammer
    for (const c of G.crew) {
      if (!atWork(c) || c.job !== '정비공' || c.where !== 'yard' || Math.random() >= dt * 2.5) continue;
      spray(c.x + Math.cos(c.yaw) * .35, c.y + Math.sin(c.yaw) * .35, .45, 3, 1.2, 1.4, .3, [rgb(255, 214, 120), rgb(255, 160, 60)]);
    }
  }
  G.hurt = Math.max(0, G.hurt - dt);
  for (const t of G.tracers) t.life -= dt;
  keep(G.tracers, t => t.life > 0);
  updateParts(dt);
  ageDecals(dt);
  if ((G.saveIn -= dt) <= 0) { save(); G.saveIn = 5; }
  // the store rooms below show what you hold: rebuild them when a stack grows or shrinks
  // once a second, below ground: a pile that grew or shrank only lays its cached overlay again
  if (G.view === 'under' && Math.floor(G.time) !== Math.floor(G.time - dt) && STOCK_KINDS.map(k => stockLevel(G[k])).join() !== stockSeen) composeUnder();
  if (fenceDirty) composeYard(); // a fence side changed its wear: lay the cached overlays again
  warmFence();
}
// the ground with its stains and its swaying grass only changes at the wind's 8 steps a second (or when the
// baked picture or the stains change), so it is kept between those steps instead of redrawn every frame
const groundFrame = new Uint32Array(W * H);
let groundWind = -1, groundFade = -1, groundCut = -1, groundDecals = 0, groundSrc = null;
function drawYard() {
  const windT = STILL || !settings.wind ? 0 : Math.floor(G.time * WIND_FPS) / WIND_FPS;
  // redrawn at each wind step, while a stain fades (4 times a second), or when one is gone; a new stain is
  // painted onto the kept frame
  let fade = -1;
  for (const d of G.decals) if (d.life < 2) { fade = Math.floor(G.time * 4); break; }
  zb.set(bakedZ);
  if (windT !== groundWind || fade !== groundFade || DECALS.cut !== groundCut || groundSrc !== bakedVersion) {
    pix.set(bakedPix);
    for (const d of G.decals) paintDecal(d);
    drawTufts(windT);
    groundFrame.set(pix); groundWind = windT; groundFade = fade; groundCut = DECALS.cut; groundSrc = bakedVersion; groundDecals = G.decals.length;
  } else {
    pix.set(groundFrame);
    if (groundDecals < G.decals.length) { for (let k = groundDecals; k < G.decals.length; k++) paintDecal(G.decals[k]); groundFrame.set(pix); groundDecals = G.decals.length; }
  }
  applyFlash('yard');
  for (const z of G.zombies) drawZombie(z);
  if (G.hero) drawPerson(G.hero);
  for (const c of G.crew) if (c && c.where === 'yard') drawHand(c);
  SYS.hook.drawYard(); // the turrets on the bunker's mounts
  castSpriteShadows(SHX, SHY);
  for (const t of G.tracers) pxLine(Math.round(t.ax), Math.round(t.ay), Math.round(t.bx), Math.round(t.by), SIGNAL, 99);
  // acid globs: an arc from the spitter's mouth to where they land, with a short dripping trail
  for (const g of G.spits) for (let k = 0; k < 3; k++) {
    const t = clamp(g.t / g.dur - k * .06, 0, 1), p = project(lerp(g.x, g.tx, t), lerp(g.y, g.ty, t), 1 + Math.sin(t * Math.PI) * 1.4 - t * .6);
    const c = k ? rgb(120, 170, 40) : rgb(190, 235, 80), r = k ? 0 : 1;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) putPx(Math.round(p.sx) + dx, Math.round(p.sy) + dy, c, p.d + .3);
  }
  drawParts(G.parts);
  // lamps glow with a small flicker; the fortress beacon turns and sweeps a dashed beam
  for (let n = 0; n < GLOWS.length; n++) {
    if (Math.sin(G.time * 7 + n * 2.3) > .94) continue;
    const g = GLOWS[n], p = project(g.x, g.y, g.z), x = Math.round(p.sx), y = Math.round(p.sy), d = p.d + .15;
    putPx(x, y, g.c, d); putPx(x + 1, y, g.soft, d); putPx(x - 1, y, g.soft, d); putPx(x, y - 1, g.soft, d); putPx(x, y + 1, g.soft, d);
  }
  if (BEACON) {
    const [bx, by, bz] = BEACON, a = G.time * 4, p = project(bx, by, bz), q = project(bx + Math.cos(a) * 1.6, by + Math.sin(a) * 1.6, bz + .15);
    const n = Math.max(1, Math.round(Math.hypot(q.sx - p.sx, q.sy - p.sy)));
    for (let k = 2; k <= n; k += 2) putPx(Math.round(lerp(p.sx, q.sx, k / n)), Math.round(lerp(p.sy, q.sy, k / n)), k < n / 2 ? rgb(255, 170, 120) : rgb(255, 214, 170), p.d + .6);
    const on = Math.floor(G.time * 4) % 2 ? rgb(255, 80, 56) : rgb(255, 196, 120);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]]) putPx(Math.round(p.sx) + dx, Math.round(p.sy) + dy, on, p.d + .7);
  }
  // the electric fence: blinking lights on the posts and the odd spark
  if (G.fence && fenceInfo().electric && !G.fenceDown) {
    const k = fenceSub();
    if (k >= 3 && Math.floor(G.time * 2) % 2) for (let side = 0; side < 4; side++) { const [x, y] = SIDE_AT(side, -FENCE_R); const p = project(x, y, .66); putPx(Math.round(p.sx), Math.round(p.sy), rgb(255, 80, 60), 99); }
    if (k >= 5 && Math.random() < .3) { const side = Math.floor(Math.random() * 4), [x, y] = SIDE_AT(side, (Math.random() * 2 - 1) * FENCE_R); const p = project(x, y, .3 + Math.random() * .3); putPx(Math.round(p.sx), Math.round(p.sy), rgb(200, 240, 255), 99); putPx(Math.round(p.sx) + 1, Math.round(p.sy), rgb(140, 210, 255), 99); }
  }
  drawBars();
  if (G.hero) drawAmmo(G.hero);
  for (const f of G.floats) { const p = project(f.x, f.y, f.z); if (f.life > .25 || Math.floor(f.life * 20) % 2) pixelText(f.text, p.sx, p.sy - 6, f.color); }
}
// a workshop hand at the bench swings its hammer (the miner's swing, hard hat and all)
function drawHand(c) {
  if (c.job !== '정비공' || !atWork(c)) return drawPerson(c);
  c.job = '광부';
  try { drawPerson(c); } finally { c.job = '정비공'; }
}
function drawUnder() {
  pix.set(bakedPix); zb.set(bakedZ);
  applyFlash('under');
  const v = G.floorView || 0;
  // the mine's machinery moves
  if (G.mine && v === 2) {
    const fz = FLOOR_Z[2], { x, y } = PIT, run = !G.hungry;
    if (facTier(G.mine) === 0) {
      const depth = run ? Math.sin(G.time * 1.3) * .5 + .5 : .5, p0 = project(x, y, fz + 1.3), p1 = project(x, y, fz + 1.2 - depth * 1.6);
      pxLine(Math.round(p0.sx), Math.round(p0.sy), Math.round(p1.sx), Math.round(p1.sy), rgb(200, 186, 150), p1.d + .5);
      for (let yy = 0; yy < 3; yy++) for (let xx = -1; xx <= 1; xx++) putPx(Math.round(p1.sx) + xx, Math.round(p1.sy) + yy, rgb(118, 96, 70), p1.d + .6);
    } else {
      const top = fz + (facTier(G.mine) === 1 ? 2.05 : 2.15), spin = run ? G.time * 14 : 0, dz = run ? Math.sin(G.time * 2) * .12 : 0;
      for (let z = fz - .2; z < top - .1; z += STEP) { const p = project(x, y, z + dz), band = Math.floor(z * 6 + spin) & 1; putPx(Math.round(p.sx), Math.round(p.sy), band ? rgb(210, 214, 220) : rgb(96, 100, 108), p.d + .3); putPx(Math.round(p.sx) + 1, Math.round(p.sy), rgb(70, 74, 80), p.d + .3); }
    }
  }
  // people on this floor, and anyone on the ladder between the opening in the floor and the hood over its top:
  // a climber goes up behind the hood (on B1 out through the hatch) and comes down from behind it feet first,
  // so whatever of them is above its lower edge is wiped back to the room picture
  const top = shaftTop(v) - FLOOR_Z[v], hood = hoodEdge(v);
  for (const c of G.crew) {
    if (!c || c.where !== 'ug') continue;
    const rel = c.z - LEVEL_Z[v];
    if (rel < -1.3 || rel > top) continue;
    if (c.state === 'sleep' && !c.path.length) { if (v === 0) drawSleeper(c); continue; }
    drawPerson(c, FLOOR_Z[v] - LEVEL_Z[v]);
    if (rel > .2 && Math.abs(c.x - SHAFT.x) < 1 && c.y < LADDER_Y + .6) {
      for (let ix = hood.i0; ix <= hood.i1; ix++) for (let iy = Math.max(0, hood.rows[ix] - 48); iy < hood.rows[ix]; iy++) { const i = iy * W + ix; pix[i] = bakedPix[i]; zb[i] = bakedZ[i]; }
    }
  }
  castSpriteShadows(.25, .1);
  drawParts(G.uparts, v);
}
function draw() {
  if (G.view === 'under') drawUnder(); else drawYard();
  const shake = G.hurt > .2 && G.view === 'yard' ? (Math.floor(G.time * 40) % 2 ? 1 : -1) : 0;
  ctx.putImageData(image, shake, 0);
}
