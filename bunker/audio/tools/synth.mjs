// Generated sound effects for the bunker game (sfxr-style synthesis, no dependencies).
// Usage: node synth.mjs <output-dir>
// Writes 16-bit mono 44.1 kHz WAV files plus generated.json (id -> description).
// Everything here is our own synthesis: the output is ours to use, no licence strings attached.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SR = 44100;
const outDir = process.argv[2];
if (!outDir) { console.error('usage: node synth.mjs <output-dir>'); process.exit(1); }
mkdirSync(outDir, { recursive: true });

// ---------- helpers ----------
function rng(seed) { // mulberry32: same seed, same sound
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
function mix(dst, src, at = 0, gain = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * gain;
}
function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
// envelope: attack (s), decay time-constant (s), sustain level, release (s, at the end)
function env(tt, dur, { a = 0.005, d = 0.1, s = 0, r = 0.01, hold = 0 } = {}) {
  let v;
  if (tt < a) v = tt / a;
  else if (tt < a + hold) v = 1;
  else v = s + (1 - s) * Math.exp(-(tt - a - hold) / d);
  if (tt > dur - r) v *= Math.max(0, (dur - tt) / r);
  return v;
}
// state-variable lowpass/highpass/bandpass, cutoff may be a function of time
function svf(x, { type = 'lp', cutoff = 2000, q = 0.7 }) {
  const y = new Float32Array(x.length); let low = 0, band = 0;
  for (let i = 0; i < x.length; i++) {
    const fc = typeof cutoff === 'function' ? cutoff(i / SR) : cutoff;
    const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR), damp = 1 / q;
    for (let k = 0; k < 2; k++) { // 2x oversampled for stability at high cutoffs
      low += f * band; const high = x[i] - low - damp * band; band += f * high;
      if (k === 1) y[i] = type === 'lp' ? low : type === 'hp' ? high : band;
    }
  }
  return y;
}

