#!/usr/bin/env python3
"""Cut, normalise and encode every candidate, then measure it.

Usage:  python3 -I process.py <tools-dir> <cache-dir> <audio-dir> [candidate-id ...]

Reads  <tools-dir>/candidates.json + sources.json, the downloads in <cache-dir> (from fetch.py)
and the generated WAVs in <cache-dir>/gen (from synth.mjs).  Writes OGG Vorbis files to
<audio-dir>/candidates/<group>/<id>.ogg and the measurements to <audio-dir>/catalog.json.

Loudness rules (EBU R128 via ffmpeg's ebur128 filter), checked on the encoded OGG itself:
  music  : integrated -16 LUFS, true peak <= -1 dBTP (a 4x-oversampled limiter only when needed)
  sting  : same as music but -16 LUFS is measured on the short clip (stereo kept)
  sfx    : true peak -1.0 .. about -1.25 dBTP (mono); loudness is NOT matched between sounds
Music loops are never trimmed (that would break the loop); stings and sfx lose leading and
trailing silence.  BPM needs librosa (run with the venv python), otherwise it is left blank.
Run with:  <venv>/bin/python -I process.py ...   (-I: nothing from the current folder is imported)
"""
import json, math, os, re, shutil, subprocess, sys, tempfile
import numpy as np

SR = 44100
MUSIC_LUFS = -16.0
PEAK_DBTP = -1.0
MUSIC_CEILING = -2.0  # pre-encode peak ceiling for music: Vorbis can overshoot by up to ~1 dB
QUALITY = {'music': 3, 'sting': 4, 'sfx': 4}


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(' '.join(cmd) + '\n' + r.stderr[-2000:])
    return r


def decode(path, channels):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(channels), '-ar', str(SR), '-'],
                       capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f'decode failed: {path}\n{r.stderr.decode()[-1000:]}')
    return np.frombuffer(r.stdout, dtype='<f4').reshape(-1, channels).copy()


def write_f32(path, x):
    # 32-bit float WAV keeps headroom between steps (no clipping before the limiter)
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(x.shape[1]), '-i', 'pipe:0',
                        '-c:a', 'pcm_f32le', path], input=x.astype('<f4').tobytes(), capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[-800:])


def measure(path):
    """Integrated LUFS, true peak dBTP, momentary-max LUFS (EBU R128)."""
    r = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true:framelog=verbose',
                        '-f', 'null', '-'], capture_output=True, text=True)
    log = r.stderr
    m = re.findall(r'M:\s*(-?[\d.]+|-inf)', log)
    mmax = max([float(v) for v in m if v != '-inf'] or [-120.0])
    summ = log[log.rfind('Summary:'):]
    i = re.search(r'I:\s*(-?[\d.]+|-inf) LUFS', summ)
    tp = re.search(r'Peak:\s*(-?[\d.]+|-inf) dBFS', summ)
    f = lambda v: -120.0 if v is None or v.group(1) == '-inf' else float(v.group(1))
    return {'lufs_i': f(i), 'true_peak': f(tp), 'lufs_m_max': mmax}


def trim_silence(x, head_db=-45, tail_db=-60, pre=0.004, post=0.03):
    mono = np.abs(x).max(axis=1)
    peak = mono.max() or 1.0
    above_h = np.where(mono > peak * 10 ** (head_db / 20))[0]
    above_t = np.where(mono > peak * 10 ** (tail_db / 20))[0]
    if len(above_h) == 0:
        return x, 0.0
    a = max(0, above_h[0] - int(pre * SR))
    b = min(len(x), above_t[-1] + int(post * SR))
    y = x[a:b].copy()
    fade = min(len(y) // 4, int(0.012 * SR))
    if fade > 0:
        y[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return y, a / SR


def events(x, gap=0.12, thr_db=-38):
    """Split a file holding several separate sounds; returns [(start, end)] in samples."""
    mono = np.abs(x).max(axis=1)
    win = int(0.01 * SR)
    env = np.convolve(mono, np.ones(win) / win, mode='same')
    on = env > env.max() * 10 ** (thr_db / 20)
    segs, start, quiet = [], None, 0
    for i, v in enumerate(on):
        if v:
            if start is None:
                start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet > gap * SR:
                segs.append((start, i - quiet)); start, quiet = None, 0
    if start is not None:
        segs.append((start, len(on)))
    return [s for s in segs if (s[1] - s[0]) > 0.04 * SR]


def apply_gain_limit(x, gain_db, tmpdir, limit_dbtp=PEAK_DBTP):
    """Gain, then (only if needed) a 4x-oversampled peak limiter so the true peak stays under the limit."""
    y = x * 10 ** (gain_db / 20)
    src = os.path.join(tmpdir, 'g.wav'); write_f32(src, y)
    tp = measure(src)['true_peak']
    if tp <= limit_dbtp - 0.05:
        return y, False
    lim = 10 ** ((limit_dbtp - 0.3) / 20)
    out = os.path.join(tmpdir, 'l.wav')
    run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af',
         f'aresample={SR * 4},alimiter=limit={lim:.5f}:attack=2:release=60:level=disabled,aresample={SR}',
         '-c:a', 'pcm_f32le', out])
    return decode(out, x.shape[1]), True


