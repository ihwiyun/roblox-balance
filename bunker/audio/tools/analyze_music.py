#!/usr/bin/env python3
"""Measure tempo, key, brightness, density and loop seam of music files (needs librosa).

Usage:  python3 -I analyze_music.py <out.json> <file> [file ...]

For every file it reports:
  bpm       tempo estimate (librosa) and, when the file is a whole number of 4/4 bars, the exact
            tempo that makes the file length an integer number of bars  ->  'bpm_bar_fit'
  key       best Krumhansl-Schmuckler match (major / minor) and its correlation
  cent      mean spectral centroid in Hz (brightness)
  onsets    note onsets per second (busyness)
  dyn       95th / 10th percentile RMS ratio in dB (how much the track breathes)
  seam      what a plain loop (last sample -> first sample) would sound like:
            click_ratio   sample jump at the seam relative to the typical neighbouring jump (< 8 is fine)
            level_jump    RMS of the first 50 ms minus RMS of the last 50 ms in dB (|x| < 4 is fine)
  lead/tail seconds of near-silence (< -50 dBFS) at the start / end
Files are decoded by ffmpeg and treated as data only.
"""
import json, math, os, subprocess, sys
import numpy as np
import librosa

SR = 22050
KS_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = 'C C# D D# E F F# G G# A A# B'.split()


def load(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode()[-300:])
    return np.frombuffer(r.stdout, '<f4').reshape(-1, 2)


def seam_stats(m):
    w = int(0.05 * SR)
    j = np.concatenate([m[-w:], m[:w]])
    d = np.abs(np.diff(j))
    click = float(d[w - 3:w + 3].max() / (np.median(d) + 1e-9))
    rms = lambda s: 20 * math.log10(math.sqrt(float(np.mean(s ** 2))) + 1e-9)
    return {'click_ratio': round(click, 1), 'level_jump': round(rms(m[:w]) - rms(m[-w:]), 1)}


def bar_fit(dur, bpm_est, beats_per_bar=4):
    """Tempo that makes dur an exact number of bars, nearest to the estimate (tries x1, x2, /2 as well)."""
    best = None
    for guess in (bpm_est, bpm_est * 2, bpm_est / 2):
        for bars in range(1, 400):
            t = 60.0 * beats_per_bar * bars / dur
            if 55 <= t <= 220 and (best is None or abs(t - guess) < best[0]):
                best = (abs(t - guess), t, bars)
    return best


def analyse(path):
    x = load(path)
    m = x.mean(1)
    dur = len(m) / SR
    hop = 512
    onset = librosa.onset.onset_strength(y=m, sr=SR, hop_length=hop)
    t_glob = float(librosa.feature.tempo(onset_envelope=onset, sr=SR, hop_length=hop, start_bpm=110)[0])
    ac = librosa.autocorrelate(onset, max_size=4 * SR // hop)
    peaks = sorted(((ac[i], 60 * SR / hop / i) for i in range(1, len(ac)) if 60 <= 60 * SR / hop / i <= 200), reverse=True)[:3]
    fit = bar_fit(dur, t_glob)
    chroma = librosa.feature.chroma_cqt(y=m, sr=SR).mean(1)
    key = max([(np.corrcoef(np.roll(KS_MAJ, k), chroma)[0, 1], f'{NAMES[k]} maj') for k in range(12)] +
              [(np.corrcoef(np.roll(KS_MIN, k), chroma)[0, 1], f'{NAMES[k]} min') for k in range(12)])
    cent = float(librosa.feature.spectral_centroid(y=m, sr=SR).mean())
    ons = librosa.onset.onset_detect(onset_envelope=onset, sr=SR, hop_length=hop)
    rms = librosa.feature.rms(y=m)[0]
    dyn = 20 * math.log10(np.percentile(rms, 95) / max(np.percentile(rms, 10), 1e-6))
    thr = 10 ** (-50 / 20)
    nz = np.where(np.abs(m) > thr)[0]
    lead = float(nz[0] / SR) if len(nz) else dur
    tail = float((len(m) - 1 - nz[-1]) / SR) if len(nz) else dur
    return {'file': os.path.basename(path), 'dur': round(dur, 2), 'bpm': round(t_glob, 1),
            'ac_bpm': [round(b, 1) for _, b in peaks],
            'bpm_bar_fit': None if fit is None else {'bpm': round(fit[1], 2), 'bars': fit[2]},
            'key': key[1], 'key_r': round(float(key[0]), 2), 'cent': int(cent), 'onsets_per_s': round(len(ons) / dur, 2),
            'dyn': round(dyn, 1), 'seam': seam_stats(m), 'lead': round(lead, 3), 'tail': round(tail, 3)}


def main():
    out = sys.argv[1]
    res = []
    for p in sys.argv[2:]:
        try:
            r = analyse(p)
        except Exception as e:
            r = {'file': os.path.basename(p), 'error': str(e)}
        res.append(r)
        print(json.dumps(r, ensure_ascii=False, default=float), flush=True)
    json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1, default=float)


if __name__ == '__main__':
    main()
