#!/usr/bin/env python3
"""Cut, normalise and encode every candidate, then measure it.

Usage:  python3 -I process.py <tools-dir> <cache-dir> <audio-dir> [candidate-id ...] [--meta]
(--meta: only copy title/mood/star/slot/bpm text from candidates.json into catalog.json, no audio work)

Reads  <tools-dir>/candidates.json + sources.json, the downloads in <cache-dir> (from fetch.py)
and the generated WAVs in <cache-dir>/gen (from synth.mjs).  Writes OGG Vorbis files to
<audio-dir>/candidates/<group>/<id>.ogg and the measurements to <audio-dir>/catalog.json.

Loudness rules (EBU R128 via ffmpeg's ebur128 filter), checked on the encoded OGG itself:
  music  : integrated -16 LUFS, true peak <= -1 dBTP (a 4x-oversampled limiter only when needed)
  sting  : same as music but -16 LUFS is measured on the short clip (stereo kept)
  sfx    : true peak -1.0 .. about -1.25 dBTP (mono); loudness is NOT matched between sounds
Music loops are never trimmed (that would break the loop); stings and sfx lose leading and
trailing silence.  The only edit a loop gets is `trim_edges`: up to ~80 ms of digital silence that an MP3 decoder
adds at the start/end of a file is dropped so the wrap has no gap.  sfx and stings also get a 20 Hz DC blocker
(several sources carry a DC offset that eats headroom and thumps at the start/end) and a short fade-in/out.
Optional per-candidate fields: segment [from, to] (s), event N / event_tail / event_gap / event_thr (pick the N-th separate
sound of a recording), intro (file played once before the loop), fade_in / fade_out (s), repeat, trim, head_db / tail_db
(silence thresholds), af (an ffmpeg -af chain applied first, e.g. pitch), declick (ms of fade on both ends of a loop that
ends mid-waveform), trim_edges (drop an MP3 decoder's padding from a loop).  Every edit is listed in item['changes'].
sfx/sting items also get punch_db and preview_gain_db (the level the listening page plays them at).
BPM needs librosa (run with the venv python), otherwise it is left blank.
Run with:  <venv>/bin/python -I process.py ...   (-I: nothing from the current folder is imported)
"""
import json, math, os, re, shutil, subprocess, sys, tempfile
import numpy as np

SR = 44100
MUSIC_LUFS = -16.0
PEAK_DBTP = -1.0
MUSIC_CEILING = -2.0  # pre-encode peak ceiling for music: Vorbis can overshoot by up to ~1 dB
QUALITY = {'music': 3, 'sting': 4, 'sfx': 4}
# A tempo is only known up to half/double time (75 or 150?).  Ties are settled on the value closest to the tempo the category
# aims for (spec 15: ground 110-130, shelter 80-90; boss and shop have no spec, so a mid value is used).
BPM_REF = {'music-ground': 120.0, 'music-shelter': 85.0, 'music-boss': 120.0, 'music-shop': 105.0}


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(' '.join(cmd) + '\n' + r.stderr[-2000:])
    return r


def decode(path, channels, af=None):
    """Decode to float32 at 44.1 kHz.  `af` is an optional ffmpeg -af chain (pitch/EQ edits), applied first."""
    cmd = ['ffmpeg', '-v', 'error', '-i', path] + (['-af', af] if af else []) + \
          ['-f', 'f32le', '-ac', str(channels), '-ar', str(SR), '-']
    r = subprocess.run(cmd, capture_output=True)
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
    r = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', path, '-filter_complex', 'ebur128=peak=true:framelog=info',
                        '-f', 'null', '-'], capture_output=True, text=True)
    log = r.stderr
    m = re.findall(r'M:\s*(-?[\d.]+|-inf)', log)
    mmax = max([float(v) for v in m if v != '-inf'] or [-120.0])
    summ = log[log.rfind('Summary:'):]
    i = re.search(r'I:\s*(-?[\d.]+|-inf) LUFS', summ)
    tp = re.search(r'Peak:\s*(-?[\d.]+|-inf) dBFS', summ)
    f = lambda v: -120.0 if v is None or v.group(1) == '-inf' else float(v.group(1))
    return {'lufs_i': f(i), 'true_peak': f(tp), 'lufs_m_max': mmax}