// one oscillator note with pitch glide, vibrato, duty and an envelope
function tone({ dur, f0, f1 = f0, wave = 'square', duty = 0.5, vib = 0, vibRate = 6, envp = {}, gain = 0.5,
  lp = null, detune = 0, voices = 1, seed = 1, crush = 0 }) {
  const out = buf(dur), rand = rng(seed);
  for (let v = 0; v < voices; v++) {
    let ph = rand();
    const det = voices > 1 ? (v / (voices - 1) - 0.5) * 2 * detune : 0;
    for (let i = 0; i < out.length; i++) {
      const tt = i / SR, k = tt / dur;
      let f = f0 * (f1 / f0) ** k * 2 ** (det / 1200);
      if (vib) f *= 2 ** ((vib * Math.sin(2 * Math.PI * vibRate * tt) * Math.min(1, tt / 0.15)) / 1200);
      const dt = f / SR; ph += dt; if (ph >= 1) ph -= 1;
      let s;
      if (wave === 'sine') s = Math.sin(2 * Math.PI * ph);
      else if (wave === 'tri') s = 1 - 4 * Math.abs(ph - 0.5);
      else if (wave === 'saw') s = 2 * ph - 1 - polyblep(ph, dt);
      else { // band-limited pulse, centred on zero (a 25 % pulse has a DC offset of -0.5 that would thump on every note)
        s = (ph < duty ? 1 : -1) + polyblep(ph, dt) - polyblep((ph - duty + 1) % 1, dt) - (2 * duty - 1);
      }
      out[i] += (s * env(tt, dur, envp) * gain) / Math.sqrt(voices);
    }
  }
  let y = lp ? svf(out, { type: 'lp', cutoff: lp, q: 0.8 }) : out;
  if (crush) { const step = 2 ** crush; for (let i = 0; i < y.length; i++) y[i] = Math.round(y[i] * step) / step; }
  return y;
}
function noise({ dur, envp = {}, gain = 0.5, type = 'lp', cutoff = 3000, q = 0.8, seed = 7 }) {
  const x = buf(dur), rand = rng(seed);
  for (let i = 0; i < x.length; i++) x[i] = (rand() * 2 - 1) * env(i / SR, dur, envp) * gain;
  return svf(x, { type, cutoff, q });
}
// bell: inharmonic sine partials with their own decays
function bell({ dur, f, gain = 0.4, decay = 0.6, partials = [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]] }) {
  const out = buf(dur);
  for (const [ratio, amp] of partials) {
    if (f * ratio > SR / 2.2) continue;
    const d = decay / Math.sqrt(ratio);
    for (let i = 0; i < out.length; i++) {
      const tt = i / SR;
      out[i] += Math.sin(2 * Math.PI * f * ratio * tt) * amp * gain * Math.exp(-tt / d) * Math.min(1, tt / 0.002);
    }
  }
  return out;
}
function boom({ dur = 0.6, f0 = 150, f1 = 40, gain = 0.9, decay = 0.25 }) {
  const out = buf(dur); let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const tt = i / SR, f = f1 + (f0 - f1) * Math.exp(-tt / 0.04);
    ph += f / SR; out[i] = Math.sin(2 * Math.PI * ph) * gain * Math.exp(-tt / decay) * Math.min(1, tt / 0.001);
  }
  return out;
}
// Freeverb-style reverb (mono), returns wet signal only
function reverb(x, { room = 0.84, damp = 0.25, tail = 1.5 } = {}) {
  const n = x.length + Math.round(tail * SR), y = new Float32Array(n);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  for (const len of combs) {
    const line = new Float32Array(len); let idx = 0, store = 0;
    for (let i = 0; i < n; i++) {
      const inp = i < x.length ? x[i] : 0, out = line[idx];
      store = out * (1 - damp) + store * damp; line[idx] = inp * 0.015 + store * room;
      idx = (idx + 1) % len; y[i] += out;
    }
  }
  for (const len of aps) {
    const line = new Float32Array(len); let idx = 0;
    for (let i = 0; i < n; i++) {
      const b = line[idx], inp = y[i]; y[i] = -inp + b; line[idx] = inp + b * 0.5; idx = (idx + 1) % len;
    }
  }
  return y;
}
function withVerb(dry, wet = 0.25, opts) {
  const w = reverb(dry, opts), out = new Float32Array(w.length);
  for (let i = 0; i < out.length; i++) out[i] = (i < dry.length ? dry[i] : 0) + w[i] * wet;
  return out;
}
function trimTail(x, floorDb = -70) {
  const thr = 10 ** (floorDb / 20); let end = x.length;
  while (end > 1 && Math.abs(x[end - 1]) < thr) end--;
  const y = x.slice(0, Math.min(x.length, end + Math.round(0.01 * SR)));
  const fade = Math.min(y.length, Math.round(0.008 * SR));
  for (let i = 0; i < fade; i++) y[y.length - 1 - i] *= i / fade;
  return y;
}
function writeWav(name, x) {
  x = trimTail(x);
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.89 / peak : 1; // -1 dBFS here; process.py does the final true-peak pass
  const data = Buffer.alloc(44 + x.length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + x.length * 2, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36);
  data.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * g * 32767))), 44 + i * 2);
  writeFileSync(join(outDir, name + '.wav'), data);
  return +(x.length / SR).toFixed(3);
}

