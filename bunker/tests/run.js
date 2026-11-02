// Runs every test: node bunker/tests/run.js [--sim]
//   unit/*.test.mjs   each exports `tests` = [[name, fn], ...]
//   a short simulation smoke run (human bot, free player, to stage 60)
//   --sim             also the full acceptance report (tests/sim/report.mjs, a few minutes)
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const dir = path.join(__dirname, 'unit');
  let pass = 0, fail = 0;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort()) {
    const { tests } = await import(pathToFileURL(path.join(dir, file)).href);
    for (const [name, fn] of tests) {
      const t0 = Date.now();
      try { await fn(); pass++; console.log(`  ok   ${file} > ${name} (${Date.now() - t0} ms)`); }
      catch (e) { fail++; console.log(`  FAIL ${file} > ${name}\n       ${String(e && e.message).split('\n').join('\n       ')}`); }
    }
  }
  const sim = await import(pathToFileURL(path.join(__dirname, 'sim', 'sim.mjs')).href);
  try {
    const M = sim.run({ bot: 'human', profile: 'f2p', untilStage: 60, days: 10, seed: 1 });
    if (M.st.record < 60) throw new Error(`smoke run stopped at stage ${M.st.record}`);
    pass++; console.log(`  ok   sim smoke > human/f2p reaches stage 60 (${M.endActive.toFixed(2)} h active)`);
  } catch (e) { fail++; console.log(`  FAIL sim smoke > ${e.message}`); }
  if (process.argv.includes('--sim')) {
    const { report } = await import(pathToFileURL(path.join(__dirname, 'sim', 'report.mjs')).href);
    const r = await report({ quiet: false });
    for (const c of r.criteria) { if (c.pass) pass++; else fail++; console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} criterion > ${c.name}: ${c.value}`); }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