def dc_block(x, fc=20.0):
    """Zero-phase 2nd-order high-pass: removes DC offset and sub-20 Hz rumble without changing the timing."""
    from scipy.signal import butter, sosfiltfilt
    sos = butter(2, fc / (SR / 2), btype='highpass', output='sos')
    n = len(x)
    if n < 64:
        return x - x.mean(axis=0, keepdims=True)
    pad = min(n - 1, int(0.05 * SR))
    y = sosfiltfilt(sos, x, axis=0, padlen=pad)
    return y.astype(np.float32)


def fade_edges(x, fade_in=0.0, fade_out=0.0):
    x = x.copy()
    a = min(len(x) // 2, int(fade_in * SR))
    b = min(len(x) // 2, int(fade_out * SR))
    if a > 0:
        x[:a] *= np.linspace(0, 1, a, endpoint=False)[:, None]
    if b > 0:
        x[-b:] *= np.linspace(1, 0, b)[:, None]
    return x


def trim_loop_edges(x, max_ms=80, floor_db=-80):
    """Drop digital silence (an MP3 decoder's padding) from the very start/end of a loop.  Silence longer than
    max_ms is musical (a rest) and is kept.  Returns (trimmed, head_ms, tail_ms)."""
    mono = np.abs(x).max(axis=1)
    thr = 10 ** (floor_db / 20)
    loud = np.where(mono > thr)[0]
    if len(loud) == 0:
        return x, 0.0, 0.0
    head, tail = loud[0], len(x) - 1 - loud[-1]
    lim = int(max_ms / 1000 * SR)
    a = head if head <= lim else 0
    b = tail if tail <= lim else 0
    return x[a:len(x) - b], a / SR * 1000, b / SR * 1000


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
    ladder = ([0.0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4, 0.5, -0.5, 0.6, -0.6, -0.8, -1.0, -1.5] if kind == 'sfx'
              else [0.0, -0.4, -0.8, -1.2, -1.6, -2.0])
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
    w50 = int(0.05 * SR)
    local = np.concatenate([d[:w50], d[-w50:]])
    click_ratio = jump / (float(np.percentile(local, 99)) + 1e-9)   # > ~2.5: a hard cut, audible as a tick
    db = lambda s: 20 * math.log10(math.sqrt(float(np.mean(s ** 2))) + 1e-9)
    levels = [db(mono[i:i + w]) for i in range(0, len(mono) - w, w)]
    gap = min(db(mono[:w]), db(mono[-w:])) - float(np.median(levels))
    return {'click_pct': round(click_pct, 2), 'click_ratio': round(click_ratio, 2), 'gap_db': round(gap, 1),
            'ok': bool(click_ratio < 2.5 and gap > -18)}


def bpm_of(path, lo=55, hi=215, ref=110.0):
    """Tempo of a loop file.  Tries every whole number of beats K that fits the length (bpm = 60*K/length), keeps
    the one whose beat period repeats best in the onset envelope (circular autocorrelation at 1, 2, 4, 8 beats) and
    settles half/double-tempo ties on the value closest to `ref` (BPM_REF per category).  Matches all 7 files whose authors label the
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


def build(c, sources, fetch_log, generated, cache, audio):
    """Process one candidate; returns the catalog item.  All edits are listed (in Korean) in item['changes']."""
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
    x = decode(path, ch, c.get('af'))
    if c.get('af'):
        changes.append(f"ffmpeg 필터 적용: {c['af']}")
    dur_src = len(x) / SR
    loop = c.get('loop', 'none')
    loop_start = 0.0
    if kind != 'music':
        x = dc_block(x)   # before any silence detection: a DC offset hides the silence
    edge_note = None
    if kind == 'music' and c.get('trim_edges'):
        x, h_ms, t_ms = trim_loop_edges(x)
        if h_ms or t_ms:
            edge_note = f'디코더가 붙인 무음(앞 {h_ms:.0f}ms, 뒤 {t_ms:.0f}ms)을 잘라 반복 틈 제거'
    if c.get('segment'):
        a, b = c['segment']
        x = x[int(a * SR): int(b * SR) if b else None]
        changes.append(f'원본 {a:.2f}–{(b or dur_src):.2f}초 구간만 사용')
    if c.get('event') is not None:
        segs = events(x, gap=c.get('event_gap', 0.12), thr_db=c.get('event_thr', -38))
        a, b = segs[c['event']]
        x = x[max(0, a - int(0.005 * SR)): min(len(x), b + int(c.get('event_tail', 0.05) * SR))]
        changes.append(f"파일 안의 소리 {len(segs)}개 중 {c['event'] + 1}번째만 사용")
    if c.get('intro'):
        intro = decode(find(c['intro']), ch, c.get('af'))
        if c.get('trim_edges'):
            intro, _, _ = trim_loop_edges(intro)
        loop_start = len(intro) / SR
        x = np.concatenate([intro, x])
        changes.append(f'인트로 파일과 반복 파일을 이어 붙임 (반복은 {loop_start:.3f}초부터)')
    if edge_note:
        changes.append(edge_note)
    if c.get('repeat'):
        x = np.concatenate([x] * c['repeat'])
        changes.append(f"짧은 반복곡이라 {c['repeat']}번 이어 붙임")
    if kind != 'music' and c.get('trim', True):
        before = len(x)
        x, _ = trim_silence(x, head_db=c.get('head_db', -45), tail_db=c.get('tail_db', -60))
        if before - len(x) > 0.01 * SR:
            changes.append(f'앞뒤 무음 {(before - len(x)) / SR:.2f}초 제거')
    if kind != 'music':
        fin = c.get('fade_in', 0.002 if kind == 'sfx' else 0.004)
        x = fade_edges(x, fade_in=fin)
        changes.append('20Hz 이하 제거(직류 성분 제거)')
        if c.get('fade_in'):
            changes.append(f"{c['fade_in'] * 1000:.0f}ms 페이드인")
    if c.get('fade_out'):
        x = fade_edges(x, fade_out=c['fade_out'])
        changes.append(f"{c['fade_out']}초 페이드아웃")
    if c.get('declick'):   # the file ends mid-waveform, so the wrap would tick: a few ms of fade on both ends removes it
        ms = c['declick']
        x = fade_edges(x, fade_in=ms / 1000, fade_out=ms / 1000)
        changes.append(f'반복 이음새의 딸깍 소리를 없애려고 맨 앞뒤 {ms}ms를 페이드')

    with tempfile.TemporaryDirectory() as tmp:
        if kind == 'sfx':
            y, gain = loudness_sfx(x, tmp)
            changes.append(f'모노로 변환, 최대 음량(true peak)을 -1 dBTP로 맞춤 (이득 {gain:+.1f} dB)')
        else:
            y, gain, limited = loudness_music(x, tmp)
            changes.append(f'음량을 {MUSIC_LUFS:.0f} LUFS로 맞춤 (이득 {gain:+.1f} dB' + (', 피크 리미터 사용' if limited else '') + ')')
        group_dir = os.path.join(audio, 'candidates', c['group'])
        os.makedirs(group_dir, exist_ok=True)
        out = os.path.join(group_dir, c['id'] + '.ogg')
        meas, trim = encode(y, out, kind, (c.get('title', ''), c.get('author', '')), tmp)
        changes.append(f'OGG Vorbis q{QUALITY[kind]}로 변환' + (f' (true peak 목표를 지키려고 이득 {trim:+.2f} dB 조정)' if abs(trim) > 0.01 else ''))
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
        if loop_start > 0:   # tempo of the repeating part only (not the one-off intro)
            with tempfile.TemporaryDirectory() as t2:
                part = os.path.join(t2, 'loop.wav')
                write_f32(part, final[int(loop_start * SR):])
                est = bpm_of(part, ref=BPM_REF.get(c['group'], 110.0))
        else:
            est = bpm_of(out, ref=BPM_REF.get(c['group'], 110.0))
        item['bpm_est'] = est[0] if est else None
    if kind in ('sfx', 'sting'):
        m = final.mean(axis=1)
        w = int(0.1 * SR)
        if len(m) > w:
            csum = np.concatenate([[0.0], np.cumsum(m.astype(np.float64) ** 2)])
            rms = np.sqrt((csum[w:] - csum[:-w]) / w)
        else:
            rms = np.array([np.sqrt((m.astype(np.float64) ** 2).mean())])
        item['punch_db'] = round(20 * math.log10(float(rms.max()) + 1e-9), 1)   # loudest 100 ms, dBFS
        # preview level for the listening page: sounds are peak-normalised, so a sustained sound feels much louder than a
        # gunshot.  Playing every sfx at the same loudest-100-ms level (-20 dBFS) makes them comparable (files stay at -1 dBTP).
        item['preview_gain_db'] = round(min(0.0, -20.0 - item['punch_db']), 1)
    if loop in ('whole', 'intro'):
        a = int(loop_start * SR)
        item['loop_start'] = round(loop_start, 3)
        item['loop_end'] = round(dur, 3)
        item['seam'] = seam(final, a, len(final))
        bpm = c.get('bpm') or item.get('bpm_est')
        if bpm:   # a clean loop is a whole number of beats long
            beats = (dur - loop_start) * bpm / 60
            item['loop_beats'] = round(beats, 2)
    return item


META_KEYS = ('title', 'mood', 'star', 'slot', 'slot_label', 'bpm')   # text fields: can be refreshed without re-encoding


def main():
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    tools, cache, audio = args[:3]
    only = set(args[3:])
    meta_only = '--meta' in flags   # copy the text fields of candidates.json into catalog.json, no audio work
    cands = json.load(open(os.path.join(tools, 'candidates.json')))['candidates']
    sources = {s['id']: s for s in json.load(open(os.path.join(tools, 'sources.json')))['sources']}
    fetch_log = json.load(open(os.path.join(cache, 'fetch-log.json')))
    generated = json.load(open(os.path.join(cache, 'gen', 'generated.json')))
    cat_path = os.path.join(audio, 'catalog.json')
    catalog = {c['id']: c for c in json.load(open(cat_path))['items']} if os.path.exists(cat_path) else {}
    order = [c['id'] for c in cands]

    def save():   # after every item, so a crash never loses finished work
        items = [catalog[i] for i in order if i in catalog]
        tmp = cat_path + '.tmp'
        json.dump({'items': items}, open(tmp, 'w'), ensure_ascii=False, indent=1)
        os.replace(tmp, cat_path)

    if meta_only:
        for c in cands:
            if c['id'] in catalog and (not only or c['id'] in only):
                for k in META_KEYS:
                    if k in c:
                        catalog[c['id']][k] = c[k]
                    else:
                        catalog[c['id']].pop(k, None)
        save()
        print('catalog.json text fields refreshed')
        return

    failed = []
    for c in cands:
        if only and c['id'] not in only:
            continue
        try:
            item = build(c, sources, fetch_log, generated, cache, audio)
        except Exception as e:   # one bad candidate must not stop the rest
            failed.append(c['id'])
            print(f"FAIL {c['id']}: {str(e)[-300:]}", flush=True)
            continue
        catalog[c['id']] = item
        print(f"{c['id']:34} {item['seconds']:7.2f}s {item['bytes'] / 1024:7.0f}KB  I={item['lufs_i']:6.1f} TP={item['true_peak']:5.1f} "
              f"bpm={c.get('bpm') or item.get('bpm_est')} beats={item.get('loop_beats')} seam={item.get('seam')}", flush=True)
        save()
    save()
    if failed:
        print('FAILED:', ' '.join(failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