// ---------- building blocks for the reveals ----------
function riser(dur, { from = 300, to = 4000, gain = 0.35, seed = 3 } = {}) {
  const n = noise({ dur, gain, type: 'bp', q: 2.5, seed, envp: { a: dur * 0.9, d: 1, s: 1, r: 0.02 },
    cutoff: (t) => from * (to / from) ** (t / dur) });
  const s = tone({ dur, f0: from / 2, f1: to / 2, wave: 'sine', gain: gain * 0.4, envp: { a: dur * 0.9, d: 1, s: 1, r: 0.02 } });
  mix(n, s); return n;
}
function arp(out, at, notes, step, { wave = 'square', duty = 0.5, len = 0.12, gain = 0.3, lp = 7000 } = {}) {
  notes.forEach((m, i) => mix(out, tone({ dur: len, f0: midi(m), wave, duty, gain, lp, envp: { a: 0.002, d: len * 0.5, s: 0.25, r: 0.03 } }), at + i * step));
}
function brassChord(out, at, notes, dur, { gain = 0.22, open = 3500, seed = 11 } = {}) {
  notes.forEach((m, i) => mix(out, tone({ dur, f0: midi(m), wave: 'saw', voices: 3, detune: 9, vib: 12, vibRate: 5.5, seed: seed + i,
    gain, envp: { a: 0.03, d: dur * 0.8, s: 0.35, r: 0.25 }, lp: (t) => 600 + open * Math.min(1, t / 0.12) }), at));
}
function choir(out, at, notes, dur, gain = 0.12) {
  notes.forEach((m, i) => mix(out, tone({ dur, f0: midi(m), wave: 'tri', voices: 4, detune: 14, vib: 18, vibRate: 4.8, seed: 40 + i,
    gain, envp: { a: 0.25, d: 2, s: 0.8, r: 0.5 }, lp: 2400 }), at));
}
function sparkle(out, at, dur, count, { lo = 84, hi = 108, gain = 0.12, seed = 5 } = {}) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const m = lo + Math.floor(r() * (hi - lo));
    mix(out, bell({ dur: 0.5, f: midi(m), gain, decay: 0.18, partials: [[1, 1], [2.76, 0.3]] }), at + r() * dur);
  }
}
function impact(out, at, size = 1) {
  mix(out, boom({ dur: 0.7 * size, f0: 160, f1: 38, gain: 0.8, decay: 0.18 * size }), at);
  mix(out, noise({ dur: 0.5 * size, gain: 0.45, type: 'lp', cutoff: (t) => 7000 * Math.exp(-t / 0.08) + 300, envp: { a: 0.001, d: 0.09 * size, s: 0, r: 0.05 }, seed: 21 }), at);
}

const made = {};
function make(id, desc, fn) { made[id] = { desc, seconds: writeWav(id, fn()) }; }

// ---------- UI ----------
make('ui_button', 'Short soft select blip (square, 1.05 → 1.4 kHz)', () =>
  tone({ dur: 0.07, f0: 1050, f1: 1400, wave: 'square', duty: 0.5, gain: 0.35, lp: 5000, envp: { a: 0.001, d: 0.025, s: 0, r: 0.01 } }));

make('ui_tab', 'Two-step soft tick for switching tabs', () => {
  const o = buf(0.12);
  mix(o, tone({ dur: 0.04, f0: 1500, wave: 'tri', gain: 0.4, envp: { a: 0.001, d: 0.012, r: 0.005 } }), 0);
  mix(o, tone({ dur: 0.05, f0: 2000, wave: 'tri', gain: 0.35, envp: { a: 0.001, d: 0.015, r: 0.005 } }), 0.045);
  return o;
});

make('ui_purchase', 'Coin "ka-ching": two square notes B5 → E6 with a small sparkle', () => {
  const o = buf(0.6);
  mix(o, tone({ dur: 0.07, f0: midi(83), wave: 'square', duty: 0.5, gain: 0.3, lp: 8000, envp: { a: 0.001, d: 0.06, s: 0.6, r: 0.01 } }), 0);
  mix(o, tone({ dur: 0.45, f0: midi(88), wave: 'square', duty: 0.5, gain: 0.3, lp: 8000, envp: { a: 0.001, d: 0.12, s: 0.0, r: 0.05 } }), 0.07);
  sparkle(o, 0.08, 0.2, 4, { lo: 96, hi: 104, gain: 0.07, seed: 9 });
  return o;
});

