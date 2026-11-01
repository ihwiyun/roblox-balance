'use strict';
// Little synthesized sound effects.
/* ================= sound ================= */
let audio = null, noiseBuffer = null, master = null, lastShot = 0, quiet = false;
// each kind of sound plays at most this often, so a crowd of zombies does not turn into static
const SOUND_GAP = { kill: .05, thud: .06, clang: .06, crash: .4, buy: .03, hammer: .5, spit: .15, scream: .6, leap: .2 }, soundAt = {};
function ensureAudio() {
  if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio = new AC(); master = audio.createGain(); master.connect(audio.destination);
  noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}
function burstSound(type, freq, volume, length, delay = 0) {
  const now = audio.currentTime + delay, src = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
  src.buffer = noiseBuffer; filter.type = type; filter.frequency.value = freq; filter.Q.value = .8;
  gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0005, now + length);
  src.connect(filter).connect(gain).connect(master); src.start(now, Math.random() * .5, length + .02);
}
function sound(kind) {
  if (!audio || !settings.sound || document.hidden || quiet) return;
  if (SOUND_GAP[kind] && audio.currentTime - (soundAt[kind] || -9) < SOUND_GAP[kind]) return;
  soundAt[kind] = audio.currentTime;
  master.gain.value = settings.volume;
  if (kind === 'shot') { if (audio.currentTime - lastShot < .07) return; lastShot = audio.currentTime; burstSound('bandpass', 1500, .06, .07); burstSound('lowpass', 300, .05, .08); }
  if (kind === 'kill') burstSound('lowpass', 320, .09, .14);
  if (kind === 'buy') burstSound('bandpass', 2400, .06, .08);
  if (kind === 'crash') { burstSound('lowpass', 160, .3, .6); burstSound('bandpass', 700, .12, .4, .05); }
  if (kind === 'thud') burstSound('lowpass', 240, .08, .1);
  if (kind === 'clang') burstSound('bandpass', 2600, .05, .12);
  if (kind === 'magout') burstSound('highpass', 3000, .04, .03);
  if (kind === 'magin') burstSound('bandpass', 1800, .07, .04);
  if (kind === 'rack') { burstSound('highpass', 2500, .06, .03); burstSound('highpass', 2200, .06, .03, .07); }
  if (kind === 'hammer') for (let k = 0; k < 3; k++) burstSound('bandpass', 900, .08, .05, k * .15);
  if (kind === 'spit') { burstSound('lowpass', 500, .07, .12); burstSound('bandpass', 1200, .03, .06, .05); }
  if (kind === 'scream') { burstSound('highpass', 3200, .05, .5); burstSound('bandpass', 1800, .05, .45, .05); }
  if (kind === 'leap') burstSound('lowpass', 420, .06, .18);
}