def loudness_music(x, tmpdir):
    src = os.path.join(tmpdir, 'm.wav'); write_f32(src, x)
    limited = False
    gain = MUSIC_LUFS - measure(src)['lufs_i']
    for _ in range(4):  # the limiter shaves a little loudness off, so iterate
        y, lim = apply_gain_limit(x, gain, tmpdir, MUSIC_CEILING)
        limited |= lim
        chk = os.path.join(tmpdir, 'c.wav'); write_f32(chk, y)
        err = MUSIC_LUFS - measure(chk)['lufs_i']
        if abs(err) < 0.3:
            break
        gain += err
    return y, round(gain, 2), limited


def loudness_sfx(x, tmpdir):
    """Peak-normalise to -1 dBTP (the encoder step below re-checks the real OGG)."""
    src = os.path.join(tmpdir, 's.wav'); write_f32(src, x)
    gain = PEAK_DBTP - measure(src)['true_peak']
    return x * 10 ** (gain / 20), round(gain, 2)


def encode(y, out, kind, meta, tmpdir):
    """Encode to OGG Vorbis and measure the real file.  The decoded peak wobbles by about +-0.5 dB between encodes (it
    does not follow the gain smoothly), so a short ladder of gain trims is tried and the best encode is kept:
    sfx = true peak as close to -1.0 dBTP as possible without going above it; music/sting = first try <= -1.0 dBTP.
    Returns (measurements, chosen gain trim in dB)."""
    ladder = [0.0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45, -0.7, -1.0, -1.5] if kind == 'sfx' else [0.0, -0.4, -0.8, -1.2, -1.6, -2.0]
    best = None
    for trim in ladder:
        wav = os.path.join(tmpdir, 'final.wav'); write_f32(wav, y * 10 ** (trim / 20))
        tryout = os.path.join(tmpdir, 'try.ogg')
        run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', str(QUALITY[kind]), '-ar', str(SR),
             '-map_metadata', '-1', '-metadata', f'title={meta[0]}', '-metadata', f'artist={meta[1]}', tryout])
        meas = measure(tryout)
        tp = meas['true_peak']
        ok = tp <= PEAK_DBTP
        key = (ok, tp if ok else -tp)
        if best is None or key > best[0]:
            shutil.copyfile(tryout, os.path.join(tmpdir, 'best.ogg'))
            best = (key, meas, trim)
        if ok and (kind != 'sfx' or tp >= PEAK_DBTP - 0.25):
            break
    shutil.copyfile(os.path.join(tmpdir, 'best.ogg'), out)
    return best[1], best[2]


def seam(x, a, b):
    """Would a plain wrap from sample b back to sample a be audible?
    click_pct : percentile of the wrap's sample-to-sample jump among all jumps inside the loop (< 99.9 = no click)
    gap_db    : the quieter 100 ms next to the wrap minus the loop's median 100 ms level (> -18 = no dead air)
    loop_beats: loop length in beats at the estimated tempo is filled in by the caller."""
    w = int(0.1 * SR)
    mono = x.mean(axis=1)[a:b]
    if len(mono) < 8 * w:
        return None
    jump = abs(float(mono[0] - mono[-1]))
    d = np.abs(np.diff(mono))
    click_pct = float((d < jump).mean() * 100)
    db = lambda s: 20 * math.log10(math.sqrt(float(np.mean(s ** 2))) + 1e-9)
    levels = [db(mono[i:i + w]) for i in range(0, len(mono) - w, w)]
    gap = min(db(mono[:w]), db(mono[-w:])) - float(np.median(levels))
    return {'click_pct': round(click_pct, 2), 'gap_db': round(gap, 1),
            'ok': bool(click_pct < 99.9 and gap > -18)}