make('ui_levelup', 'Rising C-major arpeggio with a held top note', () => {
  const o = buf(1.0);
  arp(o, 0, [72, 76, 79, 84, 88], 0.055, { wave: 'square', duty: 0.25, len: 0.14, gain: 0.25 });
  arp(o, 0, [60, 64, 67, 72, 76], 0.055, { wave: 'tri', len: 0.14, gain: 0.25 });
  mix(o, tone({ dur: 0.5, f0: midi(91), wave: 'square', duty: 0.25, vib: 25, vibRate: 7, gain: 0.22, lp: 7000, envp: { a: 0.005, d: 0.3, s: 0.2, r: 0.15 } }), 0.28);
  return withVerb(o, 0.18, { tail: 0.6 });
});

make('ui_stage_clear', 'Short clear jingle: G-C-E-G run into a C-major chord with a light drum hit', () => {
  const o = buf(1.6);
  arp(o, 0, [67, 72, 76, 79], 0.09, { wave: 'square', duty: 0.5, len: 0.12, gain: 0.25 });
  [72, 76, 79, 84].forEach((m) => mix(o, tone({ dur: 0.8, f0: midi(m), wave: 'square', duty: 0.25, vib: 15, gain: 0.13, lp: 6000,
    envp: { a: 0.005, d: 0.5, s: 0.3, r: 0.2 } }), 0.38));
  mix(o, tone({ dur: 0.8, f0: midi(48), wave: 'tri', gain: 0.35, envp: { a: 0.005, d: 0.4, s: 0.2, r: 0.2 } }), 0.38);
  mix(o, boom({ dur: 0.3, f0: 120, f1: 50, gain: 0.5, decay: 0.08 }), 0.38);
  mix(o, noise({ dur: 0.25, gain: 0.2, type: 'hp', cutoff: 5000, envp: { a: 0.001, d: 0.08, r: 0.05 } }), 0.38);
  return withVerb(o, 0.15, { tail: 0.6 });
});

make('ui_warning', 'Two-tone alarm pulse (880/660 Hz) played twice', () => {
  const o = buf(0.75);
  [0, 0.36].forEach((t) => {
    mix(o, tone({ dur: 0.16, f0: 880, wave: 'square', duty: 0.5, gain: 0.3, lp: 3500, envp: { a: 0.004, d: 1, s: 1, r: 0.02 } }), t);
    mix(o, tone({ dur: 0.16, f0: 660, wave: 'square', duty: 0.5, gain: 0.3, lp: 3500, envp: { a: 0.004, d: 1, s: 1, r: 0.02 } }), t + 0.17);
  });
  return o;
});

make('ui_notify', 'Soft two-note bell chime (E6 → B6)', () => {
  const o = buf(1.0);
  mix(o, bell({ dur: 0.9, f: midi(88), gain: 0.35, decay: 0.35 }), 0);
  mix(o, bell({ dur: 0.9, f: midi(95), gain: 0.32, decay: 0.4 }), 0.12);
  return withVerb(o, 0.12, { tail: 0.5 });
});

// ---------- gacha ----------
make('gacha_roll', 'Gacha roll: ticking wheel that speeds up over a rising drum roll, ends on an upbeat (reveal follows)', () => {
  const dur = 1.7, o = buf(dur + 0.2);
  let t = 0, gap = 0.13;
  while (t < dur - 0.05) {
    mix(o, tone({ dur: 0.03, f0: 1900 + 400 * (t / dur), wave: 'square', duty: 0.3, gain: 0.22, lp: 6000, envp: { a: 0.001, d: 0.008, r: 0.005 } }), t);
    t += gap; gap = Math.max(0.035, gap * 0.9);
  }
  const roll = noise({ dur, gain: 0.4, type: 'lp', cutoff: 900, envp: { a: dur * 0.95, d: 1, s: 1, r: 0.03 }, seed: 31 });
  for (let i = 0; i < roll.length; i++) roll[i] *= 0.6 + 0.4 * Math.sin(2 * Math.PI * 22 * (i / SR)); // drum-roll flutter
  mix(o, roll);
  mix(o, riser(dur, { from: 400, to: 3000, gain: 0.18 }));
  return o;
});

