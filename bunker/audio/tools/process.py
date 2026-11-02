#!/usr/bin/env python3
"""Cut, normalise and encode every candidate, then measure it.

Usage:  python3 -I process.py <tools-dir> <cache-dir> <audio-dir> [candidate-id ...]

Reads  <tools-dir>/candidates.json + sources.json, the downloads in <cache-dir> (from fetch.py)
and the generated WAVs in <cache-dir>/gen (from synth.mjs).  Writes OGG Vorbis files to
<audio-dir>/candidates/<group>/<id>.ogg and the measurements to <audio-dir>/catalog.json.

Loudness rules (EBU R128 via ffmpeg's ebur128 filter):
  music  : integrated -16 LUFS, true peak <= -1 dBTP (a 4x-oversampled limiter only when needed)
  sting  : same as music but -16 LUFS is measured on the short clip (stereo kept)
  sfx    : true peak -1 dBTP, but never louder than SFX_CEILING momentary-max LUFS (mono)
Music loops are never trimmed (that would break the loop); stings and sfx lose leading and
trailing silence.  BPM comes from librosa when installed, otherwise it is left blank.
"""
import json, math, os, re, subprocess, sys, tempfile
import numpy as np

SR = 44100
MUSIC_LUFS = -16.0
PEAK_DBTP = -1.0
SFX_CEILING = -11.0   # momentary-max LUFS cap so dense sounds (fire, alarms) do not jump out
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
        y, lim = apply_gain_limit(x, gain, tmpdir)
        limited |= lim
        chk = os.path.join(tmpdir, 'c.wav'); write_f32(chk, y)
        err = MUSIC_LUFS - measure(chk)['lufs_i']
        if abs(err) < 0.3:
            break
        gain += err
    return y, round(gain, 2), limited


def loudness_sfx(x, tmpdir):
    src = os.path.join(tmpdir, 's.wav'); write_f32(src, x)
    m = measure(src)
    gain = PEAK_DBTP - m['true_peak']
    mmax_after = m['lufs_m_max'] + gain
    capped = mmax_after > SFX_CEILING
    if capped:
        gain -= mmax_after - SFX_CEILING
    y = x * 10 ** (gain / 20)
    return y, round(gain, 2), capped


def seam(x, a, b):
    """Click / level jump when playback wraps from sample b back to sample a."""
    w = int(0.05 * SR)
    if b - a < 4 * w:
        return None
    mono = x.mean(axis=1)
    joined = np.concatenate([mono[b - w:b], mono[a:a + w]])
    d = np.abs(np.diff(joined))
    jump = d[w - 3:w + 3].max()
    typical = np.median(d) + 1e-9
    rms = lambda s: 20 * math.log10(np.sqrt(np.mean(s ** 2)) + 1e-9)
    level_jump = rms(mono[a:a + w]) - rms(mono[b - w:b])
    return {'click_ratio': round(float(jump / typical), 1), 'level_jump_db': round(level_jump, 1),
            'ok': bool(jump / typical < 8 and abs(level_jump) < 4)}


def bpm_of(x):
    try:
        import librosa
    except ImportError:
        return None
    mono = x.mean(axis=1).astype(np.float32)[: SR * 90]
    if len(mono) < SR * 4:
        return None
    onset = librosa.onset.onset_strength(y=mono, sr=SR)
    t = librosa.feature.tempo(onset_envelope=onset, sr=SR, start_bpm=110, max_tempo=220)
    return round(float(t[0]), 1)


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
        else:
            s = sources[c['source']]
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
            x = x[max(0, a - int(0.005 * SR)): min(len(x), b + int(0.05 * SR))]
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
                y, gain, capped = loudness_sfx(x, tmp)
                changes.append(f'mono; gain {gain:+.1f} dB to -1 dBTP' + (f' then held to {SFX_CEILING:.0f} LUFS momentary max' if capped else ''))
            else:
                y, gain, limited = loudness_music(x, tmp)
                changes.append(f'loudness normalised to {MUSIC_LUFS:.0f} LUFS (gain {gain:+.1f} dB' + (', peak limiter engaged' if limited else '') + ')')
            group_dir = os.path.join(audio, 'candidates', c['group'])
            os.makedirs(group_dir, exist_ok=True)
            out = os.path.join(group_dir, c['id'] + '.ogg')
            wav = os.path.join(tmp, 'final.wav'); write_f32(wav, y)
            run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', str(QUALITY[kind]), '-ar', str(SR),
                 '-map_metadata', '-1', '-metadata', f"title={c.get('title', '')}", '-metadata', f"artist={c.get('author', '')}", out])
            changes.append(f'encoded OGG Vorbis q{QUALITY[kind]}')
            meas = measure(out)
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
        if kind in ('music', 'sting'):
            item['bpm_est'] = bpm_of(final)
        if loop in ('whole', 'intro'):
            a = int(loop_start * SR)
            item['loop_start'] = round(loop_start, 3)
            item['loop_end'] = round(dur, 3)
            item['seam'] = seam(final, a, len(final))
        catalog[c['id']] = item
        print(f"{c['id']:34} {dur:7.2f}s {item['bytes'] / 1024:7.0f}KB  I={meas['lufs_i']:6.1f} TP={meas['true_peak']:5.1f} "
              f"Mmax={meas['lufs_m_max']:6.1f} bpm={item.get('bpm_est')} seam={item.get('seam')}", flush=True)

    order = [c['id'] for c in cands]
    items = [catalog[i] for i in order if i in catalog]
    json.dump({'items': items}, open(cat_path, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