def bpm_of(path, lo=55, hi=215, ref=110.0):
    """Tempo of a loop file.  Tries every whole number of beats K that fits the length (bpm = 60*K/length), keeps
    the one whose beat period repeats best in the onset envelope (circular autocorrelation at 1, 2, 4, 8 beats) and
    settles half/double-tempo ties on the value closest to 110 BPM.  Matches all 7 files whose authors label the
    BPM (130, 125, 155, 92, 85, 80, 80).  Returns (bpm, beats) or None for clips shorter than 8 s / no librosa."""
    try:
        import librosa
    except ImportError:
        return None
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', '22050', '-'], capture_output=True)
    y = np.frombuffer(r.stdout, '<f4')
    dur = len(y) / 22050
    if dur < 8:
        return None
    env = librosa.onset.onset_strength(y=y, sr=22050, hop_length=256)
    e = env - env.mean()
    f = np.fft.rfft(e, n=2 * len(e))
    ac = np.fft.irfft(f * np.conj(f))[:len(e)]
    ac /= ac[0] + 1e-12
    fps = 22050 / 256
    cands = []
    for k in range(int(dur * lo / 60), int(dur * hi / 60) + 1):
        bpm = 60.0 * k / dur
        if not lo <= bpm <= hi:
            continue
        lags = [fps * 60.0 / bpm * m for m in (1, 2, 4, 8)]
        lags = [l for l in lags if l < len(ac) - 2]
        if len(lags) < 3:
            continue
        s = np.mean([ac[int(l)] * (1 - l % 1) + ac[int(l) + 1] * (l % 1) for l in lags])
        cands.append((float(s), bpm, k))
    if not cands:
        return None
    cands.sort(reverse=True)
    top = cands[0]
    tied = [c for c in cands if c[0] >= 0.85 * top[0] and abs(math.log2(c[1] / top[1]) - round(math.log2(c[1] / top[1]))) < 0.012]
    best = min(tied, key=lambda c: abs(math.log(c[1] / ref)))
    return round(best[1], 1), best[2]