// 8 rarity reveals, each bigger than the last (root note climbs with the grade)
const grades = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'immortal', 'mythic', 'eternal'];
make('reveal_1_' + grades[0], '일반: neutral soft pop (triangle glide)', () => {
  const o = buf(0.25);
  mix(o, tone({ dur: 0.16, f0: 700, f1: 520, wave: 'tri', gain: 0.45, envp: { a: 0.002, d: 0.06, r: 0.02 } }), 0);
  mix(o, noise({ dur: 0.03, gain: 0.15, type: 'hp', cutoff: 3000, envp: { a: 0.001, d: 0.01, r: 0.01 } }), 0);
  return o;
});
make('reveal_2_' + grades[1], '고급: bright two-note step up (E5 → A5)', () => {
  const o = buf(0.45);
  mix(o, tone({ dur: 0.08, f0: midi(76), wave: 'square', duty: 0.25, gain: 0.3, lp: 6000, envp: { a: 0.002, d: 0.06, s: 0.4, r: 0.02 } }), 0);
  mix(o, tone({ dur: 0.25, f0: midi(81), wave: 'square', duty: 0.25, gain: 0.3, lp: 6000, envp: { a: 0.002, d: 0.12, s: 0.1, r: 0.06 } }), 0.08);
  return withVerb(o, 0.1, { tail: 0.3 });
});
make('reveal_3_' + grades[2], '희귀: C-major arpeggio with a few sparkles', () => {
  const o = buf(0.9);
  arp(o, 0, [72, 76, 79, 84], 0.06, { wave: 'square', duty: 0.5, len: 0.12, gain: 0.25 });
  mix(o, tone({ dur: 0.4, f0: midi(84), wave: 'tri', gain: 0.25, vib: 15, envp: { a: 0.005, d: 0.2, s: 0.2, r: 0.1 } }), 0.24);
  sparkle(o, 0.25, 0.3, 5, { lo: 96, hi: 108, gain: 0.08, seed: 13 });
  return withVerb(o, 0.18, { tail: 0.5 });
});
make('reveal_4_' + grades[3], '영웅: whoosh, D-major run to a held chord with sparkles', () => {
  const o = buf(1.4);
  mix(o, riser(0.3, { from: 600, to: 5000, gain: 0.25, seed: 4 }), 0);
  arp(o, 0.3, [74, 78, 81, 86, 90], 0.055, { wave: 'square', duty: 0.25, len: 0.12, gain: 0.22 });
  [62, 66, 69, 74].forEach((m, i) => mix(o, tone({ dur: 0.6, f0: midi(m), wave: 'saw', voices: 2, detune: 8, seed: 50 + i, gain: 0.1, lp: 3000,
    envp: { a: 0.01, d: 0.4, s: 0.3, r: 0.2 } }), 0.57));
  sparkle(o, 0.57, 0.5, 8, { lo: 93, hi: 110, gain: 0.08, seed: 14 });
  return withVerb(o, 0.22, { tail: 0.8 });
});
make('reveal_5_' + grades[4], '전설: riser, impact, brass E-major chord, sparkle run', () => {
  const o = buf(2.2);
  mix(o, riser(0.5, { from: 300, to: 6000, gain: 0.3, seed: 5 }), 0);
  impact(o, 0.5, 1);
  brassChord(o, 0.5, [52, 56, 59, 64, 68], 0.9, { gain: 0.16 });
  arp(o, 0.55, [88, 92, 95, 100], 0.05, { wave: 'square', duty: 0.25, len: 0.12, gain: 0.12 });
  sparkle(o, 0.6, 0.7, 12, { lo: 90, hi: 112, gain: 0.07, seed: 15 });
  return withVerb(o, 0.25, { tail: 1.0 });
});
make('reveal_6_' + grades[5], '불멸: double impact, low octave and big F#-major chord with choir pad', () => {
  const o = buf(2.8);
  mix(o, riser(0.55, { from: 200, to: 5000, gain: 0.32, seed: 6 }), 0);
  impact(o, 0.55, 1.2); impact(o, 0.7, 1.4);
  mix(o, tone({ dur: 1.4, f0: midi(30), wave: 'saw', voices: 2, detune: 6, gain: 0.25, lp: 700, envp: { a: 0.01, d: 0.8, s: 0.3, r: 0.4 } }), 0.7);
  brassChord(o, 0.7, [54, 58, 61, 66, 70], 1.3, { gain: 0.15, open: 4000 });
  choir(o, 0.7, [66, 70, 73, 78], 1.6, 0.1);
  sparkle(o, 0.8, 0.9, 14, { lo: 90, hi: 112, gain: 0.06, seed: 16 });
  return withVerb(o, 0.3, { tail: 1.3 });
});
make('reveal_7_' + grades[6], '신화: long riser, impact, golden bell cascade over two octaves, brass A-major chord', () => {
  const o = buf(3.3);
  mix(o, riser(0.7, { from: 250, to: 7000, gain: 0.32, seed: 7 }), 0);
  impact(o, 0.7, 1.4);
  brassChord(o, 0.7, [57, 61, 64, 69, 73], 1.6, { gain: 0.15, open: 4500 });
  choir(o, 0.75, [69, 73, 76, 81], 2.0, 0.09);
  const pent = [81, 83, 85, 88, 90, 93, 95, 97, 100, 102];
  pent.forEach((m, i) => mix(o, bell({ dur: 1.0, f: midi(m), gain: 0.16, decay: 0.45 }), 0.75 + i * 0.05));
  sparkle(o, 1.3, 1.0, 16, { lo: 93, hi: 115, gain: 0.05, seed: 17 });
  return withVerb(o, 0.32, { tail: 1.6 });
});
make('reveal_8_' + grades[7], '영원: longest riser with accelerating ticks, huge impact, three-octave rainbow run, full chord, choir and bells', () => {
  const o = buf(4.2);
  mix(o, riser(0.95, { from: 150, to: 8000, gain: 0.34, seed: 8 }), 0);
  let t = 0, gap = 0.12; while (t < 0.9) { mix(o, tone({ dur: 0.03, f0: 2400, wave: 'square', duty: 0.3, gain: 0.12, lp: 7000,
    envp: { a: 0.001, d: 0.008, r: 0.005 } }), t); t += gap; gap = Math.max(0.03, gap * 0.85); }
  impact(o, 0.95, 1.8);
  mix(o, noise({ dur: 1.8, gain: 0.18, type: 'hp', cutoff: 6000, envp: { a: 0.002, d: 0.6, s: 0, r: 0.3 }, seed: 33 }), 0.95);
  const lyd = [72, 76, 79, 83, 86, 90, 93, 96, 100, 103, 107, 110]; // C lydian: the "rainbow" run
  lyd.forEach((m, i) => mix(o, tone({ dur: 0.18, f0: midi(m), wave: 'square', duty: 0.25, gain: 0.1, lp: 9000,
    envp: { a: 0.002, d: 0.08, s: 0.2, r: 0.05 } }), 1.0 + i * 0.035));
  lyd.forEach((m, i) => mix(o, bell({ dur: 1.2, f: midi(m), gain: 0.07, decay: 0.5 }), 1.0 + i * 0.035));
  mix(o, tone({ dur: 2.2, f0: midi(36), wave: 'saw', voices: 2, detune: 5, gain: 0.22, lp: 600, envp: { a: 0.01, d: 1.2, s: 0.3, r: 0.6 } }), 0.95);
  brassChord(o, 1.4, [60, 64, 67, 71, 74, 79], 1.9, { gain: 0.13, open: 5000 });
  choir(o, 1.4, [72, 76, 79, 83, 86], 2.3, 0.08);
  sparkle(o, 1.5, 1.6, 26, { lo: 91, hi: 118, gain: 0.05, seed: 18 });
  return withVerb(o, 0.36, { tail: 2.0 });
});

