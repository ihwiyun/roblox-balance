// node tests/sim/run.mjs [bot] [profile] [untilStage] [days] [seed]
import { run, summarize } from './sim.mjs';
const [bot = 'human', profile = 'f2p', until = '1000', days = '60', seed = '1'] = process.argv.slice(2);
const t0 = performance.now();
const M = run({ bot, profile, untilStage: +until, days: +days, seed: +seed });
const s = summarize(M);
console.log(JSON.stringify(s, null, 1));
console.log('ms', Math.round(performance.now() - t0));