def main():
    tools, cache, audio = sys.argv[1:4]
    only = set(sys.argv[4:])
    cands = json.load(open(os.path.join(tools, 'candidates.json')))['candidates']
    sources = {s['id']: s for s in json.load(open(os.path.join(tools, 'sources.json')))['sources']}
    fetch_log = json.load(open(os.path.join(cache, 'fetch-log.json')))
    generated = json.load(open(os.path.join(cache, 'gen', 'generated.json')))
    cat_path = os.path.join(audio, 'catalog.json')
    catalog = {c['id']: c for c in json.load(open(cat_path))['items']} if os.path.exists(cat_path) else {}

    for c in cands:
        if only and c['id'] not in only:
            continue
        kind = c['kind']
        ch = 1 if kind == 'sfx' else 2
        changes = []
        if c['source'] == 'generated':
            path = os.path.join(cache, 'gen', c['member'] + '.wav')
            src_files = []
            c.setdefault('author', 'synth.mjs (이 프로젝트)')
        else:
            s = sources[c['source']]
            c.setdefault('author', s['author'])
            def find(member):
                for base in ('x', 'dl'):
                    p = os.path.join(cache, base, s['id'], member)
                    if os.path.exists(p):
                        return p
                raise FileNotFoundError(f"{c['id']}: {member} not found in {s['id']}")
            path = find(c['member'])
            src_files = [c['member']] + ([c['intro']] if c.get('intro') else [])
        x = decode(path, ch)
        dur_src = len(x) / SR
        loop = c.get('loop', 'none')
        loop_start = 0.0
        if c.get('segment'):
            a, b = c['segment']
            x = x[int(a * SR): int(b * SR) if b else None]
            changes.append(f'cut {a:.2f}–{(b or dur_src):.2f} s from the original')
        if c.get('event') is not None:
            segs = events(x, gap=c.get('event_gap', 0.12))
            a, b = segs[c['event']]
            x = x[max(0, a - int(0.005 * SR)): min(len(x), b + int(c.get('event_tail', 0.05) * SR))]
            changes.append(f"took sound #{c['event'] + 1} of {len(segs)} in the file")
        if c.get('intro'):
            intro = decode(find(c['intro']), ch)
            loop_start = len(intro) / SR
            x = np.concatenate([intro, x])
            changes.append(f"joined the intro file and the loop file (loop starts at {loop_start:.3f} s)")
        if c.get('repeat'):
            x = np.concatenate([x] * c['repeat'])
            changes.append(f"repeated {c['repeat']}× so the short loop is easier to judge")
        if kind != 'music' and c.get('trim', True):
            before = len(x)
            x, _ = trim_silence(x)
            if before - len(x) > 0.01 * SR:
                changes.append(f'trimmed {(before - len(x)) / SR:.2f} s of leading/trailing silence')
        if c.get('fade_out'):
            n = int(c['fade_out'] * SR)
            x[-n:] *= np.linspace(1, 0, n)[:, None]
            changes.append(f"{c['fade_out']} s fade-out")

        with tempfile.TemporaryDirectory() as tmp:
            if kind == 'sfx':
                y, gain = loudness_sfx(x, tmp)
                changes.append(f'mono; peak-normalised to -1 dBTP (gain {gain:+.1f} dB)')
            else:
                y, gain, limited = loudness_music(x, tmp)
                changes.append(f'loudness normalised to {MUSIC_LUFS:.0f} LUFS (gain {gain:+.1f} dB' + (', peak limiter engaged' if limited else '') + ')')
            group_dir = os.path.join(audio, 'candidates', c['group'])
            os.makedirs(group_dir, exist_ok=True)
            out = os.path.join(group_dir, c['id'] + '.ogg')
            meas, trim = encode(y, out, kind, (c.get('title', ''), c.get('author', '')), tmp)
            changes.append(f'encoded OGG Vorbis q{QUALITY[kind]}' + (f' (gain trimmed {trim:+.2f} dB to keep the true-peak target)' if abs(trim) > 0.01 else ''))
            final = decode(out, ch)
        dur = len(final) / SR
        item = dict(c)
        item.update({
            'file': os.path.relpath(out, audio), 'bytes': os.path.getsize(out), 'seconds': round(dur, 3),
            'lufs_i': meas['lufs_i'], 'true_peak': meas['true_peak'], 'lufs_m_max': meas['lufs_m_max'],
            'changes': changes + ([c['extra_change']] if c.get('extra_change') else []),
            'source_files': src_files,
        })
        if c['source'] == 'generated':
            item['generated_desc'] = generated[c['member']]['desc']
        else:
            s = sources[c['source']]
            used = []
            for f in s['files']:
                lg = fetch_log.get(f['url'], {})
                inside = [m for m in src_files if m != f['name']] if lg.get('unpacked_to') else []
                if f['name'] in src_files or inside:
                    used.append({'url': f['url'], 'name': f['name'], 'sha256': lg.get('sha256'), 'members': inside})
            item['direct_files'] = used
        if kind == 'music':
            est = bpm_of(out)
            item['bpm_est'] = est[0] if est else None
        if loop in ('whole', 'intro'):
            a = int(loop_start * SR)
            item['loop_start'] = round(loop_start, 3)
            item['loop_end'] = round(dur, 3)
            item['seam'] = seam(final, a, len(final))
            bpm = c.get('bpm') or item.get('bpm_est')
            if bpm:   # a clean loop is a whole number of beats long
                beats = (dur - loop_start) * bpm / 60
                item['loop_beats'] = round(beats, 2)
        catalog[c['id']] = item
        print(f"{c['id']:34} {dur:7.2f}s {item['bytes'] / 1024:7.0f}KB  I={meas['lufs_i']:6.1f} TP={meas['true_peak']:5.1f} "
              f"bpm={c.get('bpm') or item.get('bpm_est')} beats={item.get('loop_beats')} seam={item.get('seam')}", flush=True)

    order = [c['id'] for c in cands]
    items = [catalog[i] for i in order if i in catalog]
    json.dump({'items': items}, open(cat_path, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