// ---------- other generated alternates ----------
make('relic_pickup', 'Magic pickup: fast pentatonic bell run upward with a soft pad', () => {
  const o = buf(1.3);
  [79, 81, 84, 86, 88, 91, 93, 96, 98, 100].forEach((m, i) => mix(o, bell({ dur: 0.7, f: midi(m), gain: 0.14, decay: 0.3 }), i * 0.028));
  choir(o, 0.05, [72, 76, 79], 0.9, 0.08);
  return withVerb(o, 0.25, { tail: 0.8 });
});
make('breakthrough_fanfare', 'Brass fanfare: G-G-G pick-up into a C-major chord with snare and cymbal', () => {
  const o = buf(2.2);
  [0, 0.13, 0.26].forEach((t) => brassChord(o, t, [55, 67], 0.12, { gain: 0.2, open: 3000 }));
  brassChord(o, 0.4, [60, 64, 67, 72, 76], 1.1, { gain: 0.15, open: 4200 });
  for (let i = 0; i < 6; i++) mix(o, noise({ dur: 0.08, gain: 0.18 + i * 0.02, type: 'bp', cutoff: 2200, q: 1, envp: { a: 0.001, d: 0.03, r: 0.02 }, seed: 60 + i }), i * 0.065);
  mix(o, boom({ dur: 0.4, f0: 110, f1: 45, gain: 0.6, decay: 0.12 }), 0.4);
  mix(o, noise({ dur: 1.2, gain: 0.16, type: 'hp', cutoff: 7000, envp: { a: 0.002, d: 0.45, s: 0, r: 0.3 }, seed: 70 }), 0.4);
  return withVerb(o, 0.2, { tail: 0.9 });
});
make('raid_start', 'Raid start: low war-horn glide over two drum hits and a rising alarm sweep', () => {
  const o = buf(2.4);
  mix(o, tone({ dur: 1.6, f0: midi(45), f1: midi(50), wave: 'saw', voices: 3, detune: 10, gain: 0.3, vib: 10, lp: (t) => 500 + 1500 * Math.min(1, t / 0.4),
    envp: { a: 0.08, d: 1.5, s: 0.6, r: 0.4 } }), 0.1);
  mix(o, tone({ dur: 1.6, f0: midi(57), f1: midi(62), wave: 'saw', voices: 2, detune: 8, gain: 0.15, lp: 1800, envp: { a: 0.1, d: 1.5, s: 0.5, r: 0.4 } }), 0.1);
  [0, 0.45].forEach((t) => { mix(o, boom({ dur: 0.6, f0: 120, f1: 42, gain: 0.8, decay: 0.2 }), t);
    mix(o, noise({ dur: 0.3, gain: 0.25, type: 'lp', cutoff: 1500, envp: { a: 0.001, d: 0.07, r: 0.05 }, seed: 80 }), t); });
  mix(o, tone({ dur: 1.0, f0: 500, f1: 1100, wave: 'square', duty: 0.5, gain: 0.08, lp: 3000, envp: { a: 0.3, d: 1, s: 1, r: 0.2 } }), 0.9);
  return withVerb(o, 0.2, { tail: 0.8 });
});
make('shell_casing', 'Brass casing hitting the floor: modal "tink" with three shrinking bounces', () => {
  const o = buf(0.6), parts = [[1, 1], [1.62, 0.6], [2.31, 0.45], [3.07, 0.25]];
  [[0, 1], [0.11, 0.55], [0.18, 0.3], [0.22, 0.15]].forEach(([t, a], k) =>
    mix(o, bell({ dur: 0.3, f: 4200 * (1 + 0.01 * k), gain: 0.4 * a, decay: 0.05, partials: parts }), t));
  return o;
});

writeFileSync(join(outDir, 'generated.json'), JSON.stringify(made, null, 1));
console.log(Object.entries(made).map(([k, v]) => `${k} ${v.seconds}s`).join('\n'));
