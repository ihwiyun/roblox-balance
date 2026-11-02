'use strict';
// Input and boot: tap to shoot, speed button, and the frame loop.
/* ================= input ================= */
canvas.addEventListener('pointerdown', e => {
  ensureAudio();
  if (G.view !== 'yard' || !G.hero) return;
  const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height, hero = G.hero;
  if (hero.reload > 0) { hero.reload = Math.max(.01, hero.reload - hero.reloadLen * .12); return; } // tapping hurries the reload
  let best = null, bestD = 20; // game pixels: a 32 px figure is easy to hit with a thumb
  for (const z of G.zombies) { if (z.state === 'dying' || !z.visible) continue; const d = Math.hypot(z.sx - x, z.sy - y); if (d < bestD) { bestD = d; best = z; } }
  if (best) { hero.target = best; hero.retarget = .8; hero.yaw = Math.atan2(best.y - hero.y, best.x - hero.x); fire(hero, best); }
});
nodes.speed.addEventListener('click', () => { G.speed = G.speed === 1 ? 2 : 1; nodes.speed.textContent = G.speed + '배속'; nodes.speed.setAttribute('aria-pressed', String(G.speed === 2)); });

/* ================= boot ================= */
loadSprites();
load();
bakeGround();
bakeYard();
G.hero = makeHero(); { const s = SITES[0]; G.hero.x = s[0]; G.hero.y = s[1]; G.hero.z = s[2]; }
growGrass();
bakeUnder();
showYard();
for (const c of G.crew) if (c) sendTo(c, workSpot(c), 'toWork');
renderPanel(true);
refreshTop();
addEventListener('resize', fitStage);
fitStage();
let last = performance.now(), hudIn = 0;
// after the tab was hidden the time away is credited separately (state.js), so the loop starts fresh
function resumeClock() { last = performance.now(); }
function frame(now) {
  let dt = Math.min(CATCH_UP, (now - last) / 1000) * G.speed;
  last = now;
  // a long catch-up runs quietly: a burst of every kill and thud at once is just noise
  quiet = dt > .5;
  while (dt > 0) { const step = Math.min(.04, dt); update(step); dt -= step; }
  quiet = false;
  draw();
  refreshAmmo();
  if (--hudIn <= 0) { hudIn = 6; refreshTop(); renderPanel(false); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__bunker = { G, draw, step(dt, noDraw) { update(dt); if (!noDraw) draw(); }, act, refreshTop, renderPanel, bakeYard, bakeUnder, setView, resyncPosts };
